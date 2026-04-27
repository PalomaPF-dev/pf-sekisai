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
      <body className="antialiased" style={{ background: '#f5f7fa', color: '#1f2937' }}>
        <Navbar />
        <SupabaseProvider>
          {/* サイドバー分(200px)だけ右にずらす */}
          <main style={{ marginLeft: 200, minHeight: 'calc(100vh - 68px)' }}>
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
