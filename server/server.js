require('dotenv').config();

// Critical Security Check: Ensure JWT_SECRET is explicitly configured
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  console.error('FATAL STARTUP ERROR: JWT_SECRET environment variable is missing or empty. Server cannot start.');
  process.exit(1);
}

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
const webhookRoutes = require('./routes/webhookRoutes');

// Import background services
const { startCleanupService } = require('./utils/cleanupService');
const { startReminderService } = require('./utils/reminderService');

// Initialize express application
const app = express();

// Create HTTP server instance
const server = http.createServer(app);

// Strict CORS Allowlist Configuration
const ALLOWED_ORIGINS = [
  'https://i-movies-theta.vercel.app',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173'
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach(url => {
    const trimmed = url.trim();
    if (trimmed && !ALLOWED_ORIGINS.includes(trimmed)) {
      ALLOWED_ORIGINS.push(trimmed);
    }
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, health-check probes) with no origin header
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Strictly reject any unknown origins with authorization/CORS error
    const corsError = new Error(`CORS policy violation: Origin '${origin}' is not authorized.`);
    corsError.status = 403;
    return callback(corsError, false);
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
app.use('/api/webhooks', webhookRoutes);

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
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`iMovies server listening on port ${PORT} (0.0.0.0)`);
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
