# Supabase Setup

Run the SQL in [SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql) inside your Supabase SQL editor before using authenticated backend features and the usage dashboard.

This setup file creates:

- `users`
- `model_usage_events`

It does not create the `ncaa_players_d1_male` player dataset table. That table is expected to already exist in the connected Supabase project.

## Player season history

If you store past seasons in separate tables (for example `ncaa_players_d1_male_c_2024_25_ncaa_div_i`), run [PLAYER_SEASON_HISTORY.sql](./PLAYER_SEASON_HISTORY.sql) to create the view `v_ncaa_players_d1_male_season_history`. The backend exposes `GET /api/players/:id/history` using that view. Rows are matched by **`name_home_dob`** (same value on the current `ncaa_players_d1_male` row and each season snapshot), not `unique_id`. Override with env **`PLAYER_HISTORY_MATCH_COLUMN`** if your column name differs. Add new `UNION ALL` branches when you add another season table.
