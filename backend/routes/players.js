import express from "express";
import { supabase } from "../supabase.js";
import { runReportAgent } from "../services/agentRunner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Players
 *     description: Player search, detail lookup, and report generation.
 */

const PLAYER_DETAIL_COLUMNS = `unique_id, name_split, team, position, league, class,
  pts_g, reb_g, ast_g, fg, c_3pt, ft, stl_g, blk_g, to_g,
  min_g, g, c_2pt, efg, ts, usg, ppp, orb_g, drb_g, pf_g, a_to,
  ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40`;

// Search players - similar to my-app home page functionality
// GET /api/players/search?query=john&limit=50
/**
 * @swagger
 * /api/players/search:
 *   get:
 *     tags: [Players]
 *     summary: Search players by name
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Name fragment to search by
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Max records when query is empty
 *     responses:
 *       200:
 *         description: Player list returned
 *       500:
 *         description: Search failed
 */
router.get("/search", async (req, res) => {
  try {
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : "";
    const limit = parseInt(req.query.limit, 10) || 50;

    let supabaseQuery = supabase
      .from("ncaa_players_d1_male")
      .select("unique_id, name_split, team, position, league, class")
      .not("name_split", "is", null)
      .neq("name_split", "");

    if (query) {
      supabaseQuery = supabaseQuery.ilike("name_split", `%${query}%`);
    } else {
      supabaseQuery = supabaseQuery.limit(limit);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to search players" });
    }

    return res.json({
      players: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("Player search error:", err);
    return res.status(500).json({ error: "Player search failed." });
  }
});

// Get player by unique_id - similar to my-app player detail page
// GET /api/players/:id
/**
 * @swagger
 * /api/players/{id}:
 *   get:
 *     tags: [Players]
 *     summary: Fetch player detail by unique id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player detail returned
 *       404:
 *         description: Player not found
 *       500:
 *         description: Lookup failed
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: player, error } = await supabase
      .from("ncaa_players_d1_male")
      .select(PLAYER_DETAIL_COLUMNS)
      .eq("unique_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Player not found" });
      }
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch player details" });
    }

    return res.json({ player });
  } catch (err) {
    console.error("Player lookup error:", err);
    return res.status(500).json({ error: "Player lookup failed." });
  }
});

// Generate AI scouting report for a player
// POST /api/players/report
/**
 * @swagger
 * /api/players/report:
 *   post:
 *     tags: [Players]
 *     summary: Generate a scouting report for provided player payload
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name_split, team]
 *             properties:
 *               unique_id:
 *                 type: string
 *               name_split:
 *                 type: string
 *               team:
 *                 type: string
 *               position:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report generated
 *       400:
 *         description: Required player fields missing
 *       500:
 *         description: Report generation failed
 */
router.post("/report", async (req, res) => {
  try {
    const playerInput =
      req.body && typeof req.body === "object" ? req.body : null;
    if (!playerInput || !playerInput.name_split || !playerInput.team) {
      return res.status(400).json({
        error: "Player payload with name_split and team is required.",
      });
    }

    const message = `Generate a scouting report for ${playerInput.name_split} (${playerInput.position || "N/A"}) on ${playerInput.team}. Focus on role, strengths, weaknesses, efficiency, and projection.`;
    const { report } = await runReportAgent({
      message,
      playerInput,
      playerId: playerInput.unique_id || "",
    });

    return res.json({ description: report });
  } catch (err) {
    console.error("Player report error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate scouting report." });
  }
});

export default router;
