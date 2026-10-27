import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
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
    let groupPrice = 130000;
    let feeBasis = 130000;
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

      if (demoLead.doNotContact || demoLead.status === 'DO_NOT_CONTACT') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONTACT_OPTED_OUT',
              message: 'Lead has opted out of direct contact or is marked DO_NOT_CONTACT.',
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
        groupPrice = pool.groupPrice || 130000;
        feeBasis = pool.groupPrice || pool.marketPrice || 130000;
      }

      // Record link generated status
      demoLead.lastContactAt = now;
      demoLead.lastContactStatus = 'LINK_GENERATED';
      demoLead.lastContactNote = `Generated ${templateType} link.`;
    } else {
      const supabase = getAdminSupabase();

      const { data: leadData, error: leadError } = await supabase
        .from('pool_leads')
        .select(`
          id,
          full_name,
          whatsapp_number,
          city,
          pool_id,
          buyer_number,
          status,
          do_not_contact,
          pools (*)
        `)
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !leadData) {
        return NextResponse.json(
          { success: false, error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (leadData.do_not_contact || leadData.status === 'DO_NOT_CONTACT') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONTACT_OPTED_OUT',
              message: 'Lead has opted out of direct contact or is marked DO_NOT_CONTACT.',
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      buyerName = leadData.full_name;
      buyerPhone = leadData.whatsapp_number;
      cityName = leadData.city;
      buyerNumber = Number(leadData.buyer_number || 1);

      const p = leadData.pools as unknown as Record<string, unknown>;
      if (p) {
        poolName = String(p.name || '');
        targetBuyers = Number(p.target_buyers || 10);
        deadline = String(p.deadline || '');
        groupPrice = Number(p.group_price || 130000);
        feeBasis = Number(p.group_price || p.market_price || 130000);
        pool = {
          id: String(p.id),
          slug: String(p.slug),
          name: String(p.name),
          shortDescription: String(p.short_description || ''),
          longDescription: String(p.long_description || ''),
          category: p.category as AdminPool['category'],
          city: String(p.city),
          citySlug: String(p.city_slug),
          productBrand: String(p.product_brand || ''),
          productModel: String(p.product_model || ''),
          imageUrl: (p.image_url as string) || null,
          marketPrice: p.market_price ? Number(p.market_price) : null,
          groupPrice: p.group_price ? Number(p.group_price) : null,
          targetBuyers,
          currentBuyers: Number(p.current_buyers),
          deadline,
          status: p.status as AdminPool['status'],
          priceIsVerified: Boolean(p.price_is_verified),
          priceVerifiedAt: (p.price_verified_at as string) || null,
          createdAt: String(p.created_at),
          updatedAt: String(p.updated_at),
          dealerName: (p.dealer_name as string) || null,
          tokenAmount: p.token_amount ? Number(p.token_amount) : null,
          tokenPaymentUrl: (p.token_payment_url as string) || null,
          dealerOfferUrl: (p.dealer_offer_url as string) || null,
          dealerTerms: (p.dealer_terms as string) || null,
        };
      }

      // Record link generated status
      await supabase
        .from('pool_leads')
        .update({
          last_contact_at: now,
          last_contact_status: 'LINK_GENERATED',
          last_contact_note: `Generated ${templateType} link.`,
        })
        .eq('id', leadId);
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
        messageText = buildConnectionFeeDisclosureMessage(buyerName, poolName, cityName, fee, feeBasis);
        break;
      }
      case 'PAYMENT_INSTRUCTIONS': {
        const fee = calculateSuggestedConnectionFee(feeBasis);
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
