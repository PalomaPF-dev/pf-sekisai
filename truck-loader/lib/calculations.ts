import type {
  Factory, Product, Warehouse, TruckType, PalletType,
  ProductionPlan, BaselineStock,
  LocationStock, InTransitStock, PlannedSales, SendQtyManual,
  PalletItem, TruckLoad, TruckLayout, TruckSlotItem, WarehousePlan,
  WeeklyShippingSchedule, DayWarehousePlan,
} from './types';

/** 切り上げ除算 */
const ceilDiv = (a: number, b: number) => (b > 0 ? Math.ceil(a / b) : 0);

/** 同名倉庫をグループ化する */
export function groupWarehousesByName(warehouses: Warehouse[]): Map<string, Warehouse[]> {
  const map = new Map<string, Warehouse[]>();
  for (const wh of warehouses) {
    if (!map.has(wh.name)) map.set(wh.name, []);
    map.get(wh.name)!.push(wh);
  }
  return map;
}

/** 1行＝1製品×1拠点 の配分内訳（AIコンテキスト・画面表示用） */
export interface DistributionDetailRow {
  productCode: string;
  warehouseCode: string;
  required: number;        // 拠点別 基準在庫数（個）
  currentStock: number;    // 拠点在庫（個）
  inTransit: number;       // 輸送中（個）
  plannedSales: number;    // 予定出荷（個）
  effectiveStock: number;  // max(0, 拠点在庫 + 輸送中 - 予定出荷)
  shortage: number;        // max(0, 必要 - 有効在庫)
  sendQty: number;         // 計算された送り数（個）
}

/**
 * 在庫不足に基づく配分内訳を計算する（送り数の根拠を含む）
 * 必要在庫 = 拠点別 基準在庫数（個）
 * 有効在庫 = max(0, 拠点在庫 + 輸送中 - 予定出荷)
 * 不足数 = max(0, 必要 - 有効在庫)
 * 生産数を不足比率で按分して送り数を決定する
 */
export function calcDistributionDetail(
  products: Product[],
  warehouses: Warehouse[],
  productionPlan: ProductionPlan,
  baselineStock: BaselineStock,
  locationStock: LocationStock,
  inTransitStock: InTransitStock = {},
  plannedSales: PlannedSales = {},
): DistributionDetailRow[] {
  const rows: DistributionDetailRow[] = [];

  for (const p of products) {
    const production = productionPlan[p.code] ?? 0;

    // 各拠点の不足数を計算（拠点在庫 + 輸送中 - 予定出荷 を有効在庫とする）
    const stats: Record<string, Omit<DistributionDetailRow, 'productCode' | 'warehouseCode' | 'sendQty'>> = {};
    let totalShortage = 0;

    for (const wh of warehouses) {
      const required = baselineStock[p.code]?.[wh.code] ?? 0;
      const currentStock = locationStock[p.code]?.[wh.code] ?? 0;
      const inTransit = inTransitStock[p.code]?.[wh.code] ?? 0;
      const sales = plannedSales[p.code]?.[wh.code] ?? 0;
      const effectiveStock = Math.max(0, currentStock + inTransit - sales);
      const shortage = Math.max(0, required - effectiveStock);
      stats[wh.code] = { required, currentStock, inTransit, plannedSales: sales, effectiveStock, shortage };
      totalShortage += shortage;
    }

    // 生産数を不足比率で按分
    for (const wh of warehouses) {
      const s = stats[wh.code];
      let sendQty: number;
      if (totalShortage === 0 || production === 0) {
        sendQty = 0;
      } else if (totalShortage <= production) {
        // 生産数が不足を全て賄える場合：不足数をそのまま送る
        sendQty = s.shortage;
      } else {
        // 生産数が不足に満たない場合：比率で按分
        sendQty = Math.round(production * s.shortage / totalShortage);
      }
      rows.push({ productCode: p.code, warehouseCode: wh.code, ...s, sendQty });
    }
  }

  return rows;
}

/**
 * 在庫不足に基づいて各拠点への送り数を計算する
 * （内訳は calcDistributionDetail を共有し、ここでは送り数のみを取り出す）
 */
export function calcSendQty(
  products: Product[],
  warehouses: Warehouse[],
  productionPlan: ProductionPlan,
  baselineStock: BaselineStock,
  locationStock: LocationStock,
  inTransitStock: InTransitStock = {},
  plannedSales: PlannedSales = {},
): Record<string, Record<string, number>> {
  const sendQty: Record<string, Record<string, number>> = {};
  // 製品キーを必ず初期化（拠点ゼロでも空オブジェクトを保持し従来挙動と一致させる）
  for (const p of products) sendQty[p.code] = {};

  const rows = calcDistributionDetail(
    products, warehouses, productionPlan, baselineStock, locationStock, inTransitStock, plannedSales,
  );
  for (const r of rows) {
    sendQty[r.productCode][r.warehouseCode] = r.sendQty;
  }

  return sendQty;
}

/** 選定候補トラック（有効容量つき） */
interface TruckCandidate {
  type: TruckType;
  floorCap: number; // 床面スロット数（ドック制約の判定に使用）
  eff: number;      // 有効容量（2段積み込み）
}

/**
 * フリートから、ドック制約（床面 ≤ dockFloorCap）を満たす候補を作る。
 * 各候補の有効容量は積載予定製品のスタッキング可否で決まる。
 */
function buildTruckCandidates(
  fleet: TruckType[],
  dockFloorCap: number,
  canStackProducts: boolean,
  minLoadedH: number,
): TruckCandidate[] {
  const cands: TruckCandidate[] = [];
  for (const t of fleet) {
    const floorCap = t.cols * t.rows;
    if (floorCap <= 0 || floorCap > dockFloorCap) continue; // ドックに入らない大型は除外
    const truckH = t.heightMM ?? 2300;
    const canStack = canStackProducts && minLoadedH * 2 <= truckH;
    const eff = Math.max(t.maxPallets, canStack ? floorCap * 2 : floorCap);
    cands.push({ type: t, floorCap, eff });
  }
  return cands;
}

/**
 * P枚のパレットを運ぶ最適なトラックの組合せを選定する。
 * 目的: ①廃棄スロット最小（積載率最大）→ ②台数最小 → ③大型優先。
 * DP（被覆問題）で最適化。Pが大きい場合はグリーディにフォールバック。
 * 戻り値は有効容量の降順（大型に先に積む）。
 */
export function selectTrucksForPallets(P: number, candidates: TruckCandidate[]): TruckCandidate[] {
  if (P <= 0 || candidates.length === 0) return [];
  const sortedDesc = [...candidates].sort((a, b) => b.eff - a.eff);
  const maxEff = sortedDesc[0].eff;

  // 大きすぎる P は DP 配列が膨らむためグリーディ（最大車種を満載で並べ、端数を最適車種で）
  if (P > 800) {
    const picks: TruckCandidate[] = [];
    let rem = P;
    const big = sortedDesc[0];
    while (rem > big.eff) { picks.push(big); rem -= big.eff; }
    // 端数 rem を、廃棄最小の単一車種で
    let best = sortedDesc.find((c) => c.eff >= rem) ?? big;
    for (const c of sortedDesc) if (c.eff >= rem && c.eff < best.eff) best = c;
    picks.push(best);
    return picks.sort((a, b) => b.eff - a.eff);
  }

  // dp[k] = 「k枚以上を運ぶ」最良解。比較は (総容量 asc, 台数 asc)
  const INF = Number.POSITIVE_INFINITY;
  const dp: { cap: number; count: number; from: number; cand: number }[] =
    Array.from({ length: P + 1 }, () => ({ cap: INF, count: INF, from: -1, cand: -1 }));
  dp[0] = { cap: 0, count: 0, from: -1, cand: -1 };
  const better = (a: { cap: number; count: number }, b: { cap: number; count: number }) =>
    a.cap !== b.cap ? a.cap < b.cap : a.count < b.count;

  for (let k = 1; k <= P; k++) {
    for (let ci = 0; ci < sortedDesc.length; ci++) {
      const c = sortedDesc[ci];
      const prev = dp[Math.max(0, k - c.eff)];
      if (prev.cap === INF) continue;
      const cand = { cap: prev.cap + c.eff, count: prev.count + 1, from: Math.max(0, k - c.eff), cand: ci };
      if (dp[k].cap === INF || better(cand, dp[k])) dp[k] = cand;
    }
  }

  // 復元（解が無ければ最大車種で被覆するフォールバック）
  if (dp[P].cand < 0) {
    const picks: TruckCandidate[] = [];
    let rem = P;
    while (rem > 0) { picks.push(sortedDesc[0]); rem -= maxEff; }
    return picks;
  }
  const picks: TruckCandidate[] = [];
  let k = P;
  while (k > 0 && dp[k].cand >= 0) {
    picks.push(sortedDesc[dp[k].cand]);
    k = dp[k].from;
  }
  return picks.sort((a, b) => b.eff - a.eff);
}

/**
 * 1拠点分の積載計画を計算する（送り数を外部から受け取る）
 * dockTruck はその拠点が受入可能な最大トラック（ドック制約）。
 * fleet（全車種）から最も積載効率の良いトラックを選定して積み付ける。
 */
export function calcWarehousePlan(
  warehouseCode: string,
  products: Product[],
  dockTruck: TruckType,
  fleet: TruckType[],
  sendQty: Record<string, Record<string, number>>,
  palletTypes: PalletType[] = [],
): WarehousePlan {
  const palletTypeMap = Object.fromEntries(palletTypes.map((pt) => [pt.code, pt]));
  const shippedProds = products.filter((p) => (sendQty[p.code]?.[warehouseCode] ?? 0) > 0);
  const minLoadedH = shippedProds.length > 0
    ? Math.min(...shippedProds.map((p) => palletTypeMap[p.palletType]?.loadedHeightMM ?? 1200))
    : 1200;
  // 2段積み条件: 上段に積める製品が存在 + 上積み許可の製品が存在（高さは車種ごとに判定）
  const hasUpperStackable  = shippedProds.some((p) => p.stackable !== false);
  const hasBottomStackable = shippedProds.some((p) => p.allowStackOnTop !== false);
  const canStackProducts = hasUpperStackable && hasBottomStackable;

  // 製品ごとに送り数 → パレット数を計算（端数は切り捨て＝完全パレット単位のみ）
  const items: { productCode: string; pallets: number; qty: number; capacityPerPallet: number }[] = [];
  for (const p of products) {
    const qty = sendQty[p.code]?.[warehouseCode] ?? 0;
    if (qty <= 0) continue;
    const pallets = Math.floor(qty / p.capacityPerPallet); // 端数切り捨て
    if (pallets <= 0) continue; // 1パレット未満は積載しない
    items.push({
      productCode: p.code,
      pallets,
      qty: pallets * p.capacityPerPallet,
      capacityPerPallet: p.capacityPerPallet,
    });
  }

  if (items.length === 0) {
    return { warehouseCode, trucks: [], totalPallets: 0, totalQty: 0 };
  }

  // 総パレット数 P を最適なトラック構成で運ぶ
  const totalP = items.reduce((s, i) => s + i.pallets, 0);
  const dockFloorCap = dockTruck.cols * dockTruck.rows;
  let candidates = buildTruckCandidates(fleet, dockFloorCap, canStackProducts, minLoadedH);
  if (candidates.length === 0) {
    // フリート未登録などの保険：ドックトラック単体を候補に
    const floorCap = dockTruck.cols * dockTruck.rows;
    const canStack = canStackProducts && minLoadedH * 2 <= (dockTruck.heightMM ?? 2300);
    candidates = [{ type: dockTruck, floorCap, eff: Math.max(dockTruck.maxPallets, canStack ? floorCap * 2 : floorCap) }];
  }
  const selected = selectTrucksForPallets(totalP, candidates);

  // 多パレット順に並び替え（重量・数量の多いものをキャブ側／大型車へ）
  items.sort((a, b) => b.pallets - a.pallets);

  // 選定済みトラック（大型→小型）へ順に満載で積み付ける
  const queue = items.map((i) => ({ ...i, rem: i.pallets, qtyRem: i.qty }));
  let qi = 0;
  const trucks: TruckLoad[] = [];

  for (let t = 0; t < selected.length; t++) {
    const cap = selected[t].eff;
    const truckItems: PalletItem[] = [];
    let slots = 0;
    while (slots < cap && qi < queue.length) {
      const it = queue[qi];
      if (it.rem <= 0) { qi++; continue; }
      const place = Math.min(it.rem, cap - slots);
      const qtyHere = Math.min(it.qtyRem, place * it.capacityPerPallet);
      truckItems.push({ productCode: it.productCode, pallets: place, qty: qtyHere, capacityPerPallet: it.capacityPerPallet });
      it.rem -= place;
      it.qtyRem -= qtyHere;
      slots += place;
      if (it.rem <= 0) qi++;
    }
    if (truckItems.length === 0) continue;
    trucks.push({
      truckIndex: trucks.length + 1,
      truckTypeCode: selected[t].type.code,
      items: truckItems,
      totalPallets: slots,
      maxPallets: cap,
    });
  }

  // 念のため：選定容量が不足して積み残しがあれば最大候補で追加（通常発生しない）
  const biggest = [...candidates].sort((a, b) => b.eff - a.eff)[0];
  while (qi < queue.length) {
    const cap = biggest.eff;
    const truckItems: PalletItem[] = [];
    let slots = 0;
    while (slots < cap && qi < queue.length) {
      const it = queue[qi];
      if (it.rem <= 0) { qi++; continue; }
      const place = Math.min(it.rem, cap - slots);
      const qtyHere = Math.min(it.qtyRem, place * it.capacityPerPallet);
      truckItems.push({ productCode: it.productCode, pallets: place, qty: qtyHere, capacityPerPallet: it.capacityPerPallet });
      it.rem -= place; it.qtyRem -= qtyHere; slots += place;
      if (it.rem <= 0) qi++;
    }
    if (truckItems.length === 0) break;
    trucks.push({ truckIndex: trucks.length + 1, truckTypeCode: biggest.type.code, items: truckItems, totalPallets: slots, maxPallets: cap });
  }

  const totalPallets = trucks.reduce((s, t) => s + t.totalPallets, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  return { warehouseCode, trucks, totalPallets, totalQty };
}

/**
 * 全拠点の積載計画を計算する（同名倉庫はマージして1プランにする）
 * Result is keyed by warehouse NAME (not code).
 */
export function calcAllPlans(
  warehouses: Warehouse[],
  products: Product[],
  truckTypes: TruckType[],
  productionPlan: ProductionPlan,
  baselineStock: BaselineStock,
  locationStock: LocationStock,
  inTransitStock: InTransitStock = {},
  plannedSales: PlannedSales = {},
  sendQtyManual: SendQtyManual = {},
  palletTypes: PalletType[] = [],
): Record<string, WarehousePlan> {
  const truckMap = Object.fromEntries(truckTypes.map(t => [t.code, t]));

  // 在庫不足に基づく送り数を計算（輸送中・予定出荷も考慮）
  const sendQty = calcSendQty(
    products, warehouses, productionPlan, baselineStock, locationStock, inTransitStock, plannedSales,
  );

  // 手動上書きを適用
  applyManualOverrides(sendQty, sendQtyManual);

  const result: Record<string, WarehousePlan> = {};
  const nameGroups = groupWarehousesByName(warehouses);

  for (const [name, whGroup] of nameGroups) {
    const firstWh = whGroup[0];
    const dockTruck = truckMap[firstWh.truckType];
    if (!dockTruck) continue;

    // Merge send quantities: sum over all codes in the group, keyed by name
    const mergedSendQty: Record<string, Record<string, number>> = {};
    for (const p of products) {
      const totalQty = whGroup.reduce((s, wh) => s + (sendQty[p.code]?.[wh.code] ?? 0), 0);
      mergedSendQty[p.code] = { [name]: totalQty };
    }

    const plan = calcWarehousePlan(name, products, dockTruck, truckTypes, mergedSendQty, palletTypes);
    result[name] = plan;
  }
  return result;
}

/** 手動上書きを sendQty に適用する（in-place） */
function applyManualOverrides(
  sendQty: Record<string, Record<string, number>>,
  manual: SendQtyManual,
) {
  for (const [pc, whMap] of Object.entries(manual)) {
    for (const [wc, qty] of Object.entries(whMap)) {
      if (qty > 0) {
        if (!sendQty[pc]) sendQty[pc] = {};
        sendQty[pc][wc] = qty;
      }
    }
  }
}

/**
 * 工場・曜日別の積載計画を計算する
 * factoryCode → DayWarehousePlan[] のマップを返す
 */
export function calcWeeklyPlans(
  warehouses: Warehouse[],
  products: Product[],
  truckTypes: TruckType[],
  factories: Factory[],
  productionPlan: ProductionPlan,
  baselineStock: BaselineStock,
  locationStock: LocationStock,
  schedule: WeeklyShippingSchedule,
  inTransitStock: InTransitStock = {},
  plannedSales: PlannedSales = {},
  sendQtyManual: SendQtyManual = {},
  palletTypes: PalletType[] = [],
): Record<string, DayWarehousePlan[]> {
  const truckMap = Object.fromEntries(truckTypes.map(t => [t.code, t]));
  const result: Record<string, DayWarehousePlan[]> = {};

  for (const factory of factories) {
    const factoryProducts = products.filter(
      (p) => (p.factoryCode ?? 'F001') === factory.code,
    );

    if (factoryProducts.length === 0) {
      result[factory.code] = [];
      continue;
    }

    // 週間送り数を計算（工場の製品のみ、輸送中・予定出荷考慮）
    const weeklySendQty = calcSendQty(
      factoryProducts,
      warehouses,
      productionPlan,
      baselineStock,
      locationStock,
      inTransitStock,
      plannedSales,
    );

    // 手動上書きを適用（この工場の製品のみ）
    applyManualOverrides(weeklySendQty, sendQtyManual);

    const dayPlans: DayWarehousePlan[] = [];

    const nameGroups = groupWarehousesByName(warehouses);

    for (const [name, whGroup] of nameGroups) {
      const firstWh = whGroup[0];
      const dockTruck = truckMap[firstWh.truckType];
      if (!dockTruck) continue;

      // Union of active days across all codes in the group
      const activeDaysSet = new Set<number>();
      for (const wh of whGroup) {
        const dayFlags = schedule[factory.code]?.[wh.code];
        if (dayFlags) {
          for (let i = 0; i < 7; i++) {
            if (dayFlags[i]) activeDaysSet.add(i);
          }
        }
      }
      const activeDays = Array.from(activeDaysSet).sort((a, b) => a - b);

      // Merge weekly send quantities: sum over all codes in the group
      if (activeDays.length === 0) {
        // スケジュールなし → 週全体として1プランを作る
        const mergedSendQty: Record<string, Record<string, number>> = {};
        for (const p of factoryProducts) {
          const totalQty = whGroup.reduce((s, wh) => s + (weeklySendQty[p.code]?.[wh.code] ?? 0), 0);
          mergedSendQty[p.code] = { [firstWh.code]: totalQty };
        }
        const plan = calcWarehousePlan(firstWh.code, factoryProducts, dockTruck, truckTypes, mergedSendQty, palletTypes);
        if (plan.trucks.length === 0) continue;
        dayPlans.push({ ...plan, factoryCode: factory.code, dayOfWeek: -1 });
      } else {
        // 曜日ごとにパレット単位で均等分割して計算
        // （個数単位で分割するとパレット未満の端数が生じるため、必ずパレット整数単位で配分する）
        const numDays = activeDays.length;

        for (const dayIdx of activeDays) {
          const daySendQty: Record<string, Record<string, number>> = {};
          const dayPosition = activeDays.indexOf(dayIdx);
          for (const p of factoryProducts) {
            const weeklyQty = whGroup.reduce((s, wh) => s + (weeklySendQty[p.code]?.[wh.code] ?? 0), 0);
            if (weeklyQty === 0) {
              daySendQty[p.code] = { [firstWh.code]: 0 };
              continue;
            }
            // ① 週間個数 → 必要パレット数（1枚未満は切り上げ）
            const weeklyPallets = Math.ceil(weeklyQty / p.capacityPerPallet);
            // ② パレット数を日数で均等分割。余りは最初の余り分の日に1枚ずつ積む
            const basePallets     = Math.floor(weeklyPallets / numDays);
            const remainderPallets = weeklyPallets % numDays;
            const palletsForDay   = basePallets + (dayPosition < remainderPallets ? 1 : 0);
            // ③ パレット数 → 個数（満載）
            daySendQty[p.code] = { [firstWh.code]: palletsForDay * p.capacityPerPallet };
          }
          const plan = calcWarehousePlan(firstWh.code, factoryProducts, dockTruck, truckTypes, daySendQty, palletTypes);
          if (plan.trucks.length === 0) continue;
          dayPlans.push({ ...plan, factoryCode: factory.code, dayOfWeek: dayIdx });
        }
      }
    }

    result[factory.code] = dayPlans;
  }

  return result;
}

/** 積載率 (%) — 各トラックの有効容量の合計に対する使用パレット比率。
 *  混在車種に対応するため、台数×単一容量ではなく台数別容量を合算する。
 *  第2引数 maxPallets は後方互換のための任意値（plan に積載があれば無視）。 */
export function fillRate(plan: WarehousePlan, maxPallets?: number): number {
  if (plan.trucks.length === 0) return 0;
  const totalCap = plan.trucks.reduce((s, t) => s + (t.maxPallets || 0), 0);
  if (totalCap > 0) return Math.round((plan.totalPallets / totalCap) * 100);
  if (maxPallets && maxPallets > 0) return Math.round(plan.totalPallets / (plan.trucks.length * maxPallets) * 100);
  return 0;
}

/**
 * 2段積みレイアウトを計算する（視覚化用）
 * TruckLoad の items を rows×cols の2D グリッド（床+上段）に配置する
 * - 前方（row=0）から後方（row=rows-1）へ順に床を埋める
 * - 床パレットの高さ + 上段パレットの高さ ≤ 荷室高さ の場合に上段配置
 * - orderNum は床面を先に振り、その後上段に連番
 * - 積載高さはパレット型の loadedHeightMM を優先し、未設定時は 1200mm
 */
export function calcStackingLayout(
  load: TruckLoad,
  truckType: TruckType,
  products: Product[],
  palletTypes: PalletType[] = [],
): TruckLayout {
  const { cols, rows, heightMM: truckH } = truckType;
  const TRUCK_H = truckH ?? 2300;

  // パレット型コード → loadedHeightMM マップ
  const palletTypeMap = Object.fromEntries(palletTypes.map((pt) => [pt.code, pt]));

  // 製品コード → 積載高さ マップ（パレット型の loadedHeightMM を優先）
  const heightMap: Record<string, number> = {};
  for (const p of products) {
    const pt = palletTypeMap[p.palletType];
    heightMap[p.code] = pt?.loadedHeightMM ?? 1200;
  }

  // 製品コード → スタッキングフラグ マップ
  const productMap = Object.fromEntries(products.map((p) => [p.code, p]));

  // 展開キュー（パレット1枚ずつ）
  const queue: TruckSlotItem[] = [];
  let orderNum = 1;
  for (const item of load.items) {
    const h = heightMap[item.productCode] ?? 1200;
    const qtyPerPallet = item.capacityPerPallet;
    for (let i = 0; i < item.pallets; i++) {
      queue.push({
        productCode: item.productCode,
        qty: qtyPerPallet,
        capacityPerPallet: qtyPerPallet,
        loadedHeightMM: h,
        orderNum: orderNum++,
      });
    }
  }

  // 初期化: floor[row][col], upper[row][col]
  const floor: (TruckSlotItem | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  const upper: (TruckSlotItem | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));

  // Phase 1: 床面を前→後、左→右の順に埋める
  outer1: for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (queue.length === 0) break outer1;
      floor[row][col] = queue.shift()!;
    }
  }

  // Phase 2: 上段に積めるか確認して埋める（床面と同順）
  outer2: for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (queue.length === 0) break outer2;
      const fp = floor[row][col];
      if (!fp) continue; // 床が空 → 上段も不可
      // 下段製品の「上積み許可」チェック
      const floorProd = productMap[fp.productCode];
      if (floorProd?.allowStackOnTop === false) continue;
      // 上段候補製品の「上段積み可」チェック（スキップして次の候補を探す）
      let placed = false;
      for (let qi = 0; qi < queue.length; qi++) {
        const candidate = queue[qi];
        const candidateProd = productMap[candidate.productCode];
        if (candidateProd?.stackable === false) continue;
        if (fp.loadedHeightMM + candidate.loadedHeightMM > TRUCK_H) continue;
        // 条件を満たす候補を上段に配置
        upper[row][col] = { ...candidate, orderNum: orderNum++ };
        queue.splice(qi, 1);
        placed = true;
        break;
      }
      if (!placed && queue.length === 0) break outer2;
    }
  }

  return { cols, rows, truckHeightMM: TRUCK_H, floor, upper };
}
