const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  adminEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  showId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  movieId: {
    type: String,
    required: true,
    trim: true
  },
  theatreId: {
    type: String,
    required: true,
    trim: true
  },
  theatreName: {
    type: String,
    required: true,
    trim: true
  },
  showDate: {
    type: String,
    required: true,
    trim: true
  },
  showTime: {
    type: String,
    required: true,
    trim: true
  },
  tickets: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Show', showSchema);
