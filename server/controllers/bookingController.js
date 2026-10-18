const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/bookingModel');
const Show = require('../models/showModel');
const { sendBookingConfirmation } = require('../utils/mailer');
const { sendTicketEmail } = require('../services/emailService');

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
      theatreName: theatreName || show.theatreName,
      showDate: showDate || show.showDate,
      showTime: showTime || show.showTime,
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
 */
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
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

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
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
