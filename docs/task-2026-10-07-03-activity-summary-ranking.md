# 2026-10-07 活動サマリー（アクションボード・契約率ランキング）とランキングの改修（v2.2.169）

## 依頼（ReadMeClaude.md）
- Header.tsx: '日報' → **活動サマリー**。既存の月次日報・営業別契約率に加え、**アクションボード**（DailyAction.tsx、category === 'order' のみ）と **契約率ランキング**（Ranking.tsx）を追加
- Ranking.tsx: `targetDivision`（order / spec）と上部の「事業部を選択」select。表示を targetDivision に合わせる
- mode === 'staff' のとき **予算** 列を「総計」の左に（company_achievement の category = staff、period が今年（年度ではない）の value。期間で変えない固定値）
- **達成率** を「総計」の右に

## 確認した回答
- 事業部の初期値: ⚠️ **ログイン中の事業に合わせる**（spec なら spec、それ以外は order）
- 個人別の達成率: ⚠️ **常に 総計 ÷ 年間予算**
- 契約率ランキング: ⚠️ **全員**
- Ranking.tsx の `size='lg'` は ⚠️ **オーナーによる変更**。そのまま受け入れ

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | `version.ts` | `2.2.169` |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-07_update_log_2.2.169.sql` | update_log（ローカル no=265 で投入・文言は UPDATE で揃え済み） |
| `frontend/src/components/header/` | `Header.tsx` | 「日報」→「活動サマリー」、アクションボード（`openDailyAction()`）、契約率ランキング（`showRanking` state） |
| `frontend/src/components/company/` | ⚠️ 新規 `RankingLoader.tsx` | ヘッダーから開くとき `request: 'company'` を取って Ranking に渡す |
| `frontend/src/components/company/` | `Ranking.tsx` | `targetDivision` / 事業部 select / 個人別の予算・達成率 / `size='lg'`（オーナー） |
| `docs/` | ⚠️ 新規 `deploy-v2.2.169.md` | 手順書（① フロント＋SQL のみ） |

## 設計メモ
- アクションボード: DailyAction は App.tsx に常駐し、外から開く `openDailyAction()` を既に持つ（ActiveUser.tsx が使用）。⚠️ メニューはそれを呼ぶだけ。DailyAction.tsx は変更なし。
- 契約率ランキング: Ranking はデータを受け取る作り。⚠️ RankingLoader が Company.tsx と ⚠️ **同じ API・同じ絞り方**（contract 3種、monthArray = getPeriod(thisYear-1, 6)、staff は period = thisYear）で渡す。開いたときだけ取り、一度取ったら持っておく。
- 個人予算: company_achievement の staff 行は `period = YYYY-06`（年に1行・年間予算）。⚠️ `period.startsWith(今年)` で選ぶ（2026年10月なら 2026-06）。
- 達成率の丸めは店舗別と同じ `Math.ceil`（例: 4 ÷ 3 = 133.3 → 134%）。
- 個人別の並べ替えで「達成率」を選ぶと達成率で並ぶ（⚠️ 以前は個人別では総計に読み替えていた）。
- ⚠️ Company.tsx から開くランキングにも同じ変更が入る（事業部 select・個人予算）。

## 確認（ローカル）
- `tsc --noEmit` で Header / Ranking / RankingLoader のエラーなし、build `main.6df64034.js`（変更ファイルに警告なし）。
- 旧キー「日報/…」の参照が他に残っていないことを grep で確認。
- ローカルの company データで個人別の予算・達成率を計算（集計を写したスクリプト）:
  - 注文: 担当 95人中 ⚠️ **94人に予算あり**。例: 予算3・総計4 → 134%
  - 建売: 担当 23人、⚠️ **予算あり 0人**（⚠️ DB に建売の個人予算が無い → 予算・達成率は 0）
- ⚠️ ブラウザでの画面確認は ⚠️ **未実施**。

## コード

### frontend/src/components/company/RankingLoader.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { getPeriod } from '../../utils/getPeriod';
import { thisYear } from '../../utils/thisYear';
import Ranking from './Ranking';

/**
 * ヘッダーの「活動サマリー → 契約率ランキング」から開く（v2.2.169 新規）。
 *
 * ─────────────────────────────────────────────
 *   Ranking.tsx は自分でデータを取らない（Company.tsx から受け取る作り）。
 *   ⚠️ ヘッダーには Company の画面が無いので、⚠️ **ここで同じデータを取って渡す。**
 *
 *   ⚠️⚠️ **Company.tsx と同じ材料・同じ絞り方にすること**（⚠️ 2つの入口で数字が食い違わないように）。
 *     ・API … `request: 'company'`（⚠️ Company.tsx と同じ）
 *     ・customerList … contract + contract_kaeru + contract_resale
 *     ・monthArray … getPeriod(thisYear - 1, 6)（⚠️ 今期の12か月）
 *     ・staffList … staff のうち period が今年度（thisYear）の行
 *     ・achievement … そのまま
 * ─────────────────────────────────────────────
 *
 * ⚠️ 開いたときだけ取る（⚠️ ヘッダーは全画面に出ているので、開かない人の分まで取らない）。
 *   ⚠️ 一度取ったら閉じても持っておく（⚠️ 開き直すたびに取らない）。
 */

type RankingProps = React.ComponentProps<typeof Ranking>;

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

const RankingLoader = ({ show, setShow }: Props) => {
    const [customerList, setCustomerList] = useState<RankingProps['customerList']>([]);
    const [staffList, setStaffList] = useState<RankingProps['staffList']>([]);
    const [achievement, setAchievement] = useState<RankingProps['achievement']>([]);
    const [loaded, setLoaded] = useState(false);

    // ⚠️ Company.tsx の monthArray と同じ（targetYear = thisYear のとき）
    const monthArray = useMemo(() => getPeriod(Number(thisYear) - 1, 6), []);

    useEffect(() => {
        if (!show || loaded) return;
        let alive = true;
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'company' });
                if (!alive) return;
                const data = response.data ?? {};
                setCustomerList([...(data.contract ?? []), ...(data.contract_kaeru ?? []), ...(data.contract_resale ?? [])]);
                setStaffList((data.staff ?? []).filter((s: { period: string }) => s.period === String(thisYear)));
                setAchievement(data.achievement ?? []);
                setLoaded(true);
            } catch (error) {
                // ⚠️ 黙らない。⚠️ 取れないと表が「該当するデータがありません」のままになる
                console.error('ランキングのデータ取得に失敗しました:', error);
            }
        })();
        return () => { alive = false; };
    }, [show, loaded]);

    return (
        <Ranking
            showRanking={show}
            setShowRanking={setShow}
            customerList={customerList}
            monthArray={monthArray}
            staffList={staffList}
            achievement={achievement}
        />
    );
};

export default RankingLoader;
```

### frontend/src/components/company/Ranking.tsx（修正後・全文）
```tsx
import React, { useContext, useEffect, useState } from 'react';
import { Modal, Table, Badge, Nav } from 'react-bootstrap';
import AuthContext from "../../context/AuthContext";
import { thisYear } from "../../utils/thisYear";
type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };

type Customer = Record<string, string>;

/**
 * 予算。Company.tsx と同じ形。
 *   category = 'shop'  … 店舗別ランキング（月ごとの行。期間で合計する）
 *   category = 'staff' … 個人別ランキング（v2.2.169。⚠️ 年に1行、period = `YYYY-06`、値は年間予算）
 */
type Achievement = { category: string, name: string, period: string, value: string };

/** 集計の単位。個人別＝担当者ごと、店舗別＝店舗ごと */
type RankMode = 'staff' | 'shop';

/**
 * ランキング1行。
 *
 * 個人別と店舗別で表の構造は同じなので、意味だけを差し替えて使い回す。
 *   個人別 … label = 氏名 / sub = 所属店舗
 *   店舗別 … label = 店舗 / sub = 課
 */
type RankedRow = {
    label: string;
    sub: string;
    totalCount: number;
    periodCount: number;
    /**
     * 予算。
     *   店舗別 … 表示している期間の合計（期間指定なし＝今期全体）
     *   個人別 … ⚠️ **今年の年間予算の固定値**（v2.2.169。⚠️ 期間を絞っても変えない）
     */
    budget: number;
    /**
     * 達成率（%）。
     *
     * ⚠️⚠️ **店舗別と個人別で分子が違う。**
     *   店舗別 … 期間指定あり＝期間計 / 指定なし＝総計（⚠️ 予算も同じ期間で集計してある）
     *   個人別 … ⚠️ **常に総計 ÷ 年間予算**（v2.2.169 の決定。⚠️ 予算が年間の固定値のため）
     * ⚠️ ソートに使うため、表示のたびに計算せず行に持たせる。
     */
    rate: number;
    rank: number;
};

/**
 * 並べ替えの対象。
 * ⚠️ `rate` は v2.2.169 から ⚠️ **個人別でも使う**（個人の年間予算を足したため）。
 */
type SortKey = 'total' | 'period' | 'rate';

/** 事業部の選択肢（v2.2.169）。⚠️ 値は AuthContext の category と同じ語 */
type Division = 'order' | 'spec';

const DIVISION_LABEL: Record<Division, string> = { order: '注文事業', spec: '建売事業' };

/** customerList の category 列の値（⚠️ 「注文」「建売」で入っている） */
const CUSTOMER_CATEGORY: Record<Division, string> = { order: '注文', spec: '建売' };

/** ログイン中の事業から初期値を決める。⚠️ spec 以外（order / used / 未設定）は注文事業 */
const divisionOf = (category: string | null | undefined): Division => (category === 'spec' ? 'spec' : 'order');

type Props = {
    showRanking: boolean,
    setShowRanking: React.Dispatch<React.SetStateAction<boolean>>,
    customerList: Customer[],
    monthArray: string[],
    staffList: Staff[],
    achievement: Achievement[]
};

const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffList, achievement }: Props) => {
    const { category, authority } = useContext(AuthContext);
    const [targetCustomer, setTargetCustomer] = useState<RankedRow[]>([]);

    // 既定は個人別。従来の挙動を変えない
    const [mode, setMode] = useState<RankMode>('staff');

    /**
     * 表示する事業部（v2.2.169）。⚠️ 上部の select で切り替える。
     * ⚠️ 初期値は ⚠️ **ログイン中の事業**（2026-10-07 の決定。⚠️ 建売の人には建売から出す＝従来の見え方）。
     */
    const [targetDivision, setTargetDivision] = useState<Division>(() => divisionOf(category));
    // ⚠️ AuthContext の読み込みが後から終わったときも合わせる
    useEffect(() => { setTargetDivision(divisionOf(category)); }, [category]);

    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'desc' | 'asc' }>({
        key: 'total',
        direction: 'desc'
    });

    const formate = (value: string) => {
        return (value ?? '').replace(/\//g, '-').slice(0, 7);
    };

    /** 期間が指定されているか。⚠️ 実績・予算・達成率のすべてがこれで切り替わる */
    const showPeriodCol = startMonth !== '' || endMonth !== '';

    /**
     * 達成率（%）。小数第一位を切り上げた整数で返す。
     *
     * ⚠️ 予算が0だと Infinity、実績も0だと NaN になる。
     *   予算未設定の店舗が「Infinity%」と表示されるのを防ぐため 0% に丸める。
     */
    const achievementRate = (count: number, budget: number): number => {
        const rate = (count / budget) * 100;
        if (!Number.isFinite(rate)) return 0;
        return Math.ceil(rate);
    };

    useEffect(() => {
        if (customerList.length === 0) return;

        const targetStaff = staffList.map(s => s.name);

        /**
         * 個人の年間予算（v2.2.169）。⚠️ company_achievement の category = 'staff'。
         * ⚠️⚠️ **period は「今年（年度ではない）」で選ぶ**（指示書）。⚠️ 行は `YYYY-06` の形で年に1行。
         *   ⚠️ 2026年10月なら `2026-06` の行。⚠️ 期間の絞り込みでは変えない（固定値）。
         */
        const year = String(new Date().getFullYear());
        const staffBudget = new Map<string, number>();
        achievement.forEach(a => {
            if (a.category !== 'staff' || !String(a.period ?? '').startsWith(year)) return;
            // ⚠️ value は文字列。空欄などは 0
            staffBudget.set(a.name, (staffBudget.get(a.name) ?? 0) + (Number(a.value) || 0));
        });

        // 💡 1. 集計対象の母集団。
        //
        //    ⚠️ 個人別・店舗別のどちらも「staffList に載っている担当者の契約」だけを数える。
        //      店舗別で担当者を問わず数えると、個人別の合計と店舗別の合計が一致せず
        //      「どちらが正しいのか」という問い合わせが必ず発生する。
        const inCategory = customerList.filter(c =>
            c.category === CUSTOMER_CATEGORY[targetDivision] &&
            c.staff && targetStaff.includes(c.staff)
        );

        // 実績0でも一覧に出すため、契約の有無に関わらず存在する値を集める
        const uniqueKeys = [...new Set(
            inCategory
                .map(c => mode === 'staff' ? c.staff : c.shop)
                .filter(v => v) // 空白やnullを除外
        )];

        // 💡 2. カウント用の契約済みベースリスト
        const baseFiltered = inCategory.filter(c =>
            c.status === '契約済み' &&
            monthArray.includes(formate(c.contract))
        );

        // 店舗 → 課。店舗別のときの「所属」列に使う
        const sectionByShop = new Map<string, string>();
        staffList.forEach(s => {
            if (s.shop && s.section && !sectionByShop.has(s.shop)) {
                sectionByShop.set(s.shop, s.section);
            }
        });

        let formattedList = uniqueKeys.map(key => {
            // カウント対象のデータ
            const target = baseFiltered.filter(f => (mode === 'staff' ? f.staff : f.shop) === key);

            const periodTarget = target.filter(c =>
                (!startMonth || formate(c.contract) >= startMonth) &&
                (!endMonth || formate(c.contract) <= endMonth)
            );

            /**
             * 個人別のときの「所属」。
             *
             * ─────────────────────────────────────────────
             * ⚠️⚠️ **今年の所属ではなく「実際に契約を上げた店舗」を出す**（オーナー改修）。
             *   ⚠️ 期中に異動した担当者がいるため、⚠️ **マスタの所属だけだと
             *     どこで上げた実績か分からなくなる。**
             *   ⚠️ 複数店舗で上げていれば ⚠️ **カンマでつなぐ。**
             *
             * ⚠️ 契約が1件も無い担当者は、⚠️ **今年のマスタの所属**を出す
             *   （⚠️ 実績0でも一覧には出すため）。
             * ─────────────────────────────────────────────
             *
             * ⚠️ 判定は `monthArray`（今期）の契約日だけを見る。
             *   ⚠️⚠️ **ステータスは見ていない**（解約も所属の手がかりとして残す）。
             *   ⚠️ ⚠️ **そのため件数（totalCount）が0でも所属が出ることがある。**
             */
            const contractedShops = [...new Set(
                inCategory
                    .filter(c => c.staff === key && monthArray.includes(formate(c.contract)))
                    .map(c => c.shop)
                    // ⚠️ 空の店舗を混ぜないこと。⚠️ `A,,B` のような表示になる
                    .filter(shop => shop)
            )];

            const sub = mode === 'staff'
                ? (contractedShops.length > 0
                    ? contractedShops.join(',')
                    : staffList.find(s => s.name === key && String(s.period) === String(thisYear))?.shop ?? '')
                : (sectionByShop.get(key) ?? '');

            // 予算。
            //
            // 店舗別 … ⚠️ 期間が未指定なら monthArray 全体（＝総計に対応する予算）、
            //   指定されていればその範囲（＝期間計に対応する予算）を合計する。
            //   表示している実績と期間が揃っていないと比較の意味がなくなる。
            // 個人別 … ⚠️ 今年の年間予算（固定値。上の staffBudget）
            const budget = mode === 'staff'
                ? (staffBudget.get(key) ?? 0)
                : mode === 'shop'
                ? achievement
                    .filter(a => {
                        if (a.category !== 'shop' || a.name !== key) return false;
                        const period = formate(a.period);
                        if (!monthArray.includes(period)) return false;
                        if (startMonth && period < startMonth) return false;
                        if (endMonth && period > endMonth) return false;
                        return true;
                    })
                    // ⚠️ value は文字列。空欄や全角数字が入りうるので Number() が NaN になりうる
                    .reduce((sum, a) => sum + (Number(a.value) || 0), 0)
                : 0;

            return {
                label: key,
                sub,
                totalCount: target.length,
                periodCount: periodTarget.length,
                budget,
                /**
                 * ⚠️⚠️ **分子は予算と同じ期間のものを使う。**
                 *   ⚠️ 期間指定があれば期間計、無ければ総計。
                 *   ⚠️ ⚠️ **揃えないと「総計の実績 ÷ 期間の予算」になり、意味の無い数字が出る。**
                 * ⚠️ 個人別は ⚠️ **常に総計 ÷ 年間予算**（v2.2.169。予算が年間の固定値のため）。
                 */
                rate: mode === 'shop'
                    ? achievementRate(showPeriodCol ? periodTarget.length : target.length, budget)
                    : achievementRate(target.length, budget)
            };
        });

        /**
         * 並べ替えと順位付けに使う値。
         *
         * ⚠️⚠️ **ソート・順位・足切りの3箇所で必ず同じものを使うこと。**
         *   ⚠️ ⚠️ **1箇所でも食い違うと、並びと順位が合わない表になる。**
         *
         * ⚠️ v2.2.169 から達成率は個人別にもあるので、そのまま使う
         *   （⚠️ 以前は個人別で総計に読み替えていた）。
         */
        const valueOf = (item: { totalCount: number, periodCount: number, rate: number }): number => {
            if (sortConfig.key === 'period') return item.periodCount;
            if (sortConfig.key === 'rate') return item.rate;
            return item.totalCount;
        };

        // 💡 3. ソート処理
        formattedList.sort((a, b) => {
            const valA = valueOf(a);
            const valB = valueOf(b);

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // 💡 4. 同着を考慮した順位付け
        let previousValue = -1;
        let actualRank = 1;

        const rankedList: RankedRow[] = formattedList.map((item, index) => {
            const currentValue = valueOf(item);
            if (currentValue !== previousValue) {
                actualRank = index + 1;
            }
            previousValue = currentValue;
            return { ...item, rank: actualRank };
        });

        // 💡 5. フェアな足切りロジック（Master権限の場合は全件表示）
        let displayList = rankedList;
        if (authority !== 'Master' && rankedList.length > 10) {
            const thresholdScore = valueOf(rankedList[9]);
            displayList = rankedList.filter(item => {
                const val = valueOf(item);
                if (sortConfig.direction === 'desc') return val >= thresholdScore;
                return val <= thresholdScore;
            });
        }

        setTargetCustomer(displayList);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerList, monthArray, targetDivision, authority, startMonth, endMonth, sortConfig, staffList, mode, achievement, showPeriodCol]);

    const renderRankIcon = (rank: number) => {
        if (sortConfig.direction === 'asc') return `${rank}位`;

        if (rank === 1) return <><i className="fa-solid fa-crown text-warning me-1"></i>1位</>;
        if (rank === 2) return <><i className="fa-solid fa-crown me-1" style={{ color: '#C0C0C0' }}></i>2位</>;
        if (rank === 3) return <><i className="fa-solid fa-crown me-1" style={{ color: '#CD7F32' }}></i>3位</>;
        return `${rank}位`;
    };

    const handleSort = (key: SortKey) => {
        let direction: 'desc' | 'asc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <i className="fa-solid fa-sort ms-1" style={{ color: '#dee2e6' }}></i>;
        return sortConfig.direction === 'desc'
            ? <i className="fa-solid fa-sort-down ms-1 text-primary"></i>
            : <i className="fa-solid fa-sort-up ms-1 text-primary"></i>;
    };

    return (
        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered size='lg'>
            <Modal.Header closeButton className="bg-light border-bottom-0 py-2">
                <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
                    {DIVISION_LABEL[targetDivision]} 契約ランキング
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">

                {/* 集計単位の切り替え。既定は個人別（従来の表示） */}
                <Nav
                    variant="tabs"
                    activeKey={mode}
                    onSelect={(key) => setMode(key === 'shop' ? 'shop' : 'staff')}
                    className="px-2 pt-2 bg-light"
                >
                    <Nav.Item>
                        <Nav.Link eventKey="staff" className="py-1 px-3" style={{ fontSize: '12px' }}>
                            <i className="fa-solid fa-user me-1"></i>個人別
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="shop" className="py-1 px-3" style={{ fontSize: '12px' }}>
                            <i className="fa-solid fa-store me-1"></i>店舗別
                        </Nav.Link>
                    </Nav.Item>
                </Nav>

                <div className="d-flex align-items-center justify-content-end gap-2 px-3 py-2 bg-light border-bottom">
                    {/* ⚠️ 事業部の選択（v2.2.169）。⚠️ 月の選択より左に置く */}
                    <select
                        className="form-select form-select-sm shadow-sm me-auto"
                        style={{ width: '130px', fontSize: '11px', cursor: 'pointer' }}
                        value={targetDivision}
                        onChange={e => setTargetDivision(divisionOf(e.target.value))}
                        aria-label="事業部を選択"
                    >
                        <option value="order">{DIVISION_LABEL.order}</option>
                        <option value="spec">{DIVISION_LABEL.spec}</option>
                    </select>
                    <div className="d-flex align-items-center gap-1">
                        <label className="text-muted mb-0 fw-bold" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>開始月</label>
                        <select
                            className="form-select form-select-sm shadow-sm"
                            style={{ width: '100px', fontSize: '11px', cursor: 'pointer' }}
                            value={startMonth}
                            onChange={e => setStartMonth(e.target.value)}
                        >
                            <option value="">未選択</option>
                            {monthArray.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
                        </select>
                    </div>
                    <span className="text-muted" style={{ fontSize: '11px' }}>〜</span>
                    <div className="d-flex align-items-center gap-1">
                        <label className="text-muted mb-0 fw-bold" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>終了月</label>
                        <select
                            className="form-select form-select-sm shadow-sm"
                            style={{ width: '100px', fontSize: '11px', cursor: 'pointer' }}
                            value={endMonth}
                            onChange={e => setEndMonth(e.target.value)}
                        >
                            <option value="">未選択</option>
                            {monthArray.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
                        </select>
                    </div>
                </div>

                <Table hover className="align-middle mb-0 text-center" style={{ fontSize: '12px' }}>
                    <thead className="bg-light text-muted">
                        <tr>
                            <th className="py-2" style={{ width: '60px' }}>順位</th>
                            <th className="py-2 text-start">{mode === 'staff' ? '氏名' : '店舗'}</th>
                            <th className="py-2">{mode === 'staff' ? '所属' : '課'}</th>

                            {/* 予算。期間の指定に合わせて総計／期間計のどちらかに対応する */}
                            {mode === 'shop' && (
                                <th className="py-2 text-danger" style={{ width: '70px' }}>予算</th>
                            )}

                            {showPeriodCol && (
                                <th
                                    className="py-2 text-info"
                                    style={{ width: '80px', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => handleSort('period')}
                                >
                                    期間計{getSortIcon('period')}
                                </th>
                            )}

                            {/* ⚠️ 個人別の予算（v2.2.169）。⚠️ **総計の左隣**（指示書）。⚠️ 今年の年間予算の固定値 */}
                            {mode === 'staff' && (
                                <th className="py-2 text-danger" style={{ width: '70px' }}>
                                    予算
                                    <div className="fw-normal text-muted" style={{ fontSize: '10px' }}>年間</div>
                                </th>
                            )}

                            <th
                                className="py-2"
                                style={{ width: '80px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('total')}
                            >
                                総計{getSortIcon('total')}
                            </th>

                            {/*
                              * ⚠️⚠️ **達成率は常に独立した列にする**（2026-09-24 の指示）。
                              *   ⚠️ 以前は総計・期間計のセルに括弧書きで同居させていた。
                              *   ⚠️ ⚠️ **同居していると並べ替えの対象にできない。**
                              * ⚠️ 見出しに「期間／総計」のどちらを割ったかを必ず出すこと。
                              * ⚠️ v2.2.169 から個人別にも出す（⚠️ 個人別は常に 総計÷予算）。
                              */}
                            <th
                                className="py-2 text-success"
                                style={{ width: '90px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('rate')}
                            >
                                達成率{getSortIcon('rate')}
                                <div className="fw-normal text-muted" style={{ fontSize: '10px' }}>
                                    {mode === 'shop' && showPeriodCol ? '期間計÷予算' : '総計÷予算'}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetCustomer.map((item, index) => (
                            <tr key={`${item.label}_${index}`} className={item.rank <= 3 && sortConfig.direction === 'desc' ? "fw-bold" : ""}>
                                <td className="py-2">
                                    {item.rank <= 3 && sortConfig.direction === 'desc' ? (
                                        <span style={{ fontSize: '13px' }}>{renderRankIcon(item.rank)}</span>
                                    ) : (
                                        <Badge bg="secondary" pill className="fw-normal">{item.rank}</Badge>
                                    )}
                                </td>
                                <td className="text-start py-2">{item.label}</td>
                                <td className="text-muted py-2" style={{ fontSize: '11px' }}>{item.sub}</td>

                                {mode === 'shop' && (
                                    <td className="text-danger fw-bold py-2" style={{ fontSize: '13px' }}>{item.budget}</td>
                                )}

                                {showPeriodCol && (
                                    <td className="text-info fw-bold py-2" style={{ fontSize: '13px' }}>
                                        {item.periodCount}
                                    </td>
                                )}

                                {mode === 'staff' && (
                                    <td className="text-danger fw-bold py-2" style={{ fontSize: '13px' }}>{item.budget}</td>
                                )}

                                <td className="text-primary fw-bold py-2" style={{ fontSize: '13px' }}>
                                    {item.totalCount}
                                </td>

                                <td className="text-success fw-bold py-2" style={{ fontSize: '13px' }}>
                                    {item.rate}%
                                </td>
                            </tr>
                        ))}
                        {targetCustomer.length === 0 && (
                            <tr>
                                {/* ⚠️ 順位・名前・所属・総計の4列 ＋ 期間計 ＋ 予算と達成率（v2.2.169 から個人別・店舗別の両方） */}
                                <td colSpan={4 + (showPeriodCol ? 1 : 0) + 2} className="py-4 text-muted">該当するデータがありません</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Modal.Body>
        </Modal>
    );
};

export default Ranking;```

### frontend/src/components/header/Header.tsx（差分）
```diff
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 2edf5494..4aa52fa2 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -29,10 +29,12 @@ import EventSummary from './EventSummary';
 import EventBudget from './EventBudget';
 import GoogleReview from './GoogleReview';
 import UploadLoan from './UploadLoan';
+import RankingLoader from '../company/RankingLoader';
+import { openDailyAction } from '../DailyAction';
 import { useNavigate } from "react-router-dom";
 
 // 型安全のための定義
-type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '日報' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
+type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '活動サマリー' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
 
 /**
  * 他社動向メニューの最後に出す項目。
@@ -48,7 +50,7 @@ type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' |
 const CLAUDE_COMPETITOR_ITEM = 'Claudeによる競合分析';
 
 const Header = ({ }) => {
-    const { authority } = useContext(AuthContext);
+    const { authority, category } = useContext(AuthContext);
     /** 表示中のメニュー項目。⚠️ `メニュー/項目` 形式（editMapping のキーと同じ） */
     const [editMenu, setEditMenu] = useState<string>('');
     /**
@@ -75,9 +77,14 @@ const Header = ({ }) => {
      * ⚠️ UploadLoan も自前のモーダル（md）を持つため、共通モーダル（xl）には載せず専用の state で開く。
      */
     const [uploadLoan, setUploadLoan] = useState<boolean>(false);
+    /**
+     * 契約率ランキング（v2.2.169）。
+     * ⚠️ Ranking も自前のモーダルを持つため、共通モーダル（xl）には載せず専用の state で開く。
+     */
+    const [showRanking, setShowRanking] = useState<boolean>(false);
     const [modal, setModal] = useState<boolean>(false);
     const [callStatusShow, setCallStatusShow] = useState(true);
-    const menuArray: MenuKey[] = ['システム管理', '反響管理', '土地・物件管理', '他社動向', '日報', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
+    const menuArray: MenuKey[] = ['システム管理', '反響管理', '土地・物件管理', '他社動向', '活動サマリー', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
     const [newEstate, setNewEstate] = useState<number | null>(0);
 
     const navigate = useNavigate();
@@ -159,9 +166,16 @@ const Header = ({ }) => {
         //   ⚠️ ⚠️ **ここを外すだけでは権限は閉じない**（⚠️ メニューから消えるだけ）。
         //     ⚠️ ② 側も `staff_contract` で同じ2つを確かめている。
         //   ⚠️ 他の管理者向け画面（Menu.tsx の予算詳細など）と同じ条件に揃えてある。
-        '日報': (authority === 'Master' || authority === 'BrandAdmin')
-            ? ['月次日報', '営業別契約率']
-            : ['月次日報'],
+        //
+        // ⚠️ v2.2.169 に「日報」から「活動サマリー」へ改名し、2つ足した。
+        //   ⚠️ アクションボード … ⚠️ **category === 'order' だけ**（⚠️ DailyAction 自体も注文だけを対象にしている）。
+        //   ⚠️ 契約率ランキング … 全員（⚠️ Master 以外は上位10位前後だけ出る仕組みが Ranking 側にある）。
+        '活動サマリー': [
+            '月次日報',
+            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['営業別契約率'] : []),
+            ...(category === 'order' ? ['アクションボード'] : []),
+            '契約率ランキング',
+        ],
         '公式アンバサダー': ['アンバサダー管理', '反響一覧'],
         '紹介キャンペーン': ['反響一覧'],
         '集客イベント': ['反響一覧', '集客サマリー', '広告費入力'],
@@ -199,8 +213,8 @@ const Header = ({ }) => {
         '土地・物件管理/SatBaseサマリー': <SatBaseDatabase />,
         // ⚠️ v2.2.165: 上部の「最新の他社分析」カードから、同じモーダルのまま他社分析へ切り替える。
         //   ⚠️ どちらも isFullscreenMenu に入っているので、⚠️ 全画面のまま中身だけ替わる。
-        '日報/月次日報': <DailyReports onOpenCompetitorReports={() => setEditMenu(`他社動向/${CLAUDE_COMPETITOR_ITEM}`)} />,
-        '日報/営業別契約率': <StaffContractRate />,
+        '活動サマリー/月次日報': <DailyReports onOpenCompetitorReports={() => setEditMenu(`他社動向/${CLAUDE_COMPETITOR_ITEM}`)} />,
+        '活動サマリー/営業別契約率': <StaffContractRate />,
         '公式アンバサダー/アンバサダー管理': <AmbassadorList />,
         '公式アンバサダー/反響一覧': <InquiryAmbassador />,
         '紹介キャンペーン/反響一覧': <InquiryIntroductory />,
@@ -233,7 +247,7 @@ const Header = ({ }) => {
     // 反響一覧も横に列が多いため同じ扱いにする。
     // ⚠️ キーは `メニュー/項目` 形式（editMapping と同じ）
     const isFullscreenMenu = [
-        '日報/月次日報',
+        '活動サマリー/月次日報',
         '公式アンバサダー/アンバサダー管理',
         '公式アンバサダー/反響一覧',
         '紹介キャンペーン/反響一覧',
@@ -271,7 +285,7 @@ const Header = ({ }) => {
         //   ⚠️ xl のままだと右半分が隠れて横スクロール頼みになる（2026-10-02 の指示で全画面）。
         //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
         //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
-        '日報/営業別契約率',
+        '活動サマリー/営業別契約率',
     ].includes(editMenu);
 
     // 見出しには項目名だけを出す（キーの `メニュー/` は表示に使わない）
@@ -384,6 +398,17 @@ const Header = ({ }) => {
                                             setUploadLoan(true);
                                             return;
                                         }
+                                        // ⚠️ アクションボード（v2.2.169）は ⚠️ **App.tsx に置いてある DailyAction を開くだけ**。
+                                        //   ⚠️ ActiveUser.tsx のボタンと同じ関数（⚠️ 押したときは取り直し、0件でも開く）。
+                                        if (menu === '活動サマリー' && item === 'アクションボード') {
+                                            openDailyAction();
+                                            return;
+                                        }
+                                        // ⚠️ 契約率ランキング（v2.2.169）も自前のモーダル
+                                        if (menu === '活動サマリー' && item === '契約率ランキング') {
+                                            setShowRanking(true);
+                                            return;
+                                        }
                                         // ⚠️ キーは `メニュー/項目`。項目名だけだと
                                         //   複数のメニューにある「反響一覧」が区別できない
                                         setEditMenu(`${menu}/${item}`);
@@ -497,6 +522,9 @@ const Header = ({ }) => {
 
             {/* ローン情報更新（v2.2.168）。⚠️ 自前のモーダル（md）なので共通モーダルの外に置く */}
             <UploadLoan show={uploadLoan} setShow={setUploadLoan} />
+
+            {/* 契約率ランキング（v2.2.169）。⚠️ データは RankingLoader が開いたときに取る */}
+            <RankingLoader show={showRanking} setShow={setShowRanking} />
         </>
     );
 };
```
