import { S, byId, events, save, remove, artistName, memberName } from "./store.js?v=11";
import { historyModal } from "./events.js?v=11";
import { esc, $, $$, modal, toast, confirmBox, opt, val, money, fmtDay, fmtDateShort, todayISO, daysUntil, TYPES } from "./util.js?v=11";

export const EXP_KINDS = {
  company: { label: "Company / subscription", icon: "🏢" },
  artist: { label: "Artist", icon: "🎤" },
  booking: { label: "Shoot / session", icon: "🎬" },
  other: { label: "Other", icon: "📦" },
};
export const FREQ = { once: "One-off", weekly: "Every week", monthly: "Every month", quarterly: "Every 3 months", yearly: "Every year" };
export const EXP_CATS = ["Software / subscription", "Equipment", "Studio / rent", "Travel / transport", "Food / catering", "Marketing / ads", "Props / wardrobe", "Fees / services", "Other"];

// ── dates (ISO yyyy-mm-dd, local) ──
const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function step(base, k, freq) {
  const d = parse(base);
  if (freq === "weekly") return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * k));
  const months = freq === "monthly" ? k : freq === "quarterly" ? 3 * k : 12 * k;
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return iso(new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)));
}
/** All due dates of an expense between two ISO dates (inclusive). */
export function occurrences(x, from, to) {
  if (!x.date) return [];
  if (!x.freq || x.freq === "once") return x.date >= from && x.date <= to ? [x.date] : [];
  const out = [], end = x.endDate && x.endDate < to ? x.endDate : to;
  for (let k = 0; k < 2000; k++) { const d = step(x.date, k, x.freq); if (d > end) break; if (d >= from) out.push(d); }
  return out;
}
export const isPaid = (x, d) => (!x.freq || x.freq === "once") ? !!x.paid : (x.paidDates || []).includes(d);
const monthlyCost = (x) => ({ weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[x.freq] || 0) * (Number(x.amount) || 0);
const active = (x) => !x.endDate || x.endDate >= todayISO();
/** Unpaid due dates up to today (+ `ahead` days). */
export function unpaidDue(ahead = 0) {
  const t = todayISO(), lim = iso(new Date(Date.now() + ahead * 864e5));
  const out = [];
  for (const x of S.expenses) for (const d of occurrences(x, x.date || t, lim)) if (!isPaid(x, d)) out.push({ x, d, overdue: d < t });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
export function expensesOnDay(dayIso) {
  return S.expenses.flatMap((x) => occurrences(x, dayIso, dayIso).map((d) => ({ x, d })));
}
const linkLabel = (x) => {
  if (x.kind === "booking" && x.eventId) { const e = byId("events", x.eventId); return e ? `${TYPES[e.type]?.icon || ""} ${e.title}` : "(removed booking)"; }
  if (x.kind === "artist" && x.artistId) return "🎤 " + artistName(x.artistId);
  return x.category || "";
};
export function expenseRow({ x, d }, { showDate = true } = {}) {
  const k = EXP_KINDS[x.kind] || EXP_KINDS.other;
  const paid = d ? isPaid(x, d) : (x.freq === "once" ? !!x.paid : null);
  const overdue = d && !paid && d < todayISO();
  return `<div class="item t-expense" data-exp="${esc(x.id)}" data-d="${esc(d || "")}"><div class="bar"></div><div class="body">
    <div class="t">💶 ${esc(x.title)} <span class="dim" style="font-weight:400">· ${esc(money(x.amount))}</span></div>
    <div class="meta">${showDate && d ? `<span>${esc(fmtDay(d))}</span>` : ""}<span>${k.icon} ${esc(k.label)}</span><span>🔁 ${esc(FREQ[x.freq || "once"])}</span>${linkLabel(x) ? `<span>${esc(linkLabel(x))}</span>` : ""}${x.paidBy ? `<span>paid by ${esc(memberName(x.paidBy))}</span>` : ""}</div></div>
    <div class="right">${paid === null ? "" : paid ? '<span class="badge ok">Paid</span>' : overdue ? '<span class="badge bad">Overdue</span>' : '<span class="badge warn">Unpaid</span>'}
      ${d && !paid ? `<div style="margin-top:6px"><button class="btn sm" data-pay="${esc(x.id)}" data-pd="${esc(d)}">Mark paid</button></div>` : ""}</div></div>`;
}
export async function markPaid(id, d, on = true) {
  const x = byId("expenses", id);
  if (!x) return;
  if (!x.freq || x.freq === "once") await save("expenses", id, { paid: on, paidOn: on ? todayISO() : "" }, x.title);
  else {
    const set = new Set(x.paidDates || []); on ? set.add(d) : set.delete(d);
    await save("expenses", id, { paidDates: [...set].sort() }, x.title);
  }
  toast(on ? "Marked as paid" : "Marked as unpaid");
}
export function bindExpenseRows(root) {
  $$("[data-pay]", root).forEach((b) => b.onclick = (e) => { e.stopPropagation(); markPaid(b.dataset.pay, b.dataset.pd); });
  $$("[data-exp]", root).forEach((r) => r.onclick = () => openExpenseEditor(r.dataset.exp));
}

// ─────────── Page ───────────
let tab = "upcoming", kindF = "";
export function renderExpenses(root) {
  const t = todayISO();
  const now = new Date(), mFrom = iso(new Date(now.getFullYear(), now.getMonth(), 1)), mTo = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const thisMonth = S.expenses.reduce((s, x) => s + occurrences(x, mFrom, mTo).length * (Number(x.amount) || 0), 0);
  const recurring = S.expenses.filter((x) => x.freq && x.freq !== "once" && active(x)).reduce((s, x) => s + monthlyCost(x), 0);
  const due = unpaidDue(0);
  const overdueSum = due.filter((u) => u.overdue).reduce((s, u) => s + (Number(u.x.amount) || 0), 0);
  let rows;
  const all = kindF ? S.expenses.filter((x) => x.kind === kindF) : S.expenses;
  if (tab === "upcoming") {
    const to = iso(new Date(Date.now() + 60 * 864e5));
    rows = all.flatMap((x) => occurrences(x, t, to).map((d) => ({ x, d }))).sort((a, b) => a.d.localeCompare(b.d));
  } else if (tab === "unpaid") {
    rows = unpaidDue(60).filter((u) => !kindF || u.x.kind === kindF);
  } else if (tab === "subs") {
    rows = all.filter((x) => x.freq && x.freq !== "once").sort((a, b) => a.title.localeCompare(b.title)).map((x) => ({ x, d: occurrences(x, t, "9999-12-31")[0] || null }));
  } else {
    rows = [...all].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((x) => ({ x, d: x.freq === "once" ? x.date : null }));
  }
  root.innerHTML = `<div class="topbar"><h1>Expenses</h1><button class="btn primary" data-new>+ New expense</button></div>
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><div class="v">${esc(money(thisMonth))}</div><div class="k">Due this month</div></div>
      <div class="stat"><div class="v">${esc(money(recurring))}</div><div class="k">Repeating costs / month</div></div>
      <div class="stat"><div class="v">${esc(money(recurring * 12))}</div><div class="k">Repeating costs / year</div></div>
      <div class="stat"><div class="v ${overdueSum ? "money-pos" : "money-ok"}">${esc(money(overdueSum))}</div><div class="k">Overdue (${due.filter((u) => u.overdue).length})</div></div></div>
    <div class="row" style="align-items:center;margin-bottom:12px"><div class="tabs" style="margin:0;flex:0 0 auto">${[["upcoming", "Next 60 days"], ["unpaid", "Unpaid"], ["subs", "Repeating"], ["all", "All"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <select data-kind style="max-width:240px">${opt("", "All types", kindF)}${Object.entries(EXP_KINDS).map(([k, v]) => opt(k, v.icon + " " + v.label, kindF)).join("")}</select></div>
    <div class="card flat"><div class="list">${rows.map((r) => expenseRow(r)).join("") || '<div class="empty">No expenses here.</div>'}</div></div>
    <p class="dim" style="font-size:.85rem">Due dates show in the Calendar (💶). Overdue and soon-due payments appear on Home.</p>`;
  $("[data-new]", root).onclick = () => openExpenseEditor();
  $$("[data-tab]", root).forEach((b) => b.onclick = () => { tab = b.dataset.tab; renderExpenses(root); });
  $("[data-kind]", root).onchange = (e) => { kindF = e.target.value; renderExpenses(root); };
  bindExpenseRows(root);
}

// ─────────── Editor ───────────
export function openExpenseEditor(id, preset = {}) {
  const x0 = id ? byId("expenses", id) : { kind: "company", freq: "once", date: todayISO(), category: "", ...preset };
  const st = JSON.parse(JSON.stringify(x0)); st.paidDates = st.paidDates || [];
  const arts = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
  const evs = events().filter((e) => e.type !== "unsorted").sort((a, b) => b.start - a.start).slice(0, 150);
  const m = modal(`<div class="mh"><h2>${id ? "Edit expense" : "New expense"}</h2><button class="x" data-close>×</button></div>
    <div class="row"><div class="field"><label>What is it?</label><input name="title" value="${esc(st.title || "")}" placeholder="e.g. Adobe Creative Cloud, taxi to set, studio rent"></div>
      <div class="field" style="flex:0 1 140px"><label>Amount (€)</label><input type="number" step="0.01" min="0" name="amount" value="${esc(st.amount ?? "")}"></div></div>
    <div class="field"><label>Type</label><div class="tabs" data-kinds style="margin:0">${Object.entries(EXP_KINDS).map(([k, v]) => `<button type="button" data-k="${k}">${v.icon} ${v.label}</button>`).join("")}</div></div>
    <div class="field" data-artf><label>Artist</label><select name="artistId">${opt("", "— choose —", st.artistId)}${arts.map((a) => opt(a.id, a.name + (a.managed ? " ★" : ""), st.artistId)).join("")}</select></div>
    <div class="field" data-evf><label>Shoot / session / meeting</label><select name="eventId">${opt("", "— choose —", st.eventId)}${evs.map((e) => opt(e.id, `${fmtDateShort(e.start)} · ${TYPES[e.type]?.icon || ""} ${e.title}`, st.eventId)).join("")}</select></div>
    <div class="row"><div class="field"><label>Category</label><select name="category">${opt("", "—", st.category)}${EXP_CATS.map((c) => opt(c, c, st.category)).join("")}</select></div>
      <div class="field"><label>How often?</label><select name="freq">${Object.entries(FREQ).map(([k, v]) => opt(k, v, st.freq || "once")).join("")}</select></div></div>
    <div class="row"><div class="field"><label data-datelabel>Date</label><input type="date" name="date" value="${esc(st.date || todayISO())}"></div>
      <div class="field" data-endf><label>Ends on (optional – leave empty if it keeps going)</label><input type="date" name="endDate" value="${esc(st.endDate || "")}"></div></div>
    <div class="section"><h3>Paid?</h3><div data-paid></div></div>
    <div class="row"><div class="field"><label>Paid by</label><select name="paidBy">${opt("", "Company account", st.paidBy)}${S.members.map((p) => opt(p.id, p.name, st.paidBy)).join("")}</select></div>
      <div class="field"><label>Payment method</label><input name="method" value="${esc(st.method || "")}" placeholder="card, bank transfer, cash…"></div></div>
    <div class="field"><label>Notes</label><textarea name="notes" placeholder="Account/login hint, invoice number, what it's for…">${esc(st.notes || "")}</textarea></div>
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><button class="btn" data-hist>History</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`);
  const el = m.el;
  const read = () => { ["title", "category", "freq", "date", "endDate", "paidBy", "method", "notes", "artistId", "eventId"].forEach((k) => (st[k] = val(el, k))); st.amount = Number(val(el, "amount")) || 0; };
  function drawKind() {
    $$("[data-k]", el).forEach((b) => b.classList.toggle("on", b.dataset.k === st.kind));
    $("[data-artf]", el).style.display = st.kind === "artist" ? "" : "none";
    $("[data-evf]", el).style.display = st.kind === "booking" ? "" : "none";
  }
  function drawPaid() {
    const once = !st.freq || st.freq === "once";
    $("[data-endf]", el).style.display = once ? "none" : "";
    $("[data-datelabel]", el).textContent = once ? "Date (when it's due / was paid)" : "First payment date";
    const box = $("[data-paid]", el);
    if (once) {
      box.innerHTML = `<label style="display:flex;gap:8px;align-items:center;font-size:.95rem;color:var(--tx)"><input type="checkbox" data-once ${st.paid ? "checked" : ""}> Paid${st.paidOn ? ` <span class="dim">(${esc(fmtDay(st.paidOn))})</span>` : ""}</label>`;
      $("[data-once]", box).onchange = (e) => { st.paid = e.target.checked; st.paidOn = st.paid ? todayISO() : ""; };
    } else {
      const t = todayISO(), past = occurrences(st, st.date || t, t), next = occurrences(st, iso(new Date(Date.now() + 864e5)), "9999-12-31").slice(0, 2);
      const list = [...past.slice(-6), ...next];
      box.innerHTML = list.length ? `<p class="muted" style="font-size:.85rem;margin-top:0">Tick each payment once it's paid.</p><div class="chips">${list.map((d) => `<span class="chip ${st.paidDates.includes(d) ? "on" : d < t ? "busy" : ""}" data-pd="${d}">${st.paidDates.includes(d) ? "✓ " : ""}${esc(fmtDay(d))}${!st.paidDates.includes(d) && d < t ? " <small>overdue</small>" : ""}</span>`).join("")}</div>` : '<span class="dim">Set the first payment date.</span>';
      $$("[data-pd]", box).forEach((c) => c.onclick = () => { const d = c.dataset.pd; st.paidDates = st.paidDates.includes(d) ? st.paidDates.filter((z) => z !== d) : [...st.paidDates, d]; drawPaid(); });
    }
  }
  $$("[data-k]", el).forEach((b) => b.onclick = () => { st.kind = b.dataset.k; drawKind(); });
  ["freq", "date", "endDate"].forEach((n) => $(`[name=${n}]`, el).addEventListener("change", () => { read(); drawPaid(); }));
  $("[name=eventId]", el).onchange = () => { const e = byId("events", val(el, "eventId")); if (e && e.artistId) st.artistId = e.artistId; };
  drawKind(); drawPaid();
  $("[data-save]", el).onclick = async () => {
    read();
    if (!st.title) return toast("Give the expense a name", true);
    if (!st.date) return toast("Pick a date", true);
    if (st.kind === "artist" && !st.artistId) return toast("Choose the artist", true);
    if (st.kind === "booking" && !st.eventId) return toast("Choose the shoot / session", true);
    const once = st.freq === "once";
    const d = { title: st.title, amount: st.amount, kind: st.kind, category: st.category, freq: st.freq, date: st.date, endDate: once ? "" : st.endDate || "",
      artistId: st.kind === "artist" || st.kind === "booking" ? st.artistId || "" : "", eventId: st.kind === "booking" ? st.eventId : "",
      paid: once ? !!st.paid : false, paidOn: once ? st.paidOn || "" : "", paidDates: once ? [] : st.paidDates.sort(), paidBy: st.paidBy, method: st.method, notes: st.notes };
    await save("expenses", id, d, d.title); toast("Saved"); m.close();
  };
  if (id) {
    $("[data-del]", el).onclick = async () => { if (await confirmBox(`Delete expense “${x0.title}”?`, "Delete")) { await remove("expenses", id, x0.title); m.close(); } };
    $("[data-hist]", el).onclick = () => historyModal(id, x0.title);
  }
}
