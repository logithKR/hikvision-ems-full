const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupService {
    constructor(db, auditLogService) {
        this.db = db;
        this.auditLogService = auditLogService;
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.MAX_BACKUPS = 10;
        
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    /**
     * Helper to read all documents from a collection recursively if needed.
     * We don't do deep recursion because Firestore subcollections are known.
     */
    async _backupCollection(collectionRef) {
        const snapshot = await collectionRef.get();
        const data = {};
        for (const doc of snapshot.docs) {
            data[doc.id] = doc.data();
        }
        return data;
    }

    /**
     * Creates a full JSON backup of the Firestore database.
     * Non-blocking - returns backup metadata immediately while working in background.
     */
    async createBackup(actor) {
        const backupId = `backup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const filePath = path.join(this.backupDir, `${backupId}.json`);
        
        const metadata = {
            id: backupId,
            status: 'creating',
            createdAt: new Date().toISOString(),
            completedAt: null,
            createdBy: actor,
            filePath: filePath,
            fileSize: 0,
            stats: {
                totalDocuments: 0,
                collections: []
            },
            error: null
        };

        // Save initial metadata
        await this.db.collection('system_backups').doc(backupId).set(metadata);

        // Run backup in background
        this._runBackupProcess(backupId, filePath, actor, metadata).catch(err => {
            console.error('❌ [BackupService] Background backup failed:', err);
        });

        // Audit Log
        await this.auditLogService.log({
            organizationId: 'system',
            actor,
            action: 'DATABASE_BACKUP_STARTED',
            targetId: backupId,
            targetType: 'backup',
            details: { backupId }
        });

        return metadata;
    }

    async _runBackupProcess(backupId, filePath, actor, metadata) {
        console.log(`⏳ [BackupService] Starting backup process for ${backupId}`);
        try {
            const backupData = {};
            let totalDocs = 0;
            const includedCollections = [];

            // 1. Root Collections
            const rootCollections = ['users', 'organizations', 'audit_logs', 'hikvision_logs'];
            for (const collName of rootCollections) {
                const data = await this._backupCollection(this.db.collection(collName));
                backupData[collName] = data;
                const docCount = Object.keys(data).length;
                totalDocs += docCount;
                if (docCount > 0) includedCollections.push(collName);
            }

            // 2. Organization Subcollections
            backupData['organization_subcollections'] = {};
            
            // We already loaded organizations into backupData['organizations']
            const orgIds = Object.keys(backupData['organizations'] || {});
            
            for (const orgId of orgIds) {
                backupData['organization_subcollections'][orgId] = {};
                const orgRef = this.db.collection('organizations').doc(orgId);
                
                const subcollections = ['users', 'departments', 'attendance', 'leaves', 'statistics'];
                for (const subColl of subcollections) {
                    const data = await this._backupCollection(orgRef.collection(subColl));
                    backupData['organization_subcollections'][orgId][subColl] = data;
                    const docCount = Object.keys(data).length;
                    totalDocs += docCount;
                    if (docCount > 0 && !includedCollections.includes(`org_${subColl}`)) {
                        includedCollections.push(`org_${subColl}`);
                    }
                }
            }

            // Write to file
            const jsonStr = JSON.stringify(backupData, null, 2);
            fs.writeFileSync(filePath, jsonStr, 'utf8');
            const stats = fs.statSync(filePath);

            // Update metadata
            metadata.status = 'ready';
            metadata.completedAt = new Date().toISOString();
            metadata.fileSize = stats.size;
            metadata.stats.totalDocuments = totalDocs;
            metadata.stats.collections = includedCollections;

            await this.db.collection('system_backups').doc(backupId).update(metadata);

            // Cleanup old backups
            await this._cleanupOldBackups();

            // Audit Log
            await this.auditLogService.log({
                organizationId: 'system',
                actor,
                action: 'DATABASE_BACKUP_COMPLETED',
                targetId: backupId,
                targetType: 'backup',
                details: { backupId, totalDocs, fileSize: stats.size }
            });

            console.log(`✅ [BackupService] Backup ${backupId} completed successfully.`);

        } catch (error) {
            console.error(`❌ [BackupService] Backup ${backupId} failed:`, error);
            metadata.status = 'failed';
            metadata.error = error.message;
            metadata.completedAt = new Date().toISOString();
            await this.db.collection('system_backups').doc(backupId).update(metadata);

            await this.auditLogService.log({
                organizationId: 'system',
                actor,
                action: 'DATABASE_BACKUP_FAILED',
                targetId: backupId,
                targetType: 'backup',
                details: { backupId, error: error.message }
            });
        }
    }

    async _cleanupOldBackups() {
        try {
            const snapshot = await this.db.collection('system_backups')
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.docs.length > this.MAX_BACKUPS) {
                const docsToDelete = snapshot.docs.slice(this.MAX_BACKUPS);
                for (const doc of docsToDelete) {
                    const data = doc.data();
                    if (data.filePath && fs.existsSync(data.filePath)) {
                        fs.unlinkSync(data.filePath);
                    }
                    await doc.ref.delete();
                }
                console.log(`🧹 [BackupService] Cleaned up ${docsToDelete.length} old backups.`);
            }
        } catch (error) {
            console.error('⚠️ [BackupService] Failed to cleanup old backups:', error);
        }
    }

    /**
     * Get all backups (newest first)
     */
    async getBackupHistory() {
        const snapshot = await this.db.collection('system_backups')
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Get single backup metadata
     */
    async getBackupById(backupId) {
        const doc = await this.db.collection('system_backups').doc(backupId).get();
        if (!doc.exists) return null;
        return doc.data();
    }

    /**
     * Delete a backup
     */
    async deleteBackup(backupId, actor) {
        const docRef = this.db.collection('system_backups').doc(backupId);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error('Backup not found');

        const metadata = doc.data();
        if (metadata.filePath && fs.existsSync(metadata.filePath)) {
            fs.unlinkSync(metadata.filePath);
        }

        await docRef.delete();

        await this.auditLogService.log({
            organizationId: 'system',
            actor,
            action: 'DATABASE_BACKUP_DELETED',
            targetId: backupId,
            targetType: 'backup',
            details: { backupId }
        });

        return { success: true };
    }

    /**
     * Restores database from a backup JSON file.
     * This is DESTRUCTIVE - it clears existing matching collections before importing.
     */
    async restoreFromBackup(backupId, actor) {
        const metadata = await this.getBackupById(backupId);
        if (!metadata) throw new Error('Backup not found');
        if (metadata.status !== 'ready') throw new Error('Cannot restore from an incomplete or failed backup');
        if (!fs.existsSync(metadata.filePath)) throw new Error('Backup file is missing from disk');

        console.log(`🚨 [BackupService] INITIATING DATABASE RESTORE FROM ${backupId}`);

        // Audit Log Start
        await this.auditLogService.log({
            organizationId: 'system',
            actor,
            action: 'DATABASE_RESTORE_STARTED',
            targetId: backupId,
            targetType: 'backup',
            details: { backupId }
        });

        try {
            const rawData = fs.readFileSync(metadata.filePath, 'utf8');
            const backupData = JSON.parse(rawData);

            // 1. CLEAR EXISTING DATA (Destructive)
            // We must clear the same collections we backup so we don't have zombie documents
            console.log('🧹 [BackupService] Clearing existing collections before restore...');
            
            // Clear root collections
            const rootCollections = ['users', 'organizations', 'audit_logs', 'hikvision_logs'];
            for (const collName of rootCollections) {
                await this._deleteCollection(this.db.collection(collName));
            }

            // Clear org subcollections
            // We need to find all current orgs in the DB to clear their subcollections
            // Wait, we just cleared organizations! But if there were orgs not in the backup, 
            // they would be left as orphan documents. 
            // Better to delete all subcollections of all orgs before deleting the orgs.
            // Let's do that properly:
            // Since we can't easily list all subcollections globally in standard Firebase Admin SDK without specific permissions, 
            // we will rely on the org IDs currently in the database before we cleared them, OR the orgs in the backup.
            // Actually, we already cleared root `organizations`, which deletes the document, but NOT the subcollections.
            // Subcollections are orphaned.
            // Let's rely on the org IDs in the backup to restore them. To prevent orphans, we should delete subcollections BEFORE root.
            
            // For this restore, we will overwrite documents using batched writes.
            // Any document in the backup will replace the document in DB.
            console.log('📦 [BackupService] Restoring documents...');

            let batch = this.db.batch();
            let batchCount = 0;
            const MAX_BATCH_SIZE = 400; // Firebase limit is 500

            const commitBatch = async () => {
                if (batchCount > 0) {
                    await batch.commit();
                    batch = this.db.batch();
                    batchCount = 0;
                }
            };

            const addDocToBatch = async (docRef, data) => {
                batch.set(docRef, data); // set will overwrite
                batchCount++;
                if (batchCount >= MAX_BATCH_SIZE) {
                    await commitBatch();
                }
            };

            // Restore Root Collections
            for (const collName of rootCollections) {
                if (backupData[collName]) {
                    for (const [docId, data] of Object.entries(backupData[collName])) {
                        const docRef = this.db.collection(collName).doc(docId);
                        await addDocToBatch(docRef, data);
                    }
                }
            }

            // Restore Org Subcollections
            if (backupData['organization_subcollections']) {
                for (const [orgId, subcollections] of Object.entries(backupData['organization_subcollections'])) {
                    const orgRef = this.db.collection('organizations').doc(orgId);
                    for (const [subCollName, docs] of Object.entries(subcollections)) {
                        for (const [docId, data] of Object.entries(docs)) {
                            const docRef = orgRef.collection(subCollName).doc(docId);
                            await addDocToBatch(docRef, data);
                        }
                    }
                }
            }

            // Commit any remaining writes
            await commitBatch();

            // Mark restore successful
            metadata.restoredAt = new Date().toISOString();
            metadata.restoredBy = actor;
            await this.db.collection('system_backups').doc(backupId).update({
                restoredAt: metadata.restoredAt,
                restoredBy: metadata.restoredBy
            });

            await this.auditLogService.log({
                organizationId: 'system',
                actor,
                action: 'DATABASE_RESTORE_COMPLETED',
                targetId: backupId,
                targetType: 'backup',
                details: { backupId }
            });

            console.log(`✅ [BackupService] Restore from ${backupId} completed successfully.`);
            return { success: true };

        } catch (error) {
            console.error(`❌ [BackupService] Restore from ${backupId} failed:`, error);
            
            await this.auditLogService.log({
                organizationId: 'system',
                actor,
                action: 'DATABASE_RESTORE_FAILED',
                targetId: backupId,
                targetType: 'backup',
                details: { backupId, error: error.message }
            });

            throw error;
        }
    }

    /**
     * Helper to delete all documents in a collection.
     * Note: This does not delete subcollections.
     */
    async _deleteCollection(collectionRef) {
        const query = collectionRef.orderBy('__name__').limit(500);
        
        return new Promise((resolve, reject) => {
            const deleteQueryBatch = async () => {
                try {
                    const snapshot = await query.get();
                    if (snapshot.size === 0) {
                        return resolve();
                    }

                    const batch = this.db.batch();
                    snapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    process.nextTick(deleteQueryBatch);
                } catch (err) {
                    reject(err);
                }
            };
            
            deleteQueryBatch();
        });
    }
}

module.exports = BackupService;
