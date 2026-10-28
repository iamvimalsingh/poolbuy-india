import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { DEMO_LEADS, MOCK_ADMIN_POOLS } from '@/lib/mock-data';
import {
  buildWhatsAppDirectUrl,
  buildUnlockedPoolMessage,
  buildLeadFallbackMessage,
  buildQuoteFollowupMessage,
  buildTargetReachedMessage,
  buildGroupPublishedMessage,
  buildQuoteAvailableMessage,
  buildResponseReminderMessage,
  buildConnectionFeeDisclosureMessage,
  buildPaymentInstructionsMessage,
  buildWaitlistInvitationMessage,
  buildWaitlistPromotionMessage,
  buildExclusionNoticeMessage,
  buildGroupCompletedMessage,
  buildOptOutConfirmationMessage,
} from '@/lib/whatsapp';
import { AdminPool, WhatsAppTemplateType } from '@/types';
import { whatsAppTemplateTypeEnum } from '@/lib/validation';
import { calculateSuggestedConnectionFee } from '@/lib/fee';
import { recordAdminAudit } from '@/lib/audit';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ leadId: string }>;
};

const whatsappRequestSchema = z
  .object({
    templateType: whatsAppTemplateTypeEnum.optional(),
    template: whatsAppTemplateTypeEnum.optional(),
    customNote: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.templateType || data.template, {
    message: 'Template selection is required.',
  });

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { leadId } = await context.params;
    const json = await request.json();
    const parsed = whatsappRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid template selection.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const templateType = (parsed.data.templateType || parsed.data.template)! as WhatsAppTemplateType;
    const now = new Date().toISOString();

    let buyerName = 'Valued Buyer';
    let buyerPhone = '9876543210';
    let poolName = 'Electric Scooter Group Deal';
    let cityName = 'Bhopal';
    let targetBuyers = 10;
    let deadline = new Date(Date.now() + 14 * 86400000).toISOString();
    let groupPrice = 0;
    let feeBasis = 0;
    let buyerNumber = 1;
    let pool: AdminPool | null = null;

    if (isDemoMode()) {
      const demoLead = DEMO_LEADS.find((l) => l.id === leadId);
      if (!demoLead) {
        return NextResponse.json(
          { success: false, error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found in demo records.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const hasOptedOut = Boolean(demoLead.doNotContact) || demoLead.status === 'DO_NOT_CONTACT';
      const hasConsent = Boolean(demoLead.consentAt);

      if (hasOptedOut || !hasConsent) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONTACT_OPTED_OUT',
              message: !hasConsent
                ? 'Lead has not provided contact consent.'
                : 'Lead has opted out of direct contact or is marked DO_NOT_CONTACT.',
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      buyerName = demoLead.fullName;
      buyerPhone = demoLead.whatsappNumber;
      cityName = demoLead.city;
      poolName = demoLead.poolName;
      buyerNumber = demoLead.buyerNumber;
      pool = MOCK_ADMIN_POOLS.find((p) => p.id === demoLead.poolId) || null;
      if (pool) {
        targetBuyers = pool.targetBuyers;
        deadline = pool.deadline;
        groupPrice = pool.groupPrice || pool.marketPrice || 0;
        feeBasis = pool.groupPrice || pool.marketPrice || 0;
      }

      // Record link generated status
      demoLead.lastContactAt = now;
      demoLead.lastContactStatus = 'LINK_GENERATED';
      demoLead.lastContactNote = `Generated ${templateType} link.`;
    } else {
      const db = await requireD1Database();

      const leadData = await db
        .prepare(
          `SELECT l.id, l.full_name, l.whatsapp_number, l.city, l.pool_id, l.buyer_number,
                  l.status, l.do_not_contact, l.consent_at,
                  p.id AS p_id, p.slug AS p_slug, p.name AS p_name, p.short_description AS p_short_description,
                  p.long_description AS p_long_description, p.category AS p_category, p.city AS p_city,
                  p.city_slug AS p_city_slug, p.product_brand AS p_product_brand, p.product_model AS p_product_model,
                  p.image_url AS p_image_url, p.market_price AS p_market_price, p.group_price AS p_group_price,
                  p.target_buyers AS p_target_buyers, p.current_buyers AS p_current_buyers, p.deadline AS p_deadline,
                  p.status AS p_status, p.price_is_verified AS p_price_is_verified, p.price_verified_at AS p_price_verified_at,
                  p.created_at AS p_created_at, p.updated_at AS p_updated_at, p.dealer_name AS p_dealer_name,
                  p.token_amount AS p_token_amount, p.token_payment_url AS p_token_payment_url,
                  p.dealer_offer_url AS p_dealer_offer_url, p.dealer_terms AS p_dealer_terms
           FROM pool_leads l
           LEFT JOIN pools p ON l.pool_id = p.id
           WHERE l.id = ?`
        )
        .bind(leadId)
        .first<Record<string, unknown>>();

      if (!leadData) {
        return NextResponse.json(
          { success: false, error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const hasOptedOut = Boolean(leadData.do_not_contact) || leadData.status === 'DO_NOT_CONTACT';
      const hasConsent = Boolean(leadData.consent_at);

      if (hasOptedOut || !hasConsent) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONTACT_OPTED_OUT',
              message: !hasConsent
                ? 'Lead has not provided contact consent.'
                : 'Lead has opted out of direct contact or is marked DO_NOT_CONTACT.',
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      buyerName = String(leadData.full_name || 'Valued Buyer');
      buyerPhone = String(leadData.whatsapp_number || '');
      cityName = String(leadData.city || '');
      buyerNumber = Number(leadData.buyer_number || 1);

      if (leadData.p_id) {
        poolName = String(leadData.p_name || '');
        targetBuyers = Number(leadData.p_target_buyers || 10);
        deadline = String(leadData.p_deadline || '');
        groupPrice = Number(leadData.p_group_price || leadData.p_market_price || 0);
        feeBasis = Number(leadData.p_group_price || leadData.p_market_price || 0);
        pool = {
          id: String(leadData.p_id),
          slug: String(leadData.p_slug),
          name: String(leadData.p_name),
          shortDescription: String(leadData.p_short_description || ''),
          longDescription: String(leadData.p_long_description || ''),
          category: leadData.p_category as AdminPool['category'],
          city: String(leadData.p_city),
          citySlug: String(leadData.p_city_slug),
          productBrand: String(leadData.p_product_brand || ''),
          productModel: String(leadData.p_product_model || ''),
          imageUrl: (leadData.p_image_url as string) || null,
          marketPrice: leadData.p_market_price ? Number(leadData.p_market_price) : null,
          groupPrice: leadData.p_group_price ? Number(leadData.p_group_price) : null,
          targetBuyers,
          currentBuyers: Number(leadData.p_current_buyers),
          deadline,
          status: leadData.p_status as AdminPool['status'],
          priceIsVerified: Boolean(leadData.p_price_is_verified),
          priceVerifiedAt: (leadData.p_price_verified_at as string) || null,
          createdAt: String(leadData.p_created_at),
          updatedAt: String(leadData.p_updated_at),
          dealerName: (leadData.p_dealer_name as string) || null,
          tokenAmount: leadData.p_token_amount ? Number(leadData.p_token_amount) : null,
          tokenPaymentUrl: (leadData.p_token_payment_url as string) || null,
          dealerOfferUrl: (leadData.p_dealer_offer_url as string) || null,
          dealerTerms: (leadData.p_dealer_terms as string) || null,
        };
      }

      // Record link generated status
      await db
        .prepare(
          `UPDATE pool_leads
           SET last_contact_at = ?,
               last_contact_status = 'LINK_GENERATED',
               last_contact_note = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(now, `Generated ${templateType} link.`, now, leadId)
        .run();
    }

    if (templateType === 'CONNECTION_FEE_DISCLOSURE' && (!feeBasis || feeBasis <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FEE_BASIS_REQUIRED',
            message: 'Connection fee disclosure requires an approved group quotation or price basis set on the pool.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let messageText = '';

    switch (templateType) {
      case 'UNLOCKED_TOKEN': {
        if (!isDemoMode()) {
          if (!pool || pool.status !== 'UNLOCKED' || !pool.tokenPaymentUrl || !pool.tokenAmount) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'POOL_NOT_UNLOCKED',
                  message:
                    'Cannot generate refundable token link: pool must be UNLOCKED with a verified payment URL and token deposit amount.',
                },
              },
              { status: 400, headers: { 'Cache-Control': 'no-store' } }
            );
          }
          messageText = buildUnlockedPoolMessage(buyerName, pool, pool.tokenPaymentUrl, pool.tokenAmount);
        } else {
          messageText = `Namaste ${buyerName},\n\n[DEMO] The group pool for ${poolName} is unlocked! Complete your refundable token deposit: https://example.com/demo-pay`;
        }
        break;
      }
      case 'LEAD_FALLBACK':
        messageText = buildLeadFallbackMessage(buyerName, poolName, cityName, pool?.dealerName || undefined);
        break;
      case 'TARGET_REACHED_INVITATION':
        messageText = buildTargetReachedMessage(buyerName, poolName, cityName, targetBuyers);
        break;
      case 'QUOTE_FOLLOWUP':
        messageText = buildQuoteFollowupMessage(buyerName, poolName, cityName);
        break;
      case 'GROUP_PUBLISHED':
        messageText = buildGroupPublishedMessage(buyerName, poolName, cityName, targetBuyers, deadline);
        break;
      case 'QUOTE_AVAILABLE':
        messageText = buildQuoteAvailableMessage(buyerName, poolName, cityName, groupPrice, deadline);
        break;
      case 'RESPONSE_REMINDER':
        messageText = buildResponseReminderMessage(buyerName, poolName, cityName);
        break;
      case 'CONNECTION_FEE_DISCLOSURE': {
        const fee = calculateSuggestedConnectionFee(feeBasis);
        if (fee === null) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FEE_BASIS_REQUIRED',
                message: 'Connection fee calculation is disabled because no approved purchase value basis is set for this pool.',
              },
            },
            { status: 400 }
          );
        }
        messageText = buildConnectionFeeDisclosureMessage(buyerName, poolName, cityName, fee, feeBasis);
        break;
      }
      case 'PAYMENT_INSTRUCTIONS': {
        const fee = calculateSuggestedConnectionFee(feeBasis);
        if (fee === null) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FEE_BASIS_REQUIRED',
                message: 'Payment instructions cannot be generated because no approved purchase value basis is set for this pool.',
              },
            },
            { status: 400 }
          );
        }
        const details = 'UPI ID: pay.groupbuying@upi (GroupBuying Operations Account)\nBank: State Bank of India | IFSC: SBIN0001234';
        messageText = buildPaymentInstructionsMessage(buyerName, poolName, fee, details);
        break;
      }
      case 'WAITLIST_INVITATION':
        messageText = buildWaitlistInvitationMessage(buyerName, poolName, cityName, 1);
        break;
      case 'WAITLIST_PROMOTION':
        messageText = buildWaitlistPromotionMessage(buyerName, poolName, cityName, buyerNumber);
        break;
      case 'EXCLUSION_NOTICE':
        messageText = buildExclusionNoticeMessage(buyerName, poolName, cityName, 'Non-response after deadline.');
        break;
      case 'GROUP_COMPLETED':
        messageText = buildGroupCompletedMessage(buyerName, poolName, cityName);
        break;
      case 'OPT_OUT_CONFIRMATION':
        messageText = buildOptOutConfirmationMessage(buyerName, poolName);
        break;
      default:
        messageText = buildTargetReachedMessage(buyerName, poolName, cityName, targetBuyers);
    }

    const whatsappUrl = buildWhatsAppDirectUrl(buyerPhone, messageText);

    await recordAdminAudit({
      action: 'WHATSAPP_LINK_GENERATED',
      targetType: 'LEAD',
      targetId: leadId,
      changesSummary: `Generated WhatsApp link (${templateType}) for member #${buyerNumber} (${buyerName}).`,
      details: {
        leadId,
        buyerNumber,
        templateType,
        poolName,
        cityName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          whatsappUrl,
          url: whatsappUrl,
          messageText,
          recipientPhone: buyerPhone,
          templateType,
          clickToChatNotice:
            'Click-to-chat opens WhatsApp on your device. Review the message and press Send manually. Antigravity/GroupBuying never sends automated background messages.',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('WhatsApp URL construction error:', err.message);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to construct WhatsApp message link.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: false });
  if (authError) return authError;

  const url = new URL(request.url);
  const template =
    url.searchParams.get('template') ||
    url.searchParams.get('templateType') ||
    'TARGET_REACHED_INVITATION';
  const customNote = url.searchParams.get('customNote') || undefined;

  const dummyRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ template, customNote }),
  });
  return POST(dummyRequest, context);
}
