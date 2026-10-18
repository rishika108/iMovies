const mongoose = require('mongoose');
const Favorite = require('../models/favoriteModel');
const Movie = require('../models/movieModel');
const tmdb = require('../services/tmdbService');

/**
 * Add a movie to favorites
 * POST /
 */
const addFavorite = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const { movieId } = req.body;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    if (!movieId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide movieId'
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const cleanMovieId = movieId.trim();

    // Check duplicate
    const existing = await Favorite.findOne({
      userEmail: normalizedEmail,
      movieId: cleanMovieId
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Movie already in favorites',
        favorite: existing
      });
    }

    const newFavorite = new Favorite({
      userEmail: normalizedEmail,
      movieId: cleanMovieId
    });

    const savedFavorite = await newFavorite.save();

    return res.status(201).json({
      success: true,
      message: 'Movie added to favorites',
      favorite: savedFavorite
    });
  } catch (error) {
    console.error('Error in addFavorite:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add favorite'
    });
  }
};

/**
 * Remove a movie from favorites
 * DELETE /:movieId
 */
const removeFavorite = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const { movieId } = req.params;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const cleanMovieId = (movieId || '').trim();

    const deleted = await Favorite.findOneAndDelete({
      userEmail: normalizedEmail,
      movieId: cleanMovieId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Movie removed from favorites',
      favorite: deleted
    });
  } catch (error) {
    console.error('Error in removeFavorite:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove favorite'
    });
  }
};

/**
 * Get all favorites for the authenticated user, populated with movie details
 * GET /
 */
const getUserFavorites = async (req, res) => {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const favorites = await Favorite.find({ userEmail: normalizedEmail }).sort({ createdAt: -1 });

    const movieIds = favorites.map(fav => fav.movieId).filter(Boolean);
    const validMongoIds = movieIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const tmdbIds = movieIds.filter(id => typeof id === 'string' && id.startsWith('tmdb_'));

    // Fetch movies corresponding to favorite movieIds
    const movies = validMongoIds.length > 0 ? await Movie.find({ _id: { $in: validMongoIds } }) : [];

    // Map movies by string ID for fast O(1) lookup
    const movieMap = new Map();
    for (const m of movies) {
      movieMap.set(m._id.toString(), m);
    }

    // Fetch TMDB movies details
    if (tmdbIds.length > 0) {
      await Promise.all(
        tmdbIds.map(async (tId) => {
          try {
            const cleanId = tId.replace('tmdb_', '');
            const m = await tmdb.getMovieDetails(cleanId);
            if (m) movieMap.set(tId, m);
          } catch (e) {
            console.warn('Failed to load TMDB fav movie:', tId);
          }
        })
      );
    }

    // Attach movie details to each favorite
    const combinedFavorites = favorites.map(fav => ({
      _id: fav._id,
      userEmail: fav.userEmail,
      movieId: fav.movieId,
      createdAt: fav.createdAt,
      updatedAt: fav.updatedAt,
      movie: movieMap.get(fav.movieId.toString()) || null
    }));

    return res.status(200).json({
      success: true,
      count: combinedFavorites.length,
      favorites: combinedFavorites,
      movies
    });
  } catch (error) {
    console.error('Error in getUserFavorites:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user favorites'
    });
  }
};

module.exports = {
  addFavorite,
  removeFavorite,
  getUserFavorites
};
