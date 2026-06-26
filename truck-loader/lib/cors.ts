/**
 * ネイティブ(Capacitor/iOS)の WebView は `capacitor://localhost` オリジンで動作し、
 * 本番API(Vercel)を「クロスオリジン」で fetch する。WKWebView の CORS 制約により、
 * サーバが Access-Control-Allow-Origin を返さないとプリフライト後にブロックされ、
 * ログイン/新規登録が「ネットワークエラー」になる（App Store 2.1(a) 却下の原因）。
 *
 * そこで、ネイティブ由来の既知オリジンに対してのみ CORS を許可する。
 * （任意サイトには許可しない＝Cookie認証エンドポイントのCSRF/情報漏えいを防ぐ）
 * Bearer・Cookie 双方を通すため Allow-Credentials を返し、Origin を反射する。
 */
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

/** プリフライト(OPTIONS)応答 */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** 任意のレスポンスに CORS ヘッダを付与して返す */
export function withCors(req: Request, res: Response): Response {
  const headers = corsHeaders(req);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}
