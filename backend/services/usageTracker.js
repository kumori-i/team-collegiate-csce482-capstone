import {
  insertUsageEvent,
  listUsageEventsByUserSince,
} from "./database.js";

const DEFAULT_GEMINI_PRICING = {
  "gemini-2.5-flash": {
    inputPerMillionUsd: 0.3,
    outputPerMillionUsd: 2.5,
  },
  "gemini-2.5-pro": {
    inputPerMillionUsd: 1.25,
    outputPerMillionUsd: 10,
  },
};

const DEFAULT_TAMU_PRICING = {
  "gpt-4.1": {
    inputPerMillionUsd: 2.0,
    outputPerMillionUsd: 8.0,
  },
  "protected.gpt-4.1": {
    inputPerMillionUsd: 2.0,
    outputPerMillionUsd: 8.0,
  },
  "gpt-4o": {
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10.0,
  },
  "protected.gpt-4o": {
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10.0,
  },
  "o3-mini": {
    inputPerMillionUsd: 1.1,
    outputPerMillionUsd: 4.4,
  },
  "protected.o3-mini": {
    inputPerMillionUsd: 1.1,
    outputPerMillionUsd: 4.4,
  },
};

const parsePricingEnv = (value = "") => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const TAMU_MODEL_PRICING = {
  ...DEFAULT_TAMU_PRICING,
  ...parsePricingEnv(process.env.TAMU_MODEL_PRICING_JSON),
};
const GEMINI_MODEL_PRICING = {
  ...DEFAULT_GEMINI_PRICING,
  ...parsePricingEnv(process.env.GEMINI_MODEL_PRICING_JSON),
};

const estimateTokens = (text = "") =>
  Math.max(1, Math.round(String(text || "").trim().length / 4));

export const normalizeUsage = ({
  prompt = "",
  responseText = "",
  usage = null,
} = {}) => {
  const inputTokens =
    Number(usage?.prompt_tokens ?? usage?.promptTokenCount) ||
    estimateTokens(prompt);
  const outputTokens =
    Number(
      usage?.completion_tokens ??
        usage?.candidatesTokenCount ??
        usage?.output_tokens,
    ) || estimateTokens(responseText);
  const totalTokens =
    Number(usage?.total_tokens ?? usage?.totalTokenCount) ||
    inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens };
};

const getPricingForModel = (provider = "", model = "") => {
  if (!model) return null;
  if (provider === "gemini") {
    return GEMINI_MODEL_PRICING[model] || null;
  }
  if (provider === "tamu") {
    return TAMU_MODEL_PRICING[model] || null;
  }
  return null;
};

const calculateCostUsd = ({
  provider = "",
  model = "",
  inputTokens = 0,
  outputTokens = 0,
} = {}) => {
  const pricing = getPricingForModel(provider, model);
  if (!pricing) return null;
  const inputCost =
    (Number(inputTokens) / 1_000_000) * Number(pricing.inputPerMillionUsd || 0);
  const outputCost =
    (Number(outputTokens) / 1_000_000) *
    Number(pricing.outputPerMillionUsd || 0);
  return Number((inputCost + outputCost).toFixed(8));
};

export const recordUsageEvent = async ({
  userId = "",
  provider = "",
  model = "",
  route = "",
  feature = "",
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
} = {}) => {
  if (!userId || !provider || !model) {
    return;
  }

  const costUsd = calculateCostUsd({
    provider,
    model,
    inputTokens,
    outputTokens,
  });

  const payload = {
    user_id: userId,
    provider,
    model,
    route,
    feature,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    created_at: new Date().toISOString(),
  };

  await insertUsageEvent(payload);
};

const isProcessingEvent = (event = {}) =>
  event.provider === "internal" && event.model === "agent_request";

const getProcessingEvents = (events = []) => {
  const processingEvents = events.filter(isProcessingEvent);
  return processingEvents.length > 0 ? processingEvents : events;
};

const getModelEvents = (events = []) =>
  events.filter((event) => !isProcessingEvent(event));

const createRangeStart = (days = 14) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const summarizeByModel = (events = [], provider = "") => {
  const grouped = new Map();
  events
    .filter((event) => event.provider === provider)
    .forEach((event) => {
      const key = event.model || "unknown";
      const entry = grouped.get(key) || {
        model: key,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        hasKnownCost: false,
      };
      entry.requests += 1;
      entry.inputTokens += Number(event.input_tokens || 0);
      entry.outputTokens += Number(event.output_tokens || 0);
      entry.totalTokens += Number(event.total_tokens || 0);
      if (event.cost_usd != null) {
        entry.costUsd += Number(event.cost_usd || 0);
        entry.hasKnownCost = true;
      }
      grouped.set(key, entry);
    });

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      costUsd: entry.hasKnownCost ? Number(entry.costUsd.toFixed(6)) : null,
    }))
    .sort((a, b) => b.requests - a.requests);
};

const summarizeByDay = (events = []) => {
  const grouped = new Map();
  events.forEach((event) => {
    const day = String(event.created_at || "").slice(0, 10);
    if (!day) return;
    const entry = grouped.get(day) || {
      day,
      requests: 0,
      totalTokens: 0,
      costUsd: 0,
      hasKnownCost: false,
    };
    entry.requests += 1;
    entry.totalTokens += Number(event.total_tokens || 0);
    if (event.cost_usd != null) {
      entry.costUsd += Number(event.cost_usd || 0);
      entry.hasKnownCost = true;
    }
    grouped.set(day, entry);
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((entry) => ({
      ...entry,
      costUsd: entry.hasKnownCost ? Number(entry.costUsd.toFixed(6)) : null,
    }));
};

export const getUsageDashboard = async ({ userId = "", days = 14 } = {}) => {
  const events = await listUsageEventsByUserSince({
    userId,
    isoStart: createRangeStart(days),
  });
  const processingEvents = getProcessingEvents(events);
  const modelEvents = getModelEvents(events);
  const totals = modelEvents.reduce(
    (acc, event) => {
      acc.inputTokens += Number(event.input_tokens || 0);
      acc.outputTokens += Number(event.output_tokens || 0);
      acc.totalTokens += Number(event.total_tokens || 0);
      if (event.cost_usd != null) {
        acc.costUsd += Number(event.cost_usd || 0);
        acc.hasKnownCost = true;
      }
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      hasKnownCost: false,
    },
  );

  return {
    rangeDays: days,
    totals: {
      requests: processingEvents.length,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      totalTokens: totals.totalTokens,
      costUsd: totals.hasKnownCost ? Number(totals.costUsd.toFixed(6)) : null,
    },
    geminiModels: summarizeByModel(modelEvents, "gemini"),
    tamuModels: summarizeByModel(modelEvents, "tamu"),
    dailyUsage: summarizeByDay(processingEvents),
  };
};
