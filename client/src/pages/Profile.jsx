import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faCalendarAlt,
  faTicket,
  faCheckCircle,
  faWallet,
  faLock,
  faKey,
  faShieldHalved,
  faEye,
  faEyeSlash,
  faPhone,
  faPen,
  faSave,
} from '@fortawesome/free-solid-svg-icons';

export default function Profile() {
  const navigate = useNavigate();

  // ── Tab: 'profile' | 'security' ──────────────────
  const [activeTab, setActiveTab] = useState('profile');

  // ── User state ────────────────────────────────────
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  // ── Edit Profile state ────────────────────────────
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Password Change state ─────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const token = localStorage.getItem('imovies-user-token');

  // ── Load user + stats ─────────────────────────────
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const stored = localStorage.getItem('imovies-user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setEditName(parsed.username || '');
        setEditPhone(parsed.phone || '');
      }
    } catch (e) {
      console.error('Error loading stored user:', e);
    }

    const fetchBookingStats = async () => {
      setLoading(true);
      try {
        const res = await API.get('/bookings/my');
        const list =
          res.data?.bookings || (Array.isArray(res.data) ? res.data : []);
        const completed = list.filter((b) => b.paymentStatus === 'Completed');
        const spent = completed.reduce(
          (sum, b) => sum + (Number(b.totalAmount) || 0),
          0
        );
        setStats({
          totalBookings: list.length,
          completedBookings: completed.length,
          totalSpent: spent,
        });
      } catch (err) {
        console.warn('Could not fetch booking stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingStats();
  }, [token, navigate]);

  // ── Save Profile ──────────────────────────────────
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!editName.trim() || editName.trim().length < 3) {
      toast.error('Display name must be at least 3 characters');
      return;
    }
    setSavingProfile(true);
    try {
      const updatedUser = {
        ...user,
        username: editName.trim(),
        phone: editPhone.trim(),
      };
      localStorage.setItem('imovies-user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change Password ───────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword) { toast.error('Current password is required'); return; }
    if (newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }

    setUpdatingPassword(true);
    try {
      const res = await API.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      if (res.data?.success || res.status === 200) {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.data?.error || 'Password update failed');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Password update failed. Please check your current password.';
      toast.error(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const username = user?.username || (user?.email ? user.email.split('@')[0] : 'Movie Lover');
  const email = user?.email || 'user@example.com';
  const initial = (username.charAt(0) || 'U').toUpperCase();
  const memberSince = user?.createdAt
    ? dayjs(user.createdAt).format('MMMM YYYY')
    : 'Member since 2024';

  return (
    <div
      className="d-flex flex-column min-vh-100"
      style={{ backgroundColor: 'var(--dark-bg)', color: '#fff' }}
    >
      <Header />

      <main
        className="container-fluid flex-grow-1 px-3 px-md-5 py-4"
        style={{ maxWidth: '1100px' }}
      >
        {/* ── Title ── */}
        <div className="mb-4 pb-3 border-bottom border-dark">
          <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faUser} style={{ color: 'var(--primary-red)' }} />
            <span>My Profile</span>
          </h2>
          <p className="text-secondary mb-0">
            Manage your personal details and cinema booking stats
          </p>
        </div>

        {/* ── Avatar Card ── */}
        <div
          className="dark-card p-4 mb-4 shadow-sm"
          style={{ border: '1px solid #23293b' }}
        >
          <div className="d-flex flex-column flex-sm-row align-items-center gap-4">
            {/* Avatar */}
            <div
              className="d-flex align-items-center justify-content-center text-white fw-bold shadow"
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                fontSize: '2.5rem',
                background: 'linear-gradient(135deg, #e50914 0%, #0096ff 100%)',
                border: '3px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>

            {/* User meta */}
            <div className="text-center text-sm-start flex-grow-1">
              <h3 className="fw-bold text-white mb-1">{username}</h3>
              <div className="d-flex flex-wrap justify-content-center justify-content-sm-start align-items-center gap-3 text-secondary small">
                <span className="d-flex align-items-center gap-1">
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>{email}</span>
                </span>
                {user?.phone && (
                  <>
                    <span>•</span>
                    <span className="d-flex align-items-center gap-1">
                      <FontAwesomeIcon icon={faPhone} />
                      <span>{user.phone}</span>
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="d-flex align-items-center gap-1">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <span>{memberSince}</span>
                </span>
                <span>•</span>
                <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-2 py-1">
                  Verified Cinephile
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4">
            <div className="dark-card p-4 h-100 shadow-sm" style={{ border: '1px solid #23293b' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small fw-semibold">TOTAL BOOKINGS</span>
                <div className="rounded-3 p-2 d-flex align-items-center justify-content-center text-primary" style={{ backgroundColor: 'rgba(0,150,255,0.15)' }}>
                  <FontAwesomeIcon icon={faTicket} />
                </div>
              </div>
              <h3 className="fw-bold text-white mb-0">{stats.totalBookings}</h3>
              <span className="text-secondary small">Lifetime reservations</span>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="dark-card p-4 h-100 shadow-sm" style={{ border: '1px solid #23293b' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small fw-semibold">CONFIRMED VISITS</span>
                <div className="rounded-3 p-2 d-flex align-items-center justify-content-center text-success" style={{ backgroundColor: 'rgba(46,204,113,0.15)' }}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
              </div>
              <h3 className="fw-bold text-white mb-0">{stats.completedBookings}</h3>
              <span className="text-secondary small">Watched in cinema</span>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="dark-card p-4 h-100 shadow-sm" style={{ border: '1px solid #23293b' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small fw-semibold">TOTAL SPENT</span>
                <div className="rounded-3 p-2 d-flex align-items-center justify-content-center text-danger" style={{ backgroundColor: 'rgba(229,9,20,0.15)' }}>
                  <FontAwesomeIcon icon={faWallet} />
                </div>
              </div>
              <h3 className="fw-bold text-white mb-0">₹{stats.totalSpent}</h3>
              <span className="text-secondary small">Entertainment investment</span>
            </div>
          </div>
        </div>

        {/* ── Tabbed Settings Card ── */}
        <div
          className="dark-card shadow-sm"
          style={{ border: '1px solid #23293b', maxWidth: '680px' }}
        >
          {/* Tab nav */}
          <div className="nav-tabs-dark d-flex">
            <button
              type="button"
              className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <FontAwesomeIcon icon={faPen} className="me-2" />
              Edit Profile
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <FontAwesomeIcon icon={faKey} className="me-2" />
              Security
            </button>
          </div>

          <div className="p-4 p-md-5">
            {/* ──── PROFILE INFO TAB ──── */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile}>
                <h5 className="fw-bold text-white mb-1">Personal Information</h5>
                <p className="text-secondary small mb-4">
                  Update your display name and phone number.
                </p>

                {/* Display Name */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">
                    Display Name
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faUser} />
                    </span>
                    <input
                      type="text"
                      className="form-control form-dark"
                      placeholder="Your display name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      minLength={3}
                      maxLength={20}
                      required
                    />
                  </div>
                </div>

                {/* Email (read-only) */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">
                    Email Address
                    <span className="ms-2 badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                      Cannot be changed
                    </span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faEnvelope} />
                    </span>
                    <input
                      type="email"
                      className="form-control form-dark"
                      value={email}
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold">
                    Phone Number
                    <span className="ms-2 text-secondary" style={{ fontSize: '0.72rem' }}>
                      (optional)
                    </span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faPhone} />
                    </span>
                    <input
                      type="tel"
                      className="form-control form-dark"
                      placeholder="+91 9876543210"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      maxLength={15}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-red px-4 py-2 fw-semibold"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" />
                      Saving…
                    </span>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faSave} className="me-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ──── SECURITY TAB ──── */}
            {activeTab === 'security' && (
              <form onSubmit={handlePasswordChange}>
                <h5 className="fw-bold text-white mb-1">Change Password</h5>
                <p className="text-secondary small mb-4">
                  Ensure your account is protected with a strong, unique password.
                </p>

                {/* Current Password */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">
                    Current Password
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faLock} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="mb-3">
                  <label className="form-label small text-secondary fw-semibold">
                    New Password <span className="text-muted">(min 6 chars)</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faKey} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-dark"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="form-label small text-secondary fw-semibold">
                    Confirm New Password
                  </label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#333b50' }}>
                      <FontAwesomeIcon icon={faShieldHalved} />
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

                <button
                  type="submit"
                  className="btn btn-primary-red px-4 py-2 fw-semibold"
                  disabled={updatingPassword}
                >
                  {updatingPassword ? (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" />
                      Updating…
                    </span>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
