import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { PoolRequest } from '@/types';
import { getDemoRequests } from '@/lib/mock-data';

function computeSimilarityKey(productName: string, city: string): string {
  const normCity = city.trim().toLowerCase();
  // Normalize product name to first 2 significant words
  const words = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const keyProduct = words.slice(0, 2).join(' ') || productName.toLowerCase().trim();
  return `${normCity}:::${keyProduct}`;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    let requests: PoolRequest[] = [];

    if (isDemoMode()) {
      requests = getDemoRequests();
    } else {
      const supabase = getAdminSupabase();
      if (!supabase) {
        requests = getDemoRequests();
      } else {
        const { data, error } = await supabase
          .from('pool_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: error.message } },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
          );
        }

        requests = (data || []).map((row) => ({
          id: row.id,
          productName: row.product_name,
          category: row.category,
          categoryName: row.category_name,
          brandPreference: row.brand_preference,
          modelPreference: row.model_preference,
          city: row.city,
          fullName: row.full_name,
          whatsappNumber: row.whatsapp_number,
          extraMessage: row.extra_message || '',
          status: row.status,
          adminNotes: row.admin_notes || '',
          resultingPoolId: row.resulting_pool_id,
          conversionStatus: row.conversion_status || 'PENDING',
          createdAt: row.created_at,
          reviewedAt: row.reviewed_at,
        }));
      }
    }

    // Compute frequency counts for product/city clusters
    const clusterCounts = new Map<string, number>();
    for (const r of requests) {
      const key = computeSimilarityKey(r.productName, r.city);
      clusterCounts.set(key, (clusterCounts.get(key) || 0) + 1);
    }

    const enriched = requests.map((r) => {
      const key = computeSimilarityKey(r.productName, r.city);
      return {
        ...r,
        similarRequestCount: clusterCounts.get(key) || 1,
      };
    });

    // Handle optional search & filter params
    const { searchParams } = new URL(request.url);
    const filterCity = searchParams.get('city');
    const filterStatus = searchParams.get('status');
    const filterCategory = searchParams.get('category');
    const searchQuery = searchParams.get('search')?.toLowerCase().trim();

    let filtered = enriched;
    if (filterCity && filterCity !== 'all') {
      filtered = filtered.filter(
        (r) => r.city.toLowerCase() === filterCity.toLowerCase()
      );
    }
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    if (filterCategory && filterCategory !== 'all') {
      filtered = filtered.filter(
        (r) =>
          r.category === filterCategory ||
          r.categoryName?.toLowerCase() === filterCategory.toLowerCase()
      );
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.productName.toLowerCase().includes(searchQuery) ||
          r.city.toLowerCase().includes(searchQuery) ||
          (r.fullName && r.fullName.toLowerCase().includes(searchQuery)) ||
          (r.extraMessage && r.extraMessage.toLowerCase().includes(searchQuery))
      );
    }

    return NextResponse.json(
      { success: true, data: filtered },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to list requests.' },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
