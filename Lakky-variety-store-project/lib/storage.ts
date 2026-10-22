// Server-only Supabase Storage helper (service key NEVER leaves the server).
// Bucket: payment-proofs (private). Upload + 15-minute signed view links.

function cfg() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('storage-not-configured');
  return { url, key };
}

export async function uploadReceipt(bytes: Buffer, contentType: string, ext: string, bucket = 'payment-proofs'): Promise<{ ok: boolean; key?: string }> {
  try {
    const { url, key } = cfg();
    const name = `${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) return { ok: false };
    return { ok: true, key: name };
  } catch { return { ok: false }; }
}

export async function receiptViewUrl(key: string, bucket = 'payment-proofs'): Promise<{ ok: boolean; url?: string; legacy?: boolean }> {
  // Receipts uploaded before the hosting move were saved as plain paths on the
  // old server. Those files are unrecoverable — say so instead of showing a
  // broken image. Anything already absolute is used as-is.
  if (/^https?:\/\//i.test(key)) return { ok: true, url: key };
  if (/^\/?uploads\//i.test(key)) return { ok: false, legacy: true };
  try {
    const { url, key: skey } = cfg();
    const res = await fetch(`${url}/storage/v1/object/sign/${bucket}/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { apikey: skey, Authorization: `Bearer ${skey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 900 }),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) return { ok: false };
    // Supabase returns "/object/sign/<bucket>/<file>?token=…" — the storage
    // prefix is required, otherwise the link 404s (the broken-image bug).
    const signed = data.signedURL.startsWith('/storage/v1') ? data.signedURL : '/storage/v1' + data.signedURL;
    return { ok: true, url: url + signed };
  } catch { return { ok: false }; }
}
