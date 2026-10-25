const { v4: uuidv4 } = require('uuid');
const Show = require('../models/showModel');
const Theatre = require('../models/theatreModel');
const { isShowExpired } = require('../utils/timeHelper');

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
/**
 * Distinct schedules for multi-theatre showtime expansion
 * Supports 10:30 AM, 1:45 PM, 5:15 PM, 8:30 PM, 11:00 PM and distinct theatre schedules
 */
const THEATRE_SCHEDULE_SETS = [
  ['10:30 AM', '01:45 PM', '05:15 PM', '08:30 PM', '11:00 PM'],
  ['09:45 AM', '01:15 PM', '04:30 PM', '07:45 PM', '10:45 PM'],
  ['11:00 AM', '02:15 PM', '05:45 PM', '09:00 PM', '11:30 PM'],
  ['10:00 AM', '01:30 PM', '05:00 PM', '08:15 PM', '11:15 PM']
];

/**
 * Get shows for a specific movie by movieId
 * Enhanced with:
 * 1. Multi-theater varied showtimes (10:30 AM, 1:45 PM, 5:15 PM, 8:30 PM, 11:00 PM)
 * 2. Real-world dynamic time validation (attaches isExpired flag per show)
 * 3. Optional date query filter (?date=YYYY-MM-DD)
 */
const getShowsByMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    const { date } = req.query;

    let shows = await Show.find({ movieId }).sort({ showDate: 1, showTime: 1 });

    // Check if we need to auto-provision shows (if no shows exist OR all existing shows are expired in the past)
    const upcomingShows = shows.filter((s) => !isShowExpired(s.showDate, s.showTime));

    if (shows.length === 0 || upcomingShows.length === 0) {
      let theatres = await Theatre.find({});

      // If no theatres found in database, seed primary theatres automatically
      if (theatres.length === 0) {
        theatres = await Theatre.insertMany([
          {
            theatreName: 'PVR IMAX Phoenix MarketCity',
            theatreId: 'theatre_pvr_imax_01',
            location: 'Phoenix MarketCity, Kurla',
            adminEmail: 'admin@imovies.com',
            balconySeatPrice: 350,
            middleSeatPrice: 240,
            lowerSeatPrice: 160,
            balconySeats: { rows: 3, cols: 10 },
            middleSeats: { rows: 5, cols: 12 },
            lowerSeats: { rows: 7, cols: 14 }
          },
          {
            theatreName: 'INOX Megaplex R-City',
            theatreId: 'theatre_inox_megaplex_02',
            location: 'R-City Mall, Ghatkopar',
            adminEmail: 'admin@imovies.com',
            balconySeatPrice: 320,
            middleSeatPrice: 220,
            lowerSeatPrice: 150,
            balconySeats: { rows: 3, cols: 10 },
            middleSeats: { rows: 5, cols: 12 },
            lowerSeats: { rows: 7, cols: 14 }
          },
          {
            theatreName: 'Cinepolis VIP Grand Central',
            theatreId: 'theatre_cinepolis_vip_03',
            location: 'Seawoods Grand Central, Navi Mumbai',
            adminEmail: 'admin@imovies.com',
            balconySeatPrice: 400,
            middleSeatPrice: 280,
            lowerSeatPrice: 180,
            balconySeats: { rows: 3, cols: 10 },
            middleSeats: { rows: 5, cols: 12 },
            lowerSeats: { rows: 7, cols: 14 }
          }
        ]);
      }

      const today = new Date();
      const createdShows = [];

      for (let tIndex = 0; tIndex < theatres.length; tIndex++) {
        const theatre = theatres[tIndex];
        const tickets = {};
        let globalRowIndex = 0;
        const tiers = [
          {
            name: 'balcony',
            rows: theatre.balconySeats?.rows || 3,
            cols: theatre.balconySeats?.cols || 10,
            price: theatre.balconySeatPrice || 300
          },
          {
            name: 'middle',
            rows: theatre.middleSeats?.rows || 5,
            cols: theatre.middleSeats?.cols || 12,
            price: theatre.middleSeatPrice || 200
          },
          {
            name: 'lower',
            rows: theatre.lowerSeats?.rows || 7,
            cols: theatre.lowerSeats?.cols || 14,
            price: theatre.lowerSeatPrice || 150
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

        // Multi-theatre showtime sets: distinct per theatre
        const scheduleForTheatre =
          THEATRE_SCHEDULE_SETS[tIndex % THEATRE_SCHEDULE_SETS.length];

        for (let d = 0; d < 7; d++) {
          const dateObj = new Date(today);
          dateObj.setDate(today.getDate() + d);
          const dateStr = dateObj.toISOString().split('T')[0];

          for (const timeStr of scheduleForTheatre) {
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

      shows = await Show.find({ movieId }).sort({ showDate: 1, showTime: 1 });
    }

    // Attach dynamic real-time clock validation status
    let enrichedShows = shows.map((s) => {
      const showObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...showObj,
        isExpired: isShowExpired(showObj.showDate, showObj.showTime)
      };
    });

    // If date query param is passed, filter strictly
    if (date) {
      const cleanDate = date.trim();
      enrichedShows = enrichedShows.filter(
        (s) => s.showDate === cleanDate || (s.showDate && s.showDate.includes(cleanDate))
      );
    }

    return res.status(200).json({
      success: true,
      count: enrichedShows.length,
      shows: enrichedShows
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
