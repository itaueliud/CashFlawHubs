require('dotenv').config();
const mongoose = require('mongoose');

const KEEPERS = [
  { phone: '+254700000001', email: 'superadmin@cashflawhubs.app', role: 'superadmin' },
  { phone: '+254700000000', email: 'admin@cashflawhubs.app', role: 'admin' },
  { phone: '+254700000002', email: 'ledger@cashflawhubs.app', role: 'ledger' },
  { phone: '+254711111111', email: 'testuser@cashflawhubs.app', role: 'user' },
];

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
}

function buildKeeperQuery() {
  return {
    $or: KEEPERS.flatMap((keeper) => [
      keeper.phone ? [{ phone: keeper.phone }] : [],
      keeper.email ? [{ email: keeper.email }] : [],
      keeper.role ? [{ role: keeper.role, phone: keeper.phone }] : [],
    ]).flat(),
  };
}

async function main() {
  await connectDB();

  const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  const walletSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

  const keeperQuery = buildKeeperQuery();
  const keepers = await User.find(keeperQuery).select('_id phone email role').lean();
  const keeperIds = keepers.map((user) => user._id.toString());

  const usersToDelete = await User.find({
    _id: { $nin: keeperIds },
  }).select('_id phone email role').lean();

  const deleteIds = usersToDelete.map((user) => user._id);

  if (deleteIds.length === 0) {
    console.log('No non-core users found. Nothing to delete.');
    await mongoose.connection.close();
    return;
  }

  await Wallet.deleteMany({ userId: { $in: deleteIds } });
  await User.deleteMany({ _id: { $in: deleteIds } });

  console.log(`Kept ${keepers.length} core user(s). Deleted ${deleteIds.length} other user(s) and their wallets.`);
  keepers.forEach((user) => {
    console.log(`Kept: ${user.phone || user.email || user._id} (${user.role || 'user'})`);
  });

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Failed to delete users:', err.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
