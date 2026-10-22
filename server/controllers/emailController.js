/**
 * emailController.js
 * Express Controller for Brevo (Sendinblue) Transactional Emails
 *
 * Exposes clean, validated endpoints for:
 * 1. Account verification emails (new user signups)
 * 2. Password reset links & tokens
 * 3. Booking confirmation tickets/receipts
 * 4. Booking status updates (Confirmed, Cancelled, Refunded, Rescheduled)
 * 5. Generic/Custom transactional emails
 * 6. Quick test email triggering and diagnostic health checks
 *
 * Implements robust error handling (HTTP 429 rate-limiting, network retries,
 * schema validation, structured logging).
 */

const {
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail
} = require('../services/emailService');

const {
  isConfigured,
  SENDER_EMAIL,
  SENDER_NAME,
  CLIENT_URL
} = require('../config/brevoConfig');

/**
 * Standard email format regex check (RFC 5322 subset)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
};

/**
 * Handle API responses with structured status codes and rate-limit handling
 */
const handleServiceResult = (res, result, successMessage = 'Email sent successfully') => {
  if (result.success) {
    return res.status(200).json({
      success: true,
      message: successMessage,
      messageId: result.messageId
    });
  }

  // Handle rate limits (HTTP 429)
  if (result.isRateLimited || result.statusCode === 429) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      success: false,
      error: 'Brevo email rate limit exceeded. Please retry after a brief delay.',
      details: result.error
    });
  }

  // Handle unconfigured service (HTTP 503)
  if (result.statusCode === 503) {
    return res.status(503).json({
      success: false,
      error: 'Brevo transactional email service is not configured.',
      details: result.error
    });
  }

  // Client errors (400)
  if (result.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: result.error || 'Invalid email parameters'
    });
  }

  // Resource not found (404)
  if (result.statusCode === 404) {
    return res.status(404).json({
      success: false,
      error: result.error || 'Requested record not found'
    });
  }

  // Generic fallback server error (500 or statusCode)
  const status = result.statusCode && result.statusCode >= 400 && result.statusCode < 600
    ? result.statusCode
    : 500;

  return res.status(status).json({
    success: false,
    error: result.error || 'Failed to dispatch email'
  });
};

/**
 * POST /api/email/send-verification
 * Trigger account verification email
 */
const sendVerification = async (req, res) => {
  try {
    const { email, verificationToken, verificationLink, userName } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required'
      });
    }

    const tokenOrLink = (verificationToken || verificationLink || '').trim();
    if (!tokenOrLink) {
      return res.status(400).json({
        success: false,
        error: 'verificationToken or verificationLink is required'
      });
    }

    console.log(`[emailController.sendVerification] Triggering verification email for: ${email}`);
    const result = await sendVerificationEmail(email.trim(), tokenOrLink, userName || '');

    return handleServiceResult(res, result, 'Account verification email sent successfully');
  } catch (error) {
    console.error('[emailController.sendVerification] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error dispatching verification email'
    });
  }
};

/**
 * POST /api/email/send-reset-password
 * Trigger secure password recovery email
 */
const sendPasswordReset = async (req, res) => {
  try {
    const { email, resetToken, resetLink, userName } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required'
      });
    }

    const tokenOrLink = (resetToken || resetLink || '').trim();
    if (!tokenOrLink) {
      return res.status(400).json({
        success: false,
        error: 'resetToken or resetLink is required'
      });
    }

    console.log(`[emailController.sendPasswordReset] Triggering password recovery email for: ${email}`);
    const result = await sendPasswordResetEmail(email.trim(), tokenOrLink, userName || '');

    return handleServiceResult(res, result, 'Password reset email sent successfully');
  } catch (error) {
    console.error('[emailController.sendPasswordReset] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error dispatching password reset email'
    });
  }
};

/**
 * POST /api/email/send-booking-confirmation
 * Trigger booking confirmation receipt email
 * Supports either:
 *  - { bookingId } -> loads booking from DB
 *  - { email, bookingDetails } -> direct payload
 */
const sendBookingConfirmation = async (req, res) => {
  try {
    const { bookingId, email, bookingDetails } = req.body;

    // Check if called with direct booking details or bookingId
    if (bookingId && !bookingDetails && !email) {
      console.log(`[emailController.sendBookingConfirmation] Triggering confirmation for Booking ID: ${bookingId}`);
      const result = await sendBookingConfirmationEmail(bookingId);
      return handleServiceResult(res, result, 'Booking confirmation email sent successfully');
    }

    // Called with direct email and booking payload
    const targetEmail = (email || req.body.userEmail || '').trim();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address or bookingId is required'
      });
    }

    const details = bookingDetails || {
      bookingId: bookingId || req.body.bookingId || `IMV-${Date.now()}`,
      movieTitle: req.body.movieTitle || req.body.movieName || 'Movie Ticket',
      theatreName: req.body.theatreName || 'Cinema Theatre',
      showDate: req.body.showDate || new Date().toISOString().split('T')[0],
      showTime: req.body.showTime || '07:00 PM',
      selectedSeats: req.body.selectedSeats || ['Seat 1'],
      totalAmount: req.body.totalAmount || 0,
      paymentStatus: req.body.paymentStatus || 'Completed',
      bookingDate: req.body.bookingDate || new Date().toISOString()
    };

    console.log(`[emailController.sendBookingConfirmation] Triggering confirmation for ${targetEmail} (${details.movieTitle})`);
    const result = await sendBookingConfirmationEmail(targetEmail, details);

    return handleServiceResult(res, result, 'Booking confirmation email sent successfully');
  } catch (error) {
    console.error('[emailController.sendBookingConfirmation] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error dispatching booking confirmation'
    });
  }
};

/**
 * POST /api/email/send-status-update
 * Trigger booking status change notification (Confirmed, Cancelled, Refunded, Rescheduled)
 */
const sendBookingStatusUpdate = async (req, res) => {
  try {
    const {
      email,
      statusDetails,
      status,
      bookingId,
      movieTitle,
      movieName,
      message,
      refundAmount,
      refundId
    } = req.body;

    const targetEmail = (email || req.body.userEmail || '').trim();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required'
      });
    }

    const details = statusDetails || {
      status: status || 'Updated',
      bookingId: bookingId || 'N/A',
      movieTitle: movieTitle || movieName || 'Movie',
      message: message || '',
      refundAmount,
      refundId
    };

    if (!details.status) {
      return res.status(400).json({
        success: false,
        error: 'statusDetails.status is required (e.g. Confirmed, Cancelled, Refunded)'
      });
    }

    console.log(`[emailController.sendBookingStatusUpdate] Triggering status update for ${targetEmail} [${details.status}]`);
    const result = await sendBookingStatusUpdateEmail(targetEmail, details);

    return handleServiceResult(res, result, `Booking status update email (${details.status}) sent successfully`);
  } catch (error) {
    console.error('[emailController.sendBookingStatusUpdate] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error dispatching booking status update'
    });
  }
};

/**
 * POST /api/email/send-custom
 * Send a custom transactional email with custom subject, HTML and plain text
 */
const sendCustom = async (req, res) => {
  try {
    const { to, subject, htmlContent, textContent, tags, replyTo } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Recipient "to" is required'
      });
    }

    if (!subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: 'subject and htmlContent are required'
      });
    }

    const result = await sendEmail({
      to,
      subject,
      htmlContent,
      textContent,
      tags: tags || ['custom'],
      replyTo
    });

    return handleServiceResult(res, result, 'Custom email sent successfully');
  } catch (error) {
    console.error('[emailController.sendCustom] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error sending custom email'
    });
  }
};

/**
 * POST /api/email/test
 * Quick diagnostic test endpoint to verify Brevo connectivity and delivery
 */
const testEmail = async (req, res) => {
  try {
    const targetEmail = (req.body.email || req.query.email || SENDER_EMAIL).trim();
    const testType = (req.body.type || req.query.type || 'verification').toLowerCase();

    if (!isValidEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        error: `Invalid destination email: "${targetEmail}"`
      });
    }

    console.log(`[emailController.testEmail] Running test (${testType}) to: ${targetEmail}`);

    let result;
    if (testType === 'verification') {
      result = await sendVerificationEmail(
        targetEmail,
        `test-token-${Date.now()}`,
        'Test User'
      );
    } else if (testType === 'reset' || testType === 'password') {
      result = await sendPasswordResetEmail(
        targetEmail,
        `test-reset-token-${Date.now()}`,
        'Test User'
      );
    } else if (testType === 'booking') {
      result = await sendBookingConfirmationEmail(targetEmail, {
        bookingId: `TEST-${Date.now().toString().slice(-6)}`,
        movieTitle: 'Inception (Test Screening)',
        theatreName: 'PVR IMAX Screen 1',
        showDate: new Date().toISOString().split('T')[0],
        showTime: '08:00 PM',
        selectedSeats: ['B12', 'B13'],
        totalAmount: 600,
        paymentStatus: 'Completed',
        bookingDate: new Date().toISOString()
      });
    } else if (testType === 'status') {
      result = await sendBookingStatusUpdateEmail(targetEmail, {
        status: 'Cancelled',
        bookingId: `TEST-${Date.now().toString().slice(-6)}`,
        movieTitle: 'Inception (Test Screening)',
        message: 'Your booking has been cancelled as requested. A full refund has been initiated.',
        refundAmount: 600,
        refundId: `ref_${Date.now()}`
      });
    } else {
      result = await sendEmail({
        to: targetEmail,
        subject: '🧪 iMovies Brevo Integration Test',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; background: #111; color: #fff; padding: 24px; border-radius: 8px;">
            <h2 style="color: #e50914;">🎬 iMovies Email Test</h2>
            <p>This is a live transactional test email sent via the <strong>@getbrevo/brevo</strong> SDK.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Configured Sender:</strong> ${SENDER_EMAIL} (${SENDER_NAME})</p>
            <hr style="border-color: #333;" />
            <p style="color: #4ade80;">✓ Brevo API integration is operational!</p>
          </div>
        `,
        tags: ['test']
      });
    }

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Test email (${testType}) dispatched successfully`,
        recipient: targetEmail,
        messageId: result.messageId,
        provider: 'Brevo (Sendinblue)',
        timestamp: new Date().toISOString()
      });
    }

    return handleServiceResult(res, result, 'Test email sent');
  } catch (error) {
    console.error('[emailController.testEmail] Unhandled Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error executing email test'
    });
  }
};

/**
 * GET /api/email/status
 * Check Brevo service operational and configuration status
 */
const getStatus = async (req, res) => {
  try {
    const configured = isConfigured();
    return res.status(200).json({
      success: true,
      service: 'Brevo Transactional Emails',
      configured,
      senderEmail: SENDER_EMAIL,
      senderName: SENDER_NAME,
      clientUrl: CLIENT_URL,
      features: [
        'sendVerificationEmail',
        'sendPasswordResetEmail',
        'sendBookingConfirmationEmail',
        'sendBookingStatusUpdateEmail',
        'sendEmail',
        'sendTemplateEmail'
      ]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  sendVerification,
  sendPasswordReset,
  sendBookingConfirmation,
  sendBookingStatusUpdate,
  sendCustom,
  testEmail,
  getStatus
};
