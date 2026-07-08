import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "sanatanstream-b6cac",
  appId: "1:726715788132:web:02533f9e5e81b3f0d06871",
  apiKey: "AIzaSyBYxiKwn1L-NWo23rObaGNrEc3uXPHMSJU",
  authDomain: "sanatanstream-b6cac.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "sanatanstream-b6cac.firebasestorage.app",
  messagingSenderId: "726715788132",
  measurementId: ""
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
