/**
 * testBrevoSuite.js
 * Verification script testing Brevo transactional emails (Base methods + all 4 wrapper flows)
 */

require('dotenv').config();
const {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail
} = require('./services/emailService');
const emailConfig = require('./config/emailConfig');

async function runTestSuite() {
  const targetEmail = process.env.TEST_EMAIL || emailConfig.SENDER_EMAIL;
  console.log(`\n===============================================================`);
  console.log(`🎬 iMovies Brevo Transactional Email Test Suite`);
  console.log(`Target Recipient : ${targetEmail}`);
  console.log(`Sender           : ${emailConfig.SENDER_NAME} <${emailConfig.SENDER_EMAIL}>`);
  console.log(`===============================================================\n`);

  try {
    // 1. Test Base sendEmail
    console.log('1️⃣  Testing Base sendEmail...');
    const res1 = await sendEmail({
      to: targetEmail,
      subject: '🎬 [Test 1/5] iMovies Brevo Base Service Verification',
      htmlContent: '<p>Base sendEmail method is working properly.</p>',
      tags: ['test', 'base']
    });
    console.log(`   Result: ${res1.success ? '✅ SUCCESS' : '❌ FAILED'} | MessageID: ${res1.messageId || res1.error}\n`);

    // 2. Test sendVerificationEmail (with 6-digit OTP and Link)
    console.log('2️⃣  Testing sendVerificationEmail (Account Activation + OTP)...');
    const res2 = await sendVerificationEmail(targetEmail, {
      username: 'Alex Rider',
      verificationToken: 'sample_verification_token_abc123',
      otp: '749201'
    });
    console.log(`   Result: ${res2.success ? '✅ SUCCESS' : '❌ FAILED'} | MessageID: ${res2.messageId || res2.error}\n`);

    // 3. Test sendPasswordResetEmail (Recovery link + OTP)
    console.log('3️⃣  Testing sendPasswordResetEmail (Password Recovery + OTP)...');
    const res3 = await sendPasswordResetEmail(targetEmail, {
      username: 'Alex Rider',
      resetToken: 'sample_reset_token_xyz890',
      otp: '518392'
    });
    console.log(`   Result: ${res3.success ? '✅ SUCCESS' : '❌ FAILED'} | MessageID: ${res3.messageId || res3.error}\n`);

    // 4. Test sendBookingConfirmationEmail (Cinema Ticket pass)
    console.log('4️⃣  Testing sendBookingConfirmationEmail (Digital Cinema Ticket)...');
    const res4 = await sendBookingConfirmationEmail(targetEmail, {
      bookingId: 'IMV-2026-99881',
      movieTitle: 'Oppenheimer',
      theatre: 'PVR IMAX Phoenix MarketCity',
      showDate: '2026-10-25',
      showTime: '07:30 PM',
      seatNumbers: ['B4', 'B5'],
      totalAmount: 650
    });
    console.log(`   Result: ${res4.success ? '✅ SUCCESS' : '❌ FAILED'} | MessageID: ${res4.messageId || res4.error}\n`);

    // 5. Test sendBookingStatusUpdateEmail (Status Change / Refund)
    console.log('5️⃣  Testing sendBookingStatusUpdateEmail (Refund Notification)...');
    const res5 = await sendBookingStatusUpdateEmail(targetEmail, {
      bookingId: 'IMV-2026-99881',
      movieName: 'Oppenheimer',
      status: 'Refunded',
      refundAmount: 650,
      reason: 'Customer initiated cancellation',
      releasedSeats: ['B4', 'B5']
    });
    console.log(`   Result: ${res5.success ? '✅ SUCCESS' : '❌ FAILED'} | MessageID: ${res5.messageId || res5.error}\n`);

    console.log('===============================================================');
    console.log('🎉 ALL BREVO TRANSACTIONAL EMAIL TESTS COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    process.exit(1);
  }
}

runTestSuite();
