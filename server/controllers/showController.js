const { v4: uuidv4 } = require('uuid');
const Show = require('../models/showModel');
const Theatre = require('../models/theatreModel');

/**
 * Helper to compute alphabet row labels: 0 -> 'A', 25 -> 'Z', 26 -> 'AA', etc.
 */
const getRowLabel = (index) => {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode((i % 26) + 65) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
};

/**
 * Get all shows
 */
const getAllShows = async (req, res) => {
  try {
    const shows = await Show.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: shows.length,
      shows
    });
  } catch (error) {
    console.error('Error in getAllShows:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch shows'
    });
  }
};

/**
 * Get single show by showId
 */
const getShowById = async (req, res) => {
  try {
    const { showId } = req.params;
    const show = await Show.findOne({ showId });

    if (!show) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    return res.status(200).json({
      success: true,
      show
    });
  } catch (error) {
    console.error('Error in getShowById:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch show'
    });
  }
};

/**
 * Get shows for a specific movie by movieId
 */
const getShowsByMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    let shows = await Show.find({ movieId }).sort({ showDate: 1, showTime: 1 });

    if (shows.length === 0) {
      // Auto-provision shows for this movie across existing theatres for the next 7 days
      // so users can immediately test booking on any movie (local or TMDB)!
      const theatres = await Theatre.find({});
      if (theatres.length > 0) {
        const today = new Date();
        const createdShows = [];
        const times = ['11:30 AM', '02:45 PM', '06:15 PM', '09:30 PM'];

        for (const theatre of theatres) {
          const tickets = {};
          let globalRowIndex = 0;
          const tiers = [
            { name: 'balcony', rows: theatre.balconySeats?.rows || 3, cols: theatre.balconySeats?.cols || 10, price: theatre.balconySeatPrice || 300 },
            { name: 'middle', rows: theatre.middleSeats?.rows || 5, cols: theatre.middleSeats?.cols || 12, price: theatre.middleSeatPrice || 200 },
            { name: 'lower', rows: theatre.lowerSeats?.rows || 7, cols: theatre.lowerSeats?.cols || 14, price: theatre.lowerSeatPrice || 150 }
          ];

          for (const tier of tiers) {
            for (let r = 0; r < tier.rows; r++) {
              const rowLabel = getRowLabel(globalRowIndex);
              for (let c = 1; c <= tier.cols; c++) {
                const seatId = `${rowLabel}${c}`;
                tickets[seatId] = {
                  seatId,
                  row: rowLabel,
                  col: c,
                  tier: tier.name,
                  status: 'available',
                  price: tier.price
                };
              }
              globalRowIndex++;
            }
          }

          for (let d = 0; d < 7; d++) {
            const dateObj = new Date(today);
            dateObj.setDate(today.getDate() + d);
            const dateStr = dateObj.toISOString().split('T')[0];

            const showTimesForTheatre = theatre.theatreId.includes('imax')
              ? [times[0], times[2]]
              : [times[1], times[3]];

            for (const timeStr of showTimesForTheatre) {
              const newShow = new Show({
                adminEmail: theatre.adminEmail || 'admin@imovies.com',
                showId: uuidv4(),
                movieId,
                theatreId: theatre.theatreId,
                theatreName: theatre.theatreName,
                showDate: dateStr,
                showTime: timeStr,
                tickets: JSON.parse(JSON.stringify(tickets))
              });
              await newShow.save();
              createdShows.push(newShow);
            }
          }
        }
        shows = createdShows;
      }
    }

    return res.status(200).json({
      success: true,
      count: shows.length,
      shows
    });
  } catch (error) {
    console.error('Error in getShowsByMovie:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch shows for movie'
    });
  }
};

/**
 * Add a new show
 * Finds theatre by theatreId from req.body
 * Initializes ticket grid for balcony, middle, and lower tiers
 * Generates unique showId with uuid
 * Saves and returns the created show
 */
const addShow = async (req, res) => {
  try {
    const { theatreId, movieId, showDate, showTime, theatreName } = req.body;

    if (!theatreId || !movieId || !showDate || !showTime) {
      return res.status(400).json({
        success: false,
        error: 'Please provide theatreId, movieId, showDate, and showTime'
      });
    }

    // Find the associated theatre
    const theatre = await Theatre.findOne({ theatreId });
    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: `Theatre not found with theatreId: ${theatreId}`
      });
    }

    // Initialize tickets object
    const tickets = {};
    let globalRowIndex = 0;

    const tiers = [
      {
        name: 'balcony',
        rows: theatre.balconySeats?.rows || 3,
        cols: theatre.balconySeats?.cols || 10,
        price: theatre.balconySeatPrice !== undefined ? theatre.balconySeatPrice : 300
      },
      {
        name: 'middle',
        rows: theatre.middleSeats?.rows || 5,
        cols: theatre.middleSeats?.cols || 12,
        price: theatre.middleSeatPrice !== undefined ? theatre.middleSeatPrice : 200
      },
      {
        name: 'lower',
        rows: theatre.lowerSeats?.rows || 7,
        cols: theatre.lowerSeats?.cols || 14,
        price: theatre.lowerSeatPrice !== undefined ? theatre.lowerSeatPrice : 150
      }
    ];

    for (const tier of tiers) {
      for (let r = 0; r < tier.rows; r++) {
        const rowLabel = getRowLabel(globalRowIndex);
        for (let c = 1; c <= tier.cols; c++) {
          const seatId = `${rowLabel}${c}`;
          tickets[seatId] = {
            seatId,
            row: rowLabel,
            col: c,
            tier: tier.name,
            status: 'available',
            price: tier.price
          };
        }
        globalRowIndex++;
      }
    }

    const uniqueShowId = uuidv4();
    const adminEmail = req.admin?.email || theatre.adminEmail || req.body.adminEmail;

    const newShow = new Show({
      adminEmail: adminEmail ? adminEmail.trim().toLowerCase() : theatre.adminEmail,
      showId: uniqueShowId,
      movieId: movieId.trim(),
      theatreId: theatre.theatreId,
      theatreName: (theatreName || theatre.theatreName).trim(),
      showDate: showDate.trim(),
      showTime: showTime.trim(),
      tickets
    });

    const savedShow = await newShow.save();

    return res.status(201).json({
      success: true,
      message: 'Show created successfully',
      show: savedShow
    });
  } catch (error) {
    console.error('Error in addShow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create show'
    });
  }
};

/**
 * Update show details by showId
 * Requires admin authentication
 */
const updateShow = async (req, res) => {
  try {
    const { showId } = req.params;

    const updatedShow = await Show.findOneAndUpdate(
      { showId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedShow) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Show updated successfully',
      show: updatedShow
    });
  } catch (error) {
    console.error('Error in updateShow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update show'
    });
  }
};

/**
 * Delete show by showId
 * Requires admin authentication
 */
const deleteShow = async (req, res) => {
  try {
    const { showId } = req.params;

    const deletedShow = await Show.findOneAndDelete({ showId });

    if (!deletedShow) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Show deleted successfully',
      show: deletedShow
    });
  } catch (error) {
    console.error('Error in deleteShow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete show'
    });
  }
};

module.exports = {
  getAllShows,
  getShowById,
  getShowsByMovie,
  addShow,
  updateShow,
  deleteShow
};
