# 指示（2026-09-18）　budget テーブルの店舗名を整理する

⚠️ 依頼:
> `正_修正済み.csv` をローカルの budget テーブルと差し替えてほしい
> かえる宮崎店→宮崎係 / かえる大分店→大分係 / かえる熊本店→熊本係 のマッピングで表記を修正
> かえる鹿児島店の行は鹿児島1係・2係・3係に案分（1行を3行にする。budget_value を3で割って四捨五入）
> 買い:中古リノベを use にしたら ShopTrendResale.tsx への影響が出るのでは

---

## 追加したファイル

| ディレクトリ | ファイル |
|---|---|
| `backend/scripts/sql/` | ⚠️ `2026-09-18_budget_kaeru_shop_to_section.sql` |
| `backend/scripts/sql/` | ⚠️ `2026-09-18_budget_resale_shop_to_use.sql` |
| `backend/scripts/sql/` | ⚠️ `2026-09-18_update_log_2.2.138.sql` |
| `docs/` | ⚠️ `deploy-v2.2.138.md` |

⚠️ ⚠️ **アプリケーションのコードは1行も変えていない。** ⚠️ **データだけの修正である。**

---

## ⚠️ なぜ必要だったか

⚠️ 建売の販促費は `budget.shop` に ⚠️ **「係」**（鹿児島1〜3係 / 宮崎係 / 大分係 / 熊本係 / 外販）
で入っているのが正。⚠️ ところが次の2種類が混ざっていた。

| 混ざっていたもの | 金額 | 何が起きていたか |
|---|---|---|
| ⚠️ **かえる◇◇店**（4店舗） | ⚠️ **¥17,334,445** | ⚠️ `shop_list` で `show_flag = 0` のため**画面の集計から落ちていた** |
| ⚠️ **買い:中古リノベ** | ⚠️ **¥2,350,309** | ⚠️ **中古の実費が建売の総額に乗っていた** |

⚠️⚠️ **その結果、同じ建売の2画面で総予算が食い違っていた。**

| | 修正前 | ⚠️ 修正後 |
|---|---|---|
| 店舗別広告費（ShopKaeru） | ¥301,241,610 | ⚠️ **¥298,891,204** |
| 販促媒体別広告費（CustomerKaeru） | ¥281,556,856 | ⚠️ **¥298,891,204** |
| ⚠️ **差** | ⚠️ **¥19,684,754** | ⚠️ **¥0** |

⚠️ ⚠️ **CustomerKaeru 側のバックエンドには「反響のある係の販促費だけ見る」という
`shop IN (SELECT in_charge_store FROM master_data_kaeru …)` が入っている**
（2026-09-16 の指示）。⚠️ **今回の整理で、この条件はもう1件も落としていない。**

---

## ⚠️ 作業1　CSV の取り込み

⚠️ `C:\Users\shinji-kawano\Downloads\正_修正済み.csv`（Claude デスクトップで修正したもの）を
⚠️ ローカルの `budget` と差し替えた。

### ⚠️ 踏んだ落とし穴

⚠️⚠️ **CSV が CRLF だった。**
⚠️ `LINES TERMINATED BY '\n'` だと行末の `\r` が残って ⚠️ **2行が1行に連結され、
30,773件のはずが 15,968件しか入らなかった。**
⚠️ ⚠️ **エラーは出ない。** ⚠️ 件数を数えて初めて気づける。

```sql
LOAD DATA LOCAL INFILE '/tmp/budget_new.csv'
INTO TABLE budget_new
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'          -- ⚠️ ここ
IGNORE 1 LINES
(@dummy, budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section);
```

⚠️ ⚠️ **1列目は空のインデックス列**なので `@dummy` で捨てる（`id` は AUTO_INCREMENT）。

⚠️⚠️ **物理行 30,773 に対して実レコードは 30,717。**
⚠️ `note` 欄に改行を含む行が56件あるためで、⚠️ **欠損ではない。**

### 手順

1. ⚠️ `mysqldump` でバックアップ（`scratchpad/budget_backup_20260918.sql`）
2. ⚠️ **`budget_new` という一時テーブルへ読み込んで検証**（⚠️ 本体はまだ触らない）
3. ⚠️ `RENAME TABLE budget TO budget_bk_20260918, budget_new TO budget;`

⚠️ ⚠️ **旧テーブルは `budget_bk_20260918` としてローカルに残してある。**

### 取り込み後

| | 旧 | ⚠️ 新 |
|---|---|---|
| 行数 | 30,693 | ⚠️ **30,717** |
| 総額 | ¥1,223,934,524 | ⚠️ **¥1,224,567,600** |

---

## ⚠️ 作業2　かえる◇◇店 を係へ寄せる

⚠️ ファイル: `backend/scripts/sql/2026-09-18_budget_kaeru_shop_to_section.sql`

```sql
START TRANSACTION;

UPDATE budget SET shop = '宮崎係' WHERE section = 'spec' AND shop = 'かえる宮崎店';
UPDATE budget SET shop = '大分係' WHERE section = 'spec' AND shop = 'かえる大分店';
UPDATE budget SET shop = '熊本係' WHERE section = 'spec' AND shop = 'かえる熊本店';

INSERT INTO budget
    (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT
    budget_period, '鹿児島2係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

INSERT INTO budget
    (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT
    budget_period, '鹿児島3係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

UPDATE budget
   SET shop = '鹿児島1係',
       budget_value = ROUND(budget_value / 3)
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

COMMIT;
```

### ⚠️ 気をつけた点

⚠️⚠️ **複製が先、書き換えが後。**
⚠️ 先に `UPDATE` で1係へ変えてしまうと、⚠️ **複製の `WHERE` に引っかからず金額が 1/3 になる。**

⚠️⚠️ **`section = 'spec'` を必ず付ける**（2026-09-18 の判断）。
⚠️ `use`（中古）と `order`（注文）にも「かえる◇◇店」の行が19件（¥600,368）あるが、
⚠️ **中古・注文の販促費が建売の係名になってしまう**ので触らない。

⚠️ ⚠️ **四捨五入の誤差は許容する**（指示）。⚠️ 総額が **−¥95** ずれた。

⚠️ `id` は AUTO_INCREMENT なので列に含めない。

### 結果

| 店舗 | 件数 | 金額 |
|---|---|---|
| 鹿児島3係 | 543 | ¥72,406,931 |
| 鹿児島1係 | 532 | ¥71,470,287 |
| 宮崎係 | 267 | ¥67,685,107 |
| 鹿児島2係 | 560 | ¥37,651,097 |
| 大分係 | 228 | ¥33,573,981 |
| 熊本係 | 158 | ¥16,103,801 |
| ⚠️ **買い:中古リノベ** | 55 | ⚠️ **¥2,350,309**（⚠️ この時点ではまだ残っている） |

---

## ⚠️ 作業3　買い:中古リノベ を中古へ移す

⚠️ ファイル: `backend/scripts/sql/2026-09-18_budget_resale_shop_to_use.sql`

```sql
START TRANSACTION;

UPDATE budget
   SET section = 'use',
       order_section = ''
 WHERE section = 'spec'
   AND shop = '買い:中古リノベ';

COMMIT;
```

### ⚠️ 事前に確認したこと（`ShopTrendResale.tsx` への影響）

⚠️ 依頼で ⚠️ **「ShopTrendResale.tsx への影響が出るのでは」**と指摘があったため調べた。

⚠️⚠️ **結論: コードの修正は不要だった。**

⚠️ `ShopTrendResale.tsx` は ⚠️ **`targetSection` を設定する UI を持っていない**
（⚠️ `setTargetSection('')` でリセットされるだけ）。そのため `utils/budgetFilter.ts` は
常に最後の分岐に入る。

```ts
export const budgetFilter = (object: any, targetSection: string, shop: string, index) => {
    let value;
    if (targetSection && targetSection !== 'all') {
        value = object.filter(item => index >= 1 ? item.shop === shop : item.order_section === targetSection)
    } else if (targetSection === 'all') {
        value = object.filter(item => index >= 1 ? item.order_section === shop : true)
    } else {
        value = object.filter(item => index >= 1 ? item.shop === shop : true)   // ⚠️ ここに入る
    }
    return value;
};
```

⚠️ ⚠️ **`shop` 名だけで突合しており、`section` も `order_section` も見ていない。**
⚠️ バックエンドが `section = 'use'` で絞る時点で対象に入るので、⚠️ **移せばそのまま正しい行に乗る。**

### ⚠️ ただし `order_section` は空にした

⚠️⚠️ **移す55件は `order_section` が `不動産営業1課`(54件) / `鹿児島営業1課`(1件) だった。**
⚠️ 一方 ⚠️ **既存の `use` 530件はすべて空**である。

⚠️ 揃えないと、⚠️ **今後 ShopTrendResale に課の絞り込みを足したときに
`budgetFilter` の `order_section` を見る分岐へ入り、この55件だけ挙動が変わる。**

### ⚠️ `'use'` であって `'used'` ではない

⚠️⚠️ **`section` の値は `'use'`。** ⚠️ `backend-express/src/features/shopTrend/queries.ts` の
`SECTION` にも `used: 'use'` と書いてある。⚠️ **間違えると1件も拾えない。**

### ⚠️ `response_medium` は 0 と 1 の両方を移した

⚠️ 事業の区分（建売か中古か）であって費目ではないため。

### 結果

| | 前 | ⚠️ 後 |
|---|---|---|
| ShopKaeru（建売） | ¥301,241,513 | ⚠️ **¥298,891,204** |
| CustomerKaeru（総反響） | ¥298,891,204 | ⚠️ **¥298,891,204** |
| ⚠️ **差** | ¥2,350,309 | ⚠️ **¥0** |
| 中古リノベ全体 | ¥30,586,708 | ⚠️ **¥30,750,741** |
| ⚠️ **買い:中古リノベ** | ¥1,284,466 | ⚠️ **¥3,541,275**（⚠️ **約2.8倍**） |
| `use` の `order_section` | 空530件＋課55件 | ⚠️ **空621件のみ** |

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ `use` / `order` に残る「かえる◇◇店」19件（¥600,368） | ⚠️ **指示で spec だけと決めた** |
| 2 | ⚠️ `order_section` が空の建売 353件（¥32,992,445） | ⚠️ **別の判断が要る**（課で絞ると消える既存の不具合） |
| 3 | ⚠️ `medium_kaeru` に無い媒体（¥5,719,305） | ⚠️ **「その他」行として出すかは未決** |
| 4 | ⚠️ `ShopTrendResale` の内訳に「中古住宅専門店」¥24,180,174 が出ない件 | ⚠️ **`originalShopArray` が3店舗の直書き。範囲外** |

---

## 検証

| 確認 | 結果 |
|---|---|
| 取り込んだ行数 | ⚠️ **30,717**（⚠️ note の改行56件を除いた実レコード数） |
| `section` の内訳 | order 27,232 / spec 2,955 / use 530（⚠️ 移動前） |
| ⚠️ `かえる` が spec に残っていないか | ⚠️ **0件** |
| ⚠️ `買い:中古リノベ` が spec に残っていないか | ⚠️ **0件** |
| ⚠️ 2画面の総額 | ⚠️ **一致（¥298,891,204）** |
| ⚠️ `use` の `order_section` | ⚠️ **621件すべて空** |
| `npm run build` | ⚠️ **成功** |

### ⚠️ 未実施

⚠️⚠️ **① 本番にはまだ流していない。** ⚠️ 手順書は `docs/deploy-v2.2.138.md`。
