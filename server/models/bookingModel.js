const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  showId: {
    type: String,
    required: true,
    trim: true
  },
  movieId: {
    type: String,
    trim: true
  },
  movieName: {
    type: String,
    trim: true
  },
  theatreName: {
    type: String,
    trim: true
  },
  showDate: {
    type: String,
    trim: true
  },
  showTime: {
    type: String,
    trim: true
  },
  ticketsData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  selectedSeats: {
    type: [String],
    default: []
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    default: 'Razorpay'
  },
  razorpayOrderId: {
    type: String,
    trim: true,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    trim: true,
    default: ''
  },
  razorpaySignature: {
    type: String,
    trim: true,
    default: ''
  },
  refundId: {
    type: String,
    trim: true,
    default: ''
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundStatus: {
    type: String,
    trim: true,
    default: ''
  },
  customerName: {
    type: String,
    trim: true,
    default: ''
  },
  screen: {
    type: String,
    trim: true,
    default: 'Screen 1'
  },
  posterUrl: {
    type: String,
    trim: true,
    default: ''
  },
  confirmationEmailSent: {
    type: Boolean,
    default: false,
    index: true
  },
  confirmationEmailStatus: {
    type: String,
    enum: ['not_sent', 'pending', 'sending', 'sent', 'failed'],
    default: 'not_sent',
    index: true
  },
  confirmationEmailSentAt: {
    type: Date,
    default: null
  },
  confirmationEmailMessageId: {
    type: String,
    trim: true,
    default: ''
  },
  confirmationEmailError: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
