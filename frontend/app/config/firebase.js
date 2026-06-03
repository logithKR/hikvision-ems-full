/**
 * app/config/firebase.js
 * Firebase CLIENT SDK Configuration for Frontend
 * 
 * This config is SAFE to expose in the browser
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your Firebase Web App Configuration
const firebaseConfig = {
 apiKey: import.meta.env.VITE_FIREBASE_API_KEY ||"AIzaSyCM7Rv2xTf55PZ8-y95n7FctN45nIBXOko",
 authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||"ems-project-799d6.firebaseapp.com",
 projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ||"ems-project-799d6",
 storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||"ems-project-799d6.firebasestorage.app",
 messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||"100915421632",
 appId: import.meta.env.VITE_FIREBASE_APP_ID ||"1:100915421632:web:9c494abab14198d4682825"
};

// Initialize Firebase (singleton pattern)
let app;
if (!getApps().length) {
 app = initializeApp(firebaseConfig);
 console.log('✅ Firebase Client initialized for project:', firebaseConfig.projectId);
} else {
 app = getApps()[0];
 console.log('✅ Firebase Client already initialized');
}

// Export auth instance for authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Export app instance
export default app;
