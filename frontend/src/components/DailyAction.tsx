import React, { useEffect, useState, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import AuthContext from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { useIsSp } from '../utils/isSp';

/**
 * 注文営業のダッシュボードを開いた直後に出す「要確認」。
 *
 * ⚠️⚠️ **狙いは「晒す」こと**（2026-09-28 の相談）。
 *   ⚠️ 未同期と来場日未入力は**放置されがち**なので、
 *     ⚠️ **誰の顧客かに関係なく全員に見せる。**
 *   ⚠️ ⚠️ **担当者で絞り込まないこと。** 絞ると自分の分しか見えず、狙いが消える。
 *
 * ⚠️ 出す条件
 *   ⚠️ `!isSp` … スマートフォンでは出さない（表が5列あり読めない）
 *   ⚠️ `category === 'order'` … 注文営業のみ
 *   ⚠️⚠️ **`staff.check_daily_action` が本日でないこと**（サーバーが `show` で返す）
 *   ⚠️⚠️ **件数が0件のときは出さない**（見せるものが無い）
 *
 * ⚠️⚠️ **`Category.tsx` の `goToDashboard` では出せない。**
 *   ⚠️ あの関数は直後に `navigate()` するので、⚠️ **出した瞬間に消える。**
 *   ⚠️ 遷移先（`Company.tsx`）に置くこと。
 *
 * ⚠️⚠️ **閉じる手段は「確認しました」だけ。**
 *   ⚠️ closeButton も背景クリックも ESC も効かない（指示）。
 *   ⚠️ 押した時点で `roll: 'check'` を投げ、⚠️ **その日はもう出なくなる。**
 */

type Row = {
    /** ⚠️ 未同期・来場日未入力だけが持つ。本日の予定には無い */
    days?: number;
    shop: string;
    register: string;
    customer: string;
    medium: string;
};

type Section = {
    label: string;
    hasDays: boolean;
    rows: Row[];
};

type Props = {
    /** ⚠️ 開いてよいか。⚠️ 呼び出し側が「トップから来たか」を管理する */
    show: boolean;
    onClose: () => void;
};

/**
 * 放置日数の色。
 *
 * ⚠️ 段階はオーナー指定（2026-09-28）。
 *   ⚠️ 〜2日 … 薄い黄
 *   ⚠️ 3〜5日 … 橙
 *   ⚠️ 6日以上 … 赤
 *
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。**
 */
const daysStyle = (days: number): React.CSSProperties => {
    if (days >= 6) return { backgroundColor: '#dc3545', color: '#ffffff', fontWeight: 700 };
    if (days >= 3) return { backgroundColor: '#fd7e14', color: '#ffffff', fontWeight: 700 };
    return { backgroundColor: '#fff3cd', color: '#664d03', fontWeight: 700 };
};

/** ⚠️ 空の値は「(未設定)」と出す。空欄だと入力漏れなのか取得漏れなのか分からない */
const orUnset = (value: string): string => (value ?? '').trim() === '' ? '(未設定)' : value;

const cellStyle: React.CSSProperties = { fontSize: '11px', verticalAlign: 'middle' };

/**
 * 上部のサマリー。
 *
 * ⚠️⚠️ **固定（sticky）にする**（指示）。⚠️ 下までスクロールしても
 *   「確認しました」に手が届くようにするため。
 * ⚠️ ⚠️ **0件の項目は出さない**（指示）。
 */
const summaryStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #dee2e6',
    // ⚠️ Modal.Body の padding を打ち消して端まで白を敷く。敷かないと
    //   スクロールした行が両脇から透けて見える
    margin: '-1rem -1rem 0.75rem',
    padding: '0.75rem 1rem',
};

const DailyAction = ({ show, onClose }: Props) => {
    const { category } = useContext(AuthContext);
    const isSp = useIsSp();

    const [sections, setSections] = useState<Section[]>([]);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    /** ⚠️ 取りに行ってよいか。⚠️ **通信の前に判定する**（無駄な通信を避ける） */
    const canFetch = show && !isSp && category === 'order';

    useEffect(() => {
        if (!canFetch || loaded) return;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'daily_action', roll: 'list', category });
                setSections(response.data?.sections ?? []);
                setTotal(Number(response.data?.total ?? 0));
                setTruncated(response.data?.truncated === true);
                setAllowed(response.data?.show === true);
            } catch (e) {
                /**
                 * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
                 *   「今日は0件だった」と誤解される。**
                 * ⚠️ ⚠️ ただし**モーダルは開かない。** 空の枠だけ出しても意味がない
                 */
                console.error('要確認の取得に失敗しました', e);
                setError('要確認を取得できませんでした。');
            } finally {
                setLoaded(true);
            }
        };
        fetchData();
    }, [canFetch, loaded, category]);

    /**
     * 「確認しました」。
     *
     * ⚠️⚠️ **記録に失敗しても閉じる。** ⚠️ 閉じられないほうが困る
     *   （⚠️ 閉じる手段がこのボタンしかないため）。
     * ⚠️ 失敗した場合は**翌日以降もまた出る**だけで、害は無い。
     */
    const handleCheck = async () => {
        if (sending) return;
        setSending(true);
        try {
            await apiClient.post('', { request: 'daily_action', roll: 'check', category });
        } catch (e) {
            console.error('確認済みの記録に失敗しました', e);
        } finally {
            setSending(false);
            onClose();
        }
    };

    // ⚠️ 出さない条件。⚠️ **0件・確認済み・取得失敗のいずれでも出さない**
    if (!canFetch || !loaded || error !== '' || !allowed || total === 0) return null;

    const visible = sections.filter((section) => section.rows.length > 0);

    return (
        <Modal
            show={show}
            size='lg'
            centered
            scrollable
            /* ⚠️⚠️ **閉じる手段は下のボタンだけ**（指示）。背景も ESC も効かせない */
            backdrop='static'
            keyboard={false}
            onHide={() => { /* ⚠️ 何もしない。react-bootstrap が要求するので置いてある */ }}
        >
            {/* ⚠️ closeButton は付けない（指示） */}
            <Modal.Header>
                <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>要確認</div>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '74vh' }}>
                <div style={summaryStyle}>
                    <div className='d-flex flex-wrap align-items-center justify-content-between'>
                        <div className='d-flex flex-wrap align-items-center' style={{ gap: '10px' }}>
                            {visible.map((section) => (
                                <span key={section.label} style={{ fontSize: '12px' }}>
                                    {section.label}
                                    <span className='fw-bold text-danger ms-1' style={{ fontSize: '14px' }}>
                                        {section.rows.length}
                                    </span>
                                    件
                                </span>
                            ))}
                        </div>
                        <button
                            className='btn btn-primary btn-sm rounded-pill px-4'
                            style={{ fontSize: '12px', whiteSpace: 'nowrap', opacity: sending ? 0.5 : 1 }}
                            onClick={handleCheck}
                        >
                            確認しました
                        </button>
                    </div>
                </div>

                {/* ⚠️ 上限で切れたことを黙らない。⚠️ 「全部でこれだけ」と誤解される */}
                {truncated && (
                    <div className='text-danger mb-2' style={{ fontSize: '10px' }}>
                        ⚠️ 件数が多いため、放置日数の長い順に一部だけ表示しています。
                    </div>
                )}

                {visible.map((section) => (
                    <div key={section.label} className='mb-3'>
                        <div className={`fw-bold mb-1 ${section.hasDays ? 'text-danger' : 'text-primary'}`} style={{ fontSize: '13px' }}>
                            {section.label}
                            <span className='text-dark ms-1' style={{ fontSize: '11px' }}>{section.rows.length}件</span>
                        </div>
                        <Table bordered hover size='sm' className='mb-0'>
                            <thead>
                                <tr style={{ fontSize: '11px' }}>
                                    {/* ⚠️ 放置日数の列は未同期・来場日未入力だけ。本日の予定には無い */}
                                    {section.hasDays && <td style={{ width: '70px' }} className='text-center'>放置日数</td>}
                                    <td style={{ width: '130px' }}>店舗</td>
                                    <td style={{ width: '95px' }}>反響日</td>
                                    <td>顧客名</td>
                                    <td style={{ width: '120px' }}>反響媒体</td>
                                </tr>
                            </thead>
                            <tbody>
                                {section.rows.map((row, index) => (
                                    <tr key={`${section.label}-${row.customer}-${index}`}>
                                        {section.hasDays && (
                                            <td style={{ ...cellStyle, ...daysStyle(Number(row.days)), textAlign: 'center' }}>
                                                {Number(row.days)}日
                                            </td>
                                        )}
                                        <td style={cellStyle}>{orUnset(row.shop)}</td>
                                        <td style={cellStyle}>{orUnset(row.register)}</td>
                                        <td style={cellStyle}>{orUnset(row.customer)}</td>
                                        <td style={cellStyle}>{orUnset(row.medium)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                ))}
            </Modal.Body>
        </Modal>
    );
};

export default DailyAction;
