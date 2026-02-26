import { supabase } from "../supabase.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYER_COLUMNS = `unique_id, name_split, team, position, league, class,
  pts_g, reb_g, ast_g, fg, c_3pt, ft, stl_g, blk_g, to_g,
  min_g, g, c_2pt, efg, ts, usg, ppp, orb_g, drb_g, pf_g, a_to,
  ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.resolve(__dirname, "../.cache/top90_stats.json");
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const ELITE_PERCENTILE = 0.9;

const ELITE_STAT_METRICS = ["psp", "c_3pe", "fgs", "a_to", "dsi"];

const METRIC_SELECT_LIST = ELITE_STAT_METRICS.join(", ");
const PLAYER_SIMILARITY_SELECT = `unique_id, name_split, team, position, class, league, g, ${METRIC_SELECT_LIST}`;

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

const buildTopPercentileCache = async ({ minGames = 5 } = {}) => {
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const selectClause = `g, ${METRIC_SELECT_LIST}`;
  const { data, error } = await supabase
    .from("ncaa_players_d1_male")
    .select(selectClause)
    .gte("g", safeMinGames);

  if (error) {
    throw new Error(`Percentile cache build failed: ${error.message}`);
  }

  const rows = data || [];
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
    ELITE_STAT_METRICS.some((metric) => !Number.isFinite(cache.thresholds[metric]));

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
  const whereParts = [`name_split IS NOT NULL`, `name_split <> ''`];
  if (query) whereParts.push(`name_split ILIKE '%${query}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  if (safePosition) whereParts.push(`position ILIKE '%${safePosition}%'`);
  console.log(
    `[agentTools.searchPlayers] sql=SELECT unique_id, name_split, team, position, league, class FROM ncaa_players_d1_male WHERE ${whereParts.join(" AND ")} LIMIT ${safeLimit};`,
  );

  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select("unique_id, name_split, team, position, league, class")
    .not("name_split", "is", null)
    .neq("name_split", "");

  if (query) {
    supabaseQuery = supabaseQuery.ilike("name_split", `%${query}%`);
  }
  if (team) {
    supabaseQuery = supabaseQuery.ilike("team", `%${team}%`);
  }
  if (safePosition) {
    supabaseQuery = supabaseQuery.ilike("position", `%${safePosition}%`);
  }

  supabaseQuery = supabaseQuery.limit(safeLimit);

  const { data, error } = await supabaseQuery;
  if (error) {
    throw new Error(`Player search failed: ${error.message}`);
  }
  return data || [];
};

export const getPlayer = async (id) => {
  console.log(
    `[agentTools.getPlayer] sql=SELECT ${PLAYER_COLUMNS.replace(/\s+/g, " ").trim()} FROM ncaa_players_d1_male WHERE unique_id = '${String(id)}' LIMIT 1;`,
  );
  const { data, error } = await supabase
    .from("ncaa_players_d1_male")
    .select(PLAYER_COLUMNS)
    .eq("unique_id", id)
    .single();

  if (error) {
    throw new Error(`Player lookup failed: ${error.message}`);
  }
  return data;
};

export const getSimilarPlayers = async ({
  playerId = "",
  position = "",
  team = "",
  limit = 10,
  minGames = 5,
}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safeMinGames = Math.max(0, Number(minGames) || 0);
  const safePosition = normalizePositionFilter(position);
  const target = await getPlayer(playerId);

  if (!target?.unique_id) {
    throw new Error("Target player not found for similarity search.");
  }

  const missingTargetMetrics = ELITE_STAT_METRICS.filter(
    (metric) => !Number.isFinite(Number(target?.[metric])),
  );
  if (missingTargetMetrics.length > 0) {
    throw new Error(
      `Target player is missing similarity metrics: ${missingTargetMetrics.join(", ")}`,
    );
  }

  const candidatePosition = safePosition || target.position || "";
  const whereParts = [
    `name_split IS NOT NULL`,
    `name_split <> ''`,
    `unique_id <> '${String(target.unique_id)}'`,
    `g >= ${safeMinGames}`,
  ];
  if (candidatePosition) whereParts.push(`position ILIKE '%${candidatePosition}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  console.log(
    `[agentTools.getSimilarPlayers] sql=SELECT ${PLAYER_SIMILARITY_SELECT} FROM ncaa_players_d1_male WHERE ${whereParts.join(" AND ")} LIMIT ${Math.max(safeLimit * 25, 250)};`,
  );

  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select(PLAYER_SIMILARITY_SELECT)
    .not("name_split", "is", null)
    .neq("name_split", "")
    .neq("unique_id", target.unique_id)
    .gte("g", safeMinGames)
    .limit(Math.max(safeLimit * 25, 250));

  if (candidatePosition) {
    supabaseQuery = supabaseQuery.ilike("position", `%${candidatePosition}%`);
  }
  if (team) {
    supabaseQuery = supabaseQuery.ilike("team", `%${team}%`);
  }

  const { data, error } = await supabaseQuery;
  if (error) {
    throw new Error(`Similar players query failed: ${error.message}`);
  }

  const rawCandidates = (data || []).filter((player) =>
    ELITE_STAT_METRICS.every((metric) => Number.isFinite(Number(player?.[metric]))),
  );

  const stats = Object.fromEntries(
    ELITE_STAT_METRICS.map((metric) => {
      const values = [target, ...rawCandidates]
        .map((p) => Number(p[metric]))
        .filter((v) => Number.isFinite(v));
      const mean = values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(values.length, 1);
      const stdDev = Math.sqrt(variance);
      return [metric, { stdDev: stdDev > 0 ? stdDev : 1 }];
    }),
  );

  const players = rawCandidates
    .map((candidate) => {
      const componentDiffs = ELITE_STAT_METRICS.map((metric) => {
        const targetValue = Number(target[metric]);
        const candidateValue = Number(candidate[metric]);
        const zDiff = Math.abs(candidateValue - targetValue) / stats[metric].stdDev;
        return {
          metric,
          targetValue,
          candidateValue,
          zDiff: Number(zDiff.toFixed(4)),
        };
      });
      const distance = Math.sqrt(
        componentDiffs.reduce((sum, part) => sum + part.zDiff ** 2, 0) /
          ELITE_STAT_METRICS.length,
      );
      return {
        ...candidate,
        similarityDistance: Number(distance.toFixed(4)),
        similarityScore: Number((1 / (1 + distance)).toFixed(4)),
        similarityBreakdown: componentDiffs,
      };
    })
    .sort((a, b) => {
      if (a.similarityDistance !== b.similarityDistance) {
        return a.similarityDistance - b.similarityDistance;
      }
      return Number(b.psp) - Number(a.psp);
    })
    .slice(0, safeLimit);

  return {
    targetPlayer: {
      unique_id: target.unique_id,
      name_split: target.name_split,
      team: target.team,
      position: target.position,
      class: target.class,
      league: target.league,
      g: target.g,
      psp: target.psp,
      c_3pe: target.c_3pe,
      fgs: target.fgs,
      a_to: target.a_to,
      dsi: target.dsi,
    },
    metricsUsed: ELITE_STAT_METRICS,
    filters: {
      position: candidatePosition || null,
      team: team || null,
      minGames: safeMinGames,
    },
    players,
  };
};

export const getTopPlayersByMetric = async ({
  metric = "psp",
  position = "",
  team = "",
  limit = 10,
  minGames = 5,
}) => {
  const allowlistedMetrics = new Set([
    "a_to",
    "psp",
    "c_3pe",
    "dsi",
    "fgs",
  ]);

  const safeMetric = allowlistedMetrics.has(metric) ? metric : "psp";
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safeMinGames = Number(minGames) || 0;
  const safePosition = normalizePositionFilter(position);
  const whereParts = [`name_split IS NOT NULL`, `name_split <> ''`, `g >= ${safeMinGames}`];
  if (safePosition) whereParts.push(`position ILIKE '%${safePosition}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  console.log(
    `[agentTools.getTopPlayersByMetric] sql=SELECT unique_id, name_split, team, position, class, league, g, psp, c_3pe, fgs, a_to, dsi FROM ncaa_players_d1_male WHERE ${whereParts.join(" AND ")} ORDER BY ${safeMetric} DESC LIMIT ${safeLimit};`,
  );

  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select("unique_id, name_split, team, position, class, league, g, psp, c_3pe, fgs, a_to, dsi")
    .not("name_split", "is", null)
    .neq("name_split", "")
    .gte("g", safeMinGames)
    .order(safeMetric, { ascending: false, nullsFirst: false })
    .limit(safeLimit);

  if (safePosition) {
    supabaseQuery = supabaseQuery.ilike("position", `%${safePosition}%`);
  }
  if (team) {
    supabaseQuery = supabaseQuery.ilike("team", `%${team}%`);
  }

  const { data, error } = await supabaseQuery;
  if (error) {
    throw new Error(`Top players query failed: ${error.message}`);
  }

  return {
    metric: safeMetric,
    players: data || [],
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

  const whereParts = [`name_split IS NOT NULL`, `name_split <> ''`, `g >= ${safeMinGames}`];
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

  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select(`unique_id, name_split, team, position, class, league, g, ${METRIC_SELECT_LIST}`)
    .not("name_split", "is", null)
    .neq("name_split", "")
    .gte("g", safeMinGames);

  if (safePosition) {
    supabaseQuery = supabaseQuery.ilike("position", `%${safePosition}%`);
  }
  if (team) {
    supabaseQuery = supabaseQuery.ilike("team", `%${team}%`);
  }
  if (thresholdFilters.length > 0) {
    supabaseQuery = supabaseQuery.or(thresholdFilters.join(","));
  }

  const { data, error } = await supabaseQuery.limit(Math.max(safeLimit * 5, 25));
  if (error) {
    throw new Error(`Effective players query failed: ${error.message}`);
  }

  const ranked = (data || [])
    .map((player) => {
      const eliteMetrics = ELITE_STAT_METRICS.filter((metric) => {
        const threshold = thresholds[metric];
        const value = Number(player?.[metric]);
        return Number.isFinite(threshold) && Number.isFinite(value) && value >= threshold;
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
      if (
        Number.isFinite(Number(b.psp)) &&
        Number.isFinite(Number(a.psp)) &&
        Number(b.psp) !== Number(a.psp)
      ) {
        return Number(b.psp) - Number(a.psp);
      }
      if (
        Number.isFinite(Number(b.dsi)) &&
        Number.isFinite(Number(a.dsi)) &&
        Number(b.dsi) !== Number(a.dsi)
      ) {
        return Number(b.dsi) - Number(a.dsi);
      }
      return 0;
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
