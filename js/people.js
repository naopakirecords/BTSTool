import { S, byId, events, save, remove, live, artistName, memberName, setRaw, callScript, scriptReady } from "./store.js?v=9";
import { createLogin, auth, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from "./firebase.js?v=9";
import { eventRow, bindEventRows, openEventEditor, owedOf, paidOf, historyModal, activityHTML } from "./events.js?v=9";
import { openDocUpload, docRow, bindDocRows } from "./misc.js?v=9";
import { showWelcome } from "./onboard.js?v=9";
import { expenseRow, bindExpenseRows, openExpenseEditor, occurrences } from "./expenses.js?v=9";
import { esc, $, $$, modal, toast, confirmBox, opt, val, fmtDate, fmtDay, money, todayISO, daysUntil, TYPES, CONTRACT_TYPES, linkify, hoursOf } from "./util.js?v=9";

// ─────────── Artists ───────────
export function artistStats(a) {
  const evs = events().filter((e) => e.artistId === a.id && e.status !== "cancelled");
  const projects = evs.filter((e) => e.type === "shoot" || e.type === "recording");
  const past = projects.filter((e) => e.end < Date.now());
  const first = projects.length ? Math.min(...projects.map((e) => e.start)) : null;
  const billed = evs.reduce((s, e) => s + (Number(e.price) || 0), 0);
  const paid = evs.reduce((s, e) => s + paidOf(e), 0);
  const owed = evs.reduce((s, e) => s + owedOf(e), 0);
  return { evs, projects, past, first, billed, paid, owed, shoots: projects.filter((e) => e.type === "shoot").length, recs: projects.filter((e) => e.type === "recording").length,
    hours: projects.reduce((s, e) => s + (e.allDay ? 0 : hoursOf(e)), 0), everManaged: !!a.managed || (a.managedHistory || []).length > 0 };
}
let artistFilter = "all", artistQ = "";
export function renderArtists(root) {
  let list = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
  if (artistFilter === "managed") list = list.filter((a) => a.managed);
  if (artistFilter === "worked") list = list.filter((a) => !a.managed);
  if (artistQ) list = list.filter((a) => (a.name + " " + (a.realName || "") + " " + (a.genre || "")).toLowerCase().includes(artistQ.toLowerCase()));
  root.innerHTML = `<div class="topbar"><h1>Artists</h1><button class="btn primary" data-new>+ New artist</button></div>
    <div class="row" style="margin-bottom:12px;align-items:center"><div class="tabs" style="margin:0;flex:0 0 auto">${[["all", "All"], ["managed", "Managed ★"], ["worked", "Worked with"]].map(([k, l]) => `<button data-f="${k}" class="${artistFilter === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <input data-q placeholder="Search artists…" value="${esc(artistQ)}"></div>
    <div class="grid">${list.map((a) => { const s = artistStats(a); return `<div class="card" data-a="${esc(a.id)}" style="cursor:pointer;margin:0">
      <h2>${esc(a.name)} ${a.managed ? '<span class="badge acc">★ Managed</span>' : ""}</h2>
      <div class="muted" style="font-size:.88rem">${esc(a.genre || "—")}</div>
      <div class="meta muted" style="font-size:.85rem;margin-top:8px">${s.projects.length} projects${s.first ? " · since " + esc(fmtDate(s.first)) : ""}${s.owed ? ` · <span class="money-pos">${esc(money(s.owed))} owed</span>` : ""}</div></div>`; }).join("") || '<div class="empty">No artists yet.</div>'}</div>`;
  $("[data-new]", root).onclick = () => openArtistEditor();
  $$("[data-f]", root).forEach((b) => b.onclick = () => { artistFilter = b.dataset.f; renderArtists(root); });
  const q = $("[data-q]", root); q.oninput = () => { artistQ = q.value; const p = q.selectionStart; renderArtists(root); const n = $("[data-q]", root); n.focus(); n.setSelectionRange(p, p); };
  $$("[data-a]", root).forEach((c) => c.onclick = () => (location.hash = "#/artist/" + c.dataset.a));
}

export function renderArtist(root, id) {
  const a = byId("artists", id);
  if (!a) { root.innerHTML = `<div class="empty">Artist not found. <a href="#/artists">Back to artists</a></div>`; return; }
  const s = artistStats(a);
  const now = Date.now();
  const upcoming = s.evs.filter((e) => e.end >= now).sort((x, y) => x.start - y.start);
  const past = s.evs.filter((e) => e.end < now).sort((x, y) => y.start - x.start);
  const contracts = S.contracts.filter((c) => c.artistId === id).sort((x, y) => (y.endDate || "").localeCompare(x.endDate || ""));
  const docs = S.docs.filter((d) => d.artistId === id);
  const exps = S.expenses.filter((x) => x.artistId === id);
  const spent = exps.reduce((s, x) => s + occurrences(x, x.date || "0000-01-01", todayISO()).length * (Number(x.amount) || 0), 0);
  const hist = S.activity.filter((x) => x.docId === id).slice(0, 15);
  const links = [["Instagram", a.instagram], ["TikTok", a.tiktok], ["YouTube", a.youtube], ["Spotify", a.spotify], ["Other", a.links]].filter((x) => x[1]);
  root.innerHTML = `<div class="topbar"><a href="#/artists" class="btn ghost">‹ Artists</a><h1>${esc(a.name)} ${a.managed ? '<span class="badge acc">★ Managed</span>' : '<span class="badge">Worked with</span>'}</h1>
      <div class="btns"><button class="btn" data-hist>History</button><button class="btn primary" data-edit>Edit</button></div></div>
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><div class="v">${s.first ? esc(fmtDate(s.first)) : "—"}</div><div class="k">Working together since</div></div>
      <div class="stat"><div class="v">${s.projects.length}</div><div class="k">Projects (${s.shoots} shoots · ${s.recs} sessions)</div></div>
      <div class="stat"><div class="v">${s.hours}</div><div class="k">Hours worked / booked</div></div>
      <div class="stat"><div class="v">${s.everManaged ? (a.managed ? "Yes – now" : "Yes – before") : "No"}</div><div class="k">Managed by us</div></div>
      <div class="stat"><div class="v">${esc(money(s.billed))}</div><div class="k">Total billed</div></div>
      <div class="stat"><div class="v ${s.owed ? "money-pos" : "money-ok"}">${esc(money(s.owed))}</div><div class="k">Owes us</div></div>
      <div class="stat"><div class="v">${esc(money(spent))}</div><div class="k">Our expenses for them</div></div></div>
    <div class="grid2">
      <div>
        <div class="card"><h2>Profile</h2><div class="kv">
          ${a.realName ? `<div>Real name</div><div>${esc(a.realName)}</div>` : ""}
          <div>Style of music</div><div>${esc(a.genre || "—")}</div>
          ${a.phone ? `<div>Phone</div><div><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></div>` : ""}
          ${a.email ? `<div>Email</div><div><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>` : ""}
          ${links.map(([k, v]) => `<div>${k}</div><div>${linkify(v)}</div>`).join("")}
          ${a.managed && a.managedSince ? `<div>Managed since</div><div>${esc(fmtDay(a.managedSince))}</div>` : ""}
          ${(a.managedHistory || []).length ? `<div>Managed periods</div><div>${a.managedHistory.map((p) => `${esc(fmtDay(p.from))} → ${p.to ? esc(fmtDay(p.to)) : "now"}`).join("<br>")}</div>` : ""}
        </div></div>
        <div class="card"><h2>Image & style</h2><div class="pre">${linkify(a.image || "—")}</div></div>
        <div class="card"><h2>What they want to do</h2><div class="pre">${linkify(a.goals || "—")}</div></div>
        <div class="card"><h2>Notes</h2><div class="pre">${linkify(a.notes || "—")}</div></div>
      </div>
      <div>
        <div class="card flat"><div style="padding:12px 14px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1">Upcoming</h2>
          <button class="btn sm" data-add="shoot">+ Shoot</button><button class="btn sm" data-add="recording">+ Rec</button><button class="btn sm" data-add="management">+ Drop/gig</button></div>
          <div class="list">${upcoming.map((e) => eventRow(e)).join("") || '<div class="empty">Nothing planned.</div>'}</div></div>
        <div class="card flat"><div style="padding:12px 14px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1">Contracts</h2><button class="btn sm" data-newc>+ Contract</button></div>
          <div class="list">${contracts.map(contractRow).join("") || '<div class="empty">No contracts.</div>'}</div></div>
        <div class="card flat"><div style="padding:12px 14px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1">Documents</h2><button class="btn sm" data-up>+ Upload</button></div>
          <div class="list">${docs.map(docRow).join("") || '<div class="empty">No documents.</div>'}</div></div>
        <div class="card flat"><div style="padding:12px 14px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1">💶 Expenses</h2><button class="btn sm" data-newx>+ Expense</button></div>
          <div class="list">${exps.map((x) => expenseRow({ x, d: x.freq === "once" ? x.date : null })).join("") || '<div class="empty">No expenses.</div>'}</div></div>
        <div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">Past work (${past.length})</h2></div>
          <div class="list">${past.map((e) => eventRow(e)).join("") || '<div class="empty">No past projects yet.</div>'}</div></div>
        <div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">Profile changes</h2></div>
          <div class="list">${hist.map(activityHTML).join("") || '<div class="empty">No changes yet.</div>'}</div></div>
      </div></div>`;
  $("[data-edit]", root).onclick = () => openArtistEditor(id);
  $("[data-hist]", root).onclick = () => historyModal(id, a.name);
  $$("[data-add]", root).forEach((b) => b.onclick = () => openEventEditor(null, { type: b.dataset.add, artistId: id }));
  $("[data-newc]", root).onclick = () => openContractEditor(null, { artistId: id });
  $("[data-up]", root).onclick = () => openDocUpload({ artistId: id });
  bindEventRows(root); bindContractRows(root); bindDocRows(root); bindExpenseRows(root);
  $("[data-newx]", root).onclick = () => openExpenseEditor(null, { kind: "artist", artistId: id });
}

export function openArtistEditor(id) {
  const a = id ? byId("artists", id) : { managed: false };
  const m = modal(`<div class="mh"><h2>${id ? "Edit artist" : "New artist"}</h2><button class="x" data-close>×</button></div>
    <div class="row"><div class="field"><label>Artist / stage name</label><input name="name" value="${esc(a.name || "")}"></div>
      <div class="field"><label>Real name</label><input name="realName" value="${esc(a.realName || "")}"></div></div>
    <div class="row"><div class="field" style="flex:0 0 auto"><label style="display:flex;gap:8px;align-items:center;min-height:42px"><input type="checkbox" name="managed" ${a.managed ? "checked" : ""}> We manage this artist ★</label></div>
      <div class="field" data-since style="${a.managed ? "" : "display:none"}"><label>Managed since</label><input type="date" name="managedSince" value="${esc(a.managedSince || todayISO())}"></div></div>
    <div class="row"><div class="field"><label>Phone</label><input name="phone" value="${esc(a.phone || "")}"></div><div class="field"><label>Email</label><input name="email" value="${esc(a.email || "")}"></div></div>
    <div class="row"><div class="field"><label>Instagram</label><input name="instagram" value="${esc(a.instagram || "")}"></div><div class="field"><label>TikTok</label><input name="tiktok" value="${esc(a.tiktok || "")}"></div></div>
    <div class="row"><div class="field"><label>YouTube</label><input name="youtube" value="${esc(a.youtube || "")}"></div><div class="field"><label>Spotify</label><input name="spotify" value="${esc(a.spotify || "")}"></div></div>
    <div class="field"><label>Other links</label><input name="links" value="${esc(a.links || "")}"></div>
    <div class="field"><label>Style of music</label><input name="genre" value="${esc(a.genre || "")}" placeholder="e.g. R&B, pop, trap…"></div>
    <div class="field"><label>Image & style (look, colours, references, moodboards)</label><textarea name="image">${esc(a.image || "")}</textarea></div>
    <div class="field"><label>What they want to do (goals, plans)</label><textarea name="goals">${esc(a.goals || "")}</textarea></div>
    <div class="field"><label>Other important notes</label><textarea name="notes">${esc(a.notes || "")}</textarea></div>
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`);
  const el = m.el;
  $("[name=managed]", el).onchange = (e) => ($("[data-since]", el).style.display = e.target.checked ? "" : "none");
  $("[data-save]", el).onclick = async () => {
    const d = {}; ["name", "realName", "phone", "email", "instagram", "tiktok", "youtube", "spotify", "links", "genre", "image", "goals", "notes", "managedSince"].forEach((k) => (d[k] = val(el, k)));
    d.managed = val(el, "managed");
    if (!d.name) return toast("Name is required", true);
    const hist = [...(a.managedHistory || [])];
    if (d.managed && !a.managed) hist.push({ from: d.managedSince || todayISO(), to: "" });
    if (!d.managed && a.managed) { const last = hist[hist.length - 1]; if (last && !last.to) last.to = todayISO(); else hist.push({ from: a.managedSince || "", to: todayISO() }); }
    if (d.managed && a.managed && hist.length && !hist[hist.length - 1].to) hist[hist.length - 1].from = d.managedSince;
    d.managedHistory = hist;
    if (!d.managed) d.managedSince = "";
    const nid = await save("artists", id, d, d.name);
    toast("Saved"); m.close();
    if (!id) location.hash = "#/artist/" + nid;
  };
  id && ($("[data-del]", el).onclick = async () => {
    const n = events().filter((e) => e.artistId === id).length;
    if (!(await confirmBox(`Delete ${a.name}?${n ? ` ${n} bookings stay but will lose the artist link.` : ""}`, "Delete"))) return;
    await remove("artists", id, a.name); m.close(); location.hash = "#/artists";
  });
}

// ─────────── Contracts ───────────
export function contractStatus(c) {
  const d = daysUntil(c.endDate);
  if (d === null) return '<span class="badge">No end date</span>';
  if (d < 0) return `<span class="badge bad">Expired ${esc(fmtDay(c.endDate))}</span>`;
  if (d <= 60) return `<span class="badge warn">Expires in ${d} d</span>`;
  return `<span class="badge ok">Until ${esc(fmtDay(c.endDate))}</span>`;
}
const renewBadge = (r) => r === "yes" ? '<span class="badge ok">Renew: yes</span>' : r === "no" ? '<span class="badge bad">Renew: no</span>' : '<span class="badge">Renew: undecided</span>';
export function contractRow(c) {
  return `<div class="item" data-c="${esc(c.id)}"><div class="body"><div class="t">${esc(c.title || c.type || "Contract")}</div>
    <div class="meta"><span>🎤 ${esc(artistName(c.artistId) || "—")}</span><span>${esc(c.type || "")}</span>${c.startDate ? `<span>${esc(fmtDay(c.startDate))} → ${esc(fmtDay(c.endDate) || "open")}</span>` : ""}</div></div>
    <div class="right">${contractStatus(c)}<div style="margin-top:4px">${renewBadge(c.renew)}</div></div></div>`;
}
export function bindContractRows(root) { $$("[data-c]", root).forEach((r) => r.onclick = () => openContractEditor(r.dataset.c)); }

export function openContractEditor(id, preset = {}) {
  const c = id ? byId("contracts", id) : { renew: "undecided", ...preset };
  const arts = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
  const docs = S.docs.filter((d) => !c.artistId || d.artistId === c.artistId || (c.docIds || []).includes(d.id));
  const m = modal(`<div class="mh"><h2>${id ? "Edit contract" : "New contract"}</h2><button class="x" data-close>×</button></div>
    <div class="row"><div class="field"><label>Artist</label><select name="artistId">${opt("", "— choose —", c.artistId)}${arts.map((a) => opt(a.id, a.name, c.artistId)).join("")}</select></div>
      <div class="field"><label>Type</label><select name="type">${CONTRACT_TYPES.map((t) => opt(t, t, c.type)).join("")}</select></div></div>
    <div class="field"><label>Title</label><input name="title" value="${esc(c.title || "")}" placeholder="e.g. Management agreement 2026"></div>
    <div class="row"><div class="field"><label>Start date</label><input type="date" name="startDate" value="${esc(c.startDate || "")}"></div>
      <div class="field"><label>End / expiry date</label><input type="date" name="endDate" value="${esc(c.endDate || "")}"></div>
      <div class="field"><label>Do we want to renew?</label><select name="renew">${opt("undecided", "Undecided", c.renew)}${opt("yes", "Yes", c.renew)}${opt("no", "No", c.renew)}</select></div></div>
    <div class="row"><div class="field"><label>Value / our percentage</label><input name="value" value="${esc(c.value || "")}" placeholder="e.g. 20% of live income"></div>
      <div class="field"><label>Notice period</label><input name="notice" value="${esc(c.notice || "")}" placeholder="e.g. 30 days before expiry"></div></div>
    <div class="field"><label>Key terms & notes</label><textarea name="terms">${esc(c.terms || "")}</textarea></div>
    <div class="field"><label>Linked documents</label><div class="chips" data-docs>${docs.map((d) => `<span class="chip ${(c.docIds || []).includes(d.id) ? "on" : ""}" data-d="${esc(d.id)}">📄 ${esc(d.name)}</span>`).join("") || '<span class="dim">Upload the signed contract in Documents, then link it here.</span>'}</div></div>
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><button class="btn" data-hist>History</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`);
  const el = m.el;
  let docIds = [...(c.docIds || [])];
  $$("[data-d]", el).forEach((ch) => ch.onclick = () => { const d = ch.dataset.d; docIds = docIds.includes(d) ? docIds.filter((x) => x !== d) : [...docIds, d]; ch.classList.toggle("on"); });
  $("[data-save]", el).onclick = async () => {
    const d = {}; ["artistId", "type", "title", "startDate", "endDate", "renew", "value", "notice", "terms"].forEach((k) => (d[k] = val(el, k)));
    if (!d.artistId) return toast("Choose the artist", true);
    d.docIds = docIds;
    if (!d.title) d.title = `${d.type} – ${artistName(d.artistId)}`;
    await save("contracts", id, d, d.title); toast("Saved"); m.close();
  };
  if (id) {
    $("[data-del]", el).onclick = async () => { if (await confirmBox(`Delete contract “${c.title}”?`, "Delete")) { await remove("contracts", id, c.title); m.close(); } };
    $("[data-hist]", el).onclick = () => historyModal(id, c.title);
  }
}

// ─────────── Management tab ───────────
export function renderManagement(root) {
  const managed = S.artists.filter((a) => a.managed).sort((a, b) => a.name.localeCompare(b.name));
  const now = Date.now();
  const mgmt = events().filter((e) => e.type === "management" && e.end >= now && e.status !== "cancelled").sort((a, b) => a.start - b.start);
  const contracts = [...S.contracts].sort((a, b) => (a.endDate || "9999").localeCompare(b.endDate || "9999"));
  root.innerHTML = `<div class="topbar"><h1>Management</h1><div class="btns"><button class="btn" data-newc>+ Contract</button><button class="btn primary" data-newe>+ Meeting / drop / gig</button></div></div>
    <h2>Managed artists</h2>
    <div class="grid" style="margin-bottom:18px">${managed.map((a) => {
      const next = events().filter((e) => e.artistId === a.id && e.end >= now && e.status !== "cancelled").sort((x, y) => x.start - y.start)[0];
      const ct = S.contracts.filter((c) => c.artistId === a.id).sort((x, y) => (y.endDate || "").localeCompare(x.endDate || ""))[0];
      return `<div class="card" data-a="${esc(a.id)}" style="cursor:pointer;margin:0"><h2>★ ${esc(a.name)}</h2><div class="muted" style="font-size:.88rem">${esc(a.genre || "")}</div>
        <div style="font-size:.86rem;margin-top:8px">${next ? `Next: <b>${esc(next.title)}</b> · ${esc(fmtDate(next.start))}` : '<span class="dim">Nothing planned</span>'}</div>
        <div style="margin-top:6px">${ct ? contractStatus(ct) + " " + renewBadge(ct.renew) : '<span class="badge warn">No contract logged</span>'}</div></div>`;
    }).join("") || '<div class="empty">No managed artists yet. Open an artist and tick “We manage this artist”.</div>'}</div>
    <div class="grid2">
      <div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">Drops, concerts & meetings</h2></div>
        <div class="list">${mgmt.map((e) => eventRow(e)).join("") || '<div class="empty">Nothing planned.</div>'}</div></div>
      <div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">All contracts</h2></div>
        <div class="list">${contracts.map(contractRow).join("") || '<div class="empty">No contracts yet.</div>'}</div></div>
    </div>`;
  $("[data-newc]", root).onclick = () => openContractEditor();
  $("[data-newe]", root).onclick = () => openEventEditor(null, { type: "management" });
  $$("[data-a]", root).forEach((c) => c.onclick = () => (location.hash = "#/artist/" + c.dataset.a));
  bindEventRows(root); bindContractRows(root);
}

// ─────────── Team (admin) ───────────
function calBadge(x) {
  if (x.role === "admin" && x.id === "naopakirecords@gmail.com") return '<span class="badge acc">📅 owns the BTS calendar</span>';
  if (x.calendarAccess === "shared") return '<span class="badge ok">📅 BTS calendar shared</span>';
  if (x.calendarAccess === "error") return `<span class="badge bad" title="${esc(x.calendarError || "")}">📅 calendar not shared – needs a Google account email</span>`;
  if (x.calendarAccess === "removed") return '<span class="badge">📅 calendar access removed</span>';
  return x.active === false ? "" : '<span class="badge warn">📅 sharing calendar…</span>';
}
const shareCal = () => scriptReady() && callScript("shareCalendar").catch((e) => console.warn(e));
export function renderTeam(root) {
  const isAdmin = S.me?.role === "admin";
  const list = [...S.members].sort((a, b) => (a.role === "admin" ? -1 : 1) - (b.role === "admin" ? -1 : 1) || a.name.localeCompare(b.name));
  root.innerHTML = `<div class="topbar"><h1>Team</h1>${isAdmin ? '<button class="btn primary" data-new>+ Add member</button>' : ""}</div>
    <div class="alert info">📅 <b>Shared calendar:</b> everyone on this list automatically gets edit access to the one shared <b>BTS</b> Google calendar (Google emails them an invite and it shows up in their own Google Calendar). Only that calendar is synced with the tool – nobody's personal calendar is ever read. For this, a member's email must be a Google account (Gmail or Google Workspace).</div>
    <p class="muted">Only people on this list can sign in. There is no public sign-up – an admin adds each person here and they get an email to set their own password.</p>
    <div class="card"><h2>What each access level can do</h2><div class="kv">
      <div><b>Member</b></div><div>Sees everything and can add, edit and delete shoots, sessions, meetings, artists, contracts, expenses, documents, equipment, locations and links. Can change their own name and password.</div>
      <div><b>Admin</b></div><div>Everything a member can do, plus: add and remove team accounts, give or take admin access, resend password emails, and use the Google sync tools (sync now, test the Sunday email).</div>
      <div><b>Nobody in the tool</b></div><div>How the tool itself works (its code, design, Firebase and Google settings) can't be changed from inside the tool at all – only through the company GitHub and Google accounts.</div></div></div>
    <div class="card flat"><div class="list">${list.map((x) => `<div class="item" style="cursor:default"><div class="body"><div class="t">${esc(x.name)} ${x.role === "admin" ? '<span class="badge acc">Admin</span>' : ""} ${x.active === false ? '<span class="badge bad">Deactivated</span>' : ""}</div>
      <div class="meta"><span>${esc(x.id)}</span>${x.title ? `<span>${esc(x.title)}</span>` : ""}${calBadge(x)}</div></div>
      ${isAdmin && x.id !== S.me.id ? `<div class="btns"><button class="btn sm" data-reset="${esc(x.id)}">Send password email</button><button class="btn sm" data-edit="${esc(x.id)}">Edit</button></div>` : ""}</div>`).join("")}</div></div>`;
  if (!isAdmin) return;
  $("[data-new]", root).onclick = () => memberEditor();
  $$("[data-edit]", root).forEach((b) => b.onclick = () => memberEditor(b.dataset.edit));
  $$("[data-reset]", root).forEach((b) => b.onclick = async () => { await sendPasswordResetEmail(auth, b.dataset.reset); toast("Email sent to " + b.dataset.reset); });
}
function memberEditor(id) {
  const x = id ? byId("members", id) : { role: "member", active: true };
  const m = modal(`<div class="mh"><h2>${id ? "Edit member" : "Add team member"}</h2><button class="x" data-close>×</button></div>
    <div class="field"><label>Name</label><input name="name" value="${esc(x.name || "")}"></div>
    <div class="field"><label>Email (their login)</label><input name="email" type="email" value="${esc(x.id || "")}" ${id ? "disabled" : ""}></div>
    <div class="field"><label>Role in the team</label><input name="title" value="${esc(x.title || "")}" placeholder="e.g. Manager, Musician / producer"></div>
    <div class="row"><div class="field"><label>Access</label><select name="role">${opt("member", "Member – can add and edit all data", x.role)}${opt("admin", "Admin – can also manage accounts", x.role)}</select></div>
    ${id ? `<div class="field"><label>Status</label><select name="active">${opt("true", "Active", String(x.active !== false))}${opt("false", "Deactivated – cannot sign in", String(x.active !== false))}</select></div>` : ""}</div>
    ${id ? "" : '<p class="muted">They will receive two emails: one from Firebase (“Reset your password…”) with a link to set their own password – check spam – and one from Google Calendar inviting them to the shared <b>BTS</b> calendar. Then they sign in at this site with that email and password.</p>'}
    <div class="mf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>${id ? "Save" : "Create account & send email"}</button></div>`);
  $("[data-save]", m.el).onclick = async (ev) => {
    const name = val(m.el, "name"), email = (id || val(m.el, "email")).toLowerCase();
    if (!name || !email.includes("@")) return toast("Name and a valid email are needed", true);
    ev.target.disabled = true;
    try {
      const d = { name, title: val(m.el, "title"), role: val(m.el, "role"), email };
      if (id) d.active = val(m.el, "active") === "true"; else d.active = true;
      await save("members", email, d, name);
      if (!id) { await createLogin(email); toast("Account created – password email sent to " + email); }
      else toast("Saved");
      shareCal();
      m.close();
    } catch (e) { console.error(e); toast(e.message, true); ev.target.disabled = false; }
  };
}

// ─────────── Account ───────────
export function renderAccount(root) {
  root.innerHTML = `<div class="topbar"><h1>My account</h1></div>
    <div class="card"><h2>Profile</h2><div class="field"><label>Name shown in the tool</label><input name="name" value="${esc(S.me.name)}"></div>
      <div class="field"><label>Email</label><input value="${esc(S.me.id)}" disabled></div><button class="btn primary" data-savename>Save name</button></div>
    <div class="card"><h2>Change password</h2>
      <div class="field"><label>Current password</label><input type="password" name="cur" autocomplete="current-password"></div>
      <div class="field"><label>New password (min 8 characters)</label><input type="password" name="np" autocomplete="new-password"></div>
      <div class="field"><label>Repeat new password</label><input type="password" name="np2" autocomplete="new-password"></div>
      <button class="btn primary" data-pw>Change password</button></div>
    ${S.me.role === "admin" ? `<div class="card"><h2>Google connection</h2><p class="muted">Calendar sync runs every minute and right after every change. The Sunday summary email goes out at 18:00.</p>
      <div class="btns"><button class="btn" data-sync>Sync now</button><button class="btn" data-sum>Send me the weekly summary now (test)</button></div></div>` : ""}
    <div class="card"><h2>Install on this device</h2><p class="muted">Add BTS to your home screen so it opens like an app.</p><button class="btn" data-tour>📲 Show install steps & tour</button></div>
    <button class="btn danger" data-out>Sign out</button>`;
  $("[data-savename]", root).onclick = async () => { const n = $("[name=name]", root).value.trim(); if (n) { await save("members", S.me.id, { name: n }, n); toast("Saved"); } };
  $("[data-pw]", root).onclick = async () => {
    const cur = $("[name=cur]", root).value, np = $("[name=np]", root).value, np2 = $("[name=np2]", root).value;
    if (np.length < 8) return toast("New password must be at least 8 characters", true);
    if (np !== np2) return toast("New passwords don't match", true);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, cur));
      await updatePassword(auth.currentUser, np);
      toast("Password changed"); $$("input[type=password]", root).forEach((i) => (i.value = ""));
    } catch (e) { toast(e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" ? "Current password is wrong" : e.message, true); }
  };
  $("[data-out]", root).onclick = () => signOut(auth);
  $("[data-tour]", root).onclick = () => showWelcome();
  const sy = $("[data-sync]", root); sy && (sy.onclick = async () => { try { sy.disabled = true; const r = await callScript("sync"); toast(r.message || "Synced"); } catch (e) { toast(e.message, true); } sy.disabled = false; });
  const su = $("[data-sum]", root); su && (su.onclick = async () => { try { su.disabled = true; await callScript("summaryTest"); toast("Summary sent to " + S.me.id); } catch (e) { toast(e.message, true); } su.disabled = false; });
}
