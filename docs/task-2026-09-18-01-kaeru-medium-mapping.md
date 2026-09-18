# 指示（2026-09-18）　建売の販促媒体の表記統一とKPIの見直し

⚠️ 依頼（`ReadMeClaude.md` 要旨）: 「v2.2.137 で作業。`customer/CustomerKaeru.tsx` の改修。
⚠️ **販促媒体の表記のブレを Mapping 処理で統一**（`master_data_kaeru.sales_promotion_name` /
`medium_kaeru` / `budget` でそれぞれ異なるので ⚠️ **`medium_kaeru` を基準**に）。
⚠️ マッピングリストに無いものは**そのまま表示・突合で OK**。
⚠️ **KPI を『総反響 接触数 来場 申込 契約』の表記に**。⚠️ **来場率・申込率・契約率も追記**（⚠️ **左の歩留まりを分母**）。
⚠️ **この KPI に合わせた単価**（総予算列を各KPIの歩留まりで割った値でよい）」

---

## ⚠️ 着手前に確認したこと（利用者が決定）

| # | 論点 | ⚠️ 決定 |
|---|---|---|
| 1 | ⚠️ 指示書は `ネット検索` だが実データは **`インターネット検索`**（¥98,218,945・販促費の最多）。顧客の最多 **`ネット` 4,892件** もリストに無い | ⚠️ **両方とも `Web検索` に含める** |
| 2 | ⚠️ `Instagram`・`Web検索` は `medium_kaeru.show_graph = 0` のため、統一しても独立行にならず「ホームページ反響」に入る | ⚠️ **行に出す**（`show_graph = 1` にする SQL を作る） |

---

## ⚠️ 実データ（ローカルDB・2026-09-18）

### 顧客（`master_data_kaeru.sales_promotion_name` / `show_dashboard = 1` の 8,391件）

| 値 | 件数 | 寄せ先 |
|---|---|---|
| ⚠️ **`ネット`** | ⚠️ **4,892** | ⚠️ **Web検索** |
| `SUUMO` | 1,043 | （そのまま） |
| `アットホーム` / `athome` | 292 / 12 | アットホーム |
| `ALLGRIT` / `公式LINE` | 286 / 11 | 公式LINE |
| `Instagram` / `Facebook` | 261 / 4 | Instagram |
| `Web検索` | 212 | （そのまま） |

### 販促費（`budget` / `section = 'spec'`・⚠️ **店舗で絞った後 ¥262,924,157**）

| 値 | 金額 | 寄せ先 |
|---|---|---|
| ⚠️ **`インターネット検索`** | ⚠️ **¥98,218,945** | ⚠️ **Web検索** |
| `SNS広告` | ¥88,081,670 | Instagram |
| `SUUMO` | ¥64,510,348 | （そのまま） |
| `athome` | ¥13,226,806 | アットホーム |
| `カゴスマ` | ¥605,022 | カゴスマ・タテルヤ |

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/customer/` | ⚠️ `customerKaeruUtils.ts`（⚠️ **新規**） | 表記の対応表と正規化 |
| `frontend/src/components/customer/` | `CustomerKaeru.tsx` | 突合に正規化を通す／KPIの列を増やす |
| `frontend/src/components/shop/` | `unitPriceSeries.ts` | ⚠️ **`UNIT_PRICE_SERIES_SPEC_FULL` を追加**（来場単価つき5本） |
| `frontend/src/utils/` | `version.ts` | `2.2.137` |
| `backend/scripts/sql/` | ⚠️ `2026-09-18_medium_kaeru_show_graph_web.sql`（⚠️ **新規**） | Instagram・Web検索 を行に出す |
| `backend/scripts/sql/` | ⚠️ `2026-09-18_update_log_2.2.137.sql`（⚠️ **新規**） | 更新履歴 |

## 追加した定数・関数

| 名前 | ファイル |
|---|---|
| `MEDIUM_ALIAS` | `customerKaeruUtils.ts` |
| `cleanMedium()` | `customerKaeruUtils.ts` |
| ⚠️ `normalizeMedium()` | `customerKaeruUtils.ts` |
| ⚠️ `shownMediums`（`useMemo`） | `CustomerKaeru.tsx` |
| `rate()`（`aggregated` の中） | `CustomerKaeru.tsx` |
| ⚠️ `UNIT_PRICE_SERIES_SPEC_FULL` | `shop/unitPriceSeries.ts` |

---

## ⚠️ 実装で踏んだ落とし穴

### ⚠️⚠️ 表記を寄せると**二重計上**が起きる

⚠️ `medium_kaeru` には **`ネット広告`（`show_graph = 0`）** と **`Web検索`（今回 `1` にした）** が
別の行として存在する。⚠️ **`ネット広告` は `Web検索` に寄る。**

⚠️ そのままだと ⚠️ **`Web検索` が「表示する行」と「まとめる行」の両方に入り**、
⚠️ **同じ顧客と同じ販促費が2回数えられる。**

⚠️ ⚠️ **エラーは出ず、合計だけが増える**という気づきにくい壊れ方をする。
⚠️ `Facebook`（0）→ `Instagram`（1）でも同じことが起きる。

⚠️ 対処: ⚠️ **まとめ側から「表示する行と同じ名前になったもの」を外す。**

```tsx
    const groupedMediums = useMemo(
        () => [...new Set(
            mediumArray.filter(m => Number(m.show_graph) !== 1).map(m => normalizeMedium(m.medium))
        )]
            .filter(medium => !shownMediums.includes(medium)),
        [mediumArray, shownMediums]
    );
```

### ⚠️ 行の名前も重複する

⚠️ `Instagram` と `Facebook` はどちらも `Instagram` になるため、⚠️ **同じ名前の行が2つ並ぶ。**
⚠️ `new Set` で落としてある。

---

## ⚠️ KPI の変更

| 列 | 分母 | いつから |
|---|---|---|
| 接触率 | 総反響 | 従来 |
| ⚠️ **来場率** | ⚠️ **接触数** | ⚠️ **新規** |
| ⚠️ **申込率** | ⚠️ **来場** | ⚠️ **新規** |
| ⚠️ 契約率 | ⚠️ **申込**（⚠️ 従来は**接触数**） | ⚠️ **変更** |

⚠️ 表記も変えた（`来場・案内` → **`来場`** ／ `申込数` → **`申込`** ／ `契約数` → **`契約`**）。

⚠️ 単価は ⚠️ **総予算 ÷ その工程の件数**。⚠️ **来場単価が増えて5本**になった。
⚠️ 工程ごとに予算を割り振ってはいない。⚠️ **分母だけが変わる。**

### ⚠️⚠️ `ShopKaeru.tsx` と食い違う点

⚠️ `CustomerKaeru.tsx` の冒頭には「⚠️ **片方を直したら必ず両方直すこと**」と書いてある。
⚠️ しかし今回の指示は ⚠️ **`CustomerKaeru.tsx` だけ**が対象なので、⚠️ **あちらは触っていない。**

| | CustomerKaeru（今回） | ShopKaeru（従来のまま） |
|---|---|---|
| 契約率の分母 | ⚠️ **申込** | ⚠️ **接触数** |
| 来場率・申込率 | ⚠️ **ある** | ⚠️ **無い** |
| 単価グラフの系列 | ⚠️ **5本**（来場単価つき） | ⚠️ **4本** |

⚠️ ⚠️ **同じ「契約率」でも画面によって数字が違う。**
⚠️ 揃えるかどうかは ⚠️ **別の指示を待つ**（勝手に変えない）。
⚠️ 揃える場合は `ShopKaeru.tsx` の `perContract` と `headCell('契約率', …)` を直し、
⚠️ グラフの系列を `UNIT_PRICE_SERIES_SPEC_FULL` に差し替える。

---

## `frontend/src/components/customer/customerKaeruUtils.ts`（⚠️ 新規・全文）

```ts
/**
 * 建売分譲事業の販促媒体の表記ゆれをまとめる（customer/CustomerKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **3つのテーブルで同じ媒体が別の名前で入っている**（2026-09-18 の指示）。
 *     master_data_kaeru.sales_promotion_name … 顧客が選んだ反響媒体
 *     medium_kaeru                            … ⚠️ **基準にする名前**
 *     budget.medium                           … 販促費
 *   ⚠️ 突合できないと**分子（顧客）と分母（販促費）が別の行に乗り**、
 *     単価がまるで合わなくなる。
 *
 * ⚠️⚠️ **`medium_kaeru` の名前を正とする。** 画面の行もこの名前で出る。
 *
 * ⚠️ 対応表に無いものは**そのまま**扱う（`SUUMO` / `HOME'S` / `チラシ` など。指示）。
 * ─────────────────────────────────────────────
 */

/**
 * 正式名 → その名前として扱う値の一覧。
 *
 * ⚠️⚠️ **キーは `medium_kaeru.medium` に実在する名前にすること。**
 *   ⚠️ 実在しない名前を作ると、⚠️ **その行が画面に出てこない**
 *     （行は `medium_kaeru` から作るため）。
 *
 * ⚠️⚠️ **`インターネット検索` と `ネット` を `Web検索` に入れている**（2026-09-18 に利用者が決定）。
 *   ⚠️ 指示書の原文は `ネット検索` だったが、⚠️ **実データは `インターネット検索`** で
 *     ⚠️ **販促費の最多（¥98,218,945／全体の35%）**である。1文字違いで丸ごと漏れていた。
 *   ⚠️ 顧客側の `ネット` は ⚠️ **4,892件（建売の反響の59%）**で、これも漏れていた。
 *
 * ⚠️ `Youtube` は `medium_kaeru` では `YouTube`（T が大文字）である。
 *   ⚠️ **両方を書いておく。** 大文字小文字を無視する作りにはしていない
 *     （`HOME'S` のような記号混じりで思わぬ一致を生むため）。
 */
export const MEDIUM_ALIAS: Record<string, string[]> = {
    'アットホーム': ['アットホーム', 'athome'],
    'Instagram': ['Instagram', 'SNS広告', 'Facebook'],
    'Web検索': [
        'Web検索', 'WEB検索', 'ネット検索', 'ネット広告',
        // ⚠️ 2026-09-18 に追加（利用者の決定）
        'インターネット検索', 'ネット',
    ],
    'カゴスマ・タテルヤ': ['カゴスマ・タテルヤ', 'カゴスマ'],
    '公式LINE': ['公式LINE', 'ALLGRIT'],
    'その他': ['その他', 'テレビCM', '住宅展示場', 'Yahoo!不動産', 'Youtube', 'YouTube'],
};

/**
 * 値 → 正式名 の引き当て表。
 *
 * ⚠️ 毎回 `Object.entries` を回すと行数×顧客数だけ繰り返すことになるので、
 *   ⚠️ **読み込み時に1度だけ作る。**
 */
const CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MEDIUM_ALIAS)) {
    for (const alias of aliases) CANONICAL.set(alias, canonical);
}

/**
 * 媒体名の掃除。
 *
 * ⚠️⚠️ **実データには末尾の空白と改行が混ざっている。**
 *   ⚠️ 掃除せずに比べると**静かに落ちる**（エラーは出ず、件数がわずかに減るだけ）。
 * ⚠️ budgetSimulatorUtils.ts の `cleanMedium()` と同じ考え方である。
 */
export const cleanMedium = (value: string): string =>
    (value ?? '').replace(/[\r\n]/g, '').trim();

/**
 * 表記を `medium_kaeru` の名前に揃える。
 *
 * ⚠️⚠️ **対応表に無いものはそのまま返す**（指示）。
 *   ⚠️ 勝手に「その他」へ寄せない。⚠️ **寄せると、拾えていないことに気づけなくなる。**
 *
 * ⚠️⚠️ **`Instagram、Web検索` のような複数選択はそのまま返る。**
 *   ⚠️ 実データに約50件ある。⚠️ **どの行にも乗らない**（数え方が未決のため）。
 *   ⚠️ 総反響の行には入るので、⚠️ **媒体別の合計と総反響は一致しない。**
 */
export const normalizeMedium = (value: string): string => {
    const cleaned = cleanMedium(value);
    return CANONICAL.get(cleaned) ?? cleaned;
};

```

---

## `backend/scripts/sql/2026-09-18_medium_kaeru_show_graph_web.sql`（⚠️ 新規・全文）

```sql
-- ---------------------------------------------------------------------------
-- Instagram と Web検索 を販促媒体別の行に出す（2026-09-18 の指示）
--
-- ⚠️⚠️ **画面のコードは変えていない。** 行は `medium_kaeru.show_graph = 1` から作る。
--   ⚠️ 表記ゆれを寄せた結果、この2つに大きな販促費が集まるようになったため、
--     ⚠️ **「ホームページ反響」に埋もれさせない。**
--
-- ⚠️ ローカルの実測（2026-09-18 / budget / section = 'spec'）
--     Instagram（SNS広告 を寄せた分）   ¥88,081,670
--     Web検索（インターネット検索 を寄せた分） ¥98,218,945
--   ⚠️ 合計 **¥186,300,615**（⚠️ 建売の販促費 ¥282,481,113 の **66%**）が
--     ⚠️ **1行にまとまって見えなくなっていた。**
--
-- ⚠️⚠️ **`show_graph = 1` を増やすと「ホームページ反響」の行はその分だけ減る。**
--   ⚠️ 総反響の行は変わらない。**合計が合わなくなったわけではない。**
--
-- ⚠️ 表記の寄せ先は frontend/src/components/customer/customerKaeruUtils.ts の
--   `MEDIUM_ALIAS`。⚠️ **片方だけ変えないこと。**
--
-- ⚠️ 実行先は ⚠️ **① レンタルサーバー（Xserver）の phpMyAdmin**。
-- ---------------------------------------------------------------------------

UPDATE medium_kaeru
   SET show_graph = 1
 WHERE medium IN ('Instagram', 'Web検索');

-- ⚠️ 確認。⚠️ **6件が 1 になっていること**
--   （SUUMO / HOME'S / アットホーム / 公式LINE / Instagram / Web検索）
-- SELECT no, medium, show_graph FROM medium_kaeru ORDER BY show_graph DESC, no;
```

## `frontend/src/components/shop/unitPriceSeries.ts`（追加分）

```ts
/**
 * 建売分譲事業・来場単価つき（customer/CustomerKaeru.tsx）。
 *
 * ⚠️⚠️ **2026-09-18 に KPI を 総反響 → 接触 → 来場 → 申込 → 契約 の5段階にした**（指示）。
 *   ⚠️ 上の `UNIT_PRICE_SERIES_SPEC`（4本）は ⚠️ **ShopKaeru.tsx がそのまま使っている。**
 *     ⚠️ あちらの表はまだ4段階なので、⚠️ **系列を足すと表と食い違う。**
 *     ⚠️ そのため**別の定数にしてある。**
 *
 * ⚠️ 来場単価の色は接触（緑）と申込（橙）の間に入れた。
 *   ⚠️ 工程の進み方が色でも読めるようにするため。**並びを入れ替えないこと。**
 */
export const UNIT_PRICE_SERIES_SPEC_FULL = [
    { key: 'registerUnit', label: '反響単価', color: '#4e79a7' },
    { key: 'contactUnit', label: '接触単価', color: '#59a14f' },
    { key: 'interviewUnit', label: '来場単価', color: '#8cb369' },
    { key: 'applicationUnit', label: '申込単価', color: '#f28e2b' },
    { key: 'contractUnit', label: '契約単価', color: '#e15759' },
] as const;
```

---

## ⚠️ `frontend/src/components/customer/CustomerKaeru.tsx`（⚠️ **全文**）

```tsx
import React, { useEffect, useMemo, useState, useContext } from 'react';
import Table from "react-bootstrap/Table";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import Category from '../Category';
import apiClient from '../../utils/apiClient';
// ⚠️ グラフは shop/ と共有する。X軸が店舗名か販促媒体名かだけが違う
import UnitPriceGraphModal from '../shop/UnitPriceGraphModal';
// ⚠️ 系列は5本（来場単価を含む）。⚠️ ShopKaeru.tsx は4本のままである
import { UNIT_PRICE_SERIES_SPEC_FULL } from '../shop/unitPriceSeries';
import { normalizeMedium } from './customerKaeruUtils';

/**
 * 販促媒体別ランキング（建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **shop/ShopKaeru.tsx を踏襲している**（2026-09-14 の指示）。
 *   違いは**行が店舗か販促媒体か**だけで、KPI も列の並びも同じにしてある。
 *   ⚠️ **片方を直したら必ず両方直すこと。**
 *
 * ⚠️⚠️ **2026-09-14 に KPI を建売のものへ直した。以前とは数字が変わる。**
 *   それまで中身は CustomerOrder.tsx とほぼ同じで、**注文事業の判定**
 *   （総反響 → 来場 → 契約／契約に「解約」を含む）を使っていた。
 *   ⚠️ 建売は 総反響 → 接触 → 来場・案内 → 申込み → 契約 で、
 *     契約は `status === '契約済み'` のみである。
 *
 *   ⚠️⚠️ **旧版は「申込み」の列を契約として数えていた。**
 *     建売の 01J82Z5F1RR18Z792C7KZS88QG は `application`（申込み）であり、
 *     契約は 01JP74NGRTT95X4Z8AQZ2QK2PW（＋仲介 01JV6AVXQMJY6XR4STWCHNKVE0）。
 *     ⚠️ 実測（2026-09-14 / show_dashboard = 1 の 8,321 件）で
 *       旧 435 件 → 新 **473 件**。**増える**。
 *       申込み日が空でも契約日が入っている顧客がいるためで、
 *       解約を除いた効果より、契約列を正しく見た効果のほうが大きい。
 *     ⚠️ ShopKaeru や CustomerTrendKaeru とはこれで一致する。
 *
 * ⚠️⚠️ **販促媒体が1つも表示されていなかった問題も直した。**
 *   `response.data.medium.filter(m => m.list_medium === 1)` としていたが、
 *   建売が受け取るのは `medium_kaeru` で、**`list_medium` 列が存在しない。**
 *   `undefined === 1` は常に false になり、表は「総反響」1行だけだった。
 *   ⚠️ エラーは出ないので気づきにくい壊れ方である。
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
type Shop = { id: number; brand: string; shop: string; section: string; area: string; }
/**
 * ⚠️ 実データ（medium_kaeru）は `id` ではなく **`no`** を返す。
 *   ⚠️ `show_graph` は 2026-09-11 に足した列。
 *     backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql を先に実行すること。
 */
type Medium = { id?: number; no?: number; medium: string; show_graph?: number | string }

/**
 * ⚠️⚠️ **`show_graph = 0` の媒体をまとめる行の名前。**
 *   ⚠️ 実在の媒体名と重ならないこと。`medium_kaeru` に同名があると
 *     その媒体だけ二重に数えられる。
 */
const HOMEPAGE_ROW = 'ホームページ反響';
type Section = { no: number, name: string }

const CustomerKaeru = () => {
    const { category } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<Customer[]>([]);
    const [originalBudgetList, setOriginalBudgetList] = useState<Budget[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [sortKey, setSortKey] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<string>('');
    const [sectionList, setSectionList] = useState<Section[]>([]);
    /** 単価グラフ（モーダル）。⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す */
    const [showGraph, setShowGraph] = useState<boolean>(false);

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                // ⚠️ 本番URLの直書きをやめた。apiClient が環境ごとの向き先を持つ
                const response = await apiClient.post("", { request: "customer", category });
                await setOriginalList(response.data.customer);
                await setShopArray(response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗')));
                // ⚠️⚠️ **絞らないこと。** medium_kaeru に `list_medium` 列は無く、
                //   以前の `filter(m => m.list_medium === 1)` は**常に空**になっていた。
                //   ⚠️ ShopTrendKaeru.tsx と同じく全件をそのまま行にする（指示）
                await setMediumArray(response.data.medium);
                await setOriginalBudgetList(response.data.budget);
                await setSectionList(response.data.section);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!originalList.length) return [];
        const areaValue = shopArray.find(item => item.area === selectedArea);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
        }

        return originalList.filter(item => {
            const targetDate = new Date(item.register.replace(/\//g, '-'));
            const sectionShops = shopArray.filter(s => s.section === selectedSection).map(s => s.shop);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop?.includes(selectedShop)) &&
                (!selectedSection || sectionShops.includes(item.shop)) &&
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });
    }, [originalList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);

    const filteredBudgets = useMemo(() => {
        if (!originalBudgetList.length) return [];
        const areaValue = shopArray.find(item => item.area === selectedArea);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
        }

        return originalBudgetList.filter(item => {
            const targetDate = new Date(item.budget_period);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop.includes(selectedShop)) &&
                (!selectedSection || item.order_section.includes(selectedSection)) &&
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });
    }, [originalBudgetList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);

    /**
     * ⚠️⚠️ **まとめる側の媒体（`show_graph = 0`）の名前一覧。**
     *   ⚠️ これらは1行「ホームページ反響」にまとめる（2026-09-16 の指示）。
     *   ⚠️ `Number()` を通すこと。DB から `"0"` / `"1"` の文字列で来ることがあり、
     *     `=== 1` の厳密比較だと**全部 false になって行が消える**。
     */
    /**
     * 独立した行として出す媒体（`show_graph = 1`）。
     * ⚠️ 表記を寄せたあとの名前。⚠️ **重複を落とす**（別名が同じ名前になるため）。
     */
    const shownMediums = useMemo(
        () => [...new Set(
            mediumArray.filter(m => Number(m.show_graph) === 1).map(m => normalizeMedium(m.medium))
        )],
        [mediumArray]
    );

    const groupedMediums = useMemo(
        () => [...new Set(
            mediumArray.filter(m => Number(m.show_graph) !== 1).map(m => normalizeMedium(m.medium))
        )]
            /**
             * ⚠️⚠️ **表示する行と同じ名前になったものは、まとめ側から外す。**
             *   ⚠️ 2026-09-18 の表記統一で**実際に起きる**。
             *     `ネット広告`（show_graph = 0）→ `Web検索`（show_graph = 1）
             *     `Facebook`（show_graph = 0）→ `Instagram`（show_graph = 1）
             *   ⚠️ 外さないと ⚠️ **同じ顧客が「Web検索」と「ホームページ反響」の
             *     両方に数えられる**（販促費も同じく二重に足される）。
             *   ⚠️ エラーは出ず、⚠️ **合計だけが増える**という気づきにくい壊れ方をする。
             */
            .filter(medium => !shownMediums.includes(medium)),
        [mediumArray, shownMediums]
    );

    /**
     * 表の行。
     *
     * ⚠️⚠️ **並びは「総反響 → show_graph=1 の媒体 → ホームページ反響」。**
     *   ⚠️ 総反響を先頭にするのは shop/ShopKaeru.tsx の「グループ全体」に揃えるため。
     *     グラフのX軸も同じ並びになるので、表と突き合わせられる。
     *   ⚠️ まとめ行は**末尾**。個別の媒体より先に出すと、内訳に見えて誤読される。
     *
     * ⚠️⚠️ **`show_graph` 列がまだ無いと、全媒体が「ホームページ反響」に入る。**
     *   ⚠️ `undefined` は `Number()` で NaN になり `!== 1` が真になるため。
     *   ⚠️ その場合は backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql
     *     が未実行。**表は出るので気づきにくい。**
     */
    const rows = useMemo<Medium[]>(() => {
        /**
         * ⚠️⚠️ **行の名前も統一してある**（2026-09-18。`shownMediums` を参照）。
         *   ⚠️ 表記ゆれを寄せた結果、⚠️ **同じ行が2つできることがある**
         *     （例: `Instagram` と `Facebook` はどちらも `Instagram` になる）。
         *   ⚠️ **重複は `shownMediums` で落としてある。**
         */
        const base: Medium[] = [
            { medium: '総反響' },
            ...shownMediums.map(medium => ({ medium })),
        ];
        // ⚠️ まとめる媒体が1つも無ければ、空の行を作らない
        return groupedMediums.length > 0 ? [...base, { medium: HOMEPAGE_ROW }] : base;
    }, [shownMediums, groupedMediums]);

    /** 単価。⚠️ 分母が0や未定義なら null（表では '-'、グラフでは 0） */
    const unitPrice = (budget: number, count: number): number | null =>
        isFinite(budget / count) ? Math.round(budget / count) : null;

    const aggregated = useMemo(() => {
        /**
         * ⚠️⚠️ **「総反響」は先頭に置く。**
         *   2026-09-14 まで末尾だった。shop/ShopKaeru.tsx の「グループ全体」に
         *   揃えてある。⚠️ グラフのX軸も同じ並びになるので、表と突き合わせられる。
         */
        return rows.map(value => {
            /**
             * ⚠️⚠️ **行ごとに拾う顧客の決め方が3通りある。**
             *   総反響           … 全部
             *   ホームページ反響 … ⚠️ `show_graph = 0` の媒体**だけ**の合計
             *   それ以外         … その媒体だけ
             *
             * ⚠️ 「総反響から show_graph=1 の分を引く」形にはしていない。
             *   ⚠️ 媒体が空だったり medium_kaeru に無い値の反響が混ざると、
             *     引き算では**それらが黙って「ホームページ反響」に入る。**
             *   ⚠️ 足し算なら、拾えていない反響は表に出ない＝気づける。
             */
            const base = filteredCustomers.filter(c => {
                if (value.medium === '総反響') return true;
                // ⚠️⚠️ **必ず normalizeMedium を通してから比べる**（2026-09-18）。
                //   ⚠️ 顧客側は `athome` / `ALLGRIT` / `ネット` のように別名で入っている
                const medium = normalizeMedium(c.medium);
                if (value.medium === HOMEPAGE_ROW) return groupedMediums.includes(medium);
                return medium === value.medium;
            });

            /**
             * ⚠️⚠️ **判定は shop/ShopKaeru.tsx の `filteredValue()` と同じもの。**
             *
             * ⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
             *   接触日が空でも契約済みなら「接触した」はずである。
             *   日付の入力漏れで歩留まりが逆転する（契約数 > 申込数 など）のを防ぐ。
             *
             * ⚠️ `tour`（物件案内）は来場と同じ段階として扱う。
             * ⚠️ `contract_broker`（仲介契約）も契約に含める。
             * ⚠️ 契約は `status === '契約済み'` のみ。**解約を含めない**
             *   （注文事業とはここが違う）。
             */
            const isContract = (b: Customer) => (b.contract || b.contract_broker) && b.status === '契約済み';
            const isApplication = (b: Customer) => b.application || isContract(b);
            const isInterview = (b: Customer) => b.interview || b.tour || isApplication(b);
            const isContact = (b: Customer) => b.contact || isInterview(b);

            const totalValue = base.length;
            const contactValue = base.filter(isContact).length;
            const interviewValue = base.filter(isInterview).length;
            const applicationValue = base.filter(isApplication).length;
            const contractValue = base.filter(isContract).length;

            /**
             * 歩留まり。
             *
             * ─────────────────────────────────────────────
             * ⚠️⚠️ **分母は「ひとつ左の工程」である**（2026-09-18 の指示）。
             *     接触率 = 接触 ÷ 総反響
             *     来場率 = 来場 ÷ 接触
             *     申込率 = 申込 ÷ 来場
             *     契約率 = 契約 ÷ 申込
             *   ⚠️ 総反響を分母にした「通過率」ではない。⚠️ **工程ごとの落ち方**を見る。
             *
             * ⚠️⚠️ **契約率の分母が変わった。** 2026-09-18 まで**接触数**だった。
             *   ⚠️ ⚠️ **shop/ShopKaeru.tsx は接触数のままである。**
             *     ⚠️ 同じ「契約率」でも**画面によって数字が違う。**
             *     ⚠️ あちらを揃えるかは別の指示を待つ（勝手に変えない）。
             *
             * ⚠️ 分母が0なら0%。⚠️ `Infinity` や `NaN` を画面に出さない。
             * ─────────────────────────────────────────────
             */
            const rate = (numerator: number, denominator: number): number =>
                denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

            const perContact = rate(contactValue, totalValue);
            const perInterview = rate(interviewValue, contactValue);
            const perApplication = rate(applicationValue, interviewValue);
            const perContract = rate(contractValue, applicationValue);

            /**
             * ランク別。
             * ⚠️⚠️ **status で絞らない。** 注文は `status === '見込み'` で絞るが、
             *   建売は `show_dashboard = 1` のものを**すべて見込みとして扱う**
             *   運用である（ShopKaeru.tsx / Company.tsx と同じ）。
             */
            const rankSValue = base.filter(item => item.rank === 'Sランク').length;
            const rankAValue = base.filter(item => item.rank === 'Aランク').length;
            const rankBValue = base.filter(item => item.rank === 'Bランク').length;
            const rankCValue = base.filter(item => item.rank === 'Cランク').length;

            // ⚠️ 販促費も行の決め方に合わせる。⚠️ 顧客と揃えないと単価が合わない
            const totalBudget = filteredBudgets
                .filter(item => {
                    if (value.medium === '総反響') return true;
                    // ⚠️ 販促費側は `SNS広告` / `インターネット検索` / `カゴスマ` で入っている
                    const medium = normalizeMedium(item.medium);
                    if (value.medium === HOMEPAGE_ROW) return groupedMediums.includes(medium);
                    return medium === value.medium;
                })
                .reduce((acc, cur) => acc + cur.budget_value, 0);

            return {
                value,
                totalValue,
                contactValue,
                interviewValue,
                applicationValue,
                contractValue,
                perContact,
                perInterview,
                perApplication,
                perContract,
                rankSValue,
                rankAValue,
                rankBValue,
                rankCValue,
                totalBudget,
                /**
                 * ⚠️ キー名は shop/unitPriceSeries.ts の
                 *   `UNIT_PRICE_SERIES_SPEC_FULL` と一致させること。
                 * ⚠️⚠️ **単価はどれも「総予算 ÷ その工程の件数」**（2026-09-18 の指示）。
                 *   ⚠️ 工程ごとに予算を割り振ってはいない。⚠️ **分母だけが変わる。**
                 */
                registerUnit: unitPrice(totalBudget, totalValue),
                contactUnit: unitPrice(totalBudget, contactValue),
                interviewUnit: unitPrice(totalBudget, interviewValue),
                applicationUnit: unitPrice(totalBudget, applicationValue),
                contractUnit: unitPrice(totalBudget, contractValue),
            };
        });
    }, [rows, groupedMediums, filteredCustomers, filteredBudgets]);

    /**
     * 単価グラフのデータ。
     * ⚠️ X軸は**販促媒体**。先頭が「総反響」になるよう aggregated の並びをそのまま使う。
     * ⚠️ 非表示のときは作らない。
     */
    const graphData = useMemo(() => {
        if (!showGraph) return [];
        return aggregated.map(item => ({
            medium: item.value.medium,
            // ⚠️ null のままだと recharts が棒を描かないので 0 に落とす
            registerUnit: item.registerUnit ?? 0,
            contactUnit: item.contactUnit ?? 0,
            interviewUnit: item.interviewUnit ?? 0,
            applicationUnit: item.applicationUnit ?? 0,
            contractUnit: item.contractUnit ?? 0,
        }));
    }, [aggregated, showGraph]);


    const sorted = useMemo(() => {
        const arr = [...aggregated];
        arr.sort((a, b) => {
            const getKey = (x) => {
                switch (sortKey) {
                    // ⚠️ キーは shop/ShopKaeru.tsx と揃えてある（建売のKPI）
                    case 'total': default: return x.totalValue;
                    case 'perContact': return x.perContact;
                    case 'contact': return x.contactValue;
                    // ⚠️ 2026-09-18 に来場率・申込率を足した
                    case 'perInterview': return x.perInterview;
                    case 'interview': return x.interviewValue;
                    case 'perApplication': return x.perApplication;
                    case 'application': return x.applicationValue;
                    case 'perContract': return x.perContract;
                    case 'contract': return x.contractValue;
                    case 'S': return x.rankSValue;
                    case 'A': return x.rankAValue;
                    case 'B': return x.rankBValue;
                    case 'C': return x.rankCValue;
                    case 'totalBudget': return x.totalBudget;
                    case 'registerBudget':
                        return isFinite(x.totalBudget / x.totalValue) ? Math.round(x.totalBudget / x.totalValue) : 0;
                    case 'contactBudget':
                        return isFinite(x.totalBudget / x.contactValue) ? Math.round(x.totalBudget / x.contactValue) : 0;
                    case 'interviewBudget':
                        return isFinite(x.totalBudget / x.interviewValue) ? Math.round(x.totalBudget / x.interviewValue) : 0;
                    case 'applicationBudget':
                        return isFinite(x.totalBudget / x.applicationValue) ? Math.round(x.totalBudget / x.applicationValue) : 0;
                    case 'contractBudget':
                        return isFinite(x.totalBudget / x.contractValue) ? Math.round(x.totalBudget / x.contractValue) : 0;
                }
            };
            const aVal = getKey(a);
            const bVal = getKey(b);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return arr;
    }, [aggregated, sortKey, sortOrder]);



    const handleSort = async (start: string, end: string, shop: string, section: string, area: string) => {
        await setStartMonth(start);
        await setEndMonth(end);
        await setSelectedShop(shop);
        await setSelectedSection(section);
        await setSelectedArea(area);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    const arrowStyle = { position: 'absolute' as const, right: '4px', cursor: 'pointer' as const, fontSize: '10px' };

    /** 見出しの期間表示。⚠️ ツールチップの文言に使う */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' && endMonth !== '' ? '' : '全期間'}`;

    /**
     * 見出しのセル。
     * ⚠️ shop/ShopKaeru.tsx の headCell と同じ形にしてある。
     * ⚠️ `plain` のときは並べ替えの矢印を出さない（販促媒体名の列）。
     */
    const headCell = (label: string, key: string, tip?: string, plain?: boolean) => (
        <td
            className={plain ? 'sticky-column budget' : undefined}
            style={{ position: 'relative', textAlign: 'center' }}
        >
            {tip ? (
                <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: '12px' }}>{tip}</Tooltip>}
                >
                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{label}</span>
                </OverlayTrigger>
            ) : label}
            {!plain && <>
                <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', key)}>▲</span>
                <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', key)}>▼</span>
            </>}
        </td>
    );

    /** 単価の表示。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */
    const unitText = (budget: number, count: number) =>
        isFinite(budget / count) ? `¥${Math.round(budget / count).toLocaleString()}` : '-';

    return (
        <>
            <div className='content customer bg-white p-2'>
                <div style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                <div className="d-flex flex-wrap mb-3">
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(event.target.value, endMonth, selectedShop, selectedSection, selectedArea)}>
                            <option value="" selected>開始月</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <span className='d-flex align-items-center mx-1'>～</span>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                            <option value="" selected>終了月</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, event.target.value, '', '')}>
                            <option value="">グループ全体</option>
                            {shopArray.map((item, index) => (
                                <option key={index} value={item.shop} selected={item.shop === selectedShop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, '', event.target.value, '')}>
                            <option value="" selected={selectedSection === ''}>注文営業全体</option>
                            {sectionList.map((section, index) =>
                                <option value={section.name} key={index}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, '', '', event.target.value)}>
                            <option value="" selected={selectedArea === ''}>全エリア</option>
                            <option value="鹿児島県" selected={selectedArea === '鹿児島県'}>鹿児島県</option>
                            <option value="宮崎県" selected={selectedArea === '宮崎県'}>宮崎県</option>
                            <option value="大分県" selected={selectedArea === '大分県'}>大分県</option>
                            <option value="熊本県" selected={selectedArea === '熊本県'}>熊本県</option>
                            <option value="佐賀県" selected={selectedArea === '佐賀県'}>佐賀県</option>
                        </select>
                    </div>
                </div>
                <div className="d-flex flex-wrap mb-3">
                    <div className="m-1">
                        {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す */}
                        <div className="bg-primary btn text-white rounded-pill px-3 py-1"
                            style={{ fontSize: '12px', letterSpacing: '1px' }}
                            onClick={() => setShowGraph(true)}>グラフを表示</div>
                    </div>
                </div>
                {/* ⚠️ X軸は販促媒体。`itemKey` を渡さないと店舗名を探して空になる */}
                <UnitPriceGraphModal
                    show={showGraph}
                    onHide={() => setShowGraph(false)}
                    data={graphData}
                    series={UNIT_PRICE_SERIES_SPEC_FULL}
                    title='建売分譲事業'
                    itemKey='medium'
                    itemLabel='販促媒体'
                />
                <div className="table-wrapper mt-3">
                    <div className="list_table">
                        <Table striped style={{ fontSize: '12px' }} bordered>
                            <tbody>
                                <tr className='sticky-header'>
                                    {/* ⚠️⚠️ 列の並びは shop/ShopKaeru.tsx と揃えてある。
                                           建売は「率 → 数」の順（注文の ShopOrder だけ「数 → 率」）。
                                           ⚠️ 片方だけ直すと画面ごとに並びが違って読み違える */}
                                    {headCell('販促媒体名', '', '', true)}
                                    {headCell('総反響', 'total', `${periodLabel}の総反響数`)}
                                    {/* ⚠️⚠️ **率の分母は「ひとつ左の工程」**（2026-09-18 の指示）。
                                           ⚠️ 総反響を分母にした通過率ではない */}
                                    {headCell('接触率', 'perContact', '接触数/総反響')}
                                    {headCell('接触数', 'contact', `${periodLabel}の反響のうち接触した方の数（以降の工程に進んだ方を含む）`)}
                                    {headCell('来場率', 'perInterview', '来場/接触数')}
                                    {headCell('来場', 'interview', '来場または物件案内があった方の数（以降の工程に進んだ方を含む）')}
                                    {headCell('申込率', 'perApplication', '申込/来場')}
                                    {headCell('申込', 'application', '申し込みに至った方の数（契約者を含む）')}
                                    {/* ⚠️⚠️ **分母が「申込」に変わった**（2026-09-18）。
                                           ⚠️ shop/ShopKaeru.tsx は**接触数のまま**なので数字が違う */}
                                    {headCell('契約率', 'perContract', '契約/申込')}
                                    {headCell('契約', 'contract', '契約済みの方の数（仲介契約を含む。解約は含まない）')}
                                    {['S', 'A', 'B', 'C'].map(item =>
                                        <React.Fragment key={item}>
                                            {headCell(`${item}ランク`, item, `${periodLabel}の反響のうち${item}ランクの数`)}
                                        </React.Fragment>
                                    )}
                                    {headCell('総予算', 'totalBudget')}
                                    {/* ⚠️ 単価はどれも「総予算 ÷ その工程の件数」。⚠️ **分母だけが変わる** */}
                                    {headCell('反響単価', 'registerBudget', '総予算/総反響')}
                                    {headCell('接触単価', 'contactBudget', '総予算/接触数')}
                                    {headCell('来場単価', 'interviewBudget', '総予算/来場')}
                                    {headCell('申込単価', 'applicationBudget', '総予算/申込')}
                                    {headCell('契約単価', 'contractBudget', '総予算/契約')}
                                </tr>
                                {sorted.map((item, index) => {
                                    const {
                                        value,
                                        totalValue,
                                        contactValue,
                                        interviewValue,
                                        applicationValue,
                                        contractValue,
                                        perContact,
                                        perInterview,
                                        perApplication,
                                        perContract,
                                        rankSValue,
                                        rankAValue,
                                        rankBValue,
                                        rankCValue,
                                        totalBudget,
                                    } = item;

                                    return (
                                        <tr key={value.id ?? `medium-${index}`}>
                                            <td className='sticky-column' style={{ textAlign: 'center' }}>{value.medium}</td>
                                            {/* ⚠️ 見出しと同じ並び。入れ替えないこと */}
                                            <td style={{ textAlign: 'center' }}>{totalValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perContact}%</td>
                                            <td style={{ textAlign: 'center' }}>{contactValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perInterview}%</td>
                                            <td style={{ textAlign: 'center' }}>{interviewValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perApplication}%</td>
                                            <td style={{ textAlign: 'center' }}>{applicationValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perContract}%</td>
                                            <td style={{ textAlign: 'center' }}>{contractValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankSValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankAValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankBValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankCValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{`¥${totalBudget.toLocaleString()}`}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, totalValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, contactValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, interviewValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, applicationValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, contractValue)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
        </>
    )
}

export default CustomerKaeru;

```

---

## 検証

⚠️ `customerKaeruUtils.ts` を単体で JS に変換し、⚠️ **画面と同じ手順**で実データを集計した
（⚠️ 顧客 8,391件／販促費は ② の SQL と同じ店舗の絞り込み後 ¥262,924,157）。

### ⚠️⚠️ 未分類がほぼ解消した

| | 顧客 | 販促費 |
|---|---|---|
| ⚠️ **改修前** | ⚠️ **5,960件（71%）** | ⚠️ **¥192,441,137（73%）** |
| ⚠️ **改修後** | ⚠️ **770件（9%）** | ⚠️ **¥1,140,450（0.4%）** |

### ⚠️ 行ごとの数字（改修後）

| 行 | 総反響 | 接触率 | 接触 | 来場率 | 来場 | 申込率 | 申込 | 契約率 | 契約 | 総予算 |
|---|---|---|---|---|---|---|---|---|---|---|
| 総反響 | 8,391 | 58% | 4,868 | 54% | 2,624 | 33% | 855 | 57% | 485 | ¥262,924,157 |
| SUUMO | 1,043 | 75% | 778 | 78% | 604 | 37% | 223 | 53% | 119 | ¥64,510,348 |
| HOME'S | 186 | 58% | 108 | 59% | 64 | 33% | 21 | 48% | 10 | ¥3,787,102 |
| ⚠️ Instagram | 265 | 28% | 73 | 37% | 27 | 11% | 3 | 100% | 3 | ⚠️ **¥84,719,298** |
| ⚠️ Web検索 | ⚠️ **5,127** | 57% | 2,918 | 41% | 1,207 | 30% | 357 | 58% | 206 | ⚠️ **¥92,749,561** |
| アットホーム | 304 | 72% | 220 | 74% | 162 | 29% | 47 | 49% | 23 | ¥13,226,806 |
| 公式LINE | 297 | 34% | 100 | 34% | 34 | 12% | 4 | 75% | 3 | ¥17,370 |
| ホームページ反響 | 399 | 61% | 244 | 73% | 179 | 37% | 66 | 76% | 50 | ¥2,773,222 |

### ⚠️⚠️ 二重計上が無いこと

| 確認 | 結果 |
|---|---|
| 総反響の行 | 8,391件 ／ ¥262,924,157 |
| 媒体行の合計 | 7,621件 ／ ¥261,783,707 |
| ⚠️ 差（どの行にも乗らない分） | ⚠️ **770件 ／ ¥1,140,450** |
| ⚠️⚠️ **差が負でないこと**（＝二重計上なし） | ⚠️ **OK** |

⚠️ ⚠️ **媒体別の合計は総反響と一致しない。** ⚠️ これは**正しい**（拾えていない分が見えるようにしてある）。

### ⚠️ まだ乗らない顧客の内訳（上位）

| 値 | 件数 | 備考 |
|---|---|---|
| `未設定` | 256 | ⚠️ 媒体が決まっていない |
| `電話` | 198 | ⚠️ `medium_kaeru` に無い |
| （空） | 185 | ⚠️ 未入力 |
| `来店` | 57 | ⚠️ `medium_kaeru` に無い |
| ⚠️ `Instagram、Web検索` 等の**複数選択** | ⚠️ 計約50 | ⚠️ **数え方が未決** |
| `メール` / `LINE` / `オープンハウス` / `イベント` | 26 | ⚠️ `medium_kaeru` に無い |

⚠️ ⚠️ **複数選択の数え方は引き続き未決**（2026-09-16 から残っている宿題）。
⚠️ 「先頭だけ数える」「全部に1件ずつ数える（合計が合わなくなる）」などの選択肢があり、⚠️ **利用者の判断が要る。**

### ビルド

| 確認 | 結果 |
|---|---|
| `npm run build` | ⚠️ **成功**（`Compiled with warnings.`） |
| ⚠️ 追加した警告 | ⚠️ **無し**（`CustomerKaeru.tsx` の `'Category' is defined but never used` は**改修前からある**） |

⚠️ ローカルDBには ⚠️ **`show_graph` の SQL を適用済み**（検算のため）。

### ⚠️ 未実施

| # | 確認 | 期待 |
|---|---|---|
| 1 | 建売の「販促媒体別広告費」 | ⚠️ **8行**（総反響 / SUUMO / HOME'S / Instagram / Web検索 / アットホーム / 公式LINE / ホームページ反響） |
| 2 | ⚠️ Web検索の行 | ⚠️ **総反響 5,127件・総予算 ¥92,749,561** |
| 3 | 列の並び | ⚠️ 総反響 / 接触率 / 接触数 / **来場率** / **来場** / **申込率** / **申込** / 契約率 / **契約** |
| 4 | 単価の列 | ⚠️ 反響 / 接触 / **来場** / 申込 / 契約 の**5つ** |
| 5 | 並べ替え | ⚠️ **来場率・申込率・来場単価でも並ぶ** |
| 6 | グラフ | ⚠️ **5本**（来場単価が増えている） |
| 7 | ⚠️ 注文事業の「販促媒体別広告費」 | ⚠️ **何も変わっていないこと** |
| 8 | ⚠️ 建売の「店舗別広告費」（ShopKaeru） | ⚠️ **何も変わっていないこと**（⚠️ 契約率の分母は接触数のまま） |

---

## ⚠️ 残作業

⚠️ デプロイ手順は [deploy-v2.2.137.md](deploy-v2.2.137.md) にまとめてある。

| # | 内容 |
|---|---|
| 1 | ⚠️ 上の**画面での確認** |
| 2 | ⚠️ ① で **`2026-09-18_medium_kaeru_show_graph_web.sql`** |
| 3 | push → PR → `production` |
| 4 | ⚠️ ① へフロント |
| 5 | ⚠️ ① で `2026-09-18_update_log_2.2.137.sql` |

⚠️ ⚠️ **② VPS の変更は無い**（⚠️ **フロントと DB のみ**）。⚠️ Express の再ビルドは不要。

## ⚠️ 判断を待っていること

| # | 内容 |
|---|---|
| 1 | ⚠️ **複数選択（`Instagram、Web検索` 等）の数え方** |
| 2 | ⚠️ `電話` / `来店` / `メール` / `LINE` / `オープンハウス` / `イベント` を `medium_kaeru` に足すか、対応表で寄せるか |
| 3 | ⚠️ **`ShopKaeru.tsx` の契約率の分母を揃えるか**（⚠️ 今は画面によって数字が違う） |
| 4 | ⚠️ `未設定` 256件・空 185件（⚠️ **DB の中身**） |
