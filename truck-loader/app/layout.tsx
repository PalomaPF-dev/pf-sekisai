import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { SupabaseProvider } from '@/components/SupabaseProvider';
import { SessionProvider } from '@/components/SessionProvider';
import { Toaster } from '@/components/Toast';

export const metadata: Metadata = {
  title: '積載計画ナビ',
  description: '中小製造業向け 積載計画ナビ — 在庫基準から最適なトラックと積み方をAIが提案',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased" style={{ background: '#f5f7fa', color: '#1f2937' }}>
        <SessionProvider>
          <Navbar />
          <SupabaseProvider>
            {/* PCはサイドバー分(200px)右にずらす。モバイルは全幅（ドロワーで遷移） */}
            <main className="min-h-[calc(100vh-68px)] lg:ml-[200px]">
              {children}
            </main>
          </SupabaseProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
