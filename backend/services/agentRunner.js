import {
  getPlayer,
  getTopPlayersByMetric,
  searchPlayers,
} from "./agentTools.js";
import { generateWithProvider } from "./llm.js";

const logToolInvocation = (tool, args = {}) => {
  try {
    console.log(
      `[agentRunner] tool_call=${tool} args=${JSON.stringify(args)}`,
    );
  } catch {
    console.log(`[agentRunner] tool_call=${tool} args=[unserializable]`);
  }
};

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

const resolvePlayerSearchForChat = async (args = {}) => {
  const query = String(args.query ?? args.name ?? args.playerName ?? "").trim();
  logToolInvocation("search_players", {
    query,
    team: args.team || "",
    position: args.position || "",
    limit: args.limit || 20,
  });
  const matches = await searchPlayers({
    query,
    team: args.team || "",
    position: args.position || "",
    limit: args.limit || 20,
  });

  if (!query) {
    return { tool: "search_players", result: matches };
  }

  const target = normalizeName(query);
  const exactMatches = matches.filter(
    (player) => normalizeName(player.name_split) === target,
  );

  if (exactMatches.length === 1 && exactMatches[0]?.unique_id) {
    logToolInvocation("get_player_by_id", { id: exactMatches[0].unique_id });
    const player = await getPlayer(exactMatches[0].unique_id);
    return {
      tool: "search_players+get_player_by_id",
      result: {
        query,
        bestMatch: exactMatches[0],
        resolution: "exact",
        resolvedName: exactMatches[0].name_split,
        player,
        candidateMatches: matches.slice(0, 5),
      },
    };
  }

  if (exactMatches.length > 1) {
    return {
      tool: "search_players",
      result: {
        query,
        ambiguity: "duplicate_exact_name",
        candidates: exactMatches.map((p) => ({
          unique_id: p.unique_id,
          name_split: p.name_split,
          team: p.team,
          position: p.position,
          class: p.class,
          league: p.league,
        })),
      },
    };
  }

  if (matches.length === 1 && matches[0]?.unique_id) {
    logToolInvocation("get_player_by_id", { id: matches[0].unique_id });
    const player = await getPlayer(matches[0].unique_id);
    return {
      tool: "search_players+get_player_by_id",
      result: {
        query,
        bestMatch: matches[0],
        resolution: "single_candidate",
        resolvedName: matches[0].name_split,
        player,
      },
    };
  }

  if (matches.length === 0) {
    const queryTokens = tokenizeName(query);
    const fallbackTokens = [...new Set([queryTokens[0], queryTokens[queryTokens.length - 1]])]
      .filter((token) => token && token.length >= 2)
      .slice(0, 2);

    const fallbackMatches = [];
    for (const token of fallbackTokens) {
      const tokenMatches = await searchPlayers({
        query: token,
        team: args.team || "",
        position: args.position || "",
        limit: 25,
      });
      fallbackMatches.push(...tokenMatches);
    }

    const deduped = Array.from(
      new Map(fallbackMatches.map((player) => [player.unique_id, player])).values(),
    );

    const ranked = deduped
      .map((player) => ({
        player,
        score: scoreNameSimilarity(query, player.name_split),
      }))
      .filter((entry) => entry.score >= 0.45)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 1 && ranked[0].player?.unique_id) {
      const chosen = ranked[0].player;
      logToolInvocation("get_player_by_id", { id: chosen.unique_id });
      const player = await getPlayer(chosen.unique_id);
      return {
        tool: "search_players+get_player_by_id",
        result: {
          query,
          bestMatch: chosen,
          resolution: "fuzzy_single",
          resolvedName: chosen.name_split,
          player,
          candidateMatches: ranked.slice(0, 5).map((entry) => entry.player),
        },
      };
    }

    if (ranked.length > 0) {
      return {
        tool: "search_players",
        result: {
          query,
          ambiguity: "similar_name_candidates",
          candidates: ranked.slice(0, 5).map((entry) => ({
            unique_id: entry.player.unique_id,
            name_split: entry.player.name_split,
            team: entry.player.team,
            position: entry.player.position,
            class: entry.player.class,
            league: entry.player.league,
          })),
        },
      };
    }
  }

  return { tool: "search_players", result: matches };
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
- For "search_players" args, use:
  { "query": "<player name or search text>", "team": "", "position": "", "limit": 20 }
- Do not use "name" as a key. Put player names in "query".

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
    const query = String(args.query ?? args.name ?? args.playerName ?? "").trim();
    logToolInvocation("search_players", {
      query,
      team: args.team || "",
      position: args.position || "",
      limit: args.limit || 20,
    });
    const players = await searchPlayers({
      query,
      team: args.team || "",
      position: args.position || "",
      limit: args.limit || 20,
    });
    return { tool: "search_players", result: players };
  }

  if (plan.tool === "get_player_by_id" && args.id) {
    logToolInvocation("get_player_by_id", { id: args.id });
    const player = await getPlayer(args.id);
    return { tool: "get_player_by_id", result: player };
  }

  if (plan.tool === "top_players") {
    logToolInvocation("top_players", {
      metric: args.metric || "pts_g",
      position: args.position || "",
      team: args.team || "",
      limit: args.limit || 10,
      minGames: args.minGames || 5,
    });
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

  let plan = await decideChatTool(message);
  if (plan.tool === "none") {
    const extracted = await extractReportTarget(message);
    if (extracted?.playerName) {
      plan = {
        tool: "search_players",
        args: {
          query: extracted.playerName,
          team: extracted.team || "",
          position: extracted.position || "",
          limit: 20,
        },
      };
    }
  }
  logToolInvocation("plan_selected", plan);
  const toolResult =
    plan.tool === "search_players"
      ? await resolvePlayerSearchForChat(plan.args || {})
      : await runToolPlan(plan);

  if (
    toolResult.tool === "search_players" &&
    (toolResult.result?.ambiguity === "duplicate_exact_name" ||
      toolResult.result?.ambiguity === "similar_name_candidates")
  ) {
    const candidates = toolResult.result.candidates || [];
    const candidateSummary = candidates
      .slice(0, 5)
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.name_split} - ${p.team || "Unknown team"} (${p.position || "N/A"}) [id: ${p.unique_id}]`,
      )
      .join("\n");

    return {
      reply:
        toolResult.result.ambiguity === "duplicate_exact_name"
          ? `I found multiple players with the exact name "${toolResult.result.query}". Please clarify which one you mean:\n${candidateSummary}\n\nYou can reply with the player id, team, or position.`
          : `I couldn't find an exact name match for "${toolResult.result.query}", but I found similar players:\n${candidateSummary}\n\nWhich player did you mean? You can reply with the player id, team, or position.`,
      toolUsed: toolResult.tool,
      evidence: toolResult.result,
    };
  }

  const replyPrompt = `You are the chat agent for a basketball analytics app.
You must use ONLY the tool result below for factual claims.
Do NOT use outside knowledge, assumptions, or any external data.
If the tool result is null/empty or does not contain enough data, say you do not have enough database evidence and ask a clarifying question.

User message:
${message}

Tool used: ${toolResult.tool}
Tool result JSON:
${JSON.stringify(toolResult.result)}

Return a concise, helpful response grounded only in the tool result.`;

  const reply = await generateWithProvider(replyPrompt);
  const resolvedName = toolResult.result?.resolvedName;
  const originalQuery = toolResult.result?.query;
  if (
    resolvedName &&
    originalQuery &&
    normalizeName(resolvedName) !== normalizeName(originalQuery)
  ) {
    return {
      reply: `I used "${resolvedName}" as the closest matching player name.\n\n${reply}`,
      toolUsed: toolResult.tool,
      evidence: toolResult.result,
    };
  }
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
    logToolInvocation("get_player_by_id", { id });
    evidence = { player: await getPlayer(id) };
    toolUsed = "get_player_by_id";
  } else if (playerInput?.name_split) {
    logToolInvocation("search_players", {
      query: playerInput.name_split,
      team: playerInput.team || "",
      position: playerInput.position || "",
      limit: 5,
    });
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
      logToolInvocation("search_players", {
        query: extracted.playerName,
        team: extracted.team || "",
        position: extracted.position || "",
        limit: 10,
      });
      const matches = await searchPlayers({
        query: extracted.playerName,
        team: extracted.team || "",
        position: extracted.position || "",
        limit: 10,
      });

      const bestMatch = pickBestPlayerMatch(extracted.playerName, matches);
      if (bestMatch?.unique_id) {
        logToolInvocation("get_player_by_id", { id: bestMatch.unique_id });
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
Use ONLY the evidence JSON for factual claims.
Do NOT use outside knowledge, assumptions, memory, or any external data.
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
