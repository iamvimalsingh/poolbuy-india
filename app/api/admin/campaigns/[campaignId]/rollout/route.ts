import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { previewCampaignRollout, executeCampaignRollout } from '@/lib/campaigns';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

/**
 * GET: Previews bulk rollout across canonical 25 launch cities.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    const { searchParams } = new URL(request.url);
    const citySlugsParam = searchParams.get('citySlugs');
    const citySlugs = citySlugsParam ? citySlugsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const preview = await previewCampaignRollout(campaignId, citySlugs);

    return NextResponse.json(
      { success: true, data: preview },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    const msg = e.message || 'Failed to preview campaign rollout.';
    const isNotFound = msg.includes('CAMPAIGN_NOT_FOUND');
    return NextResponse.json(
      { success: false, error: { code: isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR', message: msg } },
      { status: isNotFound ? 404 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * POST: Idempotently executes bulk rollout across canonical launch cities.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    let json: { citySlugs?: string[]; activateOnlyIntended?: boolean } = {};
    try {
      json = await request.json();
    } catch {}

    const result = await executeCampaignRollout(campaignId, {
      citySlugs: json.citySlugs,
      activateOnlyIntended: json.activateOnlyIntended,
    });

    await recordAdminAudit({
      action: 'CAMPAIGN_BULK_ROLLOUT',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      changesSummary: `Executed bulk rollout for campaign "${result.campaignTitle}": ${result.createdCount} created, ${result.existingCount} already present, ${result.failedCount} failed/skipped.`,
      details: {
        totalRequested: result.totalRequested,
        createdCount: result.createdCount,
        existingCount: result.existingCount,
        failedCount: result.failedCount,
        cities: result.results.map((r) => ({ city: r.cityName, status: r.status })),
      },
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    const msg = e.message || 'Failed to execute campaign rollout.';
    const isNotFound = msg.includes('CAMPAIGN_NOT_FOUND');
    return NextResponse.json(
      { success: false, error: { code: isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR', message: msg } },
      { status: isNotFound ? 404 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
