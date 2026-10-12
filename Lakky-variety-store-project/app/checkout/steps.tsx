'use client';

// Checkout stepper: Cart ✓ → Details (2) → Pay (3) → Done (4). Shared by Details + Pay.
export default function Steps({ step }: { step: number }) {
  const items = ['Cart', 'Details', 'Pay', 'Done'];
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 4px 12px' }}>
    {items.map((t, i) => {
      const n = i + 1;
      const done = n < step, now = n === step;
      return (<div key={t} style={{ display: 'flex', alignItems: 'center', flex: n === 4 ? 0 : 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', margin: '0 auto',
            background: done ? '#47745A' : now ? '#5A2948' : '#fff',
            border: done || now ? 'none' : '1px solid #EBDDD2',
            color: done || now ? '#fff' : '#756B68',
            fontWeight: 700, lineHeight: '34px',
          }}>{done ? '✓' : n}</div>
          <div style={{ fontSize: 12, fontWeight: now ? 700 : 400, color: now ? '#5A2948' : '#756B68' }}>{t}</div>
        </div>
        {n < 4 && <div style={{ flex: 1, height: 2, background: '#EBDDD2', margin: '0 6px 18px' }} />}
      </div>);
    })}
  </div>);
}
