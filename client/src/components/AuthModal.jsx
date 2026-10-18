import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faXmark,
  faUserShield,
  faCheckCircle,
  faArrowRightToBracket
} from '@fortawesome/free-solid-svg-icons';

/**
 * Reusable AuthModal supporting:
 * 1. Login (User or Admin via tab toggle)
 * 2. Sign Up (Strictly for regular users — zero admin signup options)
 */
export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [loginRole, setLoginRole] = useState('user'); // 'user' | 'admin'

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Email and password are required');
      return;
    }
    if (!validateEmail(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const endpoint = loginRole === 'admin' ? '/auth/admin/login' : '/auth/login';
      const response = await API.post(endpoint, {
        email: email.trim().toLowerCase(),
        password
      });

      if (response.data && response.data.success) {
        toast.success(`Welcome back! Logged in as ${loginRole === 'admin' ? 'Administrator' : 'User'}`);
        if (loginRole === 'admin') {
          localStorage.setItem('imovies-admin-token', response.data.token);
          localStorage.setItem('imovies-admin', JSON.stringify(response.data.admin || { email }));
          onClose();
          navigate('/admin');
        } else {
          localStorage.setItem('imovies-user-token', response.data.token);
          localStorage.setItem('imovies-user', JSON.stringify(response.data.user || { email, role: 'user' }));
          onClose();
          navigate('/home');
        }
      } else {
        toast.error(response.data?.error || response.data?.message || 'Login failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (username.trim().length < 3 || username.trim().length > 25) {
      toast.error('Username must be between 3 and 25 characters');
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
      // Public registrations strictly target /auth/register and force role='user'
      const response = await API.post('/auth/register', {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      if (response.data && response.data.success) {
        toast.success('🎉 Welcome to iMovies! Your user account has been created.');
        localStorage.setItem('imovies-user-token', response.data.token);
        localStorage.setItem('imovies-user', JSON.stringify(response.data.user || { username, email, role: 'user' }));
        onClose();
        navigate('/home');
      } else {
        toast.error(response.data?.error || response.data?.message || 'Registration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop-custom position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dark-card border-0 rounded-4 shadow-lg overflow-hidden position-relative w-100"
        style={{ maxWidth: '440px', backgroundColor: '#121622', border: '1px solid #28334b' }}
      >
        {/* Header Close Button */}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm rounded-circle position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center"
          style={{ width: '32px', height: '32px', zIndex: 10 }}
          onClick={onClose}
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {/* Modal Header */}
        <div className="p-4 pt-4 pb-2 text-center">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
            <span style={{ fontSize: '1.8rem' }}>🎬</span>
            <span className="fs-3 fw-bold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </div>
          <h5 className="text-white fw-bold mb-1">
            {mode === 'login' ? 'Sign In to Your Account' : 'Create Customer Account'}
          </h5>
          <p className="text-secondary small mb-3">
            {mode === 'login'
              ? 'Access live cinema tickets, watchlist & seat selection'
              : 'Join today to book blockbusters and reserve seats in real time'}
          </p>

          {/* Login Tabs: User vs Admin (Only shown in Login mode) */}
          {mode === 'login' && (
            <div className="d-flex rounded-3 p-1 mb-2" style={{ backgroundColor: '#0a0d16', border: '1px solid #232d42' }}>
              <button
                type="button"
                className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                  loginRole === 'user' ? 'btn-danger shadow-sm text-white' : 'text-secondary bg-transparent'
                }`}
                style={loginRole === 'user' ? { backgroundColor: 'var(--primary-red)' } : {}}
                onClick={() => setLoginRole('user')}
              >
                <FontAwesomeIcon icon={faUser} />
                <span>User Login</span>
              </button>
              <button
                type="button"
                className={`btn w-50 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 border-0 rounded-2 transition-all ${
                  loginRole === 'admin' ? 'btn-primary shadow-sm text-white' : 'text-secondary bg-transparent'
                }`}
                style={loginRole === 'admin' ? { backgroundColor: '#0096ff' } : {}}
                onClick={() => setLoginRole('admin')}
              >
                <FontAwesomeIcon icon={faUserShield} />
                <span>Admin Login</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 pt-1">
          {mode === 'login' ? (
            /* ── LOGIN FORM ── */
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label small text-secondary fw-semibold">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
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

              <div className="mb-4">
                <label className="form-label small text-secondary fw-semibold">Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control form-dark"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-secondary text-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ borderColor: '#2e3a54' }}
                    aria-label="Toggle password"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all ${
                  loginRole === 'admin' ? 'btn-primary-blue' : 'btn-primary-red'
                }`}
                disabled={loading}
              >
                {loading ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Authenticating...
                  </span>
                ) : (
                  <span>
                    <FontAwesomeIcon icon={faArrowRightToBracket} className="me-2" />
                    Sign In as {loginRole === 'admin' ? 'Admin' : 'User'}
                  </span>
                )}
              </button>
            </form>
          ) : (
            /* ── SIGNUP FORM (Strictly regular user) ── */
            <form onSubmit={handleSignup}>
              <div className="mb-3">
                <label className="form-label small text-secondary fw-semibold">Username (3-25 chars)</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    type="text"
                    className="form-control form-dark"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    minLength={3}
                    maxLength={25}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small text-secondary fw-semibold">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
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

              <div className="mb-3">
                <label className="form-label small text-secondary fw-semibold">Password (min 6 chars)</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control form-dark"
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-secondary text-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ borderColor: '#2e3a54' }}
                    aria-label="Toggle password"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small text-secondary fw-semibold">Confirm Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#2e3a54' }}>
                    <FontAwesomeIcon icon={faCheckCircle} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control form-dark"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Creating Account...
                  </span>
                ) : (
                  'Create Customer Account'
                )}
              </button>
            </form>
          )}

          {/* Toggle Between Login & Signup */}
          <div className="text-center mt-3 pt-3 border-top border-dark">
            {mode === 'login' ? (
              <p className="text-secondary small mb-0">
                New to iMovies?{' '}
                <button
                  type="button"
                  className="btn btn-link p-0 fw-semibold text-decoration-none"
                  style={{ color: 'var(--primary-red)' }}
                  onClick={() => setMode('signup')}
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-secondary small mb-0">
                Already registered?{' '}
                <button
                  type="button"
                  className="btn btn-link p-0 fw-semibold text-decoration-none"
                  style={{ color: 'var(--primary-red)' }}
                  onClick={() => setMode('login')}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
