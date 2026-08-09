const express = require('express');
const rateLimit = require('express-rate-limit');
const Booking = require('../models/Booking');
const BlockedDate = require('../models/BlockedDate');
const {
  generateUniqueRef,
  expandDateRange,
  hasDateConflict,
  sanitizeString,
} = require('../utils/helpers');

const router = express.Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 booking attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later.' },
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PACKAGES = ['daytour', 'vip'];

// POST /api/bookings
router.post('/bookings', bookingLimiter, async (req, res) => {
  try {
    const {
      package: pkg,
      packageLabel,
      checkin,
      checkout,
      name,
      phone,
      fb,
      guests,
      email,
      notes,
    } = req.body || {};

    // Required field validation
    if (!VALID_PACKAGES.includes(pkg)) {
      return res.status(400).json({ error: 'A valid package is required.' });
    }
    if (!checkin || !DATE_RE.test(checkin) || !checkout || !DATE_RE.test(checkout)) {
      return res.status(400).json({ error: 'Valid checkin and checkout dates are required.' });
    }
    if (checkout < checkin) {
      return res.status(400).json({ error: 'Checkout date cannot be before checkin date.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ error: 'Phone is required.' });
    }
    const guestsNum = Number(guests);
    if (!guestsNum || guestsNum < 1) {
      return res.status(400).json({ error: 'Guests must be a positive number.' });
    }

    // Double-booking guard (time-aware: accounts for package turnover times,
    // e.g. a Day Tour can't start on someone else's Overnight checkout day)
    const conflict = await hasDateConflict(checkin, checkout, pkg);
    if (conflict) {
      return res.status(409).json({
        error: 'The selected dates are no longer available. Please choose different dates.',
      });
    }

    const ref = await generateUniqueRef();

    const booking = await Booking.create({
      ref,
      package: pkg,
      packageLabel: sanitizeString(packageLabel, 100) || pkg,
      checkin,
      checkout,
      name: sanitizeString(name, 150),
      phone: sanitizeString(phone, 40),
      fb: sanitizeString(fb, 200),
      guests: guestsNum,
      email: sanitizeString(email, 150),
      notes: sanitizeString(notes, 1000),
      status: 'pending',
    });

    return res.status(201).json(booking);
  } catch (err) {
    console.error('POST /api/bookings error:', err);
    return res.status(500).json({ error: 'Something went wrong creating the booking.' });
  }
});

// GET /api/availability
router.get('/availability', async (req, res) => {
  try {
    const [blockedDateDocs, acceptedBookings] = await Promise.all([
      BlockedDate.find().select('date'),
      Booking.find({ status: 'accepted' }).select('checkin checkout package'),
    ]);

    // Legacy flat list (date-only, checkout day excluded) — kept for backward
    // compatibility with any client that hasn't picked up the `bookings` field yet.
    const dateSet = new Set(blockedDateDocs.map((d) => d.date));
    for (const b of acceptedBookings) {
      for (const d of expandDateRange(b.checkin, b.checkout)) {
        dateSet.add(d);
      }
    }

    return res.json({
      blockedDates: Array.from(dateSet).sort(),
      // Package + checkin/checkout for each accepted booking, so the frontend
      // can run the time-aware conflict check (see PKG_TIMES) instead of
      // treating every date as a simple booked/open boolean.
      bookings: acceptedBookings.map((b) => ({
        checkin: b.checkin,
        checkout: b.checkout,
        package: b.package,
      })),
    });
  } catch (err) {
    console.error('GET /api/availability error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching availability.' });
  }
});

module.exports = router;
