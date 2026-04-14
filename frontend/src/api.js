// frontend/src/api.js
import axios from "axios";
import { getValidStoredToken } from "./auth";

// Use explicit URL if provided, otherwise use proxy
// If REACT_APP_API_URL is set, use it; otherwise use proxy path
const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL
  : "http://localhost:5001/api";

// Debug: Log the API URL being used
console.log("API URL:", API_URL);

export const loginWithGoogle = async (idToken) => {
  const res = await axios.post(`${API_URL}/auth/google`, { idToken });
  return res.data.token;
};

// Get current user profile
export const getUserProfile = async () => {
  const token = getValidStoredToken();
  const res = await axios.get(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// Delete user account
export const deleteAccount = async () => {
  const token = getValidStoredToken();
  const res = await axios.delete(`${API_URL}/auth/account`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

export const chatWithAgent = async (message, history = []) => {
  let sessionId = localStorage.getItem("agentSessionId");
  const token = getValidStoredToken();
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `session-${Date.now()}`;
    localStorage.setItem("agentSessionId", sessionId);
  }
  const res = await axios.post(
    `${API_URL}/agent/chat`,
    {
      message,
      sessionId,
      history,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return res.data;
};

/**
 * @param {Response} res
 * @param {{ onStatus?: (d: object) => void, onToken?: (d: { text: string }) => void, onDone?: (d: object) => void, onError?: (d: { message?: string }) => void }} callbacks
 */
const consumeAgentSseResponse = async (res, callbacks = {}) => {
  const { onStatus, onToken, onDone, onError } = callbacks;
  const reader = res.body?.getReader?.();
  if (!reader) {
    throw new Error("Streaming not supported in this browser.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchBlock = (block) => {
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    let data;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }
    if (eventName === "status" && onStatus) onStatus(data);
    else if (eventName === "token" && onToken) onToken(data);
    else if (eventName === "done" && onDone) onDone(data);
    else if (eventName === "error" && onError) onError(data);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (block.trim()) dispatchBlock(block);
    }
  }
  if (buffer.trim()) {
    dispatchBlock(buffer);
  }
};

/**
 * Streams agent chat over SSE (POST /api/agent/chat/stream).
 * @param {string} message
 * @param {Array<{role: string, content: string}>} history
 * @param {{ onStatus?: (d: object) => void, onToken?: (d: { text: string }) => void, onDone?: (d: object) => void, onError?: (d: { message?: string }) => void }} callbacks
 */
export const chatWithAgentStream = async (message, history = [], callbacks = {}) => {
  let sessionId = localStorage.getItem("agentSessionId");
  const token = getValidStoredToken();
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `session-${Date.now()}`;
    localStorage.setItem("agentSessionId", sessionId);
  }

  const res = await fetch(`${API_URL}/agent/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, sessionId, history }),
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.response = { status: res.status };
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Chat stream failed: ${res.status}`);
    err.response = { status: res.status };
    throw err;
  }

  await consumeAgentSseResponse(res, callbacks);
};

/**
 * Streams scouting report over SSE (POST /api/agent/report/stream).
 * @param {{ onStatus?: (d: object) => void, onToken?: (d: { text: string }) => void, onDone?: (d: { report?: string, toolUsed?: string, evidence?: object }) => void, onError?: (d: { message?: string }) => void }} callbacks
 */
export const generatePlayerReportStream = async (player, callbacks = {}) => {
  const token = getValidStoredToken();
  const prompt = `Generate a scouting report for ${player.name_split} (${player.position}) on ${player.team}. Focus on role, strengths, weaknesses, and projection.`;
  const res = await fetch(`${API_URL}/agent/report/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: prompt, player }),
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.response = { status: res.status };
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Report stream failed: ${res.status}`);
    err.response = { status: res.status };
    throw err;
  }

  await consumeAgentSseResponse(res, callbacks);
};

export const resetAgentSession = async (sessionId) => {
  const token = getValidStoredToken();
  const res = await axios.post(
    `${API_URL}/agent/reset`,
    { sessionId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return res.data;
};

export const getChatSuggestions = async ({
  history = [],
  latestUserMessage = "",
  latestAssistantReply = "",
  toolUsed = "",
  chartSpec = null,
  evidence = null,
  mode = "startup",
} = {}) => {
  const token = getValidStoredToken();
  const res = await axios.post(
    `${API_URL}/agent/suggestions`,
    {
      history,
      latestUserMessage,
      latestAssistantReply,
      toolUsed,
      chartSpec,
      evidence,
      mode,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return res.data;
};

// Backward-compatible alias for older imports.
export const chatWithDataset = chatWithAgent;

export const searchPlayers = async (query) => {
  const res = await axios.get(`${API_URL}/players/search`, {
    params: { query },
  });
  return res.data;
};

export const getPlayer = async (id) => {
  const res = await axios.get(`${API_URL}/players/${encodeURIComponent(id)}`);
  return res.data;
};

export const getPlayerHistory = async (id) => {
  const res = await axios.get(
    `${API_URL}/players/${encodeURIComponent(id)}/history`,
  );
  return res.data;
};

export const getSimilarPlayers = async (
  id,
  { limit = 5, portalOnly = true, betterOrEqual = true } = {},
) => {
  const res = await axios.get(
    `${API_URL}/players/${encodeURIComponent(id)}/similar`,
    {
      params: { limit, portalOnly, betterOrEqual },
    },
  );
  return res.data;
};

export const generatePlayerReport = async (player) => {
  const token = getValidStoredToken();
  const prompt = `Generate a scouting report for ${player.name_split} (${player.position}) on ${player.team}. Focus on role, strengths, weaknesses, and projection.`;
  const res = await axios.post(
    `${API_URL}/agent/report`,
    {
      message: prompt,
      player,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return {
    description: res.data?.report || "",
  };
};

export const getUsageDashboard = async (days = 14) => {
  const token = getValidStoredToken();
  const res = await axios.get(`${API_URL}/usage/dashboard`, {
    params: { days },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// Helper to get auth headers
export const getAuthHeaders = () => {
  const token = getValidStoredToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};
