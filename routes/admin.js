const express = require('express');
const Booking = require('../models/Booking');
const BlockedDate = require('../models/BlockedDate');
const { requireAdmin } = require('../middleware/auth');
const { sanitizeString } = require('../utils/helpers');

const router = express.Router();

// All routes below require a valid admin JWT
router.use(requireAdmin);

const VALID_STATUSES = ['pending', 'accepted', 'rejected'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/admin/bookings?status=pending|accepted|rejected
router.get('/bookings', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter.' });
      }
      filter.status = status;
    }
    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (err) {
    console.error('GET /api/admin/bookings error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching bookings.' });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [pending, accepted, rejected, total] = await Promise.all([
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'accepted' }),
      Booking.countDocuments({ status: 'rejected' }),
      Booking.countDocuments({}),
    ]);
    return res.json({ pending, accepted, rejected, total });
  } catch (err) {
    console.error('GET /api/admin/stats error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching stats.' });
  }
});

// PATCH /api/admin/bookings/:ref/status
router.patch('/bookings/:ref/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const booking = await Booking.findOneAndUpdate(
      { ref: req.params.ref },
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    return res.json(booking);
  } catch (err) {
    console.error('PATCH /api/admin/bookings/:ref/status error:', err);
    return res.status(500).json({ error: 'Something went wrong updating the booking.' });
  }
});

// DELETE /api/admin/bookings/:ref
router.delete('/bookings/:ref', async (req, res) => {
  try {
    const booking = await Booking.findOneAndDelete({ ref: req.params.ref });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/bookings/:ref error:', err);
    return res.status(500).json({ error: 'Something went wrong deleting the booking.' });
  }
});

// GET /api/admin/blocked-dates
router.get('/blocked-dates', async (req, res) => {
  try {
    const dates = await BlockedDate.find().sort({ date: 1 });
    return res.json(dates);
  } catch (err) {
    console.error('GET /api/admin/blocked-dates error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching blocked dates.' });
  }
});

// POST /api/admin/blocked-dates
router.post('/blocked-dates', async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required.' });
    }

    const existing = await BlockedDate.findOne({ date });
    if (existing) {
      return res.json(existing); // skip if already blocked
    }

    const blocked = await BlockedDate.create({ date: sanitizeString(date, 10) });
    return res.status(201).json(blocked);
  } catch (err) {
    console.error('POST /api/admin/blocked-dates error:', err);
    return res.status(500).json({ error: 'Something went wrong blocking the date.' });
  }
});

// DELETE /api/admin/blocked-dates/:date
router.delete('/blocked-dates/:date', async (req, res) => {
  try {
    const blocked = await BlockedDate.findOneAndDelete({ date: req.params.date });
    if (!blocked) {
      return res.status(404).json({ error: 'Blocked date not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/blocked-dates/:date error:', err);
    return res.status(500).json({ error: 'Something went wrong unblocking the date.' });
  }
});

module.exports = router;
