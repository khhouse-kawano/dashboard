# 市況分析（Market）

e-Stat の統計（人口・世帯数・建築着工）と自社CRMの実績を市区町村単位で突き合わせ、
商圏ごとの KHG シェアを出す画面。

## 構成

```
src/components/Market.tsx          エントリ。状態の保持と組み立てのみ
src/components/market/
  types.ts               型定義
  api.ts                 取得と数値への正規化
  areaMatcher.ts         住所 → 市区町村の解決
  useMarketData.ts       取得フック
  useMarketSummary.ts    集計（ここが本体）
  MarketFilterBar.tsx    絞り込み
  MarketTable.tsx        一覧表
  MarketDetailModal.tsx  商圏の詳細（グラフ＋AI分析）
```

サーバー側:

```
backend/src/core/market.php               共通SQL断片（area正規化・日付正規化）
backend/src/handlers/market_master.php    店舗・担当・媒体・県・期間
backend/src/handlers/market_area.php      population / households / households_c / building
backend/src/handlers/market_response.php  master_data + master_data_kaeru（参照のみ）
backend/src/handlers/market_construction.php  contract_customer + kaeru_building
```

## 押さえておくべき前提

### 1. area の表記がテーブルごとに違う

|                | 郡下の町         | 政令市の区         |
|----------------|------------------|--------------------|
| `population`   | `三養基郡基山町` | `熊本市中央区`     |
| `building`     | `基山町`         | `中央区`           |
| `households`   | `基山町`         | `熊本市中央区`     |
| `households_c` | `基山町`         | `熊本市　中央区`（全角スペース）|

そのままでは突合できないので、親（郡・政令市）の接頭辞を落とした `areaKey` を
サーバー側で全テーブルに持たせている（`marketAreaKeyExpr`）。
`三養基郡基山町` も `熊本市　中央区` も、それぞれ `基山町` `中央区` になる。

「南九州市」「いちき串木野市」のように市名の途中に市や郡を含むものを
削ってしまわないよう、末尾が町村区で終わる場合だけ接頭辞を外している。

### 2. 郡の行は県計に足してはいけない

郡の行は配下の町の行と数値が重複している。
佐賀県2025-10 の持家着工なら `三養基郡 12 = 基山町6 + 上峰町2 + みやき町4`。
県計は `isDistrict = false` の行だけを合計する（157 → 132）。

`population` と `households` には `area = '-'` の県全域行があるが、
`building` には無いため、建築着工の県計だけは足し上げで作っている。

### 3. 注文と建売で着工のデータソースが違う

統合できない。建売は「着工 → 完成 → 販売」の順に進むため、
契約者一覧には未販売の着工物件が構造上載らない
（`contract_customer` の建売行で着工日が入っているのは 11.7% のみ）。

- 注文 … `contract_customer`（契約者単位、着工日の充足率 94%）
- 建売 … `kaeru_building`（物件単位、着工日の充足率 82%）

### 4. ステップ項目のIDは2テーブルで意味が違う

| カラムID | `master_data` | `master_data_kaeru` |
|---|---|---|
| `…01J82Z5F1RR18Z792C7KZS88QG` | **契約日** | 申し込み日 |
| `…01JP74NGRTT95X4Z8AQZ2QK2PW` | 2回目以降面談 | **自社契約日** |

建売の「契約」は自社契約日を使う。仲介契約は e-Stat の分譲着工を分母にした
シェアの分子に対応しないため含めない。

### 5. 期間の既定値は e-Stat の着工データの範囲

KHG の着工実績は2017年〜将来の予定日まで入っているのに対し、
`building` は 2025-01〜2025-10 の10か月分しかない。
期間を無指定にすると分子だけ全期間・分母は10か月となり、
シェアが実態の数倍（鹿児島県で 59%）になってしまう。
初期値を `master.periods` の最初と最後に合わせている（同 10.3%）。

### 6. 課・店舗の絞り込みは担当者名で突合する

契約・着工のデータ（`contract_customer` / `kaeru_building`）は**店舗コードを持たず
担当者名しか無い**。そのため課や店舗で絞るときは、いったん担当者の集合に
読み替えてから突合する。

```
課 / 店舗 → staff_list（今年度）で該当する name の集合
          → contract_customer.staff / kaeru_building.staff
          → master_data.in_charge_user / master_data_kaeru.in_charge_user
```

`staff_list.period` は年度で、異動があるため「今年の所属」で見る。
今年のデータがまだ無い時期でも絞り込みが全滅しないよう、
今年以前で最も新しい年度にフォールバックする。

反響側も同じ担当者名で揃えているのが要点。
反響だけ `in_charge_store`（店舗）で絞ると、
「反響は店舗基準・着工は担当者基準」というちぐはぐな数字になる。

突合率は 反響95.0% / 注文着工86.9% / 建売着工72.0%。
残りは退職者や過去年度の担当者で、課・店舗を選ぶと集計から外れる。

### 7. 人口・世帯数は経年比較しない

`population` / `households` / `households_c` は**直近1時点のスナップショット**として扱う。
期間セレクタを動かしても値は変わらない。

国勢調査は5年おきで、月次にも年次にも素直に載らないため。
一覧の「人口計」「世帯数」列と、詳細の世代別人口・世帯数内訳グラフは
すべて期間フィルタの影響を受けない。画面にも注記を出している。

### 8. 月次と年次で着工テーブルが別

e-Stat には**「月次 × 市区町村（町村含む）× 利用関係別」の統計表が存在しない**。
API を総当たりで調べた結果は次のとおり。

| 統計表 | 月次 | 市区町村 | 利用関係別 | 制約 |
|---|---|---|---|---|
| `0003114496` | ○ | × 都道府県のみ | ○ | — |
| `0003114535` | ○ | △ 市部のみ | ○ | 2011-10〜2024-09 |
| `0004018780` | ○ | ○ 2,243件 | × 構造別 | 床面積のみ・戸数なし |
| **`0003114522`** | × 年次 | **○ 2,324件** | **○** | **2011〜2024** |

そこで2テーブルを併せ持ち、画面で切り替える。

- `building`（月次・2025-01〜2026-06）… CSV から取り込む。**既定はこちら**
- `building_yearly`（年次・2011〜2024）… API から取り込む。着工シェアの長期推移を見る

月次は API で代替できないため、今後も CSV での更新が必要。

### 郡と区は県計から必ず外す

どちらも他の行と数値が重なっている。

| | 重複の向き | 例 |
|---|---|---|
| 郡 | 配下の町村と重複 | 佐賀県2025-10 `三養基郡12 = 基山町6 + 上峰町2 + みやき町4` |
| 区 | 属する市と重複 | 熊本県2026-06 `熊本市128 = 中央区12+東区40+西区13+南区31+北区32` |

除外しないと熊本県2026-06 の持家が 481 になる（正しくは 303）。
サーバー側で `isDistrict` / `isWard` を立てて返し、`useMarketSummary` で除外している。

※ 東京23区は市に属さない特別区のため、対象県を関東に広げるときは
この除外ロジックを見直すこと。

年次側には e-Stat の県全域行（`area = '-'`）があるため、県計を足し上げで作る必要がない。
月次側には無いので、従来どおり郡を除いた市区町村の合計で県計を作る。
この分岐は `useMarketSummary` の `hasTotalRow` で判定している。

**年次では反響・来場・契約の列がほぼ0になる。**
自社CRMの反響取得日は2025年以降が実質すべて（2025年13,057件・2026年7,799件に対し、
2024年以前は305件）で、e-Stat の年次着工が2024年までのため、両者が重ならない。
画面にも注記を出している。

## 対象の都道府県を増やすとき

**都道府県の選択肢は `population` を基準にしている。**
市況表の1行は人口データで作るため、人口が無い県は行そのものが作れない。
`market_master.php` の `prefs` も `market_area.php` の絞り込みも
`SELECT DISTINCT pref FROM population` を見ている。

現在の対象は **鹿児島・宮崎・大分・熊本・佐賀・福岡** の6県。

`building` / `households` / `households_c` は全国47都道府県ぶん入っているが、
`population` を6県に絞ることで選択肢を制御している。
自社の営業実績が無い県まで選択肢に並ぶと、空の表を開くことになるため。

### 手順

1. `import-population-csv.mjs` の `TARGET_PREFS` に県を足す
   （その場かぎりなら `--prefs 鹿児島県,宮崎県,…` でも指定できる）
2. 人口を取り込み直す
   ```bash
   node scripts/import-population-csv.mjs "population_all.csv"
   ```
3. **年次の着工を取り込み直す**
   ```bash
   node --env-file=.env scripts/import-estat-building-yearly.mjs
   ```
   対象県を `population` から決めているので、この再実行で新しい県の年次が入る。
   忘れると年次表示にしたときだけエリア着工が0になる。

`building`（月次）と `households` / `households_c` は全国ぶん入っているので、
CSVを取り直す必要はない。

## 既知の制約

| 内容 | 影響 | 解消時期 |
|---|---|---|
| 年次の着工が 2024 まで | 2025年以降は月次でしか見られない | e-Stat の次回更新 |
| 年次では反響列がほぼ0 | CRMが2025年〜、e-Stat年次が2024年までで重ならない | — |
| 世帯数が主要市町村のみ（鹿児島県で21/52） | 小さな町村の行は世帯数が `-` になる | 国勢調査の収録範囲による |
| 総人口と5歳階級の合計が一致しない | 年齢不詳が総人口にのみ含まれる。一覧の「人口計」は公表値の総人口を出す | 元データの仕様 |
| 反響住所の10.7%が市区町村を特定できない | 県外・住所未入力が主。県計にも入らない | — |
| `staff_list.section` に表記ゆれが4名分ある | `鹿児島営業二課`(2) `鹿児島営業三課`(1) `大分・佐賀課`(1) は `section_list` の正式名と一致せず、課で絞ると漏れる | マスタ側の修正待ち |
| API の Authorization がフロントに直書き | ビルド成果物から読める | サーバー認証の見直し時 |

人口・世帯数を経年で見られない点は**制約ではなく仕様**。上の「6.」を参照。

### e-Stat の API で取得できなかったもの

次の3つは API に該当する統計表が無い。

1. **住宅着工 市区町村別・利用関係別（月次）** — 上表のとおり存在しない。
   → CSV（`building_all.csv` 形式）で取り込む。今後も CSV 更新が必要
2. **人口 5歳階級・男女別（市区町村・経年）** — 住民基本台帳の年齢階級別はAPI非対応。
   `0000020101`（市区町村データ基礎データ、1980〜2024・3,818地域）は年齢区分が
   `15歳未満 / 15〜64 / 65歳以上` と不規則で5歳階級が無い。
   → 経年比較しない方針のため、現行のスナップショットのままでよい
3. **国勢調査 住宅の建て方 × 家族類型（市区町村）** — `0003445143` は
   全国／都道府県／21大都市／人口50万以上の市どまりで町村が無い。
   → 経年比較はしないが、町村の欠損を埋めるため Excel があれば取り込みたい

### `kaeru_building.use_code` の扱い

スプレッドシートに凡例が無いため、実データからの推定で分類している。
`use_code` 列に生値を残してあるので、定義が変わっても
`import-kaeru-csv.mjs` のマッピングを直すだけで見直せる。

| コード | 件数 | 内容 | 建売着工に含めるか |
|---|---|---|---|
| `0` | 1,617 | 建売（主力） | 含める |
| `1` | 74 | 建売（1500〜1800万円帯） | 含める |
| `2` | 95 | 建売（3000万円台） | 含める |
| `3` | 70 | 注文系モデルハウス（`S×L平屋` `H川上` 等） | **含める**（2026-08-27 確認済み） |
| `4` | 9 | 中古再販（物件名に「中古」） | **除外**（新設着工ではないため） |
| `5` | 2 | 建売 | 含める |

## データの取り込み

```bash
cd backend-express

# 1. テーブル定義（既存は _backup_20260826 に退避される）
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db \
  < scripts/sql/2026-08-26_market_construction.sql

# 2. 注文（受注完工【KHG】）
node scripts/import-construction-csv.mjs "<CSV>" --dry-run
node scripts/import-construction-csv.mjs "<CSV>"

# 3. 建売（かえるホーム工程表）
node scripts/import-kaeru-csv.mjs "<CSV>" --dry-run
node scripts/import-kaeru-csv.mjs "<CSV>"

# 4. 建築着工の月次（CSV。全都道府県・2025-01〜2026-06）
#    既存の building は _backup_20260827 に退避される
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db \
  < scripts/sql/2026-08-27_building_monthly.sql
node scripts/import-building-csv.mjs "building_all.csv" --dry-run
node scripts/import-building-csv.mjs "building_all.csv"

# 5. 人口（CSV。対象6県のみ取り込む）
#    既存の population は _backup_20260827 に退避される
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db   < scripts/sql/2026-08-27_population.sql
node scripts/import-population-csv.mjs "population_all.csv" --dry-run
node scripts/import-population-csv.mjs "population_all.csv"

# 6. 世帯総数・世帯構成（CSV。全都道府県 1,282地域）
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db \
  < scripts/sql/2026-08-27_households.sql
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db \
  < scripts/sql/2026-08-27_households_c.sql
node scripts/import-households-csv.mjs   "households_all.csv"
node scripts/import-households-c-csv.mjs "households_c_all.csv"

# 7. e-Stat の年次着工（2011〜2024）
#    ※ population の対象県を変えたら必ず実行し直すこと
#    ESTAT_APP_ID を backend-express/.env に設定しておくこと
docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db \
  < scripts/sql/2026-08-27_building_yearly.sql
node --env-file=.env scripts/import-estat-building-yearly.mjs --dry-run
node --env-file=.env scripts/import-estat-building-yearly.mjs
```

`import-estat-building-yearly.mjs` は UPSERT なので何度実行してもよい。
e-Stat が過去年を訂正したときも再実行で追随できる。
取り込み時に「県全域行の持家 ＝ 市区町村の合計（郡と政令市の区を除く）」を
検算して表示する。

統計表を探すときは `estat-discover.mjs` を使う。

```bash
node --env-file=.env scripts/estat-discover.mjs --keyword "住宅着工統計 市区町村"
node --env-file=.env scripts/estat-discover.mjs --meta 0003114522
```

どちらも全件入れ替え（TRUNCATE → INSERT）をトランザクションで囲む。
値の自動補正はせず、日付として読めない値は `NULL` にしたうえで警告に出す。
警告のサンプルには行番号・物件IDだけを出し、氏名や住所は出さない。
