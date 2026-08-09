const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true, index: true },
    package: { type: String, required: true, enum: ['daytour', 'vip'] },
    packageLabel: { type: String, required: true, trim: true, maxlength: 100 },
    checkin: { type: String, required: true }, // YYYY-MM-DD
    checkout: { type: String, required: true }, // YYYY-MM-DD
    name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    fb: { type: String, trim: true, maxlength: 200, default: '' },
    guests: { type: Number, required: true, min: 1, max: 500 },
    email: { type: String, trim: true, maxlength: 150, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true } // createdAt, updatedAt
);

module.exports = mongoose.model('Booking', BookingSchema);
