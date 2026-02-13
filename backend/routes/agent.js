import express from "express";
import { runChatAgent, runReportAgent } from "../services/agentRunner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Agent
 *     description: Higher-level agent orchestration endpoints.
 */

/**
 * @swagger
 * /api/agent/chat:
 *   post:
 *     tags: [Agent]
 *     summary: Run chat agent workflow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agent reply returned
 *       400:
 *         description: Missing message
 *       500:
 *         description: Agent request failed
 */
router.post("/chat", async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const { reply, toolUsed } = await runChatAgent(message);
    return res.json({
      reply,
      agent: "chat",
      toolUsed,
    });
  } catch (err) {
    console.error("Agent chat error:", err);
    return res.status(500).json({ error: "Agent chat request failed." });
  }
});

/**
 * @swagger
 * /api/agent/report:
 *   post:
 *     tags: [Agent]
 *     summary: Run report agent workflow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               playerId:
 *                 type: string
 *               player:
 *                 type: object
 *     responses:
 *       200:
 *         description: Agent report returned
 *       400:
 *         description: message, player, or playerId required
 *       500:
 *         description: Agent request failed
 */
router.post("/report", async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    const playerInput =
      req.body.player && typeof req.body.player === "object"
        ? req.body.player
        : null;
    const directPlayerId =
      typeof req.body.playerId === "string" ? req.body.playerId.trim() : "";

    if (!message && !playerInput && !directPlayerId) {
      return res
        .status(400)
        .json({ error: "message, player, or playerId is required." });
    }

    const { report, toolUsed } = await runReportAgent({
      message,
      playerInput,
      playerId: directPlayerId,
    });

    return res.json({
      report,
      agent: "report",
      toolUsed,
    });
  } catch (err) {
    console.error("Agent report error:", err);
    return res.status(500).json({ error: "Agent report request failed." });
  }
});

export default router;
