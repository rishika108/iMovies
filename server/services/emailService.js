/**
 * emailService.js
 * Production-Ready Transactional Email Service for iMovies powered by Brevo (Sendinblue)
 */

const { BrevoClient } = require('@getbrevo/brevo');
const emailConfig = require('../config/emailConfig');

// Initialize Brevo Client only when API key is present
let brevoClient = null;
if (emailConfig.isConfigured && emailConfig.BREVO_API_KEY) {
  try {
    brevoClient = new BrevoClient({ apiKey: emailConfig.BREVO_API_KEY });
    console.log('[emailService] ✅ Brevo Transactional Email client initialized.');
  } catch (err) {
    console.warn('[emailService] ⚠️  Failed to initialize Brevo client:', err.message);
  }
} else {
  console.warn('[emailService] ⚠️  Brevo client not initialized — BREVO_API_KEY missing. Email sending is disabled.');
}

/**
 * No-op stub returned when email service is not configured.
 * Logs a warning but does NOT throw — application continues safely.
 */
const emailDisabledResult = (context) => {
  console.warn(`[emailService] ⚠️  Email skipped (${context}): BREVO_API_KEY not configured.`);
  return { success: false, error: 'Email service not configured. Set BREVO_API_KEY in your environment.' };
};

/**
 * Helper to normalize recipients into array of { email, name }
 */
const normalizeRecipients = (to) => {
  if (!to) return [];
  if (Array.isArray(to)) {
    return to.map((item) => (typeof item === 'string' ? { email: item } : item));
  }
  if (typeof to === 'string') {
    return [{ email: to }];
  }
  if (typeof to === 'object' && to.email) {
    return [to];
  }
  return [];
};

/**
 * Handle and structure errors from Brevo SDK
 */
const handleBrevoError = (error, context = '') => {
  const status = error.statusCode || error.status || (error.response ? error.response.status : null);
  const body = error.body || (error.response ? error.response.body : null);
  const message = error.message || 'Unknown Brevo error';

  if (status === 429) {
    console.error(`[emailService Rate Limit 429] ${context}: Brevo API rate limit exceeded. Please backoff requests.`, body);
  } else if (status === 401 || status === 403) {
    console.error(`[emailService Auth ${status}] ${context}: Invalid Brevo API Key or unauthorized sender.`, body);
  } else if (status === 400) {
    console.error(`[emailService Bad Request 400] ${context}: Invalid email payload parameters.`, body);
  } else {
    console.error(`[emailService Failure] ${context}: ${message}`, body || error);
  }

  return {
    success: false,
    status,
    error: message,
    details: body
  };
};

/**
 * Base Method: sendEmail
 * Sends a transactional email using raw HTML or text content
 */
const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  params = {},
  tags = ['transactional'],
  retryCount = 1
}) => {
  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) {
    console.warn('[emailService] sendEmail aborted: No recipients specified.');
    return { success: false, error: 'Recipient email is required' };
  }

  if (!brevoClient) {
    return emailDisabledResult(`sendEmail to ${Array.isArray(to) ? to[0]?.email || to[0] : to}`);
  }

  // Construct payload strictly conforming to Brevo v6 API requirements
  const payload = {
    sender: {
      name: emailConfig.SENDER_NAME,
      email: emailConfig.SENDER_EMAIL
    },
    replyTo: {
      name: emailConfig.SENDER_NAME,
      email: emailConfig.SENDER_EMAIL
    },
    to: recipients,
    subject: subject || 'Notification from iMovies'
  };

  if (htmlContent) {
    payload.htmlContent = htmlContent;
  }

  if (textContent && typeof textContent === 'string' && textContent.trim().length > 0) {
    payload.textContent = textContent.trim();
  } else if (!htmlContent) {
    payload.textContent = 'Notification from iMovies';
  }

  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    payload.params = params;
  }

  if (Array.isArray(tags) && tags.length > 0) {
    payload.tags = tags;
  }

  try {
    const response = await brevoClient.transactionalEmails.sendTransacEmail(payload);
    const messageId = response?.messageId || response?.messageIds?.[0] || 'sent';
    console.log(`[emailService] Transactional email sent to [${recipients.map((r) => r.email).join(', ')}] | MessageID: ${messageId}`);
    return { success: true, messageId, response };
  } catch (error) {
    // Retry once on transient network errors (e.g. 5xx or network timeout, excluding 400/401/403)
    const status = error.statusCode || error.status;
    if (retryCount > 0 && (!status || status >= 500)) {
      console.warn(`[emailService] Retrying sendEmail to [${recipients[0]?.email}] due to transient error...`);
      await new Promise((res) => setTimeout(res, 1000));
      return sendEmail({ to, subject, htmlContent, textContent, params, tags, retryCount: retryCount - 1 });
    }
    return handleBrevoError(error, `sendEmail to ${recipients[0]?.email}`);
  }
};

/**
 * Base Method: sendTemplateEmail
 * Sends an email using a registered Brevo template ID
 */
const sendTemplateEmail = async ({ to, templateId, params = {}, tags = ['template'] }) => {
  const recipients = normalizeRecipients(to);
  if (recipients.length === 0 || !templateId) {
    return { success: false, error: 'Recipient and templateId are required' };
  }

  if (!brevoClient) {
    return emailDisabledResult(`sendTemplateEmail #${templateId}`);
  }

  try {
    const response = await brevoClient.transactionalEmails.sendTransacEmail({
      sender: { name: emailConfig.SENDER_NAME, email: emailConfig.SENDER_EMAIL },
      to: recipients,
      templateId: Number(templateId),
      params,
      tags
    });
    return { success: true, messageId: response?.messageId, response };
  } catch (error) {
    return handleBrevoError(error, `sendTemplateEmail #${templateId}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL FEATURE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper: sendVerificationEmail
 * Sends account activation email containing both:
 * 1. An instant 6-digit OTP code to enter in the application window
 * 2. A direct one-click verification link
 */
const sendVerificationEmail = async (email, { username = 'Movie Fan', verificationToken, verificationLink, otp }) => {
  const clientBase = emailConfig.CLIENT_URL;
  const link = verificationLink || `${clientBase}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your iMovies Account</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c14; margin: 0; padding: 24px; color: #f8fafc; }
        .wrapper { max-width: 580px; margin: 0 auto; background: #111726; border-radius: 16px; overflow: hidden; border: 1px solid #243048; box-shadow: 0 20px 40px rgba(0,0,0,0.7); }
        .header { background: linear-gradient(135deg, #e50914 0%, #87060d 100%); padding: 32px 24px; text-align: center; }
        .logo { font-size: 32px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 1px; }
        .sublogo { color: #fecdd3; font-size: 14px; margin-top: 6px; font-weight: 500; }
        .body { padding: 32px 28px; }
        h2 { font-size: 22px; color: #ffffff; margin-top: 0; margin-bottom: 12px; font-weight: 700; }
        p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
        .otp-container { background: #0a0e1a; border: 2px dashed #e50914; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: 8px; margin: 6px 0; }
        .otp-note { color: #ef4444; font-size: 12px; font-weight: 600; }
        .divider { text-align: center; margin: 28px 0; position: relative; }
        .divider::before { content: ""; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #233048; }
        .divider span { background: #111726; position: relative; padding: 0 16px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
        .btn-wrapper { text-align: center; margin: 24px 0 12px; }
        .btn { display: inline-block; background: #e50914; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 20px rgba(229,9,20,0.4); }
        .footer { background: #090d16; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2336; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="logo">🎬 iMovies</div>
          <div class="sublogo">Cinema Ticketing & Live Movie Experiences</div>
        </div>
        <div class="body">
          <h2>Welcome aboard, ${username}!</h2>
          <p>Thank you for signing up for iMovies. To complete your registration and secure your cinema account, please authenticate using the One-Time Password (OTP) below:</p>

          <div class="otp-container">
            <div class="otp-label">Your Account Verification OTP</div>
            <div class="otp-code">${otp || '123456'}</div>
            <div class="otp-note">⏱ Valid for the next 15 minutes</div>
          </div>

          <div class="divider">
            <span>OR CLICK DIRECT LINK</span>
          </div>

          <div class="btn-wrapper">
            <a href="${link}" class="btn" target="_blank">Verify My Account Instantly</a>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 20px;">
            If you did not sign up for iMovies, please ignore this email safely.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🔐 Your iMovies Verification Code: ${otp || ''} (Action Required)`,
    htmlContent,
    textContent: `Welcome to iMovies! Your verification OTP is: ${otp}. Or verify here: ${link}`,
    tags: ['auth', 'verification']
  });
};

/**
 * Wrapper: sendPasswordResetEmail
 * Sends a secure password recovery email containing:
 * 1. A 6-digit OTP code to enter on the reset screen
 * 2. A direct secure reset link
 */
const sendPasswordResetEmail = async (email, { username = 'Movie Lover', resetToken, resetLink, otp }) => {
  const clientBase = emailConfig.CLIENT_URL;
  const link = resetLink || `${clientBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your iMovies Password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c14; margin: 0; padding: 24px; color: #f8fafc; }
        .wrapper { max-width: 580px; margin: 0 auto; background: #111726; border-radius: 16px; overflow: hidden; border: 1px solid #243048; box-shadow: 0 20px 40px rgba(0,0,0,0.7); }
        .header { background: linear-gradient(135deg, #0284c7 0%, #034468 100%); padding: 32px 24px; text-align: center; }
        .logo { font-size: 32px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 1px; }
        .sublogo { color: #bae6fd; font-size: 14px; margin-top: 6px; font-weight: 500; }
        .body { padding: 32px 28px; }
        h2 { font-size: 22px; color: #ffffff; margin-top: 0; margin-bottom: 12px; font-weight: 700; }
        p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
        .otp-container { background: #0a0e1a; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: 8px; margin: 6px 0; }
        .otp-note { color: #38bdf8; font-size: 12px; font-weight: 600; }
        .btn-wrapper { text-align: center; margin: 24px 0 12px; }
        .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 20px rgba(2,132,199,0.4); }
        .security-alert { background: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; color: #fca5a5; font-size: 13px; line-height: 1.5; margin-top: 24px; }
        .footer { background: #090d16; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2336; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="logo">🎬 iMovies Security</div>
          <div class="sublogo">Password Recovery Request</div>
        </div>
        <div class="body">
          <h2>Hi ${username},</h2>
          <p>We received a request to reset the password for your iMovies account. Use the 6-digit recovery OTP below to proceed:</p>

          <div class="otp-container">
            <div class="otp-label">Your Password Reset OTP</div>
            <div class="otp-code">${otp || '987654'}</div>
            <div class="otp-note">⏱ Valid for 15 minutes</div>
          </div>

          <div class="btn-wrapper">
            <a href="${link}" class="btn" target="_blank">Reset Password via Link</a>
          </div>

          <div class="security-alert">
            🛡️ <strong>Security Notice:</strong> If you did not initiate this password reset, please ignore this email. Your existing credentials remain completely secure.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🔑 Your iMovies Password Reset Code: ${otp || ''}`,
    htmlContent,
    textContent: `Hi ${username}, your password reset OTP is ${otp}. Or visit: ${link}`,
    tags: ['auth', 'password-reset']
  });
};

/**
 * Wrapper: sendBookingConfirmationEmail (also exported as sendTicketEmail)
 * Sends a full cinema e-ticket confirmation with styling, details, seats, and simulated QR pass.
 */
const sendBookingConfirmationEmail = async (userEmail, ticketDetails = {}) => {
  if (!userEmail) {
    console.warn('[emailService] No recipient email specified for ticket confirmation');
    return { success: false, error: 'Recipient email is required' };
  }

  const {
    bookingId = 'N/A',
    movieTitle,
    movieName,
    title,
    theatre,
    theatreName,
    showDate,
    date,
    showTime,
    showtime,
    time,
    seatNumbers,
    selectedSeats,
    seats,
    totalAmount,
    amount
  } = ticketDetails;

  const displayMovie = movieTitle || movieName || title || 'Cinema Blockbuster';
  const displayTheatre = theatre || theatreName || 'iMovies Cinema Multiplex';
  const displayDate = showDate || date || 'N/A';
  const displayTime = showTime || showtime || time || 'N/A';

  // Format seat numbers
  let displaySeats = 'N/A';
  if (Array.isArray(seatNumbers)) {
    displaySeats = seatNumbers.join(', ');
  } else if (Array.isArray(selectedSeats)) {
    displaySeats = selectedSeats.join(', ');
  } else if (Array.isArray(seats)) {
    displaySeats = seats.join(', ');
  } else if (seatNumbers || selectedSeats || seats) {
    displaySeats = String(seatNumbers || selectedSeats || seats);
  }

  const displayAmount = totalAmount !== undefined
    ? Number(totalAmount).toLocaleString('en-IN')
    : (amount !== undefined ? Number(amount).toLocaleString('en-IN') : '0');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - iMovies</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c14; margin: 0; padding: 24px; color: #f8fafc; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #111726; border-radius: 16px; overflow: hidden; border: 1px solid #243048; box-shadow: 0 20px 40px rgba(0,0,0,0.7); }
        .header { background: linear-gradient(135deg, #e50914 0%, #87060d 100%); padding: 36px 24px; text-align: center; }
        .brand { font-size: 32px; font-weight: 800; color: #ffffff; margin: 0; }
        .subbrand { color: #fecdd3; font-size: 14px; margin-top: 6px; font-weight: 500; }
        .content { padding: 32px 28px; }
        .ticket { background: #0a0e1a; border: 2px dashed #3a4763; border-radius: 12px; padding: 24px; margin-bottom: 24px; position: relative; }
        .badge { display: inline-block; background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid #22c55e; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
        .movie-title { margin: 0 0 18px; font-size: 24px; font-weight: 800; color: #ffffff; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .table td { padding: 10px 0; border-bottom: 1px solid #1e283d; vertical-align: top; }
        .label { color: #8b9bb4; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; width: 40%; }
        .val { color: #f8fafc; font-size: 15px; font-weight: 600; text-align: right; width: 60%; }
        .seats-pill { background: #e50914; color: #ffffff; padding: 4px 12px; border-radius: 6px; display: inline-block; font-weight: 700; }
        .total-val { color: #22c55e; font-size: 22px; font-weight: 800; }
        .barcode-box { background: #131926; border-radius: 8px; padding: 16px; margin-top: 18px; border: 1px solid #253147; text-align: center; }
        .barcode-label { color: #8b9bb4; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .booking-id { color: #38bdf8; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 800; letter-spacing: 2px; margin: 6px 0; }
        .instructions { background: rgba(229,9,20,0.08); border-left: 4px solid #e50914; padding: 14px 16px; border-radius: 4px; color: #cbd5e1; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
        .footer { background: #090d16; padding: 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1a2336; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="brand">🎬 iMovies Cinema Pass</div>
          <div class="subbrand">Official Digital Ticket & Booking Receipt</div>
        </div>
        <div class="content">
          <div class="ticket">
            <span class="badge">● Confirmed & Verified</span>
            <div class="movie-title">${displayMovie}</div>

            <table class="table">
              <tr>
                <td class="label">Theatre</td>
                <td class="val">${displayTheatre}</td>
              </tr>
              <tr>
                <td class="label">Show Date</td>
                <td class="val">${displayDate}</td>
              </tr>
              <tr>
                <td class="label">Show Time</td>
                <td class="val">${displayTime}</td>
              </tr>
              <tr>
                <td class="label">Reserved Seats</td>
                <td class="val"><span class="seats-pill">${displaySeats}</span></td>
              </tr>
              <tr>
                <td class="label" style="font-weight: 700; color: #ffffff;">Amount Paid</td>
                <td class="val total-val">₹${displayAmount}</td>
              </tr>
            </table>

            <div class="barcode-box">
              <div class="barcode-label">Booking Reference Number</div>
              <div class="booking-id">${bookingId}</div>
              <div class="barcode-label" style="margin-top: 4px;">Present this digital ticket at the cinema gate for direct entry</div>
            </div>
          </div>

          <div class="instructions">
            📌 <strong>Entry Guidelines:</strong> Please arrive 15 minutes prior to showtime. You may present this digital ticket on your smartphone directly at the theatre scanner or counter.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Entertainment. Powered by Brevo Transactional Email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `🍿 Ticket Confirmed: ${displayMovie} [${bookingId}]`,
    htmlContent,
    textContent: `Your ticket for ${displayMovie} is confirmed! Booking ID: ${bookingId}, Seats: ${displaySeats}, Amount: ₹${displayAmount}.`,
    tags: ['booking', 'confirmation']
  });
};

/**
 * Wrapper: sendBookingStatusUpdateEmail
 * Notifies customer of changes to their booking status (e.g. Refunded, Cancelled, Rescheduled)
 */
const sendBookingStatusUpdateEmail = async (email, statusDetails = {}) => {
  const {
    bookingId = 'N/A',
    movieName = 'Your Movie',
    status = 'Updated',
    refundAmount,
    reason = 'Administrative update',
    releasedSeats = []
  } = statusDetails;

  const isRefunded = String(status).toLowerCase().includes('refund');
  const isCancelled = String(status).toLowerCase().includes('cancel');

  const statusColor = isRefunded ? '#ef4444' : (isCancelled ? '#f59e0b' : '#3b82f6');
  const seatsText = Array.isArray(releasedSeats) ? releasedSeats.join(', ') : String(releasedSeats || '');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Booking Status Update - iMovies</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c14; margin: 0; padding: 24px; color: #f8fafc; }
        .wrapper { max-width: 580px; margin: 0 auto; background: #111726; border-radius: 16px; overflow: hidden; border: 1px solid #243048; }
        .header { background: #1e293b; padding: 28px 24px; text-align: center; }
        .brand { font-size: 28px; font-weight: 800; color: #ffffff; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}; font-weight: 700; padding: 6px 14px; border-radius: 20px; font-size: 13px; text-transform: uppercase; margin-bottom: 16px; }
        h2 { color: #ffffff; font-size: 20px; margin: 0 0 16px; }
        p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .info-card { background: #0a0e1a; border-radius: 10px; padding: 18px; border: 1px solid #233048; margin: 20px 0; }
        .footer { background: #090d16; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="brand">🎬 iMovies Update</div>
        </div>
        <div class="body">
          <span class="badge">Status: ${status}</span>
          <h2>Update on Booking #${bookingId}</h2>
          <p>This is an automated notification regarding your ticket reservation for <strong>${movieName}</strong>.</p>

          <div class="info-card">
            <p style="margin: 4px 0;"><strong>Booking Reference:</strong> ${bookingId}</p>
            ${refundAmount ? `<p style="margin: 4px 0; color: #22c55e;"><strong>Refund Amount:</strong> ₹${Number(refundAmount).toLocaleString('en-IN')}</p>` : ''}
            ${seatsText ? `<p style="margin: 4px 0;"><strong>Seats Released:</strong> ${seatsText}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Reason / Note:</strong> ${reason}</p>
          </div>

          <p>If you have any questions about this update or need assistance, our support team is available 24/7.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🔔 Booking Update: ${movieName} [${status}]`,
    htmlContent,
    textContent: `Your booking #${bookingId} for ${movieName} has been marked as ${status}.`,
    tags: ['booking', 'status-update']
  });
};

module.exports = {
  brevoClient,
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendTicketEmail: sendBookingConfirmationEmail, // Backwards compatible alias
  sendBookingStatusUpdateEmail
};
