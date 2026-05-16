/**
 * UserRepository.js
 * 
 * Repository for managing users within organizations.
 * Supports hierarchical structure: organizations/{orgId}/users/{userId}
 * 
 * Handles: Business Owners, Admins, Employees
 */

const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
  constructor(db) {
    // Don't call super() with collection name since we use hierarchical structure
    super(db, 'users');
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
    return this.db.collection('organizations').doc(orgId).collection('users');
  }

  /**
   * Create a new user within an organization
   * @param {string} orgId - Organization ID
   * @param {Object} data - User data
   * @returns {Promise<Object>} Created user
   */
  async create(orgId, data) {
    try {
      const docRef = this.getCollection(orgId).doc();
      const timestamp = new Date().toISOString();

      const userData = {
        id: docRef.id,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash, // ✅ Should be hashed before calling this
        role: data.role || 'employee',
        department: data.department || '',
        position: data.position || data.role || '',
        salary: data.salary || '0',
        workingType: data.workingType || 'full-time',
        skills: data.skills || '',
        address: data.address || '',
        emergencyContact: data.emergencyContact || '',
        phone: data.phone || '',

        organizationId: orgId, // ✅ Always set
        isActive: true,

        // 🏢 Department mapping
        departmentId: data.departmentId || null,

        // 👥 Team/Manager mapping
        managerId: data.managerId || null,
        managerName: data.managerName || null,
        isDeptHead: data.isDeptHead || false,
        isManager: data.isManager || false,
        isTeamLead: data.isManager || data.isDeptHead || false, // backward compat
        directReports: [],

        // 👨‍💼 For Admins: Track their quota usage
        ...(data.role === 'admin' && {
          adminSettings: {
            employeesCreated: 0,
            canCreateUpTo: data.canCreateUpTo || 50 // Default quota
          }
        }),

        createdAt: timestamp,
        createdBy: data.createdBy || null, // Who created this user
        updatedAt: timestamp
      };

      await docRef.set(userData);

      console.log(`✅ [UserRepository] Created ${userData.role} in org ${orgId}: ${docRef.id}`);
      return userData;
    } catch (error) {
      console.error(`❌ [UserRepository] Create error:`, error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Create a new user with a specific ID within an organization
   * @param {string} orgId - Organization ID
   * @param {string} id - Specific user ID
   * @param {Object} data - User data
   * @returns {Promise<Object>} Created user
   */
  async createWithId(orgId, id, data) {
    try {
      const docRef = this.getCollection(orgId).doc(id);
      const timestamp = new Date().toISOString();

      const userData = {
        id,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role || 'employee',
        department: data.department || '',
        position: data.position || data.role || '',
        salary: data.salary || '0',
        workingType: data.workingType || 'full-time',
        skills: data.skills || '',
        address: data.address || '',
        emergencyContact: data.emergencyContact || '',
        phone: data.phone || '',
        organizationId: orgId,
        isActive: true,
        departmentId: data.departmentId || null,
        managerId: data.managerId || null,
        managerName: data.managerName || null,
        isDeptHead: data.isDeptHead || false,
        isManager: data.isManager || false,
        isTeamLead: data.isManager || data.isDeptHead || false,
        directReports: [],
        ...(data.role === 'admin' && {
          adminSettings: {
            employeesCreated: 0,
            canCreateUpTo: data.canCreateUpTo || 50
          }
        }),
        createdAt: timestamp,
        createdBy: data.createdBy || null,
        updatedAt: timestamp
      };

      await docRef.set(userData);

      console.log(`✅ [UserRepository] Created ${userData.role} in org ${orgId} with ID: ${id}`);
      return userData;
    } catch (error) {
      console.error(`❌ [UserRepository] CreateWithId error:`, error);
      throw new Error(`Failed to create user with ID: ${error.message}`);
    }
  }

  /**
   * Find user by ID within organization
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async findById(orgId, userId) {
    try {
      const doc = await this.getCollection(orgId).doc(userId).get();

      if (!doc.exists) {
        console.log(`⚠️ [UserRepository] User not found: ${userId} in org ${orgId}`);
        return null;
      }

      const data = { id: doc.id, ...doc.data() };
      console.log(`✅ [UserRepository] Found user: ${userId}`);
      return data;
    } catch (error) {
      console.error(`❌ [UserRepository] FindById error:`, error);
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  /**
   * Find user by email within organization
   * @param {string} orgId - Organization ID
   * @param {string} email - User email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(orgId, email) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`⚠️ [UserRepository] User not found by email: ${email} in org ${orgId}`);
        return null;
      }

      const doc = snapshot.docs[0];
      const data = { id: doc.id, ...doc.data() };

      console.log(`✅ [UserRepository] Found user by email: ${email}`);
      return data;
    } catch (error) {
      console.error(`❌ [UserRepository] FindByEmail error:`, error);
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  /**
   * Find all users in organization
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Optional filters { role, isActive }
   * @returns {Promise<Array>}
   */
  async findAll(orgId, filters = {}) {
    try {
      let query = this.getCollection(orgId);

      // Apply role filter
      if (filters.role) {
        query = query.where('role', '==', filters.role);
      }

      // Apply active status filter
      if (filters.isActive !== undefined) {
        query = query.where('isActive', '==', filters.isActive);
      }

      // Note: Removed orderBy from Firestore query to avoid composite index requirement
      // when using where() filters. Sorting is done in JavaScript instead.
      const snapshot = await query.get();

      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt descending in JavaScript
      users.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      console.log(`✅ [UserRepository] Found ${users.length} users in org ${orgId}`);
      return users;
    } catch (error) {
      console.error(`❌ [UserRepository] FindAll error:`, error);
      throw new Error(`Failed to find users: ${error.message}`);
    }
  }

  /**
   * Find all active users in organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>}
   */
  async findAllActive(orgId) {
    return await this.findAll(orgId, { isActive: true });
  }

  /**
   * Find users by role
   * @param {string} orgId - Organization ID
   * @param {string} role - User role (admin, employee, business_owner)
   * @returns {Promise<Array>}
   */
  async findByRole(orgId, role) {
    return await this.findAll(orgId, { role, isActive: true });
  }

  /**
   * Update user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async update(orgId, userId, data) {
    try {
      const docRef = this.getCollection(orgId).doc(userId);

      // Check if user exists
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // Don't allow updating certain fields
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.createdBy;
      delete updateData.organizationId;

      await docRef.update(updateData);

      // Fetch updated document
      const updatedDoc = await docRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      console.log(`✅ [UserRepository] Updated user: ${userId}`);
      return result;
    } catch (error) {
      console.error(`❌ [UserRepository] Update error:`, error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Soft delete user (mark as inactive)
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async softDelete(orgId, userId) {
    try {
      return await this.update(orgId, userId, {
        isActive: false,
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [UserRepository] Soft delete error:`, error);
      throw new Error(`Failed to soft delete user: ${error.message}`);
    }
  }

  /**
   * Hard delete user (permanent)
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async delete(orgId, userId) {
    try {
      const docRef = this.getCollection(orgId).doc(userId);

      // Check if exists
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      await docRef.delete();

      console.log(`✅ [UserRepository] Deleted user: ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ [UserRepository] Delete error:`, error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Increment admin's employee creation count
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>}
   */
  async incrementAdminQuota(orgId, adminId) {
    try {
      const admin = await this.findById(orgId, adminId);
      if (!admin) {
        throw new Error(`Admin not found: ${adminId}`);
      }

      if (admin.role !== 'admin') {
        throw new Error(`User is not an admin: ${adminId}`);
      }

      const updatedSettings = {
        ...admin.adminSettings,
        employeesCreated: (admin.adminSettings?.employeesCreated || 0) + 1
      };

      console.log(`➕ [UserRepository] Incrementing quota for admin ${adminId}: ${updatedSettings.employeesCreated}/${admin.adminSettings?.canCreateUpTo}`);

      return await this.update(orgId, adminId, {
        adminSettings: updatedSettings
      });
    } catch (error) {
      console.error(`❌ [UserRepository] IncrementAdminQuota error:`, error);
      throw new Error(`Failed to increment admin quota: ${error.message}`);
    }
  }

  /**
   * Decrement admin's employee creation count
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>}
   */
  async decrementAdminQuota(orgId, adminId) {
    try {
      const admin = await this.findById(orgId, adminId);
      if (!admin) {
        throw new Error(`Admin not found: ${adminId}`);
      }

      if (admin.role !== 'admin') {
        throw new Error(`User is not an admin: ${adminId}`);
      }

      const updatedSettings = {
        ...admin.adminSettings,
        employeesCreated: Math.max(0, (admin.adminSettings?.employeesCreated || 0) - 1)
      };

      console.log(`➖ [UserRepository] Decrementing quota for admin ${adminId}: ${updatedSettings.employeesCreated}/${admin.adminSettings?.canCreateUpTo}`);

      return await this.update(orgId, adminId, {
        adminSettings: updatedSettings
      });
    } catch (error) {
      console.error(`❌ [UserRepository] DecrementAdminQuota error:`, error);
      throw new Error(`Failed to decrement admin quota: ${error.message}`);
    }
  }

  /**
   * Check if admin can create more employees
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} { canCreate: boolean, created: number, limit: number }
   */
  async checkAdminQuota(orgId, adminId) {
    try {
      const admin = await this.findById(orgId, adminId);
      if (!admin) {
        throw new Error(`Admin not found: ${adminId}`);
      }

      if (admin.role !== 'admin') {
        return { canCreate: false, reason: 'User is not an admin' };
      }

      const created = admin.adminSettings?.employeesCreated || 0;
      const limit = admin.adminSettings?.canCreateUpTo || 50;
      const canCreate = created < limit;

      console.log(`🔍 [UserRepository] Admin quota check: ${created}/${limit} (${canCreate ? 'OK' : 'EXCEEDED'})`);

      return {
        canCreate,
        created,
        limit,
        remaining: Math.max(0, limit - created)
      };
    } catch (error) {
      console.error(`❌ [UserRepository] CheckAdminQuota error:`, error);
      throw new Error(`Failed to check admin quota: ${error.message}`);
    }
  }

  /**
   * Update admin's employee creation limit (Business Owner only)
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @param {number} newLimit - New limit
   * @returns {Promise<Object>}
   */
  async updateAdminLimit(orgId, adminId, newLimit) {
    try {
      const admin = await this.findById(orgId, adminId);
      if (!admin) {
        throw new Error(`Admin not found: ${adminId}`);
      }

      if (admin.role !== 'admin') {
        throw new Error(`User is not an admin: ${adminId}`);
      }

      const updatedSettings = {
        ...admin.adminSettings,
        canCreateUpTo: newLimit
      };

      console.log(`📊 [UserRepository] Updating admin limit for ${adminId}: ${newLimit}`);

      return await this.update(orgId, adminId, {
        adminSettings: updatedSettings
      });
    } catch (error) {
      console.error(`❌ [UserRepository] UpdateAdminLimit error:`, error);
      throw new Error(`Failed to update admin limit: ${error.message}`);
    }
  }

  /**
   * Count users by role in organization
   * @param {string} orgId - Organization ID
   * @param {string} role - User role
   * @returns {Promise<number>}
   */
  async countByRole(orgId, role) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('role', '==', role)
        .where('isActive', '==', true)
        .get();

      const count = snapshot.size;
      console.log(`✅ [UserRepository] Count for role ${role}: ${count}`);
      return count;
    } catch (error) {
      console.error(`❌ [UserRepository] CountByRole error:`, error);
      throw new Error(`Failed to count users by role: ${error.message}`);
    }
  }

  /**
   * Check if email exists in organization
   * @param {string} orgId - Organization ID
   * @param {string} email - Email to check
   * @returns {Promise<boolean>}
   */
  async emailExists(orgId, email) {
    try {
      const user = await this.findByEmail(orgId, email);
      return user !== null;
    } catch (error) {
      console.error(`❌ [UserRepository] EmailExists error:`, error);
      return false;
    }
  }

  /**
   * Get user statistics for organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>}
   */
  async getStats(orgId) {
    try {
      const allUsers = await this.findAllActive(orgId);

      const stats = {
        total: allUsers.length,
        byRole: {
          businessOwners: allUsers.filter(u => u.role === 'business_owner').length,
          admins: allUsers.filter(u => u.role === 'admin').length,
          employees: allUsers.filter(u => u.role === 'employee').length
        },
        byDepartment: {}
      };

      // Count by department
      allUsers.forEach(user => {
        const dept = user.department || 'Unassigned';
        stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
      });

      console.log(`✅ [UserRepository] Stats for org ${orgId}:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ [UserRepository] GetStats error:`, error);
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  /**
   * Assign a manager to an employee (updates both employee and leader documents)
   * @param {string} orgId - Organization ID
   * @param {string} userId - Employee user ID
   * @param {string} managerId - New manager's user ID (null to unassign)
   * @returns {Promise<Object>} Updated employee
   */
  async assignManager(orgId, userId, managerId) {
    try {
      const employee = await this.findById(orgId, userId);
      if (!employee) throw new Error(`Employee not found: ${userId}`);

      const oldManagerId = employee.managerId;
      const batch = this.db.batch();
      const timestamp = new Date().toISOString();

      // 1. Remove employee from old manager's directReports
      if (oldManagerId && oldManagerId !== managerId) {
        const oldManagerRef = this.getCollection(orgId).doc(oldManagerId);
        const oldManagerDoc = await oldManagerRef.get();
        if (oldManagerDoc.exists) {
          const oldReports = (oldManagerDoc.data().directReports || []).filter(id => id !== userId);
          batch.update(oldManagerRef, {
            directReports: oldReports,
            isTeamLead: oldReports.length > 0,
            updatedAt: timestamp
          });
        }
      }

      // 2. Set new manager on employee
      let managerName = null;
      if (managerId) {
        const newManager = await this.findById(orgId, managerId);
        if (!newManager) throw new Error(`Manager not found: ${managerId}`);
        managerName = newManager.name;

        // 3. Add employee to new manager's directReports
        const newManagerRef = this.getCollection(orgId).doc(managerId);
        const currentReports = newManager.directReports || [];
        if (!currentReports.includes(userId)) {
          currentReports.push(userId);
        }
        batch.update(newManagerRef, {
          directReports: currentReports,
          isTeamLead: true,
          updatedAt: timestamp
        });
      }

      // 4. Update employee's managerId/managerName
      const employeeRef = this.getCollection(orgId).doc(userId);
      batch.update(employeeRef, {
        managerId: managerId || null,
        managerName: managerName,
        updatedAt: timestamp
      });

      await batch.commit();

      // Fetch and return updated employee
      const updatedDoc = await employeeRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };
      console.log(`✅ [UserRepository] Assigned manager ${managerId} to employee ${userId}`);
      return result;
    } catch (error) {
      console.error(`❌ [UserRepository] AssignManager error:`, error);
      throw new Error(`Failed to assign manager: ${error.message}`);
    }
  }

  /**
   * Get all direct reports for a team lead
   * @param {string} orgId - Organization ID
   * @param {string} leaderId - Team lead's user ID
   * @returns {Promise<Array>} List of direct report users
   */
  async getDirectReports(orgId, leaderId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('managerId', '==', leaderId)
        .where('isActive', '==', true)
        .get();

      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`✅ [UserRepository] Found ${reports.length} direct reports for ${leaderId}`);
      return reports;
    } catch (error) {
      console.error(`❌ [UserRepository] GetDirectReports error:`, error);
      throw new Error(`Failed to get direct reports: ${error.message}`);
    }
  }

  /**
   * Get all team leads in an organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} List of team lead users
   */
  async getTeamLeads(orgId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('isTeamLead', '==', true)
        .where('isActive', '==', true)
        .get();

      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`✅ [UserRepository] Found ${leads.length} team leads in org ${orgId}`);
      return leads;
    } catch (error) {
      console.error(`❌ [UserRepository] GetTeamLeads error:`, error);
      throw new Error(`Failed to get team leads: ${error.message}`);
    }
  }

  /**
   * Find all users in a department
   * @param {string} orgId - Organization ID
   * @param {string} deptId - Department ID
   * @returns {Promise<Array>}
   */
  async findByDepartment(orgId, deptId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('departmentId', '==', deptId)
        .where('isActive', '==', true)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ [UserRepository] FindByDepartment error:`, error);
      throw new Error(`Failed to find users by department: ${error.message}`);
    }
  }

  /**
   * Get department head for a department
   * @param {string} orgId
   * @param {string} deptId
   * @returns {Promise<Object|null>}
   */
  async getDeptHead(orgId, deptId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('departmentId', '==', deptId)
        .where('isDeptHead', '==', true)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`❌ [UserRepository] GetDeptHead error:`, error);
      throw new Error(`Failed to get dept head: ${error.message}`);
    }
  }

  /**
   * Get all managers in an organization
   * @param {string} orgId
   * @returns {Promise<Array>}
   */
  async getManagers(orgId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('isManager', '==', true)
        .where('isActive', '==', true)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ [UserRepository] GetManagers error:`, error);
      throw new Error(`Failed to get managers: ${error.message}`);
    }
  }

  /**
   * Get all department heads in an organization
   * @param {string} orgId
   * @returns {Promise<Array>}
   */
  async getDeptHeads(orgId) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('isDeptHead', '==', true)
        .where('isActive', '==', true)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ [UserRepository] GetDeptHeads error:`, error);
      throw new Error(`Failed to get dept heads: ${error.message}`);
    }
  }
  /**
   * Find user by their Hikvision device employee ID within an organization.
   * Used to enforce uniqueness — one Hikvision ID = one EMS user per org.
   * @param {string} orgId - Organization ID
   * @param {string} hikvisionEmployeeId - The ID from the physical device
   * @param {string|null} excludeUserId - Optional: skip this user (for update checks)
   * @returns {Promise<Object|null>}
   */
  async findByHikvisionId(orgId, hikvisionEmployeeId, excludeUserId = null) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('hikvisionEmployeeId', '==', hikvisionEmployeeId)
        .where('isActive', '==', true)
        .limit(2)
        .get();

      const matches = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== excludeUserId); // exclude self when updating

      return matches.length > 0 ? matches[0] : null;
    } catch (error) {
      console.error(`❌ [UserRepository] FindByHikvisionId error:`, error);
      throw new Error(`Database error while checking Hikvision ID: ${error.message}`);
    }
  }
}

module.exports = UserRepository;
