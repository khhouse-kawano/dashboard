# 指示（2026-09-18）　競合サマリーの UI 改修と Express 化

⚠️ 依頼（`ReadMeClaude.md` 要旨）: 「`header/CompetitorSummary.tsx` の改修。⚠️ **引き続き v2.2.137**。
⚠️ **モーダルを fullscreen に**／⚠️ **左上にも閉じるボタン**／⚠️ **Saas 風のデザインに**（いずれも `GoogleReview.tsx` 参照）。
⚠️ **先頭行の次の行に総数を挿入**（`targetSection`・`targetShop` が false なら **`注文営業全体`**、そのほかは `{targetSection}全体` / `{targetShop}全体`）。
⚠️ **契約列**も `competitor_win_reason` がある場合は**クリックできるUI**に → モーダルで
`competitor_win_reason` / `competitor_price_gap` / `competitor_sales_person` を**小さなカードのグリッド**で表示（⚠️ **競合に勝った案件のサマリ**）。
⚠️ **失注列**はクリックで `customized_input_01JRF9CZSW65A151WR30NA4PB3` / `customized_input_01JSE7H4MQES619NBWX6PQDFRH` /
`competitor_price_gap` / `competitor_sales_person` / `competitor_countermeasure` / `competitor_campaign` を**カードでグリッド表示**（⚠️ **競合に負けた案件のサマリ**）。
⚠️ **Express 化**」

⚠️ 追加の指示（作業中）: 「⚠️ **勝因、敗因ともに表示されるモーダルに `in_charge_store` と `sales_promotion_name` を表示**」

---

## ⚠️ 着手前に確認したこと（利用者が決定）

| # | 論点 | ⚠️ 決定 |
|---|---|---|
| 1 | 追加する「総数行」は何を数えるか | ⚠️ **競合が記録された案件全体**（⚠️ **下の行の合計ではない**） |
| 2 | 失注列の現在のモーダル（失注理由の件数集計表）をどうするか | ⚠️ **カードに置き換える** |

---

## ⚠️ 調査で分かったこと

### ⚠️ fullscreen と左上の閉じるボタンは `Header.tsx` の仕事

⚠️⚠️ **`isFullscreenMenu` の配列に1行足すだけ**で、次の3つが同時に効く。

| | 内容 |
|---|---|
| 大きさ | `dialogClassName='modal-fullscreen'` |
| 閉じるボタン | ⚠️ **見出しの隣（左上）にボタンが出る**（右上の × は消える） |
| 本文 | `p-0 flex-grow-1` ／ `overflow: hidden` |

⚠️ ⚠️ **コンポーネント側に閉じるボタンを実装しないこと。** ⚠️ **二重に出る。**

### ⚠️ 既存の別名の重複（移植ではそのままにした）

⚠️ `competitor.php` は `customized_input_01JRF9CZSW65A151WR30NA4PB3` を
⚠️ **`reason` と `lost_reason_detail` の2つの別名**で返している。
⚠️ 画面が使うのは `lost_reason_detail` だけだが、⚠️ **応答の形が変わると ① との差分になる**ため残した。

### ⚠️⚠️ 列名から意味が読めない

| 別名 | 実際の意味 |
|---|---|
| `lost_reason_detail` | ⚠️ **他決理由**（複数選択・カンマ区切り） |
| ⚠️ `reason_detail` | ⚠️ **敗因**（⚠️ 名前からは読めない） |

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/header/` | ⚠️ `CompetitorSummary.tsx` | ⚠️ **全面的に書き直し** |
| `frontend/src/components/header/` | `Header.tsx` | ⚠️ `isFullscreenMenu` に1行 |
| `backend-express/src/features/` | ⚠️ `competitor.ts`（⚠️ **新規**） | `competitor.php` の移植 |
| `backend-express/src/gateway/` | `registry.ts` | `request: 'competitor'` を登録 |
| `backend/src/core/` | `express_proxy.php` | 許可リストに `'competitor'` |
| `backend/src/handlers/` | ⚠️ `competitor.php` | ⚠️ **6列を追加（② と同じ）** |

## 追加した定数・関数

| 名前 | ファイル | 役割 |
|---|---|---|
| `BRANDS` | `CompetitorSummary.tsx` | ⚠️ ブランド列の定義（⚠️ **6つの `filter` のベタ書きをやめた**） |
| `WIN_FIELDS` / `LOSE_FIELDS` | `CompetitorSummary.tsx` | カードに出す項目 |
| `isBlank()` | `CompetitorSummary.tsx` | 空の判定（⚠️ `'null'` も空） |
| ⚠️ `getTotals()` | `CompetitorSummary.tsx` | ⚠️ **総数行** |
| `openCards()` / `brandCells()` / `subHeaders()` | `CompetitorSummary.tsx` | 描画 |
| ⚠️ `runCompetitor()` | `backend-express/src/features/competitor.ts` | ⚠️ **新規** |

---

## ⚠️ 実装の考え方

### ⚠️⚠️ 総数行は「下の行の合計」ではない

```tsx
    const getTotals = (dataSet: Summary[]): Metrics => {
        const hasCompetitor = (d: Summary) => !isBlank(d.competitor);
        const hasLost = (d: Summary) => !isBlank(d.lost_competitor);
        const base = dataSet.filter(hasCompetitor);
        return {
            total: dataSet.filter(d => hasCompetitor(d) || hasLost(d)),
            contract: base.filter(d => d.contract),
            lose: dataSet.filter(hasLost),
            follow: base.filter(d => d.status === '見込み' && !hasLost(d)),
        };
    };
```

⚠️⚠️ **1件の案件に競合が複数いると、それぞれの行に数えられる。**
⚠️ そのため ⚠️ **縦に足すと実際の案件数より大きくなる**（延べ数）。
⚠️ こちらは ⚠️ **案件を重複なく**数える。⚠️ **画面に注記を出してある。**

⚠️⚠️ **`getMetrics` に空文字を渡してはいけない。**
⚠️ `''.includes('')` は真なので、⚠️ **競合が空の案件まで数えてしまう。**
⚠️ そのため専用の関数を作った。

### ⚠️ 契約列を押せるのは「勝因が入っているとき」だけ

```tsx
        if (type === 'contract') {
            const withReason = records.filter(r => !isBlank(r.win_reason));
            if (withReason.length === 0) return <span className="cs_num cs_contract">{count}</span>;
            return (
                <button
                    type="button"
                    className="cs_num cs_contract cs_click"
                    title={`クリックで勝因を表示（${withReason.length}件）`}
                    onClick={() => openCards(`${makerName} に勝った案件`, WIN_FIELDS, withReason)}
                >
                    {count}
                </button>
            );
        }
```

⚠️ ⚠️ **空のモーダルは開けない。** 開けると「壊れている」と受け取られる。
⚠️ 数字は**契約の総数**のまま出し、⚠️ **カードには勝因が入っている案件だけ**を並べる。

### ⚠️ カードに店舗と反響媒体を出す（追加の指示）

```tsx
                                        <div className="cs_meta">
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-shop me-1" aria-hidden="true" />
                                                {record.shop || '店舗未設定'}
                                            </span>
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-bullhorn me-1" aria-hidden="true" />
                                                {isBlank(record.medium) ? '媒体未設定' : record.medium}
                                            </span>
                                        </div>
```

⚠️ `shop` は `in_charge_store`、`medium` は `sales_promotion_name` の別名。
⚠️ ⚠️ **自由記述より上に置く。** ⚠️ どの店舗のどの反響か分からないと、勝因・敗因だけ読んでも判断できない。

### ⚠️ 空の項目は行ごと出さない

```tsx
                                const filled = cardModal.fields.filter(f => !isBlank(record[f.key]));
```

⚠️ ⚠️ **空行だらけのカードは読めない。** ⚠️ すべて空なら「まだ入力されていません」と出す。

---

## `backend-express/src/features/competitor.ts`（⚠️ 新規・全文）

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 競合サマリー（header/CompetitorSummary.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/competitor.php`
 *
 * ⚠️⚠️ **参照のみ。** 書き込みは一切しない。
 *   ⚠️ ① に PHP ハンドラが実在するので、転送に失敗しても ① へ
 *     自動フォールバックして動く（`expressProxyExclusive` には入れない）。
 *
 * ⚠️⚠️ **列と別名は移植元から1文字も変えないこと。**
 *   ⚠️ 画面が別名をそのまま使っている（`competitor` / `lost_competitor` など）。
 *   ⚠️ 読みやすい名前に変えると、**表が全部0件になる**（エラーは出ない）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * 店舗。
 * ⚠️ `report_flag = 1` で絞るのは移植元と同じ。画面は `section` で店舗を束ねる。
 */
const SHOP_SQL = `
  SELECT brand, shop, division, section, multi, report_flag
    FROM shop_list
   WHERE report_flag = 1
`;

const SECTION_SQL = 'SELECT division, name FROM section_list';

/**
 * 顧客一覧（注文事業）。
 *
 * ⚠️⚠️ **`customized_input_01JRF9CZSW65A151WR30NA4PB3` が
 *   `reason` と `lost_reason_detail` の2つの別名で出ている。**
 *   ⚠️ 移植元がそうなっている。⚠️ **画面は `lost_reason_detail` だけを使う。**
 *   ⚠️ 直したくなるが、⚠️ **応答の形が変わると ① との差分になる**ので残す。
 *
 * ⚠️⚠️ **2026-09-18 に勝因・敗因の5列を足した。**
 *   ⚠️ 契約列・失注列のモーダル（案件ごとのカード）で使う。
 *   ⚠️ ⚠️ **`master_data` にこれらの列が無いと `Unknown column` で画面が開かない。**
 *     ⚠️ v2.2.136 の `2026-09-17_master_data_win_lose.sql` を先に流すこと。
 *   ⚠️ ① の competitor.php にも**同じ5行を足してある。** 片方だけにしないこと。
 *
 * ⚠️ 移植元は `master_data` を全件返している。⚠️ **絞り込みは画面側**である
 *   （店舗・営業課・競合名）。⚠️ ここで絞ると画面の絞り込みと二重になる。
 */
const CONTRACT_SQL = `
  SELECT
    COALESCE(id, '') as id,
    COALESCE(in_charge_store, '') as shop,
    COALESCE(in_charge_user, '') as staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as reason,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') as reason_detail,
    COALESCE(customer_contacts_annual_income, '') as income,
    COALESCE(last_action_step_migration_item_name, '') as change_reason,
    COALESCE(competitors_text, '') as competitor,
    COALESCE(competitor_name, '') as lost_competitor,
    COALESCE(competitor_lost_contract_reason, '') as lost_reason,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as lost_reason_detail,
    COALESCE(sales_promotion_name, '') as medium,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
    COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
    COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
    COALESCE(status, '') as status,
    COALESCE(rank_period, '') as rank_period,
    COALESCE(customer_contacts_name, '') as customer,
    COALESCE(competitor_win_reason, '') as win_reason,
    COALESCE(competitor_price_gap, '') as price_gap,
    COALESCE(competitor_sales_person, '') as sales_person,
    COALESCE(competitor_countermeasure, '') as countermeasure,
    COALESCE(competitor_campaign, '') as rival_campaign
  FROM master_data
`;

const MAKER_SQL = 'SELECT * FROM house_maker';

export interface CompetitorResponse {
  shop: Record<string, unknown>[];
  section: Record<string, unknown>[];
  contract: Record<string, unknown>[];
  maker: Record<string, unknown>[];
}

export const runCompetitor = async (): Promise<CompetitorResponse> => {
  // ⚠️ 4つとも独立しているので並べて取る。移植元は直列だった
  const [shop, section, contract, maker] = await Promise.all([
    query<DynamicRow>(SHOP_SQL),
    query<DynamicRow>(SECTION_SQL),
    query<DynamicRow>(CONTRACT_SQL),
    query<DynamicRow>(MAKER_SQL),
  ]);

  return { shop, section, contract, maker };
};

```

---

## `backend-express/src/gateway/registry.ts`（追加分）

```ts
// ---------------------------------------------------------------------------
// 競合サマリー
//
// ⚠️ 参照のみ。⚠️ ① に PHP ハンドラが実在する（competitor.php）ので、
//   転送に失敗しても ① へ自動フォールバックして動く。
//
// ⚠️⚠️ **`master_data` に勝因・敗因の5列が必要**（v2.2.136 の SQL）。
//   ⚠️ 無いと `Unknown column` になり、⚠️ **② も ① も同じように失敗する。**
// ---------------------------------------------------------------------------

register({
  request: 'competitor',
  summary: '競合サマリー（競合他社別の総数・契約・失注・追客）',
  phpSource: 'backend/src/handlers/competitor.php',
  auth: 'staff',
  handler: async () => runCompetitor(),
});
```

## `backend/src/core/express_proxy.php`（追加分）

```php
        // -----------------------------------------------------------------
        // 2026-09-18 移植。競合サマリー（参照のみ）。
        //
        // ⚠️ ① に PHP ハンドラが実在する（competitor.php）。この行を消せば即座に戻る。
        // ⚠️ 書き込みは無いので expressProxyExclusive() へは入れない。
        // ⚠️⚠️ **master_data に勝因・敗因の5列が要る**（v2.2.136 の SQL）。
        // -----------------------------------------------------------------
        'competitor',
```

## `backend/src/handlers/competitor.php`（追加分・⚠️ **フォールバック分**）

```php
    COALESCE(status, '') as status,
    COALESCE(rank_period, '') as rank_period,
    -- ⚠️ 2026-09-18 に追加。契約列・失注列のモーダル（案件ごとのカード）で使う。
    -- ⚠️⚠️ **master_data にこれらの列が無いと Unknown column で画面が開かない。**
    --   ⚠️ v2.2.136 の 2026-09-17_master_data_win_lose.sql を先に流すこと。
    -- ⚠️ ② の backend-express/src/features/competitor.ts と**必ず揃えること**。
    COALESCE(customer_contacts_name, '') as customer,
    COALESCE(competitor_win_reason, '') as win_reason,
    COALESCE(competitor_price_gap, '') as price_gap,
    COALESCE(competitor_sales_person, '') as sales_person,
    COALESCE(competitor_countermeasure, '') as countermeasure,
    COALESCE(competitor_campaign, '') as rival_campaign
FROM master_data";
```

## `frontend/src/components/header/Header.tsx`（追加分）

```tsx
        // ⚠️ 競合サマリーは**7ブランド × 4列＝28列**あり、xl では大半が隠れる。
        //   ⚠️ 2026-09-18 の指示で全画面にした。
        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る**（下の JSX を参照）。
        //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
        '他社動向/競合サマリー',
```

---

## ⚠️ `frontend/src/components/header/CompetitorSummary.tsx`（⚠️ **全文**）

⚠️ 書き直したので全文を載せる。⚠️ 主な変更点は次のとおり。

| # | 内容 |
|---|---|
| 1 | ⚠️ **全画面に合わせた土台**（`cs_wrap` が高さを使い切り、⚠️ **表だけスクロール**） |
| 2 | ⚠️ **Saas 風の見た目**（⚠️ Bootstrap のクラス頼みをやめ、⚠️ **コンポーネント専用の `<style>`**） |
| 3 | ⚠️ **見出し2段＋総数行＋先頭列を固定**（⚠️ 28列を横スクロールしても迷わない） |
| 4 | ⚠️ **総数行**を追加（⚠️ 見出しは絞り込みに追従） |
| 5 | ⚠️ **契約列をクリック可能に**（⚠️ 勝因がある案件だけ） |
| 6 | ⚠️ **失注列のモーダルをカードに置き換え** |
| 7 | ⚠️ **カードに店舗と反響媒体**（追加の指示） |
| 8 | ⚠️ `BRANDS` 配列で ⚠️ **6つの `filter` のベタ書きを廃止** |
| 9 | ⚠️ **読み込み中と取得失敗を出す**（⚠️ 以前は `console.error` だけで、⚠️ **0件と区別できなかった**） |

```tsx
import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

/**
 * 競合サマリー（ヘッダー → 他社動向 → 競合サマリー）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-18 に全画面へ変えた**（指示）。
 *   ⚠️ 7ブランド × 4列 ＝ **28列**あり、xl では大半が隠れていた。
 *   ⚠️ ⚠️ **全画面と「左上の閉じるボタン」は Header.tsx の `isFullscreenMenu`
 *     が面倒を見る。** ⚠️ ここに閉じるボタンを実装しないこと（二重になる）。
 *
 * ⚠️⚠️ **Modal.Body は p-0 かつ overflow: hidden**（Header.tsx）。
 *   ⚠️ そのため
 *     ・余白はこちらで持つ
 *     ・高さを使い切り、**表だけがスクロールする**形にする
 *   ⚠️ `height: 100%` と `min-height: 0` を外すと、表が画面外へ出て見えなくなる。
 *   ⚠️ GoogleReview.tsx と同じ作りである。
 *
 * ⚠️⚠️ **数字は「案件数」であって「延べ数」ではない。**
 *   ⚠️ 1件の案件に競合が複数いると、**それぞれの行に数えられる。**
 *   ⚠️ そのため ⚠️ **各行を縦に足しても総数行にはならない。** 画面に注記を出す。
 * ─────────────────────────────────────────────
 */

type Summary = Record<string, string>;

/** 集計の1かたまり。⚠️ 件数だけでなく**案件そのもの**を持つ（モーダルで使う） */
type Metrics = { total: Summary[]; contract: Summary[]; lose: Summary[]; follow: Summary[] };

/** ブランド列の定義。⚠️ `prefix` は `in_charge_store` の先頭に付く文字 */
const BRANDS = [
    { key: 'kh', label: 'KH', prefix: 'KH' },
    { key: 'djh', label: 'DJH', prefix: 'DJH' },
    { key: 'nagomi', label: 'なごみ', prefix: 'なごみ' },
    { key: 'nieru', label: '2L', prefix: '2L' },
    { key: 'jh', label: 'JH', prefix: 'JH' },
    { key: 'pgh', label: 'PGH', prefix: 'PG' },
] as const;

/** カードに出す項目。⚠️ 値が空のものは行ごと出さない */
type CardField = { key: string; label: string; unit?: string };

/**
 * ⚠️⚠️ **勝ちのサマリ（契約列）で出す項目**（2026-09-18 の指示）。
 *   ⚠️ 列名は master_data の `competitor_*`。② / ① の SELECT で別名を付けてある。
 */
const WIN_FIELDS: CardField[] = [
    { key: 'win_reason', label: '勝因' },
    { key: 'price_gap', label: '価格差', unit: '万円' },
    { key: 'sales_person', label: '他社営業' },
];

/**
 * ⚠️⚠️ **負けのサマリ（失注列）で出す項目**（2026-09-18 の指示）。
 *   ⚠️ `lost_reason_detail` は他決理由（複数選択・カンマ区切り）。
 *   ⚠️ `reason_detail` が**敗因**である（列名からは読めないので注意）。
 */
const LOSE_FIELDS: CardField[] = [
    { key: 'lost_reason_detail', label: '他決理由' },
    { key: 'reason_detail', label: '敗因' },
    { key: 'price_gap', label: '価格差', unit: '万円' },
    { key: 'sales_person', label: '他社営業' },
    { key: 'countermeasure', label: '今後の対策' },
    { key: 'rival_campaign', label: '他社のキャンペーン' },
];

/** ⚠️ 空とみなす値。⚠️ 文字列の `'null'` が実データに入っている */
const isBlank = (value: unknown): boolean => {
    const text = String(value ?? '').trim();
    return text === '' || text === 'null';
};

const CompetitorSummary: React.FC = () => {
    const [data, setData] = useState<Summary[]>([]);
    const [list, setList] = useState<string[]>([]);
    const [shops, setShops] = useState<Summary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');

    /**
     * 案件カードのモーダル。
     * ⚠️ 勝ちと負けで**出す項目だけが違う**ので、1つの state にまとめてある。
     */
    const [cardModal, setCardModal] = useState<{
        show: boolean; title: string; fields: CardField[]; records: Summary[];
    }>({ show: false, title: '', fields: [], records: [] });

    const itemsPerPage = 20;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'competitor' });
                setData(response.data.contract);
                setList(response.data.maker.map((m: any) => m.label));
                setShops(response.data.shop.filter(
                    (s: any) => !s.shop.includes('未設定') && !s.shop.includes('全店舗')
                ));
            } catch (e) {
                // ⚠️ 0件と取得失敗を見分けられるようにする（黙って空の表を出さない）
                setError('競合情報を取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const targetData = useMemo(() => {
        const targetShops = shops.filter(s => s.section === targetSection).map(s => s.shop);
        return data.filter(d => {
            let match = true;
            if (targetShop && d.shop !== targetShop) match = false;
            if (targetSection && !targetShops.includes(d.shop)) match = false;
            return match;
        });
    }, [data, targetShop, targetSection, shops]);

    /** ブランドごとに絞った案件。⚠️ 総数行と各行で使い回す */
    const brandData = useMemo(() => {
        const out: Record<string, Summary[]> = { khg: targetData };
        for (const b of BRANDS) out[b.key] = targetData.filter(d => d.shop?.startsWith(b.prefix));
        return out;
    }, [targetData]);

    /**
     * 競合他社1社ぶんの集計。
     * ⚠️⚠️ **判定は改修前と同じにしてある。** 数字が変わると比較できなくなる。
     *   総数 … 競合に挙がっている、または失注先になっている
     *   契約 … 競合に挙がっていて契約日がある
     *   失注 … 失注先になっている
     *   追客 … 競合に挙がっていて見込み、かつその会社に負けていない
     */
    const getMetrics = (dataSet: Summary[], makerName: string): Metrics => {
        const total = dataSet.filter(d => d.competitor?.includes(makerName) || d.lost_competitor?.includes(makerName));
        const base = dataSet.filter(d => d.competitor?.includes(makerName));
        return {
            total,
            contract: base.filter(d => d.contract),
            lose: dataSet.filter(d => d.lost_competitor?.includes(makerName)),
            follow: base.filter(b => b.status === '見込み' && !b.lost_competitor?.includes(makerName)),
        };
    };

    /**
     * 総数行の集計。
     *
     * ⚠️⚠️ **「競合が記録された案件」全体を数える**（2026-09-18 に利用者が決定）。
     *   ⚠️ ⚠️ **下の行の合計ではない。**
     *     ⚠️ 1件の案件に競合が複数いると各行に数えられるため、
     *       縦に足すと**実際の案件数より大きくなる**（延べ数になる）。
     *   ⚠️ こちらは**案件を重複なく**数える。
     *
     * ⚠️ `getMetrics` に空文字を渡してはいけない。
     *   ⚠️ `''.includes('')` は真なので、⚠️ **競合が空の案件まで数えてしまう。**
     */
    const getTotals = (dataSet: Summary[]): Metrics => {
        const hasCompetitor = (d: Summary) => !isBlank(d.competitor);
        const hasLost = (d: Summary) => !isBlank(d.lost_competitor);
        const base = dataSet.filter(hasCompetitor);
        return {
            total: dataSet.filter(d => hasCompetitor(d) || hasLost(d)),
            contract: base.filter(d => d.contract),
            lose: dataSet.filter(hasLost),
            follow: base.filter(d => d.status === '見込み' && !hasLost(d)),
        };
    };

    /** 総数行の見出し。⚠️ 絞り込みに合わせて名前を変える（指示） */
    const totalLabel = targetShop
        ? `${targetShop}全体`
        : targetSection
            ? `${targetSection}全体`
            : '注文営業全体';

    const totalsRow = useMemo(() => ({
        khg: getTotals(brandData.khg),
        ...Object.fromEntries(BRANDS.map(b => [b.key, getTotals(brandData[b.key])])),
    }) as Record<string, Metrics>, [brandData]);

    const filteredList = useMemo(() => {
        return list
            .map(name => ({
                name,
                sortCount: getMetrics(brandData.khg, name).total.length,
                metrics: {
                    khg: getMetrics(brandData.khg, name),
                    ...Object.fromEntries(BRANDS.map(b => [b.key, getMetrics(brandData[b.key], name)])),
                } as Record<string, Metrics>,
            }))
            .sort((a, b) => b.sortCount - a.sortCount);
    }, [list, brandData]);

    const searchedList = useMemo(() => {
        if (!searchTerm) return filteredList;
        return filteredList.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [filteredList, searchTerm]);

    const totalPages = Math.ceil(searchedList.length / itemsPerPage) || 1;

    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return searchedList.slice(startIndex, startIndex + itemsPerPage);
    }, [searchedList, currentPage, itemsPerPage]);

    const pageNumbers = useMemo(() => {
        const maxPages = 5;
        let start = Math.max(1, currentPage - 2);
        let end = start + maxPages - 1;
        if (end > totalPages) {
            end = totalPages;
            start = Math.max(1, end - maxPages + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [currentPage, totalPages]);

    const openCards = (title: string, fields: CardField[], records: Summary[]) =>
        setCardModal({ show: true, title, fields, records });

    /**
     * 数字のセル。
     *
     * ⚠️⚠️ **押せるのは「中身があるとき」だけ**（2026-09-18 の指示）。
     *   契約 … `competitor_win_reason` が入っている案件が1件でもあるとき
     *   失注 … 失注が1件でもあるとき
     *   ⚠️ 空のモーダルを開けると「壊れている」と受け取られる。
     *
     * ⚠️ 押せるセルは**点線の下線**を付ける。⚠️ 色だけでは押せると分からない。
     */
    const renderCountCell = (
        records: Summary[], type: 'total' | 'contract' | 'lose' | 'follow', makerName: string
    ) => {
        const count = records.length;
        if (count === 0) return <span className="cs_zero">0</span>;

        if (type === 'contract') {
            // ⚠️ 勝因が入っている案件だけを見せる。⚠️ 入っていない契約は出さない
            const withReason = records.filter(r => !isBlank(r.win_reason));
            if (withReason.length === 0) return <span className="cs_num cs_contract">{count}</span>;
            return (
                <button
                    type="button"
                    className="cs_num cs_contract cs_click"
                    title={`クリックで勝因を表示（${withReason.length}件）`}
                    onClick={() => openCards(`${makerName} に勝った案件`, WIN_FIELDS, withReason)}
                >
                    {count}
                </button>
            );
        }

        if (type === 'lose') {
            return (
                <button
                    type="button"
                    className="cs_num cs_lose cs_click"
                    title="クリックで敗因を表示"
                    onClick={() => openCards(`${makerName} に負けた案件`, LOSE_FIELDS, records)}
                >
                    {count}
                </button>
            );
        }

        return <span className={`cs_num ${type === 'follow' ? 'cs_follow' : 'cs_total'}`}>{count}</span>;
    };

    const brandCells = (metrics: Metrics, makerName: string, first = false) => (
        <>
            <td className={first ? '' : 'cs_sep'}>{renderCountCell(metrics.total, 'total', makerName)}</td>
            <td>{renderCountCell(metrics.contract, 'contract', makerName)}</td>
            <td>{renderCountCell(metrics.lose, 'lose', makerName)}</td>
            <td>{renderCountCell(metrics.follow, 'follow', makerName)}</td>
        </>
    );

    const subHeaders = (first = false) => (
        <>
            <th className={`cs_th cs_th_sub ${first ? '' : 'cs_sep'}`}>総数</th>
            <th className="cs_th cs_th_sub">契約</th>
            <th className="cs_th cs_th_sub">失注</th>
            <th className="cs_th cs_th_sub">追客</th>
        </>
    );

    /** ⚠️ 列の総数。⚠️ 「該当なし」の colSpan に使う（ずれると表が崩れる） */
    const columnCount = 1 + (BRANDS.length + 1) * 4;

    return (
        <div className="cs_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**。
                 *   ⚠️ 余白はこちらで持ち、**表だけがスクロールする**形にする。
                 *   ⚠️ height:100% と min-height:0 を外すと表が画面外へ出る。
                 */
                .cs_wrap { font-size: 13px; color: #1f2937;
                           height: 100%; display: flex; flex-direction: column;
                           padding: 16px 32px 20px; box-sizing: border-box; }
                .cs_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .cs_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .cs_note { font-size: 11px; color: #6b7280; }

                .cs_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .cs_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .cs_select, .cs_input {
                    border: 1px solid #d8dee6; border-radius: 8px; height: 32px;
                    color: #1f2937; font-size: 12px; background: #fff; outline: none;
                    padding: 0 8px; }
                .cs_select:focus, .cs_input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px #dbeafe; }

                /* ⚠️ 表。⚠️ 見出しと総数行と先頭列を固定する。
                      ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」 */
                .cs_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .cs_table { border-collapse: separate; border-spacing: 0; font-size: 12px;
                            min-width: 1300px; width: 100%; text-align: center; }
                .cs_th { position: sticky; top: 0; z-index: 3; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 7px 10px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                /* ⚠️ 2段目の見出し。⚠️ top を1段目の高さぶん下げないと重なる */
                .cs_th_sub { top: 30px; z-index: 3; font-size: 10px; }
                /* ⚠️ 先頭列。⚠️ 横スクロールしても競合他社名が見えるようにする */
                .cs_name_th { left: 0; z-index: 5; border-right: 2px solid #e5e7eb; text-align: left; }
                .cs_name_td { position: sticky; left: 0; z-index: 2; background: #fff;
                              border-right: 2px solid #e5e7eb; text-align: left;
                              font-weight: 700; color: #111827; white-space: nowrap;
                              padding: 7px 10px; }
                .cs_td { border-bottom: 1px solid #f1f5f9; padding: 6px 10px; }
                .cs_row:hover > td { background: #f8fafc; }
                /* ⚠️ ブランドの区切り。⚠️ 無いと28列が地続きに見えて読めない */
                .cs_sep { border-left: 2px solid #e5e7eb; }

                /**
                 * ⚠️⚠️ **総数行**。⚠️ 見出しのすぐ下に固定する（2026-09-18 の指示）。
                 *   ⚠️ top は1段目＋2段目の高さ。⚠️ ずらすと見出しに重なる。
                 */
                .cs_total_row > td { position: sticky; top: 56px; z-index: 2;
                                     background: #eff6ff; border-bottom: 2px solid #bfdbfe;
                                     font-weight: 700; }
                .cs_total_row > .cs_name_td { z-index: 4; background: #eff6ff; }

                .cs_num { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }
                .cs_total { color: #2563eb; }
                .cs_contract { color: #059669; }
                .cs_lose { color: #dc2626; }
                .cs_follow { color: #d97706; }
                .cs_zero { color: #cbd5e1; font-variant-numeric: tabular-nums; }
                /* ⚠️ 押せることを下線で示す。⚠️ 色だけでは分からない */
                .cs_click { background: none; border: none; padding: 0;
                            cursor: pointer; text-decoration: underline dotted; }
                .cs_click:hover { text-decoration: underline solid; }

                /* カードのグリッド。⚠️ 幅に合わせて自動で折り返す */
                .cs_cards { display: grid; gap: 10px;
                            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
                .cs_card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px;
                           background: #fff; }
                .cs_card_head { display: flex; align-items: baseline; gap: 8px;
                                border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;
                                margin-bottom: 6px; }
                .cs_card_name { font-weight: 700; font-size: 13px; color: #111827; }
                .cs_card_shop { font-size: 10px; color: #6b7280; }
                /* ⚠️ 担当店舗と反響媒体。⚠️ 自由記述と見分けがつくよう小さな札で出す */
                .cs_meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
                .cs_chip { font-size: 10px; color: #4b5563; background: #f3f4f6;
                           border-radius: 999px; padding: 2px 8px; white-space: nowrap; }

                .cs_field { margin-bottom: 6px; }
                .cs_field_label { font-size: 10px; color: #6b7280; font-weight: 700; }
                /* ⚠️ 改行と長い語を折り返す。⚠️ 自由記述なので1語が長いことがある */
                .cs_field_value { font-size: 12px; line-height: 1.6; white-space: pre-wrap;
                                  word-break: break-word; color: #1f2937; }
                .cs_empty { color: #9ca3af; font-size: 12px; }

                .cs_page { display: flex; justify-content: center; gap: 4px; margin-top: 10px; }
                .cs_page button { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px;
                                  font-size: 12px; padding: 3px 10px; color: #374151; }
                .cs_page button:disabled { color: #cbd5e1; }
                .cs_page button.is_active { background: #2563eb; border-color: #2563eb; color: #fff;
                                            font-weight: 700; }
            `}</style>

            <div className="cs_head mb-2">
                <span className="cs_title">
                    <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
                    競合サマリー
                </span>
                {/* ⚠️⚠️ 縦に足しても総数行にならない理由を必ず出す。
                       書かないと「集計が壊れている」と受け取られる */}
                <span className="cs_note">
                    ※ 1件の案件に競合が複数いる場合、それぞれの行に数えられます（各行の合計は総数と一致しません）
                </span>
            </div>

            {error !== '' && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="cs_bar mb-3">
                        <div>
                            <div className="cs_label">営業課</div>
                            <select
                                className="cs_select" style={{ width: '180px' }}
                                value={targetSection}
                                onChange={(e) => { setTargetSection(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">全課を表示</option>
                                {/* ⚠️ 課の一覧は master ではなく画面に直書きのまま（改修前から）。
                                       ⚠️ 触ると絞り込みの挙動が変わるので今回は残す */}
                                {['鹿児島営業1課', '鹿児島営業2課', '鹿児島営業3課',
                                    '宮崎営業課', '熊本営業課', '大分・佐賀営業課'].map(s =>
                                        <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="cs_label">店舗</div>
                            <select
                                className="cs_select" style={{ width: '200px' }}
                                value={targetShop}
                                onChange={(e) => { setTargetShop(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">全店舗を表示</option>
                                {shops.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="cs_label">競合名検索</div>
                            <input
                                type="text" className="cs_input" style={{ width: '200px' }}
                                placeholder="名称を入力..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <span className="cs_note ms-auto pb-1">
                            該当 {searchedList.length} 件／
                            <span className="fw-bold">契約・失注の数字はクリックできます</span>
                        </span>
                    </div>

                    <div className="cs_table_wrap">
                        <table className="cs_table">
                            <thead>
                                <tr>
                                    <th rowSpan={2} className="cs_th cs_name_th">競合他社名</th>
                                    <th colSpan={4} className="cs_th">KHG</th>
                                    {BRANDS.map(b => (
                                        <th key={b.key} colSpan={4} className="cs_th cs_sep">{b.label}</th>
                                    ))}
                                </tr>
                                <tr>
                                    {subHeaders(true)}
                                    {BRANDS.map(b => <React.Fragment key={b.key}>{subHeaders()}</React.Fragment>)}
                                </tr>
                            </thead>
                            <tbody>
                                {/* ⚠️⚠️ **総数行は見出しのすぐ下**（2026-09-18 の指示）。
                                       ⚠️ 競合ごとの行と混ざらないよう色と太字で分ける */}
                                <tr className="cs_total_row">
                                    <td className="cs_name_td">{totalLabel}</td>
                                    {brandCells(totalsRow.khg, totalLabel, true)}
                                    {BRANDS.map(b => (
                                        <React.Fragment key={b.key}>
                                            {brandCells(totalsRow[b.key], totalLabel)}
                                        </React.Fragment>
                                    ))}
                                </tr>

                                {paginatedList.length > 0 ? paginatedList.map((row, index) => (
                                    <tr className="cs_row" key={`${row.name}-${index}`}>
                                        <td className="cs_name_td">{row.name}</td>
                                        {brandCells(row.metrics.khg, row.name, true)}
                                        {BRANDS.map(b => (
                                            <React.Fragment key={b.key}>
                                                {brandCells(row.metrics[b.key], row.name)}
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td className="cs_td cs_empty py-4" colSpan={columnCount}>
                                            該当するデータがありません
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="cs_page">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>前へ</button>
                            {pageNumbers.map(page => (
                                <button key={page} className={currentPage === page ? 'is_active' : ''}
                                    onClick={() => setCurrentPage(page)}>{page}</button>
                            ))}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>次へ</button>
                        </div>
                    )}
                </>
            )}

            {/**
              * ⚠️⚠️ **案件ごとのカード**（2026-09-18 の指示）。
              *   ⚠️ 勝ち（契約列）と負け（失注列）で**出す項目だけ**が違う。
              *   ⚠️ 2026-09-18 まではここに「失注理由の件数集計表」を出していたが、
              *     ⚠️ **カードへ置き換えた**（利用者の決定）。
              */}
            <Modal
                show={cardModal.show}
                onHide={() => setCardModal(prev => ({ ...prev, show: false }))}
                size="xl"
                centered
                scrollable
            >
                <Modal.Header closeButton className="border-bottom-0 pb-0">
                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>
                        {cardModal.title}
                        <span className="ms-2 text-muted" style={{ fontSize: '12px', fontWeight: 400 }}>
                            {cardModal.records.length}件
                        </span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ maxHeight: '75vh' }}>
                    {cardModal.records.length === 0 ? (
                        <div className="cs_empty py-3">データがありません</div>
                    ) : (
                        <div className="cs_cards">
                            {cardModal.records.map((record, index) => {
                                // ⚠️ 空の項目は行ごと出さない。⚠️ 空行だらけのカードは読めない
                                const filled = cardModal.fields.filter(f => !isBlank(record[f.key]));
                                return (
                                    <div className="cs_card" key={record.id || index}>
                                        <div className="cs_card_head">
                                            <span className="cs_card_name">{record.customer || '(氏名なし)'}</span>
                                            <span className="cs_card_shop">{record.staff}</span>
                                        </div>
                                        {/**
                                          * ⚠️⚠️ **担当店舗と反響媒体は勝ち・負けの両方で出す**（2026-09-18 の指示）。
                                          *   ⚠️ `shop` は `in_charge_store`、`medium` は `sales_promotion_name` の別名。
                                          *   ⚠️ **自由記述の項目より上に置く。** どの店舗のどの反響かが
                                          *     先に分からないと、勝因・敗因だけ読んでも判断できない。
                                          */}
                                        <div className="cs_meta">
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-shop me-1" aria-hidden="true" />
                                                {record.shop || '店舗未設定'}
                                            </span>
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-bullhorn me-1" aria-hidden="true" />
                                                {isBlank(record.medium) ? '媒体未設定' : record.medium}
                                            </span>
                                        </div>
                                        {filled.length === 0 ? (
                                            <div className="cs_empty">まだ入力されていません</div>
                                        ) : filled.map(f => (
                                            <div className="cs_field" key={f.key}>
                                                <div className="cs_field_label">{f.label}</div>
                                                <div className="cs_field_value">
                                                    {record[f.key]}{f.unit ?? ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default CompetitorSummary;

```

---

## 検証

### ⚠️⚠️ ② と ① の SELECT が一致すること

⚠️ 両方のファイルから別名を機械的に取り出して突き合わせた。

| 確認 | 結果 |
|---|---|
| ② の列数 | ⚠️ **25** |
| ① の列数 | ⚠️ **25** |
| ⚠️ **順序まで完全一致** | ⚠️ **OK** |

⚠️ ⚠️ **列名を1つでも変えると、画面の表が全部0件になる**（エラーは出ない）。ここを機械で見ておく価値がある。

### SQL が通ること

⚠️ 移植した `CONTRACT_SQL` をローカルDBへそのまま流した。

| 確認 | 結果 |
|---|---|
| 返る列 | ⚠️ **25列**（`win_reason` / `price_gap` / `sales_person` / `countermeasure` / `rival_campaign` / `customer` を含む） |

### ⚠️⚠️ ローカルDBの列が消えていた（作業中に気づいた）

⚠️ 検証中に `Unknown column 'competitor_win_reason'` が出た。
⚠️ ⚠️ **ローカルの MariaDB が1時間ほど前に作り直されており、v2.2.136 の5列が消えていた。**
⚠️ `2026-09-17_master_data_win_lose.sql` を流し直して復旧した。

⚠️⚠️ **本番でも同じことが起きる。** ⚠️ **SQL を先に流さないとこの画面は開かない。**
⚠️ 手順書の先頭に置いてある。

### ビルド・型

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（② Express） | ⚠️ **エラー0** |
| `npm run build`（フロント） | ⚠️ **成功**（`Compiled with warnings.`） |
| ⚠️ `CompetitorSummary.tsx` の警告 | ⚠️ **0件** |
| ⚠️ `Header.tsx` の警告 | ⚠️ **改修前からある1件のみ** |
| `php -l`（`competitor.php` / `express_proxy.php`） | ⚠️ **構文エラーなし** |

### ⚠️ 未実施

⚠️⚠️ **画面を開いての確認は未実施。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | 他社動向 → 競合サマリー | ⚠️ **全画面で開く**／⚠️ **左上に「閉じる」** |
| 2 | 横スクロール | ⚠️ **競合他社名の列と見出し2段が固定されたまま** |
| 3 | ⚠️ **総数行** | ⚠️ 見出しのすぐ下・⚠️ **青い帯**・⚠️ **`注文営業全体`** |
| 4 | 営業課／店舗を選ぶ | ⚠️ 総数行の名前が **`〇〇営業課全体` / `〇〇全体`** に変わる |
| 5 | ⚠️ **契約の数字** | ⚠️ 勝因がある競合では**点線の下線が付き押せる**／⚠️ **無ければ押せない** |
| 6 | ⚠️ 契約をクリック | ⚠️ **勝因・価格差・他社営業**のカード |
| 7 | ⚠️ 失注をクリック | ⚠️ **他決理由・敗因・価格差・他社営業・今後の対策・他社のキャンペーン**のカード |
| 8 | ⚠️ **カードの上部** | ⚠️ **店舗と反響媒体の札**が出る |
| 9 | 価格差 | ⚠️ **「万円」が付く** |
| 10 | ページ送り・検索 | ⚠️ **今までどおり動く** |
| 11 | ⚠️ ② を止める | ⚠️ **① へ退避して同じ画面が出る**（⚠️ 参照のみなので落ちない） |

---

## ⚠️ 残作業

⚠️ デプロイ手順は [deploy-v2.2.137.md](deploy-v2.2.137.md) に**追記してある**。

| # | 内容 |
|---|---|
| 1 | ⚠️ 上の**画面での確認** |
| 2 | ⚠️⚠️ **本番に v2.2.136 の `2026-09-17_master_data_win_lose.sql` が入っていること**（⚠️ **未適用なら先に**） |
| 3 | ⚠️ ① で `2026-09-18_medium_kaeru_show_graph_web.sql` |
| 4 | push → PR → `production` |
| 5 | ⚠️ **② VPS で Express を再ビルド**（⚠️ **今回から必要**。`competitor.ts` を足したため） |
| 6 | ⚠️ ① へフロント ⚠️ **＋ PHP 2ファイル**（`express_proxy.php` / `competitor.php`） |
| 7 | ⚠️ ① で `2026-09-18_update_log_2.2.137.sql` |

⚠️ ⚠️ **v2.2.137 は当初「フロントと DB のみ」だったが、この指示で ② と ① の PHP も対象になった。**

---

## ⚠️ 追補（2026-09-18）　モーダルの表記・配色・項目の整理

⚠️ 依頼: 「モーダルのタイトル `〜に負けた案件` → ⚠️ **`{競合会社名} 失注一覧`**／
⚠️ **文字のカラーをもう少しだけくすんだ感じに**／⚠️ **`in_charge_user`・`customer_contacts_name` の表示は不要**」

### 変更

| # | 内容 |
|---|---|
| 1 | ⚠️ 失注モーダルのタイトルを **`{競合会社名} 失注一覧`** に |
| 2 | ⚠️ カードの**お客様名と担当営業を出さない**（⚠️ カードの見出し行ごと削除） |
| 3 | ⚠️ **文字色を1段ずつくすませた** |

### ⚠️ 配色（1段ずつ落とした）

| 場所 | 変更前 | ⚠️ 変更後 |
|---|---|---|
| モーダルの見出し | `#374151` | ⚠️ **`#565f6b`** |
| 件数 | `text-muted` | ⚠️ **`#8b95a1`** |
| 項目名（勝因・敗因など） | `#6b7280` | ⚠️ **`#8b95a1`** |
| 本文（自由記述） | `#1f2937` | ⚠️ **`#4b5563`** |
| 札（店舗・反響媒体） | `#4b5563` / 背景 `#f3f4f6` | ⚠️ **`#6b7280`** / 背景 `#f5f6f8` |

⚠️⚠️ **これ以上薄くしないこと。** ⚠️ 本文が読めなくなる。

### ⚠️ 個人が特定できる情報を出さない

```tsx
                                        {/**
                                          * ⚠️⚠️ **お客様名（customer_contacts_name）と担当営業（in_charge_user）は出さない**
                                          *   （2026-09-18 の指示）。⚠️ **個人が特定できる情報を並べない。**
                                          *   ⚠️ ここは「どう勝ったか・どう負けたか」を読む場所である。
                                          *   ⚠️ ② / ① の SELECT には `customer` と `staff` が**残してある**。
                                          *     ⚠️ 応答の形を変えると ① との差分になるため。**画面で出さないだけ。**
                                          */}
```

⚠️⚠️ **SELECT からは外していない。**
⚠️ ⚠️ **応答の形（キーの並び）を変えると ① との差分になる。** ⚠️ 画面で出さないだけにしてある。

### ⚠️ モーダルのタイトル（⚠️ **両方とも揃えた**）

| モーダル | タイトル |
|---|---|
| 契約（契約列） | ⚠️ **`{競合会社名} 契約一覧`** |
| 失注（失注列） | ⚠️ **`{競合会社名} 失注一覧`** |

⚠️ ⚠️ **片方だけ変えないこと。** ⚠️ 並びの不揃いは、同じ表から開く2つのモーダルでは
⚠️ **別の機能に見えてしまう。**

```tsx
                    // ⚠️ 表記は「{競合会社名} 契約一覧」。⚠️ **失注側と揃えてある**（2026-09-18 の指示）
                    onClick={() => openCards(`${makerName} 契約一覧`, WIN_FIELDS, withReason)}
```

```tsx
                    // ⚠️ 表記は「{競合会社名} 失注一覧」（2026-09-18 の指示）
                    onClick={() => openCards(`${makerName} 失注一覧`, LOSE_FIELDS, records)}
```

### 検証

| 確認 | 結果 |
|---|---|
| `npm run build` | ⚠️ **成功** |
| ⚠️ `CompetitorSummary.tsx` の警告 | ⚠️ **0件** |
| ⚠️ 削除漏れ（`cs_card_head` / `record.customer` / `record.staff`） | ⚠️ **残っていないことを確認済み** |
| ⚠️ **画面での確認** | ⚠️ **未実施** |
