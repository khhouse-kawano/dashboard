# 引き継ぎ書：不動産企画係アプリの移植（realty）

> この文書は、**新しく入る開発者（人またはエージェント）が `git clone` から開発を再開できる**ように書いています。
> 最終更新：2026-11-06（**realty は v2.2.252 まで production にマージ済み**。v2.2.253 はアクセス解析の CV（realty 外。マージ済み）。**v2.2.255（顧客情報編集の日付ボタンの位置）までマージ済み。v2.2.256 は買い反響の問合せ物件を媒介獲得台帳に紐づける検索欄（push 済み・マージ待ち）**。realty の次は v2.2.257（媒介更新履歴か ③ 申込獲得か。利用者に確かめる）。版を進めたら、冒頭の版・「4. 進捗」・「5. 次にやること」を必ず書き直してください（別のエージェントが常にこの文書を読んでいます）。
>
> ⚠️ **2026-11-05 から、改修の正は「連動トリガー仕様書」です** → [docs/realty-trigger-spec.md](realty-trigger-spec.md)
> 以前のアプリ（v14）を最優先にしていた今までの方針とぶつかるところは、仕様書に合わせます。ただし、**段階・現況の名前は今のまま**にし、仕様書の名前とは対応表で読み替えます（利用者の決定）。

---

## 0. 最初に読む順番
1. この文書
2. **[docs/realty-trigger-spec.md](realty-trigger-spec.md)**：連動トリガー仕様書の要約・名前の対応表・今の作りとの食い違い。**改修はこれが正**。
3. リポジトリ直下の `CLAUDE.md`：作業ルール。版の上げ方、テスト、docs、業務ガイド、禁止事項が書いてあり、**必ず守ります**。
4. `ReadMeClaude.md`：その回の依頼。利用者が毎回上書きします。**書かれていないことはやりません。**
5. 直近の作業記録
   - `docs/task-2026-11-04-04-realty-lead-to-deal.md`
   - `docs/task-2026-11-05-01-realty-list-usability.md`
   - `docs/task-2026-11-05-02-realty-buy-offer-resale.md`
   - `docs/task-2026-11-05-03-realty-ledger-link-lead-modal.md`
   - `docs/task-2026-11-05-04-realty-spec-phase1-ledger-link.md`（v2.2.248。仕様書 ①）
   - `docs/task-2026-11-05-05-realty-spec-phase2-deadlines.md`（v2.2.249。仕様書 ② の期限）
   - `docs/task-2026-11-05-06-realty-spec-phase2-properties.md`（v2.2.250。仕様書 ② の媒介物件）
   - `docs/task-2026-11-05-08-realty-lead-contacts.md`（v2.2.251。反響の電話・メール）
   - `docs/task-2026-11-05-09-realty-lead-contact-sync.md`（v2.2.252。反響の連絡先を電話・メールに合わせる、架電キューの電話番号）
   - `docs/task-2026-11-05-10-realty-staff-planner-deals.md`（v2.2.252。担当者の修正依頼4件：反響の表の幅・担当者の表記・精算書・商談案件の編集）
   - `docs/task-2026-11-06-02-realty-media-kpi.md`（v2.2.254。チームサマリーの売りKPI・買いKPI）
   - `docs/task-2026-11-06-03-realty-next-date-buttons.md`（v2.2.255。顧客情報編集の日付ボタンの位置）
   - `docs/task-2026-11-06-04-realty-buy-lead-ledger-picker.md`（v2.2.256。買い反響の問合せ物件を媒介獲得台帳に紐づける）
6. 古い作業記録（v2.2.221〜226）は `docs/oldDocument/task-2026-10-28-0*-realty-*.md` にあります。

---

## 1. 何の案件か
- 不動産企画係は、以前の単一 HTML アプリを使っていました（Supabase 製。`https://khf-eigyokanri.netlify.app/`）。そのアプリを Dashboard へ**全部移し**、以前のアプリは閉じます。
  - 閉じる理由：セキュリティ上の危険が高まったため。
- **方針（2026-11-05 に変更）**
  - **正は「連動トリガー仕様書」**（[realty-trigger-spec.md](realty-trigger-spec.md)）。何が起きたら何を作り、どこを紐づけるかは、仕様書のとおりにします。
  - 段階・現況の名前は今のまま（以前のアプリの値）にし、仕様書の名前と対応表で読み替えます。歩留まりの数え方と過去のデータを崩さないためです。
  - （2026-10-28〜11-04 の方針は「以前のアプリを最優先」でした。v2.2.244〜247 はその方針で作ったので、仕様書と食い違うところがあります。食い違いの一覧は仕様書の要約の「9」）
  - 画面は**同じ構成のまま**移し、見た目だけ Dashboard に合わせます。
  - メニューも以前のアプリと同じ見出し・同じ順番にします（`RealtyMenu.tsx`）。
- 部署は 2026-10-29 から Dashboard を使い始めています。ただし、以前のアプリにもまだ入力しています（「7. 切り替え」を参照）。
- 利用者は「スモールステップで進める」方針です。**1版に1テーマ**で進めます。

### 業務の流れ（制作者の説明。2026-11-04）
```
売り反響 → 媒介（売主と物件）→ 掲載 → 買い反響（物件と紐づく）
        → 購入申込で商談案件（売主⇔物件⇔買主）→ 決済

買取：売り反響 → 買取案件 → 内訳計算 → 決済 → 再販（売主は自社）→ 買い反響 → 商談案件
```
- **台帳・商談案件・買取再販案件は、画面から直接作りません。必ず反響から作ります**（制作者の要望。どの反響から来たかを辿れるようにするため）。
  - そのため v2.2.245・246 で、各画面の「追加」ボタンを消しました。

---

## 2. 環境を立ち上げる（git clone から）

### 2-1. 取得
```bash
git clone https://github.com/khhouse-kawano/dashboard.git
cd dashboard
git checkout production        # 本番の版。最新の作業ブランチは v2.2.x
git branch -a | grep v2.2.24   # 最新の版のブランチを確認
```

### 2-2. リポジトリに入っていないもの（利用者からもらう）
次のものは `.gitignore` で除かれています。**利用者（川野さん）から直接受け取ってください。** ⚠️ 中身を画面・ログ・コミットに出してはいけません。

| もの | 置き場所 | 用途 |
|---|---|---|
| DB の初期データ（約15MB） | `docker/mariadb/init/01_*.sql` | ローカル DB の中身。初回起動時に読み込まれる |
| ① PHP の秘密の値 | `backend/.env`（形は `backend/.env.example`） | 暗号化のマスターキーなど |
| フロントの接続先 | `frontend/.env.development` | `REACT_APP_XSERVER_API`（ローカルの ① を指す） |
| ② の秘密の値（任意） | `backend-express/.env.local` | 無くても起動する |
| 以前のアプリの元ファイル | リポジトリの**外**に置く | 画面を写すときの手本。下の注意を参照 |

> ⚠️ **以前のアプリの元ファイル（`index.html`。最新は v14.29.1）には Supabase のキーが入っています。**
> 読むのは、キーの部分を伏せた写し（`index.masked.html`）だけです。元ファイルを開く・読む・リポジトリに入れることはしません。
> 写しの作り方：キーの形（`eyJ…`、`sb_…` など）を `sed` で `***` に置き換える。写しも、リポジトリの外の作業用フォルダに置きます。

### 2-3. 起動
```bash
docker compose up -d           # php-web(①:8080) / express-api(②:3001) / mariadb-db(3307)
docker compose ps              # 3つとも Up(healthy) になるまで待つ（初回は DB の読み込みで最大5〜10分）

cd frontend
npm ci
PORT=3100 BROWSER=none npm start   # ⚠️ 3000 は利用者が使う。エージェントは 3100
```
- 画面：`http://localhost:3100/dashboard/`（router の basename は `/dashboard`）
- ① の窓口：`http://localhost:8080/`。② の窓口：`http://localhost:3001/api/gateway`
- ② にライブラリを足したあとに 502 が続くときは、`docker compose up -d --build -V express-api` で作り直します。
- DB に SQL を流すとき（パスワードはコンテナの環境変数のまま使い、画面に出さない）
```bash
MSYS_NO_PATHCONV=1 docker cp <file>.sql dashboard-mariadb-db-1:/tmp/q.sql
MSYS_NO_PATHCONV=1 docker exec dashboard-mariadb-db-1 sh -c 'mariadb --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" local_db < /tmp/q.sql'
```

### 2-4. 不動産企画係の画面に入る（テスト用ログイン）
ログイン画面は通さず、テスト用のスタッフを作って localStorage に入れます。
1. DB の `staff` に、id `999999` の仮スタッフを入れます。
   - 既存の Master の行を `INSERT … SELECT` で写し、`id`・`name`・`api_token`（任意の文字列）を差し替えます。
   - `shop` は `all` か `realty`、`timestamp` は今の時刻（`NOW()`）にします。
   - ⚠️ `timestamp` が古いと、フロント（`AuthProvider.tsx`）がログアウトさせます。
2. Playwright の `addInitScript` で、次の値を localStorage に入れます。

| キー | 値 |
|---|---|
| `token` | 1で決めた `api_token` |
| `authority` | `Master` |
| `userName` | 任意 |
| `shopName` | `all` |
| `category` | `realty` |

3. `http://localhost:3100/dashboard/summary` などを開きます。
4. **テストが終わったら**、仮スタッフ（id 999999）とテストで作った行を消し、開発サーバー（3100）を止めます。

---

## 3. 作りの地図

### 3-1. 通信の経路（重要）
```
画面（React） ──► ① PHP（backend/src/core/express_proxy.php） ──► ② Express（backend-express）──► MariaDB
```
- 不動産企画係のデータは、**ほぼ全部 ② で処理します**（`request: 'planner'` と `'broker'`）。① は認証の入口と中継だけです。
- ② にしか無い `roll` を新しく作ったら、`express_proxy.php` の **`expressProxyRequests()` と `expressProxyExclusive()` の両方**に `'planner:新しいroll'` を足します。足さないと、① が 404 を返します。
- 確認のしかた：トークン無しで ① に POST して **401** が返れば、② まで届いています。404 なら許可リストの漏れです。
- ⚠️ ① を通ると、本文の空のオブジェクト `{}` が `[]` に変わります。形を保ちたい JSON は文字列で送り、② で `JSON.parse` します。

### 3-2. フロント（`frontend/src/components/realty/`）
| 画面（メニュー名） | URL | ファイル |
|---|---|---|
| 今日の架電キュー | /realtyCallQueue | `callq/CallQueue.tsx`, `callq/callqLogic.ts` |
| 架電ナビ（一括査定） | /realtyCallNavi | `navi/CallNavi.tsx`, `navi/naviEngine.js`（以前のアプリを写した Shadow DOM 部品）, `navi/naviHost.ts` |
| チームサマリー | /summary | `summary/Summary.tsx`, `summary/kpi.ts`, `summary/CommandCenter.tsx`, `summary/resaleAlerts.ts` |
| 月次売上管理 | /realtySales | `sales/MonthlySales.tsx` |
| 月次媒介管理 | /realtyBaikaiMonthly | `bmonthly/BaikaiMonthly.tsx` |
| 失注・他決の分析 | /realtyLost | `lost/LostAnalysis.tsx` |
| 売り反響（一括査定） | /leadSell | `sell/LeadSell.tsx` |
| 買い反響（ポータル） | /leadBuy | `buy/LeadBuy.tsx` |
| 商談案件管理 | /leadOpportunity | `deals/LeadOpportunity.tsx` |
| 買取再販案件 | /leadResale | `resale/LeadResale.tsx` |
| 媒介獲得台帳 | /broker | ⚠️ `components/database/DatabaseBroker.tsx`（realty の外にある） |
| 週次行動計画 | /realtyWeekly | `weekly/WeeklyPlan.tsx` |
| コンプライアンス | /realtyCompliance | `compliance/Compliance.tsx` |
| 設定・データ管理 | /realtySettings | `settings/RealtySettings.tsx`, `settings/RealtyImport.tsx`, `settings/RealtyLogImport.tsx` |
| 移行中の案内 | /realtyPending?view=… | `RealtyPending.tsx` |

共通の部品（`common/`）
- `realtyState.ts`：② の呼び出し（`post`、`loadRecords(kinds)`、設定・週次・コンプラの保存）と、共通の CSS（`REALTY_CSS`。接頭辞は `rlt-`）。
- `leadLinks.ts`：反響から台帳・案件へつなぐ処理。
  - `leadToLedger`：媒介受託 → 台帳（v2.2.247 から `LedgerLinkModal.tsx` で値を確かめてから作る。売り反響の画面だけ）
  - `buyToDeal`：購入申込 → 「買」の商談案件
  - `registerBuyOffer` / `unlinkBuyOffer`：台帳の買付登録と、その解除
  - `leadToResale`：売り反響 → 買取再販案件
  - `isOwnStock`：自社が売主の物件か
  - `guessProperty`：物件名の候補
  - `logChange`：変更の記録
- `BuyOfferModal.tsx`：買付登録の画面。
- `leadUtiles.ts`：段階・終了理由の選択肢（`LEAD_PHASES`・`BUY_PHASES`・`DEAL_PHASES`・`*_END_REASONS`・`DEAL_LOST_REASONS`）と、終了理由を聞く処理（`askEndReason`）。
- `LeadFilterBar.tsx`：反響の一覧の絞り込み。
- `LeadEdit.tsx`：反響の編集画面。
- `leadFunnel.ts`：歩留まりの計算。

画面の入口
- `App.tsx` で、すべてのルートを `RealtyRoute` で包んでいます（担当事業が realty か all の人だけ入れる）。
- `Menu.tsx` は、`category === 'realty'` のときだけ `RealtyMenu.tsx` を出します。
- ⚠️ **URL は1段**にします（`/realty/xxx` にしない）。`homepage: "./"` なので、2段の URL は再読み込みすると真っ白になります。

### 3-3. バックエンド
- ②：`backend-express/src/features/realty/`
  - `index.ts`：planner / broker の roll の振り分け
  - `state.ts`：設定・週次・コンプラ。`app_state` に、項目ごとに `JSON_SET` で書きます。
  - `importer.ts`：以前のアプリのデータの取り込み
  - `calls.ts`：通話記録（`realty_call_logs`）
  - `homesAssessment.ts`：LIFULL HOME'S の査定メールを売り反響に取り込む
- ①：`backend/src/handlers/planner.php` と `broker.php`（古い処理と、② が止まったときの代わり）。
- 使う roll：`planner:records`、`planner:state`、`planner:settings`、`planner:weekly`、`planner:compliance`、`planner:import_*`、`planner:call_*`、`planner:navi_save`、`broker:update` など（一覧は `express_proxy.php`）。

### 3-4. データの形（`brokerage_listings` 1表に全部入っている）
- 列 `kind` で種類を分けます。
  - 主なもの：`leads`（売り反響）、`buyLeads`（買い反響）、`deals`（商談案件）、`ledger`（媒介台帳）、`resales`（買取再販）、`logs`、`notices`
  - そのほか（以前のアプリにあった種類）：`renewals`、`docs`、`settlements`、`sellerReports`、`viewings`、`comments`
- 削除は `show_dashboard = 0` です（`loadRecords` は削除済みを返しません）。
- 読む：`loadRecords(['deals', 'ledger'])` → `{ records, settings }`
- 書く：`saveBrokerageRecord(id, fields)`（`broker:update`。UPSERT）
- **つながりのキー**
  - 売り反響 → 台帳：反響の `ledgerId`・`ledgerNo`
  - 台帳 → 売り側の商談案件：台帳の `dealId`
  - 他社客付けの情報：台帳の `coBroker`（JSON の文字列）
  - 買い反響 → 商談案件：反響の `dealId`。物件は `ledgerId`・`ledgerNo`
  - 買取再販 → 台帳：再販の `ledgerNo`
- **番号**：台帳 No. と商談案件 No. は、いちばん大きい番号 + 1 です。
- **担当者の書き方が種類で違います**
  - 台帳：略称
  - 反響・商談案件：フルネーム
  - 変換は `settings.staff` の略称 ↔ 名前で行います。
- 設定は `app_state` にあります（形は以前のアプリと同じ）。
- 通話記録は `realty_call_logs` にあります（全員が読めます）。

### 3-5. 業務ガイドの記事（画面を変えたら直す）
`backend/scripts/guide/articles/common/` の不動産企画係の記事は、次のとおりです。

| 記事 | 内容 |
|---|---|
| screen-230 | 入口と権限 |
| screen-232 | 今日の架電キュー |
| screen-233 | 架電ナビ |
| screen-240 | チームサマリー |
| screen-242 | 月次売上管理 |
| screen-243 | 月次媒介管理 |
| screen-244 | 失注・他決の分析 |
| screen-245 | 歩留まり |
| screen-247 | 反響から商談案件へのつながり |
| screen-250 | 週次行動計画 |
| screen-260 | コンプライアンス |
| screen-270 | 設定 |

手順は `CLAUDE.md` の「業務ガイドの記事」のとおりです（`build-guide-sql.cjs` で SQL を作り、その版の update_log の SQL の末尾に足します）。

### 3-6. 関係する SQL（`backend/scripts/sql/`）
- `2026-10-28_realty_import_1_backup.sql`〜`3_restore.sql`：以前のアプリのデータを取り込む前と後に流す（手順は `docs/oldDocument/deploy-v2.2.224.md`）
- `2026-10-28_realty_call_logs.sql`：通話記録の表
- `2026-11-04_realty_deal_lost.sql`：失注理由の列（`lostReason`・`lostDate`・`lostNote`）

---

## 4. 進捗（v2.2.256 まで push 済み）

### 終わったもの
| 版 | 内容 |
|---|---|
| v2.2.221 | 入口と安全：区分 `realty`、ルートの制限、データの読み書きを ② へ移して認証を付けた、データファイルを git とサーバーから除いた |
| v2.2.222 | チームサマリーを実データで出す |
| v2.2.223 | 設定画面、週次行動計画、コンプライアンス |
| v2.2.224 | 以前のアプリのデータの取り込み（設定画面。マスターだけ） |
| v2.2.225 | メニュー、チームサマリー（営業司令塔・買取再販の期限）、月次売上、月次媒介、失注分析、歩留まり（58項目が以前のアプリと一致） |
| v2.2.226 | 今日の架電キュー、架電ナビ、通話記録、CSV の取り込み |
| v2.2.244 | 反響から台帳・案件へのつながり、商談案件管理の作り直し、選択肢を以前のアプリの値にそろえた、失注理由 |
| v2.2.245 | tsconfig の修正（ビルドで型を確かめるようになった）、反響の絞り込み、通期（12か月）の表示、媒介台帳を1枚に、追加ボタンの削除 |
| v2.2.246 | 媒介台帳の買付登録（他社は「売」1件、自社は「売」「買」2件、解除できる）、売り反響の「買取案件へ」、買取再販の「＋案件」を削除 |
| v2.2.247 | 売り反響の「媒介紐付」（売り反響の値が入った登録の画面で確かめてから台帳を作る。台帳へつなぐのは売り反響の画面だけ）、売り・買い反響の「反響を追加」を登録のモーダルに（必須・重複の確認） |
| v2.2.248 | **仕様書 ①**：媒介紐付の必須（専属専任・未来日不可・満了日3か月・売出価格・担当・所在地・種別）、台帳の作成と反響の媒介受託を ② の `planner:ledger_link` で1つのトランザクションに、作った台帳を開くボタン、架電キュー・チームサマリーで媒介受託を選べない。あわせて仕様書の要約 `realty-trigger-spec.md` を作成 |
| v2.2.249 | **仕様書 ② のうち期限**：設定画面の「休業日」（定休の曜日と個別の日付。初期値は火・水。取り込みでも消えない）、媒介獲得台帳にレインズ登録の期限（専属専任5営業日・専任7営業日）・販売報告の期限（7日・14日ごと）・満了（expiry。14日前から。一般も）。計算は `common/deadlines.ts` |
| v2.2.250 | **仕様書 ② のうち媒介物件**：新しい表 `realty_properties` と `brokerage_listings.propertyId`。媒介紐付で、種別＋住所（地番・マンションは建物名＋部屋）で物件を探し・作り・台帳と売り反響に紐づける（② の同じトランザクション。突き合わせは `features/realty/propertyKey.ts`・規則は `propertyKeyRules.json`）。今ある台帳は移し替えの SQL（`build-property-sql.cjs` で作る）。一覧に「同じ物件の台帳 N件」 |
| v2.2.251 | 反響の電話番号・メールアドレス：以前のアプリから取り込んだ反響は連絡先（contact「電話 / メール」）だけで phone・mail が空だった → SQL で contact から入れた（先頭の0が落ちた携帯は0を足す）。取り込み直し（importer.ts）でも入れる（`features/realty/contactSplit.ts`。入っている値は上書きしない） |
| v2.2.252 | 反響の連絡先（contact）：画面からの登録・編集で contact が空・古いままだった → ② の `broker:update` で、売り反響・買い反響の phone・mail が**変わったとき**だけ contact を「電話 / メール」に作り直す（`features/realty/index.ts` の `withLeadContact`）。架電キュー（`telOf`）・架電ナビは phone を先に読む。空の contact を埋める SQL。**担当者からの修正依頼4件**：①売り・買い反響の担当欄が縮む → 選択欄の列に最小幅 ②台帳の担当が略称・空白入り・氏名で混在 → **空白なしの氏名**にそろえた（SQL `2026-11-05_realty_staff_name_unify.sql`・媒介紐付 `ledgerLink.ts`・取り込み `importer.ts`・台帳の編集画面 `PropertyRegister.tsx`。読むところは `kpi.ts` の `findStaff`・`staffNameOf`）③精算書に見本の値（田原様・固都税）が残る → 開くたびに空欄から作り直す（`PlannerGenerator.tsx` の `plannerDefaults`・以前のアプリの fromDeal）④商談案件の「編集」が表の右端で見えない → 左端・物件名で編集 |
| v2.2.254 | **チームサマリーの売りKPI・買いKPI**（以前のアプリ v14.30 の `DSK_KIND`・`dskAgg`・`dashKpiCard`・`dskCsv` をそのまま写した）。見出しのすぐ下・歩留まりファネルの前に2枚。媒体別・担当者別・担当者×媒体（指標を選ぶ）、期間は期首〜対象月の累計（対象月は上で選んだ月。通期なら今月）・各月・各期・全期間、絞り込み、±5pt の色分け、CSV（クロスは縦持ち）。集計は `summary/mediaKpi.ts`、画面は `summary/MediaKpiCard.tsx`。数え方は受信月コホート（`leadFunnel.ts` の関数）。通電アポのアポ日は原本の `raw_data.appt.date`（架電ナビが書く）。② と DB の変更なし |
| v2.2.255 | 顧客情報編集（`common/LeadEdit.tsx`）の「明日」「3日後」…ボタンが、買い反響では通電日の下に出ていた → 次回連絡日の列の中（入力欄の真下）に移した（`col-12` の行で置いていたのが原因） |
| v2.2.256 | 買い反響の編集に「問合せ物件（媒介獲得台帳）」の検索欄（`common/LedgerPicker.tsx`。以前のアプリ v14.14 の選択欄を検索の形に）と「問合せ物件名」。押すと `ledgerId`・`ledgerNo`・`propertyId`（台帳の媒介物件）を入れる。一覧に「📝No.〇」。② の `broker:update` の書き込める列に `propertyId` を追加。DB の列の追加なし |

### 未着手のもの
**次の版の予定**（1版に1つ。v2.2.257 のテーマは利用者に確かめる）
- 資料の提案する順番では、売りKPI・買いKPI（v2.2.254 で済）の次は**媒介更新履歴**（`renderRenew`）→ 販売報告＋台帳の報告期限 → データ品質チェック → ③
- **③ 申込獲得**（自社客付けを買い反響から・取引番号・按分・状態の連動・計上月）。「5. 次にやること」を参照
- その次：④ 買取獲得・⑤ 内訳と消費税（以前の予定「買取再販の誤りの修正」と「按分の画面一式」はここに入る）

**まだ移していない画面**
- 売主への販売報告
- 媒介更新履歴
- データ品質チェック
- 買取再販案件の一覧を、以前の画面の形にする
- 設定画面の残りのカード
  - 買取再販の粗利方式・経費科目
  - 架電キュー
  - 販売報告
  - データ管理
- 書類（`documents/` に下地あり）
- ロープレ（今は「移行中」と表示）

**利用者の判断待ち**
- 仕様書の「要確認」（課長・経理・税理士。一覧は仕様書の要約の各節）
  - 媒介獲得件数を数える日付（契約日か登録日か）
  - 休業日カレンダーの置き場所
  - 買取転換のときの件数
  - 再販の買主を自社で付けたときの売上
  - 消費税の4項目
- 売上の計上月を、仕様書どおり決済日の月にするか（今は契約日の月。数字が変わる）
- 仲介手数料の「800万円以下は30万円」の特例を残すか（仕様書は3%＋6万円＋消費税）
- 帳簿の条文をロとハのどちらにするか（経理に確認中）
- 一括で割合を入れたときに、消費税が合わない件の扱い
- 架電ナビで、不在でも「通電済」になる。以前のアプリの不具合をそのまま移したもので、直すかどうかが決まっていない。

**大きな作り替え**
- 売主・物件・買主を「物件」1つでつなぐ表（仕様書の「媒介物件」）は、まだありません。仕様書の②で作ります。

---

## 5. 次にやること：v2.2.257（媒介更新履歴か ③ 申込獲得か。利用者に確かめる）
v2.2.256 までが production にマージされていなければ、最新の版から枝を切ります。以下は ③ を選んだときの要点です。仕様書の要約の「4. ③」と、食い違いの一覧（6〜10）に合わせます。**③は大きいので、どこまでを1版にするかを利用者と決め、計画の了承を取ってから着手します。**

主な食い違い（今の作り → 仕様書）
- 自社客付け（売・買の2件）：今は台帳の「買付登録」から作る → 仕様書では買い反響を「申込獲得」（＝購入申込）にして保存したときに作る
- 買い反響の購入申込：今は「買」1件だけ → 自社の台帳物件なら2件
- 取引番号・番手、按分（整数％・合計100％・端数は主担当へ）、状態の連動（契約済・決済済・失注を台帳・反響へ）、③-A の2件の失注を一緒に処理
- ⚠️ 仲介手数料（800万円以下の30万円の特例・税抜 → 3％＋6万円＋消費税）と、**売上の計上月（契約日の月 → 決済日の月）**は数字が変わるので、利用者の判断が要る（判断待ちの一覧にある）
- 保存は ① と同じく、② の1つのトランザクションにまとめる（今の `common/leadLinks.ts` の registerBuyOffer・buyToDeal は、画面から何回かに分けて保存している）

### 参考：以前のアプリ v14.30 と現行の相違点（2026-11-05 に利用者から受領）
利用者の Downloads にある「以前のアプリ v14.30 と現行（v2.2.248）の相違点・改修依頼の要点.md」（作成 時任さん。リポジトリには無い）。v2.2.248 の時点の比較なので、媒介物件（v2.2.250）・期限（v2.2.249）は済んでいる。要点：
- 以前のアプリの最新は **v14.30**（画面下の表示は v14.29.1 のまま）。手本は伏せた写し（`index.masked.html`）。各節に手本の関数名がある
- 差が大きいもの（優先 高）：買取再販の按分一式（`RSA`：按分の比較・根拠書・期限管理・今期の消費税）、チームサマリーの**売りKPI・買いKPI**（`DSK_KIND`・`dskAgg`・`dashKpiCard`。媒体別・担当者別・クロス、CSV）、移行中の**売主への販売報告**（`SR`）
- 中：媒介更新履歴（`renderRenew`）、データ品質チェック（`qualityChecks`）、台帳の鍵の預かり・次回報告期限・報告状態の列、ロープレ、売り反響の CSV・メール取込、買い反響の明細 CSV
- 低：書類添付、月次売上の書類の列、設定の CSV 出力・復元（「初期データに戻す」「下書きの全削除」は移さないことを勧める）、メール文例の初期値
- 外部の仕組みが要るもの（メール取込・AI ロープレ・コメント通知・書類の置き場）は、置き場と費用を決めてから
- **資料の提案する順番**：② 媒介物件・期限（済）→ 売りKPI・買いKPI（仕様書とぶつからない。早めを勧める）→ 媒介更新履歴 → 販売報告＋台帳の報告期限 → データ品質チェック → ③ 申込獲得 → ④⑤ 買取・按分（2版）→ ⑤ 一覧の期限・今期の消費税・精算書・取込・CSV → 残り
- **利用者の判断待ち（資料の7章）**：「画面・項目・帳票・集計は HTML、きっかけと作成・必須・取消・権限・税の確定は仕様書」という分け方でよいか／手数料の特例と計上月／按分方法（HTML 4種・6種と仕様書3種）／レインズの期限（v2.2.249 で営業日にした）
- ⚠️ 次の版のテーマは、利用者に確かめてから着手する（売りKPI・買いKPI は v2.2.254 で済）

**v2.2.256 で決まったこと**
- 買い反響と台帳のつながりは `buyLeads.ledgerId`・`ledgerNo`（物件名の一致は使わない）。編集画面の検索欄で紐づけたときは、台帳の `propertyId`（媒介物件）も入れる（利用者の了承）
  - ⚠️ 台帳の「買付登録」の自社客付け（`leadLinks.ts` の registerBuyOffer）は、今は ledgerId・ledgerNo だけで propertyId を入れていない。③ で買い反響から作るときにそろえる
- ポータルの反響を物件名・住所で自動でつなぐ処理（以前のアプリのメール取込の `mbFindLedger`）は未移植。メール取込を移すときに一緒に移す

**v2.2.254 で決まったこと**
- 売りKPI・買いKPI の数え方は以前のアプリ v14.30 のまま（受信月コホート。歩留まりファネルと合計が一致する）。表示の条件は保存しない（以前のアプリと同じ）
- 媒体は書いてあるとおりに分ける（「HOME's」と「HOME'S」は別の行。以前のアプリも同じ）。ローカルでは売り反響に「HOME'S」が1件あった

**v2.2.252 で決まったこと**
- **担当者は、どの種類（反響・台帳・商談・買取再販）も「空白なしの氏名」**（設定の担当者名。利用者の決定）。台帳も氏名（以前のアプリは略称）
  - 以前のアプリから来るデータは略称のことがあるので、台帳の担当を読むときは `kpi.ts` の `findStaff`・`staffNameOf`（氏名・略称・空白違いを同じ人にする）を使う。略称で `===` 比較しない
  - 設定の担当者に居ない「大坪」（スタッフ表では中古住宅専門店の「大坪 征也」さん）の台帳10件はそのまま（利用者の決定）
  - 台帳の `portal` 列は略称のまま（Dashboard は読まない）
- 精算書（`PlannerGenerator.tsx`）は開くたびに空欄の初期値から作る。見本の値を初期値に置かない
- 電話番号の正は `phone`。`contact` は表示・検索・重複判定用で、② の `broker:update` が phone・mail の変更に合わせて作り直す（画面に contact の欄は作らない）
- phone・mail が前と同じ保存（フェーズだけの変更など）では contact を変えない（以前のアプリの2つ目の番号などの書き込みを残すため）
- 電話番号を読むところ（架電キュー `telOf`・架電ナビ `naviEngine.js`）は phone → contact の順

**v2.2.251 で決まったこと**
- 反響の電話・メールは `phone`・`mail`。`contact` は以前のアプリの形（「電話 / メール」）のまま残す。取り出し方は `contactSplit.ts` と SQL で同じ

**v2.2.250 で決まったこと**
- 媒介物件は `realty_properties`。台帳・売り反響（④で買取案件も）は `brokerage_listings.propertyId` でつなぐ
- 住所のそろえ方は `backend-express/src/features/realty/propertyKeyRules.json` の1か所
  - ⚠️ 変えると、すでに作った物件の突き合わせ用の文字列と合わなくなる。変えるときは利用者と相談し、移し替えの SQL も `node backend/scripts/realty/build-property-sql.cjs` で作り直す
- 番地の無い住所は、ほかとまとめない（キーの末尾に `|u:台帳 ID`）

---

## 6. 守ること・ハマりどころ
**ルール**
- `.env` や、キー・パスワードが入ったファイルは**読まない・書かない**。以前のアプリの元ファイルも同じです。
- 既存のコードを変える前に、**計画を出して利用者の了承を取る**。
- 顧客の個人情報を、画面・ログ・報告に出さない。
- 応答は日本語で書く（途中の報告も）。
- push するのは版のブランチまで。マージは利用者が GitHub の PR で行う。コミットの末尾には、決まった Co-Authored-By の行を入れる。
- **`version.ts` の版はブランチ名と同じにする**。版を上げたら、update_log の SQL を作ってローカルにも流す（`CLAUDE.md`）。
- デプロイの手順書（`docs/deploy-v2.2.x.md`）を毎回書く。① と ② のどちらに何を上げるか、その順番まで書く。
- 2日たった docs は、`docs/oldDocument/` へ移す。

**ハマりどころ**
- 段階の名前は、以前のアプリの値から変えない。「通電済み」のように1字違うだけで、歩留まりの数に入らなくなります。
- 数字（歩留まり・売上）を以前のアプリと見比べてもらうのは、**切り替えの取り込みが済んでから**です。途中の版で「見比べてください」と頼まない。
- Git Bash のコマンドラインに日本語を直接書くと、文字が化けます。日本語の入ったスクリプトや SQL は、ファイルに書いてから実行します。
  - node から docker を呼ぶときは `execFileSync`（shell を通さない）を使います。
- 改行が CRLF のファイルがあります。行の置き換えは、改行をそろえてから行います。
- 型チェック：`cd frontend && npx tsc --noEmit -p .`。v2.2.245 から、`npm run build` でも型を確かめます。
- Playwright のとき
  - 固定ヘッダーが邪魔でクリックできないときは、`el.click()` を `evaluate` で呼びます。
  - 読み込みを待つときは、`waitForFunction` で行数を待ちます。

**完了の条件**（`CLAUDE.md` の「開発終了の条件」）
1. コードを読み直す。
2. 動かして確かめる。
   - ① を通した確認：トークン無しで 401 が返る。
   - 画面の確認：Playwright（3100）。
3. 改修した範囲を整理し、もう一度テストする。
4. 作業記録（docs）・業務ガイドの記事・update_log の SQL・デプロイの手順書を書く。

---

## 7. 本番の切り替え（いつか必要）
- 部署は今も以前のアプリに入力しています。**切り替えの日に、最新のデータを取り込み直します。**
  1. 以前のアプリで「バックアップを保存（JSON）」を押してファイルを作る。
  2. Dashboard の設定画面の「以前のアプリのデータを取り込む」で読み込む（マスターだけ）。
  3. 取り込みの前と後に、① で `2026-10-28_realty_import_1〜3` を流す。
- ポータルから取り込んだ分とは、`extId` で突き合わせます。
- 取り込みのあと、歩留まりと売上が以前のアプリと合うかを利用者が確かめ、必要なら調整します。
