const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    jobApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    deliveryType: { type: String, enum: ['webhook', 'email'], default: 'webhook' },
    webhookUrl: { type: String, default: null },
    emailAddress: { type: String, default: null },
    payload: { type: Object, required: true },
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'processing', 'delivered', 'failed'], default: 'pending' },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, default: null },
    responseStatus: { type: Number, default: null },
    responseBody: { type: Object, default: null },
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
