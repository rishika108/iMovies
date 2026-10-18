import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AdminTransactions from '../components/AdminTransactions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGaugeHigh,
  faFilm,
  faBuilding,
  faCalendarDays,
  faReceipt,
  faUserShield,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';

export default function AdminTransactionsPage() {
  const location = useLocation();

  const navLinks = [
    { name: 'Dashboard', path: '/admin', icon: faGaugeHigh },
    { name: 'Movies', path: '/addmovie', icon: faFilm },
    { name: 'Theatres', path: '/addtheatre', icon: faBuilding },
    { name: 'Shows', path: '/addshow', icon: faCalendarDays },
    { name: 'Bookings', path: '/adminbookings', icon: faReceipt },
    { name: 'Transactions', path: '/admintransactions', icon: faCreditCard },
    { name: 'Add Admin', path: '/addadmin', icon: faUserShield }
  ];

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <div className="container-fluid flex-grow-1 px-3 px-md-4 py-4">
        <div className="row g-4">
          {/* Admin Sidebar Navigation */}
          <aside className="col-12 col-lg-2">
            <div
              className="p-3 rounded-4 sticky-top shadow-sm"
              style={{
                backgroundColor: 'var(--dark-card)',
                border: '1px solid #262626',
                top: '90px',
                zIndex: 10
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom border-dark">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'var(--primary-red)'
                  }}
                >
                  <FontAwesomeIcon icon={faCreditCard} />
                </div>
                <div>
                  <h6 className="mb-0 text-white fw-bold">Admin Portal</h6>
                  <span className="text-secondary small">Financial Control</span>
                </div>
              </div>

              <nav className="nav nav-pills flex-column gap-1">
                {navLinks.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-link d-flex align-items-center gap-3 px-3 py-2 rounded-3 transition-all ${
                        isActive
                          ? 'active bg-danger text-white fw-semibold shadow-sm'
                          : 'text-secondary hover-scale'
                      }`}
                      style={{
                        backgroundColor: isActive ? 'var(--primary-red)' : 'transparent',
                        color: isActive ? '#fff' : '#b3b3b3',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <FontAwesomeIcon icon={item.icon} style={{ width: '18px' }} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 pt-3 border-top border-dark text-secondary small">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span>Logged in as:</span>
                  <span className="text-success">● Active</span>
                </div>
                <div className="text-white text-truncate fw-semibold">
                  {localStorage.getItem('imovies-admin') || 'System Administrator'}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Transactions Content */}
          <main className="col-12 col-lg-10">
            <AdminTransactions />
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
