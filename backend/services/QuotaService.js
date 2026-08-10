/**
 * QuotaService.js
 * 
 * Business logic for quota management and enforcement.
 * Implements the hierarchical control system:
 * - System Admin controls organization limits (maxEmployees, maxAdmins)
 * - Business Owner controls admin quotas (employeesPerAdmin)
 * - Admins can create employees within their quota
 * 
 * SOLID Principles:
 * - Single Responsibility: Only quota validation and enforcement
 * - Dependency Inversion: Depends on repositories (abstractions)
 */

class QuotaService {
  /**
   * Constructor with dependency injection
   * @param {OrganizationRepository} organizationRepository
   * @param {UserRepository} userRepository
   */
  constructor(organizationRepository, userRepository) {
    this.orgRepo = organizationRepository;
    this.userRepo = userRepository;
  }

  /**
   * Check if organization can add more users of a specific role
   * @param {string} orgId - Organization ID
   * @param {string} role - User role (admin, employee, business_owner)
   * @returns {Promise<Object>} { allowed: boolean, reason: string, current: number, max: number }
   */
  async canAddUserToOrg(orgId, role) {
    console.log(`🔍 QuotaService.canAddUserToOrg() - Org: ${orgId}, Role: ${role}`);

    try {
      // Check if organization is active
      const isActive = await this.orgRepo.isActive(orgId);
      if (!isActive) {
        console.log(`⛔ Organization is inactive: ${orgId}`);
        return {
          allowed: false,
          reason: 'Organization is inactive. Contact support to reactivate.',
          current: 0,
          max: 0,
          remaining: 0
        };
      }

      // Check role-specific limits
      const limitCheck = await this.orgRepo.checkUserLimit(orgId, role);

      if (limitCheck.hasReachedLimit) {
        console.log(`⛔ Organization limit reached for ${role}: ${limitCheck.current}/${limitCheck.max}`);
        return {
          allowed: false,
          reason: `Organization limit reached. Maximum ${role}s allowed: ${limitCheck.max}. Contact your system admin to increase the limit.`,
          current: limitCheck.current,
          max: limitCheck.max,
          remaining: 0
        };
      }

      console.log(`✅ Organization can add ${role}: ${limitCheck.current}/${limitCheck.max}`);
      return {
        allowed: true,
        reason: null,
        current: limitCheck.current,
        max: limitCheck.max,
        remaining: limitCheck.remaining
      };
    } catch (error) {
      console.error('❌ QuotaService: Error checking org limit:', error);
      throw new Error(`Failed to check organization limit: ${error.message}`);
    }
  }

  /**
   * Check if admin can create more employees
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} { allowed: boolean, reason: string, created: number, limit: number }
   */
  async canAdminCreateEmployee(orgId, adminId) {
    console.log(`🔍 QuotaService.canAdminCreateEmployee() - Admin: ${adminId}`);

    try {
      // First check organization limit for employees
      const orgCheck = await this.canAddUserToOrg(orgId, 'employee');
      if (!orgCheck.allowed) {
        console.log(`⛔ Organization limit prevents employee creation`);
        return {
          allowed: false,
          reason: orgCheck.reason,
          created: 0,
          limit: 0,
          remaining: 0,
          blockedBy: 'organization'
        };
      }

      // Then check admin's personal quota
      const adminQuota = await this.userRepo.checkAdminQuota(orgId, adminId);

      if (!adminQuota.canCreate) {
        console.log(`⛔ Admin quota exceeded: ${adminQuota.created}/${adminQuota.limit}`);
        return {
          allowed: false,
          reason: `Your employee creation quota is full (${adminQuota.created}/${adminQuota.limit}). Contact your business owner to increase your quota.`,
          created: adminQuota.created,
          limit: adminQuota.limit,
          remaining: 0,
          blockedBy: 'admin_quota'
        };
      }

      console.log(`✅ Admin can create employee: ${adminQuota.created}/${adminQuota.limit}`);
      return {
        allowed: true,
        reason: null,
        created: adminQuota.created,
        limit: adminQuota.limit,
        remaining: adminQuota.remaining,
        blockedBy: null
      };
    } catch (error) {
      console.error('❌ QuotaService: Error checking admin quota:', error);
      throw new Error(`Failed to check admin quota: ${error.message}`);
    }
  }

  /**
   * Validate and prepare for user creation (combines all checks)
   * @param {string} orgId - Organization ID
   * @param {string} role - Role to create (admin, employee, business_owner)
   * @param {string} creatorId - User creating (admin/business_owner ID)
   * @param {string} creatorRole - Creator's role
   * @returns {Promise<Object>} { allowed: boolean, reason: string }
   */
  async validateUserCreation(orgId, role, creatorId, creatorRole) {
    console.log(`🔍 QuotaService.validateUserCreation() - Creating ${role} by ${creatorRole}`);

    try {
      // 1. Check if organization exists and is active
      const org = await this.orgRepo.findById(orgId);
      if (!org) {
        return {
          allowed: false,
          reason: 'Organization not found'
        };
      }

      if (!org.isActive) {
        return {
          allowed: false,
          reason: 'Organization is inactive'
        };
      }

      // 2. Check creator permissions
      const creatorCheck = this.validateCreatorPermissions(creatorRole, role);
      if (!creatorCheck.allowed) {
        return creatorCheck;
      }

      // 3. Check organization limits
      const orgCheck = await this.canAddUserToOrg(orgId, role);
      if (!orgCheck.allowed) {
        return orgCheck;
      }

      // 4. If admin creating users, check admin quota
      if (creatorRole === 'admin') {
        const adminCheck = await this.canAdminCreateEmployee(orgId, creatorId);
        if (!adminCheck.allowed) {
          return adminCheck;
        }
      }

      console.log(`✅ User creation validated successfully`);
      return { allowed: true, reason: null };
    } catch (error) {
      console.error('❌ QuotaService: Error validating user creation:', error);
      throw new Error(`Failed to validate user creation: ${error.message}`);
    }
  }

  /**
   * Validate creator has permission to create role
   * @param {string} creatorRole - Creator's role
   * @param {string} targetRole - Role being created
   * @returns {Object} { allowed: boolean, reason: string }
   */
  validateCreatorPermissions(creatorRole, targetRole) {
    console.log(`🔍 QuotaService.validateCreatorPermissions() - ${creatorRole} creating ${targetRole}`);

    // Admin can create any role EXCEPT admin and business_owner
    if (creatorRole === 'admin') {
      const blockedRoles = ['admin', 'business_owner', 'system_admin'];
      if (blockedRoles.includes(targetRole)) {
        console.log(`⛔ ${creatorRole} cannot create ${targetRole}`);
        return {
          allowed: false,
          reason: `Admin is not authorized to create ${targetRole} accounts`
        };
      }
      console.log(`✅ ${creatorRole} can create ${targetRole}`);
      return { allowed: true, reason: null };
    }

    const permissions = {
      system_admin: ['business_owner'], // System Admin can create business owners
      business_owner: ['admin', 'business_owner', 'employee', 'manager'], // Business owner can create most roles
    };

    const allowedRoles = permissions[creatorRole] || [];

    if (!allowedRoles.includes(targetRole)) {
      console.log(`⛔ ${creatorRole} cannot create ${targetRole}`);
      return {
        allowed: false,
        reason: `${creatorRole} is not authorized to create ${targetRole}`
      };
    }

    console.log(`✅ ${creatorRole} can create ${targetRole}`);
    return { allowed: true, reason: null };
  }

  /**
   * Record user creation (increment counts)
   * @param {string} orgId - Organization ID
   * @param {string} role - User role created
   * @param {string} creatorId - Creator user ID (if admin)
   * @param {string} creatorRole - Creator's role
   * @returns {Promise<void>}
   */
  async recordUserCreation(orgId, role, creatorId, creatorRole) {
    console.log(`📝 QuotaService.recordUserCreation() - Role: ${role}, Creator: ${creatorRole}`);

    try {
      // Increment organization count
      await this.orgRepo.incrementUserCount(orgId, role);
      console.log(`✅ Incremented organization ${role} count`);

      // If admin created employee, increment admin's quota usage
      if (creatorRole === 'admin' && role === 'employee') {
        await this.userRepo.incrementAdminQuota(orgId, creatorId);
        console.log(`✅ Incremented admin quota for ${creatorId}`);
      }
    } catch (error) {
      console.error('❌ QuotaService: Error recording user creation:', error);
      throw new Error(`Failed to record user creation: ${error.message}`);
    }
  }

  /**
   * Record user deletion (decrement counts)
   * @param {string} orgId - Organization ID
   * @param {string} role - User role deleted
   * @param {string} creatorId - Original creator ID (if admin)
   * @returns {Promise<void>}
   */
  async recordUserDeletion(orgId, role, creatorId = null) {
    console.log(`📝 QuotaService.recordUserDeletion() - Role: ${role}`);

    try {
      // Decrement organization count
      await this.orgRepo.decrementUserCount(orgId, role);
      console.log(`✅ Decremented organization ${role} count`);

      // If employee was created by an admin, decrement admin's quota
      if (role === 'employee' && creatorId) {
        try {
          // Check if the creator is actually an admin before decrementing
          const creator = await this.userRepo.findById(orgId, creatorId);
          if (creator && creator.role === 'admin') {
            await this.userRepo.decrementAdminQuota(orgId, creatorId);
            console.log(`✅ Decremented admin quota for ${creatorId}`);
          } else {
            console.log(`ℹ️ Creator ${creatorId} is not an admin (role: ${creator?.role}), skipping quota decrement`);
          }
        } catch (quotaError) {
          // Non-critical: don't fail the deletion just because quota decrement failed
          console.warn(`⚠️ Could not decrement admin quota for ${creatorId}:`, quotaError.message);
        }
      }
    } catch (error) {
      console.error('❌ QuotaService: Error recording user deletion:', error);
      throw new Error(`Failed to record user deletion: ${error.message}`);
    }
  }

  /**
   * Get quota summary for organization (System Admin view)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Quota summary
   */
  async getOrgQuotaSummary(orgId) {
    console.log(`📊 QuotaService.getOrgQuotaSummary() - Org: ${orgId}`);

    try {
      const org = await this.orgRepo.findById(orgId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Support both nested limits object and root-level fields
      const limits = org.limits || {
        maxBusinessOwners: org.maxBusinessOwners || 5,
        maxAdmins: org.maxAdmins || 20,
        maxEmployees: org.maxEmployees || 1000
      };

      const counts = org.counts || {
        businessOwners: 0,
        admins: 0,
        employees: 0
      };

      const summary = {
        organizationId: orgId,
        organizationName: org.name,
        isActive: org.isActive,
        limits: limits,
        counts: counts,
        utilization: {
          businessOwners: {
            current: counts.businessOwners || 0,
            max: limits.maxBusinessOwners || 5,
            percentage: limits.maxBusinessOwners > 0
              ? Math.round((counts.businessOwners / limits.maxBusinessOwners) * 100)
              : 0,
            remaining: Math.max(0, (limits.maxBusinessOwners || 5) - (counts.businessOwners || 0))
          },
          admins: {
            current: counts.admins || 0,
            max: limits.maxAdmins || 20,
            percentage: limits.maxAdmins > 0
              ? Math.round((counts.admins / limits.maxAdmins) * 100)
              : 0,
            remaining: Math.max(0, (limits.maxAdmins || 20) - (counts.admins || 0))
          },
          employees: {
            current: counts.employees || 0,
            max: limits.maxEmployees || 1000,
            percentage: limits.maxEmployees > 0
              ? Math.round((counts.employees / limits.maxEmployees) * 100)
              : 0,
            remaining: Math.max(0, (limits.maxEmployees || 1000) - (counts.employees || 0))
          }
        }
      };

      console.log(`✅ Quota summary generated:`, summary.utilization);
      return summary;
    } catch (error) {
      console.error('❌ QuotaService: Error getting quota summary:', error);
      throw new Error(`Failed to get quota summary: ${error.message}`);
    }
  }

  /**
   * Get admin quota status (Business Owner view)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} List of admins with quota info
   */
  async getAdminQuotaStatus(orgId) {
    console.log(`📊 QuotaService.getAdminQuotaStatus() - Org: ${orgId}`);

    try {
      // Get all admins in organization
      const admins = await this.userRepo.findByRole(orgId, 'admin');

      // Add quota information to each admin
      const adminsWithQuota = admins.map(admin => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        quota: {
          created: admin.adminSettings?.employeesCreated || 0,
          limit: admin.adminSettings?.canCreateUpTo || 50,
          remaining: Math.max(0, (admin.adminSettings?.canCreateUpTo || 50) - (admin.adminSettings?.employeesCreated || 0)),
          percentage: admin.adminSettings?.canCreateUpTo > 0
            ? Math.round(((admin.adminSettings?.employeesCreated || 0) / admin.adminSettings.canCreateUpTo) * 100)
            : 0
        }
      }));

      console.log(`✅ Retrieved quota status for ${adminsWithQuota.length} admins`);
      return adminsWithQuota;
    } catch (error) {
      console.error('❌ QuotaService: Error getting admin quota status:', error);
      throw new Error(`Failed to get admin quota status: ${error.message}`);
    }
  }

  /**
   * Update organization limits (System Admin only)
   * @param {string} orgId - Organization ID
   * @param {Object} newLimits - { maxBusinessOwners, maxAdmins, maxEmployees }
   * @returns {Promise<Object>} Updated organization
   */
  async updateOrgLimits(orgId, newLimits) {
    console.log(`📝 QuotaService.updateOrgLimits() - Org: ${orgId}`, newLimits);

    try {
      // Validate limits are positive numbers
      const validatedLimits = {};

      if (newLimits.maxBusinessOwners !== undefined) {
        validatedLimits.maxBusinessOwners = Math.max(1, parseInt(newLimits.maxBusinessOwners));
      }
      if (newLimits.maxAdmins !== undefined) {
        validatedLimits.maxAdmins = Math.max(1, parseInt(newLimits.maxAdmins));
      }
      if (newLimits.maxEmployees !== undefined) {
        validatedLimits.maxEmployees = Math.max(1, parseInt(newLimits.maxEmployees));
      }

      // Update limits
      const updated = await this.orgRepo.updateLimits(orgId, validatedLimits);

      console.log(`✅ Organization limits updated successfully`);
      return updated;
    } catch (error) {
      console.error('❌ QuotaService: Error updating org limits:', error);
      throw new Error(`Failed to update organization limits: ${error.message}`);
    }
  }

  /**
   * Update admin employee quota (Business Owner only)
   * @param {string} orgId - Organization ID
   * @param {string} adminId - Admin user ID
   * @param {number} newLimit - New employee creation limit
   * @returns {Promise<Object>} Updated admin
   */
  async updateAdminQuota(orgId, adminId, newLimit) {
    console.log(`📝 QuotaService.updateAdminQuota() - Admin: ${adminId}, Limit: ${newLimit}`);

    try {
      // Validate limit is positive
      const validatedLimit = Math.max(1, parseInt(newLimit));

      // Update admin limit
      const updated = await this.userRepo.updateAdminLimit(orgId, adminId, validatedLimit);

      console.log(`✅ Admin quota updated successfully`);
      return updated;
    } catch (error) {
      console.error('❌ QuotaService: Error updating admin quota:', error);
      throw new Error(`Failed to update admin quota: ${error.message}`);
    }
  }

  /**
   * Bulk update admin quotas (Business Owner sets employeesPerAdmin)
   * @param {string} orgId - Organization ID
   * @param {number} employeesPerAdmin - Default quota for all admins
   * @returns {Promise<Object>} Update result
   */
  async updateAllAdminQuotas(orgId, employeesPerAdmin) {
    console.log(`📝 QuotaService.updateAllAdminQuotas() - Setting all to: ${employeesPerAdmin}`);

    try {
      const validatedLimit = Math.max(1, parseInt(employeesPerAdmin));

      // Get all admins
      const admins = await this.userRepo.findByRole(orgId, 'admin');

      // Update each admin
      const updatePromises = admins.map(admin =>
        this.userRepo.updateAdminLimit(orgId, admin.id, validatedLimit)
      );

      await Promise.all(updatePromises);

      // Update organization settings
      await this.orgRepo.updateSettings(orgId, {
        employeesPerAdmin: validatedLimit
      });

      console.log(`✅ Updated quota for ${admins.length} admins`);
      return {
        success: true,
        updatedCount: admins.length,
        newLimit: validatedLimit
      };
    } catch (error) {
      console.error('❌ QuotaService: Error updating all admin quotas:', error);
      throw new Error(`Failed to update all admin quotas: ${error.message}`);
    }
  }

  /**
   * Get my quota info (for current user)
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} userRole - User role
   * @returns {Promise<Object>} User's quota info
   */
  async getMyQuotaInfo(orgId, userId, userRole) {
    console.log(`📊 QuotaService.getMyQuotaInfo() - User: ${userId}, Role: ${userRole}`);

    try {
      if (userRole === 'admin') {
        // Get admin's quota
        const admin = await this.userRepo.findById(orgId, userId);
        if (!admin) {
          throw new Error('Admin not found');
        }

        return {
          role: 'admin',
          quota: {
            created: admin.adminSettings?.employeesCreated || 0,
            limit: admin.adminSettings?.canCreateUpTo || 50,
            remaining: Math.max(0, (admin.adminSettings?.canCreateUpTo || 50) - (admin.adminSettings?.employeesCreated || 0)),
            percentage: admin.adminSettings?.canCreateUpTo > 0
              ? Math.round(((admin.adminSettings?.employeesCreated || 0) / admin.adminSettings.canCreateUpTo) * 100)
              : 0
          }
        };
      } else if (userRole === 'business_owner') {
        // Get organization limits
        const summary = await this.getOrgQuotaSummary(orgId);
        return {
          role: 'business_owner',
          organization: summary
        };
      } else {
        return {
          role: userRole,
          message: 'No quota limits for this role'
        };
      }
    } catch (error) {
      console.error('❌ QuotaService: Error getting user quota info:', error);
      throw new Error(`Failed to get quota info: ${error.message}`);
    }
  }
}

module.exports = QuotaService;
