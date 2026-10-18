# 🎬 iMovies - Full-Stack Movie Ticket Booking & Cinema Management Platform

A modern, production-grade MERN stack movie booking platform featuring live market movies via TMDB, real-time interactive seat maps with hold locking using WebSockets, Razorpay payment processing (Cards, UPI, Netbanking), automated Nodemailer email ticket confirmations, WhatsApp digital ticket sharing, and an advanced Admin Management Suite.

---

## ✨ Features

### 🌟 Customer Experience
- **Live Market Movies from TMDB:** Fetches the latest blockbusters, trailers, synopsis, cast, and ratings directly from The Movie Database (TMDB) API.
- **Dynamic Filtering:** Filter movies by **Genre** (Action, Comedy, Drama, Sci-Fi, Horror, etc.) and **Country/Location** (India, USA, South Korea, UK, Japan, etc.).
- **Real-Time Seat Booking:** Interactive multi-tiered cinema layout (Balcony, Middle, Lower).
- **10-Minute Hold Locking:** Powered by **Socket.io** to prevent double-booking. Locked seats expire automatically if payment is not completed within 10 minutes.
- **Razorpay Payment Gateway:** Integrated test-mode checkout supporting credit/debit cards, netbanking, and UPI (Google Pay, PhonePe, Paytm, BHIM, QR code).
- **Automated Email Confirmations:** Sends styled HTML tickets to customer emails upon booking confirmation via Nodemailer.
- **Digital Ticket & WhatsApp Sharing:** Printable tickets with simulated QR pass and a 1-click **Share to WhatsApp** action.
- **Dark & Light Mode:** Seamless theme toggling with persistent state management across the app.
- **User Profile Management:** Edit personal details and manage booking histories.

### 🛡️ Admin Suite & Role-Based Access Control (RBAC)
- **Role Isolation:** Strict role validation (`admin` vs `user`). Public signups are strictly constrained to `role: 'user'`, preventing privilege escalation.
- **Admin Dashboard & Analytics:** Real-time metrics for total revenue, active theatres, scheduled shows, and user base.
- **Movie, Theatre & Showtime Management:** Create, edit, and schedule shows across custom seating configurations and price tiers.
- **Transactions & Refund Management:** View all user payments and issue instant Razorpay refunds directly from the admin panel, automatically freeing up reserved seats in real time.
- **Protected Admin Provisioning:** Super-admin protected route (`POST /api/admin/create-admin`) to securely provision new administrator accounts.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, React Router DOM v6, Bootstrap 5, FontAwesome, React Toastify, Axios, Socket.io-client
- **Backend:** Node.js, Express.js, MongoDB with Mongoose, Socket.io, JWT (JSON Web Tokens), Bcrypt.js
- **Integrations:**
  - **TMDB API** (Movie Discovery & Metadata)
  - **Razorpay** (Payment Processing & Refunds)
  - **Nodemailer** (Transactional Confirmation Emails)

---

## 📁 Project Structure

```text
iMovies/
├── client/                     # React Frontend
│   ├── src/
│   │   ├── components/         # Navbar, MovieCard, Modals, Checkout, Legenda
│   │   ├── context/            # ThemeContext (Dark / Light)
│   │   ├── hooks/              # Custom data fetching hooks
│   │   ├── pages/              # Landing, Home, SeatSlug, Bookings, Admin, etc.
│   │   └── utils/              # API interceptors, guards, whatsapp helpers
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Express Backend
│   ├── controllers/            # Auth, Movie, Theatre, Show, Booking, Admin
│   ├── middlewares/            # fetchUser, fetchAdmin RBAC guards
│   ├── models/                 # User, Admin, Movie, Theatre, Show, Booking
│   ├── routes/                 # Express API endpoints
│   ├── services/               # TMDB & Nodemailer services
│   ├── utils/                  # Cron seat-cleanup & show reminders
│   ├── .env.example
│   ├── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/ritik2209verma-ai/iMovies.git
cd iMovies
```

### 2. Configure Backend Environment
Navigate to `server/` and create `.env` based on `.env.example`:
```bash
cd server
cp .env.example .env
```
Fill in your credentials:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/imovies
JWT_SECRET=your_secret_key
TMDB_API_KEY=your_tmdb_api_key
RAZORPAY_KEY_ID=your_razorpay_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

Install backend dependencies and start the server:
```bash
npm install
npm run dev   # or: node server.js
```

### 3. Configure Frontend Environment
Navigate to `client/` and create `.env` based on `.env.example`:
```bash
cd ../client
cp .env.example .env
```
Fill in your Razorpay Key:
```env
VITE_RAZORPAY_KEY_ID=your_razorpay_id
```

Install frontend dependencies and start the Vite dev server:
```bash
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser!

---

## 🔒 Security & RBAC Enforcement

- Public signup `/api/auth/register` and `/api/auth/signup` will always default to `role: 'user'`, ignoring any client-injected role fields.
- Admin creation `/api/admin/create-admin` requires both a verified admin JWT and active record check in MongoDB.
- Razorpay payment webhooks / signature verification validate transaction integrity using HMAC-SHA256 before confirming ticket bookings.

---

## 📜 License
MIT License. Created by [ritik2209verma-ai](https://github.com/ritik2209verma-ai).
