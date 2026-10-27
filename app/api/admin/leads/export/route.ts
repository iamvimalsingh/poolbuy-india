import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getLeadsForExport } from '@/lib/leads';
import { generateCsv } from '@/lib/csv';
import { BuyingTimeline, LeadStatus } from '@/types';
import { formatDateTime } from '@/lib/format';

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const leads = await getLeadsForExport({
      poolId,
      city,
      buyingTimeline,
      hasExistingQuote,
      status,
      search,
    });

    const headers = [
      'Registration Date',
      'Pool Name',
      'Pool Slug',
      'Buyer #',
      'Full Name',
      'WhatsApp Number',
      'City',
      'Buying Timeline',
      'Has Quote',
      'Quote Amount (INR)',
      'Buyer Note / Variant',
      'Lead Status',
      'Consent Recorded At',
    ];

    const rows = leads.map((lead) => [
      formatDateTime(lead.createdAt),
      lead.poolName,
      lead.poolSlug,
      lead.buyerNumber,
      lead.fullName,
      lead.whatsappNumber,
      lead.city,
      lead.buyingTimeline,
      lead.hasExistingQuote ? 'Yes' : 'No',
      lead.existingQuoteAmount !== null ? lead.existingQuoteAmount : '',
      lead.extraMessage,
      lead.status,
      formatDateTime(lead.consentAt),
    ]);

    const csvContent = generateCsv(headers, rows);
    const today = new Date().toISOString().split('T')[0];
    const filename = `poolbuy-leads-${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('CSV Export Error:', err.message);
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_FAILED', message: 'Failed to generate CSV export.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
