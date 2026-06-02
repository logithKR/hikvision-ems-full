/**
 * admin.js (UPDATED - RBAC Fixed)
 * 
 * Routes for Admin and Business Owner with proper access control:
 * - Admin: Create/Update/Delete employees, Approve leaves
 * - Business Owner: View-only + Admin management
 * - Both: View employees, attendance, leaves
 */

const express = require('express');
const router = express.Router();
const container = require('../container');
const {
  authenticateToken,
  requireAdmin,
  requireBusinessOwner,
  requireAdminOrBusinessOwner
} = require('../middleware');

// Get services
const employeeService = container.getEmployeeService();
const attendanceService = container.getAttendanceService();
const leaveService = container.getLeaveService();
const quotaService = container.getQuotaService();
const departmentRepo = container.getDepartmentRepo();
const userRepo = container.getUserRepo();

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

/**
 * CREATE Employee (ADMIN ONLY)
 * POST /api/admin/employees
 */
router.post('/employees', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📝 POST /api/admin/employees - Create user (Admin/Employee)');
  try {
    const { name, email, password, department, position, salary, workingType, skills, address, emergencyContact, phone, role, hikvisionEmployeeId } = req.body;
    const { organizationId, uid: creatorId, role: creatorRole } = req.user;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // 🔒 UNIQUENESS: One Hikvision ID can only be assigned to one active user per org
    if (hikvisionEmployeeId) {
      const existing = await userRepo.findByHikvisionId(organizationId, hikvisionEmployeeId);
      if (existing) {
        return res.status(409).json({
          error: `Hikvision Device ID "${hikvisionEmployeeId}" is already assigned to ${existing.name}. Each device ID can only map to one employee.`
        });
      }
    }

    // Default to 'employee' if role not provided
    const targetRole = role || 'employee';

    // Create user (quota validation and permission check happens in service)
    const employee = await employeeService.createEmployee(
      organizationId,
      { name, email, password, department, departmentId: req.body.departmentId, position, salary, workingType, skills, address, emergencyContact, phone, role: targetRole, isDeptHead: req.body.isDeptHead || false, isManager: req.body.isManager || false, managerId: req.body.managerId || null, hikvisionEmployeeId: hikvisionEmployeeId || null },
      creatorId,
      creatorRole
    );

    res.status(201).json({
      message: 'Employee created successfully',
      employee
    });

  } catch (error) {
    console.error('❌ Error creating employee:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET All Employees (ADMIN + BUSINESS OWNER - Read Only)
 * GET /api/admin/employees
 * Returns all organization members (admins + employees) for Business Owner view
 */
router.get('/employees', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📋 GET /api/admin/employees - Get all employees');
  try {
    const { organizationId } = req.user;
    const { isActive, role } = req.query;

    console.log('🔍 DEBUG: Admin Employees - User:', {
      uid: req.user.uid,
      role: req.user.role,
      organizationId
    });

    if (!organizationId) {
      console.error('❌ Error: organizationId is missing from req.user');
      return res.status(500).json({ error: 'Organization ID is missing from user session' });
    }

    // Use userRepo.findAll() to get all org members (admins + employees)
    const filters = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (role) {
      filters.role = role;
    }

    // Access userRepo from the container
    const userRepo = container.getUserRepo();
    const allUsers = await userRepo.findAll(organizationId, filters);

    // Remove password hashes from response
    const usersWithoutPasswords = allUsers.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json({
      count: usersWithoutPasswords.length,
      employees: usersWithoutPasswords
    });

  } catch (error) {
    console.error('❌ Error getting employees:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Active Employees Only (ADMIN + BUSINESS OWNER)
 * GET /api/admin/employees/active
 */
router.get('/employees/active', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📋 GET /api/admin/employees/active');
  try {
    const { organizationId } = req.user;
    const employees = await employeeService.getActiveEmployees(organizationId);

    res.json({
      count: employees.length,
      employees
    });

  } catch (error) {
    console.error('❌ Error getting active employees:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Employees Created by Me (ADMIN ONLY)
 * GET /api/admin/employees/created-by-me
 * NOTE: This MUST be before /employees/:id to prevent route shadowing
 */
router.get('/employees/created-by-me', authenticateToken, requireAdmin, async (req, res) => {
  console.log('📋 GET /api/admin/employees/created-by-me');
  try {
    const { organizationId, uid: adminId } = req.user;

    const employees = await employeeService.getEmployeesCreatedByAdmin(organizationId, adminId);

    res.json({
      count: employees.length,
      employees
    });

  } catch (error) {
    console.error('❌ Error getting admin employees:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Employee by ID (ADMIN + BUSINESS OWNER)
 * GET /api/admin/employees/:id
 */
router.get('/employees/:id', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log(`📋 GET /api/admin/employees/${req.params.id}`);
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const employee = await employeeService.getEmployeeById(organizationId, id);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee });

  } catch (error) {
    console.error('❌ Error getting employee:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE Employee (ADMIN ONLY)
 * PUT /api/admin/employees/:id
 */
router.put('/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
  console.log(`📝 PUT /api/admin/employees/${req.params.id} - Update employee`);
  try {
    const { organizationId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // 🔒 UNIQUENESS: If a new Hikvision ID is being set, ensure no other active user already has it
    if (updateData.hikvisionEmployeeId) {
      const existing = await userRepo.findByHikvisionId(organizationId, updateData.hikvisionEmployeeId, id);
      if (existing) {
        return res.status(409).json({
          error: `Hikvision Device ID "${updateData.hikvisionEmployeeId}" is already assigned to ${existing.name}. Each device ID can only map to one employee.`
        });
      }
    }

    const employee = await employeeService.updateEmployee(organizationId, id, updateData);

    res.json({
      message: 'Employee updated successfully',
      employee
    });

  } catch (error) {
    console.error('❌ Error updating employee:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE Employee (ADMIN ONLY)
 * DELETE /api/admin/employees/:id
 */
router.delete('/employees/:id', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log(`🗑️ DELETE /api/admin/employees/${req.params.id}`);
  try {
    const { organizationId, uid: deletedBy } = req.user;
    const { id } = req.params;

    // Privilege Protection: Prevent self-deletion
    if (id === deletedBy) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Privilege Protection: Prevent deleting business owner
    const targetUser = await userRepo.findById(organizationId, id);
    if (targetUser && targetUser.role === 'business_owner') {
      return res.status(403).json({ error: 'Business owner accounts cannot be deleted' });
    }

    const result = await employeeService.deleteEmployee(organizationId, id, deletedBy);

    res.json({
      message: 'Employee deleted successfully',
      employee: result
    });
  } catch (error) {
    console.error('❌ Error deleting employee:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ASSIGN MANAGER (ADMIN ONLY)
 * PUT /api/admin/employees/:id/assign-manager
 */
router.put('/employees/:id/assign-manager', authenticateToken, requireAdmin, async (req, res) => {
  console.log(`👥 PUT /api/admin/employees/${req.params.id}/assign-manager`);
  try {
    const { organizationId, uid: adminId } = req.user;
    const { id } = req.params;
    const { managerId } = req.body; // Can be null to unassign

    const updatedEmployee = await employeeService.assignManager(organizationId, id, managerId, adminId);

    res.json({
      message: 'Manager assigned successfully',
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('❌ Error assigning manager:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * RESTORE Employee (ADMIN ONLY)
 * POST /api/admin/employees/:id/restore
 */
router.post('/employees/:id/restore', authenticateToken, requireAdmin, async (req, res) => {
  console.log(`♻️ POST /api/admin/employees/${req.params.id}/restore`);
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const employee = await employeeService.restoreEmployee(organizationId, id);

    res.json({
      message: 'Employee restored successfully',
      employee
    });

  } catch (error) {
    console.error('❌ Error restoring employee:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * SEARCH Employees (ADMIN + BUSINESS OWNER)
 * GET /api/admin/employees/search/:term
 */
router.get('/employees/search/:term', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log(`🔍 GET /api/admin/employees/search/${req.params.term}`);
  try {
    const { organizationId } = req.user;
    const { term } = req.params;

    const employees = await employeeService.searchEmployees(organizationId, term);

    res.json({
      count: employees.length,
      employees
    });

  } catch (error) {
    console.error('❌ Error searching employees:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Employees by Department (ADMIN + BUSINESS OWNER)
 * GET /api/admin/employees/department/:dept
 */
router.get('/employees/department/:dept', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log(`📋 GET /api/admin/employees/department/${req.params.dept}`);
  try {
    const { organizationId } = req.user;
    const { dept } = req.params;

    const employees = await employeeService.getEmployeesByDepartment(organizationId, dept);

    res.json({
      department: dept,
      count: employees.length,
      employees
    });

  } catch (error) {
    console.error('❌ Error getting employees by department:', error);
    res.status(500).json({ error: error.message });
  }
});

// created-by-me route moved above /employees/:id to prevent shadowing

// ============================================
// ATTENDANCE MANAGEMENT (View Only for Both)
// ============================================

/**
 * GET Attendance Records (ADMIN + BUSINESS OWNER - Read Only)
 * GET /api/admin/attendance
 */
router.get('/attendance', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📊 GET /api/admin/attendance');
  try {
    const { organizationId } = req.user;
    const { date, userId, startDate, endDate } = req.query;

    const filters = {};
    if (date) filters.date = date;
    if (userId) filters.userId = userId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const records = await attendanceService.getAllRecords(organizationId, filters);

    res.json({
      count: records.length,
      records
    });

  } catch (error) {
    console.error('❌ Error getting attendance records:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Attendance Summary (ADMIN + BUSINESS OWNER - Read Only)
 * GET /api/admin/attendance/summary
 */
router.get('/attendance/summary', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📊 GET /api/admin/attendance/summary');
  try {
    const { organizationId } = req.user;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const summary = await attendanceService.getSummary(organizationId, date);

    res.json({ date, summary });

  } catch (error) {
    console.error('❌ Error getting attendance summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEAVE MANAGEMENT
// ============================================

/**
 * GET All Leave Requests (ADMIN + BUSINESS OWNER - Read Only)
 * GET /api/admin/leaves
 */
router.get('/leaves', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📋 GET /api/admin/leaves');
  try {
    const { organizationId } = req.user;
    const { status, userId, startDate, endDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const leaves = await leaveService.getAllLeaves(organizationId, filters);

    res.json({
      count: leaves.length,
      leaves
    });

  } catch (error) {
    console.error('❌ Error getting leaves:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Pending Leave Requests (ADMIN + BUSINESS OWNER - Read Only)
 * GET /api/admin/leaves/pending
 */
router.get('/leaves/pending', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('⏳ GET /api/admin/leaves/pending');
  try {
    const { organizationId } = req.user;

    const pendingLeaves = await leaveService.getPendingLeaves(organizationId);

    res.json({
      count: pendingLeaves.length,
      leaves: pendingLeaves
    });

  } catch (error) {
    console.error('❌ Error getting pending leaves:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Leave Statistics (ADMIN + BUSINESS OWNER)
 * GET /api/admin/leaves/stats/summary
 */
router.get('/leaves/stats/summary', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📊 GET /api/admin/leaves/stats/summary');
  try {
    const { organizationId } = req.user;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const stats = await leaveService.getLeaveSummary(organizationId);

    res.json({ year, stats });

  } catch (error) {
    console.error('❌ Error getting leave stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// QUOTA MANAGEMENT
// ============================================

/**
 * GET My Quota (ADMIN ONLY)
 * GET /api/admin/quota
 */
router.get('/quota', authenticateToken, requireAdmin, async (req, res) => {
  console.log('📊 GET /api/admin/quota');
  try {
    const { organizationId, uid: userId, role } = req.user;

    const quotaInfo = await quotaService.getMyQuotaInfo(organizationId, userId, role);

    res.json(quotaInfo);

  } catch (error) {
    console.error('❌ Error getting quota:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * CHECK if Admin Can Create Employee (ADMIN ONLY)
 * GET /api/admin/quota/check
 */
router.get('/quota/check', authenticateToken, requireAdmin, async (req, res) => {
  console.log('🔍 GET /api/admin/quota/check');
  try {
    const { organizationId, uid: adminId } = req.user;

    const canCreate = await quotaService.canAdminCreateEmployee(organizationId, adminId);

    res.json(canCreate);

  } catch (error) {
    console.error('❌ Error checking quota:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Admin Quota Status (BUSINESS OWNER ONLY)
 * GET /api/admin/admins/quota-status
 */
router.get('/admins/quota-status', authenticateToken, requireBusinessOwner, async (req, res) => {
  console.log('📊 GET /api/admin/admins/quota-status');
  try {
    const { organizationId } = req.user;

    const adminsQuota = await quotaService.getAdminQuotaStatus(organizationId);

    res.json({
      count: adminsQuota.length,
      admins: adminsQuota
    });

  } catch (error) {
    console.error('❌ Error getting admin quota status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE Admin Quota (BUSINESS OWNER ONLY)
 * PUT /api/admin/admins/:id/quota
 */
router.put('/admins/:id/quota', authenticateToken, requireBusinessOwner, async (req, res) => {
  console.log(`📝 PUT /api/admin/admins/${req.params.id}/quota`);
  try {
    const { organizationId } = req.user;
    const { id: adminId } = req.params;
    const { limit } = req.body;

    if (!limit || limit < 1) {
      return res.status(400).json({ error: 'Valid limit is required (minimum 1)' });
    }

    const admin = await quotaService.updateAdminQuota(organizationId, adminId, limit);

    res.json({
      message: 'Admin quota updated successfully',
      admin
    });

  } catch (error) {
    console.error('❌ Error updating admin quota:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DASHBOARD
// ============================================

/**
 * GET Dashboard Statistics (ADMIN + BUSINESS OWNER)
 * GET /api/admin/dashboard/stats
 */
router.get('/dashboard/stats', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('📊 GET /api/admin/dashboard/stats');
  try {
    const { organizationId, role, uid } = req.user;
    const today = new Date().toISOString().split('T')[0];

    // Run all queries in parallel for maximum performance
    const [employeeCounts, attendanceSummary, pendingLeaves, quotaInfo] = await Promise.all([
      employeeService.getEmployeeCount(organizationId),
      attendanceService.getSummary(organizationId, today),
      leaveService.getPendingLeaves(organizationId),
      role === 'admin'
        ? quotaService.getMyQuotaInfo(organizationId, uid, role)
        : role === 'business_owner'
          ? quotaService.getOrgQuotaSummary(organizationId)
          : Promise.resolve(null)
    ]);

    res.json({
      employees: employeeCounts,
      attendance: attendanceSummary,
      leaves: {
        pendingCount: pendingLeaves.length,
        pending: pendingLeaves
      },
      quota: quotaInfo
    });

  } catch (error) {
    console.error('❌ Error getting dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET My Organization Details (ADMIN + BUSINESS OWNER)
 * GET /api/admin/organization
 */
router.get('/organization', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  console.log('🏢 GET /api/admin/organization');
  try {
    const { organizationId } = req.user;

    // Get organization repo from container
    // Get repositories/services from container instance
    const orgRepo = container.getOrganizationRepo();
    const empService = container.getEmployeeService();

    const organization = await orgRepo.findById(organizationId);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get current counts using existing service or repo
    const employeeCounts = await empService.getEmployeeCount(organizationId);

    res.json({
      id: organization.id,
      name: organization.name,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      adminCount: employeeCounts.admins,
      employeeCount: employeeCounts.employees,
      limits: organization.limits || {}
    });

  } catch (error) {
    console.error('❌ Error getting organization details:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEPARTMENT MANAGEMENT (ADMIN ONLY)
// ============================================

/**
 * CREATE Department
 * POST /api/admin/departments
 */
router.post('/departments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId, uid } = req.user;
    const { name, description, maxEmployees } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    // Check duplicate name
    const existing = await departmentRepo.findByName(organizationId, name);
    if (existing) return res.status(400).json({ error: 'Department with this name already exists' });

    const dept = await departmentRepo.create(organizationId, {
      name, description, maxEmployees: maxEmployees || 50, createdBy: uid
    });
    res.status(201).json({ message: 'Department created', department: dept });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET All Departments
 * GET /api/admin/departments
 */
router.get('/departments', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const departments = await departmentRepo.findAll(organizationId);
    res.json({ count: departments.length, departments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET Department by ID (with members)
 * GET /api/admin/departments/:id
 */
router.get('/departments/:id', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const dept = await departmentRepo.findById(organizationId, req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const members = await employeeService.getDepartmentMembers(organizationId, req.params.id);
    res.json({ department: dept, members, memberCount: members.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE Department
 * PUT /api/admin/departments/:id
 */
router.put('/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { name, description, maxEmployees } = req.body;
    const dept = await departmentRepo.update(organizationId, req.params.id, { name, description, maxEmployees });
    res.json({ message: 'Department updated', department: dept });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE Department (deletes all members!)
 * DELETE /api/admin/departments/:id
 */
router.delete('/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId, uid } = req.user;
    const deptId = req.params.id;

    // Get all members
    const members = await userRepo.findByDepartment(organizationId, deptId);
    
    // Create an atomic batch
    const db = container.db;
    const batch = db.batch();
    const timestamp = new Date().toISOString();

    // 1. Soft-delete all members and clear their departmentId link (Option B)
    for (const member of members) {
      const memberRef = db.collection('organizations').doc(organizationId).collection('users').doc(member.id);
      batch.update(memberRef, { 
        isActive: false, 
        deletedAt: timestamp,
        departmentId: null // Clear ID so it doesn't glitch if restored
      });
    }

    // 2. Delete the department itself
    const deptRef = db.collection('organizations').doc(organizationId).collection('departments').doc(deptId);
    batch.delete(deptRef);

    // Commit the batch atomically
    await batch.commit();

    // Run background cleanup tasks (quotas, audit logs) so they don't block the response
    for (const member of members) {
      if (employeeService.quotaService) {
        employeeService.quotaService.recordUserDeletion(organizationId, member.role || 'employee', member.createdBy || null).catch(e => console.error(e));
      }
      if (employeeService.auditService) {
        employeeService.auditService.log({
          organizationId,
          actor: { uid, name: 'Admin', role: 'admin' },
          action: 'EMPLOYEE_DELETE_SOFT',
          targetId: member.id,
          targetType: member.role || 'employee',
          details: { reason: 'Department Deleted' }
        }).catch(e => console.error(e));
      }
    }

    res.json({ message: `Department deleted along with ${members.length} members atomically` });
  } catch (error) {
    console.error('❌ Error deleting department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * CREATE Department Head
 * POST /api/admin/departments/:id/hod
 */
router.post('/departments/:id/hod', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId, uid: creatorId, role: creatorRole } = req.user;
    const deptId = req.params.id;
    const { name, email, password, position, phone, hikvisionEmployeeId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check dept exists
    const dept = await departmentRepo.findById(organizationId, deptId);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if (dept.headId) return res.status(400).json({ error: 'Department already has a HOD. Remove existing HOD first.' });

    const employee = await employeeService.createEmployee(
      organizationId,
      { name, email, password, department: dept.name, departmentId: deptId, position: position || 'Department Head', isDeptHead: true, role: 'employee', phone, hikvisionEmployeeId: hikvisionEmployeeId || null },
      creatorId, creatorRole
    );

    res.status(201).json({ message: 'Department Head created', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CREATE Employee in Department
 * POST /api/admin/departments/:id/employees
 */
router.post('/departments/:id/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId, uid: creatorId, role: creatorRole } = req.user;
    const deptId = req.params.id;
    const { name, email, password, position, phone, hikvisionEmployeeId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const dept = await departmentRepo.findById(organizationId, deptId);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if (!dept.headId) return res.status(400).json({ error: 'Create a Department Head first before adding employees' });

    // Check member limit
    const limit = await departmentRepo.checkMemberLimit(organizationId, deptId);
    if (!limit.canAdd) return res.status(400).json({ error: `Department has reached max capacity (${limit.max})` });

    const employee = await employeeService.createEmployee(
      organizationId,
      { name, email, password, department: dept.name, departmentId: deptId, position: position || 'Employee', role: 'employee', phone, managerId: req.body.managerId || dept.headId || null, hikvisionEmployeeId: hikvisionEmployeeId || null },
      creatorId, creatorRole
    );

    res.status(201).json({ message: 'Employee created in department', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CREATE Manager in Department
 * POST /api/admin/departments/:id/managers
 */
router.post('/departments/:id/managers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId, uid: creatorId, role: creatorRole } = req.user;
    const deptId = req.params.id;
    const { name, email, password, position, phone, hikvisionEmployeeId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const dept = await departmentRepo.findById(organizationId, deptId);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if (!dept.headId) return res.status(400).json({ error: 'Create a Department Head first' });

    const limit = await departmentRepo.checkMemberLimit(organizationId, deptId);
    if (!limit.canAdd) return res.status(400).json({ error: `Department has reached max capacity (${limit.max})` });

    const employee = await employeeService.createEmployee(
      organizationId,
      { name, email, password, department: dept.name, departmentId: deptId, position: position || 'Manager', isManager: true, role: 'employee', phone, managerId: dept.headId || null, hikvisionEmployeeId: hikvisionEmployeeId || null },
      creatorId, creatorRole
    );

    res.status(201).json({ message: 'Manager created in department', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PROMOTE Employee to Manager
 * PUT /api/admin/employees/:id/promote-manager
 */
router.put('/employees/:id/promote-manager', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const employee = await employeeService.promoteToManager(organizationId, req.params.id);
    res.json({ message: 'Employee promoted to Manager', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEMOTE Manager to Employee
 * PUT /api/admin/employees/:id/demote-manager
 */
router.put('/employees/:id/demote-manager', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const employee = await employeeService.demoteFromManager(organizationId, req.params.id);
    res.json({ message: 'Manager demoted to Employee', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADD Team Member to Manager
 * PUT /api/admin/employees/:managerId/add-team-member
 */
router.put('/employees/:managerId/add-team-member', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { managerId } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    // Validate: target cannot be a manager
    const target = await userRepo.findById(organizationId, employeeId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    if (target.isManager) return res.status(400).json({ error: 'A manager cannot be added to another manager\'s team' });

    const updated = await userRepo.assignManager(organizationId, employeeId, managerId);
    const { passwordHash, ...safe } = updated;
    res.json({ message: 'Team member added', employee: safe });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ORG CHART Data
 * GET /api/admin/org-chart
 */
router.get('/org-chart', authenticateToken, requireAdminOrBusinessOwner, async (req, res) => {
  try {
    const { organizationId } = req.user;

    const [departments, allUsers] = await Promise.all([
      departmentRepo.findAll(organizationId),
      userRepo.findAll(organizationId, { isActive: true })
    ]);

    // Build hierarchy
    const formatUser = (u) => {
      if (!u) return null;
      const { passwordHash, ...rest } = u;
      return {
        ...rest,
        joinDate: u.createdAt || u.joinDate,
      };
    };

    const assignedUserIds = new Set();

    const chart = departments.map(dept => {
      const deptMembers = allUsers.filter(u => u.departmentId === dept.id);
      
      const hod = deptMembers.find(u => u.isDeptHead);
      if (hod) assignedUserIds.add(hod.id);

      // Only grab managers that haven't already been claimed (e.g. as HOD)
      const managers = deptMembers.filter(u => u.isManager && !assignedUserIds.has(u.id));
      
      const formattedManagers = managers.map(m => {
        assignedUserIds.add(m.id);
        
        const directReports = (m.directReports || []).map(rid => {
          const r = allUsers.find(u => u.id === rid);
          // CRITICAL FIX: If user is missing OR already claimed somewhere else in the hierarchy, skip them to prevent duplicate nodes.
          if (!r || assignedUserIds.has(r.id)) return null;
          
          assignedUserIds.add(r.id);
          return formatUser(r);
        }).filter(Boolean);

        return {
          ...formatUser(m),
          teamMembers: directReports
        };
      });

      // Department employees are those who haven't been assigned as HOD, Manager, or a Direct Report
      const employees = deptMembers.filter(u => !assignedUserIds.has(u.id));
      employees.forEach(e => assignedUserIds.add(e.id));

      return {
        department: { id: dept.id, name: dept.name, maxEmployees: dept.maxEmployees, memberCount: dept.memberCount },
        hod: formatUser(hod),
        managers: formattedManagers,
        employees: employees.map(e => formatUser(e))
      };
    });

    // Unassigned users are those who are completely orphaned from the tree
    const unassigned = allUsers
      .filter(u => !assignedUserIds.has(u.id) && u.role === 'employee')
      .map(e => formatUser(e));

    res.json({ chart, unassigned });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
