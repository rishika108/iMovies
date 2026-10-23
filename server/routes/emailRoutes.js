/**
 * emailRoutes.js
 * Endpoints for transactional emails and diagnostics
 */

const express = require('express');
const router = express.Router();
const {
  testEmail,
  sendCustomTicketConfirmation,
  sendCustomStatusUpdate
} = require('../controllers/emailController');

// Test & diagnostics
router.post('/test', testEmail);

// Explicit transactional triggers
router.post('/ticket-confirmation', sendCustomTicketConfirmation);
router.post('/status-update', sendCustomStatusUpdate);

module.exports = router;
