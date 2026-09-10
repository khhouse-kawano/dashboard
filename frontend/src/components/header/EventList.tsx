import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { Table, Spinner, Alert, Modal } from 'react-bootstrap';
// ⚠️ 2026-09-06 に list/ から header/ へ移動した。listUtils は list/ に残している
//   （ListOrder / ListKaeru / ListResale も使っており、こちらへ移すと影響が広い）
import { styles, positions ,formatToYYYYMMDD} from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import { generateULID } from '../../utils/createULID';
import { thisYear } from '../../utils/thisYear';
import AuthContext from '../../context/AuthContext';

/**
 * イベント予約1件。
 *
 * ⚠️ 2つの経路で作られる。
 *     1. LPのフォーム（おうちづくりフェスタ2026）→ ② Express の event_reservation
 *     2. 受付での手入力（既存の運用）
 *   `title` でイベントを区別している。
 *
 * ⚠️ **編集できるのは name / phone / mail の3つだけ**（2026-09-07）。
 *   それ以外は来場者本人が入力した原本であり、社内で書き換えると
 *   「本当は何と入力されたのか」が分からなくなる。
 *   サーバー側（listAction/list_event.php）でも同じ制限を掛けている。
 *   受付運用のための check_in_time / check_out_time / remarks は例外。
 */
type CustomerData = {
    no: string;
    id: string;
    time: string;
    date: string;
    name: string;
    /** ふりがな。⚠️ LPのフォームから届いた予約にのみ入る */
    kana: string;
    zip: string;
    address: string;
    street: string;
    phone: string;
    mail: string;
    age: string;
    adult: string;
    child: string;
    house: string;
    interview: string;
    /** マイホームのご検討。⚠️ カンマ区切り。LPのフォームから届いた予約にのみ入る */
    request: string;
    medium: string;
    area: string;
    question: string;
    /** 個人情報の取り扱いへの同意。⚠️ NULL は同意欄が無かった頃の予約 */
    agree: number | null;
    /** 予約を受け付けた日時。⚠️ 手入力で作られた行には入らない */
    reserved_at: string | null;
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    remarks: string;
    title: string;
    shop: string;
    sync: number | null;
};

type Staff = {
    name: string;
    shop: string;
    period: string;
    position: string;
    rank: string;
};

// ⚠️ セレクトボックスの選択肢（OPTIONS）は 2026-09-07 に削除した。
//   来場予定・世帯情報・相談内容・きっかけを編集できなくしたため使い道が無い。
//   選択肢はイベントごとに違い（LPのフォームと旧イベントで別物）、
//   固定の一覧で描くと、そのイベントにしか無い値が画面から消える。
//   復活させるなら listAction/list_event.php の $allowed_columns も戻すこと。

const brands: Record<string, string> = {
    'KH': '国分ハウジング',
    'DJ': 'デイジャストハウス',
    'なご': 'なごみ工務店',
    '2L': 'ニーエルホーム',
    'JH': 'ジャスフィーホーム',
    'FH': 'フルコミホーム',
    'PG': 'PG HOUSE'
};

/**
 * 相談意向のある来場者と判定する `interview` の値。
 *
 * ⚠️ 部分一致（includes）で判定してよい。似た値と衝突しないことを実データで確認済み。
 *   `interview` には「注文住宅の相談」「中古住宅の相談」もあるが、これらは
 *   **「住宅の相談」であって「住宅相談」を含まない**（「の」が入る）。
 *
 * ⚠️ 完全一致にはしないこと。`interview` はカンマ区切りの複数選択で、
 *   実データは「住宅相談,資金・ローン相談,キッチンカー,マルシェ,…」のように連なる。
 *
 * ⚠️ 選択肢はイベントごとに違う（LPのフォームと旧イベントで別物）。
 *   将来この文言が変わったら、ここを直すこと。
 */
const CONSULTATION_KEYWORDS = ['住宅相談', '資金・ローン相談'];

/**
 * 相談意向のある行か。**どちらか一方でも満たせば真（OR）。**
 *
 * ⚠️ AND ではない。ロジックを変えるときは注意。
 *   ローカルの実データでは `request` が入っている行が2件しか無く、
 *   その2件はどちらも `interview` 側にも該当するため、
 *   **AND と OR で件数の差が出ず、テストでは違いに気づけない。**
 *   本番では `request` 未入力でも相談内容だけで着色される行が出る。
 */
const hasConsultationIntent = (item: CustomerData): boolean => {
    const interview = item.interview || '';
    if (CONSULTATION_KEYWORDS.some(keyword => interview.includes(keyword))) return true;

    /**
     * マイホームのご検討（`request`）が入力済みか。
     * ⚠️ 空文字・NULL は「未入力」。LPのフォーム由来の予約にしか入らない。
     * ⚠️ trim している。空白だけの値は未入力として扱う
     *   （表示側も `.filter(v => v)` で空を落としており、そちらと揃える）。
     */
    return (item.request || '').trim() !== '';
};

/**
 * 行の配色。
 * inline style では .table のセル背景に負けるため Bootstrap の配色クラスを使用。
 *
 * ⚠️⚠️ **判定の順序に意味がある。先に返した色が勝つ。**
 *
 *   1. sync === 1（同期済み）が最優先。顧客取込の済み／未済は作業判断に直結するため、
 *      相談意向の色で塗り潰さないこと。
 *   2. house（賃貸／持ち家）は既存の挙動をそのまま残す。
 *   3. 相談意向は最後。⚠️ **意図的に一番弱くしている。**
 *      ここより上に置くと、既に色が付いている行の色が変わってしまう。
 *
 * ⚠️ 2 と 3 は実質ぶつからない。`house` は手入力の行にしか入らず、
 *   `interview` / `request` が埋まる LP フォーム由来の行は `house` が全件空である
 *   （2026-09-10 時点の実データで確認）。順序は将来の値の追加に対する保険。
 */
const getRowClass = (item: CustomerData) => {
    if (item.sync === 1) return 'table-primary';
    const house = item.house || '';
    if (house.includes('賃貸')) return 'table-info';
    if (house.includes('持ち家')) return 'table-warning';
    // ⚠️ 上の3色（青・水色・黄）と区別が付く薄い色にする
    if (hasConsultationIntent(item)) return 'table-success';
    return '';
};

// 顧客取込(insert)用のペイロードを生成
const createSyncPayload = (item: CustomerData): Record<string, string> => ({
    id: generateULID(),
    customer_contacts_name: item.name || '',
    full_address: `${item.address || ''}${item.street || ''}`,
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: formatToYYYYMMDD(item.check_in_time),
    customer_contacts_mobile_phone_number: item.phone || '',
    customer_contacts_email: item.mail || '',
    postal_code: item.zip || '',
    sales_promotion_name: 'イベント',
    customized_input_01JRCT12N9X24PCQ5QZPAYKB93: item.title || '',
    status: '見込み',
    planned_construction_site: item.area || '',
    brand: brands[(item.shop || '').slice(0, 2)] || ''
});

// 極限まで高さを削るための共通スタイル
const compactInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
    height: '24px',
};

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '4px 8px',
    borderBottom: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#8898aa',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontSize: '11px',
};

type Props = {
    eventSummary: boolean,
    setEventSummary: React.Dispatch<React.SetStateAction<boolean>>
}

const EventList = ({ eventSummary, setEventSummary }: Props) => {
    const { category } = useContext(AuthContext);
    const [data, setData] = useState<CustomerData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetEvent, setTargetEvent] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [isVisited, setIsVisited] = useState<number | null>(null);
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    // 同期(担当者選択)モーダル用の状態
    const [syncShow, setSyncShow] = useState(false);
    const [syncTarget, setSyncTarget] = useState<CustomerData | null>(null);
    const [targetStaff, setTargetStaff] = useState('');

    // ⚠️ QRコードの読み取り（受付）は 2026-09-07 にこの画面から外した。
    //   受付はスタッフが自分のスマホで来場者のQRを読み、
    //   kh-house.jp/festa/reservation/?id=... を開いて行う運用に変えたため。
    //   スマホではヘッダーのメニューが出ないので、この画面はそもそも開けない。
    //   サーバー側の実装は backend-express/src/features/event/checkin.ts。
    const rowRefs = useRef<{ [key: string]: { [field: string]: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null } }>({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // キャッシュバスターを残しつつ、最新データを取得
            const payload = {
                request: 'list',
                roll: 'event',
                function: 'load',
                category,
                _t: Date.now()
            };
            const response = await apiClient.post('', payload);
            setData(response.data.summary);
            const positionIndex = (position: string) => {
                const index = positions.indexOf(position);
                return index === -1 ? positions.length : index;
            };
            const responseStaff = response.data.staff
                .filter((s: Staff) => s.period === String(thisYear) && Number(s.rank) === 1)
                .sort((a: Staff, b: Staff) => positionIndex(a.position) - positionIndex(b.position));
            setStaffArray(responseStaff);
        } catch (err) {
            setError("データの取得に失敗しました");
            console.error(err)
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventSummary) {
            fetchData();
        }
    }, [eventSummary]);

    // ==========================================
    // 💡 追加: 外部からデータが再取得された際に、
    // rowRefs を使って強制的に画面の DOM (value) を上書き同期する
    // ==========================================
    useEffect(() => {
        data.forEach(item => {
            const refs = rowRefs.current[item.id];
            if (!refs) return;

            // ⚠️ 入力欄として描画している項目だけを列挙すること。
            //   表示のみの項目を書くと ref が無く、毎回空振りする
            const fields: (keyof CustomerData)[] = [
                'name', 'phone', 'mail',
                'check_in_time', 'check_out_time', 'remarks'
            ];

            fields.forEach(field => {
                const el = refs[field];
                if (el) {
                    const newValue = item[field] || '';
                    if (el.value !== String(newValue)) {
                        el.value = String(newValue);
                    }
                }
            });
        });
    }, [data]); // dataが更新されるたびに発火

    // ==========================================
    // 取得データから絞り込み用の選択肢(ユニーク値)を生成
    // ==========================================
    const eventArray = useMemo(() => Array.from(new Set(data.map(item => item.title).filter(value => !!value))), [data]);

    const shopArray = useMemo(() => Array.from(new Set(data.map(item => item.shop).filter(value => !!value))), [data]);

    // ==========================================
    // イベント名・店舗・来場状況による絞り込み
    // ==========================================
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const visited = !!item.check_in_time && item.check_in_time !== '';
            return (
                (targetEvent === '' || (item.title || '') === targetEvent) &&
                (targetShop === '' || (item.shop || '') === targetShop) &&
                (isVisited === null || (isVisited === 1 ? visited : !visited))
            );
        });
    }, [data, targetEvent, targetShop, isVisited]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => Number(b.no) - Number(a.no));
    }, [filteredData]);

    // ==========================================
    // 段階的なレンダリング（スクロールで20件ずつ増やす）
    //
    // ⚠️ 1行あたりの要素数が多く、全件を一度に描くと数百件で目に見えて重くなる。
    //   ListOrder.tsx と同じ IntersectionObserver 方式に揃えている。
    //
    // ⚠️ **QRの受付は描画件数の影響を受けない。** 検索対象は data（全件）であり、
    //   画面に出ていない予約でもチェックインできる。ここを slice 済みの
    //   配列に変えてはいけない（下までスクロールしないと受付できなくなる）。
    // ==========================================
    const PAGE_SIZE = 20;
    const [displayLength, setDisplayLength] = useState<number>(PAGE_SIZE);
    const loaderRef = useRef<HTMLTableRowElement>(null);

    // ⚠️ 絞り込みが変わったら先頭に戻す。戻さないと、少ない結果に絞ったあとで
    //   「前に読み込んだ件数」が残り、次に絞り込みを外したとき一気に描画される
    useEffect(() => {
        setDisplayLength(PAGE_SIZE);
    }, [targetEvent, targetShop, isVisited]);

    useEffect(() => {
        const total = sortedData.length;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLength((prev) => (prev < total ? prev + PAGE_SIZE : prev));
                }
            },
            // ⚠️ 表(.table-responsive)が縦スクロールするわけではなくモーダル全体が
            //   スクロールするため、root は既定（ビューポート）でよい。
            //   先読みして体感の待ちを減らす
            { rootMargin: '200px' }
        );

        const current = loaderRef.current;
        if (current) observer.observe(current);

        return () => {
            if (current) observer.unobserve(current);
        };
    }, [sortedData.length]);

    const visibleData = useMemo(
        () => sortedData.slice(0, displayLength),
        [sortedData, displayLength]
    );

    // 1項目のみを更新するAPI呼び出し(handleBlur / チェックボックス / 同期完了で共用)
    const updateField = async (id: string, field: string, value: string | number) => {
        try {
            await apiClient.post('', {
                id,
                request: 'list',
                roll: 'event',
                function: 'update',
                category,
                [field]: value
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleBlur = (id: string, field: keyof CustomerData) => {
        const element = rowRefs.current[id]?.[field];
        if (!element) return;

        const newValue = element.value;
        const currentData = data.find(item => item.id === id);

        if (currentData && currentData[field] === newValue) return;

        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue } : item));
        updateField(id, field, newValue);
    };

    // ⚠️ 相談内容（interview）のチェックボックス編集は 2026-09-07 に廃止した。
    //   選択肢がイベントごとに違い、固定の選択肢で描くと
    //   「そのイベントにしか無い値」が画面から消えたうえ、
    //   触った瞬間に保存されて**原本が失われる**ため。

    const setRef = (id: string, field: string) => (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => {
        if (!rowRefs.current[id]) {
            rowRefs.current[id] = {};
        }
        rowRefs.current[id][field] = el;
    };

    /**
     * イベントの特設ページ。
     *
     * ⚠️ イベントごとにURLが違う。絞り込みで選んでいるイベントのものを開く。
     *   1つに固定すると、イベントが変わるたびに古いページへ飛ぶ
     *   （実際に 2026-09-07 まで前年の住まいるフェス2025を指したままだった）。
     */
    const EVENT_URLS: Record<string, string> = {
        'おうちづくりフェスタ2026': 'https://kh-house.jp/festa/',
        '住まいるフェスティバル2026': 'https://kh-house.jp/lp/smilefes_akune_2025/',
    };

    /** ⚠️ 未選択・未登録のイベントのときは最新のものを開く */
    const currentEventUrl = EVENT_URLS[targetEvent] ?? 'https://kh-house.jp/festa/';

    const openUrl = () => {
        window.open(currentEventUrl, '_blank');
    };



    const reload = () => {
        fetchData();
    };

    // 対象行の店舗に紐づくスタッフ + 「〇〇店 管理」
    const staffOptions = useMemo(() => {
        if (!syncTarget) return [];
        return [...staffArray.filter(s => s.shop === syncTarget.shop).map(s => s.name), `${syncTarget.shop} 管理`];
    }, [staffArray, syncTarget]);

    const handleSync = (item: CustomerData) => {
        setSyncTarget(item);
        setTargetStaff('');
        setSyncShow(true);
    };

    // 同期成功(status === 'success')後のUI更新
    const syncSuccess = (id: string) => {
        setData(prev => prev.map(item => item.id === id ? { ...item, sync: 1 } : item));
        updateField(id, 'sync', 1);
        setSyncShow(false);
        setSyncTarget(null);
        setTargetStaff('');
    };

    const syncStart = async () => {
        if (!syncTarget || targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }

        const postData: Record<string, string> = {
            ...createSyncPayload(syncTarget),
            in_charge_user: targetStaff,
            in_charge_store: syncTarget.shop,
            request: 'list',
            roll: 'insert',
            category
        };

        try {
            const response = await apiClient.post('', postData);
            if (response.data.status === 'success') {
                syncSuccess(syncTarget.id);
            } else {
                alert('同期に失敗しました。');
            }
        } catch (e) {
            console.error(e);
            alert('同期に失敗しました。');
        }
    };

    return (
        <>
            <Modal show={eventSummary} onHide={() => setEventSummary(false)} fullscreen>
                <Modal.Header closeButton className="py-2">
                    {/* ⚠️ 複数のイベントを扱うため、特定のイベント名を書かない。
                        どのイベントを見ているかは右上の絞り込みで示す */}
                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>イベント予約状況</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex gap-2">
                            <button style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={openUrl}>
                                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>特設URLはこちら
                            </button>
                            <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={reload} disabled={loading}>
                                {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                                リロード
                            </button>
                            <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setEventSummary(false)} disabled={loading}>
                                <i className="fa-solid fa-xmark me-1"></i>閉じる
                            </button>
                        </div>

                        {/* 💡 追加: 絞り込み用セレクトタグ */}
                        <div className="d-flex gap-2 align-items-center">
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetEvent} onChange={(e) => setTargetEvent(e.target.value)}>
                                <option value="">全イベント表示</option>
                                {eventArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetShop} onChange={(e) => setTargetShop(e.target.value)}>
                                <option value="">全店舗表示</option>
                                {shopArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={isVisited === null ? '' : String(isVisited)}
                                onChange={(e) => setIsVisited(e.target.value === '' ? null : Number(e.target.value))}>
                                <option value="">来場状況</option>
                                <option value="1">来場済み</option>
                                <option value="0">未来場</option>
                            </select>
                        </div>
                    </div>

                    {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                    <div className="bg-white rounded shadow-sm border table-responsive">
                        <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1800px' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '40px' }}>同期</th>
                                    <th style={{ ...thStyle, width: '110px' }}>来場予定</th>
                                    {/* ⚠️ ここから3列だけが編集できる。他は来場者の入力した原本 */}
                                    <th style={{ ...thStyle, width: '110px' }}>お名前</th>
                                    <th style={{ ...thStyle, width: '100px' }}>電話番号</th>
                                    <th style={{ ...thStyle, width: '180px' }}>メールアドレス</th>
                                    <th style={{ ...thStyle, width: '80px' }}>郵便番号</th>
                                    <th style={{ ...thStyle, width: '220px' }}>住所</th>
                                    <th style={{ ...thStyle, width: '200px' }}>世帯情報</th>
                                    <th style={{ ...thStyle, width: '220px', whiteSpace: 'normal' }}>相談内容</th>
                                    <th style={{ ...thStyle, width: '160px', whiteSpace: 'normal' }}>ご検討</th>
                                    <th style={{ ...thStyle, width: '100px' }}>きっかけ</th>
                                    <th style={{ ...thStyle, width: '120px' }}>希望エリア</th>
                                    <th style={{ ...thStyle, width: '130px' }}>チェックイン</th>
                                    <th style={{ ...thStyle, width: '130px' }}>チェックアウト</th>
                                    <th style={{ ...thStyle, width: '180px' }}>事前質問</th>
                                    <th style={{ ...thStyle, width: '180px' }}>備考欄</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleData.map((item, index) => {
                                    const hasCheckIn = !!item.check_in_time && item.check_in_time !== '';
                                    const hasCheckOut = !!item.check_out_time && item.check_out_time !== '';
                                    let statusIcon;

                                    if (hasCheckIn && !hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-arrow-right-to-bracket text-success" title="チェックイン"></i>;
                                    } else if (hasCheckIn && hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-check-double text-secondary" title="チェックアウト"></i>;
                                    }

                                    return (
                                        <tr key={item.id} className={getRowClass(item)}>
                                            <td className="p-1 align-middle text-center fw-bold" style={{ fontSize: '10px' }}>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span>{index + 1}</span>
                                                    {statusIcon && <span style={{ fontSize: '12px' }}>{statusIcon}</span>}
                                                    {item.sync === 1
                                                        ? <span style={{ fontSize: '9px' ,color: 'red'}}>同期済み</span>
                                                        : <i className='fa-solid fa-arrows-rotate pointer' onClick={() => handleSync(item)}></i>}
                                                </div>
                                            </td>
                                            {/* ⚠️ ここから下、編集できるのは お名前 / 電話番号 / メールアドレス の3つだけ。
                                                他は来場者本人が入力した原本のため表示のみにしている（2026-09-07）。
                                                サーバー側（listAction/list_event.php）でも同じ制限を掛けているので、
                                                入力欄に戻すだけでは保存されない。 */}
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>
                                                <div>{item.date || ''}</div>
                                                <div className="fw-bold">{item.time || ''}</div>
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name} onBlur={() => handleBlur(item.id, 'name')} />
                                                {/* ⚠️ ふりがなは編集させない。読み仮名は本人の申告が正 */}
                                                {item.kana && <div style={{ fontSize: '10px', color: '#8898aa' }}>{item.kana}</div>}
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'phone')} defaultValue={item.phone} onBlur={() => handleBlur(item.id, 'phone')} />
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'mail')} defaultValue={item.mail} onBlur={() => handleBlur(item.id, 'mail')} />
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>{item.zip || ''}</td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {`${item.address || ''}${item.street || ''}`}
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {/* ⚠️ 手入力で作られた行にしか入らない項目。LPのフォームには無い */}
                                                {[item.age, item.adult, item.child, item.house].filter(v => v).join(' / ')}
                                            </td>
                                            <td className="p-1 align-middle" style={{ whiteSpace: 'normal', lineHeight: '1.3', fontSize: '10px' }}>
                                                {/* ⚠️ 選択肢はイベントごとに違う（LPのフォームと旧イベントで別物）。
                                                    固定のチェックボックスにすると、知らない値が黙って消える */}
                                                {(item.interview || '').split(',').filter(v => v).map(v => (
                                                    <span key={v} className="badge bg-light text-dark border me-1 mb-1 fw-normal">{v}</span>
                                                ))}
                                            </td>
                                            <td className="p-1 align-middle" style={{ whiteSpace: 'normal', lineHeight: '1.3', fontSize: '10px' }}>
                                                {(item.request || '').split(',').filter(v => v).map(v => (
                                                    <span key={v} className="badge bg-light text-dark border me-1 mb-1 fw-normal">{v}</span>
                                                ))}
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>{item.medium || ''}</td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>{item.area || ''}</td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} placeholder="2026/03/21 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time || ''} onBlur={() => handleBlur(item.id, 'check_in_time')} />
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} placeholder="2026/03/21 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time || ''} onBlur={() => handleBlur(item.id, 'check_out_time')} />
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {/* ⚠️ 事前質問も本人の入力。書き換えると原本が失われる */}
                                                {item.question || ''}
                                            </td>
                                            <td className="p-1 align-middle">
                                                <textarea
                                                    style={{ ...compactInputStyle, height: '40px', resize: 'none' }}
                                                    placeholder="受付スタッフ用メモ..."
                                                    ref={setRef(item.id, 'remarks')}
                                                    defaultValue={item.remarks}
                                                    onBlur={() => handleBlur(item.id, 'remarks')}
                                                ></textarea>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={16} className="text-center p-4 text-muted" style={{ fontSize: '11px' }}>データがありません</td>
                                    </tr>
                                )}

                                {/* ⚠️ 追加読み込みの目印。tbody の中なので tr / td で置くこと。
                                    div を直接入れるとブラウザが table の外へ弾き出し、
                                    交差判定が働かずスクロールしても増えなくなる */}
                                <tr ref={loaderRef}>
                                    <td colSpan={16} className="text-center text-muted p-2" style={{ fontSize: '11px' }}>
                                        {sortedData.length > displayLength
                                            ? `読み込み中…（${displayLength} / ${sortedData.length} 件）`
                                            : sortedData.length > 0 ? `全 ${sortedData.length} 件` : ''}
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>

            {/* 💡 追加: 担当者選択モーダル */}
            <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '13px', fontWeight: 'bold', color: '#32325d' }}>担当営業の選択</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                        {syncTarget ? `${syncTarget.shop} / ${syncTarget.name} 様` : ''}
                    </div>
                    <select style={{ ...compactInputStyle, height: '28px', fontSize: '12px' }} value={targetStaff} onChange={(e) => setTargetStaff(e.target.value)}>
                        <option value="">担当営業を選択</option>
                        {staffOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button className='mt-2'
                        style={{ ...styles.buttonDanger, padding: '0px 10px', fontSize: '11px' }}
                        onClick={syncStart}>
                        <i className="fa-solid fa-rotate me-1"></i>同期する
                    </button>
                </Modal.Body>
            </Modal>

        </>
    );
};

export default EventList;