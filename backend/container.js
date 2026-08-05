/**
 * container.js
 * 
 * Dependency Injection Container
 * Initializes all repositories and services with proper dependencies.
 * 
 * This is a singleton that manages all service instances.
 */

const { getFirestore } = require('firebase-admin/firestore');
const initFirebaseAdmin = require('./firebase-admin');
const redisClient = require('./config/redis');

// ========================================
// REPOSITORIES
// ========================================
const OrganizationRepository = require('./repositories/OrganizationRepository');
const UserRepository = require('./repositories/UserRepository');
const AttendanceRepository = require('./repositories/AttendanceRepository');
const LeaveRepository = require('./repositories/LeaveRepository');
const StatisticsRepository = require('./repositories/StatisticsRepository');
const AuditLogRepository = require('./repositories/AuditLogRepository');
const DepartmentRepository = require('./repositories/DepartmentRepository');
const ProjectRepository = require('./repositories/ProjectRepository');
const NotificationRepository = require('./repositories/NotificationRepository');

// ========================================
// SERVICES
// ========================================
const AttendanceService = require('./services/AttendanceService');
const QuotaService = require('./services/QuotaService');
const EmployeeService = require('./services/EmployeeService');
const LeaveService = require('./services/LeaveService');
const StatisticsService = require('./services/StatisticsService');

const AuditLogService = require('./services/AuditLogService');
const NotificationService = require('./services/NotificationService');
const BackupService = require('./services/BackupService');
const ProjectService = require('./services/ProjectService');

/**
 * Container Class
 * Manages dependency injection for all services and repositories
 */
class Container {
  constructor() {
    console.log('🔧 Initializing Dependency Injection Container...');

    // Initialize Firebase Admin
    initFirebaseAdmin();
    this.db = getFirestore();
    console.log('✅ Firebase Admin initialized');

    // Initialize Redis (async, but don't wait for it)
    this.initializeRedis();

    // ========================================
    // Initialize Repositories
    // ========================================
    this.organizationRepo = new OrganizationRepository(this.db);
    this.userRepo = new UserRepository(this.db);
    this.attendanceRepo = new AttendanceRepository(this.db);
    this.leaveRepo = new LeaveRepository(this.db);
    this.statisticsRepo = new StatisticsRepository(this.db);
    this.auditLogRepo = new AuditLogRepository(this.db);
    this.departmentRepo = new DepartmentRepository(this.db);
    this.projectRepo = new ProjectRepository(this.db);
    this.notificationRepo = new NotificationRepository(this.db);
    console.log('✅ Repositories initialized');

    // ========================================
    // Initialize Services (with dependencies)
    // ========================================
    this.notificationService = new NotificationService(this.notificationRepo);
    console.log('✅ NotificationService initialized');

    this.auditLogService = new AuditLogService(this.auditLogRepo);
    console.log('✅ AuditLogService initialized');

    this.attendanceService = new AttendanceService(
      this.attendanceRepo,
      this.userRepo,
      this.notificationService
    );
    console.log('✅ AttendanceService initialized');

    this.quotaService = new QuotaService(
      this.organizationRepo,
      this.userRepo
    );
    console.log('✅ QuotaService initialized');

    this.employeeService = new EmployeeService(
      this.userRepo,
      this.quotaService,
      this.organizationRepo,
      this.auditLogService,
      this.departmentRepo,
      this.leaveRepo
    );
    console.log('✅ EmployeeService initialized');

    this.leaveService = new LeaveService(
      this.leaveRepo,
      this.userRepo,
      this.auditLogService,
      this.notificationService
    );
    console.log('✅ LeaveService initialized');

    this.statisticsService = new StatisticsService(
      this.statisticsRepo,
      this.attendanceRepo,
      this.userRepo
    );
    console.log('✅ StatisticsService initialized');

    this.backupService = new BackupService(this.db, this.auditLogService);
    console.log('✅ BackupService initialized');

    this.projectService = new ProjectService(this.projectRepo, this.userRepo, this.notificationService);
    console.log('✅ ProjectService initialized');

    console.log('🎉 Container initialization complete!');
  }

  /**
   * Initialize Redis connection (async)
   * @private
   */
  async initializeRedis() {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('⚠️ Redis initialization failed, continuing without cache');
    }
  }

  // ========================================
  // SERVICE GETTERS
  // ========================================

  /**
   * Get AttendanceService instance
   * @returns {AttendanceService}
   */
  getAttendanceService() {
    return this.attendanceService;
  }

  /**
   * Get QuotaService instance
   * @returns {QuotaService}
   */
  getQuotaService() {
    return this.quotaService;
  }

  /**
   * Get EmployeeService instance
   * @returns {EmployeeService}
   */
  getEmployeeService() {
    return this.employeeService;
  }

  /**
   * Get LeaveService instance
   * @returns {LeaveService}
   */
  getLeaveService() {
    return this.leaveService;
  }

  /**
   * Get StatisticsService instance
   * @returns {StatisticsService}
   */
  getStatisticsService() {
    return this.statisticsService;
  }

  /**
   * Get AuditLogService instance
   * @returns {AuditLogService}
   */
  getAuditLogService() {
    return this.auditLogService;
  }

  /**
   * Get BackupService instance
   * @returns {BackupService}
   */
  getBackupService() {
    return this.backupService;
  }

  /**
   * Get ProjectService instance
   * @returns {ProjectService}
   */
  getProjectService() {
    return this.projectService;
  }

  // ========================================
  // REPOSITORY GETTERS
  // ========================================

  /**
   * Get AttendanceRepository instance
   * @returns {AttendanceRepository}
   */
  getAttendanceRepo() {
    return this.attendanceRepo;
  }

  /**
   * Get UserRepository instance
   * @returns {UserRepository}
   */
  getUserRepo() {
    return this.userRepo;
  }

  /**
   * Get OrganizationRepository instance
   * @returns {OrganizationRepository}
   */
  getOrganizationRepo() {
    return this.organizationRepo;
  }

  /**
   * Get LeaveRepository instance
   * @returns {LeaveRepository}
   */
  getLeaveRepo() {
    return this.leaveRepo;
  }

  /**
   * Get StatisticsRepository instance
   * @returns {StatisticsRepository}
   */
  getStatisticsRepo() {
    return this.statisticsRepo;
  }

  /**
   * Get AuditLogRepository instance
   * @returns {AuditLogRepository}
   */
  getAuditLogRepo() {
    return this.auditLogRepo;
  }

  /**
   * Get DepartmentRepository instance
   * @returns {DepartmentRepository}
   */
  getDepartmentRepo() {
    return this.departmentRepo;
  }

  /**
   * Get ProjectRepository instance
   * @returns {ProjectRepository}
   */
  getProjectRepo() {
    return this.projectRepo;
  }

  /**
   * Get NotificationRepository instance
   * @returns {NotificationRepository}
   */
  getNotificationRepo() {
    return this.notificationRepo;
  }

  /**
   * Get Firestore database instance
   * @returns {FirebaseFirestore.Firestore}
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Initialize Socket.io
   * @param {Object} io 
   */
  initSocket(io) {
    if (this.notificationService) {
      this.notificationService.setIo(io);
      console.log('✅ Socket.io initialized in Container');
    }

    // Initialize real-time Firestore listeners
    const RealtimeListeners = require('./services/RealtimeListeners');
    this.realtimeListeners = new RealtimeListeners(this.db, io);
    console.log('✅ RealtimeListeners initialized in Container');
  }

  /**
   * Get NotificationService instance
   * @returns {NotificationService}
   */
  getNotificationService() {
    return this.notificationService;
  }

  /**
   * Get Redis client instance
   * @returns {RedisClient}
   */
  getRedisClient() {
    return redisClient;
  }
}

// ========================================
// CREATE SINGLETON INSTANCE
// ========================================
const container = new Container();

// Export singleton
module.exports = container;
