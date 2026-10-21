const crypto = require('crypto');
const Razorpay = require('razorpay');
const Booking = require('../models/bookingModel');
const Show = require('../models/showModel');
const { sendBookingConfirmation } = require('../utils/mailer');
const { sendBookingConfirmationEmail, sendTicketEmail } = require('../services/emailService');

/**
 * Initialize Razorpay instance safely
 */
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay API keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured');
  }

  return new Razorpay({ key_id, key_secret });
};

/**
 * Safely access socket.io instance
 */
const getIO = (req) => {
  return req.app.get('io') || global.io || null;
};

/**
 * Step 2 & 3: Create Razorpay Order
 * POST /api/payment/create-order
 * Request Body: { bookingId, amount, currency }
 */
const createOrder = async (req, res) => {
  try {
    const { bookingId, amount, currency = 'INR' } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid payment amount is required'
      });
    }

    const razorpay = getRazorpayInstance();

    // Convert amount to the smallest currency unit (paise for INR: 1 INR = 100 paise)
    const amountInPaise = Math.round(Number(amount) * 100);

    const receiptId = `rcpt_${(bookingId || Date.now()).toString().slice(-30)}`;

    const options = {
      amount: amountInPaise,
      currency,
      receipt: receiptId,
      notes: {
        bookingId: bookingId || '',
        userEmail: req.user?.email || req.body.userEmail || ''
      }
    };

    const order = await razorpay.orders.create(options);

    // If a bookingId was provided, attach razorpayOrderId to the booking document
    if (bookingId) {
      await Booking.findOneAndUpdate(
        { bookingId },
        { razorpayOrderId: order.id, totalAmount: Number(amount) },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      order
    });
  } catch (error) {
    console.error('[Razorpay createOrder Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Razorpay order'
    });
  }
};

/**
 * Step 4: Verify Cryptographic Signature and Finalize Booking
 * POST /api/payment/verify
 * Request Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId }
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing Razorpay verification parameters (order_id, payment_id, or signature)'
      });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      return res.status(500).json({
        success: false,
        error: 'RAZORPAY_KEY_SECRET is not configured on the server'
      });
    }

    // Cryptographic HMAC SHA256 Signature Verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    let isAuthentic = false;
    try {
      const expBuf = Buffer.from(expectedSignature, 'utf-8');
      const sigBuf = Buffer.from(razorpay_signature, 'utf-8');
      if (expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf)) {
        isAuthentic = true;
      }
    } catch (e) {
      isAuthentic = false;
    }

    if (!isAuthentic) {
      // If signature is invalid, mark booking as Failed and release temporary seat holds
      if (bookingId) {
        const failedBooking = await Booking.findOneAndUpdate(
          { bookingId },
          { paymentStatus: 'Failed' },
          { new: true }
        );
        if (failedBooking && failedBooking.showId && Array.isArray(failedBooking.selectedSeats)) {
          const show = await Show.findOne({ showId: failedBooking.showId });
          if (show && show.tickets) {
            for (const seatId of failedBooking.selectedSeats) {
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
        }
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Verification failed.'
      });
    }

    // Locate booking record by bookingId or razorpayOrderId
    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({ bookingId });
    }
    if (!booking && razorpay_order_id) {
      booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Associated booking record not found'
      });
    }

    // Ownership check (BOLA/IDOR protection)
    const requesterEmail = req.user?.email ? req.user.email.trim().toLowerCase() : null;
    const isAdmin = req.user?.role === 'admin' || req.admin?.role === 'admin';
    const bookingUserEmail = booking.userEmail ? booking.userEmail.trim().toLowerCase() : null;
    if (!isAdmin && requesterEmail && bookingUserEmail && requesterEmail !== bookingUserEmail) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to verify or modify this booking'
      });
    }

    // Order ID consistency check
    if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Order mismatch: razorpay_order_id does not match the booking order'
      });
    }

    // Handle duplicate confirmation idempotently
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
        message: 'Payment was already verified and booking is confirmed',
        booking,
        emailNotification
      });
    }

    // Update booking status to Completed with Razorpay transaction details
    booking.paymentStatus = 'Completed';
    booking.paymentMethod = 'Razorpay';
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    const updatedBooking = await booking.save();

    // Ensure the seats on the corresponding Show are set to 'booked'
    if (booking.showId && Array.isArray(booking.selectedSeats) && booking.selectedSeats.length > 0) {
      const show = await Show.findOne({ showId: booking.showId });
      if (show && show.tickets) {
        for (const seatId of booking.selectedSeats) {
          if (show.tickets[seatId]) {
            show.tickets[seatId] = {
              ...show.tickets[seatId],
              status: 'booked',
              bookedBy: booking.userEmail
            };
            delete show.tickets[seatId].lockExpiry;
            delete show.tickets[seatId].lockedBy;
          }
        }
        show.markModified('tickets');
        await show.save();

        // Emit real-time WebSocket event
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
    }

    // Step 5: Send automated email ticket confirmation using SendGrid emailService
    let emailNotification = { status: 'pending' };
    try {
      const emailResult = await sendBookingConfirmationEmail(booking.bookingId);
      emailNotification = {
        status: emailResult.status || (emailResult.success ? 'sent' : (emailResult.alreadySent ? 'sent' : 'failed')),
        messageId: emailResult.messageId || null
      };
    } catch (emailErr) {
      console.warn('[Payment Controller Ticket Email Note]:', emailErr.message);
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
    console.error('[Razorpay verifyPayment Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed'
    });
  }
};

/**
 * Get Public Razorpay Key for Frontend Client
 * GET /api/payment/key
 */
const getPaymentKey = (req, res) => {
  return res.status(200).json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID || ''
  });
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentKey
};
