import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignDependencies,
  CampaignDeletionBlockedError,
} from '@/lib/campaigns';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    const campaign = await getCampaignById(campaignId);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const dependencies = await getCampaignDependencies(campaign.id);

    return NextResponse.json(
      { success: true, data: { ...campaign, dependencies } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    const json = await request.json();

    const updated = await updateCampaign(campaignId, {
      ...(json.title !== undefined && { title: json.title }),
      ...(json.brand !== undefined && { brand: json.brand }),
      ...(json.model !== undefined && { model: json.model }),
      ...(json.variantName !== undefined && { variantName: json.variantName }),
      ...(json.shortDescription !== undefined && { shortDescription: json.shortDescription }),
      ...(json.longDescription !== undefined && { longDescription: json.longDescription }),
      ...(json.imageUrl !== undefined && { imageUrl: json.imageUrl }),
      ...(json.defaultMarketPrice !== undefined && { defaultMarketPrice: json.defaultMarketPrice ? Number(json.defaultMarketPrice) : null }),
      ...(json.defaultGroupPrice !== undefined && { defaultGroupPrice: json.defaultGroupPrice ? Number(json.defaultGroupPrice) : null }),
      ...(json.defaultTargetBuyers !== undefined && { defaultTargetBuyers: Number(json.defaultTargetBuyers) }),
      ...(json.defaultMaxWaitlistSize !== undefined && { defaultMaxWaitlistSize: Number(json.defaultMaxWaitlistSize) }),
      ...(json.status !== undefined && { status: json.status }),
      ...(json.isPublished !== undefined && { isPublished: Boolean(json.isPublished) }),
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'CAMPAIGN_UPDATED',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      changesSummary: `Updated campaign "${updated.title}". Status: ${updated.status}. Published: ${updated.isPublished}.`,
    });

    try {
      revalidatePath('/');
      revalidatePath('/categories');
      revalidatePath('/cities');
      if (updated.categorySlug) {
        revalidatePath(`/category/${updated.categorySlug}`);
      }
      if (updated.cityPools) {
        for (const pool of updated.cityPools) {
          if (pool.citySlug) {
            revalidatePath(`/city/${pool.citySlug}`);
            revalidatePath(`/deals/${pool.citySlug}/${pool.slug}`);
          }
        }
      }
    } catch (revalErr) {
      console.warn('Campaign update revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { campaignId } = await context.params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    const result = await deleteCampaign(campaignId, { hardDelete });

    await recordAdminAudit({
      action: hardDelete ? 'CAMPAIGN_HARD_DELETED' : 'CAMPAIGN_ARCHIVED',
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      changesSummary: hardDelete
        ? `Hard-deleted campaign ${campaignId} (zero dependent leads/requests).`
        : `Archived campaign ${campaignId} and its city pools.`,
    });

    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    if (err instanceof CampaignDeletionBlockedError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            dependencies: err.dependencies,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Failed to delete campaign.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

