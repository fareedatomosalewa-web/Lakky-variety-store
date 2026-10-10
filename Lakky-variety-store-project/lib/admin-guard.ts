'use server';

// Real server-side role check — verified against the session store on every call.
// roles lists which user roles may pass (default: admin only; staff pages pass ['admin','staff']).
// Staff also need an approved invite — they see nothing until the owner approves.
export async function checkAdmin(roles: string[] = ['admin']): Promise<{ ok: boolean; role?: string }> {
  const { auth } = await import('./auth');
  const { headers } = await import('next/headers');
  const session = await auth.api.getSession({ headers: await headers() });
  const role = ((session?.user as any)?.role as string) || '';
  if (!session?.user || !roles.includes(role)) return { ok: false };
  if (role === 'staff') {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL || '', { prepare: false });
    try {
      const inv = await sql`select status from staff_invites where email=${(session.user as any).email} order by created_at desc limit 1`;
      await sql.end();
      if (!inv.length || inv[0].status !== 'approved') return { ok: false, role };
    } catch {
      try { await sql.end(); } catch {}
      return { ok: false };
    }
  }
  return { ok: true, role };
}
