// Server-only Supabase connection (Drizzle + postgres-js, pooled mode).
// NEVER import this file from client components — it holds the connection string.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, sessions, accounts, verifications } from '../db/schema';

// Be tolerant during build-time checks and CI when DATABASE_URL is not yet set.
// Real runtime still requires a valid .env.local value before any DB actions run.
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/lakky_store';

// Transaction pooler (:6543) requires prepare:false
const client = postgres(connectionString, { prepare: false });
export const authTables = { user: users, session: sessions, account: accounts, verification: verifications };
export const db = drizzle(client, { schema: authTables });
