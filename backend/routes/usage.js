import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getUsageDashboard } from "../services/usageTracker.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Usage
 *     description: Model usage and cost dashboard endpoints.
 */

/**
 * @swagger
 * /api/usage/dashboard:
 *   get:
 *     tags: [Usage]
 *     summary: Get usage dashboard data for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           enum: [14, 30, 180]
 *     responses:
 *       200:
 *         description: Usage dashboard returned
 *       401:
 *         description: Access token required
 */
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const days = Math.max(
      14,
      Math.min(180, Number.parseInt(req.query.days, 10) || 14),
    );
    const normalizedDays = [14, 30, 180].includes(days) ? days : 14;
    const dashboard = await getUsageDashboard({
      userId: req.user.id,
      days: normalizedDays,
    });
    return res.json(dashboard);
  } catch (err) {
    console.error("Usage dashboard error:", err);
    return res.status(500).json({ error: "Failed to load usage dashboard." });
  }
});

export default router;
