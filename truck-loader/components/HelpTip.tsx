'use client';

import { useEffect, useRef, useState } from 'react';

// ─── 専門用語ヘルプ「?」───────────────────────────────────────────
// ホバー（PC）でもタップ（タブレット/スマホ）でも開ける小さなツールチップ。
// 使い方: <HelpTip text="有効在庫 = 拠点在庫 + 輸送中 − 予定出荷" />

export function HelpTip({ text, title }: { text: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // 外側タップで閉じる（タブレット向け）
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="説明を表示"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-[80] mt-1.5 w-60 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-left shadow-xl"
        >
          {title && <span className="mb-1 block text-[11px] font-bold text-white">{title}</span>}
          <span className="block whitespace-pre-line text-[11px] font-normal leading-relaxed text-slate-200">{text}</span>
        </span>
      )}
    </span>
  );
}
