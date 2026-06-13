'use client';

import { create } from 'zustand';
import clsx from 'clsx';

// ─── 軽量トースト通知 ─────────────────────────────────────────────
// どこからでも toast('保存しました') で呼べる。<Toaster/> を layout に1つ置く。

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; text: string; type: ToastType }

interface ToastState {
  toasts: ToastItem[];
  push: (text: string, type: ToastType) => void;
  remove: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, type) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    // 2.8秒で自動消去
    setTimeout(() => get().remove(id), 2800);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** どこからでも呼べる通知。例: toast('✓ 保存しました') */
export function toast(text: string, type: ToastType = 'success') {
  useToastStore.getState().push(text, type);
}

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'bg-slate-800 text-white',
  error: 'bg-rose-600 text-white',
  info: 'bg-indigo-600 text-white',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => remove(t.id)}
          className={clsx(
            'pointer-events-auto w-auto max-w-full truncate rounded-full px-4 py-2 text-xs font-semibold shadow-lg',
            'animate-[toastIn_.18s_ease-out]',
            TYPE_STYLE[t.type],
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
