import { openDocUpload, openDoc } from "./misc.js?v=6";
import { S, byId, events, live, save, memberName, artistName, equipLabel, locName, setRaw, delRaw, uid, onChange } from "./store.js?v=6";
import { findConflicts, freeMembers, freeEquipment, nextFreeSlot, equipmentBusy, memberBusy } from "./conflicts.js?v=6";
import {
  esc, $, $$, modal, toast, confirmBox, opt, fmtDT, fmtDate, fmtDateShort, fmtTime, money, hoursOf, toDateInput, toTimeInput,
  fromInputs, TYPES, SUBTYPES, EQUIP_CATS, startOfDay, addDays, TYPE_ORDER, NO_GEAR, linkify,
} from "./util.js?v=6";

export const paidOf = (e) => (e.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
export const owedOf = (e) => e.status === "cancelled" ? 0 : Math.max(0, (Number(e.price) || 0) - paidOf(e));

export const agendaItems = (e) => String(e.brief || "").split("\n").map((x) => x.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter(Boolean);

export function eventRow(e, { showDate = true } = {}) {
  const t = TYPES[e.type] || TYPES.unsorted;
  const crew = (e.memberIds || []).map(memberName).join(", ");
  const owed = owedOf(e);
  return `<div class="item t-${esc(e.type || "unsorted")}" data-ev="${esc(e.id)}">
    <div class="bar"></div>
    <div class="body">
      <div class="t">${esc(e.title || "Untitled")} ${e.status === "cancelled" ? '<span class="badge bad">Cancelled</span>' : ""}${e.status === "done" ? '<span class="badge ok">Done</span>' : ""}</div>
      <div class="meta">
        ${showDate ? `<span>${e.allDay ? esc(fmtDate(e.start)) + " · all day" : esc(fmtDT(e.start)) + "–" + esc(fmtTime(e.end))}</span>` : `<span>${e.allDay ? "All day" : esc(fmtTime(e.start)) + "–" + esc(fmtTime(e.end))}</span>`}
        <span>${t.icon} ${esc(e.subtype || t.label)}</span>
        ${e.artistId ? `<span>🎤 ${esc(artistName(e.artistId))}</span>` : ""}
        ${locName(e) ? `<span>📍 ${esc(locName(e))}${e.travelMin ? ` (+${esc(e.travelMin)} min travel)` : ""}</span>` : ""}
        ${crew ? `<span>👥 ${esc(crew)}</span>` : ""}
        ${(e.equipmentIds || []).length ? `<span>🎥 ${(e.equipmentIds || []).length} items</span>` : ""}
        ${e.type === "meeting" && agendaItems(e).length ? `<span>📝 ${agendaItems(e).length} agenda points</span>` : ""}
        ${(e.docIds || []).length ? `<span>📄 ${(e.docIds || []).length} docs</span>` : ""}
        ${e.link ? `<span>🔗 online</span>` : ""}
      </div>
    </div>
    <div class="right">${hoursOf(e) && !e.allDay ? hoursOf(e) + " h" : ""}${owed ? `<div class="money-pos">${esc(money(owed))} due</div>` : ""}</div>
  </div>`;
}
export function bindEventRows(root) {
  $$("[data-ev]", root).forEach((el) => el.addEventListener("click", () => openEventEditor(el.dataset.ev)));
}

// ─────────── Event editor ───────────
export function openEventEditor(id, preset = {}) {
  const ex = id ? byId("events", id) : null;
  const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
  const st = ex ? JSON.parse(JSON.stringify(ex)) : {
    type: preset.type || "shoot", subtype: "", title: "", artistId: preset.artistId || "", status: "planned",
    start: preset.start || now.getTime(), end: (preset.start || now.getTime()) + (preset.type === "meeting" ? 1 : 4) * 36e5, allDay: false,
    locationId: "", locationText: "", travelMin: 0, memberIds: S.me ? [S.me.id] : [], equipmentIds: [],
    price: "", payments: [], notes: "", brief: "", callNotes: "", docIds: [], link: "",
  };
  if (!ex && preset.type === "meeting") st.memberIds = S.members.filter((x) => x.active !== false).map((x) => x.id);
  st.memberIds = st.memberIds || []; st.equipmentIds = st.equipmentIds || []; st.payments = st.payments || []; st.docIds = st.docIds || [];
  const isNew = !ex;

  const m = modal(`
    <div class="mh"><h2>${isNew ? "New" : "Edit"} <span data-typelabel></span></h2><button class="x" data-close>×</button></div>
    <div class="tabs" data-typetabs>${TYPE_ORDER.filter((t) => t !== "unsorted" || st.type === "unsorted").map((t) => `<button type="button" data-t="${t}">${TYPES[t].icon} ${TYPES[t].label}</button>`).join("")}</div>
    <div class="row">
      <div class="field"><label>Kind</label><select name="subtype"></select></div>
      <div class="field"><label>Status</label><select name="status">${opt("planned", "Planned", st.status)}${opt("done", "Done", st.status)}${opt("cancelled", "Cancelled", st.status)}</select></div>
    </div>
    <div class="field"><label>Artist</label><select name="artistId"></select>
      <input name="newArtist" placeholder="New artist name" style="display:none;margin-top:6px"></div>
    <div class="field"><label>Title <span class="dim">(optional – defaults to “Artist – Kind”)</span></label><input name="title" value="${esc(st.title)}" placeholder="e.g. Valentino – Music video"></div>
    <div class="row">
      <div class="field"><label>Date</label><input type="date" name="date" value="${toDateInput(st.start)}"></div>
      <div class="field" data-timef><label>Start time</label><input type="time" name="time" value="${toTimeInput(st.start)}" step="900"></div>
      <div class="field" data-timef><label>Hours</label><input type="number" name="hours" min="0.25" step="0.25" value="${hoursOf(st) || 4}"></div>
      <div class="field" style="flex:0 0 auto;align-self:end"><label style="display:flex;gap:6px;align-items:center;min-height:42px"><input type="checkbox" name="allDay" ${st.allDay ? "checked" : ""}> All day</label></div>
    </div>
    <div class="row">
      <div class="field"><label>Location</label><select name="locationId"></select>
        <div data-newloc style="display:none;margin-top:6px" class="row"><input name="newLocName" placeholder="Location name"><input name="newLocAddr" placeholder="Address (optional)"></div></div>
      <div class="field" style="flex:0 1 150px"><label>Travel time (min, each way)</label><input type="number" name="travelMin" min="0" step="5" value="${esc(st.travelMin || 0)}"></div>
    </div>
    <div class="field" data-linkf><label>Online meeting link <span class="dim">(Google Meet, Zoom… optional)</span></label><input name="link" value="${esc(st.link || "")}" placeholder="https://meet.google.com/…"></div>
    <div class="section"><h3 data-teamlabel>Team</h3><div class="chips" data-members></div></div>
    <div class="section" data-docsec><h3>Documents to discuss</h3><div data-docsel></div>
      <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" data-updoc>+ Upload a document</button></div></div>
    <div class="section" data-equipsec><h3>Equipment <span class="dim" data-eqcount></span></h3><div data-equip></div></div>
    <div class="section"><h3>Clashes</h3><div data-conflicts></div></div>
    <div class="section"><h3>Notes</h3>
      <div class="field"><label data-brieflabel>Brief / shot list</label><textarea name="brief">${esc(st.brief || "")}</textarea></div>
      <div class="field"><label data-noteslabel>Internal notes</label><textarea name="notes">${esc(st.notes || "")}</textarea></div>
      <div class="field" data-callf><label>Call sheet notes <span class="dim">(visible to the artist on the shared call sheet)</span></label><textarea name="callNotes" placeholder="What to bring, outfits, parking…">${esc(st.callNotes || "")}</textarea></div>
    </div>
    <div class="section" data-moneysec><h3>Money</h3>
      <div class="row"><div class="field"><label>Price (€)</label><input type="number" name="price" min="0" step="1" value="${esc(st.price ?? "")}"></div><div class="field"><label>Balance</label><div data-bal style="padding:10px 0"></div></div></div>
      <div data-payments></div>
      <button type="button" class="btn sm" data-addpay>+ Add payment</button>
    </div>
    ${ex && ex.source === "google" ? `<p class="dim" style="margin-top:12px">Added from Google Calendar.</p>` : ""}
    <div class="mf">
      ${!isNew ? `<button class="btn danger" data-del>Delete</button><button class="btn" data-hist>History</button><button class="btn" data-share>Call sheet link</button>` : ""}
      <span class="spacer"></span>
      <button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>
    </div>`, { wide: true, onClose: () => unsub() });
  const el = m.el;
  const unsub = onChange(() => { renderMembers(); renderEquip(); renderConflicts(); });

  function readForm() {
    st.subtype = $("[name=subtype]", el).value;
    st.status = $("[name=status]", el).value;
    st.artistId = $("[name=artistId]", el).value;
    st.title = $("[name=title]", el).value.trim();
    st.allDay = $("[name=allDay]", el).checked;
    const date = $("[name=date]", el).value;
    if (st.allDay) { st.start = fromInputs(date, "00:00"); st.end = addDays(st.start, 1); }
    else {
      st.start = fromInputs(date, $("[name=time]", el).value || "12:00");
      const h = parseFloat($("[name=hours]", el).value) || 1;
      st.end = st.start + Math.round(h * 36e5);
    }
    st.locationId = $("[name=locationId]", el).value;
    st.travelMin = parseInt($("[name=travelMin]", el).value) || 0;
    st.link = $("[name=link]", el).value.trim();
    st.brief = $("[name=brief]", el).value; st.notes = $("[name=notes]", el).value; st.callNotes = $("[name=callNotes]", el).value;
    st.price = $("[name=price]", el).value === "" ? "" : Number($("[name=price]", el).value);
    $$("[data-pay]", el).forEach((row, i) => {
      st.payments[i] = { amount: Number($("[name=pamt]", row).value) || 0, date: $("[name=pdate]", row).value, note: $("[name=pnote]", row).value };
    });
  }
  function setTimeInputs() {
    $("[name=date]", el).value = toDateInput(st.start);
    $("[name=time]", el).value = toTimeInput(st.start);
    $("[name=hours]", el).value = hoursOf(st);
  }
  function renderType() {
    $("[data-typelabel]", el).textContent = TYPES[st.type].label.toLowerCase();
    $$("[data-typetabs] button", el).forEach((b) => b.classList.toggle("on", b.dataset.t === st.type));
    const subs = SUBTYPES[st.type];
    $("[name=subtype]", el).innerHTML = subs.map((s) => opt(s, s, st.subtype || subs[0])).join("");
    const mt = st.type === "meeting";
    $("[data-equipsec]", el).style.display = NO_GEAR.has(st.type) ? "none" : "";
    $("[data-brieflabel]", el).textContent = mt ? "Agenda – one point per line" : st.type === "recording" ? "Songs / session plan" : st.type === "management" ? "Agenda / details" : "Brief / shot list";
    $("[name=brief]", el).placeholder = mt ? "e.g.\nNext month's shoots\nValentino contract renewal\nNew lights budget" : "";
    $("[data-noteslabel]", el).textContent = mt ? "Minutes & decisions (fill in during / after the meeting)" : "Internal notes";
    $("[data-callf]", el).style.display = NO_GEAR.has(st.type) ? "none" : "";
    $("[data-moneysec]", el).style.display = mt ? "none" : "";
    $("[data-linkf]", el).style.display = mt || st.type === "management" ? "" : "none";
    $("[data-teamlabel]", el).textContent = mt ? "Who attends" : "Team";
    $("[name=title]", el).placeholder = mt ? "e.g. Weekly sync – December plan" : "e.g. Valentino – Music video";
    $("[data-docsec]", el).style.display = mt || st.type === "management" ? "" : "none";
    const sh = $("[data-share]", el); if (sh) sh.style.display = NO_GEAR.has(st.type) ? "none" : "";
  }
  function renderArtists() {
    const arts = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
    $("[name=artistId]", el).innerHTML = opt("", "— none —", st.artistId) + arts.map((a) => opt(a.id, a.name + (a.managed ? " ★" : ""), st.artistId)).join("") + opt("__new", "+ New artist…", st.artistId);
  }
  function renderLocations() {
    const locs = [...S.locations].sort((a, b) => a.name.localeCompare(b.name));
    $("[name=locationId]", el).innerHTML = opt("", st.locationText ? `“${st.locationText}” (from Google)` : "— none —", st.locationId) + locs.map((l) => opt(l.id, l.name, st.locationId)).join("") + opt("__new", "+ New location…", st.locationId);
  }
  function renderMembers() {
    const mem = S.members.filter((x) => x.active !== false || st.memberIds.includes(x.id));
    $("[data-members]", el).innerHTML = mem.map((x) => {
      const busy = st.start && !st.allDay ? memberBusy(st, x.id) : null;
      return `<span class="chip ${st.memberIds.includes(x.id) ? "on" : ""} ${busy ? "busy" : ""}" data-m="${esc(x.id)}" title="${busy ? "Busy: " + esc(busy.title) : ""}">${esc(x.name)}${busy ? " <small>busy</small>" : ""}</span>`;
    }).join("") || '<span class="dim">No team members yet.</span>';
    $$("[data-m]", el).forEach((c) => c.onclick = () => { const id = c.dataset.m; st.memberIds = st.memberIds.includes(id) ? st.memberIds.filter((x) => x !== id) : [...st.memberIds, id]; renderMembers(); renderConflicts(); });
  }
  function renderEquip() {
    const items = S.equipment.filter((q) => q.status !== "Retired" || st.equipmentIds.includes(q.id));
    $("[data-eqcount]", el).textContent = st.equipmentIds.length ? `(${st.equipmentIds.length} selected)` : "";
    if (!items.length) { $("[data-equip]", el).innerHTML = '<span class="dim">No equipment logged yet – add items in the Equipment tab.</span>'; return; }
    const cats = EQUIP_CATS.filter((c) => items.some((q) => q.category === c));
    $("[data-equip]", el).innerHTML = cats.map((c) => `<div class="group-label">${esc(c)}</div><div class="chips">${items.filter((q) => q.category === c).sort((a, b) => (a.number || "").localeCompare(b.number || "")).map((q) => {
      const busy = st.start ? equipmentBusy(st, q.id) : null;
      const off = (q.status && q.status !== "Available") || q.condition === "Broken";
      return `<span class="chip ${st.equipmentIds.includes(q.id) ? "on" : ""} ${busy ? "busy" : ""} ${off ? "off" : ""}" data-q="${esc(q.id)}" title="${busy ? "Booked: " + esc(busy.title) : off ? esc(q.status || q.condition) : ""}">${esc(q.number ? q.number + " · " : "")}${esc(q.name)}${busy ? " <small>booked</small>" : off ? ` <small>${esc(q.status !== "Available" ? q.status : q.condition)}</small>` : ""}</span>`;
    }).join("")}</div>`).join("");
    $$("[data-q]", el).forEach((c) => c.onclick = () => { const id = c.dataset.q; st.equipmentIds = st.equipmentIds.includes(id) ? st.equipmentIds.filter((x) => x !== id) : [...st.equipmentIds, id]; renderEquip(); renderConflicts(); });
  }
  function renderDocs() {
    const box = $("[data-docsel]", el);
    const docs = [...S.docs].sort((a, b) => (st.docIds.includes(b.id) - st.docIds.includes(a.id)) || b.createdAt - a.createdAt);
    if (!docs.length) { box.innerHTML = '<span class="dim">No documents uploaded yet.</span>'; return; }
    const sel = docs.filter((d) => st.docIds.includes(d.id));
    box.innerHTML = (sel.length ? `<div class="card flat" style="margin:0 0 8px"><div class="list">${sel.map((d) => `<div class="item" style="cursor:default"><div class="body"><div class="t">📄 ${esc(d.name)}</div><div class="meta"><span>${esc(d.category || "")}</span>${d.artistId ? `<span>🎤 ${esc(artistName(d.artistId))}</span>` : ""}</div></div><div class="btns"><button type="button" class="btn sm" data-opendoc="${esc(d.id)}">Open</button><button type="button" class="btn sm ghost" data-rmdoc="${esc(d.id)}">✕</button></div></div>`).join("")}</div></div>` : "") +
      `<div class="group-label">Attach an existing document</div><div class="chips">${docs.filter((d) => !st.docIds.includes(d.id)).slice(0, 40).map((d) => `<span class="chip" data-adddoc="${esc(d.id)}">+ ${esc(d.name)}</span>`).join("") || '<span class="dim">All documents attached.</span>'}</div>`;
    $$("[data-adddoc]", box).forEach((c) => c.onclick = () => { st.docIds.push(c.dataset.adddoc); renderDocs(); });
    $$("[data-rmdoc]", box).forEach((c) => c.onclick = () => { st.docIds = st.docIds.filter((x) => x !== c.dataset.rmdoc); renderDocs(); });
    $$("[data-opendoc]", box).forEach((c) => c.onclick = () => openDoc(c.dataset.opendoc));
  }
  let conflicts = [];
  function renderConflicts() {
    const cand = { ...st, id: ex?.id, artistId: st.artistId === "__new" ? "" : st.artistId, locationId: st.locationId === "__new" ? "" : st.locationId };
    conflicts = findConflicts(cand);
    const box = $("[data-conflicts]", el);
    if (!conflicts.length) { box.innerHTML = `<div class="alert info">✓ No clashes – team, equipment, artist and location are all free (travel time included).</div>`; $("[data-save]", el).disabled = false; return; }
    $("[data-save]", el).disabled = true;
    const slot = conflicts.some((c) => c.other) ? nextFreeSlot(cand) : null;
    box.innerHTML = `<div class="alert bad"><b>Double booking – resolve before saving.</b></div>` + conflicts.map((c, i) => {
      let fixes = "";
      if (c.kind === "member") {
        const alts = freeMembers(cand).slice(0, 4);
        fixes = alts.map((a) => `<button class="btn sm" data-fix="swapm" data-i="${i}" data-to="${esc(a.id)}">Swap to ${esc(a.name)}</button>`).join("") + `<button class="btn sm" data-fix="rmm" data-i="${i}">Remove ${esc(memberName(c.id))}</button>`;
      } else if (c.kind === "equipment" || c.kind === "status") {
        const alts = freeEquipment(cand, c.id).slice(0, 4);
        fixes = alts.map((a) => `<button class="btn sm" data-fix="swapq" data-i="${i}" data-to="${esc(a.id)}">Swap to ${esc(equipLabel(a.id))}</button>`).join("") + `<button class="btn sm" data-fix="rmq" data-i="${i}">Remove item</button>`;
        if (!alts.length && c.kind === "equipment") fixes = `<span class="dim">No other free ${esc(byId("equipment", c.id)?.category || "")} item.</span> ` + fixes;
      } else if (c.kind === "location") {
        fixes = `<button class="btn sm" data-fix="rmloc" data-i="${i}">Choose another location</button>`;
      }
      if (c.other) fixes += `<button class="btn sm" data-fix="open" data-i="${i}">Open other booking</button>`;
      return `<div class="alert warn">${esc(c.msg)}<div class="btns">${fixes}</div></div>`;
    }).join("") + (slot ? `<div class="alert info">Next time with no clashes: <b>${esc(fmtDT(slot))}</b><div class="btns"><button class="btn sm primary" data-fix="move" data-to="${slot}">Move to ${esc(fmtDT(slot))}</button></div></div>` : "");
    $$("[data-fix]", box).forEach((b) => b.onclick = () => {
      const c = conflicts[b.dataset.i];
      switch (b.dataset.fix) {
        case "swapm": st.memberIds = st.memberIds.map((x) => (x === c.id ? b.dataset.to : x)); break;
        case "rmm": st.memberIds = st.memberIds.filter((x) => x !== c.id); break;
        case "swapq": st.equipmentIds = st.equipmentIds.map((x) => (x === c.id ? b.dataset.to : x)); break;
        case "rmq": st.equipmentIds = st.equipmentIds.filter((x) => x !== c.id); break;
        case "rmloc": $("[name=locationId]", el).focus(); return;
        case "open": openEventEditor(c.other.id); return;
        case "move": { const d = st.end - st.start; st.start = Number(b.dataset.to); st.end = st.start + d; setTimeInputs(); break; }
      }
      renderMembers(); renderEquip(); renderConflicts();
    });
  }
  function renderPayments() {
    $("[data-payments]", el).innerHTML = st.payments.map((p, i) => `<div class="row" data-pay style="margin-bottom:6px;align-items:center">
      <input type="number" name="pamt" placeholder="Amount €" value="${esc(p.amount ?? "")}" style="flex:0 1 120px">
      <input type="date" name="pdate" value="${esc(p.date || "")}" style="flex:0 1 160px">
      <input name="pnote" placeholder="Note (cash, bank…)" value="${esc(p.note || "")}">
      <button type="button" class="btn sm ghost" data-rmpay="${i}" style="flex:0 0 auto">✕</button></div>`).join("");
    $$("[data-rmpay]", el).forEach((b) => b.onclick = () => { readForm(); st.payments.splice(Number(b.dataset.rmpay), 1); renderPayments(); renderBal(); });
    $$("[data-pay] input", el).forEach((i) => i.oninput = () => { readForm(); renderBal(); });
  }
  function renderBal() {
    const paid = st.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const due = (Number(st.price) || 0) - paid;
    $("[data-bal]", el).innerHTML = `Paid ${esc(money(paid))} · <b class="${due > 0 ? "money-pos" : "money-ok"}">${due > 0 ? esc(money(due)) + " due" : "settled"}</b>`;
  }
  function toggleAllDay() { $$("[data-timef]", el).forEach((f) => (f.style.display = st.allDay ? "none" : "")); }

  renderType(); renderArtists(); renderLocations(); renderMembers(); renderEquip(); renderDocs(); renderPayments(); renderBal(); toggleAllDay(); renderConflicts();
  $("[data-updoc]", el).onclick = () => openDocUpload({ category: "Other", eventId: ex?.id || "", onDone: (id) => { st.docIds.push(id); setTimeout(renderDocs, 400); } });

  $$("[data-typetabs] button", el).forEach((b) => b.onclick = () => { readForm(); st.type = b.dataset.t; st.subtype = ""; if (NO_GEAR.has(st.type)) st.equipmentIds = []; renderType(); renderEquip(); renderConflicts(); });
  $("[name=artistId]", el).onchange = (e) => { $("[name=newArtist]", el).style.display = e.target.value === "__new" ? "" : "none"; readForm(); renderConflicts(); };
  $("[name=locationId]", el).onchange = (e) => {
    $("[data-newloc]", el).style.display = e.target.value === "__new" ? "" : "none";
    const l = byId("locations", e.target.value);
    if (l && l.travelMin && !Number($("[name=travelMin]", el).value)) $("[name=travelMin]", el).value = l.travelMin;
    readForm(); renderMembers(); renderEquip(); renderConflicts();
  };
  ["date", "time", "hours", "travelMin", "allDay", "status"].forEach((n) => $(`[name=${n}]`, el).addEventListener("change", () => { readForm(); toggleAllDay(); renderMembers(); renderEquip(); renderConflicts(); }));
  $("[name=price]", el).oninput = () => { readForm(); renderBal(); };
  $("[data-addpay]", el).onclick = () => { readForm(); st.payments.push({ amount: "", date: toDateInput(Date.now()), note: "" }); renderPayments(); renderBal(); };

  $("[data-save]", el).onclick = async () => {
    readForm();
    if (!st.start) return toast("Pick a date", true);
    const btn = $("[data-save]", el); btn.disabled = true; btn.textContent = "Saving…";
    try {
      if (st.artistId === "__new") {
        const n = $("[name=newArtist]", el).value.trim();
        if (!n) { toast("Type the new artist's name", true); btn.disabled = false; btn.textContent = "Save"; return; }
        st.artistId = await save("artists", null, { name: n, managed: false }, n);
      }
      if (st.locationId === "__new") {
        const n = $("[name=newLocName]", el).value.trim();
        if (!n) { toast("Type the new location's name", true); btn.disabled = false; btn.textContent = "Save"; return; }
        st.locationId = await save("locations", null, { name: n, address: $("[name=newLocAddr]", el).value.trim(), travelMin: st.travelMin || 0 }, n);
      }
      if (findConflicts({ ...st, id: ex?.id }).length) { renderConflicts(); btn.textContent = "Save"; return toast("Resolve the clashes first", true); }
      if (!st.title) st.title = st.type === "meeting" ? `Team meeting – ${st.subtype || "Weekly sync"}` : [artistName(st.artistId), st.subtype || TYPES[st.type].label].filter(Boolean).join(" – ");
      const data = {
        type: st.type, subtype: st.subtype, title: st.title, artistId: st.artistId || "", status: st.status,
        start: st.start, end: st.end, allDay: !!st.allDay, locationId: st.locationId || "", locationText: st.locationId ? "" : (st.locationText || ""),
        travelMin: st.travelMin || 0, memberIds: st.memberIds, equipmentIds: NO_GEAR.has(st.type) ? [] : st.equipmentIds, docIds: st.docIds, link: st.link || "",
        price: st.type === "meeting" || st.price === "" ? 0 : st.price, payments: st.payments.filter((p) => p.amount), brief: st.brief, notes: st.notes, callNotes: st.callNotes, deleted: false,
      };
      if (isNew) data.source = "app";
      const newId = await save("events", ex?.id, data, data.title);
      if (ex?.shareToken) await writeCallSheet({ ...data, id: newId, shareToken: ex.shareToken });
      toast("Saved – syncing to Google Calendar");
      m.close();
    } catch (e) { console.error(e); toast("Save failed: " + e.message, true); btn.disabled = false; btn.textContent = "Save"; }
  };
  if (!isNew) {
    $("[data-del]", el).onclick = async () => {
      if (!(await confirmBox(`Delete “${ex.title}”? It will also be removed from Google Calendar.`, "Delete"))) return;
      await save("events", ex.id, { deleted: true }, ex.title);
      if (ex.shareToken) await delRaw("callsheets", ex.shareToken).catch(() => {});
      toast("Deleted"); m.close();
    };
    $("[data-hist]", el).onclick = () => historyModal(ex.id, ex.title);
    $("[data-share]", el).onclick = () => shareModal(ex.id);
  }
}

// ─────────── Call sheet ───────────
async function writeCallSheet(e) {
  const crew = (e.memberIds || []).map(memberName);
  const loc = e.locationId ? byId("locations", e.locationId) : null;
  await setRaw("callsheets", e.shareToken, {
    eventId: e.id, title: e.title || "", type: TYPES[e.type]?.label || "", subtype: e.subtype || "", start: e.start, end: e.end, allDay: !!e.allDay,
    artist: artistName(e.artistId), location: loc ? loc.name : e.locationText || "", address: loc ? loc.address || "" : "",
    crew, equipment: (e.equipmentIds || []).map(equipLabel), notes: e.callNotes || "", brief: e.brief || "", status: e.status || "planned", updatedAt: Date.now(),
  });
}
function shareModal(id) {
  const e = byId("events", id);
  const link = (t) => new URL("callsheet.html?t=" + t, location.href.split("#")[0]).href;
  const m = modal(`<div class="mh"><h2>Call sheet link</h2><button class="x" data-close>×</button></div>
    <p class="muted">A read-only page with date, time, location, team, equipment and the call sheet notes. No prices or internal notes. Anyone with the link can open it, so send it only to the artist and crew. It updates every time you save the shoot.</p>
    <div data-b></div>`);
  const draw = () => {
    const ev = byId("events", id);
    $("[data-b]", m.el).innerHTML = ev.shareToken
      ? `<div class="field"><input readonly value="${esc(link(ev.shareToken))}"></div><div class="btns"><button class="btn primary" data-copy>Copy link</button><a class="btn" target="_blank" href="${esc(link(ev.shareToken))}">Open</a><span class="spacer"></span><button class="btn danger" data-stop>Stop sharing</button></div>`
      : `<button class="btn primary" data-make>Create link</button>`;
    $("[data-make]", m.el) && ($("[data-make]", m.el).onclick = async () => {
      const t = uid(24);
      await save("events", id, { shareToken: t }, ev.title);
      await writeCallSheet({ ...ev, shareToken: t });
      setTimeout(draw, 300);
    });
    $("[data-copy]", m.el) && ($("[data-copy]", m.el).onclick = () => { navigator.clipboard.writeText(link(ev.shareToken)); toast("Link copied"); });
    $("[data-stop]", m.el) && ($("[data-stop]", m.el).onclick = async () => {
      await delRaw("callsheets", ev.shareToken).catch(() => {});
      await save("events", id, { shareToken: "" }, ev.title);
      setTimeout(draw, 300);
    });
  };
  draw();
}

// ─────────── History ───────────
const FIELD_NAMES = { memberIds: "Team", equipmentIds: "Equipment", artistId: "Artist", locationId: "Location", travelMin: "Travel (min)", start: "Start", end: "End", allDay: "All day", callNotes: "Call sheet notes", subtype: "Kind", shareToken: "Call sheet link", locationText: "Location (Google)", managedSince: "Managed since", managedHistory: "Managed periods", renew: "Renew?", endDate: "End date", startDate: "Start date" };
export function fmtChangeValue(f, v) {
  if (v === "" || v === undefined) return "—";
  let p = v; try { p = JSON.parse(v); } catch (_) {}
  if (f === "start" || f === "end") return fmtDT(Number(v));
  if (f === "memberIds" && Array.isArray(p)) return p.map(memberName).join(", ") || "—";
  if (f === "equipmentIds" && Array.isArray(p)) return p.map(equipLabel).join(", ") || "—";
  if (f === "artistId") return artistName(v) || v;
  if (f === "locationId") return byId("locations", v)?.name || v;
  if (f === "payments" && Array.isArray(p)) return p.map((x) => money(x.amount) + (x.date ? " (" + x.date + ")" : "")).join(", ") || "—";
  if (f === "managedHistory" && Array.isArray(p)) return p.map((x) => `${x.from || "?"} → ${x.to || "now"}`).join(", ");
  if (f === "shareToken") return v ? "on" : "off";
  return String(v).length > 120 ? String(v).slice(0, 120) + "…" : String(v);
}
export function activityHTML(a) {
  const col = { links: "link", events: "", artists: "artist", contracts: "contract", equipment: "equipment", locations: "location", docs: "document", members: "team member" }[a.col] ?? a.col;
  const ev = a.col === "events" ? byId("events", a.docId) : null;
  const what = ev ? (TYPES[ev.type]?.label.toLowerCase() || "event") : col;
  const ch = (a.changes || []).filter((c) => c.f !== "deleted").slice(0, 8).map((c) => `<div class="change"><b>${esc(FIELD_NAMES[c.f] || c.f)}</b>: ${esc(fmtChangeValue(c.f, c.from))} → ${esc(fmtChangeValue(c.f, c.to))}</div>`).join("");
  return `<div class="item" style="cursor:default"><div class="body"><div><b>${esc(a.byName || a.by)}</b> ${esc(a.action)} ${esc(what)} <b>${esc(a.label || "")}</b></div>${ch}</div><div class="right" title="${esc(new Date(a.ts).toLocaleString())}">${esc(new Date(a.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</div></div>`;
}
export function historyModal(docId, title) {
  const list = S.activity.filter((a) => a.docId === docId);
  modal(`<div class="mh"><h2>History – ${esc(title || "")}</h2><button class="x" data-close>×</button></div>
    <div class="card flat"><div class="list">${list.map(activityHTML).join("") || '<div class="empty">No history yet.</div>'}</div></div>`, { wide: true });
}

// ─────────── Calendar view ───────────
let calMonth = null, calSel = null, calFilter = new Set(TYPE_ORDER);
export function renderCalendar(root) {
  if (!calMonth) { const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  const first = new Date(calMonth);
  const startGrid = addDays(first.getTime(), -((first.getDay() + 6) % 7));
  const evs = events().filter((e) => calFilter.has(e.type || "unsorted"));
  const today = startOfDay(Date.now());
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const day = startOfDay(addDays(startGrid, i)), next = addDays(day, 1);
    const de = evs.filter((e) => e.start < next && e.end > day).sort((a, b) => a.start - b.start);
    const out = new Date(day).getMonth() !== first.getMonth();
    if (i >= 35 && out && i % 7 === 0) break;
    cells += `<div class="day ${out ? "out" : ""} ${day === today ? "today" : ""} ${day === calSel ? "sel" : ""}" data-day="${day}">
      <span class="n">${new Date(day).getDate()}</span>
      ${de.slice(0, 3).map((e) => `<span class="ev t-${esc(e.type || "unsorted")}" data-evc="${esc(e.id)}">${e.allDay ? "" : esc(fmtTime(e.start)) + " "}${esc(e.title)}</span>`).join("")}
      ${de.length > 3 ? `<span class="more">+${de.length - 3} more</span>` : ""}
      <div class="dots">${de.slice(0, 6).map((e) => `<i class="t-${esc(e.type || "unsorted")}"></i>`).join("")}</div></div>`;
  }
  const sel = calSel ?? (startOfDay(Date.now()) >= calMonth && startOfDay(Date.now()) < addDays(calMonth, 31) ? today : null);
  const selEvents = sel ? evs.filter((e) => e.start < addDays(sel, 1) && e.end > sel).sort((a, b) => a.start - b.start) : [];
  root.innerHTML = `<div class="topbar"><h1>Calendar</h1>
      <div class="btns"><button class="btn" data-prev>‹</button><button class="btn" data-today>Today</button><button class="btn" data-next>›</button></div></div>
    <div class="btns" style="margin-bottom:10px"><h2 style="margin:0;flex:1">${esc(first.toLocaleDateString("en-GB", { month: "long", year: "numeric" }))}</h2>
      <div class="chips">${TYPE_ORDER.map((t) => `<span class="chip ${calFilter.has(t) ? "on" : ""} t-${t}" data-f="${t}"><span class="tdot"></span>${TYPES[t].label}</span>`).join("")}</div></div>
    <div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells}</div>
    ${sel ? `<div class="card flat" style="margin-top:14px"><div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1">${esc(fmtDate(sel))}</h2>
      <button class="btn sm" data-add="shoot">+ Shoot</button><button class="btn sm" data-add="recording">+ Recording</button><button class="btn sm" data-add="management">+ Mgmt</button><button class="btn sm" data-add="meeting">+ Meeting</button></div>
      <div class="list">${selEvents.map((e) => eventRow(e, { showDate: false })).join("") || '<div class="empty">Nothing planned.</div>'}</div></div>` : ""}`;
  $("[data-prev]", root).onclick = () => { const d = new Date(calMonth); calMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); calSel = null; renderCalendar(root); };
  $("[data-next]", root).onclick = () => { const d = new Date(calMonth); calMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); calSel = null; renderCalendar(root); };
  $("[data-today]", root).onclick = () => { calMonth = null; calSel = startOfDay(Date.now()); renderCalendar(root); };
  $$("[data-f]", root).forEach((c) => c.onclick = () => { calFilter.has(c.dataset.f) ? calFilter.delete(c.dataset.f) : calFilter.add(c.dataset.f); renderCalendar(root); });
  $$("[data-day]", root).forEach((c) => c.onclick = (ev) => {
    const evc = ev.target.closest("[data-evc]");
    if (evc && window.innerWidth > 700) return openEventEditor(evc.dataset.evc);
    calSel = Number(c.dataset.day); renderCalendar(root);
    if (window.innerWidth <= 700) root.querySelector(".card.flat")?.scrollIntoView({ behavior: "smooth" });
  });
  $$("[data-add]", root).forEach((b) => b.onclick = () => openEventEditor(null, { type: b.dataset.add, start: sel + 12 * 36e5 }));
  bindEventRows(root);
}

// ─────────── Production / Audio lists ───────────
const listTab = {};
export function renderTypeList(root, type, title) {
  const tab = listTab[type] || "upcoming";
  const now = Date.now();
  let list = events().filter((e) => e.type === type);
  if (tab === "upcoming") list = list.filter((e) => e.end >= now && e.status !== "cancelled").sort((a, b) => a.start - b.start);
  else if (tab === "past") list = list.filter((e) => e.end < now).sort((a, b) => b.start - a.start);
  else list = list.sort((a, b) => b.start - a.start);
  const all = events().filter((e) => e.type === type && e.status !== "cancelled");
  const upcomingHours = all.filter((e) => e.end >= now).reduce((s, e) => s + (e.allDay ? 0 : hoursOf(e)), 0);
  const owed = all.reduce((s, e) => s + owedOf(e), 0);
  root.innerHTML = `<div class="topbar"><h1>${esc(title)}</h1><button class="btn primary" data-new>+ New ${esc(TYPES[type].label.toLowerCase())}</button></div>
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><div class="v">${all.filter((e) => e.end >= now).length}</div><div class="k">Upcoming</div></div>
      <div class="stat"><div class="v">${upcomingHours}</div><div class="k">Hours booked ahead</div></div>
      <div class="stat"><div class="v">${all.filter((e) => e.end < now).length}</div><div class="k">Completed</div></div>
      ${type === "meeting" ? "" : `<div class="stat"><div class="v ${owed ? "money-pos" : ""}">${esc(money(owed))}</div><div class="k">Unpaid balance</div></div>`}</div>
    <div class="tabs">${["upcoming", "past", "all"].map((t) => `<button data-tab="${t}" class="${tab === t ? "on" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
    <div class="card flat"><div class="list">${list.map((e) => eventRow(e)).join("") || '<div class="empty">Nothing here yet.</div>'}</div></div>`;
  $("[data-new]", root).onclick = () => openEventEditor(null, { type });
  $$("[data-tab]", root).forEach((b) => b.onclick = () => { listTab[type] = b.dataset.tab; renderTypeList(root, type, title); });
  bindEventRows(root);
}
