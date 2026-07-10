import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type Database, getDatabase } from 'firebase/database';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

let firebaseApp: FirebaseApp | undefined;
let database: Database | undefined;

if (projectId && projectId !== 'your-project-id') {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  firebaseApp = initializeApp(firebaseConfig);
  database = getDatabase(firebaseApp);
}

export { database, firebaseApp };
