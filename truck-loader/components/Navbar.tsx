'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/',              label: 'ダッシュボード' },
  { href: '/inventory',    label: '在庫・積載計画' },
  { href: '/production',   label: '配送計画入力' },
  { href: '/schedule',     label: '出荷スケジュール' },
  { href: '/loading-plan', label: '積載計画' },
  { href: '/settings',     label: 'マスタ設定' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
      {/* ── 上段：会社ロゴ ＋ システム名 ── */}
      <div
        className="flex items-center justify-between px-6"
        style={{
          height: 56,
          background: 'linear-gradient(135deg, #0c1f35 0%, #1a3a5c 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* 左：public/logo.svg を表示 */}
        <Image
          src="/logo.svg"
          alt="会社ロゴ"
          width={160}
          height={48}
          priority
          style={{ height: 38, width: 'auto' }}
        />

        {/* 右：システム名 */}
        <div className="flex flex-col items-end">
          <div className="font-bold text-white tracking-widest" style={{ fontSize: 15, letterSpacing: '0.12em' }}>
            積載計画管理システム
          </div>
          <div className="tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em' }}>
            LOGISTICS PLANNING SYSTEM
          </div>
        </div>
      </div>

      {/* ── 下段：ナビゲーション ── */}
      <div
        className="flex items-stretch px-2"
        style={{
          height: 38,
          background: 'linear-gradient(180deg, #1e3f60 0%, #17324e 100%)',
          borderBottom: '2px solid #0c1f35',
        }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'relative flex items-center px-4 text-[13px] font-medium tracking-wide transition-all select-none',
                active ? 'text-white' : 'hover:text-white',
              )}
              style={
                active
                  ? {
                      background: 'rgba(255,255,255,0.12)',
                      color: 'white',
                      borderBottom: '2px solid #5ba4e8',
                      marginBottom: -2,
                    }
                  : { color: 'rgba(255,255,255,0.62)' }
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
