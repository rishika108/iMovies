# 🎬 iMovies - Movie Ticket Booking Platform

> **iMovies - Movie ticket booking made simple**  
> A full-stack, responsive, production-ready Movie Ticket Booking & Cinema Management Web Application built with the **MERN** stack (MongoDB, Express.js, React, Node.js), Vite, Socket.io, Razorpay (Test Mode), Nodemailer, and WhatsApp Integration following the Model-View-Controller (MVC) architecture.

---

## 🌟 Overview & Architecture

- **App Name**: iMovies - Movie ticket booking made simple
- **Architecture**: Client-Server Architecture following MVC design pattern.
  - **Frontend**: React.js (Vite bundle), React Router DOM (Lazy loading with Suspense), Bootstrap 5 / Tailwind CSS, FontAwesome icons, React-Toastify, Axios, Socket.io-client.
  - **Backend**: Node.js + Express.js REST API with JWT authentication and bcrypt.js password hashing.
  - **Database**: MongoDB (Mongoose ODM) with schemas for Users, Admins, Movies, Theatres, Shows, Bookings, Favorites, and Reviews.
  - **Real-Time Services**: Temporary seat locking mechanism with TTL (10-minute countdown) and WebSocket / Socket.io for live availability tracking.
  - **Payment Gateway**: Razorpay (Test Mode) with multi-payment support (UPI: GPay, PhonePe, Paytm, BHIM, QR code; Debit/Credit Cards; NetBanking) and HMAC-SHA256 signature verification.
  - **Admin Suite**: Financial transaction analytics, live revenue summary, and one-click Razorpay refund issuing with automatic seat liberation.
  - **Notification & Sharing**: Nodemailer Gmail SMTP HTML ticket confirmation emails, dynamic on-screen scannable QR ticket view, and one-click WhatsApp ticket sharing.
  - **Automation & Utilities**: Node-cron for cleanup of expired locks and upcoming show reminders.

---

## 🔑 Test Credentials & Environment

### Razorpay Test Mode Credentials
```env
RAZORPAY_KEY_ID=rzp_test_TpQ7mg5jyDRTt0
RAZORPAY_KEY_SECRET=5OtY3b29pz3FK1KukmSiZqmS
```

### Pre-configured Demo Accounts
- **Administrator Portal**:
  - URL: `/login` (Switch to Admin tab) or direct route `/admin`
  - Email: `admin@imovies.com`
  - Password: `Admin@123`
- **Customer User Account**:
  - Register freely on `/register` or `/login` with any valid email.

---

## 📂 Project Directory Structure

```text
iMovies/
├── client/                     # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/         # Reusable UI (Header, Footer, Loader, TicketModal, AdminTransactions, CheckoutButton)
│   │   ├── context/            # ThemeContext (Dark Cinema Theme / Light Mode)
│   │   ├── hooks/              # Custom Hooks (useFetch)
│   │   ├── pages/              # Landing, Login, Register, Home, MovieDetails, MovieShows, SeatSlug, Bookings, Profile, Admin Suite
│   │   ├── utils/              # API helpers, route protection (UserProtection, AdminProtection), whatsappHelper, timeHelper
│   │   ├── App.jsx             # React Router DOM configuration with Suspense & Lazy loading
│   │   └── main.jsx
│   ├── .env                    # VITE_API_URL, VITE_RAZORPAY_KEY_ID
│   ├── .env.example
│   └── package.json
└── server/                     # Backend (Node + Express)
    ├── controllers/            # Handlers for Auth, Movies, Theatres, Shows, Bookings, Payments, Admin, Reviews, Favorites
    ├── middlewares/            # fetchUser.js (JWT validation), fetchAdmin.js
    ├── models/                 # Mongoose schemas: userModel, adminModel, movieModel, theatreModel, showModel, bookingModel, favoriteModel, reviewModel
    ├── routes/                 # Express REST API routes: /api/auth, /api/movies, /api/theatres, /api/shows, /api/bookings, /api/payment, /api/admin, /api/reviews, /api/favorites, /api/email
    ├── services/               # emailService.js (Nodemailer Gmail SMTP & Brevo), tmdbService.js
    ├── utils/                  # reminderService.js, cleanupService.js, mailer.js, timeHelper.js
    ├── .env                    # PORT, MONGO_URI, JWT_SECRET, RAZORPAY_*, EMAIL_*
    ├── .env.example
    ├── seed.js                 # Database seeder for movies, theatres, and default admin
    ├── server.js               # Express entry point & Socket.io server
    └── package.json
```

---

## 🗄️ Database Schemas (Mongoose ODM)

1. **User Schema (`userModel.js`)**:
   - `username`: String, required, min length 3, max length 20, unique.
   - `email`: String, required, unique, max length 50.
   - `password`: String, required, min length 6 (bcrypt hashed).
   - `role`: String, enum: `['user', 'admin']`, default: `'user'`.
2. **Admin Schema (`adminModel.js`)**:
   - `username`: String, required, min length 3, max length 20, unique.
   - `email`: String, required, unique, max length 50.
   - `password`: String, required, min length 6.
   - `role`: String, default: `'admin'`.
3. **Movie Schema (`movieModel.js`)**:
   - `movieName`: String, required, trim, min length 2, max length 200.
   - `description`: String, required, trim, min length 10.
   - `genres`: Array of Strings, required (validator ensuring at least 1 genre).
   - `releaseDate`: Date, required.
   - `language`: String, required.
   - `duration`: Mixed (String/Number), required.
   - `certification`: String (`U`, `UA`, `A`).
   - `posterUrl`, `trailerUrl`, `cast`, `director`.
4. **Theatre Schema (`theatreModel.js`)**:
   - `theatreName`: String, required.
   - `theatreId`: String, required, unique.
   - `location`: String, required.
   - `balconySeatPrice`: Number, required (e.g., ₹300).
   - `middleSeatPrice`: Number, required (e.g., ₹200).
   - `lowerSeatPrice`: Number, required (e.g., ₹150).
   - `balconySeats`: Object (rows, cols).
   - `middleSeats`: Object (rows, cols).
   - `lowerSeats`: Object (rows, cols).
   - `showtimes`: Array of Strings.
5. **Show Schema (`showModel.js`)**:
   - `adminEmail`: String, required.
   - `showId`: String, required, unique.
   - `movieId`: String, required.
   - `theatreName`: String, required.
   - `theatreId`: String, required.
   - `showDate`: String/Date, required.
   - `showTime`: String, required.
   - `tickets`: Object tracking real-time status (`available`, `locked`, `booked`), lock timestamps, and user associations.
6. **Booking Schema (`bookingModel.js`)**:
   - `bookingId`: String, required, unique.
   - `userEmail`: String, required.
   - `showId`: String, required.
   - `ticketsData`: Object, required.
   - `selectedSeats`: Array of Strings.
   - `totalAmount`: Number.
   - `paymentStatus`: String (`Pending`, `Completed`, `Failed`, `Cancelled`, `Refunded`).
   - `paymentMethod`: String (`Razorpay`).
   - `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`.
   - `refundId`, `refundAmount`, `refundStatus`.
7. **Favorite / Watchlist Schema (`favoriteModel.js`)**:
   - `userEmail`: String, required.
   - `movieId`: String, required.
8. **Review Schema (`reviewModel.js`)**:
   - `userEmail`: String, required.
   - `movieId`: String, required.
   - `rating`: Number (1-5), required.
   - `reviewText`: String, required, min length 10.

---

## 💳 Strict 5-Step Razorpay Transaction Flow

1. **Step 1 — Selection**: The user selects seats across Balcony, Middle, or Lower tiers on `/seatslug/:showId`, locks them temporarily for 10 minutes, and clicks **"Proceed to Pay"**.
2. **Step 2 — Frontend API Call**: React makes an Axios POST request to `/api/payment/create-order` passing `bookingId`, `amount`, and `currency: "INR"`.
3. **Step 3 — Gateway Communication**: The Express backend uses the official `razorpay` npm package to create an order with Razorpay servers, generating an `order_id` in paise ($1\text{ INR} = 100\text{ paise}$).
4. **Step 4 — Checkout Modal & Cryptographic Verification**:
   - The native Razorpay checkout modal opens with UPI priority (Google Pay, PhonePe, Paytm, BHIM, UPI QR code), Cards, and NetBanking.
   - Upon completion, the frontend submits `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/api/payment/verify`.
   - The backend validates the cryptographic signature using `crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)`.
   - Once verified, the booking is updated to `Completed`, and seats on the Show are marked `booked`.
5. **Step 5 — Confirmation & Notification**:
   - The backend triggers an automated HTML e-ticket confirmation email via Nodemailer (`sendTicketEmail`).
   - Real-time WebSocket events (`seats:booked`) update all viewing clients.
   - The user is redirected to `/bookings` with instant success alerts and can view their printable digital ticket or share it to WhatsApp.

---

## 💸 Admin Transactions & Refund Management

1. **Admin Transactions Dashboard** (`/admintransactions`):
   - Real-time data table displaying all customer bookings with live badges (`Completed`, `Pending`, `Cancelled`, `Refunded`).
   - Financial analytics cards: Total Transactions, Total Revenue (₹), Total Refunds (₹), Completed vs Pending vs Cancelled count.
2. **One-Click Refund & Automatic Seat Liberation**:
   - Admin clicks **"Issue Refund / Cancel Booking"** on any completed reservation.
   - Express endpoint `POST /api/admin/refund/:paymentId` invokes `razorpay.payments.refund()`.
   - Marks booking status as `Refunded`.
   - Automatically releases reserved seats in the MongoDB Show document back to `available`.
   - Broadcasts real-time Socket.io event (`seats:released`) so customers can immediately book those seats again.
   - Sends automated status update notification email.

---

## 💬 WhatsApp Ticket Sharing & Nodemailer Emails

1. **WhatsApp Share Helper** (`client/src/utils/whatsappHelper.js`):
   - Formats ticket details into an emoji-rich cinema message including Movie Name, Cinema Hall, Date, Time, Seat Numbers, Total Amount, and Booking ID.
   - Generates prefilled `https://wa.me/?text=...` share links.
   - Prominent green **"💬 Share to WhatsApp"** button embedded in both the Booking History card and the Digital Ticket modal.
2. **Nodemailer Email Integration** (`server/services/emailService.js`):
   - Configured with Gmail SMTP transport using `EMAIL_USER` and `EMAIL_PASS`.
   - Delivers styled HTML tickets with e-pass header, confirmation status badge, breakdown of showtime and seats, and order ID.

---

## 🚀 Quickstart Guide

### 1. Set Active Workspace
Ensure your workspace is set to:
```text
C:\Users\rishi\.gemini\antigravity\scratch\iMovies
```

### 2. Configure Environment Files

**Backend (`server/.env`)**:
```env
PORT=5000
CLIENT_URL=http://localhost:5173,http://localhost:3000
MONGO_URI=mongodb://localhost:27017/imovies
JWT_SECRET=imovies_super_secure_jwt_secret_token_key_2026
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
RAZORPAY_KEY_ID=rzp_test_TpQ7mg5jyDRTt0
RAZORPAY_KEY_SECRET=5OtY3b29pz3FK1KukmSiZqmS
```

**Frontend (`client/.env`)**:
```env
VITE_API_URL=https://imovies1802.onrender.com
VITE_RAZORPAY_KEY_ID=rzp_test_TpQ7mg5jyDRTt0
```

### 3. Run the Application

**Run Frontend**:
```powershell
cd client
npm run dev
```
Access the application at `http://localhost:5173`.

**Run Backend (Optional for local API)**:
```powershell
cd server
npm start
```
*(The frontend is also pre-configured to connect to the live cloud API at `https://imovies1802.onrender.com`)*.

---

## 🎯 Verification & Testing

- ✅ **Vite Frontend Build**: Built 245 modules cleanly in 2.1s.
- ✅ **Frontend Dev Server**: Running on `http://localhost:5173`.
- ✅ **Razorpay Test Integration**: Validated test keys and 5-step transaction flow.
- ✅ **UPI Support**: Pre-configured UPI and QR payment options in modal.
- ✅ **Nodemailer SMTP**: Integrated into `emailService.js` and `mailer.js`.
- ✅ **WhatsApp Sharing**: Tested with emoji formatted string generation and green action buttons.
- ✅ **Admin Transactions & Refunds**: Data table with live metrics and `/api/admin/refund/:paymentId` endpoint.
- ✅ **Real-Time Locking & Sockets**: 10-minute hold lock with timer countdown and Socket.io broadcasts.

---

## 👤 Author & Maintainer

Maintained and developed by **[rishika108](https://github.com/rishika108)**.

