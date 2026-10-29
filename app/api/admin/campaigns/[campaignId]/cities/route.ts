import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { addCityToCampaign } from '@/lib/campaigns';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    const json = await request.json();

    if (!json.cityName || typeof json.cityName !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'City name is required.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const pool = await addCityToCampaign(campaignId, {
      cityName: json.cityName.trim(),
      citySlug: json.citySlug ? json.citySlug.trim() : json.cityName.trim(),
      targetBuyers: json.targetBuyers ? Number(json.targetBuyers) : undefined,
      deadline: json.deadline,
    });

    await recordAdminAudit({
      action: 'CAMPAIGN_CITY_ADDED',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      changesSummary: `Added city pool in ${pool.city} (ID: ${pool.id}) to campaign ${campaignId}.`,
      details: { poolId: pool.id, city: pool.city },
    });

    return NextResponse.json(
      { success: true, data: pool },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    const msg = e.message || 'Failed to add city to campaign.';
    const isClient = msg.includes('CITY_') || msg.includes('CAMPAIGN_NOT_FOUND');
    return NextResponse.json(
      { success: false, error: { code: isClient ? 'INVALID_INPUT' : 'INTERNAL_ERROR', message: msg } },
      { status: isClient ? 400 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

