import type { Metadata } from 'next';
import './globals.css';
import { BottomNav, SiteHeader } from './site-nav';
export const metadata: Metadata = { title: 'Lakky Variety Store', description: 'Something for every day.', manifest: '/manifest.json' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet" /></head><body><SiteHeader /><main className="pagewrap">{children}<BottomNav /></main></body></html>);
}
