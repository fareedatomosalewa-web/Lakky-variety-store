import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { authTables, db as dbType } from './db';

// Shared Better Auth options (no Next.js imports — safe for scripts + server).
// Single admin email+password. Customers have NO accounts.
export function authOptions(database: typeof dbType, tables: typeof authTables): BetterAuthOptions {
  return {
    database: drizzleAdapter(database, { provider: 'pg', schema: tables }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    // Vercel Preview builds get a new hostname on every deploy. These are the
    // shop's own projects under the lvs12 team — deliberately NOT a blanket
    // "*.vercel.app" wildcard, so another team's site is never trusted.
    trustedOrigins: [
      'http://localhost:3000',
      'https://lakky-variety-store-*-lvs12.vercel.app',
      'https://lakky-variety-store-chgs.vercel.app',
      'https://lakky-variety-store.vercel.app',
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ],
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'customer', input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 12 },
  };
}
