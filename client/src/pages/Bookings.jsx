import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import TicketModal from '../components/TicketModal';
import API from '../utils/api';
import { getCancellationEligibility } from '../utils/timeHelper';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faCalendarAlt,
  faClock,
  faMapMarkerAlt,
  faPrint,
  faXmark,
  faBan,
  faCheckCircle,
  faHourglassHalf,
  faRotateLeft,
  faShareNodes,
  faShieldHalved,
  faCheck,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { shareTicketToWhatsApp } from '../utils/whatsappHelper';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('imovies-user-token');

  const fetchBookings = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/bookings/my');
      const data = res.data?.bookings || (Array.isArray(res.data) ? res.data : []);
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      toast.error('Unable to fetch your booking history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleOpenCancelModal = (booking) => {
    const eligibility = getCancellationEligibility(booking.showDate, booking.showTime);
    if (!eligibility.eligible) {
      toast.error(eligibility.reason || 'Cancellation is closed within 2 hours of showtime.');
      return;
    }
    setCancelModalBooking(booking);
  };

  const handleConfirmCancellation = async () => {
    if (!cancelModalBooking) return;
    const bookingId = cancelModalBooking.bookingId || cancelModalBooking._id;

    setIsCancelling(true);
    try {
      const res = await API.put(`/bookings/cancel/${bookingId}`);
      if (res.data && res.data.success) {
        toast.success('Ticket cancelled successfully! Reserved seats have been released.');
        setCancelModalBooking(null);
        await fetchBookings();
      } else {
        toast.error(res.data?.error || 'Failed to cancel ticket');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Error cancelling booking';
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleShareTicket = async (booking) => {
    const bookingId = booking.bookingId || booking._id;
    const shareUrl = `${window.location.origin}/tickets/view/${bookingId}`;
    const movieName = booking.movieName || 'Movie';

    if (navigator.share) {
      try {
        await navigator.share({
          title: `iMovies Ticket: ${movieName}`,
          text: `Here is my verified ticket for ${movieName} at ${booking.theatreName} (${booking.showDate} - ${booking.showTime})!`,
          url: shareUrl
        });
        toast.success('Ticket shared!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedId(bookingId);
        toast.success('Public ticket link copied to clipboard!');
        setTimeout(() => setCopiedId(null), 3000);
      } catch (err) {
        toast.info(shareUrl);
      }
    } else {
      toast.info(shareUrl);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
      case 'Confirmed':
        return (
          <span className="badge bg-success bg-opacity-25 border border-success text-success px-3 py-1 rounded-pill fw-semibold">
            <FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Confirmed
          </span>
        );
      case 'Pending':
        return (
          <span className="badge bg-warning bg-opacity-25 border border-warning text-warning px-3 py-1 rounded-pill fw-semibold">
            <FontAwesomeIcon icon={faHourglassHalf} className="me-1" /> Pending
          </span>
        );
      case 'Cancelled':
        return (
          <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-3 py-1 rounded-pill fw-semibold">
            <FontAwesomeIcon icon={faBan} className="me-1" /> Cancelled
          </span>
        );
      case 'Refunded':
        return (
          <span className="badge bg-secondary bg-opacity-25 border border-secondary text-secondary px-3 py-1 rounded-pill fw-semibold">
            <FontAwesomeIcon icon={faRotateLeft} className="me-1" /> Refunded
          </span>
        );
      default:
        return (
          <span className="badge bg-secondary px-3 py-1 rounded-pill fw-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid flex-grow-1 px-3 px-md-5 py-4" style={{ maxWidth: '1200px' }}>
        {/* Title Bar */}
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-dark flex-wrap gap-2">
          <div>
            <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faTicket} style={{ color: 'var(--primary-red)' }} />
              <span>My Booking History</span>
            </h2>
            <p className="text-secondary mb-0">View, share, manage, and print your cinema tickets</p>
          </div>
          <span className="badge bg-dark border border-secondary px-3 py-2 rounded-pill fs-6">
            Total: {bookings.length}
          </span>
        </div>

        {/* Policy Instruction Notice on Dashboard */}
        <div className="mb-4 p-3 rounded-3 border border-secondary border-opacity-25" style={{ backgroundColor: '#131722' }}>
          <div className="d-flex align-items-center gap-2 text-secondary small">
            <FontAwesomeIcon icon={faShieldHalved} className="text-warning" />
            <span>
              <strong className="text-white">Ticket Cancellation Policy:</strong> Cancellations are permitted up to 2 hours prior to showtime. No refunds or cancellations will be processed within 2 hours of the scheduled start time.
            </span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-5">
            <Loader message="Loading your tickets..." fullScreen={false} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="dark-card text-center py-5 px-3 my-4">
            <div className="mb-3 text-secondary" style={{ fontSize: '3.5rem' }}>
              🎟️
            </div>
            <h4 className="fw-bold text-white mb-2">No Bookings Found</h4>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '420px' }}>
              You haven't booked any movie tickets yet. Explore our current showings and reserve your seats now!
            </p>
            <button className="btn btn-primary-red" onClick={() => navigate('/home')}>
              Explore Now Showing
            </button>
          </div>
        ) : (
          <div className="row g-4">
            {bookings.map((booking) => {
              const bookingId = booking.bookingId || booking._id;
              const isCancelled = booking.paymentStatus === 'Cancelled' || booking.paymentStatus === 'Refunded';
              const eligibility = getCancellationEligibility(booking.showDate, booking.showTime);

              return (
                <div key={bookingId} className="col-12 col-lg-6">
                  <div
                    className="dark-card p-4 h-100 d-flex flex-column justify-content-between shadow-sm position-relative overflow-hidden"
                    style={{
                      border: isCancelled ? '1px solid #3a2228' : '1px solid #23293b',
                      opacity: isCancelled ? 0.75 : 1
                    }}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h4 className="fw-bold text-white mb-1">
                            {booking.movieName || 'Movie Experience'}
                          </h4>
                          <div className="text-secondary small d-flex align-items-center gap-1">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-danger" />
                            <span>{booking.theatreName}</span>
                          </div>
                        </div>
                        <div>{getStatusBadge(booking.paymentStatus)}</div>
                      </div>

                      {/* Booking Meta Details */}
                      <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
                        <div className="row g-2 text-secondary small">
                          <div className="col-6 d-flex align-items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-danger" />
                            <span>
                              Date: <strong className="text-white">{booking.showDate}</strong>
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-2">
                            <FontAwesomeIcon icon={faClock} className="text-danger" />
                            <span>
                              Time: <strong className="text-white">{booking.showTime}</strong>
                            </span>
                          </div>
                          <div className="col-12 mt-2 pt-2 border-top border-dark">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="fw-semibold text-secondary">Seats:</span>
                              {booking.selectedSeats?.map((seat) => (
                                <span
                                  key={seat}
                                  className="badge px-2 py-1"
                                  style={{ backgroundColor: '#23293b', color: '#e2e8f0' }}
                                >
                                  {seat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cancellation status line */}
                      {!isCancelled && (
                        <div className="mb-3">
                          {eligibility.eligible ? (
                            <div className="small text-success d-flex align-items-center gap-1">
                              <span>✓ Eligible for cancellation (closes 2h before show)</span>
                            </div>
                          ) : (
                            <div className="small text-secondary d-flex align-items-center gap-1">
                              <span className="text-muted">🔒 {eligibility.reason}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Amount and Actions */}
                    <div className="d-flex justify-content-between align-items-center pt-3 border-top border-dark flex-wrap gap-2">
                      <div>
                        <span className="small text-secondary d-block">Total Paid</span>
                        <span className="fs-5 fw-bold" style={{ color: 'var(--primary-red)' }}>
                          ₹{booking.totalAmount}
                        </span>
                      </div>

                      <div className="d-flex gap-2 flex-wrap align-items-center">
                        {/* Cancellation Button */}
                        {!isCancelled && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger px-3 fw-semibold d-inline-flex align-items-center gap-1"
                            onClick={() => handleOpenCancelModal(booking)}
                            disabled={!eligibility.eligible}
                            title={
                              eligibility.eligible
                                ? 'Cancel this booking and release seats (permitted up to 2 hours prior to show)'
                                : eligibility.reason
                            }
                          >
                            <FontAwesomeIcon icon={faBan} />
                            <span>Cancel Ticket</span>
                          </button>
                        )}

                        {/* Share Public Ticket URL */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info px-3 fw-semibold d-inline-flex align-items-center gap-1"
                          onClick={() => handleShareTicket(booking)}
                          title="Share public ticket link"
                        >
                          <FontAwesomeIcon icon={copiedId === bookingId ? faCheck : faShareNodes} />
                          <span>{copiedId === bookingId ? 'Copied' : 'Share'}</span>
                        </button>

                        {/* WhatsApp Share */}
                        <button
                          type="button"
                          className="btn btn-sm btn-success px-3 fw-semibold d-inline-flex align-items-center gap-1"
                          style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                          onClick={() => shareTicketToWhatsApp(booking)}
                          title="Share ticket to WhatsApp"
                        >
                          <span>💬 WhatsApp</span>
                        </button>

                        {/* View Ticket Modal */}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary-red px-3 fw-semibold d-inline-flex align-items-center gap-1"
                          onClick={() => setSelectedTicket(booking)}
                        >
                          <FontAwesomeIcon icon={faTicket} />
                          <span>View Ticket</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ticket Modal */}
      {selectedTicket && (
        <TicketModal
          booking={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalBooking && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', zIndex: 10500 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
            <div className="modal-content bg-dark text-white border-0 shadow-lg rounded-4 overflow-hidden" style={{ border: '1px solid #3a4460' }}>
              <div className="modal-header border-bottom border-dark px-4 py-3">
                <div className="d-flex align-items-center gap-2 text-danger fw-bold fs-5">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>Confirm Ticket Cancellation</span>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setCancelModalBooking(null)}
                  disabled={isCancelling}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body px-4 py-4">
                <p className="text-light mb-3">
                  Are you sure you want to cancel your booking for{' '}
                  <strong className="text-white">{cancelModalBooking.movieName}</strong>?
                </p>

                {/* Details summary */}
                <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
                  <div className="small text-secondary mb-1">
                    Theatre: <strong className="text-white">{cancelModalBooking.theatreName}</strong>
                  </div>
                  <div className="small text-secondary mb-1">
                    Showtime: <strong className="text-white">{cancelModalBooking.showDate} at {cancelModalBooking.showTime}</strong>
                  </div>
                  <div className="small text-secondary mb-1">
                    Seats to Release:{' '}
                    <strong className="text-warning">
                      {cancelModalBooking.selectedSeats?.join(', ')}
                    </strong>
                  </div>
                  <div className="small text-secondary">
                    Booking ID: <span className="font-monospace text-white">{cancelModalBooking.bookingId}</span>
                  </div>
                </div>

                {/* Required Cancellation Policy Notice */}
                <div className="alert alert-warning py-3 px-3 small rounded-3 mb-0 border-warning border-opacity-50">
                  <div className="d-flex align-items-start gap-2">
                    <FontAwesomeIcon icon={faShieldHalved} className="mt-1" />
                    <div>
                      <strong>Cancellation Policy:</strong> Cancellations are permitted up to 2 hours prior to showtime. No refunds or cancellations will be processed within 2 hours of the scheduled start time.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top border-dark px-4 py-3 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 rounded-pill"
                  onClick={() => setCancelModalBooking(null)}
                  disabled={isCancelling}
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 rounded-pill fw-bold"
                  onClick={handleConfirmCancellation}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Cancelling & Releasing...
                    </span>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
