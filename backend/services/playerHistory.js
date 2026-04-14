import { runCompanyGraphql } from "./companyApi.js";

export const PLAYER_HISTORY_VIEW =
  process.env.PLAYER_HISTORY_VIEW || "player_event";

export const PLAYER_HISTORY_MATCH_COLUMN =
  process.env.PLAYER_HISTORY_MATCH_COLUMN || "player_id";

function normalizeHistoryIdentityKey(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

/**
 * Loads season rows from the history view using name_home_dob from the current
 * ncaa_players_d1_male row for the given unique_id.
 * @throws {Error} code PGRST116 when no current player row exists
 */
export async function fetchPlayerSeasonHistory(uniqueId) {
  const safeId = String(uniqueId || "").replace(/"/g, '\\"');
  const gql = `
    query FetchPlayerHistory {
      player(where: { id: { _eq: "${safeId}" } }, limit: 1) {
        id
        player_event(order_by: { event: { name: asc } }) {
          games_played
          pts_per_game
          reb_per_game
          ast_per_game
          stl_per_game
          blk_per_game
          ts_pct
          efg_pct
          usg_pct
          fg_pct
          three_pt_pct
          ft_pct
          event { name league { name } }
          team { name }
          player { position }
        }
      }
    }
  `;
  const data = await runCompanyGraphql(gql);
  const player = data?.player?.[0];
  if (!player) {
    const err = new Error("Player not found");
    err.code = "PGRST116";
    throw err;
  }
  const identityKey = normalizeHistoryIdentityKey(player?.id);
  const seasons = (player?.player_event || []).map((row) => ({
    season: row?.event?.name || "",
    team: row?.team?.name || "",
    league: row?.event?.league?.name || "",
    position: row?.player?.position || "",
    g: row?.games_played ?? null,
    pts_g: row?.pts_per_game ?? null,
    reb_g: row?.reb_per_game ?? null,
    ast_g: row?.ast_per_game ?? null,
    stl_g: row?.stl_per_game ?? null,
    blk_g: row?.blk_per_game ?? null,
    ts: row?.ts_pct ?? null,
    efg: row?.efg_pct ?? null,
    usg: row?.usg_pct ?? null,
    fg: row?.fg_pct ?? null,
    c_3pt: row?.three_pt_pct ?? null,
    ft: row?.ft_pct ?? null,
  }));

  return {
    seasons,
    identityMissing: false,
    matchedBy: PLAYER_HISTORY_MATCH_COLUMN,
  };
}

const COMPACT_SEASON_FIELDS = [
  "season",
  "team",
  "g",
  "pts_g",
  "reb_g",
  "ast_g",
  "stl_g",
  "blk_g",
  "ts",
  "efg",
  "usg",
  "fg",
  "c_3pt",
  "ft",
  "class",
  "league",
  "position",
];

/** Smaller payload for LLM prompts (full rows can be huge). */
export function compactSeasonHistoryForLLM(seasons) {
  if (!Array.isArray(seasons)) return [];
  return seasons.map((row) => {
    const o = {};
    for (const k of COMPACT_SEASON_FIELDS) {
      if (row[k] !== undefined && row[k] !== null) o[k] = row[k];
    }
    return o;
  });
}
