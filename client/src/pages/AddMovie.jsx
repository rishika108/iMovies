import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilm,
  faPlus,
  faTrash,
  faPenToSquare,
  faCalendar,
  faClock,
  faVideo,
  faImage,
  faUserTie,
  faUsers,
  faRotateLeft,
  faCheck,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

const AVAILABLE_GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Sci-Fi',
  'Romance',
  'Thriller',
  'Animation',
  'Documentary'
];

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada'];
const CERTIFICATIONS = ['U', 'UA', 'A', 'S'];

const initialFormState = {
  movieName: '',
  description: '',
  genres: [],
  releaseDate: '',
  language: 'English',
  duration: '2h 15m',
  certification: 'UA',
  posterUrl: '',
  trailerUrl: '',
  director: '',
  castInput: ''
};

export default function AddMovie() {
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [moviesList, setMoviesList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const formRef = useRef(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    setListLoading(true);
    try {
      const res = await API.get('/movies');
      const data = res.data?.movies || res.data?.data || res.data || [];
      setMoviesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch movies:', err);
      toast.error('Failed to load existing movies');
    } finally {
      setListLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenreToggle = (genre) => {
    setFormData((prev) => {
      const exists = prev.genres.includes(genre);
      const nextGenres = exists
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre];
      return { ...prev, genres: nextGenres };
    });
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.movieName.trim()) {
      toast.error('Please enter a movie name');
      return;
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    if (formData.genres.length === 0) {
      toast.error('Please select at least one genre');
      return;
    }
    if (!formData.releaseDate) {
      toast.error('Please select a release date');
      return;
    }

    setLoading(true);

    // Prepare payload
    const castArray = formData.castInput
      ? formData.castInput.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    const payload = {
      movieName: formData.movieName.trim(),
      description: formData.description.trim(),
      genres: formData.genres,
      releaseDate: formData.releaseDate,
      language: formData.language,
      duration: formData.duration.trim(),
      certification: formData.certification,
      posterUrl: formData.posterUrl.trim(),
      trailerUrl: formData.trailerUrl.trim(),
      director: formData.director.trim(),
      cast: castArray
    };

    try {
      if (editingId) {
        await API.put(`/movies/${editingId}`, payload);
        toast.success('Movie updated successfully!');
      } else {
        await API.post('/movies', payload);
        toast.success('Movie added successfully!');
      }

      resetForm();
      fetchMovies();
    } catch (err) {
      console.error('Error saving movie:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save movie';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (movie) => {
    setEditingId(movie._id || movie.id);

    // Format date for input: YYYY-MM-DD
    let formattedDate = '';
    if (movie.releaseDate) {
      try {
        formattedDate = new Date(movie.releaseDate).toISOString().split('T')[0];
      } catch (e) {
        formattedDate = '';
      }
    }

    // Cast handling
    let castStr = '';
    if (Array.isArray(movie.cast)) {
      castStr = movie.cast.join(', ');
    } else if (typeof movie.cast === 'string') {
      castStr = movie.cast;
    }

    setFormData({
      movieName: movie.movieName || movie.name || movie.title || '',
      description: movie.description || '',
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      releaseDate: formattedDate,
      language: movie.language || 'English',
      duration: movie.duration || '2h 15m',
      certification: movie.certification || 'UA',
      posterUrl: movie.posterUrl || movie.poster || '',
      trailerUrl: movie.trailerUrl || movie.trailer || '',
      director: movie.director || '',
      castInput: castStr
    });

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title || 'this movie'}"?`)) {
      return;
    }

    try {
      await API.delete(`/movies/${id}`);
      toast.success('Movie deleted successfully');
      fetchMovies();
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      console.error('Failed to delete movie:', err);
      toast.error(err.response?.data?.message || 'Failed to delete movie');
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container py-4 flex-grow-1" ref={formRef}>
        {/* Title Header */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-4">
          <div>
            <h2 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faFilm} className="text-danger me-2" />
              {editingId ? 'Edit Movie Details' : 'Add New Movie'}
            </h2>
            <p className="text-secondary mb-0">
              Publish or modify cinema titles shown across theatres in the network.
            </p>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="btn btn-outline-warning btn-sm d-flex align-items-center gap-2 px-3 rounded-pill"
            >
              <FontAwesomeIcon icon={faXmark} />
              <span>Cancel Editing</span>
            </button>
          )}
        </div>

        {/* Main Form Card */}
        <div
          className="p-4 p-md-5 rounded-4 mb-5 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="row g-4">
              {/* Movie Name */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Movie Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="movieName"
                  className="form-control form-dark text-white"
                  placeholder="e.g. Inception, Dune: Part Two"
                  value={formData.movieName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Language */}
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label text-secondary small fw-bold">
                  Language <span className="text-danger">*</span>
                </label>
                <select
                  name="language"
                  className="form-select form-dark text-white"
                  value={formData.language}
                  onChange={handleInputChange}
                  required
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Certification */}
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label text-secondary small fw-bold">
                  Certification <span className="text-danger">*</span>
                </label>
                <select
                  name="certification"
                  className="form-select form-dark text-white"
                  value={formData.certification}
                  onChange={handleInputChange}
                  required
                >
                  {CERTIFICATIONS.map((cert) => (
                    <option key={cert} value={cert}>
                      {cert}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="col-12">
                <label className="form-label text-secondary small fw-bold">
                  Description / Synopsis <span className="text-danger">*</span>
                </label>
                <textarea
                  name="description"
                  rows="3"
                  className="form-control form-dark text-white"
                  placeholder="Provide an engaging summary of the movie plot (min 10 characters)..."
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Genres Checkbox Group */}
              <div className="col-12">
                <label className="form-label text-secondary small fw-bold d-block mb-2">
                  Genres <span className="text-danger">* (select at least one)</span>
                </label>
                <div className="d-flex flex-wrap gap-2">
                  {AVAILABLE_GENRES.map((genre) => {
                    const isChecked = formData.genres.includes(genre);
                    return (
                      <button
                        type="button"
                        key={genre}
                        onClick={() => handleGenreToggle(genre)}
                        className={`btn btn-sm rounded-pill px-3 py-1 transition-all d-flex align-items-center gap-2 ${
                          isChecked
                            ? 'btn-danger text-white fw-bold shadow-sm'
                            : 'btn-outline-secondary text-secondary'
                        }`}
                        style={{ fontSize: '0.82rem' }}
                      >
                        {isChecked && <FontAwesomeIcon icon={faCheck} size="xs" />}
                        <span>{genre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Release Date */}
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Release Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  name="releaseDate"
                  className="form-control form-dark text-white"
                  value={formData.releaseDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Duration */}
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Duration <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="duration"
                  className="form-control form-dark text-white"
                  placeholder="e.g. 2h 30m"
                  value={formData.duration}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Director */}
              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-bold">
                  Director
                </label>
                <input
                  type="text"
                  name="director"
                  className="form-control form-dark text-white"
                  placeholder="e.g. Christopher Nolan"
                  value={formData.director}
                  onChange={handleInputChange}
                />
              </div>

              {/* Cast Input */}
              <div className="col-12">
                <label className="form-label text-secondary small fw-bold">
                  Cast Members (comma separated)
                </label>
                <input
                  type="text"
                  name="castInput"
                  className="form-control form-dark text-white"
                  placeholder="e.g. Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page"
                  value={formData.castInput}
                  onChange={handleInputChange}
                />
              </div>

              {/* Poster URL & Preview */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Poster Image URL
                </label>
                <input
                  type="url"
                  name="posterUrl"
                  className="form-control form-dark text-white mb-2"
                  placeholder="https://example.com/poster.jpg"
                  value={formData.posterUrl}
                  onChange={handleInputChange}
                />
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Provide a valid web image link for high resolution display.
                </span>

                {formData.posterUrl && (
                  <div className="mt-3 p-2 rounded-3 text-center" style={{ backgroundColor: '#101010', border: '1px solid #333' }}>
                    <div className="text-secondary small mb-2">Poster Live Preview</div>
                    <img
                      src={formData.posterUrl}
                      alt="Preview"
                      className="rounded-2 shadow-sm"
                      style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Trailer URL */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-bold">
                  Trailer URL (YouTube / Video)
                </label>
                <input
                  type="url"
                  name="trailerUrl"
                  className="form-control form-dark text-white mb-2"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formData.trailerUrl}
                  onChange={handleInputChange}
                />
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Link to official movie trailer video.
                </span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="d-flex justify-content-end gap-3 mt-4 pt-4 border-top border-dark">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-outline-secondary px-4 rounded-pill"
                disabled={loading}
              >
                <FontAwesomeIcon icon={faRotateLeft} className="me-2" />
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary-red px-5 rounded-pill shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <FontAwesomeIcon icon={editingId ? faPenToSquare : faPlus} className="me-2" />
                    <span>{editingId ? 'Update Movie' : 'Add Movie'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Movies List Section */}
        <div
          className="p-4 p-md-5 rounded-4 shadow-sm"
          style={{
            backgroundColor: 'var(--dark-card)',
            border: '1px solid #262626'
          }}
        >
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-4">
            <div>
              <h4 className="text-white fw-bold mb-1">Existing Movies Directory</h4>
              <span className="text-secondary small">
                Total {moviesList.length} titles registered in the database
              </span>
            </div>
            <button
              onClick={fetchMovies}
              className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-light"
            >
              Refresh List
            </button>
          </div>

          {listLoading ? (
            <div className="text-center py-5 text-secondary">
              <div className="spinner-border text-danger mb-2" role="status" />
              <div>Loading movie list...</div>
            </div>
          ) : moviesList.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FontAwesomeIcon icon={faFilm} size="3x" className="mb-3 text-muted" />
              <h5>No Movies Found</h5>
              <p className="small mb-0">Use the form above to add your first movie.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                <thead>
                  <tr className="border-bottom border-secondary text-secondary small text-uppercase">
                    <th scope="col" style={{ width: '80px' }}>Poster</th>
                    <th scope="col">Title</th>
                    <th scope="col">Language / Cert</th>
                    <th scope="col">Genres</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Release Date</th>
                    <th scope="col" className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moviesList.map((movie) => {
                    const id = movie._id || movie.id;
                    const poster = movie.posterUrl || movie.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
                    const genres = Array.isArray(movie.genres) ? movie.genres : [];

                    return (
                      <tr key={id} className="border-bottom border-dark">
                        <td>
                          <img
                            src={poster}
                            alt={movie.movieName || 'Poster'}
                            className="rounded-2 shadow-sm"
                            style={{ width: '48px', height: '64px', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
                            }}
                          />
                        </td>
                        <td>
                          <div className="text-white fw-bold">{movie.movieName || movie.name}</div>
                          {movie.director && (
                            <div className="text-secondary small">Dir: {movie.director}</div>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-dark border border-secondary text-white me-1">
                            {movie.language || 'English'}
                          </span>
                          <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50">
                            {movie.certification || 'U'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '240px' }}>
                            {genres.slice(0, 3).map((g, idx) => (
                              <span key={idx} className="genre-badge m-0" style={{ fontSize: '0.7rem' }}>
                                {g}
                              </span>
                            ))}
                            {genres.length > 3 && (
                              <span className="text-secondary small">+{genres.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-secondary small">
                          {movie.duration || 'N/A'}
                        </td>
                        <td className="text-secondary small">
                          {movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              onClick={() => handleEditClick(movie)}
                              className="btn btn-outline-warning btn-sm rounded-circle d-flex align-items-center justify-content-center"
                              style={{ width: '34px', height: '34px' }}
                              title="Edit Movie"
                            >
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button
                              onClick={() => handleDelete(id, movie.movieName || movie.name)}
                              className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center"
                              style={{ width: '34px', height: '34px' }}
                              title="Delete Movie"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
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
