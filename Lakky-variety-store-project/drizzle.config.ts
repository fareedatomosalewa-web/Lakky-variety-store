import type { Config } from 'drizzle-kit';
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL || 'postgres://lakky:lakky_local_pw@localhost:5432/lakky_store' },
} satisfies Config;
