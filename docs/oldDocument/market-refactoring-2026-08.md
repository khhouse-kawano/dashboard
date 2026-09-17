# 市況分析（Market）改修まとめ

期間: 2026-08-26 〜 2026-08-27
本番反映: 完了・動作確認済み

---

## 1. 何をしたか

1,111行の単一ファイルだった `src/components/Market.tsx` を分割し、
e-Stat の公的統計と自社CRMを突き合わせて **商圏ごとのKHGシェア** を出す画面として作り直した。

あわせて、

- 画面が必要とするデータを返す **PHPハンドラ（新設）**
- e-Stat / CSV を取り込む **Node取り込みスクリプト（新設）**
- 対象テーブルの **構造変更SQL（新設）**

を整備し、本番DBを差し替えた。

---

## 2. 成果物

### フロントエンド — `src/components/market/`

| ファイル | 役割 |
|---|---|
| `types.ts` | 画面で扱う型とフィルタの定義 |
| `api.ts` | ゲートウェイへのPOSTとエラー整形 |
| `areaMatcher.ts` | 市区町村の表記ゆれ吸収（後述） |
| `chartTheme.ts` | 検証済みカラーパレット |
| `useMarketData.ts` | 4リクエストの取得 |
| `useMarketSummary.ts` | 一覧表の集計 |
| `useMarketDetail.ts` | モーダルの集計 |
| `MarketFilterBar.tsx` | 絞り込みUI |
| `MarketTable.tsx` | 商圏別の一覧表 |
| `MarketDetailModal.tsx` | 商圏詳細のグラフ |
| `README.md` | 構成の説明 |

`src/components/Market.tsx` は上記を組み立てるだけの薄い入口になった。

### バックエンド — `backend/src/`

| ファイル | 返すもの |
|---|---|
| `core/market.php` | 共通のSQL式・レスポンス整形・エラー整形 |
| `handlers/market_master.php` | 店舗 / 課 / 担当者 / 販促媒体 / 都道府県 / 対象月 / 対象年 |
| `handlers/market_area.php` | 人口 / 世帯数 / 世帯内訳 / 着工（月次・年次） |
| `handlers/market_response.php` | 反響・来場・契約（`master_data` 系から**参照のみ**） |
| `handlers/market_construction.php` | KHGの着工棟数（注文 / 建売） |

計5本。`master_data` / `master_data_kaeru` は最後まで**一切変更していない**。

### データ整備 — `backend-express/scripts/`

構造変更SQL（`scripts/sql/`）

- `2026-08-26_market_construction.sql` … `contract_customer`, `kaeru_building`
- `2026-08-27_population.sql`
- `2026-08-27_households.sql`
- `2026-08-27_households_c.sql`
- `2026-08-27_building_monthly.sql`
- `2026-08-27_building_yearly.sql`

いずれも **DROPせず `_backup_<日付>` にリネームして退避** する方式。

取り込みスクリプト

- `lib/csv.mjs` … RFC4180パーサ、日付正規化、警告収集
- `import-population-csv.mjs` / `import-households-csv.mjs` / `import-households-c-csv.mjs`
- `import-building-csv.mjs` … 着工（月次）
- `import-estat-building-yearly.mjs` … 着工（年次、e-Stat API直取得）
- `import-construction-csv.mjs` / `import-kaeru-csv.mjs` … 自社データ
- `estat-discover.mjs` … e-Stat の統計表を探すための調査用
- `export-market-tables.mjs` … 本番適用SQLの書き出し

---

## 3. つまずいた点と対処

技術的に非自明だったものだけ残す。

### 3-1. 郡と町の二重計上

佐賀県 2025-10 の持家着工が **157**（正しくは 132）になっていた。
e-Stat は「〇〇郡」の行と、その配下の「〇〇町」の行を**両方**返す。
単純合計すると郡の分だけ重複する。

→ `isDistrict` フラグを立て、県計の合計から除外。

### 3-2. 政令市の区でも同じ問題

熊本県 2026-06 が **481**（正しくは 303）。今度は「熊本市」と「熊本市中央区」。

→ `isWard` フラグを追加。

### 3-3. 市区町村の表記が3テーブルで揃わない

世帯数の列が常に `-` だった。同じ自治体が次の4通りで書かれていた。

```
姶良郡湧水町 / 湧水町 / 熊本市中央区 / 熊本市　中央区（全角スペース）
```

→ 郡・政令市の接頭辞を落とした `areaKey` を SQL 側で生成し、それで突合。

### 3-4. シェアが59%に膨らんでいた

分子（自社契約）が全期間、分母（e-Stat着工）が10か月分だった。

→ 期間の初期値を e-Stat のデータ範囲に合わせる。実測 **10.3%** に是正。

### 3-5. e-Stat のカテゴリコードが2024年に変わった

利用関係別のコードが 2023年以前は `11`、2024年以降は `10`。
片方だけ指定すると年次データが途中で切れる。

→ 両方をリクエストして統合。

### 3-6. `cdTime` を省くと最新年しか返らない

e-Stat API は時間軸コードを明示しないと最新1時点だけを返す。経年比較には明示が必須。

### 3-7. 世帯数に新旧2世代が混在（190行 / 実体100件）

CSVに国勢調査の2世代が積まれていた。

→ 先勝ちで1件に寄せ、`(pref, area)` に UNIQUE 制約を付けて再発を防止。

### 3-8. 本番の HTTP 500 が読めなかった

`https://khg-marketing.info/dashboard/api/gateway/` が500を返した。
原因はDBのテーブル未適用だったが、**axios が 500 で reject するため、
サーバーが返した日本語メッセージが握り潰され**「Request failed with status code 500」
としか出ていなかった。

→ 二段で対処。

- `core/market.php` に `marketFail()` を追加。詳細は `error_log` にのみ出し、
  クライアントには SQLSTATE 別のヒントを返す
  （例: `42S02` → 「テーブルがありません。マイグレーションSQLが未適用の可能性があります。」）
- `api.ts` で `error.response.data.message` を拾い直して再throw

---

## 4. 設計上の決めごと

### 注文と建売でデータソースを分けた理由

| | ソース | 理由 |
|---|---|---|
| 注文 | `contract_customer` | 契約→着工の順なので着工日の充足率94% |
| 建売 | `kaeru_building` | 着工→完成→販売の順。未販売物件は契約者一覧に存在せず、着工日の充足率が11.7%しかない |

統合は断念し、用途ごとに使い分ける形にした。

### 除外条件

- 注文: `status = '解約'` を除外
- 建売: `sales_status = 'キャンセル'` と `category = '中古'`（中古再販）を除外。
  モデルハウスは実際に着工しているので**含める**

### 課・店舗の絞り込み

契約・着工データは店舗コードを持たず担当者名しか無いため、
`staff_list`（今年度の所属）を突合表にして担当者名で絞る。

突合率: 95.0% / 86.9% / 72.0%

### 世帯数は経年比較しない

国勢調査は5年おきで月次にも年次にも素直に載らない。
直近1時点のスナップショットとして扱い、期間フィルタの影響を受けない。

### 都道府県はハードコードしない

旧実装は5県を配列で持っていた。福岡県の追加時に丸ごと抜け落ちるため、
`population` テーブルから動的に取得する方式に変更した。
**新しい県は人口データを入れれば自動で選択肢に出る。**

### グラフ

`dataviz` の指針に沿ってパレットを検証（`validate_palette.js`）。
二軸禁止・カテゴリ8系列まで・凡例＋直接ラベル併記。

注文 `#2a78d6` / 建売 `#1baf7a` / ファネル `#2a78d6・#eb6834・#1baf7a`

---

## 5. 検証した数値

鹿児島県 2025-01〜2026-06（月次）

- 注文: 434 / 4,584 = **9.5%**
- 建売: 184 / 2,026 = **9.1%**

シェアの推移（年次）

| 2020 | 2021 | 2022 | 2023 | 2024 |
|---|---|---|---|---|
| 0.0% | 3.8% | 5.5% | 6.7% | 8.9% |

対象6県すべてで「県全域＝市区町村の合計」が一致することを確認済み。

---

## 6. 本番のテーブル

| テーブル | 行数 |
|---|---|
| `population` | 840 |
| `households` | 1,282 |
| `households_c` | 6,410 |
| `building` | 32,021 |
| `building_yearly` | 3,888 |
| `contract_customer` | 3,275 |
| `kaeru_building` | 1,880 |

対象県: 鹿児島 / 宮崎 / 大分 / 熊本 / 佐賀 / 福岡

---

## 7. 残件（今回は着手せず）

- `staff_list.section` の表記ゆれ
  （`鹿児島営業二課` ×2、`鹿児島営業三課` ×1、`大分・佐賀課` ×1）。
  突合率が数%落ちている原因。
- `src/utils/apiClient.ts` に Authorization トークンが直書きされている。
- `src/components/test.js` が構文エラーで壊れている（今回の改修前から。`tsc` のエラーはこれのみ）。
- e-Stat の月次 × 市区町村 × 利用関係別は **APIに存在しない** ことを確認済み。
  月次の粒度を上げたい場合は別の入手経路が必要。
