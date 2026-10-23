import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faShieldHalved,
  faRotateRight,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function Register() {
  // Step state: 'form' | 'otp'
  const [step, setStep] = useState('form');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const navigate = useNavigate();

  // Handle Resend OTP countdown
  useEffect(() => {
    let timer;
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // Step 1: Submit Registration Form
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }

    if (username.trim().length < 3 || username.trim().length > 20) {
      toast.error('Username must be between 3 and 20 characters');
      return;
    }

    if (!validateEmail(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await API.post('/auth/register', {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      if (response.data && response.data.success) {
        setRegisteredEmail(email.trim().toLowerCase());
        setStep('otp');
        setResendCountdown(30);
        setCanResend(false);
        toast.info(
          response.data.message ||
            'Verification code sent! Please check your email inbox to activate your account.'
        );
      } else {
        toast.error(response.data?.error || response.data?.message || 'Registration failed');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Registration failed. Please check your details and try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit 6-digit OTP to verify account
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    setOtpLoading(true);

    try {
      const response = await API.post('/auth/verify-otp', {
        email: registeredEmail,
        otp: cleanOtp
      });

      if (response.data && response.data.success) {
        toast.success(response.data.message || '🎉 Account verified successfully! Welcome to iMovies.');
        if (response.data.token) {
          localStorage.setItem('imovies-user-token', response.data.token);
          localStorage.setItem(
            'imovies-user',
            JSON.stringify(response.data.user || { email: registeredEmail, username, role: 'user' })
          );
          navigate('/home');
        } else {
          navigate('/login');
        }
      } else {
        toast.error(response.data?.error || 'Invalid verification code');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Verification failed. Please check the code and try again.';
      toast.error(errorMessage);
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (!canResend) return;

    try {
      setCanResend(false);
      setResendCountdown(30);
      const res = await API.post('/auth/resend-otp', { email: registeredEmail });
      toast.success(res.data?.message || 'A fresh verification OTP has been sent to your email.');
    } catch (err) {
      setCanResend(true);
      const errorMessage = err.response?.data?.error || 'Failed to resend code. Please try again.';
      toast.error(errorMessage);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #151a28 0%, #0a0d14 70%, #05060a 100%)'
      }}
    >
      <div className="w-100" style={{ maxWidth: '480px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <Link to="/landing" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '2.2rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <p className="text-secondary small mb-0">Join thousands of cinema lovers today</p>
        </div>

        {/* Auth Card */}
        <div className="dark-card p-4 p-sm-5 shadow-lg position-relative" style={{ border: '1px solid #282f44' }}>
          {step === 'form' ? (
            <>
              <h4 className="text-white fw-bold mb-2 text-center">Create Your Account</h4>
              <p className="text-secondary small text-center mb-4">
                Get instant access to live TMDB releases, seat reservations & trailers
              </p>

              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit}>
                {/* Username */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">Username (3-20 chars)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faUser} />
                    </span>
                    <input
                      type="text"
                      className="form-control form-dark"
                      placeholder="johndoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      minLength={3}
                      maxLength={20}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">Email Address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faEnvelope} />
                    </span>
                    <input
                      type="email"
                      className="form-control form-dark"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">Password (min 6 chars)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-secondary text-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      style={{ borderColor: '#333b50' }}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold">Confirm Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                {/* Notice regarding mandatory email OTP verification */}
                <div
                  className="p-3 mb-4 rounded-3 d-flex align-items-start gap-2"
                  style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.25)' }}
                >
                  <FontAwesomeIcon icon={faShieldHalved} className="text-info mt-1" />
                  <span className="text-secondary small" style={{ fontSize: '0.8rem' }}>
                    A 6-digit OTP code and confirmation link will be delivered to your email to verify your identity.
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Creating Account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              {/* Bottom link to Login */}
              <div className="text-center mt-4 pt-2 border-top border-dark">
                <p className="text-secondary small mb-0">
                  Already have an account?{' '}
                  <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: 'var(--primary-red)' }}>
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* Step 2: 6-Digit OTP Verification Screen */
            <div className="text-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '64px', height: '64px', background: 'rgba(229, 9, 20, 0.15)', border: '1px solid var(--primary-red)' }}
              >
                <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '28px', color: 'var(--primary-red)' }} />
              </div>

              <h4 className="text-white fw-bold mb-2">Verify Your Email</h4>
              <p className="text-secondary small mb-1">
                We sent a 6-digit verification code to
              </p>
              <div className="badge bg-dark border border-secondary text-info fw-semibold px-3 py-2 mb-3" style={{ fontSize: '0.9rem' }}>
                {registeredEmail}
              </div>

              <form onSubmit={handleVerifyOtp} className="mt-3">
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold mb-2">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="form-control text-center text-white fw-bold"
                    style={{
                      fontSize: '1.8rem',
                      letterSpacing: '10px',
                      background: '#0d111b',
                      border: '2px solid #333b50',
                      borderRadius: '10px',
                      padding: '12px 16px'
                    }}
                    autoFocus
                    required
                  />
                  <div className="text-secondary small mt-2">
                    ⏱ Code expires in 15 minutes
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all mb-3"
                  disabled={otpLoading || otp.length !== 6}
                >
                  {otpLoading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Verifying Code...
                    </span>
                  ) : (
                    'Verify & Activate Account'
                  )}
                </button>
              </form>

              {/* Resend Option */}
              <div className="d-flex align-items-center justify-content-between pt-3 border-top border-dark">
                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none p-0 small d-flex align-items-center gap-1"
                  onClick={() => {
                    setStep('form');
                    setOtp('');
                  }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> Back
                </button>

                <button
                  type="button"
                  className="btn btn-link text-decoration-none p-0 small fw-semibold"
                  style={{ color: canResend ? 'var(--primary-red)' : '#64748b' }}
                  onClick={handleResendOtp}
                  disabled={!canResend}
                >
                  <FontAwesomeIcon icon={faRotateRight} className="me-1" />
                  {canResend ? 'Resend Code' : `Resend in ${resendCountdown}s`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
