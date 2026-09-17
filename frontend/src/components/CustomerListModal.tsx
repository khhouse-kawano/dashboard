import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { ModalBody } from 'react-bootstrap';
import InterviewLog from './InterviewLog';

/**
 * KPIの歩留まりに該当する顧客の一覧モーダル。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このコンポーネントは「表示」だけを担う。**
 *   どの顧客が該当するかを決めるのは呼び出し側である。
 *
 *   歩留まりの判定ロジック（getValue）は画面ごとに**別物**で、
 *   共通化してはいけない。たとえば
 *     shopTrend/ShopTrendOrder.tsx … 実来場は interview のみ
 *     customerTrend/CustomerTrendOrder.tsx … 実来場は interview ＋ 未来場の次アポ等
 *     customerTrend/CustomerTrendKaeru.tsx … KPI階層で最古日付を採る方式
 *   ここに寄せると、どれか1つを直したときに他の画面の数字が黙って変わる。
 *
 * ⚠️ 受け取る配列は「すでに絞り込み済みの顧客」である。
 *   このコンポーネントは並べ替えも絞り込みもしない。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 顧客詳細（InformationEdit）は事業ごとに別コンポーネントなので、
 *   ここには置かず `onSelectCustomer` で呼び出し側へ渡す。
 *   商談ステップ（InterviewLog）は3事業共通なので、ここで持つ。
 */

/** ⚠️ 画面ごとに列が違うので Record で受ける。使うキーだけ下で読む */
export type CustomerListRow = {
    id?: string;
    customer?: string;
    shop?: string;
    staff?: string;
    interview?: string;
    status?: string;
    rank?: string;
    medium?: string;
    [key: string]: unknown;
};

type Props = {
    /** モーダルを開くか */
    show: boolean;
    /** 見出しに出す名前。「実来場者」など。`{label}一覧` と表示される */
    label: string;
    /** 表示する顧客。⚠️ 絞り込み済みのものを渡すこと */
    list: CustomerListRow[];
    /** 閉じたときに呼ばれる。呼び出し側で show を false にする */
    onHide: () => void;
    /**
     * 顧客名をクリックしたとき。顧客詳細モーダルを開く用途。
     * ⚠️ 渡さなければ顧客名はただの文字列になる（クリックできない）。
     */
    onSelectCustomer?: (id: string) => void;
};

/** 1ページの件数。⚠️ shopTrend の一覧と揃えている */
const PAGE_SIZE = 10;

const CustomerListModal: React.FC<Props> = ({ show, label, list, onHide, onSelectCustomer }) => {
    const [page, setPage] = useState(1);
    /** 商談ステップを開く顧客ID。'' なら閉じている */
    const [interviewId, setInterviewId] = useState('');

    /**
     * ⚠️⚠️ **開き直したらページを1に戻す。**
     *   戻さないと、前回3ページ目まで見た状態で件数の少ない
     *   KPI を開いたときに**空の表**が出る（バグに見える）。
     */
    useEffect(() => {
        if (show) setPage(1);
    }, [show, label, list]);

    const close = () => {
        // ⚠️ 商談ステップも閉じる。残すと次に開いたとき勝手に開く
        setInterviewId('');
        onHide();
    };

    const hasNext = list.length - page * PAGE_SIZE > 0;
    const hasPrev = page > 1;

    return (
        <>
            <Modal show={show} onHide={close} size='xl'>
                <Modal.Header closeButton>{label}一覧（{list.length.toLocaleString()}件）</Modal.Header>
                <ModalBody>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
                            <tr>
                                <td>No</td>
                                <td>顧客名</td>
                                <td>店舗</td>
                                <td>担当営業</td>
                                <td>初回来場日</td>
                                <td>ステータス</td>
                                <td>ランク</td>
                                <td>販促媒体</td>
                                <td>商談ステップ</td>
                            </tr>
                            {list.slice(page * PAGE_SIZE - PAGE_SIZE, page * PAGE_SIZE).map((item, index) =>
                                <tr key={item.id ?? index}>
                                    {/* ⚠️ ページをまたいでも通し番号になるようにする */}
                                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                                    <td>
                                        {onSelectCustomer
                                            ? <span onClick={() => onSelectCustomer(item.id ?? '')}
                                                style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span>
                                            : item.customer}
                                    </td>
                                    <td>{item.shop}</td>
                                    <td>{item.staff}</td>
                                    {/* ⚠️ 未来場（反響・来場予約の一覧）では空になるので '-' を出す */}
                                    <td>{item.interview || '-'}</td>
                                    <td>{item.status}</td>
                                    <td>{item.rank}</td>
                                    <td>{item.medium}</td>
                                    <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
                                        onClick={() => setInterviewId(item.id ?? '')}>表示</div></td>
                                </tr>)}
                        </tbody>
                    </Table>
                    <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
                        <div className={hasPrev ? 'text-primary' : ''}
                            style={{ cursor: hasPrev ? 'pointer' : 'text' }}
                            onClick={() => { if (hasPrev) setPage(page - 1); }}>前の{PAGE_SIZE}件</div>
                        <div className={hasNext ? 'text-primary' : ''}
                            style={{ cursor: hasNext ? 'pointer' : 'text' }}
                            onClick={() => { if (hasNext) setPage(page + 1); }}>次の{PAGE_SIZE}件</div>
                    </div>
                </ModalBody>
            </Modal>
            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
        </>
    );
};

export default CustomerListModal;
