// Server-only Supabase connection (Drizzle + postgres-js, pooled mode).
// NEVER import this file from client components — it holds the connection string.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, sessions, accounts, verifications } from '../db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL missing — set it in .env.local (never commit it).');
}

// Transaction pooler (:6543) requires prepare:false
const client = postgres(connectionString, { prepare: false });
export const authTables = { user: users, session: sessions, account: accounts, verification: verifications };
export const db = drizzle(client, { schema: authTables });
