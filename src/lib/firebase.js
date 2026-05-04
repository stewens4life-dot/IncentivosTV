// ── Firebase + Config ──
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getEnv = (key, fallback = '') => {
  try { return import.meta.env?.[key] || fallback; } catch { return fallback; }
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
};

export const ADMIN_PASSWORD_FALLBACK = getEnv('VITE_ADMIN_PASSWORD', '1234');
export const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'tvincentivos-prod';

let app, auth, db;
try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error('Firebase init error:', e);
}

export { app, auth, db };

// ── Firestore path helpers ──
export const PATHS = {
  playlist: () => ['artifacts', APP_ID, 'public', 'data', 'playlist'],
  devices:  () => ['artifacts', APP_ID, 'public', 'data', 'devices'],
  settings: () => ['artifacts', APP_ID, 'public', 'data', 'settings'],
  auth:     () => ['artifacts', APP_ID, 'public', 'data', 'settings', 'auth'],
  stats:    () => ['artifacts', APP_ID, 'public', 'data', 'stats'],
};
