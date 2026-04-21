'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * アプリ起動時に Supabase からデータをロードする。
 * layout.tsx に一度だけ置く。
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const isLoaded = useAppStore((s) => s.isLoaded);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 text-sm gap-2">
        <svg className="animate-spin h-5 w-5 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        データを読み込み中...
      </div>
    );
  }

  return <>{children}</>;
}
