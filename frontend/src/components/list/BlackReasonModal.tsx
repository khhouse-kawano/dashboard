import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';

/**
 * ブラックリストに登録する理由を入れる小さな画面（v2.2.227）。ListOrder・ListKaeru・ListResale で共通。
 *
 * ⚠️ 2026-10-29 の指示: ブラックリストのボタンを押したら一番小さいサイズ（sm）で開き、理由を入れたときだけ登録する。
 *   理由が空（空白だけを含む）なら「登録」は押せない。
 * ⚠️ 理由は black_list.note（ヘッダーの「ブラックリスト編集」の備考）に入る（② の features/list/save.ts の runListBlack）。
 * ⚠️ 解除（タグを外す）のときは開かない（呼び出し側）。
 */

const MAX_REASON = 500;

type Props = {
    /** 登録しようとしているお客様の名前。null なら閉じている */
    name: string | null;
    onCancel: () => void;
    onSubmit: (reason: string) => void;
};

const BlackReasonModal: React.FC<Props> = ({ name, onCancel, onSubmit }) => {
    const [reason, setReason] = useState('');

    // 開くたびに空にする（前のお客様の理由を残さない）
    useEffect(() => { if (name !== null) setReason(''); }, [name]);

    const trimmed = reason.trim();
    const submit = () => { if (trimmed) onSubmit(trimmed); };

    return (
        <Modal show={name !== null} onHide={onCancel} size="sm" centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold' }}>ブラックリストに登録</Modal.Title>
            </Modal.Header>
            <Modal.Body className="py-2">
                <div style={{ fontSize: '12px', marginBottom: 6 }}>{name ? `${name} 様` : ''}</div>
                <label htmlFor="black-reason" style={{ fontSize: '11px', color: '#6c757d', display: 'block', marginBottom: 2 }}>
                    理由（必須）
                </label>
                <textarea
                    id="black-reason" className="form-control" rows={3} maxLength={MAX_REASON} autoFocus
                    style={{ fontSize: '12px' }} value={reason} placeholder="例）同業者の資料請求のため"
                    onChange={e => setReason(e.target.value)}
                />
                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: 4 }}>理由はブラックリストの備考に残ります。</div>
            </Modal.Body>
            <Modal.Footer className="py-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: '12px' }} onClick={onCancel}>キャンセル</button>
                <button type="button" className="btn btn-dark btn-sm" style={{ fontSize: '12px' }} disabled={!trimmed} onClick={submit}>登録</button>
            </Modal.Footer>
        </Modal>
    );
};

export default BlackReasonModal;
