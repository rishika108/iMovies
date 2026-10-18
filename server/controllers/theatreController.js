const { v4: uuidv4 } = require('uuid');
const Theatre = require('../models/theatreModel');

/**
 * Get all theatres
 */
const getAllTheatres = async (req, res) => {
  try {
    const theatres = await Theatre.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: theatres.length,
      theatres
    });
  } catch (error) {
    console.error('Error in getAllTheatres:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch theatres'
    });
  }
};

/**
 * Get single theatre by unique theatreId
 */
const getTheatreById = async (req, res) => {
  try {
    const { theatreId } = req.params;
    const theatre = await Theatre.findOne({ theatreId });

    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    return res.status(200).json({
      success: true,
      theatre
    });
  } catch (error) {
    console.error('Error in getTheatreById:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch theatre'
    });
  }
};

/**
 * Add a new theatre
 * Requires admin authentication
 * Generates unique theatreId using uuid
 */
const addTheatre = async (req, res) => {
  try {
    const {
      theatreName,
      location,
      adminEmail,
      balconySeatPrice,
      middleSeatPrice,
      lowerSeatPrice,
      balconySeats,
      middleSeats,
      lowerSeats
    } = req.body;

    // Determine admin email from auth token or body
    const email = req.admin?.email || adminEmail;

    if (!theatreName || !location || !email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide theatreName, location, and valid admin authentication/email'
      });
    }

    const uniqueTheatreId = uuidv4();

    const newTheatre = new Theatre({
      theatreName: theatreName.trim(),
      theatreId: uniqueTheatreId,
      location: location.trim(),
      adminEmail: email.trim().toLowerCase(),
      balconySeatPrice: balconySeatPrice !== undefined ? Number(balconySeatPrice) : 300,
      middleSeatPrice: middleSeatPrice !== undefined ? Number(middleSeatPrice) : 200,
      lowerSeatPrice: lowerSeatPrice !== undefined ? Number(lowerSeatPrice) : 150,
      balconySeats: balconySeats || { rows: 3, cols: 10 },
      middleSeats: middleSeats || { rows: 5, cols: 12 },
      lowerSeats: lowerSeats || { rows: 7, cols: 14 }
    });

    const savedTheatre = await newTheatre.save();

    return res.status(201).json({
      success: true,
      message: 'Theatre added successfully',
      theatre: savedTheatre
    });
  } catch (error) {
    console.error('Error in addTheatre:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add theatre'
    });
  }
};

/**
 * Update theatre by unique theatreId
 * Requires admin authentication
 */
const updateTheatre = async (req, res) => {
  try {
    const { theatreId } = req.params;

    const updatedTheatre = await Theatre.findOneAndUpdate(
      { theatreId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedTheatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Theatre updated successfully',
      theatre: updatedTheatre
    });
  } catch (error) {
    console.error('Error in updateTheatre:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update theatre'
    });
  }
};

/**
 * Delete theatre by unique theatreId
 * Requires admin authentication
 */
const deleteTheatre = async (req, res) => {
  try {
    const { theatreId } = req.params;

    const deletedTheatre = await Theatre.findOneAndDelete({ theatreId });

    if (!deletedTheatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Theatre deleted successfully',
      theatre: deletedTheatre
    });
  } catch (error) {
    console.error('Error in deleteTheatre:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete theatre'
    });
  }
};

/**
 * Get theatres managed by the authenticated admin
 * Requires fetchAdmin middleware
 */
const getTheatresByAdmin = async (req, res) => {
  try {
    const adminEmail = req.admin?.email;

    if (!adminEmail) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Admin email not identified'
      });
    }

    const theatres = await Theatre.find({
      adminEmail: adminEmail.trim().toLowerCase()
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: theatres.length,
      theatres
    });
  } catch (error) {
    console.error('Error in getTheatresByAdmin:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch admin theatres'
    });
  }
};

module.exports = {
  getAllTheatres,
  getTheatreById,
  addTheatre,
  updateTheatre,
  deleteTheatre,
  getTheatresByAdmin
};
