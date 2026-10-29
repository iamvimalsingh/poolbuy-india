import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import {
  getAllCampaigns,
  createCampaign,
  CreateCampaignInput,
  DuplicateCampaignSlugError,
} from '@/lib/campaigns';
import { recordAdminAudit } from '@/lib/audit';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const categorySlug = searchParams.get('categorySlug') || undefined;
    const status = searchParams.get('status') || undefined;
    const citySlug = searchParams.get('citySlug') || undefined;

    const campaigns = await getAllCampaigns({
      search,
      categorySlug,
      status,
      citySlug,
    });

    return NextResponse.json(
      { success: true, data: campaigns },
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const json = await request.json();

    if (!json.title || typeof json.title !== 'string' || !json.title.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Campaign title is required.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!json.categorySlug || typeof json.categorySlug !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Valid category is required.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!json.cities || !Array.isArray(json.cities) || json.cities.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CITIES_SELECTED', message: 'At least one operational city must be selected.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const input: CreateCampaignInput = {
      title: json.title.trim(),
      slug: json.slug?.trim(),
      categorySlug: json.categorySlug.trim(),
      categoryName: json.categoryName?.trim(),
      brand: json.brand?.trim(),
      model: json.model?.trim(),
      variantName: json.variantName?.trim(),
      shortDescription: json.shortDescription?.trim(),
      longDescription: json.longDescription?.trim(),
      imageUrl: json.imageUrl,
      defaultMarketPrice: json.defaultMarketPrice ? Number(json.defaultMarketPrice) : null,
      defaultGroupPrice: json.defaultGroupPrice ? Number(json.defaultGroupPrice) : null,
      defaultTargetBuyers: json.defaultTargetBuyers ? Number(json.defaultTargetBuyers) : 10,
      defaultMaxWaitlistSize: json.defaultMaxWaitlistSize ? Number(json.defaultMaxWaitlistSize) : 50,
      status: json.status || 'ACTIVE',
      isPublished: json.isPublished !== undefined ? Boolean(json.isPublished) : true,
      cities: json.cities,
      defaultDeadline: json.defaultDeadline,
    };

    const result = await createCampaign(input);

    await recordAdminAudit({
      action: 'CAMPAIGN_CREATED',
      targetType: 'CAMPAIGN',
      targetId: result.campaign.id,
      changesSummary: `Created campaign "${result.campaign.title}" across ${result.pools.length} cities (${result.pools.map((p) => p.city).join(', ')}).`,
      details: {
        campaignId: result.campaign.id,
        poolsCount: result.pools.length,
        cities: result.pools.map((p) => p.city),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          campaign: result.campaign,
          pools: result.pools,
          alreadyExisted: result.alreadyExisted,
        },
      },
      { status: result.alreadyExisted ? 200 : 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    if (err instanceof DuplicateCampaignSlugError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const e = err as { message?: string };
    const msg = e.message || 'Failed to create campaign.';
    const isClientError =
      msg.includes('CATEGORY_') ||
      msg.includes('CITY_') ||
      msg.includes('NO_CITIES_');

    return NextResponse.json(
      { success: false, error: { code: isClientError ? 'INVALID_INPUT' : 'INTERNAL_ERROR', message: msg } },
      { status: isClientError ? 400 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

