const TOKEN_PACKAGES = [
  { tokens: 10, amountKES: 100 },
  { tokens: 25, amountKES: 220 },
  { tokens: 50, amountKES: 400 },
  { tokens: 100, amountKES: 750 },
  { tokens: 250, amountKES: 1700 },
  { tokens: 500, amountKES: 3000 },
];

const getTokenPackageByTokens = (tokens) => {
  const count = Number(tokens);
  if (!Number.isInteger(count) || count <= 0) return null;
  return TOKEN_PACKAGES.find((pkg) => pkg.tokens === count) || null;
};

module.exports = {
  TOKEN_PACKAGES,
  getTokenPackageByTokens,
};
