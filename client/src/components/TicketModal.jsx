import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faPrint,
  faTicket,
  faCalendar,
  faClock,
  faLocationDot,
  faCheckCircle,
  faQrcode
} from '@fortawesome/free-solid-svg-icons';
import { shareTicketToWhatsApp } from '../utils/whatsappHelper';

export default function TicketModal({ booking, onClose }) {
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

  const handlePrint = () => {
    window.print();
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
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
            top: 50px !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            max-width: 650px !important;
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
        style={{ maxWidth: '720px' }}
      >
        <div
          className="modal-content border-0 rounded-4 overflow-hidden shadow-lg"
          style={{ backgroundColor: '#141414', border: '1px solid #333' }}
        >
          {/* Header Action Bar */}
          <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-dark print-hide">
            <div className="d-flex align-items-center gap-2 text-white fw-bold">
              <FontAwesomeIcon icon={faTicket} style={{ color: 'var(--primary-red)' }} />
              <span>Cinema E-Ticket</span>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-success btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill fw-semibold"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                onClick={() => shareTicketToWhatsApp(booking)}
              >
                <span>💬 WhatsApp Share</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                onClick={handlePrint}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>Print Ticket</span>
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
          <div className="p-4 p-md-5">
            <div
              className="ticket-print rounded-3 overflow-hidden d-flex flex-column flex-md-row"
              style={{
                backgroundColor: '#1b1b22',
                border: '2px dashed #444',
                position: 'relative'
              }}
            >
              {/* Left Section: Details */}
              <div className="flex-grow-1 p-4 d-flex flex-column justify-content-between border-md-end border-dashed border-secondary">
                <div>
                  {/* Brand & Badge */}
                  <div className="d-flex justify-content-between align-items-center mb-3">
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
                  <h3 className="text-white fw-bold mb-3" style={{ letterSpacing: '0.02em' }}>
                    {movieName}
                  </h3>

                  {/* Theatre Location */}
                  <div className="d-flex align-items-center gap-2 text-secondary mb-3 small">
                    <FontAwesomeIcon icon={faLocationDot} style={{ color: 'var(--primary-red)' }} />
                    <span className="text-light fw-medium">{theatreName}</span>
                  </div>

                  {/* Schedule Grid */}
                  <div className="row g-3 my-2 pt-2 border-top border-secondary border-opacity-25">
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
                  <div className="row g-3 my-2 pt-2 border-top border-secondary border-opacity-25">
                    <div className="col-7">
                      <div className="text-secondary small">Seats</div>
                      <div className="text-warning fw-bold mt-1 fs-5">
                        {seats}
                      </div>
                    </div>
                    <div className="col-5">
                      <div className="text-secondary small">Amount Paid</div>
                      <div className="text-white fw-bold mt-1 fs-5">
                        ₹{Number(totalAmount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                      BOOKING REFERENCE
                    </div>
                    <div className="text-white font-monospace small fw-bold">
                      {bookingId}
                    </div>
                  </div>
                  {booking.userEmail && (
                    <div className="text-end">
                      <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                        BOOKED BY
                      </div>
                      <div className="text-secondary small">{booking.userEmail}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Perforated separator notch (visual stub for md screens) */}
              <div
                className="d-none d-md-flex flex-column justify-content-center align-items-center px-2"
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

              {/* Right Section: QR Stub */}
              <div
                className="p-4 d-flex flex-column align-items-center justify-content-center text-center"
                style={{
                  minWidth: '180px',
                  backgroundColor: '#181820'
                }}
              >
                <div
                  className="rounded-3 p-3 bg-white d-flex flex-column align-items-center justify-content-center shadow-sm"
                  style={{ width: '120px', height: '120px' }}
                >
                  <FontAwesomeIcon icon={faQrcode} size="3x" className="text-dark mb-1" />
                  <span className="fw-bold text-dark font-monospace" style={{ fontSize: '0.65rem' }}>
                    SCAN AT GATE
                  </span>
                </div>
                <div className="mt-3 text-secondary" style={{ fontSize: '0.75rem' }}>
                  Admit One
                </div>
                <div className="badge bg-dark border border-secondary text-light mt-1 px-2 py-1 small">
                  Verified Ticket
                </div>
              </div>
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="d-flex justify-content-end gap-2 px-4 py-3 border-top border-dark print-hide flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary px-4 rounded-pill"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-success px-4 rounded-pill fw-semibold d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
              onClick={() => shareTicketToWhatsApp(booking)}
            >
              <span>💬 Share to WhatsApp</span>
            </button>
            <button
              type="button"
              className="btn btn-primary-red px-4 rounded-pill"
              onClick={handlePrint}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span>Print Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
