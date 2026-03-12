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

const PLAYER_DETAIL_COLUMNS = "*";

const normalizePercentLike = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const normalizeStat = (metric, value) => {
  if (metric === "c_3pe" || metric === "usg") {
    return normalizePercentLike(value);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const SIMILARITY_METRICS = ["psp", "c_3pe", "fgs", "ram", "dsi", "usg"];

const clampLimit = (value, fallback = 5) =>
  Math.min(20, Math.max(1, Number.parseInt(value, 10) || fallback));

const scoreSimilarity = (target, candidate, minMaxByMetric) => {
  let total = 0;
  let count = 0;
  for (const metric of SIMILARITY_METRICS) {
    const targetValue = normalizeStat(metric, target?.[metric]);
    const candidateValue = normalizeStat(metric, candidate?.[metric]);
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
        /\byes\b|\btrue\b|\bavailable\b|\bin portal\b|\btransfer portal\b|\bactive\b/.test(
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

    const { data: targetPlayer, error: targetError } = await supabase
      .from("ncaa_players_d1_male")
      .select(PLAYER_DETAIL_COLUMNS)
      .eq("unique_id", id)
      .single();

    if (targetError) {
      if (targetError.code === "PGRST116") {
        return res.status(404).json({ error: "Player not found" });
      }
      console.error("Supabase error:", targetError);
      return res.status(500).json({ error: "Failed to fetch source player" });
    }

    let poolQuery = supabase
      .from("ncaa_players_d1_male")
      .select(PLAYER_DETAIL_COLUMNS)
      .neq("unique_id", id)
      .not("name_split", "is", null)
      .neq("name_split", "")
      .limit(500);

    if (targetPlayer.position) {
      poolQuery = poolQuery.ilike("position", `%${targetPlayer.position}%`);
    }

    const { data: candidatePool, error: poolError } = await poolQuery;
    if (poolError) {
      console.error("Supabase error:", poolError);
      return res.status(500).json({ error: "Failed to fetch candidate pool" });
    }

    const pool = (Array.isArray(candidatePool) ? candidatePool : []).filter(
      (candidate) => !portalOnly || isPortalAvailable(candidate),
    );
    if (pool.length === 0) {
      return res.json({ players: [] });
    }

    const minMaxByMetric = {};
    for (const metric of SIMILARITY_METRICS) {
      const values = [targetPlayer, ...pool]
        .map((row) => normalizeStat(metric, row?.[metric]))
        .filter((value) => Number.isFinite(value));
      if (values.length === 0) {
        minMaxByMetric[metric] = { min: 0, max: 0 };
      } else {
        minMaxByMetric[metric] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    }

    const ranked = pool
      .map((candidate) => ({
        player: candidate,
        similarity: scoreSimilarity(targetPlayer, candidate, minMaxByMetric),
      }))
      .filter((entry) => entry.similarity >= 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((entry) => entry.player);

    return res.json({ players: ranked });
  } catch (err) {
    console.error("Similar player lookup error:", err);
    return res.status(500).json({ error: "Similar player lookup failed." });
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
