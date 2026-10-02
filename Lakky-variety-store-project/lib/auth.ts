import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// Free OSS auth: single admin email+password. Customers have NO accounts.
// Phone is contact/matching ID only. Tracking = Order ID + matching phone.
export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(undefined as any, { provider: 'pg' }),
  session: { expiresIn: 60 * 60 * 12 },
});

export function requireAdmin(session: { user?: { role?: string } } | null) {
  if (!session?.user || (session.user as any).role !== 'admin') {
    const err: any = new Error('admin-only');
    err.status = 403;
    throw err;
  }
}
