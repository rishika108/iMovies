/**
 * brevoConfig.js
 * Centralized Configuration & Client Initialization for Brevo (Sendinblue)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { BrevoClient } = require('@getbrevo/brevo');

const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const SENDER_EMAIL = (process.env.SENDER_EMAIL || 'en24cs3010865@medicaps.ac.in').trim();
const SENDER_NAME = (process.env.SENDER_NAME || 'iMovies').trim();
const CLIENT_URL = (process.env.CLIENT_URL || 'https://i-movies-theta.vercel.app').trim();

/**
 * Validate configuration values
 * @returns {{ isValid: boolean, error?: string }}
 */
const validateBrevoConfig = () => {
  if (!BREVO_API_KEY) {
    return {
      isValid: false,
      error: 'BREVO_API_KEY environment variable is missing or empty'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(SENDER_EMAIL)) {
    return {
      isValid: false,
      error: `SENDER_EMAIL is not a valid email address: "${SENDER_EMAIL}"`
    };
  }

  return { isValid: true };
};

// Initialize Brevo client instance safely
let brevoClient = null;
if (BREVO_API_KEY) {
  try {
    brevoClient = new BrevoClient({ apiKey: BREVO_API_KEY });
  } catch (err) {
    console.error('[brevoConfig] Failed to initialize BrevoClient:', err.message);
  }
} else {
  console.warn('[brevoConfig] BREVO_API_KEY is not configured. Transactional emails will be disabled or mocked.');
}

module.exports = {
  BREVO_API_KEY,
  SENDER_EMAIL,
  SENDER_NAME,
  CLIENT_URL,
  brevoClient,
  validateBrevoConfig,
  isConfigured: () => Boolean(BREVO_API_KEY && brevoClient)
};
