// Server-only Supabase Storage helper (service key NEVER leaves the server).
// Bucket: payment-proofs (private). Upload + 15-minute signed view links.

function cfg() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('storage-not-configured');
  return { url, key };
}

export async function uploadReceipt(bytes: Buffer, contentType: string, ext: string): Promise<{ ok: boolean; key?: string }> {
  try {
    const { url, key } = cfg();
    const name = `${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
    const res = await fetch(`${url}/storage/v1/object/payment-proofs/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) return { ok: false };
    return { ok: true, key: name };
  } catch { return { ok: false }; }
}

export async function receiptViewUrl(key: string): Promise<{ ok: boolean; url?: string }> {
  try {
    const { url, key: skey } = cfg();
    const res = await fetch(`${url}/storage/v1/object/sign/payment-proofs/${key}`, {
      method: 'POST',
      headers: { apikey: skey, Authorization: `Bearer ${skey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 900 }),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) return { ok: false };
    return { ok: true, url: url + data.signedURL };
  } catch { return { ok: false }; }
}
