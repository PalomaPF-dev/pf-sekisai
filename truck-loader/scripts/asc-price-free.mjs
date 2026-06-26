import { api, G, APP_ID } from './asc-lib.mjs';

// 既に価格スケジュールがあるか
try {
  const ex = await G(`/v1/apps/${APP_ID}/appPriceSchedule`);
  if (ex?.data) { console.log('既に価格スケジュールあり:', ex.data.id, '→ スキップ'); process.exit(0); }
} catch { /* 404 = まだ無い */ }

// USA の無料価格ポイントを探す
const BASE = 'USA';
let free = null;
let url = `/v2/apps/${APP_ID}/appPricePoints?filter[territory]=${BASE}&limit=200`;
while (url && !free) {
  const r = await G(url);
  free = (r.data || []).find(p => {
    const c = p.attributes?.customerPrice;
    return c === '0' || c === '0.00' || Number(c) === 0;
  });
  url = r.links?.next || null;
}
if (!free) { console.error('無料価格ポイントが見つかりませんでした'); process.exit(1); }
console.log('無料価格ポイント:', free.id, 'customerPrice=', free.attributes.customerPrice);

// 価格スケジュール作成（無料）
const body = {
  data: {
    type: 'appPriceSchedules',
    relationships: {
      app: { data: { type: 'apps', id: APP_ID } },
      baseTerritory: { data: { type: 'territories', id: BASE } },
      manualPrices: { data: [{ type: 'appPrices', id: 'p1' }] },
    },
  },
  included: [
    {
      type: 'appPrices', id: 'p1',
      relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } },
    },
  ],
};
const res = await api('POST', '/v1/appPriceSchedules', body);
console.log('✅ 価格(無料)スケジュール作成:', res.data?.id);
