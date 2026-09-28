import React, { useEffect, useState, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import AuthContext from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { useIsSp } from '../utils/isSp';

/**
 * 注文営業のダッシュボードを開いた直後に一度だけ出すモーダル。
 *
 * ⚠️⚠️ **狙いは「晒す」こと**（2026-09-28 の相談）。
 *   ⚠️ 未同期と来場未入力は**放置されがち**なので、
 *     ⚠️ **誰の顧客かに関係なく全員に見せる。**
 *   ⚠️ ⚠️ **担当者で絞り込まないこと。** 絞ると自分の分しか見えず、狙いが消える。
 *
 * ⚠️ 出す条件（指示）
 *   ⚠️ `!isSp` … スマートフォンでは出さない（表が5列あり読めない）
 *   ⚠️ `category === 'order'` … 注文営業のみ
 *   ⚠️ `size='lg'`
 *
 * ⚠️⚠️ **`Category.tsx` の `goToDashboard` では出せない。**
 *   ⚠️ あの関数は直後に `navigate()` するので、⚠️ **出した瞬間に消える。**
 *   ⚠️ 遷移先（`Company.tsx`）に置くこと。
 *
 * ⚠️ データは `request: 'daily_action'`。⚠️ **menu のバッジとは別経路**である
 *   （⚠️ menu は件数しか返さない。⚠️ **18.2MB だった頃の形に戻さないこと**）。
 */

type AttentionRow = {
    kind: 'unsync' | 'cancel';
    days: number;
    shop: string;
    register: string;
    customer: string;
    medium: string;
};

type TodayRow = {
    step: string;
    shop: string;
    register: string;
    customer: string;
    medium: string;
};

type Props = {
    /** ⚠️ 開いてよいか。⚠️ 呼び出し側が「初回だけ」を管理する */
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
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。** 表の2箇所が同じ関数を通る。
 */
const daysStyle = (days: number): React.CSSProperties => {
    if (days >= 6) return { backgroundColor: '#dc3545', color: '#ffffff', fontWeight: 700 };
    if (days >= 3) return { backgroundColor: '#fd7e14', color: '#ffffff', fontWeight: 700 };
    return { backgroundColor: '#fff3cd', color: '#664d03', fontWeight: 700 };
};

/** ⚠️ 行の種類の見出し。⚠️ 何をすればよいかが分かる言い方にする */
const KIND_LABEL: Record<AttentionRow['kind'], string> = {
    unsync: '未同期',
    cancel: '来場未入力',
};

const KIND_STYLE: Record<AttentionRow['kind'], string> = {
    unsync: 'bg-secondary',
    cancel: 'bg-dark',
};

/** ⚠️ 空の値は「(未設定)」と出す。空欄だと入力漏れなのか取得漏れなのか分からない */
const orUnset = (value: string): string => (value ?? '').trim() === '' ? '(未設定)' : value;

const cellStyle: React.CSSProperties = { fontSize: '11px', verticalAlign: 'middle' };

const DailyActionModal = ({ show, onClose }: Props) => {
    const { category } = useContext(AuthContext);
    const isSp = useIsSp();

    const [attention, setAttention] = useState<AttentionRow[]>([]);
    const [today, setToday] = useState<TodayRow[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');

    /** ⚠️ 出さない条件。⚠️ **取りに行く前に判定する**（無駄な通信を避ける） */
    const isTarget = show && !isSp && category === 'order';

    useEffect(() => {
        if (!isTarget || loaded) return;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'daily_action', category });
                setAttention(response.data?.attention ?? []);
                setToday(response.data?.today ?? []);
                setTruncated(response.data?.truncated === true);
            } catch (e) {
                /**
                 * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
                 *   「今日は0件だった」と誤解される。**
                 */
                console.error('要確認・本日の予定の取得に失敗しました', e);
                setError('要確認・本日の予定を取得できませんでした。分析サーバーが停止している可能性があります。');
            } finally {
                setLoaded(true);
            }
        };
        fetchData();
    }, [isTarget, loaded, category]);

    if (!isTarget) return null;

    return (
        <Modal show={show} size='lg' onHide={onClose} centered scrollable>
            <Modal.Header closeButton>
                <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    本日のアクション
                </div>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '72vh' }}>
                {error && <div className='alert alert-warning' style={{ fontSize: '12px' }}>{error}</div>}

                <div className='fw-bold text-danger mb-1' style={{ fontSize: '13px' }}>
                    【要確認】<span className='text-dark ms-1' style={{ fontSize: '11px' }}>{attention.length}件</span>
                </div>
                {/* ⚠️ 0件のときも表の枠は出さない。空の表は「壊れている」と読まれる */}
                {attention.length === 0
                    ? <div className='text-secondary mb-3' style={{ fontSize: '11px' }}>対応が必要な顧客はありません。</div>
                    : (
                        <Table bordered hover size='sm' className='mb-1'>
                            <thead>
                                <tr style={{ fontSize: '11px' }}>
                                    <td style={{ width: '70px' }} className='text-center'>放置日数</td>
                                    <td style={{ width: '70px' }} className='text-center'>種類</td>
                                    <td style={{ width: '120px' }}>店舗</td>
                                    <td style={{ width: '90px' }}>反響日</td>
                                    <td>顧客名</td>
                                    <td style={{ width: '110px' }}>反響媒体</td>
                                </tr>
                            </thead>
                            <tbody>
                                {attention.map((row, index) => (
                                    <tr key={`${row.kind}-${row.customer}-${index}`}>
                                        <td style={{ ...cellStyle, ...daysStyle(Number(row.days)), textAlign: 'center' }}>
                                            {Number(row.days)}日
                                        </td>
                                        <td style={{ ...cellStyle, textAlign: 'center' }}>
                                            <span className={`${KIND_STYLE[row.kind]} text-white px-1 rounded`} style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                                                {KIND_LABEL[row.kind]}
                                            </span>
                                        </td>
                                        <td style={cellStyle}>{orUnset(row.shop)}</td>
                                        <td style={cellStyle}>{orUnset(row.register)}</td>
                                        <td style={cellStyle}>{orUnset(row.customer)}</td>
                                        <td style={cellStyle}>{orUnset(row.medium)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                {/* ⚠️ 上限で切れたことを黙らない。⚠️ 「全部でこれだけ」と誤解される */}
                {truncated && (
                    <div className='text-danger mb-3' style={{ fontSize: '10px' }}>
                        ⚠️ 件数が多いため、放置日数の長い順に一部だけ表示しています。
                    </div>
                )}

                <div className='fw-bold text-primary mb-1 mt-3' style={{ fontSize: '13px' }}>
                    【本日の予定】<span className='text-dark ms-1' style={{ fontSize: '11px' }}>{today.length}件</span>
                </div>
                {today.length === 0
                    ? <div className='text-secondary' style={{ fontSize: '11px' }}>本日の予定はありません。</div>
                    : (
                        <Table bordered hover size='sm'>
                            <thead>
                                <tr style={{ fontSize: '11px' }}>
                                    <td style={{ width: '110px' }} className='text-center'>予定</td>
                                    <td style={{ width: '120px' }}>店舗</td>
                                    <td style={{ width: '90px' }}>反響日</td>
                                    <td>顧客名</td>
                                    <td style={{ width: '110px' }}>反響媒体</td>
                                </tr>
                            </thead>
                            <tbody>
                                {today.map((row, index) => (
                                    <tr key={`${row.step}-${row.customer}-${index}`}>
                                        <td style={{ ...cellStyle, textAlign: 'center' }} className='table-primary fw-bold'>{row.step}</td>
                                        <td style={cellStyle}>{orUnset(row.shop)}</td>
                                        <td style={cellStyle}>{orUnset(row.register)}</td>
                                        <td style={cellStyle}>{orUnset(row.customer)}</td>
                                        <td style={cellStyle}>{orUnset(row.medium)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
            </Modal.Body>
            <Modal.Footer className='py-2'>
                <button className='btn btn-primary btn-sm rounded-pill px-4' style={{ fontSize: '12px' }} onClick={onClose}>
                    確認しました
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default DailyActionModal;
