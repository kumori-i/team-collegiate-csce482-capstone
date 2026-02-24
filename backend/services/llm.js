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

export const generateWithProvider = async (prompt) => {
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
    ...(Number.isFinite(LLM_MAX_TOKENS)
      ? { max_tokens: LLM_MAX_TOKENS }
      : {}),
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
      return text.trim();
    }

    const detail = await res.text();
    lastError = new Error(`TAMU generate failed: ${res.status} ${detail}`);
    if (![400, 404, 422].includes(res.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error("TAMU generate failed: no available models");
};
