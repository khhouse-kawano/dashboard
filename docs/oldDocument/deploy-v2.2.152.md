# デプロイ手順 v2.2.152

⚠️ 中身は ⚠️ **1件**。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️⚠️ **SatBaseサマリーのトグルが別表に移る**（⚠️ **CSVを入れ替えても消えない**） | ⚠️ **② VPS** ＋ ⚠️ ① DB |
| 2 | 更新履歴に1行増える | ① DB |

⚠️⚠️ **② VPS の再ビルドが必要。**
⚠️ ⚠️ **DBの構造を変えます**（⚠️ **表の追加と、列の削除**）。

⚠️⚠️ **フロントのアップロードは版数表示のためだけ**（⚠️ 画面の中身は1行も変えていない）。

---

## ⚠️⚠️ 順序（⚠️ **いつもと逆**）

```
1. ② VPS（Express の再ビルド）    ← ⚠️⚠️ 必ず先
2. ① SQL（表の追加・値の移送・列の削除）
3. ① SQL（update_log）
4. ① フロント
```

⚠️⚠️ **② を先に上げること。**
⚠️ ⚠️ **先に SQL を流すと、旧コードが消えた列を読みに行って
⚠️ SatBaseサマリーが `Unknown column 'ad_posted'` で開かなくなる。**

⚠️ ⚠️ **逆に ② を先に上げても、SQL を流すまでの間は
⚠️ `satbase_property_flag` が無いので一覧が出ない。**
⚠️⚠️ **つまり手順1と手順2の間だけ、この画面は使えない。**
⚠️ ⚠️ **他の画面には影響しない。** ⚠️ 続けて流せば数分で済む。

---

## 手順1　【② VPS で実行】Express の再ビルド

⚠️ ⚠️ **`git pull` は使わないこと。** ⚠️ **必ず分岐エラーになる。**

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

⚠️ 起動確認:

```bash
dcp logs --tail 50 express-api
```

---

## 手順2　【① レンタルサーバーで実行】表を分ける（phpMyAdmin）

⚠️ ファイル: `backend/scripts/sql/2026-09-29_satbase_property_flag.sql`

⚠️⚠️ **上から順に、1つずつ流すこと。**

### ⚠️ 2-1　受け皿を作る

```sql
CREATE TABLE IF NOT EXISTS satbase_property_flag (
  property_id      INT(11)      NOT NULL,
  ad_posted        TINYINT(1)   NOT NULL DEFAULT 0,
  instagram_posted TINYINT(1)   NOT NULL DEFAULT 0,
  updated          DATETIME     DEFAULT NULL,
  updated_by       VARCHAR(128) DEFAULT NULL,
  PRIMARY KEY (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

⚠️ ⚠️ **列コメントは省いてある。** ⚠️ 全文はSQLファイルを使ってよい。

### ⚠️ 2-2　⚠️⚠️ **いまの値を移す（飛ばすと消える）**

```sql
INSERT INTO satbase_property_flag
  (property_id, ad_posted, instagram_posted, updated, updated_by)
SELECT property_id, ad_posted, instagram_posted, updated, updated_by
  FROM satbase_property
 WHERE ad_posted = 1
    OR instagram_posted = 1
    OR updated IS NOT NULL
ON DUPLICATE KEY UPDATE
  ad_posted        = VALUES(ad_posted),
  instagram_posted = VALUES(instagram_posted),
  updated          = VALUES(updated),
  updated_by       = VALUES(updated_by);
```

⚠️⚠️ **件数を確かめてから次へ進むこと。**

```sql
SELECT COUNT(*) FROM satbase_property_flag;
```

⚠️ ⚠️ **本番でトグルを付けた覚えがあるのに 0 件なら、そこで止めて相談すること。**

### ⚠️ 2-3　⚠️⚠️ **元の4列を落とす（戻せない）**

```sql
ALTER TABLE satbase_property
  DROP COLUMN ad_posted,
  DROP COLUMN instagram_posted,
  DROP COLUMN updated,
  DROP COLUMN updated_by;
```

---

## 手順3　【① レンタルサーバーで実行】SQL（phpMyAdmin）

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.152', '2026-09-29', 'SatBaseサマリーの広告出稿・Instagram投稿の状況を別表に分け、元データをCSVで入れ替えても消えないようにした。');
```

⚠️ ファイル: `backend/scripts/sql/2026-09-29_update_log_2.2.152.sql`

---

## 手順4　【あなたのPC（PowerShell）】フロント → ① へアップロード

| ファイル | |
|---|---|
| ⚠️ **`build/static/js/main.*.js`** | ⚠️ **`2.2.152` を含む** |
| `build/static/css/main.*.css` | ⚠️ **変わっていない**（一緒に上げてよい） |
| ⚠️ **`build/index.html`** | ⚠️⚠️ **必ず差し替える** |

⚠️⚠️ **ビルドはまだ行っていません。** ⚠️ **デプロイ前に `npm run build` を実行し、
⚠️ ハッシュを控えてください。**

---

## ⚠️ 手順5　動作確認

| # | やること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダー → 土地・物件管理 → SatBaseサマリー | ⚠️⚠️ **1,900行前後が出る** |
| 2 | ⚠️⚠️ **本番で前に付けたトグル** | ⚠️⚠️ **そのまま残っている** |
| 3 | ⚠️ 未操作の物件 | ⚠️ **両方オフ** |
| 4 | ⚠️ トグルを押す | ⚠️ **すぐ切り替わり、エラーが出ない** |
| 5 | ⚠️⚠️ **画面を開き直す** | ⚠️⚠️ **押した状態が残っている** |
| 6 | ⚠️ 表示項目 →「最終更新」「更新者」 | ⚠️⚠️ **いま押した日時と自分の名前** |
| 7 | ⚠️ 絞り込み「未出稿」 | ⚠️⚠️ **押していない物件が出る**（⚠️ 0件にならないこと） |
| 8 | バージョン表示 | ⚠️ **2.2.152** |

---

## ⚠️ これ以降のCSV取り込み

⚠️ ファイル: `backend/scripts/sql/2026-09-29_satbase_property_reload.sql`

```sql
DROP TABLE IF EXISTS satbase_property_new;
CREATE TABLE satbase_property_new LIKE satbase_property;
-- ⚠️ CSV を satbase_property_new に取り込む
-- ⚠️ SELECT COUNT(*) FROM satbase_property_new;  ← ⚠️ 1,900行前後を確認
RENAME TABLE
  satbase_property     TO satbase_property_old,
  satbase_property_new TO satbase_property;
-- ⚠️ 画面を見てから: DROP TABLE satbase_property_old;
```

⚠️⚠️ **`satbase_property_flag` には絶対に触らないこと。**
⚠️ ⚠️ **ローカルで入れ替えを試し、トグルが消えないことを確かめてあります。**

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| ⚠️ ② | ⚠️ `git checkout` で1つ前のコミットにして `dcp build` → `dcp up -d` |
| フロント | 1つ前の `main.*.js` と `index.html` |
| ⚠️⚠️ **落とした4列** | ⚠️⚠️ **戻すなら列を作り直して flag 表から書き戻す**（下） |
| `update_log` の行 | ⚠️ 残しておいてよい |

⚠️ 列を戻す場合:

```sql
ALTER TABLE satbase_property
  ADD COLUMN ad_posted        TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN instagram_posted TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN updated          DATETIME     DEFAULT NULL,
  ADD COLUMN updated_by       VARCHAR(128) DEFAULT NULL;

UPDATE satbase_property p
  JOIN satbase_property_flag f ON f.property_id = p.property_id
   SET p.ad_posted        = f.ad_posted,
       p.instagram_posted = f.instagram_posted,
       p.updated          = f.updated,
       p.updated_by       = f.updated_by;
```

⚠️ ⚠️ **flag 表は消さずに残すこと。** ⚠️ 値の元になる。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **手順2-2 を飛ばすと本番のトグルが全部消える。** ⚠️ **件数を見てから 2-3 へ進むこと** |
| 2 | ⚠️⚠️ **② を先に上げること。** ⚠️ 逆だと ⚠️ **SatBaseサマリーが開かなくなる** |
| 3 | ⚠️⚠️ **手順1と手順2の間だけ、この画面は使えない**（⚠️ 他の画面は無事） |
| 4 | ⚠️ ⚠️ **GASによる自動取り込みは今回入れていない**（⚠️ 取り込みは引き続き手でCSV） |
| 5 | ⚠️ ⚠️ **フロントは未ビルド。** ⚠️ デプロイ前に `npm run build` すること |
| 6 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |
| 7 | ⚠️⚠️ **MCP の説明文「既定の reaction」が古いまま**（持ち越し） |
