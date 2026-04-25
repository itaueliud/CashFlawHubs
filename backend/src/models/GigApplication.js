const mongoose = require('mongoose');

const gigApplicationSchema = new mongoose.Schema({
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenCost: { type: Number, required: true },
  coverLetter: { type: String, default: null },
  status: { type: String, enum: ['submitted', 'accepted', 'rejected'], default: 'submitted' },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

gigApplicationSchema.index({ gigId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('GigApplication', gigApplicationSchema);
