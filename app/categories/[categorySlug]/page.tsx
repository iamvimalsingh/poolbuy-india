import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ categorySlug: string }>;
}

export default async function CategoriesRedirectPage({ params }: Props) {
  const { categorySlug } = await params;
  redirect(`/category/${categorySlug}`);
}

