import { S, byId, save, remove } from "./store.js?v=10";
import { esc, $, $$, modal, toast, confirmBox, opt, val } from "./util.js?v=10";

export const LINK_CATS = ["Our websites", "Social media", "Streaming & music", "Tools & accounts", "Other"];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return u; } };
const fixUrl = (u) => (u && !/^https?:\/\//i.test(u) ? "https://" + u : u);

export function renderLinks(root) {
  const isAdmin = true; // every team member can manage links
  const list = [...S.links].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title));
  const cats = [...LINK_CATS, ...new Set(list.map((l) => l.category).filter((c) => c && !LINK_CATS.includes(c)))].filter((c) => list.some((l) => (l.category || "Other") === c));
  root.innerHTML = `<div class="topbar"><h1>Links</h1>${isAdmin ? '<button class="btn primary" data-new>+ Add link</button>' : ""}</div>
    <p class="muted">All our websites and accounts in one place. Everyone on the team can add, edit or remove links.</p>
    ${cats.map((c) => `<h2 style="margin-top:16px">${esc(c)}</h2><div class="grid">${list.filter((l) => (l.category || "Other") === c).map((l) => `
      <div class="card" style="margin:0;display:flex;gap:12px;align-items:flex-start">
        <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(l.url))}&sz=64" alt="" width="32" height="32" style="border-radius:6px;flex:0 0 32px;background:var(--bg2)" loading="lazy" onerror="this.style.visibility='hidden'">
        <div style="flex:1;min-width:0">
          <a href="${esc(l.url)}" target="_blank" rel="noopener" style="font-weight:700;font-size:1.02rem">${esc(l.title)} ↗</a>
          <div class="dim" style="font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(host(l.url))}</div>
          ${l.notes ? `<div class="muted" style="font-size:.86rem;margin-top:4px" class="pre">${esc(l.notes)}</div>` : ""}
          <div class="btns" style="margin-top:8px"><button class="btn sm" data-copy="${esc(l.url)}">Copy link</button>${isAdmin ? `<button class="btn sm ghost" data-edit="${esc(l.id)}">Edit</button>` : ""}</div>
        </div></div>`).join("")}</div>`).join("") || `<div class="empty">No links yet.${isAdmin ? " Press “+ Add link” to add the first one." : ""}</div>`}`;
  $("[data-new]", root) && ($("[data-new]", root).onclick = () => openLinkEditor());
  $$("[data-edit]", root).forEach((b) => b.onclick = () => openLinkEditor(b.dataset.edit));
  $$("[data-copy]", root).forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast("Link copied"); });
}

function openLinkEditor(id) {
  const l = id ? byId("links", id) : { category: "Our websites" };
  const m = modal(`<div class="mh"><h2>${id ? "Edit link" : "Add link"}</h2><button class="x" data-close>×</button></div>
    <div class="field"><label>Name</label><input name="title" value="${esc(l.title || "")}" placeholder="e.g. NAOPAKI website"></div>
    <div class="field"><label>Web address</label><input name="url" value="${esc(l.url || "")}" placeholder="https://…" inputmode="url"></div>
    <div class="row"><div class="field"><label>Group</label><select name="category">${LINK_CATS.map((c) => opt(c, c, l.category)).join("")}</select></div>
      <div class="field" style="flex:0 1 120px"><label>Order (optional)</label><input type="number" name="order" value="${esc(l.order ?? "")}" placeholder="1, 2, 3…"></div></div>
    <div class="field"><label>Note (optional)</label><input name="notes" value="${esc(l.notes || "")}" placeholder="e.g. login is in the shared password manager"></div>
    <div class="mf">${id ? '<button class="btn danger" data-del>Delete</button><span class="spacer"></span>' : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`);
  $("[data-save]", m.el).onclick = async () => {
    const d = { title: val(m.el, "title"), url: fixUrl(val(m.el, "url")), category: val(m.el, "category"), notes: val(m.el, "notes") };
    const o = val(m.el, "order"); d.order = o === "" ? 999 : Number(o);
    if (!d.title || !d.url) return toast("Name and web address are needed", true);
    try { new URL(d.url); } catch (_) { return toast("That web address doesn't look right", true); }
    try { await save("links", id, d, d.title); toast("Saved"); m.close(); } catch (e) { toast(e.message, true); }
  };
  id && ($("[data-del]", m.el).onclick = async () => { if (await confirmBox(`Remove the link “${l.title}”?`, "Remove")) { await remove("links", id, l.title); m.close(); } });
}
