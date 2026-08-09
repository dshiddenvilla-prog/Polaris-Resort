const Booking = require('../models/Booking');
const BlockedDate = require('../models/BlockedDate');

// Generate a unique POL-XXXXX reference (server-side)
async function generateUniqueRef() {
  let ref;
  let exists = true;
  while (exists) {
    const num = Math.floor(10000 + Math.random() * 90000); // 5-digit
    ref = `POL-${num}`;
    exists = await Booking.exists({ ref });
  }
  return ref;
}

// Expand an accepted booking's checkin/checkout into individual YYYY-MM-DD dates.
// Checkout day itself is treated as free (standard hotel convention) — nights are
// checkin .. checkout-1. If checkin === checkout (day tour), that single date is blocked.
function expandDateRange(checkin, checkout) {
  const dates = [];
  const start = new Date(checkin + 'T00:00:00Z');
  const end = new Date(checkout + 'T00:00:00Z');

  if (start.getTime() === end.getTime()) {
    dates.push(checkin);
    return dates;
  }

  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Check whether [checkin, checkout) overlaps [otherCheckin, otherCheckout)
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart + 'T00:00:00Z').getTime();
  const ae = new Date((aStart === aEnd ? aEnd + 'T23:59:59Z' : aEnd + 'T00:00:00Z')).getTime();
  const bs = new Date(bStart + 'T00:00:00Z').getTime();
  const be = new Date((bStart === bEnd ? bEnd + 'T23:59:59Z' : bEnd + 'T00:00:00Z')).getTime();
  return as < be && bs < ae;
}

// Determine whether a requested checkin/checkout range collides with any
// accepted booking or blocked date.
async function hasDateConflict(checkin, checkout) {
  const acceptedBookings = await Booking.find({ status: 'accepted' }).select(
    'checkin checkout'
  );

  for (const b of acceptedBookings) {
    if (rangesOverlap(checkin, checkout, b.checkin, b.checkout)) {
      return true;
    }
  }

  const requestedDates = expandDateRange(checkin, checkout);
  const blocked = await BlockedDate.find({
    date: { $in: requestedDates },
  }).select('date');

  return blocked.length > 0;
}

// Sanitize/trim a string input, capping length
function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

module.exports = {
  generateUniqueRef,
  expandDateRange,
  rangesOverlap,
  hasDateConflict,
  sanitizeString,
};
