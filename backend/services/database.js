import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

export const findUserByEmail = async (email = "") => {
  const db = await readDb();
  const target = String(email || "").trim().toLowerCase();
  return db.users.find((u) => String(u.email || "").toLowerCase() === target) || null;
};

export const createUser = async (payload = {}) => {
  const email = String(payload.email || "").trim();
  if (!email) throw new Error("Email is required");
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
  withWriteLock(async (db) => {
    const idx = db.users.findIndex((u) => String(u.id) === String(id));
    if (idx < 0) return db;
    db.users[idx] = { ...db.users[idx], ...updates };
    return db;
  }).then((db) => db.users.find((u) => String(u.id) === String(id)) || null);

export const getUserById = async (id = "") => {
  const db = await readDb();
  return db.users.find((u) => String(u.id) === String(id)) || null;
};

export const deleteUserById = async (id = "") =>
  withWriteLock(async (db) => {
    const idx = db.users.findIndex((u) => String(u.id) === String(id));
    if (idx < 0) return db;
    db.users.splice(idx, 1);
    return db;
  }).then((db) => !db.users.some((u) => String(u.id) === String(id)));

export const insertUsageEvent = async (payload = {}) => {
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
  const db = await readDb();
  const start = String(isoStart || "");
  return db.model_usage_events
    .filter((e) => String(e.user_id || "") === String(userId))
    .filter((e) => !start || String(e.created_at || "") >= start)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
};
