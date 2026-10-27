import { NextResponse } from 'next/server';
import { getOperationalCities } from '@/lib/cities';

export async function GET() {
  try {
    const cities = await getOperationalCities();
    return NextResponse.json(
      { success: true, data: cities },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: error.message || 'Failed to fetch cities' } },
      { status: 500 }
    );
  }
}
