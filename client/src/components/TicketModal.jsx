import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faPrint,
  faTicket,
  faCalendar,
  faClock,
  faLocationDot,
  faCheckCircle,
  faShareNodes,
  faCopy,
  faCheck,
  faShieldHalved,
  faFilm
} from '@fortawesome/free-solid-svg-icons';
import { shareTicketToWhatsApp } from '../utils/whatsappHelper';

export default function TicketModal({ booking, onClose }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!booking) return null;

  const bookingId = booking.bookingId || booking._id || 'N/A';
  const movieName = booking.movieName || (booking.movie && booking.movie.title) || 'Movie Ticket';
  const theatreName = booking.theatreName || (booking.theatre && booking.theatre.name) || 'Cinema Hall';
  const showDate = booking.showDate || (booking.show && booking.show.date) || 'N/A';
  const showTime = booking.showTime || (booking.show && booking.show.time) || 'N/A';
  const seats = Array.isArray(booking.selectedSeats)
    ? booking.selectedSeats.join(', ')
    : Array.isArray(booking.seats)
    ? booking.seats.join(', ')
    : booking.selectedSeats || booking.seats || 'N/A';
  const totalAmount = booking.totalAmount ?? booking.amount ?? 0;
  const status = booking.paymentStatus || booking.status || 'Completed';

  // Public sharable link
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicShareUrl = `${origin}/tickets/view/${bookingId}`;

  // Poster URL with fallback
  const posterUrl =
    booking.posterUrl ||
    booking.movie?.posterUrl ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80';

  // Generate Dynamic QR Code on mount or booking change
  useEffect(() => {
    if (!bookingId || bookingId === 'N/A') return;

    // Structured JSON payload + dynamic validation URL
    const qrPayload = JSON.stringify({
      app: 'iMovies Cinema Ticket',
      bookingId,
      movie: movieName,
      theatre: theatreName,
      showDate,
      showTime,
      seats,
      amount: totalAmount,
      status,
      verifyUrl: publicShareUrl
    });

    // We encode the verification URL directly so mobile cameras open the verified ticket page immediately
    QRCode.toDataURL(publicShareUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate ticket QR code:', err));
  }, [bookingId, movieName, theatreName, showDate, showTime, seats, totalAmount, status, publicShareUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareTicket = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `iMovies Ticket: ${movieName}`,
          text: `My verified movie ticket for ${movieName} at ${theatreName} (${showDate} - ${showTime}). Seats: ${seats}`,
          url: publicShareUrl
        });
        toast.success('Ticket link shared successfully!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(publicShareUrl);
        setCopied(true);
        toast.success('Public ticket link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
      } catch (e) {
        toast.info(publicShareUrl);
      }
    } else {
      toast.info(publicShareUrl);
    }
  };

  const getStatusBadgeClass = () => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'confirmed':
        return 'bg-success text-white';
      case 'pending':
        return 'bg-warning text-dark';
      case 'failed':
        return 'bg-danger text-white';
      case 'cancelled':
        return 'bg-secondary text-white';
      default:
        return 'bg-primary text-white';
    }
  };

  return (
    <div
      className="ticket-modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .ticket-print, .ticket-print * {
            visibility: visible !important;
          }
          .ticket-print {
            position: absolute !important;
            left: 50% !important;
            top: 20px !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            max-width: 680px !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .ticket-print * {
            color: #000000 !important;
            border-color: #333333 !important;
          }
          .ticket-print .text-secondary {
            color: #555555 !important;
          }
          .ticket-print .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="modal-dialog modal-dialog-centered w-100"
        style={{ maxWidth: '820px' }}
      >
        <div
          className="modal-content border-0 rounded-4 overflow-hidden shadow-lg"
          style={{ backgroundColor: '#141414', border: '1px solid #333' }}
        >
          {/* Header Action Bar */}
          <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-dark print-hide flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2 text-white fw-bold">
              <FontAwesomeIcon icon={faTicket} style={{ color: 'var(--primary-red)' }} />
              <span>Cinema E-Ticket</span>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-outline-info btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill fw-semibold"
                onClick={handleShareTicket}
                title="Share or copy ticket link"
              >
                <FontAwesomeIcon icon={copied ? faCheck : faShareNodes} />
                <span>{copied ? 'Link Copied!' : 'Share Ticket'}</span>
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill fw-semibold"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                onClick={() => shareTicketToWhatsApp(booking)}
              >
                <span>💬 WhatsApp</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                onClick={handlePrint}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>Print</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px' }}
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>

          {/* Ticket Body */}
          <div className="p-3 p-md-4">
            <div
              className="ticket-print rounded-3 overflow-hidden d-flex flex-column flex-md-row"
              style={{
                backgroundColor: '#1b1b22',
                border: '2px dashed #444',
                position: 'relative'
              }}
            >
              {/* Poster Section (Left visual preview) */}
              <div
                className="d-none d-lg-block position-relative"
                style={{ width: '170px', minWidth: '170px', backgroundColor: '#0d111b' }}
              >
                <img
                  src={posterUrl}
                  alt={movieName}
                  className="w-100 h-100"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80';
                  }}
                />
              </div>

              {/* Main Section: Details */}
              <div className="flex-grow-1 p-3 p-md-4 d-flex flex-column justify-content-between border-md-end border-dashed border-secondary">
                <div>
                  {/* Brand & Badge */}
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-1 fs-5 fw-bold text-white">
                      <span>🎬</span>
                      <span>
                        <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
                      </span>
                    </div>
                    <span className={`badge px-2 py-1 rounded-pill small ${getStatusBadgeClass()}`}>
                      {status}
                    </span>
                  </div>

                  {/* Movie Title */}
                  <h3 className="text-white fw-bold mb-2" style={{ letterSpacing: '0.02em', fontSize: '1.4rem' }}>
                    {movieName}
                  </h3>

                  {/* Theatre Location */}
                  <div className="d-flex align-items-center gap-2 text-secondary mb-3 small">
                    <FontAwesomeIcon icon={faLocationDot} style={{ color: 'var(--primary-red)' }} />
                    <span className="text-light fw-medium">{theatreName}</span>
                  </div>

                  {/* Schedule Grid */}
                  <div className="row g-2 my-1 pt-2 border-top border-secondary border-opacity-25">
                    <div className="col-6">
                      <div className="text-secondary small d-flex align-items-center gap-1">
                        <FontAwesomeIcon icon={faCalendar} />
                        <span>Date</span>
                      </div>
                      <div className="text-white fw-bold mt-1">{showDate}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-secondary small d-flex align-items-center gap-1">
                        <FontAwesomeIcon icon={faClock} />
                        <span>Time</span>
                      </div>
                      <div className="text-white fw-bold mt-1">{showTime}</div>
                    </div>
                  </div>

                  {/* Seats & Booking ID */}
                  <div className="row g-2 my-1 pt-2 border-top border-secondary border-opacity-25">
                    <div className="col-7">
                      <div className="text-secondary small">Seats</div>
                      <div className="text-warning fw-bold mt-1 fs-6">
                        {seats}
                      </div>
                    </div>
                    <div className="col-5">
                      <div className="text-secondary small">Amount Paid</div>
                      <div className="text-white fw-bold mt-1 fs-6">
                        ₹{Number(totalAmount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="text-secondary" style={{ fontSize: '0.68rem' }}>
                      BOOKING REFERENCE
                    </div>
                    <div className="text-white font-monospace small fw-bold">
                      {bookingId}
                    </div>
                  </div>
                  {booking.userEmail && (
                    <div className="text-end">
                      <div className="text-secondary" style={{ fontSize: '0.68rem' }}>
                        BOOKED BY
                      </div>
                      <div className="text-secondary small">{booking.userEmail}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Perforated separator notch for md screens */}
              <div
                className="d-none d-md-flex flex-column justify-content-center align-items-center px-1"
                style={{
                  borderLeft: '2px dashed #444',
                  backgroundColor: '#16161c'
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#141414',
                    marginBottom: 'auto',
                    marginTop: '-6px'
                  }}
                />
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#141414',
                    marginTop: 'auto',
                    marginBottom: '-6px'
                  }}
                />
              </div>

              {/* Right Section: Dynamic Scannable QR */}
              <div
                className="p-3 d-flex flex-column align-items-center justify-content-center text-center"
                style={{
                  minWidth: '190px',
                  backgroundColor: '#181820'
                }}
              >
                <div
                  className="rounded-3 p-2 bg-white d-flex flex-column align-items-center justify-content-center shadow-sm"
                  style={{ width: '130px', height: '130px' }}
                >
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="Ticket Dynamic QR"
                      className="img-fluid"
                      style={{ width: '115px', height: '115px' }}
                    />
                  ) : (
                    <div className="spinner-border spinner-border-sm text-dark" role="status"></div>
                  )}
                </div>
                <span className="fw-bold text-white-50 font-monospace mt-2" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>
                  SCAN FOR DETAILS
                </span>
                <div className="badge bg-success bg-opacity-25 border border-success text-success mt-1 px-2 py-1 small">
                  ✓ Verified Live
                </div>
              </div>
            </div>

            {/* Cancellation Policy Notice Banner */}
            <div className="mt-3 p-3 rounded-3 border border-secondary border-opacity-25 print-hide" style={{ backgroundColor: '#161922' }}>
              <div className="d-flex align-items-start gap-2 text-secondary small">
                <FontAwesomeIcon icon={faShieldHalved} className="text-warning mt-1" />
                <div>
                  <strong className="text-light">Cancellation Policy:</strong> Cancellations are permitted up to 2 hours prior to showtime. No refunds or cancellations will be processed within 2 hours of the scheduled start time.
                </div>
              </div>
            </div>
          </div>

          {/* Footer Close & Sharing Bar */}
          <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top border-dark print-hide flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-info btn-sm px-3 rounded-pill fw-semibold d-inline-flex align-items-center gap-2"
              onClick={handleShareTicket}
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
              <span>{copied ? 'Copied Public URL!' : 'Share / Copy Ticket URL'}</span>
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary px-4 rounded-pill btn-sm"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary-red px-4 rounded-pill btn-sm d-inline-flex align-items-center gap-2"
                onClick={handlePrint}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>Print Ticket</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
