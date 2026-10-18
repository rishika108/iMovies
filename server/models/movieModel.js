const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  movieName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10
  },
  genres: {
    type: [String],
    required: true,
    validate: {
      validator: function (value) {
        return Array.isArray(value) && value.length >= 1;
      },
      message: 'At least one genre required'
    }
  },
  releaseDate: {
    type: Date,
    required: true
  },
  language: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  certification: {
    type: String,
    default: 'U',
    trim: true
  },
  posterUrl: {
    type: String,
    default: '',
    trim: true
  },
  trailerUrl: {
    type: String,
    default: '',
    trim: true
  },
  cast: {
    type: [String],
    default: []
  },
  director: {
    type: String,
    default: '',
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);
