'use client';

/**
 * 配船積載・不足分析
 *
 * 基幹システムの帳票Excel5種（①現状在庫一覧照会 ②受払予定一覧照会 ③投入一覧照会
 * ④入荷実績一覧登録 ⑤配船マスタ）をアップロードし、ブラウザ内で解析して
 * 実使用予定（②③の結合）・在庫推移・不足判定・週別の必要積載量を表示する。
 * データはサーバへ送信せず、ブラウザ内でのみ処理する。
 * 計算ルールの詳細はリポジトリの analysis/README.md を参照。
 */
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { HelpTip } from '@/components/HelpTip';
import { downloadCSV } from '@/lib/csv';
import { analyze } from '@/lib/vesselPlan/analyze';
import {
  DEFAULT_PLAN_PARAMS, SOURCE_LABELS,
  type AnalysisResult, type ParsedSources, type SourceKind,
} from '@/lib/vesselPlan/types';
import type { ParseFileResult } from '@/lib/vesselPlan/parse';

const REQUIRED_KINDS: SourceKind[] = ['inventory', 'planned', 'released', 'arrivals'];
const ALL_KINDS: SourceKind[] = [...REQUIRED_KINDS, 'vessels'];

const fmt = (n: number) => n.toLocaleString('ja-JP');
const fmtDate = (d: string | null) => (d ? d.replaceAll('-', '/') : '—');

export default function VesselPlanPage() {
  const [sources, setSources] = useState<Partial<ParsedSources>>({});
  const [parseResults, setParseResults] = useState<ParseFileResult[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyFactor, setSafetyFactor] = useState(DEFAULT_PLAN_PARAMS.safetyFactor);
  const [leadWeeks, setLeadWeeks] = useState(DEFAULT_PLAN_PARAMS.leadWeeks);
  const [dailyItem, setDailyItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const missingKinds = REQUIRED_KINDS.filter((k) => !sources[k]);
  const ready = missingKinds.length === 0;

  const result: AnalysisResult | null = useMemo(() => {
    if (!ready) return null;
    try {
      return analyze(
        { vessels: [], fileNames: {}, ...sources } as ParsedSources,
        { safetyFactor, leadWeeks },
      );
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [sources, ready, safetyFactor, leadWeeks]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setParsing(true);
    setError(null);
    try {
      // SheetJS はバンドルが大きいため利用時にのみ読み込む
      const { parseSourceFiles } = await import('@/lib/vesselPlan/parse');
      const files = await Promise.all(
        [...fileList].map(async (f) => ({ name: f.name, buf: await f.arrayBuffer() })),
      );
      const { sources: parsed, results } = await parseSourceFiles(files);
      // 既存の取込結果に追記（同一帳票は上書き）
      setSources((prev) => ({
        ...prev,
        ...parsed,
        fileNames: { ...prev.fileNames, ...parsed.fileNames },
      }));
      setParseResults((prev) => [...prev, ...results]);
    } catch (e) {
      setError(`ファイルの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const unknownFiles = parseResults.filter((r) => r.kind === null);

  const exportPlanCsv = () => {
    if (!result) return;
    const head = ['入荷週(月曜)', '配船番号(目安)', '積込目安(月曜)'];
    for (const it of result.items) {
      head.push(`${it.code} 需要`, `${it.code} 登録済入荷`, `${it.code} 必要追加入荷`, `${it.code} 週末在庫`);
    }
    const lines = [head.join(',')];
    for (const w of result.weekly) {
      const row = [fmtDate(w.weekStart), `"${w.vesselLabel}"`, fmtDate(w.loadWeekStart)];
      for (const it of result.items) {
        const c = w.cells[it.code];
        row.push(String(c.demand), String(c.scheduled), String(c.required), String(c.endBalance));
      }
      lines.push(row.join(','));
    }
    downloadCSV(lines.join('\n'), `配船積載計画案_${result.asOf}.csv`);
  };

  const dailyItemCode = dailyItem ?? result?.items[0]?.code ?? null;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">配船積載・不足分析</h1>
        <p className="text-sm text-slate-500 mt-1">
          帳票Excel（①〜⑤）を取り込み、実使用予定（②＋③）と在庫・入荷予定から
          不足時期と週別の必要積載量を算出します。データはブラウザ内でのみ処理されます。
        </p>
      </div>

      {/* ── 取込 ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-slate-700">
            帳票ファイル取込
            <HelpTip text="5つの帳票Excelをまとめて選択してください。ファイル名は問わず、ヘッダ行の内容で①〜⑤を自動判別します。同じ帳票を再度取り込むと上書きされます。" />
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {parsing ? '読込中…' : 'Excelファイルを選択'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_KINDS.map((kind) => {
            const loaded = !!sources[kind];
            const optional = kind === 'vessels';
            return (
              <span
                key={kind}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-medium border',
                  loaded
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200',
                )}
                title={sources.fileNames?.[kind]}
              >
                {loaded ? '✓ ' : ''}{SOURCE_LABELS[kind]}{!loaded && optional ? '（任意）' : ''}
              </span>
            );
          })}
        </div>
        {unknownFiles.length > 0 && (
          <p className="text-xs text-amber-600">
            判別できなかったファイル: {unknownFiles.map((f) => f.fileName).join(', ')}
          </p>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {!ready && parseResults.length > 0 && (
          <p className="text-xs text-slate-500">
            不足している帳票: {missingKinds.map((k) => SOURCE_LABELS[k]).join('、')}
          </p>
        )}
      </section>

      {result && (
        <>
          {/* ── パラメータ ────────────────────────────────────── */}
          <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-6">
            <div className="text-sm text-slate-600">
              <span className="text-xs text-slate-400 block">基準日</span>
              <span className="font-semibold">{fmtDate(result.asOf)}</span>
            </div>
            <div className="text-sm text-slate-600">
              <span className="text-xs text-slate-400 block">登録済入荷の最終日</span>
              <span className="font-semibold">{fmtDate(result.supplyEndDate)}</span>
            </div>
            <label className="text-sm text-slate-600">
              <span className="text-xs text-slate-400 block">
                安全在庫係数（翌週需要×）
                <HelpTip text="週末在庫の目標を「翌週需要×この係数」とします。0.5なら翌週需要の半分を安全在庫として確保します。" />
              </span>
              <input
                type="number" step={0.1} min={0} max={4}
                value={safetyFactor}
                onChange={(e) => setSafetyFactor(Math.max(0, Number(e.target.value) || 0))}
                className="mt-0.5 w-24 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="text-xs text-slate-400 block">
                海上リードタイム（週）
                <HelpTip text="積込から入荷までの週数。入荷週からこの週数を引いた週が積込目安になります。" />
              </span>
              <input
                type="number" step={1} min={0} max={12}
                value={leadWeeks}
                onChange={(e) => setLeadWeeks(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                className="mt-0.5 w-24 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
            </label>
          </section>

          {/* ── サマリ ────────────────────────────────────────── */}
          <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <h2 className="font-semibold text-slate-700 px-4 pt-4">品目別サマリ</h2>
            <div className="overflow-x-auto p-4">
              <table className="text-sm min-w-[900px] w-full">
                <thead>
                  <tr className="bg-slate-100 text-slate-500">
                    <th className="px-3 py-2 text-left font-semibold">品目ＣＤ</th>
                    <th className="px-3 py-2 text-left font-semibold">品名</th>
                    <th className="px-3 py-2 text-right font-semibold">現在庫</th>
                    <th className="px-3 py-2 text-right font-semibold">登録済入荷計</th>
                    <th className="px-3 py-2 text-right font-semibold">需要計（入荷登録期間）</th>
                    <th className="px-3 py-2 text-right font-semibold">期間末見込在庫</th>
                    <th className="px-3 py-2 text-right font-semibold">需要計（全期間）</th>
                    <th className="px-3 py-2 text-right font-semibold">追加入荷なしの最終過不足</th>
                    <th className="px-3 py-2 text-center font-semibold">最初の在庫割れ日</th>
                  </tr>
                </thead>
                <tbody>
                  {result.summaries.map((s) => (
                    <tr key={s.itemCode} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{s.itemCode}</td>
                      <td className="px-3 py-2">{s.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.stock0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.supplyTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.demandUntilSupplyEnd)}</td>
                      <td className={clsx('px-3 py-2 text-right tabular-nums font-semibold', s.balanceAtSupplyEnd < 0 && 'text-rose-600 bg-rose-50')}>
                        {fmt(s.balanceAtSupplyEnd)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.demandTotal)}</td>
                      <td className={clsx('px-3 py-2 text-right tabular-nums font-semibold', s.finalBalance < 0 && 'text-rose-600 bg-rose-50')}>
                        {fmt(s.finalBalance)}
                      </td>
                      <td className={clsx('px-3 py-2 text-center tabular-nums', s.firstShortageDate && 'text-rose-600 font-semibold')}>
                        {fmtDate(s.firstShortageDate) || '不足なし'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 積載計画案 ────────────────────────────────────── */}
          <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 flex-wrap gap-2">
              <h2 className="font-semibold text-slate-700">
                積載計画案（週別の必要追加入荷量）
                <HelpTip text="必要追加入荷 = MAX(0, 当週需要 + 安全在庫係数×翌週需要 - 前週末在庫 - 登録済入荷)。この量を各週に入荷させれば在庫割れが発生しません。グレー行は登録済入荷期間内のため、必要追加入荷が出た場合は船便では間に合わず航空便・前倒しの検討が必要です。" />
              </h2>
              <button
                onClick={exportPlanCsv}
                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 text-xs font-medium hover:border-indigo-400"
              >
                CSVダウンロード
              </button>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="text-xs min-w-max border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-500">
                    <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-slate-100 z-10" rowSpan={2}>入荷週(月曜)</th>
                    <th className="px-2 py-2 text-left font-semibold" rowSpan={2}>配船番号(目安)</th>
                    <th className="px-2 py-2 text-left font-semibold" rowSpan={2}>積込目安</th>
                    {result.items.map((it) => (
                      <th key={it.code} colSpan={4} className="px-2 py-1.5 text-center font-semibold border-l border-slate-300">
                        <span className="font-mono">{it.code}</span>
                        <span className="ml-1 font-normal text-slate-400">{it.name}</span>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 text-slate-500">
                    {result.items.map((it) => (
                      <FragmentedSubHeader key={it.code} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.weekly.map((w) => (
                    <tr key={w.weekStart} className={clsx('border-t border-slate-100', w.inRegisteredPeriod && 'bg-slate-50')}>
                      <td className={clsx('px-2 py-1.5 tabular-nums sticky left-0 z-10', w.inRegisteredPeriod ? 'bg-slate-50' : 'bg-white')}>
                        {fmtDate(w.weekStart)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{w.vesselLabel}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtDate(w.loadWeekStart)}</td>
                      {result.items.map((it) => {
                        const c = w.cells[it.code];
                        return (
                          <FragmentedCells key={it.code} cell={c} />
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-indigo-50/50 font-semibold">
                    <td className="px-2 py-2 sticky left-0 bg-indigo-50 z-10">必要追加入荷 合計</td>
                    <td /><td />
                    {result.items.map((it) => {
                      const total = result.weekly.reduce((a, w) => a + w.cells[it.code].required, 0);
                      return (
                        <td key={it.code} colSpan={4} className="px-2 py-2 text-center tabular-nums border-l border-slate-300 text-indigo-700">
                          {fmt(total)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 配船別入荷予定 ─────────────────────────────────── */}
          <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <h2 className="font-semibold text-slate-700 px-4 pt-4">
              配船別入荷予定
              <HelpTip text="④入荷実績一覧登録の未入荷分を配船番号（入荷連絡備考）ごとに集計したものです。船名・出港日は⑤配船マスタとの突合結果で、マスタに未登録の週は空欄になります。" />
            </h2>
            {result.unmatchedVesselRefs.length > 0 && (
              <p className="text-xs text-amber-600 px-4 pt-1">
                ⑤配船マスタ未登録: {result.unmatchedVesselRefs.join(', ')}（最新マスタを取り込むと船名等が表示されます）
              </p>
            )}
            <div className="overflow-x-auto p-4">
              <table className="text-xs min-w-max">
                <thead>
                  <tr className="bg-slate-100 text-slate-500">
                    <th className="px-2 py-2 text-left font-semibold">配船番号</th>
                    <th className="px-2 py-2 text-left font-semibold">入荷予定日</th>
                    <th className="px-2 py-2 text-left font-semibold">船名(⑤)</th>
                    <th className="px-2 py-2 text-left font-semibold">コンテナ(⑤)</th>
                    <th className="px-2 py-2 text-left font-semibold">出港日(⑤)</th>
                    {result.items.map((it) => (
                      <th key={it.code} className="px-2 py-2 text-right font-semibold font-mono">{it.code}</th>
                    ))}
                    <th className="px-2 py-2 text-right font-semibold">計</th>
                  </tr>
                </thead>
                <tbody>
                  {result.vesselArrivals.map((v) => (
                    <tr key={v.ref} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{v.ref}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                        {fmtDate(v.minDate)}{v.minDate !== v.maxDate ? ` 〜 ${fmtDate(v.maxDate)}` : ''}
                      </td>
                      <td className="px-2 py-1.5">{v.master?.shipName ?? ''}</td>
                      <td className="px-2 py-1.5">{v.master?.containerSize ?? ''}</td>
                      <td className="px-2 py-1.5 tabular-nums">{v.master ? fmtDate(v.master.departureDate) : ''}</td>
                      {result.items.map((it) => (
                        <td key={it.code} className="px-2 py-1.5 text-right tabular-nums">
                          {v.qty[it.code] ? fmt(v.qty[it.code]) : ''}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 日次在庫推移 ───────────────────────────────────── */}
          <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-4 flex-wrap">
              <h2 className="font-semibold text-slate-700">
                日次在庫推移
                <HelpTip text="予定在庫 = 前日残 + 登録済入荷 - 使用予定（③確定＋②計画）。追加の積載・入荷が無い場合の推移で、マイナス（赤）が不足です。" />
              </h2>
              <select
                value={dailyItemCode ?? ''}
                onChange={(e) => setDailyItem(e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm"
              >
                {result.items.map((it) => (
                  <option key={it.code} value={it.code}>{it.code} {it.name}</option>
                ))}
              </select>
            </div>
            {dailyItemCode && (
              <div className="overflow-x-auto p-4 max-h-[480px] overflow-y-auto">
                <table className="text-xs min-w-[560px]">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-100 text-slate-500">
                      <th className="px-2 py-2 text-left font-semibold">日付</th>
                      <th className="px-2 py-2 text-right font-semibold">入荷</th>
                      <th className="px-2 py-2 text-right font-semibold">使用（③確定）</th>
                      <th className="px-2 py-2 text-right font-semibold">使用（②計画）</th>
                      <th className="px-2 py-2 text-right font-semibold">予定在庫</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.daily[dailyItemCode] ?? []).map((r) => (
                      <tr key={r.date} className="border-t border-slate-100">
                        <td className="px-2 py-1 tabular-nums">{fmtDate(r.date)}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-emerald-600">{r.supply ? fmt(r.supply) : ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.demandReleased ? fmt(r.demandReleased) : ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-400">{r.demandPlanned ? fmt(r.demandPlanned) : ''}</td>
                        <td className={clsx('px-2 py-1 text-right tabular-nums font-semibold', r.balance < 0 && 'text-rose-600 bg-rose-50')}>
                          {fmt(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// 品目ごとのサブヘッダ（需要/登録済入荷/必要追加入荷/週末在庫）
function FragmentedSubHeader() {
  return (
    <>
      <th className="px-2 py-1.5 text-right font-medium border-l border-slate-300">需要</th>
      <th className="px-2 py-1.5 text-right font-medium">登録済入荷</th>
      <th className="px-2 py-1.5 text-right font-medium text-indigo-600">必要追加入荷</th>
      <th className="px-2 py-1.5 text-right font-medium">週末在庫</th>
    </>
  );
}

function FragmentedCells({ cell }: { cell: { demand: number; scheduled: number; required: number; endBalance: number } }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums border-l border-slate-300">{cell.demand ? fmt(cell.demand) : ''}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{cell.scheduled ? fmt(cell.scheduled) : ''}</td>
      <td className={clsx('px-2 py-1.5 text-right tabular-nums font-semibold', cell.required > 0 && 'text-rose-600 bg-rose-50')}>
        {cell.required ? fmt(cell.required) : ''}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmt(cell.endBalance)}</td>
    </>
  );
}
