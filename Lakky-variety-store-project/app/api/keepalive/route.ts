// Keep-alive for the free Supabase plan.
// Supabase pauses a free project after 7 days without database activity.
// This route makes a real SQL query, so a weekly call keeps the project awake.
// It runs on Vercel Cron (see vercel.json) - no extra service needed.
import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // If CRON_SECRET is set, only the scheduler may call this route.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const key = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ ok: false, error: 'no-database-url' }, { status: 500 });

  let sql;
  try {
    sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 15 });
    const rows = await sql`select now() as at, (select count(*)::int from public.products) as products`;
    await sql.end();
    return NextResponse.json({ ok: true, checkedAt: rows[0].at, products: rows[0].products });
  } catch (e: any) {
    try { if (sql) await sql.end(); } catch {}
    return NextResponse.json({ ok: false, error: String(e?.code || 'db-error') }, { status: 500 });
  }
}
