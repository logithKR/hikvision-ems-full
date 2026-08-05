/**
 * RealtimeListeners.js
 * 
 * Sets up Firestore onSnapshot listeners on key collections.
 * When data changes, emits Socket.IO events to the relevant org room.
 * Listeners are per-org and created on-demand when clients connect.
 * Includes debouncing to avoid flooding during bulk operations.
 */

class RealtimeListeners {
    /**
     * @param {FirebaseFirestore.Firestore} db - Firestore instance
     * @param {Server} io - Socket.IO server instance
     */
    constructor(db, io) {
        this.db = db;
        this.io = io;
        this.activeListeners = new Map(); // Map<orgId, { unsubscribes: [], clientCount: number }>
        this.debounceTimers = new Map(); // Map<eventKey, timerId>

        this.setupConnectionHandling();
        console.log('✅ RealtimeListeners initialized');
    }

    /**
     * Setup Socket.IO connection/disconnection handling
     * Starts org listeners when first client joins, cleans up when last client leaves
     */
    setupConnectionHandling() {
        this.io.on('connection', (socket) => {
            socket.on('authenticate', (data) => {
                const { organizationId } = data;
                if (organizationId) {
                    this.startOrgListeners(organizationId);
                }
            });

            socket.on('disconnect', () => {
                // Check each org room - if empty, clean up listeners
                for (const [orgId, listener] of this.activeListeners.entries()) {
                    const room = this.io.sockets.adapter.rooms.get(`org:${orgId}`);
                    if (!room || room.size === 0) {
                        this.stopOrgListeners(orgId);
                    }
                }
            });
        });
    }

    /**
     * Start Firestore listeners for an organization
     * @param {string} orgId - Organization ID
     */
    startOrgListeners(orgId) {
        if (this.activeListeners.has(orgId)) {
            // Already listening
            return;
        }

        console.log(`🔔 Starting real-time listeners for org: ${orgId}`);

        const unsubscribes = [];

        // 1. Attendance collection listener
        const attendanceUnsub = this.db
            .collection('organizations').doc(orgId).collection('attendance')
            .onSnapshot(() => {
                this.debouncedEmit(orgId, 'realtime:attendance');
            }, (error) => {
                console.error(`❌ Attendance listener error for org ${orgId}:`, error.message);
            });
        unsubscribes.push(attendanceUnsub);

        // 2. Leaves collection listener
        const leavesUnsub = this.db
            .collection('organizations').doc(orgId).collection('leaves')
            .onSnapshot(() => {
                this.debouncedEmit(orgId, 'realtime:leaves');
            }, (error) => {
                console.error(`❌ Leaves listener error for org ${orgId}:`, error.message);
            });
        unsubscribes.push(leavesUnsub);

        // 3. Users collection listener
        const usersUnsub = this.db
            .collection('organizations').doc(orgId).collection('users')
            .onSnapshot(() => {
                this.debouncedEmit(orgId, 'realtime:employees');
            }, (error) => {
                console.error(`❌ Users listener error for org ${orgId}:`, error.message);
            });
        unsubscribes.push(usersUnsub);

        // 4. Projects collection listener
        const projectsUnsub = this.db
            .collection('organizations').doc(orgId).collection('projects')
            .onSnapshot(() => {
                this.debouncedEmit(orgId, 'realtime:projects');
            }, (error) => {
                console.error(`❌ Projects listener error for org ${orgId}:`, error.message);
            });
        unsubscribes.push(projectsUnsub);

        this.activeListeners.set(orgId, { unsubscribes });
        console.log(`✅ Real-time listeners active for org: ${orgId} (4 collections)`);
    }

    /**
     * Stop Firestore listeners for an organization
     * @param {string} orgId - Organization ID
     */
    stopOrgListeners(orgId) {
        const listener = this.activeListeners.get(orgId);
        if (!listener) return;

        console.log(`🔕 Stopping real-time listeners for org: ${orgId}`);

        // Unsubscribe all Firestore listeners
        listener.unsubscribes.forEach(unsub => unsub());

        // Clear any pending debounce timers
        for (const [key, timerId] of this.debounceTimers.entries()) {
            if (key.startsWith(orgId)) {
                clearTimeout(timerId);
                this.debounceTimers.delete(key);
            }
        }

        this.activeListeners.delete(orgId);
        console.log(`✅ Real-time listeners stopped for org: ${orgId}`);
    }

    /**
     * Debounced emit to avoid flooding during bulk operations
     * @param {string} orgId - Organization ID
     * @param {string} event - Socket event name
     */
    debouncedEmit(orgId, event) {
        const key = `${orgId}:${event}`;

        // Clear existing timer
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        // Set new debounced timer (500ms)
        const timerId = setTimeout(() => {
            this.io.to(`org:${orgId}`).emit(event, {
                orgId,
                timestamp: new Date().toISOString()
            });
            console.log(`📡 Emitted ${event} to org:${orgId}`);
            this.debounceTimers.delete(key);
        }, 500);

        this.debounceTimers.set(key, timerId);
    }

    /**
     * Get status of active listeners
     * @returns {Object} Status info
     */
    getStatus() {
        return {
            activeOrgs: this.activeListeners.size,
            orgs: Array.from(this.activeListeners.keys())
        };
    }
}

module.exports = RealtimeListeners;
