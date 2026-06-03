import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
try {
 // Try to find the service account key
 // Assuming it's in the backend/config or similar, but the repo uses initFirebaseAdmin from ../firebase-admin
 // Let's try to require the existing firebase-admin setup if possible
 const serviceAccount = require(path.join(__dirname, '../backend/serviceAccountKey.json'));
 admin.initializeApp({
 credential: admin.credential.cert(serviceAccount)
 });
 console.log('✅ Firebase Admin initialized with serviceAccountKey.json');
} catch (e) {
 try {
 // Fallback to default application credentials or look for other common paths
 if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
 admin.initializeApp();
 console.log('✅ Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
 } else {
 // specific path attempt
 const saPath = path.join(__dirname, '../backend/config/serviceAccountKey.json');
 try {
 const sa = require(saPath);
 admin.initializeApp({ credential: admin.credential.cert(sa) });
 console.log(`✅ Firebase Admin initialized with ${saPath}`);
 } catch (err) {
 console.log('⚠️ Could not find service account at specific path, trying default init...');
 admin.initializeApp();
 }
 }

 } catch (error) {
 console.error('❌ Failed to initialize Firebase Admin:', error);
 process.exit(1);
 }
}

const db = getFirestore();
const COLLECTION_NAME = 'organizations';

async function deleteAllOrganizations() {
 console.log(`🗑️ Starting deletion of all documents in '${COLLECTION_NAME}'...`);

 try {
 const snapshot = await db.collection(COLLECTION_NAME).get();

 if (snapshot.empty) {
 console.log('ℹ️ No organizations found to delete.');
 return;
 }

 console.log(`Found ${snapshot.size} organizations. Deleting...`);

 const batchSize = 500;
 let batch = db.batch();
 let count = 0;
 let totalDeleted = 0;

 for (const doc of snapshot.docs) {
 batch.delete(doc.ref);
 count++;

 if (count >= batchSize) {
 await batch.commit();
 console.log(`Deleted batch of ${count} organizations.`);
 totalDeleted += count;
 batch = db.batch(); // Get new batch
 count = 0;
 }
 }

 // Commit remaining
 if (count > 0) {
 await batch.commit();
 totalDeleted += count;
 console.log(`Deleted remaining ${count} organizations.`);
 }

 console.log(`✅ Successfully deleted all ${totalDeleted} organizations.`);

 } catch (error) {
 console.error('❌ Error deleting organizations:', error);
 process.exit(1);
 }
}

deleteAllOrganizations();
