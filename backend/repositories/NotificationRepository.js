/**
 * NotificationRepository.js
 * 
 * Repository for managing persistent notifications.
 * Path: organizations/{orgId}/users/{userId}/notifications/{notificationId}
 */

const BaseRepository = require('./BaseRepository');

class NotificationRepository extends BaseRepository {
    constructor(db) {
        super(db, 'notifications');
    }

    /**
     * Get collection for a specific user
     */
    getCollection(orgId, userId) {
        return this.db.collection('organizations').doc(orgId).collection('users').doc(userId).collection('notifications');
    }

    /**
     * Create a new notification
     */
    async create(orgId, userId, data) {
        try {
            const docRef = this.getCollection(orgId, userId).doc();
            const timestamp = new Date().toISOString();
            
            const notificationData = {
                id: docRef.id,
                ...data,
                read: false,
                createdAt: timestamp
            };
            
            await docRef.set(notificationData);
            return notificationData;
        } catch (error) {
            console.error(`❌ [NotificationRepo] Create error:`, error);
            throw new Error(`Failed to create notification: ${error.message}`);
        }
    }

    /**
     * Get user's recent notifications
     */
    async findByUser(orgId, userId, limit = 50) {
        try {
            const snapshot = await this.getCollection(orgId, userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
                
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`❌ [NotificationRepo] FindByUser error:`, error);
            throw new Error(`Failed to fetch notifications: ${error.message}`);
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(orgId, userId, notificationId) {
        try {
            await this.getCollection(orgId, userId).doc(notificationId).update({
                read: true,
                readAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`❌ [NotificationRepo] MarkAsRead error:`, error);
            throw new Error(`Failed to mark notification as read: ${error.message}`);
        }
    }
    
    /**
     * Mark all as read
     */
    async markAllAsRead(orgId, userId) {
        try {
            const snapshot = await this.getCollection(orgId, userId).where('read', '==', false).get();
            if (snapshot.empty) return true;
            
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true, readAt: new Date().toISOString() });
            });
            
            await batch.commit();
            return true;
        } catch (error) {
            console.error(`❌ [NotificationRepo] MarkAllAsRead error:`, error);
            throw new Error(`Failed to mark all notifications as read: ${error.message}`);
        }
    }
}

module.exports = NotificationRepository;
