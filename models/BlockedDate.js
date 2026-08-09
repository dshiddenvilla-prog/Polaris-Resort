const mongoose = require('mongoose');

const BlockedDateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('BlockedDate', BlockedDateSchema);
