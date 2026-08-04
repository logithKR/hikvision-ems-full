/**
 * AuditLogRepository.js
 * 
 * Repository for storing audit logs.
 * Collection: 'audit_logs' (Root collection for system-wide access, or per-org if preferred)
 * 
 * Structure:
 * - id
 * - organizationId
 * - actorId (who performed action)
 * - actorName
 * - actorRole
 * - action (e.g., 'CREATE_EMPLOYEE', 'APPROVE_LEAVE')
 * - targetId (e.g., employeeId, leaveId)
 * - targetType (e.g., 'employee', 'leave_request')
 * - details (JSON object with metadata)
 * - ipAddress
 * - timestamp
 */

const BaseRepository = require('./BaseRepository');

class AuditLogRepository extends BaseRepository {
    constructor(db) {
        super(db, 'audit_logs');
    }

    /**
     * Create a new audit log entry
     * @param {Object} logData
     * @returns {Promise<Object>} Created log
     */
    async create(logData) {
        try {
            const docRef = this.getCollection().doc();
            const timestamp = new Date().toISOString();

            const logEntry = {
                id: docRef.id,
                organizationId: logData.organizationId,
                actorId: logData.actorId,
                actorName: logData.actorName,
                actorRole: logData.actorRole,
                action: logData.action,
                targetId: logData.targetId || null,
                targetType: logData.targetType || null,
                details: logData.details || {},
                ipAddress: logData.ipAddress || null,
                timestamp: timestamp,
                createdAt: timestamp
            };

            await docRef.set(logEntry);

            console.log(`📝 [AuditLogRepository] Logged action: ${logData.action} by ${logData.actorName}`);
            return logEntry;
        } catch (error) {
            console.error(`❌ [AuditLogRepository] Create error:`, error);
            // Don't throw, just log error so we don't break the main flow
            return null;
        }
    }

    /**
     * Find logs by organization
     * @param {string} organizationId
     * @param {Object} options { limit, offset }
     * @returns {Promise<Array>}
     */
    async findByOrganization(organizationId, options = {}) {
        try {
            let query = this.getCollection().where('organizationId', '==', organizationId);

            // Sort by timestamp desc (requires index)
            // query = query.orderBy('timestamp', 'desc');

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();

            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Manual sort if index doesn't exist yet
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return logs;
        } catch (error) {
            console.error(`❌ [AuditLogRepository] FindByOrganization error:`, error);
            throw new Error(`Failed to get audit logs: ${error.message}`);
        }
    }
}

module.exports = AuditLogRepository;
