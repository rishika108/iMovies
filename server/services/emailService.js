/**
 * emailService.js
 * Automated Email Ticket Confirmation Service for iMovies using Nodemailer & Gmail SMTP
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER || 'admin2209verma@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'Ritik@0922';

/**
 * Reusable Gmail SMTP Transporter
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

/**
 * Sends a cinema e-ticket confirmation email with styled HTML layout
 * @param {string} userEmail - Recipient email address
 * @param {object} ticketDetails - Information about the booked ticket
 * @returns {Promise<object>} Result containing success status and messageId/error
 */
const sendTicketEmail = async (userEmail, ticketDetails = {}) => {
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

  const displayMovie = movieTitle || movieName || title || 'Movie Experience';
  const displayTheatre = theatre || theatreName || 'iMovies Cinema';
  const displayDate = showDate || date || 'N/A';
  const displayTime = showTime || showtime || time || 'N/A';

  // Format seats as comma-separated string
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
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f19;
          margin: 0;
          padding: 24px;
          color: #f1f5f9;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #151a28;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
          border: 1px solid #232d42;
        }
        .header {
          background: linear-gradient(135deg, #e50914 0%, #990008 100%);
          padding: 36px 24px;
          text-align: center;
        }
        .brand-title {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 1px;
        }
        .brand-title span {
          color: #ffffff;
        }
        .sub-header {
          margin: 10px 0 0;
          color: #ffe4e6;
          font-size: 15px;
          font-weight: 500;
        }
        .content {
          padding: 32px 28px;
        }
        .ticket-box {
          background: #0d111b;
          border: 2px dashed #3a4763;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          position: relative;
        }
        .status-badge {
          display: inline-block;
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid #22c55e;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 16px;
        }
        .movie-title {
          margin: 0 0 18px 0;
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.3px;
        }
        .info-grid {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .info-grid td {
          padding: 10px 0;
          border-bottom: 1px solid #1c2436;
          vertical-align: top;
        }
        .info-label {
          color: #8b9bb4;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          width: 40%;
        }
        .info-value {
          color: #f8fafc;
          font-size: 15px;
          font-weight: 600;
          text-align: right;
          width: 60%;
        }
        .seats-pill {
          background: #2563eb;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
          font-weight: 700;
          font-size: 14px;
        }
        .total-row td {
          border-bottom: none;
          padding-top: 16px;
        }
        .total-amount {
          color: #22c55e;
          font-size: 22px;
          font-weight: 800;
        }
        .booking-id-box {
          background: #131926;
          border-radius: 8px;
          padding: 14px 18px;
          margin-top: 16px;
          border: 1px solid #253147;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .booking-id-label {
          color: #8b9bb4;
          font-size: 12px;
          text-transform: uppercase;
        }
        .booking-id-val {
          color: #38bdf8;
          font-family: 'Courier New', Courier, monospace;
          font-size: 16px;
          font-weight: 700;
        }
        .instructions {
          background: rgba(229, 9, 20, 0.08);
          border-left: 4px solid #e50914;
          padding: 14px 16px;
          border-radius: 4px;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .footer {
          background: #0e121d;
          padding: 24px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
          border-top: 1px solid #1a2234;
        }
        .footer p {
          margin: 4px 0;
        }
        .footer a {
          color: #e50914;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Header -->
        <div class="header">
          <h1 class="brand-title">🎬 iMovies</h1>
          <p class="sub-header">Your Cinema Ticket is Confirmed!</p>
        </div>

        <!-- Content -->
        <div class="content">
          <div class="ticket-box">
            <span class="status-badge">● Payment Confirmed</span>
            <h2 class="movie-title">${displayMovie}</h2>

            <table class="info-grid">
              <tr>
                <td class="info-label">Theatre</td>
                <td class="info-value">${displayTheatre}</td>
              </tr>
              <tr>
                <td class="info-label">Show Date</td>
                <td class="info-value">${displayDate}</td>
              </tr>
              <tr>
                <td class="info-label">Show Time</td>
                <td class="info-value">${displayTime}</td>
              </tr>
              <tr>
                <td class="info-label">Reserved Seats</td>
                <td class="info-value"><span class="seats-pill">${displaySeats}</span></td>
              </tr>
              <tr class="total-row">
                <td class="info-label" style="font-size: 15px; color: #ffffff; font-weight: 700;">Total Paid</td>
                <td class="info-value total-amount">₹${displayAmount}</td>
              </tr>
            </table>

            <div class="booking-id-box">
              <span class="booking-id-label">Booking Reference ID:</span>
              <span class="booking-id-val">${bookingId}</span>
            </div>
          </div>

          <div class="instructions">
            📌 <strong>Entry Guidelines:</strong> Please arrive 15 minutes before showtime and present this e-ticket confirmation or your Booking Reference ID at the theatre gate / counter.
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Cinema Experience. All rights reserved.</p>
          <p>Questions? Reach out to our support desk anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"iMovies Ticketing" <${EMAIL_USER}>`,
    to: userEmail,
    subject: `🍿 Ticket Confirmed: ${displayMovie} [${bookingId}]`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[emailService] Ticket confirmation email successfully sent to ${userEmail} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[emailService] Failed to send ticket email to ${userEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  sendTicketEmail
};
