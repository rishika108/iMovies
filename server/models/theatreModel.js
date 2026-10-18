const mongoose = require('mongoose');

const theatreSchema = new mongoose.Schema({
  theatreName: {
    type: String,
    required: true,
    trim: true
  },
  theatreId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  adminEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  balconySeatPrice: {
    type: Number,
    required: true,
    default: 300
  },
  middleSeatPrice: {
    type: Number,
    required: true,
    default: 200
  },
  lowerSeatPrice: {
    type: Number,
    required: true,
    default: 150
  },
  balconySeats: {
    rows: {
      type: Number,
      default: 3
    },
    cols: {
      type: Number,
      default: 10
    }
  },
  middleSeats: {
    rows: {
      type: Number,
      default: 5
    },
    cols: {
      type: Number,
      default: 12
    }
  },
  lowerSeats: {
    rows: {
      type: Number,
      default: 7
    },
    cols: {
      type: Number,
      default: 14
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Theatre', theatreSchema);
