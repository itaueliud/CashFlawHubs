const mongoose = require('mongoose');

const taskUnlockSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  tokenCost: { type: Number, required: true },
  unlockedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

taskUnlockSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model('TaskUnlock', taskUnlockSchema);
