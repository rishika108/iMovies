import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTv,
  faLock,
  faTicket,
  faClock,
  faCalendarAlt,
  faCheckCircle,
  faExclamationTriangle,
  faShieldHalved,
  faArrowLeft,
  faCreditCard,
  faQrcode
} from '@fortawesome/free-solid-svg-icons';

const BALCONY_ROWS = ['A', 'B', 'C'];
const BALCONY_COLS = 10;
const MIDDLE_ROWS = ['D', 'E', 'F', 'G', 'H'];
const MIDDLE_COLS = 12;
const LOWER_ROWS = ['I', 'J', 'K', 'L', 'M', 'N', 'O'];
const LOWER_COLS = 14;

export default function SeatSlug() {
  const { showId } = useParams();
  const navigate = useNavigate();

  const [show, setShow] = useState(null);
  const [movie, setMovie] = useState(null);
  const [tickets, setTickets] = useState({});
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow States
  const [isLocked, setIsLocked] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [createdBookingId, setCreatedBookingId] = useState(null);

  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // Retrieve userEmail from localStorage
  const userToken = localStorage.getItem('imovies-user-token');
  let userEmail = '';
  try {
    const storedUser = localStorage.getItem('imovies-user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      userEmail = (parsed.email || '').toLowerCase();
    }
  } catch (e) {
    console.error('Error parsing stored user:', e);
  }

  // Fetch show details
  const fetchShowData = async () => {
    try {
      const res = await API.get(`/shows/${showId}`);
      const showData = res.data?.show || res.data;
      if (showData) {
        setShow(showData);
        setTickets(showData.tickets || {});

        // Fetch Movie Details if movieId is present
        if (showData.movieId) {
          try {
            const mRes = await API.get(`/movies/${showData.movieId}`);
            setMovie(mRes.data?.movie || mRes.data);
          } catch (mErr) {
            console.warn('Could not load movie info:', mErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load show details:', err);
      toast.error('Unable to retrieve show information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowData();
  }, [showId]);

  // Connect to Socket.IO server & join room
  useEffect(() => {
    const backendHost =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '') ||
      'https://imovies1802.onrender.com';

    const socketHost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? (import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//localhost:5000`)
        : backendHost;
    const socket = io(socketHost, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:show', showId);
    });

    // Real-time seat updates
    const handleSeatUpdate = (data) => {
      if (data && (!data.showId || data.showId === showId)) {
        if (data.tickets) {
          setTickets((prev) => ({ ...prev, ...data.tickets }));
        } else {
          // Re-fetch to ensure fresh data
          fetchShowData();
        }
      }
    };

    socket.on('seat:updated', handleSeatUpdate);
    socket.on('seats:locked', handleSeatUpdate);
    socket.on('seats:booked', handleSeatUpdate);
    socket.on('seats:cancelled', handleSeatUpdate);
    socket.on('show:updated', handleSeatUpdate);

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [showId]);

  // Timer countdown management
  useEffect(() => {
    if (isLocked && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsLocked(false);
            setSelectedSeats([]);
            toast.warn('Lock expired! Your reserved seats have been released.');
            fetchShowData();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLocked, timeLeft]);

  // Helper to get status of a seat
  const getSeatStatus = (seatId) => {
    const ticket = tickets[seatId];
    if (!ticket) return 'available';

    // Check if booked
    if (ticket.status === 'booked') return 'booked';

    // Check if locked
    if (ticket.status === 'locked') {
      // If locked by current user in active session
      if (userEmail && ticket.lockedBy && ticket.lockedBy.toLowerCase() === userEmail.toLowerCase()) {
        if (selectedSeats.includes(seatId)) return 'selected';
      }
      return 'locked';
    }

    // Check if currently selected by user in UI
    if (selectedSeats.includes(seatId)) {
      return 'selected';
    }

    return 'available';
  };

  // Helper to get price of a seat
  const getSeatPrice = (seatId, tier) => {
    const ticket = tickets[seatId];
    if (ticket && ticket.price) return ticket.price;
    if (tier === 'balcony') return 300;
    if (tier === 'middle') return 200;
    return 150;
  };

  // Seat Click Handler
  const handleSeatClick = (seatId, tier) => {
    if (isLocked) {
      toast.info('Seats are already locked. Proceed to Confirm Booking or wait for expiry.');
      return;
    }

    const status = getSeatStatus(seatId);

    if (status === 'booked') {
      toast.error(`Seat ${seatId} is already booked.`);
      return;
    }

    if (status === 'locked') {
      toast.error(`Seat ${seatId} is currently locked by another customer.`);
      return;
    }

    // Toggle Selection
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((s) => s !== seatId);
      } else {
        if (prev.length >= 8) {
          toast.warn('Maximum 8 seats can be selected per booking');
          return prev;
        }
        return [...prev, seatId];
      }
    });
  };

  // Calculate pricing breakdown
  const calculatePricing = () => {
    let balconyCount = 0;
    let middleCount = 0;
    let lowerCount = 0;
    let balconyTotal = 0;
    let middleTotal = 0;
    let lowerTotal = 0;

    selectedSeats.forEach((seatId) => {
      const row = seatId.charAt(0);
      if (BALCONY_ROWS.includes(row)) {
        balconyCount++;
        balconyTotal += getSeatPrice(seatId, 'balcony');
      } else if (MIDDLE_ROWS.includes(row)) {
        middleCount++;
        middleTotal += getSeatPrice(seatId, 'middle');
      } else {
        lowerCount++;
        lowerTotal += getSeatPrice(seatId, 'lower');
      }
    });

    const subtotal = balconyTotal + middleTotal + lowerTotal;
    const bookingFee = selectedSeats.length > 0 ? selectedSeats.length * 20 : 0;
    const grandTotal = subtotal + bookingFee;

    return {
      balconyCount,
      middleCount,
      lowerCount,
      balconyTotal,
      middleTotal,
      lowerTotal,
      subtotal,
      bookingFee,
      grandTotal
    };
  };

  const pricing = calculatePricing();

  // Lock Seats Handler
  const handleLockSeats = async () => {
    if (!userToken) {
      toast.info('Please log in to proceed with booking');
      navigate('/login');
      return;
    }

    if (selectedSeats.length === 0) {
      toast.warn('Please select at least one seat to lock');
      return;
    }

    setLockingInProgress(true);
    try {
      const res = await API.post('/bookings/lock', {
        showId,
        selectedSeats,
        userEmail
      });

      if (res.data && res.data.success) {
        setIsLocked(true);
        setTimeLeft(600); // 10 minutes = 600s
        toast.success('Seats locked for 10 minutes! Please confirm your booking.');
      } else {
        toast.error(res.data?.error || 'Failed to lock seats');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to lock seats';
      toast.error(msg);
    } finally {
      setLockingInProgress(false);
    }
  };

  // Dynamic script loader for Razorpay Checkout SDK
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.onload = () => resolve(true);
        existingScript.onerror = () => resolve(false);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // ── 5-Step Razorpay Transaction Flow ──────────────────────────────────────────
  // Step 1: Selection - User clicks Proceed to Pay
  // Step 2: Frontend API Call - POST /api/payment/create-order
  // Step 3: Gateway Communication - Order ID generated with Razorpay
  // Step 4: Checkout Modal & Verification - window.Razorpay -> POST /api/payment/verify
  // Step 5: Confirmation & Notification - Redirect to /bookings with ticket generated
  const handleConfirmBooking = async () => {
    if (!userToken) {
      toast.info('Please log in to confirm booking');
      navigate('/login');
      return;
    }

    if (!isLocked) {
      toast.warn('Please lock your seats before confirming booking');
      return;
    }

    setBookingInProgress(true);
    try {
      // Ensure Razorpay SDK script is ready
      const isSdkLoaded = await loadRazorpayScript();
      if (!isSdkLoaded) {
        toast.error('Unable to initialize Razorpay SDK. Please check your internet connection.');
        setBookingInProgress(false);
        return;
      }

      // Step 1: Create initial Pending booking in MongoDB
      const createRes = await API.post('/bookings', {
        showId,
        selectedSeats,
        movieId: show.movieId,
        movieName: movie?.movieName || movie?.title || show.theatreName,
        theatreName: show.theatreName,
        showDate: show.showDate,
        showTime: show.showTime,
        totalAmount: pricing.grandTotal
      });

      const newBooking = createRes.data?.booking;
      if (!newBooking || !newBooking.bookingId) {
        throw new Error('Failed to create booking order');
      }

      setCreatedBookingId(newBooking.bookingId);

      // Step 2 & 3: Create Order via Backend (amount in paise)
      const orderRes = await API.post('/payment/create-order', {
        bookingId: newBooking.bookingId,
        amount: pricing.grandTotal,
        currency: 'INR'
      });

      if (!orderRes.data || !orderRes.data.success) {
        throw new Error(orderRes.data?.error || 'Failed to initialize payment gateway order');
      }

      const { orderId, amount, currency, key } = orderRes.data;
      const razorpayKey = key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TpNJvdvA0P93UL';
      const parsedUser = JSON.parse(localStorage.getItem('imovies-user') || '{}');

      // Step 4: Launch Razorpay Checkout Modal
      const options = {
        key: razorpayKey,
        amount: amount,
        currency: currency || 'INR',
        name: 'iMovies Cinema Experience',
        description: `Tickets for ${movieTitle} (${selectedSeats.join(', ')})`,
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=128&q=80',
        order_id: orderId,
        prefill: {
          name: parsedUser.username || 'Movie Enthusiast',
          email: userEmail || parsedUser.email || '',
          contact: parsedUser.phone || '9999999999',
          method: 'upi'
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay using UPI (Google Pay, PhonePe, Paytm, BHIM, QR)',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['collect', 'intent', 'qr']
                  }
                ]
              },
              cards: {
                name: 'Debit / Credit Cards',
                instruments: [{ method: 'card' }]
              },
              netbanking: {
                name: 'NetBanking & Wallets',
                instruments: [{ method: 'netbanking' }, { method: 'wallet' }]
              }
            },
            sequence: ['block.upi', 'block.cards', 'block.netbanking'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        notes: {
          bookingId: newBooking.bookingId,
          theatre: show.theatreName,
          showDate: show.showDate,
          showTime: show.showTime,
          upi_methods: 'gpay,phonepe,paytm,bhim,upi_qr'
        },
        theme: {
          color: '#e50914'
        },
        handler: async function (response) {
          // Cryptographic HMAC Verification Call
          try {
            setBookingInProgress(true);
            const verifyRes = await API.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: newBooking.bookingId
            });

            if (verifyRes.data && verifyRes.data.success) {
              // Step 5: Confirmation & Redirection
              toast.success('🎉 Payment Verified! Your movie tickets are confirmed.');
              setIsLocked(false);
              navigate('/bookings');
            } else {
              toast.error(verifyRes.data?.error || 'Payment signature verification failed.');
            }
          } catch (verErr) {
            console.error('Verification error:', verErr);
            toast.error(verErr.response?.data?.error || 'Server error during payment verification');
          } finally {
            setBookingInProgress(false);
          }
        },
        modal: {
          ondismiss: function () {
            toast.info('Payment window closed. Your seats remain locked for the countdown period.');
            setBookingInProgress(false);
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', function (failResponse) {
        console.error('Payment failed:', failResponse.error);
        toast.error(`Payment failed: ${failResponse.error?.description || 'Transaction unsuccessful'}`);
        setBookingInProgress(false);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Payment initiation error:', err);
      const msg = err.response?.data?.error || err.message || 'Payment initiation failed';
      toast.error(msg);
      setBookingInProgress(false);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-dark text-white d-flex flex-column">
        <Header />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <Loader message="Loading interactive seat map..." fullScreen={false} />
        </div>
        <Footer />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-vh-100 bg-dark text-white d-flex flex-column">
        <Header />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center text-center p-4">
          <div className="dark-card p-5">
            <h3 className="text-white fw-bold mb-3">Show Unavailable</h3>
            <p className="text-secondary mb-4">The show could not be found or has expired.</p>
            <button className="btn btn-primary-red" onClick={() => navigate('/home')}>
              Back to Movies
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const movieTitle = movie?.movieName || movie?.name || movie?.title || 'Movie Experience';

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid flex-grow-1 px-3 px-md-4 py-4" style={{ maxWidth: '1400px' }}>
        {/* Top Header Information */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-3 mb-4 border-bottom border-dark">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-sm btn-outline-secondary mb-2 d-inline-flex align-items-center gap-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back</span>
            </button>
            <h3 className="fw-bold mb-1 text-white">
              {movieTitle}
            </h3>
            <div className="text-secondary small d-flex flex-wrap align-items-center gap-3">
              <span><strong>Theatre:</strong> {show.theatreName}</span>
              <span>•</span>
              <span><FontAwesomeIcon icon={faCalendarAlt} className="me-1" />{show.showDate}</span>
              <span>•</span>
              <span><FontAwesomeIcon icon={faClock} className="me-1" />{show.showTime}</span>
            </div>
          </div>

          {/* Timer Banner (if locked) */}
          {isLocked && (
            <div className="badge bg-warning bg-opacity-25 border border-warning text-warning px-3 py-2 fs-6 rounded-pill d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <span>Seats Locked: <strong>{formatTime(timeLeft)}</strong></span>
            </div>
          )}
        </div>

        <div className="row g-4">
          {/* Left / Center: Interactive Seat Layout */}
          <div className="col-12 col-xl-8">
            <div className="dark-card p-4 text-center overflow-auto shadow-sm" style={{ border: '1px solid #23293b' }}>
              {/* Screen Representation */}
              <div className="mb-4" style={{ perspective: '300px' }}>
                <div
                  className="screen-curved mx-auto"
                  style={{
                    maxWidth: '560px',
                    height: '10px',
                    transform: 'rotateX(-20deg)',
                    boxShadow: '0 10px 25px rgba(229, 9, 20, 0.45)'
                  }}
                ></div>
                <div className="text-secondary fw-semibold small mt-2 letter-spacing" style={{ letterSpacing: '4px' }}>
                  --- CINEMA SCREEN ---
                </div>
              </div>

              {/* TIER 1: BALCONY */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2 px-3">
                  <span className="badge bg-danger bg-opacity-20 text-danger border border-danger fw-semibold px-2 py-1">
                    BALCONY TIER (₹300)
                  </span>
                  <span className="text-secondary small">Premium Viewing</span>
                </div>
                <div className="d-inline-block">
                  {BALCONY_ROWS.map((row) => (
                    <div key={row} className="d-flex align-items-center justify-content-center mb-1">
                      <span className="text-secondary fw-bold me-2" style={{ width: '20px' }}>
                        {row}
                      </span>
                      <div className="d-flex">
                        {Array.from({ length: BALCONY_COLS }, (_, i) => {
                          const seatId = `${row}${i + 1}`;
                          const status = getSeatStatus(seatId);
                          return (
                            <div
                              key={seatId}
                              className={`seat ${status}`}
                              onClick={() => handleSeatClick(seatId, 'balcony')}
                              title={`Seat ${seatId} - ₹300 (${status})`}
                            >
                              {i + 1}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIER 2: MIDDLE */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2 px-3">
                  <span className="badge bg-primary bg-opacity-20 text-primary border border-primary fw-semibold px-2 py-1">
                    MIDDLE TIER (₹200)
                  </span>
                  <span className="text-secondary small">Standard Comfort</span>
                </div>
                <div className="d-inline-block">
                  {MIDDLE_ROWS.map((row) => (
                    <div key={row} className="d-flex align-items-center justify-content-center mb-1">
                      <span className="text-secondary fw-bold me-2" style={{ width: '20px' }}>
                        {row}
                      </span>
                      <div className="d-flex">
                        {Array.from({ length: MIDDLE_COLS }, (_, i) => {
                          const seatId = `${row}${i + 1}`;
                          const status = getSeatStatus(seatId);
                          return (
                            <div
                              key={seatId}
                              className={`seat ${status}`}
                              onClick={() => handleSeatClick(seatId, 'middle')}
                              title={`Seat ${seatId} - ₹200 (${status})`}
                            >
                              {i + 1}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIER 3: LOWER */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2 px-3">
                  <span className="badge bg-secondary bg-opacity-25 text-light border border-secondary fw-semibold px-2 py-1">
                    LOWER TIER (₹150)
                  </span>
                  <span className="text-secondary small">Budget Friendly</span>
                </div>
                <div className="d-inline-block">
                  {LOWER_ROWS.map((row) => (
                    <div key={row} className="d-flex align-items-center justify-content-center mb-1">
                      <span className="text-secondary fw-bold me-2" style={{ width: '20px' }}>
                        {row}
                      </span>
                      <div className="d-flex">
                        {Array.from({ length: LOWER_COLS }, (_, i) => {
                          const seatId = `${row}${i + 1}`;
                          const status = getSeatStatus(seatId);
                          return (
                            <div
                              key={seatId}
                              className={`seat ${status}`}
                              onClick={() => handleSeatClick(seatId, 'lower')}
                              title={`Seat ${seatId} - ₹150 (${status})`}
                            >
                              {i + 1}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seat Legend */}
              <div className="pt-4 border-top border-dark d-flex flex-wrap justify-content-center gap-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="seat available m-0" style={{ cursor: 'default' }}></div>
                  <span className="small text-secondary">Available</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="seat selected m-0" style={{ cursor: 'default' }}></div>
                  <span className="small text-secondary">Selected</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="seat locked m-0" style={{ cursor: 'default' }}></div>
                  <span className="small text-secondary">Locked (10m)</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="seat booked m-0" style={{ cursor: 'default' }}></div>
                  <span className="small text-secondary">Booked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Panel: Booking Summary & Checkout */}
          <div className="col-12 col-xl-4">
            <div className="dark-card p-4 shadow-sm position-sticky" style={{ top: '85px', border: '1px solid #23293b' }}>
              <h4 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faTicket} style={{ color: 'var(--primary-red)' }} />
                <span>Booking Summary</span>
              </h4>

              {/* Selected Seats Badges */}
              <div className="mb-4">
                <label className="form-label small text-secondary fw-semibold">
                  Selected Seats ({selectedSeats.length})
                </label>
                {selectedSeats.length === 0 ? (
                  <p className="text-secondary small mb-0">No seats selected. Click any green seat to select.</p>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {selectedSeats.map((seat) => (
                      <span
                        key={seat}
                        className="badge bg-primary px-3 py-2 rounded-2 fs-6 fw-bold"
                        style={{ backgroundColor: 'var(--primary-blue)' }}
                      >
                        {seat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-3 rounded-3 mb-4" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
                <h6 className="fw-bold text-white mb-2">Price Breakdown</h6>
                <div className="d-flex flex-column gap-2 small text-secondary">
                  {pricing.balconyCount > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Balcony ({pricing.balconyCount} × ₹300)</span>
                      <span className="text-white fw-semibold">₹{pricing.balconyTotal}</span>
                    </div>
                  )}
                  {pricing.middleCount > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Middle ({pricing.middleCount} × ₹200)</span>
                      <span className="text-white fw-semibold">₹{pricing.middleTotal}</span>
                    </div>
                  )}
                  {pricing.lowerCount > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Lower ({pricing.lowerCount} × ₹150)</span>
                      <span className="text-white fw-semibold">₹{pricing.lowerTotal}</span>
                    </div>
                  )}
                  {selectedSeats.length > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Convenience Fee (₹20/seat)</span>
                      <span className="text-white fw-semibold">₹{pricing.bookingFee}</span>
                    </div>
                  )}
                  <hr className="my-2 border-secondary" />
                  <div className="d-flex justify-content-between fs-6 fw-bold text-white">
                    <span>Total Amount</span>
                    <span style={{ color: 'var(--primary-red)' }}>₹{pricing.grandTotal}</span>
                  </div>
                </div>
              </div>

              {/* Lock Warning */}
              {isLocked ? (
                <div className="alert alert-warning py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <span>
                    Seats held for <strong>{formatTime(timeLeft)}</strong>. Complete checkout to finalize your tickets.
                  </span>
                </div>
              ) : (
                <div className="alert alert-dark py-2 px-3 small rounded-3 mb-3 text-secondary border border-secondary">
                  <span>Step 1: Lock your selected seats to hold them for 10 minutes.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="d-flex flex-column gap-2">
                {/* 1. Lock Seats Button */}
                <button
                  type="button"
                  className="btn btn-primary-blue w-100 py-2 fw-bold"
                  onClick={handleLockSeats}
                  disabled={selectedSeats.length === 0 || isLocked || lockingInProgress}
                >
                  {lockingInProgress ? (
                    'Locking Seats...'
                  ) : isLocked ? (
                    '✓ Seats Locked'
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faLock} />
                      <span>Lock Seats</span>
                    </>
                  )}
                </button>

                {/* 2. Confirm Booking & Pay with Razorpay Button */}
                <button
                  type="button"
                  className="btn btn-primary-red w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                  onClick={handleConfirmBooking}
                  disabled={!isLocked || bookingInProgress}
                  style={{ fontSize: '0.95rem' }}
                >
                  {bookingInProgress ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Connecting Razorpay Gateway...
                    </span>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCreditCard} />
                      <span>Proceed to Pay ₹{pricing.grandTotal}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Razorpay Trust Badges & Supported Methods */}
              <div className="mt-3 text-center">
                <div className="d-flex flex-wrap align-items-center justify-content-center gap-1 mb-2">
                  <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    <FontAwesomeIcon icon={faQrcode} className="me-1 text-danger" />
                    UPI QR Code
                  </span>
                  <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    Google Pay
                  </span>
                  <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    PhonePe
                  </span>
                  <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    Paytm / BHIM
                  </span>
                  <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    Cards & NetBanking
                  </span>
                </div>
                <div className="text-secondary" style={{ fontSize: '0.72rem' }}>
                  🔒 Powered by <strong>Razorpay</strong> • Instant Test UPI & Cards
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
