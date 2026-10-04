import { betterAuth } from 'better-auth';
import { headers } from 'next/headers';
import { authTables, db } from './db';
import { authOptions } from './auth-options';

// v1.7 REAL wiring: single admin email+password. Customers have NO accounts.
// Phone stays contact/matching ID only. Tracking = Order ID + matching phone.
export const auth = betterAuth(authOptions(db, authTables));

// Server-side admin gate — call from server actions/layouts, never from client code.
export async function getAdminSession(): Promise<{ ok: boolean; email?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== 'admin') return { ok: false };
  return { ok: true, email: session.user.email };
}

export function requireAdmin(session: { user?: { role?: string } } | null) {
  if (!session?.user || (session.user as any).role !== 'admin') {
    const err: any = new Error('admin-only');
    err.status = 403;
    throw err;
  }
}
