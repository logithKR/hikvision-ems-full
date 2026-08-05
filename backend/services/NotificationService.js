/**
 * NotificationService.js
 * 
 * Service for handling real-time notifications via Socket.io.
 * Abstracts the socket logic from business services.
 */

class NotificationService {
    /**
     * @param {NotificationRepository} notificationRepo 
     * @param {Server} io - Socket.io server instance (optional)
     */
    constructor(notificationRepo = null, io = null) {
        this.notificationRepo = notificationRepo;
        this.io = io;
        this.connectedUsers = new Map(); // Map<userId, socketId>
    }

    /**
     * Set IO instance after initialization
     * @param {Server} io 
     */
    setIo(io) {
        this.io = io;
        this.initialize();
    }

    /**
     * Initialize socket events
     */
    initialize() {
        if (!this.io) {
            console.warn('⚠️ NotificationService: Socket.io instance not provided yet');
            return;
        }

        this.io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);

            // Handle user authentication/identification
            socket.on('authenticate', (data) => {
                const { userId, organizationId } = data;
                if (userId) {
                    this.connectedUsers.set(userId, socket.id);
                    socket.join(`user:${userId}`);
                    socket.join(`org:${organizationId}`);
                    console.log(`👤 User ${userId} authenticated and joined org:${organizationId}`);
                }
            });

            socket.on('disconnect', () => {
                // Remove user from map on disconnect
                for (const [userId, socketId] of this.connectedUsers.entries()) {
                    if (socketId === socket.id) {
                        this.connectedUsers.delete(userId);
                        console.log(`🔌 User ${userId} disconnected`);
                        break;
                    }
                }
            });
        });
    }

    /**
     * Send notification to specific user
     * @param {string} userId
     * @param {string} event - Event name
     * @param {Object} data - Payload
     */
    sendToUser(userId, event, data) {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(event, data);
        console.log(`📨 Sent '${event}' to user ${userId}`);
    }

    /**
     * Send notification to entire organization
     * @param {string} orgId
     * @param {string} event
     * @param {Object} data
     */
    sendToOrg(orgId, event, data) {
        if (!this.io) return;
        this.io.to(`org:${orgId}`).emit(event, data);
        console.log(`📨 Sent '${event}' to org ${orgId}`);
    }

    /**
     * Send notification to all admins in an org
     * @param {string} orgId
     * @param {string} event
     * @param {Object} data
     */
    sendToOrgAdmins(orgId, event, data) {
        if (!this.io) return;
        // In a real app, you might have a separate room for admins
        // For now, we can rely on client-side filtering or just send to org room with a 'role' filter in data
        // Better: Join admins to `org:${orgId}:admins` room upon auth
        this.io.to(`org:${orgId}:admins`).emit(event, data);
        console.log(`📨 Sent '${event}' to org ${orgId} admins`);
    }

    /**
     * Create a persistent notification in DB and emit via socket
     * @param {string} orgId 
     * @param {string} userId 
     * @param {Object} payload - { type, title, message, data }
     */
    async sendPersistentNotification(orgId, userId, payload) {
        if (!this.notificationRepo) {
            console.warn('⚠️ NotificationService: notificationRepo not injected, cannot persist.');
            this.sendToUser(userId, 'notification', payload);
            return;
        }

        try {
            // 1. Save to DB
            const savedNotification = await this.notificationRepo.create(orgId, userId, payload);
            
            // 2. Emit via socket
            this.sendToUser(userId, 'notification', savedNotification);
            
            return savedNotification;
        } catch (error) {
            console.error(`❌ Failed to send persistent notification:`, error);
        }
    }
}

module.exports = NotificationService;
