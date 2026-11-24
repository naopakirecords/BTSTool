import { db, auth, collection, doc, onSnapshot, writeBatch, query, orderBy, limit, deleteDoc, setDoc } from "./firebase.js?v=6";
import { CONFIG } from "./config.js?v=6";
import { uid } from "./util.js?v=6";

export const COLS = ["members", "artists", "contracts", "events", "equipment", "locations", "docs", "links"];
export const S = { user: null, me: null, activity: [], loaded: new Set() };
COLS.forEach((c) => (S[c] = []));

const subs = new Set();
export const onChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };
let emitT;
const emit = () => { clearTimeout(emitT); emitT = setTimeout(() => subs.forEach((f) => f()), 30); };

let unsubs = [];
export function startSync(onFirst) {
  stopSync();
  let pending = COLS.length + 1;
  const done = (k) => { if (!S.loaded.has(k)) { S.loaded.add(k); if (--pending === 0) onFirst && onFirst(); } };
  for (const c of COLS) {
    unsubs.push(onSnapshot(collection(db, c), (snap) => {
      S[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (c === "members" && S.user) S.me = S.members.find((m) => m.id === S.user.email.toLowerCase()) || S.me;
      done(c); emit();
    }, (err) => { console.error(c, err); done(c); emit(); }));
  }
  unsubs.push(onSnapshot(query(collection(db, "activity"), orderBy("ts", "desc"), limit(600)), (snap) => {
    S.activity = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    done("activity"); emit();
  }, (err) => { console.error("activity", err); done("activity"); }));
}
export function stopSync() { unsubs.forEach((u) => u()); unsubs = []; S.loaded.clear(); }

export const byId = (col, id) => S[col].find((x) => x.id === id);
export const live = (col) => S[col].filter((x) => !x.deleted);
export const events = () => S.events.filter((e) => !e.deleted);
export const memberName = (email) => byId("members", email)?.name || email || "";
export const artistName = (id) => byId("artists", id)?.name || "";
export const equipLabel = (id) => { const q = byId("equipment", id); return q ? `${q.number ? q.number + " · " : ""}${q.name}` : "(removed item)"; };
export const locName = (e) => (e.locationId && byId("locations", e.locationId)?.name) || e.locationText || "";

const META = new Set(["updatedAt", "updatedBy", "updatedByName", "createdAt", "createdBy", "syncedAt", "gcalUpdated", "gcalId", "source"]);
const short = (v) => { if (v === undefined || v === null || v === "") return ""; const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > 400 ? s.slice(0, 400) + "…" : s; };
function diff(old, neu) {
  const out = [];
  const keys = new Set([...Object.keys(old || {}), ...Object.keys(neu || {})]);
  for (const k of keys) {
    if (META.has(k) || k === "id") continue;
    if (!(k in neu)) continue;
    const a = short(old ? old[k] : ""), b = short(neu[k]);
    if (a !== b) out.push({ f: k, from: a, to: b });
  }
  return out;
}

const clean = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v; return r; };

/** Create or update a document, with an activity-log entry. Returns id. */
export async function save(col, id, data, label, extraBatch) {
  const ref = id ? doc(db, col, id) : doc(collection(db, col));
  const old = id ? byId(col, id) : null;
  const now = Date.now();
  const payload = clean({ ...data, updatedAt: now, updatedBy: S.me.id, updatedByName: S.me.name });
  if (!old) { payload.createdAt = now; payload.createdBy = S.me.id; }
  const changes = diff(old, payload);
  const b = writeBatch(db);
  b.set(ref, payload, { merge: true });
  if (!old || changes.length) {
    b.set(doc(collection(db, "activity")), { ts: now, by: S.me.id, byName: S.me.name, action: old ? (data.deleted ? "deleted" : "updated") : "created", col, docId: ref.id, label: label || "", changes: old ? changes : [] });
  }
  extraBatch && extraBatch(b, ref.id);
  await b.commit();
  if (col === "events") pingSync();
  return ref.id;
}

export async function remove(col, id, label) {
  const now = Date.now();
  const b = writeBatch(db);
  b.delete(doc(db, col, id));
  b.set(doc(collection(db, "activity")), { ts: now, by: S.me.id, byName: S.me.name, action: "deleted", col, docId: id, label: label || "", changes: [] });
  await b.commit();
}

export async function setRaw(col, id, data) { await setDoc(doc(db, col, id), data, { merge: true }); }
export async function delRaw(col, id) { await deleteDoc(doc(db, col, id)); }

// ── Apps Script bridge ──
export const scriptReady = () => CONFIG.appsScriptUrl && !CONFIG.appsScriptUrl.startsWith("__");
let pingT;
export function pingSync() {
  if (!scriptReady()) return;
  clearTimeout(pingT);
  pingT = setTimeout(() => {
    fetch(CONFIG.appsScriptUrl, { method: "POST", body: JSON.stringify({ action: "ping" }) }).catch(() => {});
  }, 1200);
}
export async function callScript(action, payload = {}) {
  if (!scriptReady()) throw new Error("Google connection is not set up yet (Apps Script URL missing in config).");
  const idToken = await auth.currentUser.getIdToken();
  const r = await fetch(CONFIG.appsScriptUrl, { method: "POST", body: JSON.stringify({ action, idToken, ...payload }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Request failed");
  return j;
}

export { uid };
