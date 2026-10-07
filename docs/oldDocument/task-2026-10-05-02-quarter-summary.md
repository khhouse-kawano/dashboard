# 2026-10-05-02　会社実績に「4半期サマリー」を追加（v2.2.163 の続き）

## 依頼（ReadMeClaude.md）

> 引き続きv2.2.163にて作業継続 / 新たなコンポネント作成
>
> ## 要件１
> - company ディレクトリに QuarterSummary.tsx を追加
>   Company.tsx に `const [showQuarterSummary, setShowQuarterSummary] = useState(false);`
>   真の場合にコンポネントを **fullscreenでモーダル表示**
>   以下の期間の契約数、反響歩留まりを表示する画面
>
>   Table名 契約実績報告
>   1Q : [{thisYear}/06,{thisYear}/07,{thisYear}/08] / 2Q : [/09,/10,/11] / 3Q : [/12,/01,/02] / 4Q : [/03,/04,/05]
>   項目 rowSpan={2} colSpan={2}|1Q colSpan={3}|2Q colSpan={3}|3Q colSpan={3}|4Q colSpan={3}|
>   今期予算 colSpan={2}| company_achievement の該当 period の value
>   今期実績 rowSpan={4} colSpan={2}| Company.tsx の該当期間及び division の契約数
>   差異| {実績行}-{今期予算行}。該当月の実績がない場合は **-**
>   前期実績| {thisYear - 1}/該当月
>   昨対比| {thisYear}/該当月の契約数 / {thisYear - 1}/該当月の契約数
>   契約予定 colSpan={2}| rank_period が該当月 && rank === Sランク の顧客数 && 該当月 > 当月。該当月 <= 当月は契約数
>   上記の構成で全店舗、課、店舗ごとに表示
>
>   Table名 反響実績報告 … 先頭行は同じ。CustomerTrendOrder.tsx の **総反響** **来場**（実来場）**次アポ** **契約**
>
> ## 要件２
> division === '注文事業' のみ。category === 'order' のときのみ **契約棟数ランキング** の右隣りに同じボタンデザインで **4半期サマリー**
> デザインは SaaS 風（GoogleReview.tsx 参照）

追記（2026-10-05）:

> 1Q 2Q 3Q 4Qの次の列に1Q合計 2Q合計 3Q合計 4Q合計の列を追加
> さらに2Q合計、4Q合計の次の列に上半期合計、下半期合計の列を追加
> 下半期合計の次の列に〇〇年5月期合計の列を追加

---

## ⚠️ 指示書の解釈で決めたこと（⚠️ 着手前に提示し、承認を得た）

| # | 指示書 | ⚠️ 実装 |
|---|---|---|
| 1 | 3Q `{thisYear}/12, {thisYear}/01, {thisYear}/02` | ⚠️⚠️ **1月・2月は翌年**（2026/12・**2027**/01・**2027**/02）。⚠️ 文字どおりだと年度が前に戻る |
| 2 | `{thisYear}` | ⚠️ Company で選んでいる「〇〇年5月期」。⚠️ 2027年5月期 = 2026/06〜2027/05 |
| 3 | 今期実績 rowSpan={4} | ⚠️ **実績・差異・前期実績・昨対比**の4行のまとまり。⚠️ 左端に範囲（全店舗・課・店舗）の列が要るため、⚠️ 見出しは「実績」行の上に小さく「今期実績」と出した |
| 4 | 差異「実績がない場合は -」 | ⚠️ **まだ来ていない月**を「-」。⚠️ 過ぎた月で0件なら差異はマイナスで出す |
| 5 | 店舗 | ⚠️ Company と同じく ⚠️ **FH の店舗の行は出さない**（⚠️ 課・全店舗の数には含む） |

### ⚠️ 合計列の考え方（追記分）

| 行 | 合計列の値 |
|---|---|
| 予算・実績・前期実績・契約予定 | ⚠️ 期間の月を合計 |
| 差異 | ⚠️ 期間の実績合計 − 予算合計。⚠️ 期間がすべて未来なら「-」 |
| ⚠️ 昨対比 | ⚠️⚠️ **過ぎた月だけで比べる**（⚠️ 途中の四半期を前期の3か月分と比べると低く見えるため） |
| ⚠️ 反響の件数 | ⚠️⚠️ **期間でまとめて数える**（⚠️ 月ごとに足すと同じ顧客を二重に数える。下の検証を参照） |
| 歩留まり | ⚠️ 合計した件数から計算し直す（⚠️ 月ごとの％の平均ではない） |

---

## 変更したファイル

| ディレクトリ | ファイル | |
|---|---|---|
| `frontend/src/components/company/` | ⚠️⚠️ **QuarterSummary.tsx** | ⚠️ **新規** |
| `frontend/src/components/company/` | **Company.tsx** | ⚠️ state・ボタン・モーダルの3か所 |
| `backend/scripts/sql/` | **2026-10-05_update_log_2.2.163.sql** | ⚠️ 文言に追記（⚠️ ローカルDBも UPDATE 済み） |
| `docs/` | **deploy-v2.2.163.md** | ⚠️ 成果物名・確認項目・申し送りを追記 |

⚠️⚠️ **バックエンド（① ② とも）は変更していない。**
⚠️ 契約・予算・店舗・課は Company から props、反響は既存の `customerTrend`（注文）を使う。

### ⚠️ 追加した関数（QuarterSummary.tsx）

| 関数 | |
|---|---|
| `buildColumns()` | ⚠️ 列（月12＋四半期合計4＋半期合計2＋年度合計1＝19列）を作る |
| `isContracted()` | ⚠️ 契約に数えるか（⚠️ Company と同じ：契約済み・解約） |
| ⚠️ `countKpi()` | ⚠️ 反響の KPI を期間でまとめて数える（⚠️ CustomerTrendOrder の getValue と同じ定義） |
| `yieldRate()` | 歩留まり（⚠️ 切り捨て。⚠️ 分母0は null） |
| `ym()` / `lastYearOf()` | 年月の正規化・前年同月 |
| `contractRows()` / `leadRows()` | 表の行（コンポーネント内） |

---

## 動作確認（ローカル）

### ⚠️⚠️ 契約実績報告：全店舗の12か月を SQL と突き合わせ

⚠️ 画面と同じ API（`company`）・同じ計算で出した値と、⚠️ `master_data` / `company_achievement` を SQL で直接数えた値を比べた。

| 月 | 予算 | 実績 | 前期実績 | 契約予定 |
|---|---|---|---|---|
| 2026-06 | 51 / 51 | 43 / 43 | 33 / 33 | 43 |
| 2026-07 | 61 / 61 | 41 / 41 | 47 / 47 | 41 |
| 2026-08 | 64 / 64 | 54 / 54 | 43 / 43 | 54 |
| 2026-09 | 63 / 63 | 52 / 52 | 37 / 37 | 52 |
| 2026-10 | 64 / 64 | 0 / 0 | 44 / 44 | 0 |
| 2026-11 〜 2027-05 | ⚠️ すべて一致 | 0 / 0 | ⚠️ すべて一致 | ⚠️ **0（Sランク）** |

⚠️⚠️ **予算・実績・前期実績は12か月すべて一致。**

### ⚠️ 反響実績報告：全店舗 1Q を SQL と突き合わせ

| | 画面の計算 | SQL |
|---|---|---|
| 総反響 | 3,112 | 3,112 |
| 実来場 | 971（来場率 31%） | — |
| 次アポ | 583（60%） | — |
| 契約 | ⚠️ **138**（14%） | ⚠️ **138** |

⚠️ 反響側の契約 138 は、⚠️ 契約実績側の 1Q（43＋41＋54＝**138**）とも一致。

⚠️⚠️ **月ごとに数えて足すと、実来場 972・次アポ 584 になる**（⚠️ 1件ずつ多い）。
⚠️ 月をまたいだ同じ顧客を二重に数えるため。⚠️ 合計列を期間でまとめて数える作りにした理由。

### ⚠️ 「契約予定」が来月以降ほぼ 0 になる

| ランク | 予定月が来月以降 | 今月 |
|---|---|---|
| ⚠️ Sランク | ⚠️⚠️ **0** | 2 |
| Cランク | 15 | 80 |
| Dランク | 268 | 127 |

⚠️ ローカル（10/2時点）のデータ。⚠️ Sランクの顧客は予定月が今月に入っている。⚠️ **計算の誤りではない。**

### ビルド

```bash
cd frontend && npx react-scripts build   # -> Compiled with warnings
```

⚠️ QuarterSummary.tsx の警告は ⚠️ **0件**。⚠️ Company.tsx の警告は ⚠️ **以前からあるもの**（行番号がずれただけ）。

| 成果物 | |
|---|---|
| ⚠️⚠️ **`static/js/main.41d934fa.js`** | ⚠️ v2.2.163 の本体（⚠️ スタッフ管理の分も含む） |
| `static/css/main.7c10f266.css` | 変更なし |

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **ブラウザでの表示は未確認**（⚠️ 集計値とビルドは確認済み）。⚠️ 特に2段見出しの固定（30px）と、左2列の固定 |
| 2 | ⚠️ 反響は初めて開いたときに ⚠️ **約15MB**（1〜2秒）。⚠️ 販促媒体別反響推移と同じ API・同じ量 |
| 3 | ⚠️ 契約予定は来月以降ほぼ 0（上記） |
| 4 | ⚠️ 数字のセルを押しても顧客一覧は出ない（⚠️ 指示に無いため作っていない） |
| 5 | ⚠️ 併売店のまとめ（Company の「併売店をまとめる」）には ⚠️ **連動しない** |
| 6 | ⚠️ ⚠️ **コミット・push はしていない** |

---

## 付録：コード全文・差分

### ⚠️ `frontend/src/components/company/QuarterSummary.tsx`（新規・全文）

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { formattedThisMonth, monthFormate } from './companyUtils';

/**
 * 4半期サマリー（会社実績 → 「4半期サマリー」ボタン）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 2026-10-05（v2.2.163）新規。⚠️ 注文事業（category === 'order'）だけ。
 *
 * ⚠️ 表は2つ。⚠️ どちらも 全店舗 → 課 → 店舗 の順に並べる。
 *   契約実績報告 … 予算・実績・差異・前期実績・昨対比・契約予定
 *   反響実績報告 … 総反響・実来場・次アポ・契約（⚠️ 歩留まり付き）
 *
 * ⚠️⚠️ **データの出どころが2つある。**
 *   契約・予算・店舗・課 … ⚠️ **Company.tsx から props で受け取る**（ランキングと同じ）。
 *     ⚠️ 会社実績の画面と**同じ数字**になるよう、契約の判定も Company と揃えてある。
 *   反響 … ⚠️ 既存の `customerTrend`（注文）を**開いたときに1回だけ**取る。
 *     ⚠️ KPI の定義は customerTrend/CustomerTrendOrder.tsx の `getValue` と同じ。
 *     ⚠️⚠️ **あちらの定義を変えたら、ここ（countKpi）も直すこと。**
 *
 * ⚠️⚠️ **期は Company で選んでいる「〇〇年5月期」に合わせる。**
 *   ⚠️ 2027年5月期 = 2026/06 〜 2027/05。
 *   ⚠️ 3Q の 1月・2月は ⚠️ **翌年**（2026/12・2027/01・2027/02）。
 *     ⚠️ 指示書の `{thisYear}/01` を文字どおり読むと年度が前に戻るため、こう解釈した。
 *
 * ⚠️ 見た目は header/GoogleReview.tsx に合わせた（⚠️ 共通CSSを汚さないスコープCSS）。
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Shop = { brand: string; shop: string; section: string; division: string };
type Section = { name: string; division: string };
type Achievement = { category: string; name: string; period: string; value: string };

/** 反響（customerTrend の customer）。⚠️ 使う列だけ */
type Lead = {
    shop: string;
    status: string;
    register: string;
    interview: string;
    appointment: string;
    screening: string;
    contract: string;
};

type Props = {
    show: boolean;
    setShow: (value: boolean) => void;
    /** ⚠️ 期（〇〇年5月期）。⚠️ Company の targetYear をそのまま渡す */
    targetYear: number | null;
    /** ⚠️ Company の customerList（注文・建売・中古が混ざっている）。⚠️ ここで注文だけに絞る */
    customerList: Customer[];
    shopList: Shop[];
    sectionList: Section[];
    achievement: Achievement[];
};

const DIVISION = '注文事業';
/** ⚠️ Company の divisionMapping と同じ。⚠️ 顧客の category は「注文」 */
const CUSTOMER_CATEGORY = '注文';

/** ⚠️ `YYYY-MM`。⚠️ 区切りが `/` でも `-` でも、日付が付いていても揃える */
const ym = (value: string | undefined | null): string => monthFormate(String(value ?? ''));

/** 今月（`YYYY-MM`）。⚠️ これより後の月は「まだ来ていない月」 */
const THIS_MONTH = ym(formattedThisMonth);

/** 前年同月（`YYYY-MM`） */
const lastYearOf = (month: string): string => {
    const [y, m] = month.split('-');
    return `${Number(y) - 1}-${m}`;
};

/** 列の定義。⚠️ 月の列と合計の列を同じ形で扱う */
type Column = {
    key: string;
    label: string;
    kind: 'month' | 'quarter' | 'half' | 'year';
    /** ⚠️ この列が受け持つ月（`YYYY-MM`）。⚠️ 月の列なら1つ */
    months: string[];
};

/**
 * 列を作る。
 *
 * ⚠️ 並び（2026-10-05 の指示）:
 *   1Q(6,7,8月) 1Q合計 | 2Q(9,10,11月) 2Q合計 上半期合計 |
 *   3Q(12,1,2月) 3Q合計 | 4Q(3,4,5月) 4Q合計 下半期合計 〇〇年5月期合計
 */
const buildColumns = (targetYear: number): { columns: Column[]; quarters: { label: string; months: string[] }[] } => {
    const start = targetYear - 1;
    const months: string[] = [];
    for (let i = 0; i < 12; i += 1) {
        // ⚠️ new Date(y, m, 1) で作る（⚠️ 文字列から作ると UTC 解釈で月がずれることがある）
        const d = new Date(start, 5 + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const quarters = [0, 1, 2, 3].map(q => ({ label: `${q + 1}Q`, months: months.slice(q * 3, q * 3 + 3) }));

    const columns: Column[] = [];
    quarters.forEach((q, index) => {
        q.months.forEach(m => columns.push({ key: m, label: `${Number(m.slice(5))}月`, kind: 'month', months: [m] }));
        columns.push({ key: `${q.label}-total`, label: `${q.label}合計`, kind: 'quarter', months: q.months });
        if (index === 1) columns.push({ key: 'first-half', label: '上半期合計', kind: 'half', months: months.slice(0, 6) });
        if (index === 3) {
            columns.push({ key: 'second-half', label: '下半期合計', kind: 'half', months: months.slice(6) });
            columns.push({ key: 'year', label: `${targetYear}年5月期合計`, kind: 'year', months });
        }
    });
    return { columns, quarters };
};

/** 範囲（店舗の集合）。⚠️ shops が null なら事業全体 */
type Scope = {
    id: string;
    kind: 'division' | 'section' | 'shop';
    label: string;
    sub: string;
    /** ⚠️ 契約・反響を数える店舗。⚠️ null は「注文事業のすべて」 */
    shops: Set<string> | null;
    /** ⚠️ 予算を合計する店舗 */
    budgetShops: Set<string>;
};

/**
 * 契約に数えるか。
 * ⚠️⚠️ **Company.tsx の calculateContractList と同じ判定**（契約済み と 解約）。
 *   ⚠️ 会社実績の「実績」と数字を揃えるため。⚠️ 解約を除きたくなったら両方直す。
 */
const isContracted = (c: Customer): boolean => !!c.contract && (c.status === '契約済み' || c.status === '解約');

/**
 * 反響の KPI を期間でまとめて数える。
 *
 * ⚠️⚠️ **CustomerTrendOrder.tsx の `getValue` と同じ定義。** ⚠️ 期間でまとめて数えるので、
 *   ⚠️ 合計の列でも ⚠️ **同じ顧客を二重に数えない**（月ごとの件数を足すと、
 *   次アポで「2回目面談が9月・事前審査が10月」の人が2回数えられる）。
 *
 *   総反響 … 反響日（register）が期間内
 *   実来場 … 初回面談日が期間内。⚠️ 初回面談が空なら、2回目面談・事前審査・契約のどれかが期間内
 *   次アポ … 初回面談があれば「初回面談が期間内 かつ その先に進んだ」。⚠️ 無ければ上と同じ
 *   契約   … 契約日が期間内 かつ 契約済み／解約
 */
const countKpi = (leads: Lead[], months: Set<string>) => {
    const inP = (v: string) => months.has(ym(v));
    let register = 0;
    let interview = 0;
    let appointment = 0;
    let contract = 0;
    for (const b of leads) {
        if (inP(b.register)) register += 1;
        const later = inP(b.appointment) || inP(b.screening) || inP(b.contract);
        if (b.interview) {
            if (inP(b.interview)) {
                interview += 1;
                if (b.appointment || b.screening || b.contract) appointment += 1;
            }
        } else if (later) {
            interview += 1;
            appointment += 1;
        }
        if (inP(b.contract) && (b.status === '契約済み' || b.status === '解約')) contract += 1;
    }
    return { register, interview, appointment, contract };
};

/** 歩留まり（%）。⚠️ CustomerTrendOrder と同じく**切り捨て**。⚠️ 分母0は null */
const yieldRate = (count: number, base: number): number | null => (base === 0 ? null : Math.floor((count / base) * 100));

const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement }: Props) => {
    const [tab, setTab] = useState<'contract' | 'lead'>('contract');
    const [leads, setLeads] = useState<Lead[] | null>(null);
    const [leadError, setLeadError] = useState('');
    const [jump, setJump] = useState('');

    /**
     * 反響は**開いたときに1回だけ**取る。
     * ⚠️ 会社実績を開くたびに取ると、使わない人の分まで重くなる。
     */
    useEffect(() => {
        if (!show || leads !== null) return;
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'customerTrend', category: 'order' });
                setLeads((res.data?.customer ?? []) as Lead[]);
            } catch {
                setLeadError('反響を取得できませんでした。時間をおいて再度お試しください。');
                setLeads([]);
            }
        };
        void fetchData();
    }, [show, leads]);

    const year = targetYear ?? 0;
    const { columns, quarters } = useMemo(() => buildColumns(year), [year]);
    const allMonths = useMemo(() => columns.filter(c => c.kind === 'month').map(c => c.key), [columns]);

    /**
     * 範囲の一覧。⚠️ 全店舗 → 課 → その課の店舗。
     *
     * ⚠️ 店舗の行は Company と同じく ⚠️ **FH を出さない**（Company の contractTable と同じ）。
     *   ⚠️ ただし課の合計には ⚠️ **FH も含める**（Company の課の行と同じ。数字を揃えるため）。
     */
    const scopes = useMemo<Scope[]>(() => {
        const divisionShops = shopList.filter(s => s.division === DIVISION);
        const list: Scope[] = [{
            id: 'qs-all',
            kind: 'division',
            label: '全店舗',
            sub: DIVISION,
            shops: null,
            budgetShops: new Set(divisionShops.map(s => s.shop)),
        }];
        sectionList.filter(sec => sec.division === DIVISION).forEach((sec, index) => {
            const shops = divisionShops.filter(s => s.section === sec.name);
            const names = new Set(shops.map(s => s.shop));
            list.push({ id: `qs-sec-${index}`, kind: 'section', label: sec.name, sub: '課', shops: names, budgetShops: names });
            shops.filter(s => !s.shop.includes('FH')).forEach(s => {
                const one = new Set([s.shop]);
                list.push({ id: `qs-shop-${s.shop}`, kind: 'shop', label: s.shop, sub: sec.name, shops: one, budgetShops: one });
            });
        });
        return list;
    }, [shopList, sectionList]);

    /** ⚠️ 注文の顧客だけ */
    const orderCustomers = useMemo(
        () => customerList.filter(c => c.category === CUSTOMER_CATEGORY),
        [customerList]
    );

    /**
     * 契約実績の月ごとの数（範囲ごと）。
     * ⚠️ 月 → 件数 の形にしてから合計列を作る（⚠️ 顧客を列の数だけ舐め直さない）。
     */
    const contractStats = useMemo(() => {
        const monthSet = new Set(allMonths);
        const lastYearSet = new Set(allMonths.map(lastYearOf));
        return new Map(scopes.map(scope => {
            const inScope = (shop: string) => scope.shops === null || scope.shops.has(shop);
            const actual: Record<string, number> = {};
            const lastYear: Record<string, number> = {};
            const plan: Record<string, number> = {};
            const budget: Record<string, number> = {};

            for (const c of orderCustomers) {
                if (!inScope(c.shop)) continue;
                if (isContracted(c)) {
                    const m = ym(c.contract);
                    if (monthSet.has(m)) actual[m] = (actual[m] ?? 0) + 1;
                    if (lastYearSet.has(m)) lastYear[m] = (lastYear[m] ?? 0) + 1;
                }
                /**
                 * 契約予定。⚠️ Sランク × ランクの予定月（rank_period）。
                 * ⚠️ rank は `customized_input_01J82Z5F366ZQ897PXWF6H5ZAM`（company の SQL で別名）。
                 * ⚠️ ⚠️ **使うのは来月以降の月だけ**（今月以前は契約数を出す。下の planOf）。
                 */
                if (c.rank === 'Sランク') {
                    const m = ym(c.rank_period);
                    if (monthSet.has(m)) plan[m] = (plan[m] ?? 0) + 1;
                }
            }
            for (const a of achievement) {
                if (a.category !== 'shop' || !scope.budgetShops.has(a.name)) continue;
                const m = ym(a.period);
                if (monthSet.has(m)) budget[m] = (budget[m] ?? 0) + Number(a.value || 0);
            }
            return [scope.id, { actual, lastYear, plan, budget }];
        }));
    }, [scopes, orderCustomers, achievement, allMonths]);

    /** 反響の KPI（範囲 × 列）。⚠️ 列ごとに期間でまとめて数える（countKpi の注記参照） */
    const leadStats = useMemo(() => {
        if (leads === null) return null;
        const monthSet = new Set(allMonths);
        // ⚠️ 期のどの日付にも掛からない顧客は先に落とす（⚠️ 全件を列の数だけ舐めないため）
        const relevant = leads.filter(b =>
            [b.register, b.interview, b.appointment, b.screening, b.contract].some(v => monthSet.has(ym(v))));
        return new Map(scopes.map(scope => {
            const own = relevant.filter(b => scope.shops === null || scope.shops.has(b.shop));
            return [scope.id, new Map(columns.map(col => [col.key, countKpi(own, new Set(col.months))]))];
        }));
    }, [leads, scopes, columns, allMonths]);

    const sum = (record: Record<string, number>, months: string[]) =>
        months.reduce((acc, m) => acc + (record[m] ?? 0), 0);

    /** まだ来ていない月を除く */
    const elapsedOf = (months: string[]) => months.filter(m => m <= THIS_MONTH);

    if (targetYear === null) return null;

    const num = (value: number | null | string) => (value === null ? '-' : typeof value === 'number' ? value.toLocaleString() : value);

    // ---------------------------------------------------------------------
    // 見出し（2段）
    // ---------------------------------------------------------------------
    const head = (
        <thead>
            <tr>
                <th className="qs_th qs_th_label" rowSpan={2} colSpan={2}>項目</th>
                {quarters.map((q, index) => (
                    <React.Fragment key={q.label}>
                        <th className="qs_th qs_th_q" colSpan={3}>{q.label}</th>
                        <th className="qs_th qs_th_total" rowSpan={2}>{q.label}合計</th>
                        {index === 1 && <th className="qs_th qs_th_half" rowSpan={2}>上半期合計</th>}
                        {index === 3 && <>
                            <th className="qs_th qs_th_half" rowSpan={2}>下半期合計</th>
                            <th className="qs_th qs_th_year" rowSpan={2}>{targetYear}年5月期合計</th>
                        </>}
                    </React.Fragment>
                ))}
            </tr>
            <tr>
                {columns.filter(c => c.kind === 'month').map(c => (
                    <th key={c.key} className={`qs_th qs_th_month${c.key === THIS_MONTH ? ' is_now' : ''}`}>
                        {c.key.replace('-', '/')}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const cellClass = (col: Column) => `qs_td qs_num qs_col_${col.kind}`;

    // ---------------------------------------------------------------------
    // 契約実績報告
    // ---------------------------------------------------------------------
    const contractRows = (scope: Scope) => {
        const s = contractStats.get(scope.id);
        if (!s) return null;

        /** ⚠️ 契約予定: 来月以降は Sランクの数、今月以前は契約数 */
        const planOf = (months: string[]) =>
            months.reduce((acc, m) => acc + (m > THIS_MONTH ? (s.plan[m] ?? 0) : (s.actual[m] ?? 0)), 0);

        const rows: { key: string; label: string; group?: boolean; tone: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'budget', label: '今期予算', tone: 'budget', value: col => num(sum(s.budget, col.months)) },
            { key: 'actual', label: '実績', group: true, tone: 'actual', value: col => num(sum(s.actual, col.months)) },
            {
                key: 'diff', label: '差異', group: true, tone: 'plain',
                value: col => {
                    // ⚠️ 期間がすべて未来の月なら「-」（⚠️ 2026-10-05 の指示）
                    if (elapsedOf(col.months).length === 0) return '-';
                    const diff = sum(s.actual, col.months) - sum(s.budget, col.months);
                    return <span className={diff > 0 ? 'qs_pos' : diff < 0 ? 'qs_neg' : ''}>{diff > 0 ? `+${diff}` : diff}</span>;
                },
            },
            { key: 'last', label: '前期実績', group: true, tone: 'plain', value: col => num(sum(s.lastYear, col.months.map(lastYearOf))) },
            {
                key: 'yoy', label: '昨対比', group: true, tone: 'plain',
                value: col => {
                    /**
                     * ⚠️⚠️ **過ぎた月だけで比べる。**
                     *   ⚠️ 途中の四半期を前期の3か月分と比べると、⚠️ **実際より低く見える。**
                     */
                    const elapsed = elapsedOf(col.months);
                    if (elapsed.length === 0) return '-';
                    const now = sum(s.actual, elapsed);
                    const before = sum(s.lastYear, elapsed.map(lastYearOf));
                    if (before === 0) return '-';
                    const pct = Math.round((now / before) * 100);
                    return <span className={pct >= 100 ? 'qs_pos' : 'qs_neg'}>{pct}%</span>;
                },
            },
            { key: 'plan', label: '契約予定', tone: 'plan', value: col => num(planOf(col.months)) },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`} className={`qs_row qs_tone_${row.tone}${index === 0 ? ' qs_block_top' : ''}`}>
                {index === 0 && (
                    <td className={`qs_td qs_scope qs_scope_${scope.kind}`} rowSpan={rows.length} id={`${scope.id}-contract`}>
                        <div className="qs_scope_name">{scope.label}</div>
                        <div className="qs_scope_sub">{scope.sub}</div>
                    </td>
                )}
                <td className={`qs_td qs_item${row.group ? ' qs_item_group' : ''}`}>
                    {/* ⚠️ 実績〜昨対比の4行が「今期実績」のまとまり（⚠️ 指示書の rowSpan=4） */}
                    {row.key === 'actual' && <span className="qs_group_tag">今期実績</span>}
                    {row.label}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };

    // ---------------------------------------------------------------------
    // 反響実績報告
    // ---------------------------------------------------------------------
    const leadRows = (scope: Scope) => {
        const byCol = leadStats?.get(scope.id);
        if (!byCol) return null;

        const rate = (value: number | null) =>
            <div className="qs_rate">{value === null ? '—' : `${value}%`}</div>;

        const rows: { key: string; label: string; note?: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'register', label: '総反響', value: col => num(byCol.get(col.key)?.register ?? 0) },
            {
                key: 'interview', label: '来場', note: '実来場 ÷ 総反響',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.interview ?? 0)}{rate(yieldRate(k?.interview ?? 0, k?.register ?? 0))}</>;
                },
            },
            {
                key: 'appointment', label: '次アポ', note: '次アポ ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.appointment ?? 0)}{rate(yieldRate(k?.appointment ?? 0, k?.interview ?? 0))}</>;
                },
            },
            {
                key: 'contract', label: '契約', note: '契約 ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.contract ?? 0)}{rate(yieldRate(k?.contract ?? 0, k?.interview ?? 0))}</>;
                },
            },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`} className={`qs_row${index === 0 ? ' qs_block_top' : ''}`}>
                {index === 0 && (
                    <td className={`qs_td qs_scope qs_scope_${scope.kind}`} rowSpan={rows.length} id={`${scope.id}-lead`}>
                        <div className="qs_scope_name">{scope.label}</div>
                        <div className="qs_scope_sub">{scope.sub}</div>
                    </td>
                )}
                <td className="qs_td qs_item" title={row.note}>
                    {row.label}
                    {row.note && <div className="qs_item_note">{row.note}</div>}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };

    const jumpTo = (id: string) => {
        setJump(id);
        if (!id) return;
        document.getElementById(`${id}-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} fullscreen>
            <Modal.Header closeButton className="qs_modal_head">
                <Modal.Title className="qs_modal_title">
                    <i className="fa-solid fa-chart-column me-2" aria-hidden="true" />
                    4半期サマリー
                    <span className="qs_modal_sub">{DIVISION} / {targetYear}年5月期（{targetYear - 1}/06〜{targetYear}/05）</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="qs_wrap">
                {/* ⚠️ このコンポーネント専用のスタイル。⚠️ 共通CSSを汚さない（GoogleReview と同じ作法） */}
                <style>{`
                    .qs_wrap { font-size: 13px; color: #1f2937; background: #f6f7f9;
                               padding: 16px clamp(16px, 3vw, 40px) 32px; }
                    .qs_modal_head { background: #fff; border-bottom: 1px solid #e5e7eb; }
                    .qs_modal_title { font-size: 16px; font-weight: 700; display: flex; align-items: baseline; gap: 4px; }
                    .qs_modal_sub { font-size: 11px; font-weight: 500; color: #6b7280; margin-left: 10px; }

                    .qs_bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
                              background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                              padding: 10px 14px; margin-bottom: 12px; }
                    .qs_tabs { display: inline-flex; background: #f1f3f6; border-radius: 9px; padding: 3px; }
                    .qs_tab { border: none; background: transparent; padding: 6px 14px; border-radius: 7px;
                              font-size: 12px; font-weight: 700; color: #6b7280; cursor: pointer; }
                    .qs_tab.is_active { background: #fff; color: #1d4ed8; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
                    .qs_tab:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
                    .qs_bar_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                    .qs_legend { margin-left: auto; font-size: 11px; color: #6b7280; display: flex; gap: 12px; flex-wrap: wrap; }
                    .qs_dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }

                    .qs_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
                    .qs_card_title { padding: 12px 16px; font-weight: 700; font-size: 14px; border-bottom: 1px solid #eef0f3;
                                     display: flex; align-items: center; gap: 8px; }
                    .qs_card_note { font-size: 11px; font-weight: 500; color: #6b7280; }
                    .qs_table_wrap { overflow: auto; max-height: calc(100vh - 230px); }
                    .qs_table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1500px; font-size: 12px; }

                    /* ⚠️ 見出しは2段。⚠️ 1段目の高さを 30px に固定し、2段目を top: 30px で貼る。
                          ⚠️ 片方だけ変えると重なる。⚠️ ここにバッククォートを書かないこと */
                    .qs_th { position: sticky; top: 30px; z-index: 2; background: #f8fafc; color: #4b5563;
                             font-size: 11px; font-weight: 700; text-align: center; white-space: nowrap;
                             padding: 6px 8px; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #f1f5f9; }
                    thead tr:first-child .qs_th { top: 0; height: 30px; box-sizing: border-box; }
                    .qs_th[rowspan] { top: 0; }
                    .qs_th_label { left: 0; z-index: 5; min-width: 190px; }
                    .qs_th_q { background: #eef2ff; color: #3730a3; letter-spacing: .06em; }
                    .qs_th_total { background: #e0e7ff; color: #312e81; }
                    .qs_th_half { background: #dbeafe; color: #1e3a8a; }
                    .qs_th_year { background: #1e3a8a; color: #fff; }
                    .qs_th_month.is_now { color: #1d4ed8; box-shadow: inset 0 -2px 0 #2563eb; }

                    .qs_td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                             white-space: nowrap; vertical-align: middle; background: #fff; }
                    .qs_num { text-align: right; font-variant-numeric: tabular-nums; min-width: 58px; }
                    .qs_col_quarter { background: #f5f7ff; font-weight: 700; }
                    .qs_col_half { background: #eef4ff; font-weight: 700; }
                    .qs_col_year { background: #e8eefc; font-weight: 700; color: #1e3a8a; }

                    /* ⚠️ 左の2列は横スクロールしても残す */
                    .qs_scope { position: sticky; left: 0; z-index: 1; width: 120px; min-width: 120px; border-right: 1px solid #e5e7eb; }
                    .qs_item { position: sticky; left: 120px; z-index: 1; min-width: 92px; font-weight: 600; color: #374151;
                               border-right: 1px solid #e5e7eb; }
                    .qs_item_group { padding-left: 18px; color: #4b5563; font-weight: 500; }
                    .qs_group_tag { display: block; font-size: 9px; font-weight: 700; color: #1d4ed8; letter-spacing: .04em;
                                    margin-left: -10px; margin-bottom: 1px; }
                    .qs_item_note { font-size: 9px; font-weight: 500; color: #9ca3af; }
                    .qs_scope_name { font-weight: 700; font-size: 12px; white-space: normal; line-height: 1.3; }
                    .qs_scope_sub { font-size: 10px; color: #6b7280; margin-top: 2px; white-space: normal; }
                    .qs_scope_division { background: #1f2937; color: #f9fafb; }
                    .qs_scope_division .qs_scope_sub { color: #cbd5e1; }
                    .qs_scope_section { background: #eef2ff; }
                    .qs_scope_shop { background: #fafafa; }

                    .qs_block_top > .qs_td { border-top: 2px solid #e5e7eb; }
                    .qs_tone_budget .qs_num { color: #b91c1c; }
                    .qs_tone_actual .qs_num { color: #1d4ed8; font-weight: 700; }
                    .qs_tone_plan .qs_num { color: #047857; }
                    .qs_pos { color: #047857; font-weight: 700; }
                    .qs_neg { color: #b91c1c; font-weight: 700; }
                    .qs_rate { font-size: 10px; color: #6b7280; }
                    .qs_row:hover > .qs_td:not(.qs_scope) { background: #f8fafc; }

                    .qs_note { font-size: 11px; color: #6b7280; line-height: 1.8; margin-top: 10px; }
                    .qs_loading { padding: 48px; text-align: center; color: #6b7280; }
                    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
                `}</style>

                <div className="qs_bar">
                    <div className="qs_tabs" role="tablist" aria-label="表の切り替え">
                        <button type="button" role="tab" aria-selected={tab === 'contract'}
                            className={`qs_tab${tab === 'contract' ? ' is_active' : ''}`} onClick={() => setTab('contract')}>
                            契約実績報告
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'lead'}
                            className={`qs_tab${tab === 'lead' ? ' is_active' : ''}`} onClick={() => setTab('lead')}>
                            反響実績報告
                        </button>
                    </div>
                    <div>
                        <div className="qs_bar_label">移動</div>
                        <Form.Select size="sm" value={jump} style={{ width: '220px', fontSize: '12px' }}
                            onChange={(e) => jumpTo(e.target.value)}>
                            <option value="">課・店舗へ移動</option>
                            {scopes.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.kind === 'shop' ? `　${s.label}` : s.label}
                                </option>
                            ))}
                        </Form.Select>
                    </div>
                    <div className="qs_legend">
                        {tab === 'contract' ? <>
                            <span><span className="qs_dot" style={{ background: '#b91c1c' }} />予算</span>
                            <span><span className="qs_dot" style={{ background: '#1d4ed8' }} />実績</span>
                            <span><span className="qs_dot" style={{ background: '#047857' }} />契約予定</span>
                        </> : <span>下段の％は歩留まり</span>}
                    </div>
                </div>

                <div className="qs_card">
                    <div className="qs_card_title">
                        {tab === 'contract' ? '契約実績報告' : '反響実績報告'}
                        <span className="qs_card_note">
                            {tab === 'contract'
                                ? '会社実績と同じ判定（契約済み・解約）で数えています'
                                : '販促媒体別反響推移と同じ定義で数えています'}
                        </span>
                    </div>
                    <div className="qs_table_wrap">
                        {tab === 'lead' && leads === null ? (
                            <div className="qs_loading">
                                <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                                反響を読み込んでいます…
                            </div>
                        ) : tab === 'lead' && leadError ? (
                            <div className="alert alert-danger m-3" style={{ fontSize: '13px' }}>{leadError}</div>
                        ) : (
                            <table className="qs_table">
                                {head}
                                <tbody>
                                    {scopes.map(scope => (
                                        <React.Fragment key={scope.id}>
                                            {tab === 'contract' ? contractRows(scope) : leadRows(scope)}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="qs_note">
                    {tab === 'contract' ? <>
                        ※ 差異は「実績 − 予算」。まだ来ていない月は「-」です。合計列は期間の実績合計 − 予算合計です。<br />
                        ※ 昨対比は、合計列では<b>すでに過ぎた月だけ</b>で今期と前期を比べています（途中の四半期が低く見えないように）。<br />
                        ※ 契約予定は、来月以降は「Sランク × ランク予定月」の人数、今月以前は契約数です。<br />
                        ※ 店舗の行に FH は出していませんが、課・全店舗の数には含まれます（会社実績と同じ）。
                    </> : <>
                        ※ 来場は実来場（初回面談、初回面談が空なら2回目以降の面談・事前審査・契約）で数えています。<br />
                        ※ 合計列は期間でまとめて数えています（同じお客様を二重に数えません）。歩留まりは合計した件数から計算しています。
                    </>}
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default QuarterSummary;
```

### `frontend/src/components/company/Company.tsx`（差分）

```diff
diff --git a/frontend/src/components/company/Company.tsx b/frontend/src/components/company/Company.tsx
index 068e9afe..44e2dece 100644
--- a/frontend/src/components/company/Company.tsx
+++ b/frontend/src/components/company/Company.tsx
@@ -13,6 +13,7 @@ import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
 import CustomerDetail from './CustomerDetail';
 import Ranking from './Ranking';
+import QuarterSummary from './QuarterSummary';
 import { sortStyle, tableStyle, tdStyle, dateFormate, monthFormate, lastYearMonthFormate, formattedThisMonth, cancelStyle, lastYearStyle } from './companyUtils';
 
 type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };
@@ -64,6 +65,11 @@ const Company = () => {
      */
     const [showMulti, setShowMulti] = useState<boolean>(false);
     const [showRanking, setShowRanking] = useState(false);
+    /**
+     * 4半期サマリー（2026-10-05 / v2.2.163）。⚠️ 注文（category === 'order'）だけ。
+     * ⚠️ 中身は QuarterSummary.tsx。⚠️ 契約・予算は**この画面のデータをそのまま渡す**。
+     */
+    const [showQuarterSummary, setShowQuarterSummary] = useState(false);
 
     const isSp = useIsSp();
 
@@ -971,6 +977,10 @@ const Company = () => {
                         {(category === 'order' || category === 'spec') &&
                             <div className={`text-white bg-${category === 'order' ? 'primary' : 'success'} rounded-pill px-2 py-1 mx-1 shadow-sm`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                 onClick={() => setShowRanking(true)}>契約棟数ランキング</div>}
+                        {/* ⚠️ 注文だけ。⚠️ 見た目は左の「契約棟数ランキング」と同じにしてある */}
+                        {category === 'order' &&
+                            <div className="text-white bg-primary rounded-pill px-2 py-1 mx-1 shadow-sm" style={{ fontSize: '10px', cursor: 'pointer' }}
+                                onClick={() => setShowQuarterSummary(true)}>4半期サマリー</div>}
                         <div className="bg-white m-1">
                             <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'><input type='checkbox' className='me-1'
                                 onChange={() => setShowLastYear(!showLastYear)} />昨年実績を表示</label>
@@ -1162,6 +1172,16 @@ const Company = () => {
             <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
             <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
             <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement}/>
+            {category === 'order' &&
+                <QuarterSummary
+                    show={showQuarterSummary}
+                    setShow={setShowQuarterSummary}
+                    targetYear={targetYear}
+                    customerList={customerList}
+                    shopList={shopList}
+                    sectionList={sectionList}
+                    achievement={achievement}
+                />}
         </>
     )
 }
```

### `backend/scripts/sql/2026-10-05_update_log_2.2.163.sql`（全文）

```sql
-- =====================================================================
-- update_log に v2.2.163 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
--
-- ⚠️⚠️ **この版はDBの構造を変えない**（表も列も追加なし）。流すのはこれだけ。
-- ⚠️ 2026-10-05 に4半期サマリーを同じ版に足したため、文言を追記した
--   （⚠️ ローカルDBは UPDATE で同じ文言に揃え済み）。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.163', '2026-10-05', 'スタッフ管理を改修した。権限編集で氏名・権限・事業区分・メールアドレス・パスワードを変更できるようにした。スタッフ追加では課と店舗を選ばないと登録できないようにした。権限編集の一覧からログイン情報が送られないようにした。\n会社実績（注文）に「4半期サマリー」を追加した。四半期・半期・年度ごとの契約実績（予算・実績・差異・前期実績・昨対比・契約予定）と反響実績（総反響・来場・次アポ・契約と歩留まり）を、全店舗・課・店舗ごとに確認できる。');
```
