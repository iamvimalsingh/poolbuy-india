import { BuyingTimeline, PoolCategory, PoolStatus, LeadStatus, PoolRequestStatus } from '@/types';

export const SITE_NAME = 'GroupBuying.store';
export const SECONDARY_BRAND = 'PoolBuy India';
export const CANONICAL_PRODUCTION_URL = 'https://groupbuying.store';
export const SITE_TAGLINE = 'Solar, Power Backup & Water Softener Group Deals in India';
export const SITE_DESCRIPTION = 'Register free interest in local group-buying for rooftop solar systems, inverter-battery combos and whole-house water softeners. Offers depend on local demand and verified supplier terms.';

export interface CategoryMeta {
  category: PoolCategory;
  slug: string;
  label: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    category: 'ROOFTOP_SOLAR',
    slug: 'rooftop-solar',
    label: 'Rooftop Solar (3kW & 5kW)',
    description: 'Residential rooftop solar installations with DISCOM subsidy guidance.',
  },
  {
    category: 'ROOFTOP_SOLAR',
    slug: 'home-power-backup',
    label: 'Home Power Backup',
    description: 'Heavy-duty pure sine wave inverter and 200 Ah tall tubular battery combo package.',
  },
  {
    category: 'ROOFTOP_SOLAR',
    slug: 'water-softeners',
    label: 'Whole-House Water Softener',
    description: 'Automatic ion-exchange water softeners for scale-free residential plumbing.',
  },
  {
    category: 'EV_SCOOTERS',
    slug: 'ev-scooters',
    label: 'Electric Scooters',
    description: 'Bulk buying for top 2W electric vehicles and high-speed commuters.',
  },
  {
    category: 'CARS',
    slug: 'cars',
    label: 'Cars & SUVs',
    description: 'City-level group quotations for personal and family passenger cars.',
  },
  {
    category: 'LAPTOPS',
    slug: 'laptops',
    label: 'Laptops & MacBooks',
    description: 'Direct corporate and student group deals on premium laptops.',
  },
  {
    category: 'SMART_TVS',
    slug: 'smart-tvs',
    label: 'Smart TVs',
    description: 'Large-screen 4K and QLED television group purchases.',
  },
  {
    category: 'TRACTORS_COMMERCIAL',
    slug: 'tractors-commercial',
    label: 'Tractors & Commercial',
    description: 'Agricultural equipment and commercial vehicle pooling.',
  },
];

export const CATEGORY_SLUG_MAP: Record<string, PoolCategory | PoolCategory[]> = {
  'rooftop-solar': 'ROOFTOP_SOLAR',
  'home-power-backup': 'ROOFTOP_SOLAR',
  'water-softeners': 'ROOFTOP_SOLAR',
  'ev-scooters': 'EV_SCOOTERS',
  'cars': 'CARS',
  'laptops': 'LAPTOPS',
  'smart-tvs': 'SMART_TVS',
  'tractors-commercial': 'TRACTORS_COMMERCIAL',
  'electronics': ['LAPTOPS', 'SMART_TVS'],
};

export interface CityMeta {
  name: string;
  slug: string;
  state: string;
}

export const CITIES: CityMeta[] = [
  { name: 'Bhopal', slug: 'bhopal', state: 'Madhya Pradesh' },
  { name: 'Indore', slug: 'indore', state: 'Madhya Pradesh' },
  { name: 'Pune', slug: 'pune', state: 'Maharashtra' },
  { name: 'Delhi', slug: 'delhi', state: 'Delhi NCR' },
  { name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra' },
  { name: 'Banda', slug: 'banda', state: 'Uttar Pradesh' },
];

export const TIMELINE_LABELS: Record<BuyingTimeline, string> = {
  THIS_MONTH: 'This month',
  WITHIN_1_3_MONTHS: '1–3 months',
  WITHIN_3_6_MONTHS: '3–6 months',
  JUST_EXPLORING: 'Just exploring',
  // Backward compatibility with legacy lead records
  WITHIN_7_DAYS: 'Immediate (Within 7 Days)',
  WITHIN_15_DAYS: 'Soon (Within 15 Days)',
  WITHIN_30_45_DAYS: 'Planning (Within 30–45 Days)',
};

export const STATUS_LABELS: Record<PoolStatus, { label: string; badgeClass: string; description: string }> = {
  ACTIVE: {
    label: 'Active Pool',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Open for registration. Free interest registration.',
  },
  UNLOCKED: {
    label: 'Deal Unlocked',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Target reached! Dealer terms verified.',
  },
  LEAD_FALLBACK: {
    label: 'Dealer Direct Quotes',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Connecting interested buyers directly with certified dealers.',
  },
  CLOSED: {
    label: 'Closed',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
    description: 'This pool has concluded.',
  },
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New Lead',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  DO_NOT_CONTACT: 'Do Not Contact',
};

export const REQUEST_STATUS_LABELS: Record<PoolRequestStatus, string> = {
  REQUESTED: 'Requested',
  REVIEWING: 'Under Review',
  APPROVED: 'Approved for Pool',
  REJECTED: 'Declined',
  NEEDS_INFO: 'Needs Information',
};

export const PRIVACY_NOTICE_VERSION = '2026-10-26-v1';
export const DEFAULT_TOKEN_AMOUNT = 499;
