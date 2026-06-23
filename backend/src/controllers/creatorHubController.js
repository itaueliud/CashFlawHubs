const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const CreatorUpload = require('../models/CreatorUpload');
const CreatorPurchase = require('../models/CreatorPurchase');
const CreatorSavedVideo = require('../models/CreatorSavedVideo');
const { getCurrencyRate } = require('../services/exchangeService');
const { COUNTRIES } = require('../config/countries');
const {
  CREATOR_HUB_CATEGORIES,
  CREATOR_HUB_TIERS,
  CREATOR_HUB_TITLE_MAX_CHARS,
  CREATOR_HUB_PLATFORM_FEE_PERCENT,
  KES_PER_TOKEN,
  DEFAULT_PREMIUM_PRICE_BY_COUNTRY,
  FALLBACK_PREMIUM_PRICE,
} = require('../config/creatorHubConfig');

ffmpeg.setFfprobePath(ffprobePath);

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    // noop
  }
};

const getVideoDurationSeconds = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`Could not read video metadata: ${err.message}`));
      const duration = metadata?.format?.duration;
      if (typeof duration !== 'number' || Number.isNaN(duration)) {
        return reject(new Error('Video duration could not be determined'));
      }
      resolve(duration);
    });
  });

const resolvePrice = (upload, countryCode) => {
  if (!upload.isPremium) return 0;
  const byCountry = upload.pricing?.byCountry;
  if (byCountry) {
    if (typeof byCountry.get === 'function' && byCountry.has(countryCode)) return byCountry.get(countryCode);
    if (byCountry[countryCode] !== undefined) return byCountry[countryCode];
  }
  return upload.pricing?.defaultTokens || DEFAULT_PREMIUM_PRICE_BY_COUNTRY[countryCode] || FALLBACK_PREMIUM_PRICE;
};

const calculateUnlockUsd = async (tokenAmount) => {
  const kesRate = await getCurrencyRate('KES');
  const grossUsd = ((Number(tokenAmount) || 0) * KES_PER_TOKEN) / kesRate;
  const netUsd = grossUsd * (1 - CREATOR_HUB_PLATFORM_FEE_PERCENT);
  return Number(netUsd.toFixed(4));
};

const serializeUpload = (doc, viewer, unlockedSet, savedSet) => {
  const creatorIdStr = String(doc.creatorId?._id || doc.creatorId);
  const isOwner = creatorIdStr === String(viewer.id);
  const unlocked = isOwner || unlockedSet.has(doc._id.toString());
  return {
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    tier: doc.tier,
    badge: CREATOR_HUB_TIERS[doc.tier]?.badge,
    isPremium: doc.isPremium,
    priceTokens: doc.isPremium ? resolvePrice(doc, viewer.country) : 0,
    isLocked: doc.isPremium && !unlocked,
    isOwner,
    isSaved: savedSet ? savedSet.has(doc._id.toString()) : false,
    streamUrl: `/api/creator-hub/uploads/${doc._id}/stream`,
    contact: doc.contact,
    creator: doc.creatorId?.name ? { _id: creatorIdStr, name: doc.creatorId.name, country: doc.creatorId.country } : undefined,
    views: doc.views,
    unlocks: doc.unlocks,
    createdAt: doc.createdAt,
  };
};

const parseCountryPrices = (countryPrices) => {
  let parsedCountryPrices = {};
  try {
    parsedCountryPrices = countryPrices ? JSON.parse(countryPrices) : {};
  } catch {
    parsedCountryPrices = {};
  }

  const cleanCountryPrices = {};
  Object.entries(parsedCountryPrices).forEach(([code, value]) => {
    const n = Number(value);
    if (COUNTRIES[code] && n > 0) cleanCountryPrices[code] = n;
  });
  return cleanCountryPrices;
};

const respondInsufficientTokens = (res, shortBy) =>
  res.status(402).json({
    success: false,
    message: `you need ${shortBy} more Tokens`,
    shortBy,
  });

exports.getMeta = async (req, res) => {
  res.json({
    success: true,
    categories: CREATOR_HUB_CATEGORIES,
    tiers: CREATOR_HUB_TIERS,
    titleMaxChars: CREATOR_HUB_TITLE_MAX_CHARS,
    countries: COUNTRIES,
    defaultPremiumPriceByCountry: DEFAULT_PREMIUM_PRICE_BY_COUNTRY,
    fallbackPremiumPrice: FALLBACK_PREMIUM_PRICE,
    tokenBalance: req.user.tokenBalance || 0,
    platformFeePercent: CREATOR_HUB_PLATFORM_FEE_PERCENT,
  });
};

exports.listUploads = async (req, res) => {
  try {
    const { category, tier, search, page = 1, limit = 20 } = req.query;
    const query = { status: 'published' };
    if (category) query.category = category;
    if (tier) query.tier = tier;
    if (search) query.title = { $regex: String(search).trim().slice(0, 50), $options: 'i' };

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 48);
    const skip = (pageNumber - 1) * pageSize;

    const [items, total] = await Promise.all([
      CreatorUpload.find(query)
        .populate('creatorId', 'name country level badges')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      CreatorUpload.countDocuments(query),
    ]);

    const uploadIds = items.map((i) => i._id);
    const [myUnlocks, mySaves] = await Promise.all([
      CreatorPurchase.find({ userId: req.user.id, uploadId: { $in: uploadIds } }).select('uploadId'),
      CreatorSavedVideo.find({ userId: req.user.id, uploadId: { $in: uploadIds } }).select('uploadId'),
    ]);
    const unlockedSet = new Set(myUnlocks.map((u) => u.uploadId.toString()));
    const savedSet = new Set(mySaves.map((s) => s.uploadId.toString()));

    res.json({
      success: true,
      uploads: items.map((doc) => serializeUpload(doc, req.user, unlockedSet, savedSet)),
      pagination: { total, page: pageNumber, pages: Math.max(1, Math.ceil(total / pageSize)) },
      categories: CREATOR_HUB_CATEGORIES,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUploadById = async (req, res) => {
  try {
    const doc = await CreatorUpload.findById(req.params.id).populate('creatorId', 'name country level badges');
    if (!doc || doc.status !== 'published') return res.status(404).json({ success: false, message: 'Not found' });

    const isOwner = String(doc.creatorId?._id || doc.creatorId) === String(req.user.id);
    const unlocked = isOwner || !!(await CreatorPurchase.findOne({ userId: req.user.id, uploadId: doc._id }));
    const saved = !!(await CreatorSavedVideo.findOne({ userId: req.user.id, uploadId: doc._id }));

    res.json({
      success: true,
      upload: serializeUpload(
        doc,
        req.user,
        new Set(unlocked ? [doc._id.toString()] : []),
        new Set(saved ? [doc._id.toString()] : []),
      ),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.myUploads = async (req, res) => {
  try {
    const items = await CreatorUpload.find({ creatorId: req.user.id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      uploads: items.map((doc) => ({
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        tier: doc.tier,
        badge: CREATOR_HUB_TIERS[doc.tier]?.badge,
        isPremium: doc.isPremium,
        pricing: doc.isPremium
          ? { defaultTokens: doc.pricing.defaultTokens, byCountry: Object.fromEntries(doc.pricing.byCountry || new Map()) }
          : null,
        contact: doc.contact,
        status: doc.status,
        views: doc.views,
        unlocks: doc.unlocks,
        tokensEarned: doc.tokensEarned,
        usdEarned: doc.usdEarned,
        streamUrl: `/api/creator-hub/uploads/${doc._id}/stream`,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listSavedUploads = async (req, res) => {
  try {
    const saves = await CreatorSavedVideo.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const ids = saves.map((s) => s.uploadId);
    if (!ids.length) return res.json({ success: true, uploads: [] });

    const [docs, unlocks] = await Promise.all([
      CreatorUpload.find({ _id: { $in: ids }, status: 'published' }).populate('creatorId', 'name country'),
      CreatorPurchase.find({ userId: req.user.id, uploadId: { $in: ids } }).select('uploadId'),
    ]);
    const unlockedSet = new Set(unlocks.map((u) => u.uploadId.toString()));
    const savedSet = new Set(ids.map(String));
    const order = ids.map(String);
    const sorted = docs.sort((a, b) => order.indexOf(a._id.toString()) - order.indexOf(b._id.toString()));

    res.json({ success: true, uploads: sorted.map((doc) => serializeUpload(doc, req.user, unlockedSet, savedSet)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveUpload = async (req, res) => {
  try {
    const upload = await CreatorUpload.findById(req.params.id);
    if (!upload || upload.status !== 'published') return res.status(404).json({ success: false, message: 'Not found' });

    const isOwner = String(upload.creatorId) === String(req.user.id);
    if (upload.isPremium && !isOwner) {
      const unlocked = await CreatorPurchase.findOne({ userId: req.user.id, uploadId: upload._id });
      if (!unlocked) {
        return res.status(402).json({
          success: false,
          message: 'This is a premium video. Unlock it before saving it to your list.',
          locked: true,
          priceTokens: resolvePrice(upload, req.user.country),
        });
      }
    }

    await CreatorSavedVideo.findOneAndUpdate(
      { userId: req.user.id, uploadId: upload._id },
      { $setOnInsert: { savedAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    res.json({ success: true, saved: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unsaveUpload = async (req, res) => {
  try {
    await CreatorSavedVideo.deleteOne({ userId: req.user.id, uploadId: req.params.id });
    res.json({ success: true, saved: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createUpload = async (req, res) => {
  const session = await User.db.startSession();
  try {
    const { title, description, category, tier, isPremium, defaultPriceTokens, countryPrices, phone, email, whatsapp, website } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'A video file is required' });

    const tierConfig = CREATOR_HUB_TIERS[tier];
    if (!tierConfig) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid package selected' });
    }
    if (!CREATOR_HUB_CATEGORIES.some((c) => c.value === category)) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (cleanTitle.length > CREATOR_HUB_TITLE_MAX_CHARS) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: `Title must be ${CREATOR_HUB_TITLE_MAX_CHARS} characters or fewer` });
    }

    if (req.file.size > tierConfig.maxSizeMB * 1024 * 1024) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: `${tierConfig.label} allows files up to ${tierConfig.maxSizeMB}MB. Choose a higher package for a bigger file.` });
    }

    let videoDurationSec;
    try {
      videoDurationSec = await getVideoDurationSeconds(req.file.path);
    } catch (probeErr) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Could not read video file. Make sure it is a valid MP4, MOV, WEBM, or MKV.' });
    }

    if (videoDurationSec > tierConfig.maxDurationSec) {
      safeUnlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Your video is ${Math.ceil(videoDurationSec)}s long. ${tierConfig.label} allows up to ${tierConfig.maxDurationSec}s. Trim it or choose a higher package.`,
        videoDurationSec: Math.ceil(videoDurationSec),
        maxAllowedSec: tierConfig.maxDurationSec,
      });
    }

    const cleanDescription = String(description || '').trim();
    if (cleanDescription.length > tierConfig.maxDescriptionChars) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: `Description exceeds the ${tierConfig.maxDescriptionChars}-character limit for ${tierConfig.label}.` });
    }

    const premiumFlag = String(isPremium) === 'true' || isPremium === true;
    const pricing = premiumFlag
      ? {
          defaultTokens: Math.max(Number(defaultPriceTokens) || FALLBACK_PREMIUM_PRICE, 1),
          byCountry: parseCountryPrices(countryPrices),
        }
      : { defaultTokens: 0, byCountry: {} };

    session.startTransaction();

    const creator = await User.findOneAndUpdate(
      { _id: req.user.id, tokenBalance: { $gte: tierConfig.tokenCost } },
      { $inc: { tokenBalance: -tierConfig.tokenCost, totalTokensSpent: tierConfig.tokenCost } },
      { new: true, session },
    );

    if (!creator) {
      await session.abortTransaction();
      session.endSession();
      safeUnlink(req.file.path);
      const currentUser = await User.findById(req.user.id).select('tokenBalance');
      const shortBy = Math.max(tierConfig.tokenCost - Number(currentUser?.tokenBalance || 0), 1);
      return respondInsufficientTokens(res, shortBy);
    }

    const uploadDoc = await CreatorUpload.create([{
      creatorId: creator._id,
      title: cleanTitle,
      description: cleanDescription,
      category,
      tier,
      tokenCostPaid: tierConfig.tokenCost,
      videoFilePath: req.file.path,
      videoMimeType: req.file.mimetype || 'video/mp4',
      videoFileName: req.file.originalname || path.basename(req.file.path),
      videoSizeBytes: req.file.size,
      contact: {
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        whatsapp: String(whatsapp || '').trim(),
        website: String(website || '').trim(),
      },
      isPremium: premiumFlag,
      pricing,
      status: 'published',
    }], { session });

    await Transaction.create([{
      userId: creator._id,
      type: 'creator_hub_upload',
      amountLocal: tierConfig.tokenCost,
      amountUSD: 0,
      currency: 'TOKEN',
      country: creator.country,
      provider: 'internal',
      direction: 'debit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        creatorUploadId: uploadDoc[0]._id.toString(),
        tier,
        category,
        tokenCost: tierConfig.tokenCost,
      },
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const refreshedUser = await User.findById(creator._id).select('tokenBalance totalTokensSpent');
    return res.status(201).json({
      success: true,
      message: 'Upload published successfully',
      upload: {
        _id: uploadDoc[0]._id,
        title: uploadDoc[0].title,
        tier: uploadDoc[0].tier,
      },
      tokenBalance: refreshedUser?.tokenBalance ?? creator.tokenBalance,
    });
  } catch (error) {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch (_) {
      // noop
    }
    session.endSession();
    safeUnlink(req.file?.path);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.unlockUploadWithWallet = async (req, res) => {
  const session = await User.db.startSession();
  try {
    const upload = await CreatorUpload.findById(req.params.id).populate('creatorId', 'name country');
    if (!upload || upload.status !== 'published') return res.status(404).json({ success: false, message: 'Not found' });

    const isOwner = String(upload.creatorId?._id || upload.creatorId) === String(req.user.id);
    if (isOwner) {
      return res.json({ success: true, unlocked: true, alreadyUnlocked: true });
    }

    const unlocked = await CreatorPurchase.findOne({ userId: req.user.id, uploadId: upload._id });
    if (unlocked) {
      return res.json({ success: true, unlocked: true, alreadyUnlocked: true });
    }

    const priceTokens = resolvePrice(upload, req.user.country);

    session.startTransaction();
    const viewer = await User.findOneAndUpdate(
      { _id: req.user.id, tokenBalance: { $gte: priceTokens } },
      { $inc: { tokenBalance: -priceTokens, totalTokensSpent: priceTokens } },
      { new: true, session },
    );

    if (!viewer) {
      await session.abortTransaction();
      session.endSession();
      const currentUser = await User.findById(req.user.id).select('tokenBalance');
      const shortBy = Math.max(priceTokens - Number(currentUser?.tokenBalance || 0), 1);
      return respondInsufficientTokens(res, shortBy);
    }

    const creatorId = upload.creatorId?._id || upload.creatorId;
    const netUsd = await calculateUnlockUsd(priceTokens);

    await CreatorPurchase.create([{
      userId: viewer._id,
      uploadId: upload._id,
      tokenAmount: priceTokens,
      country: req.user.country,
      unlockedAt: new Date(),
    }], { session });

    await CreatorUpload.findByIdAndUpdate(upload._id, {
      $inc: {
        unlocks: 1,
        tokensEarned: priceTokens,
        usdEarned: netUsd,
      },
    }, { session });

    let creatorWallet = await Wallet.findOne({ userId: creatorId }).session(session);
    if (!creatorWallet) {
      creatorWallet = new Wallet({ userId: creatorId });
    }
    creatorWallet.balanceUSD += netUsd;
    creatorWallet.totalEarned += netUsd;
    creatorWallet.creatorHubEarnings += netUsd;
    await creatorWallet.save({ session });

    const creatorCountry = upload.creatorId?.country || req.user.country || 'KE';
    await Transaction.create([{
      userId: viewer._id,
      type: 'creator_hub_purchase',
      amountLocal: priceTokens,
      amountUSD: netUsd,
      currency: 'TOKEN',
      country: req.user.country,
      provider: 'internal',
      direction: 'debit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        uploadId: upload._id.toString(),
        creatorId: String(creatorId),
        method: 'wallet',
        priceTokens,
      },
    }, {
      userId: creatorId,
      type: 'creator_hub_earning',
      amountLocal: priceTokens,
      amountUSD: netUsd,
      currency: 'TOKEN',
      country: creatorCountry,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        uploadId: upload._id.toString(),
        purchaserId: viewer._id.toString(),
        platformFeePercent: CREATOR_HUB_PLATFORM_FEE_PERCENT,
        priceTokens,
      },
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const refreshedUser = await User.findById(viewer._id).select('tokenBalance totalTokensSpent');
    return res.json({
      success: true,
      unlocked: true,
      priceTokens,
      tokenBalance: refreshedUser?.tokenBalance ?? viewer.tokenBalance,
      usdEarned: netUsd,
    });
  } catch (error) {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch (_) {
      // noop
    }
    session.endSession();
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.streamUpload = async (req, res) => {
  try {
    const doc = await CreatorUpload.findById(req.params.id)
      .select('+videoFilePath +videoMimeType +videoFileName +videoSizeBytes creatorId isPremium pricing status title description category tier views unlocks tokensEarned usdEarned contact')
      .populate('creatorId', 'name country');

    if (!doc || doc.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const isOwner = String(doc.creatorId?._id || doc.creatorId) === String(req.user.id);
    const unlocked = isOwner || !!(await CreatorPurchase.findOne({ userId: req.user.id, uploadId: doc._id }));
    if (doc.isPremium && !unlocked) {
      return res.status(402).json({ success: false, message: 'Unlock this premium video before streaming it.', locked: true });
    }

    if (!doc.videoFilePath || !fs.existsSync(doc.videoFilePath)) {
      return res.status(404).json({ success: false, message: 'Video file unavailable' });
    }

    await CreatorUpload.findByIdAndUpdate(doc._id, { $inc: { views: 1 } });

    const stat = fs.statSync(doc.videoFilePath);
    const range = req.headers.range;
    const mimeType = doc.videoMimeType || 'video/mp4';
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(doc.videoFilePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      file.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(doc.videoFilePath).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUpload = async (req, res) => {
  try {
    const upload = await CreatorUpload.findOne({ _id: req.params.id, creatorId: req.user.id }).select('+videoFilePath');
    if (!upload) return res.status(404).json({ success: false, message: 'Not found' });

    const filePath = upload.videoFilePath;
    await Promise.all([
      CreatorPurchase.deleteMany({ uploadId: upload._id }),
      CreatorSavedVideo.deleteMany({ uploadId: upload._id }),
      CreatorUpload.deleteOne({ _id: upload._id }),
    ]);
    safeUnlink(filePath);

    res.json({ success: true, deleted: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

