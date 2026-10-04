'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAdmin } from './admin-guard';

// Redirects non-admins to /admin/login. Returns true once admin is confirmed.
export function useAdminGuard(): boolean {
  const [ok, setOk] = useState(false);
  const router = useRouter();
  useEffect(() => {
    checkAdmin().then((r) => {
      if (!r.ok) router.replace('/admin/login');
      else setOk(true);
    });
  }, [router]);
  return ok;
}
