#!/usr/bin/env node
/**
 * demonstrate-truck-selection.mjs
 *
 * サンプルデータで「現行（拠点固定トラック）」と「新方式（最適トラック選定）」の
 * 積載効率を比較する検証スクリプト。DB不要・純計算。
 *
 *   node scripts/demonstrate-truck-selection.mjs
 */

// ── サンプルデータ（seed-sample-data.mjs と同一）─────────────────────
const FLEET = [
  { code: 'T01', name: '2t',        cols: 1, rows: 4, heightMM: 2100 },
  { code: 'T02', name: '4t',        cols: 2, rows: 4, heightMM: 2200 },
  { code: 'T05', name: 'ウイング4t', cols: 2, rows: 4, heightMM: 2300 },
  { code: 'T06', name: 'ウイング10t',cols: 2, rows: 6, heightMM: 2600 },
  { code: 'T04', name: 'トレーラー20t',cols: 2, rows: 8, heightMM: 2500 },
];
const floorCap = (t) => t.cols * t.rows;

const products = {
  D001: { cap: 60 }, D002: { cap: 60 }, D003: { cap: 72 }, D004: { cap: 100 },
  D005: { cap: 100 }, D006: { cap: 48 }, D007: { cap: 48 }, D008: { cap: 60 },
};
const productionQty = { D001: 4800, D002: 3600, D003: 7200, D004: 5000, D005: 4000, D006: 2400, D007: 2400, D008: 3600 };
const warehouses = [
  { code: 'W001', name: '札幌',   truck: 'T06' },
  { code: 'W002', name: '仙台',   truck: 'T05' },
  { code: 'W003', name: '東京',   truck: 'T04' },
  { code: 'W004', name: '名古屋', truck: 'T06' },
  { code: 'W005', name: '大阪',   truck: 'T06' },
  { code: 'W006', name: '福岡',   truck: 'T05' },
];
const shareByWh = { W001: 10, W002: 15, W003: 30, W004: 15, W005: 20, W006: 10 };
const PALLET_LOADED_H = 1200; // 全パレット 1200mm

// ── 送り数 → 拠点別 総パレット数（週間マージ）─────────────────────
// sendQty_wh(product) = round(production * share / 100)（サンプルでは有効在庫=0）
function palletsForWarehouse(whCode) {
  const share = shareByWh[whCode];
  let pallets = 0;
  for (const [code, { cap }] of Object.entries(products)) {
    const sendQty = Math.round(productionQty[code] * share / 100);
    pallets += Math.floor(sendQty / cap);
  }
  return pallets;
}

// ── 有効容量（2段積み考慮）───────────────────────────────────────
function effCap(truck) {
  const canStack = PALLET_LOADED_H * 2 <= truck.heightMM; // 全製品 stackable 前提
  return canStack ? floorCap(truck) * 2 : floorCap(truck);
}

// ── 現行ロジック: 拠点固定トラック ─────────────────────────────────
function oldPlan(P, dockTruck) {
  const cap = effCap(dockTruck);
  const trucks = Math.ceil(P / cap);
  const fill = trucks > 0 ? Math.round((P / (trucks * cap)) * 100) : 0;
  return { label: `${dockTruck.name}×${trucks}`, trucks, fill, totalCap: trucks * cap };
}

// ── 新方式: 最適トラック選定（DP: 廃棄スロット最小 → 台数最小）──────────
function selectTrucks(P, dockTruck) {
  const dockFloor = floorCap(dockTruck);
  const candidates = FLEET
    .filter((t) => floorCap(t) <= dockFloor)           // ドック制約（積載床面）
    .map((t) => ({ ...t, eff: effCap(t) }));
  if (P <= 0) return { picks: [], trucks: 0, fill: 0, totalCap: 0 };

  // dp[k] = 「k枚以上を運ぶ」最良解。比較: (総容量 asc, 台数 asc)
  const NEG = Infinity;
  const dp = Array.from({ length: P + 1 }, () => ({ cap: NEG, count: NEG, from: -1, cand: -1 }));
  dp[0] = { cap: 0, count: 0, from: -1, cand: -1 };
  const better = (a, b) => a.cap !== b.cap ? a.cap < b.cap : a.count < b.count;
  for (let k = 1; k <= P; k++) {
    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];
      const prev = dp[Math.max(0, k - c.eff)];
      if (prev.cap === NEG) continue;
      const cand = { cap: prev.cap + c.eff, count: prev.count + 1, from: Math.max(0, k - c.eff), cand: ci };
      if (dp[k].cap === NEG || better(cand, dp[k])) dp[k] = cand;
    }
  }
  // 復元
  const picks = [];
  let k = P;
  while (k > 0 && dp[k].cand >= 0) {
    const c = candidates[dp[k].cand];
    picks.push(c);
    k = dp[k].from;
  }
  const totalCap = picks.reduce((s, c) => s + c.eff, 0);
  const fill = totalCap > 0 ? Math.round((P / totalCap) * 100) : 0;
  // 集計表示
  const byType = {};
  for (const c of picks) byType[c.name] = (byType[c.name] ?? 0) + 1;
  const label = Object.entries(byType).map(([n, c]) => `${n}×${c}`).join(' + ') || '—';
  return { picks, label, trucks: picks.length, fill, totalCap };
}

// ── 比較出力 ─────────────────────────────────────────────────────
console.log('\n📊 週間マージ・拠点別 積載効率の比較（サンプルデータ）\n');
console.log('拠点      P枚  │ 現行(固定)          積載率 │ 新方式(選定)              積載率');
console.log('─'.repeat(92));
let oldFillSum = 0, newFillSum = 0, oldTrucks = 0, newTrucks = 0, n = 0;
for (const wh of warehouses) {
  const P = palletsForWarehouse(wh.code);
  const dock = FLEET.find((t) => t.code === wh.truck);
  const o = oldPlan(P, dock);
  const s = selectTrucks(P, dock);
  oldFillSum += o.fill; newFillSum += s.fill; oldTrucks += o.trucks; newTrucks += s.trucks; n++;
  console.log(
    `${wh.name.padEnd(6)}  ${String(P).padStart(3)}枚 │ ` +
    `${o.label.padEnd(16)} ${String(o.fill).padStart(4)}% │ ` +
    `${s.label.padEnd(22)} ${String(s.fill).padStart(4)}%`,
  );
}
console.log('─'.repeat(92));
console.log(
  `平均積載率: 現行 ${Math.round(oldFillSum / n)}%（${oldTrucks}台） → ` +
  `新方式 ${Math.round(newFillSum / n)}%（${newTrucks}台）`,
);
console.log('');
