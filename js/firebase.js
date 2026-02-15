import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDEZGvOW1g0vDzTPwoUo2LA3yPoC7_nqKg",
  authDomain: "w-d8888.firebaseapp.com",
  projectId: "w-d8888",
  storageBucket: "w-d8888.firebasestorage.app",
  messagingSenderId: "762614041322",
  appId: "1:762614041322:web:6d6bde6673f3f7c7416593",
  measurementId: "G-1NXWFNQXYS"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && value !== "REPLACE_ME"
);

let app;
let auth;
let db;
const FIREBASE_TIMEOUT_MS = 12000;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
  });
}

export function ensureConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured yet. Update js/firebase.js with your Firebase project keys."
    );
  }
}

export function formatFirebaseError(error) {
  const code = String(error?.code || "");

  if (code === "permission-denied") {
    return "Save blocked by Firestore rules. Deploy firestore.rules and ensure you are logged in.";
  }
  if (code === "failed-precondition") {
    return "Firestore is not fully enabled yet. Enable Cloud Firestore in Firebase Console.";
  }
  if (code === "unavailable") {
    return "Firestore is temporarily unavailable. Check internet and retry.";
  }
  if (code === "unauthenticated") {
    return "You are not authenticated anymore. Sign in again.";
  }
  if (code === "not-found") {
    return "Requested Firestore resource was not found.";
  }
  if (code === "resource-exhausted") {
    return "Firestore quota exceeded. Check Firebase usage limits.";
  }
  if (code === "timeout") {
    return "Save request timed out. Confirm Firestore is enabled and rules allow writes for your user.";
  }
  if (code === "network-request-failed") {
    return "Network request failed. Check internet and try again.";
  }

  return String(error?.message || "Unexpected Firebase error.");
}

async function withTimeout(promise, ms = FIREBASE_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          reject({ code: "timeout" });
        }, ms);
      })
    ]);
  } finally {
    if (timer) {
      window.clearTimeout(timer);
    }
  }
}

export async function loginWithGoogle() {
  ensureConfigured();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export async function loginWithGoogleRedirect() {
  ensureConfigured();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithRedirect(auth, provider);
}

export async function resolveGoogleRedirect() {
  ensureConfigured();
  return getRedirectResult(auth);
}

export async function logoutUser() {
  ensureConfigured();
  return signOut(auth);
}

export function watchAuth(callback) {
  ensureConfigured();
  return onAuthStateChanged(auth, callback);
}

function userPath(uid, subCollection) {
  return collection(db, "users", uid, subCollection);
}

function userDoc(uid, subCollection, id) {
  return doc(db, "users", uid, subCollection, id);
}

export async function saveProfile(uid, payload) {
  ensureConfigured();
  return withTimeout(
    setDoc(
      userDoc(uid, "profile", "meta"),
      {
        ...payload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  );
}

export async function getProfile(uid) {
  ensureConfigured();
  const snapshot = await withTimeout(getDoc(userDoc(uid, "profile", "meta")));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveWorkoutLog(uid, dateKey, payload) {
  ensureConfigured();
  return withTimeout(
    setDoc(
      userDoc(uid, "workoutLogs", dateKey),
      {
        ...payload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  );
}

export async function getRecentWorkoutLogs(uid, itemLimit = 90) {
  ensureConfigured();
  const q = query(userPath(uid, "workoutLogs"), orderBy("date", "desc"), limit(itemLimit));
  const snapshot = await withTimeout(getDocs(q));
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export async function addFoodLog(uid, payload) {
  ensureConfigured();
  return withTimeout(
    addDoc(userPath(uid, "foodLogs"), {
      ...payload,
      createdAt: serverTimestamp(),
      eatenAtMs: new Date(payload.eatenAt).getTime()
    })
  );
}

export async function getRecentFoodLogs(uid, itemLimit = 120) {
  ensureConfigured();
  const q = query(userPath(uid, "foodLogs"), orderBy("eatenAtMs", "desc"), limit(itemLimit));
  const snapshot = await withTimeout(getDocs(q));
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export async function saveDailyWeight(uid, dateKey, payload) {
  ensureConfigured();
  return withTimeout(
    setDoc(
      userDoc(uid, "weightLogs", dateKey),
      {
        ...payload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  );
}

export async function getWeightLogs(uid, itemLimit = 180) {
  ensureConfigured();
  const q = query(userPath(uid, "weightLogs"), orderBy("date", "desc"), limit(itemLimit));
  const snapshot = await withTimeout(getDocs(q));
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export { auth, db };
