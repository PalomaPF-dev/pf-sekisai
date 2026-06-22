'use client';

/**
 * 画面シェル。ログイン/公開ページではナビゲーション（タブ）とデータ読込を出さず、
 * アプリ本体ページでのみ Navbar + データ読込 + サイドバー余白を適用する。
 */
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SupabaseProvider } from '@/components/SupabaseProvider';
import { TrialGate } from '@/components/TrialGate';

// ナビ・データ読込を出さない「素の」ページ（ログイン・登録・公開法務/料金ページ）
const BARE_PATHS = ['/login', '/register', '/privacy', '/terms', '/contact', '/pricing'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const bare = BARE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (bare) {
    // ナビなし・サイドバー余白なし・データ読込なし
    return <main className="min-h-[calc(100vh_-_env(safe-area-inset-top))]">{children}</main>;
  }

  return (
    <TrialGate>
      <Navbar />
      <SupabaseProvider>
        {/* PCはサイドバー分(200px)右にずらす。モバイルは全幅（ドロワーで遷移） */}
        <main className="min-h-[calc(100vh_-_68px_-_env(safe-area-inset-top))] lg:ml-[200px]">
          {children}
        </main>
      </SupabaseProvider>
    </TrialGate>
  );
}
