-- Season history: unions per-year NCAA D1 male tables into one queryable view.
-- Run in Supabase SQL Editor after your season snapshot tables exist.
-- Table names must match your project (see ncaa_players_d1_male_c_*_ncaa_div_i).

CREATE OR REPLACE VIEW v_ncaa_players_d1_male_season_history AS
SELECT t.*, '2021_22'::text AS season
FROM ncaa_players_d1_male_c_2021_22_ncaa_div_i t
UNION ALL
SELECT t.*, '2022_23'::text AS season
FROM ncaa_players_d1_male_c_2022_23_ncaa_div_i t
UNION ALL
SELECT t.*, '2023_24'::text AS season
FROM ncaa_players_d1_male_c_2023_24_ncaa_div_i t
UNION ALL
SELECT t.*, '2024_25'::text AS season
FROM ncaa_players_d1_male_c_2024_25_ncaa_div_i t
UNION ALL
SELECT t.*, '2025_26'::text AS season
FROM ncaa_players_d1_male_c_2025_26_ncaa_div_i t;

-- Expose to PostgREST clients (adjust if you use custom roles).
GRANT SELECT ON v_ncaa_players_d1_male_season_history TO anon, authenticated, service_role;
