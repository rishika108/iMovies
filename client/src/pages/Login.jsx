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
  faCheckCircle,
  faExclamationCircle,
  faKey
} from '@fortawesome/free-solid-svg-icons';

export default function Login() {
  const [role, setRole] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Email verification enforcement state
  const [unverifiedNotice, setUnverifiedNotice] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [activating, setActivating] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isVerifiedFromUrl = searchParams.get('verified') === 'true';

  useEffect(() => {
    if (isVerifiedFromUrl) {
      toast.success('🎉 Email verified successfully! You can now sign in.');
    }
  }, [isVerifiedFromUrl]);

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUnverifiedNotice(false);

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
        toast.error(response.data?.error || response.data?.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data;

      // Handle unverified account block (Trigger 1)
      if (status === 403 && responseData?.isVerified === false) {
        setUnverifiedNotice(true);
        setUnverifiedEmail(responseData.email || email.trim().toLowerCase());
        toast.warn('⚠️ Please verify your email before logging in.');
        return;
      }

      const errorMessage =
        responseData?.error ||
        responseData?.message ||
        'Failed to connect to the server. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = unverifiedEmail || email.trim().toLowerCase();
    if (!targetEmail) return;

    setResendingEmail(true);
    try {
      await API.post('/auth/resend-verification', { email: targetEmail });
      toast.success('📬 A new verification email has been dispatched. Please check your inbox!');
    } catch (err) {
      toast.info('📬 If an account exists, a verification email has been sent.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleDirectActivate = async () => {
    const targetEmail = unverifiedEmail || email.trim().toLowerCase();
    if (!targetEmail) return;

    setActivating(true);
    try {
      const res = await API.post('/auth/verify-email', { email: targetEmail });
      if (res.data && res.data.success) {
        toast.success('🎉 Account authenticated successfully!');
        setUnverifiedNotice(false);

        // If password is already entered, automatically sign in
        if (password) {
          const loginRes = await API.post('/auth/login', {
            email: targetEmail,
            password
          });
          if (loginRes.data && loginRes.data.success) {
            localStorage.setItem('imovies-user-token', loginRes.data.token);
            localStorage.setItem('imovies-user', JSON.stringify(loginRes.data.user || { email: targetEmail }));
            navigate('/home');
            return;
          }
        }
      } else {
        toast.error(res.data?.error || 'Verification failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to authenticate account');
    } finally {
      setActivating(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !validateEmail(forgotEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setForgotLoading(true);
    try {
      await API.post('/auth/forgot-password', {
        email: forgotEmail.trim().toLowerCase()
      });
      setForgotSent(true);
      toast.success('✉️ Password reset link sent to your email address!');
    } catch (err) {
      setForgotSent(true);
      toast.info('✉️ If an account exists, a password reset link has been dispatched.');
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

        {/* Verification Success Notice */}
        {isVerifiedFromUrl && (
          <div
            className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3 small border-0"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}
          >
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>Email verified successfully! You may now sign in.</span>
          </div>
        )}

        {/* Unverified Account Warning Banner */}
        {unverifiedNotice && (
          <div
            className="alert alert-warning mb-3 py-3 px-3 small border-0 text-start"
            style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#facc15', borderRadius: '10px' }}
          >
            <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <span>Email Authentication Required</span>
            </div>
            <p className="mb-2" style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
              Your account has not been activated yet. Please click the link sent to{' '}
              <strong>{unverifiedEmail}</strong>.
            </p>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-warning btn-sm w-50 fw-bold py-1"
                onClick={handleResendVerification}
                disabled={resendingEmail}
              >
                {resendingEmail ? 'Sending...' : 'Resend Email'}
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm w-50 fw-bold py-1"
                onClick={handleDirectActivate}
                disabled={activating}
              >
                {activating ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="dark-card p-4 p-sm-5 shadow-lg position-relative" style={{ border: '1px solid #282f44', borderRadius: '14px' }}>
          {/* Role Toggle Tabs */}
          <div className="d-flex rounded-3 p-1 mb-4" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
            <button
              type="button"
              className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                role === 'user' ? 'btn-danger shadow-sm' : 'text-secondary bg-transparent'
              }`}
              style={role === 'user' ? { backgroundColor: 'var(--primary-red)' } : {}}
              onClick={() => {
                setRole('user');
                setUnverifiedNotice(false);
              }}
            >
              <FontAwesomeIcon icon={faUser} /> User
            </button>
            <button
              type="button"
              className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                role === 'admin' ? 'btn-primary shadow-sm' : 'text-secondary bg-transparent'
              }`}
              style={role === 'admin' ? { backgroundColor: 'var(--primary-blue)' } : {}}
              onClick={() => {
                setRole('admin');
                setUnverifiedNotice(false);
              }}
            >
              <FontAwesomeIcon icon={faUserShield} /> Admin
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="mb-3">
              <label className="form-label small text-secondary fw-semibold mb-1">
                {role === 'admin' ? 'Admin Email' : 'Email Address'}
              </label>
              <div className="input-group">
                <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type="email"
                  className="form-control form-dark"
                  placeholder={role === 'admin' ? 'admin@imovies.com' : 'user@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small text-secondary fw-semibold mb-0">Password</label>
                {role === 'user' && (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none small"
                    style={{ color: '#94a3b8', fontSize: '0.8rem' }}
                    onClick={() => {
                      setForgotEmail(email || '');
                      setForgotSent(false);
                      setShowForgotModal(true);
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
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
        </div>
      </div>

      {/* Forgot Password Modal (Trigger 2) */}
      {showForgotModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
        >
          <div className="dark-card p-4 shadow-lg w-100 text-start" style={{ maxWidth: '420px', border: '1px solid #334155' }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '36px', height: '36px', backgroundColor: 'rgba(229, 9, 20, 0.15)', color: 'var(--primary-red)' }}
                >
                  <FontAwesomeIcon icon={faKey} />
                </div>
                <h5 className="text-white fw-bold mb-0">Reset Password</h5>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close"
              ></button>
            </div>

            {forgotSent ? (
              <div className="py-2 text-center">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                >
                  <FontAwesomeIcon icon={faCheckCircle} size="lg" />
                </div>
                <h6 className="text-white fw-bold mb-2">Check Your Email</h6>
                <p className="text-secondary small mb-3">
                  We have dispatched a secure password reset link to <strong>{forgotEmail}</strong>.
                  Please check your inbox (or spam folder) to set a new password.
                </p>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={() => setShowForgotModal(false)}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit}>
                <p className="text-secondary small mb-3">
                  Enter your registered email address and we will send you a password recovery link.
                </p>
                <div className="mb-3">
                  <label className="form-label text-secondary small">Email Address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary">
                      <FontAwesomeIcon icon={faEnvelope} />
                    </span>
                    <input
                      type="email"
                      className="form-control form-dark"
                      placeholder="user@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-50 py-2"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary-red w-50 py-2 fw-semibold"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Sending...' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
