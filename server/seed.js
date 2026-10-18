/**
 * iMovies - Seed Script (Movies Only)
 * =====================================
 * Seeds sample movies so the platform has content to browse.
 * All user data, theatres, shows, bookings are left empty —
 * professors / evaluators can register and create their own.
 *
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const Movie  = require('./models/movieModel');
const Admin  = require('./models/adminModel');
const User   = require('./models/userModel');
const Show   = require('./models/showModel');
const Booking= require('./models/bookingModel');
const Favorite=require('./models/favoriteModel');
const Review = require('./models/reviewModel');
const Theatre= require('./models/theatreModel');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/imovies';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // ── Clear everything ──────────────────────────────────────────────────────
  console.log('🗑️   Clearing all collections…');
  await Promise.all([
    User.deleteMany({}),
    Admin.deleteMany({}),
    Movie.deleteMany({}),
    Theatre.deleteMany({}),
    Show.deleteMany({}),
    Booking.deleteMany({}),
    Favorite.deleteMany({}),
    Review.deleteMany({}),
  ]);

  // ── Demo Admin ────────────────────────────────────────────────────────────
  console.log('👑  Creating demo admin…');
  await Admin.create({
    username: 'admin',
    email   : 'admin@imovies.com',
    password: bcrypt.hashSync('Admin@123', 10),
  });

  // ── Sample Movies ─────────────────────────────────────────────────────────
  console.log('🎬  Seeding movies…');
  const movies = [
    {
      movieName    : 'Interstellar Odyssey',
      description  : 'A breathtaking journey beyond the stars as a crew of astronauts travel through a wormhole in search of a new home for humanity, confronting the mysteries of time, gravity, and love across dimensions.',
      genres       : ['Sci-Fi', 'Drama', 'Adventure'],
      releaseDate  : new Date('2024-03-15'),
      language     : 'English',
      duration     : '2h 49m',
      certification: 'UA',
      posterUrl    : 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
      director     : 'Christopher Nolan',
      cast         : ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine'],
    },
    {
      movieName    : 'Shadow Protocol',
      description  : 'An elite spy navigates a web of deception and betrayal in a race against time to prevent a global catastrophe orchestrated by a shadow organisation operating within world governments.',
      genres       : ['Action', 'Thriller'],
      releaseDate  : new Date('2024-04-20'),
      language     : 'English',
      duration     : '2h 15m',
      certification: 'A',
      posterUrl    : 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'James Cameron',
      cast         : ['Tom Hardy', 'Zoe Saldana', 'Idris Elba', 'Emily Blunt'],
    },
    {
      movieName    : 'Kuch Khwaab The',
      description  : 'A heartwarming Bollywood romantic drama about two strangers who meet on a train journey across Rajasthan and fall hopelessly in love against a backdrop of vibrant colours and soulful music.',
      genres       : ['Romance', 'Drama'],
      releaseDate  : new Date('2024-05-01'),
      language     : 'Hindi',
      duration     : '2h 35m',
      certification: 'U',
      posterUrl    : 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Karan Johar',
      cast         : ['Ranbir Kapoor', 'Deepika Padukone', 'Ranveer Singh', 'Alia Bhatt'],
    },
    {
      movieName    : 'The Last Kingdom',
      description  : 'An epic historical saga following the rise and fall of kingdoms in medieval Europe as warriors battle for honour, love, and supremacy across blood-soaked battlefields spanning three continents.',
      genres       : ['Action', 'Drama'],
      releaseDate  : new Date('2024-02-14'),
      language     : 'English',
      duration     : '3h 02m',
      certification: 'A',
      posterUrl    : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Ridley Scott',
      cast         : ['Henry Cavill', 'Chris Hemsworth', 'Cate Blanchett', 'Viggo Mortensen'],
    },
    {
      movieName    : 'Laughing Stock',
      description  : 'A hilarious comedy about a bumbling stand-up comedian who accidentally becomes a global superstar after a viral mishap, only to find fame is not what he imagined.',
      genres       : ['Comedy'],
      releaseDate  : new Date('2024-06-10'),
      language     : 'English',
      duration     : '1h 58m',
      certification: 'UA',
      posterUrl    : 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Judd Apatow',
      cast         : ['Ryan Reynolds', 'Sandra Bullock', 'Will Ferrell', 'Rebel Wilson'],
    },
    {
      movieName    : 'Phantom Frequencies',
      description  : 'A spine-chilling horror thriller where a radio journalist begins receiving transmissions from the dead while investigating a series of mysterious disappearances in a remote mountain town.',
      genres       : ['Horror', 'Thriller'],
      releaseDate  : new Date('2024-10-31'),
      language     : 'English',
      duration     : '1h 52m',
      certification: 'A',
      posterUrl    : 'https://images.unsplash.com/photo-1503435980610-a51f3ddfee50?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Jordan Peele',
      cast         : ['Daniel Kaluuya', 'Florence Pugh', 'Adam Driver', "Lupita Nyong'o"],
    },
    {
      movieName    : "Dragon's Breath",
      description  : 'A stunning animated adventure following a young dragon tamer who must unite rival dragon clans to defeat an ancient evil threatening to plunge their world into eternal darkness.',
      genres       : ['Animation', 'Adventure'],
      releaseDate  : new Date('2024-07-15'),
      language     : 'English',
      duration     : '1h 45m',
      certification: 'U',
      posterUrl    : 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Pete Docter',
      cast         : ['Tom Hanks', 'Cate Blanchett', 'Zendaya'],
    },
    {
      movieName    : 'Aakash Ki Seemaein',
      description  : 'An emotional Tamil action drama about an astronaut from a small village who defies all odds to reach the stars, inspiring his entire community and bridging the gap between dreams and reality.',
      genres       : ['Action', 'Drama', 'Sci-Fi'],
      releaseDate  : new Date('2024-08-26'),
      language     : 'Tamil',
      duration     : '2h 45m',
      certification: 'UA',
      posterUrl    : 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'S. Shankar',
      cast         : ['Vijay', 'Nayanthara', 'Rajinikanth', 'Trisha Krishnan'],
    },
    {
      movieName    : 'Neon Requiem',
      description  : 'In a dystopian cyberpunk megacity, a disgraced detective teams up with an AI consciousness to expose a corporate conspiracy that reaches the highest levels of synthetic government.',
      genres       : ['Sci-Fi', 'Thriller', 'Action'],
      releaseDate  : new Date('2024-09-12'),
      language     : 'English',
      duration     : '2h 22m',
      certification: 'A',
      posterUrl    : 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Denis Villeneuve',
      cast         : ['Keanu Reeves', 'Ana de Armas', 'Oscar Isaac', 'Tilda Swinton'],
    },
    {
      movieName    : 'Monsoon Wedding Stories',
      description  : 'A bittersweet anthology of four love stories unfolding across one chaotic monsoon wedding weekend in Mumbai — laughter, tears, secrets, and new beginnings.',
      genres       : ['Romance', 'Comedy', 'Drama'],
      releaseDate  : new Date('2024-11-01'),
      language     : 'Hindi',
      duration     : '2h 08m',
      certification: 'U',
      posterUrl    : 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Zoya Akhtar',
      cast         : ['Ayushmann Khurrana', 'Taapsee Pannu', 'Vicky Kaushal', 'Katrina Kaif'],
    },
    {
      movieName    : 'Veera Nadai',
      description  : 'A riveting Tamil action film following a fearless village youth who single-handedly takes on a powerful drug cartel threatening to destroy his coastal community.',
      genres       : ['Action', 'Drama'],
      releaseDate  : new Date('2024-12-06'),
      language     : 'Tamil',
      duration     : '2h 30m',
      certification: 'UA',
      posterUrl    : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Lokesh Kanagaraj',
      cast         : ['Dhanush', 'Samantha Ruth Prabhu', 'Fahadh Faasil'],
    },
    {
      movieName    : 'Arctic Silence',
      description  : 'A gripping survival thriller about a glaciologist stranded alone on a melting Arctic ice shelf who must outwit nature, a pack of wolves, and her own slowly unravelling mind.',
      genres       : ['Thriller', 'Drama'],
      releaseDate  : new Date('2025-01-17'),
      language     : 'English',
      duration     : '1h 56m',
      certification: 'UA',
      posterUrl    : 'https://images.unsplash.com/photo-1520637836993-5c09ca89d7e5?w=400&h=600&fit=crop',
      trailerUrl   : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      director     : 'Alejandro González Iñárritu',
      cast         : ['Saoirse Ronan', 'Joel Edgerton', 'Michelle Yeoh'],
    },
  ];

  const movieDocs = await Movie.insertMany(movies);

  console.log('');
  console.log('='.repeat(55));
  console.log('  iMovies Seed Complete!');
  console.log('='.repeat(55));
  console.log(`  Movies created  : ${movieDocs.length}`);
  console.log(`  Demo admin      : admin@imovies.com / Admin@123`);
  console.log('='.repeat(55));
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Login as admin → /login (Admin tab)');
  console.log('  2. Add a Theatre  → /addtheatre');
  console.log('  3. Schedule shows → /addshow');
  console.log('  4. Register as user and book tickets!');
  console.log('='.repeat(55));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
