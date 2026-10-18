const cron = require('node-cron');
const Show = require('../models/showModel');

/**
 * Initializes cron job to release expired locked seats across all shows
 * Runs every minute ('* * * * *')
 */
const startCleanupService = () => {
  const task = cron.schedule('* * * * *', async () => {
    try {
      const shows = await Show.find({});
      const now = Date.now();

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
            modified = true;
          }
        }

        if (modified) {
          show.markModified('tickets');
          await show.save();
          console.log(`[CleanupService] Released expired locked tickets for Show ID: ${show.showId}`);
        }
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
