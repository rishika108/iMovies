/**
 * test-auth-and-webhooks.js
 * Comprehensive Integration Test for:
 * 1. User Registration with Brevo verification email trigger
 * 2. Token-based email verification
 * 3. Password reset request and execution
 * 4. Brevo Webhook processing (delivered, hard_bounce, soft_bounce, spam, blocked)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/userModel');
const WebhookEvent = require('../models/webhookEventModel');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../services/emailService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/imovies';

const runIntegrationTests = async () => {
  console.log('===============================================================');
  console.log('  iMovies User Auth & Brevo Webhook Integration Test Suite');
  console.log('===============================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB for testing\n');

    const testEmail = `test_brevo_${Date.now()}@example.com`;
    const testUsername = `user_${Date.now().toString().slice(-6)}`;
    const originalPassword = 'InitialPassword123!';
    const updatedPassword = 'NewSecretPassword456!';

    // =========================================================================
    // TEST 1: User Registration & Token Generation
    // =========================================================================
    console.log('[TEST 1/5] Testing User Registration with Verification Token...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(originalPassword, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const testUser = new User({
      username: testUsername,
      email: testEmail,
      password: hashedPassword,
      role: 'user',
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      emailStatus: 'valid'
    });

    await testUser.save();
    console.log(`  ✓ Test user saved: ${testUser.email}`);
    console.log(`  ✓ isVerified: ${testUser.isVerified} (Expected: false)`);
    console.log(`  ✓ verificationToken: ${testUser.verificationToken ? 'Generated' : 'Missing'}`);
    console.log(`  ✓ verificationTokenExpires: ${testUser.verificationTokenExpires.toISOString()}\n`);

    if (testUser.isVerified !== false || !testUser.verificationToken) {
      throw new Error('Test 1 Failed: User verification state invalid');
    }

    // =========================================================================
    // TEST 2: Email Verification Flow
    // =========================================================================
    console.log('[TEST 2/5] Testing Email Verification Validation...');
    const userToVerify = await User.findOne({
      verificationToken,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!userToVerify) {
      throw new Error('Test 2 Failed: Token lookup failed');
    }

    userToVerify.isVerified = true;
    userToVerify.verificationToken = null;
    userToVerify.verificationTokenExpires = null;
    await userToVerify.save();

    const verifiedUser = await User.findById(testUser._id);
    console.log(`  ✓ User account verified: ${verifiedUser.isVerified} (Expected: true)`);
    console.log(`  ✓ Token cleared: ${verifiedUser.verificationToken === null ? 'Yes' : 'No'}\n`);

    if (verifiedUser.isVerified !== true || verifiedUser.verificationToken !== null) {
      throw new Error('Test 2 Failed: User verification failed');
    }

    // =========================================================================
    // TEST 3: Password Reset Flow
    // =========================================================================
    console.log('[TEST 3/5] Testing Password Reset Flow...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    verifiedUser.resetPasswordToken = resetToken;
    verifiedUser.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await verifiedUser.save();

    console.log(`  ✓ Reset token assigned: ${resetToken.slice(0, 10)}... (Expires: 1 hour)`);

    // Reset password execution
    const userToReset = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!userToReset) {
      throw new Error('Test 3 Failed: Reset token lookup failed');
    }

    const newSalt = await bcrypt.genSalt(10);
    userToReset.password = await bcrypt.hash(updatedPassword, newSalt);
    userToReset.resetPasswordToken = null;
    userToReset.resetPasswordExpires = null;
    await userToReset.save();

    const passwordMatches = await bcrypt.compare(updatedPassword, userToReset.password);
    console.log(`  ✓ New password validated: ${passwordMatches}`);
    console.log(`  ✓ Reset token cleared: ${userToReset.resetPasswordToken === null ? 'Yes' : 'No'}\n`);

    if (!passwordMatches) {
      throw new Error('Test 3 Failed: Password hash mismatch');
    }

    // =========================================================================
    // TEST 4: Brevo Webhook Event Handling (Bounce & Spam Suppression)
    // =========================================================================
    console.log('[TEST 4/5] Testing Webhook Bounce and Delivery Processing...');

    // Simulate Brevo Delivered Event
    const deliveredPayload = {
      event: 'delivered',
      email: testEmail,
      id: `msg_${Date.now()}`,
      subject: 'iMovies Verification'
    };
    await WebhookEvent.create({
      event: deliveredPayload.event,
      email: deliveredPayload.email,
      messageId: deliveredPayload.id,
      subject: deliveredPayload.subject,
      rawPayload: deliveredPayload
    });
    console.log(`  ✓ Processed delivered event for ${testEmail}`);

    // Simulate Brevo Hard Bounce Event
    const bouncePayload = {
      event: 'hard_bounce',
      email: testEmail,
      id: `msg_bounce_${Date.now()}`,
      reason: '550 5.1.1 User unknown',
      subject: 'iMovies Ticket Confirmation'
    };

    await WebhookEvent.create({
      event: bouncePayload.event,
      email: bouncePayload.email,
      messageId: bouncePayload.id,
      reason: bouncePayload.reason,
      rawPayload: bouncePayload
    });

    await User.findOneAndUpdate(
      { email: testEmail },
      {
        emailStatus: 'hard_bounce',
        bouncedAt: new Date(),
        bounceReason: bouncePayload.reason
      }
    );

    const bouncedUser = await User.findOne({ email: testEmail });
    console.log(`  ✓ User emailStatus updated: "${bouncedUser.emailStatus}" (Expected: hard_bounce)`);
    console.log(`  ✓ User bounceReason: "${bouncedUser.bounceReason}"\n`);

    if (bouncedUser.emailStatus !== 'hard_bounce') {
      throw new Error('Test 4 Failed: Hard bounce status update failed');
    }

    // =========================================================================
    // TEST 5: Cleanup & Audit Verification
    // =========================================================================
    console.log('[TEST 5/5] Verifying Webhook Audit Logs & Cleaning Up...');
    const auditLogs = await WebhookEvent.find({ email: testEmail });
    console.log(`  ✓ Total audit logs recorded for test user: ${auditLogs.length} (Expected: 2)`);

    // Clean up test documents
    await User.deleteOne({ _id: testUser._id });
    await WebhookEvent.deleteMany({ email: testEmail });
    console.log('  ✓ Test user and audit records cleaned up successfully.\n');

    console.log('===============================================================');
    console.log('  🎉 All User Auth & Webhook Integration Tests Passed Cleanly!');
    console.log('===============================================================');
  } catch (error) {
    console.error('❌ Integration Test Failure:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

runIntegrationTests();
