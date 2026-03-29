/**
 * lib/firebaseClient.js
 * Firebase Client SDK for browser authentication
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ✅ Updated Firebase configuration with YOUR project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCM7Rv2xTf55PZ8-y95n7FctN45nIBXOko",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ems-project-799d6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ems-project-799d6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ems-project-799d6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "100915421632",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:100915421632:web:9c494abab14198d4682825",
};

let app;
let auth;
let db;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  
  // Set Firebase Auth persistence to SESSION so closing tabs logs out
  setPersistence(auth, browserSessionPersistence)
    .then(() => console.log('✅ Firebase auth persistence set to SESSION'))
    .catch((error) => console.error('❌ Failed to set persistence:', error));
    
  db = getFirestore(app);
  console.log('✅ Firebase initialized successfully for project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  // Create null objects for development
  auth = null;
  db = null;
}

export { auth, db, signInWithCustomToken, GoogleAuthProvider, signInWithPopup };
export default app;

/**
 * Get valid Firebase ID token
 * @returns {Promise<string>} Firebase ID token
 */
export async function getValidIdToken() {
  console.log('🔑 getValidIdToken() called');
  console.log('🔑 auth exists:', !!auth);
  console.log('🔑 auth.currentUser:', auth?.currentUser ? `User: ${auth.currentUser.uid}` : 'NULL (Firebase not ready yet!)');

  try {
    if (auth && auth.currentUser) {
      console.log('🔑 Attempting to get fresh ID token from Firebase...');
      const token = await auth.currentUser.getIdToken(true);
      if (token) {
        console.log('✅ Got fresh ID token from Firebase (first 50 chars):', token.substring(0, 50) + '...');
        try {
          sessionStorage.setItem('firebaseToken', token);
        } catch { }
        return token;
      }
    } else {
      console.warn('⚠️ auth.currentUser is NULL - Firebase sign-in not complete yet!');
    }
  } catch (e) {
    console.error('❌ Failed to get ID token from Firebase:', e?.message);
  }

  // Fallback to stored token
  console.log('🔑 Falling back to sessionStorage token...');
  try {
    const stored = sessionStorage.getItem('firebaseToken') || '';
    if (stored) {
      console.log('⚠️ Using STORED token from sessionStorage (first 50 chars):', stored.substring(0, 50) + '...');
      console.log('⚠️ WARNING: This might be a CUSTOM token, not an ID token!');
    } else {
      console.error('❌ No token found in sessionStorage either!');
    }
    return stored;
  } catch {
    console.error('❌ sessionStorage access failed');
    return '';
  }
}
