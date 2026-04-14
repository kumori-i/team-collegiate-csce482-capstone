const SEASON_SHORTHAND_PATTERN = /\b(\d{2})[-/_](\d{2})\b/g;

const LINGO_REPLACEMENTS = [
  { pattern: /\bpgg\b/gi, replacement: "ppg" },
  { pattern: /\brgp\b/gi, replacement: "rpg" },
  { pattern: /\brgg\b/gi, replacement: "rpg" },
  { pattern: /\bagg\b/gi, replacement: "apg" },
  { pattern: /\barcetypes\b/gi, replacement: "archetypes" },
  { pattern: /\barcetype\b/gi, replacement: "archetype" },
  { pattern: /\btransfered\b/gi, replacement: "transferred" },
];

const expandSeasonShorthand = (text = "") =>
  String(text || "").replace(
    SEASON_SHORTHAND_PATTERN,
    (_match, start, end) => `20${start}-${end}`,
  );

export const normalizeUserLingo = (message = "") => {
  let normalized = expandSeasonShorthand(message);
  for (const { pattern, replacement } of LINGO_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
};

export const normalizeConversationHistoryLingo = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history.map((entry) => ({
    ...entry,
    content: normalizeUserLingo(entry?.content || ""),
  }));
};
