/**
 * Resolves the appropriate brand-compatible category fallback illustration.
 * Guarantees a clean, local SVG fallback is always available offline without broken images.
 */
export function getPoolFallbackImage(
  category?: string | null,
  categorySlug?: string | null,
  slugOrName?: string | null
): string {
  const normCategory = (category || '').toUpperCase();
  const normSlug = (categorySlug || '').toLowerCase();
  const normName = (slugOrName || '').toLowerCase();

  // 1. Direct categorySlug matches
  if (normSlug === 'home-power-backup' || normName.includes('power-backup') || normName.includes('inverter')) {
    return '/images/power-backup-default.svg';
  }

  if (normSlug === 'water-softeners' || normSlug === 'water-softener' || normName.includes('water-softener') || normName.includes('softener')) {
    return '/images/water-softener-default.svg';
  }

  if (normSlug === 'rooftop-solar' || normCategory === 'ROOFTOP_SOLAR') {
    // Check if the specific solar-categorized product is actually a power backup or water softener package
    if (normName.includes('backup') || normName.includes('battery') || normName.includes('inverter')) {
      return '/images/power-backup-default.svg';
    }
    if (normName.includes('softener') || normName.includes('water')) {
      return '/images/water-softener-default.svg';
    }
    return '/images/solar-default.svg';
  }

  if (normCategory === 'EV_SCOOTERS' || normSlug === 'ev-scooters') {
    return '/images/ev-scooters-default.svg';
  }

  if (normCategory === 'CARS' || normSlug === 'cars') {
    return '/images/cars-default.svg';
  }

  if (normCategory === 'LAPTOPS' || normSlug === 'laptops') {
    return '/images/laptops-default.svg';
  }

  return '/images/pool-default.svg';
}
