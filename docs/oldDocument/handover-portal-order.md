# 引き継ぎ書：注文事業ポータル反響の取り込み移植（portal-app → sync + dashboard backend）

## 0. 最初に読むべき結論

**本番の `inquiry_customer` に大量の重複顧客が登録されている。原因は特定済み。**

- 原因：`inquiry_customer.inquiry_id` に UNIQUE キーが無いまま `INSERT IGNORE` を使っているため、実行のたびに全件が追加される
- 移植元の旧API は「1件ずつ POST → PHP 側で `SELECT ... WHERE inquiry_id = ?` により存在確認」していた。移植先はバルク投入＋UNIQUE キー依存に設計変更したが、**DDL が未適用**
- **重複データがあるため UNIQUE キーの ALTER が失敗する**という循環に陥っている
- → 対策案は「§5 重複問題」に記載。**PHP 側を存在確認方式に変更するのが最優先タスク**

---

## 1. 案件の目的

`C:\Users\shinji-kawano\projects\portal-app` にあった 4 本の Node.js スクレイピングスクリプトを、
`C:\Users\shinji-kawano\projects\sync`（TypeScript / Express）へ移植する。
あわせて受け皿となる API を `C:\Users\shinji-kawano\react\dashboard\backend`（PHP）に新規実装する。

| 移植元 | 移植先 | 対象ブランド |
|---|---|---|
| `reloadSuumo.js` | `src/services/runSuumoOrder.ts` | KH / DJH / Nagomi |
| `reloadHomes.js` | `src/services/runHomesOrder.ts` | KH / DJH / JH / PG HOUSE |
| `reloadTownlife.js` | `src/services/runTownlifeOrder.ts` | KH / DJH / Nagomi / PG HOUSE / JH |
| `reloadAllgrit.js` | `src/services/runAllgritOrder.ts` | KH / DJH |

※ `reloadMochiie.js` / `reloadTownlifeKhf.js` は今回の対象外。

---

## 2. アーキテクチャ（データフロー）

```
sync (TypeScript / Heroku)
  POST /api/portal  { targetTasks: ["suumo_order", ...] }
        |
        v
  portalService.ts   … タスク名 → run*Order() のディスパッチ
        |
        v
  run*Order.ts       … Playwright でスクレイピング → CSV パース → 店舗判定
        |
        |  POST https://khg-marketing.info/dashboard/api/gateway/
        |  { request: "suumo_db_order", data: [ ...500件ずつ... ] }
        v
dashboard backend (PHP / Xserver)
  src/index.php                     … request 名で handlers/<name>.php にルーティング
        |
        v
  handlers/<媒体>_db_order.php      … 生データを *_db へ upsert
        |
        v
  handlers/portal/<媒体>_order.php  … 1レコードを inquiry_customer 用に変換
        |
        v
  MySQL: suumo_db / homes_db / townlife_db / allGrit_db  (生データ)
         inquiry_customer                                 (注文事業の反響一覧)
```

### 旧構成との違い（重要）

| | 旧（portal-app → /api/*.php） | 新（sync → gateway） |
|---|---|---|
| 送信単位 | 1レコード = 1 POST | 500件バルク POST |
| 重複判定 | PHP が毎回 SELECT で存在確認 | UNIQUE キー + `INSERT IGNORE` に依存 |
| リトライ | なし | 最大3回（`postGateway.ts`） |

**この設計変更が重複の直接原因。** 旧 API のソースは §9 に要点を記載。

---

## 3. 実装済みファイル

### 3-1. sync（`c:\Users\shinji-kawano\projects\sync`）

**新規サービス**
```
src/services/runSuumoOrder.ts
src/services/runHomesOrder.ts
src/services/runTownlifeOrder.ts
src/services/runAllgritOrder.ts
```

**新規ユーティリティ**
```
src/utils/portalShopList.ts   … portal-app/shops.js を移植（402件）
                                 ※ 既存 shopList.ts とは別物。件数もブランド表記も違う
                                    （shopList.ts=384件/PGH、portalShopList.ts=402件/PG HOUSE）
                                    挙動を変えないため統合していない
src/utils/modelHouseList.ts   … portal-app/modelHouse.js を移植（HOME'S 来場予約の店舗判定用）
src/utils/portalCsv.ts        … SJIS読込 / CSVパース / 列マッピング / Excel装飾除去
src/utils/postGateway.ts      … 500件チャンク + リトライ送信
src/utils/portalPage.ts       … タイムアウト定数 / 0件判定 / ボタン検出 / closeBrowser
```

**リネーム（`git mv` 済み）**
```
portalKaeruService.ts    → portalService.ts
portalKaeruController.ts → portalController.ts
portalKaeruRoutes.ts     → portalRoutes.ts
```
`src/app.ts` は `/api/portal` を追加し、`/api/portal_kaeru` も互換で残している。

**portalService.ts に追加したタスク**
```ts
'suumo_order'    -> runSuumoOrder
'homes_order'    -> runHomesOrder
'townlife_order' -> runTownlifeOrder
'allgrit_order'  -> runAllgritOrder
```

### 3-2. dashboard backend（`c:\Users\shinji-kawano\react\dashboard\backend`）

```
src/core/bulk_upsert.php                 … 共通ヘルパー（新規ハンドラのみが利用）
src/handlers/suumo_db_order.php
src/handlers/homes_db_order.php
src/handlers/townlife_db_order.php
src/handlers/allgrit_db_order.php
src/handlers/portal/suumo_order.php      … inquiry_customer へのマッピング
src/handlers/portal/homes_order.php
src/handlers/portal/townlife_order.php
src/handlers/portal/allgrit_order.php
tools/ddl/portal_order_unique_keys.sql   … UNIQUE キー追加DDL（未適用）
```

**既存の PHP ファイルには一切手を入れていない。**
`filterAllowed` 等が既存ハンドラに重複しているが、影響範囲を抑えるため
新規ハンドラだけが `core/bulk_upsert.php` を使う構成にしてある。

すべて commit `b444585c` に含まれている（コミット名は無関係な "fix RankOrder.tsx"）。
**本番へは未デプロイ。** sync 実行時に gateway が 404 を返す状態。

---

## 4. マッピング仕様（旧API から復元・照合済み）

### 4-1. 共通

`inquiry_id` は媒体プレフィックス + 元ID の**単純連結（区切り文字なし）**。

| 媒体 | inquiry_id | medium / response_medium |
|---|---|---|
| SUUMO | `suumo` + id_suumo | `SUUMO` |
| HOME'S 問合せ | `homes` + id_homes | `HOME'S` |
| HOME'S 来場予約 | `homes_reserve` + 番号 | `HOME'S` |
| タウンライフ | `townlife` + id_townlife | `タウンライフ` |
| ALLGRIT | `allgrit` + id_allGrit（DJH接尾辞込み） | `ALLGRIT` |

### 4-2. 媒体別の差分

| | SUUMO | HOME'S | タウンライフ | ALLGRIT |
|---|---|---|---|---|
| `inquiry_date` | `date_suumo` そのまま | `explode(' ', date_homes)[0]` | `response_date_townlife` | `date_allGrit` |
| 氏名分割 | 分割済（sei/mei） | `explode(' ', ...)` **半角** | `explode('　', ...)` **全角** | sei/mei |
| カナ | sei_kana / mei_kana | 半角スペース分割 | 全角スペース分割 | 設定しない |
| `zip` | **登録しない** | `zip_homes` | `zip_townlife` | `zip_allGrit` |
| 住所 | `building` = `address1 + address3`<br>（**address2 は不使用**） | `building` = `address_homes` | `building` = `pref + city + address` | `building` = `address1_allGrit` |
| `area` | `place_suumo` | `place_homes` | `place_detail_townlife` | `pref + city` |

### 4-3. ALLGRIT のブランド接尾辞

旧 API `allGrit.php` の実装：
```php
$brand = strpos($shop_allGrit, "DJH") === false ? '' : 'DJH';
$id_allGrit = $id . $brand;   // $id = お客様LINEUID
```
同一 LINE UID が KH / DJH 両アカウントに現れて衝突するのを避けるための識別子。
本番データで裏付け済み（接尾辞なし 684件 / `DJH` 付き 142件）。
`portalAllgritId()` は二重付与を防ぐため冪等にしてある。

### 4-4. HOME'S の問合せ / 来場予約の分離

「問合せ番号」と「来場予約問合せ番号」は別採番のため、番号が偶然一致すると衝突する。
来場予約側は `homes_db.id_homes` に `reserve_` を付けて区別する（ユーザー承認済み）。

```
問合せメール  id_homes = '3196337'          inquiry_id = 'homes3196337'
来場予約      id_homes = 'reserve_3196337'  inquiry_id = 'homes_reserve3196337'
```

問合せメール側は ID 体系を変えていないため既存 1,417 件の移行は不要。
ただし**新方式の初回実行時のみ**、過去に `homes<番号>` として入っていた来場予約が
`homes_reserve<番号>` として新規登録され、一度だけ重複する（ユーザー了承済み）。

### 4-5. 実装しなかったもの（ユーザー指示）

旧 API にあった `duplicate` / `black_list` / `hp_campaign` の判定は**実装不要**との指示。
ただしタウンライフの `townlife_db.duplicate`（他媒体からの反響重複の記録）だけは実装している。
旧 API は `WHERE mail = ?` としていたが `townlife_db` に `mail` カラムは無く常に SQL エラーだったため、
`mail_townlife` に修正して有効化した（`portalTownlifeMarkDuplicates()`）。

---

## 5. 重複問題（最優先タスク）

### 5-1. 原因

1. **`inquiry_customer.inquiry_id` に UNIQUE キーが無い**
   `INSERT IGNORE` は無視する対象が無く、全件がそのまま挿入される
2. **SUUMO は毎回「前月1日から」の全期間を取得する**
   ```
   targetMonth = 前月（getMonth() をそのまま使用）、日 = "01"
   ```
   移植元も同じ挙動。旧 API は1件ずつ存在確認していたため問題にならなかったが、
   現状は**実行のたびに約1ヶ月分が丸ごと追加**される
3. **`postGateway.ts` のリトライが増幅する**
   axios タイムアウト60秒・最大3回。サーバーが挿入を完了した後にタイムアウトすると、
   同じ500件がもう一度挿入される。タウンライフは1件ごとに SELECT を走らせるため
   （500件で1,000クエリ）特に時間がかかりやすい

### 5-2. 対策案（推奨）

**PHP 側を旧 API と同じ「存在確認方式」に変更する。** UNIQUE キー無しでも重複しない。

```php
// チャンク単位で既存 inquiry_id を1クエリでまとめて取得
SELECT inquiry_id FROM inquiry_customer WHERE inquiry_id IN (?, ?, ...);
// 未登録のものだけ INSERT
```

- 旧 API（1件ずつ SELECT）より高速
- **DDL 不要のため、重複データを掃除する前に適用できる**（循環を断てる）
- `*_db` 側も同様に「既存IDを一括取得 → INSERT と UPDATE に振り分け」へ変更
- UNIQUE キーは重複整理後に**多重防御として後から追加**すれば安全

対象ファイル：`src/core/bulk_upsert.php` の `portalRunBulkImport()` / `portalInsertBatchIgnore()`

### 5-3. 重複データの掃除

`tools/ddl/portal_order_unique_keys.sql` に以下を用意済み。
- 手順1：重複の確認クエリ（5テーブル分）
- 手順2：同じキーのうち `id` が最大の行を残して削除する DELETE（コメントアウト状態）
- 手順3：UNIQUE キー追加の ALTER

**手順2の DELETE は実行前に必ずバックアップを取ること。**

### 5-4. `*_db` の存在チェックについて

旧 API は `WHERE id_suumo LIKE '%{$id}%'` という**部分一致**だった（`123` が `1234` にも誤マッチする）。
移植では**完全一致に修正**することでユーザー承認済み。存在確認方式に変えるときも完全一致を維持すること。

---

## 6. テーブル定義の要点

ローカル検証用のダンプ：`docker/mariadb/init/01_xs200571_kawano.sql`（約1GB）
起動中のコンテナ：`dashboard-mariadb-db-1`（`localhost:3307`）、`dashboard-php-web-1`（`localhost:8080`）

### 6-1. インデックス（現状）

```
suumo_db          PRIMARY KEY (id) のみ         ← id_suumo に UNIQUE なし
homes_db          PRIMARY KEY (id) のみ         ← id_homes に UNIQUE なし
townlife_db       PRIMARY KEY (id) のみ         ← id_townlife に UNIQUE なし
allGrit_db        PRIMARY KEY (id) のみ         ← id_allGrit に UNIQUE なし
inquiry_customer  PRIMARY KEY (id)
                  KEY idx_ic_pg_id (pg_id(768))
                  KEY idx_ic_response (response_medium(768))
                                                ← inquiry_id に UNIQUE なし ★問題の根源

参考：inquiry_customer_kaeru には UNIQUE KEY inquiry_id がある（かえる側は重複しない）
```

### 6-2. 注意点

- `*_db` のカラムはすべて `text` 型。UNIQUE を張るには接頭辞長が必要（DDL では 191 を指定）
- `*_db` に `shop` カラムは**無い**。TS が算出する `shop` は `inquiry_customer.shop` に直接入る
- `inquiry_customer` は多くのカラムが `text NOT NULL` かつ既定値なし。
  部分 INSERT が通っているのは sql_mode が非 strict のため。
  そのため `portalNormalizeRow()` は第2引数 `false` で呼び、空文字を NULL に変換していない
- `allGrit_db` には `kana_allGrit` / `reservation` カラムが無く、CSV に含まれていても保存されない
- 事業区分の対応：`inquiry_customer`=注文事業 / `inquiry_customer_kaeru`=建売分譲（spec, brand='かえる'） / `inquiry_customer_resale`=中古（used）

---

## 7. 未完了タスク（優先順）

1. **【最優先】重複の停止** — §5-2 の存在確認方式へ変更
2. **重複データの掃除** — §5-3
3. **本番デプロイ** — PHP 9ファイル。現状 gateway が 404 を返している
4. **UNIQUE キー追加** — 掃除完了後に多重防御として
5. **動作確認** — `POST /api/portal` に `{"targetTasks":["suumo_order"]}` で1媒体ずつ

### 判断待ちの項目

**(a) タウンライフの店舗判定 — 旧 API のバグをどう扱うか**
```js
// reloadTownlife.js
if (!record["response_date_townlife"] || record["shop"] === undefined) {
//   ^^^^^^^^^^^^^^^^^^^^^^^^^^ 本来は place_detail_townlife のはず
```
建設予定地詳細で店舗が確定していても、問合せ日時が空だと市区町村判定で上書きされる。
**TS では正しい挙動（詳細で当たればそれを採用）にしてある。** 旧挙動へ戻すべきか未確認。

**(b) タウンライフの引用符除去の範囲**
旧 JS は `.replace(/"/g, "")` で文字列中のすべての `"` を除去。
TS の `stripExcelFormula()` は前後のみ除去。住所の途中に `"` を含むデータで差が出る。

---

## 8. 検証済みの内容

### 8-1. JS ↔ TS の照合（完了）

**columnMapping は全5種が完全一致**（機械的に突き合わせ済み）

| 対象 | JS | TS | 結果 |
|---|---|---|---|
| SUUMO | 16項目 | 16項目 | 一致 |
| HOME'S 問合せ | 15項目 | 15項目 | 一致 |
| HOME'S 来場予約 | 13項目 | 13項目 | 一致 |
| タウンライフ | 26項目 | 26項目 | 一致 |
| ALLGRIT | 17項目 | 17項目 | 一致 |

加工・絞り込みロジックも一致を確認済み（日付整形、店舗判定の優先順位、
タウンライフの「取消処理されました」除外、ALLGRIT の取り込み条件と LINE登録日の当日上書き）。

**相違は §7 の (a)(b) の2点のみ。**

### 8-2. SQL の検証（完了）

ローカルコンテナで、生成される INSERT 文を実スキーマに対して `prepare` して検証済み（レコードは未投入）。
8クエリすべて通過。氏名分割・ID生成も期待どおり。

```
OK   suumo    -> suumo_db (17 cols)        OK   suumo    -> inquiry_customer (14 cols)
OK   homes    -> homes_db (16 cols)        OK   homes    -> inquiry_customer (15 cols)
OK   townlife -> townlife_db (26 cols)     OK   townlife -> inquiry_customer (15 cols)
OK   allgrit  -> allGrit_db (15 cols)      OK   allgrit  -> inquiry_customer (13 cols)
```

### 8-3. 未検証

- **本番 API へのエンドツーエンド疎通**（未デプロイのため 404）
- **ローカル DB への実投入**（検証DBを汚さないため prepare のみで留めている）

---

## 9. 旧 API の要点（参考）

旧 API のソースはこのリポジトリに存在しない（`khg-marketing.info/api/*.php` にのみある）。
ユーザーから提供された内容の要点を記録しておく。

```php
// 各媒体共通の流れ
// 1) *_db へ upsert
$stmt = $dbh->prepare("SELECT * FROM suumo_db WHERE id_suumo LIKE ?");
$stmt->execute(["%{$id_suumo}%"]);        // ← 部分一致（移植では完全一致に修正）
if ($stmt->rowCount() > 0) { UPDATE ... } else { INSERT ... }

// 2) inquiry_customer へ
$stmt = $dbh->prepare("SELECT * FROM inquiry_customer WHERE inquiry_id = ?");
$stmt->execute(["suumo" . $id_suumo]);
if ($stmt->rowCount() > 0) {
    // 既存 → 何もしない（'duplicate' を返して終了）★これが重複を防いでいた
} elseif (同じ mail が既存) {
    // duplicate カラムに "<shop> <medium> 重複" を記録して INSERT（今回は実装しない）
} else {
    // 通常 INSERT
}
```

---

## 10. 運用上の注意

### 10-1. セキュリティ（要対応）

**本番 DB の認証情報がチャット履歴に平文で残っている。**
ユーザーから共有された旧 API ソースに `xs200571_kawano` / パスワードが含まれていた。
実装ファイルには一切書き込んでいない（`core/db.php` の `getenv()` 方式を利用）が、
**当該 DB パスワードのローテーションを推奨済み。未対応。**

### 10-2. sync 側の `.env`

26キーを追加済み・設定済み（値の有無のみ確認、内容は未参照）。

```
SUUMO_ID_KH / DJH / NAGOMI                    + 各 _PASS
HOMES_ID_KH / DJH / JH / PGH                  + 各 _PASS
TOWNLIFE_ID_KH / DJH / NAGOMI / PGH / JH      + 各 _PASS
ALLGRIT_ORDER_ID / ALLGRIT_ORDER_PASS
```

**オールグリットだけキー名が異なる。** sync には既に「かえる」用の `ALLGRIT_ID` / `ALLGRIT_PASS`
（同じ `line-saas.auka.jp` の別アカウント）があり、上書きすると既存の `allGrit_kaeru` タスクが壊れる。
PG HOUSE のキー名は `PGH`。SUUMO には PG HOUSE ブランドが無いため `SUUMO_ID_PGH` は不要。

### 10-3. HOME'S 来場予約の 3 ブランド

DJH / JH / PG HOUSE は来場予約一覧にダウンロードボタンが存在しない（`検出したボタン=[]` を確認済み）。
機能が提供されていないと判断し、エラーではなくスキップ扱いにしてある。KH のみ取得できる。

### 10-4. 今セッションで実施した安全化リファクタリング

ユーザー依頼により、`portalService.ts` に載っている**GMAIL 認証以外**の 13 サービスを安全化した。

- **`browser.close()` が `finally` の外にあり、例外時に Chromium がリークしていた** のを全件修正
  （`runSuumoKaeru` / `runSuumoResale` / `runSuumoResaleSummary` / `runHomesSummary` /
  `runAtHomeSummary` / `runAllGritKaeru` の6本が該当。共通の `closeBrowser()` 経由に統一）
- モジュールスコープだった `errors` 配列を実行ごとに初期化（前回のエラーが次回に持ち越されていた）
- `runGeocode` / `runSumaiStep` の `sendErrorMail` が未 await だったのを修正
- `runHotlead` が例外を握りつぶしていたのをエラーメール通知に変更
- タイムアウトの延長と、0件・ボタン不在のスキップ化（`src/utils/portalPage.ts`）

**GMAIL 認証の 14 本（`runAtHomeKaeru` 等）には指示により手を付けていない。**

---

## 11. 作業ルール（CLAUDE.md より）

- 複雑なタスクや既存コードの改修は、**事前に変更計画を提示して承認を得てから**着手する
- 既存の動作するコードを、明示的な指示なくリファクタリングしない
- テストコードやドキュメントを確認なしに削除・変更・コメントアウトしない
- `.env` やクレデンシャルを含むファイルは読み書きしない
- 破壊的コマンド（`rm -rf`、DB削除など）は実行しない
- 応答は日本語、簡潔に
- TypeScript の型は厳密に、`any` の乱用を避ける
- エラーは握りつぶさず適切にログ出力する

---

## 12. 検証コマンド

```bash
# 型チェック（sync）
cd /c/Users/shinji-kawano/projects/sync && npx tsc --noEmit

# PHP 構文チェック（コンテナ経由）
cd /c/Users/shinji-kawano/react/dashboard/backend/src
docker exec -i dashboard-php-web-1 php -l < handlers/suumo_db_order.php

# スキーマ確認（1GBダンプから抽出）
cd /c/Users/shinji-kawano/react/dashboard/docker/mariadb/init
grep -nE "CREATE TABLE \`(suumo_db|townlife_db|homes_db|allGrit_db|inquiry_customer)\`" 01_xs200571_kawano.sql

# docker で PHP を実行するときは MSYS_NO_PATHCONV=1 を付ける（Git Bash のパス変換対策）
MSYS_NO_PATHCONV=1 docker exec dashboard-php-web-1 php /tmp/script.php
```
