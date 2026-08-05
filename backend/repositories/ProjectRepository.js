/**
 * ProjectRepository.js
 * 
 * Repository for managing projects within organizations.
 * Path: organizations/{orgId}/projects/{projectId}
 */

const BaseRepository = require('./BaseRepository');

class ProjectRepository extends BaseRepository {
    constructor(db) {
        super(db, 'projects');
    }

    /**
     * Get collection for a specific organization
     */
    getCollection(orgId) {
        return this.db.collection('organizations').doc(orgId).collection('projects');
    }

    /**
     * Create a new project
     */
    async create(orgId, data) {
        try {
            const docRef = this.getCollection(orgId).doc();
            const timestamp = new Date().toISOString();

            // Setup creator as lead and accepted
            const memberIds = [data.creatorId];
            const membersData = {
                [data.creatorId]: {
                    role: 'lead',
                    status: 'accepted',
                    name: data.creatorName || 'Unknown',
                    addedAt: timestamp
                }
            };

            const projectData = {
                id: docRef.id,
                name: data.name,
                description: data.description || '',
                status: data.status || 'active',
                creatorId: data.creatorId,
                departmentId: data.departmentId || null,
                organizationId: orgId,
                memberIds,
                membersData,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            await docRef.set(projectData);
            console.log(`✅ [ProjectRepo] Created project "${projectData.name}" in org ${orgId}`);
            return projectData;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Create error:`, error);
            throw new Error(`Failed to create project: ${error.message}`);
        }
    }

    /**
     * Find project by ID
     */
    async findById(orgId, projectId) {
        try {
            const doc = await this.getCollection(orgId).doc(projectId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error(`❌ [ProjectRepo] FindById error:`, error);
            throw new Error(`Failed to find project: ${error.message}`);
        }
    }

    /**
     * Find all projects in an organization (for Admin/BO)
     */
    async findAll(orgId) {
        try {
            const snapshot = await this.getCollection(orgId).orderBy('createdAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`❌ [ProjectRepo] FindAll error:`, error);
            throw new Error(`Failed to list projects: ${error.message}`);
        }
    }

    /**
     * Find all projects for a specific department (for Tech Lead)
     */
    async findByDepartment(orgId, departmentId) {
        try {
            const snapshot = await this.getCollection(orgId)
                .where('departmentId', '==', departmentId)
                .get();
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory to avoid composite index requirement
            return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error(`❌ [ProjectRepo] FindByDepartment error:`, error);
            throw new Error(`Failed to list department projects: ${error.message}`);
        }
    }

    /**
     * Find all projects a user is involved in
     */
    async findByUser(orgId, userId) {
        try {
            const snapshot = await this.getCollection(orgId)
                .where('memberIds', 'array-contains', userId)
                .get();
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory to avoid composite index requirement
            return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error(`❌ [ProjectRepo] FindByUser error:`, error);
            throw new Error(`Failed to list user projects: ${error.message}`);
        }
    }

    /**
     * Update project basic details
     */
    async update(orgId, projectId, data) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            const doc = await ref.get();
            if (!doc.exists) throw new Error(`Project not found: ${projectId}`);

            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            delete updateData.id;
            delete updateData.organizationId;
            delete updateData.createdAt;
            delete updateData.memberIds;
            delete updateData.membersData;

            await ref.update(updateData);
            const updated = await ref.get();
            return { id: updated.id, ...updated.data() };
        } catch (error) {
            console.error(`❌ [ProjectRepo] Update error:`, error);
            throw new Error(`Failed to update project: ${error.message}`);
        }
    }

    /**
     * Delete project
     */
    async delete(orgId, projectId) {
        try {
            await this.getCollection(orgId).doc(projectId).delete();
            console.log(`✅ [ProjectRepo] Deleted project ${projectId}`);
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Delete error:`, error);
            throw new Error(`Failed to delete project: ${error.message}`);
        }
    }

    /**
     * Add member / send invite
     */
    async addMember(orgId, projectId, userId, memberData) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            const { FieldValue } = require('firebase-admin/firestore');
            
            await ref.update({
                memberIds: FieldValue.arrayUnion(userId),
                [`membersData.${userId}`]: {
                    ...memberData,
                    addedAt: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Add member error:`, error);
            throw new Error(`Failed to add member to project: ${error.message}`);
        }
    }

    /**
     * Update member status (e.g. accepted, declined, change role)
     */
    async updateMember(orgId, projectId, userId, updates) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            
            // We use dot notation to update specific nested fields without overwriting the whole object
            const firestoreUpdates = {
                updatedAt: new Date().toISOString()
            };
            
            for (const [key, value] of Object.entries(updates)) {
                firestoreUpdates[`membersData.${userId}.${key}`] = value;
            }

            await ref.update(firestoreUpdates);
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Update member error:`, error);
            throw new Error(`Failed to update member: ${error.message}`);
        }
    }

    /**
     * Remove member entirely
     */
    async removeMember(orgId, projectId, userId) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            const { FieldValue } = require('firebase-admin/firestore');
            
            await ref.update({
                memberIds: FieldValue.arrayRemove(userId),
                [`membersData.${userId}`]: FieldValue.delete(),
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Remove member error:`, error);
            throw new Error(`Failed to remove member: ${error.message}`);
        }
    }

    /**
     * Add a task to the project
     */
    async addTask(orgId, projectId, taskId, taskData) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            await ref.update({
                [`tasksData.${taskId}`]: {
                    ...taskData,
                    id: taskId,
                    createdAt: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Add task error:`, error);
            throw new Error(`Failed to add task: ${error.message}`);
        }
    }

    /**
     * Update an existing task
     */
    async updateTask(orgId, projectId, taskId, updates) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            const firestoreUpdates = { updatedAt: new Date().toISOString() };
            
            for (const [key, value] of Object.entries(updates)) {
                firestoreUpdates[`tasksData.${taskId}.${key}`] = value;
            }

            await ref.update(firestoreUpdates);
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Update task error:`, error);
            throw new Error(`Failed to update task: ${error.message}`);
        }
    }

    /**
     * Delete a task
     */
    async removeTask(orgId, projectId, taskId) {
        try {
            const ref = this.getCollection(orgId).doc(projectId);
            const { FieldValue } = require('firebase-admin/firestore');
            
            await ref.update({
                [`tasksData.${taskId}`]: FieldValue.delete(),
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`❌ [ProjectRepo] Remove task error:`, error);
            throw new Error(`Failed to remove task: ${error.message}`);
        }
    }
}

module.exports = ProjectRepository;
