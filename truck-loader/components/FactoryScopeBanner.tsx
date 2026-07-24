'use client';

/**
 * 部署（工場）スコープが効いているときの常時バナー。
 * ポータルの部署が「工場」種別の一般・作業者アカウントは、その工場のデータだけが表示される
 * （管理者・工場未設定のユーザーは全工場を閲覧できるためバナーは出ない）。
 * 実際の絞り込みはサーバー側 lib/db.ts と lib/store.ts の双方で実施している。
 */
import { useAppStore } from '@/lib/store';

export function FactoryScopeBanner() {
  const scope = useAppStore((s) => s.factoryScope);
  if (!scope) return null;

  // 工場マスタに該当名が無い場合は突合できず空表示になるため、その旨を明示する。
  if (!scope.factoryCode) {
    return (
      <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs text-center py-1.5 px-4 font-medium">
        ⚠️ 所属工場「{scope.factoryName}」が工場マスタに見つかりません。表示できるデータがありません。
      </div>
    );
  }

  return (
    <div className="bg-slate-100 border-b border-slate-300 text-slate-700 text-xs text-center py-1.5 px-4 font-medium">
      🏭 {scope.factoryName}のデータのみ表示しています。
    </div>
  );
}
