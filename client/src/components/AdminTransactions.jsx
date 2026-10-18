import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faReceipt,
  faIndianRupeeSign,
  faRotateRight,
  faRotateLeft,
  faSearch,
  faFilter,
  faCheckCircle,
  faTriangleExclamation,
  faBan,
  faClock,
  faCreditCard,
  faTicket,
  faShieldHalved,
  faXmark,
  faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalCompletedRevenue: 0,
    totalRefundedAmount: 0,
    completedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    refundedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Refund Modal State
  const [selectedTx, setSelectedTx] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('Customer requested cancellation & refund');
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/admin/transactions');
      if (res.data && res.data.success) {
        setTransactions(res.data.transactions || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        toast.error('Failed to load transaction records');
      }
    } catch (err) {
      console.error('Error fetching admin transactions:', err);
      toast.error(err.response?.data?.error || 'Unable to load transactions from server');
    } finally {
      setLoading(false);
    }
  };

  // Open Refund Modal
  const handleOpenRefundModal = (tx) => {
    setSelectedTx(tx);
    setRefundReason('Customer requested cancellation & refund');
    setRefundModalOpen(true);
  };

  // Process Refund via Backend API
  const handleProcessRefund = async () => {
    if (!selectedTx) return;

    setRefunding(true);
    try {
      const paymentIdentifier = selectedTx.razorpayPaymentId || selectedTx.bookingId;
      const res = await API.post(`/admin/refund/${paymentIdentifier}`, {
        amount: selectedTx.totalAmount,
        reason: refundReason
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || 'Refund successfully processed and seats released!');
        setRefundModalOpen(false);
        setSelectedTx(null);
        // Refresh transactions list
        fetchTransactions();
      } else {
        toast.error(res.data?.error || 'Refund failed');
      }
    } catch (err) {
      console.error('Refund processing error:', err);
      toast.error(err.response?.data?.error || 'Server error while processing refund');
    } finally {
      setRefunding(false);
    }
  };

  // Filtering transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Search query matching
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (tx.bookingId && tx.bookingId.toLowerCase().includes(q)) ||
      (tx.userEmail && tx.userEmail.toLowerCase().includes(q)) ||
      (tx.movieName && tx.movieName.toLowerCase().includes(q)) ||
      (tx.theatreName && tx.theatreName.toLowerCase().includes(q)) ||
      (tx.razorpayPaymentId && tx.razorpayPaymentId.toLowerCase().includes(q)) ||
      (tx.razorpayOrderId && tx.razorpayOrderId.toLowerCase().includes(q));

    // Status matching
    const matchesStatus =
      statusFilter === 'All' ||
      (tx.paymentStatus && tx.paymentStatus.toLowerCase() === statusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'completed':
        return (
          <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-2 py-1 d-inline-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '0.75rem' }} />
            Completed
          </span>
        );
      case 'refunded':
        return (
          <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 px-2 py-1 d-inline-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: '0.75rem' }} />
            Refunded
          </span>
        );
      case 'pending':
        return (
          <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 px-2 py-1 d-inline-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faClock} style={{ fontSize: '0.75rem' }} />
            Pending
          </span>
        );
      case 'cancelled':
        return (
          <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-50 px-2 py-1 d-inline-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faBan} style={{ fontSize: '0.75rem' }} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="badge bg-secondary bg-opacity-25 text-light border border-secondary px-2 py-1">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-100">
      {/* 4 Metric Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="p-3 rounded-4 h-100 d-flex align-items-center gap-3 shadow-sm"
            style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px', backgroundColor: 'rgba(0, 150, 255, 0.15)', color: '#0096ff', fontSize: '1.25rem' }}
            >
              <FontAwesomeIcon icon={faReceipt} />
            </div>
            <div>
              <span className="text-secondary small text-uppercase fw-semibold">Total Orders</span>
              <h4 className="mb-0 text-white fw-bold">{summary.totalTransactions}</h4>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="p-3 rounded-4 h-100 d-flex align-items-center gap-3 shadow-sm"
            style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px', backgroundColor: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', fontSize: '1.25rem' }}
            >
              <FontAwesomeIcon icon={faIndianRupeeSign} />
            </div>
            <div>
              <span className="text-secondary small text-uppercase fw-semibold">Net Completed Revenue</span>
              <h4 className="mb-0 text-white fw-bold">₹{Number(summary.totalCompletedRevenue).toLocaleString('en-IN')}</h4>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="p-3 rounded-4 h-100 d-flex align-items-center gap-3 shadow-sm"
            style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px', backgroundColor: 'rgba(229, 9, 20, 0.15)', color: '#e50914', fontSize: '1.25rem' }}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
            </div>
            <div>
              <span className="text-secondary small text-uppercase fw-semibold">Total Refunded</span>
              <h4 className="mb-0 text-white fw-bold">₹{Number(summary.totalRefundedAmount).toLocaleString('en-IN')}</h4>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="p-3 rounded-4 h-100 d-flex align-items-center gap-3 shadow-sm"
            style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px', backgroundColor: 'rgba(243, 156, 18, 0.15)', color: '#f39c12', fontSize: '1.25rem' }}
            >
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
            <div>
              <span className="text-secondary small text-uppercase fw-semibold">Refunded Bookings</span>
              <h4 className="mb-0 text-white fw-bold">{summary.refundedCount} of {summary.totalTransactions}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="p-4 rounded-4 shadow-sm"
        style={{ backgroundColor: 'var(--dark-card)', border: '1px solid #262626' }}
      >
        {/* Toolbar: Search, Filters, Refresh */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <div>
            <h5 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faReceipt} className="text-danger" />
              <span>Razorpay Transactions & Refund Management</span>
            </h5>
            <span className="text-secondary small">
              Live audit of payment orders, Razorpay transaction IDs, and automated seat liberation.
            </span>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Search Box */}
            <div className="input-group" style={{ maxWidth: '280px' }}>
              <span className="input-group-text bg-dark border-secondary text-secondary">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                className="form-control form-dark text-white border-secondary"
                placeholder="Search user, ID, movie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* Filter Pills */}
            <div className="btn-group" role="group">
              {['All', 'Completed', 'Refunded', 'Pending', 'Cancelled'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm ${
                    statusFilter === st ? 'btn-danger fw-semibold' : 'btn-dark text-secondary'
                  }`}
                  style={{
                    backgroundColor: statusFilter === st ? 'var(--primary-red)' : '#161922',
                    border: '1px solid #2b3040',
                    fontSize: '0.8rem'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchTransactions}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
              title="Refresh Transactions"
            >
              <FontAwesomeIcon icon={faRotateRight} spin={loading} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="text-center py-5 text-secondary">
            <div className="spinner-border text-danger mb-3" role="status"></div>
            <div>Fetching transaction records from MongoDB...</div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-5 text-secondary border border-dark rounded-3 my-2">
            <FontAwesomeIcon icon={faTicket} size="3x" className="mb-3 opacity-50" />
            <h6 className="text-white fw-bold">No Transactions Found</h6>
            <p className="small mb-0">No booking records match your selected filter or search query.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr className="text-secondary small text-uppercase" style={{ borderBottom: '1px solid #333' }}>
                  <th className="py-3 px-3">Booking ID & Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Movie & Theatre</th>
                  <th className="py-3 px-3">Seats</th>
                  <th className="py-3 px-3 text-end">Amount</th>
                  <th className="py-3 px-3">Gateway / Payment ID</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isEligibleForRefund = tx.paymentStatus === 'Completed';
                  const dateStr = tx.createdAt
                    ? dayjs(tx.createdAt).format('DD MMM YYYY, hh:mm A')
                    : 'N/A';

                  return (
                    <tr
                      key={tx._id || tx.bookingId}
                      style={{
                        backgroundColor: '#11141c',
                        borderBottom: '1px solid #1f2330'
                      }}
                    >
                      {/* Booking ID & Timestamp */}
                      <td className="py-3 px-3">
                        <div className="fw-bold text-white small" title={tx.bookingId}>
                          {tx.bookingId ? `#${tx.bookingId.slice(0, 8)}...` : 'N/A'}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.75rem' }}>
                          {dateStr}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3">
                        <div className="text-white small fw-semibold text-truncate" style={{ maxWidth: '180px' }} title={tx.userEmail}>
                          {tx.userEmail}
                        </div>
                      </td>

                      {/* Movie & Theatre */}
                      <td className="py-3 px-3">
                        <div className="text-white small fw-bold text-truncate" style={{ maxWidth: '180px' }} title={tx.movieName}>
                          {tx.movieName || 'Untitled Movie'}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.75rem' }}>
                          {tx.theatreName}
                        </div>
                      </td>

                      {/* Seats */}
                      <td className="py-3 px-3">
                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '120px' }}>
                          {(tx.selectedSeats || []).map((s) => (
                            <span key={s} className="badge bg-dark border border-secondary text-light px-1 py-0" style={{ fontSize: '0.7rem' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-end">
                        <span className="fw-bold fs-6 text-white">
                          ₹{Number(tx.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Gateway / Payment ID */}
                      <td className="py-3 px-3">
                        {tx.razorpayPaymentId ? (
                          <div>
                            <span className="badge bg-primary bg-opacity-25 text-info border border-info border-opacity-50 px-2 py-1" style={{ fontSize: '0.75rem' }}>
                              {tx.razorpayPaymentId}
                            </span>
                            {tx.razorpayOrderId && (
                              <div className="text-secondary text-truncate" style={{ fontSize: '0.7rem', maxWidth: '140px' }} title={tx.razorpayOrderId}>
                                Ord: {tx.razorpayOrderId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary px-2 py-1" style={{ fontSize: '0.72rem' }}>
                            Internal Direct
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(tx.paymentStatus)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-end">
                        {isEligibleForRefund ? (
                          <button
                            onClick={() => handleOpenRefundModal(tx)}
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 rounded-pill px-3 py-1 fw-semibold shadow-sm"
                            style={{ fontSize: '0.78rem' }}
                          >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            <span>Issue Refund</span>
                          </button>
                        ) : tx.paymentStatus === 'Refunded' ? (
                          <span className="text-secondary small d-inline-flex align-items-center gap-1" title={tx.refundId}>
                            <FontAwesomeIcon icon={faCheckCircle} className="text-danger" />
                            <span>Refunded</span>
                          </span>
                        ) : (
                          <span className="text-secondary small">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Refund */}
      {refundModalOpen && selectedTx && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content text-white rounded-4 shadow-lg"
              style={{ backgroundColor: '#141720', border: '1px solid #2e3547' }}
            >
              {/* Header */}
              <div className="modal-header border-secondary border-opacity-25 px-4 pt-4 pb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-danger bg-opacity-20 text-danger p-2 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                    <FontAwesomeIcon icon={faRotateLeft} />
                  </div>
                  <h5 className="modal-title fw-bold text-white mb-0">Confirm Booking Refund</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setRefundModalOpen(false)}
                  disabled={refunding}
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body px-4 py-3">
                <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger small rounded-3 mb-3 d-flex align-items-start gap-2">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-1" />
                  <div>
                    <strong>Irreversible Action:</strong> This will trigger the Razorpay refund API, mark the booking status as <strong>Refunded</strong>, and immediately liberate all <strong>{(selectedTx.selectedSeats || []).join(', ')}</strong> seats back to the theatre seat map.
                  </div>
                </div>

                <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#0d1017', border: '1px solid #212636' }}>
                  <div className="row g-2 small">
                    <div className="col-5 text-secondary">Customer Email:</div>
                    <div className="col-7 text-white fw-semibold text-truncate">{selectedTx.userEmail}</div>

                    <div className="col-5 text-secondary">Movie:</div>
                    <div className="col-7 text-white fw-semibold">{selectedTx.movieName}</div>

                    <div className="col-5 text-secondary">Theatre:</div>
                    <div className="col-7 text-white fw-semibold">{selectedTx.theatreName}</div>

                    <div className="col-5 text-secondary">Booked Seats:</div>
                    <div className="col-7 text-white fw-semibold">{(selectedTx.selectedSeats || []).join(', ')}</div>

                    <div className="col-5 text-secondary">Payment ID:</div>
                    <div className="col-7 text-info fw-semibold text-truncate">{selectedTx.razorpayPaymentId || 'Direct'}</div>

                    <div className="col-5 text-secondary">Refund Amount:</div>
                    <div className="col-7 text-danger fw-bold fs-6">₹{selectedTx.totalAmount}</div>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label text-secondary small fw-semibold">Refund Reason (Audited in Razorpay Notes):</label>
                  <input
                    type="text"
                    className="form-control form-dark text-white border-secondary"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g., Customer requested show cancellation"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-secondary border-opacity-25 px-4 pb-4 pt-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4 rounded-pill"
                  onClick={() => setRefundModalOpen(false)}
                  disabled={refunding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 rounded-pill fw-bold d-flex align-items-center gap-2 shadow"
                  onClick={handleProcessRefund}
                  disabled={refunding}
                >
                  {refunding ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Processing Gateway Refund...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faRotateLeft} />
                      <span>Confirm & Issue Refund</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
