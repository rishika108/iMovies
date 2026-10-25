import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import API from '../utils/api';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faGaugeHigh,
  faFilm,
  faBuilding,
  faCalendarDays,
  faReceipt,
  faCreditCard,
  faUserShield,
  faSearch,
  faTrashCan,
  faUserSlash,
  faUserCheck,
  faClockRotateLeft,
  faExclamationTriangle,
  faShieldHalved,
  faTicket
} from '@fortawesome/free-solid-svg-icons';

export default function AdminUsers() {
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/admin', icon: faGaugeHigh },
    { name: 'Users', path: '/admin/users', icon: faUsers },
    { name: 'Movies', path: '/addmovie', icon: faFilm },
    { name: 'Theatres', path: '/addtheatre', icon: faBuilding },
    { name: 'Shows', path: '/addshow', icon: faCalendarDays },
    { name: 'Bookings', path: '/adminbookings', icon: faReceipt },
    { name: 'Transactions', path: '/admintransactions', icon: faCreditCard },
    { name: 'Add Admin', path: '/addadmin', icon: faUserShield }
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await API.get('/admin/users');
      const list = res.data?.users || (Array.isArray(res.data) ? res.data : []);
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error(err.response?.data?.error || 'Failed to fetch registered users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter((u) => {
      const name = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [users, searchTerm]);

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    const targetId = deleteTargetUser._id || deleteTargetUser.id;

    setIsDeleting(true);
    try {
      const res = await API.delete(`/admin/users/${targetId}`);
      if (res.data && res.data.success) {
        toast.success(`User ${deleteTargetUser.email} was successfully removed.`);
        setDeleteTargetUser(null);
        await fetchUsers();
      } else {
        toast.error(res.data?.error || 'Failed to delete user');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Error deleting user';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalVerified = users.filter((u) => u.isVerified).length;
  const totalBookingsAll = users.reduce((sum, u) => sum + (u.totalBookings || 0), 0);

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <div className="container-fluid flex-grow-1 px-3 px-md-4 py-4">
        <div className="row g-4">
          {/* Admin Navigation Sidebar */}
          <aside className="col-12 col-lg-2">
            <div
              className="p-3 rounded-4 sticky-top"
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
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div>
                  <h6 className="mb-0 text-white fw-bold">User Manager</h6>
                  <span className="text-secondary small">Access Control</span>
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

          {/* Main User Management Table */}
          <main className="col-12 col-lg-10">
            {/* Header & Controls */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
              <div>
                <h2 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faUsers} style={{ color: 'var(--primary-red)' }} />
                  <span>Registered Users Management</span>
                </h2>
                <p className="text-secondary mb-0">
                  Inspect user accounts, verification standing, booking frequency, and revoke accounts.
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={fetchUsers}
                  className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-light"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faClockRotateLeft} className="me-2" />
                  Refresh Users
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-sm-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}>
                  <div className="text-secondary small text-uppercase fw-semibold">Total Accounts</div>
                  <div className="fs-3 fw-bold text-white mt-1">{users.length}</div>
                </div>
              </div>
              <div className="col-12 col-sm-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}>
                  <div className="text-secondary small text-uppercase fw-semibold">Email Verified</div>
                  <div className="fs-3 fw-bold text-success mt-1">{totalVerified}</div>
                </div>
              </div>
              <div className="col-12 col-sm-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}>
                  <div className="text-secondary small text-uppercase fw-semibold">Total User Bookings</div>
                  <div className="fs-3 fw-bold text-warning mt-1">{totalBookingsAll}</div>
                </div>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 rounded-4 mb-4" style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}>
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-secondary">
                      <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-dark border-secondary text-white"
                      placeholder="Search by username or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setSearchTerm('')}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-12 col-md-6 text-md-end text-secondary small">
                  Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div
              className="rounded-4 overflow-hidden shadow-sm"
              style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
            >
              {loading ? (
                <div className="text-center py-5 text-secondary">
                  <div className="spinner-border text-danger mb-3" role="status"></div>
                  <div>Loading registered users...</div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-5 text-secondary">
                  <div className="fs-1 mb-2">👤</div>
                  <h5 className="text-white">No Users Found</h5>
                  <p className="small">No accounts match your search filter criteria.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0 align-middle">
                    <thead style={{ backgroundColor: '#181b24', borderBottom: '1px solid #333' }}>
                      <tr>
                        <th className="py-3 px-4 text-secondary small text-uppercase">User</th>
                        <th className="py-3 px-3 text-secondary small text-uppercase">Email</th>
                        <th className="py-3 px-3 text-secondary small text-uppercase">Status</th>
                        <th className="py-3 px-3 text-secondary small text-uppercase">Registration Date</th>
                        <th className="py-3 px-3 text-secondary small text-uppercase text-center">Bookings</th>
                        <th className="py-3 px-3 text-secondary small text-uppercase text-end">Total Spent</th>
                        <th className="py-3 px-4 text-secondary small text-uppercase text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const isVerified = Boolean(user.isVerified);
                        const regDate = user.createdAt
                          ? dayjs(user.createdAt).format('DD MMM YYYY, hh:mm A')
                          : 'N/A';

                        return (
                          <tr key={user._id || user.id}>
                            {/* User Name & Avatar */}
                            <td className="py-3 px-4">
                              <div className="d-flex align-items-center gap-3">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    backgroundColor: '#2b3144',
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  {(user.username || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="fw-semibold text-white">
                                    {user.username || 'Movie Enthusiast'}
                                  </div>
                                  <div className="text-secondary small font-monospace" style={{ fontSize: '0.72rem' }}>
                                    ID: {user._id || user.id}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3 px-3 text-light">{user.email}</td>

                            {/* Verification Status */}
                            <td className="py-3 px-3">
                              {isVerified ? (
                                <span className="badge bg-success bg-opacity-25 border border-success text-success px-2 py-1 rounded-pill small">
                                  <FontAwesomeIcon icon={faUserCheck} className="me-1" />
                                  Verified
                                </span>
                              ) : (
                                <span className="badge bg-warning bg-opacity-25 border border-warning text-warning px-2 py-1 rounded-pill small">
                                  Pending
                                </span>
                              )}
                            </td>

                            {/* Registration Date */}
                            <td className="py-3 px-3 text-secondary small">{regDate}</td>

                            {/* Total Bookings */}
                            <td className="py-3 px-3 text-center">
                              <span className="badge bg-dark border border-secondary text-light px-2 py-1 font-monospace">
                                {user.totalBookings || 0}
                              </span>
                            </td>

                            {/* Total Spent */}
                            <td className="py-3 px-3 text-end fw-semibold text-white">
                              ₹{Number(user.totalSpent || 0).toLocaleString('en-IN')}
                            </td>

                            {/* Action: Delete / Remove User */}
                            <td className="py-3 px-4 text-end">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm rounded-pill px-3 d-inline-flex align-items-center gap-1"
                                onClick={() => setDeleteTargetUser(user)}
                                title="Revoke and delete this user account"
                              >
                                <FontAwesomeIcon icon={faTrashCan} />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {deleteTargetUser && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', zIndex: 10500 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div
              className="modal-content bg-dark text-white border-0 shadow-lg rounded-4 overflow-hidden"
              style={{ border: '1px solid #4a2228' }}
            >
              <div className="modal-header border-bottom border-dark px-4 py-3">
                <div className="d-flex align-items-center gap-2 text-danger fw-bold fs-5">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>Delete User Account</span>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDeleteTargetUser(null)}
                  disabled={isDeleting}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body px-4 py-4">
                <p className="text-light mb-3">
                  Are you sure you want to permanently delete user{' '}
                  <strong className="text-white">{deleteTargetUser.email}</strong>?
                </p>

                <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#10131b', border: '1px solid #23293b' }}>
                  <div className="small text-secondary mb-1">
                    Username: <strong className="text-white">{deleteTargetUser.username || 'N/A'}</strong>
                  </div>
                  <div className="small text-secondary mb-1">
                    Registered: <strong className="text-white">{dayjs(deleteTargetUser.createdAt).format('DD MMM YYYY')}</strong>
                  </div>
                  <div className="small text-secondary">
                    Total Bookings: <strong className="text-warning">{deleteTargetUser.totalBookings || 0}</strong>
                  </div>
                </div>

                <div className="alert alert-danger py-2 px-3 small rounded-3 mb-0 border-danger border-opacity-50">
                  <FontAwesomeIcon icon={faShieldHalved} className="me-2" />
                  This action is irreversible. The account record will be removed and any active login sessions will be terminated immediately.
                </div>
              </div>

              <div className="modal-footer border-top border-dark px-4 py-3 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 rounded-pill"
                  onClick={() => setDeleteTargetUser(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 rounded-pill fw-bold"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Deleting User...
                    </span>
                  ) : (
                    'Delete Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
