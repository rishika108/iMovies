const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/bookingModel');
const Show = require('../models/showModel');
const Movie = require('../models/movieModel');
const { sendBookingStatusUpdateEmail } = require('../services/emailService');
const { sendBookingConfirmation } = require('../utils/mailer');
const { sendTicketEmail } = require('../services/emailService');
const { isShowExpired, getCancellationEligibility } = require('../utils/timeHelper');

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

    // Dynamic Time Sync: Block booking/locking on shows that have already commenced or passed
    if (isShowExpired(show.showDate, show.showTime)) {
      return res.status(400).json({
        success: false,
        error: `This showtime (${show.showTime} on ${show.showDate}) has already passed and is no longer available for booking.`
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
 * Create Booking document and update show seats to 'booked'
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

    // Dynamic Time Sync: Prevent booking expired shows
    if (isShowExpired(show.showDate, show.showTime)) {
      return res.status(400).json({
        success: false,
        error: `This showtime (${show.showTime} on ${show.showDate}) has already passed and cannot be booked.`
      });
    }

    // Resolve poster URL
    let resolvedPosterUrl = req.body.posterUrl || '';
    if (!resolvedPosterUrl && (movieId || show.movieId)) {
      try {
        const targetMovieId = movieId || show.movieId;
        const movieDoc = await Movie.findOne({
          $or: [
            { movieId: targetMovieId },
            { _id: mongoose.isValidObjectId(targetMovieId) ? targetMovieId : null }
          ]
        });
        if (movieDoc && movieDoc.posterUrl) {
          resolvedPosterUrl = movieDoc.posterUrl;
        }
      } catch (pErr) {
        // non-blocking
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

    // Create booking document
    const newBooking = new Booking({
      bookingId,
      userEmail,
      showId,
      movieId: movieId || show.movieId,
      movieName: movieName || show.theatreName || 'Movie',
      theatreId: req.body.theatreId || show.theatreId || '',
      theatreName: theatreName || show.theatreName,
      showDate: showDate || show.showDate,
      showTime: showTime || show.showTime,
      posterUrl: resolvedPosterUrl,
      ticketsData: finalTicketsData,
      selectedSeats,
      totalAmount: finalAmount,
      paymentStatus: 'Pending'
    });

    const savedBooking = await newBooking.save();

    // Update show tickets: mark each seat as 'booked', remove lockExpiry and lockedBy
    for (const seatId of selectedSeats) {
      if (show.tickets && show.tickets[seatId]) {
        show.tickets[seatId] = {
          ...show.tickets[seatId],
          status: 'booked',
          bookedBy: userEmail
        };
        delete show.tickets[seatId].lockExpiry;
        delete show.tickets[seatId].lockedBy;
      }
    }

    show.markModified('tickets');
    await show.save();

    // Emit socket event
    const io = getIO(req);
    if (io) {
      io.to(showId).emit('seats:booked', {
        showId,
        selectedSeats,
        userEmail,
        bookingId,
        tickets: show.tickets
      });
      io.emit('show:updated', {
        showId,
        tickets: show.tickets
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
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
 * Confirm Payment and send confirmation email
 * PUT /confirm/:bookingId
 */
const confirmPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    booking.paymentStatus = 'Completed';
    const updatedBooking = await booking.save();

    // Send confirmation email asynchronously
    try {
      if (booking.userEmail) {
        await sendTicketEmail(booking.userEmail, {
          bookingId: booking.bookingId,
          movieTitle: booking.movieName,
          theatre: booking.theatreName,
          showDate: booking.showDate,
          showTime: booking.showTime,
          seatNumbers: booking.selectedSeats,
          totalAmount: booking.totalAmount
        });
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email in confirmPayment:', emailErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      booking: updatedBooking
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
 * Strict 2-hour cutoff rule:
 * Cancellation Allowed = (Show Start Time - Current Time) >= 2 hours
 */
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userEmail = (req.user?.email || '').trim().toLowerCase();
    const isAdmin = req.user?.role === 'admin';

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Ownership check (users can only cancel their own bookings; admins can override)
    if (!isAdmin && userEmail && booking.userEmail.toLowerCase() !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only cancel tickets booked under your account.'
      });
    }

    // Prevent duplicate cancellations
    if (booking.paymentStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'This booking has already been cancelled.'
      });
    }

    if (booking.paymentStatus === 'Refunded') {
      return res.status(400).json({
        success: false,
        error: 'This booking has already been refunded and cannot be cancelled again.'
      });
    }

    // Enforce 2-hour cutoff rule (unless admin override)
    if (!isAdmin) {
      const eligibility = getCancellationEligibility(booking.showDate, booking.showTime);
      if (!eligibility.canCancel) {
        return res.status(400).json({
          success: false,
          error: eligibility.reason,
          eligibility
        });
      }
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

    // Send cancellation notification email asynchronously via Brevo
    if (booking.userEmail) {
      sendBookingStatusUpdateEmail(booking.userEmail, {
        bookingId: booking.bookingId,
        movieName: booking.movieName,
        status: 'Cancelled',
        reason: 'User cancelled booking within allowed cancellation window (> 2 hours before showtime)',
        releasedSeats: booking.selectedSeats
      }).catch((e) => console.warn('[bookingController] Cancellation status email note:', e.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Reserved seats have been released.'
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
 * Public ticket verification & view endpoint
 * GET /public/:bookingId or /ticket/:bookingId
 * Completely unauthenticated so public links can be shared and QR scanned.
 */
const getPublicTicket = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking reference ID is required'
      });
    }

    const booking = await Booking.findOne({
      $or: [
        { bookingId: bookingId.trim() },
        { _id: mongoose.isValidObjectId(bookingId.trim()) ? bookingId.trim() : null }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found or invalid booking reference.'
      });
    }

    // Resolve poster URL if not stored on booking document
    let posterUrl = booking.posterUrl || '';
    if (!posterUrl && booking.movieId) {
      try {
        const movieDoc = await Movie.findOne({
          $or: [
            { movieId: booking.movieId },
            { _id: mongoose.isValidObjectId(booking.movieId) ? booking.movieId : null }
          ]
        });
        if (movieDoc && movieDoc.posterUrl) {
          posterUrl = movieDoc.posterUrl;
        }
      } catch (mErr) {
        // non-blocking
      }
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const dynamicValidationUrl = `${clientUrl}/tickets/view/${booking.bookingId}`;

    // Structured JSON payload for the Dynamic QR Code
    const qrPayload = JSON.stringify({
      bookingId: booking.bookingId,
      movie: booking.movieName,
      theatre: booking.theatreName,
      showDate: booking.showDate,
      showTime: booking.showTime,
      seats: booking.selectedSeats,
      amount: booking.totalAmount,
      status: booking.paymentStatus,
      verifyUrl: dynamicValidationUrl
    });

    return res.status(200).json({
      success: true,
      booking: {
        bookingId: booking.bookingId,
        movieName: booking.movieName,
        theatreName: booking.theatreName,
        showDate: booking.showDate,
        showTime: booking.showTime,
        selectedSeats: booking.selectedSeats,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt,
        posterUrl,
        dynamicValidationUrl
      },
      qrPayload
    });
  } catch (error) {
    console.error('Error in getPublicTicket:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve ticket'
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
  getAllBookings,
  getPublicTicket
};
