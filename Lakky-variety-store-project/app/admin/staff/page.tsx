'use client';
import { useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { approveStaff, inviteStaff, listInvites } from '../../../lib/shop-v1';
export default function StaffPage() {
  const allowed = useAdminGuard();
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const [invites, setInvites] = useState<any[]>([]);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const load = async () => { const r: any = await listInvites().catch(() => null); if (r && r.ok) setInvites(r.rows); };
  const invite = async () => {
    const r: any = await inviteStaff({ email }).catch(() => null);
    if (r && r.ok) setMsg(`Invite ready — staff signs up at /staff/join/${r.inviteId} (send them the link). They see nothing until you approve.`);
    else setMsg('Invite failed — check the email.');
    load();
  };
  const decide = async (em: string, approve: boolean) => {
    await approveStaff({ email: em, approve }).catch(() => null);
    load();
  };
  return (<div><h2>Staff — owner invites, owner approves</h2>
    <div className="card"><input placeholder="Staff email" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn" onClick={invite}>Invite staff</button><div><b>{msg}</b></div><button className="btn-s" onClick={load}>Show invites</button>
      {invites.map((i: any) => <div key={i.id} className="small">{i.email} [{i.status}] <button className="btn-s" onClick={() => decide(i.email, true)}>Approve</button> <button className="btn-d" onClick={() => decide(i.email, false)}>Remove</button></div>)}</div>
    <div className="card small">Staff can: view pending orders, check receipts, confirm / reject / partially accept, update progress, mark fees paid, reply. Owner only: products, prices, discounts, coupons, bank, stock, settings, refunds, credit, reviews, reports, invites.</div></div>);
}
