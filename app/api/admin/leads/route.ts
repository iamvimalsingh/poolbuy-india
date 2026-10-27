import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminLeads, updateLeadStatus } from '@/lib/leads';
import { AdminLeadFilters, BuyingTimeline, LeadStatus } from '@/types';
import { leadStatusEnum } from '@/lib/validation';
import { z } from 'zod';

const patchLeadSchema = z.object({
  leadId: z.string().min(1),
  status: leadStatusEnum,
});

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const poolId = url.searchParams.get('poolId') || undefined;
    const city = url.searchParams.get('city') || undefined;
    const buyingTimeline = (url.searchParams.get('buyingTimeline') as BuyingTimeline) || undefined;
    const hasExistingQuoteParam = url.searchParams.get('hasExistingQuote');
    const hasExistingQuote =
      hasExistingQuoteParam === 'true'
        ? true
        : hasExistingQuoteParam === 'false'
        ? false
        : undefined;
    const status = (url.searchParams.get('status') as LeadStatus) || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const filters: AdminLeadFilters = {
      poolId,
      city,
      buyingTimeline,
      hasExistingQuote,
      status,
      search,
      page,
      pageSize,
    };

    const result = await getAdminLeads(filters);

    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to fetch leads.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const json = await request.json();
    const parsed = patchLeadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Invalid status.' },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await updateLeadStatus(parsed.data.leadId, parsed.data.status);

    return NextResponse.json(
      { success: true, data: { updated: true } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to update lead status.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
