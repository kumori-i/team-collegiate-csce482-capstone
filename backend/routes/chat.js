import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const GEN_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "..", "data");
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
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return data.embedding;
};

const generateAnswer = async (prompt) => {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEN_MODEL,
      prompt,
      stream: false,
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
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
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
    const prompt = [
      "You are a helpful assistant answering questions using the provided context.",
      "If the answer is not in the context, say you don't know.",
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
