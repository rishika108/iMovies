import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faCircleXmark, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid or missing verification link parameters.');
      return;
    }

    const verify = async () => {
      try {
        const res = await API.post('/auth/verify-email', { token, email });
        if (res.data && res.data.success) {
          setStatus('success');
          setMessage(res.data.message || 'Your email has been successfully verified!');
          if (res.data.token) {
            localStorage.setItem('imovies-user-token', res.data.token);
            if (res.data.user) {
              localStorage.setItem('imovies-user', JSON.stringify(res.data.user));
            }
          }
          // Redirect after 3 seconds
          setTimeout(() => {
            navigate('/home');
          }, 2500);
        } else {
          setStatus('error');
          setMessage(res.data?.error || 'Verification link is invalid or has expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(
          err.response?.data?.error || 'Verification link has expired or is invalid. Please request a new code.'
        );
      }
    };

    verify();
  }, [token, email, navigate]);

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
        </div>

        <div className="dark-card p-4 p-sm-5 text-center shadow-lg" style={{ border: '1px solid #282f44' }}>
          {status === 'loading' && (
            <div>
              <div className="spinner-border text-danger mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h4 className="text-white fw-bold mb-2">Verifying Your Account</h4>
              <p className="text-secondary small mb-0">Please wait while we confirm your email credentials...</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '64px', height: '64px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '32px', color: '#4ade80' }} />
              </div>
              <h4 className="text-white fw-bold mb-2">Email Verified!</h4>
              <p className="text-secondary small mb-3">{message}</p>
              <div className="text-secondary small mb-4">Redirecting you to your dashboard in a moment...</div>
              <Link to="/home" className="btn btn-primary-red w-100 fw-bold">
                Continue to iMovies <FontAwesomeIcon icon={faArrowRight} className="ms-1" />
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '64px', height: '64px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444' }}
              >
                <FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: '32px', color: '#f87171' }} />
              </div>
              <h4 className="text-white fw-bold mb-2">Verification Failed</h4>
              <p className="text-secondary small mb-4">{message}</p>
              <Link to="/login" className="btn btn-primary-red w-100 fw-bold mb-2">
                Go to Sign In
              </Link>
              <Link to="/register" className="btn btn-outline-secondary w-100 fw-semibold text-secondary">
                Register Again
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
