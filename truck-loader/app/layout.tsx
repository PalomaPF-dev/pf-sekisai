import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { SupabaseProvider } from '@/components/SupabaseProvider';

export const metadata: Metadata = {
  title: 'トラック積載最適化システム',
  description: '生産計画から拠点別トラック積載計画を自動算出・可視化するシステム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-800 antialiased">
        <Navbar />
        <SupabaseProvider>
          <main className="min-h-[calc(100vh-56px)]">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
