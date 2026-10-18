import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash, faUserShield, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
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
      // Public registrations strictly target /auth/register
      const response = await API.post('/auth/register', {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      if (response.data && response.data.success) {
        toast.success('🎉 Account created successfully! Welcome to iMovies.');
        localStorage.setItem('imovies-user-token', response.data.token);
        localStorage.setItem('imovies-user', JSON.stringify(response.data.user || { username, email }));
        navigate('/home');
      } else {
        toast.error(response.data?.error || response.data?.message || 'Registration failed');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Registration failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
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
          <h4 className="text-white fw-bold mb-2 text-center">Create Your Account</h4>
          <p className="text-secondary small text-center mb-4">
            Get instant access to live TMDB releases, seat reservations & trailers
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit}>
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
                  placeholder="Create a strong password"
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
                  <FontAwesomeIcon icon={faCheckCircle} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control form-dark"
                  placeholder="Re-type your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Creating Account...
                </span>
              ) : (
                'Create User Account'
              )}
            </button>
          </form>

          {/* Bottom link */}
          <div className="text-center mt-4 pt-2 border-top border-dark">
            <p className="text-secondary small mb-0">
              Already have an account?{' '}
              <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: 'var(--primary-red)' }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
