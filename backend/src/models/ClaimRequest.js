const mongoose = require('mongoose');

const claimRequestSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    email: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'confirmed', 'expired'], default: 'pending' },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24) }, // 24h
  },
  { timestamps: true }
);

claimRequestSchema.index({ token: 1 });

module.exports = mongoose.model('ClaimRequest', claimRequestSchema);
