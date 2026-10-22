/**
 * emailRoutes.js
 * Express Router for Brevo (Sendinblue) Transactional Emails
 */

const express = require('express');
const router = express.Router();

const {
  sendVerification,
  sendPasswordReset,
  sendBookingConfirmation,
  sendBookingStatusUpdate,
  sendCustom,
  testEmail,
  getStatus
} = require('../controllers/emailController');

// Status & Diagnostics
router.get('/status', getStatus);
router.get('/test', testEmail);
router.post('/test', testEmail);

// Transactional Workflows
router.post('/send-verification', sendVerification);
router.post('/send-reset-password', sendPasswordReset);
router.post('/send-booking-confirmation', sendBookingConfirmation);
router.post('/send-status-update', sendBookingStatusUpdate);
router.post('/send-custom', sendCustom);

module.exports = router;
