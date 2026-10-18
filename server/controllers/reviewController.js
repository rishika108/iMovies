const Review = require('../models/reviewModel');

/**
 * Add a review for a movie
 * POST /
 */
const addReview = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const username = req.user?.username || req.body.username || 'Anonymous';
    const { movieId, rating, reviewText } = req.body;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    if (!movieId || rating === undefined || !reviewText) {
      return res.status(400).json({
        success: false,
        error: 'Please provide movieId, rating (1-5), and reviewText'
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be a number between 1 and 5'
      });
    }

    if (reviewText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Review text must be at least 10 characters long'
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const cleanMovieId = movieId.trim();

    // Check if user already reviewed this movie
    const existingReview = await Review.findOne({
      userEmail: normalizedEmail,
      movieId: cleanMovieId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this movie. You can update your existing review.'
      });
    }

    const newReview = new Review({
      userEmail: normalizedEmail,
      username: username.trim(),
      movieId: cleanMovieId,
      rating: numRating,
      reviewText: reviewText.trim()
    });

    const savedReview = await newReview.save();

    return res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review: savedReview
    });
  } catch (error) {
    console.error('Error in addReview:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add review'
    });
  }
};

/**
 * Update an existing review by review _id
 * PUT /:id
 */
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    const updateData = {};
    if (req.body.rating !== undefined) {
      const numRating = Number(req.body.rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be a number between 1 and 5'
        });
      }
      updateData.rating = numRating;
    }

    if (req.body.reviewText !== undefined) {
      if (req.body.reviewText.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Review text must be at least 10 characters long'
        });
      }
      updateData.reviewText = req.body.reviewText.trim();
    }

    const updatedReview = await Review.findOneAndUpdate(
      { _id: id, userEmail: userEmail.trim().toLowerCase() },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or unauthorized to update'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('Error in updateReview:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update review'
    });
  }
};

/**
 * Get all reviews for a movie sorted descending by creation time
 * GET /movie/:movieId
 */
const getMovieReviews = async (req, res) => {
  try {
    const { movieId } = req.params;

    const reviews = await Review.find({ movieId: (movieId || '').trim() }).sort({ createdAt: -1 });

    const totalRatings = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = reviews.length > 0 ? (totalRatings / reviews.length).toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      count: reviews.length,
      averageRating: Number(averageRating),
      reviews
    });
  } catch (error) {
    console.error('Error in getMovieReviews:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch movie reviews'
    });
  }
};

/**
 * Delete review by review _id
 * DELETE /:id
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not authenticated'
      });
    }

    const deletedReview = await Review.findOneAndDelete({
      _id: id,
      userEmail: userEmail.trim().toLowerCase()
    });

    if (!deletedReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or unauthorized to delete'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      review: deletedReview
    });
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete review'
    });
  }
};

module.exports = {
  addReview,
  updateReview,
  getMovieReviews,
  deleteReview
};
