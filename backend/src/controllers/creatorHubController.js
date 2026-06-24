const fs = require('fs');
const path = require('path');

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

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    // noop
  }
};

const resolveCreatorHubVideoPath = (doc) => {
  const storedPath = doc?.videoFilePath || '';
  if (storedPath && fs.existsSync(storedPath)) return storedPath;

  const fileName = path.basename(storedPath || doc?.videoFileName || '');
  if (!fileName) return '';

  const configuredRoot = process.env.CREATOR_HUB_UPLOAD_ROOT;
  const defaultRoot = path.join(__dirname, '..', '..', 'uploads-private', 'creator-hub');
  const candidates = [
    configuredRoot ? path.join(configuredRoot, fileName) : '',
    path.join(defaultRoot, fileName),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return '';
};

const getVideoDurationSeconds = async () => null;

const resolvePremiumPriceUSD = (upload, countryCode) => {
  if (!upload.isPremium) return 0;
  const byCountry = upload.pricing?.byCountry;
  if (byCountry) {
    if (typeof byCountry.get === 'function' && byCountry.has(countryCode)) return Number(byCountry.get(countryCode)) || 0;
    if (byCountry[countryCode] !== undefined) return Number(byCountry[countryCode]) || 0;
  }
  return Number(upload.pricing?.defaultUSD || upload.pricing?.defaultTokens || DEFAULT_PREMIUM_PRICE_BY_COUNTRY[countryCode] || FALLBACK_PREMIUM_PRICE) || 0;
};
const normalizeCreatorHubTransactionType = (type) => {
  switch (String(type || '')) {
    case 'creator_hub_upload':
    case 'creator_hub_purchase':
      return 'token_spend';
    case 'creator_hub_earning':
      return 'manual_payment';
    default:
      return type;
  }
};

const createCreatorHubTransactions = async (docs) => {
  try {
    await Transaction.create(docs);
    return { success: true, fallbackUsed: false, warning: null };
  } catch (error) {
    const fallbackDocs = docs.map((doc) => ({
      ...doc,
      type: normalizeCreatorHubTransactionType(doc.type),
      metadata: {
        ...(doc.metadata || {}),
        originalType: doc.type,
      },
    }));

    try {
      await Transaction.create(fallbackDocs);
      return {
        success: true,
        fallbackUsed: true,
        warning: 'Audit log used a fallback transaction mapping, but your upload still completed successfully.',
      };
    } catch (fallbackError) {
      console.warn(`Creator hub transaction logging failed even after fallback: ${fallbackError.message}`);
      return {
        success: false,
        fallbackUsed: true,
        warning: 'Your upload completed, but the audit log could not be written.',
      };
    }
  }
};

const calculateUnlockUsd = async (priceUSD) => {
  const grossUsd = Number(priceUSD) || 0;
  const netUsd = grossUsd * (1 - CREATOR_HUB_PLATFORM_FEE_PERCENT);
  return Number(netUsd.toFixed(4));
};

const resolveCountryCurrency = (countryCode) => COUNTRIES[countryCode]?.currency || 'USD';

const resolveUploadPriceLocal = async (upload, countryCode) => {
  const priceUSD = resolvePremiumPriceUSD(upload, countryCode);
  if (!priceUSD) return 0;
  const currency = resolveCountryCurrency(countryCode);
  if (currency === 'USD') return Number(priceUSD.toFixed(2));
  const rate = await getCurrencyRate(currency);
  return Number((priceUSD * rate).toFixed(2));
};

const serializeUpload = async (doc, viewer, unlockedSet, savedSet) => {
  const creatorIdStr = String(doc.creatorId?._id || doc.creatorId);
  const isOwner = creatorIdStr === String(viewer.id);
  const unlocked = isOwner || unlockedSet.has(doc._id.toString());
  const priceUSD = doc.isPremium ? resolvePremiumPriceUSD(doc, viewer.country) : 0;
  const priceLocal = doc.isPremium ? await resolveUploadPriceLocal(doc, viewer.country) : 0;
  return {
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    tier: doc.tier,
    badge: CREATOR_HUB_TIERS[doc.tier]?.badge,
    isPremium: doc.isPremium,
    priceUSD,
    priceLocal,
    priceCurrency: resolveCountryCurrency(viewer.country),
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

    const uploads = await Promise.all(items.map((doc) => serializeUpload(doc, req.user, unlockedSet, savedSet)));

    res.json({
      success: true,
      uploads,
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
      upload: await serializeUpload(
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
          ? {
              defaultUSD: Number(doc.pricing.defaultUSD || doc.pricing.defaultTokens || FALLBACK_PREMIUM_PRICE),
              byCountry: Object.fromEntries(doc.pricing.byCountry || new Map()),
            }
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
          priceUSD: resolvePremiumPriceUSD(upload, req.user.country),
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
    const { title, description, category, tier, isPremium, defaultPriceUSD, defaultPriceTokens, countryPrices, phone, email, whatsapp, website } = req.body;

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

    let videoDurationSec = null;
    try {
      videoDurationSec = await getVideoDurationSeconds(req.file.path);
    } catch {
      videoDurationSec = null;
    }

    if (videoDurationSec !== null && videoDurationSec > tierConfig.maxDurationSec) {
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
          defaultUSD: Math.max(Number(defaultPriceUSD || defaultPriceTokens) || FALLBACK_PREMIUM_PRICE, 1),
          defaultTokens: Math.max(Number(defaultPriceUSD || defaultPriceTokens) || FALLBACK_PREMIUM_PRICE, 1),
          byCountry: parseCountryPrices(countryPrices),
        }
      : { defaultUSD: 0, defaultTokens: 0, byCountry: {} };

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

    await session.commitTransaction();
    session.endSession();

    const auditLogResult = await createCreatorHubTransactions([{
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
    }]);

    const refreshedUser = await User.findById(creator._id).select('tokenBalance totalTokensSpent');
    return res.status(201).json({
      success: true,
      message: 'Upload published successfully',
      auditLogWarning: auditLogResult.warning,
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

    const priceUSD = resolvePremiumPriceUSD(upload, req.user.country);

    session.startTransaction();
    const wallet = await Wallet.findOne({ userId: req.user.id }).session(session);
    if (!wallet || Number(wallet.balanceUSD || 0) < priceUSD) {
      await session.abortTransaction();
      session.endSession();
      const shortBy = Math.max(priceUSD - Number(wallet?.balanceUSD || 0), 0.01);
      return res.status(402).json({
        success: false,
        message: `you need $${shortBy.toFixed(2)} more USD`,
        shortBy: Number(shortBy.toFixed(4)),
      });
    }

    wallet.balanceUSD = Number((Number(wallet.balanceUSD || 0) - priceUSD).toFixed(4));
    await wallet.save({ session });

    const creatorId = upload.creatorId?._id || upload.creatorId;
    const netUsd = await calculateUnlockUsd(priceUSD);

    await CreatorPurchase.create([{
      userId: req.user.id,
      uploadId: upload._id,
      tokenAmount: priceUSD,
      amountUSD: priceUSD,
      currency: 'USD',
      country: req.user.country,
      unlockedAt: new Date(),
    }], { session });

    await CreatorUpload.findByIdAndUpdate(upload._id, {
      $inc: {
        unlocks: 1,
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

    await session.commitTransaction();
    session.endSession();

    const auditLogResult = await createCreatorHubTransactions([{
      userId: req.user.id,
      type: 'creator_hub_purchase',
      amountLocal: priceUSD,
      amountUSD: priceUSD,
      currency: 'USD',
      country: req.user.country,
      provider: 'internal',
      direction: 'debit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        uploadId: upload._id.toString(),
        creatorId: String(creatorId),
        method: 'wallet',
        amountUSD: priceUSD,
      },
    }, {
      userId: creatorId,
      type: 'creator_hub_earning',
      amountLocal: priceUSD,
      amountUSD: netUsd,
      currency: 'USD',
      country: creatorCountry,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        uploadId: upload._id.toString(),
        purchaserId: req.user.id.toString(),
        platformFeePercent: CREATOR_HUB_PLATFORM_FEE_PERCENT,
        amountUSD: priceUSD,
      },
    }]);

    const refreshedWallet = await Wallet.findOne({ userId: req.user.id }).select('balanceUSD');
    return res.json({
      success: true,
      unlocked: true,
      amountUSD: priceUSD,
      walletBalanceUSD: refreshedWallet?.balanceUSD ?? wallet.balanceUSD,
      usdEarned: netUsd,
      auditLogWarning: auditLogResult.warning,
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

    const videoFilePath = resolveCreatorHubVideoPath(doc);
    if (!videoFilePath) {
      return res.status(404).json({ success: false, message: 'Video file unavailable' });
    }

    await CreatorUpload.findByIdAndUpdate(doc._id, { $inc: { views: 1 } });

    const stat = fs.statSync(videoFilePath);
    const range = req.headers.range;
    const mimeType = doc.videoMimeType || 'video/mp4';
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(videoFilePath, { start, end });
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
    fs.createReadStream(videoFilePath).pipe(res);
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

