const cron = require('node-cron');
const Show = require('../models/showModel');
const Booking = require('../models/bookingModel');

/**
 * Initializes cron job to release expired locked seats across all shows
 * and cancel abandoned pending bookings.
 * Runs every minute ('* * * * *')
 */
const startCleanupService = () => {
  const task = cron.schedule('* * * * *', async () => {
    try {
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

      // 1. Release expired seat holds across Shows
      const shows = await Show.find({});
      for (const show of shows) {
        if (!show.tickets || typeof show.tickets !== 'object') {
          continue;
        }

        let modified = false;
        const ticketKeys = Object.keys(show.tickets);

        for (const seatKey of ticketKeys) {
          const ticket = show.tickets[seatKey];
          if (
            ticket &&
            ticket.status === 'locked' &&
            ticket.lockExpiry &&
            new Date(ticket.lockExpiry).getTime() < now
          ) {
            ticket.status = 'available';
            delete ticket.lockExpiry;
            if (ticket.lockedBy) delete ticket.lockedBy;
            if (ticket.userEmail) delete ticket.userEmail;
            if (ticket.bookingId) delete ticket.bookingId;
            modified = true;
          }
        }

        if (modified) {
          show.markModified('tickets');
          await show.save();
          console.log(`[CleanupService] Released expired locked tickets for Show ID: ${show.showId}`);
        }
      }

      // 2. Automatically mark abandoned Pending bookings as Cancelled
      const abandonedBookings = await Booking.find({
        paymentStatus: 'Pending',
        createdAt: { $lt: tenMinutesAgo }
      });

      for (const booking of abandonedBookings) {
        booking.paymentStatus = 'Cancelled';
        await booking.save();
        console.log(`[CleanupService] Cancelled abandoned pending booking: ${booking.bookingId}`);
      }
    } catch (error) {
      console.error('[CleanupService] Error during ticket cleanup:', error);
    }
  });

  console.log('[CleanupService] Ticket cleanup service started successfully.');
  return task;
};

module.exports = {
  startCleanupService
};
