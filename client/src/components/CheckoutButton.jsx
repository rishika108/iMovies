import React, { useState } from 'react';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faQrcode, faShieldHalved } from '@fortawesome/free-solid-svg-icons';

/**
 * Loads Razorpay Checkout script dynamically with fallback
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.onload = () => resolve(true);
      existing.onerror = () => resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Reusable Razorpay Checkout Button with Native Multi-UPI (GPay, PhonePe, Paytm, QR) & Card Support
 */
export default function CheckoutButton({
  bookingId,
  amount,
  movieTitle = 'Movie Tickets',
  theatreName = '',
  selectedSeats = [],
  userEmail = '',
  userName = '',
  userPhone = '',
  onPaymentSuccess,
  onPaymentFailure,
  disabled = false,
  className = 'btn btn-primary-red w-100 py-2 fw-bold'
}) {
  const [loading, setLoading] = useState(false);

  const handlePayNow = async () => {
    setLoading(true);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Unable to load payment gateway. Please check your network connection.');
        setLoading(false);
        return;
      }

      // Step 2 & 3: Create Order via Backend (amount converted to paise)
      const orderRes = await API.post('/payment/create-order', {
        bookingId,
        amount,
        currency: 'INR'
      });

      if (!orderRes.data || !orderRes.data.success) {
        throw new Error(orderRes.data?.error || 'Failed to create payment order');
      }

      const { orderId, amount: amountInPaise, currency, key } = orderRes.data;
      const razorpayKey = key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TpNJvdvA0P93UL';

      // Step 4: Razorpay Options with Native UPI & QR Priority Configuration
      const options = {
        key: razorpayKey,
        amount: amountInPaise,
        currency: currency || 'INR',
        name: 'iMovies Cinema Experience',
        description: `${movieTitle} • Seats: ${selectedSeats.join(', ')}`,
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=128&q=80',
        order_id: orderId,
        prefill: {
          name: userName || 'Movie Enthusiast',
          email: userEmail || '',
          contact: userPhone || '9999999999',
          method: 'upi'
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI (Google Pay, PhonePe, Paytm, BHIM, QR)',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['collect', 'intent', 'qr']
                  }
                ]
              },
              cards: {
                name: 'Credit / Debit Cards',
                instruments: [{ method: 'card' }]
              },
              netbanking: {
                name: 'NetBanking & Wallets',
                instruments: [{ method: 'netbanking' }, { method: 'wallet' }]
              }
            },
            sequence: ['block.upi', 'block.cards', 'block.netbanking'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        notes: {
          bookingId: bookingId || '',
          theatre: theatreName || '',
          selectedSeats: selectedSeats.join(', '),
          upi_options: 'googlepay,phonepe,paytm,bhim,upi_qr'
        },
        theme: {
          color: '#e50914'
        },
        handler: async function (response) {
          try {
            setLoading(true);
            const verifyRes = await API.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId
            });

            if (verifyRes.data && verifyRes.data.success) {
              toast.success('🎉 Payment Verified! Your movie tickets are confirmed.');
              if (onPaymentSuccess) {
                onPaymentSuccess(verifyRes.data.booking);
              }
            } else {
              toast.error(verifyRes.data?.error || 'Payment signature verification failed.');
              if (onPaymentFailure) onPaymentFailure(verifyRes.data);
            }
          } catch (err) {
            console.error('Verification error:', err);
            toast.error(err.response?.data?.error || 'Server error verifying payment');
            if (onPaymentFailure) onPaymentFailure(err);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            toast.info('Payment cancelled. Your seats remain reserved for the timer duration.');
            setLoading(false);
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', function (failResp) {
        console.error('Payment Failed:', failResp.error);
        toast.error(`Payment failed: ${failResp.error?.description || 'Transaction unsuccessful'}`);
        setLoading(false);
        if (onPaymentFailure) onPaymentFailure(failResp.error);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err.response?.data?.error || err.message || 'Payment initiation failed');
      setLoading(false);
    }
  };

  return (
    <div className="w-100">
      <button
        type="button"
        className={className}
        onClick={handlePayNow}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className="d-flex align-items-center justify-content-center gap-2">
            <span className="spinner-border spinner-border-sm" role="status"></span>
            Opening UPI & Payment Gateway...
          </span>
        ) : (
          <span className="d-flex align-items-center justify-content-center gap-2">
            <FontAwesomeIcon icon={faCreditCard} />
            <span>Proceed to Pay ₹{amount}</span>
          </span>
        )}
      </button>

      {/* Visual Badges for UPI & Payment options */}
      <div className="mt-2 text-center">
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-1 mb-1">
          <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.68rem' }}>
            <FontAwesomeIcon icon={faQrcode} className="me-1 text-danger" />
            UPI QR
          </span>
          <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.68rem' }}>
            Google Pay
          </span>
          <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.68rem' }}>
            PhonePe
          </span>
          <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.68rem' }}>
            Paytm / BHIM
          </span>
          <span className="badge bg-dark border border-secondary text-light px-2 py-1" style={{ fontSize: '0.68rem' }}>
            Cards & NetBanking
          </span>
        </div>
        <div className="text-secondary small d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '0.72rem' }}>
          <FontAwesomeIcon icon={faShieldHalved} className="text-success" />
          <span>Razorpay Instant 256-Bit SSL Encryption</span>
        </div>
      </div>
    </div>
  );
}
