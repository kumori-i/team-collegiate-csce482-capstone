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
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const whereParts = [`name_split IS NOT NULL`, `name_split <> ''`];
  if (query) whereParts.push(`name_split ILIKE '%${query}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  if (position) whereParts.push(`position ILIKE '%${position}%'`);
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
  if (position) {
    supabaseQuery = supabaseQuery.ilike("position", `%${position}%`);
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
  const whereParts = [`name_split IS NOT NULL`, `name_split <> ''`, `g >= ${safeMinGames}`];
  if (position) whereParts.push(`position ILIKE '%${position}%'`);
  if (team) whereParts.push(`team ILIKE '%${team}%'`);
  console.log(
    `[agentTools.getTopPlayersByMetric] sql=SELECT unique_id, name_split, team, position, class, league, g, pts_g, reb_g, ast_g, usg, a_to, efg, ts, ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40 FROM ncaa_players_d1_male WHERE ${whereParts.join(" AND ")} ORDER BY ${safeMetric} DESC LIMIT ${safeLimit};`,
  );

  let supabaseQuery = supabase
    .from("ncaa_players_d1_male")
    .select("unique_id, name_split, team, position, class, league, g, pts_g, reb_g, ast_g, usg, a_to, efg, ts, ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40")
    .not("name_split", "is", null)
    .neq("name_split", "")
    .gte("g", safeMinGames)
    .order(safeMetric, { ascending: false, nullsFirst: false })
    .limit(safeLimit);

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
