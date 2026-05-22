/**
 * team.js
 * 
 * Routes for Team Lead / Manager / HOD management.
 * HODs can view dept members/attendance and approve/reject dept leaves.
 * Managers can view their direct reports and attendance.
 */

const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireTeamLead, requireDeptHead } = require('../middleware');

// Get services
const userRepo = container.getUserRepo();
const attendanceService = container.getAttendanceService();
const leaveService = container.getLeaveService();

// Middleware to ensure user is authenticated and authorized as a team lead/manager/HOD
router.use(authenticateToken, requireTeamLead);

// ============================================
// TEAM MEMBER ROUTES (Manager + HOD)
// ============================================

/**
 * GET /api/team/members
 * Get direct reports (for managers) or dept members (for HOD)
 */
router.get('/members', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const user = await userRepo.findById(organizationId, uid);

        let members = [];

        if (user.isDeptHead && user.departmentId) {
            // HOD: get all department members
            members = await userRepo.findByDepartment(organizationId, user.departmentId);
            members = members.filter(m => m.id !== uid); // exclude self
        } else {
            // Manager: get direct reports
            members = await userRepo.getDirectReports(organizationId, uid);
        }

        const safeMembers = members.map(m => {
            const { passwordHash, ...safe } = m;
            return safe;
        });

        res.json({ count: safeMembers.length, members: safeMembers });
    } catch (error) {
        console.error('❌ Error getting team members:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ATTENDANCE ROUTES (Manager + HOD)
// ============================================

/**
 * GET /api/team/attendance
 * Get today's attendance for team/department
 */
router.get('/attendance', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const teamAttendance = await attendanceService.getTeamAttendance(organizationId, uid, date);

        res.json({ date, count: teamAttendance.length, attendance: teamAttendance });
    } catch (error) {
        console.error('❌ Error getting team attendance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/team/attendance/weekly
 * Get weekly hours for the team
 */
router.get('/attendance/weekly', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const { weekStart, weekEnd } = req.query;

        if (!weekStart || !weekEnd) {
            return res.status(400).json({ error: 'weekStart and weekEnd are required' });
        }

        const teamHours = await attendanceService.getTeamWeeklyHours(organizationId, uid, weekStart, weekEnd);

        res.json({ weekStart, weekEnd, data: teamHours });
    } catch (error) {
        console.error('❌ Error getting team weekly hours:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HOD DEPARTMENT VIEW
// ============================================

/**
 * GET /api/team/department/members
 * Get all department members (HOD only)
 */
router.get('/department/members', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const user = await userRepo.findById(organizationId, uid);

        if (!user.isDeptHead || !user.departmentId) {
            return res.status(403).json({ error: 'Only Department Heads can access this' });
        }

        const members = await userRepo.findByDepartment(organizationId, user.departmentId);
        const safeMembers = members.filter(m => m.id !== uid).map(m => {
            const { passwordHash, ...safe } = m;
            return safe;
        });

        res.json({ count: safeMembers.length, members: safeMembers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/team/department/attendance
 * Get department attendance (HOD only)
 */
router.get('/department/attendance', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const user = await userRepo.findById(organizationId, uid);

        if (!user.isDeptHead || !user.departmentId) {
            return res.status(403).json({ error: 'Only Department Heads can access this' });
        }

        // Get all dept members and their attendance
        const members = await userRepo.findByDepartment(organizationId, user.departmentId);
        const memberIds = members.map(m => m.id);

        const allAttendance = await attendanceService.getAllRecords(organizationId, { date });
        const deptAttendance = allAttendance.filter(a => memberIds.includes(a.userId));

        res.json({ date, count: deptAttendance.length, attendance: deptAttendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LEAVE MANAGEMENT (HOD approves dept leaves)
// ============================================

/**
 * GET /api/team/leaves/pending
 * Get pending leave requests assigned to me (HOD or legacy team lead)
 */
router.get('/leaves/pending', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const pendingLeaves = await leaveService.getDeptPendingLeaves(organizationId, uid);
        res.json({ count: pendingLeaves.length, leaves: pendingLeaves });
    } catch (error) {
        console.error('❌ Error getting pending team leaves:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/team/leaves/:id/approve
 * Approve a leave request (as HOD)
 */
router.post('/leaves/:id/approve', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const { id } = req.params;
        const { comments } = req.body;

        // Verify the leave is assigned to this user
        const leave = await leaveService.getLeaveById(organizationId, id);
        if (!leave) return res.status(404).json({ error: 'Leave request not found' });
        if (leave.approverId !== uid) {
            return res.status(403).json({ error: 'You are not the assigned approver for this leave request' });
        }

        const updatedLeave = await leaveService.approveLeave(organizationId, id, uid, comments);
        res.json({ message: 'Leave request approved', leave: updatedLeave });
    } catch (error) {
        console.error('❌ Error approving leave:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/team/leaves/:id/reject
 * Reject a leave request (as HOD)
 */
router.post('/leaves/:id/reject', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const { id } = req.params;
        const { comments } = req.body;

        const leave = await leaveService.getLeaveById(organizationId, id);
        if (!leave) return res.status(404).json({ error: 'Leave request not found' });
        if (leave.approverId !== uid) {
            return res.status(403).json({ error: 'You are not the assigned approver for this leave request' });
        }

        const updatedLeave = await leaveService.rejectLeave(organizationId, id, uid, comments);
        res.json({ message: 'Leave request rejected', leave: updatedLeave });
    } catch (error) {
        console.error('❌ Error rejecting leave:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/team/leaves/history
 * Get approved/rejected leave requests
 */
router.get('/leaves/history', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const history = await leaveService.getDeptLeaveHistory(organizationId, uid);
        res.json({ count: history.length, leaves: history });
    } catch (error) {
        console.error('❌ Error getting team leave history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
