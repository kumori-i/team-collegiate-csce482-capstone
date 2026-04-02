import { supabase } from "../supabase.js";

export const PLAYER_HISTORY_VIEW =
  process.env.PLAYER_HISTORY_VIEW || "v_ncaa_players_d1_male_season_history";

export const PLAYER_HISTORY_MATCH_COLUMN =
  process.env.PLAYER_HISTORY_MATCH_COLUMN || "name_home_dob";

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
  const matchCol = PLAYER_HISTORY_MATCH_COLUMN;
  const { data: current, error: playerError } = await supabase
    .from("ncaa_players_d1_male")
    .select(matchCol)
    .eq("unique_id", uniqueId)
    .single();

  if (playerError) {
    if (playerError.code === "PGRST116") {
      const err = new Error("Player not found");
      err.code = "PGRST116";
      throw err;
    }
    throw new Error(playerError.message || "Identity lookup failed");
  }

  const identityKey = normalizeHistoryIdentityKey(current?.[matchCol]);
  if (!identityKey) {
    return {
      seasons: [],
      identityMissing: true,
      matchedBy: matchCol,
    };
  }

  const { data: seasons, error } = await supabase
    .from(PLAYER_HISTORY_VIEW)
    .select("*")
    .eq(matchCol, identityKey)
    .order("season", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    seasons: seasons || [],
    identityMissing: false,
    matchedBy: matchCol,
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
