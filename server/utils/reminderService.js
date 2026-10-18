const cron = require('node-cron');
const Booking = require('../models/bookingModel');
const { sendReminder } = require('./mailer');

/**
 * Safely parse date and time strings into a JavaScript Date object
 * Supports ISO (YYYY-MM-DD), standard formats, and 12-hour/24-hour time strings
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date|null}
 */
const parseShowDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;

  // Try direct parsing
  let parsed = new Date(`${dateStr} ${timeStr}`);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY formatting
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) {
    const [day, month, year] = parts;
    parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

/**
 * Initializes cron job to send reminders for upcoming shows
 * Runs every hour ('0 * * * *')
 */
const startReminderService = () => {
  const task = cron.schedule('0 * * * *', async () => {
    try {
      const bookings = await Booking.find({ paymentStatus: 'Completed' });
      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;

      for (const booking of bookings) {
        // Skip if reminder has already been sent
        if (booking.reminderSent) {
          continue;
        }

        const showDateTime = parseShowDateTime(booking.showDate, booking.showTime);
        if (!showDateTime) {
          continue;
        }

        const timeDiff = showDateTime.getTime() - now;

        // Check if the show is upcoming within the next 2 hours (0 < timeDiff <= 2 hours)
        if (timeDiff > 0 && timeDiff <= twoHoursMs) {
          await sendReminder(booking.userEmail, {
            bookingId: booking.bookingId,
            movieName: booking.movieName,
            theatreName: booking.theatreName,
            showDate: booking.showDate,
            showTime: booking.showTime,
            selectedSeats: booking.selectedSeats
          });

          // Mark reminder as sent to avoid duplicate emails
          booking.reminderSent = true;
          await booking.save();
          console.log(`[ReminderService] Reminder email sent for booking ${booking.bookingId} to ${booking.userEmail}`);
        }
      }
    } catch (error) {
      console.error('[ReminderService] Error checking and sending show reminders:', error);
    }
  });

  console.log('[ReminderService] Show reminder service started successfully.');
  return task;
};

module.exports = {
  startReminderService
};
