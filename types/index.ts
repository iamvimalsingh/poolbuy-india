export type PoolCategory =
  | 'EV_SCOOTERS'
  | 'CARS'
  | 'ROOFTOP_SOLAR'
  | 'LAPTOPS'
  | 'SMART_TVS'
  | 'TRACTORS_COMMERCIAL';

export type PoolStatus = 'ACTIVE' | 'UNLOCKED' | 'LEAD_FALLBACK' | 'CLOSED';

export type V3BuyingTimeline =
  | 'THIS_MONTH'
  | 'WITHIN_1_3_MONTHS'
  | 'WITHIN_3_6_MONTHS'
  | 'JUST_EXPLORING';

export type LegacyBuyingTimeline =
  | 'WITHIN_7_DAYS'
  | 'WITHIN_15_DAYS'
  | 'WITHIN_30_45_DAYS';

export type BuyingTimeline = V3BuyingTimeline | LegacyBuyingTimeline;

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'DO_NOT_CONTACT';

export type PoolClosureReason =
  | 'ADMIN_CLOSED'
  | 'AUTO_POOL_EXPIRED'
  | 'ADMIN_EXPIRED'
  | 'AUTO_OFFER_EXPIRED'
  | 'OFFER_EXPIRED'
  | 'VENDOR_UNAVAILABLE'
  | 'SUPPLIER_WITHDRAWN'
  | 'TARGET_ACHIEVED'
  | 'MANUAL_CLOSE'
  | 'OTHER';

export type PoolRequestStatus =
  | 'REQUESTED'
  | 'REVIEWING'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_INFO';

export type PoolRequestType = 'GROUP_PROPOSAL' | 'PRODUCT_SUGGESTION';

export type MarketPriceType =
  | 'UNKNOWN'
  | 'INDICATIVE_ESTIMATE'
  | 'SOURCED_REFERENCE'
  | 'VERIFIED_COMPARABLE';

export type GroupPriceType =
  | 'UNKNOWN'
  | 'INDICATIVE_ESTIMATE'
  | 'VENDOR_QUOTED'
  | 'VENDOR_VERIFIED'
  | 'EXPIRED_WITHDRAWN';

export type ConnectionStatus =
  | 'NOT_ELIGIBLE'
  | 'ADMIN_REVIEW_PENDING'
  | 'TERMS_PENDING'
  | 'PAYMENT_LINK_CONFIGURED'
  | 'PAYMENT_PENDING'
  | 'READY_TO_CONNECT'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentConfigState =
  | 'DISABLED'
  | 'MANUAL_NO_CHARGE'
  | 'EXTERNAL_LINK_CONFIGURED'
  | 'RECONCILED';

/** Canonical high-level group lifecycle state */
export type GroupLifecycleStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'OPEN'
  | 'TARGET_REACHED'
  | 'CONNECTION_IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'ARCHIVED';

/** Waitlist queue lifecycle states */
export type WaitlistStatus =
  | 'WAITING'
  | 'INVITED'
  | 'ACCEPTED_PROMOTION'
  | 'DECLINED'
  | 'EXPIRED'
  | 'PROMOTED'
  | 'REMOVED';

/** FIFO waitlist queue entry for a pool */
export interface WaitlistEntry {
  id: string;
  poolId: string;
  sequenceNumber: number;
  fullName: string;
  whatsappNumber: string;
  city: string;
  buyingTimeline?: BuyingTimeline;
  locality?: string | null;
  pinCode?: string | null;
  status: WaitlistStatus;
  invitedAt?: string | null;
  invitationExpiresAt?: string | null;
  responseAt?: string | null;
  promotedAt?: string | null;
  promotedLeadId?: string | null;
  removalReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Quotation lifecycle status */
export type QuoteStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'RECEIVED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'WITHDRAWN';

/** Quotation record with validity and scope */
export interface PoolQuotation {
  id: string;
  poolId: string;
  priceType: 'ESTIMATED' | 'VENDOR_QUOTED';
  vendorName: string;
  vendorContactRef?: string | null; // private server-only
  quotedAmount: number;
  currency: string;
  quoteDate: string;
  validUntil: string;
  scope: string;
  inclusions: string[];
  exclusions: string[];
  deliveryTerms?: string | null;
  quantityCondition?: string | null;
  status: QuoteStatus;
  isCurrentPublished: boolean;
  verifiedByAdmin?: string | null;
  verifiedAt?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Member response to quotation */
export type MemberQuoteResponse =
  | 'NOT_SENT'
  | 'AWAITING_RESPONSE'
  | 'INTERESTED'
  | 'DECLINED'
  | 'NEEDS_INFORMATION'
  | 'NO_RESPONSE';

/** Connection fee payment lifecycle */
export type ConnectionFeeStatus =
  | 'NOT_APPLICABLE'
  | 'NOT_REQUESTED'
  | 'DISCLOSED_PENDING'
  | 'PAYMENT_REPORTED'
  | 'PAID_VERIFIED'
  | 'WAIVED'
  | 'REFUNDED'
  | 'CANCELLED';

/** Member-level connection status */
export type MemberConnectionStatus =
  | 'NOT_READY'
  | 'OPTED_IN'
  | 'WAITING_FOR_FEE'
  | 'ELIGIBLE_TO_CONNECT'
  | 'CONNECTED'
  | 'OPTED_OUT'
  | 'EXCLUDED';

/** All operational WhatsApp templates */
export type WhatsAppTemplateType =
  | 'UNLOCKED_TOKEN'
  | 'LEAD_FALLBACK'
  | 'QUOTE_FOLLOWUP'
  | 'TARGET_REACHED_INVITATION'
  | 'GROUP_PUBLISHED'
  | 'QUOTE_AVAILABLE'
  | 'RESPONSE_REMINDER'
  | 'CONNECTION_FEE_DISCLOSURE'
  | 'PAYMENT_INSTRUCTIONS'
  | 'WAITLIST_INVITATION'
  | 'WAITLIST_PROMOTION'
  | 'EXCLUSION_NOTICE'
  | 'GROUP_COMPLETED'
  | 'OPT_OUT_CONFIRMATION';

/** Complete predefined kit package available within a pool or product */
export interface PoolKitOffer {
  id: string;
  poolId: string;
  name: string;
  sku: string;
  brand: string;
  model: string;
  inclusions: string[];
  exclusions: string[];
  warranty: string;
  marketPrice: number;
  groupPrice: number;
  subsidyEstimate?: number | null;
  subsidyDisclaimer?: string | null;
  targetBuyers: number;
  currentBuyers: number;
  isAvailable: boolean;
  sortOrder: number;
}

/** Pre-approved volume discount tier from verified vendors */
export interface VendorPriceTier {
  id: string;
  poolId?: string;
  kitOfferId?: string;
  minQuantity: number;
  maxQuantity?: number | null;
  pricePerUnit: number;
  vendorName: string;
  validUntil: string;
  isApproved: boolean;
  notes?: string;
}

/** Auditable quote history for transparency */
export interface PriceHistoryEntry {
  id: string;
  poolId: string;
  kitOfferId?: string;
  vendorName: string;
  quotedMarketPrice: number;
  quotedGroupPrice: number;
  minimumCohortSize: number;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'EXPIRED' | 'REJECTED';
  recordedAt: string;
  notes?: string;
}

/** Managed city directory entity for multi-city support */
export interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  placeType?: 'CITY' | 'TOWN' | 'ISLAND_CENTRE' | 'SERVICE_ZONE';
  isActive: boolean;
  isSelectable?: boolean;
  availabilityState?: 'ACTIVE' | 'DEMAND_COLLECTING' | 'NOT_YET_AVAILABLE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

/** State directory entity */
export interface StateDirectory {
  code: string;
  name: string;
  slug: string;
  type: 'STATE' | 'UNION_TERRITORY';
  citiesCount: number;
}

/** Managed category entity for dynamic runtime categories */
export interface Category {
  id: string;
  slug: string;
  label: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Reusable standardized product catalog entity */
export interface StandardProduct {
  id: string;
  name: string;
  slug: string;
  category: PoolCategory | string;
  categorySlug?: string;
  brand: string;
  model: string;
  shortDescription: string;
  longDescription: string;
  defaultMarketPrice: number | null;
  defaultGroupPrice: number | null;
  defaultTargetBuyers: number;
  isActive?: boolean;
  defaultKits?: Partial<PoolKitOffer>[];
}

/** Fields allowed in public home/category/city/deal views. Never add payment URLs or dealer private fields here. */
export interface PublicPool {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: PoolCategory;
  categorySlug?: string;
  city: string;
  citySlug: string;
  productBrand: string;
  productModel: string;
  imageUrl: string | null;
  marketPrice: number | null;
  groupPrice: number | null;
  targetBuyers: number;
  currentBuyers: number;
  deadline: string; // ISO-8601 timestamp
  status: PoolStatus;
  closureReason?: PoolClosureReason | null;
  closedAt?: string | null;
  offerValidUntil?: string | null;
  isArchived?: boolean;
  deletedAt?: string | null;
  priceIsVerified: boolean;
  priceVerifiedAt: string | null;
  kitOffers?: PoolKitOffer[];
  priceTiers?: VendorPriceTier[];
  createdAt: string;
  updatedAt: string;
  // MVP Additions
  isPublished?: boolean;
  marketPriceType?: MarketPriceType;
  groupPriceType?: GroupPriceType;
  targetReachedAt?: string | null;
  connectionStatus?: ConnectionStatus;
  savingsDisplayApproved?: boolean;
  sourceRequestId?: string | null;
  maxWaitlistSize?: number;
}

/** Private server-only shape. Never serialize this to a public page or public API. */
export interface AdminPool extends PublicPool {
  dealerName: string | null;
  tokenAmount: number | null;
  tokenPaymentUrl: string | null;
  dealerOfferUrl: string | null;
  dealerTerms: string | null;
  priceHistory?: PriceHistoryEntry[];
  // MVP Additions
  quoteSource?: string | null;
  quoteDate?: string | null;
  quoteValidUntil?: string | null;
  quoteScope?: string | null;
  quotePrivateNotes?: string | null;
  connectionNotes?: string | null;
  paymentConfigState?: PaymentConfigState;
  targetReachedAcknowledgedAt?: string | null;
}

export interface JoinPoolInput {
  fullName: string;
  whatsappNumber: string;
  city?: string;
  buyingTimeline?: BuyingTimeline;
  hasExistingQuote?: boolean;
  existingQuoteAmount?: number | null;
  extraMessage?: string;
  selectedKitOfferId?: string;
  // MVP Additions
  connectionOptIn?: boolean;
  vendorShareConsent?: boolean;
  locality?: string;
  pinCode?: string;
  connectionPreference?: 'WHATSAPP_GROUP' | 'INDIVIDUAL_INTRO';
  groupPrivacyAcknowledged?: boolean;
}

export interface JoinPoolResult {
  leadId: string;
  buyerNumber: number;
  currentBuyers: number;
  targetBuyers: number;
  remainingBuyers: number;
  alreadyJoined: boolean;
  isDuplicate?: boolean;
  poolStatus: PoolStatus;
  selectedKitCurrentBuyers?: number;
  selectedKitTargetBuyers?: number;
  targetReached?: boolean;
  isDemo?: boolean;
}

export interface PoolLead {
  id: string;
  poolId: string;
  poolSlug: string;
  poolName: string;
  poolCategory: PoolCategory;
  fullName: string;
  whatsappNumber: string;
  city: string;
  buyingTimeline: BuyingTimeline;
  hasExistingQuote: boolean;
  existingQuoteAmount: number | null;
  extraMessage: string;
  selectedKitOfferId?: string | null;
  selectedKitName?: string | null;
  status: LeadStatus;
  consentAt: string;
  privacyNoticeVersion: string;
  createdAt: string;
  buyerNumber: number;
  // MVP Additions
  connectionOptIn?: boolean;
  vendorShareConsent?: boolean;
  locality?: string | null;
  pinCode?: string | null;
  adminNotes?: string | null;
  doNotContact?: boolean;
  contactPreference?: string;
  connectionPreference?: 'WHATSAPP_GROUP' | 'INDIVIDUAL_INTRO';
  groupPrivacyAcknowledged?: boolean;
  // Stage 3 Member Operations Additions
  quoteResponse?: MemberQuoteResponse;
  quoteResponseNotes?: string | null;
  quoteResponseRecordedAt?: string | null;
  feeStatus?: ConnectionFeeStatus;
  feeRuleVersion?: string | null;
  feeApprovedBasis?: number | null;
  feeCalculatedAmount?: number | null;
  feeDisclosedAmount?: number | null;
  feeDisclosedAt?: string | null;
  paymentReference?: string | null;
  paymentReportedAt?: string | null;
  paymentVerifiedBy?: string | null;
  paymentVerifiedAt?: string | null;
  paymentWaiverReason?: string | null;
  connectionStatus?: MemberConnectionStatus;
  connectionDate?: string | null;
  connectionMethod?: string | null;
  exclusionReason?: string | null;
  excludedAt?: string | null;
  lastContactAt?: string | null;
  lastContactStatus?: 'LINK_GENERATED' | 'SENT' | null;
  lastContactNote?: string | null;
}

export interface AdminOverviewMetrics {
  totalDrafts: number;
  totalOpenGroups: number;
  totalTargetReached: number;
  totalWaitlistPending: number;
  totalQuotesAwaitingReview: number;
  totalMemberResponsesPending: number;
  totalFeesPendingVerification: number;
  totalConnectionsPending: number;
  totalCompletedGroups: number;
  totalArchivedGroups: number;
}

export interface PoolRequest {
  id: string;
  productName: string;
  category: PoolCategory | null;
  categoryName?: string | null;
  brandPreference?: string | null;
  modelPreference?: string | null;
  city: string;
  fullName: string | null;
  whatsappNumber: string | null;
  extraMessage: string;
  status: PoolRequestStatus;
  adminNotes?: string | null;
  resultingPoolId?: string | null;
  conversionStatus?: 'PENDING' | 'CONVERTED' | 'DISMISSED';
  similarRequestCount?: number;
  createdAt: string;
  reviewedAt: string | null;
  // MVP Additions
  state?: string | null;
  locality?: string | null;
  pinCode?: string | null;
  requirementsSummary?: string | null;
  targetBuyersRequested?: number | null;
  requestedDeadline?: string | null;
  contactConsent?: boolean;
  consentAt?: string | null;
  requestType?: PoolRequestType;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actor: string;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Blog CMS post entity */
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // Markdown formatted
  author: string;
  topic: string;
  tags: string[];
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sources?: string[];
  editorialNotes?: string | null;
}

export interface PoolFilters {
  citySlug?: string | 'all';
  categorySlug?: string | 'all';
  search?: string;
}

export interface AdminLeadFilters {
  poolId?: string;
  city?: string;
  buyingTimeline?: BuyingTimeline;
  hasExistingQuote?: boolean;
  status?: LeadStatus;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
