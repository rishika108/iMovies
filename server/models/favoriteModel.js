const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  movieId: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

favoriteSchema.index({ userEmail: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
