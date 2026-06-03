/**
 * lib/auth.js
 * Centralized authentication helper functions
 */

import { auth, signInWithCustomToken } from './firebaseClient';

// ✅ Consistent API URL (base server URL, /api appended by getApiBase)
// OLD LINE COMMENTED OUT:
// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// NEW LINE ADDED:
const API_URL = import.meta.env.VITE_API_URL || '';
const getApiBase = () => API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

/**
 * Login helper - calls backend and handles auth
 * @param {string} email
 * @param {string} password
 * @param {string} organizationId - Optional organization ID (NOT a role string)
 * @param {string} expectedRole - Optional role to validate after login (e.g. 'admin', 'business_owner')
 * @returns {Promise} { success: boolean, user: Object, error: string }
 */
export async function loginUser(email, password, organizationId = null, expectedRole = null) {
 try {
 console.log('🔐 Auth: Starting login for', email);

 const body = { email, password };
 if (organizationId) {
 body.organizationId = organizationId;
 }

 const response = await fetch(`${getApiBase()}/auth/login`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });

 console.log('📊 Auth: Response status:', response.status);

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 const errorMessage = errorData?.error || errorData?.message || `Login failed (${response.status})`;
 console.error('❌ Auth: Login failed:', errorMessage);
 return { success: false, error: errorMessage };
 }

 const data = await response.json();
 console.log('✅ Auth: Login successful, role:', data.user?.role);

 // Validate role if expected (system_admin can bypass)
 if (expectedRole && data.user?.role !== expectedRole && data.user?.role !== 'system_admin') {
 console.error(`❌ Auth: Role mismatch. Expected: ${expectedRole}, Got: ${data.user?.role}`);
 return {
 success: false,
 error: `Access denied. You are logged in as ${data.user?.role}, but this portal is for ${expectedRole}s.`
 };
 }

 // Sign in with Firebase using custom token
 let idToken = data.firebaseToken || data.token;
 if (auth && idToken) {
 try {
 const userCredential = await signInWithCustomToken(auth, idToken);
 idToken = await userCredential.user.getIdToken();
 console.log('🔥 Auth: Firebase authentication successful');
 } catch (firebaseError) {
 console.warn('⚠️ Auth: Firebase auth failed, using custom token:', firebaseError.message);
 }
 }

 // Store authentication data
 const authData = {
 isLoggedIn: true,
 token: idToken,
 user: data.user
 };
 storeAuthData(authData);
 console.log('💾 Auth: Stored auth data in sessionStorage');

 return {
 success: true,
 user: data.user,
 organizationId: data.user.organizationId
 };
 } catch (error) {
 console.error('❌ Auth: Network error:', error);
 return {
 success: false,
 error: 'Network error. Please check if the backend is running.'
 };
 }
}

/**
 * Login with Google
 * @param {string} organizationId - Optional organization ID
 */
export async function loginWithGoogle(organizationId = null) {
 try {
 console.log('🔵 Starting Google Login...');
 const { auth, signInWithPopup, GoogleAuthProvider } = await import('./firebaseClient');

 if (!auth) throw new Error("Firebase auth not initialized");

 const provider = new GoogleAuthProvider();
 const result = await signInWithPopup(auth, provider);
 const user = result.user;
 const idToken = await user.getIdToken();

 console.log('✅ Google Login successful. Token obtained.');
 console.log('📤 Sending token to backend for verification...');

 const response = await fetch(`${getApiBase()}/auth/google`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ idToken, organizationId }),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 throw new Error(errorData.error || errorData.message || 'Backend verification failed');
 }

 const data = await response.json();
 console.log('✅ Backend verification successful. Role:', data.user.role);

 // Store auth data
 storeAuthData({
 isLoggedIn: true,
 token: idToken,
 user: data.user
 });

 return { success: true, user: data.user };

 } catch (error) {
 console.error('❌ Google Login Error:', error);
 throw error;
 }
}

/**
 * Register organization (for business owner)
 */
export async function registerOrganization(data) {
 try {
 console.log('📝 Auth: Registering organization:', data.organizationName);

 const response = await fetch(`${getApiBase()}/auth/register/organization`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 const errorMessage = errorData?.error || 'Registration failed';
 console.error('❌ Auth: Registration failed:', errorMessage);
 return { success: false, error: errorMessage };
 }

 const result = await response.json();
 console.log('✅ Auth: Registration successful');

 // Sign in with the new account
 if (result.firebaseToken) {
 try {
 await signInWithCustomToken(auth, result.firebaseToken);
 } catch (e) {
 console.warn('⚠️ Auto sign-in failed:', e.message);
 }
 }

 return { success: true, data: result };
 } catch (error) {
 console.error('❌ Auth: Registration error:', error);
 return { success: false, error: error.message };
 }
}

/**
 * Store authentication data in sessionStorage
 */
export function storeAuthData({ isLoggedIn, token, user }) {
 try {
 sessionStorage.setItem('isLoggedIn', String(isLoggedIn));
 sessionStorage.setItem('firebaseToken', token);
 sessionStorage.setItem('currentUser', JSON.stringify(user));

 // Role-specific flags (for backward compatibility)
 if (user.role === 'admin') {
 sessionStorage.setItem('adminLoggedIn', 'true');
 } else if (user.role === 'employee') {
 sessionStorage.setItem('employeeLoggedIn', 'true');
 } else if (user.role === 'business_owner') {
 sessionStorage.setItem('businessOwnerLoggedIn', 'true');
 } else if (user.role === 'system_admin') {
 sessionStorage.setItem('systemAdminLoggedIn', 'true');
 }
 } catch (error) {
 console.error('❌ Failed to store auth data:', error);
 }
}

/**
 * Get current user from sessionStorage
 */
export function getCurrentUser() {
 try {
 const userStr = sessionStorage.getItem('currentUser');
 return userStr ? JSON.parse(userStr) : null;
 } catch {
 return null;
 }
}

/**
 * Get auth token
 */
export function getAuthToken() {
 try {
 return sessionStorage.getItem('firebaseToken') || '';
 } catch {
 return '';
 }
}

/**
 * Check if user is logged in
 */
export function isAuthenticated() {
 try {
 return sessionStorage.getItem('isLoggedIn') === 'true';
 } catch {
 return false;
 }
}

/**
 * Logout user
 */
export function logoutUser() {
 try {
 // Clear all auth data
 sessionStorage.removeItem('isLoggedIn');
 sessionStorage.removeItem('firebaseToken');
 sessionStorage.removeItem('currentUser');
 sessionStorage.removeItem('adminLoggedIn');
 sessionStorage.removeItem('employeeLoggedIn');
 sessionStorage.removeItem('businessOwnerLoggedIn');
 sessionStorage.removeItem('systemAdminLoggedIn');

 // Sign out from Firebase
 if (auth && auth.currentUser) {
 auth.signOut();
 }

 console.log('👋 User logged out');
 } catch (error) {
 console.error('❌ Logout error:', error);
 }
}

/**
 * Clear all React Query caches (call on logout to prevent data leaks)
 * @param {QueryClient} queryClient - React Query client instance
 */
export function clearAllCaches(queryClient) {
 if (queryClient) {
 queryClient.clear();
 console.log('🧹 All React Query caches cleared');
 }
}

/**
 * Get role-specific redirect path
 */
export function getRoleRedirectPath(role) {
 const paths = {
 'admin': '/admin/dashboard',
 'business_owner': '/business-owner/dashboard',
 'employee': '/employee/dashboard',
 'system_admin': '/system-admin/dashboard'
 };
 return paths[role] || '/login';
}