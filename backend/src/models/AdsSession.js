const mongoose = require('mongoose');

const adsSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  windowStartedAt: { type: Date, default: null },
  windowExpiresAt: { type: Date, required: true, index: true },
  lastHeartbeatAt: { type: Date, default: null },
  accumulatedSeconds: { type: Number, default: 0, min: 0 },
  rewardGrantedAt: { type: Date, default: null },
  rewardChallengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', default: null },
}, { timestamps: true });

adsSessionSchema.index({ windowExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdsSession', adsSessionSchema);
