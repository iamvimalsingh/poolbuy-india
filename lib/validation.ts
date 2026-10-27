import { z } from 'zod';
import { normalizePhone, isValidIndianMobile } from './format';
export { normalizePhone, isValidIndianMobile };

export const buyingTimelineEnum = z.enum([
  'THIS_MONTH',
  'WITHIN_1_3_MONTHS',
  'WITHIN_3_6_MONTHS',
  'JUST_EXPLORING',
  // Backward compatibility with legacy records:
  'WITHIN_7_DAYS',
  'WITHIN_15_DAYS',
  'WITHIN_30_45_DAYS',
]);

export const poolCategoryEnum = z.enum([
  'EV_SCOOTERS',
  'CARS',
  'ROOFTOP_SOLAR',
  'LAPTOPS',
  'SMART_TVS',
  'TRACTORS_COMMERCIAL',
]);

export const poolStatusEnum = z.enum([
  'ACTIVE',
  'UNLOCKED',
  'LEAD_FALLBACK',
  'CLOSED',
]);

export const leadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'DO_NOT_CONTACT',
]);

export const poolRequestStatusEnum = z.enum([
  'REQUESTED',
  'REVIEWING',
  'APPROVED',
  'REJECTED',
  'NEEDS_INFO',
]);

export const marketPriceTypeEnum = z.enum([
  'UNKNOWN',
  'INDICATIVE_ESTIMATE',
  'SOURCED_REFERENCE',
  'VERIFIED_COMPARABLE',
]);

export const groupPriceTypeEnum = z.enum([
  'UNKNOWN',
  'INDICATIVE_ESTIMATE',
  'VENDOR_QUOTED',
  'VENDOR_VERIFIED',
  'EXPIRED_WITHDRAWN',
]);

export const connectionStatusEnum = z.enum([
  'NOT_ELIGIBLE',
  'ADMIN_REVIEW_PENDING',
  'TERMS_PENDING',
  'PAYMENT_LINK_CONFIGURED',
  'PAYMENT_PENDING',
  'READY_TO_CONNECT',
  'COMPLETED',
  'CANCELLED',
]);

export const paymentConfigStateEnum = z.enum([
  'DISABLED',
  'MANUAL_NO_CHARGE',
  'EXTERNAL_LINK_CONFIGURED',
  'RECONCILED',
]);

/**
 * Validation schema for public buyer interest join submissions
 */
export const joinPoolSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: 'Full name must be at least 2 characters.' })
      .max(100, { message: 'Full name must not exceed 100 characters.' }),
    whatsappNumber: z
      .string()
      .transform((val) => normalizePhone(val))
      .refine((val) => isValidIndianMobile(val), {
        message: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      }),
    city: z
      .string()
      .trim()
      .min(2, { message: 'City must be at least 2 characters.' })
      .max(80, { message: 'City must not exceed 80 characters.' })
      .optional(),
    buyingTimeline: buyingTimelineEnum.optional().default('THIS_MONTH'),
    hasExistingQuote: z.boolean().default(false),
    existingQuoteAmount: z
      .number()
      .min(0, { message: 'Quote amount must be non-negative.' })
      .nullable()
      .optional(),
    extraMessage: z
      .string()
      .trim()
      .max(1000, { message: 'Note must not exceed 1,000 characters.' })
      .default(''),
    selectedKitOfferId: z.string().trim().max(100).optional(),
    connectionOptIn: z.boolean().default(false),
    vendorShareConsent: z.boolean().default(false),
    locality: z.string().trim().max(100).optional(),
    pinCode: z.string().trim().max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.hasExistingQuote && data.existingQuoteAmount !== null && data.existingQuoteAmount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Existing quote amount is only valid when hasExistingQuote is true.',
        path: ['existingQuoteAmount'],
      });
    }
  });

export type JoinPoolSchemaInput = z.infer<typeof joinPoolSchema>;

/**
 * Validation schema for Demand Discovery pool requests & group proposals
 */
export const poolRequestSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(2, { message: 'Product name must be at least 2 characters.' })
    .max(180, { message: 'Product name must not exceed 180 characters.' }),
  category: z.string().trim().max(80).nullable().optional(),
  categoryName: z.string().trim().max(100).nullable().optional(),
  brandPreference: z.string().trim().max(100).nullable().optional(),
  modelPreference: z.string().trim().max(100).nullable().optional(),
  city: z
    .string()
    .trim()
    .min(2, { message: 'City must be at least 2 characters.' })
    .max(80, { message: 'City must not exceed 80 characters.' }),
  state: z.string().trim().max(80).optional(),
  locality: z.string().trim().max(100).optional(),
  pinCode: z.string().trim().max(10).optional(),
  requirementsSummary: z.string().trim().max(1000).optional(),
  targetBuyersRequested: z.number().int().min(2).max(10000).optional(),
  requestedDeadline: z.string().optional(),
  contactConsent: z.boolean().default(true),
  requestType: z.enum(['GROUP_PROPOSAL', 'PRODUCT_SUGGESTION']).default('GROUP_PROPOSAL'),
  fullName: z
    .string()
    .trim()
    .max(100, { message: 'Full name must not exceed 100 characters.' })
    .nullable()
    .optional(),
  whatsappNumber: z
    .string()
    .optional()
    .transform((val) => (val ? normalizePhone(val) : ''))
    .refine((val) => val === '' || isValidIndianMobile(val), {
      message: 'Enter a valid 10-digit Indian mobile number, or leave blank.',
    }),
  extraMessage: z
    .string()
    .trim()
    .max(1000, { message: 'Note must not exceed 1,000 characters.' })
    .default(''),
});

export type PoolRequestSchemaInput = z.infer<typeof poolRequestSchema>;

/**
 * Validation schema for converting a community demand request into an operational pool
 */
export const convertRequestSchema = z.object({
  citySlug: z.string().trim().min(2).max(80),
  productSlug: z.string().trim().min(2).max(120).optional(),
  productName: z.string().trim().min(2).max(180),
  categorySlug: z.string().trim().min(2).max(80),
  productBrand: z.string().trim().min(1).max(80).default('Standardized Brand'),
  productModel: z.string().trim().min(1).max(80).default('Standardized Model'),
  shortDescription: z.string().trim().max(300).default(''),
  longDescription: z.string().trim().max(2000).default(''),
  marketPrice: z.number().min(0).nullable().optional(),
  groupPrice: z.number().min(0).nullable().optional(),
  targetBuyers: z.number().int().min(1).default(10),
  durationDays: z.number().int().min(1).max(180).default(14),
  dealerName: z.string().trim().max(120).nullable().optional(),
});

export type ConvertRequestSchemaInput = z.infer<typeof convertRequestSchema>;

/**
 * Validation schema for runtime dynamic categories
 */
export const categorySchema = z.object({
  label: z.string().trim().min(2, 'Category label must be at least 2 characters.').max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.'),
  description: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type CategorySchemaInput = z.infer<typeof categorySchema>;

/**
 * Validation schema for predefined kit offers
 */
export const kitOfferSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(60),
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  inclusions: z.array(z.string().trim()).default([]),
  exclusions: z.array(z.string().trim()).default([]),
  warranty: z.string().trim().max(120).default(''),
  marketPrice: z.number().min(0),
  groupPrice: z.number().min(0),
  subsidyEstimate: z.number().min(0).nullable().optional(),
  subsidyDisclaimer: z.string().trim().max(500).nullable().optional(),
  targetBuyers: z.number().int().min(1).default(10),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type KitOfferSchemaInput = z.infer<typeof kitOfferSchema>;

/**
 * Validation schema for blog post CMS
 */
export const blogPostSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters.').max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.'),
  excerpt: z.string().trim().min(10, 'Excerpt must be at least 10 characters.').max(500),
  content: z.string().trim().min(20, 'Content must be at least 20 characters.'),
  author: z.string().trim().min(2).max(100),
  topic: z.string().trim().min(2).max(60),
  tags: z.array(z.string().trim()).default([]),
  coverImageUrl: z.string().trim().url().nullable().optional(),
  coverImageAlt: z.string().trim().max(200).nullable().optional(),
  metaTitle: z.string().trim().max(120).nullable().optional(),
  metaDescription: z.string().trim().max(250).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  sources: z.array(z.string().trim()).optional(),
  editorialNotes: z.string().trim().max(1000).nullable().optional(),
});

export type BlogPostSchemaInput = z.infer<typeof blogPostSchema>;

/**
 * Validates HTTPS payment URLs
 */
export function isValidHttpsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
