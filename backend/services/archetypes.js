export const ARCHETYPES = [
  {
    name: "The Connector",
    ranges: {
      psp: { min: 60, max: 80 },
      c_3pe: { min: 50, max: 90 },
      fgs: { min: 60, max: 80 },
      atr: { min: 55, max: 80 },
      dsi: { min: 50, max: null },
      usg: { min: 0, max: 25 },
    },
  },
  {
    name: "Modern Big",
    ranges: {
      psp: { min: 70, max: null },
      c_3pe: { min: 40, max: null },
      fgs: { min: 50, max: null },
      atr: { min: 70, max: null },
      dsi: { min: 70, max: null },
      usg: { min: 23, max: null },
    },
  },
  {
    name: "Point Forward",
    ranges: {
      psp: { min: 65, max: null },
      c_3pe: { min: null, max: null },
      fgs: { min: 65, max: null },
      atr: { min: 65, max: null },
      dsi: { min: 65, max: null },
      usg: { min: 20, max: null },
    },
  },
  {
    name: "2 Way Guard",
    ranges: {
      psp: { min: null, max: null },
      c_3pe: { min: null, max: null },
      fgs: { min: 70, max: null },
      atr: { min: null, max: 85 },
      dsi: { min: 65, max: null },
      usg: { min: 0, max: 25 },
    },
  },
  {
    name: "Modern Guard",
    ranges: {
      psp: { min: 70, max: null },
      c_3pe: { min: 70, max: null },
      fgs: { min: 70, max: null },
      atr: { min: null, max: null },
      dsi: { min: null, max: null },
      usg: { min: 25, max: null },
    },
  },
  {
    name: "Rim Runner",
    ranges: {
      psp: { min: 55, max: null },
      c_3pe: { min: null, max: 55 },
      fgs: { min: null, max: 55 },
      atr: { min: 70, max: null },
      dsi: { min: 70, max: null },
      usg: { min: null, max: null },
    },
  },
  {
    name: "3 and D",
    ranges: {
      psp: { min: null, max: null },
      c_3pe: { min: 65, max: null },
      fgs: { min: null, max: 65 },
      atr: { min: 55, max: null },
      dsi: { min: 80, max: null },
      usg: { min: 0, max: 25 },
    },
  },
];

const normalizePercentLike = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue <= 1 ? numericValue * 100 : numericValue;
};

const matchesArchetypeRange = (value, range) => {
  if (!range || (range.min === null && range.max === null)) return true;
  if (!Number.isFinite(value)) return false;
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
};

const ARCHETYPE_METRIC_LABELS = {
  psp: "PSP",
  c_3pe: "3PE",
  fgs: "FGS",
  atr: "ATR (mapped from the player `ram` field)",
  dsi: "DSI",
  usg: "USG%",
};

const formatRange = ({ min = null, max = null } = {}) => {
  if (min === null && max === null) return "any value";
  if (min !== null && max !== null) return `${min}-${max}`;
  if (min !== null) return `>= ${min}`;
  return `<= ${max}`;
};

export const getArchetypePromptContext = () => {
  const archetypeLines = ARCHETYPES.map((archetype) => {
    const thresholds = Object.entries(archetype.ranges)
      .map(
        ([metric, range]) =>
          `${ARCHETYPE_METRIC_LABELS[metric] || metric}: ${formatRange(range)}`,
      )
      .join(", ");
    return `- ${archetype.name}: ${thresholds}`;
  }).join("\n");

  return `Archetype reference for this app:
- A player matches an archetype only if every listed threshold is satisfied.
- In these archetype rules, ATR maps to the player data field \`ram\`.
- For \`c_3pe\` and \`usg\`, treat the values as percentage-like on a 0-100 scale.
- If a user asks what an archetype means, explain it using the threshold ranges below.
- If a user asks whether a specific player fits an archetype and the current evidence does not include that player's data, say you need the player record or a search first.
- If a user asks for players in an archetype, do not invent results from memory; use only tool data if available.

Defined archetypes:
${archetypeLines}`;
};

export const resolvePlayerArchetypes = (player) => {
  if (!player) return [];
  const values = {
    psp: Number(player.psp),
    c_3pe: normalizePercentLike(player.c_3pe),
    fgs: Number(player.fgs),
    atr: Number(player.ram),
    dsi: Number(player.dsi),
    usg: normalizePercentLike(player.usg),
  };

  return ARCHETYPES.filter((archetype) =>
    Object.entries(archetype.ranges).every(([metric, range]) =>
      matchesArchetypeRange(values[metric], range),
    ),
  ).map((archetype) => archetype.name);
};

export const isArchetypeQuestion = (message = "") => {
  const text = String(message || "").toLowerCase();
  if (!text) return false;
  if (/\barchetype\b|\barchetypes\b/.test(text)) return true;
  return ARCHETYPES.some((archetype) =>
    text.includes(archetype.name.toLowerCase()),
  );
};
