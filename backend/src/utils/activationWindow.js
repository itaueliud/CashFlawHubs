const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isActivationTestWindowEnabled = () => {
  const enabled = String(process.env.ACTIVATION_TEST_MODE || 'false').toLowerCase() === 'true';
  if (!enabled) return false;

  const startAt = parseDate(process.env.ACTIVATION_TEST_START_AT);
  if (!startAt) return false;

  const days = Number(process.env.ACTIVATION_TEST_DAYS || 15);
  if (!Number.isFinite(days) || days <= 0) return false;

  const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);
  const now = new Date();
  return now >= startAt && now < endAt;
};

const isUserActivated = (user) => {
  if (user?.activationStatus) return true;
  return isActivationTestWindowEnabled();
};

module.exports = {
  isActivationTestWindowEnabled,
  isUserActivated,
};

