import React from 'react';
import { connection } from 'next/server';
import { getPublicPools } from '@/lib/pools';
import { getOperationalCities } from '@/lib/cities';
import { getOperationalCategories } from '@/lib/categories';
import { HomepageView } from '@/components/homepage-view';

export default async function HomePage() {
  await connection();
  const [pools, operationalCities, operationalCategories] = await Promise.all([
    getPublicPools(),
    getOperationalCities(),
    getOperationalCategories(),
  ]);

  return (
    <HomepageView
      pools={pools}
      operationalCities={operationalCities}
      operationalCategories={operationalCategories}
    />
  );
}
