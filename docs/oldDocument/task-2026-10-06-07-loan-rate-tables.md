# 2026-10-06 住宅ローン金利の表を作る（v2.2.168）

## 依頼
- ReadMeClaude.md: funding-plan の「⑨ 銀行金利比較」の金利データ（金利データ.js）を Dashboard 側で持てないか（2次利用のため）
- 検討の結果、まず「必要なテーブルをローカルに作り、① 用の SQL を準備する」

## 前提（調査結果）
- 金融機関のサイトから金利を読み取る機能は ⚠️ **無い**。金利は HTML 内の配列 `LOANS`（33商品、基準日 `LN_ASOF_DEFAULT` = 2026-08-20）。
- `金利データ.js`（`window.KHG_RATE_FEED`）・配信URL・ファイル読込・一括貼り付けで上書きできる口があるが、どれも未使用。
- 計画書は保存時の金利を `funding_plan.loans`（JSON）に顧客ごとに持つ。⚠️ 後から金利が変わっても過去の計画書は動かない（守るべき性質）。

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | `version.ts` | `2.2.168` |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-06_update_log_2.2.168.sql` | update_log（ローカル no=264 で投入済み） |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-06_loan_rate.sql` | `loan_product` / `loan_rate` の CREATE TABLE |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-06_loan_rate_seed.sql` | 初期データ（⚠️ LOANS から機械生成） |
| `docs/` | ⚠️ 新規 `deploy-v2.2.168.md` | 手順書（⚠️ DB のみ。作業中） |

## 設計
- ⚠️ 列名は LOANS のキーと同じ（`g` `fi` `pn` `type` `feeMode` `feeVal` `hoshoVal` …）。funding_plan と同じ方針。`KHG_RATE_FEED` にそのまま渡せる。
- `loan_product`（PK `id`）… 商品。⚠️ 金利は持たない。`sort` で並び順、`active=0` で非表示（⚠️ 行は消さない）。
- `loan_rate`（PK `no`、⚠️ UNIQUE `(id, base_date)`）… 商品 × 基準日の金利。⚠️ 上書きせず積み上げる（履歴）。
  - `base_date` = 基準日（HTML の `ln_asof`）、`asof` = 金融機関側の適用月の表記（LOANS の `asof`、例 `2026/8`）
  - `source` = 出典（HTML の `ln_source`）
  - ⚠️ `confirmed_at` が NULL の行は下書き。⚠️ 「最新の金利」は確定済みのうち base_date が最も新しい行（人が確認する前の金利を計画書に出さないため）
- ⚠️ 外部キーは付けていない（既存の表と同じ）。

## 確認（ローカル）
- 2表を作成、初期データ 33件ずつ。⚠️ seed を2回流しても 33件（INSERT IGNORE）。
- ⚠️ DB の値を JSON で取り出して HTML の LOANS と突き合わせ → ⚠️ **33商品 × 16項目すべて一致、並び順も同じ**。

## 次の段階（未着手）
- ② に「最新の金利」を `KHG_RATE_FEED` の形で返す API
- funding-plan が起動時にその API を読む
- Dashboard に金利を入力・確定する画面

## 初期データの生成スクリプト（scratchpad/gen_seed.js。リポジトリには入れていない）
```js
// funding-plan/index.html の LOANS / LN_ASOF_DEFAULT / LN_SOURCE_DEFAULT から初期投入SQLを作る
const fs = require('fs');
const [htmlPath, outPath] = process.argv.slice(2);
const src = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');

const pick = (re, name) => { const m = src.match(re); if (!m) throw new Error(`${name} が見つからない`); return m[1]; };
const LN_ASOF = pick(/var LN_ASOF_DEFAULT = "([^"]+)";/, 'LN_ASOF_DEFAULT');
const LN_SOURCE = pick(/var LN_SOURCE_DEFAULT = "([^"]+)";/, 'LN_SOURCE_DEFAULT');
const start = src.indexOf('var LOANS = [');
const end = src.indexOf('\n];', start);
const LOANS = Function('return ' + src.slice(src.indexOf('[', start), end + 2))();

const q = (v) => (v === null || v === undefined || v === '') ? 'NULL'
  : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const num = (v) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`数値でない: ${v}`); return String(n); };

const ids = new Set();
const products = LOANS.map((p, i) => {
  if (ids.has(p.id)) throw new Error(`id 重複: ${p.id}`); ids.add(p.id);
  return `(${q(p.id)}, ${q(p.g)}, ${q(p.fi)}, ${q(p.pn)}, ${q(p.type)}, ${q(p.url)}, ${(i + 1) * 10}, 1)`;
});
const rates = LOANS.map((p) =>
  `(${q(p.id)}, ${q(LN_ASOF)}, ${num(p.rate)}, ${q(p.asof)}, ${q(p.fee)}, ${q(p.feeMode || 'fixed')}, ${num(p.feeVal || 0)}, ` +
  `${q(p.hosho)}, ${num(p.hoshoVal || 0)}, ${q(p.dan)}, ${q(p.note)}, ${q(p.warn)}, ${q(LN_SOURCE)}, NOW(), 'system', 'system')`);

const out = `-- ===========================================================
-- 住宅ローン金利の初期投入（loan_product / loan_rate）
--
-- 2026-10-06 新規（v2.2.168）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ **2026-10-06_loan_rate.sql のあとに流すこと。**
--
-- ⚠️⚠️ **手で書いていない。** frontend/public/funding-plan/index.html の
--   LOANS（${LOANS.length}商品）・LN_ASOF_DEFAULT（${LN_ASOF}）・LN_SOURCE_DEFAULT から機械的に作った。
--   ⚠️ 今の計画書に出ている金利と同じ値で始めるため。
--
-- ⚠️ INSERT IGNORE なので、2回流しても重複しない（⚠️ 既にある行は上書きしない）。
-- ⚠️ 初期投入の金利は確定済み（confirmed_at = 流した日時、confirmed_by = system）として入れる。
-- ===========================================================

INSERT IGNORE INTO loan_product (id, g, fi, pn, type, url, sort, active) VALUES
${products.join(',\n')};

INSERT IGNORE INTO loan_rate
  (id, base_date, rate, asof, fee, feeMode, feeVal, hosho, hoshoVal, dan, note, warn, source, confirmed_at, confirmed_by, created_by)
VALUES
${rates.join(',\n')};

-- 確認（⚠️ どちらも ${LOANS.length} 件）
SELECT 'loan_product', COUNT(*) FROM loan_product
UNION ALL
SELECT 'loan_rate', COUNT(*) FROM loan_rate;
`;
fs.writeFileSync(outPath, out);
console.log('products', LOANS.length, 'asof', LN_ASOF);
```

## backend/scripts/sql/2026-10-06_loan_rate.sql（全文）
```sql
-- ===========================================================
-- 住宅ローン金利のマスタ（loan_product / loan_rate）
--
-- 2026-10-06 新規（v2.2.168）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規2表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   AIデジタル資金計画書（frontend/public/funding-plan/index.html）の
--   「⑨ 銀行金利比較」で使う金融機関別の住宅ローン金利。
--   これまでは HTML の中の配列 `LOANS`（33商品）に直接書かれており、
--   更新するには HTML を直してビルド・デプロイする必要があった。
--   DB に移し、Dashboard で更新・履歴の参照・他画面での2次利用ができるようにする。
--
--   loan_product … 商品（金融機関 × 商品）。⚠️ 金利を持たない
--   loan_rate    … 商品ごと・基準日ごとの金利。⚠️ 行を上書きせず**積み上げる**（履歴）
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **列名は HTML の `LOANS` のキーと1文字も違わない**（funding_plan と同じ方針）。
--   `fi` `pn` `feeMode` のような素っ気ない名前・camelCase だが意図的である。
--   画面へは `KHG_RATE_FEED`（applyFeed が読む形）でそのまま渡せ、変換表が要らない。
--   ⚠️ 列名を「分かりやすく」改名してはいけない。
--
-- ⚠️⚠️ **顧客の計画書の金利は、ここが変わっても動かない。**
--   計画書は保存時の金利を funding_plan.loans（JSON）に持つ。
--   過去の計画書の数字が後から変わらないための仕組みであり、
--   ここから funding_plan.loans を書き換える処理を作ってはいけない。
--
-- ⚠️ 「最新の金利」= 商品ごとに、確定済み（confirmed_at が入っている）行のうち
--   base_date が最も新しいもの。⚠️ 未確定の行（下書き）は計画書に出さない。
--   （人が確認する前の金利がお客様に出るのを防ぐ）
-- ===========================================================

CREATE TABLE IF NOT EXISTS `loan_product` (
   `id`    VARCHAR(64)  NOT NULL COMMENT '商品ID（LOANS の id。例: kagin / flat35）。⚠️ 変えると計画書の比較表と照合できなくなる'
  ,`g`     VARCHAR(64)  NOT NULL COMMENT '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）'
  ,`fi`    VARCHAR(191) NOT NULL COMMENT '金融機関名（例: 鹿児島銀行）。⚠️ 一括更新（金融機関名=金利）の照合キーにもなる'
  ,`pn`    VARCHAR(191) NOT NULL COMMENT '商品名（例: 住宅ローン（変動））'
  ,`type`  VARCHAR(8)   NOT NULL DEFAULT 'v' COMMENT '金利タイプ。v = 変動 / f = 固定'
  ,`url`   VARCHAR(255)     NULL COMMENT '公式サイト'
  ,`sort`  INT          NOT NULL DEFAULT 0 COMMENT '並び順（小さいほど上）'
  ,`active` TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '1 = 計画書に出す / 0 = 出さない（⚠️ 行は消さない。過去の金利の参照元になるため）'
  ,`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`id`)
  ,KEY `idx_loan_product_sort` (`active`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='住宅ローン商品（AIデジタル資金計画書 ⑨銀行金利比較）。金利は loan_rate';

CREATE TABLE IF NOT EXISTS `loan_rate` (
   `no`        INT          NOT NULL AUTO_INCREMENT
  ,`id`        VARCHAR(64)  NOT NULL COMMENT '商品ID（loan_product.id）'
  ,`base_date` DATE         NOT NULL COMMENT '基準日（この金利をいつ時点のものとして登録したか）。⚠️ HTML の ln_asof にあたる'
  ,`rate`      DECIMAL(6,3) NOT NULL COMMENT '金利（%）。例: 0.875'
  ,`asof`      VARCHAR(16)      NULL COMMENT '金融機関側の適用月の表記（LOANS の asof。例: 2026/8）'
  ,`fee`       VARCHAR(191)     NULL COMMENT '事務手数料の表記（例: 借入額×2.2%）'
  ,`feeMode`   VARCHAR(16)  NOT NULL DEFAULT 'fixed' COMMENT 'rate = 借入額×feeVal% / fixed = feeVal 円'
  ,`feeVal`    DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '事務手数料の値（feeMode による。% または 円）'
  ,`hosho`     VARCHAR(191)     NULL COMMENT '保証料の表記'
  ,`hoshoVal`  DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '保証料（円）。⚠️ 試算では事務手数料に足される'
  ,`dan`       VARCHAR(191)     NULL COMMENT '団信の表記'
  ,`note`      TEXT             NULL COMMENT '備考（優遇条件など）'
  ,`warn`      TEXT             NULL COMMENT '注意書き（画面で目立たせる）'
  ,`source`    VARCHAR(191)     NULL COMMENT '出典（例: 各金融機関公式サイト（2026年8月時点））。⚠️ HTML の ln_source にあたる'
  ,`confirmed_at` DATETIME      NULL COMMENT '確定日時。⚠️ NULL の行は下書きで、計画書には出さない'
  ,`confirmed_by` VARCHAR(191)  NULL COMMENT '確定した人（staff の名前）'
  ,`created_by`   VARCHAR(191)  NULL COMMENT '登録した人（staff の名前。初期投入は system）'
  ,`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,UNIQUE KEY `uq_loan_rate_product_date` (`id`, `base_date`)
  ,KEY `idx_loan_rate_date` (`base_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='住宅ローン金利の履歴（商品×基準日）。⚠️ 上書きせず積み上げる';

-- ⚠️ 確認（⚠️ ① では information_schema が使えないので SHOW を使う）
SHOW CREATE TABLE loan_product;
SHOW CREATE TABLE loan_rate;
```
