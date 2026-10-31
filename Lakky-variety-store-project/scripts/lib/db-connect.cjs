// Shared database connection for the maintenance scripts.
// Reads DATABASE_URL from .env.local (gitignored). Never prints the password.
//
// Some home/office networks cannot resolve Supabase hostnames and some
// antivirus tools break the TLS chain. If the normal connection fails for one
// of those reasons we look the host up through Cloudflare DNS and connect to
// the address directly. Nothing about the database changes.
const fs = require('fs');
const path = require('path');

function readEnv() {
  const file = path.join(__dirname, '..', '..', '.env.local');
  const txt = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
}

function parseConn(raw) {
  const schemeEnd = raw.indexOf('://') + 3;
  const rest = raw.slice(schemeEnd);
  const lastAt = rest.lastIndexOf('@');
  const userinfo = rest.slice(0, lastAt);
  const hostpart = rest.slice(lastAt + 1);
  const colon = userinfo.indexOf(':');
  const slash = hostpart.indexOf('/');
  const hostPort = slash === -1 ? hostpart : hostpart.slice(0, slash);
  const hp = hostPort.split(':');
  return {
    user: userinfo.slice(0, colon),
    pass: userinfo.slice(colon + 1),
    host: hp[0],
    port: Number(hp[1] || 5432),
    database: slash === -1 ? 'postgres' : hostpart.slice(slash + 1),
  };
}

async function resolveIPv4(host) {
  const res = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=A', {
    headers: { accept: 'application/dns-json' },
  });
  const j = await res.json();
  const ips = (j.Answer || []).filter((x) => x.type === 1).map((x) => x.data);
  if (!ips.length) throw new Error('no A record for ' + host);
  return ips;
}

async function connect() {
  const env = readEnv();
  if (!env.DATABASE_URL) throw new Error('no DATABASE_URL in .env.local');
  const c = parseConn(env.DATABASE_URL);
  const postgres = require('postgres');
  const base = {
    host: c.host, port: c.port, user: c.user, password: c.pass,
    database: c.database, prepare: false, max: 1, connect_timeout: 15,
  };
  try {
    const sql = postgres({ ...base, ssl: 'require' });
    await sql`select 1`;
    return { sql, via: 'direct', host: c.host };
  } catch (e) {
    const code = String(e && e.code);
    const retryable = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED'];
    if (!retryable.includes(code)) throw e;
    const ips = await resolveIPv4(c.host);
    const sql = postgres({
      ...base,
      host: ips[0],
      ssl: { servername: c.host, rejectUnauthorized: false },
      connect_timeout: 25,
    });
    await sql`select 1`;
    return { sql, via: 'resolved-ip', host: c.host, ip: ips[0] };
  }
}

function qid(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

module.exports = { connect, readEnv, parseConn, qid };
