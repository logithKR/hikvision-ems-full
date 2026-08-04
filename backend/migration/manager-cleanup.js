const admin = require('../firebase-admin')();
const db = admin.firestore();
const { FieldValue } = require('firebase-admin/firestore');

async function runMigration() {
    console.log('🚀 Starting Manager Cleanup Migration...');
    
    let totalMigrated = 0;
    
    try {
        const batchSize = 100; // Batch limit for performance
        let batch = db.batch();
        let currentBatchSize = 0;

        async function commitBatch() {
            if (currentBatchSize > 0) {
                await batch.commit();
                totalMigrated += currentBatchSize;
                console.log(`✅ Committed batch of ${currentBatchSize} updates. Total migrated so far: ${totalMigrated}`);
                batch = db.batch(); // Reset batch
                currentBatchSize = 0;
            }
        }

        const fieldsToDelete = {
            isManager: FieldValue.delete(),
            managerId: FieldValue.delete(),
            managerName: FieldValue.delete(),
            directReports: FieldValue.delete()
        };

        // 1. Process Global Users Collection
        console.log('\n🔍 Processing global `users` collection...');
        const globalUsersSnapshot = await db.collection('users').get();
        for (const doc of globalUsersSnapshot.docs) {
            const data = doc.data();
            if (data.isManager !== undefined || data.managerId !== undefined || data.managerName !== undefined || data.directReports !== undefined) {
                batch.update(doc.ref, fieldsToDelete);
                currentBatchSize++;
                
                if (currentBatchSize >= batchSize) {
                    await commitBatch();
                }
            }
        }
        await commitBatch();

        // 2. Process Organizations
        console.log('\n🔍 Processing organizations...');
        const orgsSnapshot = await db.collection('organizations').get();
        for (const orgDoc of orgsSnapshot.docs) {
            console.log(`\n🏢 Organization: ${orgDoc.id} (${orgDoc.data().name})`);
            
            // Org Users
            const orgUsersRef = orgDoc.ref.collection('users');
            const orgUsersSnapshot = await orgUsersRef.get();
            for (const doc of orgUsersSnapshot.docs) {
                const data = doc.data();
                if (data.isManager !== undefined || data.managerId !== undefined || data.managerName !== undefined || data.directReports !== undefined) {
                    batch.update(doc.ref, fieldsToDelete);
                    currentBatchSize++;
                    
                    if (currentBatchSize >= batchSize) {
                        await commitBatch();
                    }
                }
            }
            await commitBatch();
        }

        console.log(`\n🎉 Migration Complete! Successfully migrated ${totalMigrated} user documents across the database.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
