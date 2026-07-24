/**
 * 部署（工場）スコープ — 一般(member)・作業者(worker)に「自分の所属工場のデータだけ」を見せる。
 *
 * ポータルは /api/provision で {factory} を送ってくる（部署が「工場」種別のときは部署名、
 * それ以外は null）。これを users.factory に保存し、表示範囲の判定に使う。
 *   - 管理者（role='admin'）              → 制限なし（全工場を閲覧可）
 *   - 工場未設定（factory=NULL）          → 制限なし（全工場を閲覧可）
 *   - それ以外（工場所属の一般・作業者）  → その工場のデータのみ
 *
 * ポータルから来るのは「工場名」なので、工場マスタ（factories.name）から工場コード
 * （products.factory_code 等の突合キー）へ解決してから使う。一致する工場が無い場合は
 * 安全側に倒して「何も表示しない」（factoryCode = null）。
 *
 * サーバー（lib/db.ts）とクライアント（lib/store.ts）の双方から使うため、
 * このモジュールはサーバー専用の依存を持たない純粋な関数だけで構成する。
 */
import type {
  Location, Product, ProductionPlan, DailyProductionPlan, BaselineStock,
  InventoryStock, LocationStock, WeeklyShippingSchedule, InTransitStock, PlannedSales,
  OperatingDays, SendQtyManual, NonWorkingDates,
} from './types';

/**
 * 部署名に一致する工場が工場マスタに無いときの番兵コード。
 * どの工場コードにも一致しないため、突合すると結果が空になる（安全側）。
 */
export const NO_FACTORY_MATCH = '__PF_NO_FACTORY__';

/** 解決済みの工場スコープ。null = 制限なし（全工場を閲覧可）。 */
export interface FactoryScope {
  /** ポータル部署（工場）名。UI 表示に使う。 */
  factoryName: string;
  /** 工場マスタで解決した工場コード。null = 一致する工場が無い（＝表示は空にする）。 */
  factoryCode: string | null;
}

/**
 * 工場スコープ（データ表示制限）の判定。
 * 管理者は null（全工場を閲覧可）。それ以外は所属工場名（NULL なら同じく制限なし）。
 */
export function factoryScopeOf(
  role: 'admin' | 'member' | 'worker' | null | undefined,
  factory: string | null | undefined,
): string | null {
  if (role === 'admin') return null;
  const name = (factory ?? '').trim();
  return name || null;
}

/** 製品の所属工場コード（未設定は 'F001' 既定＝アプリ全体の既定と揃える）。 */
export const productFactoryCode = (p: { factoryCode?: string }): string => p.factoryCode || 'F001';

/**
 * 工場マスタ（code/name）からポータルの部署名に対応する工場コードを解決する。
 * 名前一致を優先し、無ければコード一致も許容する。見つからなければ null。
 */
export function resolveFactoryCode(
  factories: { code: string; name: string }[],
  factoryName: string,
): string | null {
  const key = factoryName.trim();
  if (!key) return null;
  const byName = factories.find((f) => (f.name ?? '').trim() === key);
  if (byName) return byName.code;
  const byCode = factories.find((f) => (f.code ?? '').trim() === key);
  return byCode ? byCode.code : null;
}

// ─── クライアント側の表示絞り込み ────────────────────────────────────────────
// LocalDataSource（IndexedDB）から読んだデータセットにも同じスコープを適用する。
// サーバー（lib/db.ts）側は SQL で同じ条件を適用しており、こちらは表示用の二重防御。

/** 工場スコープを適用するデータセット（store の状態のうち工場軸を持つもの）。 */
export interface ScopableDataset {
  locations: Location[];
  products: Product[];
  productionPlan: ProductionPlan;
  dailyProductionPlan: DailyProductionPlan;
  baselineStock: BaselineStock;
  inventoryStock: InventoryStock;
  locationStock: LocationStock;
  weeklyShippingSchedule: WeeklyShippingSchedule;
  operatingDays: OperatingDays;
  nonWorkingDates: NonWorkingDates;
  inTransitStock: InTransitStock;
  plannedSales: PlannedSales;
  sendQtyManual: SendQtyManual;
}

/** product_code をキーに持つマップを、スコープ内の製品だけに絞る。 */
function pickByProduct<V>(map: Record<string, V>, codes: Set<string>): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [pc, v] of Object.entries(map ?? {})) if (codes.has(pc)) out[pc] = v;
  return out;
}

/** factory_code をキーに持つマップを、スコープの工場だけに絞る。 */
function pickByFactory<V>(map: Record<string, V>, code: string | null): Record<string, V> {
  if (!code) return {};
  const v = (map ?? {})[code];
  return v === undefined ? {} : { [code]: v };
}

/**
 * データセット全体に工場スコープを適用する（scope=null なら素通し）。
 * - 場所マスター: 出荷先（拠点）は工場軸ではないので残し、生産元だけスコープの工場に絞る
 * - 製品・製品キーのデータ（生産計画/在庫/拠点在庫/輸送中/予定出荷/送り数）: 所属工場で絞る
 * - 工場キーのデータ（出荷スケジュール/稼働日/非稼働日）: スコープの工場のみ
 */
export function applyFactoryScopeToDataset<T extends ScopableDataset>(
  data: T,
  scope: FactoryScope | null,
): T {
  if (!scope) return data;
  const code = scope.factoryCode;

  // 生産元ロールはスコープの工場のみ残す（出荷先ロールはそのまま＝拠点は全社共通）
  const locations = (data.locations ?? []).flatMap<Location>((l) => {
    const isFactory = l.role === 'factory' || l.role === 'both';
    if (!isFactory) return [l];
    if (l.code === code) return [l];
    return l.role === 'both' ? [{ ...l, role: 'warehouse' as const }] : [];
  });

  const products = code
    ? (data.products ?? []).filter((p) => productFactoryCode(p) === code)
    : [];
  const codes = new Set(products.map((p) => p.code));

  return {
    ...data,
    locations,
    products,
    productionPlan: pickByProduct(data.productionPlan, codes),
    dailyProductionPlan: pickByProduct(data.dailyProductionPlan, codes),
    baselineStock: pickByProduct(data.baselineStock, codes),
    inventoryStock: pickByProduct(data.inventoryStock, codes),
    locationStock: pickByProduct(data.locationStock, codes),
    inTransitStock: pickByProduct(data.inTransitStock, codes),
    plannedSales: pickByProduct(data.plannedSales, codes),
    sendQtyManual: pickByProduct(data.sendQtyManual, codes),
    weeklyShippingSchedule: pickByFactory(data.weeklyShippingSchedule, code),
    operatingDays: pickByFactory(data.operatingDays, code),
    nonWorkingDates: pickByFactory(data.nonWorkingDates, code),
  };
}
