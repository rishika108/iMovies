import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faEye, faEyeSlash, faKey, faCheckCircle, faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token || !email) {
      toast.error('Invalid password reset link. Missing token or email.');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await API.post('/auth/reset-password', {
        email,
        token,
        newPassword: password
      });

      if (res.data && res.data.success) {
        setIsSuccess(true);
        toast.success('🎉 Password has been successfully updated!');
        setTimeout(() => {
          navigate('/login');
        }, 2500);
      } else {
        toast.error(res.data?.error || 'Failed to reset password');
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Password reset link has expired or is invalid.'
      );
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
      <div className="w-100" style={{ maxWidth: '440px' }}>
        <div className="text-center mb-4">
          <Link to="/landing" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '2.2rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <p className="text-secondary small mb-0">Secure Password Recovery</p>
        </div>

        <div className="dark-card p-4 p-sm-5 shadow-lg position-relative" style={{ border: '1px solid #282f44' }}>
          {!isSuccess ? (
            <>
              <div className="text-center mb-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{ width: '56px', height: '56px', background: 'rgba(2, 132, 199, 0.15)', border: '1px solid #0284c7' }}
                >
                  <FontAwesomeIcon icon={faKey} style={{ fontSize: '24px', color: '#38bdf8' }} />
                </div>
                <h4 className="text-white fw-bold mb-1">Create New Password</h4>
                <p className="text-secondary small mb-0">
                  Enter your new password for account <span className="text-white fw-semibold">{email || ''}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {/* New Password */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">New Password (min 6 chars)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-secondary text-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ borderColor: '#333b50' }}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
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
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary-red w-100 py-2 fw-bold text-white rounded-3 border-0 transition-all mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Saving New Password...
                    </span>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>

              <div className="text-center pt-3 border-top border-dark">
                <Link to="/login" className="text-secondary small text-decoration-none">
                  Back to Sign In
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '64px', height: '64px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '32px', color: '#4ade80' }} />
              </div>
              <h4 className="text-white fw-bold mb-2">Password Updated!</h4>
              <p className="text-secondary small mb-4">
                Your password has been reset successfully. Redirecting you to login...
              </p>
              <Link to="/login" className="btn btn-primary-red w-100 fw-bold">
                Sign In Now <FontAwesomeIcon icon={faArrowRight} className="ms-1" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
