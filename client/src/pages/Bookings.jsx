import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faCalendarAlt,
  faClock,
  faMapMarkerAlt,
  faQrcode,
  faPrint,
  faXmark,
  faFilm,
  faBan,
  faCheckCircle,
  faHourglassHalf,
  faRotateLeft
} from '@fortawesome/free-solid-svg-icons';
import { shareTicketToWhatsApp } from '../utils/whatsappHelper';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
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

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Reserved seats will be released.')) {
      return;
    }

    setCancellingId(bookingId);
    try {
      const res = await API.put(`/bookings/cancel/${bookingId}`);
      if (res.data && res.data.success) {
        toast.success('Booking cancelled successfully.');
        fetchBookings();
      } else {
        toast.error(res.data?.error || 'Failed to cancel booking');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error cancelling booking';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
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
          <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-3 py-1 rounded-pill fw-semibold">
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
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-dark">
          <div>
            <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faTicket} style={{ color: 'var(--primary-red)' }} />
              <span>My Booking History</span>
            </h2>
            <p className="text-secondary mb-0">View, manage, and print your cinema tickets</p>
          </div>
          <span className="badge bg-dark border border-secondary px-3 py-2 rounded-pill fs-6">
            Total: {bookings.length}
          </span>
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
            {bookings.map((booking) => (
              <div key={booking.bookingId || booking._id} className="col-12 col-lg-6">
                <div
                  className="dark-card p-4 h-100 d-flex flex-column justify-content-between shadow-sm position-relative overflow-hidden"
                  style={{ border: '1px solid #23293b' }}
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
                                className="badge bg-secondary px-2 py-1"
                                style={{ backgroundColor: '#23293b' }}
                              >
                                {seat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Amount and Actions */}
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top border-dark">
                    <div>
                      <span className="small text-secondary d-block">Total Paid</span>
                      <span className="fs-5 fw-bold" style={{ color: 'var(--primary-red)' }}>
                        ₹{booking.totalAmount}
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      {booking.paymentStatus === 'Pending' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger px-3 fw-semibold"
                          onClick={() => handleCancelBooking(booking.bookingId)}
                          disabled={cancellingId === booking.bookingId}
                        >
                          {cancellingId === booking.bookingId ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}

                      {booking.paymentStatus === 'Completed' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-success px-3 fw-semibold d-inline-flex align-items-center gap-1"
                            style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                            onClick={() => shareTicketToWhatsApp(booking)}
                            title="Share ticket to WhatsApp"
                          >
                            <span>💬 WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info px-3 fw-semibold d-inline-flex align-items-center gap-1"
                            onClick={() => setSelectedTicket(booking)}
                          >
                            <FontAwesomeIcon icon={faTicket} />
                            <span>View Ticket</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Printable Ticket Modal */}
      {selectedTicket && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content bg-dark text-white border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header border-0 pb-0 justify-content-end">
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedTicket(null)}
                  aria-label="Close"
                ></button>
              </div>

              {/* Printable Ticket Card */}
              <div className="modal-body px-4 pb-4">
                <div
                  id="printable-ticket"
                  className="p-4 rounded-4 shadow-sm position-relative text-white"
                  style={{
                    background: 'linear-gradient(135deg, #151a28 0%, #0d111b 100%)',
                    border: '2px dashed #3a4460'
                  }}
                >
                  {/* Brand & Perforated Top */}
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary border-opacity-50">
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ fontSize: '1.4rem' }}>🎬</span>
                      <span className="fw-bold fs-5">
                        <span style={{ color: 'var(--primary-red)' }}>i</span>Movies Ticket
                      </span>
                    </div>
                    <span className="badge bg-success bg-opacity-25 border border-success text-success px-2 py-1">
                      CONFIRMED
                    </span>
                  </div>

                  {/* Movie Info */}
                  <h4 className="fw-bold mb-1 text-white">
                    {selectedTicket.movieName || 'Movie Blockbuster'}
                  </h4>
                  <p className="text-secondary small mb-3">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-danger me-1" />
                    {selectedTicket.theatreName}
                  </p>

                  <div className="row g-2 mb-3 small bg-dark p-3 rounded-3 border border-secondary border-opacity-25">
                    <div className="col-6">
                      <span className="text-secondary d-block">Date</span>
                      <strong className="text-white">{selectedTicket.showDate}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-secondary d-block">Time</span>
                      <strong className="text-white">{selectedTicket.showTime}</strong>
                    </div>
                    <div className="col-6 mt-2">
                      <span className="text-secondary d-block">Seats</span>
                      <strong className="text-white">{selectedTicket.selectedSeats?.join(', ')}</strong>
                    </div>
                    <div className="col-6 mt-2">
                      <span className="text-secondary d-block">Total Paid</span>
                      <strong className="text-danger">₹{selectedTicket.totalAmount}</strong>
                    </div>
                  </div>

                  {/* QR Code and Reference */}
                  <div className="text-center py-2">
                    <div
                      className="d-inline-flex flex-column align-items-center justify-content-center p-3 bg-white rounded-3 mb-2"
                      style={{ color: '#000' }}
                    >
                      <FontAwesomeIcon icon={faQrcode} style={{ fontSize: '4.5rem' }} />
                    </div>
                    <div className="font-monospace small text-secondary">
                      Ref ID: {selectedTicket.bookingId}
                    </div>
                    <div className="small text-secondary mt-1">Scan at entrance scanner</div>
                  </div>
                </div>

                {/* Print, WhatsApp and Close CTA */}
                <div className="d-flex gap-2 mt-4 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-success flex-grow-1 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                    style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                    onClick={() => shareTicketToWhatsApp(selectedTicket)}
                  >
                    <span>💬 Share to WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary-red flex-grow-1 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                    onClick={handlePrint}
                  >
                    <FontAwesomeIcon icon={faPrint} />
                    <span>Print Ticket</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3 py-2 fw-semibold"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
