const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/bookingModel');
const Show = require('../models/showModel');
const { sendBookingConfirmation } = require('../utils/mailer');
const { sendBookingConfirmationEmail, sendBookingStatusUpdateEmail, sendTicketEmail } = require('../services/emailService');

/**
 * Helper to obtain Socket.IO instance from req or global
 */
const getIO = (req) => {
  if (req && req.app && typeof req.app.get === 'function') {
    const io = req.app.get('io');
    if (io) return io;
  }
  if (typeof global !== 'undefined' && global.io) {
    return global.io;
  }
  try {
    const serverModule = require('../server');
    if (serverModule && serverModule.io) {
      return serverModule.io;
    }
  } catch (e) {
    // server might be in middle of circular load, handled gracefully
  }
  return null;
};

/**
 * Lock seats for 10 minutes
 * Body: { showId, selectedSeats, userEmail }
 */
const lockSeats = async (req, res) => {
  try {
    const { showId, selectedSeats } = req.body;
    const userEmail = (req.user?.email || req.body.userEmail || '').trim().toLowerCase();

    if (!showId || !selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide valid showId and selectedSeats array'
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email is required to lock seats'
      });
    }

    // Find the show
    const show = await Show.findOne({ showId });
    if (!show) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    if (!show.tickets) {
      show.tickets = {};
    }

    const now = Date.now();

    // First, auto-release any expired locks on this show
    let modified = false;
    for (const seatKey of Object.keys(show.tickets)) {
      const ticket = show.tickets[seatKey];
      if (
        ticket &&
        ticket.status === 'locked' &&
        ticket.lockExpiry &&
        new Date(ticket.lockExpiry).getTime() < now
      ) {
        ticket.status = 'available';
        delete ticket.lockExpiry;
        delete ticket.lockedBy;
        delete ticket.userEmail;
        modified = true;
      }
    }

    // Check availability of each requested seat
    for (const seatId of selectedSeats) {
      const ticket = show.tickets[seatId];
      if (!ticket) {
        return res.status(400).json({
          success: false,
          error: `Seat ${seatId} does not exist in this show`
        });
      }

      // If already booked
      if (ticket.status === 'booked') {
        return res.status(400).json({
          success: false,
          error: 'Seat already taken',
          message: `Seat ${seatId} is already booked`
        });
      }

      // If locked by someone else
      if (ticket.status === 'locked' && ticket.lockedBy && ticket.lockedBy !== userEmail) {
        return res.status(400).json({
          success: false,
          error: 'Seat already taken',
          message: `Seat ${seatId} is currently locked by another customer`
        });
      }
    }

    // Lock the seats for 10 minutes
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000);
    for (const seatId of selectedSeats) {
      show.tickets[seatId] = {
        ...show.tickets[seatId],
        status: 'locked',
        lockedBy: userEmail,
        lockExpiry
      };
    }

    show.markModified('tickets');
    await show.save();

    // Emit socket event if io is accessible
    const io = getIO(req);
    if (io) {
      io.to(showId).emit('seats:locked', {
        showId,
        selectedSeats,
        userEmail,
        lockExpiry,
        tickets: show.tickets
      });
      io.emit('show:updated', {
        showId,
        tickets: show.tickets
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Seats locked for 10 minutes',
      showId,
      selectedSeats,
      lockExpiry
    });
  } catch (error) {
    console.error('Error in lockSeats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to lock seats'
    });
  }
};

/**
 * Create Booking document with Pending payment status
 * Maintains temporary 10-minute seat hold instead of prematurely marking seats as permanently booked.
 */
const createBooking = async (req, res) => {
  try {
    const userEmail = (req.user?.email || req.body.userEmail || '').trim().toLowerCase();
    const {
      showId,
      selectedSeats,
      ticketsData,
      movieId,
      movieName,
      theatreName,
      showDate,
      showTime,
      totalAmount
    } = req.body;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User email required'
      });
    }

    if (!showId || !selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide showId and selectedSeats'
      });
    }

    const show = await Show.findOne({ showId });
    if (!show) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    // Verify seats exist and are available or already locked by this user
    const now = Date.now();
    for (const seatId of selectedSeats) {
      const ticket = show.tickets ? show.tickets[seatId] : null;
      if (!ticket) {
        return res.status(400).json({
          success: false,
          error: `Seat ${seatId} does not exist in this show`
        });
      }
      if (ticket.status === 'booked') {
        return res.status(400).json({
          success: false,
          error: `Seat ${seatId} is already booked`
        });
      }
      if (
        ticket.status === 'locked' &&
        ticket.lockedBy &&
        ticket.lockedBy.toLowerCase() !== userEmail &&
        ticket.lockExpiry &&
        new Date(ticket.lockExpiry).getTime() > now
      ) {
        return res.status(400).json({
          success: false,
          error: `Seat ${seatId} is locked by another customer`
        });
      }
    }

    // Calculate total amount if not explicitly passed
    let calculatedAmount = 0;
    const finalTicketsData = ticketsData || {};

    for (const seatId of selectedSeats) {
      const ticket = show.tickets ? show.tickets[seatId] : null;
      if (ticket) {
        calculatedAmount += Number(ticket.price || 0);
        if (!finalTicketsData[seatId]) {
          finalTicketsData[seatId] = ticket;
        }
      }
    }

    const finalAmount = totalAmount !== undefined ? Number(totalAmount) : calculatedAmount;
    const bookingId = uuidv4();

    // Create booking document with 'Pending' status
    const newBooking = new Booking({
      bookingId,
      userEmail,
      showId,
      movieId: movieId || show.movieId,
      movieName: movieName || show.theatreName || 'Movie',
      theatreName: theatreName || show.theatreName,
      showDate: showDate || show.showDate,
      showTime: showTime || show.showTime,
      ticketsData: finalTicketsData,
      selectedSeats,
      totalAmount: finalAmount,
      paymentStatus: 'Pending'
    });

    const savedBooking = await newBooking.save();

    // FIX (Issue 5): Maintain temporary seat hold with 10-minute hold window for payment completion.
    // Do NOT permanently mark seats as 'booked' while payment is Pending!
    const holdExpiry = new Date(Date.now() + 10 * 60 * 1000);
    for (const seatId of selectedSeats) {
      if (show.tickets && show.tickets[seatId]) {
        show.tickets[seatId] = {
          ...show.tickets[seatId],
          status: 'locked',
          lockedBy: userEmail,
          bookingId: savedBooking.bookingId,
          lockExpiry: holdExpiry
        };
      }
    }

    show.markModified('tickets');
    await show.save();

    // Emit socket event for temporary hold
    const io = getIO(req);
    if (io) {
      io.to(showId).emit('seats:locked', {
        showId,
        selectedSeats,
        userEmail,
        bookingId: savedBooking.bookingId,
        lockExpiry: holdExpiry,
        tickets: show.tickets
      });
      io.emit('show:updated', {
        showId,
        tickets: show.tickets
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Booking initialized with 10-minute hold. Awaiting payment completion.',
      booking: savedBooking
    });
  } catch (error) {
    console.error('Error in createBooking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create booking'
    });
  }
};

/**
 * Confirm Payment with Cryptographic Razorpay Signature Verification
 * PUT /confirm/:bookingId
 * Request Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Security Enhancements:
 * 1. BOLA/IDOR: Verifies that the authenticated user owns this booking (or is an admin).
 * 2. Payment Confirmation Bypass Prevention: Strictly verifies Razorpay HMAC SHA256 signature
 *    using timing-safe comparison before transitioning paymentStatus to 'Completed'.
 * 3. Seat Transition: Only upon authentic payment verification are seats permanently marked as 'booked'.
 */
const confirmPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    // Require Razorpay cryptographic verification parameters
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required'
      });
    }

    // Locate booking by bookingId or MongoDB ObjectId
    const query = [{ bookingId }];
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      query.push({ _id: bookingId });
    }

    const booking = await Booking.findOne({ $or: query });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // BOLA/IDOR Check: Requester must be owner of the booking or an administrator
    const requesterEmail = req.user?.email ? req.user.email.trim().toLowerCase() : null;
    const isAdmin = req.user?.role === 'admin' || req.admin?.role === 'admin';
    const bookingUserEmail = booking.userEmail ? booking.userEmail.trim().toLowerCase() : null;

    if (!isAdmin && (!requesterEmail || requesterEmail !== bookingUserEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Access forbidden: You do not have permission to confirm this booking'
      });
    }

    // Prevent double confirmation while ensuring idempotent email dispatch
    if (booking.paymentStatus === 'Completed') {
      let emailNotification = {
        status: booking.confirmationEmailStatus === 'sent' ? 'sent' : 'already_processed'
      };
      if (booking.confirmationEmailStatus !== 'sent') {
        const emailRes = await sendBookingConfirmationEmail(booking.bookingId);
        emailNotification = {
          status: emailRes.status || (emailRes.success ? 'sent' : 'failed'),
          messageId: emailRes.messageId || null
        };
      }
      return res.status(200).json({
        success: true,
        message: 'Booking is already confirmed',
        booking,
        emailNotification
      });
    }

    // Verify Razorpay HMAC SHA256 Signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: RAZORPAY_KEY_SECRET is not configured'
      });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    let isAuthentic = false;
    try {
      const genBuf = Buffer.from(generatedSignature, 'utf-8');
      const sigBuf = Buffer.from(razorpay_signature, 'utf-8');
      if (genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf)) {
        isAuthentic = true;
      }
    } catch (e) {
      isAuthentic = false;
    }

    if (!isAuthentic) {
      booking.paymentStatus = 'Failed';
      await booking.save();

      // Release locked seats since signature verification failed
      const show = await Show.findOne({ showId: booking.showId });
      if (show && show.tickets) {
        for (const seatId of booking.selectedSeats) {
          if (show.tickets[seatId] && show.tickets[seatId].status === 'locked') {
            show.tickets[seatId].status = 'available';
            delete show.tickets[seatId].lockExpiry;
            delete show.tickets[seatId].lockedBy;
            delete show.tickets[seatId].bookingId;
          }
        }
        show.markModified('tickets');
        await show.save();
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Verification failed.'
      });
    }

    // Payment Signature Verified: Finalize booking
    booking.paymentStatus = 'Completed';
    booking.paymentMethod = 'Razorpay';
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    const updatedBooking = await booking.save();

    // Transition seats from 'locked' to 'booked' upon verified payment completion
    const show = await Show.findOne({ showId: booking.showId });
    if (show && show.tickets) {
      for (const seatId of booking.selectedSeats) {
        if (show.tickets[seatId]) {
          show.tickets[seatId] = {
            ...show.tickets[seatId],
            status: 'booked',
            bookedBy: booking.userEmail,
            bookingId: booking.bookingId
          };
          delete show.tickets[seatId].lockExpiry;
          delete show.tickets[seatId].lockedBy;
        }
      }
      show.markModified('tickets');
      await show.save();

      // Broadcast real-time seat booking update
      const io = getIO(req);
      if (io) {
        io.to(show.showId).emit('seats:booked', {
          showId: show.showId,
          selectedSeats: booking.selectedSeats,
          userEmail: booking.userEmail,
          bookingId: booking.bookingId,
          tickets: show.tickets
        });
        io.emit('show:updated', {
          showId: show.showId,
          tickets: show.tickets
        });
      }
    }

    // Send confirmation email via SendGrid emailService
    let emailNotification = { status: 'pending' };
    try {
      const emailResult = await sendBookingConfirmationEmail(booking.bookingId);
      emailNotification = {
        status: emailResult.status || (emailResult.success ? 'sent' : (emailResult.alreadySent ? 'sent' : 'failed')),
        messageId: emailResult.messageId || null
      };
    } catch (emailErr) {
      console.error('Failed to send confirmation email in confirmPayment:', emailErr);
      emailNotification = { status: 'failed', error: 'Email service temporary failure' };
    }

    const finalBooking = await Booking.findOne({ bookingId: booking.bookingId });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed successfully',
      booking: finalBooking || updatedBooking,
      emailNotification
    });
  } catch (error) {
    console.error('Error in confirmPayment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm payment'
    });
  }
};

/**
 * Cancel Booking and release show seats
 * PUT /cancel/:bookingId
 *
 * Security: Enforces BOLA/IDOR protection. Only the owner or an admin can cancel a booking.
 */
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    // Locate booking by bookingId or MongoDB ObjectId
    const query = [{ bookingId }];
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      query.push({ _id: bookingId });
    }

    const booking = await Booking.findOne({ $or: query });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // BOLA/IDOR Check: Ensure requester owns the booking or is an administrator
    const requesterEmail = req.user?.email ? req.user.email.trim().toLowerCase() : null;
    const isAdmin = req.user?.role === 'admin' || req.admin?.role === 'admin';
    const bookingUserEmail = booking.userEmail ? booking.userEmail.trim().toLowerCase() : null;

    if (!isAdmin && (!requesterEmail || requesterEmail !== bookingUserEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Access forbidden: You are not authorized to cancel this booking'
      });
    }

    if (booking.paymentStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already cancelled'
      });
    }

    booking.paymentStatus = 'Cancelled';
    await booking.save();

    // Release show seats back to 'available'
    const show = await Show.findOne({ showId: booking.showId });
    if (show && show.tickets) {
      for (const seatId of booking.selectedSeats) {
        if (show.tickets[seatId]) {
          show.tickets[seatId] = {
            ...show.tickets[seatId],
            status: 'available'
          };
          delete show.tickets[seatId].lockExpiry;
          delete show.tickets[seatId].lockedBy;
          delete show.tickets[seatId].bookedBy;
          delete show.tickets[seatId].bookingId;
        }
      }
      show.markModified('tickets');
      await show.save();

      // Emit socket event
      const io = getIO(req);
      if (io) {
        io.to(booking.showId).emit('seats:cancelled', {
          showId: booking.showId,
          selectedSeats: booking.selectedSeats,
          tickets: show.tickets
        });
        io.emit('show:updated', {
          showId: booking.showId,
          tickets: show.tickets
        });
      }
    }

    // Automatically trigger cancellation notification email via Brevo
    if (booking.userEmail) {
      sendBookingStatusUpdateEmail(booking.userEmail, {
        status: 'Cancelled',
        bookingId: booking.bookingId,
        movieTitle: booking.movieName || 'Movie Booking',
        message: `Your booking (${booking.bookingId}) has been cancelled and the reserved seats have been released.`,
        refundAmount: booking.totalAmount
      }).catch(mailErr => console.warn('[cancelBooking] Brevo cancellation status email notice:', mailErr.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully and seats released'
    });
  } catch (error) {
    console.error('Error in cancelBooking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel booking'
    });
  }
};

/**
 * Get bookings for the currently authenticated user
 * GET /my
 */
const getUserBookings = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not identified'
      });
    }

    const bookings = await Booking.find({
      userEmail: userEmail.trim().toLowerCase()
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error in getUserBookings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user bookings'
    });
  }
};

/**
 * Get all bookings (Admin only)
 * GET /all
 */
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error in getAllBookings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch all bookings'
    });
  }
};

module.exports = {
  lockSeats,
  createBooking,
  confirmPayment,
  cancelBooking,
  getUserBookings,
  getAllBookings
};
