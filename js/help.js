import { showWelcome } from "./onboard.js?v=8";
export function renderHelp(root) {
  root.innerHTML = `<div class="topbar"><h1>Help</h1><button class="btn primary" data-tour>▶ Welcome tour & install steps</button></div>
  <div class="card help">
  <p>BTS is our private team tool. It keeps every shoot, recording session, artist, contract, document and piece of equipment in one place, and it stays in sync with our Google Calendar. Everything you change is saved instantly and appears on everyone's phone and computer within a second.</p>
  <ul class="toc">
    <li><a href="#h-start">1. Getting started</a></li><li><a href="#h-home">2. Home</a></li><li><a href="#h-cal">3. Calendar</a></li>
    <li><a href="#h-shoot">4. Logging a shoot</a></li><li><a href="#h-rec">5. Logging a recording session</a></li><li><a href="#h-clash">6. Double bookings</a></li>
    <li><a href="#h-mgmt">7. Management</a></li><li><a href="#h-meet">7b. Team meetings</a></li><li><a href="#h-art">8. Artists</a></li><li><a href="#h-contract">9. Contracts</a></li>
    <li><a href="#h-docs">10. Documents</a></li><li><a href="#h-eq">11. Equipment</a></li><li><a href="#h-loc">12. Locations</a></li>
    <li><a href="#h-links">12b. Links</a></li><li><a href="#h-google">13. Google Calendar sync & tags</a></li><li><a href="#h-sum">14. Sunday summary</a></li><li><a href="#h-call">15. Call sheet links</a></li>
    <li><a href="#h-money">16. Money</a></li><li><a href="#h-hist">17. History & activity log</a></li><li><a href="#h-acc">18. Accounts & passwords</a></li><li><a href="#h-tips">19. Tips & FAQ</a></li>
  </ul>

  <h2 id="h-start">1. Getting started</h2>
  <ol>
    <li>The admin adds you in <b>Team</b>. You get an email from Firebase (“Reset your password”). Check spam if you don't see it.</li>
    <li>Open the link and choose your own password.</li>
    <li>Go to the BTS site and sign in with your email and that password. There is no “sign up” – only people the admin adds can get in.</li>
    <li><b>On your phone:</b> open the site in Safari (iPhone) or Chrome (Android) → Share / menu → <b>Add to Home Screen</b>. It then opens like an app.</li>
  </ol>
  <p>Navigation: on a computer the menu is on the left. On a phone use the bar at the bottom – <b>＋</b> adds something new, <b>More</b> opens every other section.</p>

  <h2 id="h-home">2. Home</h2>
  <p>Your daily overview: double bookings that need fixing, items added in Google Calendar that still need sorting, contracts that expire soon, what's coming up, this week's plan, and finished work that hasn't been paid yet. On Sundays a pop-up shows the plan for the coming week the first time you open the tool that day.</p>

  <h2 id="h-cal">3. Calendar</h2>
  <ul>
    <li>Colours: <span class="t-shoot"><span class="tdot"></span></span> shoots, <span class="t-recording"><span class="tdot"></span></span> recordings, <span class="t-management"><span class="tdot"></span></span> management, <span class="t-meeting"><span class="tdot"></span></span> team meetings, <span class="t-unsorted"><span class="tdot"></span></span> unsorted (from Google with no tag).</li>
    <li>Tap a day to see its list and add something on that day. On a computer, click an item in the grid to open it.</li>
    <li>Use the coloured filter chips to show only some types.</li>
  </ul>

  <h2 id="h-shoot">4. Logging a shoot</h2>
  <ol>
    <li>Press <b>+ Shoot</b> (Home, Production, Calendar or ＋ on mobile).</li>
    <li><b>Kind</b> – music video, visualizer, social content…</li>
    <li><b>Artist</b> – pick from the list, or choose “+ New artist…” and type the name. The artist gets a profile automatically.</li>
    <li><b>Title</b> – optional. If empty it becomes “Artist – Kind”, e.g. “Valentino – Music video”.</li>
    <li><b>Date, start time and hours</b> – e.g. 22 Nov, 18:00, 4 hours.</li>
    <li><b>Location</b> – pick a saved location or “+ New location…”. <b>Travel time</b> is minutes each way. The tool blocks that time before and after the shoot for the people and gear on it.</li>
    <li><b>Team</b> – tap the people who will be there. Anyone marked <i>busy</i> is already booked at that time.</li>
    <li><b>Equipment</b> – tap every item you're bringing. Items marked <i>booked</i> are at another booking at the same time. Faded items are in repair, lent out or broken.</li>
    <li><b>Notes</b> – brief/shot list, internal notes, and call sheet notes (the only notes the artist can see).</li>
    <li><b>Money</b> – price and any payments received (see Money).</li>
    <li>Press <b>Save</b>. It appears in Google Calendar as “Shoot: …” within seconds.</li>
  </ol>

  <h2 id="h-rec">5. Logging a recording session</h2>
  <p>Same as a shoot – press <b>+ Recording</b>. Pick the artist, date, start time, hours, studio/location, who from the team is there and what gear is used (mics, interface, laptop…). Use “Songs / session plan” for the songs you're working on. In Google it shows as “Rec: …”.</p>

  <h2 id="h-clash">6. Double bookings</h2>
  <p>While you fill in a booking, the <b>Clashes</b> box checks it live against everything else (including travel time). It flags:</p>
  <ul><li>a team member already booked elsewhere at that time,</li><li>an equipment item already booked, or marked in repair/broken/lent out,</li><li>the same artist booked twice,</li><li>the same location used twice.</li></ul>
  <p><b>You can't save until every clash is solved.</b> The box gives one-tap fixes: <i>Swap to [free person]</i>, <i>Swap to [free item of the same type]</i>, <i>Remove</i>, <i>Move to [next free time]</i>, or open the other booking to change that one instead. Clashes caused by changes made directly in Google Calendar can't be blocked, so they appear on Home under “Double bookings” with a <b>Resolve</b> button.</p>

  <h2 id="h-mgmt">7. Management</h2>
  <ul>
    <li>Cards for every artist we manage, with their next booking and contract status.</li>
    <li><b>Drops, concerts & meetings</b> – press “+ Meeting / drop / gig”, choose the kind (Meeting, Release / drop, Concert / gig, Deadline, Promo) and the artist. Tick “All day” for release days. In Google these show as “Mgmt: …”.</li>
    <li><b>All contracts</b> – sorted by expiry date, with whether we want to renew.</li>
  </ul>

  <h2 id="h-meet">7b. Team meetings</h2>
  <p>For internal meetings of the team (not with artists – those go under Management).</p>
  <ol>
    <li>Press <b>+ Meeting</b> (Home, Calendar, Team meetings tab, or ＋ on mobile).</li>
    <li>Choose the kind (weekly sync, planning, brainstorm, money…), date, start time and length. Everyone on the team is pre-selected under <b>Who attends</b> – tap to remove people.</li>
    <li>Pick a location, or paste an <b>online meeting link</b> (Google Meet, Zoom…).</li>
    <li>Write the <b>Agenda – one point per line</b>. The tool shows the number of agenda points in the list, and the full agenda is in the Google Calendar event and the Sunday email.</li>
    <li><b>Documents to discuss</b>: attach any uploaded document with one tap, or <b>Upload a document</b> straight from the meeting. Everyone can open them from the meeting.</li>
    <li>During or after the meeting, write <b>Minutes & decisions</b> in the notes field so there's a record.</li>
  </ol>
  <p>In Google the title starts with <code>Meet:</code> – you can also create one in Google with that tag. Meetings use the same clash check, so nobody can be booked on a shoot during a team meeting.</p>

  <h2 id="h-art">8. Artists</h2>
  <p>One shared profile per artist, used in every tab. That covers artists we manage (★) and artists we've just worked with, so their details can be reused next time.</p>
  <ul>
    <li><b>Edit</b> to update contacts, socials, style of music, image &amp; style, what they want to do, and notes. Change it whenever their image or plans change – every edit is kept in “Profile changes”.</li>
    <li>Tick <b>We manage this artist</b> to make them managed (choose the start date). Untick when we stop managing them – the period is kept, so the profile shows if we managed them before.</li>
    <li>The profile shows automatically: working together since, number of projects (shoots + sessions), hours, whether we managed them, total billed and <b>how much they owe</b>, upcoming and past work, contracts and documents.</li>
  </ul>

  <h2 id="h-contract">9. Contracts</h2>
  <p>Management → “+ Contract”, or from the artist's profile. Fill in type, start and end date, <b>Do we want to renew?</b> (Undecided / Yes / No), value or percentage, notice period and key terms. Upload the signed file in Documents and link it on the contract. Contracts expiring within 60 days show on Home and in the Sunday summary.</p>

  <h2 id="h-docs">10. Documents</h2>
  <p>Documents → <b>+ Upload</b>. Choose the file (max 25 MB), a category (contract, invoice, release form…), and optionally the artist and the shoot/session it belongs to. Files are stored privately in the team's Google Drive (“BTS Documents” folder). Only signed-in team members can open them from the tool. Open / Download / Delete from the document.</p>

  <h2 id="h-eq">11. Equipment</h2>
  <ul>
    <li>Every item is logged <b>separately</b> with its own number (e.g. CAM-01, LGT-02), so two shoots at the same time can split the gear. Put a sticker with the number on the gear itself.</li>
    <li>“+ Add item” → category, number (suggested automatically), name, brand/model, serial, condition, status, owner. Use “Add <i>N</i> of these” for several identical items – each gets its own number.</li>
    <li><b>Status</b>: Available, In repair, Lent out, Retired. Anything not “Available” (or in “Broken” condition) can't be booked.</li>
    <li><b>Check availability</b> at the top shows what's free or booked for any date and time.</li>
    <li>Open an item to see every booking it's been on, and its history.</li>
  </ul>

  <h2 id="h-loc">12. Locations</h2>
  <p>Saved places (studio, client houses, outdoor spots) with address, usual travel time (pre-fills new bookings) and notes like parking and access. Addresses open in Google Maps.</p>

  <h2 id="h-links">12b. Links</h2>
  <p>The <b>Links</b> page collects all our websites and accounts (the NAOPAKI site, socials, streaming profiles, tools) so anyone can open them in one tap or copy the address. Everyone on the team can add, edit, reorder (with the Order number) or remove links.</p>

  <h2 id="h-google">13. Google Calendar sync & tags</h2>
  <ul>
    <li>Everything lives in <b>one shared Google calendar called BTS</b>, owned by the company account. Every team member gets edit access to it automatically when the admin adds them (Google sends an invite and it appears in your own Google Calendar app). <b>Your personal calendar is never synced</b> – only the BTS calendar is.</li>
    <li>In the BTS calendar, the tag at the start of the title says what it is:<br>
      <code>Shoot: Valentino – Music video</code> → Production · <code>Rec: Valentino</code> → Audio · <code>Mgmt: Label meeting</code> → Management · <code>Meet: Weekly sync</code> → Team meetings.</li>
    <li><b>From the tool → Google:</b> within a few seconds of saving. The Google event has the location, team, equipment and notes in its description.</li>
    <li><b>From Google → the tool:</b> within about 1 minute. Two ways:
      <ul><li>Add the event to the <b>BTS</b> calendar (choose “BTS” in the calendar dropdown when creating it – <i>not</i> your own calendar). Tagged events go to the right tab; untagged ones land in <b>Unsorted</b> on Home, where you choose the type with one tap.</li>
      <li>Only on the company account itself: a tagged event (e.g. <code>Shoot: Valentino</code>) added to the company's main calendar is moved into BTS automatically. Team members' personal calendars are never read.</li></ul></li>
    <li>Changing the time, title or location in Google updates the tool. Deleting it in Google deletes it here.</li>
    <li>Team, equipment, artist and money can only be set in the tool – open the item here to add them.</li>
  </ul>

  <h2 id="h-sum">14. Sunday summary</h2>
  <p>Every Sunday at 18:00 everyone on the team gets an email with next week's shoots, sessions and management items (day by day, with times, locations, team and gear), plus any clashes and contracts expiring soon. The same summary pops up in the tool the first time you open it on Sunday and is always on Home.</p>

  <h2 id="h-call">15. Call sheet links</h2>
  <p>Open a saved shoot or session → <b>Call sheet link</b> → Create link → Copy. Send it to the artist or freelancers. The page shows date, time, location (with map), artist, team, equipment and the <b>call sheet notes</b>. It never shows prices or internal notes. It updates every time you save the booking. Press <b>Stop sharing</b> to turn the link off.</p>

  <h2 id="h-money">16. Money</h2>
  <p>In each booking set the <b>Price</b> and add <b>payments</b> as they come in (amount, date, note). The balance shows straight away. Artist profiles total everything: billed, paid and owed. Unpaid finished work appears on Home, and Production/Audio show the unpaid balance. All amounts are in euro.</p>

  <h2 id="h-hist">17. History & activity log</h2>
  <p>Every change is recorded with who made it, when and what changed (old → new value). See it for one item with the <b>History</b> button, or for everything in <b>Activity</b> (filter by person or type).</p>

  <h2 id="h-acc">18. Accounts & passwords</h2>
  <ul>
    <li><b>My account</b>: change your display name and password, and sign out.</li>
    <li>Forgot your password? On the sign-in screen press “Forgot password?” and you'll get a reset email.</li>
    <li><b>Admin only (Team)</b>: add a member (name + email → they get the set-password email), make someone admin, deactivate an account (they can no longer sign in or see anything), resend the password email.</li>
    <li><b>Members</b> can add and edit everything in the tool (bookings, artists, contracts, documents, equipment, locations, links) but can't manage accounts. Nobody can change how the tool works from inside it – that's only possible through the company GitHub and Google accounts.</li>
  </ul>

  <h2 id="h-tips">19. Tips & FAQ</h2>
  <ul>
    <li><b>Do I need to press sync?</b> No. Saving is instant and syncs automatically.</li>
    <li><b>Offline?</b> Recently loaded data stays visible. Changes are sent when you're back online.</li>
    <li><b>Cancelled shoot?</b> Set Status → Cancelled to keep the record (it stops blocking people and gear), or Delete to remove it completely.</li>
    <li><b>Shoot finished?</b> Set Status → Done and log the payment.</li>
    <li><b>Fix a clash with someone else's booking:</b> use “Open other booking” in the Clashes box.</li>
  </ul>
  </div>`;
  root.querySelector('[data-tour]').onclick = () => showWelcome();
  root.querySelectorAll('.toc a').forEach((a) => a.onclick = (e) => { e.preventDefault(); root.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); });
}
