// 配船積載・不足分析の型定義。
// 入力は基幹システムの帳票Excel5種（①現状在庫一覧照会 ②受払予定一覧照会
// ③投入一覧照会 ④入荷実績一覧登録 ⑤配船マスタ）。詳細は analysis/README.md 参照。

/** 帳票の種別キー */
export type SourceKind = 'inventory' | 'planned' | 'released' | 'arrivals' | 'vessels';

export const SOURCE_LABELS: Record<SourceKind, string> = {
  inventory: '①現状在庫一覧照会',
  planned: '②受払予定一覧照会',
  released: '③投入一覧照会',
  arrivals: '④入荷実績一覧登録',
  vessels: '⑤配船マスタ',
};

/** ①現状在庫（必要列のみ） */
export interface InventoryRow {
  itemCode: string;
  itemName: string;
  locationCode: string;
  qty: number;
}

/** ②受払予定（未確定の使用予定） */
export interface PlannedRow {
  itemCode: string;
  itemName: string;
  date: string; // YYYY-MM-DD（予定日付）
  qty: number;  // 基準単位出庫数量
}

/** ③投入（確定済の使用予定） */
export interface ReleasedRow {
  itemCode: string;
  itemName: string;
  date: string; // YYYY-MM-DD（投入予定日）
  qty: number;  // 投入残数量
}

/** ④入荷実績（未入荷=これから入荷する分） */
export interface ArrivalRow {
  itemCode: string;
  itemName: string;
  date: string;      // YYYY-MM-DD（入荷予定日）
  qty: number;       // 入荷予定数量
  vesselRef: string; // 入荷連絡備考（配船番号 例: Y288-1K）
  status: string;    // 進捗状況区分名
}

/** ⑤配船マスタ */
export interface VesselRow {
  vesselNo: string;    // shp_air_no 例: 283-A
  weekCode: string;    // wk_cd
  typeName: string;    // 船便/航空便
  shipName: string;    // shp_nm
  containerSize: string;
  departureDate: string | null; // 日本出港日
  deleted: boolean;
}

/** パース結果（5種すべて揃って初めて分析可能） */
export interface ParsedSources {
  inventory: InventoryRow[];
  planned: PlannedRow[];
  released: ReleasedRow[];
  arrivals: ArrivalRow[];
  vessels: VesselRow[];
  /** 判別できたファイル名（種別→ファイル名） */
  fileNames: Partial<Record<SourceKind, string>>;
}

// ─── 分析結果 ───────────────────────────────────────────────────────

export interface ItemSummary {
  itemCode: string;
  itemName: string;
  stock0: number;            // 現在庫
  supplyTotal: number;       // 登録済入荷予定 合計
  demandUntilSupplyEnd: number; // 入荷登録期間内の需要
  balanceAtSupplyEnd: number;   // 入荷登録期間末の見込在庫
  demandTotal: number;          // 全期間需要
  finalBalance: number;         // 追加入荷なしの最終過不足
  firstShortageDate: string | null; // 最初に在庫割れする日
}

export interface DailyRow {
  date: string;
  supply: number;
  demandReleased: number; // ③確定分
  demandPlanned: number;  // ②未確定分
  balance: number;
}

export interface WeeklyItemCell {
  demand: number;
  scheduled: number; // 登録済入荷
  required: number;  // 必要追加入荷
  endBalance: number;
}

export interface WeeklyPlanRow {
  weekStart: string;          // 月曜
  vesselLabel: string;        // 実配船 or Y29x(推定)
  loadWeekStart: string;      // 積込目安（週の月曜）
  inRegisteredPeriod: boolean; // 登録済入荷期間内（船便では間に合わない）
  cells: Record<string, WeeklyItemCell>; // itemCode -> cell
}

export interface VesselArrivalRow {
  ref: string;
  minDate: string;
  maxDate: string;
  master: { shipName: string; containerSize: string; departureDate: string | null } | null;
  qty: Record<string, number>; // itemCode -> qty
  total: number;
}

export interface AnalysisResult {
  asOf: string;               // 基準日
  items: { code: string; name: string }[];
  summaries: ItemSummary[];
  daily: Record<string, DailyRow[]>; // itemCode -> rows
  weekly: WeeklyPlanRow[];
  vesselArrivals: VesselArrivalRow[];
  unmatchedVesselRefs: string[]; // ⑤に無い配船番号
  supplyEndDate: string | null;  // 登録済入荷の最終日
}

export interface PlanParams {
  /** 安全在庫係数（翌週需要×） */
  safetyFactor: number;
  /** 海上リードタイム（週） */
  leadWeeks: number;
}

export const DEFAULT_PLAN_PARAMS: PlanParams = { safetyFactor: 0.5, leadWeeks: 3 };
