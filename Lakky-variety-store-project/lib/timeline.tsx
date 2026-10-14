// Shared order timeline (customer + admin see the same steps).
// Lives here — NOT in a page file — because Next.js pages may only export
// route fields; extra exports like this break `npm run build`.
// Owner timeline: Order placed → Receipt received → Payment confirmed →
// Ready for pickup → Collected. Done = green, current = highlighted, rest = gray.
export function posFor(fulfilment: string): number {
  if (fulfilment === 'completed') return 4;
  if (fulfilment === 'ready' || fulfilment === 'onway') return 3;
  return 2;
}
export function TimelineSteps({ fulfilment, confirmedAt, hasReceipt, compact }: { fulfilment: string; confirmedAt?: string; hasReceipt?: boolean; compact?: boolean }) {
  const pos = posFor(fulfilment);
  const titles = ['Order placed', 'Receipt received', 'Payment confirmed', 'Ready for pickup', 'Collected'];
  const subs = [
    '',
    hasReceipt === false ? 'Not yet' : '',
    confirmedAt ? new Date(confirmedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '',
    pos === 2 ? 'We’ll message you in the app' : '',
    '',
  ];
  return (<div className="timeline" style={{ marginTop: 8 }}>
    {titles.map((t, i) => {
      const state = fulfilment === 'completed' || i < pos ? 'done' : i === pos ? 'now' : 'todo';
      return (
        <div key={t} style={{ display: 'flex', gap: 10, padding: '7px 0', opacity: state === 'todo' ? 0.55 : 1 }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', display: 'inline-block', textAlign: 'center', lineHeight: '26px',
            background: state === 'done' ? '#47745A' : state === 'now' ? '#5A2948' : '#fff',
            border: state === 'todo' ? '2px solid #CFC4BC' : 'none',
            color: state === 'todo' ? '#756B68' : '#fff', fontWeight: 700, fontSize: 14,
          }}>{state === 'done' ? '✓' : (i + 1)}</span>
          <div><b>{t}</b>{!compact && subs[i] ? <div className="small">{subs[i]}</div> : null}</div>
        </div>
      );
    })}
  </div>);
}
