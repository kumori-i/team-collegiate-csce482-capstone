import {
  getPlayer,
  getTopPlayersByMetric,
  searchPlayers,
} from "./agentTools.js";
import { generateWithProvider } from "./llm.js";

const parseJsonFromModel = (text) => {
  if (!text) {
    return null;
  }
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  }
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pickBestPlayerMatch = (playerName, matches) => {
  if (!playerName || !Array.isArray(matches) || matches.length === 0) {
    return null;
  }

  const target = normalizeName(playerName);
  const exact = matches.find(
    (player) => normalizeName(player.name_split) === target,
  );
  if (exact) {
    return exact;
  }

  const prefix = matches.find((player) =>
    normalizeName(player.name_split).startsWith(target),
  );
  if (prefix) {
    return prefix;
  }

  const contains = matches.find((player) =>
    normalizeName(player.name_split).includes(target),
  );
  if (contains) {
    return contains;
  }

  return matches[0];
};

const extractReportTarget = async (message) => {
  if (!message?.trim()) {
    return null;
  }

  const prompt = `Extract report target fields from this basketball request.
Return ONLY valid JSON with this exact schema:
{
  "playerName": "",
  "team": "",
  "position": ""
}

Rules:
- If a field is unknown, return empty string.
- playerName should be a full player name if present.

Request:
${message}`;

  const raw = await generateWithProvider(prompt);
  const parsed = parseJsonFromModel(raw);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    playerName:
      typeof parsed.playerName === "string" ? parsed.playerName.trim() : "",
    team: typeof parsed.team === "string" ? parsed.team.trim() : "",
    position:
      typeof parsed.position === "string" ? parsed.position.trim() : "",
  };
};

export const decideChatTool = async (message) => {
  const prompt = `You are a routing agent for basketball database tools.
Return ONLY valid JSON with this schema:
{
  "tool": "search_players" | "get_player_by_id" | "top_players" | "none",
  "args": { ... }
}

Guidelines:
- Use "search_players" when user asks to find players by name/team/position.
- Use "get_player_by_id" only if user explicitly provides an id.
- Use "top_players" when user asks for top/best/ranking by a metric.
- Use "none" for pure conversation.
- For top/best:
  allowed metrics: pts_g, reb_g, ast_g, stl_g, blk_g, fg, c_3pt, ft, efg, ts, usg, ppp, a_to, orb_40, ram, c_ram, psp, c_3pe, dsi, fgs, bms

User message:
${message}`;

  const raw = await generateWithProvider(prompt);
  const parsed = parseJsonFromModel(raw);
  if (!parsed?.tool) {
    return { tool: "none", args: {} };
  }
  return parsed;
};

export const runToolPlan = async (plan) => {
  const args = plan?.args || {};
  if (plan.tool === "search_players") {
    const players = await searchPlayers({
      query: args.query || "",
      team: args.team || "",
      position: args.position || "",
      limit: args.limit || 20,
    });
    return { tool: "search_players", result: players };
  }

  if (plan.tool === "get_player_by_id" && args.id) {
    const player = await getPlayer(args.id);
    return { tool: "get_player_by_id", result: player };
  }

  if (plan.tool === "top_players") {
    const result = await getTopPlayersByMetric({
      metric: args.metric || "pts_g",
      position: args.position || "",
      team: args.team || "",
      limit: args.limit || 10,
      minGames: args.minGames || 5,
    });
    return { tool: "top_players", result };
  }

  return { tool: "none", result: null };
};

export const runChatAgent = async (message) => {
  const reportIntent =
    /\b(report|scouting report|scout report|write up|write-up|player report)\b/i.test(
      message,
    );

  if (reportIntent) {
    const delegated = await runReportAgent({ message });
    return {
      reply: delegated.report,
      toolUsed: `chat->report:${delegated.toolUsed}`,
      evidence: delegated.evidence,
    };
  }

  const plan = await decideChatTool(message);
  const toolResult = await runToolPlan(plan);

  const replyPrompt = `You are the chat agent for a basketball analytics app.
Use the tool result below for factual claims. If tool result is null, answer generally and ask a clarifying question when needed.

User message:
${message}

Tool used: ${toolResult.tool}
Tool result JSON:
${JSON.stringify(toolResult.result)}

Return a concise, helpful response.`;

  const reply = await generateWithProvider(replyPrompt);
  return {
    reply,
    toolUsed: toolResult.tool,
    evidence: toolResult.result,
  };
};

export const runReportAgent = async ({
  message = "",
  playerInput = null,
  playerId = "",
}) => {
  let evidence = {};
  let toolUsed = "none";

  if (playerInput?.unique_id || playerId) {
    const id = playerInput?.unique_id || playerId;
    evidence = { player: await getPlayer(id) };
    toolUsed = "get_player_by_id";
  } else if (playerInput?.name_split) {
    const matches = await searchPlayers({
      query: playerInput.name_split,
      team: playerInput.team || "",
      position: playerInput.position || "",
      limit: 5,
    });
    evidence = {
      providedPlayer: playerInput,
      matches,
    };
    toolUsed = "search_players";
  } else {
    const extracted = await extractReportTarget(message);
    if (extracted?.playerName) {
      const matches = await searchPlayers({
        query: extracted.playerName,
        team: extracted.team || "",
        position: extracted.position || "",
        limit: 10,
      });

      const bestMatch = pickBestPlayerMatch(extracted.playerName, matches);
      if (bestMatch?.unique_id) {
        const player = await getPlayer(bestMatch.unique_id);
        evidence = {
          extractedTarget: extracted,
          bestMatch,
          player,
          candidateMatches: matches.slice(0, 5),
        };
        toolUsed = "search_players+get_player_by_id";
      } else {
        evidence = {
          extractedTarget: extracted,
          candidateMatches: matches,
        };
        toolUsed = "search_players";
      }
    }

    if (toolUsed === "none") {
      const plan = await decideChatTool(message);
      const toolResult = await runToolPlan(
        plan.tool === "none"
          ? { tool: "top_players", args: { metric: "pts_g", limit: 10 } }
          : plan,
      );
      evidence = { userRequest: message, result: toolResult.result };
      toolUsed = toolResult.tool;
    }
  }

  const reportPrompt = `You are the report-generation agent for basketball scouting.
Generate a coach-friendly, evidence-based report from the data below.
If data is incomplete, explicitly state limitations.

User request:
${message || "Generate a scouting report from provided player data."}

Evidence JSON:
${JSON.stringify(evidence)}

Required output format:
1) Player/Cohort Overview
2) Key Strengths
3) Key Concerns
4) Metrics Snapshot
5) Projection / Recommendation

Use markdown and include specific numbers from evidence where available.`;

  const report = await generateWithProvider(reportPrompt);
  return {
    report,
    toolUsed,
    evidence,
  };
};
