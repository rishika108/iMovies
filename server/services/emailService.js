/**
 * emailService.js
 * Production-Ready Email Notification System for iMovies using Twilio SendGrid (@sendgrid/mail)
 *
 * Security & Reliability Features:
 * 1. Never hardcodes secrets; reads SENDGRID_API_KEY, EMAIL_FROM, and CLIENT_URL from process.env.
 * 2. Idempotent dispatch: Prevents duplicate confirmation emails across retries, webhooks, or page refreshes.
 * 3. Atomic state transitions: Prevents concurrent race conditions when sending emails.
 * 4. Safe error handling: Delivery errors never compromise or invalidate paid bookings.
 * 5. Sanitized rendering: Strictly escapes user-controlled strings to prevent HTML injection / XSS.
 * 6. Responsive cinema-themed HTML layout with accessible plain-text alternative.
 */

require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const Booking = require('../models/bookingModel');
const Movie = require('../models/movieModel');
const Theatre = require('../models/theatreModel');
const Show = require('../models/showModel');
const User = require('../models/userModel');

// Initialize SendGrid API Key safely
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.trim() : '';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('[emailService] Safe Config Warning: SENDGRID_API_KEY is not configured. Confirmation emails will be handled gracefully without crashing.');
}

/**
 * Cleanly resolve client URL from environment
 */
const getClientBaseUrl = () => {
  const rawUrl = process.env.CLIENT_URL || 'https://i-movies-theta.vercel.app';
  const urls = rawUrl.split(',').map((u) => u.trim()).filter(Boolean);
  const preferred = urls.find((u) => u.startsWith('https://')) || urls[0] || 'https://i-movies-theta.vercel.app';
  return preferred.replace(/\/+$/, '');
};

/**
 * Cleanly resolve sender email address
 */
const getSenderEmail = () => {
  return (process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim()) || 'tickets@imovies.com';
};

/**
 * Escape user-controlled input to prevent HTML injection / XSS in emails
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
 * Validate public HTTP/HTTPS URL for movie poster images
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
 * Build professional, responsive cinema-themed HTML email
 */
const generateTicketHtml = ({
  customerName,
  bookingId,
  movieTitle,
  posterUrl,
  theatreName,
  theatreLocation,
  screen,
  showDate,
  showTime,
  selectedSeats,
  ticketCount,
  itemizedSeats,
  subtotal,
  bookingFee,
  totalAmount,
  paymentId,
  paymentStatus,
  bookingDetailsUrl
}) => {
  const safeCustomerName = escapeHtml(customerName || 'Movie Enthusiast');
  const safeBookingId = escapeHtml(bookingId);
  const safeMovieTitle = escapeHtml(movieTitle || 'Movie Experience');
  const safeTheatre = escapeHtml(theatreName || 'iMovies Cinema');
  const safeLocation = theatreLocation ? escapeHtml(theatreLocation) : '';
  const safeScreen = escapeHtml(screen || 'Screen 1');
  const safeDate = escapeHtml(showDate || 'N/A');
  const safeTime = escapeHtml(showTime || 'N/A');
  const safeSeats = escapeHtml(selectedSeats.join(', '));
  const safePaymentId = escapeHtml(paymentId || 'N/A');
  const safeStatus = escapeHtml(paymentStatus || 'Completed');

  const hasValidPoster = isValidHttpUrl(posterUrl);
  const posterHtml = hasValidPoster
    ? `
      <td width="130" valign="top" style="padding-right: 20px;" class="poster-col">
        <img src="${escapeHtml(posterUrl)}" alt="${safeMovieTitle}" width="130" style="border-radius: 8px; display: block; border: 1px solid #334155; object-fit: cover; max-height: 195px;" />
      </td>
    `
    : '';

  // Generate itemized pricing rows
  let itemizedRowsHtml = '';
  if (Array.isArray(itemizedSeats) && itemizedSeats.length > 0) {
    itemizedRowsHtml = itemizedSeats
      .map(
        (seat) => `
        <tr>
          <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Seat ${escapeHtml(seat.seatId)} (${escapeHtml(seat.tier || 'Standard')})</td>
          <td style="padding: 6px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-weight: 500;">₹${Number(seat.price || 0).toLocaleString('en-IN')}</td>
        </tr>
      `
      )
      .join('');
  } else {
    itemizedRowsHtml = `
      <tr>
        <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Tickets (${ticketCount}x)</td>
        <td style="padding: 6px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-weight: 500;">₹${Number(subtotal).toLocaleString('en-IN')}</td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your iMovies Ticket Booking is Confirmed!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
    }
    @media only screen and (max-width: 620px) {
      .email-wrapper {
        width: 100% !important;
        padding: 12px !important;
      }
      .poster-col {
        display: block !important;
        width: 100% !important;
        padding-right: 0 !important;
        margin-bottom: 16px !important;
        text-align: center !important;
      }
      .poster-col img {
        margin: 0 auto !important;
      }
      .details-col {
        display: block !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="background-color: #0b0f19; margin: 0; padding: 24px 12px;">
  <center>
    <table class="email-wrapper" width="600" style="max-width: 600px; width: 100%; background: #131926; border-radius: 16px; overflow: hidden; border: 1px solid #1f293d; box-shadow: 0 16px 40px rgba(0,0,0,0.6);">
      <!-- Header Banner -->
      <tr>
        <td style="background: linear-gradient(135deg, #e50914 0%, #8b0000 100%); padding: 32px 28px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 1px;">🎬 iMovies</h1>
          <p style="margin: 8px 0 0; color: #ffe4e6; font-size: 15px; font-weight: 500;">Your Cinema Ticket Booking is Confirmed!</p>
        </td>
      </tr>

      <!-- Main Body -->
      <tr>
        <td style="padding: 28px;">
          <!-- Salutation & Confirmation Banner -->
          <p style="margin: 0 0 16px; font-size: 16px; color: #cbd5e1;">
            Hello <strong>${safeCustomerName}</strong>,
          </p>
          <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
            Thank you for booking with iMovies! Your payment has been verified and your cinema seats are officially reserved. Below are your complete ticket and transaction details.
          </p>

          <!-- Ticket Box -->
          <div style="background: #0d121d; border: 2px dashed #2b3952; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <!-- Badge & Reference -->
            <table width="100%" style="margin-bottom: 18px;">
              <tr>
                <td align="left">
                  <span style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px;">
                    ● ${safeStatus}
                  </span>
                </td>
                <td align="right">
                  <span style="color: #64748b; font-size: 12px; text-transform: uppercase;">Booking Ref:</span>
                  <span style="color: #38bdf8; font-family: monospace; font-size: 13px; font-weight: 700;">${safeBookingId}</span>
                </td>
              </tr>
            </table>

            <!-- Movie Info with optional poster -->
            <table width="100%" style="margin-bottom: 16px;">
              <tr>
                ${posterHtml}
                <td valign="top" class="details-col">
                  <h2 style="margin: 0 0 10px; color: #ffffff; font-size: 22px; font-weight: 700;">${safeMovieTitle}</h2>
                  <p style="margin: 0 0 6px; color: #cbd5e1; font-size: 14px;">
                    🏛️ <strong>${safeTheatre}</strong>${safeLocation ? ` &bull; ${safeLocation}` : ''}
                  </p>
                  <p style="margin: 0 0 6px; color: #94a3b8; font-size: 13px;">
                    🎦 <strong>Auditorium:</strong> ${safeScreen}
                  </p>
                  <p style="margin: 0 0 6px; color: #94a3b8; font-size: 13px;">
                    📅 <strong>Date:</strong> ${safeDate}
                  </p>
                  <p style="margin: 0 0 6px; color: #94a3b8; font-size: 13px;">
                    ⏰ <strong>Showtime:</strong> ${safeTime}
                  </p>
                  <p style="margin: 10px 0 0; color: #94a3b8; font-size: 13px;">
                    🪑 <strong>Seats (${ticketCount}):</strong>
                    <span style="background: #2563eb; color: #ffffff; padding: 3px 8px; border-radius: 5px; font-weight: 700; font-size: 13px; display: inline-block;">
                      ${safeSeats}
                    </span>
                  </p>
                </td>
              </tr>
            </table>

            <!-- Itemized Pricing Breakdown -->
            <div style="border-top: 1px solid #1e293b; margin-top: 16px; padding-top: 14px;">
              <table width="100%">
                ${itemizedRowsHtml}
                ${
                  bookingFee > 0
                    ? `
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Convenience / Booking Fees</td>
                    <td style="padding: 6px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-weight: 500;">₹${Number(bookingFee).toLocaleString('en-IN')}</td>
                  </tr>
                `
                    : ''
                }
                <tr style="border-top: 2px solid #334155;">
                  <td style="padding-top: 12px; color: #ffffff; font-size: 15px; font-weight: 700;">Total Paid (Verified)</td>
                  <td style="padding-top: 12px; color: #22c55e; font-size: 20px; font-weight: 800; text-align: right;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>

            <!-- Transaction Reference -->
            <div style="background: #151c2a; border-radius: 8px; padding: 10px 14px; margin-top: 16px; border: 1px solid #232e42;">
              <table width="100%">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">Payment Transaction ID</td>
                  <td style="color: #94a3b8; font-family: monospace; font-size: 12px; text-align: right;">${safePaymentId}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- CTA: View Booking Online -->
          <table width="100%" style="margin-bottom: 24px;">
            <tr>
              <td align="center">
                <a href="${escapeHtml(bookingDetailsUrl)}" target="_blank" style="background: #e50914; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                  View & Print Ticket on iMovies
                </a>
              </td>
            </tr>
          </table>

          <!-- Important Guidelines -->
          <div style="background: rgba(229, 9, 20, 0.08); border-left: 4px solid #e50914; padding: 12px 16px; border-radius: 4px; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
            📌 <strong>Cinema Admission Notice:</strong> Please arrive 15 minutes before showtime. You can present this digital confirmation or show your Booking Reference ID at the cinema entrance.
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background: #0a0e17; padding: 24px; text-align: center; border-top: 1px solid #1a2334; color: #64748b; font-size: 12px;">
          <p style="margin: 0 0 6px;">&copy; ${new Date().getFullYear()} iMovies Cinema Experience. All rights reserved.</p>
          <p style="margin: 0 0 8px;">
            Need help or need to cancel? Visit your <a href="${escapeHtml(bookingDetailsUrl)}" style="color: #e50914; text-decoration: none;">iMovies Bookings Dashboard</a>.
          </p>
          <p style="margin: 0; font-size: 11px; color: #475569;">
            This email was sent automatically to confirm your verified transaction.
          </p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `;
};

/**
 * Build clean plain-text alternative email
 */
const generateTicketPlainText = ({
  customerName,
  bookingId,
  movieTitle,
  theatreName,
  theatreLocation,
  screen,
  showDate,
  showTime,
  selectedSeats,
  ticketCount,
  itemizedSeats,
  subtotal,
  bookingFee,
  totalAmount,
  paymentId,
  paymentStatus,
  bookingDetailsUrl
}) => {
  const safeName = customerName || 'Movie Enthusiast';
  const loc = theatreLocation ? ` (${theatreLocation})` : '';

  let pricingLines = '';
  if (Array.isArray(itemizedSeats) && itemizedSeats.length > 0) {
    pricingLines = itemizedSeats.map((s) => `  - Seat ${s.seatId} (${s.tier || 'Standard'}): INR ${s.price}`).join('\n');
  } else {
    pricingLines = `  - Tickets (${ticketCount}x): INR ${subtotal}`;
  }

  return `
==================================================
iMovies Cinema Experience - Booking Confirmed
==================================================

Hello ${safeName},

Your movie ticket booking is confirmed!

BOOKING DETAILS:
--------------------------------------------------
Booking ID:     ${bookingId}
Status:         ${paymentStatus || 'Completed'}
Movie:          ${movieTitle}
Theatre:        ${theatreName}${loc}
Screen:         ${screen || 'Screen 1'}
Date:           ${showDate}
Time:           ${showTime}
Seats (${ticketCount}):   ${selectedSeats.join(', ')}

ITEMIZED PAYMENT BREAKDOWN:
--------------------------------------------------
${pricingLines}
${bookingFee > 0 ? `  - Convenience Fee: INR ${bookingFee}\n` : ''}Total Paid:     INR ${totalAmount}
Payment ID:     ${paymentId || 'N/A'}

VIEW OR PRINT YOUR DIGITAL TICKET:
--------------------------------------------------
${bookingDetailsUrl}

ENTRY GUIDELINES:
Please arrive at least 15 minutes before showtime and present your Booking ID at the entrance.

Questions or support? Visit ${getClientBaseUrl()}

(c) ${new Date().getFullYear()} iMovies Inc. All rights reserved.
==================================================
`.trim();
};

/**
 * Primary Idempotent Confirmation Email Dispatcher
 *
 * Verifies that:
 * 1. Booking exists.
 * 2. Payment is 'Completed' (verified by trusted payment provider).
 * 3. Booking has not already triggered a confirmation email.
 * 4. Concurrent requests are protected by atomic status locks.
 *
 * @param {string|object} bookingIdOrDoc - Booking document or bookingId string
 * @returns {Promise<object>} Outcome containing success status, messageId, or error
 */
const sendBookingConfirmationEmail = async (bookingIdOrDoc) => {
  try {
    let bookingId = '';
    if (typeof bookingIdOrDoc === 'string') {
      bookingId = bookingIdOrDoc.trim();
    } else if (bookingIdOrDoc && bookingIdOrDoc.bookingId) {
      bookingId = bookingIdOrDoc.bookingId.trim();
    }

    if (!bookingId) {
      return { success: false, skipped: true, error: 'Valid booking ID is required to send confirmation email' };
    }

    // Step 1: Query booking document
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return { success: false, skipped: true, error: `Booking not found: ${bookingId}` };
    }

    // Step 2: Strictly verify that payment is Completed
    if (booking.paymentStatus !== 'Completed') {
      console.warn(`[emailService] Payment for booking ${bookingId} is '${booking.paymentStatus}'. Confirmation email skipped.`);
      return {
        success: false,
        skipped: true,
        reason: `Payment not verified/completed (current status: ${booking.paymentStatus})`
      };
    }

    // Step 3: Prevent duplicate emails if already sent
    if (booking.confirmationEmailSent === true || booking.confirmationEmailStatus === 'sent') {
      return {
        success: true,
        alreadySent: true,
        messageId: booking.confirmationEmailMessageId || null,
        message: 'Confirmation email has already been sent for this booking'
      };
    }

    // Step 4: Atomic lock to protect against concurrent duplicate execution
    const claimedBooking = await Booking.findOneAndUpdate(
      {
        bookingId,
        paymentStatus: 'Completed',
        confirmationEmailSent: false,
        confirmationEmailStatus: { $nin: ['sending', 'sent'] }
      },
      {
        $set: {
          confirmationEmailStatus: 'sending'
        }
      },
      { new: true }
    );

    if (!claimedBooking) {
      // Re-read to check if another worker completed it
      const freshBooking = await Booking.findOne({ bookingId });
      if (freshBooking && (freshBooking.confirmationEmailSent || freshBooking.confirmationEmailStatus === 'sent')) {
        return {
          success: true,
          alreadySent: true,
          messageId: freshBooking.confirmationEmailMessageId || null,
          message: 'Confirmation email already sent by another process'
        };
      }
      return {
        success: false,
        skipped: true,
        reason: 'Email dispatch is currently in progress or booking is not eligible'
      };
    }

    // Step 5: Resolve recipient email address
    const recipientEmail = (claimedBooking.userEmail || '').trim().toLowerCase();
    if (!recipientEmail) {
      await Booking.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            confirmationEmailStatus: 'failed',
            confirmationEmailError: 'No recipient email associated with this booking'
          }
        }
      );
      return { success: false, error: 'Recipient email is missing' };
    }

    // Step 6: Populate auxiliary details (posterUrl, theatre location, customer name)
    let customerName = claimedBooking.customerName || '';
    if (!customerName) {
      const user = await User.findOne({ email: recipientEmail }).select('username');
      if (user && user.username) {
        customerName = user.username;
      }
    }

    let posterUrl = claimedBooking.posterUrl || '';
    if (!posterUrl && claimedBooking.movieId) {
      const movie = await Movie.findById(claimedBooking.movieId).select('posterUrl');
      if (movie && movie.posterUrl) {
        posterUrl = movie.posterUrl;
      }
    }

    let theatreLocation = '';
    let screen = claimedBooking.screen || 'Screen 1';
    if (claimedBooking.showId) {
      const show = await Show.findOne({ showId: claimedBooking.showId });
      if (show && show.theatreId) {
        const theatre = await Theatre.findOne({ theatreId: show.theatreId }).select('location');
        if (theatre && theatre.location) {
          theatreLocation = theatre.location;
        }
      }
    }

    // Parse itemized seats pricing
    const selectedSeats = Array.isArray(claimedBooking.selectedSeats) ? claimedBooking.selectedSeats : [];
    const itemizedSeats = [];
    let calculatedSubtotal = 0;

    if (claimedBooking.ticketsData && typeof claimedBooking.ticketsData === 'object') {
      for (const seatId of selectedSeats) {
        const ticket = claimedBooking.ticketsData[seatId];
        if (ticket) {
          const price = Number(ticket.price || 0);
          calculatedSubtotal += price;
          itemizedSeats.push({
            seatId,
            tier: ticket.tier || 'Standard',
            price
          });
        }
      }
    }

    const totalAmount = Number(claimedBooking.totalAmount || calculatedSubtotal);
    const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : totalAmount;
    const bookingFee = totalAmount > subtotal ? totalAmount - subtotal : 0;

    const clientBaseUrl = getClientBaseUrl();
    const bookingDetailsUrl = `${clientBaseUrl}/bookings`;

    const emailContext = {
      customerName,
      bookingId: claimedBooking.bookingId,
      movieTitle: claimedBooking.movieName,
      posterUrl,
      theatreName: claimedBooking.theatreName,
      theatreLocation,
      screen,
      showDate: claimedBooking.showDate,
      showTime: claimedBooking.showTime,
      selectedSeats,
      ticketCount: selectedSeats.length,
      itemizedSeats,
      subtotal,
      bookingFee,
      totalAmount,
      paymentId: claimedBooking.razorpayPaymentId || 'N/A',
      paymentStatus: 'Confirmed',
      bookingDetailsUrl
    };

    const htmlContent = generateTicketHtml(emailContext);
    const plainTextContent = generateTicketPlainText(emailContext);

    // Step 7: Check SendGrid API configuration
    const activeApiKey = process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.trim() : '';
    if (!activeApiKey) {
      const errorMsg = 'SENDGRID_API_KEY environment variable is not configured on the server';
      console.warn(`[emailService] ${errorMsg}. Recording status as failed without compromising payment.`);
      await Booking.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            confirmationEmailStatus: 'failed',
            confirmationEmailError: errorMsg
          }
        }
      );
      return { success: false, status: 'failed', error: errorMsg };
    }

    // Ensure sgMail has the latest API key
    sgMail.setApiKey(activeApiKey);

    const senderEmail = getSenderEmail();
    const mailOptions = {
      to: recipientEmail,
      from: {
        email: senderEmail,
        name: 'iMovies Cinema Experience'
      },
      subject: 'Your iMovies Ticket Booking is Confirmed!',
      text: plainTextContent,
      html: htmlContent
    };

    // Step 8: Send via Twilio SendGrid
    const [sgResponse] = await sgMail.send(mailOptions);
    const messageId =
      (sgResponse && sgResponse.headers && (sgResponse.headers['x-message-id'] || sgResponse.headers['x-message-id'.toLowerCase()])) ||
      `sg_${Date.now()}`;

    // Step 9: Update booking record with sent confirmation
    await Booking.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          confirmationEmailSent: true,
          confirmationEmailStatus: 'sent',
          confirmationEmailSentAt: new Date(),
          confirmationEmailMessageId: messageId,
          confirmationEmailError: ''
        }
      }
    );

    return {
      success: true,
      status: 'sent',
      messageId
    };
  } catch (error) {
    // Sanitize error message to prevent leaking credentials
    const safeErrorMsg =
      error.response?.body?.errors?.[0]?.message ||
      error.message ||
      'Failed to deliver confirmation email via SendGrid';

    console.error(`[emailService] Failed to send ticket confirmation email: ${safeErrorMsg}`);

    // Update booking record to reflect failed delivery without affecting paymentStatus
    if (bookingIdOrDoc) {
      const bId = typeof bookingIdOrDoc === 'string' ? bookingIdOrDoc : bookingIdOrDoc.bookingId;
      if (bId) {
        await Booking.findOneAndUpdate(
          { bookingId: bId },
          {
            $set: {
              confirmationEmailSent: false,
              confirmationEmailStatus: 'failed',
              confirmationEmailError: safeErrorMsg
            }
          }
        ).catch(() => {});
      }
    }

    return {
      success: false,
      status: 'failed',
      error: safeErrorMsg
    };
  }
};

/**
 * Backward compatibility wrapper for legacy sendTicketEmail calls
 */
const sendTicketEmail = async (userEmail, ticketDetails = {}) => {
  if (ticketDetails && ticketDetails.bookingId) {
    return await sendBookingConfirmationEmail(ticketDetails.bookingId);
  }
  return { success: false, error: 'Booking ID required for ticket email' };
};

module.exports = {
  sgMail,
  sendBookingConfirmationEmail,
  sendTicketEmail,
  escapeHtml,
  isValidHttpUrl,
  generateTicketHtml,
  generateTicketPlainText
};
