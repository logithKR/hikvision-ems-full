/**
 * auth.js (UPDATED)
 * 
 * Routes for authentication (login, register, etc.).
 * Uses EmployeeService and OrganizationRepository from container.
 */

const express = require('express');
const router = express.Router();
const container = require('../container');
const admin = require('../firebase-admin');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware');

// Get service instances from container
const employeeService = container.getEmployeeService();
const orgRepo = container.getOrganizationRepo();
const userRepo = container.getUserRepo();

/**
 * GET /api/auth/workspaces
 * Fetches all organizations a user belongs to by their email address.
 * Uses a Collection Group query for performance.
 */
router.get('/workspaces', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Missing email', message: 'Email query parameter is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = require('firebase-admin').firestore();
    
    console.log(`🔍 Searching for workspaces for email: ${normalizedEmail}`);
    
    const workspaces = [];

    // 1. Check Root Users (System Administration)
    const systemUserQuery = await db.collection('users')
      .where('email', '==', normalizedEmail)
      .where('isSystemUser', '==', true)
      .limit(1)
      .get();
      
    if (!systemUserQuery.empty) {
      const doc = systemUserQuery.docs[0];
      const data = doc.data();
      if (data.isActive) {
        workspaces.push({
          id: 'system',
          name: 'System Administration',
          role: 'system_admin'
        });
      }
    }

    // 2. Search across all active organizations
    const allOrgs = await orgRepo.findAllActive();
    for (const org of allOrgs) {
      // Find user in this org
      const foundUser = await userRepo.findByEmail(org.id, normalizedEmail);
      if (foundUser && foundUser.isActive) {
        workspaces.push({
          id: org.id,
          name: org.name,
          role: foundUser.role || 'employee'
        });
      }
    }

    console.log(`✅ Found ${workspaces.length} workspaces for ${normalizedEmail}`);
    res.json({ workspaces });

  } catch (error) {
    console.error('❌ Error fetching workspaces:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to fetch workspaces' });
  }
});

/**
 * POST /api/auth/login
 * Universal login endpoint for all roles
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, organizationId } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    let userOrgId = null;

    const db = require('firebase-admin').firestore();

    // 1. If organizationId is explicitly provided, look for them in that organization
    if (organizationId) {
      console.log('🏢 Organization ID provided. Checking organization user...');
      const orgUser = await userRepo.findByEmail(organizationId, normalizedEmail);
      if (orgUser) {
        user = orgUser;
        userOrgId = organizationId;
        console.log('✅ Found user in target organization:', user.name, '(', user.role, ')');
      } else {
        return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect' });
      }
    } 
    // 2. If NO organizationId is provided, they MUST be a System Admin
    else {
      console.log('🔍 No Organization ID provided. Checking for system user...');
      const systemUserQuery = await db.collection('users')
        .where('email', '==', normalizedEmail)
        .where('isSystemUser', '==', true)
        .limit(1)
        .get();

      if (!systemUserQuery.empty) {
        const doc = systemUserQuery.docs[0];
        user = { id: doc.id, ...doc.data() };
        userOrgId = null;
        console.log('✅ Found system user:', user.name, '(', user.role, ')');
      } else {
        return res.status(400).json({ error: 'Organization Required', message: 'Please select a workspace to log into.' });
      }
    }

    // User not found
    if (!user) {
      console.log('❌ User not found:', normalizedEmail);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('⚠️ User account is inactive:', normalizedEmail);
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact your administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', normalizedEmail);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Get Firebase Admin instance
    const firebaseAdmin = admin();

    // Create custom token with organizationId in claims
    const customToken = await firebaseAdmin.auth().createCustomToken(user.id, {
      organizationId: userOrgId,
      role: user.role,
      email: user.email
    });

    console.log('✅ Login successful for:', user.name, '(' + user.role + ')');

    // Return user data (without password) and token
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        ...userWithoutPassword,
        organizationId: userOrgId
      },
      token: customToken
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login. Please try again.'
    });
  }
});

/**
 * POST /api/auth/google
 * Universal Google Login endpoint
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken, organizationId } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing ID token' });
    }

    console.log('🔐 Google Login: Verifying token...');

    // Verify token with Firebase Admin
    const firebaseAdmin = admin();
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    const { email, name, picture, uid } = decodedToken;

    console.log(`✅ Token verified for: ${email}`);

    // Check if user exists in Firestore
    let user = null;
    let userOrgId = null;
    const db = require('firebase-admin').firestore();

    // 1. If organizationId is provided, look strictly in that organization
    if (organizationId) {
      console.log('🏢 Organization ID provided for Google Auth. Checking organization user...');
      if (organizationId === 'system') {
        const systemUserQuery = await db.collection('users')
          .where('email', '==', email)
          .where('isSystemUser', '==', true)
          .limit(1)
          .get();

        if (!systemUserQuery.empty) {
          const doc = systemUserQuery.docs[0];
          user = { id: doc.id, ...doc.data() };
          userOrgId = null;
          console.log('✅ Found system user:', user.name);
        }
      } else {
        const orgUser = await userRepo.findByEmail(organizationId, email);
        if (orgUser) {
          user = orgUser;
          userOrgId = organizationId;
          console.log('✅ Found user in target organization:', user.name);
        }
      }
    } 
    // 2. If NO organizationId is provided, do fallback search
    else {
      console.log('🔍 No Organization ID provided for Google Auth. Checking for system user...');
      const systemUserQuery = await db.collection('users')
        .where('email', '==', email)
        .where('isSystemUser', '==', true)
        .limit(1)
        .get();

      if (!systemUserQuery.empty) {
        const doc = systemUserQuery.docs[0];
        user = { id: doc.id, ...doc.data() };
        userOrgId = null;
        console.log('✅ Found system user:', user.name);
      }

      if (!user) {
        console.log('🔍 Searching across all organizations...');
        const allOrgs = await orgRepo.findAllActive();

        for (const org of allOrgs) {
          const foundUser = await userRepo.findByEmail(org.id, email);
          if (foundUser) {
            user = foundUser;
            userOrgId = org.id;
            console.log('✅ User found in organization:', org.name);
            break;
          }
        }
      }
    }

    if (!user) {
      console.log('❌ User not found for Google Login:', email);
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email. Please contact your administrator.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated.'
      });
    }

    // Create Custom Token with claims
    const customToken = await firebaseAdmin.auth().createCustomToken(user.id, {
      organizationId: userOrgId,
      role: user.role,
      email: user.email
    });

    // Return user data
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Google Login successful',
      user: {
        ...userWithoutPassword,
        organizationId: userOrgId
      },
      token: customToken
    });

  } catch (error) {
    console.error('❌ Google Login error:', error);
    res.status(500).json({
      error: 'Google Login failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/register/organization
 * Register new organization with business owner
 */
router.post('/register/organization', async (req, res) => {
  try {
    const {
      organizationName,
      ownerName,
      ownerEmail,
      ownerPassword,
      phone
    } = req.body;

    console.log('📝 Organization registration attempt:', organizationName);

    // Validate required fields
    if (!organizationName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Organization name, owner name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Validate password length
    if (ownerPassword.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if organization with this email already exists
    const existingOrg = await orgRepo.findByOwnerEmail(ownerEmail);
    if (existingOrg) {
      return res.status(409).json({
        error: 'Organization already exists',
        message: 'An organization with this email already exists'
      });
    }

    // Check if organization name already exists
    const existingOrgName = await orgRepo.findByName(organizationName);
    if (existingOrgName) {
      return res.status(409).json({
        error: 'Organization name taken',
        message: 'An organization with this name already exists. Please choose a different name.'
      });
    }

    // Create organization (active by default)
    const organization = await orgRepo.create({
      name: organizationName,
      ownerEmail: ownerEmail.toLowerCase(),
      ownerName,
      phone: phone || '',
      maxBusinessOwners: 5,
      maxAdmins: 20,
      maxEmployees: 1000,
      employeesPerAdmin: 50
    });

    console.log('✅ Organization created:', organization.id);

    // Hash password
    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    // Create business owner user
    const businessOwner = await userRepo.create(organization.id, {
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      passwordHash,
      role: 'business_owner',
      department: 'Management',
      position: 'Business Owner',
      createdBy: null // Self-registered
    });

    console.log('✅ Business owner created:', businessOwner.id);

    // Increment business owner count
    await orgRepo.incrementUserCount(organization.id, 'business_owner');

    // Get Firebase Admin instance
    const firebaseAdmin = admin();

    // Create custom token
    const customToken = await firebaseAdmin.auth().createCustomToken(businessOwner.id, {
      organizationId: organization.id,
      role: 'business_owner',
      email: businessOwner.email
    });

    // Return response (without password)
    const { passwordHash: _, ...businessOwnerWithoutPassword } = businessOwner;

    res.status(201).json({
      success: true,
      message: 'Organization registered successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        isActive: organization.isActive
      },
      user: {
        ...businessOwnerWithoutPassword,
        organizationId: organization.id
      },
      token: customToken
    });

  } catch (error) {
    console.error('❌ Organization registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message || 'An error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.uid;
    const userOrgId = req.user.organizationId;

    // Validate passwords
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Old password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'New password must be at least 6 characters'
      });
    }

    if (!userOrgId && req.user.role !== 'system_admin') {
      return res.status(400).json({
        error: 'Organization not found',
        message: 'User is not associated with an organization.'
      });
    }

    // Change password using EmployeeService
    await employeeService.changePassword(userOrgId, userId, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Change password error:', error);

    if (error.message.includes('incorrect')) {
      return res.status(401).json({
        error: 'Invalid password',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile details
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, department, position, address } = req.body;
    const userId = req.user.uid;
    const userOrgId = req.user.organizationId;
    const userRole = req.user.role;

    // Allow if orgId exists OR if it's a system_admin (system user)
    if (!userOrgId && userRole !== 'system_admin') {
      return res.status(400).json({
        error: 'Organization not found'
      });
    }

    // Prepare update data - only include fields that are defined
    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (department) updateData.department = department;
    if (position) updateData.position = position;

    console.log('📝 Updating profile for user:', userId, updateData);

    let updatedUser;

    // Direct update for system users (system_admin)
    if (!userOrgId || userRole === 'system_admin') {
      const firestore = require('firebase-admin').firestore();
      await firestore.collection('users').doc(userId).update(updateData);

      const userDoc = await firestore.collection('users').doc(userId).get();
      updatedUser = { id: userDoc.id, ...userDoc.data() };
      console.log('✅ System user profile updated');
    } else {
      updatedUser = await userRepo.update(userOrgId, userId, updateData);
    }

    // Remove password
    const { passwordHash, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: userWithoutPassword
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (Alias for /me)
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userOrgId = req.user.organizationId;

    if (!userOrgId) {
      return res.status(400).json({
        error: 'Organization not found'
      });
    }

    // Get user
    const user = await userRepo.findById(userOrgId, userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // NEW: Fetch manager email if managerId exists
    if (user.managerId) {
      try {
        const manager = await userRepo.findById(userOrgId, user.managerId);
        if (manager) {
          user.managerEmail = manager.email;
        }
      } catch (e) {
        console.error('Error fetching manager for email:', e.message);
      }
    }

    // Remove password
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: {
        ...userWithoutPassword,
        organizationId: userOrgId
      }
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user (supports system users like system_admins
 * )
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const firebaseAdmin = admin();

    let userId, userOrgId, userRole;

    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      userId = decodedToken.uid;
      userOrgId = decodedToken.organizationId;
      userRole = decodedToken.role;
    } catch (error) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Invalid token');
      }
      userId = decoded.uid || decoded.user_id || decoded.sub;
      userOrgId = decoded.organizationId || (decoded.claims && decoded.claims.organizationId);
      userRole = decoded.role || (decoded.claims && decoded.claims.role);
    }

    console.log('🔍 [/me] User ID:', userId, 'Org ID:', userOrgId, 'Role:', userRole);

    let user = null;

    // Check if this is a system user (system_admin) - no organizationId
    if (!userOrgId || userRole === 'system_admin') {
      // Look up in root users collection
      const firestore = require('firebase-admin').firestore();
      const userDoc = await firestore.collection('users').doc(userId).get();

      if (userDoc.exists) {
        user = { id: userDoc.id, ...userDoc.data() };
        console.log('✅ [/me] Found system user:', user.name);
      }
    } else {
      // Look up in organization's users collection
      user = await userRepo.findById(userOrgId, userId);

      // NEW: Fetch manager email if managerId exists
      if (user && user.managerId) {
        try {
          const manager = await userRepo.findById(userOrgId, user.managerId);
          if (manager) {
            user.managerEmail = manager.email;
          }
        } catch (e) {
          console.error('Error fetching manager for email:', e.message);
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user data'
      });
    }

    // Remove password
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: {
        ...userWithoutPassword,
        organizationId: userOrgId || null
      }
    });

  } catch (error) {
    console.error('❌ Get /me error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: error.message
    });
  }
});

module.exports = router;

