const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireEmployee, requireAdmin, requireAdminOrBusinessOwner } = require('../middleware');

// Get service instances from container (ONCE at the top)
const attendanceService = container.getAttendanceService();
const statisticsService = container.getStatisticsService();

// Now use them in routes without re-declaring
router.post('/record', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { action, employeeId, location } = req.body;
    
    const VALID_ACTIONS = ['checkIn', 'checkOut', 'breakIn', 'breakOut'];
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }
    // Don't declare attendanceService again here!

    let userId = req.user.uid;
    let userName = req.user.name;
    const orgId = req.user.organizationId;

    if (req.user.role === 'admin' && employeeId) {
      const userRepo = container.getUserRepo();
      const employee = await userRepo.findById(orgId, employeeId);
      if (employee) {
        userId = employee.id;
        userName = employee.name;
      }
    }

    const result = await attendanceService.recordAttendance(
      orgId,
      userId,
      userName,
      action,
      { location } // Pass location in options
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get my records
router.get('/my-records', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const records = await attendanceService.getEmployeeRecords(
      req.user.organizationId,
      req.user.uid,
      { limit }
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's status
router.get('/today', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const status = await attendanceService.getTodayStatus(
      req.user.organizationId,
      req.user.uid
    );
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly hours
router.get('/weekly-hours', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.query;
    const stats = await attendanceService.getWeeklyHours(
      req.user.organizationId,
      req.user.uid,
      weekStart,
      weekEnd
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;