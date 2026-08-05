/**
 * team.js
 * 
 * Routes for Team Lead / HOD management.
 * HODs can view dept members/attendance and approve/reject dept leaves.
 */

const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireTeamLead, requireDeptHead } = require('../middleware');

// Get services
const userRepo = container.getUserRepo();
const attendanceService = container.getAttendanceService();
const leaveService = container.getLeaveService();

// Middleware to ensure user is authenticated
// (Authorization is now handled inside each route because any employee could be a Project Lead)
router.use(authenticateToken);

// ============================================
// TEAM MEMBER ROUTES (HOD)
// ============================================

/**
 * GET /api/team/members
 * Get dept members (for HOD) and project members (for Project Leads)
 */
router.get('/members', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const user = await userRepo.findById(organizationId, uid);

        let memberIds = new Set();
        let membersMap = new Map();

        // 1. If HOD, get all department members
        if (user.isDeptHead && user.departmentId) {
            const deptMembers = await userRepo.findByDepartment(organizationId, user.departmentId);
            deptMembers.forEach(m => {
                if (m.id !== uid) {
                    memberIds.add(m.id);
                    membersMap.set(m.id, m);
                }
            });
        }

        // 2. Add Project members (if user leads any project)
        const projectService = container.getProjectService();
        const myProjects = await projectService.getMyProjects(organizationId, uid);
        
        for (const project of myProjects) {
            const myData = project.membersData?.[uid];
            // Only fetch members if the user is a lead of this project
            if (myData && myData.role === 'lead') {
                for (const memberId of (project.memberIds || [])) {
                    if (memberId !== uid && project.membersData?.[memberId]?.status === 'accepted') {
                        memberIds.add(memberId);
                        // If not already fetched, we need to fetch them
                        if (!membersMap.has(memberId)) {
                            const pMember = await userRepo.findById(organizationId, memberId);
                            if (pMember) {
                                membersMap.set(memberId, pMember);
                            }
                        }
                    }
                }
            }
        }

        const members = Array.from(membersMap.values());
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
// ATTENDANCE ROUTES (HOD)
// ============================================

/**
 * GET /api/team/attendance
 * Get today's attendance for team (dept + projects)
 */
router.get('/attendance', async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        // 1. Get all members user has access to
        const user = await userRepo.findById(organizationId, uid);
        let memberIds = new Set();
        
        if (user.isDeptHead && user.departmentId) {
            const deptMembers = await userRepo.findByDepartment(organizationId, user.departmentId);
            deptMembers.forEach(m => { if (m.id !== uid) memberIds.add(m.id); });
        }

        const projectService = container.getProjectService();
        const myProjects = await projectService.getMyProjects(organizationId, uid);
        for (const project of myProjects) {
            const myData = project.membersData?.[uid];
            if (myData && myData.role === 'lead') {
                for (const memberId of (project.memberIds || [])) {
                    if (memberId !== uid && project.membersData?.[memberId]?.status === 'accepted') {
                        memberIds.add(memberId);
                    }
                }
            }
        }

        // 2. Fetch all attendance for org today, then filter by memberIds
        const allAttendance = await attendanceService.getAllRecords(organizationId, { date });
        const teamAttendance = allAttendance.filter(a => memberIds.has(a.userId));

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

        // Fetch user's team members
        const user = await userRepo.findById(organizationId, uid);
        let memberIds = new Set();
        
        if (user.isDeptHead && user.departmentId) {
            const deptMembers = await userRepo.findByDepartment(organizationId, user.departmentId);
            deptMembers.forEach(m => { if (m.id !== uid) memberIds.add(m.id); });
        }

        const projectService = container.getProjectService();
        const myProjects = await projectService.getMyProjects(organizationId, uid);
        for (const project of myProjects) {
            const myData = project.membersData?.[uid];
            if (myData && myData.role === 'lead') {
                for (const memberId of (project.memberIds || [])) {
                    if (memberId !== uid && project.membersData?.[memberId]?.status === 'accepted') {
                        memberIds.add(memberId);
                    }
                }
            }
        }

        const teamHours = await attendanceService.getWeeklyHoursForUsers(organizationId, Array.from(memberIds), weekStart, weekEnd);

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
