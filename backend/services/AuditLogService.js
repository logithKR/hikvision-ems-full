/**
 * AuditLogService.js
 * 
 * Service for creating and retrieving audit logs.
 * Abstraction layer over AuditLogRepository.
 */

class AuditLogService {
    /**
     * @param {AuditLogRepository} auditLogRepository
     */
    constructor(auditLogRepository) {
        this.auditRepo = auditLogRepository;
    }

    /**
     * Log an action
     * @param {Object} params
     * @param {string} params.organizationId
     * @param {Object} params.actor - User performing action { uid, name, role }
     * @param {string} params.action - Action code (e.g. 'EMPLOYEE_CREATE')
     * @param {string} params.targetId - ID of affected object
     * @param {string} params.targetType - Type of affected object
     * @param {Object} params.details - Additional metadata
     * @param {string} params.ipAddress - Optional IP
     */
    async log(params) {
        const {
            organizationId,
            actor,
            action,
            targetId,
            targetType,
            details,
            ipAddress
        } = params;

        if (!actor || !action || (!organizationId && organizationId !== 'system')) {
            console.warn('⚠️ [AuditLogService] Missing required fields for log');
            return;
        }

        /* 
          actor object should ideally come from req.user:
          {
            uid: '...',
            name: '...',
            role: '...'
          }
        */

        return await this.auditRepo.create({
            organizationId,
            actorId: actor.uid || actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            action,
            targetId,
            targetType,
            details,
            ipAddress
        });
    }

    /**
     * Get logs for an organization
     * @param {string} organizationId 
     * @param {number} limit 
     */
    async getOrganizationLogs(organizationId, limit = 50) {
        return await this.auditRepo.findByOrganization(organizationId, { limit });
    }
}

module.exports = AuditLogService;
