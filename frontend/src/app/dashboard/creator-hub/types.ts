export interface CreatorHubSubcategory {
  value: string;
  label: string;
}

export interface CreatorHubCategory {
  value: string;
  label: string;
  isNew?: boolean;
  subcategories: CreatorHubSubcategory[];
}

export interface CreatorHubUploadType {
  value: 'video' | 'document';
  label: string;
  icon: string;
  formats?: string[];
}

export interface CreatorHubTier {
  label: string;
  tokenCost: number;
  maxDurationSec?: number; // undefined for document tiers
  maxSizeMB: number;
  maxDescriptionChars: number;
  badge: string;
}

export interface CreatorHubMeta {
  success: boolean;
  uploadTypes: CreatorHubUploadType[];
  categories: CreatorHubCategory[];
  tiers: { video: Record<string, CreatorHubTier>; document: Record<string, CreatorHubTier> };
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
  uploadType: 'video' | 'document';
  category: string;
  subcategory?: string;
  tier: string;
  badge?: string;
  isPremium: boolean;
  isLocked: boolean;
  isOwner?: boolean;
  isSaved?: boolean;
  priceUSD: number;
  priceLocal?: number;
  priceCurrency?: string;
  streamUrl: string;
  videoPublicUrl?: string;
  fileName?: string;
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
  uploadType: 'video' | 'document';
  category: string;
  subcategory?: string;
  tier: string;
  badge?: string;
  isPremium: boolean;
  pricing: null | { defaultUSD: number; defaultTokens?: number; byCountry: Record<string, number> };
  status: string;
  views: number;
  unlocks: number;
  tokensEarned: number;
  usdEarned: number;
  streamUrl: string;
  videoPublicUrl?: string;
  createdAt: string;
}
