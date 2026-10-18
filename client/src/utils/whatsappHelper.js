/**
 * WhatsApp Ticket Share Helper for iMovies
 * Formats cinema ticket details into an emoji-rich message and generates a WhatsApp share link
 */

export function formatTicketWhatsAppMessage(booking) {
  if (!booking) return '';

  const id = booking.bookingId ? booking.bookingId.slice(0, 8).toUpperCase() : 'N/A';
  const movie = booking.movieName || 'Movie';
  const theatre = booking.theatreName || 'iMovies Multiplex';
  const date = booking.showDate || 'Today';
  const time = booking.showTime || 'Now';
  const seats = Array.isArray(booking.selectedSeats)
    ? booking.selectedSeats.join(', ')
    : booking.selectedSeats || 'N/A';
  const amount = booking.totalAmount !== undefined ? `₹${booking.totalAmount}` : 'N/A';
  const status = booking.paymentStatus || 'Completed';

  const message = 
`🍿 *iMovies Cinema Ticket Confirmation* 🎬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎟️ *Booking ID:* #${id}
🎥 *Movie:* ${movie}
🏛️ *Theatre:* ${theatre}
📅 *Show Date:* ${date}
⏰ *Show Time:* ${time}
💺 *Seats:* ${seats}
💰 *Total Amount:* ${amount}
✅ *Status:* ${status}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ _Present this ticket at the cinema box-office counter._
🔗 *iMovies App:* Instant reservations & HD trailers online!`;

  return message;
}

/**
 * Returns wa.me share URL for the given booking
 */
export function getWhatsAppShareUrl(booking) {
  const message = formatTicketWhatsAppMessage(booking);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Directly opens WhatsApp in a new browser tab/app
 */
export function shareTicketToWhatsApp(booking) {
  const url = getWhatsAppShareUrl(booking);
  window.open(url, '_blank', 'noopener,noreferrer');
}
