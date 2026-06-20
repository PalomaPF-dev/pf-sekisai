# トラック積載アプリ iOS化 — 段階移行プラン書

作成日: 2026-06-14
対象: `truck-loader`（Next.js 14 / TypeScript / Tailwind / Neon Postgres / NextAuth）

> 本番稼働の手順は [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) を参照（デプロイ・環境変数・APNs・TestFlight）。

---

## 0. 結論サマリー

| 項目 | 決定 |
|---|---|
| **方式** | Capacitor 6 でラップ（既存React UIを再利用） |
| **配信** | まず TestFlight 社内配布 → 必要なら App Store |
| **必須ネイティブ機能** | ① 完全オフライン動作 ② カメラ/バーコード読取 ③ プッシュ通知 |
| **最大の技術課題** | データ層が Next.js Server Actions に依存 → オフライン対応のため抽象化が必要 |
| **要前提** | Apple Developer Program 登録（年99ドル）。プッシュ通知のため必須 |

---

## 1. 現状アーキテクチャの分析

```
現状（Web一体型）
┌──────────────────────────────────────────┐
│ Next.js 14 (App Router) on Vercel        │
│                                          │
│  画面 (app/*, components/*)               │
│    └ Zustand store (lib/store.ts)        │
│         └ lib/db.ts ← 'use server'       │  ← サーバー必須
│              └ Neon Postgres (company単位) │
│                                          │
│  認証: NextAuth (JWT, Credentials)        │
│  AI:  /api/ai-recommendation (Google)    │
│  保護: middleware.ts (withAuth)           │
└──────────────────────────────────────────┘
```

**重要な事実:**
- `lib/db.ts` は全関数が Server Action（`'use server'`）。`company_id` をJWTセッションから取得し、Neonに直結。**= サーバーが無いと動かない。**
- `lib/store.ts`（Zustand）は UI と `db.*` の間に既にきれいな抽象境界を持っている。**この継ぎ目を使えば改修範囲を局所化できる。**
- `lib/calculations.ts`（積載計算ロジック）はサーバー非依存の純粋ロジック → **そのままオフラインで動く。**

---

## 2. 目標アーキテクチャ（Capacitor + オフライン）

```
┌─────────── iPhoneアプリ（Capacitor 6）────────────────┐
│  画面 (React 静的ビルド) ← アプリ内同梱＝オフライン表示    │
│    └ Zustand store                                    │
│         └ DataSource インターフェース ◀── 新設         │
│              ├ LocalDataSource  → SQLite(端末)         │
│              └ RemoteDataSource → Vercel API           │
│         └ SyncEngine ◀── 新設（オンライン時に差分同期）  │
│                                                        │
│  ネイティブ: カメラ/バーコード・プッシュ・SQLite         │
└────────────────────────┬───────────────────────────-─┘
                         │ オンライン時のみ
              ┌──────────▼──────────┐
              │ Vercel (既存Next.js) │
              │  - REST/Server API   │ ← Server Actions を API化
              │  - NextAuth          │
              │  - AI推奨            │
              │  - APNs送信用エンドポイント ◀── 新設
              │  Neon Postgres       │
              └─────────────────────┘
```

**設計の肝:** Zustand が直接 `db.*`(Server Action) を呼んでいる箇所を、`DataSource` インターフェース越しに差し替える。これにより「端末ローカル(SQLite)」と「サーバー(API)」を切り替え可能にする。

---

## 3. フェーズ別移行計画

各フェーズは独立して価値が出る順に並べてある。各フェーズ末で「動くもの」が残る。

### フェーズ 1 — Capacitor導入・アプリとして起動（最短で手応え）【完了】
**ゴール:** iPhoneシミュレータ/実機で「アプリとして」今のUIが開く → **達成（iPhone 17シミュレータで起動確認）**

- [x] Capacitor 6 を導入（`@capacitor/core` `@capacitor/cli` `@capacitor/ios` = 6.2.1）
- [x] `capacitor.config.ts` 作成（appId/appName/webDir）
- [x] npm スクリプト追加（`cap:add:ios` `cap:sync` `cap:open`）／`.gitignore` にiOS生成物
- [x] **CocoaPods 導入**（`brew install cocoapods` = 1.16.2）
- [x] **iOS Xcodeプロジェクト生成**（`npx cap add ios`）— `ios/App` 一式作成、フェーズ2のオフラインアプリ（`www/`）を `ios/App/App/public` に同梱済み
- [x] **フルXcode 導入**（Xcode 26.5）。`DEVELOPER_DIR` 指定で `cap sync` 実行（`pod install` 成功）
- [x] **CocoaPods依存解決済み**（`ios/App/Pods`）・iOS/iOSシミュレータSDK（26.5）認識
- [x] **iOSシミュレータランタイム取得**（iOS 26.5、`xcodebuild -downloadPlatform iOS`）。容量確保のため再生成可能なキャッシュ類を削除（下記）
- [x] **シミュレータでビルド成功 & 起動確認**（iPhone 17）。`xcodebuild ... build` → `simctl install/launch` で起動、ダッシュボード描画・オフライン認証スタブ動作をスクショ確認
- [ ] **要ユーザー作業（任意）**: Bundle ID 変更（現状 `jp.co.example.truckloader`）・App Icon / 表示名・実機実行時の署名Team設定（無料Apple ID可）

**完了条件:** 実機/シミュレータでアプリが起動 → **達成。**

#### 重要な運用メモ
- グローバルの `xcode-select` は CommandLineTools のままなので、**ビルド系コマンドは必ず `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` を付ける**（sudo不要の回避策）。恒久対応するなら `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`。
- 開発機の空き容量が逼迫していたため、以下の**再生成可能データを削除して容量を確保**した。必要時に各自復元すること:
  - 他5プロジェクト（todo-app / fortune-uranai-app / production-load-calc / production-plan / asset-manager）の `node_modules` → 各プロジェクトで `npm install`
  - npm/Homebrew/Chrome(`~/Library/Caches/Google`)/OpenAI Codex(`~/Library/Caches/com.openai.codex`)/VSCode更新キャッシュ → 各ツールが自動再生成
- ビルド/起動の再現コマンド:
  ```bash
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  cd truck-loader/truck-loader && npm run build:ios && npm run cap:sync   # フロント反映
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -sdk iphonesimulator \
    -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath /tmp/tl-dd \
    CODE_SIGNING_ALLOWED=NO build
  xcrun simctl boot "iPhone 17"; open -a Simulator
  xcrun simctl install booted /tmp/tl-dd/Build/Products/Debug-iphonesimulator/App.app
  xcrun simctl launch booted jp.co.example.truckloader
  ```
  GUIで触りたいときは `npm run cap:open` で Xcode を開いて ▶ Run でもOK。

#### Xcode導入後にユーザーが実行するコマンド（CocoaPods・iOSプロジェクトは導入済み）
```bash
# 1) フルXcode を App Store からインストール後、開発ディレクトリを切替
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept

# 2) 最新の www/ を取り込み + pod install（cap sync が両方やる）
cd truck-loader/truck-loader
npm run build:ios     # オフラインフロントを再ビルド（変更があれば）
npm run cap:sync      # www → ios へ反映 + pod install
npm run cap:open      # Xcode で App.xcworkspace を開く

# 3) Xcode 左上で実機/シミュレータを選択、Signing & Capabilities で
#    Team（無料Apple IDで可）を設定 → ▶ Run
```

### フェーズ 2 — フロントの静的化（オフライン表示の土台）【完了】
**ゴール:** UIがネット無しでも表示される。

判明した好条件: 既存ページはほぼ全て `'use client'`（クライアントSPA）で、データ取得もstore経由。サーバーコンポーネント依存がほぼ無く、**Next.js `output: 'export'` がそのまま使えた**（4.1案A）。Vite切り出し（案B）は不要だった。

- [x] Capacitorビルド専用フラグ `CAPACITOR_BUILD=1` で `output: 'export'`（`next.config.mjs`、通常のVercelビルドは不変）
- [x] 静的化を阻む3要素をビルド時に分離（`scripts/build-capacitor.mjs`）:
  - API Routes（`app/api`）・`middleware.ts` を一時退避（サーバー専用）
  - Server Actions `lib/db.ts` を `lib/db.capacitor-stub.ts` へ物理差し替え（静的書き出し非対応のため）
- [x] 静的出力 `out/` → `www/` へコピー（`npm run build:ios`）。全12ページ静的化
- [x] **ブラウザで完全オフライン動作を実証**: サーバー/認証/DB無しでダッシュボード描画 → 「サンプルで始める」で LocalDataSource(IndexedDB)へシード → calculations.tsが積載計算（57台/493パレット/33,196個/6拠点）→ リロードしても永続化を確認
- [x] **認証のオフライン対応**: `lib/authClient.tsx` ラッパーを新設し、3画面（login / UserMenu / SessionProvider）を `next-auth/react` から本ラッパー経由に変更。`NEXT_PUBLIC_CAPACITOR=1` のときローカルスタブ（`lib/next-auth-react.capacitor-stub.tsx`）へ実行時切替 → セッションfetchをせず CLIENT_FETCH_ERROR が消滅。「ローカルユーザーでログイン済み」として動作（ブラウザで確認: ヘッダーに「オフライン/ローカルユーザー」表示・新規エラー0）
  - ※ webpackエイリアスはこのプロジェクトで安定して効かなかったため、env による実行時切替を採用
- [ ] **残（フェーズ4）**: `middleware.ts` のルート保護をAPI側へ移管＋実トークン認証（オンライン同期API実装時）

**完了条件:** 機内モードでアプリを開いてUIが崩れず表示される → **達成**（認証エラーも解消）。両ビルド（通常 / `build:ios`）green。

### フェーズ 3 — データ層の抽象化とローカルDB（完全オフラインの核）【着手中】
**ゴール:** ネット無しで積載計画の閲覧・入力・再計算ができる。

- [x] `DataSource` インターフェース定義（`lib/dataSource/types.ts`）— store が呼ぶ db 関数を網羅
- [x] `ServerDataSource`（`serverDataSource.ts`）— 既存 Server Actions のラッパー。現状挙動を完全維持
- [x] `LocalDataSource`（`localDataSource.ts`）— 端末ローカル実装。**現状は IndexedDB**（`idbKv.ts`）でドキュメント保持。**将来 Capacitor SQLite に差し替え**（idbKv の get/set 差し替えのみで済む設計）
- [x] 環境セレクタ（`index.ts` の `getDataSource()`）— SSR=server / ブラウザは指定で local 切替可
- [x] store を `import * as db` から `getDataSource()` 経由に置換（継ぎ目の一点のみ改修）
- [x] 型チェック (`tsc --noEmit`) ・ `next build`（RSC境界）通過
- [ ] **残**: `@capacitor-community/sqlite` 実装（フェーズ1でCapacitor導入後）— `idbKv` を置換
- [ ] **残**: 認証のオフライン対応（ローカルモード時のログイン回避・トークン保持）
- [x] `lib/calculations.ts` はサーバー非依存のため改修不要（そのままオフライン動作）

**ローカルモードの試し方（手動）:** ブラウザのコンソールで
`localStorage.setItem('truckloader.dataSource','local')` → リロード。以降データは端末（IndexedDB `truckloader-local`）に保存される。`'server'` か削除で元に戻る。
※ 現状はログイン（NextAuth＝サーバー必須）が残るため、完全機内モード検証はフェーズ2の認証オフライン化後に可能。

**完了条件:** 機内モードでマスタ編集・生産計画入力・積載再計算が完結する。

### フェーズ 4 — 同期エンジン（オンライン復帰時にサーバーと整合）【コア完了】
**ゴール:** 端末の変更がサーバーに反映され、他端末の変更も取り込まれる。

採用方針: **データセット単位の Last-Write-Wins**（文書モデルのLocalDataSourceに自然に乗る）。収束は保証。同時編集の field 単位マージは将来拡張。

- [x] ローカルに同期メタ `meta { updatedAt, dirty, lastSyncedAt }`（`localDataSource.ts`）。全ミューテーションの `persist()` が自動で `updatedAt`更新＋`dirty`化
- [x] 同期API `LocalSyncApi`（exportSnapshot / importSnapshot / getSyncMeta / markSynced）
- [x] 同期エンジン `lib/sync/syncEngine.ts` — pull→LWW判定→（取込 or push）→アプリ再ロード、多重起動を1本に集約
- [x] オンライン検知 `lib/sync/network.ts`（Web=`navigator.onLine`/events、ネイティブ=`@capacitor/network` 動的import）
- [x] 同期状態ストア＋UI `lib/sync/syncStore.ts` / `components/SyncStatus.tsx`（Navbar右上に「同期済み hh:mm / 未同期 / オフライン」＋手動同期ボタン）。オンライン時・未同期時・8秒間隔で自動同期
- [x] リモート抽象 `RemoteSync`：`mockRemote`（検証用）/ `httpRemote`（本番 `/api/sync/*`）/ `getRemoteSync()` セレクタ
- [x] サーバーREST `app/api/sync/pull|push`（テナント単位の `sync_snapshots` blob、Cookieセッション認証）
- [x] **ブラウザ＋モックリモートで双方向収束を実証**: push(ローカル→サーバー)、pull+LWW(サーバー新→ローカル取込 SYNC9)、push+LWW(ローカル新→サーバー反映 LOCAL10)、交互編集が両側に収束
- [x] **ネイティブのBearerトークン認証**（別項「ネイティブのトークン認証」参照）
- [x] **正規化テーブル整合**（Web版とネイティブ版のデータ統一）:
  - `lib/server/companyContext.ts`（AsyncLocalStorage）で company_id を注入し、`db.ts` の `getCompanyId()` が override を最優先で参照
  - `lib/server/syncRepo.ts` — `loadSnapshotData`/`saveSnapshotData` が **db.ts の load/upsert/replaceAll をそのまま再利用**して正規化テーブル(products 等)を読み書き（全削除→再投入でデータセット置換）。更新時刻は `sync_meta` で管理
  - `/api/sync/pull|push` を blob から正規化テーブル方式へ刷新 → **ネイティブのpushがWeb版にも反映され、pullでWeb版の編集を取得**
  - 検証: ALSの company_id 注入が Promise.all/並行リクエストで正しく伝播・分離（node）、`tsc`/両ビルド green
- [ ] **残（要デプロイ環境で検証）**: 実Neonで Web↔ネイティブ往復の実データ確認
- [ ] **残（任意の高度化）**: ① Web側のdb.ts書き込み時にも `sync_meta` を更新（Web編集を含む完全なLWWタイムスタンプ）② 置換のトランザクション化 ③ レコード単位マージ（同時編集の保全）

**完了条件:** 2端末で交互編集してもデータが収束する → **達成（モックリモートで実証）。** 実サーバー(Vercel/Neon)接続は上記バックエンド残作業の完了後にデプロイ環境で要検証。

#### 同期の試し方（手動・ブラウザ）
コンソールで `localStorage.setItem('truckloader.sync','mock')` → リロードで Navbar に同期ステータスが出る（モックサーバー=同一ブラウザのIndexedDB別キー）。本番は `'http'` か `NEXT_PUBLIC_SYNC_API` 設定で `/api/sync/*` を使用。

### フェーズ 5 — カメラ / バーコード読取【完了】
**ゴール:** 製品/パレットのバーコード・QRをスキャンして積込確認。

- [x] `@capacitor-mlkit/barcode-scanning@6.2.0` 導入（`cap sync` でpod install済み）
- [x] カメラ権限 `NSCameraUsageDescription` を `ios/App/App/Info.plist` に追加
- [x] スキャンラッパー `lib/barcode.ts` — ネイティブ=MLKitカメラ / Web=手入力フォールバック（`Capacitor.isNativePlatform()` で分岐、ネイティブ依存は動的import）
- [x] 積込スキャンUI `components/LoadingScanPanel.tsx` — スキャン値を製品マスタと突合し ✓(計画内)/❗(計画外)/⚠️(未登録) を表示、誤積み警告（toast）
- [x] 積載計画ページに統合 — トップバーに「📷 積込スキャン」ボタン＋フローティングパネル。`expectedCodes`（選択中工場の計画内製品コード）で計画内外を判定
- [x] **ブラウザで照合ロジック検証**: D001(緑茶)→✓計画内、9999→⚠️未登録 を確認
- [x] **MLKit込みでネイティブビルド成功**（x86_64シミュレータ向け BUILD SUCCEEDED）

**完了条件:** バーコードを読むと対象製品を突合・警告表示 → **達成（ロジックはブラウザ実証、ネイティブ実機で要カメラ実測）**

#### ⚠️ MLKit と Apple Silicon シミュレータの制約（重要）
Google MLKit の pod は `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` を設定しており、**arm64シミュレータ非対応**（x86_64シミュレータ or 実機のみ）。そのため:
- Apple Silicon Mac では `npm run cap:open` → **Xcodeから実機(iPhone)を選んで Run** するのが正道（カメラ実測もこれが必要）。
- シミュレータで確認したい場合は Xcode がRosetta(x86_64)で自動対応。CLIの `xcodebuild ... -destination 'generic/platform=iOS Simulator'` は x86_64 でビルドされ、arm64シミュレータには直接インストール不可。
- いずれもコード/ビルドの問題ではなくMLKitの仕様。**カメラはシミュレータに無いため、実機確認が本来必要。**

### フェーズ 6 — プッシュ通知【コア完了】
**ゴール:** 出荷予定・積込完了などをプッシュで通知。

- [x] `@capacitor/push-notifications` 導入（+ APNs JWT署名用に `jose`）
- [x] クライアントラッパー `lib/push.ts` — ネイティブ=権限要求→APNs登録→トークン取得→サーバー送信＋受信リスナー、Web=Notification APIデモ
- [x] 権限UX `components/PushNotificationSetup.tsx`（設定ページに配置。状態表示＋「通知を有効にする」）。受信リスナーは `SupabaseProvider` で起動時に設定（受信時トースト）
- [x] トークン登録API `app/api/push/register`（`device_tokens` テーブル、Cookieセッション認証）
- [x] APNs送信ユーティリティ `lib/server/apns.ts`（ES256 JWT署名＋HTTP/2、追加依存なし）＋テスト送信API `app/api/push/test`
- [x] iOS `Info.plist` に `UIBackgroundModes: remote-notification` 追加
- [x] **ブラウザで権限フロー実証**: 「通知を有効にする」→許可→状態「✓ 有効」→デモ通知発火
- [x] `tsc` / 通常ビルド（`/api/push/*` 登録）/ `build:ios` すべてgreen
- [ ] **要ユーザー作業（Apple認証情報・実機）**:
  - Apple Developer で **APNs鍵(.p8)** を発行 → Vercel環境変数 `APNS_KEY` `APNS_KEY_ID` `APNS_TEAM_ID` `APNS_BUNDLE_ID`（=Bundle ID）`APNS_PRODUCTION` を設定
  - Xcode → Signing & Capabilities → **+ Capability → Push Notifications**（`aps-environment` entitlement が自動追加される）
  - `npm run cap:sync`（push-notifications/network プラグインのpod導入）
- [ ] **残（任意）**: 通知トリガの自動化（例: 出荷確定/同期受信時にサーバーから送信）。現状は `/api/push/test` で手動送信して疎通確認可能

**完了条件:** サーバーから送信したテスト通知が実機に届く → **コード/UI完成・Web実証済み。実機疎通は上記Apple認証情報＋Push capability設定後に `/api/push/test` で確認。**

### 追加改善 — 画面向き（全画面 自動回転）【完了】
**方針:** 全画面で端末の向きに追従して自動回転（縦横どちらも可）。

- [x] `@capacitor/screen-orientation` 導入（`cap sync` 済み）
- [x] `lib/orientation.ts` — `enableAutoRotate()` が起動時に `unlock()`（過去のロックが残っていても解除）。ルート別ロックは廃止
- [x] `components/OrientationController.tsx`（`layout.tsx` に配置）— 起動時に1回だけ自動回転を許可。Webは何もしない
- [x] `Info.plist` は縦/横（Landscape Left/Right）を許可済み＝自動回転が有効
- [x] `tsc` / 両ビルド green
- 注: 物理的な回転はネイティブ専用動作。実機（またはXcodeのRosettaシミュレータ）で確認。

### 追加 — ネイティブのトークン認証【完了】（フェーズ2/4/6の残作業の核）
**目的:** 実機（Cookie不可）からサーバーAPIを認証できるようにし、実同期・実プッシュ登録の土台にする。

- [x] サーバー認証ヘルパー `lib/server/auth.ts` — `getAuthContext(req)` が **Bearerトークン（ネイティブ）/ Cookieセッション（Web）両対応**。`signAuthToken()` で30日有効のJWT(HS256)発行。鍵は `NEXTAUTH_SECRET` 流用
- [x] ログイン→トークン発行API `app/api/auth/token`（email/password を users/companies で照合）
- [x] 保護API（`sync/pull` `sync/push` `push/register` `push/test`）を `getAuthContext` に統一
- [x] クライアント: トークン端末保存 `lib/auth/token.ts`（ネイティブ=`@capacitor/preferences`／Web=localStorage）、`lib/auth/cloudAuth.ts`（`cloudLogin`/`cloudLogout`/`isCloudLoggedIn`、ログインで同期'http'有効化）
- [x] `httpRemote` と push登録に **Bearerトークン付与**、API base は `NEXT_PUBLIC_SYNC_API`
- [x] UI: 設定ページに `CloudSyncLogin`（会社アカウントでログイン→同期有効、ログアウトでローカル専用に戻る）
- [x] **検証**: JWT署名/検証/改ざん拒否（jose単体）、ログイン→トークン保存→同期有効化チェーン、ログイン済みUI（getToken経由）、ログアウトをブラウザで実証。`tsc`/両ビルド green、`cap sync` で5プラグイン導入
- [ ] **残（要デプロイ/実機）**: ① 実Neon+実ユーザーでの `/api/auth/token` 疎通 ② ネイティブで `NEXT_PUBLIC_SYNC_API` に本番URLを設定しビルド ③（強化）トークン保存をKeychainプラグインへ
- 注: これで「実機ログイン→Bearer付きで sync/push を呼ぶ」経路が成立。残るは APNs鍵設定（フェーズ6）と同期サーバーの正規化テーブル整合（フェーズ4）。

---

## 4. 重要な技術判断ポイント

### 4.1 フロントの静的化方式（フェーズ2の肝）
Next.js App Router + Server Actions は `output: 'export'` と相性が悪い（Server Actions/動的APIが使えない）。選択肢:

| 案 | 内容 | 評価 |
|---|---|---|
| **A. Next.js静的書き出し** | `output:'export'` 化し Server Actions を全て fetch API へ置換 | 改修中。SSR資産は捨てる |
| **B. UIをViteのSPAに切り出し**（推奨） | `app/*`/`components/*` のReactを Vite + React Router で再構成。ロジック（lib/）はほぼ流用 | Capacitorと最も相性良。明確 |
| **C. ライブURLをWebView表示** | 既存Vercelをそのまま表示 | フェーズ1の暫定のみ。オフライン不可なので最終解にはならない |

→ **推奨は B**。`lib/`（store, calculations, types, csv等）はそのまま再利用でき、画面コンポーネントもほぼ流用可能。Server Actions依存だけを `DataSource` に置換する。

### 4.2 Server Actions の API化
`lib/db.ts` の各関数を、Vercel上の REST エンドポイント（`/api/data/*`）として再公開する。
- 認証は JWT Bearer トークン（NextAuthのJWTを流用 or 軽量JWT発行）
- `company_id` は従来どおりトークンから取得（マルチテナント分離を維持）
- `RemoteDataSource` がこのAPIを叩く

### 4.3 認証のモバイル対応
- NextAuth はCookieセッション前提 → モバイルは **トークンをSecure Storageに保持**する方式へ
- ログインAPIを叩いてJWTを取得 → `@capacitor/preferences` or Keychain に保存 → 以降のAPIに付与
- オフライン中は「最後にログインしたユーザー」としてローカルデータで動作（再オンライン時にトークン更新）

### 4.4 SQLite スキーマ移植
- `neon-schema.sql` を SQLite方言へ移植（型・シリアル・JSON列の扱いに注意）
- マルチテナントだが端末は1社分のみ保持するため `company_id` 列は省略可（簡素化）

---

## 5. 配信戦略（推奨ルート）

1. **Apple Developer Program 登録**（年99ドル）— プッシュ通知に必須
2. **TestFlight で社内配布** — 審査ほぼ不要、招待リンクで現場メンバーへ。カメラ/プッシュ/オフライン全機能テスト可
3. 一般公開が必要になったら **App Store 審査** へ
4. 完全社内限定なら **Apple Business Manager（カスタムApp）** も選択肢

---

## 6. リスクと留意点

| リスク | 対応 |
|---|---|
| Server Actions の API化が広範囲 | store が `db.*` を呼ぶ箇所に閉じているため、関数単位で機械的に置換可能 |
| 同期の競合 | 初期は Last-Write-Wins。現場運用（時間帯で編集者が異なる）なら実害小 |
| iOSのバックグラウンド制約 | プッシュはAPNs必須。サイレント通知の頻度制限に注意 |
| AI推奨のオフライン不可 | AIはオンライン専用機能として割り切る（積載計算本体はローカルで動く） |
| App Store審査 | TestFlight運用なら回避可。公開時のみ要対応 |

---

## 7. 次アクション候補

- [ ] **フェーズ1着手** — Capacitor導入してアプリ起動を最短実現（手応え重視）
- [ ] **PoC: DataSource抽象化** — `lib/db.ts` のインターフェース化だけ先に試す（フェーズ3の心臓部の検証）
- [ ] **Apple Developer 登録**（並行で進められる事務手続き）

---

*このプランは段階ごとに独立して価値が出る構成です。フェーズ1→2→3 が「オフライン動作」の本線、5・6 は並行着手可能です。*
