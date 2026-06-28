const admin = require('./firebase-admin');
const container = require('./container');
const jwt = require('jsonwebtoken');

/**
 * Extract organizationId from decoded token
 * Handles both ID tokens and custom tokens
 */
function extractOrganizationId(decoded) {
  // Try direct property first (ID token)
  if (decoded.organizationId) {
    return decoded.organizationId;
  }

  // Try claims object (custom token)
  if (decoded.claims?.organizationId) {
    return decoded.claims.organizationId;
  }

  // Return null to trigger fallback search
  return null;
}

/**
 * Authenticate token from Authorization header
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Middleware: No token provided or invalid format');
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // Get services AFTER database is connected
    const employeeService = container.getEmployeeService();
    const orgRepo = container.getOrganizationRepo();
    const userRepo = container.getUserRepo();

    const token = authHeader.split('Bearer ')[1];
    const firebaseAdmin = admin();

    // Decode token to get uid
    const decoded = jwt.decode(token);

    // Firebase ID tokens use 'sub' or 'user_id', not 'uid' for the user ID!
    const uid = decoded?.uid || decoded?.sub || decoded?.user_id;

    if (!decoded || !uid) {
      console.log('❌ No uid found in token. Available fields:', decoded ? Object.keys(decoded) : 'none');
      return res.status(401).json({ error: 'Unauthorized: Invalid token structure' });
    }

    let organizationId = extractOrganizationId(decoded);
    let employee = null;

    // Try to verify as Firebase ID token first
    try {
      const verifiedToken = await firebaseAdmin.auth().verifyIdToken(token);
      organizationId = extractOrganizationId(verifiedToken) || organizationId;
    } catch (idTokenError) {
      // Not a valid ID token, continue with decoded data
      console.log('⚠️ Token is not a valid ID token, using decoded data');
    }

    // If we have an organizationId, try to find the employee directly
    if (organizationId) {
      try {
        employee = await employeeService.getEmployeeById(organizationId, uid);
      } catch (e) {
        console.log(`⚠️ Middleware: Lookup failed in org ${organizationId}:`, e.message);
      }
    }

    // Check for system user (system_admin) in root users collection
    if (!employee) {
      try {
        const firestore = require('firebase-admin').firestore();
        const userDoc = await firestore.collection('users').doc(uid).get();
        if (userDoc.exists) {
          employee = { id: userDoc.id, ...userDoc.data() };
          console.log(`✅ Middleware: Found system user: ${employee.email}`);
        }
      } catch (e) {
        console.log('⚠️ Middleware: System user lookup failed:', e.message);
      }
    }

    // Fallback: Search across all organizations
    if (!employee) {
      console.log(`🔍 Middleware: Searching for user ${uid} across all organizations...`);
      try {
        const allOrgs = await orgRepo.findAllActive();
        for (const org of allOrgs) {
          const foundUser = await userRepo.findById(org.id, uid);
          if (foundUser) {
            employee = foundUser;
            organizationId = org.id;
            console.log(`✅ Middleware: Found user in org: ${org.name} (${org.id})`);
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Middleware: Cross-org search failed:', e.message);
      }
    }

    if (!employee) {
      console.log(`❌ Middleware: Employee not found for uid: ${uid}`);
      return res.status(404).json({ error: 'Employee record not found' });
    }

    if (employee.isActive === false) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Remove password from employee object
    const { passwordHash, ...safeEmployee } = employee;

    req.user = {
      uid: employee.id,
      email: employee.email,
      role: employee.role,
      name: employee.name,
      department: employee.department,
      departmentId: employee.departmentId || null,
      organizationId: organizationId || employee.organizationId,
      isTeamLead: employee.isTeamLead || false,
      isManager: employee.isManager || false,
      isDeptHead: employee.isDeptHead || false,
      managerId: employee.managerId || null,
      managerName: employee.managerName || null,
      directReports: employee.directReports || []
    };

    return next();

  } catch (error) {
    console.error('❌ Middleware: Authentication failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

/**
 * Require ADMIN role only
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: Admin access only',
      requiredRole: 'admin',
      yourRole: req.user?.role || 'none'
    });
  }
  next();
}

/**
 * Require BUSINESS OWNER role only
 */
function requireBusinessOwner(req, res, next) {
  if (!req.user || req.user.role !== 'business_owner') {
    return res.status(403).json({
      error: 'Forbidden: Business Owner access only',
      requiredRole: 'business_owner',
      yourRole: req.user?.role || 'none'
    });
  }
  next();
}

/**
 * Require ADMIN or BUSINESS OWNER (for read-only operations)
 */
function requireAdminOrBusinessOwner(req, res, next) {
  if (!req.user || !['admin', 'business_owner'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden: Admin or Business Owner access required',
      requiredRoles: ['admin', 'business_owner'],
      yourRole: req.user?.role || 'none'
    });
  }
  next();
}

/**
 * Require SYSTEM ADMIN role only
 */
function requireSystemAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'system_admin') {
    return res.status(403).json({
      error: 'Forbidden: System Admin access only',
      requiredRole: 'system_admin',
      yourRole: req.user?.role || 'none'
    });
  }
  next();
}



/**
 * Require EMPLOYEE role (any authenticated user)
 */
function requireEmployee(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  next();
}

/**
 * Require user to belong to specific organization
 */
function requireOrganization(organizationId) {
  return (req, res, next) => {
    if (!req.user || req.user.organizationId !== organizationId) {
      return res.status(403).json({
        error: 'Forbidden: Organization access denied',
        requiredOrg: organizationId,
        yourOrg: req.user?.organizationId || 'none'
      });
    }
    next();
  };
}

/**
 * Require TEAM LEAD access (Manager or HOD)
 * (Also allows Admin and Business Owner)
 */
function requireTeamLead(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const isAuthorized = req.user.isTeamLead || req.user.isDeptHead || req.user.isManager ||
    ['admin', 'business_owner'].includes(req.user.role);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden: Team Lead / Manager access required',
      yourRole: req.user.role
    });
  }
  next();
}

/**
 * Require Manager or HOD
 */
function requireManagerOrHOD(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const isAuthorized = req.user.isDeptHead || req.user.isManager ||
    ['admin', 'business_owner'].includes(req.user.role);
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden: Manager or Tech Lead access required' });
  }
  next();
}

/**
 * Require Department Head only
 */
function requireDeptHead(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.user.isDeptHead && !['admin', 'business_owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Department Head access required' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireBusinessOwner,
  requireAdminOrBusinessOwner,
  requireSystemAdmin,
  requireTeamLead,
  requireManagerOrHOD,
  requireDeptHead,
  requireEmployee,
  requireOrganization
};
