const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  getPaymentKey
} = require('../controllers/paymentController');
const fetchUser = require('../middlewares/fetchUser');

/**
 * Route: POST /api/payment/create-order
 * Initializes a Razorpay order with amount and currency
 */
router.post('/create-order', fetchUser, createOrder);

/**
 * Route: POST /api/payment/verify
 * Validates HMAC SHA256 payment signature and updates booking status
 */
router.post('/verify', fetchUser, verifyPayment);

/**
 * Route: GET /api/payment/key
 * Returns public Razorpay key ID for client checkout
 */
router.get('/key', getPaymentKey);

module.exports = router;
