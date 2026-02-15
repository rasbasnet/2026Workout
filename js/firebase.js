import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
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

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function ensureConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured yet. Update js/firebase.js with your Firebase project keys."
    );
  }
}

export async function loginWithGoogle() {
  ensureConfigured();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
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
  await setDoc(
    userDoc(uid, "profile", "meta"),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getProfile(uid) {
  ensureConfigured();
  const snapshot = await getDoc(userDoc(uid, "profile", "meta"));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveWorkoutLog(uid, dateKey, payload) {
  ensureConfigured();
  await setDoc(
    userDoc(uid, "workoutLogs", dateKey),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getRecentWorkoutLogs(uid, itemLimit = 90) {
  ensureConfigured();
  const q = query(userPath(uid, "workoutLogs"), orderBy("date", "desc"), limit(itemLimit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export async function addFoodLog(uid, payload) {
  ensureConfigured();
  await addDoc(userPath(uid, "foodLogs"), {
    ...payload,
    createdAt: serverTimestamp(),
    eatenAtMs: new Date(payload.eatenAt).getTime()
  });
}

export async function getRecentFoodLogs(uid, itemLimit = 120) {
  ensureConfigured();
  const q = query(userPath(uid, "foodLogs"), orderBy("eatenAtMs", "desc"), limit(itemLimit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export async function saveDailyWeight(uid, dateKey, payload) {
  ensureConfigured();
  await setDoc(
    userDoc(uid, "weightLogs", dateKey),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getWeightLogs(uid, itemLimit = 180) {
  ensureConfigured();
  const q = query(userPath(uid, "weightLogs"), orderBy("date", "desc"), limit(itemLimit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export { auth, db };
