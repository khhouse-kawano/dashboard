import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthContext from "../../context/AuthContext";
import { getPeriod } from '../../utils/getPeriod';
import { getYears } from '../../utils/getYears';
import InformationEdit from '../information/InformationEdit';
import InformationEditKaeru from '../information/InformationEditKaeru';
import InformationEditResale from '../information/InformationEditResale';
import { thisYear } from '../../utils/thisYear';
import apiClient from '../../utils/apiClient';
import CustomerDetail from './CustomerDetail';
import Ranking from './Ranking';
import QuarterSummary from './QuarterSummary';
import CompanyToolbar from './CompanyToolbar';
import CompanyTable from './CompanyTable';
import type { CommitBudget } from './CompanyTable';
import { COMPANY_STYLE } from './companyStyle';
import { formattedThisMonth } from './companyUtils';
import { DIVISION_ORDER, REALTY_NAME, aggregateContracts, buildRows, multiChildrenOf } from './companyAggregate';
import type { Achievement, Customer, RealtyDeal, Section, Shop, Staff } from './companyTypes';

/**
 * 全社報告用フォーマット（会社実績）。
 *
 * ─────────────────────────────────────────────
 * v2.2.264 で、1つだった画面を分けた（2026-11-11 の指示：表示の速さ・見やすさ）。
 *   Company.tsx          … データの取得と、画面の状態（このファイル）
 *   companyAggregate.ts  … 集計（契約の振り分け・行とセルの文字づくり）。⚠️ 数え方の決まりはここの注記
 *   CompanyTable.tsx     … 表（並べるだけ。セルは memo）
 *   CompanyToolbar.tsx   … 上のバー
 *   companyStyle.ts      … 見た目
 *
 * ⚠️ 速さのために守ること
 *   ・部品（セル・行）を Company の中で定義しない（描き直すたびに全セルを作り直すことになる）
 *   ・表に渡す関数は useCallback で固定する（変わると全セルを描き直す）
 *   ・集計は useMemo の2段（契約の振り分け → 行づくり）。予算の保存では、1段目は動かない
 *   ・予算の入力中は state を変えない（欄を離れたときに保存。CompanyTable.tsx の BudgetInput）
 *
 * ⚠️⚠️ **「要確認」モーダルはこの画面が持っていない**（2026-09-28 に移した）。
 *   ⚠️ 「URL が変わるたびに出す」ため `App.tsx` に1つだけ置いてある。**ここに戻さないこと。**
 *
 * ⚠️ v2.2.300 年度ごとに読む（GET の company_year。② の features/company/index.ts の runCompanyYear）
 *   ・開いたとき・期（targetYear）を変えたときに、その年度で読み直す。⚠️ 表示の切り替え（昨年実績・キャンセル・併売店）では読まない
 *   ・② は契約者だけを年度（＋前年度・今月・S〜C ランク）で絞って返す。画面はそれを今までと同じ集計にかける（数字は変わらない）
 *   ・期は画面の URL にも出す（?year=2025。今年度は出さない）。URL の year で開くと、その期で開く
 *   ・② に届かないときは、今までの company（POST・① の予備あり）で全年度を1回だけ読み、以後は読み直さない（画面が期で絞る）
 *
 * ⚠️ 不動産企画係（v2.2.264）
 *   ・1つの事業部として売上を出す（② の company が返す realty_deals。数え方は月次売上管理と同じ）
 *   ・事業が不動産企画係のときも開ける（不動産企画係の事業部を先頭に出す。中古リノベのときは中古リノベのすぐ次、注文・建売は最後）
 *   ・売上のセルは押せない。⚠️ 中古リノベの下にあった「不動産企画係」の店舗の行は出さない（事業部として出すため）
 * ─────────────────────────────────────────────
 */

const EMPTY_EDIT_ID: Record<string, string> = { order: '', kaeru: '', resale: '' };

/** URL の year（⚠️ 選べる期のどれかのときだけ使う。それ以外・無しは今年度） */
const yearFromUrl = (): number => {
    const value = new URLSearchParams(window.location.search).get('year') ?? '';
    return getYears().includes(value) ? Number(value) : thisYear;
};

/** company / company_year の応答（⚠️ 形を確かめてから state に入れる。途中で切れた応答・エラーの本文を入れない） */
type CompanyBody = {
    staff: Staff[]; shop: Shop[]; section: Section[];
    contract: Customer[]; contract_kaeru: Customer[]; contract_resale: Customer[];
    achievement: Achievement[]; realty_deals?: RealtyDeal[];
};
const isCompanyBody = (body: unknown): body is CompanyBody => {
    const b = body as Partial<CompanyBody> | null;
    return !!b && [b.staff, b.shop, b.section, b.contract, b.contract_kaeru, b.contract_resale, b.achievement].every(Array.isArray);
};

const Company = () => {
    const { token, authority, category } = useContext(AuthContext);

    const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [realtyDeals, setRealtyDeals] = useState<RealtyDeal[]>([]);
    const [show, setShow] = useState(false);
    const [contract, setContract] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetYear, setTargetYear] = useState<number | null>(yearFromUrl);
    const [editId, setEditId] = useState<Record<string, string>>(EMPTY_EDIT_ID);
    const [showLastYear, setShowLastYear] = useState(false);
    const [showCancel, setShowCancel] = useState(true);
    /**
     * 併売店をまとめるか。⚠️ 既定は false（false のときは従来の表示と1つも変わらない）。
     *   true にすると、子店舗の行を隠し、親店舗の行が「自店＋子店」を数え、重複している担当の行を1本にまとめる。
     */
    const [showMulti, setShowMulti] = useState<boolean>(false);
    const [showRanking, setShowRanking] = useState(false);
    /** 4半期サマリー（注文と建売）。⚠️ 中身は QuarterSummary.tsx。契約・予算は、この画面のデータをそのまま渡す */
    const [showQuarterSummary, setShowQuarterSummary] = useState(false);

    /** v2.2.300 ② で年度ごとに読めるか（⚠️ 一度失敗したら false にして、以後は全年度の company を使う） */
    const [serverMode, setServerMode] = useState(true);
    /** ⚠️ はじめは true（最初の読み込みは setTimeout のあとに始まるので、false だと開いた直後に「読み込み済み」に見える） */
    const [loading, setLoading] = useState(true);
    /** 全年度の company を読み終えたか（⚠️ 予備のときは1回だけ読む） */
    const fullLoadedRef = useRef(false);
    /** 読み込みの番号（⚠️ 期を続けて変えたとき、古い応答を表に入れない） */
    const loadSeqRef = useRef(0);

    const apply = useCallback((body: CompanyBody) => {
        setOriginalStaffList(body.staff);
        setShopList(body.shop);
        setSectionList(body.section);
        setCustomerList([...body.contract, ...body.contract_kaeru, ...body.contract_resale]);
        setAchievement(body.achievement);
        // ⚠️ ② だけが返す（① が代わりに返したときは無い → 不動産企画係の売上は空）
        setRealtyDeals(body.realty_deals ?? []);
    }, []);

    useEffect(() => {
        // ⚠️ 予備で全年度を読み終えていれば、期を変えても読み直さない（画面が期で絞る）
        if (!serverMode && fullLoadedRef.current) return;
        const seq = ++loadSeqRef.current;
        const fetchData = async () => {
            setLoading(true);
            try {
                if (serverMode) {
                    try {
                        const response = await apiClient.get('', { params: { request: 'company_year', year: targetYear } });
                        if (seq !== loadSeqRef.current) return;
                        if (!isCompanyBody(response?.data)) throw new Error('invalid company_year response');
                        apply(response.data);
                        return;
                    } catch (error) {
                        if (seq !== loadSeqRef.current) return;
                        console.error('company_year に失敗しました。全年度の読み込みに切り替えます:', error);
                        // ⚠️ 全年度の読み込みは serverMode が変わったあとの読み込みで行う（ここで読むと2回読む）
                        setServerMode(false);
                        return;
                    }
                }
                const response = await apiClient.post('', { request: 'company' });
                if (seq !== loadSeqRef.current) return;
                if (!isCompanyBody(response?.data)) throw new Error('invalid company response');
                fullLoadedRef.current = true;
                apply(response.data);
            } catch (error) {
                console.error('全社報告用フォーマットの読み込みに失敗しました:', error);
                alert('全社報告用フォーマットのデータを読み込めませんでした。時間をおいて開き直してください。');
            } finally {
                if (seq === loadSeqRef.current) setLoading(false);
            }
        };
        // ⚠️ setTimeout(0) で1回にまとめる（StrictMode で effect が2回走ったときに2回読まない）
        const timer = window.setTimeout(() => { void fetchData(); }, 0);
        return () => window.clearTimeout(timer);
    }, [targetYear, serverMode, apply]);

    // ⚠️ v2.2.300 期を URL にも出す（⚠️ 今年度なら出さない。ほかのパラメータ（顧客を開く ?id= など）は残す）
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        if (targetYear === null || targetYear === thisYear) next.delete('year');
        else next.set('year', String(targetYear));
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [targetYear, searchParams, setSearchParams]);

    const divisionArray: string[] = useMemo(() => DIVISION_ORDER[category] ?? DIVISION_ORDER.order, [category]);
    const staffList = useMemo(() => originalStaffList.filter(o => o.period === String(targetYear)), [originalStaffList, targetYear]);
    const monthArray: string[] = useMemo(() => getPeriod(Number(targetYear) - 1, 6), [targetYear]);
    const lastYearMonthArray: string[] = useMemo(() => getPeriod(Number(targetYear) - 2, 6), [targetYear]);

    /** まとめ表示で隠す店舗（＝子店舗）の名前 */
    const mergedChildShops = useMemo(() => {
        const set = new Set<string>();
        multiChildrenOf(shopList).forEach(children => children.forEach(c => set.add(c)));
        return set;
    }, [shopList]);
    /** バーの「店舗を選択」に出す店舗（⚠️ まとめ表示中は、隠れている子店舗を選ばせない） */
    const jumpShops = useMemo(
        // ⚠️ 不動産企画係は店舗の行が無い（事業部として出す）ので、ここには出さない
        () => shopList.filter(s => s.section && s.shop !== REALTY_NAME && !(showMulti && mergedChildShops.has(s.shop))),
        [shopList, showMulti, mergedChildShops]);

    // 1段目：契約を グループ → 事業部 → 課 → 店舗 に分ける（⚠️ 予算の保存・表示の切り替えでは動かない）
    const aggregated = useMemo(
        () => aggregateContracts(customerList, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList),
        [customerList, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList]);

    // 2段目：行とセルの文字を作る
    const rows = useMemo(() => buildRows({
        customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti,
        agg: aggregated, realtyDeals, thisMonth: formattedThisMonth,
        // ⚠️ 不動産企画係の事業部の場所：不動産企画係なら先頭、中古リノベ（used）なら中古リノベのすぐ次、注文・建売は最後
        realtyPlace: category === 'realty' ? 'first' : category === 'used' ? 'afterUsed' : 'last',
    }), [customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti, aggregated, realtyDeals, category]);

    /** その行まで表を動かす。⚠️ 行が無い（「〜を選択」を選んだ）ときは、表の先頭へ */
    const moveToTarget = useCallback((targetValue: string) => {
        const target = targetValue ? document.getElementById(targetValue) : null;
        if (!target) {
            document.querySelector('.co_scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const informationEditClose = useCallback(() => setEditId(EMPTY_EDIT_ID), []);

    /**
     * 予算を保存する（⚠️ 欄を離れたときに呼ばれる）。画面の値を先に直してから送る。
     * ⚠️ 保存に失敗したら、画面の値を元に戻す（戻さないと、保存できていない値が表に残り、同じ値を入れ直しても送られない）。
     */
    const changeAchievement: CommitBudget = useCallback(async (periodValue, categoryValue, nameValue, achievementValue) => {
        const same = (a: Achievement) => a.category === categoryValue && a.period === periodValue && a.name === nameValue;
        /** 直す前の値（null は、行が無かった） */
        let before: string | null = null;
        setAchievement(prev => {
            const hit = prev.find(same);
            before = hit ? hit.value : null;
            return hit
                ? prev.map(a => (same(a) ? { ...a, value: achievementValue } : a))
                : [...prev, { category: categoryValue, period: periodValue, name: nameValue, value: achievementValue }];
        });
        try {
            await apiClient.post('', { request: 'change_company_achievement', category: categoryValue, name: nameValue, period: periodValue, value: achievementValue });
        } catch (error) {
            console.error('Error updating achievement:', error);
            const restore = before;
            setAchievement(prev => (restore === null ? prev.filter(a => !same(a)) : prev.map(a => (same(a) ? { ...a, value: restore } : a))));
            alert('予算を保存できませんでした。入力前の値に戻しました。通信の状態を確かめて、もう一度入力してください。');
        }
    }, []);

    const showCustomer = useCallback((list: Customer[]) => {
        if (list.length === 0) return;
        setContract(list);
        setShow(true);
    }, []);

    const toggleLastYear = useCallback(() => setShowLastYear(v => !v), []);
    const toggleCancel = useCallback(() => setShowCancel(v => !v), []);
    const toggleMulti = useCallback(() => setShowMulti(v => !v), []);
    const openRanking = useCallback(() => setShowRanking(true), []);
    const openQuarter = useCallback(() => setShowQuarterSummary(true), []);

    return (
        <>
            <div className={`content company co_page p-0${loading ? ' co_loading' : ''}`}>
                <style>{COMPANY_STYLE}</style>
                <CompanyToolbar
                    category={category}
                    targetYear={targetYear}
                    divisionArray={divisionArray}
                    sectionList={sectionList}
                    shops={jumpShops}
                    showLastYear={showLastYear}
                    showCancel={showCancel}
                    showMulti={showMulti}
                    canMerge={mergedChildShops.size > 0}
                    onYear={setTargetYear}
                    onJump={moveToTarget}
                    onRanking={openRanking}
                    onQuarter={openQuarter}
                    onLastYear={toggleLastYear}
                    onCancel={toggleCancel}
                    onMulti={toggleMulti}
                    loading={loading}
                />
                <CompanyTable
                    rows={rows}
                    monthArray={monthArray}
                    targetYear={targetYear}
                    showLastYear={showLastYear}
                    showCancel={showCancel}
                    onOpen={showCustomer}
                    onCommit={changeAchievement}
                />
            </div>
            <CustomerDetail show={show} setShow={setShow} contract={contract} setEditId={setEditId} category={category} />
            <InformationEdit id={editId.order} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
            <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement} />
            {(category === 'order' || category === 'spec') &&
                <QuarterSummary
                    // ⚠️ 事業が変わったら作り直す（⚠️ 中で反響を1回だけ取って持っているため）
                    key={category}
                    show={showQuarterSummary}
                    setShow={setShowQuarterSummary}
                    category={category}
                    targetYear={targetYear}
                    customerList={customerList}
                    shopList={shopList}
                    sectionList={sectionList}
                    achievement={achievement}
                    staffList={staffList}
                />}
        </>
    )
}

export default Company;
