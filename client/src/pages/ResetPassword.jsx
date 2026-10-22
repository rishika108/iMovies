import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faEye, faEyeSlash, faKey, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error('Missing password reset token in the link.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await API.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      });

      if (response.data && response.data.success) {
        setIsSuccess(true);
        toast.success('🎉 Password reset successfully! You can now sign in.');
      } else {
        toast.error(response.data?.error || 'Failed to reset password.');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'The password reset link has expired or is invalid. Please request a new one.';
      toast.error(errorMsg);
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
        {/* Brand Header */}
        <div className="text-center mb-4">
          <Link to="/landing" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '2.2rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <p className="text-secondary small mb-0">Secure Password Recovery</p>
        </div>

        {/* Reset Password Card */}
        <div className="dark-card p-4 p-sm-5 shadow-lg" style={{ border: '1px solid #282f44', borderRadius: '14px' }}>
          {isSuccess ? (
            <div className="text-center py-3">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '70px', height: '70px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} size="2x" />
              </div>
              <h4 className="text-white fw-bold mb-2">Password Updated!</h4>
              <p className="text-secondary small mb-4">
                Your password has been reset successfully. You can now log in with your new credentials.
              </p>
              <button
                className="btn btn-primary-red w-100 py-2 fw-bold"
                onClick={() => navigate('/login')}
              >
                Sign In Now
              </button>
            </div>
          ) : !token ? (
            <div className="text-center py-2">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '70px', height: '70px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
              >
                <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
              </div>
              <h4 className="text-white fw-bold mb-2">Invalid Link</h4>
              <p className="text-secondary small mb-4">
                This password reset link is missing a valid security token. Please request a new recovery link from the login page.
              </p>
              <Link to="/login" className="btn btn-primary-red w-100 py-2 fw-bold text-decoration-none">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{ width: '56px', height: '56px', backgroundColor: 'rgba(229, 9, 20, 0.15)', color: 'var(--primary-red)' }}
                >
                  <FontAwesomeIcon icon={faKey} size="lg" />
                </div>
                <h4 className="text-white fw-bold mb-1">Set New Password</h4>
                {emailParam && (
                  <p className="text-secondary small mb-0">For account: <strong className="text-light">{emailParam}</strong></p>
                )}
              </div>

              <form onSubmit={handleSubmit}>
                {/* New Password */}
                <div className="mb-3">
                  <label className="form-label text-secondary small">New Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary">
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-secondary text-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="form-label text-secondary small">Confirm New Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary">
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
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
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Updating Password...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>

              <div className="text-center mt-4 pt-2 border-top border-dark">
                <Link to="/login" className="text-secondary small text-decoration-none">
                  Remember your password? <span style={{ color: 'var(--primary-red)' }}>Sign In</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
