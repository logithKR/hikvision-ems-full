/**
 * LeaveService.js (REFACTORED)
 * 
 * Business logic layer for leave request management.
 * Uses LeaveRepository for data access.
 * Uses UserRepository for user validation.
 * 
 * SOLID Principles:
 * - Single Responsibility: Only leave request business logic
 * - Dependency Inversion: Depends on abstractions (repositories)
 * - Open/Closed: Can extend without modifying existing code
 */

class LeaveService {
  /**
   * Constructor with dependency injection
   * @param {LeaveRepository} leaveRepository
   * @param {UserRepository} userRepository
   * @param {AuditLogService} auditLogService
   * @param {NotificationService} notificationService
   */
  constructor(leaveRepository, userRepository, auditLogService = null, notificationService = null) {
    this.leaveRepo = leaveRepository;
    this.userRepo = userRepository;
    this.auditService = auditLogService;
    this.notificationService = notificationService;
  }

  /**
   * Apply for leave (Employee)
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Object} leaveData - Leave request data
   * @returns {Promise<Object>} Created leave request
   */
  async applyForLeave(orgId, userId, leaveData) {
    console.log(`📝 LeaveService.applyForLeave() - User: ${userId}`);

    try {
      // 1. Validate user exists and is active
      const user = await this.userRepo.findById(orgId, userId);
      if (!user) {
        throw new Error('User not found');
      }
      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      // 2. Validate dates
      this.validateLeaveDates(leaveData.startDate, leaveData.endDate);

      // 3. Check for overlapping leaves
      const hasOverlap = await this.leaveRepo.hasOverlappingLeave(
        orgId,
        userId,
        leaveData.startDate,
        leaveData.endDate
      );

      if (hasOverlap) {
        throw new Error('You already have a leave request for this period. Please check your existing leaves.');
      }

      // 4. Validate leave type
      const validTypes = ['sick', 'casual', 'vacation', 'emergency', 'other'];
      if (!validTypes.includes(leaveData.leaveType)) {
        throw new Error(`Invalid leave type. Must be one of: ${validTypes.join(', ')}`);
      }

      // 5. Determine approver based on hierarchy
      // Manager → leave goes to Business Owner
      // Employee → leave goes to their Manager
      let approverId = null;
      let approverName = null;

      if (user.isManager) {
        // Manager's leave goes to Business Owner
        const boUsers = await this.userRepo.findByRole(orgId, 'business_owner');
        if (boUsers.length > 0) {
          approverId = boUsers[0].id;
          approverName = boUsers[0].name;
        }
        console.log(`🔀 Manager leave routed to Business Owner: ${approverId}`);
      } else if (user.departmentId) {
        // Employee → find their Manager
        const manager = await this.userRepo.getManager(orgId, user.departmentId);
        if (manager) {
          approverId = manager.id;
          approverName = manager.name;
        }
        console.log(`🔀 Employee leave routed to Manager: ${approverId}`);
      }

      // 6. Create leave request
      const leaveDataToCreate = {
        userId: user.id,
        userName: user.name,
        leaveType: leaveData.leaveType,
        startDate: leaveData.startDate,
        endDate: leaveData.endDate,
        reason: leaveData.reason || '',
        approverId: approverId,
        approverName: approverName,
        departmentId: user.departmentId || null
      };

      const leave = await this.leaveRepo.create(orgId, leaveDataToCreate);

      console.log(`✅ Leave request created: ${leave.id} (${leave.days} days) for approver: ${leave.approverId || 'Admin'}`);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: userId, name: user.name, role: user.role },
          action: 'LEAVE_CREATE',
          targetId: leave.id,
          targetType: 'leave_request',
          details: {
            type: leaveData.leaveType,
            dates: `${leaveData.startDate} to ${leaveData.endDate}`,
            approverId: leave.approverId
          }
        });
      }

      // Notification
      if (this.notificationService) {
        // If approver exists, notify them. Otherwise notify admins.
        if (leave.approverId) {
          this.notificationService.sendToUser(leave.approverId, 'leave:created', {
            leaveId: leave.id,
            userName: user.name,
            type: leaveData.leaveType
          });
        } else {
          this.notificationService.sendToOrgAdmins(orgId, 'leave:created', {
            leaveId: leave.id,
            userName: user.name,
            type: leaveData.leaveType
          });
        }
      }

      return leave;
    } catch (error) {
      console.error(`❌ LeaveService: Error applying for leave:`, error);
      throw new Error(`Failed to apply for leave: ${error.message}`);
    }
  }

  /**
   * Get leave request by ID
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @returns {Promise<Object|null>} Leave request
   */
  async getLeaveById(orgId, leaveId) {
    console.log(`🔍 LeaveService.getLeaveById() - ID: ${leaveId}`);

    try {
      const leave = await this.leaveRepo.findById(orgId, leaveId);

      if (!leave) {
        console.log(`⚠️ Leave request not found: ${leaveId}`);
        return null;
      }

      console.log(`✅ Leave request retrieved: ${leaveId}`);
      return leave;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting leave:`, error);
      throw new Error(`Failed to get leave request: ${error.message}`);
    }
  }

  /**
   * Get all leave requests for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Object} options - Options { status, limit }
   * @returns {Promise<Array>} User's leave requests
   */
  async getUserLeaves(orgId, userId, options = {}) {
    console.log(`📋 LeaveService.getUserLeaves() - User: ${userId}`);

    try {
      const leaves = await this.leaveRepo.findByUser(orgId, userId, options);

      console.log(`✅ Retrieved ${leaves.length} leave requests`);
      return leaves;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting user leaves:`, error);
      throw new Error(`Failed to get user leaves: ${error.message}`);
    }
  }

  /**
   * Get all leave requests in organization (Admin/Business Owner)
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Filters { status, userId, startDate, endDate }
   * @returns {Promise<Array>} Leave requests
   */
  async getAllLeaves(orgId, filters = {}) {
    console.log(`📋 LeaveService.getAllLeaves() - Org: ${orgId}`);

    try {
      const leaves = await this.leaveRepo.findAll(orgId, filters);

      console.log(`✅ Retrieved ${leaves.length} leave requests`);
      return leaves;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting all leaves:`, error);
      throw new Error(`Failed to get all leaves: ${error.message}`);
    }
  }

  /**
   * Get pending leave requests (for Admin approval)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Pending leave requests
   */
  async getPendingLeaves(orgId) {
    console.log(`⏳ LeaveService.getPendingLeaves() - Org: ${orgId}`);

    try {
      const pendingLeaves = await this.leaveRepo.findPending(orgId);

      console.log(`✅ Retrieved ${pendingLeaves.length} pending leave requests`);
      return pendingLeaves;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting pending leaves:`, error);
      throw new Error(`Failed to get pending leaves: ${error.message}`);
    }
  }

  /**
   * Approve leave request (Admin only)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} comments - Optional comments
   * @returns {Promise<Object>} Updated leave request
   */
  async approveLeave(orgId, leaveId, reviewerId, comments = null) {
    console.log(`✅ LeaveService.approveLeave() - Leave: ${leaveId}, Reviewer: ${reviewerId}`);

    try {
      // 1. Validate leave exists and is pending
      const leave = await this.leaveRepo.findById(orgId, leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }
      if (leave.status !== 'pending') {
        throw new Error(`Cannot approve leave with status: ${leave.status}`);
      }

      // 2. Get reviewer info
      const reviewer = await this.userRepo.findById(orgId, reviewerId);
      if (!reviewer) {
        throw new Error('Reviewer not found');
      }

      // 3. Approve leave
      const approved = await this.leaveRepo.approve(
        orgId,
        leaveId,
        reviewerId,
        reviewer.name,
        comments
      );

      console.log(`✅ Leave approved: ${leaveId} by ${reviewer.name}`);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: reviewerId, name: reviewer.name, role: reviewer.role },
          action: 'LEAVE_APPROVE',
          targetId: leaveId,
          targetType: 'leave_request',
          details: { comments, applicantId: leave.userId }
        });
      }

      // Notification
      if (this.notificationService) {
        this.notificationService.sendToUser(leave.userId, 'leave:approved', {
          leaveId,
          reviewerName: reviewer.name,
          status: 'approved'
        });
      }

      return approved;
    } catch (error) {
      console.error(`❌ LeaveService: Error approving leave:`, error);
      throw new Error(`Failed to approve leave: ${error.message}`);
    }
  }

  /**
   * Reject leave request (Admin only)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} comments - Rejection reason
   * @returns {Promise<Object>} Updated leave request
   */
  async rejectLeave(orgId, leaveId, reviewerId, comments = null) {
    console.log(`❌ LeaveService.rejectLeave() - Leave: ${leaveId}, Reviewer: ${reviewerId}`);

    try {
      // 1. Validate leave exists and is pending
      const leave = await this.leaveRepo.findById(orgId, leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }
      if (leave.status !== 'pending') {
        throw new Error(`Cannot reject leave with status: ${leave.status}`);
      }

      // 2. Get reviewer info
      const reviewer = await this.userRepo.findById(orgId, reviewerId);
      if (!reviewer) {
        throw new Error('Reviewer not found');
      }

      // 3. Reject leave
      const rejected = await this.leaveRepo.reject(
        orgId,
        leaveId,
        reviewerId,
        reviewer.name,
        comments || null
      );

      console.log(`❌ Leave rejected: ${leaveId} by ${reviewer.name}`);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: reviewerId, name: reviewer.name, role: reviewer.role },
          action: 'LEAVE_REJECT',
          targetId: leaveId,
          targetType: 'leave_request',
          details: { comments, applicantId: leave.userId }
        });
      }

      // Notification
      if (this.notificationService) {
        this.notificationService.sendToUser(leave.userId, 'leave:rejected', {
          leaveId,
          reviewerName: reviewer.name,
          status: 'rejected'
        });
      }

      return rejected;
    } catch (error) {
      console.error(`❌ LeaveService: Error rejecting leave:`, error);
      throw new Error(`Failed to reject leave: ${error.message}`);
    }
  }

  /**
   * Update leave request (Employee, only if pending)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} userId - User ID (for authorization)
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated leave request
   */
  async updateLeave(orgId, leaveId, userId, updateData) {
    console.log(`📝 LeaveService.updateLeave() - Leave: ${leaveId}`);

    try {
      // 1. Validate leave exists
      const leave = await this.leaveRepo.findById(orgId, leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }

      // 2. Validate ownership
      if (leave.userId !== userId) {
        throw new Error('You can only update your own leave requests');
      }

      // 3. Validate leave is pending
      if (leave.status !== 'pending') {
        throw new Error('Cannot update leave that has already been reviewed');
      }

      // 4. Validate dates if updating
      if (updateData.startDate || updateData.endDate) {
        const startDate = updateData.startDate || leave.startDate;
        const endDate = updateData.endDate || leave.endDate;
        this.validateLeaveDates(startDate, endDate);

        // Check for overlaps (excluding current leave)
        const hasOverlap = await this.leaveRepo.hasOverlappingLeave(
          orgId,
          userId,
          startDate,
          endDate,
          leaveId // Exclude this leave from overlap check
        );

        if (hasOverlap) {
          throw new Error('Updated dates overlap with another leave request');
        }
      }

      // 5. Update leave
      const updated = await this.leaveRepo.update(orgId, leaveId, updateData);

      console.log(`✅ Leave updated: ${leaveId}`);
      return updated;
    } catch (error) {
      console.error(`❌ LeaveService: Error updating leave:`, error);
      throw new Error(`Failed to update leave: ${error.message}`);
    }
  }

  /**
   * Cancel/Delete leave request (Employee, only if pending)
   * @param {string} orgId - Organization ID
   * @param {string} leaveId - Leave ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} True if deleted
   */
  async cancelLeave(orgId, leaveId, userId) {
    console.log(`🗑️ LeaveService.cancelLeave() - Leave: ${leaveId}`);

    try {
      // 1. Validate leave exists
      const leave = await this.leaveRepo.findById(orgId, leaveId);
      if (!leave) {
        throw new Error('Leave request not found');
      }

      // 2. Validate ownership
      if (leave.userId !== userId) {
        throw new Error('You can only cancel your own leave requests');
      }

      // 3. Validate leave is pending
      if (leave.status !== 'pending') {
        throw new Error('Cannot cancel leave that has already been reviewed');
      }

      // 4. Delete leave
      await this.leaveRepo.delete(orgId, leaveId);

      console.log(`✅ Leave cancelled: ${leaveId}`);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: userId, name: 'User', role: 'employee' }, // Fetch user if needed, but userId is known
          action: 'LEAVE_CANCEL',
          targetId: leaveId,
          targetType: 'leave_request',
          details: { cancelledBy: userId }
        });
      }

      return true;
    } catch (error) {
      console.error(`❌ LeaveService: Error cancelling leave:`, error);
      throw new Error(`Failed to cancel leave: ${error.message}`);
    }
  }

  /**
   * Get leave statistics for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @returns {Promise<Object>} Leave statistics
   */
  async getUserLeaveStats(orgId, userId, year = new Date().getFullYear()) {
    console.log(`📊 LeaveService.getUserLeaveStats() - User: ${userId}, Year: ${year}`);

    try {
      const stats = await this.leaveRepo.getUserStats(orgId, userId, year);

      console.log(`✅ Leave stats generated for user:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting user leave stats:`, error);
      throw new Error(`Failed to get user leave stats: ${error.message}`);
    }
  }

  /**
   * Get organization leave statistics
   * @param {string} orgId - Organization ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Organization leave statistics
   */
  async getOrgLeaveStats(orgId, startDate, endDate) {
    console.log(`📊 LeaveService.getOrgLeaveStats() - Org: ${orgId}`);

    try {
      const stats = await this.leaveRepo.getOrgStats(orgId, startDate, endDate);

      console.log(`✅ Organization leave stats generated:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting org leave stats:`, error);
      throw new Error(`Failed to get org leave stats: ${error.message}`);
    }
  }

  /**
   * Get leave summary (counts by status)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Leave summary
   */
  async getLeaveSummary(orgId) {
    console.log(`📊 LeaveService.getLeaveSummary() - Org: ${orgId}`);

    try {
      const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
        this.leaveRepo.countByStatus(orgId, 'pending'),
        this.leaveRepo.countByStatus(orgId, 'approved'),
        this.leaveRepo.countByStatus(orgId, 'rejected')
      ]);

      const summary = {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount
      };

      console.log(`✅ Leave summary generated:`, summary);
      return summary;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting leave summary:`, error);
      throw new Error(`Failed to get leave summary: ${error.message}`);
    }
  }

  /**
   * Get leaves for a specific date range
   * @param {string} orgId - Organization ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Leave requests in date range
   */
  async getLeavesByDateRange(orgId, startDate, endDate) {
    console.log(`📅 LeaveService.getLeavesByDateRange() - ${startDate} to ${endDate}`);

    try {
      this.validateLeaveDates(startDate, endDate);

      const leaves = await this.getAllLeaves(orgId, {
        startDate,
        endDate
      });

      console.log(`✅ Retrieved ${leaves.length} leaves in date range`);
      return leaves;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting leaves by date range:`, error);
      throw new Error(`Failed to get leaves by date range: ${error.message}`);
    }
  }

  /**
   * Check if user has leave on a specific date
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} date - Date to check (YYYY-MM-DD)
   * @returns {Promise<Object|null>} Leave request if on leave, null otherwise
   */
  async isUserOnLeave(orgId, userId, date) {
    console.log(`🔍 LeaveService.isUserOnLeave() - User: ${userId}, Date: ${date}`);

    try {
      const leaves = await this.getUserLeaves(orgId, userId, { status: 'approved' });

      // Check if date falls within any approved leave
      const leaveOnDate = leaves.find(leave => {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        const checkDate = new Date(date);

        return checkDate >= leaveStart && checkDate <= leaveEnd;
      });

      if (leaveOnDate) {
        console.log(`✅ User is on leave: ${leaveOnDate.leaveType}`);
        return leaveOnDate;
      }

      console.log(`❌ User is not on leave`);
      return null;
    } catch (error) {
      console.error(`❌ LeaveService: Error checking if user is on leave:`, error);
      return null;
    }
  }

  /**
   * Validate leave dates
   * @private
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @throws {Error} If dates are invalid
   */
  validateLeaveDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if end date is after start date
    if (end < start) {
      throw new Error('End date must be after start date');
    }

    // Check if dates are not in the past
    if (start < today) {
      throw new Error('Cannot apply for leave in the past');
    }

    // Check if leave duration is reasonable (e.g., max 90 days)
    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 90) {
      throw new Error('Leave duration cannot exceed 90 days. Please contact HR for extended leave.');
    }
  }

  /**
   * Get upcoming leaves for organization (next 30 days)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Upcoming approved leaves
   */
  async getUpcomingLeaves(orgId) {
    console.log(`📅 LeaveService.getUpcomingLeaves() - Org: ${orgId}`);

    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);

      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const leaves = await this.getAllLeaves(orgId, {
        status: 'approved',
        startDate: startDateStr,
        endDate: endDateStr
      });

      console.log(`✅ Retrieved ${leaves.length} upcoming leaves`);
      return leaves;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting upcoming leaves:`, error);
      throw new Error(`Failed to get upcoming leaves: ${error.message}`);
    }
  }

  /**
   * Get leave balance for user (if your system has leave quotas)
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @returns {Promise<Object>} Leave balance
   */
  async getUserLeaveBalance(orgId, userId, year = new Date().getFullYear()) {
    console.log(`💰 LeaveService.getUserLeaveBalance() - User: ${userId}`);

    try {
      const stats = await this.getUserLeaveStats(orgId, userId, year);

      // Define leave quotas (can be fetched from organization settings)
      const quotas = {
        vacation: 15,
        sick: 10,
        casual: 5,
        emergency: 3,
        other: 2
      };

      const balance = {
        vacation: {
          total: quotas.vacation,
          used: stats.daysUsed.vacation || 0,
          remaining: Math.max(0, quotas.vacation - (stats.daysUsed.vacation || 0))
        },
        sick: {
          total: quotas.sick,
          used: stats.daysUsed.sick || 0,
          remaining: Math.max(0, quotas.sick - (stats.daysUsed.sick || 0))
        },
        casual: {
          total: quotas.casual,
          used: stats.daysUsed.casual || 0,
          remaining: Math.max(0, quotas.casual - (stats.daysUsed.casual || 0))
        },
        emergency: {
          total: quotas.emergency,
          used: stats.daysUsed.emergency || 0,
          remaining: Math.max(0, quotas.emergency - (stats.daysUsed.emergency || 0))
        },
        other: {
          total: quotas.other,
          used: stats.daysUsed.other || 0,
          remaining: Math.max(0, quotas.other - (stats.daysUsed.other || 0))
        }
      };

      console.log(`✅ Leave balance calculated:`, balance);
      return balance;
    } catch (error) {
      console.error(`❌ LeaveService: Error getting leave balance:`, error);
      throw new Error(`Failed to get leave balance: ${error.message}`);
    }
  }

  /**
   * Get pending leaves for a team lead
   * @param {string} orgId - Organization ID
   * @param {string} leaderId - Team lead user ID
   * @returns {Promise<Array>} Pending leaves
   */
  async getTeamPendingLeaves(orgId, leaderId) {
    const leaves = await this.leaveRepo.findByApprover(orgId, leaderId, { status: 'pending' });
    return await this.attachUserDetails(orgId, leaves);
  }

  /**
   * Get leave history (approved/rejected) for a team lead
   * @param {string} orgId - Organization ID
   * @param {string} leaderId - Team lead user ID
   * @returns {Promise<Array>} Leave history
   */
  async getTeamLeaveHistory(orgId, leaderId) {
    return await this.getDeptLeaveHistory(orgId, leaderId);
  }

  /**
   * Attach user details (email, avatar) to leaves
   * @private
   */
  async attachUserDetails(orgId, leaves) {
    if (!leaves.length) return [];

    // Get unique user IDs
    const userIds = [...new Set(leaves.map(l => l.userId))];

    // Fetch users in parallel
    const users = await Promise.all(
      userIds.map(uid => this.userRepo.findById(orgId, uid).catch(() => null))
    );

    const userMap = new Map(users.filter(u => u).map(u => [u.id, u]));

    return leaves.map(leave => {
      const user = userMap.get(leave.userId);
      return {
        ...leave,
        userEmail: user?.email || '',
        userAvatar: user?.avatar || null
      };
    });
  }

  /**
   * Get pending leaves for a Manager (leaves where they are the approver)
   * @param {string} orgId - Organization ID
   * @param {string} managerId - Manager user ID
   * @returns {Promise<Array>} Pending leaves addressed to this Manager
   */
  async getDeptPendingLeaves(orgId, managerId) {
    const leaves = await this.leaveRepo.findByApprover(orgId, managerId, { status: 'pending' });
    return await this.attachUserDetails(orgId, leaves);
  }

  /**
   * Get leave history for a Manager
   * @param {string} orgId - Organization ID
   * @param {string} hodId - Department Head user ID
   * @returns {Promise<Array>} Approved/rejected leaves
   */
  async getDeptLeaveHistory(orgId, hodId) {
    const user = await this.userRepo.findById(orgId, hodId);
    if (!user) return [];

    let memberIds = [];

      if (user.isManager && user.departmentId) {
      // Manager: get all department members
      const members = await this.userRepo.findByDepartment(orgId, user.departmentId);
      memberIds = members.map(m => m.id).filter(id => id !== hodId);
    }

    if (memberIds.length === 0) return [];

    // Get all leaves for these members
    const allLeaves = await this.leaveRepo.findAll(orgId, {});
    
    // Filter for approved and rejected leaves
    const teamHistory = allLeaves.filter(
      l => memberIds.includes(l.userId) && (l.status === 'approved' || l.status === 'rejected')
    );

    teamHistory.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return await this.attachUserDetails(orgId, teamHistory);
  }
}

module.exports = LeaveService;
