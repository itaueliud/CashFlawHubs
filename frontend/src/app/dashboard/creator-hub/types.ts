export interface CreatorHubCategory {
  value: string;
  label: string;
}

export interface CreatorHubTier {
  label: string;
  tokenCost: number;
  maxDurationSec: number;
  maxSizeMB: number;
  maxDescriptionChars: number;
  badge: string;
}

export interface CreatorHubMeta {
  success: boolean;
  categories: CreatorHubCategory[];
  tiers: Record<string, CreatorHubTier>;
  titleMaxChars: number;
  countries: Record<string, { name: string; currency: string; symbol: string }>;
  tokenBalance: number;
  defaultPremiumPriceByCountry: Record<string, number>;
  fallbackPremiumPrice: number;
  platformFeePercent: number;
}

export interface CreatorUploadItem {
  _id: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  badge?: string;
  isPremium: boolean;
  isLocked: boolean;
  isOwner?: boolean;
  isSaved?: boolean;
  priceTokens: number;
  streamUrl: string;
  contact?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    website?: string;
  };
  creator?: {
    _id: string;
    name: string;
    country?: string;
  };
  views: number;
  unlocks: number;
  createdAt: string;
}

export interface MyUploadItem {
  _id: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  badge?: string;
  isPremium: boolean;
  pricing: null | { defaultTokens: number; byCountry: Record<string, number> };
  contact?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    website?: string;
  };
  status: string;
  views: number;
  unlocks: number;
  tokensEarned: number;
  usdEarned: number;
  streamUrl: string;
  createdAt: string;
}
