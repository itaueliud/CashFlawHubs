const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['design', 'writing', 'marketing', 'programming', 'video', 'social_media', 'va', 'data_entry', 'other'],
    required: true,
  },
  priceUSD: { type: Number, required: true, min: 1 },
  deliveryDays: { type: Number, required: true, min: 1 },
  tags: [{ type: String }],
  images: [{ type: String }],
  isActive: { type: Boolean, default: true },
  applicationTokenCost: { type: Number, default: 10, min: 0 },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
}, { timestamps: true });

const gigOrderSchema = new mongoose.Schema({
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountUSD: { type: Number, required: true },
  platformFeeUSD: { type: Number, required: true }, // 10% platform cut
  sellerAmountUSD: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'delivered', 'completed', 'disputed', 'cancelled'],
    default: 'pending',
  },
  requirements: { type: String, default: null },
  deliverables: { type: String, default: null },
  dueDate: { type: Date },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

gigSchema.index({ category: 1 });
gigSchema.index({ sellerId: 1 });
gigSchema.index({ title: 'text', description: 'text' });

const Gig = mongoose.model('Gig', gigSchema);
const GigOrder = mongoose.model('GigOrder', gigOrderSchema);

module.exports = { Gig, GigOrder };
