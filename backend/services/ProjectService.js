/**
 * ProjectService.js
 * 
 * Business logic layer for project management.
 */

class ProjectService {
    constructor(projectRepo, userRepo, notificationService = null) {
        this.projectRepo = projectRepo;
        this.userRepo = userRepo;
        this.notificationService = notificationService;
    }

    /**
     * Create a new project
     */
    async createProject(orgId, creatorId, data) {
        // Validate creator exists
        const creator = await this.userRepo.findById(orgId, creatorId);
        if (!creator) throw new Error('Creator not found');

        const projectData = {
            name: data.name,
            description: data.description,
            status: data.status || 'active',
            creatorId,
            creatorName: creator.name,
            departmentId: creator.departmentId || null
        };

        const project = await this.projectRepo.create(orgId, projectData);
        return project;
    }

    /**
     * Get all projects a user is involved in
     */
    async getMyProjects(orgId, userId) {
        return await this.projectRepo.findByUser(orgId, userId);
    }

    /**
     * Get all projects in the org (Admin / BO)
     */
    async getAllProjects(orgId) {
        return await this.projectRepo.findAll(orgId);
    }

    /**
     * Get all projects for a specific department (Manager)
     */
    async getDepartmentProjects(orgId, departmentId) {
        if (!departmentId) return [];
        return await this.projectRepo.findByDepartment(orgId, departmentId);
    }

    /**
     * Invite an employee to a project
     */
    async inviteMember(orgId, projectId, leadId, targetUserId, role = 'member') {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        // Check if inviter is the lead
        const inviterData = project.membersData?.[leadId];
        if (!inviterData || inviterData.role !== 'lead') {
            throw new Error('Only project leads can invite members');
        }

        if (project.memberIds?.includes(targetUserId)) {
            throw new Error('User is already a member or has a pending invite');
        }

        const targetUser = await this.userRepo.findById(orgId, targetUserId);
        if (!targetUser) throw new Error('Target user not found');
        if (targetUser.status === 'inactive' || targetUser.status === 'disabled' || targetUser.isActive === false) {
            throw new Error('Cannot invite an inactive employee');
        }

        const memberData = {
            role,
            status: 'pending',
            name: targetUser.name,
            email: targetUser.email,
            department: targetUser.department
        };

        await this.projectRepo.addMember(orgId, projectId, targetUserId, memberData);

        if (this.notificationService) {
            this.notificationService.sendToUser(targetUserId, 'project_invite', {
                projectId,
                projectName: project.name,
                message: `You have been invited to join project ${project.name}`
            });
        }

        return { success: true };
    }

    /**
     * Respond to an invite
     */
    async respondToInvite(orgId, projectId, userId, accept) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const memberData = project.membersData?.[userId];
        if (!memberData) throw new Error('No invite found for this user');

        if (memberData.status !== 'pending') {
            throw new Error('Invite is no longer pending');
        }

        if (accept) {
            await this.projectRepo.updateMember(orgId, projectId, userId, { status: 'accepted' });
            return { success: true, status: 'accepted' };
        } else {
            // Decline -> remove from project entirely
            await this.projectRepo.removeMember(orgId, projectId, userId);
            return { success: true, status: 'declined' };
        }
    }

    /**
     * Remove a member from the project (or leave)
     */
    async removeMember(orgId, projectId, requesterId, targetUserId) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        const targetData = project.membersData?.[targetUserId];

        if (!targetData) throw new Error('Target user is not in this project');

        // Allow if requester is lead OR requester is leaving voluntarily
        if (requesterId === targetUserId) {
            // User is leaving
            // If they are a lead, they cannot leave if they are the only lead.
            if (requesterData.role === 'lead') {
                const leads = Object.values(project.membersData || {}).filter(m => m.role === 'lead' && m.status === 'accepted');
                if (leads.length <= 1) {
                    throw new Error('You are the only lead. You must assign another lead or delete the project instead of leaving.');
                }
            }
        } else if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can remove other members');
        }

        await this.projectRepo.removeMember(orgId, projectId, targetUserId);
        return { success: true };
    }

    /**
     * Update a project's basic details (only lead can do this)
     */
    async updateProject(orgId, projectId, requesterId, data) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can update project details');
        }

        return await this.projectRepo.update(orgId, projectId, data);
    }

    /**
     * Delete a project (only lead can do this)
     */
    async deleteProject(orgId, projectId, requesterId) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can delete the project');
        }

        await this.projectRepo.delete(orgId, projectId);
        return { success: true };
    }

    // ==========================================
    // TASK MANAGEMENT
    // ==========================================

    async addTask(orgId, projectId, requesterId, taskData) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can add tasks');
        }

        const crypto = require('crypto');
        const taskId = crypto.randomUUID();

        const newTask = {
            title: taskData.title,
            description: taskData.description || '',
            status: taskData.status || 'todo',
            deadline: taskData.deadline || null,
            createdBy: requesterId
        };

        await this.projectRepo.addTask(orgId, projectId, taskId, newTask);
        
        // Notify team
        Object.keys(project.membersData || {}).forEach(memberId => {
            if (memberId !== requesterId) {
                this.notificationService.sendPersistentNotification(orgId, memberId, {
                    type: 'task_added',
                    title: `New Task in ${project.name}`,
                    message: `${requesterData.name || 'Team Lead'} added task: ${newTask.title}`,
                    data: { projectId }
                });
            }
        });

        return { id: taskId, ...newTask };
    }

    async updateTask(orgId, projectId, requesterId, taskId, updates) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can edit tasks');
        }

        await this.projectRepo.updateTask(orgId, projectId, taskId, updates);
        return { success: true };
    }

    async deleteTask(orgId, projectId, requesterId, taskId) {
        const project = await this.projectRepo.findById(orgId, projectId);
        if (!project) throw new Error('Project not found');

        const requesterData = project.membersData?.[requesterId];
        if (!requesterData || requesterData.role !== 'lead') {
            throw new Error('Only project leads can delete tasks');
        }

        await this.projectRepo.removeTask(orgId, projectId, taskId);
        return { success: true };
    }
}

module.exports = ProjectService;
