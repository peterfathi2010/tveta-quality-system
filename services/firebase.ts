import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBMRhbsaxcgEak2sJiCPTKwxbZmpfn7gw0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "quality-mangment.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "quality-mangment",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "quality-mangment.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "978902583172",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:978902583172:web:9e91b3409c05f229c73fd1",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

let app: FirebaseApp | undefined;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);

  // Enable offline persistence safely
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firebase offline persistence error:", err.code);
  });
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { db, storage, auth };
