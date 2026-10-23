import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faUser,
  faUserShield,
  faShieldHalved,
  faKey,
  faArrowLeft,
  faRotateRight,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verification OTP Modal state (when user is unverified)
  const [showOtpView, setShowOtpView] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Forgot Password modal state
  // null | 'email' | 'reset'
  const [forgotModal, setForgotModal] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const navigate = useNavigate();

  // Check URL query parameters (e.g. ?verified=true&email=...)
  useEffect(() => {
    const verified = searchParams.get('verified');
    const paramEmail = searchParams.get('email');
    if (paramEmail) {
      setEmail(paramEmail);
    }
    if (verified === 'true') {
      toast.success('🎉 Your email address has been verified! You can now log in.');
    }
  }, [searchParams]);

  // Resend Countdown timer
  useEffect(() => {
    let timer;
    if (showOtpView && resendCountdown > 0) {
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
  }, [showOtpView, resendCountdown]);

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // Main Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!validateEmail(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!password) {
      toast.error('Password is required');
      return;
    }

    setLoading(true);

    try {
      const endpoint = role === 'admin' ? '/auth/admin/login' : '/auth/login';
      const response = await API.post(endpoint, {
        email: email.trim().toLowerCase(),
        password
      });

      if (response.data && response.data.success) {
        toast.success(`Welcome back! Logged in as ${role === 'admin' ? 'Administrator' : 'User'}`);

        if (role === 'admin') {
          localStorage.setItem('imovies-admin-token', response.data.token);
          localStorage.setItem('imovies-admin', JSON.stringify(response.data.admin || { email }));
          navigate('/admin');
        } else {
          localStorage.setItem('imovies-user-token', response.data.token);
          localStorage.setItem('imovies-user', JSON.stringify(response.data.user || { email }));
          navigate('/home');
        }
      } else {
        toast.error(response.data?.error || response.data?.message || 'Login failed.');
      }
    } catch (err) {
      // Check if unverified user
      if (err.response?.data?.requireVerification) {
        const targetEmail = err.response.data.email || email.trim().toLowerCase();
        setOtpEmail(targetEmail);
        setShowOtpView(true);
        setResendCountdown(30);
        setCanResend(false);
        toast.warning(
          err.response.data.error ||
            'Your account requires email verification. We just sent a 6-digit OTP to your email.'
        );
        return;
      }

      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to connect to the server. Please check your credentials.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP for unverified account activation
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await API.post('/auth/verify-otp', {
        email: otpEmail,
        otp: cleanOtp
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || 'Account activated successfully!');
        if (res.data.token) {
          localStorage.setItem('imovies-user-token', res.data.token);
          localStorage.setItem(
            'imovies-user',
            JSON.stringify(res.data.user || { email: otpEmail, role: 'user' })
          );
          navigate('/home');
        } else {
          setShowOtpView(false);
          setPassword('');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed. Please check the code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP for unverified account
  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      setCanResend(false);
      setResendCountdown(30);
      const res = await API.post('/auth/resend-otp', { email: otpEmail });
      toast.success(res.data?.message || 'A fresh code has been sent to your email.');
    } catch (err) {
      setCanResend(true);
      toast.error(err.response?.data?.error || 'Failed to resend code');
    }
  };

  // Step 1 Forgot Password: Request OTP
  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !validateEmail(forgotEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await API.post('/auth/forgot-password', {
        email: forgotEmail.trim().toLowerCase()
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || 'Reset code sent to your email.');
        setForgotModal('reset');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate password reset');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2 Forgot Password: Submit OTP & New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      toast.error('Please enter the 6-digit reset code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await API.post('/auth/reset-password', {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        newPassword
      });

      if (res.data && res.data.success) {
        toast.success('🎉 Password reset successfully! Please sign in with your new password.');
        setEmail(forgotEmail);
        setPassword('');
        setForgotModal(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password. Please check the code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #151a28 0%, #0a0d14 70%, #05060a 100%)'
      }}
    >
      <div className="w-100" style={{ maxWidth: '420px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <Link to="/landing" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '2.2rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <p className="text-secondary small mb-0">Sign in to manage your tickets and preferences</p>
        </div>

        {/* Auth Card */}
        <div className="dark-card p-4 p-sm-5 shadow-lg position-relative" style={{ border: '1px solid #282f44' }}>
          {/* View 1: Standard Login Form */}
          {!showOtpView && !forgotModal && (
            <>
              {/* Role Toggle Tabs */}
              <div className="d-flex rounded-3 p-1 mb-4" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
                <button
                  type="button"
                  className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                    role === 'user' ? 'btn-danger shadow-sm' : 'text-secondary bg-transparent'
                  }`}
                  style={role === 'user' ? { backgroundColor: 'var(--primary-red)' } : {}}
                  onClick={() => setRole('user')}
                >
                  <FontAwesomeIcon icon={faUser} />
                  <span>User</span>
                </button>
                <button
                  type="button"
                  className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                    role === 'admin' ? 'btn-primary shadow-sm' : 'text-secondary bg-transparent'
                  }`}
                  style={role === 'admin' ? { backgroundColor: 'var(--primary-blue)' } : {}}
                  onClick={() => setRole('admin')}
                >
                  <FontAwesomeIcon icon={faUserShield} />
                  <span>Admin</span>
                </button>
              </div>

              <h4 className="text-white fw-bold mb-4 text-center">
                {role === 'admin' ? 'Admin Portal' : 'Welcome Back'}
              </h4>

              {/* Form */}
              <form onSubmit={handleLoginSubmit}>
                {/* Email Field */}
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

                {/* Password Field */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small text-secondary fw-semibold mb-0">Password</label>
                  </div>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                {/* Forgot Password Link */}
                <div className="d-flex justify-content-end mb-4">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none small text-secondary hover-underline"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => {
                      setForgotEmail(email || '');
                      setForgotModal('email');
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className={`w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all ${
                    role === 'admin' ? 'btn-primary-blue' : 'btn-primary-red'
                  }`}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Signing In...
                    </span>
                  ) : (
                    `Sign In as ${role === 'admin' ? 'Admin' : 'User'}`
                  )}
                </button>
              </form>

              {/* Bottom link */}
              <div className="text-center mt-4 pt-2 border-top border-dark">
                <p className="text-secondary small mb-0">
                  Don't have an account?{' '}
                  <Link to="/register" className="fw-semibold text-decoration-none" style={{ color: 'var(--primary-red)' }}>
                    Create one now
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* View 2: Unverified Account OTP Entry */}
          {showOtpView && (
            <div className="text-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '64px', height: '64px', background: 'rgba(229, 9, 20, 0.15)', border: '1px solid var(--primary-red)' }}
              >
                <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '28px', color: 'var(--primary-red)' }} />
              </div>

              <h4 className="text-white fw-bold mb-2">Account Verification Required</h4>
              <p className="text-secondary small mb-1">
                Your email is not verified yet. Enter the 6-digit OTP sent to:
              </p>
              <div className="badge bg-dark border border-secondary text-info fw-semibold px-3 py-2 mb-3" style={{ fontSize: '0.85rem' }}>
                {otpEmail}
              </div>

              <form onSubmit={handleVerifyOtpSubmit}>
                <div className="mb-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
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
                    ⏱ Valid for 15 minutes
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all mb-3"
                  disabled={otpLoading || otpCode.length !== 6}
                >
                  {otpLoading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </form>

              <div className="d-flex align-items-center justify-content-between pt-3 border-top border-dark">
                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none p-0 small d-flex align-items-center gap-1"
                  onClick={() => setShowOtpView(false)}
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

          {/* View 3: Forgot Password - Step 1 (Request Code) */}
          {forgotModal === 'email' && (
            <div>
              <div className="text-center mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{ width: '56px', height: '56px', background: 'rgba(2, 132, 199, 0.15)', border: '1px solid #0284c7' }}
                >
                  <FontAwesomeIcon icon={faKey} style={{ fontSize: '24px', color: '#38bdf8' }} />
                </div>
                <h4 className="text-white fw-bold mb-1">Reset Password</h4>
                <p className="text-secondary small">
                  Enter your registered email address. We'll send a 6-digit OTP to reset your password.
                </p>
              </div>

              <form onSubmit={handleRequestPasswordReset}>
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold">Email Address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faEnvelope} />
                    </span>
                    <input
                      type="email"
                      className="form-control form-dark"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary-blue w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all mb-3"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Sending Code...
                    </span>
                  ) : (
                    'Send Reset OTP'
                  )}
                </button>
              </form>

              <div className="text-center pt-3 border-top border-dark">
                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none small"
                  onClick={() => setForgotModal(null)}
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* View 4: Forgot Password - Step 2 (Enter OTP + New Password) */}
          {forgotModal === 'reset' && (
            <div>
              <div className="text-center mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{ width: '56px', height: '56px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e' }}
                >
                  <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '24px', color: '#4ade80' }} />
                </div>
                <h4 className="text-white fw-bold mb-1">Set New Password</h4>
                <p className="text-secondary small mb-2">
                  Enter the 6-digit OTP code sent to:
                </p>
                <div className="badge bg-dark border border-secondary text-info fw-semibold px-2 py-1 mb-2">
                  {forgotEmail}
                </div>
              </div>

              <form onSubmit={handleResetPasswordSubmit}>
                {/* 6-Digit OTP */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">6-Digit Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="form-control text-center text-white fw-bold"
                    style={{
                      fontSize: '1.4rem',
                      letterSpacing: '6px',
                      background: '#0d111b',
                      border: '2px solid #333b50',
                      borderRadius: '8px',
                      padding: '8px'
                    }}
                    autoFocus
                    required
                  />
                </div>

                {/* New Password */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">New Password (min 6 chars)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-secondary text-secondary"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ borderColor: '#333b50' }}
                    >
                      <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold">Confirm New Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all mb-3"
                  disabled={forgotLoading || forgotOtp.length !== 6}
                >
                  {forgotLoading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Updating Password...
                    </span>
                  ) : (
                    'Reset & Save Password'
                  )}
                </button>
              </form>

              <div className="text-center pt-3 border-top border-dark">
                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none small"
                  onClick={() => setForgotModal('email')}
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
