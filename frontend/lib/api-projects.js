/**
 * lib/api-projects.js
 * Frontend API calls for Project Management
 */

import api from './api';

export const projectApi = {
  // Employee routes
  getMyProjects: async () => {
    const res = await api.get('/projects');
    return res.data;
  },

  createProject: async (data) => {
    const res = await api.post('/projects', data);
    return res.data;
  },

  respondToInvite: async (projectId, userId, accept) => {
    const res = await api.put(`/projects/${projectId}/invites/respond`, { accept });
    return res.data;
  },

  // Project Lead routes
  updateProject: async (projectId, data) => {
    const res = await api.put(`/projects/${projectId}`, data);
    return res.data;
  },

  inviteMember: async (projectId, targetUserId, role = 'member') => {
    const res = await api.post(`/projects/${projectId}/invites`, { targetUserId, role });
    return res;
  },

  removeMember: async (projectId, userId) => {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    return res;
  },

  deleteProject: async (projectId) => {
    const res = await api.delete(`/projects/${projectId}`);
    return res;
  },

  getOrgEmployees: async () => {
    const res = await api.get('/projects/employees');
    return res.data || [];  // res is { data: [...] }, so res.data is the array
  },

  // Admin / Tech Lead routes
  getAllProjects: async () => {
    const res = await api.get('/projects/all');
    return res.data;
  },

  getDepartmentProjects: async (deptId) => {
    const res = await api.get(`/projects/department/${deptId}`);
    return res.data;
  },

  // ==========================================
  // TASKS
  // ==========================================
  addTask: async (projectId, taskData) => {
    return await api.post(`/projects/${projectId}/tasks`, taskData);
  },
  updateTask: async (projectId, taskId, updates) => {
    return await api.put(`/projects/${projectId}/tasks/${taskId}`, updates);
  },
  deleteTask: async (projectId, taskId) => {
    return await api.delete(`/projects/${projectId}/tasks/${taskId}`);
  },

  // ==========================================
  // ATTENDANCE
  // ==========================================
  getProjectAttendance: async (projectId) => {
    return await api.get(`/projects/${projectId}/attendance`);
  }
};
