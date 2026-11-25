import { S, byId, events, save, remove, memberName, artistName, setRaw } from "./store.js?v=12";
import { arrayUnion } from "./firebase.js?v=12";
import { historyModal } from "./events.js?v=12";
import { esc, $, $$, modal, toast, confirmBox, opt, val, fmtDay, fmtDateShort, todayISO, daysUntil, ago, TYPES, linkify } from "./util.js?v=12";

const saveErr = (e) => {
  console.error(e);
  toast(e && e.code === "permission-denied"
    ? "Couldn't save: the database rules haven't been updated yet. The admin needs to publish the new rule in Firebase (see the instructions in chat)."
    : "Couldn't save: " + (e && e.message || e), true);
};
async function safe(fn) { try { return await fn(); } catch (e) { saveErr(e); } }

export const STAGES = { todo: "To do", doing: "In progress", done: "Done" };
const STAGE_ICON = { todo: "⬜", doing: "🔄", done: "✅" };

export const commentsOf = (id) => S.taskComments.filter((c) => c.taskId === id).sort((a, b) => a.ts - b.ts);
/** Comments that tag me and I haven't opened yet. */
export const unreadMentions = () => S.me ? S.taskComments.filter((c) => (c.mentions || []).includes(S.me.id) && !(c.seenBy || []).includes(S.me.id) && byId("tasks", c.taskId)) : [];
export const myOpenTasks = () => S.tasks.filter((t) => t.assignee === S.me?.id && t.status !== "done");
export const openUnassigned = () => S.tasks.filter((t) => !t.assignee && t.status !== "done");

function relatedLabel(t) {
  if (t.relatedType === "admin") return "🗂️ Admin";
  if (t.relatedType === "artist" && t.artistId) return "🎤 " + (artistName(t.artistId) || "(removed artist)");
  if (t.relatedType === "event" && t.eventId) { const e = byId("events", t.eventId); return e ? `${TYPES[e.type]?.icon || ""} ${e.title} · ${fmtDateShort(e.start)}` : "(removed booking)"; }
  return "";
}
function dueBadge(t) {
  if (!t.due || t.status === "done") return "";
  const n = daysUntil(t.due);
  return n < 0 ? `<span class="badge bad">Overdue · ${esc(fmtDay(t.due))}</span>` : n <= 2 ? `<span class="badge warn">Due ${n === 0 ? "today" : n === 1 ? "tomorrow" : esc(fmtDay(t.due))}</span>` : `<span class="badge">Due ${esc(fmtDay(t.due))}</span>`;
}
export function taskCard(t, { compact = false } = {}) {
  const n = commentsOf(t.id).length;
  const who = t.assignee ? `👤 ${esc(memberName(t.assignee))}` : `<span class="badge acc">Open – anyone can take it</span>`;
  return `<div class="item" data-task="${esc(t.id)}" style="${t.status === "done" ? "opacity:.65" : ""}">
    <input type="checkbox" data-tick="${esc(t.id)}" ${t.status === "done" ? "checked" : ""} title="Tick off" style="margin-top:3px;width:18px;height:18px">
    <div class="body"><div class="t" style="${t.status === "done" ? "text-decoration:line-through" : ""}">${t.priority === "high" ? "🔥 " : ""}${esc(t.title)}</div>
      <div class="meta"><span>${who}</span>${relatedLabel(t) ? `<span>${esc(relatedLabel(t))}</span>` : ""}${dueBadge(t)}${n ? `<span>💬 ${n}</span>` : ""}${compact ? `<span>${STAGE_ICON[t.status || "todo"]} ${STAGES[t.status || "todo"]}</span>` : ""}</div>
      ${!t.assignee && t.status !== "done" ? `<div style="margin-top:6px"><button class="btn sm" data-take="${esc(t.id)}">✋ I'll take it</button></div>` : ""}</div></div>`;
}
export function bindTaskCards(root) {
  $$("[data-tick]", root).forEach((c) => { c.onclick = (e) => e.stopPropagation(); c.onchange = () => setStage(c.dataset.tick, c.checked ? "done" : "todo"); });
  $$("[data-take]", root).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); const t = byId("tasks", b.dataset.take); if (!(await safe(() => save("tasks", t.id, { assignee: S.me.id, status: t.status === "todo" ? "doing" : t.status }, t.title)))) return; toast("It's yours – moved to In progress"); });
  $$("[data-task]", root).forEach((r) => r.onclick = () => openTaskEditor(r.dataset.task));
}
async function setStage(id, status) {
  const t = byId("tasks", id);
  const d = { status };
  if (status === "done") { d.doneAt = Date.now(); d.doneBy = S.me.id; } else { d.doneAt = 0; d.doneBy = ""; }
  if (!(await safe(() => save("tasks", id, d, t.title)))) return;
  toast(status === "done" ? "Ticked off ✅" : "Moved to " + STAGES[status]);
}

// ─────────── Page (board) ───────────
let who = "all", relF = "", mobileStage = "todo";
export function renderTasks(root) {
  let list = [...S.tasks];
  if (who === "mine") list = list.filter((t) => t.assignee === S.me.id);
  if (who === "open") list = list.filter((t) => !t.assignee);
  if (relF) list = list.filter((t) => (relF === "none" ? !t.relatedType : t.relatedType === relF));
  const sort = (a, b) => (b.priority === "high") - (a.priority === "high") || (a.due || "9999").localeCompare(b.due || "9999") || a.createdAt - b.createdAt;
  const col = (s) => list.filter((t) => (t.status || "todo") === s).sort(s === "done" ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : sort);
  const ment = unreadMentions();
  root.innerHTML = `<div class="topbar"><h1>Tasks</h1><button class="btn primary" data-new>+ New task</button></div>
    ${ment.length ? `<div class="alert info">💬 You were tagged in ${ment.length} comment${ment.length > 1 ? "s" : ""}: ${[...new Set(ment.map((c) => c.taskId))].map((id) => `<a href="#" data-open="${esc(id)}">${esc(byId("tasks", id)?.title || "")}</a>`).join(", ")}</div>` : ""}
    <div class="row" style="align-items:center;margin-bottom:12px"><div class="tabs" style="margin:0;flex:0 0 auto">${[["all", "Everyone"], ["mine", "My tasks"], ["open", "Open – unassigned"]].map(([k, l]) => `<button data-who="${k}" class="${who === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <select data-rel style="max-width:220px">${opt("", "Related to anything", relF)}${opt("artist", "🎤 Artist tasks", relF)}${opt("event", "🎬 Shoot / session tasks", relF)}${opt("admin", "🗂️ Admin tasks", relF)}${opt("none", "General tasks", relF)}</select></div>
    <div class="tabs board-tabs">${Object.entries(STAGES).map(([k, l]) => `<button data-ms="${k}" class="${mobileStage === k ? "on" : ""}">${STAGE_ICON[k]} ${l} (${col(k).length})</button>`).join("")}</div>
    <div class="board">${Object.entries(STAGES).map(([k, l]) => `<div class="board-col ${mobileStage === k ? "on" : ""}" data-col="${k}">
      <div class="board-h">${STAGE_ICON[k]} ${l} <span class="dim">${col(k).length}</span></div>
      <div class="card flat" style="margin:0"><div class="list">${col(k).slice(0, k === "done" ? 30 : 500).map((t) => taskCard(t)).join("") || '<div class="empty">Nothing here.</div>'}</div></div>
      ${k !== "done" ? `<button class="btn sm ghost" data-newin="${k}" style="margin-top:6px">+ Add task</button>` : ""}</div>`).join("")}</div>`;
  $("[data-new]", root).onclick = () => openTaskEditor();
  $$("[data-newin]", root).forEach((b) => b.onclick = () => openTaskEditor(null, { status: b.dataset.newin }));
  $$("[data-who]", root).forEach((b) => b.onclick = () => { who = b.dataset.who; renderTasks(root); });
  $$("[data-ms]", root).forEach((b) => b.onclick = () => { mobileStage = b.dataset.ms; renderTasks(root); });
  $("[data-rel]", root).onchange = (e) => { relF = e.target.value; renderTasks(root); };
  $$("[data-open]", root).forEach((a) => a.onclick = (e) => { e.preventDefault(); openTaskEditor(a.dataset.open); });
  bindTaskCards(root);
}

// ─────────── Editor + comments ───────────
const mentionRe = () => S.members.filter((m) => m.active !== false).map((m) => ({ id: m.id, name: m.name }));
function renderCommentText(text) {
  let h = linkify(text);
  for (const m of mentionRe()) h = h.split(esc("@" + m.name)).join(`<b style="color:var(--acc)">@${esc(m.name)}</b>`);
  return h.replace(/\n/g, "<br>");
}
export function openTaskEditor(id, preset = {}) {
  const t0 = id ? byId("tasks", id) : { status: "todo", assignee: "", relatedType: "", priority: "normal", ...preset };
  const st = { ...t0 };
  const arts = [...S.artists].sort((a, b) => a.name.localeCompare(b.name));
  const evs = events().filter((e) => e.type !== "unsorted").sort((a, b) => b.start - a.start).slice(0, 150);
  const m = modal(`<div class="mh"><h2>${id ? "Task" : "New task"}</h2><button class="x" data-close>×</button></div>
    <div class="field"><label>Task</label><input name="title" value="${esc(st.title || "")}" placeholder="e.g. Book the studio for Valentino's vocals"></div>
    <div class="field"><label>Details (optional)</label><textarea name="description" placeholder="What exactly needs doing, links, info…">${esc(st.description || "")}</textarea></div>
    <div class="field"><label>Stage</label><div class="tabs" data-stages style="margin:0">${Object.entries(STAGES).map(([k, l]) => `<button type="button" data-s="${k}">${STAGE_ICON[k]} ${l}</button>`).join("")}</div></div>
    <div class="row"><div class="field"><label>Assigned to (who does it)</label><select name="assignee">${opt("", "Nobody yet – anyone with time can take it", st.assignee)}${S.members.filter((x) => x.active !== false || x.id === st.assignee).map((x) => opt(x.id, x.name + (x.id === S.me.id ? " (me)" : ""), st.assignee)).join("")}</select></div>
      <div class="field" style="flex:0 1 160px"><label>Due date (optional)</label><input type="date" name="due" value="${esc(st.due || "")}"></div>
      <div class="field" style="flex:0 1 140px"><label>Priority</label><select name="priority">${opt("normal", "Normal", st.priority)}${opt("high", "🔥 High", st.priority)}</select></div></div>
    <div class="field"><label>Related to (what it's about – separate from who does it)</label><select name="relatedType">${opt("", "Nothing specific", st.relatedType)}${opt("admin", "🗂️ Admin (company paperwork, accounts, finances…)", st.relatedType)}${opt("artist", "🎤 An artist", st.relatedType)}${opt("event", "🎬 A shoot / session / meeting", st.relatedType)}</select></div>
    <div class="field" data-artf><select name="artistId">${opt("", "— choose artist —", st.artistId)}${arts.map((a) => opt(a.id, a.name + (a.managed ? " ★" : ""), st.artistId)).join("")}</select></div>
    <div class="field" data-evf><select name="eventId">${opt("", "— choose shoot / session —", st.eventId)}${evs.map((e) => opt(e.id, `${fmtDateShort(e.start)} · ${TYPES[e.type]?.icon || ""} ${e.title}`, st.eventId)).join("")}</select></div>
    ${id ? `<div class="section"><h3>💬 Comments</h3><div data-comments></div>
      <div class="field" style="margin-top:8px"><textarea name="comment" placeholder="Write a comment… tag someone with the buttons below"></textarea></div>
      <div class="btns"><span class="dim" style="font-size:.82rem">Tag:</span>${mentionRe().filter((x) => x.id !== S.me.id).map((x) => `<button type="button" class="btn sm ghost" data-tag="${esc(x.name)}">@${esc(x.name)}</button>`).join("")}<span class="spacer"></span><button type="button" class="btn sm primary" data-post>Post comment</button></div></div>` : ""}
    <p class="dim" style="font-size:.8rem;margin-top:10px">${id ? `Created by ${esc(memberName(t0.createdBy))} ${esc(ago(t0.createdAt))}${t0.status === "done" && t0.doneBy ? ` · done by ${esc(memberName(t0.doneBy))}` : ""}` : ""}</p>
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><button class="btn" data-hist>History</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>${id ? "Save" : "Create task"}</button></div>`, { wide: true, onClose: () => unsub && unsub() });
  const el = m.el;
  let unsub = null;
  const drawStage = () => $$("[data-s]", el).forEach((b) => b.classList.toggle("on", b.dataset.s === (st.status || "todo")));
  const drawRel = () => { const r = val(el, "relatedType"); $("[data-artf]", el).style.display = r === "artist" ? "" : "none"; $("[data-evf]", el).style.display = r === "event" ? "" : "none"; };
  $$("[data-s]", el).forEach((b) => b.onclick = () => { st.status = b.dataset.s; drawStage(); });
  $("[name=relatedType]", el).onchange = drawRel;
  drawStage(); drawRel();

  if (id) {
    const drawComments = () => {
      const cs = commentsOf(id);
      $("[data-comments]", el).innerHTML = cs.map((c) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="font-size:.82rem"><b>${esc(c.byName || memberName(c.by))}</b> <span class="dim">${esc(ago(c.ts))}</span>${c.by === S.me.id ? ` <a href="#" data-delc="${esc(c.id)}" class="dim" style="font-size:.78rem">delete</a>` : ""}</div>
        <div style="margin-top:2px">${renderCommentText(c.text)}</div></div>`).join("") || '<div class="dim">No comments yet.</div>';
      $$("[data-delc]", el).forEach((a) => a.onclick = async (e) => { e.preventDefault(); if (await confirmBox("Delete this comment?", "Delete")) await remove("taskComments", a.dataset.delc, "comment"); });
      // mark mentions of me as seen
      cs.filter((c) => (c.mentions || []).includes(S.me.id) && !(c.seenBy || []).includes(S.me.id)).forEach((c) => setRaw("taskComments", c.id, { seenBy: arrayUnion(S.me.id) }).catch(() => {}));
    };
    drawComments();
    import("./store.js?v=12").then((mod) => { unsub = mod.onChange(() => { if (document.body.contains(el)) drawComments(); }); });
    $$("[data-tag]", el).forEach((b) => b.onclick = () => { const ta = $("[name=comment]", el); ta.value = (ta.value && !ta.value.endsWith(" ") ? ta.value + " " : ta.value) + "@" + b.dataset.tag + " "; ta.focus(); });
    $("[data-post]", el).onclick = async () => {
      const text = $("[name=comment]", el).value.trim();
      if (!text) return;
      const mentions = mentionRe().filter((x) => text.includes("@" + x.name)).map((x) => x.id);
      const ok = await safe(() => save("taskComments", null, { taskId: id, text, by: S.me.id, byName: S.me.name, ts: Date.now(), mentions, seenBy: [S.me.id] }, `on “${t0.title}”`));
      if (!ok) return;
      $("[name=comment]", el).value = "";
      toast(mentions.length ? `Posted – ${mentions.map(memberName).join(", ")} will see it` : "Posted");
    };
    $("[data-del]", el).onclick = async () => {
      if (!(await confirmBox(`Delete task “${t0.title}” and its comments?`, "Delete"))) return;
      for (const c of commentsOf(id)) await remove("taskComments", c.id, "comment").catch(() => {});
      await remove("tasks", id, t0.title); m.close();
    };
    $("[data-hist]", el).onclick = () => historyModal(id, t0.title);
  }
  $("[data-save]", el).onclick = async () => {
    const title = val(el, "title");
    if (!title) return toast("Write what the task is", true);
    const rel = val(el, "relatedType");
    if (rel === "artist" && !val(el, "artistId")) return toast("Choose the artist", true);
    if (rel === "event" && !val(el, "eventId")) return toast("Choose the shoot / session", true);
    const ev = rel === "event" ? byId("events", val(el, "eventId")) : null;
    const d = { title, description: val(el, "description"), status: st.status || "todo", assignee: val(el, "assignee"), due: val(el, "due"), priority: val(el, "priority"),
      relatedType: rel, artistId: rel === "artist" ? val(el, "artistId") : ev?.artistId || "", eventId: rel === "event" ? val(el, "eventId") : "" };
    if (d.status === "done" && t0.status !== "done") { d.doneAt = Date.now(); d.doneBy = S.me.id; }
    if (d.status !== "done") { d.doneAt = 0; d.doneBy = ""; }
    const btn = $("[data-save]", el); btn.disabled = true; btn.textContent = "Saving…";
    const nid = await safe(() => save("tasks", id, d, title));
    if (!nid) { btn.disabled = false; btn.textContent = id ? "Save" : "Create task"; return; }
    toast(id ? "Saved" : d.assignee && d.assignee !== S.me.id ? `Task created and assigned to ${memberName(d.assignee)}` : "Task created");
    m.close();
  };
}

/** Small block for artist profiles / bookings. */
export function relatedTasksHTML(filter) {
  const list = S.tasks.filter(filter).sort((a, b) => (a.status === "done") - (b.status === "done") || (a.due || "9999").localeCompare(b.due || "9999"));
  return list.map((t) => taskCard(t, { compact: true })).join("") || '<div class="empty">No tasks.</div>';
}
