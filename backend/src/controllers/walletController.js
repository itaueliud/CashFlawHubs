const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { COUNTRIES } = require('../config/countries');
const { getCurrencyRate } = require('../services/exchangeService');
const { TOKEN_PACKAGES, getTokenPackageByTokens } = require('../config/tokenPackages');
const logger = require('../utils/logger');

const XP_REDEMPTION_BLOCK = 20000;
const XP_REDEMPTION_LOCAL_KES = 1000;

const getEatDate = () => new Date(Date.now() + (3 * 60 * 60 * 1000));

const isFriday = () => getEatDate().getUTCDay() === 5;
const isFridayOnlyWithdrawalEnabled = () => String(process.env.WITHDRAWALS_FRIDAY_ONLY || 'false').toLowerCase() === 'true';
const isWithdrawalWindowOpen = () => !isFridayOnlyWithdrawalEnabled() || isFriday();

const nextFridayDate = () => {
  const now = getEatDate();
  const day = now.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilFriday);

  return next.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

// @GET /api/wallet
exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const user = req.user;
    const countryConfig = COUNTRIES[user.country];
    const rate = await getCurrencyRate(countryConfig.currency);
    const friday = isFriday();
    const withdrawalOpen = isWithdrawalWindowOpen();

    res.json({
      success: true,
      wallet: {
        balanceUSD: wallet.balanceUSD,
        balanceLocal: (wallet.balanceUSD * rate).toFixed(2),
        pendingBalanceUSD: wallet.pendingBalance,
        pendingBalanceLocal: (wallet.pendingBalance * rate).toFixed(2),
        currency: countryConfig.currency,
        symbol: countryConfig.symbol,
        tokenBalance: wallet.tokenBalance || 0,
        totalTokensPurchased: wallet.totalTokensPurchased || 0,
        tokenPackages: TOKEN_PACKAGES,
        totalEarned: wallet.totalEarned,
        totalEarnedLocal: Number((wallet.totalEarned * rate).toFixed(2)),
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        breakdown: {
          surveys: wallet.surveyEarnings,
          tasks: wallet.taskEarnings,
          offers: wallet.offerEarnings,
          referrals: wallet.referralEarnings,
          freelance: wallet.freelanceEarnings,
          challenges: wallet.challengeEarnings,
          xp: wallet.xpEarnings,
        },
        xpRedeemable: Math.floor((req.user.xpPoints || 0) / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_BLOCK,
        xpCashLocal: Math.floor((req.user.xpPoints || 0) / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_LOCAL_KES,
        xpCashUSD: Number((((Math.floor((req.user.xpPoints || 0) / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_LOCAL_KES) / rate)).toFixed(4)),
        xpPerBlockLocal: XP_REDEMPTION_LOCAL_KES,
        withdrawalOpen,
        nextPayoutDate: withdrawalOpen
          ? (friday ? 'Today. Friday payouts are running now.' : 'Open now')
          : `Next Friday - ${nextFridayDate()}`,
        payoutNote: isFridayOnlyWithdrawalEnabled()
          ? 'Referral rewards still settle in the Friday batch. Direct wallet withdrawals now route through the country payout provider with fallback where configured.'
          : 'Withdrawals are open daily and route through the country payout provider with fallback where configured.',
      },
    });
  } catch (error) {
    logger.error(`getWallet error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/wallet/xp/redeem
exports.redeemXp = async (req, res) => {
  try {
    const requestedXp = Number(req.body?.xpPoints || 0);
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const redeemableXp = Math.floor((user.xpPoints || 0) / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_BLOCK;
    if (redeemableXp < XP_REDEMPTION_BLOCK) {
      return res.status(400).json({
        success: false,
        message: `You need at least ${XP_REDEMPTION_BLOCK.toLocaleString()} XP to redeem cash.`,
      });
    }

    const xpToRedeem = requestedXp > 0
      ? Math.floor(requestedXp / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_BLOCK
      : redeemableXp;

    if (xpToRedeem <= 0) {
      return res.status(400).json({
        success: false,
        message: `Redeem in blocks of ${XP_REDEMPTION_BLOCK.toLocaleString()} XP.`,
      });
    }

    if (xpToRedeem > redeemableXp) {
      return res.status(400).json({
        success: false,
        message: 'Not enough XP available to redeem that amount.',
      });
    }

    const blocks = xpToRedeem / XP_REDEMPTION_BLOCK;
    const amountLocal = blocks * XP_REDEMPTION_LOCAL_KES;
    const rate = await getCurrencyRate('KES');
    const amountUSD = Number((amountLocal / rate).toFixed(4));

    user.xpPoints = Math.max((user.xpPoints || 0) - xpToRedeem, 0);
    user.checkLevelUp();
    await user.save();

    await wallet.credit(amountUSD, 'xp');

    await Transaction.create({
      userId: user._id,
      type: 'xp_redemption',
      amountLocal,
      amountUSD,
      currency: 'KES',
      country: user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        xpRedeemed: xpToRedeem,
        xpBlockSize: XP_REDEMPTION_BLOCK,
        kesValuePerBlock: XP_REDEMPTION_LOCAL_KES,
      },
    });

    return res.json({
      success: true,
      message: `Redeemed ${xpToRedeem.toLocaleString()} XP for KSh ${amountLocal.toLocaleString()}.`,
      xpRedeemed: xpToRedeem,
      amountLocal,
      amountUSD,
      xpPoints: user.xpPoints,
      balanceUSD: wallet.balanceUSD,
    });
  } catch (error) {
    logger.error(`redeemXp error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/wallet/token-packages
exports.getTokenPackages = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const countryConfig = COUNTRIES[user.country];
    const rate = await getCurrencyRate(countryConfig.currency);
    const kesRate = await getCurrencyRate('KES');

    const packages = TOKEN_PACKAGES.map((pkg) => {
      const amountUSD = Number((pkg.amountKES / kesRate).toFixed(4));
      const amountLocal = Number((amountUSD * rate).toFixed(2));
      return {
        tokens: pkg.tokens,
        amountKES: pkg.amountKES,
        amountUSD,
        amountLocal,
        currency: countryConfig.currency,
        symbol: countryConfig.symbol,
        label: `${countryConfig.symbol}${amountLocal.toLocaleString()}`,
      };
    });

    res.json({
      success: true,
      currency: countryConfig.currency,
      symbol: countryConfig.symbol,
      packages,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/wallet/tokens/purchase
exports.purchaseTokens = async (req, res) => {
  try {
    const { packageTokens } = req.body;
    const selectedPackage = getTokenPackageByTokens(packageTokens);

    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token package selected',
      });
    }

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const kesRate = await getCurrencyRate('KES');
    const amountUSD = Number((selectedPackage.amountKES / kesRate).toFixed(4));

    if (wallet.balanceUSD < amountUSD) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. You need about $${amountUSD.toFixed(2)} for this package.`,
      });
    }

    wallet.balanceUSD = Number((wallet.balanceUSD - amountUSD).toFixed(4));
    wallet.tokenBalance += selectedPackage.tokens;
    wallet.totalTokensPurchased += selectedPackage.tokens;
    await wallet.save();

    await Transaction.create({
      userId: req.user.id,
      type: 'token_purchase',
      amountLocal: selectedPackage.amountKES,
      amountUSD,
      currency: 'KES',
      country: req.user.country,
      provider: 'internal',
      direction: 'debit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        packageTokens: selectedPackage.tokens,
        packageAmountKES: selectedPackage.amountKES,
      },
    });

    return res.json({
      success: true,
      message: `${selectedPackage.tokens} tokens purchased successfully`,
      tokenBalance: wallet.tokenBalance,
      balanceUSD: wallet.balanceUSD,
    });
  } catch (error) {
    logger.error(`purchaseTokens error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/wallet/transactions
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    if (type) query.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
