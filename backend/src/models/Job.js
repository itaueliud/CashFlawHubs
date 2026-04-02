const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true },
  source: { type: String, enum: ['remotive', 'jobicy', 'adzuna'], required: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  companyLogo: { type: String, default: null },
  category: { type: String, required: true },
  jobType: { type: String, default: 'full-time' },
  location: { type: String, default: 'Remote' },
  salary: { type: String, default: null },
  description: { type: String, required: true },
  tags: [{ type: String }],
  applicationUrl: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  views: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
}, {
  timestamps: true,
});

jobSchema.index({ category: 1 });
jobSchema.index({ publishedAt: -1 });
jobSchema.index({ isActive: 1 });
jobSchema.index({ title: 'text', company: 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
