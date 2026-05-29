const mongoose = require('mongoose');

const jobOutreachLogSchema = new mongoose.Schema(
  {
    recipientEmail: { type: String, required: true, index: true },
    recipientHost: { type: String, default: null },
    digestDate: { type: String, required: true, index: true },
    jobIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    jobCount: { type: Number, default: 0 },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'skipped' },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

jobOutreachLogSchema.index({ recipientEmail: 1, digestDate: 1 }, { unique: true });

module.exports = mongoose.model('JobOutreachLog', jobOutreachLogSchema);
