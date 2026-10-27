import type { Metadata } from 'next';
import { AdminLoginForm } from '@/components/admin-login-form';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4">
      <AdminLoginForm />
    </div>
  );
}
