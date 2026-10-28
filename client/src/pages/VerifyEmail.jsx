import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleXmark,
  faEnvelope,
  faKey,
  faRotateRight,
  faArrowRight,
  faShieldHalved,
  faLock,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlToken = searchParams.get('token');
  const urlEmail = searchParams.get('email');

  // Modes: 'token-loading' | 'token-success' | 'otp-form'
  const [mode, setMode] = useState(urlToken ? 'token-loading' : 'otp-form');
  const [email, setEmail] = useState(
    urlEmail || localStorage.getItem('pendingVerificationEmail') || ''
  );
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [tokenSuccessMessage, setTokenSuccessMessage] = useState('');

  const otpInputRef = useRef(null);

  // Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Handle Direct URL Token Verification (if link clicked from email)
  useEffect(() => {
    if (!urlToken || !urlEmail) return;

    const verifyToken = async () => {
      try {
        const res = await API.post('/auth/verify-email', {
          token: urlToken,
          email: urlEmail.trim().toLowerCase()
        });

        if (res.data && res.data.success) {
          setMode('token-success');
          setTokenSuccessMessage(res.data.message || 'Your email has been successfully verified!');
          toast.success(res.data.message || '🎉 Email verified successfully! Welcome to iMovies.');

          if (res.data.token) {
            localStorage.setItem('imovies-user-token', res.data.token);
            if (res.data.user) {
              localStorage.setItem('imovies-user', JSON.stringify(res.data.user));
            }
          }
          localStorage.removeItem('pendingVerificationEmail');

          setTimeout(() => {
            navigate('/home');
          }, 2000);
        } else {
          toast.error(res.data?.error || 'Verification link is invalid or has expired.');
          setMode('otp-form');
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.error ||
          'Verification link has expired or is invalid. Please verify using your 6-digit OTP code below.';
        toast.error(errorMsg);
        setMode('otp-form');
      }
    };

    verifyToken();
  }, [urlToken, urlEmail, navigate]);

  // Handle 6-Digit OTP Submission
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your account email address.');
      return;
    }

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the full 6-digit verification code.');
      if (otpInputRef.current) otpInputRef.current.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await API.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: cleanOtp
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || '🎉 Account verified successfully! Welcome to iMovies.');
        if (res.data.token) {
          localStorage.setItem('imovies-user-token', res.data.token);
          if (res.data.user) {
            localStorage.setItem('imovies-user', JSON.stringify(res.data.user));
          }
        }
        localStorage.removeItem('pendingVerificationEmail');
        navigate('/home');
      } else {
        toast.error(res.data?.error || 'Invalid verification code. Please check and try again.');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Verification failed. Please check the code and try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP Code
  const handleResendOtp = async () => {
    if (!canResend || resending) return;

    if (!email.trim()) {
      toast.error('Please enter your account email to resend verification code.');
      return;
    }

    setResending(true);

    try {
      const res = await API.post('/auth/resend-otp', {
        email: email.trim().toLowerCase()
      });

      if (res.data && res.data.success) {
        setResendCountdown(30);
        setCanResend(false);
        const successMsg =
          res.data.message || 'A fresh 6-digit verification code has been dispatched to your email.';
        toast.success(successMsg);

        // Dev mode fallback awareness
        if (res.data.devOtp) {
          setDevOtpHint(res.data.devOtp);
          setOtp(res.data.devOtp);
          toast.info(`[Dev Mode] Generated OTP: ${res.data.devOtp}`, { autoClose: 8000 });
        }
      } else {
        toast.error(res.data?.error || 'Failed to resend verification code. Please try again.');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to resend verification code. Please check your network and try again.';
      toast.error(errorMsg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #151a28 0%, #0a0d14 70%, #05060a 100%)'
      }}
    >
      <div className="w-100" style={{ maxWidth: '460px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <Link to="/landing" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '2.4rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <div className="text-secondary small">Cinema Ticketing & Account Security</div>
        </div>

        {/* Mode 1: Token Verifying State */}
        {mode === 'token-loading' && (
          <div className="dark-card p-4 p-sm-5 text-center shadow-lg" style={{ border: '1px solid #282f44' }}>
            <div
              className="spinner-border text-danger mb-3"
              style={{ width: '3.2rem', height: '3.2rem' }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <h4 className="text-white fw-bold mb-2">Verifying Your Account</h4>
            <p className="text-secondary small mb-0">
              Validating your one-click verification credentials. Please wait...
            </p>
          </div>
        )}

        {/* Mode 2: Token Verification Success */}
        {mode === 'token-success' && (
          <div className="dark-card p-4 p-sm-5 text-center shadow-lg" style={{ border: '1px solid #282f44' }}>
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{
                width: '68px',
                height: '68px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid #22c55e'
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '36px', color: '#4ade80' }} />
            </div>
            <h4 className="text-white fw-bold mb-2">Email Verified!</h4>
            <p className="text-secondary small mb-3">{tokenSuccessMessage}</p>
            <div className="text-secondary small mb-4">Redirecting you to the movie dashboard...</div>
            <Link to="/home" className="btn btn-primary-red w-100 fw-bold py-2">
              Continue to iMovies <FontAwesomeIcon icon={faArrowRight} className="ms-1" />
            </Link>
          </div>
        )}

        {/* Mode 3: Manual 6-Digit OTP Form & Resend Handler */}
        {mode === 'otp-form' && (
          <div className="dark-card p-4 p-sm-5 shadow-lg" style={{ border: '1px solid #282f44' }}>
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'rgba(229, 9, 20, 0.12)',
                  border: '1px solid rgba(229, 9, 20, 0.3)'
                }}
              >
                <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '24px', color: '#e50914' }} />
              </div>
              <h4 className="text-white fw-bold mb-1">Verify Your Email</h4>
              <p className="text-secondary small mb-0">
                Enter the 6-digit verification code sent to your email inbox to activate your account.
              </p>
            </div>

            {/* Dev Mode Banner (If present) */}
            {devOtpHint && (
              <div
                className="p-3 mb-3 rounded-3 border small"
                style={{
                  backgroundColor: 'rgba(2, 132, 199, 0.12)',
                  borderColor: '#0284c7',
                  color: '#bae6fd'
                }}
              >
                <div className="d-flex align-items-center gap-2 fw-semibold">
                  <span>ℹ️</span>
                  <span>Dev Mode Notice:</span>
                </div>
                <div className="mt-1">
                  OTP Code auto-detected: <strong className="font-monospace text-white">{devOtpHint}</strong> (Also printed in server console)
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              {/* Email Input Field */}
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Account Email</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <input
                    type="email"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 6-Digit OTP Field */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label text-secondary small fw-semibold mb-0">
                    6-Digit Verification Code
                  </label>
                  <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50" style={{ fontSize: '0.68rem' }}>
                    15 Min Expiry
                  </span>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faKey} />
                  </span>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="form-control bg-dark text-white border-secondary text-center font-monospace fw-bold fs-4"
                    style={{ letterSpacing: '8px' }}
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setOtp(val);
                    }}
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary-red w-100 fw-bold py-2 mb-3"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Verifying Code...
                  </span>
                ) : (
                  'Verify & Activate Account'
                )}
              </button>

              {/* Resend Action */}
              <div className="text-center pt-2 border-top border-dark">
                <div className="text-secondary small mb-2">Didn't receive the email or code?</div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3 rounded-pill fw-semibold"
                  onClick={handleResendOtp}
                  disabled={!canResend || resending}
                >
                  {resending ? (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Resending...
                    </span>
                  ) : resendCountdown > 0 ? (
                    <span>
                      <FontAwesomeIcon icon={faRotateRight} className="me-1" />
                      Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <span>
                      <FontAwesomeIcon icon={faRotateRight} className="me-1" />
                      Resend Verification Code
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Navigation links */}
            <div className="mt-4 pt-3 border-top border-dark text-center small text-secondary">
              <div className="d-flex justify-content-between align-items-center">
                <Link to="/login" className="text-decoration-none text-secondary hover-white">
                  <FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back to Sign In
                </Link>
                <Link to="/register" className="text-decoration-none text-danger hover-white fw-semibold">
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
