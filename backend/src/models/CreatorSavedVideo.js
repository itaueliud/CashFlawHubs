const mongoose = require('mongoose');

const creatorSavedVideoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorUpload', required: true },
  savedAt: { type: Date, default: Date.now },
}, { timestamps: true });

creatorSavedVideoSchema.index({ userId: 1, uploadId: 1 }, { unique: true });

module.exports = mongoose.model('CreatorSavedVideo', creatorSavedVideoSchema);
