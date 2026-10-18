import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TicketModal from '../components/TicketModal';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faReceipt,
  faSearch,
  faFilter,
  faFileCsv,
  faEye,
  faIndianRupeeSign,
  faCheckCircle,
  faClock,
  faXmark,
  faRotateLeft,
  faChevronLeft,
  faChevronRight,
  faTicket,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';

const ITEMS_PER_PAGE = 20;

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Filters state
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [filterDate, setFilterDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAllBookings();
  }, []);

  const fetchAllBookings = async () => {
    setLoading(true);
    try {
      const res = await API.get('/bookings/all');
      const data = res.data?.bookings || res.data?.data || res.data || [];
      const bookingsList = Array.isArray(data) ? data : [];
      // Sort newest first
      bookingsList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setBookings(bookingsList);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      toast.error('Failed to load bookings database');
    } finally {
      setLoading(false);
    }
  };

  // Top summary metrics
  const summary = useMemo(() => {
    let completedRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    bookings.forEach((b) => {
      const status = (b.paymentStatus || 'Pending').toLowerCase();
      const amount = Number(b.totalAmount) || 0;

      if (status === 'completed' || status === 'confirmed') {
        completedCount++;
        completedRevenue += amount;
      } else if (status === 'pending') {
        pendingCount++;
      } else if (status === 'failed') {
        failedCount++;
      }
    });

    return {
      completedRevenue,
      completedCount,
      pendingCount,
      failedCount,
      totalCount: bookings.length
    };
  }, [bookings]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Email or ID search
      if (searchEmail.trim()) {
        const query = searchEmail.toLowerCase().trim();
        const email = (b.userEmail || '').toLowerCase();
        const id = (b.bookingId || b._id || '').toLowerCase();
        const movie = (b.movieName || '').toLowerCase();
        if (!email.includes(query) && !id.includes(query) && !movie.includes(query)) {
          return false;
        }
      }

      // 2. Status filter
      if (selectedStatus !== 'All') {
        const status = (b.paymentStatus || 'Pending').toLowerCase();
        if (status !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // 3. Date filter
      if (filterDate) {
        const bShowDate = b.showDate ? b.showDate.split('T')[0] : '';
        const bCreatedDate = b.createdAt ? b.createdAt.split('T')[0] : '';
        if (bShowDate !== filterDate && bCreatedDate !== filterDate) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, searchEmail, selectedStatus, filterDate]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / ITEMS_PER_PAGE));
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleResetFilters = () => {
    setSearchEmail('');
    setSelectedStatus('All');
    setFilterDate('');
    setCurrentPage(1);
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (filteredBookings.length === 0) {
      toast.warning('No bookings to export with current filters');
      return;
    }

    const headers = [
      'Booking ID',
      'User Email',
      'Movie Name',
      'Theatre Name',
      'Show Date',
      'Show Time',
      'Selected Seats',
      'Total Amount (INR)',
      'Payment Status',
      'Created At'
    ];

    const rows = filteredBookings.map((b) => {
      const seats = Array.isArray(b.selectedSeats)
        ? b.selectedSeats.join(';')
        : b.selectedSeats || '';

      const clean = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        clean(b.bookingId || b._id),
        clean(b.userEmail),
        clean(b.movieName),
        clean(b.theatreName),
        clean(b.showDate),
        clean(b.showTime),
        clean(seats),
        clean(b.totalAmount || 0),
        clean(b.paymentStatus || 'Pending'),
        clean(b.createdAt ? new Date(b.createdAt).toLocaleString() : '')
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `imovies_bookings_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Bookings exported to CSV');
  };

  const getStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase();
    switch (s) {
      case 'completed':
      case 'confirmed':
        return (
          <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-2 py-1">
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 px-2 py-1">
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 px-2 py-1">
            Failed
          </span>
        );
      case 'cancelled':
      default:
        return (
          <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-50 px-2 py-1">
            {status || 'Cancelled'}
          </span>
        );
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid px-3 px-md-5 py-4 flex-grow-1">
        {/* Title Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <div>
            <h2 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faReceipt} className="text-warning me-2" />
              All Cinema Bookings
            </h2>
            <p className="text-secondary mb-0">
              Complete audit ledger of customer ticket transactions, verification codes, and statuses.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Link
              to="/admintransactions"
              className="btn btn-outline-danger btn-sm px-3 rounded-pill d-flex align-items-center gap-2 fw-semibold"
            >
              <FontAwesomeIcon icon={faCreditCard} />
              <span>Razorpay Refunds</span>
            </Link>
            <button
              onClick={exportToCSV}
              className="btn btn-outline-success btn-sm px-3 rounded-pill d-flex align-items-center gap-2"
            >
              <FontAwesomeIcon icon={faFileCsv} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchAllBookings}
              className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-light"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="row g-3 g-md-4 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div
              className="p-4 rounded-4 shadow-sm"
              style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-secondary text-uppercase small fw-semibold">
                    Completed Revenue
                  </span>
                  <h3 className="text-white fw-bold mt-1 mb-0">
                    ₹{summary.completedRevenue.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-warning"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    fontSize: '1.4rem'
                  }}
                >
                  <FontAwesomeIcon icon={faIndianRupeeSign} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div
              className="p-4 rounded-4 shadow-sm"
              style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-secondary text-uppercase small fw-semibold">
                    Completed Bookings
                  </span>
                  <h3 className="text-white fw-bold mt-1 mb-0">{summary.completedCount}</h3>
                </div>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-success"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    border: '1px solid rgba(46, 204, 113, 0.3)',
                    fontSize: '1.4rem'
                  }}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div
              className="p-4 rounded-4 shadow-sm"
              style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-secondary text-uppercase small fw-semibold">
                    Pending Verification
                  </span>
                  <h3 className="text-white fw-bold mt-1 mb-0">{summary.pendingCount}</h3>
                </div>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-warning"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    border: '1px solid rgba(243, 156, 18, 0.3)',
                    fontSize: '1.4rem'
                  }}
                >
                  <FontAwesomeIcon icon={faClock} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div
              className="p-4 rounded-4 shadow-sm"
              style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-secondary text-uppercase small fw-semibold">
                    Total Transactions
                  </span>
                  <h3 className="text-white fw-bold mt-1 mb-0">{summary.totalCount}</h3>
                </div>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-info"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'rgba(0, 150, 255, 0.1)',
                    border: '1px solid rgba(0, 150, 255, 0.3)',
                    fontSize: '1.4rem'
                  }}
                >
                  <FontAwesomeIcon icon={faTicket} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          className="p-4 rounded-4 mb-4 shadow-sm"
          style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
        >
          <div className="row g-3 align-items-end">
            {/* Search Input */}
            <div className="col-12 col-md-4">
              <label className="form-label text-secondary small fw-bold">
                Search Customer Email / Booking ID / Movie
              </label>
              <div className="input-group">
                <span className="input-group-text bg-dark border-secondary text-secondary">
                  <FontAwesomeIcon icon={faSearch} />
                </span>
                <input
                  type="text"
                  className="form-control form-dark text-white"
                  placeholder="e.g. user@gmail.com, Inception..."
                  value={searchEmail}
                  onChange={(e) => {
                    setSearchEmail(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Status Dropdown */}
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label text-secondary small fw-bold">Payment Status</label>
              <select
                className="form-select form-dark text-white"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label text-secondary small fw-bold">Show / Booking Date</label>
              <input
                type="date"
                className="form-control form-dark text-white"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Reset Filters */}
            <div className="col-12 col-md-2 d-flex">
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-outline-secondary w-100 rounded-pill py-2 text-light"
              >
                <FontAwesomeIcon icon={faRotateLeft} className="me-2" />
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        <div
          className="p-4 p-md-5 rounded-4 shadow-sm"
          style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
        >
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-4">
            <div>
              <h4 className="text-white fw-bold mb-1">Bookings Ledger</h4>
              <span className="text-secondary small">
                Showing {filteredBookings.length} results matching filter criteria
              </span>
            </div>
            <div className="text-secondary small">
              Page <span className="text-white fw-bold">{currentPage}</span> of{' '}
              <span className="text-white fw-bold">{totalPages}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-secondary">
              <div className="spinner-border text-warning mb-2" role="status" />
              <div>Loading reservations ledger...</div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FontAwesomeIcon icon={faReceipt} size="3x" className="mb-3 text-muted" />
              <h5>No Bookings Match Your Filter</h5>
              <p className="small mb-0">Try clearing filters or searching with a different term.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table
                  className="table table-dark table-hover align-middle mb-0"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <thead>
                    <tr className="border-bottom border-secondary text-secondary small text-uppercase">
                      <th scope="col" className="py-3">Booking ID</th>
                      <th scope="col" className="py-3">Customer Email</th>
                      <th scope="col" className="py-3">Movie</th>
                      <th scope="col" className="py-3">Theatre</th>
                      <th scope="col" className="py-3">Date</th>
                      <th scope="col" className="py-3">Time</th>
                      <th scope="col" className="py-3">Seats</th>
                      <th scope="col" className="py-3">Amount</th>
                      <th scope="col" className="py-3">Status</th>
                      <th scope="col" className="py-3 text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.map((b) => {
                      const id = b.bookingId || b._id;
                      const seats = Array.isArray(b.selectedSeats)
                        ? b.selectedSeats.join(', ')
                        : b.selectedSeats || 'N/A';
                      const amount = Number(b.totalAmount) || 0;

                      return (
                        <tr key={id} className="border-bottom border-dark">
                          <td className="font-monospace text-warning small fw-bold">
                            {id ? id.substring(0, 10) : 'N/A'}
                          </td>
                          <td className="text-white small">
                            {b.userEmail || 'Guest'}
                          </td>
                          <td className="text-white fw-semibold">
                            {b.movieName || 'Movie Title'}
                          </td>
                          <td className="text-secondary small">
                            {b.theatreName || 'Theatre'}
                          </td>
                          <td className="text-secondary small">
                            {b.showDate || 'N/A'}
                          </td>
                          <td className="text-secondary small font-monospace">
                            {b.showTime || 'N/A'}
                          </td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-50 text-light font-monospace small">
                              {seats}
                            </span>
                          </td>
                          <td className="text-white fw-bold">
                            ₹{amount.toLocaleString('en-IN')}
                          </td>
                          <td>{getStatusBadge(b.paymentStatus)}</td>
                          <td className="text-end">
                            <button
                              onClick={() => setSelectedBooking(b)}
                              className="btn btn-outline-info btn-sm rounded-circle p-2"
                              title="View Full Ticket & Details"
                              style={{ width: '34px', height: '34px' }}
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 mt-4 pt-3 border-top border-dark">
                  <div className="text-secondary small">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of{' '}
                    {filteredBookings.length} records
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="me-1" />
                      Prev
                    </button>

                    <div className="d-flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          return (
                            p === 1 ||
                            p === totalPages ||
                            (p >= currentPage - 1 && p <= currentPage + 1)
                          );
                        })
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          return (
                            <React.Fragment key={p}>
                              {prev && p - prev > 1 && (
                                <span className="text-secondary px-2">...</span>
                              )}
                              <button
                                className={`btn btn-sm rounded-circle ${
                                  currentPage === p
                                    ? 'btn-danger text-white fw-bold'
                                    : 'btn-outline-dark text-secondary'
                                }`}
                                style={{ width: '32px', height: '32px', padding: 0 }}
                                onClick={() => handlePageChange(p)}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      Next
                      <FontAwesomeIcon icon={faChevronRight} className="ms-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Ticket Modal Details Popup */}
      {selectedBooking && (
        <TicketModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      <Footer />
    </div>
  );
}
