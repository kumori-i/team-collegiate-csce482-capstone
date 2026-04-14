import express from "express";
import { runReportAgent } from "../services/agentRunner.js";
import { fetchPlayerSeasonHistory } from "../services/playerHistory.js";
import {
  getPlayer,
  getSimilarPlayersById,
  searchPlayers,
} from "../services/agentTools.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Players
 *     description: Player search, detail lookup, and report generation.
 */

const clampLimit = (value, fallback = 5) =>
  Math.min(20, Math.max(1, Number.parseInt(value, 10) || fallback));

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
    const data = await searchPlayers({ query, limit });

    return res.json({
      players: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("Player search error:", err);
    return res.status(500).json({ error: "Player search failed." });
  }
});

/**
 * @swagger
 * /api/players/{id}/similar:
 *   get:
 *     tags: [Players]
 *     summary: Fetch similar players based on archetype-related metrics
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Similar players returned
 *       404:
 *         description: Player not found
 *       500:
 *         description: Similar player lookup failed
 */
router.get("/:id/similar", async (req, res) => {
  try {
    const { id } = req.params;
    const limit = clampLimit(req.query.limit, 5);
    const portalOnly =
      typeof req.query.portalOnly === "string"
        ? req.query.portalOnly.toLowerCase() !== "false"
        : true;

    const result = await getSimilarPlayersById({
      id,
      limit,
      portalState: portalOnly ? "portal_only" : "any",
    });
    const pool = Array.isArray(result?.players) ? result.players : [];
    if (!pool.length) {
      return res.json({ players: [] });
    }
    return res.json({ players: pool });
  } catch (err) {
    console.error("Similar player lookup error:", err);
    return res.status(500).json({ error: "Similar player lookup failed." });
  }
});

/**
 * @swagger
 * /api/players/{id}/history:
 *   get:
 *     tags: [Players]
 *     summary: Season-by-season rows matched by name/home/DOB (not unique_id)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Current-season unique_id; server resolves identity column from ncaa_players_d1_male
 *     responses:
 *       200:
 *         description: Season history rows (newest last); identityMissing if no match key on current row
 *       404:
 *         description: Player not found in current table
 *       500:
 *         description: Query failed (e.g. history view not created in Supabase)
 */
router.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await fetchPlayerSeasonHistory(id);
    return res.json({
      seasons: result.seasons,
      identityMissing: result.identityMissing,
      matchedBy: result.matchedBy,
    });
  } catch (err) {
    if (err.code === "PGRST116") {
      return res.status(404).json({ error: "Player not found" });
    }
    console.error("Player history error:", err);
    return res.status(500).json({
      error: "Failed to load season history from company API.",
    });
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
    const player = await getPlayer(id);

    return res.json({ player });
  } catch (err) {
    if (/not found/i.test(String(err?.message || ""))) {
      return res.status(404).json({ error: "Player not found" });
    }
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
