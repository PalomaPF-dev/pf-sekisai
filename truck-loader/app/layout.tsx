import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { SupabaseProvider } from '@/components/SupabaseProvider';

export const metadata: Metadata = {
  title: '積載計画管理システム',
  description: '生産計画から拠点別トラック積載計画を自動算出・可視化する生産管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased" style={{ background: '#f0f6fc', color: '#1e3a5f', minHeight: '100vh' }}>
        <Navbar />
        <SupabaseProvider>
          <main className="min-h-[calc(100vh-94px)]">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
