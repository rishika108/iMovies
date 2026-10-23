/**
 * emailConfig.js
 * Centralized Configuration and Environment Validator for Brevo Transactional Email Service
 */

require('dotenv').config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'en24cs3010865@medicaps.ac.in';
const SENDER_NAME = process.env.SENDER_NAME || 'iMovies';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Validate configuration
const validateConfig = () => {
  const errors = [];

  if (!BREVO_API_KEY) {
    errors.push('BREVO_API_KEY is missing from environment variables.');
  } else if (!BREVO_API_KEY.startsWith('xkeysib-')) {
    console.warn('[emailConfig Warning] BREVO_API_KEY does not appear to follow the standard xkeysib- prefix.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!SENDER_EMAIL || !emailRegex.test(SENDER_EMAIL)) {
    errors.push(`SENDER_EMAIL (${SENDER_EMAIL}) is not a valid email address.`);
  }

  if (errors.length > 0) {
    console.error('[emailConfig Error] Invalid email configuration:\n' + errors.join('\n'));
    return false;
  }

  return true;
};

const isConfigured = validateConfig();

module.exports = {
  BREVO_API_KEY,
  SENDER_EMAIL,
  SENDER_NAME,
  CLIENT_URL,
  isConfigured,
  validateConfig
};
