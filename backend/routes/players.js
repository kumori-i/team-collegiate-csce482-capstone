import express from "express";
import { supabase } from "../supabase.js";

const router = express.Router();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_GEN_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
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

const generateReport = async (prompt) => {
  if (LLM_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            ...(Number.isFinite(LLM_TEMPERATURE)
              ? { temperature: LLM_TEMPERATURE }
              : {}),
            ...(Number.isFinite(LLM_TOP_P) ? { topP: LLM_TOP_P } : {}),
            ...(Number.isFinite(LLM_MAX_TOKENS)
              ? { maxOutputTokens: LLM_MAX_TOKENS }
              : {}),
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini generate failed: ${res.status} ${detail}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join("");
    return text?.trim() || "";
  }

  if (LLM_PROVIDER === "tamu") {
    if (!TAMU_API_KEY) {
      throw new Error("TAMU_API_KEY not configured");
    }
    console.log("[players/report] TAMU request", {
      baseUrl: TAMU_BASE_URL,
      models: TAMU_CHAT_MODELS,
    });
    const parseTamuResponse = async (res) => {
      const contentType = res.headers.get("content-type") || "";
      console.log("[players/report] TAMU response", {
        status: res.status,
        contentType,
      });
      if (contentType.includes("text/event-stream")) {
        const raw = await res.text();
        console.log(
          "[players/report] TAMU SSE raw (first 200 chars)",
          raw.slice(0, 200),
        );
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
          } catch (err) {
            console.log(
              "[players/report] TAMU SSE parse error (payload)",
              payload.slice(0, 200),
            );
          }
        }
        if (!chunks.length) {
          return {};
        }
        return {
          choices: [{ message: { content: chunks.join("") } }],
        };
      }
      const raw = await res.text();
      if (!raw) {
        return {};
      }
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.log(
          "[players/report] TAMU non-JSON body (first 200 chars)",
          raw.slice(0, 200),
        );
        throw err;
      }
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
      console.log(
        "[players/report] TAMU non-OK body (first 200 chars)",
        detail.slice(0, 200),
      );
      lastError = new Error(`TAMU generate failed: ${res.status} ${detail}`);
      if (![400, 404, 422].includes(res.status)) {
        throw lastError;
      }
    }

    throw lastError || new Error("TAMU generate failed: no available models");
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
    throw new Error(`Ollama generate failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return data.response?.trim() || "";
};

// Search players - similar to my-app home page functionality
// GET /api/players/search?query=john&limit=50
router.get("/search", async (req, res) => {
  try {
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : "";
    const limit = parseInt(req.query.limit) || 50;

    let supabaseQuery = supabase
      .from("ncaa_players_d1_male")
      .select("unique_id, name_split, team, position, league, class")
      .not("name_split", "is", null)
      .neq("name_split", "");

    if (query) {
      // Search through entire database when user is searching
      supabaseQuery = supabaseQuery.ilike("name_split", `%${query}%`);
    } else {
      // Only show top {limit} for initial load
      supabaseQuery = supabaseQuery.limit(limit);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to search players" });
    }

    return res.json({
      players: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("Player search error:", err);
    return res.status(500).json({ error: "Player search failed." });
  }
});

// Get player by unique_id - similar to my-app player detail page
// GET /api/players/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: player, error } = await supabase
      .from("ncaa_players_d1_male")
      .select(
        `unique_id, name_split, team, position, league, class,
         pts_g, reb_g, ast_g, fg, c_3pt, ft, stl_g, blk_g, to_g,
         min_g, g, c_2pt, efg, ts, usg, ppp, orb_g, drb_g, pf_g, a_to,
         ram, c_ram, psp, c_3pe, dsi, fgs, bms, orb_40`,
      )
      .eq("unique_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Player not found" });
      }
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch player details" });
    }

    return res.json({ player });
  } catch (err) {
    console.error("Player lookup error:", err);
    return res.status(500).json({ error: "Player lookup failed." });
  }
});

// Generate AI scouting report for a player
// POST /api/players/report
router.post("/report", async (req, res) => {
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
      efg,
      ts,
      usg,
      a_to,
      orb_g,
      ram,
      c_ram,
      psp,
      c_3pe,
      dsi,
      fgs,
      bms,
      orb_40,
    } = req.body || {};

    if (!name || !team || !position) {
      return res.status(400).json({ error: "Missing required player fields." });
    }

    const usagePct =
      usg != null
        ? `${Number(usg).toFixed(1)}% (approximate usage rate)`
        : "N/A";
    const efgPct = efg ? `${(Number(efg) * 100).toFixed(1)}%` : "N/A";
    const tsPct = ts ? `${(Number(ts) * 100).toFixed(1)}%` : "N/A";
    const fgPct = fg ? `${(Number(fg) * 100).toFixed(1)}%` : "N/A";
    const c3Pct = c_3pt ? `${(Number(c_3pt) * 100).toFixed(1)}%` : "N/A";
    const ftPct = ft ? `${(Number(ft) * 100).toFixed(1)}%` : "N/A";
    const aToRatio = a_to != null ? Number(a_to).toFixed(2) : "N/A";
    const orbPer40 =
      orb_g != null && min_g
        ? ((Number(orb_g) / Number(min_g)) * 40).toFixed(2)
        : "N/A";
    const toDiff =
      stl_g != null && to_g != null
        ? (Number(stl_g) - Number(to_g)).toFixed(2)
        : "N/A";

    const prompt = `Role: You are an expert basketball scout and data analyst.
Task: Using the attached data file and the statistical profile below, generate a concise professional scouting report called "Cerebro Report" for ${name}.

Player Profile Data (for reference, do NOT restate verbatim in a bullet list; instead, use in your analysis and tables):
- Name: ${name}
- Team: ${team}
- Class: ${playerClass || "N/A"}
- Position: ${position}
- Points per game (PTS/G): ${pts_g != null ? Number(pts_g).toFixed(1) : "N/A"}
- Rebounds per game (REB/G): ${reb_g != null ? Number(reb_g).toFixed(1) : "N/A"}
- Assists per game (AST/G): ${ast_g != null ? Number(ast_g).toFixed(1) : "N/A"}
- Minutes per game (MIN/G): ${min_g != null ? Number(min_g).toFixed(1) : "N/A"}
- Field goal percentage (FG%): ${fgPct}
- 3-point percentage (3P%): ${c3Pct}
- Free throw percentage (FT%): ${ftPct}
- Effective field goal percentage (eFG%): ${efgPct}
- True shooting percentage (TS%): ${tsPct}
- Steals per game (STL/G): ${stl_g != null ? Number(stl_g).toFixed(1) : "N/A"}
- Blocks per game (BLK/G): ${blk_g != null ? Number(blk_g).toFixed(1) : "N/A"}
- Turnovers per game (TO/G): ${to_g != null ? Number(to_g).toFixed(1) : "N/A"}
- Assist-to-turnover ratio (A/TO): ${aToRatio}
- Approximate usage rate: ${usagePct}
- Offensive rebounds per 40 minutes (ORB/40 approx.): ${orbPer40}
- Turnover differential (TO Diff = Steals - Turnovers): ${toDiff}

Follow these instructions EXACTLY.

1. Guidelines & Tone:
- Length: 250–350 words total (short, dense, and readable).
- Tone: Professional and analytical. Avoid deterministic language (e.g., instead of "will score," use phrases like "projects to be a scorer" or "statistical trends suggest").
- Format: Use the specific sections outlined below with clear headings, similar in style and brevity to a scouting newsletter blurb.

2. Required Sections (use these exact headings and ordering):

### Player Profile & Bio
Write 3–4 short sentences that read like a tight scouting blurb. Include: Name, Class (or approximate level), Team, Position, and a proposed Cerebro Archetype (based on the definitions below). You may infer Height and Hometown only if the data clearly implies typical size/region for the archetype; otherwise keep it high-level and focused on role and identity.

### 5 Standout Facts
Write exactly 5 bullet points. Each bullet should have a short, bolded label and then 1–2 sentences of explanation (e.g., "**The Shooting Leap (80 3PE):** ..."). Focus on the biggest outliers and defining traits (efficiency jumps, scoring volume, defensive impact, rim pressure, usage vs efficiency). Every fact MUST explicitly reference at least one concrete statistic (e.g., eFG%, TS%, A/TO, ORB/40, TO Diff, usage rate, PSP, DSI, etc.).

### Deep Dive: Cerebro Metrics Analysis
Use the provided Cerebro metrics EXACTLY as given in the data (do NOT alter or invent new values). Present them as a short bullet list in this format:

- **RAM**: ${ram ?? "N/A"} – short interpretation of total impact
- **C-RAM**: ${c_ram ?? "N/A"} – impact tier (Gold/Silver/Bronze) and what that means
- **PSP**: ${psp ?? "N/A"} – explanation of scoring profile
- **3PE**: ${c_3pe ?? "N/A"} – explanation of shooting gravity/efficiency
- **DSI**: ${dsi ?? "N/A"} – explanation of defensive disruption
- **FGS**: ${fgs ?? "N/A"} – explanation of playmaking / floor general skills
- **ATR / BMS**: ${bms ?? "N/A"} – explanation of rim protection / around-the-rim impact

After the bullets, add 2–3 sentences tying these metrics together into an overall impact summary using the Gold/Silver/Bronze tier definitions:
  - Gold Tier: C-RAM 10.0+ (Superstar/Player of the Year Contender)
  - Silver Tier: C-RAM 8.5–9.9 (All-Star/High-Major Starter)
  - Bronze Tier: C-RAM 7.0–8.4 (Above Average/Solid Rotation)

Also strictly apply these skill metric thresholds (0–100 scale):
- Thresholds: 60+ is GOOD, 80+ is ELITE.
- PSP (Pure Scoring Prowess): Scoring Volume + Efficiency.
- 3PE (3-Point Efficiency): 3PT Volume + Percentage.
- FGS (Floor General Skills): Assists, Turnovers, Steals.
- ATR (Around The Rim): Rebounding & Block rates (use rebounding and rim protection).
- DSI (Defensive Statistical Impact): Stocks (Steals + Blocks) vs. Fouls.

When you assign PSP, 3PE, FGS, ATR, and DSI values, make sure they are consistent with the actual per-game stats and usage listed above.

### Winning Habits & Efficiency
Present the "winning basketball" traits as a compact bullet list, using this exact format:

- **eFG%**: ${efgPct} – brief comment on shot quality and efficiency
- **TS%**: ${tsPct} – overall scoring efficiency context
- **A/TO**: ${aToRatio} – how well they value the ball
- **TO Diff (Steals − TOs)**: ${toDiff} – possession battle impact
- **ORB/40**: ${orbPer40 !== "N/A" ? orbPer40 : (orb_40 ?? "N/A")} – effort/motor and extra possessions

Follow the bullets with 2–3 sentences explaining:
- Who values the ball (low turnovers, strong A/TO, positive TO Diff).
- Who scores efficiently (high eFG% and TS% relative to role/usage).
- Who does the "dirty work" (rebounding, extra possessions, defensive activity).

### Statistical Performance Trends
Write 3–4 short bullet points that highlight the most important trends, similar in style to:
- "Scoring Explosion" (career vs recent PPG).
- "Perimeter Evolution" (career vs recent 3P% or shooting quality).
- Usage vs efficiency or defensive versatility.

### Conclusion
Provide a brief 3–4 sentence wrap-up that clearly states the primary archetype (e.g., "Point Forward", "3-and-D specialist", "Stretch Big") and how the metrics support that label. Mention any nearby sub-archetypes they are close to achieving. Keep language probabilistic ("projects", "profiles as", "statistical indicators suggest") rather than absolute.

3. Archetype Classification (follow these definitions strictly)
Using the inferred skill metrics (PSP, 3PE, FGS, ATR, DSI) and approximate usage, determine which Cerebro archetype best fits this player and explain why. Also identify any archetypes they are close to as sub-archetypes.

Use these Cerebro Archetype Thresholds (0–100 scale for skill metrics; usage is a percentage of offense):
- 3&D: minimum 65 3PE, maximum 65 FGS, minimum 55 ATR, minimum 80 DSI, maximum 25% usage.
- Stretch Big: minimum 55 PSP, minimum 60 3PE, minimum 70 ATR, minimum 70 DSI.
- Rim Runner: minimum 55 PSP, maximum 55 3PE, maximum 55 FGS, minimum 70 ATR, minimum 70 DSI.
- Modern Guard: minimum 70 PSP, minimum 70 3PE, minimum 70 FGS, minimum 25% usage.
- 2-Way Guard: minimum 70 FGS, maximum 65 ATR, minimum 65 DSI, maximum 25% usage.
- Point Forward: minimum 65 PSP, minimum 65 FGS, minimum 65 ATR, minimum 65 DSI, minimum 20% usage.
- Modern Big: minimum 70 PSP, minimum 40 3PE, minimum 50 FGS, minimum 70 ATR, minimum 70 DSI, minimum 23% usage.
- Connector: 60–80 PSP, 50–80 3PE, 60–80 FGS, 55–80 ATR, minimum 60 DSI.

VERY IMPORTANT:
- Always ground your language in the provided statistical profile and the inferred metrics you assign.
- Do NOT invent impossible numbers; keep everything consistent across tables and prose.
- Strengths and weaknesses must be described explicitly in terms of the winning habits metrics (eFG%, TS%, A/TO, TO Diff, ORB/40) and the skill metrics (PSP, 3PE, FGS, ATR, DSI).
`;

    const description = await generateReport(prompt);

    if (!description) {
      return res
        .status(500)
        .json({ error: "Model returned an empty description" });
    }

    return res.json({ description });
  } catch (err) {
    console.error("Player report error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate scouting report." });
  }
});

export default router;
