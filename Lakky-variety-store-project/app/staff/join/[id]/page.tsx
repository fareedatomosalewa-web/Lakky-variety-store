'use client';
import { useState } from 'react';
import { joinStaff } from '../../../../lib/shop-v1';
export default function StaffJoin({ params }: { params: { id: string } }) {
  const [pw, setPw] = useState(''); const [msg, setMsg] = useState('');
  const go = async () => {
    const r: any = await joinStaff({ inviteId: params.id, password: pw }).catch(() => null);
    setMsg(r && r.ok ? 'Done. The owner will approve you — you will see nothing until then. Then log in at /admin/login.' : 'That link is used, wrong, or the password is too short.');
  };
  return (<div className="card"><h2>Join the shop team</h2>
    <input type="password" placeholder="Choose a password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
    <button className="btn" onClick={go}>Join</button><div><b>{msg}</b></div></div>);
}
