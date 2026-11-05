# 引き継ぎ書：不動産企画係アプリの移植（realty）

> この文書は、**新しく入る開発者（人またはエージェント）が `git clone` から開発を再開できる**ように書いています。
> 最終更新：2026-11-05（**v2.2.249 まで push 済み**。次は v2.2.250 ② 媒介物件）。版を進めたら、冒頭の版・「4. 進捗」・「5. 次にやること」を必ず書き直してください（別のエージェントが常にこの文書を読んでいます）。
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

## 4. 進捗（v2.2.249 まで push 済み）

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

### 未着手のもの
**次の版の予定**（仕様書の順。1版に1つ）
- **v2.2.250：② 媒介物件の表**（物件そのもの・過去の物件との突き合わせ・三者の紐づけ）。「5. 次にやること」を参照
- その次：③ 申込獲得（自社客付けを買い反響から・取引番号・按分・状態の連動・計上月）
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

## 5. 次にやること：v2.2.250 ② 媒介物件の表（仕様書の②）
v2.2.249 が production にマージされていなければ、v2.2.249 から枝を切ります。仕様書の要約の「3. ②」に合わせます。**計画を利用者に見せて了承を取ってから着手します。**

1. **媒介物件の表**（新しい表。自社が媒介・買取した物件そのもの）
   - ⚠️ `property_db`（ポータルの掲載物件。他社の物件を含む）とは別物
   - 所在地（地番）と種別、マンションは建物名と部屋番号で、既存の物件と突き合わせる。一致すれば紐づけ、無ければ作る
   - 売り反響・台帳・媒介物件の三者を、双方向に紐づける
   - v2.2.248 の `planner:ledger_link` のトランザクションの中で行う（`backend-express/src/features/realty/ledgerLink.ts`）
   - 媒介紐付の画面に、地番・建物名・部屋番号・土地面積・建物面積・築年・間取りを足すか、利用者と決める
2. **今ある台帳（約217件）の移し替え**：既存の台帳から媒介物件を作るかどうか、利用者と決める
3. 台帳の現況の連動（買付有・契約済・成約）は ③ で行う

**v2.2.249 で決まったこと**
- 休業日は `settings.holidays`（`{ weekdays, dates }`）。初期値は火・水
- 以前のアプリの設定を取り込むときも残す（`importer.ts` の `DASHBOARD_ONLY_SETTINGS`）
- Dashboard にしか無い設定の項目を足すときは、ここにも足す

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
