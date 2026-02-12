import express from "express";

const router = express.Router();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_GEN_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const TAMU_API_KEY = process.env.TAMU_API_KEY || "";
const TAMU_BASE_URL = process.env.TAMU_BASE_URL || "https://chat.tamu.ai";
const TAMU_CHAT_MODELS = (process.env.TAMU_CHAT_MODELS || "gpt5.2,gpt5.1,gpt5")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const LLM_PROVIDER =
  process.env.LLM_PROVIDER || (GEMINI_API_KEY ? "gemini" : "ollama");
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

const generateAnswer = async (prompt) => {
  if (LLM_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for Gemini generation.");
    }

    const generationConfig = {};
    if (Number.isFinite(LLM_TEMPERATURE)) {
      generationConfig.temperature = LLM_TEMPERATURE;
    }
    if (Number.isFinite(LLM_TOP_P)) {
      generationConfig.topP = LLM_TOP_P;
    }
    if (Number.isFinite(LLM_MAX_TOKENS)) {
      generationConfig.maxOutputTokens = LLM_MAX_TOKENS;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Generate failed: ${res.status} ${detail}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join("");
    return text?.trim() || "";
  }

  if (LLM_PROVIDER === "tamu") {
    if (!TAMU_API_KEY) {
      throw new Error("TAMU_API_KEY is required for TAMU generation.");
    }

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
          data?.choices?.[0]?.message?.content ||
          data?.choices?.[0]?.text ||
          "";
        return text.trim();
      }

      const detail = await res.text();
      lastError = new Error(`Generate failed: ${res.status} ${detail}`);
      if (![400, 404, 422].includes(res.status)) {
        throw lastError;
      }
    }

    throw lastError || new Error("Generate failed: no available TAMU models.");
  }

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_GEN_MODEL,
      prompt,
      stream: false,
      options: {
        ...(Number.isFinite(LLM_TEMPERATURE)
          ? { temperature: LLM_TEMPERATURE }
          : {}),
        ...(Number.isFinite(LLM_TOP_P) ? { top_p: LLM_TOP_P } : {}),
        ...(Number.isFinite(LLM_MAX_TOKENS)
          ? { num_predict: LLM_MAX_TOKENS }
          : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Generate failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return data.response?.trim() || "";
};

router.post("/", async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const reply = await generateAnswer(message);
    return res.json({
      reply,
      sources: [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat request failed." });
  }
});

export default router;
