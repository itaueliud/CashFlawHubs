const CREATOR_HUB_UPLOAD_TYPES = [
  { value: 'video', label: 'Video', icon: '🎥' },
  { value: 'document', label: 'Document', icon: '📄', formats: ['PDF', 'DOCX', 'PPTX', 'XLSX', 'EPUB'] },
];

const CREATOR_HUB_CATEGORIES = [
  {
    value: 'books_documents',
    label: '📚 Books & Documents',
    isNew: true,
    subcategories: [
      { value: 'ebooks', label: 'eBooks (PDF, EPUB)' },
      { value: 'study_notes', label: 'Study Notes' },
      { value: 'business_documents', label: 'Business Documents' },
      { value: 'templates', label: 'Templates' },
      { value: 'cvs_resumes', label: 'CVs & Resumes' },
      { value: 'guides_manuals', label: 'Guides & Manuals' },
      { value: 'checklists', label: 'Checklists' },
      { value: 'digital_planners', label: 'Digital Planners' },
    ],
  },
  {
    value: 'education_learning',
    label: '🎓 Education & Learning',
    subcategories: [
      { value: 'tutorials', label: 'Tutorials' },
      { value: 'courses', label: 'Courses' },
      { value: 'training_videos', label: 'Training Videos' },
      { value: 'exam_preparation', label: 'Exam Preparation' },
    ],
  },
  {
    value: 'business_finance',
    label: '💼 Business & Finance',
    subcategories: [
      { value: 'business_ideas', label: 'Business Ideas' },
      { value: 'investment', label: 'Investment' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'sales', label: 'Sales' },
      { value: 'entrepreneurship', label: 'Entrepreneurship' },
    ],
  },
  {
    value: 'technology',
    label: '💻 Technology',
    subcategories: [
      { value: 'programming', label: 'Programming' },
      { value: 'ai', label: 'AI' },
      { value: 'cybersecurity', label: 'Cybersecurity' },
      { value: 'software_development', label: 'Software Development' },
      { value: 'tech_reviews', label: 'Tech Reviews' },
    ],
  },
  {
    value: 'creative_design',
    label: '🎨 Creative & Design',
    subcategories: [
      { value: 'graphic_design', label: 'Graphic Design' },
      { value: 'ui_ux', label: 'UI/UX' },
      { value: 'photography', label: 'Photography' },
      { value: 'animation', label: 'Animation' },
      { value: 'video_editing', label: 'Video Editing' },
    ],
  },
  {
    value: 'professional_services',
    label: '🛠 Professional Services',
    subcategories: [
      { value: 'freelancing', label: 'Freelancing' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'virtual_assistance', label: 'Virtual Assistance' },
      { value: 'writing', label: 'Writing' },
      { value: 'translation', label: 'Translation' },
    ],
  },
  {
    value: 'startups_innovation',
    label: '🚀 Startups & Innovation',
    subcategories: [
      { value: 'startup_pitches', label: 'Startup Pitches' },
      { value: 'product_demos', label: 'Product Demos' },
      { value: 'business_projects', label: 'Business Projects' },
    ],
  },
  {
    value: 'products_reviews',
    label: '🛍 Products & Reviews',
    subcategories: [
      { value: 'product_demonstrations', label: 'Product Demonstrations' },
      { value: 'unboxings', label: 'Unboxings' },
      { value: 'recommendations', label: 'Recommendations' },
    ],
  },
  {
    value: 'talent_entertainment',
    label: '🎤 Talent & Entertainment',
    subcategories: [
      { value: 'music', label: 'Music' },
      { value: 'comedy', label: 'Comedy' },
      { value: 'dance', label: 'Dance' },
      { value: 'acting', label: 'Acting' },
      { value: 'spoken_word', label: 'Spoken Word' },
    ],
  },
  {
    value: 'lifestyle',
    label: '❤️ Lifestyle',
    subcategories: [
      { value: 'health', label: 'Health' },
      { value: 'fitness', label: 'Fitness' },
      { value: 'travel', label: 'Travel' },
      { value: 'food', label: 'Food' },
      { value: 'motivation', label: 'Motivation' },
    ],
  },
  {
    value: 'marketing_promotion',
    label: '📢 Marketing & Promotion',
    subcategories: [
      { value: 'brand_promotions', label: 'Brand Promotions' },
      { value: 'company_profiles', label: 'Company Profiles' },
      { value: 'advertisements', label: 'Advertisements' },
    ],
  },
];

// Video packages — unchanged from previous setup.
const CREATOR_HUB_TIERS = {
  normal: { label: 'Normal', tokenCost: 5, maxDurationSec: 300, maxSizeMB: 10, maxDescriptionChars: 500, badge: 'Standard visibility' },
  plus: { label: 'Plus', tokenCost: 10, maxDurationSec: 600, maxSizeMB: 25, maxDescriptionChars: 1000, badge: 'Higher visibility + basic analytics' },
  featured: { label: 'Featured', tokenCost: 20, maxDurationSec: 900, maxSizeMB: 50, maxDescriptionChars: 2000, badge: 'Featured placement + enhanced analytics + badge' },
  premium_spotlight: { label: 'Premium Spotlight', tokenCost: 30, maxDurationSec: 1800, maxSizeMB: 100, maxDescriptionChars: 3000, badge: 'Top ranking + Verified Creator badge + priority review' },
};

// Document packages — no duration limit.
const CREATOR_HUB_DOCUMENT_TIERS = {
  basic: { label: 'Basic', tokenCost: 2, maxSizeMB: 1, maxDescriptionChars: 500, badge: 'Standard visibility' },
  standard: { label: 'Standard', tokenCost: 5, maxSizeMB: 5, maxDescriptionChars: 1000, badge: 'Higher visibility + basic analytics' },
  professional: { label: 'Professional', tokenCost: 10, maxSizeMB: 10, maxDescriptionChars: 1500, badge: 'Featured placement + enhanced analytics + badge' },
  premium: { label: 'Premium', tokenCost: 15, maxSizeMB: 50, maxDescriptionChars: 2500, badge: 'Top ranking + Verified Creator badge + priority review' },
  enterprise: { label: 'Enterprise', tokenCost: 25, maxSizeMB: 100, maxDescriptionChars: 4000, badge: 'Enterprise placement + dedicated support + priority review' },
};

const CREATOR_HUB_TIERS_BY_TYPE = {
  video: CREATOR_HUB_TIERS,
  document: CREATOR_HUB_DOCUMENT_TIERS,
};

const CREATOR_HUB_DOCUMENT_MIME_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/epub+zip': '.epub',
};

const CREATOR_HUB_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

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
  CREATOR_HUB_UPLOAD_TYPES,
  CREATOR_HUB_CATEGORIES,
  CREATOR_HUB_TIERS,
  CREATOR_HUB_DOCUMENT_TIERS,
  CREATOR_HUB_TIERS_BY_TYPE,
  CREATOR_HUB_DOCUMENT_MIME_TYPES,
  CREATOR_HUB_VIDEO_MIME_TYPES,
  CREATOR_HUB_TITLE_MAX_CHARS,
  CREATOR_HUB_PLATFORM_FEE_PERCENT,
  KES_PER_TOKEN,
  DEFAULT_PREMIUM_PRICE_BY_COUNTRY,
  FALLBACK_PREMIUM_PRICE,
};
