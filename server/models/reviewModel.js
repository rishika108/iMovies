const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  movieId: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    required: true,
    trim: true,
    minlength: 10
  }
}, { timestamps: true });

reviewSchema.index({ userEmail: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
