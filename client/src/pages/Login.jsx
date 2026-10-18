import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faUser, faUserShield } from '@fortawesome/free-solid-svg-icons';

export default function Login() {
  const [role, setRole] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSubmit = async (e) => {
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
        toast.error(response.data?.error || response.data?.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to connect to the server. Please try again.';
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
          <form onSubmit={handleSubmit}>
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
            <div className="mb-4">
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
    </div>
  );
}
