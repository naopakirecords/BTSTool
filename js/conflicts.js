import { S, events, byId, memberName, artistName, equipLabel, locName } from "./store.js?v=5";
import { fmtDT, fmtTime, startOfDay, addDays } from "./util.js?v=5";

const active = (e) => !e.deleted && e.status !== "cancelled" && e.start && e.end;
export const windowOf = (e) => { const t = (Number(e.travelMin) || 0) * 6e4; return [e.start - t, e.end + t]; };
const overlaps = (a, b) => { const [s1, e1] = windowOf(a), [s2, e2] = windowOf(b); return s1 < e2 && s2 < e1; };
const evLabel = (o) => `“${o.title || "Untitled"}” (${fmtDT(o.start)}–${fmtTime(o.end)})`;

/**
 * Every clash for a candidate event. Each item:
 * { kind: 'member'|'equipment'|'artist'|'location'|'status', id, other, msg }
 */
export function findConflicts(c, list = events()) {
  const out = [];
  if (!c.start || !c.end) return out;
  if (c.end <= c.start) out.push({ kind: "time", msg: "End time must be after the start time." });
  for (const id of c.equipmentIds || []) {
    const q = byId("equipment", id);
    if (q && q.status && q.status !== "Available") out.push({ kind: "status", id, msg: `${equipLabel(id)} is marked “${q.status}”.` });
    else if (q && (q.condition === "Broken")) out.push({ kind: "status", id, msg: `${equipLabel(id)} is marked “Broken”.` });
  }
  if (c.status === "cancelled") return out;
  for (const o of list) {
    if (o.id === c.id || !active(o) || !overlaps(c, o)) continue;
    for (const m of c.memberIds || []) if ((o.memberIds || []).includes(m)) out.push({ kind: "member", id: m, other: o, msg: `${memberName(m)} is already on ${evLabel(o)}.` });
    for (const q of c.equipmentIds || []) if ((o.equipmentIds || []).includes(q)) out.push({ kind: "equipment", id: q, other: o, msg: `${equipLabel(q)} is already booked for ${evLabel(o)}.` });
    if (c.artistId && c.artistId === o.artistId) out.push({ kind: "artist", id: c.artistId, other: o, msg: `${artistName(c.artistId)} is already booked for ${evLabel(o)}.` });
    if (c.locationId && c.locationId === o.locationId) out.push({ kind: "location", id: c.locationId, other: o, msg: `${locName(c)} is already in use for ${evLabel(o)}.` });
  }
  return out;
}

/** Members who are free for the candidate's time window. */
export function freeMembers(c, list = events()) {
  return S.members.filter((m) => m.active !== false && !(c.memberIds || []).includes(m.id) &&
    !list.some((o) => o.id !== c.id && active(o) && overlaps(c, o) && (o.memberIds || []).includes(m.id)));
}
/** Items of the same category that are available and free. */
export function freeEquipment(c, itemId, list = events()) {
  const item = byId("equipment", itemId);
  return S.equipment.filter((q) => q.id !== itemId && (!item || q.category === item.category) && (q.status || "Available") === "Available" && q.condition !== "Broken" &&
    !(c.equipmentIds || []).includes(q.id) && !list.some((o) => o.id !== c.id && active(o) && overlaps(c, o) && (o.equipmentIds || []).includes(q.id)));
}
/** Is item busy at candidate time? returns the other event or null */
export function equipmentBusy(c, itemId, list = events()) {
  return list.find((o) => o.id !== c.id && active(o) && c.start && c.end && overlaps(c, o) && (o.equipmentIds || []).includes(itemId)) || null;
}
export function memberBusy(c, email, list = events()) {
  return list.find((o) => o.id !== c.id && active(o) && c.start && c.end && overlaps(c, o) && (o.memberIds || []).includes(email)) || null;
}

/** Earliest start (15-min steps, next 14 days, 07:00–23:00) where the event has no clashes. */
export function nextFreeSlot(c, list = events()) {
  const dur = c.end - c.start;
  let t = c.start + 15 * 6e4;
  const limit = addDays(c.start, 14);
  while (t < limit) {
    const d = new Date(t), h = d.getHours();
    if (h < 7) { t = startOfDay(t) + 7 * 36e5; continue; }
    if (h >= 23) { t = startOfDay(addDays(t, 1)) + 7 * 36e5; continue; }
    const cand = { ...c, start: t, end: t + dur };
    if (!findConflicts(cand, list).some((x) => x.other)) return t;
    t += 15 * 6e4;
  }
  return null;
}

/** All clashes among upcoming events (for the alerts list). */
export function allConflicts() {
  const now = Date.now();
  const list = events().filter((e) => active(e) && e.end > now).sort((a, b) => a.start - b.start);
  const seen = new Set(), out = [];
  for (const e of list) {
    for (const c of findConflicts(e, list)) {
      const key = c.other ? [e.id, c.other.id].sort().join("|") + c.kind + c.id : e.id + c.kind + c.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ event: e, ...c });
    }
  }
  return out;
}
