import { NextResponse } from 'next/server';
import { getOperationalCategories } from '@/lib/categories';

export async function GET() {
  try {
    const categories = await getOperationalCategories();
    return NextResponse.json(
      { success: true, data: categories },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: error.message || 'Failed to fetch categories' } },
      { status: 500 }
    );
  }
}
