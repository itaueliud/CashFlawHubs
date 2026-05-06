const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterRole: { type: String, default: 'user' },
  subject: { type: String, required: true, trim: true },
  category: { type: String, enum: ['account', 'payment', 'wallet', 'content', 'security', 'other'], default: 'other' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  description: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: [{
    body: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ requesterId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
