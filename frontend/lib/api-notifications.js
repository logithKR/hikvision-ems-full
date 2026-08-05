import api from './api';

export const notificationApi = {
  /**
   * Fetch user's recent notifications
   */
  getNotifications: async () => {
    return await api.get('/notifications');
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (id) => {
    return await api.put(`/notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    return await api.put('/notifications/read-all');
  }
};
