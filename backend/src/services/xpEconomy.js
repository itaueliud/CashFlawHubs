const { getCurrencyRate } = require('./exchangeService');

// Single source of truth for the XP <-> cash conversion used across the app.
// Keep these in sync with controllers/walletController.js redemption logic.
const XP_REDEMPTION_BLOCK = 20000;      // XP required per redemption block
const XP_REDEMPTION_LOCAL_KES = 1000;   // KES value of one redemption block

/**
 * Converts a USD earning value (what CPX/an offerwall paid out for a
 * survey/offer) into the XP a user should be awarded, using the same rate
 * the wallet uses when redeeming XP back into cash.
 *
 * NOTE: If your providers are already configured to report rewards in XP
 * units directly (not USD), you should use Math.round(Number(amount))
 * instead of calling this function.
 */
async function usdToXp(amountUSD) {
  const usd = Number(amountUSD);
  if (!Number.isFinite(usd) || usd <= 0) return 0;

  const kesRate = await getCurrencyRate('KES'); // KES per 1 USD
  const amountKES = usd * kesRate;
  const xp = (amountKES / XP_REDEMPTION_LOCAL_KES) * XP_REDEMPTION_BLOCK;
  return Math.max(Math.round(xp), 0);
}

module.exports = { XP_REDEMPTION_BLOCK, XP_REDEMPTION_LOCAL_KES, usdToXp };
