const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireAdminOrBusinessOwner, requireManager } = require('../middleware');

const projectService = container.getProjectService();

// ========================================
// EMPLOYEE ROUTES
// ========================================

/**
 * Get organization employees (for invites)
 * GET /api/projects/employees
 */
router.get('/employees', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.user;
        const userRepo = container.getUserRepo();
        const employees = await userRepo.findAll(organizationId);
        
        // Return safe data (no passwords, exclude inactive and admin/bo)
        const safeEmployees = employees
            .filter(e => e.status !== 'inactive' && e.status !== 'disabled')
            .filter(e => !['admin', 'business_owner', 'system_admin'].includes(e.role))
            .map(({ id, name, email, departmentId, role }) => ({ id, name, email, departmentId, role }));
            
        res.json({ data: safeEmployees });
    } catch (error) {
        console.error('Error fetching org employees:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get projects I am involved in
 * GET /api/projects
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const projects = await projectService.getMyProjects(organizationId, uid);
        res.json({ data: projects });
    } catch (error) {
        console.error('Error fetching my projects:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create a new project
 * POST /api/projects
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const projectData = req.body;
        
        if (!projectData.name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const project = await projectService.createProject(organizationId, uid, projectData);
        res.status(201).json({ message: 'Project created successfully', data: project });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Respond to an invite
 * PUT /api/projects/:id/invites/respond
 */
router.put('/:id/invites/respond', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const { accept } = req.body;
        
        if (accept === undefined) {
            return res.status(400).json({ error: 'Must provide accept boolean' });
        }

        const result = await projectService.respondToInvite(organizationId, req.params.id, uid, accept);
        res.json({ message: `Invite ${result.status}`, data: result });
    } catch (error) {
        console.error('Error responding to invite:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PROJECT LEAD ROUTES
// ========================================

/**
 * Update project details
 * PUT /api/projects/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const project = await projectService.updateProject(organizationId, req.params.id, uid, req.body);
        res.json({ message: 'Project updated', data: project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Send an invite
 * POST /api/projects/:id/invites
 */
router.post('/:id/invites', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const { targetUserId, role } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'targetUserId is required' });
        }

        await projectService.inviteMember(organizationId, req.params.id, uid, targetUserId, role || 'member');
        res.json({ message: 'Invite sent successfully' });
    } catch (error) {
        console.error('Error sending invite:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Remove a member (or leave)
 * DELETE /api/projects/:id/members/:userId
 */
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        await projectService.removeMember(organizationId, req.params.id, uid, req.params.userId);
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        await projectService.deleteProject(organizationId, req.params.id, uid);
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: error.message });
    }
});
// ========================================
// TASKS
// ========================================

/**
 * Add a new task to a project
 * POST /api/projects/:id/tasks
 */
router.post('/:id/tasks', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const task = await projectService.addTask(organizationId, req.params.id, uid, req.body);
        res.json({ message: 'Task added successfully', data: task });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update a task
 * PUT /api/projects/:id/tasks/:taskId
 */
router.put('/:id/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        await projectService.updateTask(organizationId, req.params.id, uid, req.params.taskId, req.body);
        res.json({ message: 'Task updated successfully' });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a task
 * DELETE /api/projects/:id/tasks/:taskId
 */
router.delete('/:id/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        await projectService.deleteTask(organizationId, req.params.id, uid, req.params.taskId);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ATTENDANCE (Project Lead Access)
// ========================================

/**
 * Get recent attendance for project members
 * GET /api/projects/:id/attendance
 */
router.get('/:id/attendance', authenticateToken, async (req, res) => {
    try {
        const { organizationId, uid } = req.user;
        const project = await projectService.getProjectById(organizationId, req.params.id);
        if (!project) throw new Error("Project not found");
        
        const requesterData = project.membersData?.[uid];
        if (!requesterData || requesterData.role !== 'lead') {
            return res.status(403).json({ error: 'Only project leads can view member attendance' });
        }

        // Fetch attendance for members
        const container = require('../container');
        const attendanceService = container.getAttendanceService();
        const memberIds = Object.keys(project.membersData || {});
        
        const today = new Date().toISOString().split('T')[0];
        
        // Let's get today's attendance for all members
        const attendanceData = {};
        for (const memberId of memberIds) {
            // We need a method to get specific user's attendance for a date or date range.
            // Using getRecords directly if possible, or just userRepo for minimal info
            const records = await container.getAttendanceRepo().getUserRecords(organizationId, memberId, today, today);
            attendanceData[memberId] = records.length > 0 ? records[0] : null;
        }

        res.json({ data: attendanceData });
    } catch (error) {
        console.error('Error fetching project attendance:', error);
        res.status(500).json({ error: error.message });
    }
});
// ========================================
// ADMIN / BO / MANAGER ROUTES
// ========================================

/**
 * Get all projects in the org
 * GET /api/projects/all
 */
router.get('/all', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
    try {
        const { organizationId } = req.user;
        const projects = await projectService.getAllProjects(organizationId);
        res.json({ data: projects });
    } catch (error) {
        console.error('Error fetching all projects:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all projects for a department (Manager)
 * GET /api/projects/department/:deptId
 */
router.get('/department/:deptId', authenticateToken, requireManager, async (req, res) => {
    try {
        const { organizationId } = req.user;
        const projects = await projectService.getDepartmentProjects(organizationId, req.params.deptId);
        res.json({ data: projects });
    } catch (error) {
        console.error('Error fetching department projects:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
