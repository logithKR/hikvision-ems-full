/**
 * backend/routes/notifications.js
 * 
 * Routes for handling persistent notifications.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const container = require('../container');

// ==========================================
// GET /api/notifications
// Fetch recent notifications for the logged-in user
// ==========================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notificationRepo = container.getNotificationRepo();
        const notifications = await notificationRepo.findByUser(req.user.organizationId, req.user.uid, 50);
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// PUT /api/notifications/:id/read
// Mark a specific notification as read
// ==========================================
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const notificationRepo = container.getNotificationRepo();
        await notificationRepo.markAsRead(req.user.organizationId, req.user.uid, id);
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// PUT /api/notifications/read-all
// Mark all notifications as read
// ==========================================
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const notificationRepo = container.getNotificationRepo();
        await notificationRepo.markAllAsRead(req.user.organizationId, req.user.uid);
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
