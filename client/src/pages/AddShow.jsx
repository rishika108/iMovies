import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarPlus,
  faFilm,
  faBuilding,
  faCalendarDays,
  faClock,
  faTrash,
  faTicket,
  faRotateLeft,
  faPlus
} from '@fortawesome/free-solid-svg-icons';

export default function AddShow() {
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [shows, setShows] = useState([]);

  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedTheatreId, setSelectedTheatreId] = useState('');
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingShows, setFetchingShows] = useState(true);

  const adminEmail = localStorage.getItem('imovies-admin') || 'admin@imovies.com';

  useEffect(() => {
    fetchPrerequisites();
    fetchShows();
  }, []);

  const fetchPrerequisites = async () => {
    // 1. Fetch movies
    try {
      const res = await API.get('/movies');
      const data = res.data?.movies || res.data?.data || res.data || [];
      setMovies(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedMovieId(data[0]._id || data[0].id || '');
      }
    } catch (err) {
      console.error('Failed to fetch movies:', err);
      toast.error('Failed to load movies list');
    }

    // 2. Fetch theatres
    try {
      let res;
      try {
        res = await API.get('/theatres/admin');
      } catch (err) {
        res = await API.get('/theatres');
      }
      const data = res.data?.theatres || res.data?.data || res.data || [];
      setTheatres(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedTheatreId(data[0].theatreId || data[0]._id || '');
      }
    } catch (err) {
      console.error('Failed to fetch theatres:', err);
      toast.error('Failed to load theatres list');
    }
  };

  const fetchShows = async () => {
    setFetchingShows(true);
    try {
      const res = await API.get('/shows');
      const allShows = res.data?.shows || res.data?.data || res.data || [];
      const showsArray = Array.isArray(allShows) ? allShows : [];

      // Filter by current adminEmail if matching, otherwise fallback to all shows
      const adminFiltered = showsArray.filter(
        (s) => s.adminEmail && s.adminEmail.toLowerCase() === adminEmail.toLowerCase()
      );

      setShows(adminFiltered.length > 0 ? adminFiltered : showsArray);
    } catch (err) {
      console.error('Failed to fetch shows:', err);
      toast.error('Failed to load scheduled shows');
    } finally {
      setFetchingShows(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedMovieId) {
      toast.error('Please select a movie');
      return;
    }
    if (!selectedTheatreId) {
      toast.error('Please select a theatre');
      return;
    }
    if (!showDate) {
      toast.error('Please choose a show date');
      return;
    }
    if (!showTime) {
      toast.error('Please choose a show time');
      return;
    }

    // Lookup movie and theatre details
    const chosenMovie = movies.find((m) => (m._id || m.id) === selectedMovieId);
    const chosenTheatre = theatres.find((t) => (t.theatreId || t._id) === selectedTheatreId);

    const movieName = chosenMovie?.movieName || chosenMovie?.name || 'Selected Movie';
    const theatreName = chosenTheatre?.theatreName || 'Selected Theatre';
    const showId = `sh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    setLoading(true);

    const payload = {
      showId,
      movieId: selectedMovieId,
      movieName,
      theatreId: selectedTheatreId,
      theatreName,
      showDate,
      showTime,
      adminEmail,
      tickets: {}
    };

    try {
      await API.post('/shows', payload);
      toast.success('Show scheduled successfully!');
      setShowDate('');
      setShowTime('');
      fetchShows();
    } catch (err) {
      console.error('Failed to add show:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to create show';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShow = async (show) => {
    const id = show.showId || show._id;
    if (!window.confirm(`Are you sure you want to cancel the show on ${show.showDate} at ${show.showTime}?`)) {
      return;
    }

    try {
      await API.delete(`/shows/${id}`);
      toast.success('Show cancelled successfully');
      fetchShows();
    } catch (err) {
      console.error('Failed to delete show:', err);
      toast.error(err.response?.data?.message || 'Failed to cancel show');
    }
  };

  const countBookedSeats = (tickets) => {
    if (!tickets) return 0;
    if (Array.isArray(tickets)) return tickets.length;
    if (typeof tickets === 'object') {
      return Object.values(tickets).filter((t) => {
        if (typeof t === 'string') return t === 'booked';
        return t?.status === 'booked';
      }).length;
    }
    return 0;
  };

  const getMovieTitle = (show) => {
    if (show.movieName) return show.movieName;
    const match = movies.find((m) => (m._id || m.id) === show.movieId);
    return match ? (match.movieName || match.name) : 'Cinema Show';
  };

  const getTheatreTitle = (show) => {
    if (show.theatreName) return show.theatreName;
    const match = theatres.find((t) => (t.theatreId || t._id) === show.theatreId);
    return match ? match.theatreName : 'Screen';
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container py-4 flex-grow-1">
        {/* Title Header */}
        <div className="mb-4">
          <h2 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faCalendarPlus} className="text-success me-2" />
            Showtime Scheduler
          </h2>
          <p className="text-secondary mb-0">
            Assign movies to registered theatre screens with specific dates and showtimes.
          </p>
        </div>

        {/* Schedule Show Form Card */}
        <div
          className="p-4 p-md-5 rounded-4 mb-5 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="row g-4">
              {/* Select Movie */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Select Movie <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faFilm} />
                  </span>
                  <select
                    className="form-select form-dark text-white"
                    value={selectedMovieId}
                    onChange={(e) => setSelectedMovieId(e.target.value)}
                    required
                  >
                    {movies.length === 0 && <option value="">No movies available</option>}
                    {movies.map((m) => (
                      <option key={m._id || m.id} value={m._id || m.id}>
                        {m.movieName || m.name} ({m.language || 'EN'})
                      </option>
                    ))}
                  </select>
                </div>
                {movies.length === 0 && (
                  <span className="text-danger small mt-1 d-block">
                    Please add movies first from the "Add Movie" section.
                  </span>
                )}
              </div>

              {/* Select Theatre */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Select Theatre / Screen <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faBuilding} />
                  </span>
                  <select
                    className="form-select form-dark text-white"
                    value={selectedTheatreId}
                    onChange={(e) => setSelectedTheatreId(e.target.value)}
                    required
                  >
                    {theatres.length === 0 && <option value="">No theatres available</option>}
                    {theatres.map((t) => (
                      <option key={t.theatreId || t._id} value={t.theatreId || t._id}>
                        {t.theatreName} — {t.location}
                      </option>
                    ))}
                  </select>
                </div>
                {theatres.length === 0 && (
                  <span className="text-danger small mt-1 d-block">
                    Please add theatres first from the "Add Theatre" section.
                  </span>
                )}
              </div>

              {/* Show Date */}
              <div className="col-12 col-sm-6">
                <label className="form-label text-secondary small fw-bold">
                  Show Date <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faCalendarDays} />
                  </span>
                  <input
                    type="date"
                    className="form-control form-dark text-white"
                    value={showDate}
                    onChange={(e) => setShowDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              {/* Show Time */}
              <div className="col-12 col-sm-6">
                <label className="form-label text-secondary small fw-bold">
                  Show Time <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <FontAwesomeIcon icon={faClock} />
                  </span>
                  <input
                    type="time"
                    className="form-control form-dark text-white"
                    value={showTime}
                    onChange={(e) => setShowTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-end gap-3 mt-4 pt-4 border-top border-dark">
              <button
                type="button"
                onClick={() => {
                  setShowDate('');
                  setShowTime('');
                }}
                className="btn btn-outline-secondary px-4 rounded-pill"
                disabled={loading}
              >
                <FontAwesomeIcon icon={faRotateLeft} className="me-2" />
                Clear
              </button>
              <button
                type="submit"
                className="btn btn-primary-red px-5 rounded-pill shadow-sm"
                disabled={loading || movies.length === 0 || theatres.length === 0}
              >
                <FontAwesomeIcon icon={faPlus} className="me-2" />
                <span>{loading ? 'Scheduling...' : 'Create Show'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Existing Shows List Section */}
        <div
          className="p-4 p-md-5 rounded-4 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-4">
            <div>
              <h4 className="text-white fw-bold mb-1">Scheduled Movie Shows</h4>
              <span className="text-secondary small">
                Showing all active showtimes and seat occupancy
              </span>
            </div>
            <button
              onClick={fetchShows}
              className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-light"
            >
              Refresh Shows
            </button>
          </div>

          {fetchingShows ? (
            <div className="text-center py-5 text-secondary">
              <div className="spinner-border text-success mb-2" role="status" />
              <div>Loading shows...</div>
            </div>
          ) : shows.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FontAwesomeIcon icon={faCalendarDays} size="3x" className="mb-3 text-muted" />
              <h5>No Shows Scheduled</h5>
              <p className="small mb-0">Create your first showtime slot using the form above.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                <thead>
                  <tr className="border-bottom border-secondary text-secondary small text-uppercase">
                    <th scope="col">Movie Name</th>
                    <th scope="col">Theatre / Screen</th>
                    <th scope="col">Show Date</th>
                    <th scope="col">Time</th>
                    <th scope="col">Booked Seats</th>
                    <th scope="col" className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shows.map((show) => {
                    const bookedCount = countBookedSeats(show.tickets);
                    return (
                      <tr key={show.showId || show._id} className="border-bottom border-dark">
                        <td className="text-white fw-bold">
                          {getMovieTitle(show)}
                        </td>
                        <td className="text-secondary small">
                          {getTheatreTitle(show)}
                        </td>
                        <td>
                          <span className="badge bg-dark border border-secondary text-light px-2 py-1">
                            {show.showDate}
                          </span>
                        </td>
                        <td className="text-white font-monospace">
                          {show.showTime}
                        </td>
                        <td>
                          <span
                            className={`badge px-2 py-1 ${
                              bookedCount > 0 ? 'bg-warning text-dark fw-bold' : 'bg-secondary bg-opacity-50 text-light'
                            }`}
                          >
                            <FontAwesomeIcon icon={faTicket} className="me-1" />
                            {bookedCount} Booked
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            onClick={() => handleDeleteShow(show)}
                            className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center ms-auto"
                            style={{ width: '34px', height: '34px' }}
                            title="Cancel Show"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
