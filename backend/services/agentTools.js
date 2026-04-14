import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCompanyGraphql } from "./companyApi.js";

const SIMILARITY_METRICS = ["psp", "c_3pe", "fgs", "ram", "dsi", "usg"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_ROOT = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : process.env.VERCEL
    ? path.resolve("/tmp/cerebro-cache")
    : path.resolve(__dirname, "../.cache");
const CACHE_FILE = path.resolve(CACHE_ROOT, "top90_stats.json");
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const ELITE_PERCENTILE = 0.9;

const ELITE_STAT_METRICS = [
  "pts_g",
  "reb_g",
  "ast_g",
  "stl_g",
  "blk_g",
  "fg",
  "c_3pt",
  "ft",
  "efg",
  "ts",
  "usg",
  "ppp",
  "a_to",
  "orb_40",
  "ram",
  "c_ram",
  "psp",
  "c_3pe",
  "dsi",
  "fgs",
  "bms",
];

const METRIC_SELECT_LIST = ELITE_STAT_METRICS.join(", ");

const EVENT_ALLOWLIST = (process.env.COMPANY_ALLOWED_EVENTS || "")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const METRIC_TO_COMPANY_FIELD = {
  pts_g: "pts_per_game",
  reb_g: "reb_per_game",
  ast_g: "ast_per_game",
  stl_g: "stl_per_game",
  blk_g: "blk_per_game",
  fg: "fg_pct",
  c_3pt: "three_pt_pct",
  ft: "ft_pct",
  efg: "efg_pct",
  ts: "ts_pct",
  usg: "usg_pct",
  ppp: "ppp",
  a_to: "ast_tov_ratio",
  orb_40: "orb_per_40",
  ram: "ram",
  c_ram: "c_ram",
  psp: "psp",
  c_3pe: "three_pe",
  dsi: "dsi",
  fgs: "fgs",
  bms: "ppp",
};

const COMPANY_PLAYER_FIELDS = `
  id
  name
  position
  player_event(limit: 8, order_by: { games_played: desc }) {
    games_played
    pts_per_game
    reb_per_game
    ast_per_game
    stl_per_game
    blk_per_game
    fg_pct
    three_pt_pct
    ft_pct
    efg_pct
    ts_pct
    usg_pct
    ppp
    ast_tov_ratio
    orb_per_40
    ram
    c_ram
    psp
    three_pe
    dsi
    fgs
    event { name league { name } }
    team { name }
  }
`;

const eventIsAllowed = (eventName = "") =>
  EVENT_ALLOWLIST.length === 0 || EVENT_ALLOWLIST.includes(String(eventName));

const pickPrimaryEventRow = (rows = []) =>
  rows.find((row) => eventIsAllowed(row?.event?.name)) || rows[0] || null;

const mapCompanyRowToPlayer = (playerRow = {}) => {
  const eventRows = Array.isArray(playerRow?.player_event)
    ? playerRow.player_event
    : [];
  const primary = pickPrimaryEventRow(eventRows) || {};

  return {
    unique_id: playerRow?.id || "",
    name_split: playerRow?.name || "",
    team: primary?.team?.name || "",
    position: playerRow?.position || "",
    league: primary?.event?.league?.name || "",
    class: "",
    pts_g: primary?.pts_per_game ?? null,
    reb_g: primary?.reb_per_game ?? null,
    ast_g: primary?.ast_per_game ?? null,
    fg: primary?.fg_pct ?? null,
    c_3pt: primary?.three_pt_pct ?? null,
    ft: primary?.ft_pct ?? null,
    stl_g: primary?.stl_per_game ?? null,
    blk_g: primary?.blk_per_game ?? null,
    to_g: null,
    min_g: null,
    g: primary?.games_played ?? null,
    c_2pt: null,
    efg: primary?.efg_pct ?? null,
    ts: primary?.ts_pct ?? null,
    usg: primary?.usg_pct ?? null,
    ppp: primary?.ppp ?? null,
    orb_g: null,
    drb_g: null,
    pf_g: null,
    a_to: primary?.ast_tov_ratio ?? null,
    ram: primary?.ram ?? null,
    c_ram: primary?.c_ram ?? null,
    psp: primary?.psp ?? null,
    c_3pe: primary?.three_pe ?? null,
    dsi: primary?.dsi ?? null,
    fgs: primary?.fgs ?? null,
    bms: null,
    orb_40: primary?.orb_per_40 ?? null,
  };
};

const buildWhereFilters = ({ query = "", team = "", position = "" } = {}) => {
  const parts = [];
  if (query) parts.push(`{ name: { _ilike: "%${query.replace(/"/g, '\\"')}%" } }`);
  if (position)
    parts.push(
      `{ position: { _ilike: "%${position.replace(/"/g, '\\"')}%" } }`,
    );
  if (team) {
    const safeTeam = team.replace(/"/g, '\\"');
    parts.push(`{ player_event: { team: { name: { _ilike: "%${safeTeam}%" } } } }`);
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return `where: ${parts[0]}`;
  return `where: { _and: [${parts.join(",")}] }`;
};

const normalizePositionFilter = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const text = raw.toLowerCase();
  if (/\bpoint guard\b|\bpg\b/.test(text)) return "PG";
  if (/\bshooting guard\b|\bsg\b/.test(text)) return "SG";
  if (/\bsmall forward\b|\bsf\b/.test(text)) return "SF";
  if (/\bpower forward\b|\bpf\b/.test(text)) return "PF";
  if (/\bcenter\b|\bc\b/.test(text)) return "C";
  if (/\bguard\b|\bg\b/.test(text)) return "G";
  if (/\bforward\b|\bf\b/.test(text)) return "F";
  return raw;
};

const normalizePercentLike = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const normalizeSimilarityStat = (metric, value) => {
  if (metric === "c_3pe" || metric === "usg") {
    return normalizePercentLike(value);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isPortalAvailable = (player = {}) => {
  if (typeof player.portal_available === "boolean")
    return player.portal_available;
  if (typeof player.in_portal === "boolean") return player.in_portal;
  if (typeof player.transfer_portal === "boolean")
    return player.transfer_portal;

  const portalLikeEntries = Object.entries(player).filter(([key]) =>
    /portal|transfer/i.test(String(key)),
  );
  for (const [, rawValue] of portalLikeEntries) {
    if (typeof rawValue === "boolean") return rawValue;
    if (typeof rawValue === "number") return rawValue > 0;
    if (typeof rawValue === "string") {
      const text = rawValue.toLowerCase().trim();
      if (
        /\byes\b|\btrue\b|\bavailable\b|\bin portal\b|\btransfer portal\b/.test(
          text,
        )
      ) {
        return true;
      }
      if (
        /\bno\b|\bfalse\b|\bnot available\b|\bnot in portal\b|\binactive\b/.test(
          text,
        )
      ) {
        return false;
      }
    }
  }

  const combinedText = [
    player.team,
    player.league,
    player.class,
    player.status,
    player.roster_status,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return (
    /\btransfer portal\b/.test(combinedText) ||
    /\bin portal\b/.test(combinedText)
  );
};

const scoreSimilarity = (target, candidate, minMaxByMetric) => {
  let total = 0;
  let count = 0;
  for (const metric of SIMILARITY_METRICS) {
    const targetValue = normalizeSimilarityStat(metric, target?.[metric]);
    const candidateValue = normalizeSimilarityStat(metric, candidate?.[metric]);
    if (!Number.isFinite(targetValue) || !Number.isFinite(candidateValue)) {
      continue;
    }

    const bounds = minMaxByMetric[metric] || { min: 0, max: 0 };
    const range = Math.max(1e-6, bounds.max - bounds.min);
    const distance = Math.abs(targetValue - candidateValue) / range;
    const similarity = Math.max(0, 1 - distance);
    total += similarity;
    count += 1;
  }
  if (!count) return -1;
  return total / count;
};

const percentile = (values = [], p = 0.9) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[index];
};

const ensureCacheDir = async () => {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
};

const readPercentileCache = async () => {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writePercentileCache = async (payload) => {
  await ensureCacheDir();
  await writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf-8");
};

const fetchMetricRows = async ({
  minGames = 0,
  limit = 1200,
  position = "",
  team = "",
  orderByMetric = "",
} = {}) => {
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const metricField = METRIC_TO_COMPANY_FIELD[orderByMetric] || "pts_per_game";
  const where = [
    `{ games_played: { _gte: ${safeMinGames} } }`,
    ...(position
      ? [
          `{ player: { position: { _ilike: "%${position.replace(/"/g, '\\"')}%" } } }`,
        ]
      : []),
    ...(team
      ? [`{ team: { name: { _ilike: "%${team.replace(/"/g, '\\"')}%" } } }`]
      : []),
  ];
  const query = `
    query FetchMetricRows {
      player_event(
        where: { _and: [${where.join(",")}] }
        order_by: [{ ${metricField}: desc_nulls_last }]
        limit: ${Math.max(50, Number(limit) || 200)}
      ) {
        games_played
        pts_per_game
        reb_per_game
        ast_per_game
        stl_per_game
        blk_per_game
        fg_pct
        three_pt_pct
        ft_pct
        efg_pct
        ts_pct
        usg_pct
        ppp
        ast_tov_ratio
        orb_per_40
        ram
        c_ram
        psp
        three_pe
        dsi
        fgs
        event { name league { name } }
        team { name }
        player { id name position }
      }
    }
  `;
  const data = await runCompanyGraphql(query);
  return (data?.player_event || [])
    .filter((row) => eventIsAllowed(row?.event?.name))
    .map((row) =>
      mapCompanyRowToPlayer({
        id: row?.player?.id,
        name: row?.player?.name,
        position: row?.player?.position,
        player_event: [row],
      }),
    );
};

const buildTopPercentileCache = async ({ minGames = 5 } = {}) => {
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const rows = await fetchMetricRows({ minGames: safeMinGames, limit: 3500 });
  const thresholds = {};
  for (const metric of ELITE_STAT_METRICS) {
    const threshold = percentile(
      rows.map((row) => row?.[metric]).filter((value) => value != null),
      ELITE_PERCENTILE,
    );
    if (threshold != null) {
      thresholds[metric] = Number(threshold);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    minGames: safeMinGames,
    percentile: ELITE_PERCENTILE,
    sampleSize: rows.length,
    thresholds,
  };
  await writePercentileCache(payload);
  return payload;
};

const getTopPercentileCache = async ({ minGames = 5 } = {}) => {
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const cache = await readPercentileCache();
  const stale =
    !cache?.generatedAt ||
    Date.now() - new Date(cache.generatedAt).getTime() > CACHE_TTL_MS;
  const wrongMinGames = Number(cache?.minGames) !== safeMinGames;
  const missingThresholds =
    !cache?.thresholds ||
    ELITE_STAT_METRICS.some(
      (metric) => !Number.isFinite(cache.thresholds[metric]),
    );

  if (cache && !stale && !wrongMinGames && !missingThresholds) {
    return cache;
  }

  return buildTopPercentileCache({ minGames: safeMinGames });
};

export const searchPlayers = async ({
  query = "",
  team = "",
  position = "",
  limit = 20,
}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePosition = normalizePositionFilter(position);
  const filterClause = buildWhereFilters({
    query,
    team,
    position: safePosition,
  });
  const gql = `
    query SearchPlayers {
      player(${filterClause}${filterClause ? "," : ""} limit: ${safeLimit}) {
        ${COMPANY_PLAYER_FIELDS}
      }
    }
  `;
  const data = await runCompanyGraphql(gql);
  return (data?.player || []).map(mapCompanyRowToPlayer);
};

export const getPlayer = async (id) => {
  const safeId = String(id).replace(/"/g, '\\"');
  const gql = `
    query GetPlayer {
      player(where: { id: { _eq: "${safeId}" } }, limit: 1) {
        ${COMPANY_PLAYER_FIELDS}
      }
    }
  `;
  const data = await runCompanyGraphql(gql);
  const row = data?.player?.[0];
  if (!row) {
    throw new Error("Player lookup failed: player not found");
  }
  return mapCompanyRowToPlayer(row);
};

export const getSimilarPlayersById = async ({
  id,
  limit = 5,
  portalState = "any",
}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const targetPlayer = await getPlayer(id);
  const candidatePool = await fetchMetricRows({
    minGames: 1,
    limit: 1200,
    position: targetPlayer.position || "",
  });

  const pool = (Array.isArray(candidatePool) ? candidatePool : [])
    .filter((candidate) => candidate?.unique_id !== id)
    .filter(
    (candidate) => {
      if (portalState === "portal_only") return isPortalAvailable(candidate);
      if (portalState === "non_portal_only")
        return !isPortalAvailable(candidate);
      return true;
    },
  );
  if (pool.length === 0) {
    return { player: targetPlayer, players: [] };
  }

  const minMaxByMetric = {};
  for (const metric of SIMILARITY_METRICS) {
    const values = [targetPlayer, ...pool]
      .map((row) => normalizeSimilarityStat(metric, row?.[metric]))
      .filter((value) => Number.isFinite(value));
    minMaxByMetric[metric] =
      values.length === 0
        ? { min: 0, max: 0 }
        : { min: Math.min(...values), max: Math.max(...values) };
  }

  const players = pool
    .map((candidate) => ({
      player: candidate,
      similarity: scoreSimilarity(targetPlayer, candidate, minMaxByMetric),
    }))
    .filter((entry) => entry.similarity >= 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, safeLimit)
    .map((entry) => entry.player);

  return { player: targetPlayer, players };
};

export const getTopPlayersByMetric = async ({
  metric = "pts_g",
  position = "",
  team = "",
  limit = 10,
  minGames = 5,
}) => {
  const allowlistedMetrics = new Set([
    "pts_g",
    "reb_g",
    "ast_g",
    "stl_g",
    "blk_g",
    "fg",
    "c_3pt",
    "ft",
    "efg",
    "ts",
    "usg",
    "ppp",
    "a_to",
    "orb_40",
    "ram",
    "c_ram",
    "psp",
    "c_3pe",
    "dsi",
    "fgs",
    "bms",
  ]);

  const safeMetric = allowlistedMetrics.has(metric) ? metric : "pts_g";
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safeMinGames = Number(minGames) || 0;
  const safePosition = normalizePositionFilter(position);
  const data = await fetchMetricRows({
    minGames: safeMinGames,
    limit: Math.max(50, safeLimit * 4),
    position: safePosition,
    team,
    orderByMetric: safeMetric,
  });
  const sorted = data
    .filter((row) => Number.isFinite(Number(row?.[safeMetric])))
    .sort((a, b) => Number(b[safeMetric]) - Number(a[safeMetric]))
    .slice(0, safeLimit);

  return {
    metric: safeMetric,
    players: sorted || [],
  };
};

export const getTopPlayersByPosition = async ({
  position = "",
  team = "",
  limit = 10,
  minGames = 5,
  focusMetric = "",
}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const safePosition = normalizePositionFilter(position);
  const cache = await getTopPercentileCache({ minGames: safeMinGames });
  const thresholds = cache?.thresholds || {};
  const thresholdFilters = ELITE_STAT_METRICS.filter((metric) =>
    Number.isFinite(thresholds[metric]),
  ).map((metric) => `${metric}.gte.${thresholds[metric]}`);

  const whereParts = [
    `name_split IS NOT NULL`,
    `name_split <> ''`,
    `g >= ${safeMinGames}`,
  ];
  if (safePosition) whereParts.push(`position ILIKE '%${safePosition}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  if (thresholdFilters.length) {
    whereParts.push(
      `(${thresholdFilters.map((f) => f.replace(".gte.", " >= ")).join(" OR ")})`,
    );
  }
  console.log(
    `[agentTools.getTopPlayersByPosition] sql=SELECT unique_id, name_split, team, position, class, league, g, ${METRIC_SELECT_LIST} FROM ncaa_players_d1_male WHERE ${whereParts.join(" AND ")} ORDER BY ${focusMetric || "elite_count DESC"} LIMIT ${safeLimit};`,
  );

  const data = await fetchMetricRows({
    minGames: safeMinGames,
    limit: Math.max(safeLimit * 8, 200),
    position: safePosition,
    team,
  });

  const ranked = (data || [])
    .map((player) => {
      const eliteMetrics = ELITE_STAT_METRICS.filter((metric) => {
        const threshold = thresholds[metric];
        const value = Number(player?.[metric]);
        return (
          Number.isFinite(threshold) &&
          Number.isFinite(value) &&
          value >= threshold
        );
      });
      return {
        ...player,
        eliteMetrics,
        eliteCount: eliteMetrics.length,
      };
    })
    .filter((player) => player.eliteCount > 0)
    .sort((a, b) => {
      if (
        focusMetric &&
        Number.isFinite(a[focusMetric]) &&
        Number.isFinite(b[focusMetric]) &&
        a[focusMetric] !== b[focusMetric]
      ) {
        return b[focusMetric] - a[focusMetric];
      }
      if (b.eliteCount !== a.eliteCount) {
        return b.eliteCount - a.eliteCount;
      }
      if (Number(b.ts) !== Number(a.ts)) {
        return Number(b.ts) - Number(a.ts);
      }
      return Number(b.ppp) - Number(a.ppp);
    })
    .slice(0, safeLimit);

  return {
    position,
    team,
    focusMetric: focusMetric || null,
    percentile: cache?.percentile ?? ELITE_PERCENTILE,
    generatedAt: cache?.generatedAt || null,
    sampleSize: cache?.sampleSize || 0,
    thresholds,
    players: ranked,
  };
};
