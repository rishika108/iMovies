/**
 * mailer.js
 * Centralized Mail Utility Service for iMovies
 * Supports Nodemailer Gmail SMTP and Brevo with Dev Mode OTP Fallback
 */

const nodemailer = require('nodemailer');
const {
  sendVerificationEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail
} = require('../services/emailService');

const isConfigured = (val) => {
  if (!val || typeof val !== 'string') return false;
  const lower = val.trim().toLowerCase();
  return (
    lower.length > 5 &&
    !lower.includes('your_') &&
    !lower.includes('your-') &&
    !lower.includes('example.com')
  );
};

// Safe nodemailer transporter with timeout configuration
let transporter = null;
if (isConfigured(process.env.EMAIL_USER) && isConfigured(process.env.EMAIL_PASS)) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_PASS.trim()
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });
  } catch (err) {
    console.warn('[mailer.js] Could not initialize nodemailer transporter:', err.message);
  }
}

/**
 * Send booking confirmation email with styled HTML ticket details
 * @param {string} to - Recipient email
 * @param {object} bookingDetails - Booking information
 */
const sendBookingConfirmation = async (to, bookingDetails) => {
  return sendBookingConfirmationEmail(to, bookingDetails);
};

/**
 * Send reminder email for upcoming show
 * @param {string} to - Recipient email
 * @param {object} showDetails - Show and booking information
 */
const sendReminder = async (to, showDetails) => {
  const {
    movieName,
    theatreName,
    showDate,
    showTime,
    selectedSeats,
    seats
  } = showDetails;

  const displayMovie = movieName || 'Movie';
  const displayTheatre = theatreName || 'iMovies Cinema';
  const displaySeats = Array.isArray(selectedSeats)
    ? selectedSeats.join(', ')
    : (seats || 'N/A');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your show starts soon! - iMovies</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0f172a;
          margin: 0;
          padding: 24px;
          color: #f8fafc;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #1e293b;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          border: 1px solid #334155;
        }
        .header {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          padding: 30px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          color: #ffffff;
        }
        .header p {
          margin: 8px 0 0;
          color: #fef3c7;
          font-size: 15px;
        }
        .content {
          padding: 30px 24px;
        }
        .details-box {
          background: #0f172a;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #334155;
          margin-bottom: 20px;
        }
        .item {
          margin-bottom: 12px;
        }
        .item:last-child {
          margin-bottom: 0;
        }
        .label {
          color: #94a3b8;
          font-size: 13px;
          text-transform: uppercase;
        }
        .val {
          color: #f1f5f9;
          font-size: 16px;
          font-weight: 600;
          margin-top: 4px;
        }
        .notice {
          background: rgba(245, 158, 11, 0.1);
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 4px;
          color: #fde68a;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #64748b;
          font-size: 13px;
          background: #111827;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your show starts soon!</h1>
          <p>Get ready for an exciting cinematic experience</p>
        </div>
        <div class="content">
          <div class="details-box">
            <div class="item">
              <div class="label">Movie</div>
              <div class="val" style="color: #fbbf24; font-size: 20px;">${displayMovie}</div>
            </div>
            <div class="item">
              <div class="label">Theatre</div>
              <div class="val">${displayTheatre}</div>
            </div>
            <div class="item">
              <div class="label">Show Date & Time</div>
              <div class="val">${showDate} at ${showTime}</div>
            </div>
            <div class="item">
              <div class="label">Seats</div>
              <div class="val" style="color: #38bdf8;">${displaySeats}</div>
            </div>
          </div>
          <div class="notice">
            Please arrive at the theatre at least 15-20 minutes before the scheduled showtime to ensure smooth entry and seating.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`[mailer.js] Simulated reminder email to ${to} for show: ${displayMovie}`);
    return { success: true, simulated: true };
  }

  const mailOptions = {
    from: `"iMovies" <${process.env.EMAIL_USER || 'no-reply@imovies.com'}>`,
    to,
    subject: `Your show starts soon! - ${displayMovie}`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  sendBookingConfirmation,
  sendReminder,
  sendVerificationEmail,
  sendOtpEmail,
  sendPasswordResetEmail
};
