import React, { useMemo, useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import apiClient from '../../../utils/apiClient';
import { staffSorter } from '../../../utils/staffSorter';
import { getYearMonthArray } from '../../../utils/getYearMonthArray';
import { thisYear } from '../../../utils/thisYear';
import AuthContext from '../../../context/AuthContext';
import { descending } from '../../../utils/descending';


// --- Types ---
type shopList = { brand: string, shop: string, section: string, show_flag: number };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, period: string, inside: number, section: string };
type CallLogList = {
    id: string;
    shop: string;
    name: string;
    staff: string;
    status: string;
    reserved_status: string;
    call_log: string;
    add: Boolean;
};
type CustomerList = Record<string, string>;
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string;
};
type Props = {
    callStatusShow: boolean,
    setCallStatusShow: React.Dispatch<React.SetStateAction<boolean>>,
    source?: string
};

const parseLogs = (raw: string | null | undefined): CallAction[] => {
    if (!raw || raw.trim() === "") return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "object") return [parsed];
        return [];
    } catch {
        return [];
    }
};

const filteredStaffName = (value: string) => {
    if (!value) return '';
    return value.includes('牟田') ? '牟田' : value.replace(/[  ]+/g, '');
};

const dateFormate = (value: string) => (value ?? '').replace(/-/g, '/');

/**
 * 総架電数に数える action（v2.2.186）。
 * ⚠️ 2026-10-10 の指示で ⚠️ **SMS送信も総架電数に入れる**（それまでは 通電・未通電 だけ）。
 * ⚠️ 通電数は 通電 だけ（変更なし）。⚠️ インサイドセールス表示の「SMS送信数」の行は別に残る（SMS は両方に出る）。
 * ⚠️ 店舗スタッフ表示とインサイドセールス表示の両方でこの一覧を使う（⚠️ 片方だけ直さない）。
 */
const CALL_COUNT_ACTIONS = ['通電', '未通電', 'SMS送信'];
const isCallCountAction = (action: string): boolean => CALL_COUNT_ACTIONS.includes(action);

/**
 * インサイドセールスの対象店舗。
 *
 * ⚠️ 基本は `section === '熊本営業課'` だが、2026-09-18 の指示で
 *   `PGH霧島店`（section は熊本営業課ではない）も対象に加えた。
 * ⚠️ 絞り込み（targetShopList）と表の行（displayShops）の2か所で使う。
 *   片方だけ直すと「表には出るのに数字が0」「数字はあるのに行が出ない」になる。
 */
const INSIDE_SALES_SECTION = '熊本営業課';
const INSIDE_SALES_EXTRA_SHOPS = ['PGH霧島店'];
const isInsideSalesShop = (s: shopList): boolean =>
    s.section === INSIDE_SALES_SECTION || INSIDE_SALES_EXTRA_SHOPS.includes(s.shop);

/** 合計行の見出し。⚠️ 熊本営業課以外も含むため「熊本営業課」とは書かない。 */
const INSIDE_SALES_TOTAL_LABEL = 'インサイドセールス全体';

/**
 * v2.2.294 インサイドセールスの担当者（staff_list の shop）。
 * ⚠️ 「インサイドセールス全体」の対応反響数は、今年度（thisYear）のこの店舗のスタッフが架電記録に名前を残した顧客。
 */
const INSIDE_SALES_STAFF_SHOP = 'インサイドセールス';

/**
 * v2.2.294 期間（開始月〜終了月）。⚠️ 月は 'YYYY/MM'（getYearMonthArray と同じ形）。② と URL には 'YYYY-MM' で送る。
 * ⚠️ MAX_MONTHS は ② の features/callStatusList.ts の MAX_MONTHS と同じ。
 */
const MAX_MONTHS = 12;
const DEFAULT_MONTHS = 6;
const monthIndex = (ym: string): number => { const [y, m] = ym.split('/').map(Number); return y * 12 + m - 1; };
const monthOf = (index: number): string => `${Math.floor(index / 12)}/${String((index % 12) + 1).padStart(2, '0')}`;
const thisMonth = (): string => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const defaultFrom = (): string => monthOf(monthIndex(thisMonth()) - (DEFAULT_MONTHS - 1));
/** 'YYYY-MM'（URL・②）→ 'YYYY/MM'。⚠️ 形が違えば '' */
const fromUrlMonth = (v: string | null): string => (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v.replace('-', '/') : '');
const toUrlMonth = (ym: string): string => ym.replace('/', '-');
const monthsBetween = (from: string, to: string): string[] =>
    Array.from({ length: Math.max(0, monthIndex(to) - monthIndex(from) + 1) }, (_, i) => monthOf(monthIndex(from) + i));

/**
 * v2.2.294 期間の数字を出すのに要る分だけにする（⚠️ ② に届かず全件を読んだときに、画面で使う）。
 * ⚠️⚠️ ② の features/callStatusList.ts の runCallStatusSummary と**同じ**絞り方。⚠️ 直すときは両方。
 *   顧客      … 表示中（trash = 1）で、反響日が期間の月
 *   架電シート … この事業の表示中の顧客のもので、架電記録に期間の月の日付がある・来場予定日が期間の月・上の顧客のもの
 */
const filterForPeriod = (customers: CustomerList[], callLogs: CallLogList[], months: string[]) => {
    const hit = (v: string | undefined) => months.some(m => dateFormate(v ?? '').includes(m));
    const visible = customers.filter(o => Number(o.trash) === 1);
    const visibleIds = new Set(visible.map(o => String(o.id)));
    const periodCustomers = visible.filter(o => hit(o.register));
    const periodIds = new Set(periodCustomers.map(o => String(o.id)));
    const logs = callLogs.filter(c => visibleIds.has(String(c.id)) && (
        periodIds.has(String(c.id)) || hit(c.reserved_status) || parseLogs(c.call_log).some(a => hit(a?.day))
    ));
    return { customers: periodCustomers, callLogs: logs };
};

/** v2.2.294 インサイドセールスの表の見た目（Company.tsx の付箋のような区切りに合わせる。接頭辞 csl_） */
const SHOP_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2', '#7c3aed', '#db2777'];
const CSL_STYLE = `
.csl_period { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
.csl_table { border-collapse: separate !important; border-spacing: 0; }
.csl_table td, .csl_table th { border-color: #eef0f3 !important; }
.csl_table tr.csl_gap > td { background: #f4f6f8 !important; border: 0 !important; padding: 0 !important; height: 10px; }
.csl_table tr.csl_first > td { border-top: 2px solid #94a3b8 !important; }
.csl_table td.csl_shop { border-left: 5px solid #cbd5e1 !important; background: #fff; }
.csl_table td.csl_shop::before { content: '店舗'; display: block; width: max-content; margin-bottom: 3px; font-size: 9px; font-weight: 600;
  letter-spacing: .1em; border-radius: 3px; padding: 0 6px; line-height: 1.6; background: rgba(15,23,42,.08); color: #334155; }
.csl_table td.csl_shop.csl_total { background: #111827 !important; color: #fff; border-left-color: #111827 !important; }
.csl_table td.csl_shop.csl_total::before { content: '合計'; background: #374151; color: #e5e7eb; }
.csl_table tr.csl_total_row > td:not(.csl_shop) { background: #f8fafc; }
${SHOP_COLORS.map((c, i) => `.csl_table td.csl_shop.csl_col${i} { border-left-color: ${c} !important; }`).join(' ')}
`;

const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) => {
    const [insideSalesCategory, setInsideSalesCategory] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [callLogList, setCallLogList] = useState<CallLogList[]>([]);
    const [shopArray, setShopArray] = useState<shopList[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const now = useMemo(() => new Date(), []);
    const yearValue = now.getFullYear();
    const monthValue = now.getMonth() + 1;
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalDatabase, setOriginalDatabase] = useState<CustomerList[]>([]);
    const { category } = useContext(AuthContext);
    const categoryValue = source ?? category;
    const [targetInsideSales, setTargetInsideSales] = useState('');

    /**
     * v2.2.294 期間（開始月〜終了月）。⚠️ はじめは今月までの6か月。
     * ⚠️ ヘッダーの「架電状況」のページ（source あり）で開いたときだけ、URL の from / to（'YYYY-MM'）を読み・書く。
     *   ⚠️ 顧客DB から開くモーダルでは URL に触らない（顧客DB の一覧の条件が URL に載っているため）。
     */
    const [searchParams, setSearchParams] = useSearchParams();
    /** 開いたときの期間（⚠️ URL の from / to が正しく、12か月以内のときだけ使う。それ以外は既定の6か月） */
    const [initPeriod] = useState(() => {
        const sp = new URLSearchParams(window.location.search);
        const urlFrom = source ? fromUrlMonth(sp.get('from')) : '';
        const urlTo = source ? fromUrlMonth(sp.get('to')) : '';
        const valid = urlFrom !== '' && urlTo !== '' && monthIndex(urlFrom) <= monthIndex(urlTo) && monthIndex(urlTo) - monthIndex(urlFrom) < MAX_MONTHS;
        return valid ? { from: urlFrom, to: urlTo } : { from: defaultFrom(), to: thisMonth() };
    });
    const [periodFrom, setPeriodFrom] = useState(initPeriod.from);
    const [periodTo, setPeriodTo] = useState(initPeriod.to);
    /** 表の列に出す月（古い順） */
    const displayMonths = useMemo(() => monthsBetween(periodFrom, periodTo), [periodFrom, periodTo]);

    /** 開始月を選ぶ（⚠️ 終了月が前になる・12か月を超えるときは終了月を寄せる） */
    const changeFrom = (value: string) => {
        startRendering();
        setPeriodFrom(value);
        if (monthIndex(periodTo) < monthIndex(value)) setPeriodTo(value);
        else if (monthIndex(periodTo) - monthIndex(value) >= MAX_MONTHS) setPeriodTo(monthOf(monthIndex(value) + MAX_MONTHS - 1));
    };
    /** 終了月を選ぶ（⚠️ 開始月が後になる・12か月を超えるときは開始月を寄せる） */
    const changeTo = (value: string) => {
        startRendering();
        setPeriodTo(value);
        if (monthIndex(value) < monthIndex(periodFrom)) setPeriodFrom(value);
        else if (monthIndex(value) - monthIndex(periodFrom) >= MAX_MONTHS) setPeriodFrom(monthOf(monthIndex(value) - MAX_MONTHS + 1));
    };

    // ⚠️ v2.2.294 ページで開いたときは期間を URL にも出す（⚠️ 既定の6か月なら出さない。ほかのパラメータは残す）
    useEffect(() => {
        if (!source) return;
        const next = new URLSearchParams(searchParams);
        const isDefault = periodFrom === defaultFrom() && periodTo === thisMonth();
        if (isDefault) { next.delete('from'); next.delete('to'); }
        else { next.set('from', toUrlMonth(periodFrom)); next.set('to', toUrlMonth(periodTo)); }
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [source, periodFrom, periodTo, searchParams, setSearchParams]);

    /**
     * 読み込み中の表示（v2.2.177）。
     *
     * ⚠️ 時間がかかるのは2か所: ① 取得（call_sheet 全件など）② 表の集計（⚠️ 描画の中で全架電記録を数えている）。
     *   ・loading   … 取得中
     *   ・rendering … ⚠️ 表を描く前に一度スピナーを描かせるための目印。
     *     ⚠️ 集計は同期処理で画面が固まるので、⚠️ **先にスピナーを描いてから**（setTimeout）表を描く。
     *     ⚠️ 店舗・担当・期間を切り替えたときも立てる（⚠️ 集計し直しになるため）。
     * ⚠️⚠️ v2.2.294 rendering を true / false の state で持たない。⚠️ 番号（renderRequest）を増やし、描いた番号（renderDone）と比べる。
     *   ⚠️ true / false だと、予備（全件を読み込み済み）で期間を変えたときに 表示を下ろしても画面に反映されず、
     *     ⚠️ **「集計しています」のまま止まる**ことがあった（ローカルで再現。原因の特定はできていない）。
     *   ⚠️ 番号なら、立てるたび・下ろすたびに必ず値が変わる。
     */
    const [loading, setLoading] = useState(false);
    const [renderRequest, setRenderRequest] = useState(1);
    const [renderDone, setRenderDone] = useState(0);
    const rendering = renderDone !== renderRequest;
    /** 集計し直す前に「集計しています」を出す（⚠️ 番号を1つ進める） */
    const startRendering = () => setRenderRequest(n => n + 1);
    useEffect(() => {
        if (!rendering || loading) return;
        const target = renderRequest;
        const timer = window.setTimeout(() => setRenderDone(target), 50);
        return () => window.clearTimeout(timer);
    }, [rendering, loading, renderRequest]);

    /**
     * v2.2.294 ② から期間の分だけ GET で読む（request call_status_summary）。
     * ⚠️⚠️ ② に届かないときは serverMode を false にして、今までの callStatusList（POST・① の予備あり）で全件を1回だけ読み（fullRef）、
     *   期間を変えるたびに filterForPeriod（② と同じ絞り方）で絞る。
     * ⚠️ 店舗・表示の初期値は最初の1回だけ決める（期間を変えても選んだ店舗・担当は変えない）。
     */
    const [serverMode, setServerMode] = useState(true);
    const fullRef = useRef<{ customer: CustomerList[]; callLog: CallLogList[] } | null>(null);
    const initializedRef = useRef(false);
    const loadSeqRef = useRef(0);

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        if (!callStatusShow) return;
        const seq = ++loadSeqRef.current;
        const months = monthsBetween(periodFrom, periodTo);

        /** 担当・店舗を入れ、最初の1回だけ表示の初期値を決める */
        const applyMasters = (shop: any[], staff: any[]) => {
            const divisionMapping: Record<string, string> = {
                'order': '注文事業',
                'spec': '建売分譲事業',
                'used': '中古リノベ'
            };
            const filteredShopList = shop.filter((s: any) => s.division === divisionMapping[categoryValue] && s.show_flag === 1);
            setShopArray(filteredShopList);
            setStaffArray(staff.filter((s: any) => Number(s.period) === thisYear));
            if (initializedRef.current) return;
            initializedRef.current = true;
            if (categoryValue === 'order') {
                setInsideSalesCategory('inside_sales');
                setTargetShop('inside_sales');
            } else if (categoryValue === 'used') {
                setInsideSalesCategory('shopStaff');
                setTargetShop('中古住宅専門店');
            } else {
                setInsideSalesCategory('shopStaff');
                setTargetShop(filteredShopList.map((f: any) => f.shop)[0]);
            }
        };

        /*
          ⚠️⚠️ 応答の形を先に確かめる（v2.2.177 修正: `Cannot read properties of undefined (reading 'map')`）。
            ⚠️ エラーの本文（{ status: 'error' … }）や途中で切れた応答だと callLog が無い。
            ⚠️ 配列が揃っていなければ ⚠️ **何も state に入れずに**失敗として扱う。
        */
        const isValid = (body: any): boolean => Boolean(body) && Array.isArray(body.callLog) && Array.isArray(body.shop)
            && Array.isArray(body.customer) && Array.isArray(body.staff);

        const fetchData = async () => {
            setLoading(true);
            startRendering();
            try {
                if (serverMode) {
                    try {
                        const response = await apiClient.get('', {
                            params: { request: 'call_status_summary', category: categoryValue, from: toUrlMonth(periodFrom), to: toUrlMonth(periodTo) },
                        });
                        if (seq !== loadSeqRef.current) return;
                        const body = response?.data;
                        if (!isValid(body)) throw new Error('invalid call_status_summary response');
                        // ⚠️ ② が表示中の顧客・期間で絞ってある（v2.2.177 の show_dashboard = 1 の決まりも ② が守る）
                        setCallLogList(body.callLog);
                        setOriginalDatabase(body.customer);
                        applyMasters(body.shop, body.staff);
                        return;
                    } catch (error) {
                        if (seq !== loadSeqRef.current) return;
                        console.error('call_status_summary に失敗しました。全件の読み込みに切り替えます:', error);
                        // ⚠️ 全件の読み込みは serverMode が変わったあとの読み込みで行う（ここで読むと2回読む）
                        setServerMode(false);
                        return;
                    }
                }
                if (fullRef.current === null) {
                    const response = await apiClient.post('', { request: 'callStatusList', category: categoryValue });
                    const body = response?.data;
                    if (!isValid(body)) {
                        console.error('架電状況の応答が正しくありません', typeof body === 'object' && body ? Object.keys(body) : typeof body);
                        throw new Error('invalid callStatusList response');
                    }
                    fullRef.current = { customer: body.customer, callLog: body.callLog };
                    applyMasters(body.shop, body.staff);
                }
                if (seq !== loadSeqRef.current) return;
                const { customers, callLogs } = filterForPeriod(fullRef.current.customer, fullRef.current.callLog, months);
                setCallLogList(callLogs);
                setOriginalDatabase(customers);
            } catch (error) {
                alert('架電状況の取得に失敗しました');
                console.error(error);
            } finally {
                if (seq === loadSeqRef.current) setLoading(false);
            }
        };
        // ⚠️ setTimeout(0) で1回にまとめる（開始月・終了月を両方寄せたとき・StrictMode で effect が2回走ったときに、2回読まない）
        const timer = window.setTimeout(() => { void fetchData(); }, 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callStatusShow, periodFrom, periodTo, serverMode]);

    const insideSaleStaffs = staffArray.filter(s => s.inside === 1);

    const targetShopList = useMemo(() => {
        if (categoryValue === 'order') {
            if (targetShop === 'inside_sales') {
                return shopArray.filter(isInsideSalesShop).map(s => s.shop);
            }
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'spec') {
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'used') {
            return ['買い:中古リノベ', '買い:ポータル', '売り:ポータル'];
        }
        return [];
    }, [targetShop, shopArray, categoryValue]);

    const changedStaff = useMemo(() => {
        if (category === 'used') return staffArray.filter(s => s.section === '中古住宅専門店');
        return staffArray.sort(staffSorter()).filter(s =>
            s.rank === 1 && (targetShop === 'estate' ? s.estate === 1 : (targetShop ? s.shop === targetShop : false))
        );
    }, [staffArray, targetShop]);

    const parsedCallLogs = useMemo(() => {
        // ⚠️ 念のため配列でなければ空（⚠️ 描画で落とさない）
        return (Array.isArray(callLogList) ? callLogList : []).map(log => ({
            ...log,
            parsedActions: parseLogs(log.call_log)
        }));
    }, [callLogList]);

    const targetCallLog = useMemo(() => {
        return parsedCallLogs.filter(c => targetShop !== 'estate' ? targetShopList.includes(c.shop) : true);
    }, [parsedCallLogs, targetShop, targetShopList]);

    /**
     * ⚠️⚠️ v2.2.177: 店舗スタッフ表示は ⚠️ **架電シートの店舗（call_sheet.shop）で絞らない**（指示書）。
     *   ⚠️ スタッフ名だけで、⚠️ **全ての架電記録**から数える（⚠️ 所属店舗以外の顧客への架電も入る）。
     *   ⚠️ 以前は targetCallLog（選んだ店舗の架電シートだけ）から取っていた。
     * ⚠️ インサイドセールス表示（renderInsideSalesList）は従来どおり targetCallLog を使う。
     */
    const allParsedActions = useMemo(() => {
        return parsedCallLogs.flatMap(log => log.parsedActions);
    }, [parsedCallLogs]);

    const safeFormate = (value: string): string => {
        return (value ?? '').replace(/[\s\u3000]+/g, '');
    };

    /**
     * v2.2.294 「インサイドセールス全体」の対応反響数に数える担当者（今年度・staff_list の shop がインサイドセールス）。
     * ⚠️ staffArray は今年度（thisYear）だけに絞ってある。
     */
    const insideSalesStaffNames = useMemo(
        () => staffArray.filter(s => s.shop === INSIDE_SALES_STAFF_SHOP).map(s => safeFormate(s.name)).filter(Boolean),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [staffArray]);

    /**
     * 店舗（など）で絞った顧客。インサイドセールス表示では、担当者が架電記録に名前を残した顧客だけ（＝対応反響数）。
     * ⚠️ v2.2.294 以前は「インサイドセールス全体」（担当を選んでいない）とき絞っておらず、対応反響数が総反響数と同じだった（指示書で修正）。
     *   ⚠️ 今は、担当を選べばその人、選ばなければ今年度のインサイドセールスの担当者のだれかが記録に名前を残した顧客。
     *   ⚠️ 名前の比べ方は担当を選んだときと同じ（空白を消して、記録の担当名に含まれるか）。
     */
    const filteredCustomer = useMemo(() => {
        let ids: Set<string> | null = null;

        if (targetShop === 'inside_sales') {
            const names = targetInsideSales ? [safeFormate(targetInsideSales)] : insideSalesStaffNames;
            ids = new Set(parsedCallLogs.filter(c =>
                c.parsedActions.some(action => names.some(name => safeFormate(action.staff).includes(name)))
            ).map(c => c.id));
        }

        return originalDatabase.filter(o => {
            const isShopMatch = targetShop !== 'estate' ? targetShopList.includes(o.shop) : true;
            const isStaffMatch = ids !== null ? ids.has(o.id) : true;
            return isShopMatch && isStaffMatch;
        });

    }, [originalDatabase, targetShop, targetShopList, targetInsideSales, parsedCallLogs, insideSalesStaffNames]);

    const isThisMonth = (month: string) => month === `${String(yearValue).padStart(2, '0')}/${String(monthValue).padStart(2, '0')}`;
    const formate = (value: number, month: string) => {
        const [yearStr, monthStr] = month.split('/');
        const days = new Date(Number(yearStr), Number(monthStr), 0).getDate();
        return isThisMonth(month) ? (value * days) / now.getDate() : value;
    };

    const renderInsideSalesList = () => {
        /** ⚠️ 表に出す月（v2.2.177 修正: 合計列もこの月だけで数える） */
        const insideMonths = displayMonths;
        // ⚠️ 先頭は合計行。sIndex === 0 を isTotalRow として扱うので、並び順を変えないこと。
        const displayShops: shopList[] = [
            { brand: '', shop: INSIDE_SALES_TOTAL_LABEL, section: INSIDE_SALES_SECTION, show_flag: 1 },
            ...shopArray.filter(isInsideSalesShop),
        ];
        const metrics = ['総反響数', '対応反響数', '対応中', 'アポ取得数', '対応反響数からの来場数', '総架電数', '資料郵送数', 'SMS送信数', 'メール送信数'];

        return (
            <div className="table-responsive shadow-sm rounded mb-3 border" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {/* ⚠️ v2.2.294 店舗ごとに余白の行で区切り、店舗名の左に色の帯を付ける（Company.tsx の付箋のような作り。CSL_STYLE） */}
                <Table hover className="mb-0 bg-white csl_table" style={{ minWidth: `${displayMonths.length * 110 + 220}px` }} bordered>
                    <thead className="bg-light text-muted" style={{ fontSize: '12px' }}>
                        <tr>
                            <th className="bg-light" style={{ position: 'sticky', top: 0, left: 0, width: '120px', minWidth: '120px', zIndex: 3 }}>店舗</th>
                            <th className="bg-light border-end" style={{ position: 'sticky', top: 0, left: '120px', width: '160px', minWidth: '160px', zIndex: 3 }}>種別</th>
                            <th className="bg-light text-center" style={{ position: 'sticky', top: 0, width: '80px', zIndex: 2 }}>合計</th>
                            {displayMonths.map((month, mIndex) => (
                                <th key={mIndex} className="bg-light text-center" style={{ position: 'sticky', top: 0, minWidth: '100px', zIndex: 2 }}>{month}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '12px' }} className="align-middle">
                        {displayShops.map((s, sIndex) => {
                            // 💡 1. この行が「合計行（インデックス0）」かどうかを判定
                            const isTotalRow = sIndex === 0;

                            // 💡 2. 対象の店舗 ＆ 担当者で CallLog を正確に絞り込む（Unicodeエスケープ対策済）
                            const customerFilter = targetCallLog.filter(c => {
                                const shopMatch = isTotalRow ? true : c.shop === s.shop;
                                const staffMatch = targetInsideSales
                                    ? c.parsedActions.some(action => safeFormate(action.staff).includes(safeFormate(targetInsideSales)))
                                    : true;
                                return shopMatch && staffMatch;
                            });

                            // 💡 3. 各ベース配列を「この行の店舗」にスコープを限定する
                            const registerFilter = originalDatabase.filter(o => isTotalRow ? targetShopList.includes(o.shop) : o.shop === s.shop);
                            // 全体を絞り込んだ filteredCustomer を、さらにこの行の店舗で絞り込む
                            const calledCustomer = filteredCustomer.filter(c => isTotalRow ? true : c.shop === s.shop);

                            // 💡 4. アクション（架電やSMS）も、この行の customerFilter から展開する
                            const base = customerFilter.flatMap(c => c.parsedActions).filter(a =>
                                targetInsideSales ? safeFormate(a.staff).includes(safeFormate(targetInsideSales)) : true
                            );

                            // ⚠️ v2.2.186: SMS送信も総架電数に入れる（CALL_COUNT_ACTIONS）
                            const callFilter = base.filter(p => isCallCountAction(p.action));
                            const postFilter = base.filter(p => p.action === '資料郵送');
                            const mailFilter = base.filter(p => p.action === 'メール送信');
                            const smsFilter = base.filter(p => p.action === 'SMS送信');

                            const continueFilter = customerFilter.filter(c => c.status === '継続');
                            const appointFilter = customerFilter.filter(c => c.status === '来場アポ');
                            const interviewFilter = customerFilter.filter(c => c.status === '来場済み');

                            return <React.Fragment key={s.shop}>
                                {/* ⚠️ v2.2.294 店舗の前の余白（⚠️ data-gap の行は数字を持たない） */}
                                {sIndex > 0 && <tr data-gap="" className="csl_gap"><td colSpan={displayMonths.length + 3}></td></tr>}
                                {metrics.map((metric, index) => {
                                const isImportant = index === 3 || index === 4;
                                return (
                                    <tr key={`${sIndex}-${index}`} className={`${index === 0 ? 'csl_first' : ''} ${isTotalRow ? 'csl_total_row' : ''}`}>
                                        {index === 0 && (
                                            <td rowSpan={9} className={`align-middle fw-bold csl_shop ${isTotalRow ? 'csl_total' : `csl_col${(sIndex - 1) % SHOP_COLORS.length}`}`}
                                                style={{ position: 'sticky', left: 0, width: '120px', minWidth: '120px', zIndex: 1 }}>
                                                {s.shop}
                                            </td>
                                        )}
                                        <td className={`border-end bg-white ${index === 4 ? 'text-primary' : index === 3 ? 'text-danger' : 'text-secondary'}`} style={{ position: 'sticky', left: '120px', zIndex: 1 }}>
                                            {isImportant ? <Badge bg={index === 3 ? 'danger' : 'primary'} className="me-1">{metric}</Badge> : metric}
                                        </td>

                                        {['total', ...displayMonths].map((month, mIndex) => {
                                            /*
                                              ⚠️ v2.2.177 修正: 合計列は ⚠️ **表に出ている月（displayMonths）の分だけ**。
                                                ⚠️ 以前は全期間（mIndex === 0 なら true）で、⚠️ 月の列を足しても合計と合わなかった。
                                                ⚠️ 月の列と同じ判定（includes）を表示中の月で回すので、⚠️ 月の列の合計と必ず一致する。
                                            */
                                            const monthMatch = (dateStr: string) => mIndex === 0
                                                ? insideMonths.some(m => dateFormate(dateStr).includes(m))
                                                : dateFormate(dateStr).includes(month);

                                            let value: string | number = 0;
                                            if (index === 0) value = registerFilter.filter(r => monthMatch(r.register)).length;
                                            else if (index === 1) value = calledCustomer.filter(c => monthMatch(c.register)).length;
                                            else if (index === 2) {
                                                value = continueFilter.filter(c => {
                                                    const newest = c.parsedActions.length > 0 ? c.parsedActions[c.parsedActions.length - 1] : null;
                                                    return newest ? monthMatch(newest.day) : false;
                                                }).length;
                                            }
                                            else if (index === 3) {
                                                const appts = appointFilter.filter(c => monthMatch(c.reserved_status)).length;
                                                const ints = interviewFilter.filter(c => monthMatch(c.reserved_status)).length;
                                                const baseCount = calledCustomer.filter(c => monthMatch(c.register)).length;
                                                const rate = baseCount > 0 ? Math.ceil((appts + ints) / baseCount * 1000) / 10 : 0;
                                                value = `${appts + ints} (${rate}%)`;
                                            }
                                            else if (index === 4) value = interviewFilter.filter(c => monthMatch(c.reserved_status)).length;
                                            else if (index === 5) value = callFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 6) value = postFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 7) value = smsFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 8) value = mailFilter.filter(c => monthMatch(c.day)).length;

                                            return (
                                                <td key={mIndex} className={`text-end ${mIndex === 0 ? 'fw-bold bg-light' : ''} ${index === 4 ? 'text-primary fw-bold' : index === 3 ? 'text-danger fw-bold' : ''}`}>
                                                    {value}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                                })}
                            </React.Fragment>;
                        })}
                    </tbody>
                </Table>
            </div>
        );
    };

    const renderShopStaffList = () => {
        /** ⚠️ 表に出す月（v2.2.177 修正: 合計列もこの月だけで数える） */
        const staffMonths = displayMonths;
        console.log(changedStaff)
        const staffListToRender = [{ name: '合計', shop: '', pg_id: '', category: 0, estate: 1 } as unknown as staffList, ...changedStaff];
        const targetCategories = targetShop === 'estate' ? ['土地新着ネット反響数', '総架電数', '通電数', 'アポ取得数', '架電からの来場数'] : ['総架電数', '通電数', 'アポ取得数', '架電からの来場数'];

        return (
            <div className="table-responsive shadow-sm rounded mb-3 border" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <Table hover className="mb-0 bg-white" style={{ minWidth: `${displayMonths.length * 100 + 470}px` }} bordered>
                    <thead className="bg-light text-muted" style={{ fontSize: '12px' }}>
                        <tr>
                            <th className="bg-light" style={{ position: 'sticky', top: 0, left: 0, width: '150px', minWidth: '150px', zIndex: 3 }}>担当</th>
                            <th className="bg-light border-end" style={{ position: 'sticky', top: 0, left: '150px', width: '240px', minWidth: '240px', zIndex: 3 }}>種別</th>
                            <th className="bg-light text-center" style={{ position: 'sticky', top: 0, width: '80px', zIndex: 2 }}>合計</th>
                            {displayMonths.map((month, idx) => (
                                <th key={idx} className="bg-light text-center" style={{ position: 'sticky', top: 0, minWidth: '100px', zIndex: 2 }}>{month}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '12px' }} className="align-middle">
                        {staffListToRender.map((staff, sIndex) => {
                            const fStaffName = filteredStaffName(staff.name);
                            const validStaffNames = targetShop === 'estate' ? staffArray.filter(s => s.estate === 1).map(s => filteredStaffName(s.name)) : staffArray.filter(s => targetShop ? s.shop === targetShop : true).map(s => filteredStaffName(s.name));

                            /*
                              ⚠️ v2.2.177: 架電シートは ⚠️ **店舗で絞らない**（parsedCallLogs = 全件）。
                                ⚠️ そのスタッフが担当（c.staff）か、架電記録に名前がある顧客。
                                ⚠️ 土地新着ネット（estate）は以前から店舗で絞っていないので結果は同じ。
                            */
                            const staffLogs = parsedCallLogs.filter(c => {
                                if (sIndex > 0) {
                                    return filteredStaffName(c.staff) === fStaffName || c.parsedActions.some(l => filteredStaffName(l.staff) === fStaffName);
                                }
                                return validStaffNames.includes(filteredStaffName(c.staff)) || c.parsedActions.some(l => validStaffNames.includes(filteredStaffName(l.staff)));
                            });

                            /*
                              ⚠️ v2.2.177: アポ取得数・架電からの来場数も ⚠️ **店舗で絞らない**（2026-10-08 合意）。
                                ⚠️ 架電数だけ全店舗にすると「架電 → アポ → 来場」の比率が合わなくなるため。
                                ⚠️ 以前は filteredCustomer（選んだ店舗の顧客）で引いていた → ⚠️ originalDatabase（この事業の全顧客）。
                            */
                            const appointLogIds = new Set(staffLogs.filter(c => c.status === '来場アポ').map(c => c.id));
                            const appointCustomerRegs = originalDatabase.filter(o => appointLogIds.has(o.id)).map(o => o.register);

                            const interviewLogIds = new Set(staffLogs.filter(c => c.status === '来場済み').map(c => c.id));
                            const interviewCustomerRegs = originalDatabase.filter(o => interviewLogIds.has(o.id)).map(o => o.register);

                            const estateResponses = filteredCustomer.filter(o => o.medium === '土地新着ネット' && (sIndex === 0 || o.staff === staff.name));

                            return targetCategories.map((category, cIndex) => {
                                const isEstate = targetShop === 'estate';
                                const subText = isEstate && sIndex > 0 ? (category === '総架電数' ? ' (目標100件)' : category === '通電数' ? ' (目標15件)' : category === 'アポ取得数' ? ' (目標2件)' : '') : '';

                                return (
                                    <tr key={`${sIndex}-${cIndex}`}>
                                        {cIndex === 0 && (
                                            <td rowSpan={targetCategories.length} className="align-middle fw-bold bg-white" style={{ position: 'sticky', left: 0, width: '150px', minWidth: '150px', zIndex: 1 }}>
                                                {sIndex === 0 ? `${targetShop.replace('estate', '土地新着ネット')}合計` : staff.name}
                                            </td>
                                        )}
                                        <td className="border-end bg-white text-secondary" style={{ position: 'sticky', left: '150px', width: '240px', minWidth: '240px', zIndex: 1 }}>
                                            {category} <span className="text-muted" style={{ fontSize: '10px' }}>{subText}</span>
                                        </td>
                                        {(() => {
                                            const preFilteredActions = (category === '総架電数' || category === '通電数')
                                                // ⚠️ v2.2.177: 全架電記録から（⚠️ 店舗で絞らない。スタッフ名だけ）
                                                ? allParsedActions.filter(log => {
                                                    const staffName = filteredStaffName(log.staff);
                                                    const isTargetStaff = sIndex > 0 ? staffName === fStaffName : validStaffNames.includes(staffName);

                                                    if (!isTargetStaff) return false;

                                                    // ⚠️ v2.2.186: SMS送信も総架電数に入れる（CALL_COUNT_ACTIONS）
                                                    if (category === '総架電数') return isCallCountAction(log.action);
                                                    if (category === '通電数') return log.action === '通電';
                                                    return false;
                                                })
                                                : [];

                                            return ['total', ...displayMonths].map((month, mIndex) => {
                                                const targetMonthStr = mIndex > 0 ? dateFormate(month) : '';
                                                /*
                                                  ⚠️ v2.2.177 修正: 合計列は ⚠️ **表に出ている月（displayMonths）の分だけ**。
                                                    ⚠️ 以前は全期間で、⚠️ 月の列を足しても合計と合わなかった。
                                                    ⚠️ 月の列と同じ判定を表示中の月で回す（⚠️ 月の列の合計と必ず一致する）。
                                                */
                                                const matchMonth = (dateStr: string) => mIndex === 0
                                                    ? staffMonths.some(m => dateFormate(dateStr).includes(m))
                                                    : dateFormate(dateStr).includes(targetMonthStr);
                                                const matchRegMonth = (reg: string) => mIndex === 0
                                                    ? staffMonths.includes(dateFormate(reg.slice(0, 7)))
                                                    : dateFormate(reg.slice(0, 7)) === month;

                                                let value = 0;
                                                let textColorClass = '';

                                                if (category === '土地新着ネット反響数') {
                                                    value = estateResponses.filter(r => matchMonth(r.register)).length;
                                                } else if (category === '総架電数') {
                                                    // 事前フィルタ済みの配列から、月だけを判定するから爆速
                                                    value = preFilteredActions.filter(log => matchMonth(log.day)).length;
                                                    textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 100 ? 'text-danger' : 'text-success fw-bold') : '';
                                                } else if (category === '通電数') {
                                                    // 事前フィルタ済みの配列から、月だけを判定
                                                    value = preFilteredActions.filter(log => matchMonth(log.day)).length;
                                                    textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 15 ? 'text-danger' : 'text-success fw-bold') : '';
                                                } else if (category === 'アポ取得数') {
                                                    value = appointCustomerRegs.filter(matchRegMonth).length;
                                                    textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 2 ? 'text-danger' : 'text-success fw-bold') : '';
                                                } else if (category === '架電からの来場数') {
                                                    value = interviewCustomerRegs.filter(matchRegMonth).length;
                                                }

                                                return (
                                                    <td key={mIndex} className={`text-end ${mIndex === 0 ? 'bg-light fw-bold' : ''} ${textColorClass}`}>
                                                        {value}
                                                    </td>
                                                );
                                            });
                                        })()}
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </Table>
            </div>
        );
    };

    /**
     * v2.2.294 期間（開始月・終了月）。⚠️ 選択肢は新しい順（descending）。⚠️ 最長12か月（超えるともう片方を寄せる）。
     * ⚠️ 選んだ月の分だけを読み直す（② に届かないときは、読み込み済みの全件を絞り直す）。
     */
    const periodSelect = (
        <div className="csl_period mb-3 px-1">
            <div>
                <Form.Label className="text-muted small fw-bold mb-1">開始月</Form.Label>
                <Form.Select aria-label="開始月" value={periodFrom} onChange={(e) => changeFrom(e.target.value)}
                    style={{ fontSize: '13px', width: '130px' }} className="shadow-sm border-0">
                    {descending(monthArray).map(m => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
            </div>
            <div className="pb-2 text-muted">〜</div>
            <div>
                <Form.Label className="text-muted small fw-bold mb-1">終了月</Form.Label>
                <Form.Select aria-label="終了月" value={periodTo} onChange={(e) => changeTo(e.target.value)}
                    style={{ fontSize: '13px', width: '130px' }} className="shadow-sm border-0">
                    {descending(monthArray).map(m => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
            </div>
            <div className="pb-2 text-muted" style={{ fontSize: '11px' }}>{displayMonths.length}か月（最長{MAX_MONTHS}か月）</div>
        </div>
    );

    const selectCategory = (
        <div className="d-flex justify-content-start align-items-center mb-4 px-1">
            <div className="w-25 min-w-200 me-3">
                <Form.Label className="text-muted small fw-bold mb-1">表示カテゴリを選択</Form.Label>
                <Form.Select
                    value={targetShop}
                    onChange={(e) => {
                        // ⚠️ v2.2.177: 集計し直しになるので先に読み込み中を出す
                        startRendering();
                        setTargetShop(e.target.value);
                        setInsideSalesCategory(e.target.value === 'inside_sales' ? 'inside_sales' : 'shopStaff');
                    }}
                    style={{ fontSize: '13px' }}
                    className="shadow-sm border-0"
                >
                    {categoryValue === 'order' && <>
                        <option value="inside_sales">インサイドセールス</option>
                        <option value="estate">土地新着ネット</option>
                    </>}
                    {shopArray
                        .filter(s => !s.shop.includes('全店舗') && !s.shop.includes('未設定'))
                        .map((item, index) => (
                            <option key={index} value={item.shop}>{item.shop}</option>
                        ))}
                </Form.Select>
            </div>
            {targetShop === 'inside_sales' && <div className="w-25 min-w-200">
                <Form.Label className="text-muted small fw-bold mb-1">担当を選択</Form.Label>
                <Form.Select
                    value={targetInsideSales}
                    onChange={(e) => {
                        // ⚠️ v2.2.177: 集計し直しになるので先に読み込み中を出す
                        startRendering();
                        setTargetInsideSales(e.target.value)
                    }}
                    style={{ fontSize: '13px' }}
                    className="shadow-sm border-0"
                >
                    <option value="">インサイドセールス全体</option>
                    {insideSaleStaffs.map(item =>
                        <option key={item.name} value={item.name}>{item.name}</option>
                    )}
                </Form.Select>
            </div>}
        </div>
    )

    /**
     * 統計の表、または読み込み中の表示（v2.2.177）。
     * ⚠️ 取得中・集計前は表を描かない（⚠️ 描くと集計で画面が固まり、スピナーも出ない）。
     */
    const statsOrLoading = (loading || rendering)
        ? (
            <div className="d-flex flex-column align-items-center justify-content-center bg-white rounded border shadow-sm mb-3"
                style={{ minHeight: '240px', gap: '10px' }} role="status" aria-live="polite">
                <Spinner animation="border" variant="primary" />
                <div className="text-muted" style={{ fontSize: '13px' }}>
                    {loading ? '架電状況を読み込んでいます…' : '集計しています…'}
                </div>
            </div>
        )
        : (insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList());

    return (
        <><style>{CSL_STYLE}</style>{source ?
            <>
                {periodSelect}
                { selectCategory}
                {statsOrLoading}
            </>
            :
            <Modal show={callStatusShow} onHide={() => setCallStatusShow(false)} size="xl" dialogClassName="modal-90w">
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="fs-5 fw-bold text-secondary">
                        <i className="bi bi-telephone-fill me-2"></i>架電状況詳細
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-light pt-4">
                    {periodSelect}
                    {categoryValue !== 'used' && selectCategory}
                    {statsOrLoading}
                </Modal.Body>
            </Modal>}
        </>
    );
};

export default CallStatusList;