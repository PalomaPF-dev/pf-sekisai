// 帳票Excel（①〜⑤）のパース。
// ファイル名に依存せず、1行目のヘッダに含まれる列名で種別を自動判別する。
// SheetJS(xlsx) は重いのでこのモジュールごと動的 import で読み込むこと。
import * as XLSX from 'xlsx';
import type {
  ArrivalRow, InventoryRow, ParsedSources, PlannedRow, ReleasedRow,
  SourceKind, VesselRow,
} from './types';

// 種別判別用のシグネチャ（この列がすべて含まれていれば該当帳票とみなす）
const SIGNATURES: Record<SourceKind, string[]> = {
  inventory: ['在庫数量', '引当可能数量', '品目ＣＤ'],
  planned: ['受払予定伝票ＮＯ', '基準単位出庫数量'],
  released: ['投入残数量', '子品目ＣＤ', '投入予定日'],
  arrivals: ['入荷予定数量', '入荷連絡備考', '出荷実績ＮＯ'],
  vessels: ['shp_air_no', 'wk_cd', 'prt_dep_dt'],
};

/** セル値→YYYY-MM-DD（Date/文字列どちらでも）。無効なら null */
function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // cellDates:true で得た Date は UTC 深夜。UTC 基準で取り出す
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return null;
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return toDateStr(v) ?? '';
  return String(v).trim();
}

interface Sheet {
  header: string[];
  rows: unknown[][];
}

function readFirstSheet(buf: ArrayBuffer): Sheet {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const header = (data[0] ?? []).map((h) => toStr(h));
  return { header, rows: data.slice(1) };
}

function detectKind(header: string[]): SourceKind | null {
  const set = new Set(header);
  for (const kind of Object.keys(SIGNATURES) as SourceKind[]) {
    if (SIGNATURES[kind].every((col) => set.has(col))) return kind;
  }
  return null;
}

/** 列名→インデックスの引き。無い列は -1 */
function indexer(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => { if (!map.has(h)) map.set(h, i); });
  return (name: string) => map.get(name) ?? -1;
}

function parseInventory(s: Sheet): InventoryRow[] {
  const col = indexer(s.header);
  const [iItem, iName, iLoc, iQty] = [col('品目ＣＤ'), col('品名'), col('場所ＣＤ'), col('在庫数量')];
  return s.rows
    .filter((r) => toStr(r[iItem]))
    .map((r) => ({
      itemCode: toStr(r[iItem]),
      itemName: toStr(r[iName]),
      locationCode: toStr(r[iLoc]),
      qty: toNum(r[iQty]),
    }));
}

function parsePlanned(s: Sheet): PlannedRow[] {
  const col = indexer(s.header);
  const [iItem, iName, iDate, iQty] = [col('品目ＣＤ'), col('品名'), col('予定日付'), col('基準単位出庫数量')];
  const out: PlannedRow[] = [];
  for (const r of s.rows) {
    const itemCode = toStr(r[iItem]);
    const date = toDateStr(r[iDate]);
    if (!itemCode || !date) continue;
    out.push({ itemCode, itemName: toStr(r[iName]), date, qty: toNum(r[iQty]) });
  }
  return out;
}

function parseReleased(s: Sheet): ReleasedRow[] {
  const col = indexer(s.header);
  const [iItem, iName, iDate, iQty] = [col('子品目ＣＤ'), col('子品名'), col('投入予定日'), col('投入残数量')];
  const out: ReleasedRow[] = [];
  for (const r of s.rows) {
    const itemCode = toStr(r[iItem]);
    const date = toDateStr(r[iDate]);
    if (!itemCode || !date) continue;
    out.push({ itemCode, itemName: toStr(r[iName]), date, qty: toNum(r[iQty]) });
  }
  return out;
}

function parseArrivals(s: Sheet): ArrivalRow[] {
  const col = indexer(s.header);
  const [iItem, iName, iDate, iQty, iRef, iStatus] = [
    col('品目ＣＤ'), col('品名'), col('入荷予定日'), col('入荷予定数量'),
    col('入荷連絡備考'), col('進捗状況区分名'),
  ];
  const out: ArrivalRow[] = [];
  for (const r of s.rows) {
    const itemCode = toStr(r[iItem]);
    const date = toDateStr(r[iDate]);
    if (!itemCode || !date) continue;
    out.push({
      itemCode,
      itemName: toStr(r[iName]),
      date,
      qty: toNum(r[iQty]),
      vesselRef: toStr(r[iRef]),
      status: toStr(r[iStatus]),
    });
  }
  return out;
}

function parseVessels(s: Sheet): VesselRow[] {
  const col = indexer(s.header);
  const [iNo, iWk, iType, iShip, iCntnr, iDep, iDel] = [
    col('shp_air_no'), col('wk_cd'), col('shp_air_typ_nm'), col('shp_nm'),
    col('cntnr_sz'), col('prt_dep_dt'), col('del_flg'),
  ];
  const out: VesselRow[] = [];
  for (const r of s.rows) {
    const vesselNo = toStr(r[iNo]);
    // 2行目は和名ヘッダ行（wk_cd列に「週コード」等の文字列が入る）なので数値以外は除外
    if (!vesselNo || !/^\d/.test(toStr(r[iWk]))) continue;
    out.push({
      vesselNo,
      weekCode: toStr(r[iWk]),
      typeName: toStr(r[iType]),
      shipName: toStr(r[iShip]),
      containerSize: toStr(r[iCntnr]),
      departureDate: toDateStr(r[iDep]),
      deleted: toStr(r[iDel]) === '1',
    });
  }
  return out.filter((v) => !v.deleted);
}

export interface ParseFileResult {
  kind: SourceKind | null;
  fileName: string;
}

/**
 * 複数の Excel ファイルを読み、種別を判別して ParsedSources に統合する。
 * 同一種別が複数あった場合は後勝ち。判別できないファイルは kind: null で返す。
 */
export async function parseSourceFiles(
  files: { name: string; buf: ArrayBuffer }[],
): Promise<{ sources: Partial<ParsedSources>; results: ParseFileResult[] }> {
  const sources: Partial<ParsedSources> = { fileNames: {} };
  const results: ParseFileResult[] = [];
  for (const f of files) {
    let kind: SourceKind | null = null;
    try {
      const sheet = readFirstSheet(f.buf);
      kind = detectKind(sheet.header);
      if (kind === 'inventory') sources.inventory = parseInventory(sheet);
      else if (kind === 'planned') sources.planned = parsePlanned(sheet);
      else if (kind === 'released') sources.released = parseReleased(sheet);
      else if (kind === 'arrivals') sources.arrivals = parseArrivals(sheet);
      else if (kind === 'vessels') sources.vessels = parseVessels(sheet);
      if (kind) sources.fileNames![kind] = f.name;
    } catch {
      kind = null;
    }
    results.push({ kind, fileName: f.name });
  }
  return { sources, results };
}
