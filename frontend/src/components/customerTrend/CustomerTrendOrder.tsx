import React, { useEffect, useState, useContext, useMemo } from "react";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import Table from "react-bootstrap/Table";
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { isLastYear } from '../../utils/isLastYear';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { get11MonthsAgoString } from "../../utils/get11MonthsAgoString";
import apiClient from "../../utils/apiClient";
import { chartColors } from "./utils";
import CustomerListModal from "../CustomerListModal";
import InformationEdit from "../information/InformationEdit";

/**
 * 店舗。
 * ⚠️ `multi` / `parent_shop` は shop_list 由来で、「併売店をまとめる」にだけ使う。
 */
type Shop = { brand: string; shop: string; section: string; area: string; multi?: number; parent_shop?: string | null; }
type MediumType = { medium: string, category: string, sort_key: number, response_medium: number };
/**
 * 顧客。
 * ⚠️ `customer` / `staff` / `rank` は**以前から API が返していた**が、
 *   この型に書かれていなかったため使えなかった。顧客一覧モーダルで使う。
 */
type CustomerList = { id: string, customer: string, staff: string, rank: string, shop: string, status: string, medium: string, interview: string, register: string, contract: string, hp_campaign: string, section: string, appointment: string, screening: string };
type GraphData = { month: string, [key: string]: number | string };
type CheckItem = {
    name: string;
    show: boolean;
};
type CheckedState = {
    [key: string]: CheckItem;
};
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };

const CustomerTrendOrder: React.FC = () => {
    // ⚠️ token / authority は顧客詳細（InformationEdit）に渡すために取る
    const { category, token, authority } = useContext(AuthContext);
    const [originalUserData, setOriginalUserData] = useState<CustomerList[]>([]);
    const [mediumList, setMediumList] = useState<MediumType[]>([]);
    const [graphCategory, setGraphCategory] = useState('register');
    const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
    const [startMonth, setStartMonth] = useState(startMonthValue);
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const now = new Date();
    const year = now.getFullYear();
    const [checked, setChecked] = useState<CheckedState>({
        graph: { name: 'グラフ', show: false },
        register: { name: '総反響数', show: true },
        interview: { name: '実来場数', show: true },
        appointment: { name: '次アポ数', show: true },
        contract: { name: '契約数', show: true },
        budget: { name: '広告費', show: false },
        comparison: { name: '昨年実績', show: false }
    });
    const thisYear = now.getMonth() <= 4 ? year : year + 1;
    const [budgetList, setBudget] = useState<Budget[]>([]);
    const [portalChecked, setPortalChecked] = useState(false);

    /**
     * 併売店をまとめるか。
     * ⚠️ 親店舗（shop_list.parent_shop）は**利用者が手作業で設定する**。
     *   1件も設定されていなければ、ONにしても表示・集計は一切変わらない。
     */
    const [showMulti, setShowMulti] = useState<boolean>(false);

    /** 顧客一覧モーダル。label は「実来場者」などの見出し */
    const [listShow, setListShow] = useState<{ show: boolean, label: string, list: CustomerList[] }>({
        show: false, label: '', list: []
    });
    /** 顧客詳細モーダルを開く顧客ID。'' なら閉じている */
    const [editId, setEditId] = useState('');


    const formate = (medium: string) => {
        return medium === '公式LINE' ? 'ALLGRIT' : medium;
    };

    const dateFormate = (date: string) => {
        return date ? date.replace(/-/g, '/') : '';
    };

    /**
     * 数字のセルの見た目。
     * ⚠️ 0件のときは下線もカーソルも出さない。押しても何も起きないため、
     *   押せるように見せると「壊れている」と受け取られる。
     */
    const clickable = (value: number) => {
        return value ? {
            fontWeight: '700', textDecoration: 'underline', cursor: 'pointer', letterSpacing: '1px'
        } : { fontWeight: '700' };
    };

    /** 顧客一覧モーダルを開く。⚠️ 0件のときは開かない */
    const handleShow = (list: CustomerList[], labelValue: string) => {
        if (list.length === 0) return;
        setListShow({ show: true, label: labelValue, list });
    };

    /**
     * 顧客詳細を閉じたあとの再取得。
     * ⚠️ 詳細で日付を直すと歩留まりが変わるため、閉じたら読み直す。
     */
    const closeInformationEdit = () => {
        setEditId('');
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'customerTrend', category });
                setOriginalUserData(response.data.customer);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        fetchData();
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // ⚠️⚠️ 2026-09-11 まで axios で**本番URLを直書き**していた。
                //   ローカル開発からでも本番DBを読んでいた。apiClient を通すこと。
                const response = await apiClient.post("", { request: 'customerTrend', category });
                setOriginalUserData(response.data.customer);
                const filteredMedium = response.data.medium.filter(item => item.list_medium === 1);
                setMediumList(filteredMedium);
                setOriginalShopArray(response.data.shop);
                setBudget(response.data.budget);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        setOriginalMonthArray(getYearMonthArray(2025, 1));
        fetchData();
    }, []);

    /**
     * ⚠️⚠️ **ここから下の派生値は useState + useEffect をやめて useMemo にした（2026-09-11）。**
     *
     *   以前は1つの useEffect の中で monthArray / sectionArray / userData /
     *   graphData を**まとめて setState** しており、依存配列から
     *   `mediumList` と `mediumArray` が**抜けていた**。
     *
     *   ⚠️ そのため「ポータル反響のみ表示」を切り替えたとき、
     *     graphData が**1テンポ古い mediumArray** で作られていた
     *     （portalChecked → mediumArray → graphData の順に更新されるのに、
     *      graphData は portalChecked にしか反応していなかった）。
     *
     *   ⚠️ さらに setState が4回走るため再描画が重なり、表示がもたついていた。
     *
     * ⚠️ **この変更で表示が変わる場面がある。** 上記のズレが直る方向だが、
     *   「前は違う数字だった」と見える可能性がある。
     */

    /** 販促媒体名の一覧。⚠️ ポータルのみ表示のときは category = 'ポータル' に絞る */
    const mediumArray = useMemo(() =>
        mediumList.filter(m => portalChecked ? m.category === 'ポータル' : true).map(f => f.medium),
        [mediumList, portalChecked]);

    /** 表示対象の年月。開始月・終了月で切り出す */
    const monthArray = useMemo(() => {
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length;
        return originalMonthArray.slice(startIndex, endIndex);
    }, [originalMonthArray, startMonth, endMonth]);

    /** 課の一覧。⚠️ 「第2営業課」のような数字で並べる */
    const sectionArray = useMemo(() => {
        const unique = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
        return unique.sort((a, b) => {
            const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
            const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
            return numA - numB;
        });
    }, [originalShopArray]);

    /**
     * 親店舗名 → まとめ先に吸収する子店舗名の一覧。
     *
     * ⚠️⚠️ **親が注文事業の店舗一覧に居ない場合は対象外にする。**
     *   `shop_list` は事業をまたいで1つのテーブルなので、`parent_shop` に
     *   他事業の店舗名が入り得る。そのまま子を隠すと、**どの行にも合算されず
     *   数字が消える**（合計だけ合わなくなり、気づきにくい）。
     */
    const multiChildren = useMemo(() => {
        const shopNames = new Set(originalShopArray.map(s => s.shop));
        const map = new Map<string, string[]>();
        originalShopArray.forEach(s => {
            const parent = s.parent_shop;
            if (s.multi !== 1 || !parent || !shopNames.has(parent) || parent === s.shop) return;
            const children = map.get(parent) ?? [];
            children.push(s.shop);
            map.set(parent, children);
        });
        return map;
    }, [originalShopArray]);

    /** まとめON時に選択肢から消える側（子店舗）の集合 */
    const mergedChildShops = useMemo(() => {
        const set = new Set<string>();
        multiChildren.forEach(children => children.forEach(child => set.add(child)));
        return set;
    }, [multiChildren]);

    /**
     * その店舗が集計対象とする店舗名の一覧。
     * まとめOFF、または子を持たない店舗では `[shopName]` のままなので、
     * 呼び出し側の既存ロジックは変わらない。
     */
    const shopNamesOf = (shopName: string): string[] =>
        showMulti ? [shopName, ...(multiChildren.get(shopName) ?? [])] : [shopName];

    /** その店舗を選択肢として表示してよいか */
    const isVisibleShop = (shopName: string): boolean => !(showMulti && mergedChildShops.has(shopName));

    /**
     * 絞り込み後の顧客。
     * ⚠️ 表の行は「販促媒体」なので、店舗の絞り込みはここで一度だけ効く。
     *   ⚠️ まとめONで親店舗を選んだときは、子店舗の顧客も含める。
     */
    const userData = useMemo(() => {
        const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);
        const targetShops = targetShop ? shopNamesOf(targetShop) : [];
        return originalUserData.filter(o =>
            (targetSection ? sectionShops.includes(o.shop) : true) &&
            (targetShop ? targetShops.includes(o.shop) : true) &&
            (targetBrand ? o.shop.slice(0, 2) === targetBrand : true) &&
            (portalChecked ? !o.hp_campaign : true)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [originalUserData, originalShopArray, targetSection, targetShop, targetBrand, portalChecked, showMulti, multiChildren]);

    const getValue = (base: CustomerList[], monthIndex: number, month: string, target: string, period: string[] = monthArray) => {
        if (target === 'appointment') {
            return base.filter(b => {
                if (b.interview) {
                    return monthIndex >= 1 ? dateFormate(b.interview).includes(month) && (b.appointment || b.screening || b.contract)
                        : period.includes(dateFormate(b.interview).slice(0, 7)) && (b.appointment || b.screening || b.contract);
                }
                return (monthIndex >= 1 ? (dateFormate(b.appointment).includes(month) || dateFormate(b.screening).includes(month) || dateFormate(b.contract).includes(month))
                    : (period.includes(dateFormate(b.appointment).slice(0, 7)) || period.includes(dateFormate(b.screening).slice(0, 7)) || period.includes(dateFormate(b.contract).slice(0, 7))))
            })
        }
        if (target === 'interview') {
            if (monthIndex >= 1) {
                const interviewBase = base.filter(b =>
                    dateFormate(b.interview).includes(month)
                );
                const appointmentBase = base.filter(b =>
                    !b.interview &&
                    (
                        dateFormate(b.appointment).includes(month) ||
                        dateFormate(b.screening).includes(month) ||
                        dateFormate(b.contract).includes(month)
                    )
                );
                return [...interviewBase, ...appointmentBase];
            } else {
                const interviewBase = base.filter(b =>
                    period.includes(dateFormate(b.interview).slice(0, 7))
                );
                const appointmentBase = base.filter(b =>
                    !b.interview &&
                    (
                        period.includes(dateFormate(b.appointment).slice(0, 7)) ||
                        period.includes(dateFormate(b.screening).slice(0, 7)) ||
                        period.includes(dateFormate(b.contract).slice(0, 7))
                    )
                );
                return [...interviewBase, ...appointmentBase];
            }
        }

        if (target === 'contract') {
            return base.filter(b => (monthIndex >= 1 ? dateFormate(b.contract).includes(month) && (b.status === '契約済み' || b.status === '解約') : period.includes(dateFormate(b.contract).slice(0, 7)) && (b.status === '契約済み' || b.status === '解約')))
        }
        return base.filter(b => (monthIndex >= 1 ? dateFormate(b[target]).includes(month) : period.includes(dateFormate(b[target]).slice(0, 7))))
    };

    /**
     * 積み上げ棒グラフのデータ。⚠️ グラフ非表示のときは作らない（重いため）
     *
     * ⚠️⚠️ **`getValue` の定義より後に置くこと。**
     *   useMemo のコールバックは**レンダー中に即実行される**ため、
     *   `const getValue = ...` より前に書くと初回レンダーで
     *   「Cannot access 'getValue' before initialization」になる。
     *   （以前このファイルでは getValue が下にあり、useEffect だったので
     *     問題が出ていなかった。useMemo 化で条件が変わった）
     */
    const graphData = useMemo<GraphData[]>(() => {
        if (!checked.graph.show) return [];
        return monthArray.map(monthValue => ({
            month: monthValue,
            ...Object.fromEntries(
                mediumArray.map(mediumValue => [mediumValue,
                    getValue(userData, monthArray.indexOf(monthValue) + 1, monthValue, graphCategory)
                        .filter(item => formate(item.medium) === formate(mediumValue)).length
                ])
            )
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userData, monthArray, mediumArray, graphCategory, checked.graph.show]);

    const CustomLegend = ({ payload }: { payload?: any[] }) => {
        if (!payload) return null;
        return (
            <div style={{ fontSize: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center" }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                backgroundColor: entry.color,
                                marginRight: 6,
                                borderRadius: 2
                            }}
                        />
                        <span>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;

        return (
            <div
                style={{
                    background: "white",
                    border: "1px solid #ccc",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",        // ← フォントサイズ変更
                    lineHeight: "1.4",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                }}
            >
                <div style={{ marginBottom: 4, fontWeight: "bold" }}>{label}</div>

                {payload.map((entry: any, index: number) => (
                    <div key={index} style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </div>
                ))}
            </div>
        );
    };

    const checkedChange = (e) => {
        const { name } = e.target;

        setChecked(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                show: !prev[name].show
            }
        }));
    };

    return (
        <>
            <div className='content bg-white p-2'>
                <div className="d-flex flex-wrap mb-1 search_condition">
                    <div className="m-1">
                        <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                            <option value="" selected>開始月</option>
                            {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <span className='d-flex align-items-center mx-1'>～</span>
                    <div className="m-1">
                        <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                            <option value="" selected>終了月</option>
                            {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(e) => {
                            setTargetShop('');
                            setTargetBrand('');
                            setTargetSection(e.target.value);
                        }}><option value="">課を選択</option>
                            {sectionArray.map((item, index) =>
                                <option value={item} selected={item === targetSection} key={index}>{item}</option>
                            )}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(e) => {
                            setTargetShop('');
                            setTargetSection('');
                            setTargetBrand(e.target.value);
                        }}>
                            <option value="">ブランドを選択</option>
                            <option value="KH" selected={targetBrand.slice(0, 2) === 'KH'}>国分ハウジング</option>
                            <option value="DJ" selected={targetBrand.slice(0, 2) === 'DJ'}>デイジャストハウス</option>
                            <option value="なご" selected={targetBrand.slice(0, 2) === 'なご'}>なごみ工務店</option>
                            <option value="2L" selected={targetBrand.slice(0, 2) === '2L'}>ニーエルホーム</option>
                            <option value="PG" selected={targetBrand.slice(0, 2) === 'PG'}>PGハウス</option>
                            <option value="JH" selected={targetBrand.slice(0, 2) === 'JH'}>ジャスフィーホーム</option>
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(e) => {
                            setTargetBrand('');
                            setTargetSection('');
                            setTargetShop(e.target.value);
                        }}>
                            <option value="">店舗を選択</option>
                            {originalShopArray.filter(shop => !shop.shop?.includes('店舗未設定') && isVisibleShop(shop.shop)).map(shop =>
                                <option value={shop.shop} selected={shop.shop === targetShop}>{shop.shop}</option>
                            )}
                        </select>
                    </div>
                </div>
                <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                <div className="d-flex flex-wrap mb-1 search_condition">
                    {Object.entries(checked).map(([key, value], index) => {
                        if ((value.name === '広告費' || value.name === '昨年実績') && targetShop) return;
                        return <div className="m-1" key={index}>
                            <label className="target checkbox d-flex align-items-center">
                                <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
                            </label>
                        </div>
                    })}
                    <div className="m-1">
                        <label className="target checkbox d-flex align-items-center">
                            <input type="checkbox" checked={portalChecked} className='me-1' onChange={() =>
                                setPortalChecked(!portalChecked)
                            } />ポータル反響のみ表示
                        </label>
                    </div>
                    <div className="m-1">
                        <label className="target checkbox d-flex align-items-center">
                            {/* ⚠️ 表の行は販促媒体なので、効くのは店舗の選択肢と集計だけ。行数は変わらない */}
                            <input type="checkbox" checked={showMulti} className='me-1' onChange={() => {
                                // ⚠️ 子店舗を選んだままONにすると選択肢から消えて戻せなくなる。先に解除する
                                if (!showMulti && targetShop && mergedChildShops.has(targetShop)) setTargetShop('');
                                setShowMulti(!showMulti);
                            }} />併売店をまとめる
                        </label>
                    </div>
                </div>
                <div className="table-wrapper">
                    <div className="list_table">
                        <div className="mt-3">
                            {checked.graph.show && <><div className="d-flex justify-content-center">
                                <div className="btn bg-primary text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'register' ? 'scale(1.1)' : '', opacity: graphCategory === 'register' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('register')}>反響数推移</div>
                                <div className="btn bg-success text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'interview' ? 'scale(1.1)' : '', opacity: graphCategory === 'interview' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('interview')}>来場数推移</div>
                                <div className="btn bg-info text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'appointment' ? 'scale(1.1)' : '', opacity: graphCategory === 'appointment' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('appointment')}>次アポ数推移</div>
                                <div className="btn bg-danger text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contract' ? 'scale(1.1)' : '', opacity: graphCategory === 'contract' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('contract')}>契約数推移</div>
                            </div>
                                {graphData.length > 0 && <div className="my-5">
                                    <ResponsiveContainer width="100%" height={500}>
                                        <BarChart data={graphData}>
                                            <XAxis dataKey="month" fontSize={12} />
                                            <YAxis fontSize={12} />
                                            <Tooltip content={CustomTooltip} />
                                            <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                                            <Legend content={<CustomLegend />} />
                                            {mediumArray.map((medium, index) =>
                                                <Bar dataKey={medium} stackId="a" fill={chartColors[index]} />
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>}</>}
                        </div>
                        <div style={{ width: `${(monthArray.length + 1) * 190}px` }}>
                            <Table striped bordered>
                                <tbody style={{ fontSize: "12px" }}>
                                    <tr className="sticky-header">
                                        <td className="text-center sticky-column" style={{ width: '300px' }}>販促媒体名</td>
                                        {['全期間', ...monthArray].map((month, index) => (
                                            <td key={index} className="">
                                                {month}
                                            </td>
                                        ))}
                                    </tr>
                                    {['全販促媒体', 'ホームページ反響計', ...mediumArray, 'その他']
                                        .map((medium, mediumIndex) => {
                                            const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);

                                            const base = userData.filter(o => {
                                                if (mediumIndex === 0) return true;
                                                if (mediumIndex === 1) return o.hp_campaign;
                                                if (medium === 'その他') {
                                                    return (!o.medium || !mediumArray.some(m => formate(m) === formate(o.medium)));
                                                }
                                                return formate(o.medium) === formate(medium);
                                            });

                                            // ▼ 2. budgetList の絞り込み
                                            const baseBudget = budgetList.filter(b => {
                                                if (b.section !== 'order') return false;
                                                if (targetBrand && b.shop.slice(0, 2) !== targetBrand.slice(0, 2)) return false;
                                                if (targetSection && !sectionShops.includes(b.shop)) return false;
                                                if (targetShop && b.shop !== targetShop) return false;

                                                if (mediumIndex === 0) return true;
                                                if (mediumIndex === 1) return formate(b.medium) === formate('ホームページ反響計');
                                                if (medium === 'その他') {
                                                    // HP反響予算ではなく、かつ mediumArray の予算にもフォーマット一致で含まれないものを「その他」とする
                                                    return formate(b.medium) !== formate('ホームページ反響計')
                                                        && (!b.medium || !mediumArray.some(m => formate(m) === formate(b.medium)));
                                                }
                                                return formate(b.medium) === formate(medium);
                                            });
                                            const isBudget = checked.budget.show && mediumIndex !== 1;
                                            return (
                                                <>{(portalChecked ? mediumIndex !== 1 : true) && (<tr key={mediumIndex}>
                                                    <td className='align-middle sticky-column text-center'
                                                        rowSpan={isBudget ? 2 : 1}>
                                                        {medium}
                                                    </td>
                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
                                                        const total = getValue(base, monthIndex, month, 'register');
                                                        const interview = getValue(base, monthIndex, month, 'interview');
                                                        const contract = getValue(base, monthIndex, month, 'contract');
                                                        const appointment = getValue(base, monthIndex, month, 'appointment');
                                                        const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                        const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                        let lastYearValue;
                                                        if (monthIndex === 0 || isLastYear(month)) {
                                                            lastYearValue = {
                                                                total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                                                interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                                                appointment: getValue(base, monthIndex, lastYear, 'appointment', lastYearMonthArray).length,
                                                                contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray),
                                                            };
                                                        }
                                                        const isDisplayLastYear =
                                                            checked.comparison.show &&
                                                            (monthIndex === 0 || isLastYear(month));
                                                        return (
                                                            <td style={{ fontSize: '11px', letterSpacing: '.5px' }}>
                                                                <div className={checked.register.show ? "text-white p-2 rounded" : 'text-white rounded'} style={{ backgroundColor: '#6baed6' }}>
                                                                    {checked.register.show && <div>総反響:<span style={clickable(total.length)} onClick={() => handleShow(total, `${medium} ${month} 総反響`)}>{total.length.toLocaleString()}</span>
                                                                        {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.total.toLocaleString()}</span>}</div>}
                                                                    <div className={checked.interview.show ? "rounded p-2 my-2" : "my-2 rounded p-2"} style={{ backgroundColor: '#2171b5' }}>
                                                                        {checked.interview.show && <div>実来場:<span style={clickable(interview.length)} onClick={() => handleShow(interview, `${medium} ${month} 実来場`)}>{interview.length.toLocaleString()}</span>({isNaN(interview.length / total.length) ? 0 : Math.floor(interview.length / total.length * 100)}%)
                                                                            {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.interview.toLocaleString()}</span>}</div>}
                                                                        <div className={checked.appointment.show ? "rounded p-2 my-2" : "my-2 rounded"} style={{ backgroundColor: '#08519c' }}>
                                                                            {checked.appointment.show && <div>次アポ:<span style={clickable(appointment.length)} onClick={() => handleShow(appointment, `${medium} ${month} 次アポ`)}>{appointment.length.toLocaleString()}</span>({isNaN(appointment.length / interview.length) ? 0 : Math.floor(appointment.length / interview.length * 100)}%)
                                                                                {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.appointment.toLocaleString()}</span>}</div>}
                                                                        </div>
                                                                        <div className={checked.contract.show ? "rounded p-2 my-2" : "my-2 rounded"} style={{ backgroundColor: '#08306b' }}>
                                                                            {checked.contract.show && <div>契約:<span style={clickable(contract.length)} onClick={() => handleShow(contract, `${medium} ${month} 契約`)}>{contract.length.toLocaleString()}</span>({isNaN(contract.length / interview.length) ? 0 : Math.floor(contract.length / interview.length * 100)}%)
                                                                                {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.contract.length.toLocaleString()}</span>}</div>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>)}
                                                    {isBudget && <tr>
                                                        {['全期間', ...monthArray].map((month, monthIndex) => {
                                                            const filteredBudget = baseBudget.filter(b =>
                                                                monthIndex > 0 ? b.budget_period.includes(month) : monthArray.includes(b.budget_period.slice(0, 7)));
                                                            const formattedValue = filteredBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                            const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                            const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                            const isDisplayLastYear = (isLastYear(month) || monthIndex === 0) && checked.comparison.show;
                                                            const lastYearBudget = baseBudget.filter(b =>
                                                                b.section === 'order'
                                                                && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                                                            );
                                                            const formattedLastYearValue = lastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                            const total = getValue(base, monthIndex, month, 'register');
                                                            const interview = getValue(base, monthIndex, month, 'interview');
                                                            const contract = getValue(base, monthIndex, month, 'contract');
                                                            let lastYearValue = {
                                                                total: 0,
                                                                interview: 0,
                                                                contract: 0,
                                                            };

                                                            if (monthIndex === 0 || isLastYear(month)) {
                                                                lastYearValue = {
                                                                    total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                                                    interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                                                    contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                                                                };
                                                            }

                                                            return <td key={monthIndex} style={{ fontSize: '11px' }}>
                                                                {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                                                    .map((item, index) => {
                                                                        const deno = index === 1 ? total.length : index === 2 ? interview.length : index === 3 ? contract.length : 1;
                                                                        const prevDeno = index === 1 ? lastYearValue.total : index === 2 ? lastYearValue.interview : index === 3 ? lastYearValue.contract : 1;
                                                                        return <div className="text-white rounded pe-2 py-1 mb-1" style={{ backgroundColor: item.color, textAlign: 'right' }} key={index}>{item.label}:￥{Math.ceil(formattedValue / deno || 1).toLocaleString()}
                                                                            {isDisplayLastYear && <span className='bg-white text-danger rounded px-1 ms-1 fw-bold'>￥{Math.ceil(formattedLastYearValue / prevDeno || 1).toLocaleString()}</span>}</div>
                                                                    })}
                                                            </td>
                                                        })}
                                                    </tr>}
                                                </>
                                            );
                                        })}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
            <CustomerListModal
                show={listShow.show}
                label={listShow.label}
                list={listShow.list}
                onHide={() => setListShow({ show: false, label: '', list: [] })}
                onSelectCustomer={setEditId}
            />
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    );
};

export default CustomerTrendOrder;

