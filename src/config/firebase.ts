import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Import getStorage

// Ensure environment variables are loaded correctly.
// Throw an error during build/startup if any are missing.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate that all required config values are present
const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
  console.error(`Missing Firebase config environment variables: ${missingConfigKeys.join(', ')}`);
  // Optionally throw an error to prevent startup with missing config
  // throw new Error(`Missing Firebase config environment variables: ${missingConfigKeys.join(', ')}`);
}


// Initialize Firebase
// Check if Firebase app has already been initialized to prevent errors
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Export getStorage as 'storage'

export { app, auth, db, storage };
