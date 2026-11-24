// ─────────────────────────────────────────────────────────────
// BTS configuration. To move to the company account later:
//  1. Create a new Firebase project under the company Google account
//     and paste its web config below.
//  2. Install the Apps Script (apps-script/) under the company account
//     and paste its new web-app URL below.
// See README.md → "Switching to the company account".
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyAWFRcaTMp3KpUujrjHfi7_t3ad7C7xnaw",
    authDomain: "bts-tool.firebaseapp.com",
    projectId: "bts-tool",
    storageBucket: "bts-tool.firebasestorage.app",
    messagingSenderId: "529006140655",
    appId: "1:529006140655:web:4819fce4208511216d4f1a",
  },
  // Google Apps Script web app (calendar sync, Sunday email, document storage)
  appsScriptUrl: "__APPS_SCRIPT_URL__",
  currency: "EUR",
  locale: "en-GB",
};
