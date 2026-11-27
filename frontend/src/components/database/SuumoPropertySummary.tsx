import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import apiClient from '../../utils/apiClient';

/**
 * SUUMO掲載順位（/suumoRanking）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ v2.2.305 全画面のモーダルをやめてページにした（指示）。⚠️ 左のメニュー（Menu.tsx）には出さない。
 *   開くのは物件DB（DatabaseProperty.tsx）の「SUUMO掲載順位」ボタン（建売＝category が spec のときだけ）から。
 * ⚠️ 読み込みは ② の property_suumo_latest（GET）。選んだ取得日（初めは最新の日）と県（初めは鹿児島県）の行だけを読む。
 *   取得日か県を変えるたびに読み直す。⚠️ 前回の順位に使う行（その日より前で最新の1行）も ② が付けて返す。
 *   ⚠️ 県の市町村は ② の SUUMO_AREA_MAPPING（features/propertyGet.ts）と同じ（片方だけ直さない）。
 * ⚠️ ② に届かないときは今までの property:suumo（POST・全期間・全県）を1回だけ読み、日付と県は画面で選ぶ。
 * ⚠️ 取得日・県は URL にも出す（?date=・?pref=。最新の日・鹿児島県なら出さない）。
 * ─────────────────────────────────────────────
 */

type SuumoProperty = {
    id: string;
    rank: string | number;
    area: string;
    company: string;
    name: string;
    price: string;
    plan: string;
    url: string;
    registered_at: string;
};

// 💡 都道府県と市町村のマッピングデータ（⚠️ ② の SUUMO_AREA_MAPPING と同じ）
const AREA_MAPPING: Record<string, string[]> = {
    '鹿児島県': ['鹿児島市', '鹿屋市', '薩摩川内市', '日置市', '霧島市', '姶良市'],
    '宮崎県': ['宮崎市', '都城市', '延岡市', '日向市', '西都市', '北諸県郡', '東諸県郡', '児湯郡'],
    '大分県': ['大分市', '別府市', '中津市', '由布市', '速水郡'],
    '熊本県': ['熊本市中央区', '熊本市東区', '熊本市西区', '熊本市南区', '熊本市北区', '八代市', '荒尾市', '玉名市', '菊池市', '宇土市', '宇城市', '合志市', '菊池郡', '上益城郡']
};
const DEFAULT_PREFECTURE = '鹿児島県';

const getPlanBadgeStyle = (plan: string) => {
    const baseStyle = { padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', display: 'inline-block', whiteSpace: 'nowrap' as const, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

    if (plan.includes('デコレーション')) return { ...baseStyle, backgroundColor: '#f3e8ff', color: '#6b46c1', border: '1px solid #d6bcfa' };
    if (plan.includes('プレミアム')) return { ...baseStyle, backgroundColor: '#feebc8', color: '#d69e2e', border: '1px solid #fbd38d' };
    if (plan.includes('コマ')) return { ...baseStyle, backgroundColor: '#eebefa', color: '#3182ce', border: '1px solid #bee3f8' };
    if (plan.includes('レポート')) return { ...baseStyle, backgroundColor: '#c6f6d5', color: '#38a169', border: '1px solid #9ae6b4' };

    return { ...baseStyle, backgroundColor: '#edf2f7', color: '#718096', border: '1px solid #e2e8f0' };
};

/** URL の取得日（?date=YYYY-MM-DD）。⚠️ 形が違えば ''（最新の日） */
const dateFromUrl = (): string => {
    const value = new URLSearchParams(window.location.search).get('date') ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
};
/** URL の県（?pref=）。⚠️ 選択肢に無ければ鹿児島県 */
const prefectureFromUrl = (): string => {
    const value = new URLSearchParams(window.location.search).get('pref') ?? '';
    return AREA_MAPPING[value] ? value : DEFAULT_PREFECTURE;
};

const SuumoPropertySummary = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [properties, setProperties] = useState<SuumoProperty[]>([]);

    const [selectedPrefecture, setSelectedPrefecture] = useState<string>(prefectureFromUrl);
    const [selectedCity, setSelectedCity] = useState<string>('');
    // 表示する取得日（YYYY-MM-DD）。⚠️ v2.2.301 URL の ?date= で開く。無ければデータ取得後に最新日で初期化される
    const [selectedDate, setSelectedDate] = useState<string>(dateFromUrl);

    const [serverMode, setServerMode] = useState(true);
    const [serverDates, setServerDates] = useState<string[] | null>(null);
    /** 読み終えた「取得日|県」（⚠️ ② の応答で日付を直したときに、同じものをもう一度読まないため）。予備で全部を読んだら 'full' */
    const loadedRef = useRef<string | null>(null);

    useEffect(() => {
        const key = `${selectedDate}|${selectedPrefecture}`;
        if (serverMode ? loadedRef.current === key && selectedDate !== '' : loadedRef.current === 'full') return;
        let cancelled = false;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                if (serverMode) {
                    try {
                        const response = await apiClient.get('', {
                            params: { request: 'property_suumo_latest', pref: selectedPrefecture, ...(selectedDate ? { date: selectedDate } : {}) },
                        });
                        const data = response?.data;
                        if (!Array.isArray(data?.suumo) || !Array.isArray(data?.dates)) throw new Error('invalid property_suumo_latest response');
                        if (cancelled) return;
                        loadedRef.current = `${String(data.date ?? '')}|${selectedPrefecture}`;
                        setServerDates(data.dates);
                        setProperties(data.suumo);
                        if (data.date && data.date !== selectedDate) setSelectedDate(data.date);
                        return;
                    } catch (error) {
                        if (cancelled) return;
                        console.error('property_suumo_latest に失敗しました。全期間の読み込みに切り替えます:', error);
                        setServerMode(false);
                        return;
                    }
                }
                const response = await apiClient.post('', { request: 'property', roll: 'suumo' });
                if (cancelled) return;
                if (response.data && response.data.suumo) {
                    loadedRef.current = 'full';
                    setServerDates(null);
                    setProperties(response.data.suumo);
                }
            } catch (error) {
                console.error("SUUMOデータの取得に失敗しました:", error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        // ⚠️ setTimeout(0) で1回にまとめる（StrictMode で effect が2回走ったときに2回読まない）
        const timer = window.setTimeout(() => { void fetchData(); }, 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [selectedDate, selectedPrefecture, serverMode]);

    useEffect(() => {
        setSelectedCity('');
    }, [selectedPrefecture]);

    const targetCities = useMemo(() => {
        return selectedCity ? [selectedCity] : (AREA_MAPPING[selectedPrefecture] || []);
    }, [selectedPrefecture, selectedCity]);

    /** 取得日の一覧（YYYY-MM-DD）。新しい順。⚠️ v2.2.301 ② で読んだときは ② が返す一覧（読んだ行は選んだ日と前回の分だけのため） */
    const availableDates = useMemo(() => {
        if (serverDates) return serverDates;
        const dates = properties
            .map(p => p.registered_at?.split(' ')[0])
            .filter((d): d is string => Boolean(d));
        return [...new Set(dates)].sort((a, b) => (a < b ? 1 : -1));
    }, [properties, serverDates]);

    // 初期値は最新の取得日。
    // ⚠️ 再取得で選択中の日付が消えることがあるため、その場合も最新へ戻す。
    //   存在しない日付を選んだままだと、表が空になって原因が分からなくなる。
    // ⚠️ v2.2.301 一覧がまだ無い（読み込み前）ときは触らない（URL の ?date= で開いたときに、読み込む前に消さないため）
    useEffect(() => {
        if (availableDates.length === 0) return;
        if (!availableDates.includes(selectedDate)) {
            setSelectedDate(availableDates[0]);
        }
    }, [availableDates, selectedDate]);

    // ⚠️ 選んだ取得日・県を URL（?date=・?pref=）にも出す（最新の日・鹿児島県なら出さない）。ほかのパラメータは残す
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        if (selectedDate === '' || selectedDate === availableDates[0]) next.delete('date');
        else next.set('date', selectedDate);
        if (selectedPrefecture === DEFAULT_PREFECTURE) next.delete('pref');
        else next.set('pref', selectedPrefecture);
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [selectedDate, selectedPrefecture, availableDates, searchParams, setSearchParams]);

    /**
     * 物件URLごとの順位の履歴。新しい順に並べる。
     *
     * ⚠️ 日付も一緒に持つこと。
     *   以前は順位だけを配列に入れ、「前回」を history[1]（全体で2番目に新しい行）
     *   としていた。取得日を選べるようにすると、過去の日付を選んだときに
     *   **未来の順位を「前回」として表示してしまう**。
     */
    const historyMap = useMemo(() => {
        const map: Record<string, { date: string; rank: number }[]> = {};

        [...properties]
            .sort((a, b) => (a.registered_at < b.registered_at ? 1 : -1))
            .forEach(p => {
                const date = p.registered_at?.split(' ')[0] ?? '';
                if (!map[p.url]) {
                    map[p.url] = [];
                }
                map[p.url].push({ date, rank: Number(p.rank) });
            });

        return map;
    }, [properties]);

    /** 選択中の取得日の物件 */
    const targetProperties = useMemo(() => {
        if (selectedDate === '') return [];
        return properties.filter(p => p.registered_at?.startsWith(selectedDate));
    }, [properties, selectedDate]);

    const { dataMap, maxRank, totalCount, cityCounts } = useMemo(() => {
        const map: Record<string, Record<number, SuumoProperty>> = {};
        const counts: Record<string, number> = {};
        let max = 0;
        let total = 0;

        targetProperties.forEach(p => {
            if (!targetCities.includes(p.area)) return;

            total++;
            counts[p.area] = (counts[p.area] || 0) + 1;

            const r = Number(p.rank);
            if (!map[p.area]) map[p.area] = {};
            map[p.area][r] = p;
            if (r > max) max = r;
        });

        return { dataMap: map, maxRank: max, totalCount: total, cityCounts: counts };
    }, [targetProperties, targetCities]);

    const rankArray = Array.from({ length: maxRank }, (_, i) => i + 1);

    return (
        <div className="content bg-light su_page">
            <style>{`
                .su_page { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; height: calc(100vh - var(--header-h, 0px)); box-sizing: border-box; }
                .su_bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; }
                .su_title { font-weight: 700; font-size: 15px; color: #374151; }
                .su_label { font-size: 12px; color: #6b7280; display: inline-flex; align-items: center; gap: 4px; }
                .su_back { font-size: 12px; font-weight: 700; color: #2563eb; background: none; border: 1px solid #bfdbfe; border-radius: 8px; padding: 4px 10px; cursor: pointer; }
                .su_back:hover { background: #eff6ff; }
                .su_scroll { flex: 1 1 auto; min-height: 0; overflow: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
                .suumo-table th, .suumo-table td {
                    padding: 4px 8px !important;
                    vertical-align: middle;
                    font-size: 11px;
                }
                .su_scroll::-webkit-scrollbar { height: 10px; width: 10px; }
                .su_scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
            `}</style>

            {/* ⚠️ ボタンは左に並べる（右上の Active users の表示と重なるため） */}
            <div className="su_bar">
                <button type="button" className="su_back" onClick={() => navigate('/property')}>
                    <i className="fa-solid fa-arrow-left me-1"></i>物件DBへ戻る
                </button>
                <span className="su_title">SUUMO掲載順位</span>
                <span className="su_label">
                    <i className="bi bi-clock-history"></i>取得日
                    <select
                        className="form-select form-select-sm shadow-sm fw-bold text-secondary"
                        style={{ width: '150px', cursor: 'pointer', fontSize: '12px' }}
                        aria-label="取得日"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        disabled={availableDates.length === 0}
                    >
                        {availableDates.length === 0 && <option value="">データなし</option>}
                        {availableDates.map((d, i) => (
                            <option key={d} value={d}>{d}{i === 0 ? '（最新）' : ''}</option>
                        ))}
                    </select>
                </span>
                <select
                    className="form-select form-select-sm shadow-sm border-secondary fw-bold text-secondary"
                    style={{ width: '140px', cursor: 'pointer', fontSize: '12px' }}
                    aria-label="都道府県"
                    value={selectedPrefecture}
                    onChange={(e) => setSelectedPrefecture(e.target.value)}
                >
                    {Object.keys(AREA_MAPPING).map(pref => (
                        <option key={pref} value={pref}>{pref}</option>
                    ))}
                </select>
                <select
                    className="form-select form-select-sm shadow-sm border-primary fw-bold text-primary"
                    style={{ width: '160px', cursor: 'pointer', fontSize: '12px' }}
                    aria-label="市町村"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                >
                    <option value="">全ての市町村</option>
                    {AREA_MAPPING[selectedPrefecture].map(city => (
                        <option key={city} value={city}>{city}</option>
                    ))}
                </select>
                <span className="su_label">
                    該当: <strong className="text-primary fs-6">{totalCount}</strong> 件
                </span>
            </div>

            {isLoading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                    <div className="spinner-border text-primary" role="status"></div>
                </div>
            ) : (
                <div className="su_scroll">
                    <Table bordered hover className="mb-0 text-center align-middle text-nowrap suumo-table">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <tr>
                                {targetCities.map(city => (
                                    <th colSpan={5} key={city} className="border-start bg-light py-2 fs-6">
                                        {city} <span className="text-primary ms-1" style={{ fontSize: '12px' }}>({cityCounts[city] || 0}件)</span>
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {targetCities.map(city => (
                                    <React.Fragment key={city}>
                                        <th className="border-start bg-white" style={{ minWidth: '60px' }}>順位</th>
                                        <th className="bg-white" style={{ minWidth: '80px' }}>枠名</th>
                                        <th className="bg-white" style={{ minWidth: '160px' }}>会社名</th>
                                        <th className="bg-white" style={{ minWidth: '220px' }}>物件名・エリア</th>
                                        <th className="bg-white" style={{ minWidth: '90px' }}>価格</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rankArray.map(rank => (
                                <tr key={rank}>
                                    {targetCities.map(city => {
                                        const item = dataMap[city]?.[rank];

                                        if (!item) {
                                            return (
                                                <React.Fragment key={city}>
                                                    <td className="border-start bg-white text-muted">-</td>
                                                    <td className="bg-white"></td>
                                                    <td className="bg-white"></td>
                                                    <td className="bg-white"></td>
                                                    <td className="bg-white"></td>
                                                </React.Fragment>
                                            );
                                        }

                                        const isOwn = item.company.includes('国分ハウジング');
                                        const bgColor = isOwn ? '#fffbeb' : '#ffffff';

                                        // ⚠️「前回」は選択中の取得日より**前**の記録。
                                        //   履歴は新しい順なので、最初に見つかった古い日付が前回になる。
                                        //   過去の日付を選んだときに未来の順位を出さないための条件。
                                        const history = historyMap[item.url] || [];
                                        const previous = history.find(h => h.date < selectedDate);
                                        const prevRank = previous ? previous.rank : '-';
                                        const rankDisplay = `${rank}(${prevRank})`;

                                        return (
                                            <React.Fragment key={city}>
                                                <td className="border-start text-center fw-bold text-secondary" style={{ backgroundColor: bgColor, fontSize: '11px' }}>
                                                    {rankDisplay}
                                                </td>
                                                <td style={{ backgroundColor: bgColor }}>
                                                    <span style={getPlanBadgeStyle(item.plan)}>{item.plan}</span>
                                                </td>
                                                <td className="text-start fw-bold text-dark" style={{ backgroundColor: bgColor, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                                    {item.company}
                                                </td>
                                                <td style={{ backgroundColor: bgColor }}>
                                                    <div className="d-flex justify-content-between align-items-center gap-2">
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-start" style={{ textDecoration: 'underline dotted', cursor: 'pointer', color: '#3182ce', fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                                            {item.name}
                                                        </a>
                                                        <span className="text-muted flex-shrink-0" style={{ fontSize: '9px' }}>
                                                            <i className="bi bi-geo-alt-fill text-danger me-1"></i>{item.area}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-end fw-bold text-dark" style={{ backgroundColor: bgColor }}>
                                                    {item.price}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                            {rankArray.length === 0 && (
                                <tr>
                                    <td colSpan={targetCities.length * 5} className="text-center text-muted py-5 bg-white">
                                        該当する物件データがありません。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default SuumoPropertySummary;
