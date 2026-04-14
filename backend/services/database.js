import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const DB_PATH = process.env.APP_DB_PATH
  ? path.resolve(process.env.APP_DB_PATH)
  : path.resolve(process.cwd(), ".data", "app-db.json");

let writeQueue = Promise.resolve();

const defaultDb = () => ({
  users: [],
  model_usage_events: [],
});

const ensureDbFile = async () => {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await readFile(DB_PATH, "utf-8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify(defaultDb(), null, 2), "utf-8");
  }
};

const readDb = async () => {
  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf-8");
  const parsed = JSON.parse(raw || "{}");
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    model_usage_events: Array.isArray(parsed.model_usage_events)
      ? parsed.model_usage_events
      : [],
  };
};

const writeDb = async (db) => {
  await ensureDbFile();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
};

const withWriteLock = async (updater) => {
  writeQueue = writeQueue.then(async () => {
    const db = await readDb();
    const out = (await updater(db)) || db;
    await writeDb(out);
    return out;
  });
  return writeQueue;
};

const normalizeDuplicateEmailError = (error) => {
  if (!error) return null;
  if (error.code === "23505") {
    const out = new Error("Email already registered");
    out.code = "DUPLICATE_EMAIL";
    return out;
  }
  const message = String(error.message || "").toLowerCase();
  if (message.includes("duplicate") && message.includes("email")) {
    const out = new Error("Email already registered");
    out.code = "DUPLICATE_EMAIL";
    return out;
  }
  return null;
};

const toPlainSupabaseError = (context, error) =>
  new Error(`${context}: ${error?.message || "Unknown database error"}`);

export const findUserByEmail = async (email = "") => {
  if (supabase) {
    const target = String(email || "").trim().toLowerCase();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", target)
      .limit(1);
    if (error) throw toPlainSupabaseError("User lookup failed", error);
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }
  const db = await readDb();
  const target = String(email || "").trim().toLowerCase();
  return db.users.find((u) => String(u.email || "").toLowerCase() === target) || null;
};

export const createUser = async (payload = {}) => {
  const email = String(payload.email || "").trim();
  if (!email) throw new Error("Email is required");
  if (supabase) {
    const insertPayload = {
      id: payload.id || randomUUID(),
      email,
      name: payload.name || email.split("@")[0],
      password_hash: payload.password_hash || null,
      google_id: payload.google_id || null,
      created_at: payload.created_at || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) {
      const duplicateErr = normalizeDuplicateEmailError(error);
      if (duplicateErr) throw duplicateErr;
      throw toPlainSupabaseError("User creation failed", error);
    }
    return data;
  }
  return withWriteLock(async (db) => {
    const exists = db.users.some(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (exists) {
      const err = new Error("Email already registered");
      err.code = "DUPLICATE_EMAIL";
      throw err;
    }
    const user = {
      id: payload.id || randomUUID(),
      email,
      name: payload.name || email.split("@")[0],
      password_hash: payload.password_hash || null,
      google_id: payload.google_id || null,
      created_at: payload.created_at || new Date().toISOString(),
    };
    db.users.push(user);
    return db;
  }).then((db) =>
    db.users.find(
      (u) => String(u.email || "").toLowerCase() === String(email).toLowerCase(),
    ),
  );
};

export const updateUserById = async (id = "", updates = {}) =>
  supabase
    ? (async () => {
        const { data, error } = await supabase
          .from("users")
          .update(updates)
          .eq("id", id)
          .select("*")
          .single();
        if (error) {
          if (error.code === "PGRST116") return null;
          throw toPlainSupabaseError("User update failed", error);
        }
        return data || null;
      })()
    :
  withWriteLock(async (db) => {
    const idx = db.users.findIndex((u) => String(u.id) === String(id));
    if (idx < 0) return db;
    db.users[idx] = { ...db.users[idx], ...updates };
    return db;
  }).then((db) => db.users.find((u) => String(u.id) === String(id)) || null);

export const getUserById = async (id = "") => {
  if (supabase) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw toPlainSupabaseError("User lookup failed", error);
    }
    return data || null;
  }
  const db = await readDb();
  return db.users.find((u) => String(u.id) === String(id)) || null;
};

export const deleteUserById = async (id = "") =>
  supabase
    ? (async () => {
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw toPlainSupabaseError("User deletion failed", error);
        return true;
      })()
    :
  withWriteLock(async (db) => {
    const idx = db.users.findIndex((u) => String(u.id) === String(id));
    if (idx < 0) return db;
    db.users.splice(idx, 1);
    return db;
  }).then((db) => !db.users.some((u) => String(u.id) === String(id)));

export const insertUsageEvent = async (payload = {}) => {
  if (supabase) {
    const { error } = await supabase.from("model_usage_events").insert({
      ...payload,
      created_at: payload.created_at || new Date().toISOString(),
    });
    if (error) throw toPlainSupabaseError("Usage event insert failed", error);
    return;
  }
  await withWriteLock(async (db) => {
    db.model_usage_events.push({
      ...payload,
      created_at: payload.created_at || new Date().toISOString(),
    });
    return db;
  });
};

export const listUsageEventsByUserSince = async ({
  userId = "",
  isoStart = "",
} = {}) => {
  if (supabase) {
    let query = supabase
      .from("model_usage_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (isoStart) {
      query = query.gte("created_at", String(isoStart));
    }
    const { data, error } = await query;
    if (error) throw toPlainSupabaseError("Usage event list failed", error);
    return data || [];
  }
  const db = await readDb();
  const start = String(isoStart || "");
  return db.model_usage_events
    .filter((e) => String(e.user_id || "") === String(userId))
    .filter((e) => !start || String(e.created_at || "") >= start)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
};
