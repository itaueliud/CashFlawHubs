const cron = require('node-cron');
const CpxTransaction = require('../models/CpxTransaction');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const logger = require('../utils/logger');

async function approveCpxTransaction(tx) {
  // Atomic — only moves forward if still pending
  const updated = await CpxTransaction.findOneAndUpdate(
    { _id: tx._id, status: 'pending' },
    { $set: { status: 'approved', approvedAt: new Date() } },
    { new: true }
  );
  if (!updated) return; // another worker instance already handled it

  // Move user earnings: pending → available
  await Wallet.findOneAndUpdate(
    { userId: tx.userId },
    {
      $inc: {
        pendingBalance:   -tx.userShareUSD,
        balanceUSD:        tx.userShareUSD, // Corrected from availableBalance to balanceUSD
        surveyEarnings:    tx.userShareUSD,
        totalEarned:       tx.userShareUSD,
      },
    },
    { upsert: true }
  );

  // Credit referrer commission
  if (tx.referrerId && tx.referralShareUSD > 0) {
    await Wallet.findOneAndUpdate(
      { userId: tx.referrerId },
      {
        $inc: {
          balanceUSD:       tx.referralShareUSD, // Corrected from availableBalance to balanceUSD
          referralEarnings: tx.referralShareUSD,
          totalEarned:      tx.referralShareUSD,
        },
      },
      { upsert: true }
    );
  }

  // Increment user surveysCompleted and XP points
  try {
    const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');
    await User.findByIdAndUpdate(tx.userId, {
      $inc: { xpPoints: 20, surveysCompleted: 1 }
    });
    await trackEvent(tx.userId, 'survey_complete').catch(() => {});
    await checkEarningMilestones(tx.userId).catch(() => {});
  } catch (err) {
    logger.error(`[CPX Worker] User stats update failed for user ${tx.userId}: ${err.message}`);
  }

  // Find user to obtain role for AuditLog validation
  let userRole = 'user';
  try {
    const userDoc = await User.findById(tx.userId).select('role');
    if (userDoc) {
      userRole = userDoc.role || 'user';
    }
  } catch (err) {}

  await AuditLog.create({
    actorId:  tx.userId,
    actorRole: userRole,
    module:   'cpx',
    action:   'cpx_approved',
    metadata: {
      cpxTransactionId: tx.cpxTransactionId,
      type:             tx.type,
      userShareUSD:     tx.userShareUSD,
      platformShareUSD: tx.platformShareUSD,
      referralShareUSD: tx.referralShareUSD,
    },
  }).catch((err) => {
    logger.error(`[CPX Worker] AuditLog creation failed: ${err.message}`);
  });

  logger.info(`[CPX Worker] Approved: trans=${tx.cpxTransactionId} user=$${tx.userShareUSD} referral=$${tx.referralShareUSD} platform=$${tx.platformShareUSD}`);
}

async function runCpxVerificationWorker() {
  const now = new Date();
  logger.info(`[CPX Worker] Running at ${now.toISOString()}`);

  try {
    const ready = await CpxTransaction.find({
      status:         'pending',
      availableAfter: { $lte: now },
    }).limit(500);

    logger.info(`[CPX Worker] ${ready.length} transactions ready`);

    let approved = 0;
    let errors   = 0;

    for (const tx of ready) {
      try {
        await approveCpxTransaction(tx);
        approved++;
      } catch (err) {
        errors++;
        logger.error(`[CPX Worker] Error on ${tx.cpxTransactionId}: ${err.message}`);
      }
    }

    logger.info(`[CPX Worker] Done — approved: ${approved}, errors: ${errors}`);
  } catch (err) {
    logger.error(`[CPX Worker] Fatal: ${err.message}`);
  }
}

function startCpxVerificationWorker() {
  logger.info('[CPX Worker] Scheduled — runs every hour');
  // Run once immediately on startup to clear any backlog
  runCpxVerificationWorker().catch((err) => logger.error(`[CPX Worker] Startup run failed: ${err.message}`));
  // Then every hour
  cron.schedule('0 * * * *', () => {
    runCpxVerificationWorker().catch((err) => logger.error(`[CPX Worker] Scheduled run failed: ${err.message}`));
  });
}

module.exports = { startCpxVerificationWorker, runCpxVerificationWorker };
