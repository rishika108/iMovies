import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import API from '../utils/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faCalendar,
  faClock,
  faLocationDot,
  faCheckCircle,
  faShareNodes,
  faPrint,
  faCopy,
  faCheck,
  faShieldHalved,
  faFilm,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function PublicTicketView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPublicTicket = async () => {
      if (!bookingId) {
        setError('No booking ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await API.get(`/bookings/public/${bookingId}`);
        if (res.data && res.data.success && res.data.booking) {
          setBooking(res.data.booking);
        } else {
          setError(res.data?.error || 'Ticket not found or has been removed');
        }
      } catch (err) {
        console.error('Failed to load public ticket:', err);
        setError(err.response?.data?.error || 'Unable to retrieve ticket details. Please verify the link.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicTicket();
  }, [bookingId]);

  // Generate dynamic scannable QR Code
  useEffect(() => {
    if (!booking) return;

    const currentUrl = window.location.href;
    QRCode.toDataURL(currentUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate public QR code:', err));
  }, [booking]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const movieTitle = booking?.movieName || 'Movie';

    if (navigator.share) {
      try {
        await navigator.share({
          title: `iMovies Ticket: ${movieTitle}`,
          text: `Check out my verified movie ticket for ${movieTitle} at ${booking?.theatreName} (${booking?.showDate} - ${booking?.showTime})!`,
          url: shareUrl
        });
        toast.success('Shared successfully!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Ticket link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
      } catch (e) {
        toast.info(shareUrl);
      }
    } else {
      toast.info(shareUrl);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
        <Header />
        <main className="container flex-grow-1 d-flex align-items-center justify-content-center py-5">
          <Loader message="Verifying cinema ticket..." fullScreen={false} />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
        <Header />
        <main className="container flex-grow-1 d-flex align-items-center justify-content-center py-5">
          <div className="dark-card text-center p-5 rounded-4 shadow" style={{ maxWidth: '480px', border: '1px solid #2a3142' }}>
            <div className="mb-3 text-danger" style={{ fontSize: '3.5rem' }}>
              ⚠️
            </div>
            <h3 className="fw-bold text-white mb-2">Ticket Not Found</h3>
            <p className="text-secondary mb-4">{error || 'This ticket could not be loaded.'}</p>
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-outline-light px-4 rounded-pill" onClick={() => navigate('/home')}>
                Browse Movies
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const seats = Array.isArray(booking.selectedSeats)
    ? booking.selectedSeats.join(', ')
    : booking.selectedSeats || 'N/A';

  const poster =
    booking.posterUrl ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80';

  const isConfirmed =
    booking.paymentStatus === 'Completed' || booking.paymentStatus === 'Confirmed';

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .ticket-print-wrapper, .ticket-print-wrapper * {
            visibility: visible !important;
          }
          .ticket-print-wrapper {
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
          .ticket-print-wrapper * {
            color: #000000 !important;
            border-color: #333333 !important;
          }
          .ticket-print-wrapper .text-secondary {
            color: #555555 !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <main className="container flex-grow-1 py-4 px-3 px-md-4" style={{ maxWidth: '900px' }}>
        {/* Navigation & Action Bar */}
        <div className="d-flex justify-content-between align-items-center mb-4 print-hide flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3"
            onClick={() => navigate('/home')}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back to Movies</span>
          </button>

          <div className="d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 fw-semibold"
              onClick={handleShare}
            >
              <FontAwesomeIcon icon={copied ? faCheck : faShareNodes} />
              <span>{copied ? 'Link Copied!' : 'Share Ticket'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary-red btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3"
              onClick={handlePrint}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span>Print Ticket</span>
            </button>
          </div>
        </div>

        {/* Verified Badge Header */}
        <div className="text-center mb-4 print-hide">
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-success bg-opacity-25 border border-success text-success fw-semibold small mb-2">
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>Verified Official E-Ticket</span>
          </div>
          <h2 className="fw-bold text-white mb-1">Cinema Admission Pass</h2>
          <p className="text-secondary small mb-0">Present this digital ticket at the auditorium entrance scanner</p>
        </div>

        {/* E-Ticket Card */}
        <div
          className="ticket-print-wrapper dark-card rounded-4 overflow-hidden shadow-lg position-relative"
          style={{
            backgroundColor: '#151821',
            border: '2px dashed #3a4460'
          }}
        >
          <div className="d-flex flex-column flex-md-row">
            {/* Movie Poster Image Column */}
            <div
              className="col-12 col-md-4 position-relative"
              style={{ minHeight: '260px', backgroundColor: '#0d111b' }}
            >
              <img
                src={poster}
                alt={booking.movieName}
                className="w-100 h-100"
                style={{ objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80';
                }}
              />
              <div
                className="position-absolute bottom-0 start-0 end-0 p-3"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}
              >
                <div className="d-flex align-items-center gap-1 text-white fw-bold">
                  <span>🎬</span>
                  <span>
                    <span style={{ color: 'var(--primary-red)' }}>i</span>Movies Cinema
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket Details Center */}
            <div className="col-12 col-md-5 p-4 d-flex flex-column justify-content-between border-md-end border-dashed border-secondary">
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-2 py-1 small">
                    ADMIT ONE / GROUP
                  </span>
                  <span
                    className={`badge px-2 py-1 rounded-pill small ${
                      isConfirmed ? 'bg-success text-white' : 'bg-warning text-dark'
                    }`}
                  >
                    {booking.paymentStatus || 'Confirmed'}
                  </span>
                </div>

                <h3 className="fw-bold text-white mb-2" style={{ letterSpacing: '0.02em' }}>
                  {booking.movieName}
                </h3>

                <div className="d-flex align-items-center gap-2 text-secondary mb-3 small">
                  <FontAwesomeIcon icon={faLocationDot} className="text-danger" />
                  <span className="text-light fw-medium">{booking.theatreName}</span>
                </div>

                {/* Date & Time */}
                <div className="row g-2 my-2 pt-2 border-top border-secondary border-opacity-25">
                  <div className="col-6">
                    <div className="text-secondary small d-flex align-items-center gap-1">
                      <FontAwesomeIcon icon={faCalendar} />
                      <span>Date</span>
                    </div>
                    <div className="text-white fw-bold mt-1">{booking.showDate}</div>
                  </div>
                  <div className="col-6">
                    <div className="text-secondary small d-flex align-items-center gap-1">
                      <FontAwesomeIcon icon={faClock} />
                      <span>Time</span>
                    </div>
                    <div className="text-white fw-bold mt-1">{booking.showTime}</div>
                  </div>
                </div>

                {/* Seats & Price */}
                <div className="row g-2 my-2 pt-2 border-top border-secondary border-opacity-25">
                  <div className="col-7">
                    <div className="text-secondary small">Seats</div>
                    <div className="text-warning fw-bold mt-1 fs-5">{seats}</div>
                  </div>
                  <div className="col-5">
                    <div className="text-secondary small">Amount Paid</div>
                    <div className="text-white fw-bold mt-1 fs-5">
                      ₹{Number(booking.totalAmount).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-top border-secondary border-opacity-25">
                <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                  BOOKING REFERENCE ID
                </div>
                <div className="text-white font-monospace fw-bold">{booking.bookingId}</div>
              </div>
            </div>

            {/* Dynamic Scannable QR Code Column */}
            <div
              className="col-12 col-md-3 p-4 d-flex flex-column align-items-center justify-content-center text-center"
              style={{ backgroundColor: '#10131b' }}
            >
              <div
                className="rounded-3 p-2 bg-white d-flex flex-column align-items-center justify-content-center shadow-sm"
                style={{ width: '135px', height: '135px' }}
              >
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Ticket Verification QR"
                    className="img-fluid"
                    style={{ width: '120px', height: '120px' }}
                  />
                ) : (
                  <div className="spinner-border spinner-border-sm text-dark" role="status"></div>
                )}
              </div>
              <span className="fw-bold text-white-50 font-monospace mt-2" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>
                SCAN TO VERIFY
              </span>
              <div className="badge bg-success bg-opacity-25 border border-success text-success mt-1 px-2 py-1 small">
                ✓ Authentic Pass
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Policy Banner */}
        <div
          className="mt-4 p-3 rounded-3 border border-secondary border-opacity-25 print-hide"
          style={{ backgroundColor: '#151922' }}
        >
          <div className="d-flex align-items-start gap-2 text-secondary small">
            <FontAwesomeIcon icon={faShieldHalved} className="text-warning mt-1" />
            <div>
              <strong className="text-light">Official Cancellation Policy:</strong> Cancellations are permitted up to 2 hours prior to showtime. No refunds or cancellations will be processed within 2 hours of the scheduled start time.
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
