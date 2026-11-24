import { S, byId, events, save, remove, artistName, memberName, equipLabel, callScript, scriptReady } from "./store.js?v=8";
import { eventRow, bindEventRows, openEventEditor, historyModal, activityHTML, owedOf } from "./events.js?v=8";
import { allConflicts, equipmentBusy } from "./conflicts.js?v=8";
import { contractRow, bindContractRows } from "./people.js?v=8";
import {
  esc, $, $$, modal, toast, confirmBox, opt, val, fmtDate, fmtDT, fmtTime, fmtDateShort, money, daysUntil, startOfDay, addDays, todayISO, hoursOf,
  TYPES, EQUIP_CATS, EQUIP_PREFIX, CONDITIONS, EQUIP_STATUS, DOC_CATS, fromInputs, toDateInput,
} from "./util.js?v=8";

// ─────────── Weekly summary ───────────
export function weekRange(ref = Date.now()) {
  const d = new Date(startOfDay(ref));
  const dow = (d.getDay() + 6) % 7; // Mon=0
  // On Sunday show the coming week; otherwise the current week (Mon–Sun)
  const mon = d.getDay() === 0 ? addDays(d.getTime(), 1) : addDays(d.getTime(), -dow);
  return [mon, addDays(mon, 7)];
}
export function summaryHTML([from, to]) {
  const evs = events().filter((e) => e.start < to && e.end > from && e.status !== "cancelled").sort((a, b) => a.start - b.start);
  const by = (t) => evs.filter((e) => e.type === t);
  const hrs = (l) => l.reduce((s, e) => s + (e.allDay ? 0 : hoursOf(e)), 0);
  let days = "";
  for (let d = from; d < to; d = addDays(d, 1)) {
    const de = evs.filter((e) => e.start < addDays(d, 1) && e.end > d);
    days += `<div style="margin-bottom:10px"><div class="group-label">${esc(fmtDateShort(d))}</div>${de.length ? `<div class="card flat" style="margin:0"><div class="list">${de.map((e) => eventRow(e, { showDate: false })).join("")}</div></div>` : '<div class="dim" style="font-size:.85rem">Free</div>'}</div>`;
  }
  const expiring = S.contracts.filter((c) => { const n = daysUntil(c.endDate); return n !== null && n >= 0 && n <= 60; });
  return `<div class="stats" style="margin-bottom:12px">
      <div class="stat"><div class="v">${by("shoot").length}</div><div class="k">Shoots · ${hrs(by("shoot"))} h</div></div>
      <div class="stat"><div class="v">${by("recording").length}</div><div class="k">Sessions · ${hrs(by("recording"))} h</div></div>
      <div class="stat"><div class="v">${by("management").length}</div><div class="k">Management</div></div>
      <div class="stat"><div class="v">${by("meeting").length}</div><div class="k">Team meetings</div></div>
      <div class="stat"><div class="v">${allConflicts().filter((c) => c.event.start < to).length}</div><div class="k">Clashes</div></div></div>
    ${expiring.length ? `<div class="alert warn">Contracts expiring within 60 days: ${expiring.map((c) => `<b>${esc(artistName(c.artistId))}</b> (${esc(c.endDate)})`).join(", ")}</div>` : ""}
    ${days}`;
}
export function maybeSundayPopup() {
  const d = new Date();
  if (d.getDay() !== 0) return;
  const key = "bts-summary-" + todayISO();
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (_) {}
  const r = weekRange();
  const m = modal(`<div class="mh"><h2>Next week · ${esc(fmtDateShort(r[0]))} – ${esc(fmtDateShort(addDays(r[1], -1)))}</h2><button class="x" data-close>×</button></div>${summaryHTML(r)}
    <div class="mf"><button class="btn primary" data-close>Got it</button></div>`, { wide: true });
  bindEventRows(m.el);
}

// ─────────── Home ───────────
export function renderHome(root) {
  const now = Date.now();
  const upcoming = events().filter((e) => e.end >= now && e.status !== "cancelled" && e.type !== "unsorted").sort((a, b) => a.start - b.start).slice(0, 8);
  const conflicts = allConflicts();
  const unsorted = events().filter((e) => e.type === "unsorted" && e.end >= addDays(now, -30));
  const expiring = S.contracts.filter((c) => { const n = daysUntil(c.endDate); return n !== null && n <= 60 && n >= -14; }).sort((a, b) => a.endDate.localeCompare(b.endDate));
  const owed = events().filter((e) => owedOf(e) > 0 && e.end < now);
  const r = weekRange();
  const h = new Date().getHours();
  root.innerHTML = `<div class="topbar"><h1>Good ${h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}, ${esc(S.me.name.split(" ")[0])}</h1>
      <div class="btns"><button class="btn" data-q="shoot">🎬 + Shoot</button><button class="btn" data-q="recording">🎙️ + Recording</button><button class="btn" data-q="management">📋 + Mgmt</button><button class="btn" data-q="meeting">🤝 + Meeting</button></div></div>
    ${!scriptReady() ? `<div class="alert warn">Google Calendar sync is not connected yet (admin: see README).</div>` : ""}
    ${conflicts.length ? `<div class="card"><h2>⚠️ Double bookings (${conflicts.length})</h2>${conflicts.map((c) => `<div class="alert bad">${esc(c.event.title)} · ${esc(fmtDT(c.event.start))}: ${esc(c.msg)}<div class="btns"><button class="btn sm" data-open="${esc(c.event.id)}">Resolve</button></div></div>`).join("")}</div>` : ""}
    ${unsorted.length ? `<div class="card"><h2>❔ From Google Calendar – sort these (${unsorted.length})</h2><p class="muted" style="font-size:.88rem">These were added in Google without a tag. Pick where they belong (or add “Shoot:”, “Rec:”, “Mgmt:” or “Meet:” to the title in Google).</p>
      ${unsorted.map((e) => `<div class="alert info"><b>${esc(e.title)}</b> · ${esc(fmtDT(e.start))}<div class="btns">${["shoot", "recording", "management", "meeting"].map((t) => `<button class="btn sm" data-sort="${esc(e.id)}" data-t="${t}">${TYPES[t].icon} ${TYPES[t].label}</button>`).join("")}<button class="btn sm" data-open="${esc(e.id)}">Open</button></div></div>`).join("")}</div>` : ""}
    ${expiring.length ? `<div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">📄 Contracts expiring soon</h2></div><div class="list">${expiring.map(contractRow).join("")}</div></div>` : ""}
    <div class="grid2">
      <div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">Coming up</h2></div><div class="list">${upcoming.map((e) => eventRow(e)).join("") || '<div class="empty">Nothing planned yet.</div>'}</div></div>
      <div class="card"><h2>${new Date().getDay() === 0 ? "Next week" : "This week"} · ${esc(fmtDateShort(r[0]))} – ${esc(fmtDateShort(addDays(r[1], -1)))}</h2>${summaryHTML(r)}</div>
    </div>
    ${owed.length ? `<div class="card flat"><div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">💶 Unpaid (finished work)</h2></div><div class="list">${owed.map((e) => eventRow(e)).join("")}</div></div>` : ""}`;
  $$("[data-q]", root).forEach((b) => b.onclick = () => openEventEditor(null, { type: b.dataset.q }));
  $$("[data-open]", root).forEach((b) => b.onclick = () => openEventEditor(b.dataset.open));
  $$("[data-sort]", root).forEach((b) => b.onclick = async () => { const e = byId("events", b.dataset.sort); await save("events", e.id, { type: b.dataset.t, subtype: "" }, e.title); toast("Moved to " + TYPES[b.dataset.t].label); });
  bindEventRows(root); bindContractRows(root);
}

// ─────────── Documents ───────────
let docFilter = { cat: "", artist: "", q: "" };
const fileIcon = (mime = "") => mime.includes("pdf") ? "📕" : mime.startsWith("image") ? "🖼️" : mime.includes("sheet") || mime.includes("excel") ? "📊" : mime.startsWith("audio") ? "🎵" : mime.startsWith("video") ? "🎞️" : "📄";
export function docRow(d) {
  return `<div class="item" data-doc="${esc(d.id)}"><div style="font-size:1.4rem">${fileIcon(d.mime)}</div><div class="body"><div class="t">${esc(d.name)}</div>
    <div class="meta"><span>${esc(d.category || "")}</span>${d.artistId ? `<span>🎤 ${esc(artistName(d.artistId))}</span>` : ""}${d.size ? `<span>${(d.size / 1048576).toFixed(2)} MB</span>` : ""}<span>by ${esc(d.uploadedByName || memberName(d.createdBy))}, ${esc(fmtDate(d.createdAt))}</span></div></div></div>`;
}
export function bindDocRows(root) { $$("[data-doc]", root).forEach((r) => r.onclick = () => openDoc(r.dataset.doc)); }
export function renderDocs(root) {
  let list = [...S.docs].sort((a, b) => b.createdAt - a.createdAt);
  if (docFilter.cat) list = list.filter((d) => d.category === docFilter.cat);
  if (docFilter.artist) list = list.filter((d) => d.artistId === docFilter.artist);
  if (docFilter.q) list = list.filter((d) => (d.name + " " + (d.notes || "")).toLowerCase().includes(docFilter.q.toLowerCase()));
  root.innerHTML = `<div class="topbar"><h1>Documents</h1><button class="btn primary" data-up>+ Upload</button></div>
    <div class="row" style="margin-bottom:12px"><select data-cat>${opt("", "All categories", docFilter.cat)}${DOC_CATS.map((c) => opt(c, c, docFilter.cat)).join("")}</select>
      <select data-art>${opt("", "All artists", docFilter.artist)}${[...S.artists].sort((a, b) => a.name.localeCompare(b.name)).map((a) => opt(a.id, a.name, docFilter.artist)).join("")}</select>
      <input data-qq placeholder="Search…" value="${esc(docFilter.q)}"></div>
    <div class="card flat"><div class="list">${list.map(docRow).join("") || '<div class="empty">No documents yet.</div>'}</div></div>
    <p class="dim" style="font-size:.85rem">Files are stored in the “BTS Documents” folder on the team's Google Drive.</p>`;
  $("[data-up]", root).onclick = () => openDocUpload();
  $("[data-cat]", root).onchange = (e) => { docFilter.cat = e.target.value; renderDocs(root); };
  $("[data-art]", root).onchange = (e) => { docFilter.artist = e.target.value; renderDocs(root); };
  $("[data-qq]", root).onchange = (e) => { docFilter.q = e.target.value; renderDocs(root); };
  bindDocRows(root);
}
export function openDocUpload(preset = {}) {
  const onDone = preset.onDone;
  const arts = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
  const evs = events().sort((a, b) => b.start - a.start).slice(0, 80);
  const m = modal(`<div class="mh"><h2>Upload document</h2><button class="x" data-close>×</button></div>
    <div class="field"><label>File (max 25 MB)</label><input type="file" name="file"></div>
    <div class="field"><label>Name</label><input name="name" placeholder="Defaults to the file name"></div>
    <div class="row"><div class="field"><label>Category</label><select name="category">${DOC_CATS.map((c) => opt(c, c, preset.category || "Contract")).join("")}</select></div>
      <div class="field"><label>Artist</label><select name="artistId">${opt("", "— none —", preset.artistId)}${arts.map((a) => opt(a.id, a.name, preset.artistId)).join("")}</select></div></div>
    <div class="field"><label>Related shoot / session</label><select name="eventId">${opt("", "— none —", preset.eventId)}${evs.map((e) => opt(e.id, `${fmtDateShort(e.start)} · ${e.title}`, preset.eventId)).join("")}</select></div>
    <div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
    <div class="mf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go>Upload</button></div>`);
  $("[data-go]", m.el).onclick = async (ev) => {
    const f = $("[name=file]", m.el).files[0];
    if (!f) return toast("Choose a file", true);
    if (f.size > 25 * 1048576) return toast("File is larger than 25 MB", true);
    ev.target.disabled = true; ev.target.textContent = "Uploading…";
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      const name = val(m.el, "name") || f.name;
      const up = await callScript("upload", { name: f.name, mime: f.type || "application/octet-stream", data: b64 });
      const newDocId = await save("docs", null, { name, fileName: f.name, mime: f.type, size: f.size, driveId: up.id, category: val(m.el, "category"), artistId: val(m.el, "artistId"), eventId: val(m.el, "eventId"), notes: val(m.el, "notes"), uploadedByName: S.me.name }, name);
      toast("Uploaded"); m.close(); onDone && onDone(newDocId);
    } catch (e) { toast("Upload failed: " + e.message, true); ev.target.disabled = false; ev.target.textContent = "Upload"; }
  };
}
export function openDoc(id) {
  const d = byId("docs", id);
  const ev = d.eventId ? byId("events", d.eventId) : null;
  const m = modal(`<div class="mh"><h2>${fileIcon(d.mime)} ${esc(d.name)}</h2><button class="x" data-close>×</button></div>
    <div class="kv"><div>Category</div><div>${esc(d.category || "")}</div><div>Artist</div><div>${esc(artistName(d.artistId) || "—")}</div>
      <div>Shoot / session</div><div>${ev ? esc(ev.title + " · " + fmtDate(ev.start)) : "—"}</div><div>File</div><div>${esc(d.fileName || "")} ${d.size ? "· " + (d.size / 1048576).toFixed(2) + " MB" : ""}</div>
      <div>Uploaded</div><div>${esc(d.uploadedByName || "")}, ${esc(fmtDT(d.createdAt))}</div>${d.notes ? `<div>Notes</div><div class="pre">${esc(d.notes)}</div>` : ""}</div>
    <div class="mf"><button class="btn danger" data-del>Delete</button><span class="spacer"></span><button class="btn" data-dl>Download</button><button class="btn primary" data-open>Open</button></div>`);
  const fetchBlob = async () => { const r = await callScript("download", { id: d.driveId }); const bin = atob(r.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: r.mime || d.mime }); };
  $("[data-open]", m.el).onclick = async (e) => {
    const w = window.open("", "_blank"); e.target.textContent = "Loading…";
    try { const b = await fetchBlob(); const url = URL.createObjectURL(b); if (w) w.location = url; else location.href = url; } catch (er) { w && w.close(); toast(er.message, true); }
    e.target.textContent = "Open";
  };
  $("[data-dl]", m.el).onclick = async (e) => {
    e.target.textContent = "Loading…";
    try { const b = await fetchBlob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = d.fileName || d.name; a.click(); } catch (er) { toast(er.message, true); }
    e.target.textContent = "Download";
  };
  $("[data-del]", m.el).onclick = async () => {
    if (!(await confirmBox(`Delete “${d.name}”? The file is moved to the Drive bin (recoverable for 30 days).`, "Delete"))) return;
    try { await callScript("trash", { id: d.driveId }); } catch (e) { console.warn(e); }
    await remove("docs", id, d.name); m.close(); toast("Deleted");
  };
}

// ─────────── Equipment ───────────
let eqCheck = null;
export function renderEquipment(root) {
  const items = [...S.equipment].sort((a, b) => (a.number || a.name).localeCompare(b.number || b.name));
  const now = Date.now();
  const nextUse = (id) => events().filter((e) => e.end >= now && e.status !== "cancelled" && (e.equipmentIds || []).includes(id)).sort((a, b) => a.start - b.start)[0];
  const cats = EQUIP_CATS.filter((c) => items.some((q) => q.category === c));
  const cand = eqCheck ? { start: eqCheck.start, end: eqCheck.end, travelMin: 0 } : null;
  root.innerHTML = `<div class="topbar"><h1>Equipment</h1><button class="btn primary" data-new>+ Add item</button></div>
    <div class="card"><h2>Check availability</h2><div class="row" style="align-items:end">
      <div class="field" style="margin:0"><label>Date</label><input type="date" name="d" value="${eqCheck ? toDateInput(eqCheck.start) : todayISO()}"></div>
      <div class="field" style="margin:0"><label>From</label><input type="time" name="f" value="${eqCheck ? new Date(eqCheck.start).toTimeString().slice(0, 5) : "10:00"}"></div>
      <div class="field" style="margin:0"><label>To</label><input type="time" name="t" value="${eqCheck ? new Date(eqCheck.end).toTimeString().slice(0, 5) : "18:00"}"></div>
      <div style="flex:0 0 auto" class="btns"><button class="btn" data-check>Check</button>${eqCheck ? '<button class="btn ghost" data-clear>Clear</button>' : ""}</div></div></div>
    <div class="stats" style="margin-bottom:14px"><div class="stat"><div class="v">${items.filter((q) => q.status !== "Retired").length}</div><div class="k">Items in use</div></div>
      <div class="stat"><div class="v">${items.filter((q) => q.status === "In repair" || q.condition === "Needs repair" || q.condition === "Broken").length}</div><div class="k">Need attention</div></div></div>
    ${cats.map((c) => `<h2 style="margin-top:14px">${esc(c)} <span class="dim" style="font-weight:400">(${items.filter((q) => q.category === c).length})</span></h2><div class="card flat"><div class="list">${items.filter((q) => q.category === c).map((q) => {
      const nu = nextUse(q.id); const busy = cand ? equipmentBusy(cand, q.id) : null;
      const st = q.status && q.status !== "Available" ? `<span class="badge warn">${esc(q.status)}</span>` : "";
      const cond = q.condition ? `<span class="badge ${q.condition === "Broken" ? "bad" : q.condition === "Needs repair" ? "warn" : ""}">${esc(q.condition)}</span>` : "";
      return `<div class="item" data-q="${esc(q.id)}"><div class="body"><div class="t">${q.number ? `<span class="code">${esc(q.number)}</span> ` : ""}${esc(q.name)} ${st} ${cond}</div>
        <div class="meta">${q.brand ? `<span>${esc(q.brand)}</span>` : ""}${q.serial ? `<span>S/N ${esc(q.serial)}</span>` : ""}${q.owner ? `<span>Owner: ${esc(q.owner)}</span>` : ""}${nu ? `<span>Next: ${esc(nu.title)} · ${esc(fmtDT(nu.start))}</span>` : ""}</div></div>
        ${cand ? `<div class="right">${busy ? `<span class="badge bad">Booked: ${esc(busy.title)}</span>` : (q.status || "Available") === "Available" && q.condition !== "Broken" ? '<span class="badge ok">Free</span>' : '<span class="badge warn">Unavailable</span>'}</div>` : ""}</div>`;
    }).join("")}</div></div>`).join("") || '<div class="empty">No equipment yet.</div>'}`;
  $("[data-new]", root).onclick = () => openEquipEditor();
  $$("[data-q]", root).forEach((r) => r.onclick = () => openEquipEditor(r.dataset.q));
  $("[data-check]", root).onclick = () => { const d = $("[name=d]", root).value; eqCheck = { start: fromInputs(d, $("[name=f]", root).value), end: fromInputs(d, $("[name=t]", root).value) }; renderEquipment(root); };
  $("[data-clear]", root) && ($("[data-clear]", root).onclick = () => { eqCheck = null; renderEquipment(root); });
}
export function nextNumber(cat) {
  const p = EQUIP_PREFIX[cat] || "EQ";
  const n = S.equipment.filter((q) => (q.number || "").startsWith(p + "-")).map((q) => parseInt(q.number.split("-")[1]) || 0);
  return `${p}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(2, "0")}`;
}
export function openEquipEditor(id) {
  const q = id ? byId("equipment", id) : { category: "Camera", condition: "Good", status: "Available" };
  const now = Date.now();
  const uses = id ? events().filter((e) => (e.equipmentIds || []).includes(id) && e.status !== "cancelled").sort((a, b) => b.start - a.start) : [];
  const m = modal(`<div class="mh"><h2>${id ? "Edit item" : "Add equipment"}</h2><button class="x" data-close>×</button></div>
    <div class="row"><div class="field"><label>Category</label><select name="category">${EQUIP_CATS.map((c) => opt(c, c, q.category)).join("")}</select></div>
      <div class="field"><label>Item number (label on the gear)</label><input name="number" value="${esc(q.number || nextNumber(q.category))}"></div></div>
    <div class="field"><label>Name</label><input name="name" value="${esc(q.name || "")}" placeholder="e.g. Sony A7 IV body"></div>
    <div class="row"><div class="field"><label>Brand / model</label><input name="brand" value="${esc(q.brand || "")}"></div><div class="field"><label>Serial number</label><input name="serial" value="${esc(q.serial || "")}"></div></div>
    <div class="row"><div class="field"><label>Condition</label><select name="condition">${CONDITIONS.map((c) => opt(c, c, q.condition)).join("")}</select></div>
      <div class="field"><label>Status</label><select name="status">${EQUIP_STATUS.map((c) => opt(c, c, q.status)).join("")}</select></div>
      <div class="field"><label>Owner</label><input name="owner" value="${esc(q.owner || "")}" placeholder="Company / person"></div></div>
    <div class="field"><label>Notes (accessories, issues…)</label><textarea name="notes">${esc(q.notes || "")}</textarea></div>
    ${id ? `<div class="section"><h3>Bookings</h3><div class="card flat" style="margin:0"><div class="list">${uses.slice(0, 20).map((e) => eventRow(e)).join("") || '<div class="empty">Not used yet.</div>'}</div></div></div>` : ""}
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><button class="btn" data-hist>History</button><button class="btn" data-dup>Duplicate</button><span class="spacer"></span>' : '<label style="display:flex;gap:6px;align-items:center;margin-right:auto">Add <input type="number" name="count" value="1" min="1" max="20" style="width:70px;min-height:34px;padding:4px 8px"> of these</label>'}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`, { wide: !!id });
  const el = m.el;
  if (!id) $("[name=category]", el).onchange = (e) => ($("[name=number]", el).value = nextNumber(e.target.value));
  bindEventRows(el);
  $("[data-save]", el).onclick = async () => {
    const d = {}; ["category", "number", "name", "brand", "serial", "condition", "status", "owner", "notes"].forEach((k) => (d[k] = val(el, k)));
    if (!d.name) return toast("Name is required", true);
    if (id) { await save("equipment", id, d, `${d.number} ${d.name}`); toast("Saved"); m.close(); return; }
    const count = Math.max(1, Math.min(20, parseInt(val(el, "count")) || 1));
    for (let i = 0; i < count; i++) {
      const num = i === 0 ? d.number : nextNumber(d.category);
      await save("equipment", null, { ...d, number: num }, `${num} ${d.name}`);
    }
    toast(count > 1 ? `${count} items added` : "Saved"); m.close();
  };
  if (id) {
    $("[data-del]", el).onclick = async () => { if (await confirmBox(`Delete ${q.number} ${q.name}? Tip: set status to “Retired” instead to keep its history.`, "Delete")) { await remove("equipment", id, `${q.number} ${q.name}`); m.close(); } };
    $("[data-hist]", el).onclick = () => historyModal(id, q.name);
    $("[data-dup]", el).onclick = async () => { const { id: _, createdAt, createdBy, updatedAt, updatedBy, updatedByName, ...rest } = q; const num = nextNumber(q.category); await save("equipment", null, { ...rest, number: num, serial: "" }, `${num} ${q.name}`); toast("Duplicated as " + num); m.close(); };
  }
}

// ─────────── Locations ───────────
export function renderLocations(root) {
  const list = [...S.locations].sort((a, b) => a.name.localeCompare(b.name));
  root.innerHTML = `<div class="topbar"><h1>Locations</h1><button class="btn primary" data-new>+ Add location</button></div>
    <div class="card flat"><div class="list">${list.map((l) => {
      const n = events().filter((e) => e.locationId === l.id).length;
      return `<div class="item" data-l="${esc(l.id)}"><div class="body"><div class="t">📍 ${esc(l.name)}</div><div class="meta">${l.address ? `<span>${esc(l.address)}</span>` : ""}${l.travelMin ? `<span>Usual travel ${esc(l.travelMin)} min</span>` : ""}<span>${n} bookings</span></div></div></div>`;
    }).join("") || '<div class="empty">No locations yet.</div>'}</div></div>`;
  $("[data-new]", root).onclick = () => openLocEditor();
  $$("[data-l]", root).forEach((r) => r.onclick = () => openLocEditor(r.dataset.l));
}
function openLocEditor(id) {
  const l = id ? byId("locations", id) : {};
  const m = modal(`<div class="mh"><h2>${id ? "Edit location" : "New location"}</h2><button class="x" data-close>×</button></div>
    <div class="field"><label>Name</label><input name="name" value="${esc(l.name || "")}"></div>
    <div class="field"><label>Address</label><input name="address" value="${esc(l.address || "")}"></div>
    <div class="field"><label>Usual travel time (min, each way) – pre-fills new bookings</label><input type="number" name="travelMin" value="${esc(l.travelMin || 0)}"></div>
    <div class="field"><label>Notes (parking, access, contact, power…)</label><textarea name="notes">${esc(l.notes || "")}</textarea></div>
    ${l.address ? `<p><a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}">Open in Google Maps ↗</a></p>` : ""}
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`);
  $("[data-save]", m.el).onclick = async () => {
    const d = { name: val(m.el, "name"), address: val(m.el, "address"), travelMin: parseInt(val(m.el, "travelMin")) || 0, notes: val(m.el, "notes") };
    if (!d.name) return toast("Name is required", true);
    await save("locations", id, d, d.name); toast("Saved"); m.close();
  };
  id && ($("[data-del]", m.el).onclick = async () => { if (await confirmBox(`Delete ${l.name}?`, "Delete")) { await remove("locations", id, l.name); m.close(); } });
}

// ─────────── Activity ───────────
let actFilter = { by: "", col: "" };
export function renderActivity(root) {
  let list = S.activity;
  if (actFilter.by) list = list.filter((a) => a.by === actFilter.by);
  if (actFilter.col) list = list.filter((a) => a.col === actFilter.col);
  const people = [...new Set(S.activity.map((a) => a.by))];
  root.innerHTML = `<div class="topbar"><h1>Activity log</h1></div>
    <p class="muted">Every change anyone makes – who, what and when. Changes made in Google Calendar show as “Google Calendar”.</p>
    <div class="row" style="margin-bottom:12px"><select data-by>${opt("", "Everyone", actFilter.by)}${people.map((p) => opt(p, p === "google-calendar" ? "Google Calendar" : memberName(p), actFilter.by)).join("")}</select>
      <select data-col>${opt("", "Everything", actFilter.col)}${[["events", "Calendar items"], ["artists", "Artists"], ["contracts", "Contracts"], ["equipment", "Equipment"], ["docs", "Documents"], ["locations", "Locations"], ["members", "Team"]].map(([k, l]) => opt(k, l, actFilter.col)).join("")}</select></div>
    <div class="card flat"><div class="list">${list.slice(0, 300).map(activityHTML).join("") || '<div class="empty">No activity yet.</div>'}</div></div>`;
  $("[data-by]", root).onchange = (e) => { actFilter.by = e.target.value; renderActivity(root); };
  $("[data-col]", root).onchange = (e) => { actFilter.col = e.target.value; renderActivity(root); };
}
