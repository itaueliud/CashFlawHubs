const mongoose = require('mongoose');

const ipLogSchema = new mongoose.Schema({
  ip:          { type: String, required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  country:     { type: String, default: null },
  region:      { type: String, default: null },
  city:        { type: String, default: null },
  loginCount:  { type: Number, default: 1 },
  firstSeen:   { type: Date, default: Date.now },
  lastSeen:    { type: Date, default: Date.now },
  flagged:     { type: Boolean, default: false },
  flagReason:  { type: String, default: null },
  blocked:     { type: Boolean, default: false },
  userAgent:   { type: String, default: null },
}, { timestamps: true });

ipLogSchema.index({ ip: 1, userId: 1 }, { unique: true });
ipLogSchema.index({ ip: 1 });
ipLogSchema.index({ userId: 1 });
ipLogSchema.index({ blocked: 1 });

module.exports = mongoose.model('IpLog', ipLogSchema);
