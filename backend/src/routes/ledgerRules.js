const express = require('express');
const router = express.Router();
const { protect, ledgerOrSuperadminOnly } = require('../middleware/auth');
const PayoutRule = require('../models/PayoutRule');

router.get('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const rules = await PayoutRule.find({}).sort({ priority: -1, createdAt: -1 }).populate('createdBy', 'name email role userId').populate('updatedBy', 'name email role userId');
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const {
      name,
      country = 'ALL',
      provider,
      minAmountUSD = 0,
      maxAmountUSD = null,
      priority = 0,
      active = true,
      notes = '',
    } = req.body || {};

    if (!name || !provider) {
      return res.status(400).json({ success: false, message: 'name and provider are required' });
    }

    const rule = await PayoutRule.create({
      name: String(name).trim(),
      country: String(country || 'ALL').trim().toUpperCase(),
      provider: String(provider).trim(),
      minAmountUSD: Number(minAmountUSD) || 0,
      maxAmountUSD: maxAmountUSD === null || maxAmountUSD === '' ? null : Number(maxAmountUSD),
      priority: Number(priority) || 0,
      active: Boolean(active),
      notes: String(notes || ''),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const rule = await PayoutRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    const fields = ['name', 'country', 'provider', 'minAmountUSD', 'maxAmountUSD', 'priority', 'active', 'notes'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        rule[field] = field === 'country'
          ? String(req.body[field] || 'ALL').trim().toUpperCase()
          : field === 'active'
            ? Boolean(req.body[field])
            : field === 'name' || field === 'provider' || field === 'notes'
              ? String(req.body[field] || '').trim()
              : req.body[field];
      }
    });

    if (req.body.minAmountUSD !== undefined) rule.minAmountUSD = Number(req.body.minAmountUSD) || 0;
    if (req.body.maxAmountUSD !== undefined) {
      rule.maxAmountUSD = req.body.maxAmountUSD === null || req.body.maxAmountUSD === '' ? null : Number(req.body.maxAmountUSD);
    }
    if (req.body.priority !== undefined) rule.priority = Number(req.body.priority) || 0;
    rule.updatedBy = req.user._id;
    await rule.save();

    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const rule = await PayoutRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
