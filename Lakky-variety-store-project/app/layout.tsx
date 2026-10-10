import type { Metadata } from 'next';
import './globals.css';
import { BottomNav, SiteHeader } from './site-nav';
export const metadata: Metadata = { title: 'Lakky Variety Store', description: 'Something for every day.', manifest: '/manifest.json', themeColor: '#5A2948' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet" /><link rel="apple-touch-icon" href="/icon-192.png" /><script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){}})}` }} /></head><body><SiteHeader /><main className="pagewrap">{children}<BottomNav /></main></body></html>);
}
