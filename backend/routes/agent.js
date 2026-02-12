import express from "express";
import { runChatAgent, runReportAgent } from "../services/agentRunner.js";

const router = express.Router();

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
