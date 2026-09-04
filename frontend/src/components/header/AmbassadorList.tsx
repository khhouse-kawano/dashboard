import React, { useCallback, useEffect, useState } from 'react';
import { Table, Badge, Button, Form, Modal } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';
import { ambassadorLpUrl, copyToClipboard, instagramUrl } from './ambassadorLinks';
import { useAmbassadorMaster } from './useAmbassadorMaster';

/**
 * Instagram 公式アンバサダーの台帳。編集と新規登録を行う。
 *
 * ⚠️ バックエンドは **Express（② VPS）のみ**。PHPハンドラは存在しない。
 *   ② が落ちるとこの画面は動かない（① にフォールバック先が無い）。
 *   エラー時に「準備中」ではなく原因が分かる文言を出すこと。
 *
 * ⚠️ `inquiry`（反響数）はサーバー側で集計した値。列としては保存していない。
 *   ここで編集できる項目ではない。
 */

/** 備考のメモ1件。remarks に JSON 配列で入っている */
type Remark = { date: string; note: string };

type Ambassador = {
    no: number;
    name: string | null;
    kana: string | null;
    address: string | null;
    mobile: string | null;
    mail: string | null;
    account: string | null;
    shop: string | null;
    staff: string | null;
    remarks: string | null;
    registered_at: string | null;
    /** サーバー側で集計した反響数 */
    inquiry: number;
    /** うち未同期 */
    inquiry_unsynced: number;
};

/** 編集できる列。⚠️ サーバー側のホワイトリストと一致させること */
type EditableKey = 'name' | 'kana' | 'address' | 'mobile' | 'mail' | 'account' | 'shop' | 'staff' | 'registered_at';

const EMPTY_NEW: Record<EditableKey, string> = {
    name: '', kana: '', address: '', mobile: '', mail: '',
    account: '', shop: '', staff: '', registered_at: '',
};

const COLUMNS: { key: EditableKey; label: string; width: string; type?: string }[] = [
    { key: 'name', label: '氏名', width: '140px' },
    { key: 'kana', label: 'ふりがな', width: '140px' },
    { key: 'account', label: 'アカウント', width: '150px' },
    { key: 'mobile', label: '電話番号', width: '130px' },
    { key: 'mail', label: 'メールアドレス', width: '200px' },
    { key: 'address', label: '住所', width: '240px' },
    { key: 'registered_at', label: '登録日', width: '130px', type: 'date' },
];

/** JSON文字列をメモ配列にする。壊れていても画面は止めない */
const parseRemarks = (value: string | null): Remark[] => {
    if (!value || value.trim() === '') return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as Remark[]) : [];
    } catch {
        console.error('アンバサダー: 備考のJSON解析に失敗しました', value);
        return [];
    }
};

const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AmbassadorList = () => {
    const [list, setList] = useState<Ambassador[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<string>('');
    /** コピーした直後の行。ボタンの表示を一時的に変えるだけに使う */
    const [copiedNo, setCopiedNo] = useState<number | null>(null);

    // ⚠️ 店舗は report_flag = 1、担当営業は category = 1 かつ当年度。
    //   既存の shop_list（show_flag = 1）とは対象が違う。詳細は useAmbassadorMaster.ts
    const { shopOptions, staffOptionsFor, masterError } = useAmbassadorMaster();

    const [showNew, setShowNew] = useState(false);
    const [newData, setNewData] = useState<Record<EditableKey, string>>({ ...EMPTY_NEW, registered_at: today() });

    /** 備考モーダルで開いているアンバサダー */
    const [remarkTarget, setRemarkTarget] = useState<Ambassador | null>(null);
    const [remarkNote, setRemarkNote] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await apiClient.post('', { request: 'ambassador_list' });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '一覧の取得に失敗しました。');
                return;
            }
            setList(res.data.ambassador ?? []);
        } catch (e: unknown) {
            // ⚠️ この機能は Express のみ。② が落ちていると必ずここに来る。
            //   「準備中」ではなく原因が分かる文言にする
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? 'アンバサダー情報を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    /**
     * その行の担当営業の選択肢。
     *
     * ⚠️ 保存済みの担当者が候補に無いことがある（異動・退職・年度替わり）。
     *   そのまま出すと select の値が空になり、**次にその行の何かを触った瞬間に
     *   担当が消えたように見える。** 保存済みの値は必ず候補へ補う。
     */
    const staffChoices = useCallback((shop: string | null, current: string | null): string[] => {
        const options = staffOptionsFor(shop);
        const saved = (current ?? '').trim();
        if (saved !== '' && !options.includes(saved)) return [saved, ...options];
        return options;
    }, [staffOptionsFor]);

    /**
     * 担当店舗を変更する。
     *
     * ⚠️ 店舗を変えたら、その店舗に居ない担当営業は**必ず外す。**
     *   残すと「A店なのに担当はB店の人」という組み合わせが保存され、
     *   同期後の顧客の担当がおかしくなる。画面上は正しく見えるため気づけない。
     */
    const changeShop = async (item: Ambassador, shop: string) => {
        const ok = await saveCell(item.no, 'shop', shop);
        if (!ok) return;

        const saved = (item.staff ?? '').trim();
        if (saved !== '' && !staffOptionsFor(shop).includes(saved)) {
            await saveCell(item.no, 'staff', '');
        }
    };

    /** 専用LPのURLをコピーする */
    const copyLp = async (no: number) => {
        const ok = await copyToClipboard(ambassadorLpUrl(no));
        if (!ok) {
            setError('URLをコピーできませんでした。お手数ですが手入力でお願いします。');
            return;
        }
        setCopiedNo(no);
        window.setTimeout(() => setCopiedNo(prev => (prev === no ? null : prev)), 2000);
    };

    /**
     * 1セル分を保存する。
     *
     * ⚠️ 送るのは変更した列だけ。全列を送ると、他のセルの入力が
     *   サーバー側で NULL に潰される（サーバーは送られた列だけ更新する）。
     */
    const saveCell = async (no: number, key: EditableKey | 'remarks', value: string) => {
        const cellId = `${no}_${key}`;
        setSaving(cellId);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'ambassador_list',
                roll: 'update',
                no,
                [key]: value,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '保存に失敗しました。');
                return false;
            }
            setList(prev => prev.map(a => a.no === no ? { ...a, [key]: value } : a));
            return true;
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '保存に失敗しました。');
            return false;
        } finally {
            setSaving('');
        }
    };

    const addNew = async () => {
        if (newData.name.trim() === '') {
            setError('氏名を入力してください。');
            return;
        }
        setSaving('new');
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'ambassador_list',
                roll: 'insert',
                ...newData,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '登録に失敗しました。');
                return;
            }
            setShowNew(false);
            setNewData({ ...EMPTY_NEW, registered_at: today() });
            // ⚠️ 採番された no を使うため、一覧を再取得する。
            //   手元で組み立てると no がずれ、直後の編集が別レコードを更新する
            await load();
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '登録に失敗しました。');
        } finally {
            setSaving('');
        }
    };

    /** 備考にメモを1件追加する */
    const addRemark = async () => {
        if (remarkTarget === null || remarkNote.trim() === '') return;

        const current = parseRemarks(remarkTarget.remarks);
        // 新しいものを先頭に積む。画面でも新しい順に見せる
        const next: Remark[] = [{ date: today(), note: remarkNote.trim() }, ...current];

        const ok = await saveCell(remarkTarget.no, 'remarks', JSON.stringify(next));
        if (ok) {
            setRemarkNote('');
            setRemarkTarget(prev => prev === null ? null : { ...prev, remarks: JSON.stringify(next) });
        }
    };

    const cellStyle: React.CSSProperties = { fontSize: '12px', padding: '2px 4px' };

    return (
        <div className="py-2">
            <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                <span className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-brands fa-instagram me-2 text-danger" aria-hidden="true" />
                    公式アンバサダー台帳
                </span>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                    全{list.length}名
                </span>
                <Button
                    size="sm"
                    variant="danger"
                    style={{ fontSize: '12px' }}
                    onClick={() => setShowNew(true)}
                >
                    <i className="fa-solid fa-plus me-1" aria-hidden="true" />新規登録
                </Button>
                <Button
                    size="sm"
                    variant="outline-secondary"
                    style={{ fontSize: '12px' }}
                    onClick={() => void load()}
                >
                    <i className="fa-solid fa-rotate me-1" aria-hidden="true" />再読込
                </Button>
            </div>

            {error !== '' && (
                <div className="alert alert-danger d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="btn-close flex-shrink-0" aria-label="閉じる" />
                </div>
            )}

            {/* ⚠️ マスタの取得失敗は台帳の取得失敗とは別に出す。
                同じ枠に出すと「一覧は見えているのにエラーが出ている」理由が分からない */}
            {masterError !== '' && (
                <div className="alert alert-warning d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{masterError}（担当店舗・担当営業を選べません）</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <div className="table-responsive border rounded" style={{ maxHeight: '70vh' }}>
                    <Table hover bordered className="mb-0 align-middle text-nowrap" style={{ fontSize: '12px', minWidth: '1800px' }}>
                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr>
                                <th className="bg-light text-center" style={{ width: '60px' }}>No</th>
                                {COLUMNS.map(c => (
                                    <th key={c.key} className="bg-light" style={{ width: c.width }}>{c.label}</th>
                                ))}
                                <th className="bg-light" style={{ width: '150px' }}>担当店舗</th>
                                <th className="bg-light" style={{ width: '130px' }}>担当営業</th>
                                <th className="bg-light text-center" style={{ width: '90px' }}>反響数</th>
                                <th className="bg-light text-center" style={{ width: '70px' }}>Insta</th>
                                {/* ⚠️ アンバサダーごとに異なるURL。取り違えると成果が別人に付く */}
                                <th className="bg-light text-center" style={{ width: '110px' }}>専用LP</th>
                                <th className="bg-light text-center" style={{ width: '80px' }}>備考</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map(item => (
                                <tr key={item.no}>
                                    <td className="text-center text-muted">{item.no}</td>

                                    {COLUMNS.map(c => (
                                        <td key={c.key}>
                                            {/* ⚠️ onBlur で保存する。onChange ごとに送ると
                                                1文字ごとにリクエストが飛ぶ */}
                                            <Form.Control
                                                size="sm"
                                                type={c.type ?? 'text'}
                                                defaultValue={item[c.key] ?? ''}
                                                style={cellStyle}
                                                disabled={saving === `${item.no}_${c.key}`}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value === (item[c.key] ?? '')) return;
                                                    void saveCell(item.no, c.key, value);
                                                }}
                                            />
                                        </td>
                                    ))}

                                    <td>
                                        <Form.Select
                                            size="sm"
                                            value={item.shop ?? ''}
                                            style={cellStyle}
                                            onChange={(e) => void changeShop(item, e.target.value)}
                                        >
                                            <option value="">未設定</option>
                                            {shopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </Form.Select>
                                    </td>

                                    <td>
                                        <Form.Select
                                            size="sm"
                                            value={item.staff ?? ''}
                                            style={cellStyle}
                                            // ⚠️ 店舗が未選択なら担当も選べない。
                                            //   全店の担当者を出すと、別店舗の営業を割り当ててしまう
                                            disabled={(item.shop ?? '') === ''}
                                            title={(item.shop ?? '') === '' ? '先に担当店舗を選んでください' : ''}
                                            onChange={(e) => void saveCell(item.no, 'staff', e.target.value)}
                                        >
                                            <option value="">未設定</option>
                                            {staffChoices(item.shop, item.staff).map(n => <option key={n} value={n}>{n}</option>)}
                                        </Form.Select>
                                    </td>

                                    {/* ⚠️ 反響数はサーバー側の集計値。編集できない */}
                                    <td className="text-center">
                                        <span className="fw-bold">{item.inquiry}</span>
                                        {item.inquiry_unsynced > 0 && (
                                            <Badge bg="warning" text="dark" className="ms-1 fw-normal" title="未同期">
                                                {item.inquiry_unsynced}
                                            </Badge>
                                        )}
                                    </td>

                                    {/* Instagram のプロフィールへ */}
                                    <td className="text-center">
                                        {instagramUrl(item.account) === null ? (
                                            <span
                                                className="text-muted"
                                                title={(item.account ?? '').trim() === ''
                                                    ? 'アカウント未登録'
                                                    : 'アカウント名にInstagramで使えない文字が含まれています'}
                                            >—</span>
                                        ) : (
                                            <a
                                                href={instagramUrl(item.account) ?? '#'}
                                                target="_blank"
                                                // ⚠️ noopener が無いと、開いた先から window.opener 経由で
                                                //   このページを操作されうる（タブナビング）
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline-danger"
                                                style={{ fontSize: '11px' }}
                                                title={`@${(item.account ?? '').replace(/^@+/, '')} を開く`}
                                            >
                                                <i className="fa-brands fa-instagram" aria-hidden="true" />
                                            </a>
                                        )}
                                    </td>

                                    {/* アンバサダー専用LPのURLをコピー */}
                                    <td className="text-center">
                                        <Button
                                            size="sm"
                                            variant={copiedNo === item.no ? 'success' : 'outline-secondary'}
                                            style={{ fontSize: '11px' }}
                                            title={ambassadorLpUrl(item.no)}
                                            onClick={() => void copyLp(item.no)}
                                        >
                                            {copiedNo === item.no ? (
                                                <><i className="fa-solid fa-check me-1" aria-hidden="true" />コピー済</>
                                            ) : (
                                                <><i className="fa-regular fa-copy me-1" aria-hidden="true" />URL</>
                                            )}
                                        </Button>
                                    </td>

                                    <td className="text-center">
                                        <Button
                                            size="sm"
                                            variant={parseRemarks(item.remarks).length > 0 ? 'outline-primary' : 'outline-secondary'}
                                            style={{ fontSize: '11px' }}
                                            onClick={() => { setRemarkTarget(item); setRemarkNote(''); }}
                                        >
                                            <i className="fa-regular fa-note-sticky me-1" aria-hidden="true" />
                                            {parseRemarks(item.remarks).length}
                                        </Button>
                                    </td>
                                </tr>
                            ))}

                            {list.length === 0 && (
                                <tr>
                                    <td colSpan={COLUMNS.length + 7} className="text-center text-muted py-5">
                                        登録されているアンバサダーがいません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            <p className="text-muted mt-2 mb-0" style={{ fontSize: '11px' }}>
                <i className="fa-solid fa-circle-info me-1" aria-hidden="true" />
                各項目は入力欄からフォーカスを外した時点で保存されます。反響数は自動集計のため編集できません。
                <br />
                「専用LP」のURLはアンバサダーごとに異なります。⚠️ 取り違えて配布すると、その紹介の成果が別のアンバサダーに計上されます。
            </p>

            {/* 新規登録 */}
            <Modal show={showNew} onHide={() => setShowNew(false)} centered>
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>アンバサダーの新規登録</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {COLUMNS.map(c => (
                        <Form.Group className="mb-2" key={c.key}>
                            <Form.Label className="text-muted mb-1" style={{ fontSize: '12px' }}>
                                {c.label}
                                {c.key === 'name' && <Badge bg="danger" className="ms-1" style={{ fontSize: '9px' }}>必須</Badge>}
                            </Form.Label>
                            <Form.Control
                                size="sm"
                                type={c.type ?? 'text'}
                                value={newData[c.key]}
                                onChange={(e) => setNewData(prev => ({ ...prev, [c.key]: e.target.value }))}
                                style={{ fontSize: '13px' }}
                            />
                        </Form.Group>
                    ))}

                    <Form.Group className="mb-2">
                        <Form.Label className="text-muted mb-1" style={{ fontSize: '12px' }}>担当店舗</Form.Label>
                        <Form.Select
                            size="sm"
                            value={newData.shop}
                            // ⚠️ 店舗を変えたら担当営業も外す。別店舗の営業が残ると
                            //   その組み合わせのまま登録されてしまう
                            onChange={(e) => setNewData(prev => ({ ...prev, shop: e.target.value, staff: '' }))}
                            style={{ fontSize: '13px' }}
                        >
                            <option value="">未設定</option>
                            {shopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-2">
                        <Form.Label className="text-muted mb-1" style={{ fontSize: '12px' }}>担当営業</Form.Label>
                        <Form.Select
                            size="sm"
                            value={newData.staff}
                            disabled={newData.shop === ''}
                            onChange={(e) => setNewData(prev => ({ ...prev, staff: e.target.value }))}
                            style={{ fontSize: '13px' }}
                        >
                            <option value="">{newData.shop === '' ? '先に担当店舗を選んでください' : '未設定'}</option>
                            {staffOptionsFor(newData.shop).map(n => <option key={n} value={n}>{n}</option>)}
                        </Form.Select>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button size="sm" variant="outline-secondary" onClick={() => setShowNew(false)}>キャンセル</Button>
                    <Button size="sm" variant="danger" onClick={() => void addNew()} disabled={saving === 'new'}>
                        {saving === 'new' ? '登録中…' : '登録する'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* 備考（メモ履歴） */}
            <Modal show={remarkTarget !== null} onHide={() => setRemarkTarget(null)} centered size="lg">
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                        備考 — {remarkTarget?.name ?? ''}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="d-flex gap-2 mb-3">
                        <Form.Control
                            as="textarea"
                            rows={2}
                            value={remarkNote}
                            onChange={(e) => setRemarkNote(e.target.value)}
                            placeholder="メモを入力（日付は自動で付きます）"
                            style={{ fontSize: '13px' }}
                        />
                        <Button
                            variant="danger"
                            style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                            onClick={() => void addRemark()}
                            disabled={remarkNote.trim() === ''}
                        >
                            追加
                        </Button>
                    </div>

                    {/* ⚠️ 既存のメモは編集・削除できない。履歴として残す方針。
                        消せるようにすると経緯が追えなくなる */}
                    {parseRemarks(remarkTarget?.remarks ?? null).length === 0 ? (
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>メモはまだありません。</p>
                    ) : (
                        parseRemarks(remarkTarget?.remarks ?? null).map((r, i) => (
                            <div key={`${r.date}_${i}`} className="border-start border-3 border-danger ps-3 py-1 mb-2">
                                <div className="text-muted" style={{ fontSize: '11px' }}>{r.date}</div>
                                <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{r.note}</div>
                            </div>
                        ))
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default AmbassadorList;
