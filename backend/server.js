/**
 * server.js (UPDATED)
 * * Main Express server with new architecture.
 * Uses container for dependency injection.
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

// Import container (initializes all services and repositories)
const container = require('./container');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const teamRoutes = require('./routes/team');
const systemAdminRoutes = require('./routes/system_admin');
const hikvisionRoutes = require('./routes/hikvision');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Starting Hikvision EMS Server...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// MIDDLEWARE
// ========================================
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  // Do not log the massive hikvision heartbeat requests to keep terminal clean
  if (req.originalUrl && req.originalUrl.includes('/api/event')) return next();
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ========================================
// HEALTH CHECK
// ========================================
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    redis: container.getRedisClient().isAvailable() ? 'connected' : 'disabled'
  });
});

// app.get('/', (req, res) => {
//   res.json({
//     message: 'Hikvision EMS API',
//     version: '2.0.0',
//     status: 'running',
//     endpoints: {
//       health: '/api/health',
//       auth: '/api/auth',
//       admin: '/api/admin',
//       attendance: '/api/attendance',
//       leave: '/api/leave',
//       'system-admin': '/api/system-admin'
//     }
//   });
// });

// ========================================
// API ROUTES
// ========================================
// OLD LINES COMMENTED OUT:
// app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/attendance', attendanceRoutes);
// app.use('/api/leave', leaveRoutes);
// app.use('/api/team', teamRoutes);
// app.use('/api/system-admin', systemAdminRoutes);
// app.use('/api/event', hikvisionRoutes);

// ========================================
// API ROUTES
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/event', hikvisionRoutes);

// ========================================
// STATIC SERVING (PRODUCTION)
// ========================================
if (process.env.NODE_ENV === 'production') {
  console.log('📦 Production mode: Serving frontend built static files');
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    availableRoutes: [
      '/health',
      '/auth',
      '/admin',
      '/attendance',
      '/leave',
      '/system-admin'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
});

// ========================================
// SERVER STARTUP
// ========================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Socket.io in container
container.initSocket(io);

// ========================================
// SPA CATCH-ALL ROUTE (PRODUCTION)
// ========================================
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Hikvision EMS Server Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase: Connected`);
  console.log(`💾 Redis: ${container.getRedisClient().isAvailable() ? 'Connected' : 'Disabled (In-Memory Mode)'}`);
  console.log(`🔌 Socket.io: Initialized`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Server is ready to accept requests!');
  console.log(`\n📖 API Documentation: http://localhost:${PORT}/\n`);
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  try {
    // Close server
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Disconnect Redis
    await container.getRedisClient().disconnect();
    console.log('✅ Redis disconnected');
  } catch (error) {
    console.error('⚠️  Error during shutdown:', error);
  }

  console.log('👋 Server stopped');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(error);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ UNHANDLED PROMISE REJECTION');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});

module.exports = app;