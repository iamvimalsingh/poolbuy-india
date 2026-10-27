import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import {
  buildWhatsAppDirectUrl,
  buildUnlockedPoolMessage,
  buildLeadFallbackMessage,
  buildQuoteFollowupMessage,
} from '@/lib/whatsapp';
import { AdminPool } from '@/types';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ leadId: string }>;
};

const whatsappRequestSchema = z.object({
  templateType: z.enum(['UNLOCKED_TOKEN', 'LEAD_FALLBACK', 'QUOTE_FOLLOWUP']),
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
            message: 'Invalid template selection. Choose UNLOCKED_TOKEN, LEAD_FALLBACK, or QUOTE_FOLLOWUP.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { templateType } = parsed.data;

    let buyerName = 'Valued Buyer';
    let buyerPhone = '9876543210';
    let poolName = 'Electric Scooter Group Deal';
    let cityName = 'Bhopal';
    let pool: AdminPool | null = null;

    if (!isDemoMode()) {
      const supabase = getAdminSupabase();

      // Fetch lead and associated pool
      const { data: leadData, error: leadError } = await supabase
        .from('pool_leads')
        .select(`
          id,
          full_name,
          whatsapp_number,
          city,
          pool_id,
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

      buyerName = leadData.full_name;
      buyerPhone = leadData.whatsapp_number;
      cityName = leadData.city;

      const p = leadData.pools as unknown as Record<string, unknown>;
      if (p) {
        poolName = String(p.name || '');
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
          targetBuyers: Number(p.target_buyers),
          currentBuyers: Number(p.current_buyers),
          deadline: String(p.deadline),
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
    }

    let messageText = '';

    if (templateType === 'UNLOCKED_TOKEN') {
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

        messageText = buildUnlockedPoolMessage(
          buyerName,
          pool,
          pool.tokenPaymentUrl,
          pool.tokenAmount
        );
      } else {
        messageText = `Namaste ${buyerName},\n\n[DEMO] The group pool for ${poolName} is unlocked! Complete your refundable token deposit: https://example.com/demo-pay`;
      }
    } else if (templateType === 'LEAD_FALLBACK') {
      messageText = buildLeadFallbackMessage(buyerName, poolName, cityName, pool?.dealerName || undefined);
    } else {
      // QUOTE_FOLLOWUP
      messageText = buildQuoteFollowupMessage(buyerName, poolName, cityName);
    }

    const whatsappUrl = buildWhatsAppDirectUrl(buyerPhone, messageText);

    return NextResponse.json(
      {
        success: true,
        data: {
          whatsappUrl,
          messageText,
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
