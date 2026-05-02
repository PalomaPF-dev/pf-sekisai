import type { Product } from './types';

/** 器具名ごとに割り当てるカラーパレット */
export const PRODUCT_PALETTE = [
  '#4A90D9', '#E67E22', '#2ECC71', '#9B59B6',
  '#E74C3C', '#1ABC9C', '#F39C12', '#3498DB',
  '#C0392B', '#27AE60', '#8E44AD', '#16A085',
  '#D35400', '#2980B9', '#F1C40F', '#E91E63',
  '#00BCD4', '#FF5722', '#607D8B', '#795548',
];

/**
 * 器具名 → 色 のマップを返す（products の出現順に色を割り当て）
 * 器具名が未設定の製品は '#94a3b8'（グレー）
 */
export function buildEquipmentColorMap(products: Product[]): Record<string, string> {
  const map: Record<string, string> = {};
  let idx = 0;
  for (const p of products) {
    const key = p.equipmentName?.trim() ?? '';
    if (key && !(key in map)) {
      map[key] = PRODUCT_PALETTE[idx % PRODUCT_PALETTE.length];
      idx++;
    }
  }
  return map;
}

/**
 * 製品コード → 色 のマップを返す（器具名単位で色を統一）
 * LoadingPlanInner / TruckDiagram に渡す productColors として使用
 */
export function buildProductColors(products: Product[]): Record<string, string> {
  const eqMap = buildEquipmentColorMap(products);
  return Object.fromEntries(
    products.map((p) => {
      const key = p.equipmentName?.trim() ?? '';
      return [p.code, key ? (eqMap[key] ?? '#94a3b8') : '#94a3b8'];
    }),
  );
}
