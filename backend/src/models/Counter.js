const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    sequenceValue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', counterSchema);