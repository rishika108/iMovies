import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faPlus,
  faTrash,
  faLocationDot,
  faCouch,
  faRotateLeft,
  faIndianRupeeSign,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

const defaultForm = {
  theatreName: '',
  location: '',
  balconySeatPrice: 300,
  middleSeatPrice: 200,
  lowerSeatPrice: 150,
  balconyRows: 3,
  balconyCols: 10,
  middleRows: 5,
  middleCols: 12,
  lowerRows: 7,
  lowerCols: 14
};

export default function AddTheatre() {
  const [formData, setFormData] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [theatres, setTheatres] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchAdminTheatres();
  }, []);

  const fetchAdminTheatres = async () => {
    setFetching(true);
    try {
      // Try GET /theatres/admin first, then fallback to GET /theatres
      let res;
      try {
        res = await API.get('/theatres/admin');
      } catch (err) {
        res = await API.get('/theatres');
      }
      const data = res.data?.theatres || res.data?.data || res.data || [];
      setTheatres(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch theatres:', err);
      toast.error('Failed to load theatres list');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.theatreName.trim()) {
      toast.error('Please enter theatre name');
      return;
    }
    if (!formData.location.trim()) {
      toast.error('Please enter theatre location / city');
      return;
    }

    setLoading(true);

    const adminEmail = localStorage.getItem('imovies-admin') || 'admin@imovies.com';
    const theatreId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const payload = {
      theatreId,
      theatreName: formData.theatreName.trim(),
      location: formData.location.trim(),
      adminEmail,
      balconySeatPrice: Number(formData.balconySeatPrice) || 300,
      middleSeatPrice: Number(formData.middleSeatPrice) || 200,
      lowerSeatPrice: Number(formData.lowerSeatPrice) || 150,
      balconySeats: {
        rows: Number(formData.balconyRows) || 3,
        cols: Number(formData.balconyCols) || 10
      },
      middleSeats: {
        rows: Number(formData.middleRows) || 5,
        cols: Number(formData.middleCols) || 12
      },
      lowerSeats: {
        rows: Number(formData.lowerRows) || 7,
        cols: Number(formData.lowerCols) || 14
      },
      // Also provide flat keys for flexible server schema controllers
      balconyRows: Number(formData.balconyRows) || 3,
      balconyCols: Number(formData.balconyCols) || 10,
      middleRows: Number(formData.middleRows) || 5,
      middleCols: Number(formData.middleCols) || 12,
      lowerRows: Number(formData.lowerRows) || 7,
      lowerCols: Number(formData.lowerCols) || 14
    };

    try {
      await API.post('/theatres', payload);
      toast.success('Theatre added successfully!');
      setFormData(defaultForm);
      fetchAdminTheatres();
    } catch (err) {
      console.error('Failed to create theatre:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to add theatre';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (theatre) => {
    const id = theatre._id || theatre.theatreId;
    if (!window.confirm(`Are you sure you want to remove "${theatre.theatreName}"?`)) {
      return;
    }

    try {
      await API.delete(`/theatres/${id}`);
      toast.success('Theatre removed successfully');
      fetchAdminTheatres();
    } catch (err) {
      console.error('Failed to delete theatre:', err);
      toast.error(err.response?.data?.message || 'Failed to remove theatre');
    }
  };

  const calculateTotalSeats = (t) => {
    const b = (t.balconySeats?.rows || t.balconyRows || 0) * (t.balconySeats?.cols || t.balconyCols || 0);
    const m = (t.middleSeats?.rows || t.middleRows || 0) * (t.middleSeats?.cols || t.middleCols || 0);
    const l = (t.lowerSeats?.rows || t.lowerRows || 0) * (t.lowerSeats?.cols || t.lowerCols || 0);
    return b + m + l;
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container py-4 flex-grow-1">
        {/* Title Header */}
        <div className="mb-4">
          <h2 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faBuilding} className="text-primary me-2" />
            Theatre & Screen Management
          </h2>
          <p className="text-secondary mb-0">
            Define seating capacities, pricing tiers (Balcony, Middle, Lower), and screen geometries.
          </p>
        </div>

        {/* Add Theatre Form Card */}
        <div
          className="p-4 p-md-5 rounded-4 mb-5 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <form onSubmit={handleSubmit}>
            <h5 className="text-white fw-bold mb-3 pb-2 border-bottom border-dark d-flex align-items-center gap-2">
              <span>Theatre Details</span>
            </h5>

            <div className="row g-4 mb-4">
              {/* Theatre Name */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Theatre Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="theatreName"
                  className="form-control form-dark text-white"
                  placeholder="e.g. Cineplex IMAX Screen 1, PVR Heritage"
                  value={formData.theatreName}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Location */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Location / City <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  className="form-control form-dark text-white"
                  placeholder="e.g. Mumbai, Bandra West"
                  value={formData.location}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Pricing Section */}
            <h5 className="text-white fw-bold mb-3 pb-2 border-bottom border-dark d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faIndianRupeeSign} className="text-warning" />
              <span>Seat Tier Pricing (₹)</span>
            </h5>

            <div className="row g-4 mb-4">
              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Balcony Seat Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  name="balconySeatPrice"
                  className="form-control form-dark text-white"
                  value={formData.balconySeatPrice}
                  onChange={handleChange}
                  required
                />
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Premium upper tier seating
                </span>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Middle Seat Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  name="middleSeatPrice"
                  className="form-control form-dark text-white"
                  value={formData.middleSeatPrice}
                  onChange={handleChange}
                  required
                />
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Optimal view standard tier
                </span>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Lower Seat Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  name="lowerSeatPrice"
                  className="form-control form-dark text-white"
                  value={formData.lowerSeatPrice}
                  onChange={handleChange}
                  required
                />
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Front rows value tier
                </span>
              </div>
            </div>

            {/* Seating Layout Grid Section */}
            <h5 className="text-white fw-bold mb-3 pb-2 border-bottom border-dark d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faLayerGroup} className="text-info" />
              <span>Seating Configuration (Rows × Columns)</span>
            </h5>

            <div className="row g-4">
              {/* Balcony Row/Cols */}
              <div className="col-12 col-md-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: '#181822', border: '1px solid #333' }}>
                  <div className="text-info fw-bold small mb-2 d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faCouch} />
                    <span>Balcony Section</span>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        name="balconyRows"
                        className="form-control form-dark text-white"
                        value={formData.balconyRows}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cols</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        name="balconyCols"
                        className="form-control form-dark text-white"
                        value={formData.balconyCols}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="text-secondary small mt-2">
                    Total: {Number(formData.balconyRows || 0) * Number(formData.balconyCols || 0)} seats
                  </div>
                </div>
              </div>

              {/* Middle Row/Cols */}
              <div className="col-12 col-md-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: '#181822', border: '1px solid #333' }}>
                  <div className="text-primary fw-bold small mb-2 d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faCouch} />
                    <span>Middle Section</span>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        name="middleRows"
                        className="form-control form-dark text-white"
                        value={formData.middleRows}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cols</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        name="middleCols"
                        className="form-control form-dark text-white"
                        value={formData.middleCols}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="text-secondary small mt-2">
                    Total: {Number(formData.middleRows || 0) * Number(formData.middleCols || 0)} seats
                  </div>
                </div>
              </div>

              {/* Lower Row/Cols */}
              <div className="col-12 col-md-4">
                <div className="p-3 rounded-3" style={{ backgroundColor: '#181822', border: '1px solid #333' }}>
                  <div className="text-success fw-bold small mb-2 d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faCouch} />
                    <span>Lower Section</span>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        name="lowerRows"
                        className="form-control form-dark text-white"
                        value={formData.lowerRows}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cols</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        name="lowerCols"
                        className="form-control form-dark text-white"
                        value={formData.lowerCols}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="text-secondary small mt-2">
                    Total: {Number(formData.lowerRows || 0) * Number(formData.lowerCols || 0)} seats
                  </div>
                </div>
              </div>
            </div>

            {/* Total Capacity Summary Bar */}
            <div className="mt-4 p-3 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-3" style={{ backgroundColor: '#101015', border: '1px solid #2a2a35' }}>
              <div className="text-secondary small">
                Calculated Total Capacity:{' '}
                <span className="text-white fw-bold fs-6">
                  {Number(formData.balconyRows || 0) * Number(formData.balconyCols || 0) +
                    Number(formData.middleRows || 0) * Number(formData.middleCols || 0) +
                    Number(formData.lowerRows || 0) * Number(formData.lowerCols || 0)}{' '}
                  Seats
                </span>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(defaultForm)}
                  className="btn btn-outline-secondary px-3 rounded-pill btn-sm"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faRotateLeft} className="me-1" />
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-blue px-4 rounded-pill shadow-sm"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-2" />
                  <span>{loading ? 'Creating...' : 'Create Theatre'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Existing Theatres List */}
        <div
          className="p-4 p-md-5 rounded-4 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-4">
            <div>
              <h4 className="text-white fw-bold mb-1">Your Registered Theatres</h4>
              <span className="text-secondary small">
                Showing all cinema halls registered under your admin account
              </span>
            </div>
            <button
              onClick={fetchAdminTheatres}
              className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-light"
            >
              Refresh Theatres
            </button>
          </div>

          {fetching ? (
            <div className="text-center py-5 text-secondary">
              <div className="spinner-border text-primary mb-2" role="status" />
              <div>Loading theatres...</div>
            </div>
          ) : theatres.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FontAwesomeIcon icon={faBuilding} size="3x" className="mb-3 text-muted" />
              <h5>No Theatres Registered Yet</h5>
              <p className="small mb-0">Fill the form above to add your first cinema hall.</p>
            </div>
          ) : (
            <div className="row g-4">
              {theatres.map((theatre) => {
                const totalSeats = calculateTotalSeats(theatre);
                const bPrice = theatre.balconySeatPrice ?? 300;
                const mPrice = theatre.middleSeatPrice ?? 200;
                const lPrice = theatre.lowerSeatPrice ?? 150;

                const bRows = theatre.balconySeats?.rows || theatre.balconyRows || 3;
                const bCols = theatre.balconySeats?.cols || theatre.balconyCols || 10;
                const mRows = theatre.middleSeats?.rows || theatre.middleRows || 5;
                const mCols = theatre.middleSeats?.cols || theatre.middleCols || 12;
                const lRows = theatre.lowerSeats?.rows || theatre.lowerRows || 7;
                const lCols = theatre.lowerSeats?.cols || theatre.lowerCols || 14;

                return (
                  <div key={theatre._id || theatre.theatreId} className="col-12 col-md-6 col-xl-4">
                    <div
                      className="card h-100 border-0 p-4 rounded-4"
                      style={{
                        backgroundColor: '#16161c',
                        border: '1px solid #282835',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.25)'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h5 className="text-white fw-bold mb-1">{theatre.theatreName}</h5>
                          <div className="text-secondary small d-flex align-items-center gap-1">
                            <FontAwesomeIcon icon={faLocationDot} className="text-danger" />
                            <span>{theatre.location}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(theatre)}
                          className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: '32px', height: '32px' }}
                          title="Delete Theatre"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>

                      {/* Seat Layout Badges */}
                      <div className="mb-3 p-3 rounded-3" style={{ backgroundColor: '#111115' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1 small">
                          <span className="text-secondary">Capacity:</span>
                          <span className="text-white fw-bold">{totalSeats} Seats</span>
                        </div>
                        <div className="d-flex justify-content-between text-secondary" style={{ fontSize: '0.75rem' }}>
                          <span>Balcony: {bRows}×{bCols}</span>
                          <span>Middle: {mRows}×{mCols}</span>
                          <span>Lower: {lRows}×{lCols}</span>
                        </div>
                      </div>

                      {/* Pricing Summary */}
                      <div className="mt-auto pt-2 border-top border-dark d-flex justify-content-between align-items-center">
                        <span className="text-secondary small">Pricing:</span>
                        <div className="d-flex gap-2">
                          <span className="badge bg-dark border border-info text-info small">
                            ₹{bPrice}
                          </span>
                          <span className="badge bg-dark border border-primary text-primary small">
                            ₹{mPrice}
                          </span>
                          <span className="badge bg-dark border border-success text-success small">
                            ₹{lPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
