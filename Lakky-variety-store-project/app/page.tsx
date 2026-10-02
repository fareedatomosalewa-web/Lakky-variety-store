import { seedProducts } from '../db/seed';
export default function Home() {
  return (<div>
    <h2>Mixed catalogue — no login needed</h2>
    {seedProducts.map((p, i) => {
      const from = Math.min(...p.variants.map(v => v.price));
      return (<div className="card" key={i}><b>{p.name}</b> <span className="badge">New</span><div>From ₦{from.toLocaleString()}</div><a href={`/p/${i}`}>View variants →</a></div>);
    })}
  </div>);
}
