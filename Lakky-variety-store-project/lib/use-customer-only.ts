'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAdmin } from './admin-guard';

// Customer pages only: a signed-in owner/staff member is sent to Orders.
// Shoppers are unaffected.
export function useCustomerOnly() {
  const router = useRouter();
  useEffect(() => {
    checkAdmin(['admin', 'staff']).then((r: any) => {
      if (r && r.ok) router.replace('/admin');
    }).catch(() => {});
  }, [router]);
}
