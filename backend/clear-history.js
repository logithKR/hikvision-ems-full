const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function clearOldLogs() {
    console.log("🗑️ Cleaning up device dump history from the database...");
    const snapshot = await db.collection('hikvision_logs').get();
    
    if (snapshot.empty) {
        console.log("✅ Database is already perfectly clean!");
        process.exit(0);
    }

    let count = 0;
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${count} old device logs successfully! Everything is fresh now.`);
    process.exit(0);
}

clearOldLogs();
