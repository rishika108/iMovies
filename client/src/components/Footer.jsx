import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilm,
  faEnvelope,
  faPhone,
  faLocationDot,
  faHeart
} from '@fortawesome/free-solid-svg-icons';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto py-5" style={{ background: '#0e0e10', borderTop: '1px solid #222' }}>
      <div className="container">
        <div className="row g-4 justify-content-between">
          {/* Brand & Tagline */}
          <div className="col-12 col-md-5">
            <Link to="/" className="d-flex align-items-center gap-2 fs-4 fw-bold text-decoration-none mb-3">
              <span style={{ fontSize: '1.6rem' }}>🎬</span>
              <span className="text-white">
                <span style={{ color: 'var(--primary-red)' }}>i</span>Movies
              </span>
            </Link>
            <p className="text-secondary mb-3" style={{ maxWidth: '420px', lineHeight: '1.6' }}>
              Your premium cinema ticket booking destination. Discover trending movies, pick your preferred seats with our real-time interactive seat maps, and book memorable cinema experiences in seconds.
            </p>
            <div className="d-flex gap-3 text-secondary fs-5">
              <a href="#" className="text-secondary hover-scale text-decoration-none" title="Cinema">
                <FontAwesomeIcon icon={faFilm} />
              </a>
              <a href="mailto:support@imovies.com" className="text-secondary hover-scale text-decoration-none" title="Email">
                <FontAwesomeIcon icon={faEnvelope} />
              </a>
              <a href="tel:+1800123456" className="text-secondary hover-scale text-decoration-none" title="Support">
                <FontAwesomeIcon icon={faPhone} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-6 col-md-3">
            <h6 className="text-white fw-bold text-uppercase mb-3" style={{ letterSpacing: '1px' }}>
              Quick Links
            </h6>
            <ul className="list-unstyled d-flex flex-column gap-2">
              <li>
                <Link to="/home" className="text-secondary text-decoration-none hover-scale d-inline-block">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/home" className="text-secondary text-decoration-none hover-scale d-inline-block">
                  Browse Movies
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="text-secondary text-decoration-none hover-scale d-inline-block">
                  My Bookings
                </Link>
              </li>
              <li>
                <Link to="/landing" className="text-secondary text-decoration-none hover-scale d-inline-block">
                  About iMovies
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact / Cinema Info */}
          <div className="col-6 col-md-4">
            <h6 className="text-white fw-bold text-uppercase mb-3" style={{ letterSpacing: '1px' }}>
              Support & Cinema
            </h6>
            <ul className="list-unstyled d-flex flex-column gap-2 text-secondary">
              <li className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faLocationDot} style={{ color: 'var(--primary-red)' }} />
                <span>Downtown Cinema Boulevard, CineCity</span>
              </li>
              <li className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faPhone} style={{ color: 'var(--primary-red)' }} />
                <span>+1 (800) 555-CINE</span>
              </li>
              <li className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} style={{ color: 'var(--primary-red)' }} />
                <span>support@imovies.com</span>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-4" style={{ borderColor: '#222' }} />

        {/* Bottom Bar */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 text-secondary small">
          <p className="mb-0">
            &copy; {currentYear} <span className="text-white fw-semibold">iMovies</span>. All rights reserved.
          </p>
          <p className="mb-0 d-flex align-items-center gap-1">
            Built with <FontAwesomeIcon icon={faHeart} style={{ color: 'var(--primary-red)' }} /> for cinema lovers.
          </p>
        </div>
      </div>
    </footer>
  );
}
