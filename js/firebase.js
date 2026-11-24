import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, writeBatch, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { CONFIG } from "./config.js?v=9";

export const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
let _db;
try {
  _db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  _db = initializeFirestore(app, {});
}
export const db = _db;

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, writeBatch, query, orderBy, limit,
};

/** Create a login for a new team member without signing the admin out. */
export async function createLogin(email) {
  const second = initializeApp(CONFIG.firebase, "second-" + Date.now());
  const a2 = getAuth(second);
  const tmp = crypto.getRandomValues(new Uint32Array(4)).join("-") + "Aa!";
  try {
    await createUserWithEmailAndPassword(a2, email, tmp);
  } catch (e) {
    if (e.code !== "auth/email-already-in-use") throw e;
  } finally {
    try { await signOut(a2); } catch (_) {}
    try { await deleteApp(second); } catch (_) {}
  }
  // The member sets their own password from this email
  await sendPasswordResetEmail(auth, email);
}
