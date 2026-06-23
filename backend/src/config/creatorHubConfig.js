const CREATOR_HUB_CATEGORIES = [
  { value: 'services', label: 'Services' },
  { value: 'talent_skills', label: 'Talent & Skills' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'apps_platforms', label: 'Apps & Platforms' },
  { value: 'products', label: 'Products' },
  { value: 'startups_projects', label: 'Startups & Projects' },
];

const CREATOR_HUB_TIERS = {
  normal: {
    label: 'Normal',
    tokenCost: 5,
    maxDurationSec: 60,
    maxSizeMB: 10,
    maxDescriptionChars: 500,
    badge: 'Standard visibility',
  },
  plus: {
    label: 'Plus',
    tokenCost: 10,
    maxDurationSec: 120,
    maxSizeMB: 25,
    maxDescriptionChars: 1000,
    badge: 'Higher visibility + basic analytics',
  },
  featured: {
    label: 'Featured',
    tokenCost: 25,
    maxDurationSec: 180,
    maxSizeMB: 50,
    maxDescriptionChars: 2000,
    badge: 'Featured placement + enhanced analytics + badge',
  },
  premium_spotlight: {
    label: 'Premium Spotlight',
    tokenCost: 40,
    maxDurationSec: 300,
    maxSizeMB: 100,
    maxDescriptionChars: 3000,
    badge: 'Top ranking + Verified Creator badge + priority review',
  },
};

const CREATOR_HUB_TITLE_MAX_CHARS = 50;
const CREATOR_HUB_PLATFORM_FEE_PERCENT = 0.2;
const KES_PER_TOKEN = 10;

const DEFAULT_PREMIUM_PRICE_BY_COUNTRY = {
  KE: 15, UG: 15, TZ: 15, ET: 15, GH: 15, NG: 15,
  BJ: 15, BF: 15, CM: 15, CG: 15, CD: 12, GA: 15,
  CI: 15, LS: 12, MW: 12, MZ: 12, RW: 15, SN: 15,
  SL: 12, ZM: 12,
};

const FALLBACK_PREMIUM_PRICE = 15;

module.exports = {
  CREATOR_HUB_CATEGORIES,
  CREATOR_HUB_TIERS,
  CREATOR_HUB_TITLE_MAX_CHARS,
  CREATOR_HUB_PLATFORM_FEE_PERCENT,
  KES_PER_TOKEN,
  DEFAULT_PREMIUM_PRICE_BY_COUNTRY,
  FALLBACK_PREMIUM_PRICE,
};
