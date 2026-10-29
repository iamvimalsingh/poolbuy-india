import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ citySlug: string; categorySlug: string }>;
}

export default async function CitiesCategoryRedirectPage({ params }: Props) {
  const { citySlug, categorySlug } = await params;
  redirect(`/city/${citySlug}/${categorySlug}`);
}

