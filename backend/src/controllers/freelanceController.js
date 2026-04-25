const { Gig, GigOrder } = require('../models/Freelance');
const GigApplication = require('../models/GigApplication');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { spendTokens } = require('../services/tokenService');
const logger = require('../utils/logger');
const { JOB_POSTING_TOKEN_COST, TOKEN_PACKAGES } = require('../config/monetization');

const PLATFORM_FEE_PERCENT = 0.10; // 10% platform cut

// @GET /api/freelance/gigs
exports.getGigs = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20, minPrice, maxPrice } = req.query;
    const skip = (page - 1) * limit;

    const query = { isActive: true };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };
    if (minPrice || maxPrice) {
      query.priceUSD = {};
      if (minPrice) query.priceUSD.$gte = Number(minPrice);
      if (maxPrice) query.priceUSD.$lte = Number(maxPrice);
    }

    const [gigs, total] = await Promise.all([
      Gig.find(query)
        .populate('sellerId', 'name country level badges')
        .sort({ rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Gig.countDocuments(query),
    ]);

    res.json({
      success: true,
      gigs,
      tokenPolicy: {
        postingCost: JOB_POSTING_TOKEN_COST,
        tokenPackages: TOKEN_PACKAGES,
      },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/freelance/gigs
exports.createGig = async (req, res) => {
  try {
    const user = req.user;
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Activation required to post gigs' });
    }

    if ((user.tokenBalance || 0) < JOB_POSTING_TOKEN_COST) {
      return res.status(400).json({
        success: false,
        message: `Posting a gig requires ${JOB_POSTING_TOKEN_COST} tokens`,
        tokenBalance: user.tokenBalance || 0,
      });
    }

    user.consumeTokens(JOB_POSTING_TOKEN_COST);
    await user.save();

    const gig = await Gig.create({ ...req.body, sellerId: user.id });
    res.status(201).json({
      success: true,
      gig,
      tokenBalance: user.tokenBalance,
      tokensSpent: JOB_POSTING_TOKEN_COST,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/freelance/gigs/:id/apply
exports.applyToGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }

    const existingApplication = await GigApplication.findOne({ gigId: gig._id, userId: req.user.id });
    if (existingApplication) {
      return res.status(409).json({ success: false, message: 'You already applied to this gig' });
    }

    const tokenCost = Math.max(Number(gig.applicationTokenCost || 10), 0);
    if (tokenCost > 0) {
      await spendTokens({
        userId: req.user.id,
        tokenAmount: tokenCost,
        action: 'freelance_application',
        metadata: { gigId: gig._id.toString(), gigTitle: gig.title },
      });
    }

    const application = await GigApplication.create({
      gigId: gig._id,
      userId: req.user.id,
      tokenCost,
      coverLetter: req.body.coverLetter || null,
      status: 'submitted',
    });

    res.status(201).json({
      success: true,
      message: tokenCost > 0 ? `Applied successfully using ${tokenCost} tokens` : 'Applied successfully',
      application,
    });
  } catch (error) {
    logger.error(`applyToGig error: ${error.message}`);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// @POST /api/freelance/gigs/:id/order
exports.placeOrder = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig || !gig.isActive) return res.status(404).json({ success: false, message: 'Gig not found' });

    const buyerWallet = await Wallet.findOne({ userId: req.user.id });
    if (buyerWallet.balanceUSD < gig.priceUSD) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const platformFee = gig.priceUSD * PLATFORM_FEE_PERCENT;
    const sellerAmount = gig.priceUSD - platformFee;

    // Deduct from buyer
    await buyerWallet.debit(gig.priceUSD);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + gig.deliveryDays);

    const order = await GigOrder.create({
      gigId: gig._id,
      buyerId: req.user.id,
      sellerId: gig.sellerId,
      amountUSD: gig.priceUSD,
      platformFeeUSD: platformFee,
      sellerAmountUSD: sellerAmount,
      requirements: req.body.requirements,
      dueDate,
    });

    await Gig.findByIdAndUpdate(gig._id, { $inc: { totalOrders: 1 } });

    res.status(201).json({ success: true, order });
  } catch (error) {
    logger.error(`placeOrder error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/freelance/orders/:id/complete
exports.completeOrder = async (req, res) => {
  try {
    const order = await GigOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.buyerId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (order.status !== 'delivered') return res.status(400).json({ success: false, message: 'Order not yet delivered' });

    // Credit seller
    const sellerWallet = await Wallet.findOne({ userId: order.sellerId });
    await sellerWallet.credit(order.sellerAmountUSD, 'freelance');

    await Transaction.create({
      userId: order.sellerId,
      type: 'freelance',
      amountLocal: order.sellerAmountUSD,
      amountUSD: order.sellerAmountUSD,
      currency: 'USD',
      country: 'KE', // will be overridden by seller's country
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
    });

    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();

    res.json({ success: true, message: 'Order completed. Seller has been paid.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/freelance/my-gigs
exports.getMyGigs = async (req, res) => {
  try {
    const gigs = await Gig.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, gigs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
