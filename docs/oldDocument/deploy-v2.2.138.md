# v2.2.138 デプロイ手順（2026-09-18）

⚠️ **サーバーは2台ある。どちらで実行するか毎回確認すること。**

| 記号 | 何 | 場所 |
|---|---|---|
| ⚠️ **①** | レンタルサーバー（Xserver 共用） | `khg-marketing.info` / 本番DB・PHP・React |
| ⚠️ **②** | VPS | `162.43.5.127` / `api.khg-marketing.info` / Docker |

---

## リリース内容

| # | 内容 | 対象 |
|---|---|---|
| 1 | ⚠️ 架電状況のインサイドセールスに **PGH霧島店** を追加 | ⚠️ フロント |
| 2 | ⚠️ 同じ表の合計行を「熊本営業課」→ **「インサイドセールス全体」** | ⚠️ フロント |
| 3 | ⚠️ 建売の販促費の店舗名を **「係」に統一**（かえる◇◇店を廃止） | ⚠️ **① のDB** |
| 4 | ⚠️ `買い:中古リノベ` を建売から **中古へ移動** | ⚠️ **① のDB** |

⚠️⚠️ **② VPS の作業は無い。** ⚠️ **PHP の差し替えも無い。**
⚠️ 変更したのは ⚠️ **`frontend/src/components/CallStatusList.tsx` の1ファイルだけ**である
（⚠️ `git diff --name-only origin/production...HEAD` で確認済み。⚠️ 他は docs と version.ts）。

---

## ⚠️ 手順0　① で `budget` をエクスポートする

⚠️⚠️ **手順1と手順2は `budget` を書き換える。⚠️ 先に必ずバックアップを取ること。**

⚠️ phpMyAdmin →「エクスポート」→ `budget` テーブルを選択 → 実行。
⚠️ ⚠️ **ファイルを手元に保存してから次へ進む。**

### ⚠️ 実行前の件数を控える（① で実行）

```sql
SELECT shop, COUNT(*) AS c, SUM(budget_value) AS v
  FROM budget
 WHERE response_medium = 0 AND section = 'spec'
 GROUP BY shop
 ORDER BY v DESC;
```

⚠️ ローカルでの実行前は次のとおりだった（⚠️ **① は件数が違う可能性がある**）。

| 店舗 | 件数 | 金額 |
|---|---|---|
| 鹿児島3係 | 253 | ¥67,315,344 |
| 宮崎係 | 143 | ¥66,696,123 |
| 鹿児島1係 | 242 | ¥66,378,700 |
| 大分係 | 153 | ¥32,983,545 |
| 鹿児島2係 | 270 | ¥32,559,510 |
| 熊本係 | 140 | ¥15,623,634 |
| ⚠️ **かえる鹿児島店** | 290 | ⚠️ **¥15,274,858** |
| ⚠️ **買い:中古リノベ** | 55 | ⚠️ **¥2,350,309** |
| ⚠️ **かえる宮崎店** | 124 | ¥988,984 |
| ⚠️ **かえる大分店** | 75 | ¥590,436 |
| ⚠️ **かえる熊本店** | 18 | ¥480,167 |

---

## ⚠️ 手順1　① で「かえる◇◇店」を係へ寄せる

⚠️ ファイル: `backend/scripts/sql/2026-09-18_budget_kaeru_shop_to_section.sql`

⚠️ phpMyAdmin の「SQL」タブに ⚠️ **ファイルの中身をそのまま貼って実行**する。

### ⚠️ 何をしているか

```sql
UPDATE budget SET shop = '宮崎係' WHERE section = 'spec' AND shop = 'かえる宮崎店';
UPDATE budget SET shop = '大分係' WHERE section = 'spec' AND shop = 'かえる大分店';
UPDATE budget SET shop = '熊本係' WHERE section = 'spec' AND shop = 'かえる熊本店';

INSERT INTO budget (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT budget_period, '鹿児島2係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget WHERE section = 'spec' AND shop = 'かえる鹿児島店';

INSERT INTO budget (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT budget_period, '鹿児島3係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget WHERE section = 'spec' AND shop = 'かえる鹿児島店';

UPDATE budget SET shop = '鹿児島1係', budget_value = ROUND(budget_value / 3)
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';
```

⚠️⚠️ **順序が重要。** ⚠️ **複製が先、書き換えが後。**
⚠️ 逆順にすると1係へ変えた行が複製の対象から外れ、⚠️ **金額が 1/3 になる。**

⚠️⚠️ **`section = 'spec'` を必ず付けること。**
⚠️ `use`（中古）と `order`（注文）にも「かえる◇◇店」が 19件（¥600,368）あるが、
⚠️ **それらは触らない**（2026-09-18 の判断）。

⚠️ ⚠️ **四捨五入で総額が数十円ずれる。** ⚠️ ローカルでは **−¥95** だった。⚠️ **不具合ではない。**

---

## ⚠️ 手順2　① で「買い:中古リノベ」を中古へ移す

⚠️ ファイル: `backend/scripts/sql/2026-09-18_budget_resale_shop_to_use.sql`

```sql
UPDATE budget
   SET section = 'use',
       order_section = ''
 WHERE section = 'spec'
   AND shop = '買い:中古リノベ';
```

⚠️⚠️ **`'use'` である。⚠️ `'used'` ではない**（既存の全画面がこの値を見ている）。

⚠️⚠️ **`order_section` も空にすること。**
⚠️ 移す行は `不動産営業1課` / `鹿児島営業1課` が入っているが、
⚠️ **既存の `use` の行はすべて空**である。⚠️ 揃えないと将来の絞り込みで挙動が変わる。

⚠️ `response_medium` は ⚠️ **0 と 1 の両方を移す**（事業の区分であって費目ではない）。

---

## ⚠️ 手順3　① で結果を確認する

```sql
SELECT shop, COUNT(*) AS c, SUM(budget_value) AS v
  FROM budget
 WHERE response_medium = 0 AND section = 'spec'
 GROUP BY shop
 ORDER BY v DESC;
```

⚠️⚠️ **「係」以外が1件も出ないこと。**（鹿児島1〜3係 / 宮崎係 / 大分係 / 熊本係 / 外販）

⚠️ ローカルでの結果:

| 店舗 | 件数 | 金額 |
|---|---|---|
| 鹿児島3係 | 543 | ¥72,406,931 |
| 鹿児島1係 | 532 | ¥71,470,287 |
| 宮崎係 | 267 | ¥67,685,107 |
| 鹿児島2係 | 560 | ¥37,651,097 |
| 大分係 | 228 | ¥33,573,981 |
| 熊本係 | 158 | ¥16,103,801 |

```sql
SELECT COALESCE(NULLIF(order_section, ''), '(空)') AS os, COUNT(*) AS c
  FROM budget WHERE section = 'use' GROUP BY os;
```

⚠️⚠️ **`(空)` の1行だけになること。**

---

## 手順4　push → PR → `production`

```bash
git push origin v2.2.138
```

⚠️⚠️ **`git push origin HEAD:production` は使わないこと。** ⚠️ **必ず GitHub の PR でマージする。**

⚠️ PR を作って `production` へマージする。

---

## ⚠️ 手順5　① へフロントをアップロードする

⚠️ ビルド済み: `frontend/build/`

⚠️ FTP で ① の `dashboard/` 配下へアップロードする。

| 何 | 備考 |
|---|---|
| `index.html` | ⚠️ **必ず差し替える**（JSのハッシュが変わっている） |
| `static/js/` | ⚠️ 新しい `main.*.js` |
| `static/css/` | ⚠️ 新しい `main.*.css` |

⚠️ ⚠️ **② VPS の再ビルドは不要。** ⚠️ **PHP の差し替えも不要。**

---

## ⚠️ 手順6　① で update_log に追加する

⚠️ ファイル: `backend/scripts/sql/2026-09-18_update_log_2.2.138.sql`

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.138', '2026-09-18', '架電状況のインサイドセールスにPGH霧島店を追加。\r\n建売の販促費の店舗名を係に統一。');
```

⚠️⚠️ **`no` は AUTO_INCREMENT なので指定しない。**

---

## ⚠️ 手順7　動作確認

### 7-1　架電状況（⚠️ 今回のフロントの変更）

⚠️ 注文 → 架電状況 → 「インサイドセールス」を選ぶ。

| # | 確認 | 期待 |
|---|---|---|
| 1 | 先頭行の店舗名 | ⚠️ **「インサイドセールス全体」**（⚠️ 「熊本営業課」ではない） |
| 2 | 行の並び | ⚠️ **最後に「PGH霧島店」が出る** |
| 3 | 合計行 | ⚠️ **2行目以降の和になっている**（⚠️ PGH霧島店ぶんを含む） |
| 4 | 「担当を選択」で個人を選ぶ | ⚠️ **PGH霧島店の行も絞られる** |
| 5 | 他の店舗（KH鹿児島店など）を選ぶ | ⚠️ **何も変わっていない** |

### ⚠️ 7-2　建売の店舗別広告費（⚠️ **数字が大きく変わる**）

⚠️ 建売 → 店舗別広告費。

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **「かえる◇◇店」の行** | ⚠️ **消えている** |
| 2 | ⚠️ **「買い:中古リノベ」の行** | ⚠️ **消えている** |
| 3 | 鹿児島1〜3係の予算 | ⚠️ **増えている**（かえる鹿児島店を3等分した分） |
| 4 | 宮崎係・大分係・熊本係 | ⚠️ **増えている** |
| 5 | 総額 | ⚠️ **¥301,241,610 → ¥298,891,204**（⚠️ ローカルの値） |

### ⚠️ 7-3　建売の販促媒体別広告費（⚠️ **ここが今回の狙い**）

⚠️ 建売 → 販促媒体別広告費 → 「総反響」行の総予算。

⚠️⚠️ **店舗別広告費の総額と一致すること。**
⚠️ ⚠️ **2026-09-18 まで ¥19,684,756 ずれていた。**

### ⚠️ 7-4　中古の店舗別推移（⚠️ **数字が増える**）

⚠️ 中古 → 店舗別推移 → 「広告費を表示」。

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **中古リノベ全体** | ⚠️ **増えている**（ローカルでは ¥30,586,708 → ¥30,750,741） |
| 2 | ⚠️ **買い:中古リノベ** | ⚠️ **増えている**（ローカルでは ¥1,284,466 → ¥3,541,275。⚠️ **約2.8倍**） |
| 3 | 売り:ポータル | ⚠️ **変わらない** |

⚠️⚠️ **不具合ではない。** ⚠️ 中古の実費が建売に入っていたものを戻しただけである。

### 7-5　変わっていないことの確認

| # | 画面 | 期待 |
|---|---|---|
| 1 | ⚠️ 注文の店舗別広告費 | ⚠️ **何も変わらない**（`section = 'order'` は触っていない） |
| 2 | ⚠️ 注文の販促媒体別広告費 | ⚠️ **何も変わらない** |
| 3 | ⚠️ 予算シミュレーター | ⚠️ 注文は不変。⚠️ **建売は店舗名が係に変わる** |
| 4 | バージョン表示 | ⚠️ **2.2.138** |

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| ⚠️ **フロント** | ⚠️ 1つ前の `main.*.js` と `index.html` に戻す |
| ⚠️ **budget** | ⚠️ **手順0 でエクスポートした SQL を取り込み直す**（⚠️ 部分的な UPDATE では戻せない） |

⚠️⚠️ **手順1は「行を増やす」操作なので、同じ SQL を2回流すと鹿児島2係・3係が二重に入る。**
⚠️ ⚠️ **流し直すときは必ずエクスポートから復元してからにすること。**

---

## ⚠️ 今回入っていないもの（v2.2.138 の続き）

⚠️ 指示書（`ReadMeClaude.md`）の4件のうち、⚠️ **まだ1件も着手していない。**

| # | 内容 |
|---|---|
| 1 | ⚠️ `ListKaeru` / `ListOrder` / `ListResale` の `isBlack` の電話番号判定 |
| 2 | ⚠️ `EditBlackList.tsx` の SaaS 化 ＋ Express 化 |
| 3 | ⚠️ `ShopKaeru` / `CustomerKaeru` のセレクトタグの文言とエリア削除 |
| 4 | ⚠️ `CustomerKaeru` の「その他」行 |

⚠️ ⚠️ **4 について**: 手順1・2で総額が一致したため、⚠️ **「その他」行に入るのは
`medium_kaeru` に無い媒体だけ（ローカルで ¥5,719,305）**になった。

---

## ⚠️ 長期の宿題（v2.2.138 でも未着手）

| # | 内容 |
|---|---|
| 1 | ⚠️ **8サイトの `form/api/index.php` を `form-proxy.php` へ** — ⚠️ **最優先**（手順書は `docs/oldDocument/deploy-form-get.md`） |
| 2 | ⚠️ 8サイトの古い `index-*.js` 削除 / `form/.htaccess` 設置 |
| 3 | ⚠️ ① `khg-marketing.info/api/` の `index.php` へ差分反映 |
| 4 | ⚠️ **DBパスワードの変更** |
| 5 | ⚠️ `projects/sync` の `git push heroku main` |
| 6 | ⚠️ 建売の複数選択の媒体（`Instagram、Web検索` 等 約50件）の数え方 |
| 7 | ⚠️ `電話` `来店` `メール` `LINE`（約470件）を `medium_kaeru` に足すか |
| 8 | ⚠️ `ShopKaeru.tsx` に来場率・申込率・来場単価も足すか |
| 9 | ⚠️ 既に契約済みの935件・競合負けの582件の勝因/敗因をいつ埋めるか |
| 10 | ⚠️ **建売の `order_section` が空の 353件 / ¥32,992,445**（⚠️ 課で絞ると消える） |
| 11 | ⚠️ `use` に残る「かえる◇◇店」18件 / ¥560,368 |
| 12 | ⚠️ `ShopTrendResale` で「中古住宅専門店」¥24,180,174 が内訳の行に出ない |
