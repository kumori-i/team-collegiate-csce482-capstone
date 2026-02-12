import { supabase } from "../supabase.js";

const PLAYER_COLUMNS = `unique_id, name_split, team, position, league, class,
  pts_g, reb_g, ast_g, fg, c_3pt, ft, stl_g, blk_g, to_g,
  min_g, g, c_2pt, efg, ts, usg, ppp, orb_g, drb_g, pf_g, a_to,
  ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40`;

export const searchPlayers = async ({
  query = "",
  team = "",
  position = "",
  limit = 20,
}) => {
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
  if (position) {
    supabaseQuery = supabaseQuery.ilike("position", `%${position}%`);
  }

  supabaseQuery = supabaseQuery.limit(Math.min(Math.max(Number(limit) || 20, 1), 100));

  const { data, error } = await supabaseQuery;
  if (error) {
    throw new Error(`Player search failed: ${error.message}`);
  }
  return data || [];
};

export const getPlayer = async (id) => {
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
  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select("unique_id, name_split, team, position, class, league, g, pts_g, reb_g, ast_g, usg, a_to, efg, ts, ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40")
    .not("name_split", "is", null)
    .neq("name_split", "")
    .gte("g", Number(minGames) || 0)
    .order(safeMetric, { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(Number(limit) || 10, 1), 100));

  if (position) {
    supabaseQuery = supabaseQuery.ilike("position", `%${position}%`);
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
