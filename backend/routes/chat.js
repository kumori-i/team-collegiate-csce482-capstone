import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_GEN_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
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
const RAG_STRICT = process.env.RAG_STRICT !== "false";
const DATA_DIR =
  process.env.DATA_DIR || path.resolve(process.cwd(), "..", "data");
const INDEX_PATH =
  process.env.VECTOR_INDEX_PATH || path.join(DATA_DIR, "vector_index.json");
const TOP_K = Number(process.env.RAG_TOP_K || 4);

let cachedIndex = null;

const loadIndex = async () => {
  if (cachedIndex) {
    return cachedIndex;
  }
  const raw = await fs.readFile(INDEX_PATH, "utf8");
  cachedIndex = JSON.parse(raw);
  return cachedIndex;
};

const embedText = async (text) => {
  if (LLM_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for Gemini embeddings.");
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Embedding failed: ${res.status} ${detail}`);
    }
    const data = await res.json();
    const values =
      data?.embedding?.values ||
      data?.embeddings?.[0]?.values ||
      data?.embeddings?.[0]?.embedding?.values;
    if (!values?.length) {
      throw new Error("Embedding response missing values.");
    }
    return values;
  }

  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return data.embedding;
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

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

router.post("/", async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const index = await loadIndex();
    if (!index?.items?.length) {
      return res.status(500).json({ error: "Vector index is empty." });
    }

    const queryEmbedding = await embedText(message);
    const scored = index.items.map((item) => ({
      item,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, TOP_K).map((entry) => entry.item);

    const context = topMatches.map((match) => match.text).join("\n\n---\n\n");
    const instructions = RAG_STRICT
      ? [
          "You are a helpful assistant answering questions using only the provided context.",
          "Do not use outside knowledge. If the answer is not in the context, say you don't know.",
          "You may analyze the user's request to explain what is being asked, but all factual claims must come from the context.",
        ]
      : [
          "You are a helpful assistant answering questions using the provided context.",
          "Prefer the context, but you may answer from general knowledge if needed.",
        ];

    const prompt = [
      ...instructions,
      "",
      `Context:\n${context}`,
      "",
      `Question: ${message}`,
      "Answer:",
    ].join("\n");

    const reply = await generateAnswer(prompt);

    return res.json({
      reply,
      sources: topMatches.map((match) => match.meta),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat request failed." });
  }
});

export default router;
