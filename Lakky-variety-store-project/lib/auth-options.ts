import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { authTables, db as dbType } from './db';

// Shared Better Auth options (no Next.js imports — safe for scripts + server).
// Single admin email+password. Customers have NO accounts.
export function authOptions(database: typeof dbType, tables: typeof authTables): BetterAuthOptions {
  return {
    database: drizzleAdapter(database, { provider: 'pg', schema: tables }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'customer', input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 12 },
  };
}
