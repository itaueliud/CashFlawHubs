const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coverLetter: { type: String, default: null },
    cvOriginalName: { type: String, default: null },
    cvFileName: { type: String, default: null },
    cvMimeType: { type: String, default: null },
    cvPath: { type: String, default: null },
    cvUrl: { type: String, default: null },
    tokenCost: { type: Number, default: 0, min: 0 },
    applicantEmailSent: { type: Boolean, default: false },
    status: { type: String, enum: ['submitted', 'reviewed', 'shortlisted', 'rejected'], default: 'submitted' },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);