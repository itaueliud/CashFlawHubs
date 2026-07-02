const mongoose = require('mongoose');

const creatorUploadSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 50, index: true },
  description: { type: String, required: true, trim: true },

  uploadType: { type: String, required: true, enum: ['video', 'document'], default: 'video', index: true },

  category: {
    type: String,
    required: true,
    enum: [
      'books_documents', 'education_learning', 'business_finance', 'technology',
      'creative_design', 'professional_services', 'startups_innovation',
      'products_reviews', 'talent_entertainment', 'lifestyle', 'marketing_promotion',
      // Legacy values kept for backward compat with existing docs
      'services', 'talent_skills', 'businesses', 'apps_platforms', 'products', 'startups_projects',
    ],
    index: true,
  },
  subcategory: { type: String, default: '' },

  tier: {
    type: String,
    required: true,
    enum: ['normal', 'plus', 'featured', 'premium_spotlight', 'basic', 'standard', 'professional', 'premium', 'enterprise'],
  },
  tokenCostPaid: { type: Number, required: true },
  videoFilePath: { type: String, required: true, select: false },
  videoMimeType: { type: String, default: 'video/mp4' },
  videoFileName: { type: String },
  videoSizeBytes: { type: Number },
  videoStorageProvider: { type: String, enum: ['local', 'r2'], default: 'local' },
  videoStorageKey: { type: String },
  videoPublicUrl: { type: String },
  isPremium: { type: Boolean, default: false },
  pricing: {
    defaultUSD: { type: Number, default: 0, min: 0 },
    defaultTokens: { type: Number, default: 0, min: 0 },
    byCountry: { type: Map, of: Number, default: {} },
  },
  status: { type: String, enum: ['published', 'rejected', 'hidden'], default: 'published', index: true },
  views: { type: Number, default: 0 },
  unlocks: { type: Number, default: 0 },
  tokensEarned: { type: Number, default: 0 },
  usdEarned: { type: Number, default: 0 },
}, { timestamps: true });

creatorUploadSchema.index({ status: 1, category: 1, createdAt: -1 });
creatorUploadSchema.index({ status: 1, uploadType: 1, createdAt: -1 });
creatorUploadSchema.index({ creatorId: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorUpload', creatorUploadSchema);
