import { CONFIG } from "./config.js?v=7";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = (n = 20) => {
  const a = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => a[x % a.length]).join("");
};

const L = CONFIG.locale;
export const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString(L, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
export const fmtDateShort = (ms) => ms ? new Date(ms).toLocaleDateString(L, { weekday: "short", day: "numeric", month: "short" }) : "";
export const fmtTime = (ms) => ms ? new Date(ms).toLocaleTimeString(L, { hour: "2-digit", minute: "2-digit" }) : "";
export const fmtDT = (ms) => ms ? `${fmtDateShort(ms)}, ${fmtTime(ms)}` : "";
export const fmtDay = (iso) => iso ? new Date(iso + "T12:00:00").toLocaleDateString(L, { day: "numeric", month: "short", year: "numeric" }) : "";
export const money = (n) => (Number(n) || 0).toLocaleString(L, { style: "currency", currency: CONFIG.currency, maximumFractionDigits: 2 });
export const hoursOf = (e) => e && e.end && e.start ? Math.round(((e.end - e.start) / 36e5) * 100) / 100 : 0;
export const pad = (n) => String(n).padStart(2, "0");
export const toDateInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const toTimeInput = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fromInputs = (date, time) => { if (!date) return null; const [y, m, d] = date.split("-").map(Number); const [hh, mm] = (time || "00:00").split(":").map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
export const todayISO = () => toDateInput(Date.now());
export const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
export const daysUntil = (iso) => iso ? Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 864e5) : null;
export const ago = (ms) => {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
  return fmtDate(ms);
};

export const TYPES = {
  shoot: { label: "Shoot", tag: "Shoot", plural: "Shoots", icon: "🎬" },
  recording: { label: "Recording", tag: "Rec", plural: "Recording sessions", icon: "🎙️" },
  management: { label: "Management", tag: "Mgmt", plural: "Management items", icon: "📋" },
  meeting: { label: "Team meeting", tag: "Meet", plural: "Team meetings", icon: "🤝" },
  unsorted: { label: "Unsorted", tag: "", plural: "Unsorted", icon: "❔" },
};
export const SUBTYPES = {
  shoot: ["Music video", "Visualizer", "Social content", "Photo shoot", "Behind the scenes", "Other"],
  recording: ["Recording", "Writing session", "Mixing", "Mastering", "Rehearsal", "Other"],
  management: ["Artist meeting", "Release / drop", "Concert / gig", "Deadline", "Promo / interview", "Other"],
  meeting: ["Weekly sync", "Planning", "Creative / brainstorm", "Money / finance", "Review / feedback", "Other"],
  unsorted: ["Other"],
};
export const EQUIP_CATS = ["Camera", "Lens", "Lighting", "Light modifier", "Stand / grip", "Audio", "Power / batteries", "Storage / media", "Computer", "Other"];
export const EQUIP_PREFIX = { Camera: "CAM", Lens: "LNS", Lighting: "LGT", "Light modifier": "MOD", "Stand / grip": "STD", Audio: "AUD", "Power / batteries": "PWR", "Storage / media": "MED", Computer: "CMP", Other: "OTH" };
export const CONDITIONS = ["Excellent", "Good", "Fair", "Needs repair", "Broken"];
export const EQUIP_STATUS = ["Available", "In repair", "Lent out", "Retired"];
export const DOC_CATS = ["Contract", "Invoice / receipt", "Release form", "Brief / treatment", "Rider", "Lyrics / credits", "ID / company", "Other"];
export const CONTRACT_TYPES = ["Management", "Recording / production", "Video production", "Distribution", "Publishing", "Booking", "Other"];

let toastT;
export function toast(msg, bad = false) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); document.body.appendChild(t); }
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), bad ? 6000 : 2600);
}

/** Open a modal. Returns {el, close}. */
export function modal(html, { wide = false, onClose } = {}) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal ${wide ? "wide" : ""}">${html}</div>`;
  document.body.appendChild(bg);
  document.body.style.overflow = "hidden";
  const close = () => { bg.remove(); if (!document.querySelector(".modal-bg")) document.body.style.overflow = ""; onClose && onClose(); };
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) bg._down = true; });
  bg.addEventListener("click", (e) => { if (e.target === bg && bg._down) close(); bg._down = false; });
  bg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  const first = bg.querySelector("input:not([type=checkbox]),select,textarea");
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 30);
  return { el: bg.firstElementChild, close };
}

export function confirmBox(text, okLabel = "Confirm", danger = true) {
  return new Promise((res) => {
    const m = modal(`<div class="mh"><h2>Are you sure?</h2></div><p>${esc(text)}</p>
      <div class="mf"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(okLabel)}</button></div>`, { onClose: () => res(false) });
    m.el.querySelector("[data-no]").onclick = () => { m.close(); };
    m.el.querySelector("[data-yes]").onclick = () => { res(true); m.close(); };
  });
}

export const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? "") ? "selected" : ""}>${esc(label ?? v)}</option>`;
export const val = (root, name) => { const el = root.querySelector(`[name="${name}"]`); if (!el) return undefined; return el.type === "checkbox" ? el.checked : el.value.trim(); };
export const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

export const TYPE_ORDER = ["shoot", "recording", "management", "meeting", "unsorted"];
export const NO_GEAR = new Set(["management", "meeting"]);
