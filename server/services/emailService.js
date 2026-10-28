/**
 * emailService.js
 * Production-Ready Transactional Email Service for iMovies
 * Integrates Nodemailer (Gmail SMTP) & Brevo (Sendinblue) with Dev Mode OTP Fallback
 */

const { BrevoClient } = require('@getbrevo/brevo');
const nodemailer = require('nodemailer');
const emailConfig = require('../config/emailConfig');

/**
 * Check if the application is running in development mode
 */
const isDevMode = () => {
  return process.env.NODE_ENV !== 'production';
};

/**
 * Validate that an email string is formatted and not a placeholder
 */
const isValidConfigString = (val, placeholderKeywords = ['your_', 'your-', 'example.com', 'placeholder']) => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  if (trimmed.length < 5) return false;
  return !placeholderKeywords.some((keyword) => trimmed.includes(keyword));
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. NODEMAILER GMAIL SMTP TRANSPORTER INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
let nodemailerTransporter = null;
const isEmailUserConfigured = isValidConfigString(process.env.EMAIL_USER);
const isEmailPassConfigured = isValidConfigString(process.env.EMAIL_PASS, ['your_', 'app_password', 'password_here']);

if (isEmailUserConfigured && isEmailPassConfigured) {
  try {
    nodemailerTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_PASS.trim()
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });
    console.log(`[emailService] ✅ Nodemailer Gmail SMTP transporter initialized (${process.env.EMAIL_USER.trim()}).`);
  } catch (err) {
    console.warn('[emailService] ⚠️ Failed to initialize Nodemailer transporter:', err.message);
  }
} else {
  console.log('[emailService] ℹ️  EMAIL_USER/EMAIL_PASS not configured with live credentials. (Dev mode OTP fallback will be active).');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BREVO (SENDINBLUE) CLIENT INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
let brevoClient = null;
const isBrevoConfigured = isValidConfigString(emailConfig.BREVO_API_KEY, ['your_', 'api_key_here', 'placeholder']);

if (isBrevoConfigured) {
  try {
    brevoClient = new BrevoClient({ apiKey: emailConfig.BREVO_API_KEY.trim() });
    console.log('[emailService] ✅ Brevo Transactional Email client initialized.');
  } catch (err) {
    console.warn('[emailService] ⚠️ Failed to initialize Brevo client:', err.message);
  }
} else {
  console.log('[emailService] ℹ️  BREVO_API_KEY not configured or placeholder.');
}

/**
 * Helper to normalize recipients into array of { email, name }
 */
const normalizeRecipients = (to) => {
  if (!to) return [];
  if (Array.isArray(to)) {
    return to
      .map((item) => (typeof item === 'string' ? { email: item.trim() } : item))
      .filter((item) => item && item.email);
  }
  if (typeof to === 'string') {
    return [{ email: to.trim() }];
  }
  if (typeof to === 'object' && to.email) {
    return [{ email: to.email.trim(), name: to.name || '' }];
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
    console.error(`[emailService Rate Limit 429] ${context}: Brevo API rate limit exceeded.`, body);
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
 * Sends a transactional email using Nodemailer first, then Brevo
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

  const recipientString = recipients.map((r) => r.email).join(', ');

  // 1. Priority: Nodemailer Gmail SMTP if configured
  if (nodemailerTransporter) {
    try {
      console.log(`[emailService] Dispatching via Nodemailer Gmail SMTP to: ${recipientString}`);
      const info = await nodemailerTransporter.sendMail({
        from: `"${emailConfig.SENDER_NAME || 'iMovies'}" <${process.env.EMAIL_USER}>`,
        to: recipientString,
        subject: subject || 'Notification from iMovies',
        text: textContent || (htmlContent ? htmlContent.replace(/<[^>]+>/g, ' ') : ''),
        html: htmlContent
      });
      console.log(`[emailService] ✅ Email delivered via Nodemailer Gmail SMTP to ${recipientString} (ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, provider: 'nodemailer' };
    } catch (nmErr) {
      console.warn(`[emailService] ⚠️ Nodemailer delivery failed: ${nmErr.message}. Attempting Brevo fallback...`);
    }
  }

  // 2. Secondary: Brevo API if configured
  if (brevoClient) {
    try {
      console.log(`[emailService] Dispatching via Brevo API to: ${recipientString}`);
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

      if (htmlContent) payload.htmlContent = htmlContent;
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

      const response = await brevoClient.transactionalEmails.sendTransacEmail(payload);
      const messageId = response?.messageId || response?.messageIds?.[0] || 'sent';
      console.log(`[emailService] ✅ Email delivered via Brevo API to ${recipientString} (ID: ${messageId})`);
      return { success: true, messageId, response, provider: 'brevo' };
    } catch (error) {
      const status = error.statusCode || error.status;
      if (retryCount > 0 && (!status || status >= 500)) {
        console.warn(`[emailService] Retrying Brevo sendEmail to ${recipientString}...`);
        await new Promise((res) => setTimeout(res, 1000));
        return sendEmail({ to, subject, htmlContent, textContent, params, tags, retryCount: retryCount - 1 });
      }
      return handleBrevoError(error, `sendEmail to ${recipientString}`);
    }
  }

  // Neither Nodemailer nor Brevo was able to send
  const msg = 'No live email provider configured or reachable (Nodemailer / Brevo).';
  console.warn(`[emailService] ⚠️  ${msg} Email to ${recipientString} was not dispatched.`);
  return {
    success: false,
    error: msg,
    provider: 'none'
  };
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
    return { success: false, error: 'Brevo template emails require a valid BREVO_API_KEY.' };
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
 * Print prominent Dev Mode OTP banner in terminal for testing
 */
const logDevModeOtpBanner = (email, otp, actionName = 'Account Verification') => {
  console.log('\n' + '═'.repeat(64));
  console.log(`  🔑 [iMovies Auth] DEV MODE OTP BYPASS ACTIVATED`);
  console.log(`  Action       : ${actionName}`);
  console.log(`  Recipient    : ${email}`);
  console.log(`  DEV MODE OTP : ${otp}`);
  console.log(`  Validity     : 15 minutes`);
  console.log(`  Note         : Use this 6-digit code on the verification screen.`);
  console.log('═'.repeat(64) + '\n');
};

/**
 * Wrapper: sendVerificationEmail
 * Sends account activation email containing both:
 * 1. An instant 6-digit OTP code to enter in the application window
 * 2. A direct one-click verification link
 *
 * Guaranteed to satisfy requirements:
 * - Logs "Sending OTP email to: <email>" before dispatch
 * - In dev mode, logs "DEV MODE OTP: <otp>" if mail dispatch encounters SMTP or network issues
 */
const sendVerificationEmail = async (email, options = {}) => {
  const targetEmail = String(email || '').trim().toLowerCase();

  // Support both (email, { otp, ... }) and (email, otp)
  let otp = '';
  let username = 'Movie Fan';
  let verificationToken = '';
  let verificationLink = '';

  if (typeof options === 'string' || typeof options === 'number') {
    otp = String(options);
  } else if (options && typeof options === 'object') {
    otp = options.otp !== undefined ? String(options.otp) : '';
    if (options.username) username = options.username;
    if (options.verificationToken) verificationToken = options.verificationToken;
    if (options.verificationLink) verificationLink = options.verificationLink;
  }

  // Explicit log before mail dispatch
  console.log('Sending OTP email to:', targetEmail);

  if (!targetEmail) {
    console.error('❌ Failed to send OTP email: Recipient email is missing');
    if (isDevMode()) {
      console.log('DEV MODE OTP:', otp);
    }
    return { success: false, error: 'Recipient email is required' };
  }

  const clientBase = emailConfig.CLIENT_URL || 'http://localhost:5173';
  const link = verificationLink || `${clientBase}/verify-email?token=${verificationToken}&email=${encodeURIComponent(targetEmail)}`;

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

  try {
    const result = await sendEmail({
      to: targetEmail,
      subject: `🔐 Your iMovies Verification Code: ${otp || ''} (Action Required)`,
      htmlContent,
      textContent: `Welcome to iMovies! Your verification OTP is: ${otp}. Or verify here: ${link}`,
      tags: ['auth', 'verification']
    });

    if (result && result.success) {
      console.log('✅ OTP email successfully delivered to:', targetEmail, `(Provider: ${result.provider}, MessageId: ${result.messageId})`);
      return result;
    } else {
      console.error('❌ Failed to deliver OTP email to:', targetEmail, 'Reason:', result?.error || 'Dispatch returned failure');

      // Dev mode fallback bypass
      if (isDevMode()) {
        console.log('DEV MODE OTP:', otp);
        logDevModeOtpBanner(targetEmail, otp, 'Account Verification');
        return {
          success: true,
          devBypass: true,
          devOtp: otp,
          message: 'DEV MODE: OTP logged to console'
        };
      }

      return result;
    }
  } catch (error) {
    console.error('❌ Failed to deliver OTP email to:', targetEmail, 'Exception:', error.message);

    // Dev mode fallback bypass
    if (isDevMode()) {
      console.log('DEV MODE OTP:', otp);
      logDevModeOtpBanner(targetEmail, otp, 'Account Verification');
      return {
        success: true,
        devBypass: true,
        devOtp: otp,
        message: 'DEV MODE: OTP logged to console'
      };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Wrapper: sendPasswordResetEmail
 * Sends a secure password recovery email containing:
 * 1. A 6-digit OTP code to enter on the reset screen
 * 2. A direct secure reset link
 */
const sendPasswordResetEmail = async (email, options = {}) => {
  const targetEmail = String(email || '').trim().toLowerCase();

  // Support both (email, { otp, ... }) and (email, otp)
  let otp = '';
  let username = 'Movie Lover';
  let resetToken = '';
  let resetLink = '';

  if (typeof options === 'string' || typeof options === 'number') {
    otp = String(options);
  } else if (options && typeof options === 'object') {
    otp = options.otp !== undefined ? String(options.otp) : '';
    if (options.username) username = options.username;
    if (options.resetToken) resetToken = options.resetToken;
    if (options.resetLink) resetLink = options.resetLink;
  }

  // Explicit log before mail dispatch
  console.log('Sending OTP email to:', targetEmail);

  if (!targetEmail) {
    console.error('❌ Failed to send reset OTP email: Recipient email is missing');
    if (isDevMode()) {
      console.log('DEV MODE OTP:', otp);
    }
    return { success: false, error: 'Recipient email is required' };
  }

  const clientBase = emailConfig.CLIENT_URL || 'http://localhost:5173';
  const link = resetLink || `${clientBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(targetEmail)}`;

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

  try {
    const result = await sendEmail({
      to: targetEmail,
      subject: `🔑 Your iMovies Password Reset Code: ${otp || ''}`,
      htmlContent,
      textContent: `Hi ${username}, your password reset OTP is ${otp}. Or visit: ${link}`,
      tags: ['auth', 'password-reset']
    });

    if (result && result.success) {
      console.log('✅ Password reset OTP email successfully delivered to:', targetEmail, `(MessageId: ${result.messageId})`);
      return result;
    } else {
      console.error('❌ Failed to deliver password reset OTP to:', targetEmail, 'Reason:', result?.error || 'Dispatch returned failure');

      if (isDevMode()) {
        console.log('DEV MODE OTP:', otp);
        logDevModeOtpBanner(targetEmail, otp, 'Password Reset');
        return {
          success: true,
          devBypass: true,
          devOtp: otp,
          message: 'DEV MODE: Password reset OTP logged to console'
        };
      }

      return result;
    }
  } catch (error) {
    console.error('❌ Failed to deliver password reset OTP to:', targetEmail, 'Exception:', error.message);

    if (isDevMode()) {
      console.log('DEV MODE OTP:', otp);
      logDevModeOtpBanner(targetEmail, otp, 'Password Reset');
      return {
        success: true,
        devBypass: true,
        devOtp: otp,
        message: 'DEV MODE: Password reset OTP logged to console'
      };
    }

    return { success: false, error: error.message };
  }
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
              <div class="barcode-label">Digital Entry Pass Ref</div>
              <div class="booking-id">#${bookingId.toUpperCase()}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Present at cinema box-office counter</div>
            </div>
          </div>

          <div class="instructions">
            <strong>Important Cinema Guidelines:</strong>
            <ul style="margin: 6px 0 0; padding-left: 18px;">
              <li>Please arrive at the multiplex 15 minutes before showtime.</li>
              <li>Outside food and beverages are not allowed inside cinema halls.</li>
              <li>Free cancellation is available up to 2 hours prior to showtime from your iMovies account.</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
          <p>Thank you for choosing iMovies for your cinematic experience!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `🎟️ iMovies Ticket Confirmed: ${displayMovie} [${bookingId}]`,
    htmlContent,
    textContent: `Your booking #${bookingId} for ${displayMovie} at ${displayTheatre} is confirmed! Seats: ${displaySeats}. Total: ₹${displayAmount}.`,
    tags: ['booking', 'confirmation']
  });
};

/**
 * Wrapper: sendBookingStatusUpdateEmail
 * Notifies customer when a booking status changes (e.g. Refunded, Cancelled)
 */
const sendBookingStatusUpdateEmail = async (email, updateDetails = {}) => {
  if (!email) return { success: false, error: 'Recipient email is required' };

  const {
    bookingId = 'N/A',
    movieName = 'Movie',
    status = 'Updated',
    refundAmount,
    reason = 'Administrative update',
    releasedSeats = []
  } = updateDetails;

  const isRefunded = status === 'Refunded';
  const statusColor = isRefunded ? '#22c55e' : '#ef4444';
  const seatsText = Array.isArray(releasedSeats) && releasedSeats.length > 0 ? releasedSeats.join(', ') : '';

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
  nodemailerTransporter,
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendOtpEmail: sendVerificationEmail, // Alias
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendTicketEmail: sendBookingConfirmationEmail, // Backwards compatible alias
  sendBookingStatusUpdateEmail
};
