import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { recordUsageEvent } from "../services/usageTracker.js";
import {
  clearChatSessionMemory,
  generateChatSuggestions,
  runChatAgent,
  runReportAgent,
} from "../services/agentRunner.js";

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
const writeSse = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    const sessionId =
      typeof req.body.sessionId === "string" ? req.body.sessionId.trim() : "";
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const userId = req.user.id;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const { reply, toolUsed, chartSpec, suggestions } = await runChatAgent(
      message,
      {
      sessionId,
      history,
      userId,
      },
    );
    await recordUsageEvent({
      userId,
      provider: "internal",
      model: "agent_request",
      route: "/api/agent/chat",
      feature: toolUsed || "chat_request",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
    return res.json({
      reply,
      agent: "chat",
      toolUsed,
      chartSpec,
      suggestions: suggestions || [],
    });
  } catch (err) {
    console.error("Agent chat error:", err);
    return res.status(500).json({ error: "Agent chat request failed." });
  }
});

router.post("/chat/stream", authenticateToken, async (req, res) => {
  const message =
    typeof req.body.message === "string" ? req.body.message.trim() : "";
  const sessionId =
    typeof req.body.sessionId === "string" ? req.body.sessionId.trim() : "";
  const history = Array.isArray(req.body.history) ? req.body.history : [];
  const userId = req.user.id;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const stream = {
    write: (event, data) => writeSse(res, event, data),
    lastToolUsed: "chat_request",
  };

  try {
    await runChatAgent(message, {
      sessionId,
      history,
      userId,
      stream,
    });
    await recordUsageEvent({
      userId,
      provider: "internal",
      model: "agent_request",
      route: "/api/agent/chat/stream",
      feature: stream.lastToolUsed || "chat_request",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  } catch (err) {
    console.error("Agent chat stream error:", err);
    writeSse(res, "error", { message: "Agent chat request failed." });
  } finally {
    res.end();
  }
});

router.post("/reset", authenticateToken, async (req, res) => {
  try {
    const sessionId =
      typeof req.body.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }
    clearChatSessionMemory(sessionId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Agent reset error:", err);
    return res.status(500).json({ error: "Agent reset request failed." });
  }
});

router.post("/suggestions", authenticateToken, async (req, res) => {
  try {
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const latestUserMessage =
      typeof req.body.latestUserMessage === "string"
        ? req.body.latestUserMessage.trim()
        : "";
    const latestAssistantReply =
      typeof req.body.latestAssistantReply === "string"
        ? req.body.latestAssistantReply.trim()
        : "";
    const toolUsed =
      typeof req.body.toolUsed === "string" ? req.body.toolUsed.trim() : "";
    const mode =
      req.body.mode === "startup" || req.body.mode === "followup"
        ? req.body.mode
        : history.length > 0 || latestUserMessage || latestAssistantReply
          ? "followup"
          : "startup";
    const suggestions = await generateChatSuggestions({
      history,
      latestUserMessage,
      latestAssistantReply,
      toolUsed,
      chartSpec:
        req.body.chartSpec && typeof req.body.chartSpec === "object"
          ? req.body.chartSpec
          : null,
      evidence:
        req.body.evidence && typeof req.body.evidence === "object"
          ? req.body.evidence
          : null,
      userId: req.user.id,
      mode,
    });
    return res.json({ suggestions });
  } catch (err) {
    console.error("Agent suggestions error:", err);
    return res.status(500).json({ error: "Agent suggestion request failed." });
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
router.post("/report", authenticateToken, async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    const playerInput =
      req.body.player && typeof req.body.player === "object"
        ? req.body.player
        : null;
    const directPlayerId =
      typeof req.body.playerId === "string" ? req.body.playerId.trim() : "";
    const userId = req.user.id;

    if (!message && !playerInput && !directPlayerId) {
      return res
        .status(400)
        .json({ error: "message, player, or playerId is required." });
    }

    const { report, toolUsed } = await runReportAgent({
      message,
      playerInput,
      playerId: directPlayerId,
      userId,
    });
    await recordUsageEvent({
      userId,
      provider: "internal",
      model: "agent_request",
      route: "/api/agent/report",
      feature: toolUsed || "report_request",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
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

router.post("/report/stream", authenticateToken, async (req, res) => {
  const message =
    typeof req.body.message === "string" ? req.body.message.trim() : "";
  const playerInput =
    req.body.player && typeof req.body.player === "object"
      ? req.body.player
      : null;
  const directPlayerId =
    typeof req.body.playerId === "string" ? req.body.playerId.trim() : "";
  const userId = req.user.id;

  if (!message && !playerInput && !directPlayerId) {
    return res
      .status(400)
      .json({ error: "message, player, or playerId is required." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const stream = {
    write: (event, data) => writeSse(res, event, data),
    lastToolUsed: "report_request",
  };

  try {
    writeSse(res, "status", { phase: "thinking" });
    const result = await runReportAgent({
      message,
      playerInput,
      playerId: directPlayerId,
      userId,
      stream,
    });
    stream.lastToolUsed = result.toolUsed || stream.lastToolUsed;
    writeSse(res, "done", {
      report: result.report,
      toolUsed: result.toolUsed,
      evidence: result.evidence,
    });
    await recordUsageEvent({
      userId,
      provider: "internal",
      model: "agent_request",
      route: "/api/agent/report/stream",
      feature: stream.lastToolUsed || "report_request",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  } catch (err) {
    console.error("Agent report stream error:", err);
    writeSse(res, "error", { message: "Agent report request failed." });
  } finally {
    res.end();
  }
});

export default router;
