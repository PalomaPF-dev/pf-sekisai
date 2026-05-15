'use server';

/**
 * Neon PostgreSQL CRUD operations for all entities.
 * All functions are Server Actions (Next.js 14).
 * DATABASE_URL 環境変数に Neon の接続文字列を設定してください。
 */
import { sql } from './neon';
import type {
  Factory, Product, Warehouse, TruckType, PalletType,
  ProductionPlan, DailyProductionPlan, DistributionRatios,
  InventoryStock, LocationStock, WeeklyShippingSchedule, InTransitStock, PlannedSales,
  OperatingDays, SendQtyManual, NonWorkingDates,
} from './types';

// ─── Factories ────────────────────────────────────────────────────────────────

export async function loadFactories(): Promise<Factory[]> {
  const rows = await sql`SELECT code, name FROM factories ORDER BY code`;
  return rows.map((r) => ({ code: r.code as string, name: r.name as string }));
}

export async function upsertFactory(f: Factory) {
  await sql`
    INSERT INTO factories (code, name)
    VALUES (${f.code}, ${f.name})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;
}

export async function deleteFactory(code: string) {
  await sql`DELETE FROM factories WHERE code = ${code}`;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function loadProducts(): Promise<Product[]> {
  const rows = await sql`SELECT * FROM products ORDER BY code`;
  const seen = new Set<string>();
  return rows
    .map((r) => ({
      code: r.code as string,
      name: r.name as string,
      capacityPerPallet: r.capacity_per_pallet as number,
      palletType: r.pallet_type as string,
      color: r.color as string,
      factoryCode: (r.factory_code as string | null) ?? 'F001',
      equipmentCategory: (r.equipment_category as string | null) ?? '',
      equipmentName: (r.equipment_name as string | null) ?? '',
      poji: (r.poji as boolean | null) ?? false,
      destination: (r.destination as string | null) ?? '',
      productionMethod: (r.production_method as string | null) ?? '',
      stackable: (r.stackable as boolean | null) ?? true,
      allowStackOnTop: (r.allow_stack_on_top as boolean | null) ?? true,
      boxWidthMM: (r.box_width_mm as number | null) ?? undefined,
      boxDepthMM: (r.box_depth_mm as number | null) ?? undefined,
      boxHeightMM: (r.box_height_mm as number | null) ?? undefined,
      boxWeightKg: (r.box_weight_kg as number | null) ?? undefined,
    }))
    .filter((p) => {
      if (seen.has(p.code)) return false;
      seen.add(p.code);
      return true;
    });
}

export async function upsertProduct(p: Product) {
  await sql`
    INSERT INTO products (
      code, name, capacity_per_pallet, pallet_type, color,
      factory_code, equipment_category, equipment_name,
      poji, destination, production_method,
      stackable, allow_stack_on_top,
      box_width_mm, box_depth_mm, box_height_mm, box_weight_kg
    ) VALUES (
      ${p.code}, ${p.name}, ${p.capacityPerPallet}, ${p.palletType}, ${p.color},
      ${p.factoryCode ?? 'F001'}, ${p.equipmentCategory ?? ''}, ${p.equipmentName ?? ''},
      ${p.poji ?? false}, ${p.destination ?? ''}, ${p.productionMethod ?? ''},
      ${p.stackable ?? true}, ${p.allowStackOnTop ?? true},
      ${p.boxWidthMM ?? null}, ${p.boxDepthMM ?? null}, ${p.boxHeightMM ?? null}, ${p.boxWeightKg ?? null}
    )
    ON CONFLICT (code) DO UPDATE SET
      name                = EXCLUDED.name,
      capacity_per_pallet = EXCLUDED.capacity_per_pallet,
      pallet_type         = EXCLUDED.pallet_type,
      color               = EXCLUDED.color,
      factory_code        = EXCLUDED.factory_code,
      equipment_category  = EXCLUDED.equipment_category,
      equipment_name      = EXCLUDED.equipment_name,
      poji                = EXCLUDED.poji,
      destination         = EXCLUDED.destination,
      production_method   = EXCLUDED.production_method,
      stackable           = EXCLUDED.stackable,
      allow_stack_on_top  = EXCLUDED.allow_stack_on_top,
      box_width_mm        = EXCLUDED.box_width_mm,
      box_depth_mm        = EXCLUDED.box_depth_mm,
      box_height_mm       = EXCLUDED.box_height_mm,
      box_weight_kg       = EXCLUDED.box_weight_kg
  `;
}

export async function upsertProducts(products: Product[]) {
  for (const p of products) {
    await upsertProduct(p);
  }
}

export async function deleteProduct(code: string) {
  await sql`DELETE FROM products WHERE code = ${code}`;
}

/**
 * DB 上の products テーブルの重複行（同一 code）を削除し、各 code 1 行にする。
 * 削除した重複件数（code の種類数）を返す。
 */
export async function deduplicateProducts(): Promise<number> {
  const rows = await sql`SELECT * FROM products ORDER BY code`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keepByCode = new Map<string, any>();
  const duplicatedCodes = new Set<string>();
  for (const row of rows) {
    const code = row.code as string;
    if (keepByCode.has(code)) {
      duplicatedCodes.add(code);
    } else {
      keepByCode.set(code, row);
    }
  }
  if (duplicatedCodes.size === 0) return 0;

  for (const code of duplicatedCodes) {
    await sql`DELETE FROM products WHERE code = ${code}`;
    const keep = keepByCode.get(code)!;
    await sql`
      INSERT INTO products (
        code, name, capacity_per_pallet, pallet_type, color,
        factory_code, equipment_category, equipment_name,
        poji, destination, production_method,
        stackable, allow_stack_on_top,
        box_width_mm, box_depth_mm, box_height_mm, box_weight_kg
      ) VALUES (
        ${keep.code}, ${keep.name}, ${keep.capacity_per_pallet}, ${keep.pallet_type}, ${keep.color},
        ${keep.factory_code ?? 'F001'}, ${keep.equipment_category ?? ''}, ${keep.equipment_name ?? ''},
        ${keep.poji ?? false}, ${keep.destination ?? ''}, ${keep.production_method ?? ''},
        ${keep.stackable ?? true}, ${keep.allow_stack_on_top ?? true},
        ${keep.box_width_mm ?? null}, ${keep.box_depth_mm ?? null},
        ${keep.box_height_mm ?? null}, ${keep.box_weight_kg ?? null}
      )
    `;
  }

  return duplicatedCodes.size;
}

// ─── Warehouses ──────────────────────────────────────────────────────────────

export async function loadWarehouses(): Promise<Warehouse[]> {
  const rows = await sql`SELECT code, name, "group", truck_type, max_pallets FROM warehouses ORDER BY code`;
  return rows.map((r) => ({
    code: r.code as string,
    name: r.name as string,
    group: r.group as '東' | '西',
    truckType: r.truck_type as string,
    maxPallets: r.max_pallets as number,
  }));
}

export async function upsertWarehouse(w: Warehouse) {
  await sql`
    INSERT INTO warehouses (code, name, "group", truck_type, max_pallets)
    VALUES (${w.code}, ${w.name}, ${w.group}, ${w.truckType}, ${w.maxPallets})
    ON CONFLICT (code) DO UPDATE SET
      name       = EXCLUDED.name,
      "group"    = EXCLUDED."group",
      truck_type = EXCLUDED.truck_type,
      max_pallets = EXCLUDED.max_pallets
  `;
}

export async function deleteWarehouse(code: string) {
  await sql`DELETE FROM warehouses WHERE code = ${code}`;
}

// ─── Truck Types ─────────────────────────────────────────────────────────────

export async function loadTruckTypes(): Promise<TruckType[]> {
  const rows = await sql`SELECT * FROM truck_types ORDER BY code`;
  return rows.map((r) => ({
    code: r.code as string,
    name: r.name as string,
    maxPallets: r.max_pallets as number,
    cols: r.cols as number,
    rows: r.rows as number,
    widthMM: r.width_mm as number,
    depthMM: r.depth_mm as number,
    heightMM: (r.height_mm as number | null) ?? 2300,
  }));
}

export async function upsertTruckType(t: TruckType) {
  await sql`
    INSERT INTO truck_types (code, name, max_pallets, cols, rows, width_mm, depth_mm, height_mm)
    VALUES (${t.code}, ${t.name}, ${t.maxPallets}, ${t.cols}, ${t.rows}, ${t.widthMM}, ${t.depthMM}, ${t.heightMM})
    ON CONFLICT (code) DO UPDATE SET
      name        = EXCLUDED.name,
      max_pallets = EXCLUDED.max_pallets,
      cols        = EXCLUDED.cols,
      rows        = EXCLUDED.rows,
      width_mm    = EXCLUDED.width_mm,
      depth_mm    = EXCLUDED.depth_mm,
      height_mm   = EXCLUDED.height_mm
  `;
}

export async function deleteTruckType(code: string) {
  await sql`DELETE FROM truck_types WHERE code = ${code}`;
}

// ─── Pallet Types ────────────────────────────────────────────────────────────

export async function loadPalletTypes(): Promise<PalletType[]> {
  const rows = await sql`SELECT * FROM pallet_types ORDER BY code`;
  return rows.map((r) => ({
    code: r.code as string,
    name: r.name as string,
    widthMM: r.width_mm as number,
    depthMM: r.depth_mm as number,
    heightMM: r.height_mm as number,
    maxWeightKg: r.max_weight_kg as number,
    loadedHeightMM: (r.loaded_height_mm as number | null) ?? 1200,
  }));
}

export async function upsertPalletType(pt: PalletType) {
  await sql`
    INSERT INTO pallet_types (code, name, width_mm, depth_mm, height_mm, max_weight_kg, loaded_height_mm)
    VALUES (${pt.code}, ${pt.name}, ${pt.widthMM}, ${pt.depthMM}, ${pt.heightMM}, ${pt.maxWeightKg}, ${pt.loadedHeightMM ?? 1200})
    ON CONFLICT (code) DO UPDATE SET
      name            = EXCLUDED.name,
      width_mm        = EXCLUDED.width_mm,
      depth_mm        = EXCLUDED.depth_mm,
      height_mm       = EXCLUDED.height_mm,
      max_weight_kg   = EXCLUDED.max_weight_kg,
      loaded_height_mm = EXCLUDED.loaded_height_mm
  `;
}

export async function deletePalletType(code: string) {
  await sql`DELETE FROM pallet_types WHERE code = ${code}`;
}

// ─── Production Plan ─────────────────────────────────────────────────────────

export async function loadProductionPlan(): Promise<ProductionPlan> {
  const rows = await sql`SELECT product_code, qty FROM production_plan`;
  const plan: ProductionPlan = {};
  for (const r of rows) plan[r.product_code as string] = r.qty as number;
  return plan;
}

export async function upsertProductionQty(productCode: string, qty: number) {
  await sql`
    INSERT INTO production_plan (product_code, qty)
    VALUES (${productCode}, ${qty})
    ON CONFLICT (product_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

// ─── Daily Production Plan ───────────────────────────────────────────────────

export async function loadDailyProductionPlan(): Promise<DailyProductionPlan> {
  const rows = await sql`SELECT product_code, date, qty FROM daily_production_plan`;
  const plan: DailyProductionPlan = {};
  for (const r of rows) {
    if (!plan[r.product_code as string]) plan[r.product_code as string] = {};
    plan[r.product_code as string][r.date as string] = r.qty as number;
  }
  return plan;
}

export async function replaceAllDailyProductionPlan(dailyPlan: DailyProductionPlan) {
  await sql`DELETE FROM daily_production_plan`;
  for (const [productCode, dates] of Object.entries(dailyPlan)) {
    for (const [date, qty] of Object.entries(dates)) {
      if (qty > 0) {
        await sql`
          INSERT INTO daily_production_plan (product_code, date, qty)
          VALUES (${productCode}, ${date}, ${qty})
        `;
      }
    }
  }
}

export async function upsertDailyProductionQty(productCode: string, date: string, qty: number) {
  if (qty > 0) {
    await sql`
      INSERT INTO daily_production_plan (product_code, date, qty)
      VALUES (${productCode}, ${date}, ${qty})
      ON CONFLICT (product_code, date) DO UPDATE SET qty = EXCLUDED.qty
    `;
  } else {
    await sql`
      DELETE FROM daily_production_plan
      WHERE product_code = ${productCode} AND date = ${date}
    `;
  }
}

// ─── Distribution Ratios ─────────────────────────────────────────────────────

export async function loadDistributionRatios(): Promise<DistributionRatios> {
  const rows = await sql`SELECT product_code, warehouse_code, ratio FROM distribution_ratios`;
  const ratios: DistributionRatios = {};
  for (const r of rows) {
    if (!ratios[r.product_code as string]) ratios[r.product_code as string] = {};
    ratios[r.product_code as string][r.warehouse_code as string] = r.ratio as number;
  }
  return ratios;
}

export async function upsertDistributionRatio(productCode: string, warehouseCode: string, ratio: number) {
  await sql`
    INSERT INTO distribution_ratios (product_code, warehouse_code, ratio)
    VALUES (${productCode}, ${warehouseCode}, ${ratio})
    ON CONFLICT (product_code, warehouse_code) DO UPDATE SET ratio = EXCLUDED.ratio
  `;
}

export async function replaceAllDistributionRatios(ratios: DistributionRatios) {
  await sql`DELETE FROM distribution_ratios`;
  for (const [pc, whs] of Object.entries(ratios)) {
    for (const [wc, ratio] of Object.entries(whs)) {
      await sql`
        INSERT INTO distribution_ratios (product_code, warehouse_code, ratio)
        VALUES (${pc}, ${wc}, ${ratio})
      `;
    }
  }
}

// ─── Inventory Stock ─────────────────────────────────────────────────────────

export async function loadInventoryStock(): Promise<InventoryStock> {
  const rows = await sql`SELECT product_code, qty FROM inventory_stock`;
  const stock: InventoryStock = {};
  for (const r of rows) stock[r.product_code as string] = r.qty as number;
  return stock;
}

export async function upsertInventoryStock(productCode: string, qty: number) {
  await sql`
    INSERT INTO inventory_stock (product_code, qty)
    VALUES (${productCode}, ${qty})
    ON CONFLICT (product_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

export async function replaceAllInventoryStock(stock: InventoryStock) {
  await sql`DELETE FROM inventory_stock`;
  for (const [product_code, qty] of Object.entries(stock)) {
    await sql`INSERT INTO inventory_stock (product_code, qty) VALUES (${product_code}, ${qty})`;
  }
}

// ─── Location Stock ──────────────────────────────────────────────────────────

export async function loadLocationStock(): Promise<LocationStock> {
  const rows = await sql`SELECT product_code, warehouse_code, qty FROM location_stock`;
  const stock: LocationStock = {};
  for (const r of rows) {
    if (!stock[r.product_code as string]) stock[r.product_code as string] = {};
    stock[r.product_code as string][r.warehouse_code as string] = r.qty as number;
  }
  return stock;
}

export async function upsertLocationStock(productCode: string, warehouseCode: string, qty: number) {
  await sql`
    INSERT INTO location_stock (product_code, warehouse_code, qty)
    VALUES (${productCode}, ${warehouseCode}, ${qty})
    ON CONFLICT (product_code, warehouse_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

export async function replaceAllLocationStock(stock: LocationStock) {
  await sql`DELETE FROM location_stock`;
  for (const [pc, whs] of Object.entries(stock)) {
    for (const [wc, qty] of Object.entries(whs)) {
      await sql`
        INSERT INTO location_stock (product_code, warehouse_code, qty)
        VALUES (${pc}, ${wc}, ${qty})
      `;
    }
  }
}

// ─── In-Transit Stock ────────────────────────────────────────────────────────

export async function loadInTransitStock(): Promise<InTransitStock> {
  const rows = await sql`SELECT product_code, warehouse_code, qty FROM in_transit_stock`;
  const stock: InTransitStock = {};
  for (const r of rows) {
    if (!stock[r.product_code as string]) stock[r.product_code as string] = {};
    stock[r.product_code as string][r.warehouse_code as string] = r.qty as number;
  }
  return stock;
}

export async function upsertInTransitStock(productCode: string, warehouseCode: string, qty: number) {
  if (qty === 0) {
    await sql`
      DELETE FROM in_transit_stock
      WHERE product_code = ${productCode} AND warehouse_code = ${warehouseCode}
    `;
    return;
  }
  await sql`
    INSERT INTO in_transit_stock (product_code, warehouse_code, qty)
    VALUES (${productCode}, ${warehouseCode}, ${qty})
    ON CONFLICT (product_code, warehouse_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

export async function replaceAllInTransitStock(stock: InTransitStock) {
  await sql`DELETE FROM in_transit_stock`;
  for (const [pc, whs] of Object.entries(stock)) {
    for (const [wc, qty] of Object.entries(whs)) {
      if (qty > 0) {
        await sql`
          INSERT INTO in_transit_stock (product_code, warehouse_code, qty)
          VALUES (${pc}, ${wc}, ${qty})
        `;
      }
    }
  }
}

// ─── Planned Sales ───────────────────────────────────────────────────────────

export async function loadPlannedSales(): Promise<PlannedSales> {
  const rows = await sql`SELECT product_code, warehouse_code, qty FROM planned_sales`;
  const sales: PlannedSales = {};
  for (const r of rows) {
    if (!sales[r.product_code as string]) sales[r.product_code as string] = {};
    sales[r.product_code as string][r.warehouse_code as string] = r.qty as number;
  }
  return sales;
}

export async function upsertPlannedSales(productCode: string, warehouseCode: string, qty: number) {
  await sql`
    INSERT INTO planned_sales (product_code, warehouse_code, qty)
    VALUES (${productCode}, ${warehouseCode}, ${qty})
    ON CONFLICT (product_code, warehouse_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

export async function replaceAllPlannedSales(sales: PlannedSales) {
  await sql`DELETE FROM planned_sales`;
  for (const [pc, whs] of Object.entries(sales)) {
    for (const [wc, qty] of Object.entries(whs)) {
      if (qty > 0) {
        await sql`
          INSERT INTO planned_sales (product_code, warehouse_code, qty)
          VALUES (${pc}, ${wc}, ${qty})
        `;
      }
    }
  }
}

// ─── Weekly Shipping Schedule ────────────────────────────────────────────────

export async function loadWeeklyShippingSchedule(): Promise<WeeklyShippingSchedule> {
  const rows = await sql`SELECT factory_code, warehouse_code, days FROM weekly_shipping_schedule`;
  const schedule: WeeklyShippingSchedule = {};
  for (const r of rows) {
    if (!schedule[r.factory_code as string]) schedule[r.factory_code as string] = {};
    schedule[r.factory_code as string][r.warehouse_code as string] = r.days as boolean[];
  }
  return schedule;
}

export async function upsertShippingSchedule(factoryCode: string, warehouseCode: string, days: boolean[]) {
  await sql`
    INSERT INTO weekly_shipping_schedule (factory_code, warehouse_code, days)
    VALUES (${factoryCode}, ${warehouseCode}, ${days})
    ON CONFLICT (factory_code, warehouse_code) DO UPDATE SET days = EXCLUDED.days
  `;
}

// ─── Operating Days ──────────────────────────────────────────────────────────

export async function loadOperatingDays(): Promise<OperatingDays> {
  const rows = await sql`SELECT factory_code, days FROM operating_days`;
  const result: OperatingDays = {};
  for (const r of rows) result[r.factory_code as string] = r.days as boolean[];
  return result;
}

export async function upsertOperatingDays(factoryCode: string, days: boolean[]) {
  await sql`
    INSERT INTO operating_days (factory_code, days)
    VALUES (${factoryCode}, ${days})
    ON CONFLICT (factory_code) DO UPDATE SET days = EXCLUDED.days
  `;
}

// ─── Non-Working Dates（祝日・特別休業日） ────────────────────────────────────

export async function loadNonWorkingDates(): Promise<NonWorkingDates> {
  const rows = await sql`SELECT factory_code, date FROM non_working_dates ORDER BY date`;
  const result: NonWorkingDates = {};
  for (const r of rows) {
    if (!result[r.factory_code as string]) result[r.factory_code as string] = [];
    result[r.factory_code as string].push(r.date as string);
  }
  return result;
}

export async function addNonWorkingDate(factoryCode: string, date: string) {
  await sql`
    INSERT INTO non_working_dates (factory_code, date)
    VALUES (${factoryCode}, ${date})
    ON CONFLICT (factory_code, date) DO NOTHING
  `;
}

export async function removeNonWorkingDate(factoryCode: string, date: string) {
  await sql`
    DELETE FROM non_working_dates
    WHERE factory_code = ${factoryCode} AND date = ${date}
  `;
}

// ─── 送り数手動上書き ─────────────────────────────────────────────────────────

export async function loadSendQtyManual(): Promise<SendQtyManual> {
  const rows = await sql`SELECT product_code, warehouse_code, qty FROM send_qty_manual`;
  const result: SendQtyManual = {};
  for (const r of rows) {
    if (!result[r.product_code as string]) result[r.product_code as string] = {};
    result[r.product_code as string][r.warehouse_code as string] = r.qty as number;
  }
  return result;
}

export async function upsertSendQtyManual(productCode: string, warehouseCode: string, qty: number) {
  await sql`
    INSERT INTO send_qty_manual (product_code, warehouse_code, qty)
    VALUES (${productCode}, ${warehouseCode}, ${qty})
    ON CONFLICT (product_code, warehouse_code) DO UPDATE SET qty = EXCLUDED.qty
  `;
}

export async function deleteSendQtyManual(productCode: string, warehouseCode: string) {
  await sql`
    DELETE FROM send_qty_manual
    WHERE product_code = ${productCode} AND warehouse_code = ${warehouseCode}
  `;
}

export async function replaceAllSendQtyManual(data: SendQtyManual) {
  await sql`DELETE FROM send_qty_manual`;
  for (const [pc, whMap] of Object.entries(data)) {
    for (const [wc, qty] of Object.entries(whMap)) {
      if (qty > 0) {
        await sql`
          INSERT INTO send_qty_manual (product_code, warehouse_code, qty)
          VALUES (${pc}, ${wc}, ${qty})
        `;
      }
    }
  }
}

// ─── Seed（初回デフォルトデータ投入） ─────────────────────────────────────────

import {
  DEFAULT_FACTORIES, DEFAULT_PRODUCTS, DEFAULT_WAREHOUSES,
  DEFAULT_TRUCK_TYPES, DEFAULT_PALLET_TYPES,
  DEFAULT_PRODUCTION_PLAN, DEFAULT_DISTRIBUTION_RATIOS,
  DEFAULT_INVENTORY_STOCK,
} from './defaultData';

export async function seedDefaults() {
  // Factories
  for (const f of DEFAULT_FACTORIES) {
    await sql`
      INSERT INTO factories (code, name) VALUES (${f.code}, ${f.name})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `;
  }

  // Products
  for (const p of DEFAULT_PRODUCTS) {
    await sql`
      INSERT INTO products (
        code, name, capacity_per_pallet, pallet_type, color, factory_code
      ) VALUES (
        ${p.code}, ${p.name}, ${p.capacityPerPallet}, ${p.palletType}, ${p.color}, ${p.factoryCode ?? 'F001'}
      )
      ON CONFLICT (code) DO UPDATE SET
        name                = EXCLUDED.name,
        capacity_per_pallet = EXCLUDED.capacity_per_pallet,
        pallet_type         = EXCLUDED.pallet_type,
        color               = EXCLUDED.color,
        factory_code        = EXCLUDED.factory_code
    `;
  }

  // Warehouses
  for (const w of DEFAULT_WAREHOUSES) {
    await sql`
      INSERT INTO warehouses (code, name, "group", truck_type, max_pallets)
      VALUES (${w.code}, ${w.name}, ${w.group}, ${w.truckType}, ${w.maxPallets})
      ON CONFLICT (code) DO UPDATE SET
        name        = EXCLUDED.name,
        "group"     = EXCLUDED."group",
        truck_type  = EXCLUDED.truck_type,
        max_pallets = EXCLUDED.max_pallets
    `;
  }

  // Truck types
  for (const t of DEFAULT_TRUCK_TYPES) {
    await sql`
      INSERT INTO truck_types (code, name, max_pallets, cols, rows, width_mm, depth_mm, height_mm)
      VALUES (${t.code}, ${t.name}, ${t.maxPallets}, ${t.cols}, ${t.rows}, ${t.widthMM}, ${t.depthMM}, ${t.heightMM ?? 2300})
      ON CONFLICT (code) DO UPDATE SET
        name        = EXCLUDED.name,
        max_pallets = EXCLUDED.max_pallets,
        cols        = EXCLUDED.cols,
        rows        = EXCLUDED.rows,
        width_mm    = EXCLUDED.width_mm,
        depth_mm    = EXCLUDED.depth_mm,
        height_mm   = EXCLUDED.height_mm
    `;
  }

  // Pallet types
  for (const p of DEFAULT_PALLET_TYPES) {
    await sql`
      INSERT INTO pallet_types (code, name, width_mm, depth_mm, height_mm, max_weight_kg, loaded_height_mm)
      VALUES (${p.code}, ${p.name}, ${p.widthMM}, ${p.depthMM}, ${p.heightMM}, ${p.maxWeightKg}, ${p.loadedHeightMM ?? 1200})
      ON CONFLICT (code) DO UPDATE SET
        name            = EXCLUDED.name,
        width_mm        = EXCLUDED.width_mm,
        depth_mm        = EXCLUDED.depth_mm,
        height_mm       = EXCLUDED.height_mm,
        max_weight_kg   = EXCLUDED.max_weight_kg,
        loaded_height_mm = EXCLUDED.loaded_height_mm
    `;
  }

  // Production plan
  for (const [product_code, qty] of Object.entries(DEFAULT_PRODUCTION_PLAN)) {
    await sql`
      INSERT INTO production_plan (product_code, qty) VALUES (${product_code}, ${qty})
      ON CONFLICT (product_code) DO UPDATE SET qty = EXCLUDED.qty
    `;
  }

  // Distribution ratios
  for (const [pc, whs] of Object.entries(DEFAULT_DISTRIBUTION_RATIOS)) {
    for (const [wc, ratio] of Object.entries(whs)) {
      await sql`
        INSERT INTO distribution_ratios (product_code, warehouse_code, ratio)
        VALUES (${pc}, ${wc}, ${ratio})
        ON CONFLICT (product_code, warehouse_code) DO UPDATE SET ratio = EXCLUDED.ratio
      `;
    }
  }

  // Inventory stock
  for (const [product_code, qty] of Object.entries(DEFAULT_INVENTORY_STOCK)) {
    await sql`
      INSERT INTO inventory_stock (product_code, qty) VALUES (${product_code}, ${qty})
      ON CONFLICT (product_code) DO UPDATE SET qty = EXCLUDED.qty
    `;
  }
}
