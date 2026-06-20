/**
 * lib/db.ts の Capacitor（静的書き出し）向けスタブ。
 *
 * Next.js の `output: 'export'` は Server Actions（lib/db.ts の 'use server'）を
 * バンドルできない。ネイティブビルドではローカルモード（LocalDataSource）で動作し、
 * これらのサーバー関数は実行されないため、webpack エイリアスで本モジュールに差し替える
 * （next.config.mjs 参照）。型チェックは実体の lib/db.ts に対して行われるため、
 * ここは「呼ばれたら明示的にエラーを出す」だけの安全網でよい。
 *
 * フェーズ4以降、オンライン同期が必要になったら、ここを REST API 呼び出し
 * （RemoteDataSource）に差し替える。
 */
function offline(name: string): never {
  throw new Error(`サーバー機能「${name}」はオフライン版では利用できません（オンライン同期はフェーズ4で対応予定）`);
}

const stub = (name: string) => async (..._args: unknown[]): Promise<never> => offline(name);

// ─── Company & User ───────────────────────────────────────
export const createCompany = stub('createCompany');
export const createUser = stub('createUser');
export const emailExists = stub('emailExists');

// ─── マスタ・入力データ（読み書き） ───────────────────────
export const loadFactories = stub('loadFactories');
export const upsertFactory = stub('upsertFactory');
export const deleteFactory = stub('deleteFactory');
export const loadProducts = stub('loadProducts');
export const upsertProduct = stub('upsertProduct');
export const upsertProducts = stub('upsertProducts');
export const deleteProduct = stub('deleteProduct');
export const deduplicateProducts = stub('deduplicateProducts');
export const loadWarehouses = stub('loadWarehouses');
export const upsertWarehouse = stub('upsertWarehouse');
export const deleteWarehouse = stub('deleteWarehouse');
export const loadTruckTypes = stub('loadTruckTypes');
export const upsertTruckType = stub('upsertTruckType');
export const deleteTruckType = stub('deleteTruckType');
export const loadPalletTypes = stub('loadPalletTypes');
export const upsertPalletType = stub('upsertPalletType');
export const deletePalletType = stub('deletePalletType');
export const loadProductionPlan = stub('loadProductionPlan');
export const upsertProductionQty = stub('upsertProductionQty');
export const loadDailyProductionPlan = stub('loadDailyProductionPlan');
export const replaceAllDailyProductionPlan = stub('replaceAllDailyProductionPlan');
export const upsertDailyProductionQty = stub('upsertDailyProductionQty');
export const loadBaselineStock = stub('loadBaselineStock');
export const upsertBaseline = stub('upsertBaseline');
export const replaceAllBaselineStock = stub('replaceAllBaselineStock');
export const loadInventoryStock = stub('loadInventoryStock');
export const upsertInventoryStock = stub('upsertInventoryStock');
export const replaceAllInventoryStock = stub('replaceAllInventoryStock');
export const loadLocationStock = stub('loadLocationStock');
export const upsertLocationStock = stub('upsertLocationStock');
export const replaceAllLocationStock = stub('replaceAllLocationStock');
export const loadInTransitStock = stub('loadInTransitStock');
export const upsertInTransitStock = stub('upsertInTransitStock');
export const replaceAllInTransitStock = stub('replaceAllInTransitStock');
export const loadPlannedSales = stub('loadPlannedSales');
export const upsertPlannedSales = stub('upsertPlannedSales');
export const replaceAllPlannedSales = stub('replaceAllPlannedSales');
export const loadWeeklyShippingSchedule = stub('loadWeeklyShippingSchedule');
export const upsertShippingSchedule = stub('upsertShippingSchedule');
export const loadOperatingDays = stub('loadOperatingDays');
export const upsertOperatingDays = stub('upsertOperatingDays');
export const loadNonWorkingDates = stub('loadNonWorkingDates');
export const addNonWorkingDate = stub('addNonWorkingDate');
export const removeNonWorkingDate = stub('removeNonWorkingDate');
export const loadSendQtyManual = stub('loadSendQtyManual');
export const upsertSendQtyManual = stub('upsertSendQtyManual');
export const deleteSendQtyManual = stub('deleteSendQtyManual');
export const replaceAllSendQtyManual = stub('replaceAllSendQtyManual');

// ─── シード ───────────────────────────────────────
export const seedDefaultsForCompany = stub('seedDefaultsForCompany');
export const seedSampleDataForCompany = stub('seedSampleDataForCompany');
