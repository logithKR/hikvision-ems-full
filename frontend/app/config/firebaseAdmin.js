/**
 * app/config/firebaseAdmin.js
 * Firebase ADMIN SDK Configuration for Server-Side (API Routes)
 * 
 * This uses the service account key for privileged Firestore access
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin (singleton pattern)
if (!admin.apps.length) {
 try {
 let serviceAccount;

 // Try to use environment variable first
 if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
 serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
 } else {
 // Fall back to local file using fs (ESM compatible)
 const filePath = join(process.cwd(), 'app', 'config', 'serviceAccountKey.json');
 const fileContent = readFileSync(filePath, 'utf8');
 serviceAccount = JSON.parse(fileContent);
 }

 admin.initializeApp({
 credential: admin.credential.cert(serviceAccount),
 });

 console.log('✅ Firebase Admin (API) initialized successfully');
 } catch (error) {
 console.error('❌ Firebase Admin initialization failed:', error.message);
 console.error('⚠️ Ensure serviceAccountKey.json exists in app/config/ or set FIREBASE_SERVICE_ACCOUNT_KEY env var');
 }
}

// Export Firestore database instance
export const db = admin.firestore();

// Export admin for other uses if needed
export default admin;
