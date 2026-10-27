import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAuthenticatedAdmin } from '@/lib/admin-auth';
import { AdminDashboard } from '@/components/admin-dashboard';

export const metadata: Metadata = {
  title: 'Admin Command Center',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const isAuth = await isAuthenticatedAdmin();

  if (!isAuth) {
    redirect('/admin/login');
  }

  return <AdminDashboard />;
}
