/**
 * 工場スコープのサーバー側解決（DB参照）。
 *
 * ポータルの部署（工場）名は users.factory に入っている。アプリ側の工場軸は
 * factory_code（製品の製造工場・出荷スケジュール等）なので、工場マスタ
 * （factories.name → code）を引いて突合用のコードに直してから使う。
 *
 * 役割・所属工場は JWT に載せず毎回 DB から取得する（ポータルでの変更を即時反映するため）。
 */
import { sql } from '@/lib/neon';
import { getUserRoleAndFactory } from '@/lib/authDb';
import { factoryScopeOf, resolveFactoryCode, NO_FACTORY_MATCH } from '@/lib/factoryScope';

/** ユーザーの工場スコープ名（＝ポータルの部署名）。null = 制限なし（管理者・工場未設定）。 */
export async function resolveUserFactoryScopeName(userId: string): Promise<string | null> {
  const { role, factory } = await getUserRoleAndFactory(userId);
  return factoryScopeOf(role, factory);
}

/**
 * ユーザーの工場スコープを工場コードへ解決する。
 *   null            … 制限なし（全工場を閲覧可）
 *   NO_FACTORY_MATCH… 部署名に一致する工場がマスタに無い（安全側＝空表示）
 */
export async function resolveUserFactoryScopeCode(
  companyId: string,
  userId: string,
): Promise<string | null> {
  const name = await resolveUserFactoryScopeName(userId);
  if (!name) return null;
  const rows = await sql`SELECT code, name FROM factories WHERE company_id = ${companyId}`;
  const code = resolveFactoryCode(
    rows.map((r) => ({ code: r.code as string, name: r.name as string })),
    name,
  );
  return code ?? NO_FACTORY_MATCH;
}
