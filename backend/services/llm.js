import { normalizeUsage, recordUsageEvent } from "./usageTracker.js";

const TAMU_API_KEY = process.env.TAMU_API_KEY || "";
const TAMU_BASE_URL = process.env.TAMU_BASE_URL || "https://chat.tamu.ai";
const TAMU_CHAT_MODELS = (process.env.TAMU_CHAT_MODELS || "gpt5.2,gpt5.1,gpt5")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const LLM_TEMPERATURE = process.env.LLM_TEMPERATURE
  ? Number(process.env.LLM_TEMPERATURE)
  : undefined;
const LLM_TOP_P = process.env.LLM_TOP_P
  ? Number(process.env.LLM_TOP_P)
  : undefined;
const LLM_MAX_TOKENS = process.env.LLM_MAX_TOKENS
  ? Number(process.env.LLM_MAX_TOKENS)
  : undefined;

const resolveTamuUrl = (endpoint) => {
  const base = TAMU_BASE_URL.replace(/\/+$/, "");
  if (base.endsWith("/api")) {
    return `${base}${endpoint}`;
  }
  return `${base}/api${endpoint}`;
};

const parseTamuResponse = async (res) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const raw = await res.text();
    const lines = raw
      .split("\n")
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.startsWith("data:"));
    if (!lines.length) {
      throw new Error("TAMU response missing data payload");
    }
    const chunks = [];
    for (const line of lines) {
      const payload = line.replace(/^data:\s*/, "");
      if (payload === "[DONE]") {
        break;
      }
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          chunks.push(delta);
        }
      } catch {
        // ignore malformed payloads
      }
    }
    if (!chunks.length) {
      return {};
    }
    return {
      choices: [{ message: { content: chunks.join("") } }],
    };
  }
  return res.json();
};

/**
 * Reads TAMU chat/completions SSE from a fetch Response body and invokes onChunk for each text delta.
 * @returns {Promise<{ fullText: string, usage: object | null }>}
 */
const consumeTamuSseBody = async (res, onChunk) => {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const data = await parseTamuResponse(res);
    const text =
      data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    const t = String(text);
    if (t) onChunk(t);
    return { fullText: t.trim(), usage: data?.usage ?? null };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage = null;

  const handlePayload = (payload) => {
    if (payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.usage) usage = parsed.usage;
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    } catch {
      // ignore malformed payloads
    }
  };

  const flushLines = (text) => {
    let rest = text;
    let idx;
    while ((idx = rest.indexOf("\n")) !== -1) {
      const line = rest.slice(0, idx);
      rest = rest.slice(idx + 1);
      const trimmed = line.trimEnd();
      if (trimmed.startsWith("data:")) {
        handlePayload(trimmed.replace(/^data:\s*/, ""));
      }
    }
    return rest;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = flushLines(buffer);
  }
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      handlePayload(trimmed.replace(/^data:\s*/, ""));
    }
  }

  return { fullText: fullText.trim(), usage };
};

const resolveMaxTokensBody = (perRequestMax) => {
  if (Number.isFinite(perRequestMax) && perRequestMax > 0) {
    return { max_tokens: Math.floor(perRequestMax) };
  }
  if (Number.isFinite(LLM_MAX_TOKENS)) {
    return { max_tokens: LLM_MAX_TOKENS };
  }
  return {};
};

export const generateWithProviderStream = async (
  prompt,
  { userId = "", route = "", feature = "", maxTokens } = {},
  onChunk,
) => {
  if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "tamu") {
    throw new Error(
      "LLM_PROVIDER must be 'tamu' for agent routes. Gemini/Ollama are disabled.",
    );
  }
  if (!TAMU_API_KEY) {
    throw new Error("TAMU_API_KEY not configured");
  }

  const baseBody = {
    messages: [{ role: "user", content: prompt }],
    stream: true,
    ...(Number.isFinite(LLM_TEMPERATURE)
      ? { temperature: LLM_TEMPERATURE }
      : {}),
    ...(Number.isFinite(LLM_TOP_P) ? { top_p: LLM_TOP_P } : {}),
    ...resolveMaxTokensBody(maxTokens),
  };

  let lastError = null;
  for (const model of TAMU_CHAT_MODELS) {
    const res = await fetch(resolveTamuUrl("/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAMU_API_KEY}`,
      },
      body: JSON.stringify({ ...baseBody, model }),
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      let fullText = "";
      let usage = null;
      if (contentType.includes("text/event-stream")) {
        const out = await consumeTamuSseBody(res, onChunk);
        fullText = out.fullText;
        usage = out.usage;
      } else {
        const data = await res.json();
        fullText =
          data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
        if (fullText) onChunk(fullText);
        usage = data?.usage;
      }
      const usageNorm = normalizeUsage({
        prompt,
        responseText: fullText,
        usage,
      });
      await recordUsageEvent({
        userId,
        provider: "tamu",
        model,
        route,
        feature,
        inputTokens: usageNorm.inputTokens,
        outputTokens: usageNorm.outputTokens,
        totalTokens: usageNorm.totalTokens,
      });
      return fullText.trim();
    }

    const detail = await res.text();
    lastError = new Error(`TAMU generate failed: ${res.status} ${detail}`);
    if (![400, 404, 422].includes(res.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error("TAMU generate failed: no available models");
};

export const generateWithProviderDetailed = async (
  prompt,
  { userId = "", route = "", feature = "", maxTokens } = {},
) => {
  if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "tamu") {
    throw new Error(
      "LLM_PROVIDER must be 'tamu' for agent routes. Gemini/Ollama are disabled.",
    );
  }

  if (!TAMU_API_KEY) {
    throw new Error("TAMU_API_KEY not configured");
  }

  const baseBody = {
    messages: [{ role: "user", content: prompt }],
    stream: false,
    ...(Number.isFinite(LLM_TEMPERATURE)
      ? { temperature: LLM_TEMPERATURE }
      : {}),
    ...(Number.isFinite(LLM_TOP_P) ? { top_p: LLM_TOP_P } : {}),
    ...resolveMaxTokensBody(maxTokens),
  };

  let lastError = null;
  for (const model of TAMU_CHAT_MODELS) {
    const res = await fetch(resolveTamuUrl("/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAMU_API_KEY}`,
      },
      body: JSON.stringify({ ...baseBody, model }),
    });

    if (res.ok) {
      const data = await parseTamuResponse(res);
      const text =
        data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
      const usage = normalizeUsage({
        prompt,
        responseText: text,
        usage: data?.usage,
      });
      await recordUsageEvent({
        userId,
        provider: "tamu",
        model,
        route,
        feature,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      });
      return { text: text.trim(), model, usage };
    }

    const detail = await res.text();
    lastError = new Error(`TAMU generate failed: ${res.status} ${detail}`);
    if (![400, 404, 422].includes(res.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error("TAMU generate failed: no available models");
};

export const generateWithProvider = async (prompt, options = {}) => {
  const result = await generateWithProviderDetailed(prompt, options);
  return result.text;
};
