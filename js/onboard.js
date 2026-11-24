import { S } from "./store.js?v=10";
import { esc, $, $$, modal } from "./util.js?v=10";

const KEY = "bts-welcome-v1";
const NEWS_KEY = "bts-news-seen";
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener("appinstalled", () => { deferredPrompt = null; });

export const seenWelcome = () => { try { return !!localStorage.getItem(KEY); } catch (_) { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, String(Date.now())); localStorage.setItem(NEWS_KEY, WHATS_NEW.map((n) => n.id).join(",")); } catch (_) {} };
const seenNews = () => { try { return (localStorage.getItem(NEWS_KEY) || "").split(","); } catch (_) { return WHATS_NEW.map((n) => n.id); } };

/** Show any updates this device hasn't seen yet (people who did the tour before the update). */
export function maybeWhatsNew(onDone) {
  const seen = seenNews(), fresh = WHATS_NEW.filter((n) => !seen.includes(n.id));
  if (!fresh.length) return onDone && onDone();
  showWhatsNew(fresh, onDone);
}
export function showWhatsNew(list = WHATS_NEW, onDone) {
  const m = modal(`<div class="mh"><h2>✨ What's new in BTS</h2><button class="x" data-close>×</button></div>
    ${list.map((n) => `<div class="card"><div class="dim" style="font-size:.8rem">${esc(n.date)}</div><h2>${esc(n.title)}</h2>${n.body}</div>`).join("")}
    <p class="muted" style="font-size:.85rem">You can read this again any time in <b>Help → What's new</b>.</p>
    <div class="mf"><button class="btn primary" data-close>Got it</button></div>`, { wide: true, onClose: () => {
      try { localStorage.setItem(NEWS_KEY, [...new Set([...seenNews(), ...list.map((n) => n.id)])].join(",")); } catch (_) {}
      onDone && onDone();
    } });
}

function platform() {
  const ua = navigator.userAgent || "";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS/i.test(ua);
  return { standalone, ios, android, samsung, iosOther, mobile: ios || android };
}

function installSlide() {
  const p = platform();
  if (p.standalone) return `<div class="alert info">✓ You're already using the installed app. Nothing to do here.</div>`;
  const auto = deferredPrompt ? `<p><button class="btn primary" data-install>📲 Install BTS now</button></p><p class="muted">Or do it by hand:</p>` : "";
  let steps;
  if (p.ios) steps = `<ol>
      ${p.iosOther ? "<li>Best in <b>Safari</b>. In Chrome on iPhone it also works through the share button.</li>" : ""}
      <li>Tap the <b>Share</b> button <span class="code">⬆︎</span> (bottom of the screen in Safari, or next to the address bar).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Keep the name <b>BTS</b> and tap <b>Add</b>.</li>
      <li>Open BTS from the new icon on your home screen. It runs full screen like an app and remembers your login.</li></ol>`;
  else if (p.samsung) steps = `<ol><li>Tap the menu <span class="code">☰</span> at the bottom right.</li><li>Tap <b>Add page to</b> → <b>Home screen</b>.</li><li>Tap <b>Add</b>, then open BTS from the new icon.</li></ol>`;
  else if (p.android) steps = `<ol><li>In <b>Chrome</b>, tap the menu <span class="code">⋮</span> at the top right.</li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li><li>Tap <b>Install</b>, then open BTS from the new icon. It runs full screen like an app.</li></ol>`;
  else steps = `<ol><li>In <b>Chrome</b> or <b>Edge</b>, click the install icon <span class="code">⊕</span> at the right end of the address bar (or menu <span class="code">⋮</span> → <b>Install BTS</b> / <b>Apps → Install this site as an app</b>).</li>
      <li>BTS opens in its own window and gets an icon in your Start menu / Dock.</li>
      <li>On a phone, open <b>${esc(location.origin + location.pathname)}</b> and you'll get the phone instructions there.</li></ol>`;
  return `${auto}${steps}`;
}

const EXPENSES_HELP = `<p>Log every cost in <b>Expenses</b> (＋ → Expense, or <b>💶 Add expense</b> inside a shoot):</p><ul>
  <li><b>Type</b>: 🏢 company / subscription (software, rent…), 🎤 an <b>artist</b>, 🎬 a specific <b>shoot / session</b>, or other.</li>
  <li><b>How often</b>: one-off, or repeating every week / month / 3 months / year (with an optional end date).</li>
  <li><b>Paid?</b> Tick it for a one-off; for repeating costs tick each payment as it's made. <b>Mark paid</b> buttons are everywhere.</li></ul>
  <p>Every due date shows in the <b>Calendar</b> as 💶 for everyone, overdue and this week's payments appear on <b>Home</b>, and the page shows monthly and yearly running costs.</p>`;

export const GCAL_HELP = `
  <p>You can add shoots, sessions and meetings straight from <b>Google Calendar</b> (phone app or calendar.google.com). Follow these steps so they land in the right place:</p>
  <ol>
    <li><b>Accept the BTS calendar once.</b> When the admin adds you, Google emails you an invite to the shared <b>BTS</b> calendar. Accept it. “BTS” then shows in your calendar list next to your own calendar.</li>
    <li><b>Create the event in the BTS calendar, not your own.</b><br>
      📱 <i>Phone app:</i> tap <b>＋</b> → <b>Event</b>, then tap the calendar name under the title (it shows your email) and choose <b>BTS</b>.<br>
      💻 <i>Computer:</i> click a time → <b>More options</b>, and in the calendar drop-down next to your name choose <b>BTS</b>.</li>
    <li><b>Start the title with a tag and a colon</b>, then what it is:
      <table style="margin:6px 0"><tr><th>Type in the title</th><th>Goes to</th></tr>
        <tr><td><code>Shoot: Valentino – music video</code></td><td>🎬 Production</td></tr>
        <tr><td><code>Rec: Valentino – vocals</code></td><td>🎙️ Audio</td></tr>
        <tr><td><code>Mgmt: Valentino single release</code></td><td>📋 Management</td></tr>
        <tr><td><code>Meet: Weekly sync</code></td><td>🤝 Team meetings</td></tr></table>
      <span class="dim">Capitals don't matter, and <code>Video:</code>, <code>Recording:</code>, <code>Management:</code>, <code>Meeting:</code> or <code>[Shoot]</code> also work.</span></li>
    <li><b>Set the date, time and location</b> in Google's normal fields.</li>
    <li><b>Save.</b> It appears in the tool within about <b>1 minute</b>.</li>
    <li><b>Finish it in the tool:</b> open the item in BTS to add the artist, team, equipment, travel time and price. Google can't store those. Clashes are checked as soon as you do.</li>
  </ol>
  <p><b>Good to know</b></p>
  <ul>
    <li><b>No tag?</b> The event lands in <b>Unsorted</b> on Home, where anyone can pick the right type with one tap.</li>
    <li><b>Changes:</b> moving, renaming or changing the location in Google updates the tool. <b>Deleting</b> it in Google deletes it in the tool. To cancel but keep the record, add <code>(CANCELLED)</code> to the end of the title.</li>
    <li><b>Your personal calendar is never synced.</b> An event in your own calendar won't reach the tool, even with a tag.</li>
    <li>Everything made in the tool appears in the BTS calendar within seconds, with team, gear and notes in the description.</li>
    <li>Expenses, artists, contracts, equipment and documents can only be added in the tool.</li>
    <li><b>Not showing after 2 minutes?</b> Check that the event is in the <b>BTS</b> calendar and the tag has a colon (<code>Shoot:</code>, not <code>Shoot</code>).</li>
  </ul>`;

/* What's new: add an entry here with every update; people who already did the tour get a pop-up once. */
export const WHATS_NEW = [
  { id: "2026-11-gcal-guide", date: "Nov 2026", title: "📅 How to add things from Google Calendar", body: GCAL_HELP },
  { id: "2026-11-expenses", date: "Nov 2026", title: "💶 Expenses", body: EXPENSES_HELP },
];

const SLIDES = () => [
  { icon: "📲", title: "First: install BTS on this device", body: `<p>BTS works in any browser, but installed it opens like a normal app, full screen, straight from your home screen.</p>${installSlide()}` },
  { icon: "📅", title: "Adding things from Google Calendar", body: GCAL_HELP },
  { icon: "🏠", title: "Home", body: `<p>Your daily overview:</p><ul><li><b>Double bookings</b> to fix, with a Resolve button</li><li>Items added in Google Calendar that still need <b>sorting</b></li><li><b>Contracts</b> expiring soon, and <b>unpaid</b> finished work</li><li>What's <b>coming up</b> and the plan for this week (on Sundays, next week pops up automatically)</li></ul><p>Quick buttons at the top add a shoot, recording, management item or meeting.</p>` },
  { icon: "📅", title: "Calendar", body: `<p>Month view of everything, colour-coded: <span class="t-shoot"><span class="tdot"></span></span> shoots, <span class="t-recording"><span class="tdot"></span></span> recordings, <span class="t-management"><span class="tdot"></span></span> management, <span class="t-meeting"><span class="tdot"></span></span> team meetings.</p><p>Tap a day to see its list and add something on that day.</p><p>It's synced both ways with the shared <b>BTS</b> Google calendar, which you also get in your own Google Calendar app. Only that calendar is synced, never your personal one.</p>` },
  { icon: "🎬", title: "Production & 🎙️ Audio", body: `<p><b>Production</b> = video shoots, <b>Audio</b> = recording sessions. For each one, log:</p><ul><li>Artist, date, start time, hours</li><li>Location + <b>travel time</b></li><li>Who from the team is there</li><li>Exact <b>equipment</b> items (each item has its own number, e.g. CAM-01)</li><li>Brief / songs, notes, price and payments</li></ul><p>The tool <b>won't save a double booking</b> (person, gear, artist or location, travel included) and suggests one-tap fixes. Open a saved shoot and tap <b>Call sheet link</b> to send a read-only page to the artist.</p>` },
  { icon: "📋", title: "Management & 🎤 Artists", body: `<p><b>Artists</b>: one shared profile per artist, both managed ★ and ones we've just worked with: contacts, socials, style, image, goals, plus automatic history (since when, number of projects, money owed).</p><p><b>Management</b>: managed artists at a glance, every <b>contract</b> with its expiry date and whether we want to renew, and upcoming <b>drops, gigs and artist meetings</b>.</p>` },
  { icon: "🤝", title: "Team meetings", body: `<p>Internal meetings: pick the time and who attends, write the <b>agenda</b> (one point per line), attach <b>documents to discuss</b>, add an online link if needed, and write the <b>minutes</b> afterwards.</p>` },
  { icon: "💶", title: "Expenses", body: EXPENSES_HELP },
  { icon: "📄", title: "Documents, Equipment, Locations & Links", body: `<ul><li><b>Documents</b>: upload contracts, invoices, release forms… stored privately in the company Google Drive, linked to artists and shoots.</li><li><b>Equipment</b>: every item separately with number, condition and status, plus a quick <b>availability check</b> for any date.</li><li><b>Locations</b>: saved places with address, usual travel time and notes.</li><li><b>Links</b>: all our websites and accounts in one place.</li></ul>` },
  { icon: "✅", title: "Good to know", body: `<ul><li>Everything <b>saves instantly</b> and shows up on everyone's devices within a second. No sync button.</li><li>Every change is recorded in <b>Activity</b>: who changed what, and when.</li><li>Change your name or password in <b>My account</b>.</li><li>On a phone, <b>＋</b> at the bottom adds anything, and <b>☰ More</b> opens every section.</li><li>Full explanations are in <b>Help</b>, where you can also replay this tour.</li></ul>` },
];

/** Show the welcome tour. startAt=1 skips the install slide. */
export function showWelcome({ startAt = 0, onDone } = {}) {
  const slides = SLIDES();
  let i = startAt;
  const m = modal(`<div class="mh"><h2 data-t></h2><button class="x" data-skip title="Close">×</button></div>
    <div data-b style="min-height:250px;max-height:62vh;overflow:auto"></div>
    <div class="mf" style="align-items:center"><div class="dots" data-dots style="display:flex;gap:6px;margin-right:auto"></div>
      <button class="btn ghost" data-skip2>Skip tour</button><button class="btn" data-prev>Back</button><button class="btn primary" data-next>Next</button></div>`, { onClose: () => { markSeen(); onDone && onDone(); } });
  const el = m.el;
  const draw = () => {
    const s = slides[i];
    $("[data-t]", el).textContent = `${s.icon} ${s.title}`;
    $("[data-b]", el).innerHTML = (i === 0 ? `<p class="muted" style="margin-top:0">Welcome to BTS${S.me ? ", " + esc(S.me.name.split(" ")[0]) : ""}! This short tour shows how to install the tool and how each section works.</p>` : "") + s.body;
    $("[data-dots]", el).innerHTML = slides.map((_, k) => `<i style="width:8px;height:8px;border-radius:50%;background:${k === i ? "var(--acc)" : "var(--line2)"};display:inline-block"></i>`).join("");
    $("[data-prev]", el).style.visibility = i === 0 ? "hidden" : "visible";
    $("[data-next]", el).textContent = i === slides.length - 1 ? "Start using BTS" : "Next";
    const inst = $("[data-install]", el);
    inst && (inst.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; draw(); });
  };
  $("[data-next]", el).onclick = () => { if (i < slides.length - 1) { i++; draw(); } else m.close(); };
  $("[data-prev]", el).onclick = () => { if (i > 0) { i--; draw(); } };
  $$("[data-skip],[data-skip2]", el).forEach((b) => (b.onclick = () => m.close()));
  draw();
}
