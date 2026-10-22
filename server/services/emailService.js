/**
 * emailService.js
 * Production-Ready Brevo (Sendinblue) Transactional Email Service for iMovies
 *
 * Core Features:
 * 1. Base Methods: `sendEmail`, `sendTemplateEmail`
 * 2. High-Level Wrappers:
 *    - `sendVerificationEmail(email, verificationTokenOrLink, userName)`
 *    - `sendPasswordResetEmail(email, resetTokenOrLink, userName)`
 *    - `sendBookingConfirmationEmail(emailOrBookingId, bookingDetails)`
 *    - `sendBookingStatusUpdateEmail(email, statusDetails)`
 * 3. Backward Compatibility: `sendTicketEmail`
 * 4. Resilient error handling (HTTP 429 rate-limiting, network retries)
 * 5. Sanitized HTML rendering to prevent injection
 */

const { brevoClient, SENDER_EMAIL, SENDER_NAME, CLIENT_URL, isConfigured } = require('../config/brevoConfig');
const Booking = require('../models/bookingModel');
const Movie = require('../models/movieModel');
const Theatre = require('../models/theatreModel');
const Show = require('../models/showModel');
const User = require('../models/userModel');

/**
 * Escape user-controlled strings to prevent HTML injection in emails
 */
const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Validate public HTTP/HTTPS URL
 */
const isValidHttpUrl = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

/**
 * Parse recipient input into Brevo format [{ email, name }]
 */
const formatRecipients = (to, defaultName = '') => {
  if (Array.isArray(to)) {
    return to.map((item) => {
      if (typeof item === 'string') {
        return { email: item.trim(), name: defaultName || item.split('@')[0] };
      }
      return {
        email: (item.email || '').trim(),
        name: item.name || defaultName || (item.email || '').split('@')[0]
      };
    });
  }

  if (typeof to === 'string') {
    return [{ email: to.trim(), name: defaultName || to.split('@')[0] }];
  }

  if (to && typeof to === 'object' && to.email) {
    return [{
      email: to.email.trim(),
      name: to.name || defaultName || to.email.split('@')[0]
    }];
  }

  return [];
};

// ============================================================================
// BASE METHODS
// ============================================================================

/**
 * Base method: Send an arbitrary transactional email via Brevo
 *
 * @param {object} options
 * @param {string|Array<object>} options.to - Recipient email or array of recipients
 * @param {string} options.subject - Email subject line
 * @param {string} options.htmlContent - HTML email body
 * @param {string} [options.textContent] - Plain text alternative
 * @param {object} [options.sender] - Custom sender { email, name }
 * @param {object} [options.params] - Dynamic template parameters
 * @param {Array<string>} [options.tags] - Category tags for metrics
 * @param {object} [options.replyTo] - Reply-To address
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, statusCode?: number }>}
 */
const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  sender,
  params,
  tags,
  replyTo
}) => {
  if (!isConfigured()) {
    const errorMsg = 'Brevo email service is not configured (missing BREVO_API_KEY)';
    console.warn(`[emailService.sendEmail] ${errorMsg}`);
    return { success: false, error: errorMsg, statusCode: 503 };
  }

  const recipients = formatRecipients(to);
  if (recipients.length === 0) {
    return { success: false, error: 'Recipient email address is required', statusCode: 400 };
  }

  const senderObj = {
    email: (sender?.email || SENDER_EMAIL).trim(),
    name: sender?.name || SENDER_NAME
  };

  const payload = {
    sender: senderObj,
    to: recipients,
    subject: subject || 'iMovies Notification',
    htmlContent,
    textContent: textContent || undefined,
    params: params || undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    replyTo: replyTo ? { email: replyTo.email, name: replyTo.name } : undefined
  };

  try {
    const response = await brevoClient.transactionalEmails.sendTransacEmail(payload);
    const messageId = response?.messageId || response?.data?.messageId || `brevo_${Date.now()}`;

    console.log(`[emailService] Successfully sent transactional email "${subject}" to ${recipients[0].email} (MessageID: ${messageId})`);
    return {
      success: true,
      messageId,
      data: response
    };
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    const isRateLimited = status === 429;
    const errorDetail =
      error.body?.message ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error sending email via Brevo';

    console.error(`[emailService] Brevo Error (${status}): ${errorDetail}`);

    if (isRateLimited) {
      console.warn('[emailService] Rate limit (HTTP 429) hit on Brevo API. Consider queueing requests.');
    }

    return {
      success: false,
      statusCode: status,
      isRateLimited,
      error: errorDetail
    };
  }
};

/**
 * Base method: Send an email using a pre-configured Brevo template ID
 *
 * @param {object} options
 * @param {string|Array} options.to - Recipient(s)
 * @param {number} options.templateId - Brevo template ID
 * @param {object} [options.params] - Dynamic template variables
 * @param {object} [options.sender] - Custom sender override
 * @param {Array<string>} [options.tags] - Category tags
 * @param {object} [options.replyTo] - Reply-To address
 */
const sendTemplateEmail = async ({
  to,
  templateId,
  params = {},
  sender,
  tags,
  replyTo
}) => {
  if (!templateId || isNaN(Number(templateId))) {
    return { success: false, error: 'A valid numeric Brevo templateId is required', statusCode: 400 };
  }

  if (!isConfigured()) {
    return { success: false, error: 'Brevo email service is not configured', statusCode: 503 };
  }

  const recipients = formatRecipients(to);
  if (recipients.length === 0) {
    return { success: false, error: 'Recipient email address is required', statusCode: 400 };
  }

  const payload = {
    sender: sender ? { email: sender.email, name: sender.name } : { email: SENDER_EMAIL, name: SENDER_NAME },
    to: recipients,
    templateId: Number(templateId),
    params,
    tags: Array.isArray(tags) ? tags : undefined,
    replyTo: replyTo ? { email: replyTo.email, name: replyTo.name } : undefined
  };

  try {
    const response = await brevoClient.transactionalEmails.sendTransacEmail(payload);
    const messageId = response?.messageId || response?.data?.messageId || `brevo_tpl_${Date.now()}`;
    return { success: true, messageId, data: response };
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return {
      success: false,
      statusCode: status,
      error: error.body?.message || error.message || 'Failed to send Brevo template email'
    };
  }
};

// ============================================================================
// DEDICATED HIGH-LEVEL WRAPPER FUNCTIONS
// ============================================================================

/**
 * 1. Account Activation / Verification Email
 *
 * @param {string} email - Recipient user email
 * @param {string} verificationTokenOrLink - Verification token or full URL
 * @param {string} [userName] - User's display name
 */
const sendVerificationEmail = async (email, verificationTokenOrLink, userName = '') => {
  const safeName = escapeHtml(userName || email.split('@')[0]);
  const isLink = verificationTokenOrLink && verificationTokenOrLink.startsWith('http');
  const verifyUrl = isLink
    ? verificationTokenOrLink
    : `${CLIENT_URL}/verify-email?token=${encodeURIComponent(verificationTokenOrLink)}&email=${encodeURIComponent(email)}`;
  const safeUrl = escapeHtml(verifyUrl);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Verify Your iMovies Account</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; }
    .email-container { max-width: 600px; margin: 20px auto; background: #131926; border-radius: 14px; overflow: hidden; border: 1px solid #1f293d; }
    .header { background: linear-gradient(135deg, #e50914 0%, #8b0000 100%); padding: 32px 24px; text-align: center; }
    .content { padding: 32px 28px; }
    .btn { background: #e50914; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; }
    .footer { background: #0a0e17; padding: 24px; text-align: center; border-top: 1px solid #1a2334; color: #64748b; font-size: 12px; }
  </style>
</head>
<body style="background-color: #0b0f19; margin: 0; padding: 20px 10px;">
  <center>
    <table class="email-container" width="100%" style="max-width: 600px; background: #131926; border-radius: 14px; border: 1px solid #1f293d;">
      <tr>
        <td class="header" style="background: linear-gradient(135deg, #e50914 0%, #8b0000 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">🎬 iMovies</h1>
          <p style="margin: 8px 0 0; color: #ffe4e6; font-size: 15px;">Welcome to the Cinema Experience</p>
        </td>
      </tr>
      <tr>
        <td class="content" style="padding: 32px 28px;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Verify Your Email Address</h2>
          <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Hello <strong>${safeName}</strong>,<br><br>
            Thank you for creating an account on iMovies! To activate your profile, book cinema tickets, and access your personalized watchlist, please verify your email address.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeUrl}" class="btn" style="background: #e50914; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; display: inline-block;">
              Activate My Account
            </a>
          </div>
          <p style="margin: 0 0 12px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Or copy and paste this verification URL into your browser:<br>
            <span style="color: #38bdf8; word-break: break-all;">${safeUrl}</span>
          </p>
          <div style="background: rgba(229, 9, 20, 0.08); border-left: 4px solid #e50914; padding: 12px 16px; border-radius: 4px; margin-top: 24px; color: #cbd5e1; font-size: 12px;">
            ⚠️ This link will expire in 24 hours. If you did not create an account on iMovies, please ignore this email.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer" style="background: #0a0e17; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2334;">
          <p style="margin: 0 0 4px;">&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
          <p style="margin: 0;">Questions? Contact us at support@imovies.com</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `;

  const textContent = `
Verify Your iMovies Account
========================================

Hello ${userName || email.split('@')[0]},

Thank you for joining iMovies! Please click the link below to verify your email address and activate your account:

${verifyUrl}

This verification link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

(c) ${new Date().getFullYear()} iMovies Inc.
  `.trim();

  return await sendEmail({
    to: { email, name: userName || email.split('@')[0] },
    subject: '🎬 Verify Your iMovies Account',
    htmlContent,
    textContent,
    tags: ['account-verification', 'auth']
  });
};

/**
 * 2. Password Recovery / Reset Email
 *
 * @param {string} email - Recipient user email
 * @param {string} resetTokenOrLink - Reset token or full URL
 * @param {string} [userName] - User's display name
 */
const sendPasswordResetEmail = async (email, resetTokenOrLink, userName = '') => {
  const safeName = escapeHtml(userName || email.split('@')[0]);
  const isLink = resetTokenOrLink && resetTokenOrLink.startsWith('http');
  const resetUrl = isLink
    ? resetTokenOrLink
    : `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetTokenOrLink)}&email=${encodeURIComponent(email)}`;
  const safeUrl = escapeHtml(resetUrl);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset Your iMovies Password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; }
    .email-container { max-width: 600px; margin: 20px auto; background: #131926; border-radius: 14px; overflow: hidden; border: 1px solid #1f293d; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 2px solid #e50914; padding: 28px 24px; text-align: center; }
    .content { padding: 32px 28px; }
    .btn { background: #e50914; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; }
    .footer { background: #0a0e17; padding: 20px; text-align: center; border-top: 1px solid #1a2334; color: #64748b; font-size: 12px; }
  </style>
</head>
<body style="background-color: #0b0f19; margin: 0; padding: 20px 10px;">
  <center>
    <table class="email-container" width="100%" style="max-width: 600px; background: #131926; border-radius: 14px; border: 1px solid #1f293d;">
      <tr>
        <td class="header" style="background: #151c2a; border-bottom: 2px solid #e50914; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; color: #e50914; font-size: 26px; font-weight: 800;">🎬 iMovies</h1>
          <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">Password Recovery Request</p>
        </td>
      </tr>
      <tr>
        <td class="content" style="padding: 32px 28px;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Reset Your Password</h2>
          <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Hello <strong>${safeName}</strong>,<br><br>
            We received a request to reset the password for your iMovies account. Click the button below to choose a new, secure password.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeUrl}" class="btn" style="background: #e50914; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="margin: 0 0 12px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Or copy and paste this link in your browser:<br>
            <span style="color: #38bdf8; word-break: break-all;">${safeUrl}</span>
          </p>
          <div style="background: rgba(234, 179, 8, 0.08); border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; margin-top: 24px; color: #fef08a; font-size: 12px;">
            🔒 This password reset link is valid for 1 hour. If you did not make this request, your account is safe and no action is needed.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer" style="background: #0a0e17; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2334;">
          <p style="margin: 0 0 4px;">&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `;

  const textContent = `
Reset Your iMovies Password
========================================

Hello ${userName || email.split('@')[0]},

We received a request to reset your iMovies password. Use the link below to set a new password:

${resetUrl}

This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this message.

(c) ${new Date().getFullYear()} iMovies Inc.
  `.trim();

  return await sendEmail({
    to: { email, name: userName || email.split('@')[0] },
    subject: '🔒 Reset Your iMovies Password',
    htmlContent,
    textContent,
    tags: ['password-reset', 'auth']
  });
};

/**
 * 3. Booking Confirmation Receipt Email
 *
 * Supports dual invocation:
 * - Direct: `sendBookingConfirmationEmail(email, bookingDetails)`
 * - Legacy / Idempotent DB: `sendBookingConfirmationEmail(bookingId)`
 *
 * @param {string|object} emailOrBookingId
 * @param {object} [bookingDetails]
 */
const sendBookingConfirmationEmail = async (emailOrBookingId, bookingDetails = null) => {
  // Case A: Called with bookingId string or object that queries MongoDB
  if (!bookingDetails && (typeof emailOrBookingId === 'string' || (emailOrBookingId && emailOrBookingId.bookingId))) {
    const bookingId = typeof emailOrBookingId === 'string' ? emailOrBookingId.trim() : emailOrBookingId.bookingId;
    return await _processDatabaseBookingConfirmation(bookingId);
  }

  // Case B: Direct invocation with (email, bookingDetails)
  const recipientEmail = typeof emailOrBookingId === 'string' ? emailOrBookingId : (bookingDetails?.userEmail || '');
  return await _sendDirectBookingConfirmation(recipientEmail, bookingDetails || {});
};

/**
 * Helper to process database booking confirmation with idempotency
 */
const _processDatabaseBookingConfirmation = async (bookingId) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) {
    return { success: false, skipped: true, error: `Booking not found: ${bookingId}` };
  }

  if (booking.paymentStatus !== 'Completed') {
    return { success: false, skipped: true, reason: `Payment status is ${booking.paymentStatus}` };
  }

  // Idempotency check
  if (booking.confirmationEmailSent === true || booking.confirmationEmailStatus === 'sent') {
    return {
      success: true,
      alreadySent: true,
      messageId: booking.confirmationEmailMessageId,
      message: 'Booking confirmation email was already delivered'
    };
  }

  // Atomic claim
  const claimed = await Booking.findOneAndUpdate(
    {
      bookingId,
      paymentStatus: 'Completed',
      confirmationEmailSent: false,
      confirmationEmailStatus: { $nin: ['sending', 'sent'] }
    },
    { $set: { confirmationEmailStatus: 'sending' } },
    { new: true }
  );

  if (!claimed) {
    const fresh = await Booking.findOne({ bookingId });
    if (fresh && (fresh.confirmationEmailSent || fresh.confirmationEmailStatus === 'sent')) {
      return { success: true, alreadySent: true, messageId: fresh.confirmationEmailMessageId };
    }
    return { success: false, skipped: true, reason: 'Email dispatch already in progress' };
  }

  // Populate metadata
  let customerName = claimed.customerName || '';
  if (!customerName && claimed.userEmail) {
    const user = await User.findOne({ email: claimed.userEmail }).select('username');
    if (user && user.username) customerName = user.username;
  }

  let posterUrl = claimed.posterUrl || '';
  if (!posterUrl && claimed.movieId) {
    const movie = await Movie.findById(claimed.movieId).select('posterUrl');
    if (movie && movie.posterUrl) posterUrl = movie.posterUrl;
  }

  let theatreLocation = '';
  if (claimed.showId) {
    const show = await Show.findOne({ showId: claimed.showId });
    if (show && show.theatreId) {
      const theatre = await Theatre.findOne({ theatreId: show.theatreId }).select('location');
      if (theatre && theatre.location) theatreLocation = theatre.location;
    }
  }

  const details = {
    bookingId: claimed.bookingId,
    movieTitle: claimed.movieName,
    theatreName: claimed.theatreName,
    theatreLocation,
    screen: claimed.screen || 'Screen 1',
    showDate: claimed.showDate,
    showTime: claimed.showTime,
    selectedSeats: claimed.selectedSeats || [],
    totalAmount: claimed.totalAmount,
    paymentId: claimed.razorpayPaymentId || 'N/A',
    paymentStatus: 'Confirmed',
    posterUrl,
    customerName,
    ticketsData: claimed.ticketsData
  };

  const result = await _sendDirectBookingConfirmation(claimed.userEmail, details);

  if (result.success) {
    await Booking.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          confirmationEmailSent: true,
          confirmationEmailStatus: 'sent',
          confirmationEmailSentAt: new Date(),
          confirmationEmailMessageId: result.messageId,
          confirmationEmailError: ''
        }
      }
    );
  } else {
    await Booking.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          confirmationEmailSent: false,
          confirmationEmailStatus: 'failed',
          confirmationEmailError: result.error || 'Brevo dispatch error'
        }
      }
    );
  }

  return result;
};

/**
 * Render and send direct booking confirmation
 */
const _sendDirectBookingConfirmation = async (email, details = {}) => {
  const {
    bookingId = 'N/A',
    movieTitle,
    movieName,
    title,
    theatreName,
    theatre,
    theatreLocation = '',
    screen = 'Screen 1',
    showDate,
    date,
    showTime,
    time,
    selectedSeats = [],
    seatNumbers = [],
    seats = [],
    totalAmount,
    amount,
    paymentId = 'N/A',
    paymentStatus = 'Confirmed',
    posterUrl = '',
    customerName = ''
  } = details;

  const displayMovie = movieTitle || movieName || title || 'Cinema Ticket';
  const displayTheatre = theatreName || theatre || 'iMovies Cinema';
  const displayDate = showDate || date || 'N/A';
  const displayTime = showTime || time || 'N/A';

  let seatList = [];
  if (Array.isArray(selectedSeats) && selectedSeats.length > 0) seatList = selectedSeats;
  else if (Array.isArray(seatNumbers) && seatNumbers.length > 0) seatList = seatNumbers;
  else if (Array.isArray(seats) && seats.length > 0) seatList = seats;

  const seatStr = seatList.length > 0 ? seatList.join(', ') : 'Assigned at entrance';
  const total = totalAmount !== undefined ? totalAmount : (amount !== undefined ? amount : 0);
  const safeName = escapeHtml(customerName || email.split('@')[0]);
  const safeMovie = escapeHtml(displayMovie);
  const safeTheatre = escapeHtml(displayTheatre);
  const safeBookingId = escapeHtml(bookingId);
  const bookingUrl = `${CLIENT_URL}/bookings`;

  const hasPoster = isValidHttpUrl(posterUrl);
  const posterHtml = hasPoster
    ? `<img src="${escapeHtml(posterUrl)}" alt="${safeMovie}" width="120" style="border-radius: 8px; border: 1px solid #334155; display: block; margin-bottom: 16px;">`
    : '';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Booking Confirmed - iMovies</title>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <center>
    <table width="100%" style="max-width: 600px; background: #131926; border-radius: 14px; border: 1px solid #1f293d; overflow: hidden;">
      <tr>
        <td style="background: linear-gradient(135deg, #e50914 0%, #8b0000 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">🎬 iMovies</h1>
          <p style="margin: 8px 0 0; color: #ffe4e6; font-size: 15px;">Booking Confirmation Receipt</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 28px;">
          <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 15px;">
            Hello <strong>${safeName}</strong>, your movie tickets are officially confirmed!
          </p>

          <div style="background: #0d121d; border: 2px dashed #2b3952; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table width="100%">
              <tr>
                <td style="color: #4ade80; font-weight: 700; font-size: 12px; text-transform: uppercase;">
                  ● ${escapeHtml(paymentStatus)}
                </td>
                <td align="right" style="color: #38bdf8; font-family: monospace; font-size: 14px; font-weight: 700;">
                  ID: ${safeBookingId}
                </td>
              </tr>
            </table>

            <div style="margin: 16px 0; text-align: center;">
              ${posterHtml}
              <h2 style="margin: 0 0 6px; color: #ffffff; font-size: 22px;">${safeMovie}</h2>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">${safeTheatre}${theatreLocation ? ` &bull; ${escapeHtml(theatreLocation)}` : ''}</p>
              <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">${escapeHtml(screen)}</p>
            </div>

            <table width="100%" style="border-top: 1px solid #1e293b; padding-top: 12px;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Date & Time:</td>
                <td align="right" style="padding: 6px 0; color: #ffffff; font-weight: 600; font-size: 13px;">${escapeHtml(displayDate)} at ${escapeHtml(displayTime)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Seats Reserved:</td>
                <td align="right" style="padding: 6px 0; color: #ffffff; font-weight: 700; font-size: 14px;"><span style="background: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 4px;">${escapeHtml(seatStr)}</span></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Transaction ID:</td>
                <td align="right" style="padding: 6px 0; color: #cbd5e1; font-family: monospace; font-size: 12px;">${escapeHtml(paymentId)}</td>
              </tr>
              <tr style="border-top: 2px solid #334155;">
                <td style="padding-top: 10px; color: #ffffff; font-weight: 700; font-size: 15px;">Total Amount Paid:</td>
                <td align="right" style="padding-top: 10px; color: #22c55e; font-weight: 800; font-size: 18px;">₹${Number(total).toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(bookingUrl)}" style="background: #e50914; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
              View Digital Ticket
            </a>
          </div>

          <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center;">
            Please arrive at the theatre 15 minutes before showtime. Present this confirmation or your Booking ID at the entrance.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background: #0a0e17; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2334;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} iMovies Cinema Experience. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `;

  const textContent = `
Your iMovies Ticket Booking is Confirmed!
========================================

Booking ID: ${bookingId}
Movie:      ${displayMovie}
Theatre:    ${displayTheatre}
Screen:     ${screen}
Date/Time:  ${displayDate} at ${displayTime}
Seats:      ${seatStr}
Total Paid: INR ${total}
Payment ID: ${paymentId}

View details & print ticket: ${bookingUrl}

Please arrive 15 minutes before showtime.
(c) ${new Date().getFullYear()} iMovies Inc.
  `.trim();

  return await sendEmail({
    to: { email, name: customerName || email.split('@')[0] },
    subject: `🍿 Your iMovies Ticket Booking is Confirmed! [${bookingId}]`,
    htmlContent,
    textContent,
    tags: ['booking-confirmation', 'tickets']
  });
};

/**
 * 4. Booking Status Update Email (e.g. Confirmed, Modified, Cancelled, Refunded)
 *
 * @param {string} email - Recipient user email
 * @param {object} statusDetails - Status notification payload
 */
const sendBookingStatusUpdateEmail = async (email, statusDetails = {}) => {
  const {
    bookingId = 'N/A',
    movieTitle = 'Movie Experience',
    status = 'Updated',
    message = '',
    theatreName = 'iMovies Cinema',
    showDate = '',
    showTime = '',
    refundAmount = null,
    refundId = null
  } = statusDetails;

  const safeStatus = escapeHtml(status.toUpperCase());
  const safeBookingId = escapeHtml(bookingId);
  const safeMovie = escapeHtml(movieTitle);
  const safeMsg = escapeHtml(message || `Your booking status has been updated to "${status}".`);

  let statusColor = '#3b82f6'; // blue default
  if (status.toLowerCase().includes('cancel') || status.toLowerCase().includes('fail')) {
    statusColor = '#ef4444'; // red
  } else if (status.toLowerCase().includes('confirm') || status.toLowerCase().includes('complete')) {
    statusColor = '#22c55e'; // green
  } else if (status.toLowerCase().includes('refund')) {
    statusColor = '#f59e0b'; // amber
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Booking Status Update - iMovies</title>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <center>
    <table width="100%" style="max-width: 600px; background: #131926; border-radius: 14px; border: 1px solid #1f293d; overflow: hidden;">
      <tr>
        <td style="background: #151c2a; border-bottom: 2px solid ${statusColor}; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; color: #e50914; font-size: 26px; font-weight: 800;">🎬 iMovies</h1>
          <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">Booking Status Notification</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 32px 28px;">
          <div style="display: inline-block; background: ${statusColor}22; border: 1px solid ${statusColor}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; margin-bottom: 16px;">
            STATUS: ${safeStatus}
          </div>
          <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px;">${safeMovie}</h2>
          <p style="margin: 0 0 20px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            ${safeMsg}
          </p>

          <div style="background: #0d121d; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #232e42;">
            <table width="100%">
              <tr>
                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Booking ID:</td>
                <td align="right" style="color: #38bdf8; font-family: monospace; font-size: 13px; font-weight: 700;">${safeBookingId}</td>
              </tr>
              ${theatreName ? `
              <tr>
                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Theatre:</td>
                <td align="right" style="color: #ffffff; font-size: 13px;">${escapeHtml(theatreName)}</td>
              </tr>` : ''}
              ${showDate ? `
              <tr>
                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Showtime:</td>
                <td align="right" style="color: #ffffff; font-size: 13px;">${escapeHtml(showDate)} ${showTime ? 'at ' + escapeHtml(showTime) : ''}</td>
              </tr>` : ''}
              ${refundAmount !== null ? `
              <tr>
                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Refund Amount:</td>
                <td align="right" style="color: #22c55e; font-weight: 700; font-size: 14px;">₹${Number(refundAmount).toLocaleString('en-IN')}</td>
              </tr>` : ''}
              ${refundId ? `
              <tr>
                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Refund ID:</td>
                <td align="right" style="color: #cbd5e1; font-family: monospace; font-size: 12px;">${escapeHtml(refundId)}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${CLIENT_URL}/bookings" style="background: #e50914; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
              View My Bookings
            </a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background: #0a0e17; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2334;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `;

  const textContent = `
iMovies Booking Status Update: ${status}
========================================

Booking ID: ${bookingId}
Movie:      ${movieTitle}
Status:     ${status}

${message || `Your booking status has been updated to "${status}".`}

${refundAmount ? `Refund Amount: INR ${refundAmount}\n` : ''}${refundId ? `Refund Reference: ${refundId}\n` : ''}
View your bookings: ${CLIENT_URL}/bookings

(c) ${new Date().getFullYear()} iMovies Inc.
  `.trim();

  return await sendEmail({
    to: { email, name: email.split('@')[0] },
    subject: `🔔 Booking Update: ${movieTitle} [${status}]`,
    htmlContent,
    textContent,
    tags: ['booking-status', 'update']
  });
};

/**
 * Backward compatibility wrapper for legacy callers
 */
const sendTicketEmail = async (userEmail, ticketDetails = {}) => {
  if (ticketDetails && ticketDetails.bookingId) {
    return await sendBookingConfirmationEmail(ticketDetails.bookingId, ticketDetails);
  }
  return await sendBookingConfirmationEmail(userEmail, ticketDetails);
};

module.exports = {
  brevoClient,
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail,
  sendTicketEmail,
  escapeHtml,
  isValidHttpUrl
};
