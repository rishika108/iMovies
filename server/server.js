require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

// Import route handlers
const authRoutes = require('./routes/authRoutes');
const movieRoutes = require('./routes/movieRoutes');
const theatreRoutes = require('./routes/theatreRoutes');
const showRoutes = require('./routes/showRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const emailRoutes = require('./routes/emailRoutes');

// Import background services
const { startCleanupService } = require('./utils/cleanupService');
const { startReminderService } = require('./utils/reminderService');

// Initialize express application
const app = express();

// Create HTTP server instance
const server = http.createServer(app);

// CORS Configuration: Dynamically allow Vercel production/preview domains, localhost, or any configured CLIENT_URL
const allowedOrigins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : [];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // If explicit origins are configured, check them
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow all localhost origins and all Vercel domains (*.vercel.app)
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('vercel.app')
    ) {
      return callback(null, true);
    }

    // Dynamic reflection fallback to allow live frontend domains with credentials: true
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'auth-token', 'admin-token', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Setup Socket.io with CORS configuration
const io = new Server(server, {
  cors: corsOptions
});

// Make io accessible globally and on app instance for controllers
app.set('io', io);
global.io = io;

// CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'iMovies API is operational',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/theatres', theatreRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/email', emailRoutes);

// Socket.io connection and room event handlers
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join room for real-time seat lock/book updates for a show
  socket.on('join:show', (showId) => {
    socket.join(showId);
    console.log(`[Socket.io] Socket ${socket.id} joined show room: ${showId}`);
  });

  // Leave show room
  socket.on('leave:show', (showId) => {
    socket.leave(showId);
    console.log(`[Socket.io] Socket ${socket.id} left show room: ${showId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// 404 Route Not Found handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Database connection and server initialization
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/imovies';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connection established successfully.');

    // Start background cron jobs
    startCleanupService();
    startReminderService();

    // Start HTTP and WebSocket listener
    if (process.env.NODE_ENV !== 'test') {
      server.listen(PORT, () => {
        console.log(`iMovies server listening on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
  });

module.exports = {
  app,
  server,
  io
};
