# 改修サマリー（2026-08-27 セッション）

対象コミット: `dc351cb fix DailyReports.tsx` / `0713019 fix ListKaeru.tsx`
ブランチ: `version2.2.104`

## 概要

大きく4つの改修を行った。

1. **Claude KPI分析の絞り込み機能** — 部門 → 課 → 店舗 → スタッフ の4段カスケード
2. **Claude KPI分析の結果保存・復元** — 新規テーブル + 3ハンドラ + 履歴UI
3. **月次日報モーダルの全画面化** — 「× 閉じる」ボタン追加
4. **ListKaeru の反響合計を CustomerTrendKaeru と一致させる**

---

## 1. 修正したファイル

### バックエンド

#### `backend/src/core/kpi.php`（+368行）

Claude分析の集計ロジック本体。

| 追加した関数 | 役割 |
|---|---|
| `kpiShopDivision()` | 部門キー → `shop_list.division` の値を解決 |
| `kpiFormatJpDate()` | 保存タイトル用の日付（`2026年8月27日`） |
| `kpiMediumExpr()` | 販促媒体名の集計式。**建売のみ**丸め込みを行う（後述） |
| `kpiDivisionShops()` | `report_flag = 1` の対象店舗一覧 |
| `kpiResolveScope()` | 絞り込み指定を**DBで検証**して解決。不正なら `KpiScopeException` |
| `kpiScopeWhere()` | 解決済みスコープを `WHERE` 断片とバインド値に変換 |
| `kpiScopeDescription()` | Claudeへ渡す「対象範囲」の説明文 |
| `kpiBenchmark()` | 絞り込み時の比較基準（部門全体の値） |

変更した既存要素:

- `KPI_DIVISIONS` のラベルを `注文営業/建売営業` → **`注文事業/建売分譲事業`**（`shop_list.division` の実値に合わせた）。`shop_division` キーを追加。
  **キー（`order` / `kaeru`）は `ai_usage_log.feature` に記録済みのため変更していない。**
- `kpiFunnelBy()` / `kpiOverallContext()` / `buildInquiryTrendSnapshot()` / `buildShopSummarySnapshot()` / `buildMediumSummarySnapshot()` に `$scope` 引数を追加（デフォルト空＝従来動作）
- `kpiOverallContext()` に `$months` 引数を追加（期間を絞った分析の基準値を同じ期間で取るため）
- 冒頭の方針コメントを更新: `in_charge_user`（従業員名）は絞り込み条件としての使用を許容、集計軸には使わない

#### `backend/src/handlers/kpi_analyze.php`（+150行）

- `section` / `shop` / `staff` を受け付け、`kpiResolveScope()` で検証（不正は400）
- `KPI_SCOPED_PROMPT` を追加（母数が小さいときの注意・benchmarkの読み方）
- **店舗を絞り込んだ状態での `type: 'shop'` は400で拒否**（画面でもグレーアウト）
- 成功時に `kpi_analysis_history` へ保存。**保存失敗は分析結果の返却を妨げない**（既に課金済みのため `error_log` のみ）
- レスポンスに `history_id` / `title` / `meta.scope` を追加

#### `backend/src/handlers/listAction/list_spec.php`（+11行）

`$sql_summary`（`master_data_kaeru`）に **`show_dashboard` を追加**。
これが無いと ListKaeru 側で母数を揃えられない。

### フロントエンド

#### `src/components/header/ClaudeAnalysis.tsx`（+489行）

- `DIVISIONS` のラベルを `注文事業` / `建売分譲事業` に変更、`shopDivision` を追加
- 起動時に `kpi_filter_master` を1回取得し、カスケードは画面側で解決
- 4段セレクト（分析対象 / 課を選択 / 店舗を選択 / スタッフを選択）
- **「課を選択」はマウント直後から操作可能**。マスタ取得中は `読み込み中…`（disabled option）を出すだけで、セレクト自体は無効化しない
- 店舗またはスタッフ選択中は「店舗別サマリー」をグレーアウト（バッジ `対象外`）
- メニュー画面に「保存済みの分析」一覧（復元・削除・もっと見る）
- メニュー画面にもエラー欄を追加（履歴の削除・復元の失敗が握り潰されていた）

#### `src/components/header/ClaudeAnalysisResult.tsx`（+93行）

- 型追加: `OverallContext` / `Benchmark`、`FunnelSnapshot` と `InquiryTrendSnapshot` に `scope_label` / `benchmark`
- 絞り込み時、StatCard の補足を「部門平均 27.1%（-8.2%）」形式に切替、`tone` で色分け
- `SMALL_SAMPLE_THRESHOLD = 300` 未満で「母数が少ない」警告
- headline の上に絞り込み範囲を表示

#### `src/components/header/Header.tsx`（+74行）

- `isFullscreenMenu`（`editMenu === '月次日報'`）と `modalBody` を導入
- 月次日報のみ `dialogClassName="modal-fullscreen"` + `contentClassName="h-100 d-flex flex-column"`、`centered` を無効化
- **見出しの隣に「× 閉じる」ボタン**（全画面時のみ）。`.modal-header` は `justify-content: space-between` のため `justify-content-start` で上書きしないと右端へ飛ぶ
- 全画面時のみ `closeButton` を非表示（閉じる手段の二重化を避ける）
- Body は全画面時 `p-0 flex-grow-1` + `overflow:hidden`、中身を `height:100%`。それ以外は従来の `80vh` を維持

> `fullscreen` プロパティは react-bootstrap の型が `true | string` のため真偽値を渡せない。`dialogClassName` で同等のクラスを当てている。

#### `src/components/header/DailyReports.tsx`（+80行）

- ルートを `minHeight:100vh` → `height:100%` + `d-flex flex-column`
- 表のコンテナを `maxHeight:100vh` → `flex-grow-1`
- ルート / Card / Card.Body に **`minHeight: 0`** を付与
  （これが無いと flex 子要素が縮まず、表の内部スクロールと `thead`・1列目の `sticky` が効かない）

#### `src/components/list/ListKaeru.tsx`（+34行）

- `Customer` 型に `show_dashboard` を追加
- `dashboardCustomers`（`show_dashboard === 1`）を新設
- **`filteredRegister` を新設 → `inquiryFilter`（反響合計）が参照**。
  `inquiry_customer_kaeru.inquiry_date` ではなく **`master_data_kaeru.register`** で数えるように変更
- `filteredInterview`（来場合計）も `dashboardCustomers` 基準に変更
- `filteredInquiry` は**未同期件数専用**として残置（`sync` 列は `inquiry_customer_kaeru` にしかない）
- `show_dashboard` を返さないAPIに接続している場合は絞り込みをスキップするフォールバックあり

---

## 2. 作成したファイル

| ファイル | 内容 |
|---|---|
| `backend/src/handlers/kpi_filter_master.php` | 絞り込みマスタ（`shop_list` の `report_flag=1` + `staff_list` の最新period）を1回で返す |
| `backend/src/handlers/kpi_analysis_list.php` | 保存済み分析の一覧。**重いJSON列はSELECTしない** |
| `backend/src/handlers/kpi_analysis_get.php` | 1件取得（復元用）。**Claudeを呼ばないので課金なし** |
| `backend/src/handlers/kpi_analysis_delete.php` | 削除（物理削除） |
| `backend-express/scripts/sql/2026-08-27_kpi_analysis_history.sql` | テーブル定義 |
| `backend-express/scripts/sql/2026-08-27_kpi_analysis_history_data.sql` | 開発環境の実行結果を本番へ移す**データ移行SQL** |

全ハンドラは `requireMaster` で保護。`index.php` がファイル名でルーティングするため、ルーター登録は不要。

---

## 3. 作成したテーブル

### `kpi_analysis_history`

Claude KPI分析の結果を保存し、課金なしで復元するためのテーブル。

| 列 | 型 | 用途 |
|---|---|---|
| `id` | bigint AI PK | |
| `staff_id` | int **FK→staff(id)** | 実行者 |
| `usage_log_id` | bigint NULL | `ai_usage_log.id`。**FKは張っていない** |
| `title` | varchar(255) | `2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析` |
| `headline` | text | 一覧のサブテキスト |
| `analysis_type` | varchar(32) | `inquiry_trend` / `shop` / `medium` |
| `division` | varchar(16) | `order` / `kaeru` |
| `scope_section` / `scope_shop` / `scope_staff` | varchar(100) NULL | 絞り込み条件 |
| `scope_label` | varchar(255) | `注文事業 › 鹿児島営業1課` |
| `analysis_json` | longtext | `StructuredAnalysis`（Claudeの解釈） |
| `kpi_json` | longtext | `AnySnapshot`（グラフの元データ） |
| `model` | varchar(64) | |
| `created_at` | datetime | |

INDEX: `(staff_id, created_at)` / `(division, analysis_type, created_at)`

**HTMLではなくJSONで保存している理由**: グラフは Recharts が `kpi` スナップショットから描画するため、HTMLを固めるとグラフが失われ、過去分析同士の比較にも使えなくなる。JSONなら既存の `ClaudeAnalysisResult` に渡すだけで同一画面が復元できる。

**個人情報**: `kpi_json` に顧客個人情報は含まれない（`kpi.php` が集計値しか作らず、住所は都道府県・市区町村まで丸め済み）。

---

## 4. 修正したテーブル

**なし。** 既存テーブルへの `ALTER` は一切行っていない。
`shop_list` / `staff_list` / `master_data` / `master_data_kaeru` / `inquiry_customer_kaeru` は参照のみ。

---

## 5. 次のセッションに残しておくべき情報

### 5-1. 【要対応】本番未適用のもの

**マイグレーション2本が本番未適用。** ローカルDockerには適用済み。

```bash
# 実行順序を守ること（2本目はDDLに依存）
mariadb -u<USER> -p <DB> < backend-express/scripts/sql/2026-08-27_kpi_analysis_history.sql
mariadb -u<USER> -p <DB> < backend-express/scripts/sql/2026-08-27_kpi_analysis_history_data.sql
```

- 未適用のまま分析を実行しても**結果表示と課金は正常に動く**。保存だけが失敗し `error_log` に記録される（意図的な設計）
- データ移行SQLは冪等（`(title, created_at)` で重複チェック）。3回流して1行のままを実測確認済み
- `usage_log_id` は意図的に `NULL`（元の `19` は開発環境の `ai_usage_log.id` であり、本番の同じidは別レコードの可能性が高い）
- 前提の `SELECT COUNT(*) FROM staff WHERE id = 1;` = 1 はユーザー確認済み

**`listAction/list_spec.php` のデプロイが必要。** これが無いと ListKaeru はフォールバックが効いて改修前の値（2026/08なら260）を表示する。

### 5-2. 【重要な罠】`handlers/` 直下に呼ばれないデッドファイルがある

`list.php` は **`listAction/list_{category}.php`** を `require` する。

```php
$category = $data['category'] ?? '';   // 'order' | 'spec' | 'used' | 'common'
require_once __DIR__ . "/listAction/list_{$category}.php";
```

一方 `handlers/` 直下には**同じ内容の使われていないファイル**がある。
実際にこのセッションで `handlers/list_kaeru.php` を編集してしまい、画面が全て0になる不具合を出した。

| デッドファイル | 実際に動いているファイル |
|---|---|
| `handlers/list_kaeru.php` | `handlers/listAction/list_spec.php` |
| `handlers/list_resale.php` | `handlers/listAction/list_used.php` |

いずれも `require` / `include` の参照は **0件**（grep確認済み）。
**PHPを直す前に、必ずルーティング元から辿って対象ファイルを確定すること。**

`customerTrend.php` も同様に `customerTrendAction/customerTrend_{category}.php` へ振り分ける（こちらは重複ファイルなし）。

### 5-3. category と部門の対応

| `category` | 画面 | テーブル | `shop_list.division` |
|---|---|---|---|
| `order` | 注文 | `master_data` | `注文事業` |
| `spec` | 建売 | `master_data_kaeru` | `建売分譲事業` |
| `used` | 中古 | — | `中古リノベ` |

Claude分析の `division` キーは `order` / `kaeru`（`spec` ではない）。**画面側の `category` とは別系統**なので注意。

### 5-4. 調査で判明したデータ仕様（実測）

```
shop_list.division  : 注文事業 45 / 建売分譲事業 12 / 不動産企画室 4 / 中古リノベ 2
report_flag = 1     : 注文事業 30 / 建売分譲事業 7
```

- **`master_data.in_charge_store` は `shop_list.shop` と完全一致**（注文 `KH鹿児島店` 等 / 建売 `鹿児島1係` 等）
- `in_charge_user` ↔ `staff_list.name` の一致率: 注文 **97.7%** / 建売 **87.8%**
- `staff_list` は配属年度（`period`）ごとに行が増える（2025 / 2026 / 2027）。**同一人物が複数行に出るので DISTINCT 必須**
- 建売の `不動産課`（かえる各店）は **全て `report_flag = 0`**。そのため「課を選択」には出てこない（`不動産営業1課` / `不動産営業2課` のみ）
- `外販` は `report_flag = 1` だが最新periodの担当者が0名

### 5-5. 建売の販促媒体名の丸め込み

`kpiMediumExpr()` が **`kaeru` のときだけ**以下を `ネット` に丸める。

- `Instagram` / `Web検索` / `その他`
- 「、」で区切って複数選択されている値（例: `Instagram、Web検索`）

```
ネット: 4,903 → 5,478 に統合
```

注文事業（`master_data`）にはこの入力ゆれが無いため丸めていない。
**この式は集計（GROUP BY）と絞り込み（WHERE）の両方で使うこと。** 片方だけだと `medium_monthly` の突き合わせが空振りする。

### 5-6. SQLの注意点

- **`SELECT DISTINCT ... ORDER BY 非選択列` は本番の `ONLY_FULL_GROUP_BY` で500になる。**
  `GROUP BY col ORDER BY MIN(other)` に書き換えること。このセッションで2箇所修正済み
- テーブル名はプレースホルダで渡せないため、必ず `KPI_DIVISIONS` のようなホワイトリストで解決する
- `master_data` の日付列は `YYYY/MM/DD` と `YYYY-MM-DD` が混在。`kpiDateExpr()` がハイフンに正規化してから `STR_TO_DATE` している

### 5-7. ListKaeru と CustomerTrendKaeru の数値の関係

| | ListKaeru 反響合計 | CustomerTrendKaeru 総反響数 |
|---|---|---|
| テーブル | **`master_data_kaeru`**（改修後） | `master_data_kaeru` |
| 日付 | `register` | `register` |
| 除外 | `show_dashboard = 1` のみ | `show_dashboard = 1` のみ |

改修前は `inquiry_customer_kaeru` の `inquiry_date` を数えていたため大きくずれていた。

```
2026/08: 260 → 212   2026/07: 451 → 343
2026/06: 155 → 311   2026/05:  64 → 298
```

店舗別・期間指定を含め、実APIへPOSTして全て一致することを確認済み。

**⚠️ 未解決の懸念**: ラベル「反響合計(未同期)」の括弧内は `inquiry_customer_kaeru` 由来のままで、**合計の内訳ではない**。2026/08 なら `212(8)` と表示されるが 8件は212に含まれない。ユーザー判断でラベルは現状維持とした。運用で誤読が出たら要再検討。

### 5-8. Claude分析の運用仕様

- モデル `claude-opus-5`、`effort: medium`、`max_tokens: 8000`
- **1回40〜60秒・十数円の課金が発生する**
- 1人1日20回まで（`ai_usage_log` の `feature LIKE 'kpi_analyze%'` で前方一致カウント）
- APIキーは自分のものを優先、無ければ組織内の有効なキーを共有利用
- 全ハンドラ `requireMaster`（`staff.brand === 'Master'`）

### 5-9. 検証状況

| 項目 | 状態 |
|---|---|
| `php -l`（変更した全PHP） | 通過 |
| `tsc --noEmit` | 通過（`src/components/test.js` の既存エラーは無関係） |
| 本番ビルド | 通過。変更ファイル由来の新規lint警告なし |
| SQLロジック | 実データで検証済み（スコープ解決・不正指定の拒否4パターン・媒体丸め・benchmark期間そろえ） |
| ListKaeru ↔ CustomerTrend | 実APIへPOSTして月別・店舗別・期間指定すべて一致を確認 |
| データ移行SQL | クリーンDBで実行 → 内容MD5一致・冪等性・FK欠落時のエラー停止を確認 |
| **Claude API の実行（課金あり）** | **未実施** |
| **ブラウザでの実表示** | **未確認**（月次日報の全画面表示、絞り込みUI、履歴UI） |

### 5-10. 開発環境メモ

```
dashboard-php-web-1    0.0.0.0:8080->80/tcp     backend/src を /var/www/html にマウント
dashboard-mariadb-db-1 0.0.0.0:3307->3306/tcp   DB名: local_db
dashboard-express-api-1 0.0.0.0:3001->3001/tcp
```

- フロントの接続先は `.env.development` の `REACT_APP_XSERVER_API`。
  **開発モードが本番APIを向いていないか要確認**（向いていると、ローカルのPHP修正が反映されない）
- PHPコンテナ内でのlint: `docker exec dashboard-php-web-1 php -l /var/www/html/handlers/xxx.php`
  （Git Bashからは `MSYS_NO_PATHCONV=1` を付けないとパスが化ける）

### 5-11. その他

- `src/components/test.js` に既存のTSエラーが多数あるが、このセッションの変更とは無関係
- `Header.tsx` はセッション中にユーザー側でも編集されていた（月次日報のフルスクリーン対応の途中版）。最終的に本セッションの実装で置き換え済み
---
---

# 改修サマリー（2026-08-28 セッション）

ブランチ: `version2.2.104`
コミット: `44600cf fix backend php files and lead directry components` / `20ceecc fix lead components`
**未コミットの変更が残っている（後述「6. 引き継ぎ」参照）**

## 概要

大きく3つ。

1. **ポータル反響6本を `brokerage_listings` へ同期**（不動産CRMのリード）
2. **Summary.tsx の改修** — 「開く」→LeadEdit / ファネルのバグ修正 / KPIの実データ集計
3. **調査中に見つかった既存バグの修正** — HOME'S の重複INSERT、`inquiry_id` の接頭辞、楽観的更新の履歴取りこぼし

---

## 1. ポータル同期 → `brokerage_listings`

各ポータルのハンドラは、これまで `inquiry_customer_resale`（反響顧客）にしか同期していなかった。
そこへ不動産CRMのリード（`brokerage_listings`）への同期を追加した。

| ポータル | 呼び出し元 | `kind` | `extId` |
|---|---|---|---|
| すまいステップ | `sumai_step_update.php` | `leads` | `sumai:{管理番号}` |
| イエウール | `ieuru_resale_update.php` | `leads` | `ieul:{依頼日}:{氏名}` |
| イエイ | `iei_resale_update.php` | `leads` | `iei:{受付日}:{姓名}` |
| アットホーム | `athome_resale_update.php` | `buyLeads` | `athome:{物件番号}:{日付}:{氏名}` |
| HOME'S | `homes_db_resale.php` | `buyLeads` | `homes:{問合せ番号}` |
| SUUMO | `suumo_db_resale.php` | `buyLeads` | `suumo:{連番}` |

### 全ポータル共通の設計方針

- **INSERT 専用。UPDATE しない。**
  取り込み後の `phase` / `staff` / `budget` / `note` は担当者が画面で編集するため、
  再取込のたびに上書きすると手入力が消える。
- **重複判定は `extId` の `NOT EXISTS`。**
  `brokerage_listings` の UNIQUE は `id` だけなので `INSERT IGNORE` では防げない。
- **POSTされた1件だけに絞る**（`WHERE id = :id`）。
  従来は1件POSTごとに全表を再走査していた。**SUUMOだけは例外**（後述）。
- `phase` / `staff` は入れない（空欄＝画面上の「リード受信」・未割当）。
- `$data['id']` 等が空なら `error_log` を出して同期をスキップする。

### 採番ルール（新規 `backend/src/core/brokerage_id.php`）

`brokerage_listings.id` はアプリ（フロント）と同じ書式で作る。実データ1,259件から逆算し、
後に `source.html`（元HTML版）の実装と完全一致することを確認した。

```
x  msh5mr0p  69sck  125
|  |         |      +-- 連番（一括生成時のループ添字）
|  |         +--------- ランダム5桁（36進）
|  +------------------- Date.now().toString(36)（8桁のミリ秒）
+---------------------- リテラルの 'x'
```

```js
// source.html:4801 の元実装
function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,7) + (_uid++) }
```

- `base_convert()` は 2^53 超で精度が落ちるため自前で除算している
- ランダムは `random_int()`（衝突耐性が id の一意性そのもの）
- **id がランダムなので、重複取込を防いでいるのは各ハンドラの `NOT EXISTS` のみ**
  → 保険として `brokerage_listings.extId` に UNIQUE を追加した（後述）

### `source` / `portal` の規約（重要）

**売りと買いで使うカラムもマスタ語彙も違う。**

| | `source` | `portal` |
|---|---|---|
| 売りリード（`leads`） | 反響元（`sources` マスタ） | NULL |
| 買いリード（`buyLeads`） | 同上（横断集計用） | ポータル名（`buyPortals` マスタ） |

- `portal` は **広告費 `portalCosts` の引き当てキー**。空だと反響費用が0になる
- `source` は売り・買いを横断した媒体キー。媒体別集計で合流させるためのもの

**注意: HOME'S は表記が2種類ある。取り違えると集計が割れる。**

```
売り(sources マスタ)     ... HOME's   小文字s
買い(buyPortals マスタ)  ... HOME'S   大文字S
```

`homes_resale.php` は `portal` に大文字S（portalCostsのキー）、
`source` に小文字s（売り31件と合流）と**意図的に使い分けている**。

### ポータル別の個別事情

#### すまいステップ
- `sumai_step_db` に `id IS NULL` のゴミ行が30件（CSVの改行入りフィールドでパース崩壊）。除外必須
- `note` 書式 `{査定理由}／売却希望:{時期}／査定書:{状態}` + `opinion` を改行追記
- `reason` は複数選択が区切り無しで連結されて届く（例「住み替え金銭的な理由のため」）

#### イエウール
- **既存437件は `ieul:{7桁の依頼番号}` だが、この番号はGASが抽出しておらず `ieuru_resale` のどこにも無い**
  （全100件の remarks を既存437件の番号と総当たりして一致0件を確認）
- そのため `ieul:{依頼日}:{氏名}` の新形式にし、**重複判定は「氏名＋反響日」**で行う（B案）
- 日付は `requestDate`（依頼日時）基準。`registered` 基準だと既存との一致が88→72件に落ちる

#### イエイ
- **最大の罠。既存の売りリードは `anken:{案件番号}` で31件ある**（`iei:` は0件）
  `iei:` が0件なのを見て「既存なし」と誤判断すると、**29件がまるごと二重登録される**
  （`iei_db` 29件のうち28件が氏名＋受付日で既存 `anken:` と一致。期間も完全一致）
- 案件番号も抽出されていないため、イエウールと同じく **`anken:` と `iei:` の両方に
  「氏名＋反響日」で突合**する
- 修正後は新規1件のみ（`榎田 富美代` は既存の反響日が07-31、`iei_db` は07-30 で1日ずれ）

#### アットホーム
- **`athome_resale_update.php` は email で突合して UPDATE し `ak_` の id を使い回す。**
  id を流用して `brokerage_listings.id` を作ると、同一人物の2件目の問合せが
  `uk_id` に阻まれて作られない
- `price` は `1,600万円` 形式 → `budget`（円）へ換算
- `tour_date_1`（第一希望日時）があれば `phase='内見予約'`。`viewDate` には入れない（確定日ではないため）
- 氏名が空の行はスキップ（extId を組み立てられず個人も特定できない）

#### HOME'S
- **`homes_db_resale` は同じ userId の行が大量に重複していた**（4,756行 / userId 38種、最大616行）
  原因は `homes_db_resale.php:40` が **別テーブル `homes_db_kaeru`** を見ていたこと（修正済み）
  → 同期SQLは必ず `ORDER BY no DESC LIMIT 1` で最新1行に絞る。
    複数行拾うと同じ extId・同じ採番IDで複数INSERTして `uk_id` 違反で500になる
- HOME'S は売り・買いの両方の反響がある。`homes_db_resale` は **買い（物件問合せ）**。
  売りの査定反響は別系統で `mikata:` 接頭辞・`kind='leads'` で31件既存

#### SUUMO
- **他5本と構造が違う。`runSuumoResale.ts` がCSV全件を500件ずつバルクPOSTする**
  1件スコープにする意味が無いので全件対象。
  **候補をSELECTしてPHP側で1行ずつINSERT**する（採番関数を行ごとに呼ぶ必要があるため）。
  連番ブロックがループ添字という本来の意味を持つ
- `received_at` は `2026/7/02 12:06:19`（**月が0埋めされない**）→ `%Y/%c/%e %H:%i:%s`
- 姓名が `last_name_kanji` にまとめて入る行がある（`first_name_kanji` が NULL）
- 電話が `phone_1/2/3` に3分割の行と `phone_1` に全部入る行が混在 → `CONCAT_WS('-')` で吸収
- `price_or_rent` は `3490万円`（**カンマ無し**）。他ポータルはカンマ有り

---

## 2. Summary.tsx の改修

### 2-1. タスク一覧の「開く」→ LeadEdit

- `handleOpenLead(id)` で元レコードを引き当て、`kind === 'buyLeads'` なら `'buy'`、
  それ以外は `'sell'` を `leadCategory` に渡す
- 保存は `saveBrokerageRecord` + `recordFieldChanges`（LeadSell と同じ楽観的更新）

### 2-2. 歩留まりファネルのバグ修正

`planner_summary.php` が返すのは **`lead` と `staff` の2キーだけ**で、`lead` に売り・買いが
`kind` 混在で入っている。しかしフロントは `response.data.buyLeads` を期待していた。

```js
if (response.data.buyLeads) setBuyLeads(...)  // ← 常に実行されない
```

結果 **買いファネルが常に0、売りファネルは買いを混ぜて数えていた**。取得時に `kind` で振り分けて解消。

### 2-3. KPIサマリーの実データ集計

`sellKpiSummary` / `buyKpiSummary` はハードコードされたモック値だった。
`source.html` の `leadKpi`(L8311) / `buyKpi`(L9671) / `renderDash`(L6068-6095) と**同一定義**で実装。

- **架電数は 📞架電のみ**（LINE・メールは除外）。かつ「対象月に受信したリード」ではなく
  **「対象月に行われた架電」**を全リードから数える
- 反響費用 = 対象月受信リードの単価合計。売りは `source`→`srcCosts`、買いは `portal`→`portalCosts`
- 月次目標 = `Σ settings.staff[].baikaiTarget ÷ 12`

**裏付け**: 2026-07 の集計が旧ハードコード値と一致（架電 `83`、費用 `872,300`、目標 `16`）。

そのため `planner_summary.php` に **`app_state.settings` を返す処理を追加**した。

### 2-4. 楽観的更新の履歴取りこぼし（LeadSell / LeadBuy）

```js
setLeads(prev => { snapshot = prev; return ...; });
const before = snapshot.find(...);   // ← React18では更新関数が次のレンダリングまで走らない
```

`before` が `undefined` になり **保存は成功するのに変更履歴だけ静かに残らない**。
クロージャの現在値から取る形に修正（`LeadOpportunity.tsx` は元から正しかった）。

---

## 3. 作成したファイル

| ファイル | 内容 |
|---|---|
| `backend/src/core/brokerage_id.php` | `brokerage_listings.id` の採番関数。**ポータル5本の依存先** |
| `backend-express/scripts/sql/2026-08-28_ieuru_inquiry_id_prefix.sql` | `inquiry_id` の接頭辞修正（100件改名） |
| `backend-express/scripts/sql/2026-08-28_brokerage_listings_unique_extid.sql` | `extId` に UNIQUE 追加 |
| `backend-express/scripts/sql/2026-08-28_homes_db_resale_dedupe.sql` | 重複4,718行の削除 |
| `backend-express/scripts/sql/2026-08-28_buyleads_backfill_source.sql` | `source`/`portal` の穴埋め（**v2**） |
| `backend-express/scripts/sql/reference_brokerage_source_by_extid.sql` | 媒体の判定・診断（参照専用） |

## 4. 修正した既存バグ

| 箇所 | 内容 |
|---|---|
| `homes_db_resale.php:40` | 重複チェックが別テーブル `homes_db_kaeru` を見ていた。両表に共通 userId は0件で判定が常に空振りし、GASが回るたびINSERTされ4,756行に膨張 |
| `portal/ieuru_resale.php` | `inquiry_id` が `CONCAT('iei_', id)`（イエイからのコピペ）。`ieuru_` に修正＋既存100件を改名 |
| `planner_summary.php` | `settings` を返していなかった（KPIの費用・目標が出せない） |
| `Summary.tsx` | 買いファネルが常に0 |
| `LeadSell.tsx` / `LeadBuy.tsx` | 変更履歴の取りこぼし |

## 5. テーブル変更

- `brokerage_listings` に **`UNIQUE KEY uk_extId (extId)`** を追加
  - 事前に空文字の `extId` 76件を NULL へ寄せている（NULLは重複可だが空文字は不可）
  - **注意: `broker_update.php` は UPSERT。UNIQUEキーが2本になると「idは新規だがextIdが既存と同じ」
    レコードで別の行が更新される。** 新規リードは `extId: null` で作られ、
    `broker_update.php` は空文字をNULL化するため現状のリスクは低い
- `homes_db_resale` の重複4,718行を削除（4,756 → 38行）

---

## 6. 引き継ぎ

### 6-1. 【要対応】未コミット・未デプロイの変更

```
M backend/src/handlers/portal/athome_resale.php   ← portal / source の追加
M backend/src/handlers/portal/homes_resale.php    ← portal / source の追加
M backend/src/handlers/portal/suumo_resale.php    ← portal / source の追加
M backend/src/handlers/portal/iei_resale.php      ← anken: との重複29件を防ぐ突合修正
?? backend-express/scripts/sql/2026-08-28_buyleads_backfill_source.sql   （v2に差し替え済み）
?? backend-express/scripts/sql/reference_brokerage_source_by_extid.sql
```

**本番には `portal` / `source` を入れる前のバージョンがデプロイされている。**
そのため本番の新規行は両方 NULL（例: `extId='suumo:0140243280'` / `portal=NULL` / `source=NULL`）。

**順序は「PHP再デプロイ → SQL実行」。** 逆だとその間の反響を取りこぼす。

### 6-2. SQLの適用状況

| ファイル | 本番 | ローカル |
|---|---|---|
| `2026-08-28_ieuru_inquiry_id_prefix.sql` | 実行済 | **未適用**（`iei_ie_` が100件残存） |
| `2026-08-28_brokerage_listings_unique_extid.sql` | 実行済 | 実行済 |
| `2026-08-28_homes_db_resale_dedupe.sql` | 未実行 | 実行済（38行） |
| `2026-08-28_buyleads_backfill_source.sql` | **未実行（v2で要実行）** | v1のみ適用 |
| `app_state.portalCosts` に `HOME'S` 追加 | 実行済 | 実行済 |

ローカルで動作確認する際、`ieuru_inquiry_id_prefix.sql` が未適用だと
`inquiry_customer_resale` に `iei_ie_` と `ieuru_` が混在してイエウール同期で重複が出る。

### 6-3. `buyleads_backfill_source.sql` は v2 に差し替え済み

v1 は `WHERE portal IN (...)` を条件にしていたため、**`portal` もNULLの行を1件も拾えなかった**。
v2 は **`extId` の接頭辞を第一の判定材料**にし、`portal` はフォールバックに降格。`portal` も一緒に埋める。

検証: 本番と同じ状況を再現して実行 → 残る未判定は21件のみ（すべて `extId` を持たない手入力レコード）。

### 6-4. extId 接頭辞と媒体の対応

```
ieul   → イエウール      (売り)
sumai  → すまいステップ   (売り)
anken  → イエイ          (売り) ← 旧形式。案件番号
iei    → イエイ          (売り) ← 新形式。受付日:姓名
mikata → HOME's         (売り) ← 売却査定の反響
athome → アットホーム     (買い)
suumo  → SUUMO          (買い)
homes  → HOME'S         (買い) ← 物件問合せ
```

**`id` からは媒体を判定できない**（アプリ採番のランダム値）。診断は
`reference_brokerage_source_by_extid.sql` を使う。

売り/買いの見分けは埋まっている列で判断できる。
- 売り ... `addr`(物件住所) / `visitDate`(訪問査定日) / `reason`(売却理由)
- 買い ... `targetProperty`(希望物件) / `budget`(予算) / `viewDate`(内見日)

### 6-5. GASの抽出バグ（PHP側では直せない）

値が空のとき正規表現が**次の項目のラベルを拾う**。汚染された項目はマッピングに使っていない。

**イエイ** — `extractBracket` の後読みが空欄で誤マッチ。**ユーザー修正済み**
（`if (/^[［▼]/.test(value)) return "";` を追加）。修正後は `賃料`・`ご要望など`・
`土地面積`・`建物(専有)面積`・`築年` が取れるようになるので、**取り込み項目を増やすか要検討**。

**イエウール** — 未修正。100件中の汚染件数:
```
requestsToCompany 100 / replacementFlag 100 / buildingName 100 / totalFloorArea 100
comment 88 / mansionName 72 / roomNumber 72 / exclusiveArea 72
assessmentMethod 31 / preferredContactTime 30 / buildingArea 34 / landArea 28
```

### 6-6. 未対応・要相談

- **`app_state` に書き込むAPI・画面が無い**。`portalCosts` / `srcCosts` / 担当者目標を
  変更するには毎回SQLが必要。`source.html` の設定画面は **Supabase 保存**なのでMariaDBに届かない
  - 案A（軽い）: `app_state` の読み書きAPIを足し、「反響単価設定」だけの画面を作る
  - 案B（本格）: `source.html` の `renderSettings`(L12476-12920 約450行) 相当を移植
- `Summary.tsx` の `kpiSummaryData`（担当者別KPI・L285付近）と `callStatsData` は**まだモック値**
- ラベル「反響合計(未同期)」の件（前セッション 5-7）は未着手

### 6-7. 参照した資料

`C:\Users\shinji-kawano\Downloads\source.html`（15,723行）が **React版の移植元**。
KPIやフェーズ定義で迷ったらここが正。ただし**保存先はSupabase**でMariaDBとは別系統。

```
L4801  uid()          ... brokerage_listings.id の採番
L6068  renderDash     ... KPIサマリーの集計と表示
L8311  leadKpi        ... 売りKPI
L9671  buyKpi         ... 買いKPI
L8299  LEAD_AFTER_*   ... フェーズ定数
L12476 renderSettings ... 設定画面（反響単価・担当者目標）
```

### 6-8. 検証状況

| 項目 | 状態 |
|---|---|
| `php -l`（変更した全PHP） | 通過 |
| `tsc --noEmit` | 通過（`src/components/test.js` の既存エラーは無関係） |
| 本番ビルド | 通過。`Summary.tsx` の警告は `formatMan`・`deals` 未使用の2件で改修前から存在 |
| 6ポータルの同期 | **全て実データでエンドツーエンド検証。冪等性・extId重複0・id重複0・採番形式を確認** |
| 移行SQL4本 | トランザクション内で実行→結果確認→ロールバックまで実施 |
| **ブラウザでの実表示** | **未確認**（Summaryの「開く」→LeadEdit、KPIサマリー、ファネル） |

初回同期で入る見込み: leads +41件（すまい2 / イエウール12 / イエイ**1**）、
buyLeads +63件（アットホーム4 / HOME'S 38 / SUUMO 21）。
※イエイは `anken:` 突合の修正により29件→1件に減っている
