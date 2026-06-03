/**
 * lib/api.js
 * Centralized API client for backend communication
 */

import { getValidIdToken } from './firebaseClient';

// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const getApiBase = () => API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/admin/employees')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
export async function apiRequest(endpoint, options = {}) {
 try {
 // Get token
 const token = await getValidIdToken();

 // Build headers
 const headers = {
 'Content-Type': 'application/json',
 ...options.headers,
 };

 // Add authorization header if token exists
 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // Build full URL
 const url = `${getApiBase()}${endpoint}`;
 console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

 // Make request
 const response = await fetch(url, {
 ...options,
 headers,
 });

 // Parse response
 const data = await response.json();

 // Handle errors
 if (!response.ok) {
 const errorMessage = data.error || data.message || `HTTP ${response.status}`;
 console.error('❌ API Error:', errorMessage);
 throw new Error(errorMessage);
 }

 console.log('✅ API Success');
 return data;

 } catch (error) {
 console.error('❌ API Request Failed:', error);
 throw error;
 }
}

/**
 * Get current user from backend
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} User data
 */
export async function getCurrentUser(token) {
 const url = `${getApiBase()}/auth/me`;
 console.log('🔐 Fetching current user from:', url);

 const response = await fetch(url, {
 method: 'GET',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 }
 });

 const data = await response.json();

 if (!response.ok) {
 throw new Error(data.error || data.message || 'Failed to get user');
 }

 return data;
}

// Export convenience methods
export default {
 get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
 post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
 put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
 delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};
