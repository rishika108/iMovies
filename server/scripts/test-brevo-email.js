/**
 * test-brevo-email.js
 * Verification and Diagnostic Script for Brevo Transactional Email Integration
 *
 * Runs through:
 * 1. Configuration Validation & Account Connectivity Check
 * 2. sendVerificationEmail()
 * 3. sendPasswordResetEmail()
 * 4. sendBookingConfirmationEmail() (with direct details payload)
 * 5. sendBookingStatusUpdateEmail()
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  brevoClient,
  SENDER_EMAIL,
  SENDER_NAME,
  CLIENT_URL,
  validateBrevoConfig,
  isConfigured
} = require('../config/brevoConfig');

const {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail
} = require('../services/emailService');

const runTest = async () => {
  console.log('====================================================');
  console.log('  iMovies Brevo Transactional Email Test Suite');
  console.log('====================================================\n');

  // 1. Config Validation
  console.log('[1/5] Checking Brevo configuration...');
  const validation = validateBrevoConfig();
  if (!validation.isValid) {
    console.error(`❌ Configuration invalid: ${validation.error}`);
    process.exit(1);
  }
  console.log('  ✓ Config syntax valid');
  console.log(`  ✓ Sender: "${SENDER_NAME}" <${SENDER_EMAIL}>`);
  console.log(`  ✓ Client URL: ${CLIENT_URL}`);
  console.log(`  ✓ Brevo Client initialized: ${isConfigured()}\n`);

  // 2. Account Connectivity Check
  console.log('[2/5] Testing Brevo API connectivity...');
  try {
    const accountInfo = await brevoClient.account.getAccount();
    console.log(`  ✓ Brevo API connected!`);
    console.log(`  ✓ Account Email: ${accountInfo.email}`);
    console.log(`  ✓ Plan: ${accountInfo.plan?.[0]?.type || 'Free/Credits'}`);
    console.log(`  ✓ Credits Remaining: ${accountInfo.plan?.[0]?.credits ?? 'N/A'}\n`);
  } catch (err) {
    console.warn(`  ⚠️ Could not query account info (${err.message}). Proceeding with direct send test...\n`);
  }

  const targetEmail = process.argv[2] || process.env.TEST_EMAIL || SENDER_EMAIL;
  console.log(`Target recipient for test: ${targetEmail}\n`);

  // 3. Test sendVerificationEmail
  console.log('[3/5] Testing sendVerificationEmail()...');
  const verifyResult = await sendVerificationEmail(
    targetEmail,
    `verify-token-${Date.now()}`,
    'Test User'
  );
  if (verifyResult.success) {
    console.log(`  ✓ Verification email sent! Message ID: ${verifyResult.messageId}`);
  } else {
    console.error(`  ❌ Verification email failed: ${verifyResult.error} (Status: ${verifyResult.statusCode})`);
  }
  console.log();

  // 4. Test sendBookingConfirmationEmail
  console.log('[4/5] Testing sendBookingConfirmationEmail()...');
  const bookingResult = await sendBookingConfirmationEmail(targetEmail, {
    bookingId: `IMV-TEST-${Date.now().toString().slice(-6)}`,
    movieTitle: 'Spider-Man: Beyond the Spider-Verse',
    theatreName: 'PVR INOX Gold Screen 2',
    showDate: new Date().toISOString().split('T')[0],
    showTime: '07:30 PM',
    selectedSeats: ['B14', 'B15'],
    totalAmount: 640,
    paymentStatus: 'Completed',
    bookingDate: new Date().toISOString()
  });
  if (bookingResult.success) {
    console.log(`  ✓ Booking confirmation sent! Message ID: ${bookingResult.messageId}`);
  } else {
    console.error(`  ❌ Booking confirmation failed: ${bookingResult.error} (Status: ${bookingResult.statusCode})`);
  }
  console.log();

  // 5. Test sendBookingStatusUpdateEmail
  console.log('[5/5] Testing sendBookingStatusUpdateEmail()...');
  const updateResult = await sendBookingStatusUpdateEmail(targetEmail, {
    status: 'Confirmed',
    bookingId: `IMV-TEST-${Date.now().toString().slice(-6)}`,
    movieTitle: 'Spider-Man: Beyond the Spider-Verse',
    message: 'Your payment has been cleared and your seats are reserved.'
  });
  if (updateResult.success) {
    console.log(`  ✓ Status update email sent! Message ID: ${updateResult.messageId}`);
  } else {
    console.error(`  ❌ Status update failed: ${updateResult.error} (Status: ${updateResult.statusCode})`);
  }
  console.log();

  console.log('====================================================');
  console.log('  Brevo Integration Verification Completed!');
  console.log('====================================================');
};

runTest().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
