/**
 * BTS – Google side (runs under the team's Google account)
 *  • two-way sync between Firestore "events" and the "BTS" Google Calendar
 *  • Sunday 18:00 weekly summary email to all active team members
 *  • document storage in the "BTS Documents" Drive folder
 *
 * First install: paste this file + appsscript.json into a new Apps Script project,
 * fill CFG, run setup() once, then Deploy → Web app (Execute as: Me, Access: Anyone).
 * Switching to the company account = repeat the install under that account with the
 * new Firebase project's id/key. See README.md.
 */
const CFG = {
  PROJECT_ID: 'bts-tool',
  API_KEY: 'AIzaSyAWFRcaTMp3KpUujrjHfi7_t3ad7C7xnaw',
  ADMIN_EMAIL: 'naopakirecords@gmail.com',
  ADMIN_NAME: 'NAOPAKI Admin',
  APP_URL: 'https://naopakirecords.github.io/BTSTool/',
  CALENDAR_NAME: 'BTS',
  FOLDER_NAME: 'BTS Documents',
  TZ: 'Europe/Sofia',
};
const PROPS = PropertiesService.getScriptProperties();
const TAGS = { shoot: 'Shoot', recording: 'Rec', management: 'Mgmt', meeting: 'Meet' };
const COLORS = { shoot: '6', recording: '7', management: '3', meeting: '2' };

// ───────────────────────── Setup ─────────────────────────
function setup() {
  const cal = calendarId_();
  const folder = folder_();
  const email = CFG.ADMIN_EMAIL.toLowerCase();
  if (!getDoc_('members', email)) {
    const now = Date.now();
    patchDoc_('members', email, { name: CFG.ADMIN_NAME, email: email, role: 'admin', active: true, title: 'Admin', createdAt: now, updatedAt: now, updatedBy: 'setup', updatedByName: 'Setup' });
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).nearMinute(0).inTimezone(CFG.TZ).create();
  syncNow();
  Logger.log('Setup done. Calendar: %s  Folder: %s', cal, folder.getUrl());
}

// ───────────────────────── Web app ─────────────────────────
function doGet() { return json_({ ok: true, app: 'BTS' }); }
function doPost(e) {
  var req = {};
  try { req = JSON.parse(e.postData.contents); } catch (x) {}
  try {
    if (req.action === 'ping') { syncNow(); return json_({ ok: true }); }
    var user = verify_(req.idToken);
    switch (req.action) {
      case 'sync': syncNow(); return json_({ ok: true, message: 'Synced with Google Calendar' });
      case 'shareCalendar': shareCalendar_(); return json_({ ok: true });
      case 'upload': {
        var blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mime || 'application/octet-stream', req.name || 'file');
        var f = folder_().createFile(blob);
        f.setDescription('Uploaded to BTS by ' + user.email);
        return json_({ ok: true, id: f.getId() });
      }
      case 'download': {
        var file = ownFile_(req.id);
        var b = file.getBlob();
        return json_({ ok: true, mime: b.getContentType(), name: file.getName(), data: Utilities.base64Encode(b.getBytes()) });
      }
      case 'trash': ownFile_(req.id).setTrashed(true); return json_({ ok: true });
      case 'summaryTest': sendSummary_([user.email]); return json_({ ok: true });
    }
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function verify_(idToken) {
  if (!idToken) throw new Error('Not signed in');
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CFG.API_KEY, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
  var j = JSON.parse(r.getContentText() || '{}');
  if (!j.users || !j.users[0] || !j.users[0].email) throw new Error('Session expired – sign in again');
  var email = j.users[0].email.toLowerCase();
  var m = getDoc_('members', email);
  if (!m || m.active === false) throw new Error('No access');
  return { email: email, name: m.name };
}
function ownFile_(id) {
  var file = DriveApp.getFileById(id);
  var fid = folder_().getId(), it = file.getParents();
  while (it.hasNext()) if (it.next().getId() === fid) return file;
  throw new Error('File is not in the BTS folder');
}
function folder_() {
  var id = PROPS.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(CFG.FOLDER_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CFG.FOLDER_NAME);
  PROPS.setProperty('FOLDER_ID', f.getId());
  return f;
}
function calendarId_() {
  var id = PROPS.getProperty('CALENDAR_ID');
  if (id) return id;
  var cals = CalendarApp.getCalendarsByName(CFG.CALENDAR_NAME);
  var c = cals.length ? cals[0] : CalendarApp.createCalendar(CFG.CALENDAR_NAME, { color: CalendarApp.Color.BLUE, timeZone: CFG.TZ });
  PROPS.setProperty('CALENDAR_ID', c.getId());
  return c.getId();
}

// ───────────────────────── Sync ─────────────────────────
function syncNow() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    pushChanges_(); adoptFromPrimary_(); pullChanges_();
    var last = Number(PROPS.getProperty('LAST_SHARE') || 0);
    if (Date.now() - last > 10 * 60 * 1000) { shareCalendar_(); PROPS.setProperty('LAST_SHARE', String(Date.now())); }
  }
  finally { lock.releaseLock(); }
}

/**
 * Keeps the shared BTS calendar in step with the team list:
 * every active member gets edit access (Google emails them an invite and it appears
 * in their own Google Calendar as "BTS"); deactivated members lose access.
 * Only this one calendar is shared – nobody's personal calendar is ever read.
 */
function shareCalendar_() {
  var cal = calendarId_();
  var owner = Session.getEffectiveUser().getEmail().toLowerCase();
  var acl = (Calendar.Acl.list(cal).items || []), byEmail = {};
  acl.forEach(function (a) { if (a.scope && a.scope.type === 'user' && a.scope.value) byEmail[a.scope.value.toLowerCase()] = a; });
  listDocs_('members').forEach(function (m) {
    var email = String(m.id).toLowerCase(), has = byEmail[email];
    if (email === owner) return;
    if (m.active !== false) {
      if (!has || (has.role !== 'writer' && has.role !== 'owner')) {
        try {
          Calendar.Acl.insert({ role: 'writer', scope: { type: 'user', value: email } }, cal, { sendNotifications: true });
          patchDoc_('members', email, { calendarAccess: 'shared', calendarError: '' });
        } catch (e) { patchDoc_('members', email, { calendarAccess: 'error', calendarError: String(e && e.message || e).slice(0, 200) }); }
      } else if (m.calendarAccess !== 'shared') patchDoc_('members', email, { calendarAccess: 'shared', calendarError: '' });
    } else if (has && has.role !== 'owner') {
      try { Calendar.Acl.remove(cal, has.id); } catch (e) {}
      patchDoc_('members', email, { calendarAccess: 'removed', calendarError: '' });
    }
  });
}

/**
 * Company account only: events added to the COMPANY account's own (primary) calendar with a BTS tag in the title
 * ("Shoot:", "Rec:", "Mgmt:") are moved into the BTS calendar, so they show up in the tool.
 * Untagged personal events are never touched.
 */
function adoptFromPrimary_() {
  var bts = calendarId_();
  var token = PROPS.getProperty('PRIMARY_SYNC_TOKEN'), pageToken = null, items = [], nextSync = null;
  while (true) {
    var opt = { maxResults: 250, showDeleted: false, singleEvents: false };
    if (pageToken) opt.pageToken = pageToken;
    if (token) opt.syncToken = token; else opt.timeMin = new Date(Date.now() - 30 * 864e5).toISOString();
    var r;
    try { r = Calendar.Events.list('primary', opt); }
    catch (err) {
      if (token && /410|sync token|fullSyncRequired/i.test(String(err))) { PROPS.deleteProperty('PRIMARY_SYNC_TOKEN'); token = null; pageToken = null; items = []; continue; }
      throw err;
    }
    items = items.concat(r.items || []);
    pageToken = r.nextPageToken;
    if (!pageToken) { nextSync = r.nextSyncToken; break; }
  }
  items.forEach(function (g) {
    if (g.status === 'cancelled' || !parseTitle_(g.summary).type) return;
    if (g.organizer && g.organizer.self === false) return; // invitations from others stay put
    try { Calendar.Events.move('primary', g.id, bts); console.log('Moved into BTS: ' + g.summary); }
    catch (err) { console.error('move ' + g.id + ': ' + err); }
  });
  if (nextSync) PROPS.setProperty('PRIMARY_SYNC_TOKEN', nextSync);
}

/** Firestore → Google */
function pushChanges_() {
  var cursor = Number(PROPS.getProperty('PUSH_CURSOR') || 0);
  var docs = queryUpdatedAfter_('events', cursor);
  if (!docs.length) return;
  var L = lookups_();
  var max = cursor, failedMin = null;
  docs.forEach(function (e) {
    var u = Number(e.updatedAt || 0);
    if (Number(e.syncedAt || 0) >= u) { max = Math.max(max, u); return; }
    try { pushOne_(e, L); max = Math.max(max, u); }
    catch (err) { console.error('push ' + e.id + ': ' + err); if (failedMin === null || u < failedMin) failedMin = u; }
  });
  if (failedMin !== null) max = Math.min(max, failedMin - 1);
  PROPS.setProperty('PUSH_CURSOR', String(max));
}
function pushOne_(e, L) {
  var cal = calendarId_();
  if (e.deleted) {
    if (e.gcalId) { try { Calendar.Events.remove(cal, e.gcalId); } catch (x) {} }
    patchDoc_('events', e.id, { syncedAt: Number(e.updatedAt), gcalId: '' });
    return;
  }
  var res = resource_(e, L), out = null;
  if (e.gcalId) { try { out = Calendar.Events.patch(res, cal, e.gcalId); } catch (x) { out = null; } }
  if (!out) out = Calendar.Events.insert(res, cal);
  patchDoc_('events', e.id, { gcalId: out.id, gcalUpdated: out.updated, gcalLocation: res.location || '', syncedAt: Number(e.updatedAt) });
}
function resource_(e, L) {
  var tag = TAGS[e.type];
  var loc = e.locationId && L.locations[e.locationId];
  var location = loc ? [loc.name, loc.address].filter(String).join(', ') : (e.locationText || e.link || '');
  var lines = [];
  if (e.subtype) lines.push('Kind: ' + e.subtype);
  if (e.artistId && L.artists[e.artistId]) lines.push('Artist: ' + L.artists[e.artistId].name);
  if (e.travelMin) lines.push('Travel: ' + e.travelMin + ' min each way');
  if ((e.memberIds || []).length) lines.push('Team: ' + e.memberIds.map(function (m) { return L.members[m] ? L.members[m].name : m; }).join(', '));
  if ((e.equipmentIds || []).length) lines.push('Equipment: ' + e.equipmentIds.map(function (q) { var i = L.equipment[q]; return i ? (i.number ? i.number + ' ' : '') + i.name : '?'; }).join(', '));
  if (e.link) lines.push('Online: ' + e.link);
  if (e.type === 'meeting' && e.brief) lines.push('', 'Agenda:\n' + String(e.brief).split('\n').filter(String).map(function (x) { return '• ' + x.replace(/^\s*[-*•\d.)]+\s*/, ''); }).join('\n'));
  else if (e.brief) lines.push('', (e.type === 'recording' ? 'Songs / plan:\n' : 'Brief:\n') + e.brief);
  if ((e.docIds || []).length) lines.push('', 'Documents to discuss: ' + e.docIds.map(function (d) { return L.docs[d] ? L.docs[d].name : '?'; }).join(', '));
  if (e.notes) lines.push('', (e.type === 'meeting' ? 'Minutes:\n' : 'Notes:\n') + e.notes);
  lines.push('', 'Open in BTS: ' + CFG.APP_URL);
  var r = {
    summary: (tag ? tag + ': ' : '') + (e.title || 'Untitled') + (e.status === 'cancelled' ? ' (CANCELLED)' : ''),
    description: lines.join('\n'),
    location: location,
    status: 'confirmed',
    extendedProperties: { private: { btsId: e.id } },
  };
  if (COLORS[e.type]) r.colorId = COLORS[e.type];
  if (e.allDay) {
    r.start = { date: Utilities.formatDate(new Date(Number(e.start)), CFG.TZ, 'yyyy-MM-dd') };
    // end date is exclusive in Google; e.end is the next midnight
    var endMs = Math.max(Number(e.end), Number(e.start) + 864e5);
    r.end = { date: Utilities.formatDate(new Date(endMs + 3600e3), CFG.TZ, 'yyyy-MM-dd') };
  } else {
    r.start = { dateTime: new Date(Number(e.start)).toISOString(), timeZone: CFG.TZ };
    r.end = { dateTime: new Date(Number(e.end)).toISOString(), timeZone: CFG.TZ };
  }
  return r;
}

/** Google → Firestore */
function pullChanges_() {
  var cal = calendarId_();
  var token = PROPS.getProperty('SYNC_TOKEN'), pageToken = null, items = [], nextSync = null;
  while (true) {
    var opt = { maxResults: 250, showDeleted: true, singleEvents: true };
    if (pageToken) opt.pageToken = pageToken;
    if (token) opt.syncToken = token; else opt.timeMin = new Date(Date.now() - 90 * 864e5).toISOString();
    var r;
    try { r = Calendar.Events.list(cal, opt); }
    catch (err) {
      if (token && /410|sync token|fullSyncRequired/i.test(String(err))) { PROPS.deleteProperty('SYNC_TOKEN'); token = null; pageToken = null; items = []; continue; }
      throw err;
    }
    items = items.concat(r.items || []);
    pageToken = r.nextPageToken;
    if (!pageToken) { nextSync = r.nextSyncToken; break; }
  }
  items.forEach(function (g) { try { pullOne_(g); } catch (err) { console.error('pull ' + g.id + ': ' + err); } });
  if (nextSync) PROPS.setProperty('SYNC_TOKEN', nextSync);
}
function parseTitle_(s) {
  s = String(s || '');
  var cancelled = /\s*\(CANCELLED\)\s*$/i.test(s);
  s = s.replace(/\s*\(CANCELLED\)\s*$/i, '');
  var m = s.match(/^\s*[\[#]?\s*(shoot|shooting|video|prod|production|rec|recording|audio|session|mgmt|management|manage|meet|meeting|team)\s*\]?\s*[:\-–—]\s*(.*)$/i) ||
          s.match(/^\s*\[(shoot|shooting|video|prod|production|rec|recording|audio|session|mgmt|management|manage|meet|meeting|team)\]\s*(.*)$/i);
  var type = null, title = s.trim();
  if (m) {
    var k = m[1].toLowerCase();
    type = /^(shoot|shooting|video|prod|production)$/.test(k) ? 'shoot' : /^(rec|recording|audio|session)$/.test(k) ? 'recording' : /^(meet|meeting|team)$/.test(k) ? 'meeting' : 'management';
    title = m[2].trim();
  }
  return { type: type, title: title || 'Untitled', cancelled: cancelled };
}
function pullOne_(g) {
  var btsId = g.extendedProperties && g.extendedProperties.private && g.extendedProperties.private.btsId;
  var id = btsId || ('g_' + String(g.id).replace(/[^A-Za-z0-9_\-]/g, '_'));
  var ex = getDoc_('events', id);
  if (ex && ex.gcalUpdated && ex.gcalUpdated === g.updated) return; // our own write echoing back
  var now = Date.now();
  var who = { updatedAt: now, syncedAt: now, updatedBy: 'google-calendar', updatedByName: 'Google Calendar', gcalUpdated: g.updated || '' };
  if (g.status === 'cancelled') {
    if (ex && !ex.deleted) { patchDoc_('events', id, merge_({ deleted: true }, who)); log_('deleted', id, ex.title, []); }
    return;
  }
  if (!ex && btsId) return; // deleted in the app, Google copy is going away
  var p = parseTitle_(g.summary);
  var allDay = !!(g.start && g.start.date);
  var start = allDay ? Utilities.parseDate(g.start.date, CFG.TZ, 'yyyy-MM-dd').getTime() : Date.parse(g.start.dateTime);
  var end = allDay ? Utilities.parseDate(g.end.date, CFG.TZ, 'yyyy-MM-dd').getTime() : Date.parse(g.end.dateTime);
  var d = merge_({ title: p.title, start: start, end: end, allDay: allDay, gcalId: g.id, deleted: false }, who);
  if (p.type) d.type = p.type;
  if (p.cancelled) d.status = 'cancelled'; else if (ex && ex.status === 'cancelled') d.status = 'planned';
  if (!ex) {
    merge_(d, { type: p.type || 'unsorted', subtype: '', artistId: '', locationId: '', locationText: g.location || '', gcalLocation: g.location || '', travelMin: 0,
      memberIds: [], equipmentIds: [], price: 0, payments: [], notes: stripHtml_(g.description || ''), brief: '', callNotes: '', status: p.cancelled ? 'cancelled' : 'planned',
      source: 'google', createdAt: now, createdBy: 'google-calendar' });
    patchDoc_('events', id, d);
    log_('created', id, d.title, []);
    return;
  }
  if ((g.location || '') !== (ex.gcalLocation || '')) { d.locationId = ''; d.locationText = g.location || ''; d.gcalLocation = g.location || ''; }
  var changes = [];
  ['title', 'start', 'end', 'type', 'status', 'locationText', 'allDay'].forEach(function (k) {
    if (k in d && String(d[k]) !== String(ex[k] === undefined ? '' : ex[k])) changes.push({ f: k, from: String(ex[k] === undefined ? '' : ex[k]), to: String(d[k]) });
  });
  if (!changes.length) { patchDoc_('events', id, { gcalUpdated: g.updated || '', gcalId: g.id }); return; }
  patchDoc_('events', id, d);
  log_('updated', id, d.title, changes);
}
function stripHtml_(s) { return String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(); }
function merge_(a, b) { for (var k in b) a[k] = b[k]; return a; }
function log_(action, docId, label, changes) {
  addDoc_('activity', { ts: Date.now(), by: 'google-calendar', byName: 'Google Calendar', action: action, col: 'events', docId: docId, label: label || '', changes: changes || [] });
}
function lookups_() {
  var L = { members: {}, artists: {}, equipment: {}, locations: {}, docs: {} };
  Object.keys(L).forEach(function (c) { listDocs_(c).forEach(function (d) { L[c][d.id] = d; }); });
  return L;
}

// ───────────────────────── Weekly summary ─────────────────────────
function weeklySummary() {
  var members = listDocs_('members').filter(function (m) { return m.active !== false; });
  sendSummary_(members.map(function (m) { return m.id; }));
}
function sendSummary_(to) {
  if (!to.length) return;
  var today = Utilities.parseDate(Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), CFG.TZ, 'yyyy-MM-dd').getTime();
  var dow = Number(Utilities.formatDate(new Date(), CFG.TZ, 'u')); // 1=Mon … 7=Sun
  var from = dow === 7 ? today + 864e5 + 3600e3 : today - (dow - 1) * 864e5 + 3600e3;
  from = dayStart_(from);
  var to7 = dayStart_(from + 7 * 864e5 + 3600e3);
  var L = lookups_();
  var evs = listDocs_('events').filter(function (e) { return !e.deleted && e.status !== 'cancelled' && Number(e.start) < to7 && Number(e.end) > from; })
    .sort(function (a, b) { return a.start - b.start; });
  var fmt = function (ms, p) { return Utilities.formatDate(new Date(Number(ms)), CFG.TZ, p); };
  var C = { shoot: '#f59e0b', recording: '#22d3ee', management: '#a78bfa', meeting: '#34d399', unsorted: '#94a3b8' };
  var N = { shoot: 'Shoot', recording: 'Recording', management: 'Management', meeting: 'Team meeting', unsorted: 'Unsorted' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111">' +
    '<h2 style="margin:0 0 4px">BTS · Week of ' + fmt(from, 'd MMM') + ' – ' + fmt(to7 - 1, 'd MMM yyyy') + '</h2>' +
    '<p style="color:#555;margin:0 0 16px">' + evs.filter(function (e) { return e.type === 'shoot'; }).length + ' shoots · ' + evs.filter(function (e) { return e.type === 'recording'; }).length + ' recording sessions · ' + evs.filter(function (e) { return e.type === 'management'; }).length + ' management items · ' + evs.filter(function (e) { return e.type === 'meeting'; }).length + ' team meetings</p>';
  var clashes = clashes_(evs);
  if (clashes.length) html += '<div style="background:#fde8e8;border:1px solid #f5b5b5;padding:10px;border-radius:6px;margin-bottom:14px"><b>⚠️ Double bookings to fix:</b><br>' + clashes.map(esc).join('<br>') + '</div>';
  for (var d = from; d < to7; d = dayStart_(d + 864e5 + 3600e3)) {
    var de = evs.filter(function (e) { return Number(e.start) < d + 864e5 && Number(e.end) > d; });
    html += '<h3 style="margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px">' + fmt(d, 'EEEE d MMM') + '</h3>';
    if (!de.length) { html += '<div style="color:#999">Free</div>'; continue; }
    de.forEach(function (e) {
      var loc = e.locationId && L.locations[e.locationId] ? L.locations[e.locationId].name : (e.locationText || '');
      var team = (e.memberIds || []).map(function (m) { return L.members[m] ? L.members[m].name : m; }).join(', ');
      var gear = (e.equipmentIds || []).map(function (q) { var i = L.equipment[q]; return i ? (i.number ? i.number + ' ' : '') + i.name : '?'; }).join(', ');
      html += '<div style="border-left:4px solid ' + C[e.type || 'unsorted'] + ';padding:4px 10px;margin:6px 0">' +
        '<b>' + (e.allDay ? 'All day' : fmt(e.start, 'HH:mm') + '–' + fmt(e.end, 'HH:mm')) + ' · ' + esc(e.title) + '</b> <span style="color:#777">(' + N[e.type || 'unsorted'] + (e.subtype ? ' · ' + esc(e.subtype) : '') + ')</span>' +
        (e.artistId && L.artists[e.artistId] ? '<br>🎤 ' + esc(L.artists[e.artistId].name) : '') +
        (loc ? '<br>📍 ' + esc(loc) + (e.travelMin ? ' (' + e.travelMin + ' min travel)' : '') : '') +
        (team ? '<br>👥 ' + esc(team) : '') + (gear ? '<br>🎥 ' + esc(gear) : '') +
        (e.type === 'meeting' && e.brief ? '<br>📝 Agenda: ' + esc(String(e.brief).split('\n').filter(String).join(' · ')) : '') +
        ((e.docIds || []).length ? '<br>📄 ' + esc(e.docIds.map(function (d) { return L.docs[d] ? L.docs[d].name : '?'; }).join(', ')) : '') + '</div>';
    });
  }
  var fromIso = fmt(from, 'yyyy-MM-dd'), toIso = fmt(to7 - 1, 'yyyy-MM-dd'), todayIso = fmt(today, 'yyyy-MM-dd');
  var pays = [];
  listDocs_('expenses').forEach(function (x) { expOcc_(x, fromIso, toIso).forEach(function (d) { pays.push({ x: x, d: d }); }); });
  var overdue = [];
  listDocs_('expenses').forEach(function (x) { expOcc_(x, x.date || todayIso, todayIso).forEach(function (d) { if (d < todayIso && !expPaid_(x, d)) overdue.push({ x: x, d: d }); }); });
  if (pays.length || overdue.length) {
    pays.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    html += '<h3 style="margin-top:18px">💶 Payments</h3>' +
      overdue.map(function (o) { return '<div style="color:#b91c1c">OVERDUE ' + esc(o.d) + ' · ' + esc(o.x.title) + ' · €' + Number(o.x.amount || 0).toFixed(2) + '</div>'; }).join('') +
      pays.map(function (o) { return '<div>' + esc(o.d) + ' · ' + esc(o.x.title) + ' · €' + Number(o.x.amount || 0).toFixed(2) + (expPaid_(o.x, o.d) ? ' · paid' : ' · <b>unpaid</b>') + '</div>'; }).join('');
  }
  var exp = listDocs_('contracts').filter(function (c) { if (!c.endDate) return false; var n = (Utilities.parseDate(c.endDate, CFG.TZ, 'yyyy-MM-dd').getTime() - today) / 864e5; return n >= 0 && n <= 60; });
  if (exp.length) html += '<h3 style="margin-top:18px">📄 Contracts expiring within 60 days</h3>' + exp.map(function (c) { return '<div>' + esc(L.artists[c.artistId] ? L.artists[c.artistId].name : '') + ' – ' + esc(c.title) + ' · ends ' + esc(c.endDate) + ' · renew: ' + esc(c.renew || 'undecided') + '</div>'; }).join('');
  html += '<p style="margin-top:22px"><a href="' + CFG.APP_URL + '" style="background:#3d7ef5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open BTS</a></p></div>';
  MailApp.sendEmail({ to: to.join(','), subject: 'BTS · Next week (' + fmt(from, 'd MMM') + ' – ' + fmt(to7 - 1, 'd MMM') + ')', htmlBody: html, name: 'BTS' });
}
function expPaid_(x, d) { return (!x.freq || x.freq === 'once') ? !!x.paid : (x.paidDates || []).indexOf(d) >= 0; }
function expOcc_(x, from, to) {
  if (!x.date) return [];
  if (!x.freq || x.freq === 'once') return x.date >= from && x.date <= to ? [x.date] : [];
  var out = [], end = x.endDate && x.endDate < to ? x.endDate : to, p = x.date.split('-').map(Number);
  for (var k = 0; k < 2000; k++) {
    var d;
    if (x.freq === 'weekly') d = new Date(p[0], p[1] - 1, p[2] + 7 * k);
    else {
      var mo = x.freq === 'monthly' ? k : x.freq === 'quarterly' ? 3 * k : 12 * k;
      var last = new Date(p[0], p[1] - 1 + mo + 1, 0).getDate();
      d = new Date(p[0], p[1] - 1 + mo, Math.min(p[2], last));
    }
    var s = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    if (s > end) break;
    if (s >= from) out.push(s);
  }
  return out;
}
function dayStart_(ms) { return Utilities.parseDate(Utilities.formatDate(new Date(ms), CFG.TZ, 'yyyy-MM-dd'), CFG.TZ, 'yyyy-MM-dd').getTime(); }
function clashes_(evs) {
  var out = [], w = function (e) { var t = (Number(e.travelMin) || 0) * 6e4; return [Number(e.start) - t, Number(e.end) + t]; };
  for (var i = 0; i < evs.length; i++) for (var j = i + 1; j < evs.length; j++) {
    var a = evs[i], b = evs[j], wa = w(a), wb = w(b);
    if (!(wa[0] < wb[1] && wb[0] < wa[1])) continue;
    var shared = (a.memberIds || []).filter(function (x) { return (b.memberIds || []).indexOf(x) >= 0; }).length + (a.equipmentIds || []).filter(function (x) { return (b.equipmentIds || []).indexOf(x) >= 0; }).length;
    if (shared || (a.artistId && a.artistId === b.artistId) || (a.locationId && a.locationId === b.locationId)) out.push(a.title + ' ↔ ' + b.title);
  }
  return out;
}

// ───────────────────────── Firestore REST ─────────────────────────
function base_() { return 'https://firestore.googleapis.com/v1/projects/' + CFG.PROJECT_ID + '/databases/(default)/documents'; }
function fs_(path, method, body, params) {
  var url = base_() + path + (params ? '?' + params : '');
  var o = { method: method || 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': CFG.PROJECT_ID } };
  if (body) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(url, o), code = r.getResponseCode();
  if (code === 404) return null;
  if (code >= 300) throw new Error('Firestore ' + code + ': ' + r.getContentText().slice(0, 400));
  return JSON.parse(r.getContentText() || '{}');
}
function enc_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc_) } };
  return { mapValue: { fields: encF_(v) } };
}
function encF_(o) { var f = {}; for (var k in o) if (o[k] !== undefined) f[k] = enc_(o[k]); return f; }
function dec_(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec_);
  if ('mapValue' in v) return decF_(v.mapValue.fields || {});
  return null;
}
function decF_(f) { var o = {}; for (var k in f) o[k] = dec_(f[k]); return o; }
function decDoc_(d) { var o = decF_(d.fields || {}); o.id = decodeURIComponent(d.name.split('/').pop()); return o; }
function getDoc_(col, id) { var d = fs_('/' + col + '/' + encodeURIComponent(id)); return d ? decDoc_(d) : null; }
function patchDoc_(col, id, data) {
  var params = Object.keys(data).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  return fs_('/' + col + '/' + encodeURIComponent(id), 'patch', { fields: encF_(data) }, params);
}
function addDoc_(col, data) { return fs_('/' + col, 'post', { fields: encF_(data) }); }
function listDocs_(col) {
  var out = [], page = null;
  do {
    var r = fs_('/' + col, 'get', null, 'pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    ((r && r.documents) || []).forEach(function (d) { out.push(decDoc_(d)); });
    page = r && r.nextPageToken;
  } while (page);
  return out;
}
function queryUpdatedAfter_(col, ms) {
  var r = fs_(':runQuery', 'post', { structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: 'updatedAt' }, op: 'GREATER_THAN', value: { integerValue: String(ms) } } }, orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'ASCENDING' }], limit: 300 } });
  return (r || []).filter(function (x) { return x.document; }).map(function (x) { return decDoc_(x.document); });
}
