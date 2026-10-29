import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ citySlug: string }>;
}

export default async function CitiesRedirectPage({ params }: Props) {
  const { citySlug } = await params;
  redirect(`/city/${citySlug}`);
}

