import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faEnvelope, faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(emailParam || '');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage('No verification token provided. Please check the link in your email.');
      return;
    }

    const verify = async () => {
      try {
        const res = await API.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (res.data && res.data.success) {
          setSuccess(true);
          setMessage(res.data.message || 'Email verified successfully! Your account is now active.');
        } else {
          setSuccess(false);
          setMessage(res.data?.error || 'Verification token is invalid or has expired.');
        }
      } catch (err) {
        setSuccess(false);
        setMessage(err.response?.data?.error || 'Failed to verify email. The token may be expired or already used.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.trim()) return;

    setResendLoading(true);
    try {
      const res = await API.post('/auth/resend-verification', { email: resendEmail.trim() });
      if (res.data && res.data.success) {
        setResendSuccess(true);
      }
    } catch (err) {
      // Show generic feedback for security
      setResendSuccess(true);
    } finally {
      setResendLoading(false);
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
            <span style={{ fontSize: '2.2rem' }}>🎬</span>
            <span className="fs-2 fw-extrabold text-white">
              <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
            </span>
          </Link>
          <p className="text-secondary small mb-0">Cinema Ticket Booking & Authentication</p>
        </div>

        {/* Verification Card */}
        <div className="dark-card p-4 p-sm-5 shadow-lg text-center" style={{ border: '1px solid #282f44', borderRadius: '14px' }}>
          {loading ? (
            <div className="py-5">
              <div className="spinner-border text-danger mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h5 className="text-white fw-bold mb-1">Authenticating Your Email</h5>
              <p className="text-secondary small mb-0">Please wait while we verify your account credentials...</p>
            </div>
          ) : success ? (
            <div className="py-3">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '72px', height: '72px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} size="2x" />
              </div>
              <h4 className="text-white fw-bold mb-2">Email Authenticated!</h4>
              <p className="text-secondary small mb-4">{message}</p>
              <button
                className="btn btn-primary-red w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                onClick={() => navigate('/login?verified=true')}
              >
                Sign In to iMovies <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          ) : (
            <div className="py-2">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '72px', height: '72px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
              >
                <FontAwesomeIcon icon={faExclamationTriangle} size="2x" />
              </div>
              <h4 className="text-white fw-bold mb-2">Verification Failed</h4>
              <p className="text-secondary small mb-4">{message}</p>

              {resendSuccess ? (
                <div className="alert alert-success py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                  ✓ A new verification link has been sent to your email address!
                </div>
              ) : (
                <form onSubmit={handleResend} className="mb-3 text-start">
                  <label className="form-label text-secondary small">Request a new verification link:</label>
                  <div className="input-group mb-2">
                    <span className="input-group-text bg-dark border-secondary text-secondary">
                      <FontAwesomeIcon icon={faEnvelope} />
                    </span>
                    <input
                      type="email"
                      className="form-control form-dark"
                      placeholder="Enter your email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-outline-danger w-100 btn-sm py-2"
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </form>
              )}

              <div className="mt-3">
                <Link to="/login" className="text-secondary small text-decoration-none">
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
