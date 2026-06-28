/**
 * 同期リポジトリ（フェーズ4 残作業：正規化テーブル整合）。
 *
 * ネイティブの同期(/api/sync/*)を、Web版と同じ正規化テーブル（products 等）に
 * 読み書きさせ、Web版とネイティブ版のデータを統一する。
 *
 * 実装方針: company_id を AsyncLocalStorage で固定し、db.ts の既存
 * load / upsert / replaceAll 系をそのまま再利用（SQLマッピングの二重化・driftを回避）。
 * データセット単位LWWのため、各コレクションは「全削除→再投入」で置換する。
 * 更新時刻は sync_meta テーブルで管理。
 *
 * ※ 置換はトランザクション化していない（neon serverlessのHTTP方式のため）。
 *   厳密化はトランザクションAPIで将来対応。
 */
import { sql } from '@/lib/neon';
import { runWithCompany } from './companyContext';
import * as db from '@/lib/db';
import type {
  Factory, Product, Warehouse, TruckType, PalletType,
  ProductionPlan, DailyProductionPlan, BaselineStock, InventoryStock,
  LocationStock, WeeklyShippingSchedule, InTransitStock, PlannedSales,
  OperatingDays, NonWorkingDates, SendQtyManual,
} from '@/lib/types';

// ─── 取り出しヘルパー（DatasetSnapshot.data は unknown 型のため） ──────────────
const asArr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asMap = <T>(v: unknown): T => ((v && typeof v === 'object' ? v : {}) as T);
const ent = (v: unknown): [string, unknown][] => (v && typeof v === 'object' ? Object.entries(v as object) : []);

// ─── sync_meta（更新時刻） ─────────────────────────────────────────────────
async function ensureSyncMeta(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS sync_meta (company_id uuid PRIMARY KEY, updated_at bigint NOT NULL)`;
}

export async function getSyncUpdatedAt(companyId: string): Promise<number> {
  await ensureSyncMeta();
  const rows = await sql`SELECT updated_at FROM sync_meta WHERE company_id = ${companyId}`;
  return rows.length ? Number(rows[0].updated_at) : 0;
}

async function setSyncUpdatedAt(companyId: string, updatedAt: number): Promise<void> {
  await ensureSyncMeta();
  await sql`
    INSERT INTO sync_meta (company_id, updated_at) VALUES (${companyId}, ${updatedAt})
    ON CONFLICT (company_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
  `;
}

/** 正規化テーブルから company のデータセットを組み立てる（LocalDB と同形） */
export async function loadSnapshotData(companyId: string): Promise<Record<string, unknown>> {
  return runWithCompany(companyId, async () => {
    const [
      factories, products, warehouses, truckTypes, palletTypes,
      productionPlan, dailyProductionPlan, baselineStock, inventoryStock,
      locationStock, weeklyShippingSchedule, operatingDays, nonWorkingDates,
      inTransitStock, plannedSales, sendQtyManual,
    ] = await Promise.all([
      db.loadFactories(), db.loadProducts(), db.loadWarehouses(), db.loadTruckTypes(), db.loadPalletTypes(),
      db.loadProductionPlan(), db.loadDailyProductionPlan(), db.loadBaselineStock(), db.loadInventoryStock(),
      db.loadLocationStock(), db.loadWeeklyShippingSchedule(), db.loadOperatingDays(), db.loadNonWorkingDates(),
      db.loadInTransitStock(), db.loadPlannedSales(), db.loadSendQtyManual(),
    ]);
    return {
      factories, products, warehouses, truckTypes, palletTypes,
      productionPlan, dailyProductionPlan, baselineStock, inventoryStock,
      locationStock, weeklyShippingSchedule, operatingDays, nonWorkingDates,
      inTransitStock, plannedSales, sendQtyManual,
    };
  });
}

/** スナップショットを正規化テーブルへ反映（全削除→再投入）。更新時刻を記録。 */
export async function saveSnapshotData(companyId: string, data: Record<string, unknown>, updatedAt: number): Promise<void> {
  await runWithCompany(companyId, async () => {
    // マスター（db.ts のマッピングを再利用）
    await sql`DELETE FROM factories WHERE company_id = ${companyId}`;
    for (const f of asArr<Factory>(data.factories)) await db.upsertFactory(f);

    await sql`DELETE FROM products WHERE company_id = ${companyId}`;
    await db.upsertProducts(asArr<Product>(data.products));

    await sql`DELETE FROM warehouses WHERE company_id = ${companyId}`;
    for (const w of asArr<Warehouse>(data.warehouses)) await db.upsertWarehouse(w);

    await sql`DELETE FROM truck_types WHERE company_id = ${companyId}`;
    for (const t of asArr<TruckType>(data.truckTypes)) await db.upsertTruckType(t);

    await sql`DELETE FROM pallet_types WHERE company_id = ${companyId}`;
    for (const p of asArr<PalletType>(data.palletTypes)) await db.upsertPalletType(p);

    // 週間生産計画
    await sql`DELETE FROM production_plan WHERE company_id = ${companyId}`;
    for (const [code, qty] of ent(asMap<ProductionPlan>(data.productionPlan))) {
      await db.upsertProductionQty(code, qty as number);
    }

    // replaceAll を持つコレクション（内部で全削除→再投入）
    await db.replaceAllDailyProductionPlan(asMap<DailyProductionPlan>(data.dailyProductionPlan));
    await db.replaceAllBaselineStock(asMap<BaselineStock>(data.baselineStock));
    await db.replaceAllInventoryStock(asMap<InventoryStock>(data.inventoryStock));
    await db.replaceAllLocationStock(asMap<LocationStock>(data.locationStock));
    await db.replaceAllInTransitStock(asMap<InTransitStock>(data.inTransitStock));
    await db.replaceAllPlannedSales(asMap<PlannedSales>(data.plannedSales));
    await db.replaceAllSendQtyManual(asMap<SendQtyManual>(data.sendQtyManual));

    // 出荷スケジュール
    await sql`DELETE FROM weekly_shipping_schedule WHERE company_id = ${companyId}`;
    for (const [fc, whs] of ent(asMap<WeeklyShippingSchedule>(data.weeklyShippingSchedule))) {
      for (const [wc, days] of ent(whs)) await db.upsertShippingSchedule(fc, wc, days as boolean[]);
    }

    // 稼働日
    await sql`DELETE FROM operating_days WHERE company_id = ${companyId}`;
    for (const [fc, days] of ent(asMap<OperatingDays>(data.operatingDays))) {
      await db.upsertOperatingDays(fc, days as boolean[]);
    }

    // 非稼働日
    await sql`DELETE FROM non_working_dates WHERE company_id = ${companyId}`;
    for (const [fc, dates] of ent(asMap<NonWorkingDates>(data.nonWorkingDates))) {
      for (const d of (dates as string[])) await db.addNonWorkingDate(fc, d);
    }
  });

  await setSyncUpdatedAt(companyId, updatedAt);
}
