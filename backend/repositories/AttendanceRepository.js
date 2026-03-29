/**
 * AttendanceRepository.js
 * 
 * Repository for managing attendance records within organizations.
 * Hierarchical structure: organizations/{orgId}/attendance/{attendanceId}
 * 
 * Attendance ID format: {userId}_{YYYY-MM-DD}
 */

const BaseRepository = require('./BaseRepository');

class AttendanceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'attendance');
  }

  /**
   * Override: Get collection reference for specific organization
   * @param {string} orgId - Organization ID
   * @returns {FirebaseFirestore.CollectionReference}
   */
  getCollection(orgId) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    return this.db.collection('organizations').doc(orgId).collection('attendance');
  }

  /**
   * Create or update attendance record for a user on a specific date
   * @param {string} orgId - Organization ID
   * @param {Object} data - Attendance data
   * @returns {Promise<Object>} Created/updated attendance record
   */
  async createOrUpdate(orgId, data) {
    try {
      const { userId, userName, date, action, time, verifyMethod = 'manual', location } = data;

      // Generate attendance ID: userId_YYYY-MM-DD
      const attendanceId = `${userId}_${date}`;
      const docRef = this.getCollection(orgId).doc(attendanceId);
      const doc = await docRef.get();

      const timestamp = new Date().toISOString();
      const event = {
        type: action, // checkIn, checkOut, breakIn, breakOut
        time: timestamp,
        method: verifyMethod,
        location: data.location || null // Store location if provided
      };

      if (doc.exists) {
        // Update existing record
        const existingData = doc.data();
        const events = existingData.events || [];
        events.push(event);

        const updateData = {
          [action]: time,
          events,
          updatedAt: timestamp,
          verifyMethod // Update verify method
        };

        if (action === 'checkIn' && data.location) {
          updateData.checkInLocation = data.location;
        } else if (action === 'checkOut' && data.location) {
          updateData.checkOutLocation = data.location;
        }

        await docRef.update(updateData);

        // Fetch updated document
        const updatedDoc = await docRef.get();
        const result = { id: updatedDoc.id, ...updatedDoc.data() };

        console.log(`✅ [AttendanceRepository] Updated attendance: ${attendanceId} - ${action}`);
        return result;
      } else {
        // Create new record
        const newData = {
          id: attendanceId,
          userId,
          userName,
          date,
          organizationId: orgId,
          [action]: time,
          events: [event],
          verifyMethod,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        if (action === 'checkIn' && data.location) {
          newData.checkInLocation = data.location;
        } else if (action === 'checkOut' && data.location) {
          newData.checkOutLocation = data.location;
        }

        await docRef.set(newData);

        console.log(`✅ [AttendanceRepository] Created attendance: ${attendanceId}`);
        return newData;
      }
    } catch (error) {
      console.error(`❌ [AttendanceRepository] CreateOrUpdate error:`, error);
      throw new Error(`Failed to create/update attendance: ${error.message}`);
    }
  }

  /**
   * Get today's attendance for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>}
   */
  async getTodayRecord(orgId, userId, date) {
    try {
      const attendanceId = `${userId}_${date}`;
      const doc = await this.getCollection(orgId).doc(attendanceId).get();

      if (!doc.exists) {
        console.log(`⚠️ [AttendanceRepository] No attendance record for user ${userId} on ${date}`);
        return null;
      }

      const data = { id: doc.id, ...doc.data() };
      console.log(`✅ [AttendanceRepository] Found attendance record: ${attendanceId}`);
      return data;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetTodayRecord error:`, error);
      throw new Error(`Failed to get today's record: ${error.message}`);
    }
  }

  /**
   * Get all attendance records for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Object} options - Options { limit, startDate, endDate }
   * @returns {Promise<Array>}
   */
  async getUserRecords(orgId, userId, options = {}) {
    try {
      let query = this.getCollection(orgId).where('userId', '==', userId);

      // Date range filter
      if (options.startDate) {
        query = query.where('date', '>=', options.startDate);
      }
      if (options.endDate) {
        query = query.where('date', '<=', options.endDate);
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      let snapshot;
      try {
        snapshot = await query.get();
      } catch (indexError) {
        // Firestore composite index may not exist — fallback to userId-only query + client-side filter
        console.log('⚠️ [AttendanceRepository] Composite index not available, using fallback filter');
        const fallbackQuery = this.getCollection(orgId).where('userId', '==', userId);
        snapshot = await fallbackQuery.get();
      }

      let records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side date filtering (needed when composite index fallback is used)
      if (options.startDate) {
        records = records.filter(r => r.date >= options.startDate);
      }
      if (options.endDate) {
        records = records.filter(r => r.date <= options.endDate);
      }

      // Sort by date descending (most recent first)
      records.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Apply limit after filtering
      if (options.limit && records.length > options.limit) {
        records = records.slice(0, options.limit);
      }

      console.log(`✅ [AttendanceRepository] Found ${records.length} records for user ${userId}`);
      return records;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetUserRecords error:`, error);
      throw new Error(`Failed to get user records: ${error.message}`);
    }
  }

  /**
   * Get all attendance records for a specific date
   * @param {string} orgId - Organization ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>}
   */
  async getByDate(orgId, date) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('date', '==', date)
        .get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ [AttendanceRepository] Found ${records.length} attendance records for ${date}`);
      return records;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetByDate error:`, error);
      throw new Error(`Failed to get records by date: ${error.message}`);
    }
  }

  /**
   * Get attendance records for a date range
   * @param {string} orgId - Organization ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getByDateRange(orgId, startDate, endDate) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by date
      records.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log(`✅ [AttendanceRepository] Found ${records.length} records from ${startDate} to ${endDate}`);
      return records;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetByDateRange error:`, error);
      throw new Error(`Failed to get records by date range: ${error.message}`);
    }
  }

  /**
   * Update hours worked for an attendance record
   * @param {string} orgId - Organization ID
   * @param {string} attendanceId - Attendance ID (userId_date)
   * @param {Object} hoursData - { hoursWorked, breakDuration, isOvertime, overtimeHours }
   * @returns {Promise<Object>}
   */
  async updateHours(orgId, attendanceId, hoursData) {
    try {
      const docRef = this.getCollection(orgId).doc(attendanceId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Attendance record not found: ${attendanceId}`);
      }

      const updateData = {
        hoursWorked: hoursData.hoursWorked || 0,
        breakDuration: hoursData.breakDuration || 0,
        isOvertime: hoursData.isOvertime || false,
        overtimeHours: hoursData.overtimeHours || 0,
        totalHours: hoursData.totalHours || '0h 0m', // Legacy format
        updatedAt: new Date().toISOString()
      };

      await docRef.update(updateData);

      const updatedDoc = await docRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      console.log(`✅ [AttendanceRepository] Updated hours for ${attendanceId}: ${hoursData.hoursWorked}h`);
      return result;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] UpdateHours error:`, error);
      throw new Error(`Failed to update hours: ${error.message}`);
    }
  }

  /**
   * Get weekly attendance for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} weekStart - Week start date (YYYY-MM-DD)
   * @param {string} weekEnd - Week end date (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getWeeklyRecords(orgId, userId, weekStart, weekEnd) {
    try {
      return await this.getUserRecords(orgId, userId, {
        startDate: weekStart,
        endDate: weekEnd
      });
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetWeeklyRecords error:`, error);
      throw new Error(`Failed to get weekly records: ${error.message}`);
    }
  }

  /**
   * Get monthly attendance for a user
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Array>}
   */
  async getMonthlyRecords(orgId, userId, year, month) {
    try {
      // Calculate start and end dates
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      return await this.getUserRecords(orgId, userId, {
        startDate,
        endDate
      });
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetMonthlyRecords error:`, error);
      throw new Error(`Failed to get monthly records: ${error.message}`);
    }
  }

  /**
   * Delete attendance record
   * @param {string} orgId - Organization ID
   * @param {string} attendanceId - Attendance ID
   * @returns {Promise<boolean>}
   */
  async delete(orgId, attendanceId) {
    try {
      const docRef = this.getCollection(orgId).doc(attendanceId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Attendance record not found: ${attendanceId}`);
      }

      await docRef.delete();

      console.log(`✅ [AttendanceRepository] Deleted attendance: ${attendanceId}`);
      return true;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] Delete error:`, error);
      throw new Error(`Failed to delete attendance: ${error.message}`);
    }
  }

  /**
   * Get attendance summary for organization on a date
   * @param {string} orgId - Organization ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Promise<Object>}
   */
  async getDailySummary(orgId, date) {
    try {
      const records = await this.getByDate(orgId, date);

      const summary = {
        date,
        totalRecords: records.length,
        presentCount: records.filter(r => r.checkIn).length,
        checkedOutCount: records.filter(r => r.checkOut).length,
        onBreakCount: records.filter(r => r.breakIn && !r.breakOut).length,
        totalHoursWorked: 0,
        averageHours: 0
      };

      // Calculate total hours
      records.forEach(record => {
        if (record.hoursWorked) {
          summary.totalHoursWorked += record.hoursWorked;
        }
      });

      if (summary.presentCount > 0) {
        summary.averageHours = (summary.totalHoursWorked / summary.presentCount).toFixed(2);
      }

      console.log(`✅ [AttendanceRepository] Daily summary for ${date}:`, summary);
      return summary;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] GetDailySummary error:`, error);
      throw new Error(`Failed to get daily summary: ${error.message}`);
    }
  }

  /**
   * Count attendance records in date range
   * @param {string} orgId - Organization ID
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<number>}
   */
  async countInDateRange(orgId, startDate, endDate) {
    try {
      const snapshot = await this.getCollection(orgId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

      const count = snapshot.size;
      console.log(`✅ [AttendanceRepository] Count from ${startDate} to ${endDate}: ${count}`);
      return count;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] CountInDateRange error:`, error);
      throw new Error(`Failed to count records: ${error.message}`);
    }
  }

  /**
   * Check if user has checked in today
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Promise<boolean>}
   */
  async hasCheckedIn(orgId, userId, date) {
    try {
      const record = await this.getTodayRecord(orgId, userId, date);
      return record !== null && record.checkIn !== undefined;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] HasCheckedIn error:`, error);
      return false;
    }
  }

  /**
   * Get all attendance records (with pagination)
   * @param {string} orgId - Organization ID
   * @param {Object} options - { limit, offset, orderBy }
   * @returns {Promise<Array>}
   */
  async findAll(orgId, options = {}) {
    try {
      let query = this.getCollection(orgId);

      // Apply ordering
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field || 'date', options.orderBy.direction || 'desc');
      } else {
        query = query.orderBy('date', 'desc');
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ [AttendanceRepository] Found ${records.length} attendance records`);
      return records;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] FindAll error:`, error);
      throw new Error(`Failed to find all records: ${error.message}`);
    }
  }

  /**
   * Batch update multiple attendance records
   * @param {string} orgId - Organization ID
   * @param {Array} updates - Array of { attendanceId, data }
   * @returns {Promise<boolean>}
   */
  async batchUpdate(orgId, updates) {
    try {
      const batch = this.db.batch();

      for (const update of updates) {
        const docRef = this.getCollection(orgId).doc(update.attendanceId);
        batch.update(docRef, {
          ...update.data,
          updatedAt: new Date().toISOString()
        });
      }

      await batch.commit();

      console.log(`✅ [AttendanceRepository] Batch updated ${updates.length} records`);
      return true;
    } catch (error) {
      console.error(`❌ [AttendanceRepository] BatchUpdate error:`, error);
      throw new Error(`Failed to batch update: ${error.message}`);
    }
  }
}

module.exports = AttendanceRepository;
