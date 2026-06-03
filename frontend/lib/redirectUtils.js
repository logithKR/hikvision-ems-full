/**
 * lib/redirectUtils.js
 * Utility functions for handling redirects safely in the application.
 * Uses React Router's navigate function instead of Next.js router.
 */

/**
 * Safely redirect to a path with error handling
 * @param {Function} navigate - React Router navigate function (from useNavigate)
 * @param {string} path - Path to redirect to
 */
export function safeRedirect(navigate, path) {
 try {
 // Validate path format
 if (!path || typeof path !== 'string') {
 console.error('⚠️ Invalid redirect path:', path);
 return;
 }

 // Ensure path starts with /
 if (!path.startsWith('/')) {
 path = '/' + path;
 }

 // Prevent protocol-relative URLs (//evil.com)
 if (path.startsWith('//')) {
 console.warn('⚠️ Protocol-relative URL blocked:', path);
 navigate('/login');
 return;
 }

 // Prevent javascript: URLs
 if (path.toLowerCase().startsWith('javascript:')) {
 console.warn('⚠️ JavaScript URL blocked:', path);
 navigate('/login');
 return;
 }

 console.log('✅ Redirecting to:', path);
 navigate(path);
 } catch (error) {
 console.error('❌ Error during redirect:', error);
 // Fallback: try to redirect to home page
 try {
 navigate('/');
 } catch (fallbackError) {
 console.error('❌ Fallback redirect also failed:', fallbackError);
 }
 }
}

/**
 * Handle user logout with proper cleanup and redirect
 * @param {Function} navigate - React Router navigate function (from useNavigate)
 * @param {'admin'|'employee'|'business_owner'|'system_admin'} userType - Type of user logging out
 */
export function handleLogout(navigate, userType = null) {
 try {
 // Clear all authentication related localStorage items
 localStorage.removeItem('isLoggedIn');
 localStorage.removeItem('firebaseToken');
 localStorage.removeItem('currentUser');
 localStorage.removeItem('adminLoggedIn');
 localStorage.removeItem('employeeLoggedIn');
 localStorage.removeItem('businessOwnerLoggedIn');
 localStorage.removeItem('systemAdminLoggedIn');

 // Redirect to appropriate login page
 let loginPath = '/login';
 if (userType) {
 const loginPaths = {
 'admin': '/login',
 'employee': '/login',
 'business_owner': '/login',
 'system_admin': '/login'
 };
 loginPath = loginPaths[userType] || '/login';
 }

 safeRedirect(navigate, loginPath);
 } catch (error) {
 console.error('❌ Error during logout:', error);
 // Even if cleanup fails, still try to redirect
 safeRedirect(navigate, '/login');
 }
}

/**
 * Role-based redirect after login
 * @param {Function} navigate - React Router navigate function (from useNavigate)
 * @param {string} role - User role
 */
export function redirectByRole(navigate, role) {
 const roleRoutes = {
 'admin': '/admin/dashboard',
 'business_owner': '/business-owner/dashboard',
 'employee': '/employee/dashboard',
 'system_admin': '/system-admin/dashboard'
 };

 const destination = roleRoutes[role] || '/login';
 console.log(`✅ Redirecting ${role} to ${destination}`);
 safeRedirect(navigate, destination);
}

/**
 * Redirect to login page with return URL
 * @param {Function} navigate - React Router navigate function (from useNavigate)
 * @param {string} role - User role for which login page
 * @param {string} returnUrl - URL to return to after login
 */
export function redirectToLogin(navigate, role = null, returnUrl = null) {
 let loginPath = '/login';

 if (role) {
 const loginRoutes = {
 'admin': '/login',
 'business_owner': '/login',
 'employee': '/login',
 'system_admin': '/login'
 };
 loginPath = loginRoutes[role] || '/login';
 }

 if (returnUrl) {
 loginPath += `?returnUrl=${encodeURIComponent(returnUrl)}`;
 }

 console.log('🔒 Redirecting to login:', loginPath);
 safeRedirect(navigate, loginPath);
}
