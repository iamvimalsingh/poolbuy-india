import { NextResponse } from 'next/server';
import { INDIA_LOCATION_DIRECTORY, getAllStatesSummary } from '@/lib/location-directory';
import { getOperationalCities } from '@/lib/cities';


/**
 * Public location directory endpoint.
 * Returns all 28 States and 8 Union Territories with selectable urban centres,
 * honest place types, and operational availability states.
 */
export async function GET() {
  const operationalCities = await getOperationalCities();
  const operationalSlugs = new Set(operationalCities.map((c) => c.slug));

  const states = INDIA_LOCATION_DIRECTORY.map((s) => ({
    code: s.code,
    name: s.name,
    slug: s.slug,
    type: s.type,
    cities: s.cities.map((c) => ({
      name: c.name,
      slug: c.slug,
      placeType: c.placeType,
      isOperational: operationalSlugs.has(c.slug),
      availabilityState: operationalSlugs.has(c.slug) ? 'ACTIVE' : c.availabilityState,
    })),
  }));

  const statesSummary = getAllStatesSummary();

  return NextResponse.json({
    success: true,
    data: {
      totalStates: 28,
      totalUnionTerritories: 8,
      statesSummary,
      states,
    },
  });
}
