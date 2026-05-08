const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const { getCategoryProviders } = require('../config/categoryProviders');

const CASH_TASK_SESSION_TTL_SECONDS = 60 * 60 * 12;

const resolveCategory = () => {
  const category = getCategoryProviders('cash_tasks');
  return {
    category,
    providers: category?.providers || [],
  };
};

const mapProvider = (provider) => ({
  key: provider.key,
  name: provider.name,
  description: provider.description,
  integrationType: provider.integrationType,
  access: provider.access,
  badge: provider.badge,
  url: provider.externalUrl || null,
  live: Boolean(provider.externalUrl),
});

const createCashTaskSession = async ({ user, providerKey }) => {
  const sessionId = `CT-${providerKey}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    sessionId,
    userId: user._id.toString(),
    userCode: user.userId,
    providerKey,
    createdAt: new Date().toISOString(),
  };

  if (isRedisReady()) {
    try {
      await getRedis().setex(`cash-tasks:session:${sessionId}`, CASH_TASK_SESSION_TTL_SECONDS, JSON.stringify(payload));
    } catch (error) {
      logger.warn(`Cash task session store failed: ${error.message}`);
    }
  }

  return payload;
};

exports.getCashTaskProviders = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { category, providers: catalogProviders } = resolveCategory();
    const providers = catalogProviders.map((provider) => mapProvider(provider, user));

    res.json({
      success: true,
      category: {
        key: 'cash_tasks',
        title: category?.title || 'Cash Tasks',
        description: category?.description || 'Sure jobs and cash task postings handled directly inside the platform.',
      },
      liveProviders: providers.filter((provider) => provider.live),
      plannedProviders: providers.filter((provider) => !provider.live),
      totalProviders: providers.length,
      activeProviders: providers.filter((provider) => provider.live).length,
    });
  } catch (error) {
    logger.error(`getCashTaskProviders error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/cash-tasks/launch/:providerKey
exports.launchCashTaskProvider = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { providerKey } = req.params;
    const { providers } = resolveCategory();
    const provider = providers.find((entry) => entry.key === providerKey);

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const mappedProvider = mapProvider(provider);
    if (!mappedProvider.url) {
      return res.status(503).json({ success: false, message: 'Provider launch URL is not configured yet' });
    }

    const session = await createCashTaskSession({ user, providerKey });

    res.json({
      success: true,
      sessionId: session.sessionId,
      provider: mappedProvider,
      launchUrl: mappedProvider.url,
    });
  } catch (error) {
    logger.error(`launchCashTaskProvider error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/cash-tasks/history
exports.getCashTaskHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = {
      userId: req.user.id,
      type: 'task',
      'metadata.source': 'internal',
    };

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error(`getCashTaskHistory error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};