/**
 * LeaveRepository.js
 * 
 * Repository for managing leave requests within organizations.
 * Hierarchical structure: organizations/{orgId}/leaves/{leaveId}
 * 
 * Handles leave applications, approvals, and tracking.
 */

const BaseRepository = require('./BaseRepository');

class LeaveRepository extends BaseRepository {
  constructor(db) {
    super(db, 'leaves');
  }

  /**
   * Override: Get collection reference for specific organization
   * @param {string} orgId - Organization ID
   * @returns {FirebaseFirestore.CollectionReference}
   */
  getCollection(orgId) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    return this.db.collection('organizations').doc(orgId).collection('leaves');
  }

  /**
   * Create a new leave request
   * @param {string} orgId - Organization ID
   * @param {Object} data - Leave data
   * @returns {Promise<Object>} Created leave request
   */
  async create(orgId, data) {
    try {
      const docRef = this.getCollection(orgId).doc();
      const timestamp = new Date().toISOString();

      // Calculate number of days
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const diffMs = endDate - startDate;
      const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

      const leaveData = {
        id: docRef.id,
        userId: data.userId,
        userName: data.userName,
        organizationId: orgId,
        leaveType: data.leaveType, // sick, casual, vacation
        startDate: data.startDate, // YYYY-MM-DD
        endDate: data.endDate, // YYYY-MM-DD
        days,
        reason: data.reason || '',
        status: 'pending', // pending, approved, rejected
        // 👥 Team-lead approval routing
        approverId: data.approverId || null,
        approverName: data.approverName || null,
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewComments: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await docRef.set(leaveData);

      console.log(`✅ [LeaveRepository] Created leave request: ${docRef.id} for user ${data.userId}`);
      return leaveData;
    } catch (error) {
      console.error(`❌ [LeaveRepository] Create error:`, error);
      throw new Error(`Failed to create leave request: ${error.message}`);
    }
  }

  /**
   * Find leave request by ID
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @returns {Promise<Object|null>}
   */
  async findById(orgId, leaveId) {
    try {
      const doc = await this.getCollection(orgId).doc(leaveId).get();

      if (!doc.exists) {
        console.log(`⚠️ [LeaveRepository] Leave not found: ${leaveId}`);
        return null;
      }

      const data = { id: doc.id, ...doc.data() };
      console.log(`✅ [LeaveRepository] Found leave: ${leaveId}`);
      return data;
    } catch (error) {
      console.error(`❌ [LeaveRepository] FindById error:`, error);
      throw new Error(`Failed to find leave: ${error.message}`);
    }
  }

  /**
   * Get all leave requests for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Object} options - Options { status, limit }
   * @returns {Promise<Array>}
   */
  async findByUser(orgId, userId, options = {}) {
    try {
      let query = this.getCollection(orgId).where('userId', '==', userId);

      // Filter by status
      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      // Note: Removed orderBy to avoid composite index requirement
      // We'll sort client-side instead

      const snapshot = await query.get();

      let leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt client-side (most recent first)
      leaves.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      // Apply limit after sorting
      if (options.limit) {
        leaves = leaves.slice(0, options.limit);
      }

      console.log(`✅ [LeaveRepository] Found ${leaves.length} leave requests for user ${userId}`);
      return leaves;
    } catch (error) {
      console.error(`❌ [LeaveRepository] FindByUser error:`, error);
      throw new Error(`Failed to find user leaves: ${error.message}`);
    }
  }

  /**
   * Get all leave requests in organization
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Filters { status, userId, startDate, endDate }
   * @returns {Promise<Array>}
   */
  async findAll(orgId, filters = {}) {
    try {
      let query = this.getCollection(orgId);

      // Filter by status
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      // Filter by user
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      // Filter by date range (start date)
      if (filters.startDate) {
        query = query.where('startDate', '>=', filters.startDate);
      }
      if (filters.endDate) {
        query = query.where('startDate', '<=', filters.endDate);
      }

      // Order by creation date
      query = query.orderBy('createdAt', 'desc');

      // Apply limit
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();

      const leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ [LeaveRepository] Found ${leaves.length} leave requests in org ${orgId}`);
      return leaves;
    } catch (error) {
      console.error(`❌ [LeaveRepository] FindAll error:`, error);
      throw new Error(`Failed to find all leaves: ${error.message}`);
    }
  }

  /**
   * Get pending leave requests
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>}
   */
  async findPending(orgId) {
    try {
      return await this.findAll(orgId, { status: 'pending' });
    } catch (error) {
      console.error(`❌ [LeaveRepository] FindPending error:`, error);
      throw new Error(`Failed to find pending leaves: ${error.message}`);
    }
  }

  /**
   * Update leave status (approve/reject)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {Object} statusData - { status, reviewedBy, reviewedByName, reviewComments }
   * @returns {Promise<Object>}
   */
  async updateStatus(orgId, leaveId, statusData) {
    try {
      const docRef = this.getCollection(orgId).doc(leaveId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Leave request not found: ${leaveId}`);
      }

      const updateData = {
        status: statusData.status, // approved or rejected
        reviewedBy: statusData.reviewedBy,
        reviewedByName: statusData.reviewedByName,
        reviewedAt: new Date().toISOString(),
        reviewComments: statusData.reviewComments || null,
        updatedAt: new Date().toISOString()
      };

      await docRef.update(updateData);

      const updatedDoc = await docRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      console.log(`✅ [LeaveRepository] Updated leave status: ${leaveId} -> ${statusData.status}`);
      return result;
    } catch (error) {
      console.error(`❌ [LeaveRepository] UpdateStatus error:`, error);
      throw new Error(`Failed to update leave status: ${error.message}`);
    }
  }

  /**
   * Approve leave request
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reviewerName - Reviewer name
   * @param {string} comments - Optional comments
   * @returns {Promise<Object>}
   */
  async approve(orgId, leaveId, reviewerId, reviewerName, comments = null) {
    try {
      console.log(`✅ [LeaveRepository] Approving leave: ${leaveId} by ${reviewerName}`);
      return await this.updateStatus(orgId, leaveId, {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedByName: reviewerName,
        reviewComments: comments
      });
    } catch (error) {
      console.error(`❌ [LeaveRepository] Approve error:`, error);
      throw new Error(`Failed to approve leave: ${error.message}`);
    }
  }

  /**
   * Reject leave request
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reviewerName - Reviewer name
   * @param {string} comments - Optional comments
   * @returns {Promise<Object>}
   */
  async reject(orgId, leaveId, reviewerId, reviewerName, comments = null) {
    try {
      console.log(`❌ [LeaveRepository] Rejecting leave: ${leaveId} by ${reviewerName}`);
      return await this.updateStatus(orgId, leaveId, {
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedByName: reviewerName,
        reviewComments: comments
      });
    } catch (error) {
      console.error(`❌ [LeaveRepository] Reject error:`, error);
      throw new Error(`Failed to reject leave: ${error.message}`);
    }
  }

  /**
   * Delete leave request (only if pending)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @returns {Promise<boolean>}
   */
  async delete(orgId, leaveId) {
    try {
      const docRef = this.getCollection(orgId).doc(leaveId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Leave request not found: ${leaveId}`);
      }

      const leave = doc.data();

      // Only allow deletion of pending leaves
      if (leave.status !== 'pending') {
        throw new Error(`Cannot delete ${leave.status} leave request`);
      }

      await docRef.delete();

      console.log(`✅ [LeaveRepository] Deleted leave: ${leaveId}`);
      return true;
    } catch (error) {
      console.error(`❌ [LeaveRepository] Delete error:`, error);
      throw new Error(`Failed to delete leave: ${error.message}`);
    }
  }

  /**
   * Update leave request (only if pending)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async update(orgId, leaveId, data) {
    try {
      const docRef = this.getCollection(orgId).doc(leaveId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Leave request not found: ${leaveId}`);
      }

      const leave = doc.data();

      // Only allow updating pending leaves
      if (leave.status !== 'pending') {
        throw new Error(`Cannot update ${leave.status} leave request`);
      }

      // Recalculate days if dates changed
      let days = leave.days;
      if (data.startDate || data.endDate) {
        const startDate = new Date(data.startDate || leave.startDate);
        const endDate = new Date(data.endDate || leave.endDate);
        const diffMs = endDate - startDate;
        days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
      }

      const updateData = {
        ...data,
        days,
        updatedAt: new Date().toISOString()
      };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.userId;
      delete updateData.organizationId;
      delete updateData.status;
      delete updateData.reviewedBy;
      delete updateData.reviewedAt;
      delete updateData.createdAt;

      await docRef.update(updateData);

      const updatedDoc = await docRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      console.log(`✅ [LeaveRepository] Updated leave: ${leaveId}`);
      return result;
    } catch (error) {
      console.error(`❌ [LeaveRepository] Update error:`, error);
      throw new Error(`Failed to update leave: ${error.message}`);
    }
  }

  /**
   * Get leave statistics for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @returns {Promise<Object>}
   */
  async getUserStats(orgId, userId, year) {
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const leaves = await this.findByUser(orgId, userId);

      // Filter by year
      const yearLeaves = leaves.filter(leave => {
        const leaveYear = new Date(leave.startDate).getFullYear();
        return leaveYear === year;
      });

      const stats = {
        total: yearLeaves.length,
        totalDays: yearLeaves.reduce((sum, leave) => sum + leave.days, 0),
        byStatus: {
          pending: yearLeaves.filter(l => l.status === 'pending').length,
          approved: yearLeaves.filter(l => l.status === 'approved').length,
          rejected: yearLeaves.filter(l => l.status === 'rejected').length
        },
        byType: {
          sick: yearLeaves.filter(l => l.leaveType === 'sick').length,
          casual: yearLeaves.filter(l => l.leaveType === 'casual').length,
          vacation: yearLeaves.filter(l => l.leaveType === 'vacation').length
        },
        daysUsed: {
          sick: yearLeaves.filter(l => l.leaveType === 'sick' && l.status === 'approved')
            .reduce((sum, l) => sum + l.days, 0),
          casual: yearLeaves.filter(l => l.leaveType === 'casual' && l.status === 'approved')
            .reduce((sum, l) => sum + l.days, 0),
          vacation: yearLeaves.filter(l => l.leaveType === 'vacation' && l.status === 'approved')
            .reduce((sum, l) => sum + l.days, 0)
        }
      };

      console.log(`✅ [LeaveRepository] Stats for user ${userId} (${year}):`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ [LeaveRepository] GetUserStats error:`, error);
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  /**
   * Get organization leave statistics
   * @param {string} orgId - Organization ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>}
   */
  async getOrgStats(orgId, startDate, endDate) {
    try {
      const leaves = await this.findAll(orgId, { startDate, endDate });

      const stats = {
        total: leaves.length,
        totalDays: leaves.reduce((sum, leave) => sum + leave.days, 0),
        byStatus: {
          pending: leaves.filter(l => l.status === 'pending').length,
          approved: leaves.filter(l => l.status === 'approved').length,
          rejected: leaves.filter(l => l.status === 'rejected').length
        },
        byType: {
          sick: leaves.filter(l => l.leaveType === 'sick').length,
          casual: leaves.filter(l => l.leaveType === 'casual').length,
          vacation: leaves.filter(l => l.leaveType === 'vacation').length
        }
      };

      console.log(`✅ [LeaveRepository] Org stats from ${startDate} to ${endDate}:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ [LeaveRepository] GetOrgStats error:`, error);
      throw new Error(`Failed to get org stats: ${error.message}`);
    }
  }

  /**
   * Count leaves by status
   * @param {string} orgId - Organization ID
   * @param {string} status - Status (pending, approved, rejected)
   * @returns {Promise<number>}
   */
  async countByStatus(orgId, status) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('status', '==', status)
        .get();

      const count = snapshot.size;
      console.log(`✅ [LeaveRepository] Count for status ${status}: ${count}`);
      return count;
    } catch (error) {
      console.error(`❌ [LeaveRepository] CountByStatus error:`, error);
      throw new Error(`Failed to count by status: ${error.message}`);
    }
  }

  /**
   * Check if user has overlapping leave
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {string} excludeLeaveId - Exclude this leave ID from check
   * @returns {Promise<boolean>}
   */
  async hasOverlappingLeave(orgId, userId, startDate, endDate, excludeLeaveId = null) {
    try {
      const leaves = await this.findByUser(orgId, userId);

      // Filter approved and pending leaves
      const activeLeaves = leaves.filter(
        l => (l.status === 'approved' || l.status === 'pending') && l.id !== excludeLeaveId
      );

      // Check for overlaps
      const hasOverlap = activeLeaves.some(leave => {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        return (newStart <= leaveEnd && newEnd >= leaveStart);
      });

      console.log(`🔍 [LeaveRepository] Overlap check: ${hasOverlap ? 'FOUND' : 'NONE'}`);
      return hasOverlap;
    } catch (error) {
      console.error(`❌ [LeaveRepository] HasOverlappingLeave error:`, error);
      return false;
    }
  }

  /**
   * Find leave requests assigned to a specific approver (team lead)
   * @param {string} orgId - Organization ID
   * @param {string} approverId - Approver (team lead) user ID
   * @param {Object} options - Options { status }
   * @returns {Promise<Array>} Leave requests for the approver
   */
  async findByApprover(orgId, approverId, options = {}) {
    try {
      let query = this.getCollection(orgId)
        .where('approverId', '==', approverId);

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      const snapshot = await query.get();

      let leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt (most recent first)
      leaves.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      console.log(`✅ [LeaveRepository] Found ${leaves.length} leaves for approver ${approverId}`);
      return leaves;
    } catch (error) {
      console.error(`❌ [LeaveRepository] FindByApprover error:`, error);
      throw new Error(`Failed to find leaves by approver: ${error.message}`);
    }
  }

  /**
   * Update the approver of a leave request
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string|null} newApproverId - New approver user ID
   * @param {string|null} newApproverName - New approver name
   * @returns {Promise<void>}
   */
  async updateApprover(orgId, leaveId, newApproverId, newApproverName) {
    try {
      const docRef = this.getCollection(orgId).doc(leaveId);
      await docRef.update({
        approverId: newApproverId,
        approverName: newApproverName,
        updatedAt: new Date().toISOString()
      });
      console.log(`✅ [LeaveRepository] Updated approver for leave ${leaveId} to ${newApproverName || 'null'}`);
    } catch (error) {
      console.error(`❌ [LeaveRepository] UpdateApprover error:`, error);
      throw new Error(`Failed to update leave approver: ${error.message}`);
    }
  }
}

module.exports = LeaveRepository;

