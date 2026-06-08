const crypto = require('crypto');
const CpxTransaction = require('../models/CpxTransaction');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// ── Revenue split config ─────────────────────────────────────────────────────
const SPLIT = {
  user:     () => parseFloat(process.env.CPX_USER_SHARE     || '0.60'),
  platform: () => parseFloat(process.env.CPX_PLATFORM_SHARE || '0.30'),
  referral: () => parseFloat(process.env.CPX_REFERRAL_SHARE || '0.10'),
};

// ── Hash verification ────────────────────────────────────────────────────────
// Support both CPX Research hash formulas
function verifyHash(params) {
  const key = process.env.CPX_HASH_KEY || '';
  if (!key) {
    logger.error('[CPX] CPX_HASH_KEY not set in environment');
    return false;
  }

  const { hash, trans_id, transaction_id, ext_user_id, user_id, amount_usd, amount } = params;
  const tId = trans_id || transaction_id || '';
  const uId = user_id || ext_user_id || '';
  const amt = amount_usd || amount || '';

  // Formula 1: md5( trans_id + "-" + CPX_HASH_KEY )
  const expected1 = crypto.createHash('md5').update(`${tId}-${key}`).digest('hex');
  if (expected1 === hash) return true;

  // Formula 2: md5( ext_user_id + "-" + transaction_id + "-" + amount + "-" + CPX_HASH_KEY )
  const expected2 = crypto.createHash('md5').update(`${uId}-${tId}-${amt}-${key}`).digest('hex');
  if (expected2 === hash) return true;

  return false;
}

// ── POST/GET /api/cpx/postback ───────────────────────────────────────────────
async function handlePostback(req, res) {
  // Respond 200 immediately — CPX retries if it waits too long
  res.status(200).send('OK');

  const params = { ...req.query, ...req.body };
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

  const trans_id = params.trans_id || params.transaction_id;
  const user_id = params.user_id || params.ext_user_id;
  const amount_usd = params.amount_usd || params.amount;
  const {
    status,
    offer_id,
    survey_id,
    hash,
    subid_1,
    subid_2,
    type,
    ip_click,
  } = params;

  try {
    // ── 1. Required fields check ─────────────────────────────────────────────
    if (!trans_id || !user_id || !amount_usd || !hash) {
      logger.warn(`[CPX] Missing required fields in postback: ${JSON.stringify(params)}`);
      return;
    }

    // ── 2. Hash verification — reject fakes ──────────────────────────────────
    if (!verifyHash(params)) {
      logger.warn(`[CPX] Invalid hash for trans_id=${trans_id} user=${user_id}`);
      return;
    }

    // ── 3. Find user ─────────────────────────────────────────────────────────
    const user = await User.findOne({ userId: user_id });
    if (!user) {
      logger.warn(`[CPX] User not found: ${user_id} for trans_id=${trans_id}`);
      return;
    }

    // ── 4. Reversal (status=2) ───────────────────────────────────────────────
    if (String(status) === '2') {
      await handleReversal(trans_id, user, ip);
      return;
    }

    // ── 5. Idempotency — ignore duplicate postbacks ──────────────────────────
    const existing = await CpxTransaction.findOne({ cpxTransactionId: trans_id });
    if (existing) {
      logger.info(`[CPX] Duplicate ignored: ${trans_id}`);
      return;
    }

    // ── 6. Parse amount ──────────────────────────────────────────────────────
    const grossUSD = parseFloat(amount_usd);
    if (isNaN(grossUSD) || grossUSD <= 0) return;

    // ── 7. Revenue split ─────────────────────────────────────────────────────
    const userShareUSD     = +(grossUSD * SPLIT.user()).toFixed(6);
    const platformShareUSD = +(grossUSD * SPLIT.platform()).toFixed(6);
    let   referralShareUSD = +(grossUSD * SPLIT.referral()).toFixed(6);

    // Find referrer
    let referrerId = null;
    if (user.referredBy) {
      const referrer = await User.findOne({ referralCode: user.referredBy }).select('_id');
      if (referrer) referrerId = referrer._id;
    }
    if (!referrerId) referralShareUSD = 0;

    // ── 8. Determine hold duration ───────────────────────────────────────────
    // screenouts and bonuses are small — hold 24h; completes hold 48h
    const eventType   = String(type || 'complete').toLowerCase();
    const holdHours   = eventType === 'complete' ? 48 : 24;
    const availableAfter = new Date(Date.now() + holdHours * 60 * 60 * 1000);

    // ── 9. Save transaction as PENDING ───────────────────────────────────────
    await CpxTransaction.create({
      userId:            user._id,
      cpxTransactionId:  trans_id,
      surveyId:          offer_id   || survey_id || null,
      subid1:            subid_1    || null,
      subid2:            subid_2    || null,
      type:              eventType,
      grossUSD,
      userShareUSD,
      platformShareUSD,
      referralShareUSD,
      referrerId,
      status:            'pending',
      availableAfter,
      ipAddress:         ip_click   || ip,
      rawParams:         params,
    });

    // ── 10. Add to pendingBalance ────────────────────────────────────────────
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $inc: { pendingBalance: userShareUSD } },
      { upsert: true }
    );

    // ── 11. Audit log ────────────────────────────────────────────────────────
    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role || 'user',
      module: 'cpx',
      action: `cpx_${eventType}_pending`,
      metadata: { trans_id, grossUSD, userShareUSD, platformShareUSD, referralShareUSD, holdHours },
      ipAddress: ip,
    }).catch((err) => {
      logger.error(`[CPX] AuditLog failed: ${err.message}`);
    });

    logger.info(`[CPX] ${eventType} PENDING: user=${user_id} trans=${trans_id} gross=$${grossUSD} user_share=$${userShareUSD} hold=${holdHours}h`);

  } catch (err) {
    logger.error(`[CPX] Postback error: ${err.message}`);
  }
}

// ── Reversal handler ─────────────────────────────────────────────────────────
async function handleReversal(transactionId, user, ip) {
  const tx = await CpxTransaction.findOne({ cpxTransactionId: transactionId });
  if (!tx || tx.status === 'reversed') return;

  const wasApproved = tx.status === 'approved';
  await CpxTransaction.findOneAndUpdate(
    { _id: tx._id },
    { $set: { status: 'reversed', reversedAt: new Date() } }
  );

  if (wasApproved) {
    // Use balanceUSD instead of availableBalance
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $inc: { balanceUSD: -tx.userShareUSD, surveyEarnings: -tx.userShareUSD, totalEarned: -tx.userShareUSD } }
    );
    if (tx.referrerId && tx.referralShareUSD > 0) {
      await Wallet.findOneAndUpdate(
        { userId: tx.referrerId },
        { $inc: { balanceUSD: -tx.referralShareUSD, referralEarnings: -tx.referralShareUSD, totalEarned: -tx.referralShareUSD } }
      );
    }
  } else {
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $inc: { pendingBalance: -tx.userShareUSD } }
    );
  }

  await AuditLog.create({
    actorId: user._id,
    actorRole: user.role || 'user',
    module: 'cpx',
    action: 'cpx_reversal',
    metadata: { transactionId, wasApproved, amount: tx.userShareUSD },
    ipAddress: ip,
  }).catch((err) => {
    logger.error(`[CPX] AuditLog reversal failed: ${err.message}`);
  });

  logger.info(`[CPX] Reversal: trans=${transactionId} wasApproved=${wasApproved}`);
}

// ── GET /api/cpx/iframe-params ───────────────────────────────────────────────
async function getIframeParams(req, res) {
  try {
    const user    = req.user;
    const appId   = process.env.CPX_APP_ID  || '33543';
    const hashKey = process.env.CPX_HASH_KEY || '';

    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    // CPX iframe secure_hash = md5( userId + "-" + hashKey )
    const secureHash = crypto
      .createHash('md5')
      .update(`${user.userId}-${hashKey}`)
      .digest('hex');

    const url = new URL('https://offers.cpx-research.com/index.php');
    url.searchParams.set('app_id',      appId);
    url.searchParams.set('ext_user_id', user.userId);
    url.searchParams.set('secure_hash', secureHash);
    url.searchParams.set('username',    user.name  || '');
    url.searchParams.set('email',       user.email || '');
    url.searchParams.set('subid_1',     user.country || '');
    url.searchParams.set('subid_2',     user.referralCode || '');

    return res.json({ success: true, iframeUrl: url.toString() });
  } catch (err) {
    logger.error(`[CPX] getIframeParams error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── GET /api/cpx/history ─────────────────────────────────────────────────────
async function getHistory(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const txs   = await CpxTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('cpxTransactionId surveyId type grossUSD userShareUSD status createdAt availableAfter');
    return res.json({ success: true, transactions: txs });
  } catch (err) {
    logger.error(`[CPX] getHistory error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { handlePostback, getIframeParams, getHistory };
