'use server';

import { getAdminSession } from './auth';

// Real server-side admin check — verified against the session store on every call.
// Returns { ok } only for a logged-in user with role === 'admin'.
export async function checkAdmin(): Promise<{ ok: boolean }> {
  return getAdminSession();
}
