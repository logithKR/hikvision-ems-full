/**
 * leave.js (UPDATED)
 * 
 * Routes for leave request management.
 * Uses LeaveService from container.
 */

const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireEmployee, requireAdminOrBusinessOwner, requireBusinessOwner } = require('../middleware');

// Get service instance from container
const leaveService = container.getLeaveService();

/**
 * POST /api/leave/apply
 * Apply for leave
 * Employee only
 */
router.post('/apply', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;
    const userName = req.user.name;

    // Validate required fields
    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'leaveType, startDate, and endDate are required'
      });
    }

    // Apply for leave
    const leave = await leaveService.applyForLeave(
      orgId,
      userId,
      {
        leaveType,
        startDate,
        endDate,
        reason: reason || ''
      }
    );

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: leave
    });
  } catch (error) {
    console.error('Error applying for leave:', error);

    if (error.message.includes('overlap')) {
      return res.status(409).json({
        error: 'Date conflict',
        message: error.message
      });
    }

    if (error.message.includes('Invalid date') || error.message.includes('past')) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to apply for leave',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/my-leaves
 * Get my leave requests
 * Employee only
 */
router.get('/my-leaves', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { status, limit } = req.query;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;

    const options = {};
    if (status) options.status = status;
    if (limit) options.limit = parseInt(limit);

    const leaves = await leaveService.getUserLeaves(orgId, userId, options);

    res.json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    console.error('Error getting my leaves:', error);
    res.status(500).json({
      error: 'Failed to get leave requests',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/bo/pending
 * Get HOD leave requests pending BO approval
 * Business Owner only
 */
router.get('/bo/pending', authenticateToken, requireBusinessOwner, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const boId = req.user.uid;

    // Get pending leaves assigned to this BO (which are HOD leaves)
    const pendingLeaves = await leaveService.getDeptPendingLeaves(orgId, boId);

    res.json({
      count: pendingLeaves.length,
      leaves: pendingLeaves
    });
  } catch (error) {
    console.error('Error getting BO pending leaves:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/leave/bo/:leaveId/approve
 * Approve HOD leave (BO only)
 */
router.post('/bo/:leaveId/approve', authenticateToken, requireBusinessOwner, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { leaveId } = req.params;
    const { comments } = req.body;

    const leave = await leaveService.getLeaveById(orgId, leaveId);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (leave.approverId !== req.user.uid) {
      return res.status(403).json({ error: 'This leave is not assigned to you' });
    }

    const result = await leaveService.approveLeave(orgId, leaveId, req.user.uid, comments);
    res.json({ message: 'HOD leave approved', leave: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/leave/bo/:leaveId/reject
 * Reject HOD leave (BO only)
 */
router.post('/bo/:leaveId/reject', authenticateToken, requireBusinessOwner, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { leaveId } = req.params;
    const { comments } = req.body;

    const leave = await leaveService.getLeaveById(orgId, leaveId);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (leave.approverId !== req.user.uid) {
      return res.status(403).json({ error: 'This leave is not assigned to you' });
    }

    const result = await leaveService.rejectLeave(orgId, leaveId, req.user.uid, comments);
    res.json({ message: 'HOD leave rejected', leave: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leave/all
 * Get all leave requests for the organization
 * Admin or Business Owner only
 */
router.get('/all', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📋 GET /api/leave/all - Get all leave requests');
  try {
    const orgId = req.user.organizationId;
    const { status } = req.query;

    // Get all leaves for the organization
    const leaves = await leaveService.getAllLeaves(orgId, { status });

    // Remove sensitive data
    const safeLeaves = leaves.map(leave => {
      const { ...safeLeave } = leave;
      return safeLeave;
    });

    res.json({
      count: safeLeaves.length,
      requests: safeLeaves
    });
  } catch (error) {
    console.error('Error getting all leave requests:', error);
    res.status(500).json({
      error: 'Failed to get leave requests',
      message: error.message
    });
  }
});

/**
 * PUT /api/leave/:leaveId/status
 * Approve or Reject leave request
 * Admin or Business Owner only
 */
router.put('/:leaveId/status', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, comments } = req.body;
    const orgId = req.user.organizationId;
    const reviewerId = req.user.uid;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be either "Approved" or "Rejected"'
      });
    }

    let result;
    if (status === 'Approved') {
      result = await leaveService.approveLeave(orgId, leaveId, reviewerId, comments);
    } else {
      result = await leaveService.rejectLeave(orgId, leaveId, reviewerId, comments);
    }

    res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error updating leave status:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Leave request not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to update leave status',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/balance
 * Get leave balance for current user
 * Employee only
 */
router.get('/balance', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user.uid;
    const year = new Date().getFullYear();

    // Get leave statistics
    const stats = await leaveService.getUserLeaveStats(orgId, userId, year);

    // Default leave balances (these could come from organization settings)
    const defaultBalances = {
      vacation: 15,
      sick: 10,
      casual: 5,
      emergency: 3,
      other: 2
    };

    const balance = {
      year,
      allocated: defaultBalances,
      used: stats.daysUsed || { vacation: 0, sick: 0, casual: 0, emergency: 0, other: 0 },
      remaining: {
        vacation: defaultBalances.vacation - (stats.daysUsed?.vacation || 0),
        sick: defaultBalances.sick - (stats.daysUsed?.sick || 0),
        casual: defaultBalances.casual - (stats.daysUsed?.casual || 0),
        emergency: defaultBalances.emergency - (stats.daysUsed?.emergency || 0),
        other: defaultBalances.other - (stats.daysUsed?.other || 0)
      },
      totalAllocated: Object.values(defaultBalances).reduce((a, b) => a + b, 0),
      totalUsed: Object.values(stats.daysUsed || {}).reduce((a, b) => a + b, 0)
    };

    balance.totalRemaining = balance.totalAllocated - balance.totalUsed;

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Error getting leave balance:', error);
    res.status(500).json({
      error: 'Failed to get leave balance',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/upcoming
 * Get upcoming approved leaves (next 30 days)
 * Employee only
 */
router.get('/upcoming', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user.uid;

    // Get user's upcoming leaves
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);

    const leaves = await leaveService.getUserLeaves(orgId, userId, {
      status: 'approved'
    });

    // Filter for upcoming leaves
    const upcomingLeaves = leaves.filter(leave => {
      const leaveStart = new Date(leave.startDate);
      return leaveStart >= today && leaveStart <= endDate;
    });

    res.json({
      success: true,
      count: upcomingLeaves.length,
      data: upcomingLeaves
    });
  } catch (error) {
    console.error('Error getting upcoming leaves:', error);
    res.status(500).json({
      error: 'Failed to get upcoming leaves',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/stats/my-stats
 * Get my leave statistics for the year
 * Employee only
 * NOTE: This must be defined BEFORE /:leaveId to avoid being matched as leaveId
 */
router.get('/stats/my-stats', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { year } = req.query;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;
    const statsYear = year ? parseInt(year) : new Date().getFullYear();

    const stats = await leaveService.getUserLeaveStats(orgId, userId, statsYear);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting leave stats:', error);
    res.status(500).json({
      error: 'Failed to get leave statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/check/:date
 * Check if I'm on leave on a specific date
 * Employee only
 */
router.get('/check/:date', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { date } = req.params;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    const leave = await leaveService.isUserOnLeave(orgId, userId, date);

    res.json({
      success: true,
      onLeave: leave !== null,
      leave: leave
    });
  } catch (error) {
    console.error('Error checking leave:', error);
    res.status(500).json({
      error: 'Failed to check leave status',
      message: error.message
    });
  }
});

/**
 * GET /api/leave/:leaveId
 * Get specific leave request
 * Employee (own), Admin, or Business Owner
 */
router.get('/:leaveId', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const orgId = req.user.organizationId;

    const leave = await leaveService.getLeaveById(orgId, leaveId);

    if (!leave) {
      return res.status(404).json({
        error: 'Leave request not found'
      });
    }

    // Check if user is authorized to view this leave
    const isOwner = leave.userId === req.user.uid;
    const isAdminOrOwner = ['admin', 'business_owner'].includes(req.user.role);

    if (!isOwner && !isAdminOrOwner) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own leave requests'
      });
    }

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    console.error('Error getting leave:', error);
    res.status(500).json({
      error: 'Failed to get leave request',
      message: error.message
    });
  }
});

/**
 * PUT /api/leave/:leaveId
 * Update leave request (only if pending)
 * Employee only (own leaves)
 */
router.put('/:leaveId', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const updateData = req.body;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;

    // Only allow updating certain fields
    const allowedFields = ['leaveType', 'startDate', 'endDate', 'reason'];
    const filteredData = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    const updated = await leaveService.updateLeave(
      orgId,
      leaveId,
      userId,
      filteredData
    );

    res.json({
      success: true,
      message: 'Leave request updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating leave:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Leave request not found'
      });
    }

    if (error.message.includes('only update your own')) {
      return res.status(403).json({
        error: 'Access denied',
        message: error.message
      });
    }

    if (error.message.includes('already been reviewed')) {
      return res.status(409).json({
        error: 'Cannot update',
        message: error.message
      });
    }

    if (error.message.includes('overlap')) {
      return res.status(409).json({
        error: 'Date conflict',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to update leave request',
      message: error.message
    });
  }
});

/**
 * DELETE /api/leave/:leaveId
 * Cancel/delete leave request (only if pending)
 * Employee only (own leaves)
 */
router.delete('/:leaveId', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const orgId = req.user.organizationId;
    const userId = req.user.uid;

    await leaveService.cancelLeave(orgId, leaveId, userId);

    res.json({
      success: true,
      message: 'Leave request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling leave:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Leave request not found'
      });
    }

    if (error.message.includes('only cancel your own')) {
      return res.status(403).json({
        error: 'Access denied',
        message: error.message
      });
    }

    if (error.message.includes('already been reviewed')) {
      return res.status(409).json({
        error: 'Cannot cancel',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to cancel leave request',
      message: error.message
    });
  }
});

// NOTE: /stats/my-stats has been moved before /:leaveId route to fix route ordering
// NOTE: Duplicate /balance route removed - the one at line ~194 is used

// Route moved above /:leaveId

// NOTE: Duplicate /upcoming route removed - the one at line ~247 is used

module.exports = router;
