const express = require('express');
const router = express.Router();
const {
  lockSeats,
  createBooking,
  confirmPayment,
  cancelBooking,
  getUserBookings,
  getAllBookings
} = require('../controllers/bookingController');
const fetchUser = require('../middlewares/fetchUser');
const fetchAdmin = require('../middlewares/fetchAdmin');

// Seat locking & Booking creation
router.post('/lock', fetchUser, lockSeats);
router.post('/', fetchUser, createBooking);

// Payment confirmation & Cancellation
router.put('/confirm/:bookingId', fetchUser, confirmPayment);
router.put('/cancel/:bookingId', fetchUser, cancelBooking);

// User and Admin queries
router.get('/my', fetchUser, getUserBookings);
router.get('/all', fetchAdmin, getAllBookings);

module.exports = router;
