/**
 * EmployeeService.js (REFACTORED)
 * 
 * Business logic layer for employee management.
 * Uses UserRepository for data access.
 * Uses QuotaService for quota enforcement.
 * 
 * SOLID Principles:
 * - Single Responsibility: Only employee business logic
 * - Dependency Inversion: Depends on abstractions (repositories)
 * - Open/Closed: Can extend without modifying existing code
 */

const bcrypt = require('bcryptjs');

class EmployeeService {
  /**
 * Constructor with dependency injection
 * @param {UserRepository} userRepository
 * @param {QuotaService} quotaService
 * @param {OrganizationRepository} organizationRepository (optional)
 * @param {AuditLogService} auditLogService
 * @param {DepartmentRepository} departmentRepository (optional)
 * @param {LeaveRepository} leaveRepository (optional)
 */
  constructor(userRepository, quotaService, organizationRepository = null, auditLogService = null, departmentRepository = null, leaveRepository = null) {
    this.userRepo = userRepository;
    this.quotaService = quotaService;
    this.orgRepo = organizationRepository;
    this.auditService = auditLogService;
    this.deptRepo = departmentRepository;
    this.leaveRepo = leaveRepository;
  }

  /**
   * Create a new employee
   * @param {string} orgId - Organization ID
   * @param {Object} employeeData - Employee data
   * @param {string} creatorId - User creating the employee
   * @param {string} creatorRole - Creator's role (admin/business_owner)
   * @returns {Promise<Object>} Created employee (without password)
   */
  async createEmployee(orgId, employeeData, creatorId, creatorRole) {
    console.log(`👤 EmployeeService.createEmployee() - Org: ${orgId}, Creator: ${creatorRole}`);

    try {
      // 0. Determine target role (default to employee)
      const targetRole = employeeData.role || 'employee';

      // 1. Validate organization exists and is active
      if (this.orgRepo) {
        const isActive = await this.orgRepo.isActive(orgId);
        if (!isActive) {
          throw new Error('Organization is inactive. Cannot create users.');
        }
      }

      // 2. Validate quota (organization limit + admin quota if applicable)
      const validation = await this.quotaService.validateUserCreation(
        orgId,
        targetRole,
        creatorId,
        creatorRole
      );

      if (!validation.allowed) {
        console.log(`⛔ Quota validation failed: ${validation.reason}`);
        throw new Error(validation.reason);
      }

      // 3. Check if email already exists in organization
      const existingEmployee = await this.userRepo.findByEmail(orgId, employeeData.email);
      if (existingEmployee) {
        throw new Error(`User with email ${employeeData.email} already exists in this organization.`);
      }

      // 4. Hash password
      const passwordHash = await bcrypt.hash(employeeData.password, 10);

      // 5. Create user
      const employee = await this.userRepo.create(orgId, {
        name: employeeData.name,
        email: employeeData.email.toLowerCase(),
        passwordHash,
        role: targetRole,
        department: employeeData.department || '',
        departmentId: employeeData.departmentId || null,
        position: employeeData.position || (targetRole === 'admin' ? 'Admin' : 'Employee'),
        isDeptHead: employeeData.isDeptHead || false,
        isManager: employeeData.isManager || false,
        managerId: employeeData.managerId || null,
        salary: employeeData.salary || '0',
        workingType: employeeData.workingType || 'full-time',
        skills: employeeData.skills || '',
        address: employeeData.address || '',
        emergencyContact: employeeData.emergencyContact || '',
        phone: employeeData.phone || '',
        hikvisionEmployeeId: employeeData.hikvisionEmployeeId || null,
        createdBy: creatorId
      });

      // 6. Increment department member count if department assigned
      if (employeeData.departmentId && this.deptRepo) {
        await this.deptRepo.incrementMemberCount(orgId, employeeData.departmentId);
        // If this is a dept head, update the department record
        if (employeeData.isDeptHead) {
          await this.deptRepo.setHead(orgId, employeeData.departmentId, employee.id, employee.name);
        }
      }

      // 6b. Assign manager relationship if managerId is provided
      if (employeeData.managerId) {
        try {
          await this.userRepo.assignManager(orgId, employee.id, employeeData.managerId);
          console.log(`✅ Auto-assigned manager ${employeeData.managerId} for employee ${employee.id}`);
        } catch (err) {
          console.warn(`⚠️ Failed to auto-assign manager: ${err.message}`);
        }
      }

      // 6. Record creation in quota system
      await this.quotaService.recordUserCreation(orgId, targetRole, creatorId, creatorRole);

      // 7. Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: creatorId, name: 'Creator', role: creatorRole }, // ideally fetch name
          action: 'EMPLOYEE_CREATE',
          targetId: employee.id,
          targetType: 'employee',
          details: { name: employeeData.name, email: employeeData.email, role: targetRole }
        });
      }

      // 8. Remove password hash from response
      const { passwordHash: _, ...employeeWithoutPassword } = employee;

      console.log(`✅ Employee created successfully: ${employee.name} (${employee.id})`);
      return employeeWithoutPassword;
    } catch (error) {
      console.error(`❌ EmployeeService: Error creating employee:`, error);
      throw new Error(`Failed to create employee: ${error.message}`);
    }
  }

  /**
   * Promote an employee to manager
   * @param {string} orgId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async promoteToManager(orgId, userId) {
    const user = await this.userRepo.findById(orgId, userId);
    if (!user) throw new Error('User not found');
    if (user.isDeptHead) throw new Error('A department head cannot also be a manager');
    if (user.isManager) throw new Error('User is already a manager');

    const updated = await this.userRepo.update(orgId, userId, {
      isManager: true,
      isTeamLead: true
    });
    const { passwordHash: _, ...safe } = updated;
    return safe;
  }

  /**
   * Demote a manager back to employee
   * @param {string} orgId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async demoteFromManager(orgId, userId) {
    const user = await this.userRepo.findById(orgId, userId);
    if (!user) throw new Error('User not found');
    if (!user.isManager) throw new Error('User is not a manager');

    // Remove all direct reports from this manager
    const directReports = user.directReports || [];
    for (const reportId of directReports) {
      await this.userRepo.update(orgId, reportId, {
        managerId: null,
        managerName: null
      });
    }

    const updated = await this.userRepo.update(orgId, userId, {
      isManager: false,
      isTeamLead: user.isDeptHead, // keep isTeamLead if they're a dept head
      directReports: []
    });
    const { passwordHash: _, ...safe } = updated;
    return safe;
  }

  /**
   * Get department members (for HOD view)
   * @param {string} orgId
   * @param {string} deptId
   * @returns {Promise<Array>}
   */
  async getDepartmentMembers(orgId, deptId) {
    const members = await this.userRepo.findByDepartment(orgId, deptId);
    return members.map(m => {
      const { passwordHash, ...safe } = m;
      return safe;
    });
  }
  /**
   * Get employee by ID
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object|null>} Employee data (without password)
   */
  async getEmployeeById(orgId, employeeId) {
    console.log(`🔍 EmployeeService.getEmployeeById() - ID: ${employeeId}`);

    try {
      const employee = await this.userRepo.findById(orgId, employeeId);

      if (!employee) {
        console.log(`⚠️ Employee not found: ${employeeId}`);
        return null;
      }

      // Remove password hash
      const { passwordHash, ...employeeWithoutPassword } = employee;

      console.log(`✅ Employee retrieved: ${employee.name}`);
      return employeeWithoutPassword;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting employee:`, error);
      throw new Error(`Failed to get employee: ${error.message}`);
    }
  }

  /**
   * Get all employees in organization
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Optional filters { isActive }
   * @returns {Promise<Array>} List of employees (without passwords)
   */
  async getAllEmployees(orgId, filters = {}) {
    console.log(`📋 EmployeeService.getAllEmployees() - Org: ${orgId}`);

    try {
      const employees = await this.userRepo.findByRole(orgId, 'employee');

      // Apply filters
      let filteredEmployees = employees;

      if (filters.isActive !== undefined) {
        filteredEmployees = employees.filter(emp => emp.isActive === filters.isActive);
      }

      // Remove password hashes
      const employeesWithoutPasswords = filteredEmployees.map(emp => {
        const { passwordHash, ...empWithoutPassword } = emp;
        return empWithoutPassword;
      });

      console.log(`✅ Retrieved ${employeesWithoutPasswords.length} employees`);
      return employeesWithoutPasswords;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting all employees:`, error);
      throw new Error(`Failed to get employees: ${error.message}`);
    }
  }

  /**
   * Get active employees only
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} List of active employees
   */
  async getActiveEmployees(orgId) {
    return await this.getAllEmployees(orgId, { isActive: true });
  }

  /**
   * Update employee information
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated employee (without password)
   */
  async updateEmployee(orgId, employeeId, updateData) {
    console.log(`📝 EmployeeService.updateEmployee() - ID: ${employeeId}`);

    try {
      // Check if employee exists
      const existingEmployee = await this.userRepo.findById(orgId, employeeId);
      if (!existingEmployee) {
        throw new Error('Employee not found');
      }

      // If updating email, check for duplicates
      if (updateData.email && updateData.email !== existingEmployee.email) {
        const duplicate = await this.userRepo.findByEmail(orgId, updateData.email);
        if (duplicate) {
          throw new Error(`Email ${updateData.email} is already in use`);
        }
        updateData.email = updateData.email.toLowerCase();
      }

      // If updating password, hash it
      if (updateData.password) {
        updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
        delete updateData.password;
      }

      // Don't allow changing role, createdBy, or organizationId
      delete updateData.role;
      delete updateData.createdBy;
      delete updateData.organizationId;

      // Update employee
      const updated = await this.userRepo.update(orgId, employeeId, updateData);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: 'system', name: 'System', role: 'system' }, // TODO: Pass user context to updateEmployee
          action: 'EMPLOYEE_UPDATE',
          targetId: employeeId,
          targetType: 'employee',
          details: { updatedFields: Object.keys(updateData) }
        });
      }

      // Remove password hash
      const { passwordHash, ...updatedWithoutPassword } = updated;

      console.log(`✅ Employee updated successfully: ${updated.name}`);
      return updatedWithoutPassword;
    } catch (error) {
      console.error(`❌ EmployeeService: Error updating employee:`, error);
      throw new Error(`Failed to update employee: ${error.message}`);
    }
  }

  /**
   * Delete employee (soft delete - mark as inactive)
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @param {string} deletedBy - User performing deletion
   * @returns {Promise<Object>} Deleted employee info
   */
  async deleteEmployee(orgId, employeeId, deletedBy) {
    console.log(`🗑️ EmployeeService.deleteEmployee() - ID: ${employeeId}`);

    try {
      // Check if employee exists
      const employee = await this.userRepo.findById(orgId, employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Idempotency: If already inactive, just return success
      if (!employee.isActive) {
        console.log(`⚠️ Employee ${employee.name} is already inactive. Returning success.`);
        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          isActive: false,
          deletedAt: employee.deletedAt || new Date().toISOString(),
          deletedBy
        };
      }

      // Safe role access
      const userRole = employee.role || 'employee';

      // NEW: Cascade cleanup before deletion
      // 1. Unassign all direct reports from this manager
      const directReports = employee.directReports || [];
      if (directReports.length > 0) {
        for (const reportId of directReports) {
          await this.userRepo.update(orgId, reportId, {
            managerId: null,
            managerName: null
          });
        }
        // Clear the manager's own directReports array
        await this.userRepo.update(orgId, employeeId, { directReports: [] });
        console.log(`🔄 Unassigned ${directReports.length} direct reports from ${employee.name}`);
      }

      // 2. If this employee is a Dept Head, clear the department's headId
      if (employee.isDeptHead && employee.departmentId && this.deptRepo) {
        await this.deptRepo.clearHead(orgId, employee.departmentId);
        console.log(`🔄 Cleared HOD from department ${employee.departmentId}`);
      }

      // 3. Reassign any pending leave requests that were routed to this person
      if (this.leaveRepo) {
        const pendingLeaves = await this.leaveRepo.findByApprover(orgId, employeeId, { status: 'pending' });
        if (pendingLeaves && pendingLeaves.length > 0) {
          for (const leave of pendingLeaves) {
            // Set approverId to null so admins/BO can pick them up
            await this.leaveRepo.updateApprover(orgId, leave.id, null, null);
          }
          console.log(`🔄 Reassigned ${pendingLeaves.length} pending leaves from deleted approver`);
        }
      }

      // Soft delete (mark as inactive)
      const deleted = await this.userRepo.softDelete(orgId, employeeId);

      // Record deletion in quota system (decrement counts)
      // Only record if we actually flipped isActive from true to false
      await this.quotaService.recordUserDeletion(
        orgId,
        userRole, // Use actual role (admin/employee)
        employee.createdBy || null // Original creator ID
      );

      // Audit Log
      if (this.auditService) {
        try {
          await this.auditService.log({
            organizationId: orgId,
            actor: { uid: deletedBy, name: 'User', role: 'unknown' }, // Simple actor info
            action: 'EMPLOYEE_DELETE_SOFT',
            targetId: employeeId,
            targetType: userRole,
            details: { name: employee.name, email: employee.email }
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-critical):', auditError.message);
        }
      }

      console.log(`✅ Employee deactivated: ${employee.name}`);
      return {
        id: deleted.id,
        name: deleted.name,
        email: deleted.email,
        isActive: deleted.isActive,
        deletedAt: deleted.deletedAt,
        deletedBy
      };
    } catch (error) {
      console.error(`❌ EmployeeService: Error deleting employee:`, error);
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
  }

  /**
   * Permanently delete employee (hard delete - use with caution)
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<boolean>} True if deleted
   */
  async permanentlyDeleteEmployee(orgId, employeeId) {
    console.log(`⚠️ EmployeeService.permanentlyDeleteEmployee() - ID: ${employeeId}`);

    try {
      // Get employee info before deletion
      const employee = await this.userRepo.findById(orgId, employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Hard delete
      await this.userRepo.delete(orgId, employeeId);

      // Record deletion in quota system
      await this.quotaService.recordUserDeletion(
        orgId,
        'employee',
        employee.createdBy
      );

      console.log(`⚠️ Employee permanently deleted: ${employee.name}`);
      return true;
    } catch (error) {
      console.error(`❌ EmployeeService: Error permanently deleting employee:`, error);
      throw new Error(`Failed to permanently delete employee: ${error.message}`);
    }
  }

  /**
   * Restore soft-deleted employee
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object>} Restored employee
   */
  async restoreEmployee(orgId, employeeId) {
    console.log(`♻️ EmployeeService.restoreEmployee() - ID: ${employeeId}`);

    try {
      // Check if employee exists
      const employee = await this.userRepo.findById(orgId, employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      if (employee.isActive) {
        throw new Error('Employee is already active');
      }

      // Check quota before restoring
      const validation = await this.quotaService.canAddUserToOrg(orgId, 'employee');
      if (!validation.allowed) {
        throw new Error('Cannot restore: ' + validation.reason);
      }

      // Restore (mark as active)
      const restored = await this.userRepo.update(orgId, employeeId, {
        isActive: true,
        deletedAt: null
      });

      // Record restoration in quota system
      await this.quotaService.recordUserCreation(
        orgId,
        'employee',
        employee.createdBy,
        'admin' // Assume original creator was admin
      );

      // Remove password hash
      const { passwordHash, ...restoredWithoutPassword } = restored;

      console.log(`✅ Employee restored: ${restored.name}`);
      return restoredWithoutPassword;
    } catch (error) {
      console.error(`❌ EmployeeService: Error restoring employee:`, error);
      throw new Error(`Failed to restore employee: ${error.message}`);
    }
  }

  /**
   * Search employees by name or email
   * @param {string} orgId - Organization ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching employees
   */
  async searchEmployees(orgId, searchTerm) {
    console.log(`🔍 EmployeeService.searchEmployees() - Term: ${searchTerm}`);

    try {
      const allEmployees = await this.getAllEmployees(orgId, { isActive: true });

      const lowercaseSearch = searchTerm.toLowerCase();

      const matches = allEmployees.filter(emp =>
        emp.name.toLowerCase().includes(lowercaseSearch) ||
        emp.email.toLowerCase().includes(lowercaseSearch) ||
        (emp.department && emp.department.toLowerCase().includes(lowercaseSearch))
      );

      console.log(`✅ Found ${matches.length} matching employees`);
      return matches;
    } catch (error) {
      console.error(`❌ EmployeeService: Error searching employees:`, error);
      throw new Error(`Failed to search employees: ${error.message}`);
    }
  }

  /**
   * Get employees by department
   * @param {string} orgId - Organization ID
   * @param {string} department - Department name
   * @returns {Promise<Array>} Employees in department
   */
  async getEmployeesByDepartment(orgId, department) {
    console.log(`📋 EmployeeService.getEmployeesByDepartment() - Dept: ${department}`);

    try {
      const allEmployees = await this.getActiveEmployees(orgId);

      const deptEmployees = allEmployees.filter(emp =>
        emp.department && emp.department.toLowerCase() === department.toLowerCase()
      );

      console.log(`✅ Found ${deptEmployees.length} employees in ${department}`);
      return deptEmployees;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting employees by department:`, error);
      throw new Error(`Failed to get employees by department: ${error.message}`);
    }
  }

  /**
   * Get employee count for organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Employee counts
   */
  async getEmployeeCount(orgId) {
    console.log(`📊 EmployeeService.getEmployeeCount() - Org: ${orgId}`);

    try {
      // Get all users to count admins and employees
      const allUsers = await this.userRepo.findAll(orgId);

      console.log('🔍 DEBUG getEmployeeCount users:', allUsers.map(u => ({ id: u.id, name: u.name, role: u.role, isActive: u.isActive })));

      const businessOwners = allUsers.filter(u => u.role === 'business_owner');
      const admins = allUsers.filter(u => u.role === 'admin');
      const employees = allUsers.filter(u => u.role === 'employee');

      const counts = {
        total: allUsers.length,
        businessOwners: businessOwners.length,
        admins: admins.length,
        employees: employees.length,
        // Only count 'employee' role for active/inactive stats to avoid including BO/Admins
        active: employees.filter(u => u.isActive).length,
        inactive: employees.filter(u => !u.isActive).length
      };

      console.log(`✅ Employee counts:`, counts);
      return counts;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting employee count:`, error);
      throw new Error(`Failed to get employee count: ${error.message}`);
    }
  }

  /**
   * Validate employee credentials (for login)
   * @param {string} orgId - Organization ID
   * @param {string} email - Employee email
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} Employee data (without password) if valid, null if invalid
   */
  async validateCredentials(orgId, email, password) {
    console.log(`🔐 EmployeeService.validateCredentials() - Email: ${email}`);

    try {
      const employee = await this.userRepo.findByEmail(orgId, email);

      if (!employee) {
        console.log(`⚠️ Employee not found: ${email}`);
        return null;
      }

      if (!employee.isActive) {
        console.log(`⚠️ Employee account is inactive: ${email}`);
        return null;
      }

      // Compare password
      const isValid = await bcrypt.compare(password, employee.passwordHash);

      if (!isValid) {
        console.log(`⚠️ Invalid password for: ${email}`);
        return null;
      }

      // Remove password hash
      const { passwordHash, ...employeeWithoutPassword } = employee;

      console.log(`✅ Credentials validated for: ${employee.name}`);
      return employeeWithoutPassword;
    } catch (error) {
      console.error(`❌ EmployeeService: Error validating credentials:`, error);
      return null;
    }
  }

  /**
   * Change employee password
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} True if password changed
   */
  async changePassword(orgId, employeeId, oldPassword, newPassword) {
    console.log(`🔑 EmployeeService.changePassword() - ID: ${employeeId}`);

    try {
      const employee = await this.userRepo.findById(orgId, employeeId);

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Verify old password
      const isValid = await bcrypt.compare(oldPassword, employee.passwordHash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepo.update(orgId, employeeId, {
        passwordHash: newPasswordHash
      });

      console.log(`✅ Password changed successfully for: ${employee.name}`);
      return true;
    } catch (error) {
      console.error(`❌ EmployeeService: Error changing password:`, error);
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  /**
   * Get employees created by specific admin
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Array>} Employees created by this admin
   */
  async getEmployeesCreatedByAdmin(orgId, adminId) {
    console.log(`📋 EmployeeService.getEmployeesCreatedByAdmin() - Admin: ${adminId}`);

    try {
      const allEmployees = await this.getActiveEmployees(orgId);

      const adminEmployees = allEmployees.filter(emp => emp.createdBy === adminId);

      console.log(`✅ Found ${adminEmployees.length} employees created by admin`);
      return adminEmployees;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting admin's employees:`, error);
      throw new Error(`Failed to get admin's employees: ${error.message}`);
    }
  }

  /**
   * Get employee statistics
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Employee statistics
   */
  async getEmployeeStats(orgId) {
    console.log(`📊 EmployeeService.getEmployeeStats() - Org: ${orgId}`);

    try {
      const stats = await this.userRepo.getStats(orgId);

      console.log(`✅ Employee statistics generated:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ EmployeeService: Error getting employee stats:`, error);
      throw new Error(`Failed to get employee stats: ${error.message}`);
    }
  }
  /**
   * Assign a manager to an employee
   * @param {string} orgId - Organization ID
   * @param {string} employeeId - Employee ID
   * @param {string} managerId - Manager ID (or null to unassign)
   * @param {string} assignedBy - Admin user ID performing the assignment
   * @returns {Promise<Object>} Updated employee
   */
  async assignManager(orgId, employeeId, managerId, assignedBy) {
    console.log(`👥 EmployeeService.assignManager() - Employee: ${employeeId}, Manager: ${managerId}`);

    try {
      // Validate employee exists
      const employee = await this.userRepo.findById(orgId, employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // If assigning a manager, validate manager exists
      let managerName = null;
      if (managerId) {
        if (managerId === employeeId) {
          throw new Error('Cannot assign user as their own manager');
        }
        const manager = await this.userRepo.findById(orgId, managerId);
        if (!manager) {
          throw new Error('Manager not found');
        }
        managerName = manager.name;
      }

      // Perform assignment
      const updatedEmployee = await this.userRepo.assignManager(orgId, employeeId, managerId);

      // Audit Log
      if (this.auditService) {
        await this.auditService.log({
          organizationId: orgId,
          actor: { uid: assignedBy, name: 'Admin', role: 'admin' }, // TODO: Better actor info
          action: 'EMPLOYEE_ASSIGN_MANAGER',
          targetId: employeeId,
          targetType: 'employee',
          details: {
            managerId,
            managerName,
            previousManager: employee.managerId
          }
        });
      }

      // Remove password hash
      const { passwordHash, ...safeEmployee } = updatedEmployee;
      return safeEmployee;
    } catch (error) {
      console.error(`❌ EmployeeService: Error assigning manager:`, error);
      throw new Error(`Failed to assign manager: ${error.message}`);
    }
  }
}

module.exports = EmployeeService;
