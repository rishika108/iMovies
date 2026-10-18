const Movie = require('../models/movieModel');
const Theatre = require('../models/theatreModel');
const Show = require('../models/showModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Admin = require('../models/adminModel');
const bcrypt = require('bcryptjs');

/**
 * Get dashboard aggregated metrics
 * Returns total movies, theatres, shows, users, completed bookings count, and total revenue
 */
const getDashboardStats = async (req, res) => {
  try {
    const [movies, theatres, shows, users, bookings] = await Promise.all([
      Movie.countDocuments(),
      Theatre.countDocuments(),
      Show.countDocuments(),
      User.countDocuments(),
      Booking.find({ paymentStatus: 'Completed' })
    ]);

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    return res.status(200).json({
      success: true,
      totalMovies: movies,
      totalTheatres: theatres,
      totalShows: shows,
      totalUsers: users,
      totalBookings: bookings.length,
      totalRevenue
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard stats'
    });
  }
};

/**
 * Get all registered users (excluding password hashes)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users'
    });
  }
};

/**
 * Delete a user by _id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      user: {
        id: deletedUser._id,
        email: deletedUser.email,
        username: deletedUser.username
      }
    });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
};

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
};

const getIO = (req) => {
  return req.app.get('io') || global.io || null;
};

/**
 * Get all user transactions with aggregated summary
 * GET /api/admin/transactions
 */
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Booking.find({}).sort({ createdAt: -1 });

    const summary = {
      totalTransactions: transactions.length,
      totalCompletedRevenue: transactions
        .filter((t) => t.paymentStatus === 'Completed')
        .reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0),
      totalRefundedAmount: transactions
        .filter((t) => t.paymentStatus === 'Refunded')
        .reduce((sum, t) => sum + (Number(t.refundAmount) || Number(t.totalAmount) || 0), 0),
      completedCount: transactions.filter((t) => t.paymentStatus === 'Completed').length,
      pendingCount: transactions.filter((t) => t.paymentStatus === 'Pending').length,
      cancelledCount: transactions.filter((t) => t.paymentStatus === 'Cancelled').length,
      refundedCount: transactions.filter((t) => t.paymentStatus === 'Refunded').length
    };

    return res.status(200).json({
      success: true,
      summary,
      transactions
    });
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transactions'
    });
  }
};

/**
 * Process Razorpay refund and free up booked seats in MongoDB
 * POST /api/admin/refund/:paymentId
 */
const refundBooking = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason = 'Admin initiated refund' } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID or Booking ID is required'
      });
    }

    // Locate booking by razorpayPaymentId, bookingId, or _id
    const query = [
      { razorpayPaymentId: paymentId },
      { bookingId: paymentId }
    ];
    if (mongoose.Types.ObjectId.isValid(paymentId)) {
      query.push({ _id: paymentId });
    }

    const booking = await Booking.findOne({ $or: query });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: `No booking found associated with ID: ${paymentId}`
      });
    }

    if (booking.paymentStatus === 'Refunded') {
      return res.status(400).json({
        success: false,
        error: 'This booking has already been refunded',
        booking
      });
    }

    const refundAmount = amount ? Number(amount) : Number(booking.totalAmount || 0);
    const refundAmountInPaise = Math.round(refundAmount * 100);

    let razorpayRefund = null;
    const razorpay = getRazorpayInstance();

    // If an authentic Razorpay payment ID exists (starts with pay_), call Razorpay refund API
    if (razorpay && booking.razorpayPaymentId && booking.razorpayPaymentId.startsWith('pay_')) {
      try {
        razorpayRefund = await razorpay.payments.refund(booking.razorpayPaymentId, {
          amount: refundAmountInPaise,
          notes: {
            reason,
            bookingId: booking.bookingId,
            userEmail: booking.userEmail
          }
        });
      } catch (rzpErr) {
        console.warn('[Razorpay API Refund Warning]:', rzpErr?.error || rzpErr?.message);
      }
    }

    // Update local booking status to 'Refunded'
    const refundId = razorpayRefund?.id || `rfnd_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    booking.paymentStatus = 'Refunded';
    booking.refundId = refundId;
    booking.refundAmount = refundAmount;
    booking.refundStatus = razorpayRefund?.status || 'processed';
    const updatedBooking = await booking.save();

    // Free up the booked seats on the associated Show document
    if (booking.showId && Array.isArray(booking.selectedSeats) && booking.selectedSeats.length > 0) {
      const show = await Show.findOne({ showId: booking.showId });
      if (show && show.tickets) {
        for (const seatId of booking.selectedSeats) {
          if (show.tickets[seatId]) {
            show.tickets[seatId] = {
              ...show.tickets[seatId],
              status: 'available'
            };
            delete show.tickets[seatId].bookedBy;
            delete show.tickets[seatId].lockedBy;
            delete show.tickets[seatId].lockExpiry;
          }
        }
        show.markModified('tickets');
        await show.save();

        // Broadcast real-time seat liberation
        const io = getIO(req);
        if (io) {
          io.to(show.showId).emit('seats:released', {
            showId: show.showId,
            releasedSeats: booking.selectedSeats,
            tickets: show.tickets
          });
          io.emit('show:updated', {
            showId: show.showId,
            tickets: show.tickets
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Booking successfully refunded. ₹${refundAmount} has been credited and ${booking.selectedSeats.length} seats released.`,
      refund: {
        refundId,
        amount: refundAmount,
        status: booking.refundStatus,
        razorpayRefund
      },
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error in refundBooking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process refund'
    });
  }
};

/**
 * Securely create/provision a new admin account from behind the admin panel
 * POST /api/admin/create-admin
 * Strictly protected by fetchAdmin
 */
const createAdminAccount = async (req, res) => {
  try {
    // Explicit RBAC verification
    if (!req.admin || req.admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access forbidden. Administrator privileges required.'
      });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username, email, and password'
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters long'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const existingAdmin = await Admin.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: existingAdmin.email === normalizedEmail
          ? 'Admin with this email already exists'
          : 'Admin with this username already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin'
    });

    const savedAdmin = await newAdmin.save();

    return res.status(201).json({
      success: true,
      message: 'New admin account provisioned successfully',
      admin: {
        id: savedAdmin._id,
        email: savedAdmin.email,
        username: savedAdmin.username,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error in createAdminAccount:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create admin account'
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  deleteUser,
  getAllTransactions,
  refundBooking,
  createAdminAccount
};

