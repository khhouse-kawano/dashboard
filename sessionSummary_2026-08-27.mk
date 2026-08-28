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