import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCouch, faBolt, faTicket, faFilm, faShieldHalved } from '@fortawesome/free-solid-svg-icons';

export default function Landing() {
  return (
    <div className="landing-page min-vh-100 d-flex flex-column text-white">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.65;
          }
        }

        .fade-in-animated {
          animation: fadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .fade-in-delayed {
          animation: fadeIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }

        .fade-in-delayed-2 {
          animation: fadeIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
          opacity: 0;
        }

        .hero-cinema-bg {
          min-height: 85vh;
          background: radial-gradient(circle at 50% 25%, #18233c 0%, #0c1220 45%, #05070c 100%);
          position: relative;
          overflow: hidden;
        }

        .hero-ambient-glow {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          width: 650px;
          height: 350px;
          background: radial-gradient(circle, rgba(229, 9, 20, 0.25) 0%, rgba(0, 150, 255, 0.15) 50%, transparent 75%);
          filter: blur(80px);
          pointer-events: none;
          animation: pulseGlow 6s ease-in-out infinite;
        }

        .feature-card {
          background: rgba(20, 24, 33, 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2.2rem 1.8rem;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          border-color: rgba(229, 9, 20, 0.45);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
        }

        .feature-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          margin-bottom: 1.4rem;
        }

        .cta-btn-red {
          background: #e50914;
          color: #ffffff;
          padding: 0.85rem 2.4rem;
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          transition: background-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
          box-shadow: 0 8px 24px rgba(229, 9, 20, 0.35);
        }

        .cta-btn-red:hover {
          background: #c40812;
          color: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(229, 9, 20, 0.5);
        }

        .cta-btn-outline-blue {
          background: transparent;
          color: #0096ff;
          border: 2px solid #0096ff;
          padding: 0.85rem 2.4rem;
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 10px;
          transition: background-color 0.25s ease, color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
        }

        .cta-btn-outline-blue:hover {
          background: #0096ff;
          color: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0, 150, 255, 0.35);
        }
      `}</style>

      {/* Top Simple Nav */}
      <header className="py-3 px-4 px-md-5 d-flex justify-content-between align-items-center position-relative" style={{ zIndex: 10 }}>
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: '1.8rem' }}>🎬</span>
          <span className="fs-3 fw-bold tracking-tight">
            <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
          </span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Link to="/login" className="btn btn-sm btn-outline-light px-3 py-1 fw-semibold rounded-pill">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-sm btn-danger px-3 py-1 fw-semibold rounded-pill" style={{ backgroundColor: 'var(--primary-red)' }}>
            Sign Up
          </Link>
        </div>
      </header>

      {/* Full Hero Section */}
      <main className="hero-cinema-bg d-flex flex-column justify-content-center align-items-center text-center px-3 px-md-4">
        <div className="hero-ambient-glow"></div>

        <div className="container position-relative" style={{ maxWidth: '860px', zIndex: 2 }}>
          {/* Brand Tagline */}
          <div className="fade-in-animated mb-3">
            <span
              className="badge px-3 py-2 rounded-pill fw-semibold border"
              style={{
                backgroundColor: 'rgba(229, 9, 20, 0.15)',
                color: '#ff6b6b',
                borderColor: 'rgba(229, 9, 20, 0.35)',
                fontSize: '0.9rem'
              }}
            >
              🎬 Welcome to the Next-Gen Cinema Experience
            </span>
          </div>

          <h1
            className="fade-in-animated fw-extrabold display-3 mb-3 text-white"
            style={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            Your Ultimate <span style={{ color: 'var(--primary-red)' }}>Movie Experience</span>
          </h1>

          <p
            className="fade-in-delayed lead mb-4 text-secondary mx-auto"
            style={{ maxWidth: '680px', fontSize: '1.25rem', lineHeight: 1.6 }}
          >
            Book tickets for the latest blockbusters and timeless classics. Select your seats in real-time with zero hassle.
          </p>

          {/* CTA Buttons */}
          <div className="fade-in-delayed-2 d-flex flex-column flex-sm-row justify-content-center align-items-center gap-3 mt-4 mb-5">
            <Link to="/login" className="cta-btn-red text-decoration-none">
              Sign In
            </Link>
            <Link to="/register" className="cta-btn-outline-blue text-decoration-none">
              Sign Up
            </Link>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-5 px-3 px-md-4 position-relative" style={{ backgroundColor: '#090d16' }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div className="text-center mb-5">
            <h6 className="text-uppercase fw-bold text-danger mb-2" style={{ letterSpacing: '2px' }}>
              Why Choose iMovies
            </h6>
            <h2 className="fw-bold text-white fs-1">Seamless Booking from Screen to Seat</h2>
          </div>

          <div className="row g-4 justify-content-center">
            {/* Card 1 */}
            <div className="col-12 col-md-4">
              <div className="feature-card h-100 d-flex flex-column align-items-start">
                <div
                  className="feature-icon-wrapper"
                  style={{
                    backgroundColor: 'rgba(46, 204, 113, 0.15)',
                    color: '#2ecc71',
                    border: '1px solid rgba(46, 204, 113, 0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faCouch} />
                </div>
                <h4 className="fw-bold text-white mb-2">Real-Time Seats</h4>
                <p className="text-secondary mb-0" style={{ lineHeight: 1.6 }}>
                  Experience live interactive seat maps synced instantly with WebSockets. See reserved, locked, and available spots as they happen.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="col-12 col-md-4">
              <div className="feature-card h-100 d-flex flex-column align-items-start">
                <div
                  className="feature-icon-wrapper"
                  style={{
                    backgroundColor: 'rgba(0, 150, 255, 0.15)',
                    color: '#0096ff',
                    border: '1px solid rgba(0, 150, 255, 0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <h4 className="fw-bold text-white mb-2">Instant Booking</h4>
                <p className="text-secondary mb-0" style={{ lineHeight: 1.6 }}>
                  Lock your favorite Balcony, Middle, or Lower tier seats with 10-minute hold protection. Confirm orders with zero delay.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="col-12 col-md-4">
              <div className="feature-card h-100 d-flex flex-column align-items-start">
                <div
                  className="feature-icon-wrapper"
                  style={{
                    backgroundColor: 'rgba(229, 9, 20, 0.15)',
                    color: '#e50914',
                    border: '1px solid rgba(229, 9, 20, 0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faTicket} />
                </div>
                <h4 className="fw-bold text-white mb-2">Digital Tickets</h4>
                <p className="text-secondary mb-0" style={{ lineHeight: 1.6 }}>
                  Receive verified digital tickets with QR code passes directly to your dashboard and inbox. Print or scan seamlessly at entry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-secondary border-top border-dark" style={{ backgroundColor: '#06080e', fontSize: '0.9rem' }}>
        <p className="mb-0">
          © {new Date().getFullYear()} iMovies Inc. All rights reserved. Crafting unforgettable cinematic journeys.
        </p>
      </footer>
    </div>
  );
}
