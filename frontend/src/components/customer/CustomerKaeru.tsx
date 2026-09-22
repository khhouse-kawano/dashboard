import React, { useEffect, useMemo, useState, useContext } from 'react';
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
// ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
import { RankingStyle, SortIcon } from '../rankingUi';
import {
    isHomepageBudget,
    isHomepageCustomer,
    matchesShownMedium,
    normalizeMedium,
} from './customerKaeruUtils';

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

/**
 * ⚠️⚠️ **`medium_kaeru` に無い媒体を受け止める行の名前**（2026-09-18 の指示）。
 *
 * ⚠️ この行を足すまで、⚠️ **各媒体の行を足しても「総反響」に届かなかった。**
 *   ⚠️ `aggregated` は**足し算**で集計しており（引き算にしていない）、
 *     ⚠️ どの行にも当てはまらない反響・販促費は**黙って消えていた。**
 *   ⚠️ 実測（ローカル・建売の販促費）で ⚠️ **¥5,540,846** が消えていた
 *     （タウンライフ / Amazonギフトカード / イベント / 販促物 / LP制作 / イエタッタ）。
 *
 * ⚠️⚠️ **`medium_kaeru` の `その他` とは別物である。**
 *   ⚠️ あちらは `show_graph = 0` なので **`ホームページ反響` にまとめられる。**
 *   ⚠️ 同じ名前にすると二重に数えられるので、⚠️ **`（未分類）` を外さないこと。**
 *
 * ⚠️ この行が大きいときは ⚠️ **`medium_kaeru` に媒体を足すか、
 *   customerKaeruUtils.ts の `MEDIUM_ALIAS` に別名を足す**のが正しい対応である。
 */
const OTHER_ROW = 'その他（未分類）';
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
                (!selectedSection || sectionShops.includes(item.shop))
            );
        });
    }, [originalList, shopArray, startMonth, endMonth, selectedShop, selectedSection]);

    const filteredBudgets = useMemo(() => {
        if (!originalBudgetList.length) return [];

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
                (!selectedSection || item.order_section.includes(selectedSection))
            );
        });
    }, [originalBudgetList, startMonth, endMonth, selectedShop, selectedSection]);

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

    /**
     * ⚠️⚠️ **2026-09-22 に `groupedMediums` と `knownMediums` を廃止した。**
     *   ⚠️ 「ホームページ反響」を ⚠️ **`medium_kaeru` の `show_graph = 0` の一覧**で
     *     決めていたが、⚠️ **CustomerTrendKaeru.tsx と同じ判定へ変えた**ため
     *     （単独行のどれにも当たらない ＋ ポータル経由でない）不要になった。
     *   ⚠️ ⚠️ **二重計上を防ぐ仕組みは無くなっていない。**
     *     ⚠️ `isHomepageCustomer()` が ⚠️ **先に単独行との一致を見て弾いている。**
     */

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
        /**
         * ⚠️⚠️ **2026-09-22 から常に出す。**
         *   ⚠️ 以前は `medium_kaeru` に `show_graph = 0` の媒体があるときだけ出していた。
         *   ⚠️ ⚠️ **いまの判定は `medium_kaeru` に載っているかを見ていない**
         *     （反響媒体が空の顧客もここに入る）ので、⚠️ **台帳の中身で行が消えると困る。**
         */
        const withHomepage = [...base, { medium: HOMEPAGE_ROW }];

        /**
         * ⚠️⚠️ **「その他（未分類）」は件数が0でも必ず出す**（2026-09-18 の指示）。
         *   ⚠️ 0 のときこそ「取りこぼしが無い」という情報になる。
         *   ⚠️ 条件付きにすると、⚠️ **行が消えたのか取りこぼしが無いのか分からない。**
         * ⚠️ 位置は**いちばん最後**。個別の媒体より先に出すと内訳に見えて誤読される。
         */
        return [...withHomepage, { medium: OTHER_ROW }];
    }, [shownMediums]);

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

                /**
                 * ⚠️⚠️ **2026-09-22 に判定を CustomerTrendKaeru.tsx と同じものへ変えた**
                 *   （利用者の指示）。⚠️ **`hp_campaign` も見るようになった。**
                 *   ⚠️ ⚠️ **数字は変わる。** 以前は `medium_kaeru` に載っている
                 *     `show_graph = 0` の媒体だけを拾っていたため、
                 *     ⚠️ **台帳に無い媒体や空の媒体は「その他（未分類）」に落ちていた。**
                 */
                if (value.medium === HOMEPAGE_ROW) {
                    return isHomepageCustomer(c.medium, c.hp_campaign, shownMediums);
                }

                /**
                 * ⚠️ どの行にも当てはまらない反響。
                 * ⚠️⚠️ **ホームページ反響に吸収された顧客は必ず外すこと。**
                 *   ⚠️ 外さないと ⚠️ **同じ顧客が2つの行に数えられる。**
                 */
                if (value.medium === OTHER_ROW) {
                    if (isHomepageCustomer(c.medium, c.hp_campaign, shownMediums)) return false;
                    return !shownMediums.some(
                        shown => matchesShownMedium(c.medium, c.hp_campaign, shown)
                    );
                }

                // ⚠️ 単独行。⚠️ **反響媒体だけでなく `hp_campaign` も見る**（同上）
                return matchesShownMedium(c.medium, c.hp_campaign, value.medium);
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

                    /**
                     * ⚠️⚠️ **ホームページ反響の広告費は、媒体名を名指しで決めている**
                     *   （2026-09-22 の指示。`HOMEPAGE_BUDGET_MEDIUMS`）。
                     *   ⚠️ ⚠️ **顧客側と同じ判定にはできない。**
                     *     ⚠️ 販促費に `hp_campaign` は無く、
                     *       ⚠️ **`Amazonギフトカード` のように `medium_kaeru` に無い名前も含める**ため。
                     */
                    if (value.medium === HOMEPAGE_ROW) return isHomepageBudget(item.medium);

                    // ⚠️ 販促費側は `SNS広告` / `インターネット検索` / `カゴスマ` で入っている
                    const medium = normalizeMedium(item.medium);

                    /**
                     * ⚠️ どの行にも乗らなかった販促費。
                     * ⚠️⚠️ **ホームページ反響に数えたものは必ず外すこと**（二重計上になる）。
                     */
                    if (value.medium === OTHER_ROW) {
                        if (isHomepageBudget(item.medium)) return false;
                        return !shownMediums.includes(medium);
                    }

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
    }, [rows, shownMediums, filteredCustomers, filteredBudgets]);

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



    /**
     * 絞り込みをまとめて差し替える。
     * ⚠️ エリアは 2026-09-18 に廃止した（`selectedArea` ごと削除）。
     *   ⚠️ 引数を減らしてあるので、呼び出し側の第5引数を消し忘れないこと。
     */
    const handleSort = async (start: string, end: string, shop: string, section: string) => {
        await setStartMonth(start);
        await setEndMonth(end);
        await setSelectedShop(shop);
        await setSelectedSection(section);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    /** 見出しの期間表示。⚠️ ツールチップの文言に使う */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' && endMonth !== '' ? '' : '全期間'}`;

    /**
     * 見出しのセル。
     *
     * ⚠️⚠️ **2026-09-22 に SaaS 風の見た目へ作り替えた**（指示）。
     *   ⚠️ 並べ替えは ⚠️ **見出しそのものを押す**形にした（▲▼の小さな矢印をやめた）。
     *   ⚠️ ⚠️ **押すたびに 降順 → 昇順 → 降順 … と入れ替わる。**
     *   ⚠️ 並べ替えのキーと計算は ⚠️ **1行も変えていない**（`sorted` を参照）。
     *
     * ⚠️ `plain` のときは並べ替えない（販促媒体名の列）。
     */
    const headCell = (label: string, key: string, tip?: string, plain?: boolean) => {
        const active = sortKey === key && !plain;
        return (
            <th
                className={`rk_th${plain ? ' rk_th_name' : ' rk_th_sort'}`}
                onClick={plain ? undefined : () => changeSort(active && sortOrder === 'desc' ? 'asc' : 'desc', key)}
            >
                {tip ? (
                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: '12px' }}>{tip}</Tooltip>}
                    >
                        <span style={{ textDecoration: 'underline dotted' }}>{label}</span>
                    </OverlayTrigger>
                ) : label}
                {!plain && <SortIcon active={active} order={sortOrder} />}
            </th>
        );
    };

    /** 単価の表示。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */
    const unitText = (budget: number, count: number) =>
        isFinite(budget / count) ? `¥${Math.round(budget / count).toLocaleString()}` : '-';

    /**
     * 画面上部のまとめ。
     * ⚠️ 表の「総反響」行の合計ではなく、⚠️ **絞り込み後の顧客そのものから数える。**
     *   ⚠️ ⚠️ **媒体ごとの行を足すと、どの行にも乗らない顧客が抜ける。**
     */
    const summary = useMemo(() => {
        const total = aggregated.find(a => a.value.medium === '総反響');
        return {
            total: total?.totalValue ?? 0,
            contact: total?.contactValue ?? 0,
            interview: total?.interviewValue ?? 0,
            application: total?.applicationValue ?? 0,
            contract: total?.contractValue ?? 0,
            budget: total?.totalBudget ?? 0,
        };
    }, [aggregated]);

    return (
        <div className='content customer bg-white'>
            <RankingStyle />

            <div className="rk_wrap">
                <div className="rk_head">
                    <span className="rk_title">販促媒体別 反響・歩留まり（建売分譲事業）</span>
                    <span className="rk_note">※来場数・契約数は"反響日"起算となります。</span>
                </div>

                <div className="rk_kpi">
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">総反響</div>
                        <div className="rk_kpi_value">{summary.total.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">接触</div>
                        <div className="rk_kpi_value">{summary.contact.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">来場</div>
                        <div className="rk_kpi_value">{summary.interview.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">申込</div>
                        <div className="rk_kpi_value">{summary.application.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">契約</div>
                        <div className="rk_kpi_value">{summary.contract.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">広告費</div>
                        <div className="rk_kpi_value">¥{summary.budget.toLocaleString()}</div>
                        {/* ⚠️ 反響単価。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */}
                        <div className="rk_kpi_sub">反響単価 {unitText(summary.budget, summary.total)}</div>
                    </div>
                </div>

                <div className="rk_bar">
                    <div className="rk_field">
                        <span className="rk_label">開始月</span>
                        <select className="rk_select" value={startMonth}
                            onChange={(event) => handleSort(event.target.value, endMonth, selectedShop, selectedSection)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <span className="rk_tilde">～</span>
                    <div className="rk_field">
                        <span className="rk_label">終了月</span>
                        <select className="rk_select" value={endMonth}
                            onChange={(event) => handleSort(startMonth, event.target.value, selectedShop, selectedSection)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">店舗</span>
                        {/* ⚠️ 店舗を選んだら課は空にする（両方で絞ると必ず0件になる） */}
                        <select className="rk_select" value={selectedShop}
                            onChange={(event) => handleSort(startMonth, endMonth, event.target.value, '')}>
                            <option value="">全店舗</option>
                            {shopArray.map((item, index) => (
                                <option key={index} value={item.shop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">営業課</span>
                        <select className="rk_select" value={selectedSection}
                            onChange={(event) => handleSort(startMonth, endMonth, '', event.target.value)}>
                            <option value="">全課</option>
                            {sectionList.map((section, index) =>
                                <option value={section.name} key={index}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="rk_spacer" />
                    {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す */}
                    <button className="rk_btn" onClick={() => setShowGraph(true)}>グラフを表示</button>
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

                <div className="rk_table_wrap">
                    <table className="rk_table">
                        <thead>
                            <tr>
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
                        </thead>
                        <tbody>
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
                                    <tr className="rk_row" key={value.id ?? `medium-${index}`}>
                                        <td className="rk_td rk_td_name">{value.medium}</td>
                                        {/* ⚠️ 見出しと同じ並び。入れ替えないこと */}
                                        <td className="rk_td">{totalValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perContact}%</td>
                                        <td className="rk_td">{contactValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perInterview}%</td>
                                        <td className="rk_td">{interviewValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perApplication}%</td>
                                        <td className="rk_td">{applicationValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perContract}%</td>
                                        <td className="rk_td">{contractValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankSValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankAValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankBValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankCValue.toLocaleString()}</td>
                                        <td className="rk_td">{`¥${totalBudget.toLocaleString()}`}</td>
                                        <td className="rk_td">{unitText(totalBudget, totalValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, contactValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, interviewValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, applicationValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, contractValue)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default CustomerKaeru;
