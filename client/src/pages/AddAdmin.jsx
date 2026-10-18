import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserShield,
  faUsers,
  faUserPlus,
  faEnvelope,
  faLock,
  faUser,
  faTrash,
  faCalendarCheck,
  faSearch,
  faRotateLeft
} from '@fortawesome/free-solid-svg-icons';

export default function AddAdmin() {
  // Sub-admin registration state
  const [adminForm, setAdminForm] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // Users management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await API.get('/admin/users');
      const data = res.data?.users || res.data?.data || res.data || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load registered users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAdminFormChange = (e) => {
    const { name, value } = e.target;
    setAdminForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();

    if (!adminForm.username.trim() || adminForm.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!adminForm.email.trim() || !adminForm.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!adminForm.password || adminForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmittingAdmin(true);

    try {
      // Call secure admin-only provisioning endpoint
      const res = await API.post('/admin/create-admin', {
        username: adminForm.username.trim(),
        email: adminForm.email.trim().toLowerCase(),
        password: adminForm.password
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || 'Sub-admin provisioned successfully!');
        setAdminForm({ username: '', email: '', password: '' });
      } else {
        toast.error(res.data?.error || 'Failed to create sub-admin');
      }
    } catch (err) {
      console.error('Error creating sub-admin:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to register sub-admin';
      toast.error(msg);
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const userId = user._id || user.id;
    if (!window.confirm(`Are you sure you want to remove user "${user.username || user.email}"?`)) {
      return;
    }

    try {
      await API.delete(`/admin/users/${userId}`);
      toast.success('User removed successfully');
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(err.response?.data?.message || 'Failed to remove user');
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const username = (u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return username.includes(query) || email.includes(query);
  });

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container py-4 flex-grow-1">
        {/* Title Header */}
        <div className="mb-4">
          <h2 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faUserShield} className="text-warning me-2" />
            Admin & User Administration
          </h2>
          <p className="text-secondary mb-0">
            Provision permissions for sub-administrators and manage customer accounts.
          </p>
        </div>

        {/* Section 1: Create Sub-Admin */}
        <div
          className="p-4 p-md-5 rounded-4 mb-5 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom border-dark">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-warning"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: 'rgba(243, 156, 18, 0.15)',
                border: '1px solid rgba(243, 156, 18, 0.3)'
              }}
            >
              <FontAwesomeIcon icon={faUserPlus} size="lg" />
            </div>
            <div>
              <h4 className="text-white fw-bold mb-0">Create Sub-Admin</h4>
              <span className="text-secondary small">
                Add trusted administrators with full privileges to manage cinemas and screenings
              </span>
            </div>
          </div>

          <form onSubmit={handleCreateSubAdmin}>
            <div className="row g-4">
              {/* Username */}
              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Admin Username <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    type="text"
                    name="username"
                    className="form-control form-dark text-white"
                    placeholder="e.g. cinema_manager"
                    value={adminForm.username}
                    onChange={handleAdminFormChange}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Admin Email <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="form-control form-dark text-white"
                    placeholder="e.g. manager@imovies.com"
                    value={adminForm.email}
                    onChange={handleAdminFormChange}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Admin Password <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type="password"
                    name="password"
                    className="form-control form-dark text-white"
                    placeholder="Min 6 characters..."
                    value={adminForm.password}
                    onChange={handleAdminFormChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-3 border-top border-dark">
              <button
                type="button"
                onClick={() => setAdminForm({ username: '', email: '', password: '' })}
                className="btn btn-outline-secondary px-4 rounded-pill"
                disabled={submittingAdmin}
              >
                <FontAwesomeIcon icon={faRotateLeft} className="me-2" />
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary-red px-5 rounded-pill shadow-sm"
                disabled={submittingAdmin}
              >
                <FontAwesomeIcon icon={faUserPlus} className="me-2" />
                <span>{submittingAdmin ? 'Registering...' : 'Register Sub-Admin'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Manage Users */}
        <div
          className="p-4 p-md-5 rounded-4 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom border-dark">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-info"
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'rgba(0, 150, 255, 0.15)',
                  border: '1px solid rgba(0, 150, 255, 0.3)'
                }}
              >
                <FontAwesomeIcon icon={faUsers} size="lg" />
              </div>
              <div>
                <h4 className="text-white fw-bold mb-0">Manage Users</h4>
                <span className="text-secondary small">
                  Registered audience members and registered customers ({users.length} total)
                </span>
              </div>
            </div>

            {/* User Search Input */}
            <div style={{ minWidth: '260px' }}>
              <div className="input-group">
                <span className="input-group-text bg-dark border-secondary text-secondary">
                  <FontAwesomeIcon icon={faSearch} />
                </span>
                <input
                  type="text"
                  className="form-control form-dark text-white"
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="text-center py-5 text-secondary">
              <div className="spinner-border text-info mb-2" role="status" />
              <div>Loading registered users...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FontAwesomeIcon icon={faUsers} size="3x" className="mb-3 text-muted" />
              <h5>No Users Found</h5>
              <p className="small mb-0">
                {searchQuery ? 'No accounts matched your search keyword.' : 'No registered users present.'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                <thead>
                  <tr className="border-bottom border-secondary text-secondary small text-uppercase">
                    <th scope="col">User</th>
                    <th scope="col">Email Address</th>
                    <th scope="col">Joined Date</th>
                    <th scope="col" className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const userId = user._id || user.id;
                    const joinDate = user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'N/A';

                    return (
                      <tr key={userId} className="border-bottom border-dark">
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold small"
                              style={{
                                width: '34px',
                                height: '34px',
                                backgroundColor: 'rgba(229, 9, 20, 0.2)',
                                border: '1px solid rgba(229, 9, 20, 0.4)'
                              }}
                            >
                              {(user.username || 'U')[0].toUpperCase()}
                            </div>
                            <span className="text-white fw-semibold">{user.username}</span>
                          </div>
                        </td>
                        <td className="text-secondary small">
                          {user.email}
                        </td>
                        <td>
                          <span className="badge bg-dark border border-secondary text-secondary small d-inline-flex align-items-center gap-1">
                            <FontAwesomeIcon icon={faCalendarCheck} size="xs" />
                            {joinDate}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center ms-auto"
                            style={{ width: '34px', height: '34px' }}
                            title="Delete User Account"
                          >
                            <FontAwesomeIcon icon={faTrash} />
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

      <Footer />
    </div>
  );
}
