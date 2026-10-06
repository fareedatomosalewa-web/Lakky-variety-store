import type { Metadata } from 'next';
import './globals.css';
import CartBadge from './cart-badge';
export const metadata: Metadata = { title: 'Lakky Variety Store', description: 'Mobile-first catalogue + orders', manifest: '/manifest.json' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{margin:0,fontFamily:'Inter,Arial',background:'#F8FAFC'}}><header style={{background:'#0F766E',color:'#fff',padding:'12px 16px',position:'sticky',top:0}}><b>Lakky Variety Store</b> <a href="/cart" style={{color:'#fff',float:'right'}}>Cart 🛒 <CartBadge /></a></header><main style={{maxWidth:720,margin:'0 auto',padding:12}}>{children}</main></body></html>);
}
