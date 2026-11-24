import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, db, doc, getDoc } from "./firebase.js?v=5";
import { S, startSync, stopSync, onChange } from "./store.js?v=5";
import { renderCalendar, renderTypeList, openEventEditor } from "./events.js?v=5";
import { renderArtists, renderArtist, renderManagement, renderTeam, renderAccount, openArtistEditor, openContractEditor } from "./people.js?v=5";
import { renderLinks } from "./links.js?v=5";
import { renderHome, renderDocs, renderEquipment, renderLocations, renderActivity, maybeSundayPopup, openDocUpload, openEquipEditor } from "./misc.js?v=5";
import { renderHelp } from "./help.js?v=5";
import { esc, $, $$, modal, toast } from "./util.js?v=5";

const app = document.getElementById("app");
const NAV = [
  ["home", "🏠", "Home"], ["calendar", "📅", "Calendar"], ["production", "🎬", "Production"], ["audio", "🎙️", "Audio"], ["management", "📋", "Management"], ["meetings", "🤝", "Team meetings"],
  ["artists", "🎤", "Artists"], ["docs", "📄", "Documents"], ["equipment", "🎥", "Equipment"], ["locations", "📍", "Locations"], ["links", "🔗", "Links"], "-",
  ["activity", "🕘", "Activity"], ["team", "👥", "Team"], ["help", "❓", "Help"], ["account", "⚙️", "My account"],
];

function loginView(msg = "") {
  app.innerHTML = `<div class="login"><div class="brand center" style="font-size:2rem">BTS<span>.</span></div>
    <div class="card"><h2>Sign in</h2><p class="muted" style="font-size:.88rem">Team members only.</p>
      ${msg ? `<div class="alert bad">${esc(msg)}</div>` : ""}
      <form data-f><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label>Password</label><input name="pw" type="password" autocomplete="current-password" required></div>
      <button class="btn primary" style="width:100%">Sign in</button></form>
      <p class="center" style="margin-top:12px"><a href="#" data-forgot>Forgot password?</a></p></div></div>`;
  $("[data-f]").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "Signing in…";
    try { await signInWithEmailAndPassword(auth, e.target.email.value.trim(), e.target.pw.value); }
    catch (er) { loginView(er.code === "auth/invalid-credential" || er.code === "auth/wrong-password" || er.code === "auth/user-not-found" ? "Wrong email or password." : er.code === "auth/too-many-requests" ? "Too many attempts – try again in a few minutes." : er.message); }
  };
  $("[data-forgot]").onclick = async (e) => {
    e.preventDefault();
    const email = $("[name=email]").value.trim();
    if (!email) return toast("Type your email first", true);
    try { await sendPasswordResetEmail(auth, email); } catch (_) {}
    toast("If that email has an account, a reset link is on its way (check spam).");
  };
}

function shell() {
  const isAdmin = S.me?.role === "admin";
  const items = NAV.filter((n) => n === "-" || n[0] !== "team" || true);
  app.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand">BTS<span>.</span></div><nav class="nav">${items.map((n) => n === "-" ? '<div class="sep"></div>' : `<a href="#/${n[0]}" data-nav="${n[0]}"><span class="ico">${n[1]}</span>${n[2]}</a>`).join("")}</nav>
      <div class="dim" style="font-size:.8rem;padding:14px 12px">${esc(S.me.name)}${isAdmin ? " · admin" : ""}</div></aside>
    <main class="main" id="view"></main>
    <nav class="bottom"><a href="#/home" data-nav="home"><span class="ico">🏠</span>Home</a><a href="#/calendar" data-nav="calendar"><span class="ico">📅</span>Calendar</a>
      <a href="#" class="plus" data-plus><span class="ico">＋</span></a><a href="#/artists" data-nav="artists"><span class="ico">🎤</span>Artists</a><a href="#" data-more><span class="ico">☰</span>More</a></nav></div>`;
  $("[data-plus]").onclick = (e) => { e.preventDefault(); plusMenu(); };
  $("[data-more]").onclick = (e) => {
    e.preventDefault();
    const m = modal(`<div class="mh"><h2>Menu</h2><button class="x" data-close>×</button></div><div class="drawer">${NAV.filter((n) => n !== "-").map((n) => `<a href="#/${n[0]}">${n[1]} ${n[2]}</a>`).join("")}</div>`);
    $$("a", m.el).forEach((a) => a.addEventListener("click", () => m.close()));
  };
}
function plusMenu() {
  const opts = [["🎬", "Shoot", () => openEventEditor(null, { type: "shoot" })], ["🎙️", "Recording session", () => openEventEditor(null, { type: "recording" })],
    ["📋", "Drop / gig / artist meeting", () => openEventEditor(null, { type: "management" })], ["🤝", "Team meeting", () => openEventEditor(null, { type: "meeting" })], ["🎤", "Artist", () => openArtistEditor()], ["📝", "Contract", () => openContractEditor()],
    ["🎥", "Equipment item", () => openEquipEditor()], ["📄", "Upload document", () => openDocUpload()]];
  const m = modal(`<div class="mh"><h2>Add new</h2><button class="x" data-close>×</button></div><div class="drawer">${opts.map((o, i) => `<a href="#" data-i="${i}">${o[0]} ${o[1]}</a>`).join("")}</div>`);
  $$("[data-i]", m.el).forEach((a) => a.onclick = (e) => { e.preventDefault(); m.close(); opts[a.dataset.i][2](); });
}

let lastRoute = "";
function render() {
  const view = document.getElementById("view");
  if (!view) return;
  const [, page = "home", arg] = (location.hash || "#/home").split("/");
  const route = page + "/" + (arg || "");
  const keepScroll = route === lastRoute;
  const y = window.scrollY;
  $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === page || (page === "artist" && a.dataset.nav === "artists")));
  try {
    switch (page) {
      case "calendar": renderCalendar(view); break;
      case "production": renderTypeList(view, "shoot", "Production · Shoots"); break;
      case "audio": renderTypeList(view, "recording", "Audio · Recording sessions"); break;
      case "management": renderManagement(view); break;
      case "meetings": renderTypeList(view, "meeting", "Team meetings"); break;
      case "artists": renderArtists(view); break;
      case "artist": renderArtist(view, arg); break;
      case "docs": renderDocs(view); break;
      case "equipment": renderEquipment(view); break;
      case "locations": renderLocations(view); break;
      case "links": renderLinks(view); break;
      case "activity": renderActivity(view); break;
      case "team": renderTeam(view); break;
      case "help": renderHelp(view); break;
      case "account": renderAccount(view); break;
      default: renderHome(view);
    }
  } catch (e) { console.error(e); view.innerHTML = `<div class="alert bad">Something went wrong: ${esc(e.message)}</div>`; }
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastRoute = route;
}
window.addEventListener("hashchange", render);
let unsubRender = null;
onChange(() => {
  // don't re-render under an open text field in the page (keeps typing smooth)
  const a = document.activeElement;
  if (a && document.getElementById("view")?.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
  render();
});

onAuthStateChanged(auth, async (user) => {
  stopSync();
  if (!user) { S.user = null; S.me = null; loginView(); return; }
  app.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const snap = await getDoc(doc(db, "members", user.email.toLowerCase()));
    if (!snap.exists() || snap.data().active === false) throw new Error("no-access");
    S.user = user; S.me = { id: snap.id, ...snap.data() };
  } catch (e) {
    await signOut(auth);
    loginView("This account doesn't have access. Ask the admin to add you in Team.");
    return;
  }
  shell();
  startSync(() => { render(); maybeSundayPopup(); });
});
