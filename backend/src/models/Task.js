const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  externalId: { type: String, unique: true },
  source: { type: String, enum: ['microworkers', 'toloka', 'internal'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  rewardUSD: { type: Number, required: true },
  estimatedMinutes: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  externalUrl: { type: String, default: null },
}, { timestamps: true });

const taskCompletionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['submitted', 'approved', 'rejected'], default: 'submitted' },
  rewardPaid: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

taskCompletionSchema.index({ taskId: 1, userId: 1 }, { unique: true });

const Task = mongoose.model('Task', taskSchema);
const TaskCompletion = mongoose.model('TaskCompletion', taskCompletionSchema);

module.exports = { Task, TaskCompletion };
