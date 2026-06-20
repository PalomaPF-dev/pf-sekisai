'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useAppStore } from '@/lib/store';

// ─── 今週の作業の流れ（週次ガイド）──────────────────────────────────
// セットアップ完了後のダッシュボードに表示。毎週の運用を順番に案内する。
// 完了はデータの有無から推定（厳密なゲートではなく道しるべ）。

function hasWhQty(obj: Record<string, Record<string, number>>): boolean {
  return Object.values(obj).some((m) => Object.values(m).some((v) => v > 0));
}

interface Props {
  /** ダッシュボードで計算済みの今週のトラック台数（計画の有無判定に使用） */
  plannedTrucks: number;
}

export function WeeklyFlowGuide({ plannedTrucks }: Props) {
  const {
    factories, products, warehouses,
    productionPlan, locationStock, baselineStock, inTransitStock, weeklyShippingSchedule,
  } = useAppStore();

  // セットアップ（OnboardingChecklist の全項目）が済んだら表示＝チェックリストと入れ替わる
  const setupDone =
    factories.length > 0 && warehouses.length > 0 && products.length > 0 &&
    hasWhQty(baselineStock) && hasWhQty(locationStock) &&
    Object.values(productionPlan).some((v) => v > 0) &&
    Object.values(weeklyShippingSchedule).some((m) => Object.values(m).some((d) => Array.isArray(d) && d.some(Boolean)));
  if (!setupDone) return null;

  const s1 = Object.values(productionPlan).some((v) => v > 0); // 生産数入力済み
  const s2 = hasWhQty(locationStock);                          // 拠点在庫あり
  const s3 = s1 && s2;                                         // 送り数は自動計算（前提が揃えば確認可能）
  const s4 = plannedTrucks > 0;                                // 積載計画が生成されている
  const s5 = hasWhQty(inTransitStock);                         // 出荷確定済み（輸送中あり）

  const steps = [
    { n: 1, label: '週間生産数を入力', href: '/production?tab=production', done: s1, desc: '今週つくる数' },
    { n: 2, label: '拠点在庫・予定出荷を更新', href: '/production?tab=location', done: s2, desc: '最新の在庫に' },
    { n: 3, label: '送り数を確認', href: '/production?tab=sendqty', done: s3, desc: '自動計算を確認・修正' },
    { n: 4, label: '積載計画を確認', href: '/loading-plan?view=plan', done: s4, desc: 'トラックと積み方' },
    { n: 5, label: '出荷確定', href: '/loading-plan?view=plan', done: s5, desc: '輸送中数量に反映' },
  ];
  const current = steps.find((s) => !s.done);

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800">📅 今週の作業の流れ</h2>
        {current ? (
          <Link href={current.href} className="text-xs font-semibold text-indigo-600 hover:underline">
            次にやること: {current.label} →
          </Link>
        ) : (
          <span className="text-xs font-semibold text-emerald-600">✓ 今週の作業は完了しています</span>
        )}
      </div>

      <ol className="mt-3 flex flex-wrap items-stretch gap-1.5">
        {steps.map((s, i) => {
          const isCurrent = current?.n === s.n;
          return (
            <li key={s.n} className="flex items-center gap-1.5">
              <Link
                href={s.href}
                className={clsx(
                  'flex min-w-[120px] flex-col rounded-lg border px-2.5 py-1.5 transition',
                  s.done
                    ? 'border-emerald-200 bg-emerald-50'
                    : isCurrent
                      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50',
                )}
              >
                <span className={clsx(
                  'text-xs font-bold',
                  s.done ? 'text-emerald-700' : isCurrent ? 'text-indigo-700' : 'text-slate-600',
                )}>
                  {s.done ? '✓' : `${s.n}.`} {s.label}
                </span>
                <span className="text-[10px] text-slate-400">{s.desc}</span>
              </Link>
              {i < steps.length - 1 && <span className="text-slate-300">→</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
