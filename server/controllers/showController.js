const { v4: uuidv4 } = require('uuid');
const Show = require('../models/showModel');
const Theatre = require('../models/theatreModel');
const Movie = require('../models/movieModel');
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
 * Distinct schedules for multi-theatre showtime expansion.
 * Each theatre has 6 unique, non-overlapping showtimes per day (morning, noon, matinee, evening, prime, late night).
 * No two theatres share the same schedule.
 */
const DEFAULT_THEATRES = [
  {
    theatreId: 'theatre_pvr_imax_01',
    theatreName: 'PVR IMAX Phoenix MarketCity',
    location: 'Phoenix MarketCity, Kurla',
    screenName: 'IMAX Laser Audi 1',
    adminEmail: 'admin@imovies.com',
    balconySeatPrice: 350,
    middleSeatPrice: 240,
    lowerSeatPrice: 160,
    showtimes: ['09:15 AM', '11:45 AM', '02:30 PM', '05:15 PM', '08:00 PM', '10:45 PM'],
    facilities: ['IMAX Laser 3D', '12-Ch Immersive Sound', 'Plush Recliners', 'Gourmet Bar'],
    balconySeats: { rows: 3, cols: 10 },
    middleSeats: { rows: 5, cols: 12 },
    lowerSeats: { rows: 7, cols: 14 }
  },
  {
    theatreId: 'theatre_inox_megaplex_02',
    theatreName: 'INOX Megaplex R-City',
    location: 'R-City Mall, Ghatkopar',
    screenName: 'Megaplex Screen 2',
    adminEmail: 'admin@imovies.com',
    balconySeatPrice: 320,
    middleSeatPrice: 220,
    lowerSeatPrice: 150,
    showtimes: ['09:45 AM', '12:15 PM', '03:00 PM', '05:45 PM', '08:30 PM', '11:15 PM'],
    facilities: ['Dolby Atmos', 'Laser 4K Projection', 'Club Seating', 'In-seat Dining'],
    balconySeats: { rows: 3, cols: 10 },
    middleSeats: { rows: 5, cols: 12 },
    lowerSeats: { rows: 7, cols: 14 }
  },
  {
    theatreId: 'theatre_cinepolis_vip_03',
    theatreName: 'Cinepolis VIP Grand Central',
    location: 'Seawoods Grand Central, Navi Mumbai',
    screenName: 'VIP Lounge Audi 4',
    adminEmail: 'admin@imovies.com',
    balconySeatPrice: 400,
    middleSeatPrice: 280,
    lowerSeatPrice: 180,
    showtimes: ['10:00 AM', '12:45 PM', '03:30 PM', '06:15 PM', '09:00 PM', '11:40 PM'],
    facilities: ['Full Leather Recliners', 'Call-a-Waiter Service', 'Dolby 7.1', 'Artisan Coffee'],
    balconySeats: { rows: 3, cols: 10 },
    middleSeats: { rows: 5, cols: 12 },
    lowerSeats: { rows: 7, cols: 14 }
  },
  {
    theatreId: 'theatre_miraj_04',
    theatreName: 'Miraj Cinemas City Mall',
    location: 'City Mall, Andheri West',
    screenName: 'Audi 3 Gold',
    adminEmail: 'admin@imovies.com',
    balconySeatPrice: 300,
    middleSeatPrice: 200,
    lowerSeatPrice: 140,
    showtimes: ['10:30 AM', '01:15 PM', '04:00 PM', '06:45 PM', '09:30 PM', '11:55 PM'],
    facilities: ['RGB Pure Laser', 'Dolby Surround 7.1', 'Comfort Rocker Seats'],
    balconySeats: { rows: 3, cols: 10 },
    middleSeats: { rows: 5, cols: 12 },
    lowerSeats: { rows: 7, cols: 14 }
  }
];

/**
 * Ensure primary theatres exist in the database and their showtimes arrays are upgraded to full 6 slots
 */
const ensureTheatresExist = async () => {
  let theatres = await Theatre.find({});
  if (theatres.length === 0) {
    theatres = await Theatre.insertMany(DEFAULT_THEATRES);
  } else {
    for (const defT of DEFAULT_THEATRES) {
      const existing = theatres.find((t) => t.theatreId === defT.theatreId);
      if (!existing) {
        try {
          const created = await Theatre.create(defT);
          theatres.push(created);
        } catch (e) {
          // ignore duplicate race condition
        }
      } else if (!existing.showtimes || existing.showtimes.length < defT.showtimes.length) {
        // Upgrade existing theater to full 6 showtimes
        existing.showtimes = defT.showtimes;
        existing.facilities = defT.facilities;
        existing.screenName = defT.screenName;
        await Theatre.updateOne(
          { theatreId: defT.theatreId },
          {
            $set: {
              showtimes: defT.showtimes,
              facilities: defT.facilities,
              screenName: defT.screenName
            }
          }
        );
      }
    }
  }
  return theatres;
};

/**
 * Build seat tickets dictionary for a theatre
 */
const buildTicketsForTheatre = (theatre) => {
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

  return tickets;
};

/**
 * Auto-provision 7 days of varied, distinct showtimes (6 shows per day) for a movie across all theatres
 */
const autoProvisionShowsForMovie = async (movieId, movieName = '', forceRefresh = false) => {
  const theatres = await ensureTheatresExist();
  const today = new Date();
  const createdShows = [];

  for (let tIndex = 0; tIndex < theatres.length; tIndex++) {
    const theatre = theatres[tIndex];
    const defaultObj = DEFAULT_THEATRES.find((d) => d.theatreId === theatre.theatreId);
    const targetShowtimes =
      defaultObj?.showtimes ||
      (theatre.showtimes && theatre.showtimes.length >= 5
        ? theatre.showtimes
        : DEFAULT_THEATRES[tIndex % DEFAULT_THEATRES.length].showtimes);

    const ticketsTemplate = buildTicketsForTheatre(theatre);

    for (let d = 0; d < 7; d++) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() + d);
      const dateStr = dateObj.toISOString().split('T')[0];

      for (const timeStr of targetShowtimes) {
        const existing = await Show.findOne({
          movieId,
          theatreId: theatre.theatreId,
          showDate: dateStr,
          showTime: timeStr
        });

        if (!existing) {
          const newShow = new Show({
            adminEmail: theatre.adminEmail || 'admin@imovies.com',
            showId: uuidv4(),
            movieId,
            movieName: movieName || '',
            theatreId: theatre.theatreId,
            theatreName: theatre.theatreName,
            screenName: theatre.screenName || 'Audi 1',
            showDate: dateStr,
            showTime: timeStr,
            tickets: JSON.parse(JSON.stringify(ticketsTemplate))
          });
          await newShow.save();
          createdShows.push(newShow);
        }
      }
    }
  }

  return createdShows;
};

/**
 * Group a list of shows into structured theater schedules
 */
const groupShowsByTheatre = (showsList, theatresList = []) => {
  const theatreMap = {};

  theatresList.forEach((t) => {
    theatreMap[t.theatreId] = {
      theatreId: t.theatreId,
      theatreName: t.theatreName,
      location: t.location || '',
      screenName: t.screenName || 'Audi 1',
      facilities: t.facilities || ['Dolby 7.1', '4K Laser'],
      prices: {
        balcony: t.balconySeatPrice || 300,
        middle: t.middleSeatPrice || 200,
        lower: t.lowerSeatPrice || 150
      },
      shows: []
    };
  });

  showsList.forEach((s) => {
    const tId = s.theatreId || s.theatreName;
    if (!theatreMap[tId]) {
      theatreMap[tId] = {
        theatreId: s.theatreId || tId,
        theatreName: s.theatreName || 'Cinema Screen',
        location: '',
        screenName: s.screenName || 'Audi 1',
        facilities: ['Dolby 7.1', '4K Laser'],
        prices: {
          balcony: 300,
          middle: 200,
          lower: 150
        },
        shows: []
      };
    }

    if (s.tickets) {
      for (const k of Object.keys(s.tickets)) {
        const ticket = s.tickets[k];
        if (ticket && ticket.tier && ticket.price) {
          theatreMap[tId].prices[ticket.tier] = ticket.price;
        }
      }
    }

    theatreMap[tId].shows.push(s);
  });

  return Object.values(theatreMap).filter((t) => t.shows.length > 0);
};

/**
 * Get all shows
 * Supports query params:
 *   GET /api/shows?movieId=...&date=...&theatreId=...
 */
const getAllShows = async (req, res) => {
  try {
    const { movieId, date, theatreId } = req.query;
    const filter = {};

    if (movieId) filter.movieId = movieId.trim();
    if (theatreId) filter.theatreId = theatreId.trim();

    let shows = await Show.find(filter).sort({ showDate: 1, showTime: 1 });

    // If querying by movie, ensure all 6 showtimes per theater are provisioned
    if (movieId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayShows = shows.filter((s) => s.showDate === todayStr);

      if (shows.length === 0 || todayShows.length < 12) {
        await autoProvisionShowsForMovie(movieId.trim());
        shows = await Show.find(filter).sort({ showDate: 1, showTime: 1 });
      }
    }

    // Attach dynamic real-time clock validation status
    let enrichedShows = shows.map((s) => {
      const showObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...showObj,
        isExpired: isShowExpired(showObj.showDate, showObj.showTime)
      };
    });

    if (date) {
      const cleanDate = date.trim();
      enrichedShows = enrichedShows.filter(
        (s) => s.showDate === cleanDate || (s.showDate && s.showDate.includes(cleanDate))
      );
    }

    const theatres = await Theatre.find({});
    const groupedTheatres = groupShowsByTheatre(enrichedShows, theatres);

    return res.status(200).json({
      success: true,
      count: enrichedShows.length,
      shows: enrichedShows,
      theatres: groupedTheatres
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
 * Get shows for a specific movie by movieId
 * Supports query params:
 *   GET /api/shows/movie/:movieId?date=...&theatreId=...
 */
const getShowsByMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    const { date, theatreId } = req.query;

    const filter = { movieId: movieId.trim() };
    if (theatreId) filter.theatreId = theatreId.trim();

    let shows = await Show.find(filter).sort({ showDate: 1, showTime: 1 });

    // Auto-provision 7 days of shows across distinct theatres if count is low (e.g., old legacy 2-show data)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayShows = shows.filter((s) => s.showDate === todayStr);

    if (shows.length === 0 || todayShows.length < 12) {
      await autoProvisionShowsForMovie(movieId.trim());
      shows = await Show.find(filter).sort({ showDate: 1, showTime: 1 });
    }

    let enrichedShows = shows.map((s) => {
      const showObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...showObj,
        isExpired: isShowExpired(showObj.showDate, showObj.showTime)
      };
    });

    if (date) {
      const cleanDate = date.trim();
      enrichedShows = enrichedShows.filter(
        (s) => s.showDate === cleanDate || (s.showDate && s.showDate.includes(cleanDate))
      );
    }

    const theatres = await Theatre.find({});
    const groupedTheatres = groupShowsByTheatre(enrichedShows, theatres);

    return res.status(200).json({
      success: true,
      count: enrichedShows.length,
      shows: enrichedShows,
      theatres: groupedTheatres
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
 * Refresh and provision full 6 showtimes per theater for a movie
 * POST /api/shows/refresh/:movieId
 */
const refreshShowsForMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    if (!movieId) {
      return res.status(400).json({ success: false, error: 'Movie ID is required' });
    }

    await autoProvisionShowsForMovie(movieId.trim(), '', true);

    const shows = await Show.find({ movieId: movieId.trim() }).sort({ showDate: 1, showTime: 1 });
    const enrichedShows = shows.map((s) => {
      const showObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...showObj,
        isExpired: isShowExpired(showObj.showDate, showObj.showTime)
      };
    });

    const theatres = await Theatre.find({});
    const groupedTheatres = groupShowsByTheatre(enrichedShows, theatres);

    return res.status(200).json({
      success: true,
      message: 'Showtimes successfully refreshed and expanded to 6 shows per theater.',
      count: enrichedShows.length,
      shows: enrichedShows,
      theatres: groupedTheatres
    });
  } catch (error) {
    console.error('Error in refreshShowsForMovie:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh showtimes'
    });
  }
};

/**
 * Get single show by showId
 * Ensures seat mapping and availability endpoints are linked to individual show IDs
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

    const showObj = show.toObject ? show.toObject() : { ...show };
    const enriched = {
      ...showObj,
      isExpired: isShowExpired(showObj.showDate, showObj.showTime)
    };

    return res.status(200).json({
      success: true,
      show: enriched
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
 * Add a new show (dynamic showtime creation per theater)
 * Decouples fixed timings and allows any dynamic showtime
 */
const addShow = async (req, res) => {
  try {
    const { theatreId, movieId, showDate, showTime, theatreName, screenName, movieName } = req.body;

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

    // Check for duplicate overlapping show on the exact same theatre, date, and time
    const existing = await Show.findOne({
      theatreId: theatre.theatreId,
      showDate: showDate.trim(),
      showTime: showTime.trim()
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `A show is already scheduled at ${showTime.trim()} on ${showDate.trim()} at ${theatre.theatreName}. Please choose a different timing.`
      });
    }

    const tickets = buildTicketsForTheatre(theatre);
    const uniqueShowId = uuidv4();
    const adminEmail = req.admin?.email || theatre.adminEmail || req.body.adminEmail || 'admin@imovies.com';

    let resolvedMovieName = (movieName || '').trim();
    if (!resolvedMovieName) {
      try {
        const movieDoc = await Movie.findById(movieId);
        if (movieDoc) resolvedMovieName = movieDoc.movieName || movieDoc.name || '';
      } catch (mErr) {
        // non-blocking
      }
    }

    const newShow = new Show({
      adminEmail: adminEmail.trim().toLowerCase(),
      showId: uniqueShowId,
      movieId: movieId.trim(),
      movieName: resolvedMovieName,
      theatreId: theatre.theatreId,
      theatreName: (theatreName || theatre.theatreName).trim(),
      screenName: (screenName || theatre.screenName || 'Audi 1').trim(),
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
  DEFAULT_THEATRES,
  getAllShows,
  getShowById,
  getShowsByMovie,
  refreshShowsForMovie,
  addShow,
  updateShow,
  deleteShow
};
