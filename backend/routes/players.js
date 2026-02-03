import express from "express";
import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "..", "data");
const PLAYER_KEYS = ["player", "name"];
const TEAM_KEYS = ["team"];
const POSITION_KEYS = ["position"];

let cachedPlayers = null;

const normalizeKey = (key) => key.trim().toLowerCase();

const getColumn = (row, keys) => {
  const entries = Object.entries(row);
  for (const key of keys) {
    const match = entries.find(([k]) => normalizeKey(k) === key);
    if (match) {
      return match[1];
    }
  }
  return "";
};

const loadPlayers = async () => {
  if (cachedPlayers) {
    return cachedPlayers;
  }

  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const csvFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => entry.name);

  const players = [];

  for (const fileName of csvFiles) {
    const filePath = path.join(DATA_DIR, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    records.forEach((row, index) => {
      const name = getColumn(row, PLAYER_KEYS);
      if (!name) {
        return;
      }
      const id = `${fileName}::${index + 1}`;
      players.push({
        id,
        name,
        team: getColumn(row, TEAM_KEYS),
        position: getColumn(row, POSITION_KEYS),
        stats: row,
        source: fileName,
        rowNumber: index + 1,
      });
    });
  }

  cachedPlayers = players;
  return players;
};

router.get("/", async (req, res) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
    if (!query) {
      return res.json({ results: [] });
    }

    const players = await loadPlayers();
    const lowerQuery = query.toLowerCase();
    const results = players
      .filter((player) => player.name.toLowerCase().includes(lowerQuery))
      .slice(0, 25)
      .map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
      }));

    return res.json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Player search failed." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const players = await loadPlayers();
    const match = players.find((player) => player.id === id);
    if (!match) {
      return res.status(404).json({ error: "Player not found." });
    }

    return res.json({
      id: match.id,
      name: match.name,
      team: match.team,
      position: match.position,
      stats: match.stats,
      source: match.source,
      rowNumber: match.rowNumber,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Player lookup failed." });
  }
});

export default router;
