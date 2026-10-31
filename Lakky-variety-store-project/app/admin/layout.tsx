'use client';

// One admin menu (sidebar on laptop, wrapped buttons on phone) for every admin
// page, so "Customers" is always reachable. The login page stays bare.
import { usePathname } from 'next/navigation';
import AdminShell from './shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '';
  if (path.startsWith('/admin/login')) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
