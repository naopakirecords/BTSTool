# BTS – internal team tool

**Live:** https://naopakirecords.github.io/BTSTool/ · **Repo:** naopakirecords/BTSTool · **Accounts:** everything runs on the company Google account naopakirecords@gmail.com (Firebase project, Apps Script "BTS Sync", BTS calendar, "BTS Documents" Drive folder). The old personal repo 0Frog2/BTS is archived.

Private tool for the team: shoots, recording sessions, artist management, contracts, documents and equipment. It syncs two ways with Google Calendar. NAOPAKI is the public portfolio; **BTS is internal only**.

- **App:** static site on GitHub Pages (`index.html`, `js/`, `css/`). Dark mode, works on phone and desktop, and can be added to the home screen.
- **Data and logins:** Firebase (Authentication with email and password, plus a live-sync Firestore database). Every change appears on all devices instantly.
- **Google side:** a Google Apps Script (`apps-script/`) that runs under the team Google account:
  - two-way sync with the **BTS** Google calendar: every minute, and right after each change
  - the Sunday 18:00 summary email to every active member
  - document storage in the Drive folder **BTS Documents**
- **Help for users:** the in-app **Help** page.

## Security
- There is no sign-up page. Only emails listed in Firestore `members` (and active) can read or write anything; this is enforced by `firestore.rules`. The admin adds people on the **Team** page, and each person gets an email to set their own password.
- Documents are only served through the Apps Script after it verifies the person's Firebase login.
- Call sheet links (`callsheet.html?t=…`) are read-only snapshots with no prices and no internal notes. A link can be turned off at any time.
- The Firebase web config in `js/config.js` is not secret. Access is controlled by the rules.

## Calendar tags
In Google Calendar, a title starting with `Shoot:`, `Rec:` or `Mgmt:` goes to Production, Audio or Management. Titles without a tag land in **Unsorted** on Home.

## Switching to the company account
1. In the company Google account, create a Firebase project. Enable **Authentication → Email/Password**, create a **Firestore** database, and publish `firestore.rules`.
2. **Authentication → Users → Add user** for the admin email. In Firestore, the Apps Script `setup()` creates the admin `members` document.
3. **Project settings → Your apps → Web app:** copy the config into `js/config.js` (`firebase`).
4. In the company account, create a new Apps Script project. Paste `apps-script/Code.gs` and `appsscript.json` (enable "Show appsscript.json" in the project settings). Set `PROJECT_ID`, `API_KEY` and `ADMIN_EMAIL` in `CFG`, then run `setup()` once and approve the permissions.
5. **Deploy → New deployment → Web app** (Execute as: Me, Who has access: Anyone). Paste the URL into `js/config.js` (`appsScriptUrl`) and push.
6. Optional: move existing data over with a Firestore export/import. Ask Claude.

## Files
| Path | What |
|---|---|
| `index.html`, `js/app.js` | app shell, sign-in, navigation |
| `js/store.js` | live data, saving and the activity log |
| `js/conflicts.js` | double-booking detection and fix suggestions |
| `js/events.js` | shoot/session/management editor, calendar, lists, call sheets, history |
| `js/people.js` | artists, contracts, management, team, account |
| `js/misc.js` | home, weekly summary, documents, equipment, locations, activity |
| `js/help.js` | Help page |
| `callsheet.html` | public read-only call sheet |
| `firestore.rules` | database security rules |
| `apps-script/` | Google Calendar sync, Sunday email, Drive documents |

## Releasing a change (cache-busting)
Browsers cache files for ~10 minutes. After any change, bump the version everywhere in one go, e.g. from 5 to 6:
`sed -i 's/?v=5/?v=6/g' index.html callsheet.html js/*.js`
