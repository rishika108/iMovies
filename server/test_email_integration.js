/**
 * test_email_integration.js
 * Automated Test Suite for Twilio SendGrid Email Ticket Confirmation in iMovies
 *
 * Verifies all 10 requirements:
 * 1. Successful verified payment sends one confirmation email.
 * 2. Failed payment sends no paid-ticket confirmation.
 * 3. Invalid payment signature sends no confirmation.
 * 4. A booking belonging to another user cannot be accessed or cancelled (BOLA/IDOR).
 * 5. Repeated confirmation requests do not send duplicate emails (Idempotency).
 * 6. SendGrid API errors do not invalidate a successful payment.
 * 7. Missing environment variables are handled safely.
 * 8. Email content uses the correct movie, showtime, seats, booking ID, and amount.
 * 9. The email link points to the deployed website.
 * 10. Existing booking, payment, authentication, and seat availability features continue to work.
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const Booking = require('./models/bookingModel');
const Show = require('./models/showModel');
const Movie = require('./models/movieModel');
const Theatre = require('./models/theatreModel');
const User = require('./models/userModel');

const {
  sgMail,
  sendBookingConfirmationEmail,
  escapeHtml,
  isValidHttpUrl,
  generateTicketHtml,
  generateTicketPlainText
} = require('./services/emailService');

const { verifyPayment } = require('./controllers/paymentController');
const { confirmPayment, cancelBooking } = require('./controllers/bookingController');

// Test tracking variables
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

// Helper to create mock response object
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   iMovies: SendGrid Automatic Email Confirmation Test Suite   ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/imovies';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const testRunId = Date.now().toString().slice(-6);
  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_12345';
  process.env.RAZORPAY_KEY_SECRET = secret;
  process.env.SENDGRID_API_KEY = 'SG.mock_test_key_placeholder';
  process.env.EMAIL_FROM = 'tickets@imovies.com';
  process.env.CLIENT_URL = 'https://i-movies-theta.vercel.app';

  // Seed sample movie & theatre & show
  const testMovie = await Movie.create({
    movieName: `Oppenheimer IMAX ${testRunId}`,
    description: 'The story of American scientist J. Robert Oppenheimer.',
    genres: ['Drama', 'History'],
    releaseDate: new Date('2023-07-21'),
    language: 'English',
    duration: '3h 0m',
    certification: 'A',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'
  });

  const testTheatre = await Theatre.create({
    theatreName: `PVR Director's Cut ${testRunId}`,
    theatreId: `theatre_${testRunId}`,
    location: 'Vasant Kunj, New Delhi',
    adminEmail: 'admin@imovies.com',
    balconySeatPrice: 350,
    middleSeatPrice: 250,
    lowerSeatPrice: 180
  });

  const showId = `show_${testRunId}`;
  const testShow = await Show.create({
    adminEmail: 'admin@imovies.com',
    showId,
    movieId: testMovie._id.toString(),
    theatreId: testTheatre.theatreId,
    theatreName: testTheatre.theatreName,
    showDate: '2026-10-25',
    showTime: '19:30',
    tickets: {
      A1: { seatId: 'A1', tier: 'balcony', status: 'locked', price: 350 },
      A2: { seatId: 'A2', tier: 'balcony', status: 'locked', price: 350 },
      B1: { seatId: 'B1', tier: 'middle', status: 'locked', price: 250 },
      B2: { seatId: 'B2', tier: 'middle', status: 'available', price: 250 }
    }
  });

  const userA = { email: `alice_${testRunId}@example.com`, username: `Alice_${testRunId}` };
  const userB = { email: `bob_${testRunId}@example.com`, username: `Bob_${testRunId}` };

  await User.create({
    username: userA.username,
    email: userA.email,
    password: 'password123',
    role: 'user'
  });

  // Track SendGrid mock dispatches
  let sentMails = [];
  sgMail.send = async (msg) => {
    sentMails.push(msg);
    return [{ statusCode: 202, headers: { 'x-message-id': `sg_msg_${Date.now()}_${sentMails.length}` } }, {}];
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Successful verified payment sends exactly one confirmation email
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Successful verified payment sends one confirmation email ---');
  sentMails = [];
  const booking1Id = `book_test_1_${testRunId}`;
  const orderId1 = `order_test_1_${testRunId}`;
  const paymentId1 = `pay_test_1_${testRunId}`;
  const validSig1 = crypto.createHmac('sha256', secret).update(`${orderId1}|${paymentId1}`).digest('hex');

  await Booking.create({
    bookingId: booking1Id,
    userEmail: userA.email,
    customerName: userA.username,
    showId: testShow.showId,
    movieId: testMovie._id.toString(),
    movieName: testMovie.movieName,
    theatreName: testTheatre.theatreName,
    showDate: testShow.showDate,
    showTime: testShow.showTime,
    selectedSeats: ['A1', 'A2'],
    totalAmount: 700,
    paymentStatus: 'Pending',
    razorpayOrderId: orderId1,
    ticketsData: {
      A1: { seatId: 'A1', tier: 'balcony', price: 350 },
      A2: { seatId: 'A2', tier: 'balcony', price: 350 }
    }
  });

  const req1 = {
    body: {
      bookingId: booking1Id,
      razorpay_order_id: orderId1,
      razorpay_payment_id: paymentId1,
      razorpay_signature: validSig1
    },
    user: { email: userA.email, role: 'user' },
    app: { get: () => null }
  };
  const res1 = createMockRes();

  await verifyPayment(req1, res1);

  assert(res1.statusCode === 200, `verifyPayment returned status 200 (got ${res1.statusCode})`);
  assert(res1.data?.success === true, 'verifyPayment returned success: true');
  assert(res1.data?.emailNotification?.status === 'sent', `emailNotification status is 'sent' (got '${res1.data?.emailNotification?.status}')`);

  const updatedB1 = await Booking.findOne({ bookingId: booking1Id });
  assert(updatedB1.paymentStatus === 'Completed', `Booking paymentStatus updated to 'Completed' (got '${updatedB1.paymentStatus}')`);
  assert(updatedB1.confirmationEmailSent === true, 'Booking confirmationEmailSent is true');
  assert(updatedB1.confirmationEmailStatus === 'sent', `Booking confirmationEmailStatus is 'sent' (got '${updatedB1.confirmationEmailStatus}')`);
  assert(sentMails.length === 1, `Exactly 1 SendGrid email was dispatched (got ${sentMails.length})`);
  assert(sentMails[0].to === userA.email, `Email sent to correct recipient: ${sentMails[0].to}`);
  assert(sentMails[0].subject === 'Your iMovies Ticket Booking is Confirmed!', `Email subject matches standard: '${sentMails[0].subject}'`);

  const updatedShow1 = await Show.findOne({ showId: testShow.showId });
  assert(updatedShow1.tickets.A1.status === 'booked', "Show seat A1 transitioned to 'booked'");
  assert(updatedShow1.tickets.A2.status === 'booked', "Show seat A2 transitioned to 'booked'");

  // ---------------------------------------------------------------------------
  // TEST 2: Failed payment sends no paid-ticket confirmation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Failed payment sends no paid-ticket confirmation ---');
  sentMails = [];
  const booking2Id = `book_test_2_${testRunId}`;
  await Booking.create({
    bookingId: booking2Id,
    userEmail: userA.email,
    showId: testShow.showId,
    selectedSeats: ['B1'],
    totalAmount: 250,
    paymentStatus: 'Failed',
    ticketsData: { B1: { seatId: 'B1', price: 250 } }
  });

  const res2 = await sendBookingConfirmationEmail(booking2Id);
  assert(res2.success === false, 'sendBookingConfirmationEmail returned success: false for Failed booking');
  assert(res2.skipped === true, 'sendBookingConfirmationEmail marked dispatch as skipped');
  assert(sentMails.length === 0, `Zero emails dispatched for Failed payment (got ${sentMails.length})`);

  const checkB2 = await Booking.findOne({ bookingId: booking2Id });
  assert(checkB2.confirmationEmailSent === false, 'Failed booking confirmationEmailSent remains false');

  // ---------------------------------------------------------------------------
  // TEST 3: Invalid payment signature sends no confirmation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Invalid payment signature sends no confirmation ---');
  sentMails = [];
  const booking3Id = `book_test_3_${testRunId}`;
  const orderId3 = `order_test_3_${testRunId}`;
  const paymentId3 = `pay_test_3_${testRunId}`;
  const forgedSig3 = 'forged_fake_signature_hex_1234567890abcdef';

  await Booking.create({
    bookingId: booking3Id,
    userEmail: userA.email,
    showId: testShow.showId,
    selectedSeats: ['B1'],
    totalAmount: 250,
    paymentStatus: 'Pending',
    razorpayOrderId: orderId3,
    ticketsData: { B1: { seatId: 'B1', price: 250 } }
  });

  const req3 = {
    body: {
      bookingId: booking3Id,
      razorpay_order_id: orderId3,
      razorpay_payment_id: paymentId3,
      razorpay_signature: forgedSig3
    },
    user: { email: userA.email, role: 'user' },
    app: { get: () => null }
  };
  const res3 = createMockRes();

  await verifyPayment(req3, res3);

  assert(res3.statusCode === 400, `Rejected forged signature with status 400 (got ${res3.statusCode})`);
  assert(sentMails.length === 0, `Zero emails sent for forged signature (got ${sentMails.length})`);

  const checkB3 = await Booking.findOne({ bookingId: booking3Id });
  assert(checkB3.paymentStatus === 'Failed', `Booking marked as 'Failed' (got '${checkB3.paymentStatus}')`);
  assert(checkB3.confirmationEmailSent === false, 'confirmationEmailSent remains false');

  // ---------------------------------------------------------------------------
  // TEST 4: BOLA/IDOR - Booking of another user cannot be accessed or cancelled
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: BOLA/IDOR - Booking of another user cannot be confirmed/cancelled ---');
  const req4 = {
    params: { bookingId: booking1Id },
    user: { email: userB.email, role: 'user' }, // Bob trying to cancel Alice's booking
    app: { get: () => null }
  };
  const res4 = createMockRes();

  await cancelBooking(req4, res4);
  assert(res4.statusCode === 403, `BOLA cancellation rejected with status 403 Forbidden (got ${res4.statusCode})`);

  const req4Verify = {
    body: {
      bookingId: booking1Id,
      razorpay_order_id: orderId1,
      razorpay_payment_id: paymentId1,
      razorpay_signature: validSig1
    },
    user: { email: userB.email, role: 'user' }, // Bob trying to tamper Alice's booking
    app: { get: () => null }
  };
  const res4Verify = createMockRes();
  await verifyPayment(req4Verify, res4Verify);
  assert(res4Verify.statusCode === 403, `BOLA verify rejected with status 403 Forbidden (got ${res4Verify.statusCode})`);

  // ---------------------------------------------------------------------------
  // TEST 5: Repeated webhook or confirmation requests do not send duplicate emails (Idempotency)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Repeated confirmation requests do not send duplicate emails ---');
  sentMails = []; // Reset mail counter
  const req5 = {
    body: {
      bookingId: booking1Id,
      razorpay_order_id: orderId1,
      razorpay_payment_id: paymentId1,
      razorpay_signature: validSig1
    },
    user: { email: userA.email, role: 'user' },
    app: { get: () => null }
  };
  const res5 = createMockRes();

  await verifyPayment(req5, res5);

  assert(res5.statusCode === 200, `Second confirmation request returned 200 OK (got ${res5.statusCode})`);
  assert(sentMails.length === 0, `Zero duplicate emails sent on retry (sentMails length: ${sentMails.length})`);

  // Also call sendBookingConfirmationEmail directly to test idempotency
  const directRes = await sendBookingConfirmationEmail(booking1Id);
  assert(directRes.alreadySent === true, 'Direct call recognized alreadySent === true');
  assert(sentMails.length === 0, 'Direct call did not send duplicate email');

  // ---------------------------------------------------------------------------
  // TEST 6: SendGrid API errors do not invalidate a successful payment
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: SendGrid API errors do not invalidate a successful payment ---');
  const booking6Id = `book_test_6_${testRunId}`;
  const orderId6 = `order_test_6_${testRunId}`;
  const paymentId6 = `pay_test_6_${testRunId}`;
  const validSig6 = crypto.createHmac('sha256', secret).update(`${orderId6}|${paymentId6}`).digest('hex');

  await Booking.create({
    bookingId: booking6Id,
    userEmail: userA.email,
    showId: testShow.showId,
    selectedSeats: ['A1'],
    totalAmount: 350,
    paymentStatus: 'Pending',
    razorpayOrderId: orderId6,
    ticketsData: { A1: { seatId: 'A1', price: 350 } }
  });

  // Mock SendGrid to simulate an upstream network/API error
  sgMail.send = async () => {
    const error = new Error('SendGrid 401 Unauthorized: Invalid API Key');
    error.response = { body: { errors: [{ message: 'The provided authorization grant is invalid, expired, or revoked' }] } };
    throw error;
  };

  const req6 = {
    body: {
      bookingId: booking6Id,
      razorpay_order_id: orderId6,
      razorpay_payment_id: paymentId6,
      razorpay_signature: validSig6
    },
    user: { email: userA.email, role: 'user' },
    app: { get: () => null }
  };
  const res6 = createMockRes();

  await verifyPayment(req6, res6);

  assert(res6.statusCode === 200, `Payment verification succeeded with 200 OK despite SendGrid failure (got ${res6.statusCode})`);
  const checkB6 = await Booking.findOne({ bookingId: booking6Id });
  assert(checkB6.paymentStatus === 'Completed', `Payment remains 'Completed' in database (got '${checkB6.paymentStatus}')`);
  assert(checkB6.confirmationEmailSent === false, 'confirmationEmailSent is false');
  assert(checkB6.confirmationEmailStatus === 'failed', `confirmationEmailStatus is 'failed' (got '${checkB6.confirmationEmailStatus}')`);
  assert(checkB6.confirmationEmailError.includes('authorization grant is invalid') || checkB6.confirmationEmailError.includes('SendGrid'), 'Error summary recorded safely in database');

  // Restore working sgMail mock
  sgMail.send = async (msg) => {
    sentMails.push(msg);
    return [{ statusCode: 202, headers: { 'x-message-id': `sg_restored_${Date.now()}` } }, {}];
  };

  // ---------------------------------------------------------------------------
  // TEST 7: Missing environment variables are handled safely
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Missing environment variables are handled safely ---');
  const originalKey = process.env.SENDGRID_API_KEY;
  process.env.SENDGRID_API_KEY = '';

  const booking7Id = `book_test_7_${testRunId}`;
  await Booking.create({
    bookingId: booking7Id,
    userEmail: userA.email,
    showId: testShow.showId,
    selectedSeats: ['A1'],
    totalAmount: 350,
    paymentStatus: 'Completed',
    ticketsData: { A1: { seatId: 'A1', price: 350 } }
  });

  const res7 = await sendBookingConfirmationEmail(booking7Id);
  assert(res7.success === false, 'Handled missing SENDGRID_API_KEY gracefully with success: false');
  assert(res7.status === 'failed', "Returned status 'failed'");
  assert(res7.error.includes('SENDGRID_API_KEY'), `Safe error message returned without crashing: '${res7.error}'`);

  process.env.SENDGRID_API_KEY = originalKey; // Restore

  // ---------------------------------------------------------------------------
  // TEST 8: Email content uses correct movie, showtime, seats, booking ID, amount & sanitization
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Email content accuracy and HTML escaping ---');
  const sampleContext = {
    customerName: '<script>alert("hack")</script>Alice',
    bookingId: 'BK-TEST-999',
    movieTitle: 'Interstellar & Dune <Special Edition>',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
    theatreName: 'IMAX Cinema',
    theatreLocation: 'Connaught Place, New Delhi',
    screen: 'Audi 1',
    showDate: '2026-11-01',
    showTime: '20:15',
    selectedSeats: ['C1', 'C2', 'C3'],
    ticketCount: 3,
    itemizedSeats: [
      { seatId: 'C1', tier: 'Balcony', price: 300 },
      { seatId: 'C2', tier: 'Balcony', price: 300 },
      { seatId: 'C3', tier: 'Balcony', price: 300 }
    ],
    subtotal: 900,
    bookingFee: 60,
    totalAmount: 960,
    paymentId: 'pay_rzp_mock_123456',
    paymentStatus: 'Confirmed',
    bookingDetailsUrl: 'https://i-movies-theta.vercel.app/bookings'
  };

  const generatedHtml = generateTicketHtml(sampleContext);
  const generatedText = generateTicketPlainText(sampleContext);

  assert(!generatedHtml.includes('<script>'), 'HTML injection / XSS tags strictly escaped in HTML');
  assert(generatedHtml.includes('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;Alice'), 'Customer name properly entity-encoded in HTML');
  assert(generatedHtml.includes('BK-TEST-999'), 'Booking ID present in HTML');
  assert(generatedHtml.includes('Interstellar &amp; Dune &lt;Special Edition&gt;'), 'Movie title properly entity-encoded in HTML');
  assert(generatedHtml.includes('C1, C2, C3'), 'All seat numbers present in HTML');
  assert(generatedHtml.includes('2026-11-01'), 'Show date present in HTML');
  assert(generatedHtml.includes('20:15'), 'Showtime present in HTML');
  assert(generatedHtml.includes('960'), 'Total amount present in HTML');
  assert(generatedHtml.includes('pay_rzp_mock_123456'), 'Payment transaction ID present in HTML');

  assert(generatedText.includes('BK-TEST-999'), 'Booking ID present in plain-text');
  assert(generatedText.includes('Total Paid:     INR 960'), 'Total paid present in plain-text');
  assert(generatedText.includes('Seats (3):   C1, C2, C3'), 'Seats present in plain-text');

  // ---------------------------------------------------------------------------
  // TEST 9: Email link points to the deployed website
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Email link points to deployed website ---');
  assert(generatedHtml.includes('https://i-movies-theta.vercel.app/bookings'), 'HTML email CTA links to deployed Vercel website (/bookings)');
  assert(generatedText.includes('https://i-movies-theta.vercel.app/bookings'), 'Plain-text email links to deployed Vercel website (/bookings)');

  // ---------------------------------------------------------------------------
  // TEST 10: Existing booking, payment, and seat lifecycle features continue to work
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: Existing booking, payment, and seat lifecycle features work ---');
  // Confirm seats on testShow are booked, and test cancellation restores them to 'available'
  const booking10Id = `book_test_10_${testRunId}`;
  await Booking.create({
    bookingId: booking10Id,
    userEmail: userA.email,
    showId: testShow.showId,
    selectedSeats: ['B2'],
    totalAmount: 250,
    paymentStatus: 'Completed',
    ticketsData: { B2: { seatId: 'B2', price: 250 } }
  });

  // Mark seat B2 as booked on show
  testShow.tickets.B2.status = 'booked';
  testShow.tickets.B2.bookedBy = userA.email;
  testShow.markModified('tickets');
  await testShow.save();

  const req10Cancel = {
    params: { bookingId: booking10Id },
    user: { email: userA.email, role: 'user' },
    app: { get: () => null }
  };
  const res10Cancel = createMockRes();

  await cancelBooking(req10Cancel, res10Cancel);
  assert(res10Cancel.statusCode === 200, `Owner cancellation succeeded with 200 OK (got ${res10Cancel.statusCode})`);

  const updatedShow10 = await Show.findOne({ showId: testShow.showId });
  assert(updatedShow10.tickets.B2.status === 'available', "Show seat B2 restored to 'available' upon cancellation");

  // Clean up test documents
  await Booking.deleteMany({ bookingId: { $regex: testRunId } });
  await Show.deleteOne({ showId });
  await Movie.deleteOne({ _id: testMovie._id });
  await Theatre.deleteOne({ theatreId: testTheatre.theatreId });
  await User.deleteOne({ email: userA.email });

  console.log('\n================================================================');
  console.log(`Test Results: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
