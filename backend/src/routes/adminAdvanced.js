const express = require('express');
const router = express.Router();
const { protect, staffOnly, ledgerOrSuperadminOnly, adminOnly } = require('../middleware/auth');
const { Task } = require('../models/Task');
const Job = require('../models/Job');
const { Challenge } = require('../models/Challenge');
const { Gig } = require('../models/Freelance');
const Transaction = require('../models/Transaction');
const SupportTicket = require('../models/SupportTicket');
const AuditLog = require('../models/AuditLog');
const SystemConfig = require('../models/SystemConfig');
const ModerationRecord = require('../models/ModerationRecord');
const ReconciliationBatch = require('../models/ReconciliationBatch');
const { logAudit } = require('../utils/audit');

const MODEL_BY_TYPE = {
  task: Task,
  job: Job,
  challenge: Challenge,
  gig: Gig,
};

const buildModerationItems = async ({ type = 'all', search = '' }) => {
  const selectedTypes = type === 'all' ? Object.keys(MODEL_BY_TYPE) : [type].filter((t) => MODEL_BY_TYPE[t]);
  const all = [];

  for (const entityType of selectedTypes) {
    const Model = MODEL_BY_TYPE[entityType];
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const rows = await Model.find(query).sort({ createdAt: -1 }).limit(100);
    rows.forEach((item) => {
      all.push({
        _id: item._id,
        entityType,
        title: item.title || item.name || `${entityType} item`,
        description: item.description || '',
        status: item.isActive ? 'approved' : 'rejected',
        isActive: !!item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    });
  }

  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return all;
};

router.get('/moderation/items', protect, staffOnly, async (req, res) => {
  const { type = 'all', status = 'all', search = '' } = req.query;
  let items = await buildModerationItems({ type: String(type), search: String(search || '') });

  if (status !== 'all') {
    items = items.filter((item) => item.status === status);
  }

  res.json({ success: true, items });
});

router.put('/moderation/:entityType/:id', protect, staffOnly, async (req, res) => {
  const { entityType, id } = req.params;
  const { action, reason = '' } = req.body;

  if (!['approved', 'rejected', 'flagged'].includes(String(action))) {
    return res.status(400).json({ success: false, message: 'Invalid moderation action' });
  }

  const Model = MODEL_BY_TYPE[entityType];
  if (!Model) return res.status(400).json({ success: false, message: 'Unsupported entity type' });

  const target = await Model.findById(id);
  if (!target) return res.status(404).json({ success: false, message: 'Content not found' });

  if (action === 'approved') target.isActive = true;
  if (action === 'rejected') target.isActive = false;
  if (action !== 'flagged') await target.save();

  await ModerationRecord.create({
    entityType,
    entityId: target._id,
    action,
    reason: String(reason || ''),
    reviewedBy: req.user._id,
  });

  await logAudit({
    req,
    actor: req.user,
    module: 'moderation',
    action: `content_${action}`,
    targetType: entityType,
    targetId: target._id,
    metadata: { reason },
  });

  res.json({ success: true, item: target });
});

router.get('/support/tickets', protect, staffOnly, async (req, res) => {
  const { status = 'all', priority = 'all', search = '' } = req.query;
  const query = {};
  if (status !== 'all') query.status = status;
  if (priority !== 'all') query.priority = priority;
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const tickets = await SupportTicket.find(query)
    .populate('requesterId', 'name email phone userId role')
    .populate('assignedTo', 'name email role')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json({ success: true, tickets });
});

router.post('/support/tickets', protect, adminOnly, async (req, res) => {
  const { requesterId, subject, description, category = 'other', priority = 'normal' } = req.body;
  if (!requesterId || !subject || !description) {
    return res.status(400).json({ success: false, message: 'requesterId, subject, description are required' });
  }

  const ticket = await SupportTicket.create({
    requesterId,
    requesterRole: 'user',
    subject,
    description,
    category,
    priority,
    status: 'open',
  });

  await logAudit({
    req,
    actor: req.user,
    module: 'support',
    action: 'ticket_created',
    targetType: 'ticket',
    targetId: ticket._id,
    metadata: { category, priority },
  });

  res.status(201).json({ success: true, ticket });
});

router.put('/support/tickets/:id', protect, staffOnly, async (req, res) => {
  const { status, priority, assignedTo, note } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  if (assignedTo !== undefined) ticket.assignedTo = assignedTo || null;
  if (note) {
    ticket.notes.push({
      body: String(note),
      by: req.user._id,
      role: req.user.role,
    });
  }
  await ticket.save();

  await logAudit({
    req,
    actor: req.user,
    module: 'support',
    action: 'ticket_updated',
    targetType: 'ticket',
    targetId: ticket._id,
    metadata: { status, priority, assignedTo: assignedTo || null, hasNote: !!note },
  });

  res.json({ success: true, ticket });
});

router.get('/audit/logs', protect, staffOnly, async (req, res) => {
  const { module = 'all', actorId = '', limit = 100 } = req.query;
  const query = {};
  if (module !== 'all') query.module = module;
  if (actorId) query.actorId = actorId;

  const logs = await AuditLog.find(query)
    .populate('actorId', 'name email role userId')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 500));

  res.json({ success: true, logs });
});

router.get('/config/toggles', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const settings = await SystemConfig.find({}).sort({ key: 1 });
  res.json({ success: true, settings });
});

router.put('/config/toggles/:key', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { value, description = '' } = req.body;
  const { key } = req.params;

  const setting = await SystemConfig.findOneAndUpdate(
    { key },
    { value, description, updatedBy: req.user._id },
    { new: true, upsert: true }
  );

  await logAudit({
    req,
    actor: req.user,
    module: 'config',
    action: 'toggle_updated',
    targetType: 'config',
    targetId: key,
    metadata: { value, description },
  });

  res.json({ success: true, setting });
});

router.post('/reconciliation/import', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { source = 'manual', entries = [] } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: 'entries array is required' });
  }

  const normalized = [];
  let matched = 0;
  let mismatchedAmount = 0;

  for (const row of entries) {
    const reference = String(row.reference || '').trim();
    if (!reference) continue;

    const tx = await Transaction.findOne({
      $or: [{ reference }, { _id: reference }],
    });

    const entryAmount = Number(row.amountUSD || 0);
    const txAmount = Number(tx?.amountUSD || 0);
    const amountMismatch = tx ? Math.abs(entryAmount - txAmount) > 0.0001 : false;
    if (amountMismatch) mismatchedAmount += 1;

    if (tx) matched += 1;
    normalized.push({
      reference,
      provider: String(row.provider || ''),
      amountUSD: entryAmount,
      status: String(row.status || ''),
      matched: !!tx,
      matchedTransactionId: tx?._id || null,
      notes: amountMismatch ? `Amount mismatch: expected ${txAmount}, got ${entryAmount}` : '',
    });
  }

  const batch = await ReconciliationBatch.create({
    importedBy: req.user._id,
    source,
    entries: normalized,
    summary: {
      total: normalized.length,
      matched,
      unmatched: normalized.length - matched,
      mismatchedAmount,
    },
  });

  await logAudit({
    req,
    actor: req.user,
    module: 'reconciliation',
    action: 'import_created',
    targetType: 'reconciliation_batch',
    targetId: batch._id,
    metadata: batch.summary,
  });

  res.status(201).json({ success: true, batch });
});

router.get('/reconciliation/batches', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const batches = await ReconciliationBatch.find({})
    .populate('importedBy', 'name email role userId')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, batches });
});

router.get('/reconciliation/batches/:id', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const batch = await ReconciliationBatch.findById(req.params.id).populate('importedBy', 'name email role userId');
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
  res.json({ success: true, batch });
});

module.exports = router;
