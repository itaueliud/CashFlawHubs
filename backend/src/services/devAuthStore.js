const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(process.cwd(), '.data');
const dataFile = path.join(dataDir, 'dev-auth-store.json');

const ensureStore = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: [] }, null, 2));
  }
};

const readStore = () => {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

const writeStore = (store) => {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
};

const normalizeIdentityNumber = (value = '') => String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const buildUserResponse = (user) => ({
  id: user.id,
  _id: user.id,
  userId: user.userId,
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  email: user.email,
  phone: user.phone,
  country: user.country,
  referralCode: user.referralCode,
  activationStatus: user.activationStatus,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  identityVerificationStatus: user.identityVerificationStatus,
  tokenBalance: user.tokenBalance,
  totalTokensPurchased: user.totalTokensPurchased,
  totalTokensSpent: user.totalTokensSpent,
  role: user.role,
  level: user.level,
  xpPoints: user.xpPoints,
  streak: user.streak,
  badges: user.badges,
  isActive: user.isActive,
  isBanned: user.isBanned,
  balanceUSD: user.balanceUSD || 0,
});

const findUser = (predicate) => readStore().users.find(predicate) || null;

const createUser = async (payload) => {
  const store = readStore();
  const hashedPassword = await bcrypt.hash(payload.passwordHash, 12);
  const normalizedId = payload.idNumber ? normalizeIdentityNumber(payload.idNumber) : '';

  const user = {
    id: uuidv4(),
    userId: normalizedId ? `B${normalizedId}` : `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
    firstName: payload.firstName,
    lastName: payload.lastName,
    name: payload.name,
    email: normalizeEmail(payload.email),
    phone: payload.phone,
    country: payload.country,
    passwordHash: hashedPassword,
    idNumber: normalizedId || null,
    idDocumentImage: payload.idDocumentImage || null,
    faceVerificationImage: payload.faceVerificationImage || null,
    identityVerificationStatus: payload.identityVerificationStatus || 'pending',
    referralCode: `REF-${uuidv4().slice(0, 8).toUpperCase()}`,
    referredBy: payload.referredBy || null,
    activationStatus: false,
    emailVerified: !!payload.emailVerified,
    phoneVerified: !!payload.phoneVerified,
    tokenBalance: 10,
    totalTokensPurchased: 0,
    totalTokensSpent: 0,
    role: 'user',
    level: 1,
    xpPoints: 0,
    streak: 0,
    badges: [],
    isActive: true,
    isBanned: false,
    failedLoginAttempts: 0,
    lockUntil: null,
    balanceUSD: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users.push(user);
  writeStore(store);
  return buildUserResponse(user);
};

const updateUser = (userId, updater) => {
  const store = readStore();
  const index = store.users.findIndex((user) => user.id === userId);
  if (index === -1) return null;

  const nextUser = updater(store.users[index]);
  store.users[index] = { ...nextUser, updatedAt: new Date().toISOString() };
  writeStore(store);
  return buildUserResponse(store.users[index]);
};

const verifyPassword = async (user, password) => bcrypt.compare(password, user.passwordHash);

module.exports = {
  normalizeEmail,
  normalizeIdentityNumber,
  findById: (id) => findUser((user) => user.id === id),
  findByEmail: (email) => findUser((user) => user.email === normalizeEmail(email)),
  findByPhone: (phone) => findUser((user) => user.phone === phone),
  findByIdNumber: (idNumber) => findUser((user) => user.idNumber === normalizeIdentityNumber(idNumber)),
  findByReferralCode: (referralCode) => findUser((user) => user.referralCode === referralCode),
  createUser,
  updateUser,
  verifyPassword,
  buildUserResponse,
};
