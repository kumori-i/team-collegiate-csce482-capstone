import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
const envLocalPath = path.resolve(__dirname, "..", ".env.local");
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const LLM_PROVIDER =
  process.env.LLM_PROVIDER || (GEMINI_API_KEY ? "gemini" : "ollama");
const DATA_DIR =
  process.env.DATA_DIR || path.resolve(process.cwd(), "..", "data");
const INDEX_PATH =
  process.env.VECTOR_INDEX_PATH || path.join(DATA_DIR, "vector_index.json");
const ROWS_PER_CHUNK = Number(process.env.ROWS_PER_CHUNK || 1);

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

const rowsToText = (fileName, rows, rowStart, rowEnd) => {
  const lines = rows.map((row, idx) => {
    const rowIndex = rowStart + idx + 1;
    const fields = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return `Row ${rowIndex}\n${fields}`;
  });

  return `Source: ${fileName}\nRows ${rowStart + 1}-${rowEnd}\n\n${lines.join("\n\n")}`;
};

const buildIndex = async () => {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const csvFiles = entries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"),
    )
    .map((entry) => entry.name);

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found in ${DATA_DIR}`);
  }

  const items = [];

  for (const fileName of csvFiles) {
    const filePath = path.join(DATA_DIR, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!records.length) {
      continue;
    }

    for (let i = 0; i < records.length; i += ROWS_PER_CHUNK) {
      const chunk = records.slice(i, i + ROWS_PER_CHUNK);
      const rowStart = i;
      const rowEnd = i + chunk.length;
      const text = rowsToText(fileName, chunk, rowStart, rowEnd);
      const embedding = await embedText(text);
      items.push({
        id: `${fileName}:${rowStart + 1}-${rowEnd}`,
        text,
        embedding,
        meta: {
          source: fileName,
          rowStart: rowStart + 1,
          rowEnd,
        },
      });
    }
  }

  if (!items.length) {
    throw new Error("No records found across CSV files.");
  }

  const index = {
    version: 1,
    createdAt: new Date().toISOString(),
    model: LLM_PROVIDER === "gemini" ? GEMINI_EMBED_MODEL : OLLAMA_EMBED_MODEL,
    rowsPerChunk: ROWS_PER_CHUNK,
    dim: items[0].embedding.length,
    items,
  };

  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
  console.log(`Vector index saved to ${INDEX_PATH}`);
};

buildIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
