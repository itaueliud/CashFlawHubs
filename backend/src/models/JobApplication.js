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
    status: {
      type: String,
      enum: ['submitted', 'reviewed', 'shortlisted', 'redirected', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'],
      default: 'redirected',
    },
    appliedAt: { type: Date, default: Date.now },
    redirectedAt: { type: Date, default: null },
    appliedConfirmedAt: { type: Date, default: null },
    interviewingAt: { type: Date, default: null },
    offeredAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    reminder24At: { type: Date, default: null },
    reminder24SentAt: { type: Date, default: null },
    reminder7At: { type: Date, default: null },
    reminder7SentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
