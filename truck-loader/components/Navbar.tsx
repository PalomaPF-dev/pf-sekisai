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
    <header className="sticky top-0 z-50" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}>
      {/* ── 上段：ロゴ ＋ システム名 ── */}
      <div
        className="flex items-center justify-between px-6"
        style={{
          height: 56,
          background: 'linear-gradient(135deg, #1a4a7a 0%, #2563a8 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* 左：Palomaロゴ */}
        <Image
          src="/paloma-logo.png"
          alt="Paloma"
          width={140}
          height={40}
          priority
          style={{ height: 36, width: 'auto', objectFit: 'contain' }}
        />

        {/* 右：システム名 */}
        <div className="flex flex-col items-end">
          <div className="font-bold text-white" style={{ fontSize: 15, letterSpacing: '0.1em' }}>
            積載計画管理システム
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em' }}>
            LOGISTICS PLANNING SYSTEM
          </div>
        </div>
      </div>

      {/* ── 下段：ナビゲーション ── */}
      <div
        className="flex items-stretch px-2"
        style={{
          height: 38,
          background: 'linear-gradient(180deg, #2e74c0 0%, #2563a8 100%)',
          borderBottom: '2px solid #1a4a7a',
        }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center px-4 text-[13px] font-medium tracking-wide transition-all select-none"
              style={
                active
                  ? {
                      background: 'rgba(255,255,255,0.18)',
                      color: 'white',
                      borderBottom: '2px solid #7ec8f8',
                      marginBottom: -2,
                    }
                  : { color: 'rgba(255,255,255,0.72)' }
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
