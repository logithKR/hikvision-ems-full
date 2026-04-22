/**
 * timeCalculator.js
 * 
 * Pure utility functions for time calculations.
 * No dependencies on database or external services.
 * 
 * SOLID: Single Responsibility - Only calculates time/hours
 */

class TimeCalculator {
  /**
   * Calculate hours worked from events array
   * @param {Array} events - Array of { type, time, method }
   * @returns {Object} { hoursWorked, breakDuration, totalMinutes }
   */
  static calculateFromEvents(events) {
    if (!events || events.length === 0) {
      return { hoursWorked: 0, breakDuration: 0, totalMinutes: 0 };
    }

    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.time) - new Date(b.time)
    );

    let totalMinutes = 0;
    let sessionStart = null;
    let breakStart = null;
    let breakAccum = 0;
    let hasClosedSession = false;

    for (const event of sortedEvents) {
      const eventTime = new Date(event.time);

      switch (event.type) {
        case 'checkIn':
          sessionStart = eventTime;
          breakStart = null;
          breakAccum = 0;
          break;

        case 'breakIn':
        case 'breakStart':
          if (sessionStart && !breakStart) {
            breakStart = eventTime;
          }
          break;

        case 'breakOut':
        case 'breakEnd':
          if (sessionStart && breakStart) {
            const breakDuration = Math.max(0, Math.floor((eventTime - breakStart) / (1000 * 60)));
            breakAccum += breakDuration;
            breakStart = null;
          }
          break;

        case 'checkOut':
          if (sessionStart) {
            const sessionDuration = Math.max(0, Math.floor((eventTime - sessionStart) / (1000 * 60)));
            totalMinutes += Math.max(0, sessionDuration - breakAccum);
            hasClosedSession = true;
            sessionStart = null;
            breakStart = null;
            breakAccum = 0;
          }
          break;
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      hoursWorked: parseFloat((totalMinutes / 60).toFixed(2)),
      breakDuration: parseFloat((breakAccum / 60).toFixed(2)),
      totalMinutes,
      totalHours: `${hours}h ${minutes}m`, // Legacy format
      hasClosedSession
    };
  }

  /**
   * Calculate hours from time strings (fallback method)
   * @param {string} checkIn - Check-in time (HH:MM:SS or HH:MM AM/PM)
   * @param {string} checkOut - Check-out time
   * @param {string} breakIn - Break start time (optional)
   * @param {string} breakOut - Break end time (optional)
   * @returns {Object} { hoursWorked, breakDuration, totalMinutes }
   */
  static calculateFromTimeStrings(checkIn, checkOut, breakIn = null, breakOut = null) {
    try {
      const startMinutes = this.parseTimeString(checkIn);
      const endMinutes = this.parseTimeString(checkOut);

      if (isNaN(startMinutes) || isNaN(endMinutes)) {
        return { hoursWorked: 0, breakDuration: 0, totalMinutes: 0, totalHours: '0h 0m' };
      }

      // Calculate break duration
      let breakMinutes = 0;
      if (breakIn && breakOut) {
        const breakStartMin = this.parseTimeString(breakIn);
        const breakEndMin = this.parseTimeString(breakOut);
        if (!isNaN(breakStartMin) && !isNaN(breakEndMin)) {
          breakMinutes = Math.max(0, breakEndMin - breakStartMin);
        }
      }

      // Handle midnight crossing
      let totalMinutes = endMinutes - startMinutes;
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60; // Add 24 hours
      }

      // Subtract break time
      totalMinutes = Math.max(0, totalMinutes - breakMinutes);

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return {
        hoursWorked: parseFloat((totalMinutes / 60).toFixed(2)),
        breakDuration: parseFloat((breakMinutes / 60).toFixed(2)),
        totalMinutes,
        totalHours: `${hours}h ${minutes}m`
      };
    } catch (error) {
      console.error('❌ TimeCalculator: Error calculating from time strings:', error);
      return { hoursWorked: 0, breakDuration: 0, totalMinutes: 0, totalHours: '0h 0m' };
    }
  }

  /**
   * Parse time string to minutes since midnight
   * Handles: "09:00", "09:00:00", "09:00 AM", "9:00 PM"
   * @param {string} timeStr - Time string
   * @returns {number} Minutes since midnight
   */
  static parseTimeString(timeStr) {
    try {
      if (!timeStr) return NaN;

      // Normalize whitespace (remove non-breaking spaces)
      const normalized = String(timeStr).replace(/[\u202f\u00a0]/g, ' ').trim();
      
      // Split into time and AM/PM
      const parts = normalized.split(' ');
      const timePart = parts[0];
      const ampm = parts[1] ? parts[1].toUpperCase() : null;

      // Parse time components
      const timeComponents = timePart.split(':');
      const hours = parseInt(timeComponents[0], 10);
      const minutes = parseInt(timeComponents[1], 10) || 0;

      if (isNaN(hours) || isNaN(minutes)) {
        return NaN;
      }

      // Convert to 24-hour format
      let hours24 = hours;
      if (ampm === 'PM' && hours !== 12) {
        hours24 += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours24 = 0;
      }

      return hours24 * 60 + minutes;
    } catch (error) {
      console.error('❌ TimeCalculator: Error parsing time string:', error);
      return NaN;
    }
  }

  /**
   * Format minutes to "Xh Ym" format
   * @param {number} totalMinutes - Total minutes
   * @returns {string} Formatted string
   */
  static formatMinutesToHours(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  /**
   * Calculate overtime hours
   * @param {number} hoursWorked - Total hours worked
   * @param {number} standardHours - Standard working hours (default: 8)
   * @returns {Object} { isOvertime, overtimeHours }
   */
  static calculateOvertime(hoursWorked, standardHours = 8) {
    const overtime = Math.max(0, hoursWorked - standardHours);
    return {
      isOvertime: overtime > 0,
      overtimeHours: parseFloat(overtime.toFixed(2))
    };
  }

  /**
   * Get current time in 12-hour AM/PM format in IST
   * e.g. "09:32:15 AM" or "02:45:00 PM"
   * @returns {string}
   */
  static getCurrentTime() {
    const now = new Date();
    // Always use IST regardless of server timezone
    return now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Get current date in YYYY-MM-DD format in IST
   * @returns {string}
   */
  static getCurrentDate() {
    const now = new Date();
    // Use en-CA locale with IST timezone — gives YYYY-MM-DD directly
    return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  /**
   * Convert US date format to ISO (M/D/YYYY -> YYYY-MM-DD)
   * @param {string} usDate - Date in M/D/YYYY format
   * @returns {string} ISO date
   */
  static convertUSDateToISO(usDate) {
    try {
      const parts = usDate.split('/');
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('❌ TimeCalculator: Error converting date:', error);
      return usDate;
    }
  }

  /**
   * Check if employee is late
   * @param {string} checkInTime - Check-in time (HH:MM:SS)
   * @param {string} expectedTime - Expected check-in time (HH:MM:SS)
   * @returns {boolean}
   */
  static isLateArrival(checkInTime, expectedTime = '09:00:00') {
    try {
      const checkInMinutes = this.parseTimeString(checkInTime);
      const expectedMinutes = this.parseTimeString(expectedTime);
      return checkInMinutes > expectedMinutes;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TimeCalculator;
