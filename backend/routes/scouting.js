import express from "express";

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";

// Generate AI scouting report for a player
// POST /api/scouting/generate
router.post("/generate", async (req, res) => {
  try {
    const {
      name,
      team,
      position,
      class: playerClass,
      pts_g,
      reb_g,
      ast_g,
      fg,
      c_3pt,
      ft,
      stl_g,
      blk_g,
      to_g,
      min_g,
    } = req.body;

    if (!name || !team) {
      return res.status(400).json({ error: "Player name and team are required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const formatStat = (value, isPercentage = false) => {
      if (value === null || value === undefined) return "N/A";
      if (isPercentage) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value.toFixed(1);
    };

    const prompt = `You are an expert college basketball scout. Generate a detailed scouting report for ${name} from ${team}.

Position: ${position || "N/A"}
Class: ${playerClass || "N/A"}

Statistics:
- Points per game: ${formatStat(pts_g)}
- Rebounds per game: ${formatStat(reb_g)}
- Assists per game: ${formatStat(ast_g)}
- Minutes per game: ${formatStat(min_g)}
- Field goal percentage: ${formatStat(fg, true)}
- Three-point percentage: ${formatStat(c_3pt, true)}
- Free throw percentage: ${formatStat(ft, true)}
- Steals per game: ${formatStat(stl_g)}
- Blocks per game: ${formatStat(blk_g)}
- Turnovers per game: ${formatStat(to_g)}

Write a **dense, information-packed** 2-3 paragraph scouting report. Be concise but comprehensive - pack maximum insights into minimum words. Focus on:
- Playing style and role in team system
- Key statistical strengths backed by their actual numbers
- Offensive and defensive impact
- Efficiency metrics and shot selection
- Physical tools and intangibles
- NBA/pro potential indicators

Use **bold** for critical attributes and statistics. No fluff - every sentence should provide substantive analysis.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return res.status(500).json({ error: "Failed to generate scouting report" });
    }

    const data = await response.json();
    const description =
      data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";

    if (!description) {
      return res.status(500).json({ error: "No description generated" });
    }

    return res.json({ description });
  } catch (err) {
    console.error("Scouting report generation error:", err);
    return res.status(500).json({ error: "Failed to generate scouting report" });
  }
});

export default router;
