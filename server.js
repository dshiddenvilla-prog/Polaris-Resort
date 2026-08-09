require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const publicRoutes = require('./routes/public');
const adminAuthRoutes = require('./routes/adminAuth');
const adminRoutes = require('./routes/admin');

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_PASSCODE'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy, so Express needs
// this to see the real client IP — required for express-rate-limit to work
// correctly and not throw on startup.
app.set('trust proxy', 1);

// CORS: allow only the resort's frontend domain
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(
  cors({
    origin: allowedOrigin || false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));

app.use('/api', publicRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', dbState: mongoose.connection.readyState });
});

// Serve the frontend (index.html / admin.html) from the same service
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 404 handler for anything else (unmatched API routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler (catches JSON parse errors, etc.)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Polaris backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
