import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilm,
  faTicket,
  faHeart,
  faUser,
  faRightFromBracket,
  faBars,
  faXmark,
  faPlus,
  faGaugeHigh,
  faBuilding,
  faCalendarPlus,
  faUserShield,
  faReceipt,
  faSun,
  faMoon,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const userToken = localStorage.getItem('imovies-user-token');
  const adminToken = localStorage.getItem('imovies-admin-token');
  const isAdmin = Boolean(adminToken);
  const isUser = Boolean(userToken) && !isAdmin;

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
  const closeNav = () => setIsNavCollapsed(true);

  const handleLogout = () => {
    localStorage.removeItem('imovies-user-token');
    localStorage.removeItem('imovies-admin-token');
    localStorage.removeItem('imovies-user');
    localStorage.removeItem('imovies-admin');
    closeNav();
    navigate('/landing');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark navbar-dark-custom py-3 px-3 px-md-4 shadow-sm">
      <div className="container-fluid">
        {/* Brand Logo */}
        <Link
          to={isAdmin ? '/admin' : isUser ? '/home' : '/landing'}
          className="navbar-brand d-flex align-items-center gap-2 fw-bold fs-4 text-decoration-none"
          onClick={closeNav}
          style={{ color: '#ffffff' }}
        >
          <span style={{ fontSize: '1.6rem' }}>🎬</span>
          <span>
            <span style={{ color: 'var(--primary-red)', fontWeight: 800 }}>i</span>
            <span>Movies</span>
          </span>
        </Link>

        {/* Mobile Toggle Button */}
        <button
          className="navbar-toggler border-0"
          type="button"
          aria-controls="navbarContent"
          aria-expanded={!isNavCollapsed}
          aria-label="Toggle navigation"
          onClick={handleNavCollapse}
          style={{ boxShadow: 'none', color: '#fff' }}
        >
          <FontAwesomeIcon icon={isNavCollapsed ? faBars : faXmark} size="lg" />
        </button>

        {/* Nav Links */}
        <div className={`${isNavCollapsed ? 'collapse' : ''} navbar-collapse`} id="navbarContent">
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-2 gap-lg-3">
            {/* ADMIN NAV */}
            {isAdmin && (
              <>
                <li className="nav-item">
                  <Link
                    to="/admin"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/admin') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faGaugeHigh} />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/addmovie"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/addmovie') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faFilm} />
                    <span>Add Movie</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/addtheatre"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/addtheatre') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faBuilding} />
                    <span>Add Theatre</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/addshow"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/addshow') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faCalendarPlus} />
                    <span>Add Show</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/adminbookings"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/adminbookings') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faReceipt} />
                    <span>Bookings</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/admintransactions"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/admintransactions') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faCreditCard} />
                    <span>Transactions</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/addadmin"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/addadmin') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faUserShield} />
                    <span>Add Admin</span>
                  </Link>
                </li>
                <li className="nav-item ms-lg-2">
                  <button
                    onClick={handleLogout}
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                    style={{ fontWeight: 500 }}
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    <span>Logout</span>
                  </button>
                </li>
              </>
            )}

            {/* USER NAV */}
            {isUser && (
              <>
                <li className="nav-item">
                  <Link
                    to="/home"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/home') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faFilm} />
                    <span>Home</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/bookings"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/bookings') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faTicket} />
                    <span>Bookings</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/favoriteshows"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/favoriteshows') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faHeart} />
                    <span>Favorites</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/profile"
                    onClick={closeNav}
                    className={`nav-link px-2 d-flex align-items-center gap-2 ${
                      isActive('/profile') ? 'active text-danger fw-semibold' : 'text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faUser} />
                    <span>Profile</span>
                  </Link>
                </li>
                <li className="nav-item ms-lg-2">
                  <button
                    onClick={handleLogout}
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                    style={{ fontWeight: 500 }}
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    <span>Logout</span>
                  </button>
                </li>
              </>
            )}

            {/* GUEST NAV */}
            {!isAdmin && !isUser && (
              <>
                <li className="nav-item">
                  <Link
                    to="/landing"
                    onClick={closeNav}
                    className={`nav-link px-2 ${isActive('/landing') ? 'active text-danger' : 'text-light'}`}
                  >
                    About
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/login"
                    onClick={closeNav}
                    className={`nav-link px-2 ${isActive('/login') ? 'active text-danger' : 'text-light'}`}
                  >
                    Sign In
                  </Link>
                </li>
                <li className="nav-item ms-lg-2">
                  <Link
                    to="/register"
                    onClick={closeNav}
                    className="btn btn-primary-red btn-sm px-3 py-2"
                  >
                    Get Started
                  </Link>
                </li>
              </>
            )}

            {/* Theme Toggle Button (Available for all) */}
            <li className="nav-item ms-lg-2">
              <button
                type="button"
                className="btn btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill theme-toggle-btn shadow-sm"
                onClick={toggleTheme}
                title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: isDark ? '#ffc107' : '#1f2937',
                  border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
