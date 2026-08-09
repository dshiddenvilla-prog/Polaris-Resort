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

// Clock times per package — used to detect same-day turnover conflicts.
// A Day Tour needs the villa from early morning; an Overnight guest doesn't
// leave until midday, so a Day Tour can't start on someone else's checkout day
// even though a new Overnight stay could (its check-in is later in the afternoon).
// NOTE: keep these in sync with PKG_TIMES in public/index.html.
const PKG_TIMES = {
  daytour: { checkin: '09:00', checkout: '17:00' },
  vip: { checkin: '15:00', checkout: '12:00' },
};

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Turns a booking's (date + package + checkin-or-checkout) into an absolute UTC
// timestamp, e.g. a VIP booking checking in Aug 27 occupies from "Aug 27 15:00".
function occupiedInstant(dateStr, pkg, isCheckin) {
  const times = PKG_TIMES[pkg] || PKG_TIMES.vip;
  const clock = isCheckin ? times.checkin : times.checkout;
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMinutes(d.getUTCMinutes() + toMinutes(clock));
  return d;
}

// Expand a date range into individual YYYY-MM-DD calendar dates, INCLUSIVE of
// the checkout day. Used only for checking against fully-blocked (maintenance)
// dates, which block the whole day regardless of package/time.
function expandDateRangeInclusive(checkin, checkout) {
  const dates = [];
  const start = new Date(checkin + 'T00:00:00Z');
  const end = new Date(checkout + 'T00:00:00Z');
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Expand an accepted booking's checkin/checkout into individual YYYY-MM-DD dates,
// checkout day EXCLUSIVE (standard hotel convention: nights are checkin..checkout-1).
// Used only for the legacy flat blockedDates list returned by /api/availability —
// the real conflict check below is time-aware, not date-only.
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

// Check whether booking A (checkin/checkout/package) overlaps booking B in
// actual occupied time — not just calendar days.
function bookingsOverlap(aCheckin, aCheckout, aPkg, bCheckin, bCheckout, bPkg) {
  const aStart = occupiedInstant(aCheckin, aPkg, true);
  const aEnd = occupiedInstant(aCheckout, aPkg, false);
  const bStart = occupiedInstant(bCheckin, bPkg, true);
  const bEnd = occupiedInstant(bCheckout, bPkg, false);
  return aStart < bEnd && bStart < aEnd;
}

// Determine whether a requested checkin/checkout/package collides with any
// accepted booking (time-aware — accounts for package turnover times) or any
// fully-blocked (maintenance) date.
async function hasDateConflict(checkin, checkout, pkg) {
  const acceptedBookings = await Booking.find({ status: 'accepted' }).select(
    'checkin checkout package'
  );

  for (const b of acceptedBookings) {
    if (bookingsOverlap(checkin, checkout, pkg, b.checkin, b.checkout, b.package)) {
      return true;
    }
  }

  const requestedDates = expandDateRangeInclusive(checkin, checkout);
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
  expandDateRangeInclusive,
  bookingsOverlap,
  hasDateConflict,
  sanitizeString,
  PKG_TIMES,
};
