/**
 * webhookRoutes.js
 * Express Router for External Webhook Integrations
 */

const express = require('express');
const router = express.Router();
const {
  handleBrevoWebhook,
  verifyWebhookEndpoint,
  getWebhookLogs
} = require('../controllers/webhookController');

// Brevo Webhook Endpoints
// Supports default path, parameterized secret path, and query/header tokens
router.get('/brevo', verifyWebhookEndpoint);
router.post('/brevo', handleBrevoWebhook);
router.post('/brevo/:secret', handleBrevoWebhook);

// Webhook Audit & Observability (Logs)
router.get('/brevo/logs', getWebhookLogs);

module.exports = router;
