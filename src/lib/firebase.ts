import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpBTv3re8BuZR-i25ZeuKsUykN1DYcxNo",
  authDomain: "tripsync-8e63e.firebaseapp.com",
  projectId: "tripsync-8e63e",
  storageBucket: "tripsync-8e63e.firebasestorage.app",
  messagingSenderId: "167694267883",
  appId: "1:167694267883:web:61bd7d4f75be2ad2a915ae",
  measurementId: "G-QN6RB14ZGF"
};

// Initialize Firebase for SSR compatibility in Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
