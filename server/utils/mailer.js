const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'admin2209verma@gmail.com',
    pass: process.env.EMAIL_PASS || 'Ritik@0922'
  }
});

/**
 * Send booking confirmation email with styled HTML ticket details
 * @param {string} to - Recipient email
 * @param {object} bookingDetails - Booking information
 */
const sendBookingConfirmation = async (to, bookingDetails) => {
  const {
    bookingId,
    movieName,
    movie,
    theatreName,
    showDate,
    showTime,
    selectedSeats,
    seats,
    totalAmount,
    amount
  } = bookingDetails;

  const displayMovie = movieName || movie || 'Movie';
  const displaySeats = Array.isArray(selectedSeats)
    ? selectedSeats.join(', ')
    : (seats || 'N/A');
  const displayAmount = totalAmount !== undefined ? totalAmount : (amount !== undefined ? amount : 0);
  const displayTheatre = theatreName || 'iMovies Cinema';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - iMovies</title>
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
          background: linear-gradient(135deg, #e11d48, #be123c);
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          color: #ffffff;
          letter-spacing: 1px;
        }
        .header p {
          margin: 8px 0 0;
          color: #ffe4e6;
          font-size: 15px;
        }
        .content {
          padding: 32px 24px;
        }
        .ticket-card {
          background: #0f172a;
          border: 2px dashed #475569;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .ticket-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #1e293b;
        }
        .ticket-row:last-child {
          border-bottom: none;
        }
        .label {
          color: #94a3b8;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .value {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 15px;
          text-align: right;
        }
        .highlight {
          color: #f43f5e;
          font-size: 18px;
          font-weight: 700;
        }
        .seats-badge {
          background-color: #3b82f6;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
          font-weight: 600;
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
          <h1>iMovies</h1>
          <p>Booking Confirmed! Enjoy your movie experience.</p>
        </div>
        <div class="content">
          <div class="ticket-card">
            <div class="ticket-row">
              <span class="label">Booking ID</span>
              <span class="value" style="font-family: monospace; color: #38bdf8;">${bookingId}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Movie</span>
              <span class="value highlight">${displayMovie}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Theatre</span>
              <span class="value">${displayTheatre}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Date</span>
              <span class="value">${showDate}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Show Time</span>
              <span class="value">${showTime}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Seats</span>
              <span class="value"><span class="seats-badge">${displaySeats}</span></span>
            </div>
            <div class="ticket-row" style="margin-top: 8px; border-top: 2px solid #334155; padding-top: 14px;">
              <span class="label" style="font-size: 16px; color: #f1f5f9; font-weight: bold;">Total Amount</span>
              <span class="value" style="font-size: 20px; color: #22c55e;">₹${displayAmount}</span>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0;">
            Please present this booking confirmation or Booking ID at the cinema entrance.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} iMovies Inc. All rights reserved.</p>
          <p>Need help? Contact support@imovies.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"iMovies" <${process.env.EMAIL_USER || 'no-reply@imovies.com'}>`,
    to,
    subject: `Booking Confirmed: ${displayMovie} [${bookingId}]`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
    return { success: false, error: error.message };
  }
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
  sendReminder
};
