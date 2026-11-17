import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

/**
 * 重複の札とモーダル（v2.2.276 新規。反響一覧の注文・建売・中古で共通。ListOrder / ListKaeru / ListResale）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 重複 … 注文・建売・中古の反響をまたいで、メールアドレスか携帯番号が同じ反響（氏名は使わない）。
 * ⚠️ 件数は一覧の応答の dup_count（② の features/inquiryDup が作る表）。⚠️ 画面では判定しない。
 * ⚠️ 相手の中身は札を押したときに inquiryDup（② だけ）で取る。⚠️ 相手のメール・電話番号の値は受け取らない（一致した種類だけ）。
 * ─────────────────────────────────────────────
 */

type DupBrand = 'order' | 'spec' | 'used';

interface DupItem {
    brand: DupBrand;
    id: number;
    inquiry_id: string;
    inquiry_date: string;
    medium: string;
    response_medium: string;
    shop: string;
    category: string | null;
    staff: string;
    sync: number;
    name: string;
    by_mail: boolean;
    by_mobile: boolean;
}

const BRAND_LABEL: Record<DupBrand, string> = { order: '注文', spec: '建売', used: '中古' };

interface Props {
    /** 開いている画面の事業（この反響がある表） */
    brand: DupBrand;
    /** 反響の表の id */
    id: number;
    /** 重複の件数（dup_count）。⚠️ 0 なら何も出さない */
    count: number;
    /** モーダルの見出しに出す氏名 */
    name: string;
}

const DuplicateBadge: React.FC<Props> = ({ brand, id, count, name }) => {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<DupItem[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setItems(null);
        setError('');
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'inquiryDup', category: brand, id });
                if (cancelled) return;
                if (response.data?.status === 'success' && Array.isArray(response.data.items)) setItems(response.data.items as DupItem[]);
                else setError('重複している反響を読み込めませんでした。');
            } catch (e) {
                console.error('inquiryDup failed:', e);
                if (!cancelled) setError('重複している反響を読み込めませんでした。時間をおいて開き直してください。');
            }
        })();
        return () => { cancelled = true; };
    }, [open, brand, id]);

    if (!(count > 0)) return null;

    const perBrand = (items ?? []).reduce<Record<DupBrand, number>>((acc, item) => {
        acc[item.brand] += 1;
        return acc;
    }, { order: 0, spec: 0, used: 0 });

    return (
        <>
            <style>{CSS}</style>
            <button type="button" className="dupb_badge" onClick={() => setOpen(true)} title="重複している反響を見る">
                <i className="fa-solid fa-user-group" aria-hidden="true" />重複 {count}
            </button>
            <Modal show={open} onHide={() => setOpen(false)} size="lg" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>重複している反響{name ? `（${name}）` : ''}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="dupb_body">
                    <div className="dupb_note">注文・建売・中古の反響のうち、メールアドレスか携帯番号が同じものです（氏名は見ていません）。</div>
                    {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}
                    {items === null && error === '' && <div className="dupb_empty">読み込み中…</div>}
                    {items !== null && (
                        <>
                            <div className="dupb_cards">
                                <div className="dupb_card"><div className="dupb_label">合計</div><div className="dupb_value">{items.length}件</div></div>
                                {(Object.keys(BRAND_LABEL) as DupBrand[]).map((b) => (
                                    <div className="dupb_card" key={b}><div className="dupb_label">{BRAND_LABEL[b]}</div><div className="dupb_value">{perBrand[b]}件</div></div>
                                ))}
                            </div>
                            {items.length === 0 ? (
                                <div className="dupb_empty">いまは重複している反響がありません（個人情報削除などで外れた可能性があります）。</div>
                            ) : (
                                <div className="dupb_table_wrap">
                                    <table className="dupb_table">
                                        <thead>
                                            <tr><th>事業</th><th>店舗</th><th>反響日</th><th>媒体</th><th>氏名</th><th>一致</th><th>取込</th></tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => (
                                                <tr key={`${item.brand}-${item.id}`}>
                                                    <td><span className={`dupb_brand is_${item.brand}`}>{BRAND_LABEL[item.brand]}</span></td>
                                                    <td>{item.shop || item.category || ''}{item.staff ? <div className="dupb_sub">{item.staff}</div> : null}</td>
                                                    <td className="dupb_date">{item.inquiry_date}</td>
                                                    <td>{item.response_medium || item.medium || ''}</td>
                                                    <td>{item.name}</td>
                                                    <td className="dupb_match">
                                                        {item.by_mail && <span className="dupb_tag">メール</span>}
                                                        {item.by_mobile && <span className="dupb_tag">携帯</span>}
                                                    </td>
                                                    <td>{item.sync === 1 ? '取込済み' : '未取込'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>
        </>
    );
};

/** ⚠️ GoogleReview.tsx と同じ配色（接頭辞 dupb_） */
const CSS = `
.dupb_badge { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c;
              border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 700; cursor: pointer; line-height: 1.6; white-space: nowrap; }
.dupb_badge:hover { background: #fee2e2; }
.dupb_body { font-size: 13px; color: #1f2937; }
.dupb_note { font-size: 11px; color: #6b7280; margin-bottom: 10px; }
.dupb_cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.dupb_card { flex: 1 1 100px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; background: #fff; min-width: 0; }
.dupb_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.dupb_value { font-size: 15px; font-weight: 700; }
.dupb_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; max-height: 60vh; }
.dupb_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.dupb_table th { position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-size: 11px; color: #4b5563; white-space: nowrap; }
.dupb_table td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
.dupb_date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.dupb_sub { font-size: 11px; color: #6b7280; }
.dupb_brand { display: inline-block; border-radius: 999px; padding: 0 8px; font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; }
.dupb_brand.is_order { background: #2563eb; }
.dupb_brand.is_spec { background: #16a34a; }
.dupb_brand.is_used { background: #d97706; }
.dupb_match { white-space: nowrap; }
.dupb_tag { display: inline-block; border-radius: 6px; padding: 0 6px; margin-right: 4px; font-size: 11px; font-weight: 700; color: #1d4ed8; background: #eff6ff; }
.dupb_empty { color: #9ca3af; font-size: 12px; padding: 8px 0; }
`;

export default DuplicateBadge;
