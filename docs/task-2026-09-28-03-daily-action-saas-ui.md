# 2026-09-28 (3) 要確認モーダルの SaaS 風UIと店舗名（v2.2.150）

⚠️ [task-2026-09-28-02](task-2026-09-28-02-daily-action-ui.md) の続き。⚠️ **同じ版**。

## 依頼（`ReadMeClaude.md`）

- ⚠️⚠️ **サマリー上部にスクロール後の要素が見える（はみ出てる）**（⚠️ スクリーンショットで指摘）
- ⚠️ **モーダル外のクリックを許可する** → 確認せずに急ぎ作業を進めたい場合があるため
- ⚠️ **店舗名は `shop_list` の `show_flag = 1` と一致しない場合 `brand{未設定}` の表示にする**
- ⚠️ **Saas風UIにする** → `header/GoogleReview.tsx` 参照

---

## ⚠️⚠️ 1. サマリーのはみ出し — 原因と直し方

### 原因

⚠️ サマリーを ⚠️ **`Modal.Body` の中**に置いて `position: sticky; top: 0; z-index: 5` で留めていた。

⚠️⚠️ **スクロールする箱の中で留めているため、表の行がその上に描かれていた。**
⚠️ ⚠️ **`z-index` を上げても確実ではない**（⚠️ 表の行と同じ重なり文脈にいるため）。

### 直し方

⚠️⚠️ **サマリーを `Modal.Body` の外（`Modal.Header` 側）へ出した。**
⚠️ `scrollable` な Modal では ⚠️ **`Modal.Body` だけがスクロールする**ので、
⚠️ ⚠️ **外に置けば `sticky` も `z-index` も要らない。**

⚠️ CSS にも警告を残してある。

```css
/**
 * ⚠️⚠️ **サマリーは Modal.Body の外（ヘッダー側）に置いてある。**
 *   ⚠️ 以前は Body の中で position: sticky にしていたが、
 *     ⚠️ ⚠️ **スクロールした行がこの上に描かれてはみ出した**（2026-09-28 の指摘）。
 *   ⚠️ ⚠️ **Body に戻さないこと。** scrollable な Modal では Body だけが
 *     スクロールするため、外に置けば sticky も z-index も要らない。
 */
.da_summary { display: flex; align-items: center; justify-content: space-between;
              gap: 12px; flex-wrap: wrap; margin-top: 10px; }
```

---

## ⚠️ 2. モーダル外のクリックを許可

```tsx
            /**
             * ⚠️⚠️ **背景クリックと ESC で閉じられる**（2026-09-28 の指示）。
             *   ⚠️ `backdrop='static'` を付け直さないこと。
             *   ⚠️ ⚠️ **閉じただけでは確認済みにならない**（`check` を送らない）。
             */
            onHide={onClose}
```

⚠️ ⚠️ **`backdrop='static'` と `keyboard={false}` を削除した。**
⚠️⚠️ **閉じただけでは `check` を送らないので、翌日もまた出る。** ⚠️ これが意図（逃げ道）である。
⚠️ `check` が入るのは ⚠️ **「確認しました」を押したときだけ。**

⚠️ ESC も同時に効くようにした（⚠️ 背景クリックが効くのに ESC だけ効かないのは分かりにくいため）。

---

## ⚠️ 3. 店舗名（① ② の両方）

### ⚠️⚠️ 実データで分かったこと

⚠️ `shop_list` に ⚠️ **`KH店舗未設定` `DJH店舗未設定` などが実在していた**（⚠️ `show_flag = 1`）。

| shop | brand | division | show_flag |
|---|---|---|---|
| `2L店舗未設定` | 2L | 注文事業 | 1 |
| `DJH店舗未設定` | DJH | 注文事業 | 1 |
| `KH店舗未設定` | KH | 注文事業 | 1 |
| `PGH店舗未設定` | PGH | 注文事業 | 1 |
| `なごみ店舗未設定` | なごみ | 注文事業 | 1 |
| `ブランド・店舗未設定` | KHG | 注文事業 | 1 |

⚠️⚠️ **そのため出す文字列は `{ブランド}未設定` ではなく `{ブランド}店舗未設定` にした。**
⚠️ ⚠️ **別の文字列にすると、同じ意味の行が2種類並ぶ**（⚠️ 実測で `KH未設定` 13件 と `KH店舗未設定` 3件 に割れた）。
⚠️ `shopFormate()`（反響一覧）の言い方とも一致する。

### 追加した関数（② `dailyAction.ts`）

```ts
/**
 * 店舗名の表示。
 *
 * ⚠️⚠️ **`shop_list` の `show_flag = 1` に無い店舗名は `{ブランド}店舗未設定` と出す**
 *   （2026-09-28 の指示）。
 *   ⚠️ 実データに `KH国分ハウジング` `PGH` `なごみ姶良霧島店` のような、
 *     ⚠️ **店舗マスタに無い値**が入っている（反響フォーム側の自由入力）。
 *   ⚠️ ⚠️ **そのまま出すと実在しない店舗名が並び、誰の担当か分からない。**
 *
 * ⚠️ ブランドの言い換えは ⚠️ **`frontend/src/utils/shopFormate.ts` と同じ**にすること。
 *   ⚠️ `Nagomi` → `なごみ` ／ `PG HOUSE` → `PGH`
 *   ⚠️ ⚠️ **片方だけ直すと画面ごとに違う店舗名が出る。**
 */
const BRAND_LABEL = `
  CASE TRIM(COALESCE(%BRAND%, ''))
    WHEN 'Nagomi' THEN 'なごみ'
    WHEN 'PG HOUSE' THEN 'PGH'
    ELSE TRIM(COALESCE(%BRAND%, ''))
  END`;

/**
 * 店舗名を出す式。
 *
 * ⚠️ `%SHOP%` … 元の店舗名の列 ／ `%BRAND%` … ブランドの列
 * ⚠️ ⚠️ **`shop_list` は `s.shop` で LEFT JOIN 済みであること。**
 *   ⚠️ 一致しなければ `s.shop IS NULL` になる。
 */
const shopLabel = (shopColumn: string, brandColumn: string): string => {
  const brand = BRAND_LABEL.replace(/%BRAND%/gu, brandColumn);
  return `
    CASE
      WHEN s.shop IS NOT NULL THEN TRIM(${shopColumn})
      WHEN ${brand} <> '' THEN CONCAT(${brand}, '店舗未設定')
      ELSE ''
    END`;
};

/**
 * 表示対象の店舗。
 *
 * ⚠️ ⚠️ **`show_flag = 1` だけで絞る**（指示）。⚠️ 事業では絞らない。
 *   ⚠️ 未同期の反響には建売・中古の店舗も混ざりうるため。
 * ⚠️ `GROUP BY` で重複を潰す。⚠️ **潰さないと JOIN で行が増える。**
 */
const VISIBLE_SHOPS = `(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)`;
```

⚠️ 日付の式にも ⚠️ **別名を付けた**（⚠️ JOIN したため）。

```ts
/**
 * ⚠️⚠️ **別名（`i.` / `m.`）を必ず付けること。**
 *   ⚠️ 2026-09-28 に `shop_list` を LEFT JOIN したため、
 *     ⚠️ **列名だけだと将来あいまいになる。**
 */
const INQUIRY_DATE = asDate('i.inquiry_date');
const RESERVED_DATE = asDate('m.reserved_interview');
const REGISTER_DATE = asDate('m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');
```

⚠️ 3本のSQLすべてに `LEFT JOIN` を足した。

```ts
    FROM inquiry_customer i
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(i.shop)
```
```ts
    FROM master_data m
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
```

### 追加した関数（① `daily_action.php`）

```php
function dailyActionShop(string $shopColumn, string $brandColumn): string
{
    $brand = "CASE TRIM(COALESCE($brandColumn, ''))
                WHEN 'Nagomi' THEN 'なごみ'
                WHEN 'PG HOUSE' THEN 'PGH'
                ELSE TRIM(COALESCE($brandColumn, ''))
              END";
    return "CASE
              WHEN s.shop IS NOT NULL THEN TRIM($shopColumn)
              WHEN $brand <> '' THEN CONCAT($brand, '店舗未設定')
              ELSE ''
            END";
}

/**
 * 表示対象の店舗。
 * ⚠️ **`show_flag = 1` だけで絞る**（指示）。⚠️ 事業では絞らない。
 * ⚠️ GROUP BY で重複を潰す。⚠️ **潰さないと JOIN で行が増える。**
 */
$visible_shops = "(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)";
```

---

## ⚠️ 4. SaaS 風UI（`GoogleReview.tsx` を踏襲）

⚠️ `react-bootstrap` の `Table` をやめ、⚠️ **専用 `<style>` ＋ 素の `<table>`** にした。
⚠️ ⚠️ **共通CSSは触っていない**（`GoogleReview.tsx` と同じ方針）。

| | 値 |
|---|---|
| 文字 | `#1f2937` ／ 補助 `#6b7280` ／ 薄い `#9ca3af` |
| 枠 | `#e5e7eb` ／ 行の区切り `#f1f5f9` |
| 面 | `#f8fafc`（見出し・カード） |
| 角丸 | 10px（カード・表）／ 999px（pill） |
| ボタン | `#2563eb`（hover `#1d4ed8`）・pill |

⚠️ 主なクラス:

```css
.da_dialog { max-width: 900px; }
.da_kpi_card { background: #f8fafc; border: 1px solid #e5e7eb;
               border-radius: 10px; padding: 6px 12px; min-width: 104px; }
/* ⚠️ 放置のある表だけ数字を赤くする。本日の予定は青。色で種類が分かる */
.da_kpi_card.is_alert .da_kpi_value { color: #b91c1c; }
.da_kpi_card.is_alert { background: #fef2f2; border-color: #fecaca; }

/* ⚠️ 表。⚠️ 見出しは固定する（行が多いと見出しが流れるため） */
.da_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
         border-bottom: 1px solid #e5e7eb; padding: 7px 10px;
         font-weight: 700; font-size: 10px; color: #4b5563;
         white-space: nowrap; text-align: left; }
.da_row:hover > .da_td { background: #f8fafc; }

/* ⚠️ 放置日数。⚠️ 段階の色はオーナー指定なので変えないこと */
.da_days { display: inline-block; min-width: 42px; text-align: center;
           border-radius: 999px; padding: 2px 8px; font-size: 11px;
           font-weight: 700; font-variant-numeric: tabular-nums; }
.da_days_low { background: #fef9c3; color: #854d0e; }
.da_days_mid { background: #ffedd5; color: #9a3412; }
.da_days_high { background: #fee2e2; color: #b91c1c; }
```

⚠️ 放置日数の判定は ⚠️ **class を返す形に変えた**（⚠️ 段階と境目は変えていない）。

```tsx
/**
 * 放置日数の見た目。
 *
 * ⚠️ 段階はオーナー指定（2026-09-28）。
 *   ⚠️ 〜2日 … 薄い黄
 *   ⚠️ 3〜5日 … 橙
 *   ⚠️ 6日以上 … 赤
 *
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。**
 * ⚠️ 色は GoogleReview.tsx と同じ系統（amber / orange / red の 50・700）に寄せてある。
 */
const daysClass = (days: number): string => {
    if (days >= 6) return 'da_days da_days_high';
    if (days >= 3) return 'da_days da_days_mid';
    return 'da_days da_days_low';
};
```

⚠️ サマリーは ⚠️ **KPIカード**にした。⚠️ **放置のある表（未同期・来場日未入力）だけ赤**、⚠️ 本日の予定は通常色。

```tsx
                <div className='da_summary'>
                    <div className='da_kpi'>
                        {visible.map((section) => (
                            <div
                                key={section.label}
                                className={`da_kpi_card${section.hasDays ? ' is_alert' : ''}`}
                            >
                                <div className='da_kpi_label'>{section.label}</div>
                                <div className='da_kpi_value'>
                                    {section.rows.length.toLocaleString()}<small>件</small>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className='da_btn' onClick={handleCheck} disabled={sending}>
                        確認しました
                    </button>
                </div>
```

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| `react-scripts build`（①） | ⚠️ **成功** → ⚠️ **`main.dd98830a.js`** |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ（⚠️ **完全一致**）

| セクション | 件数 |
|---|---|
| 未同期 | 55 |
| 来場日未入力 | 19 |
| 本日の2回目以降面談 | 4 |
| 本日の契約 | 1 |
| ⚠️ **合計** | ⚠️ **79** |

### ⚠️ 店舗名（⚠️ **統合できた**）

| 店舗名 | 変更前 | ⚠️ 変更後 |
|---|---|---|
| ⚠️ **`KH店舗未設定`** | ⚠️ `KH未設定` 13 ＋ `KH店舗未設定` 3 | ⚠️⚠️ **16** |
| `DJH店舗未設定` | 5 | 5 |
| `PGH店舗未設定` | ⚠️ `PGH未設定` 5 | ⚠️ **5** |
| `PGH宮崎店` など実在店舗 | そのまま | そのまま |

⚠️ ⚠️ **「未設定」を含む行は 26 件**（⚠️ 79件中）。⚠️ **`KH国分ハウジング` のような実在しない店舗名は消えた。**

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **サマリーを `Modal.Body` に戻さないこと。** ⚠️ 戻すと**また行が上に重なる** |
| 2 | ⚠️⚠️ **`backdrop='static'` を付け直さないこと**（⚠️ 急ぎのときの逃げ道） |
| 3 | ⚠️ 閉じただけでは ⚠️ **確認済みにならない**。⚠️ **翌日また出る**（意図どおり） |
| 4 | ⚠️⚠️ **店舗名は `{ブランド}店舗未設定`。** ⚠️ `{ブランド}未設定` にすると **同じ意味の行が2種類並ぶ** |
| 5 | ⚠️ ブランドの言い換えは ⚠️ **`shopFormate.ts` と同じ**にすること（⚠️ ①② の2箇所） |
| 6 | ⚠️ 色の境目は ⚠️ **`daysClass()` と `.da_days_*`** だけを直す |
| 7 | ⚠️ 専用 `<style>` に閉じてある。⚠️ **共通CSSへ移さないこと** |
