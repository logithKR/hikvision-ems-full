/**
 * DepartmentRepository.js
 * 
 * Repository for managing departments within organizations.
 * Path: organizations/{orgId}/departments/{deptId}
 */

const BaseRepository = require('./BaseRepository');

class DepartmentRepository extends BaseRepository {
    constructor(db) {
        super(db, 'departments');
    }

    /**
     * Get collection for a specific organization
     */
    getCollection(orgId) {
        return this.db.collection('organizations').doc(orgId).collection('departments');
    }

    /**
     * Create a new department
     */
    async create(orgId, data) {
        try {
            const docRef = this.getCollection(orgId).doc();
            const timestamp = new Date().toISOString();

            const deptData = {
                id: docRef.id,
                name: data.name,
                description: data.description || '',
                managerId: data.managerId || null,
                managerName: data.managerName || null,
                maxEmployees: data.maxEmployees || 50,
                memberCount: 0,
                organizationId: orgId,
                createdAt: timestamp,
                createdBy: data.createdBy || null,
                updatedAt: timestamp
            };

            await docRef.set(deptData);
            console.log(`✅ [DepartmentRepo] Created department "${deptData.name}" in org ${orgId}`);
            return deptData;
        } catch (error) {
            console.error(`❌ [DepartmentRepo] Create error:`, error);
            throw new Error(`Failed to create department: ${error.message}`);
        }
    }

    /**
     * Find department by ID
     */
    async findById(orgId, deptId) {
        try {
            const doc = await this.getCollection(orgId).doc(deptId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error(`❌ [DepartmentRepo] FindById error:`, error);
            throw new Error(`Failed to find department: ${error.message}`);
        }
    }

    /**
     * Find department by name
     */
    async findByName(orgId, name) {
        try {
            const snapshot = await this.getCollection(orgId)
                .where('name', '==', name)
                .limit(1)
                .get();
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error(`❌ [DepartmentRepo] FindByName error:`, error);
            throw new Error(`Failed to find department by name: ${error.message}`);
        }
    }

    /**
     * Find all departments in an organization
     */
    async findAll(orgId) {
        try {
            const snapshot = await this.getCollection(orgId).orderBy('name').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`❌ [DepartmentRepo] FindAll error:`, error);
            throw new Error(`Failed to list departments: ${error.message}`);
        }
    }

    /**
     * Update department
     */
    async update(orgId, deptId, data) {
        try {
            const ref = this.getCollection(orgId).doc(deptId);
            const doc = await ref.get();
            if (!doc.exists) throw new Error(`Department not found: ${deptId}`);

            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            // Don't allow overwriting id or organizationId
            delete updateData.id;
            delete updateData.organizationId;
            delete updateData.createdAt;

            await ref.update(updateData);
            const updated = await ref.get();
            return { id: updated.id, ...updated.data() };
        } catch (error) {
            console.error(`❌ [DepartmentRepo] Update error:`, error);
            throw new Error(`Failed to update department: ${error.message}`);
        }
    }

    /**
     * Delete department
     */
    async delete(orgId, deptId) {
        try {
            await this.getCollection(orgId).doc(deptId).delete();
            console.log(`✅ [DepartmentRepo] Deleted department ${deptId}`);
            return true;
        } catch (error) {
            console.error(`❌ [DepartmentRepo] Delete error:`, error);
            throw new Error(`Failed to delete department: ${error.message}`);
        }
    }

    /**
     * Check if adding a member would exceed the limit
     */
    async checkMemberLimit(orgId, deptId) {
        const dept = await this.findById(orgId, deptId);
        if (!dept) throw new Error(`Department not found: ${deptId}`);
        return {
            canAdd: dept.memberCount < dept.maxEmployees,
            current: dept.memberCount,
            max: dept.maxEmployees
        };
    }

    /**
     * Increment member count
     */
    async incrementMemberCount(orgId, deptId) {
        const ref = this.getCollection(orgId).doc(deptId);
        const { FieldValue } = require('firebase-admin/firestore');
        await ref.update({
            memberCount: FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Decrement member count
     */
    async decrementMemberCount(orgId, deptId) {
        const ref = this.getCollection(orgId).doc(deptId);
        const { FieldValue } = require('firebase-admin/firestore');
        await ref.update({
            memberCount: FieldValue.increment(-1),
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Set department manager
     */
    async setManager(orgId, deptId, managerId, managerName) {
        return this.update(orgId, deptId, { managerId, managerName });
    }

    /**
     * Clear department manager
     */
    async clearManager(orgId, deptId) {
        return this.update(orgId, deptId, { managerId: null, managerName: null });
    }
}

module.exports = DepartmentRepository;
