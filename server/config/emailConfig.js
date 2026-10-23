/**
 * emailConfig.js
 * Centralized Configuration for Brevo Transactional Email Service
 * Gracefully handles missing env vars — never throws or crashes on startup.
 */

require('dotenv').config();

const BREVO_API_KEY = process.env.BREVO_API_KEY || null;
const SENDER_EMAIL  = process.env.SENDER_EMAIL  || 'en24cs3010865@medicaps.ac.in';
const SENDER_NAME   = process.env.SENDER_NAME   || 'iMovies';
const CLIENT_URL    = process.env.CLIENT_URL    || 'http://localhost:5173';

// Soft check — warn only, never error or crash
const isConfigured = (() => {
  if (!BREVO_API_KEY) {
    console.warn(
      '[emailConfig] ⚠️  BREVO_API_KEY is not set in environment variables. ' +
      'Transactional emails (OTP, tickets, password reset) will be skipped until this is configured in your Render dashboard.'
    );
    return false;
  }
  if (!BREVO_API_KEY.startsWith('xkeysib-')) {
    console.warn('[emailConfig] ⚠️  BREVO_API_KEY does not appear to be a valid Sendinblue/Brevo key (expected prefix: xkeysib-).');
  }
  return true;
})();

module.exports = {
  BREVO_API_KEY,
  SENDER_EMAIL,
  SENDER_NAME,
  CLIENT_URL,
  isConfigured
};
