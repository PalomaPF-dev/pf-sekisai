// 配船積載・不足分析のコアロジック。
// Excel版（analysis/build_shortage_analysis.py）と同一のルールで計算する。
//
// 実使用予定（②③の泣き別れ結合）:
//   - ③投入一覧 = 指図確定済み分。数量は投入残数量。基準日より過去の行は
//     未消化の残なので基準日扱いに繰り上げる。
//   - ②受払予定一覧 = 未確定分。数量は基準単位出庫数量。
//   - 境界日は両方に行が存在し得る（確定分＋未確定分）ため単純合算する。
//
// 必要追加入荷（積載計画案）:
//   MAX(0, 当週需要 + 安全在庫係数×翌週需要 - 前週末在庫 - 登録済入荷) の切上げ
import type {
  AnalysisResult, DailyRow, ItemSummary, ParsedSources, PlanParams,
  VesselArrivalRow, WeeklyPlanRow,
} from './types';

// ─── 日付ユーティリティ（すべて YYYY-MM-DD 文字列で扱う） ──────────────

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** その週の月曜日 */
function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 月=0
  return addDays(date, -dow);
}

/**
 * ④の配船番号（入荷連絡備考）を⑤配船マスタのキーに変換する。
 *   船便   Y288-1K → { week: 288, masterKey: '288-K' }
 *   航空便 YA289-7 → { week: 289, masterKey: '289-7' }
 */
export function parseVesselRef(ref: string): { week: number; masterKey: string } | null {
  const m = ref.trim().match(/^Y(A?)(\d{3})-(.+)$/);
  if (!m) return null;
  const week = Number(m[2]);
  const suffix = m[3];
  if (m[1] === 'A') return { week, masterKey: `${week}-${suffix}` };
  if (/^\d/.test(suffix)) return { week, masterKey: `${week}-${suffix.slice(1)}` };
  return { week, masterKey: `${week}-${suffix}` };
}

type QtyByDate = Map<string, number>; // date -> qty
type ItemSeries = Map<string, QtyByDate>; // itemCode -> series

function addQty(series: ItemSeries, item: string, date: string, qty: number) {
  if (!series.has(item)) series.set(item, new Map());
  const m = series.get(item)!;
  m.set(date, (m.get(date) ?? 0) + qty);
}

/**
 * 分析本体。asOf を省略した場合は②の最小予定日付の前日を基準日とする。
 */
export function analyze(
  sources: ParsedSources,
  params: PlanParams,
  asOfOverride?: string,
): AnalysisResult {
  const { inventory, planned, released, arrivals, vessels } = sources;

  // 基準日
  const plannedDates = planned.map((r) => r.date).sort();
  const asOf = asOfOverride
    ?? (plannedDates.length ? addDays(plannedDates[0], -1) : new Date().toISOString().slice(0, 10));

  // 対象品目 = 使用予定（②③）に登場する品目
  const itemNames = new Map<string, string>();
  for (const r of released) if (!itemNames.has(r.itemCode)) itemNames.set(r.itemCode, r.itemName);
  for (const r of planned) if (!itemNames.has(r.itemCode)) itemNames.set(r.itemCode, r.itemName);
  const items = [...itemNames.keys()].sort().map((code) => ({ code, name: itemNames.get(code) ?? '' }));
  const itemSet = new Set(itemNames.keys());

  // ① 現在庫
  const stock0 = new Map<string, number>();
  for (const r of inventory) {
    if (!itemSet.has(r.itemCode)) continue;
    stock0.set(r.itemCode, (stock0.get(r.itemCode) ?? 0) + r.qty);
  }

  // ③ 確定使用（過去日は基準日扱い） / ② 未確定使用
  const demandReleased: ItemSeries = new Map();
  for (const r of released) {
    addQty(demandReleased, r.itemCode, r.date < asOf ? asOf : r.date, r.qty);
  }
  const demandPlanned: ItemSeries = new Map();
  for (const r of planned) addQty(demandPlanned, r.itemCode, r.date, r.qty);

  // ④ 入荷予定（未入荷のみ）
  const supply: ItemSeries = new Map();
  const arrivalRows = arrivals.filter((r) => itemSet.has(r.itemCode) && r.status === '未入荷');
  for (const r of arrivalRows) addQty(supply, r.itemCode, r.date, r.qty);
  const supplyEndDate = arrivalRows.length
    ? arrivalRows.map((r) => r.date).sort().at(-1)!
    : null;

  // 対象日付の全集合
  const dateSet = new Set<string>();
  for (const s of [demandReleased, demandPlanned, supply]) {
    for (const m of s.values()) for (const d of m.keys()) dateSet.add(d);
  }
  const allDates = [...dateSet].sort();

  // ─── 日次推移とサマリ ───────────────────────────────────────────
  const daily: Record<string, DailyRow[]> = {};
  const summaries: ItemSummary[] = [];
  for (const { code, name } of items) {
    const rows: DailyRow[] = [];
    let bal = stock0.get(code) ?? 0;
    let firstShortage: string | null = null;
    let demandTotal = 0;
    let demandUntilSupplyEnd = 0;
    let supplyTotal = 0;
    for (const d of allDates) {
      const sup = supply.get(code)?.get(d) ?? 0;
      const d3 = demandReleased.get(code)?.get(d) ?? 0;
      const d2 = demandPlanned.get(code)?.get(d) ?? 0;
      bal += sup - d3 - d2;
      supplyTotal += sup;
      demandTotal += d3 + d2;
      if (supplyEndDate && d <= supplyEndDate) demandUntilSupplyEnd += d3 + d2;
      if (bal < 0 && firstShortage === null) firstShortage = d;
      if (sup || d3 || d2) {
        rows.push({ date: d, supply: sup, demandReleased: d3, demandPlanned: d2, balance: bal });
      }
    }
    daily[code] = rows;
    const s0 = stock0.get(code) ?? 0;
    summaries.push({
      itemCode: code,
      itemName: name,
      stock0: s0,
      supplyTotal,
      demandUntilSupplyEnd,
      balanceAtSupplyEnd: s0 + supplyTotal - demandUntilSupplyEnd,
      demandTotal,
      finalBalance: s0 + supplyTotal - demandTotal,
      firstShortageDate: firstShortage,
    });
  }

  // ─── 配船別入荷予定（⑤マスタ突合） ─────────────────────────────
  const masterByNo = new Map(vessels.map((v) => [v.vesselNo, v]));
  const byRef = new Map<string, { minDate: string; maxDate: string; qty: Map<string, number> }>();
  for (const r of arrivalRows) {
    const ref = r.vesselRef || '(配船番号なし)';
    if (!byRef.has(ref)) byRef.set(ref, { minDate: r.date, maxDate: r.date, qty: new Map() });
    const e = byRef.get(ref)!;
    if (r.date < e.minDate) e.minDate = r.date;
    if (r.date > e.maxDate) e.maxDate = r.date;
    e.qty.set(r.itemCode, (e.qty.get(r.itemCode) ?? 0) + r.qty);
  }
  const vesselArrivals: VesselArrivalRow[] = [];
  const unmatchedVesselRefs: string[] = [];
  for (const ref of [...byRef.keys()].sort()) {
    const e = byRef.get(ref)!;
    const parsed = parseVesselRef(ref);
    const master = parsed ? masterByNo.get(parsed.masterKey) : undefined;
    if (!master) unmatchedVesselRefs.push(ref);
    vesselArrivals.push({
      ref,
      minDate: e.minDate,
      maxDate: e.maxDate,
      master: master
        ? { shipName: master.shipName, containerSize: master.containerSize, departureDate: master.departureDate }
        : null,
      qty: Object.fromEntries(e.qty),
      total: [...e.qty.values()].reduce((a, b) => a + b, 0),
    });
  }

  // ─── 週別 積載計画案 ────────────────────────────────────────────
  // 週→実配船（初回入荷週ベース）。以降は最終Y番号から週次で外挿。
  const weekVessels = new Map<string, string[]>();
  let maxYWeek = 0;
  for (const va of vesselArrivals) {
    const parsed = parseVesselRef(va.ref);
    if (parsed) maxYWeek = Math.max(maxYWeek, parsed.week);
    const wk = mondayOf(va.minDate);
    if (!weekVessels.has(wk)) weekVessels.set(wk, []);
    weekVessels.get(wk)!.push(va.ref);
  }
  const lastRegWeek = weekVessels.size ? [...weekVessels.keys()].sort().at(-1)! : null;

  const weekly: WeeklyPlanRow[] = [];
  if (allDates.length) {
    const firstWeek = mondayOf(allDates[0]);
    const lastWeek = mondayOf(allDates.at(-1)!);
    const weeks: string[] = [];
    for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) weeks.push(w);

    // 週次需要・入荷を先に集計
    const weekAgg = (series: ItemSeries, code: string, wk: string): number => {
      const m = series.get(code);
      if (!m) return 0;
      let sum = 0;
      for (let d = wk, i = 0; i < 7; d = addDays(d, 1), i++) sum += m.get(d) ?? 0;
      return sum;
    };
    const demandOf = (code: string, wk: string) =>
      weekAgg(demandReleased, code, wk) + weekAgg(demandPlanned, code, wk);

    const prevBalance = new Map<string, number>(
      items.map(({ code }) => [code, stock0.get(code) ?? 0]),
    );
    weeks.forEach((wk, k) => {
      const inReg = lastRegWeek !== null && wk <= lastRegWeek;
      let vesselLabel = '';
      if (weekVessels.has(wk)) {
        vesselLabel = weekVessels.get(wk)!.sort().join(', ');
      } else if (lastRegWeek && wk > lastRegWeek && maxYWeek) {
        const diffWeeks = Math.round(
          (Date.parse(`${wk}T00:00:00Z`) - Date.parse(`${lastRegWeek}T00:00:00Z`)) / (7 * 86400e3),
        );
        vesselLabel = `Y${maxYWeek + diffWeeks}(推定)`;
      }
      const cells: WeeklyPlanRow['cells'] = {};
      for (const { code } of items) {
        const demand = demandOf(code, wk);
        const scheduled = weekAgg(supply, code, wk);
        const nextDemand = k + 1 < weeks.length ? demandOf(code, weeks[k + 1]) : 0;
        const prev = prevBalance.get(code) ?? 0;
        const required = Math.ceil(
          Math.max(0, demand + params.safetyFactor * nextDemand - prev - scheduled),
        );
        const endBalance = prev + scheduled + required - demand;
        cells[code] = { demand, scheduled, required, endBalance };
        prevBalance.set(code, endBalance);
      }
      weekly.push({
        weekStart: wk,
        vesselLabel,
        loadWeekStart: addDays(wk, -7 * params.leadWeeks),
        inRegisteredPeriod: inReg,
        cells,
      });
    });
  }

  return {
    asOf,
    items,
    summaries,
    daily,
    weekly,
    vesselArrivals,
    unmatchedVesselRefs,
    supplyEndDate,
  };
}
