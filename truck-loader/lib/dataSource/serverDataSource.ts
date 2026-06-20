/**
 * ServerDataSource — 既存の Server Actions（lib/db.ts / Neon Postgres）を
 * DataSource インターフェースに適合させたラッパー。
 *
 * 既存挙動と完全に同一。オンライン時・Web版のデフォルト実装。
 */
import * as db from '@/lib/db';
import type { DataSource } from './types';

export const serverDataSource: DataSource = {
  kind: 'server',

  // ─── 一括ロード ──────────────────────────────────────────
  loadFactories: db.loadFactories,
  loadProducts: db.loadProducts,
  loadWarehouses: db.loadWarehouses,
  loadTruckTypes: db.loadTruckTypes,
  loadPalletTypes: db.loadPalletTypes,
  loadProductionPlan: db.loadProductionPlan,
  loadDailyProductionPlan: db.loadDailyProductionPlan,
  loadBaselineStock: db.loadBaselineStock,
  loadInventoryStock: db.loadInventoryStock,
  loadLocationStock: db.loadLocationStock,
  loadWeeklyShippingSchedule: db.loadWeeklyShippingSchedule,
  loadOperatingDays: db.loadOperatingDays,
  loadNonWorkingDates: db.loadNonWorkingDates,
  loadInTransitStock: db.loadInTransitStock,
  loadPlannedSales: db.loadPlannedSales,
  loadSendQtyManual: db.loadSendQtyManual,

  // ─── 工場 ────────────────────────────────────────────────
  upsertFactory: db.upsertFactory,
  deleteFactory: db.deleteFactory,

  // ─── 製品 ────────────────────────────────────────────────
  upsertProduct: db.upsertProduct,
  upsertProducts: db.upsertProducts,
  deleteProduct: db.deleteProduct,

  // ─── 倉庫 ────────────────────────────────────────────────
  upsertWarehouse: db.upsertWarehouse,
  deleteWarehouse: db.deleteWarehouse,

  // ─── トラック種別 ────────────────────────────────────────
  upsertTruckType: db.upsertTruckType,
  deleteTruckType: db.deleteTruckType,

  // ─── パレット種別 ────────────────────────────────────────
  upsertPalletType: db.upsertPalletType,
  deletePalletType: db.deletePalletType,

  // ─── 生産計画 ────────────────────────────────────────────
  upsertProductionQty: db.upsertProductionQty,
  upsertDailyProductionQty: db.upsertDailyProductionQty,
  replaceAllDailyProductionPlan: db.replaceAllDailyProductionPlan,

  // ─── 基準在庫 ────────────────────────────────────────────
  upsertBaseline: db.upsertBaseline,
  replaceAllBaselineStock: db.replaceAllBaselineStock,

  // ─── 全体在庫 ────────────────────────────────────────────
  upsertInventoryStock: db.upsertInventoryStock,
  replaceAllInventoryStock: db.replaceAllInventoryStock,

  // ─── 拠点別現在庫 ────────────────────────────────────────
  upsertLocationStock: db.upsertLocationStock,
  replaceAllLocationStock: db.replaceAllLocationStock,

  // ─── 輸送中在庫 ──────────────────────────────────────────
  upsertInTransitStock: db.upsertInTransitStock,
  replaceAllInTransitStock: db.replaceAllInTransitStock,

  // ─── 予定出荷 ────────────────────────────────────────────
  upsertPlannedSales: db.upsertPlannedSales,
  replaceAllPlannedSales: db.replaceAllPlannedSales,

  // ─── 出荷スケジュール ────────────────────────────────────
  upsertShippingSchedule: db.upsertShippingSchedule,

  // ─── 稼働日 ──────────────────────────────────────────────
  upsertOperatingDays: db.upsertOperatingDays,

  // ─── 非稼働日 ────────────────────────────────────────────
  addNonWorkingDate: db.addNonWorkingDate,
  removeNonWorkingDate: db.removeNonWorkingDate,

  // ─── 送り数手動上書き ────────────────────────────────────
  upsertSendQtyManual: db.upsertSendQtyManual,
  deleteSendQtyManual: db.deleteSendQtyManual,
  replaceAllSendQtyManual: db.replaceAllSendQtyManual,

  // ─── シード ──────────────────────────────────────────────
  seedSampleData: db.seedSampleDataForCompany,
};
