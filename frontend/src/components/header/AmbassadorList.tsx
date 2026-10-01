import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Table, Badge, Button, Form, Modal } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import InformationEdit from '../information/InformationEdit';
import { ambassadorLpUrl, copyToClipboard, instagramUrl } from './ambassadorLinks';
import { useAmbassadorMaster } from './useAmbassadorMaster';
import { buildStages, rate } from './ambassadorKpi';
import type { KpiCustomer, KpiInquiry, KpiStage } from './ambassadorKpi';

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

    // ⚠️ 店舗は report_flag = 1。既存の shop_list（show_flag = 1）とは対象が違う。
    //   詳細は useAmbassadorMaster.ts
    //
    // ⚠️ 担当営業のマスタ（staffOptionsFor）はこの画面では使わない。
    //   台帳の担当営業は自由入力にする方針のため（staff_list に載らない人を
    //   書くことがある）。反響一覧側は選択式のままなので、フックは共通のまま。
    const { shopOptions, masterError } = useAmbassadorMaster();

    const [showNew, setShowNew] = useState(false);
    const [newData, setNewData] = useState<Record<EditableKey, string>>({ ...EMPTY_NEW, registered_at: today() });

    /** 備考モーダルで開いているアンバサダー */
    const [remarkTarget, setRemarkTarget] = useState<Ambassador | null>(null);
    const [remarkNote, setRemarkNote] = useState('');

    // -----------------------------------------------------------------
    // KPI（紹介した顧客の歩留まり）
    //
    // ⚠️⚠️ **台帳の取得とは別のリクエストにしてある。**
    //   ⚠️ 台帳は1セル保存のたびに引き直すため、同じ口にすると
    //     ⚠️ **保存のたびに顧客テーブル3つを舐めることになる。**
    //
    // ⚠️ ⚠️ **KPIの取得に失敗しても台帳は使えるようにする。**
    //   ⚠️ 編集が主目的の画面であり、集計が出ないだけで止めてはいけない。
    // -----------------------------------------------------------------
    const { token, authority } = useContext(AuthContext);

    const [kpiInquiry, setKpiInquiry] = useState<KpiInquiry[]>([]);
    const [kpiCustomer, setKpiCustomer] = useState<KpiCustomer[]>([]);
    const [kpiError, setKpiError] = useState('');

    /** 数字をクリックして開いた一覧。⚠️ 誰のどの段かを持つ */
    const [kpiTarget, setKpiTarget] = useState<{ ambassador: Ambassador; stage: KpiStage } | null>(null);
    /** モーダルのページ送り。⚠️ rank と同じく20件ずつ */
    const [kpiPage, setKpiPage] = useState(20);
    /** 顧客詳細（InformationEdit）で開いている顧客 */
    const [editId, setEditId] = useState('');

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

    const loadKpi = useCallback(async () => {
        setKpiError('');
        try {
            const res = await apiClient.post('', { request: 'ambassador_kpi' });
            if (res.data?.status !== 'ok') {
                setKpiError(res.data?.message ?? 'KPIの取得に失敗しました。');
                return;
            }
            setKpiInquiry(res.data.inquiry ?? []);
            setKpiCustomer(res.data.customer ?? []);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setKpiError(message ?? 'KPIを取得できませんでした。');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => { void loadKpi(); }, [loadKpi]);

    /**
     * アンバサダーごとのKPI。
     *
     * ⚠️⚠️ **`no` で引ける形にしておく。**
     *   ⚠️ 行の描画のたびに全件を filter すると、台帳が増えたときに
     *     ⚠️ **行数 × 顧客数**の総当たりになる。
     */
    const stagesByNo = useMemo(() => {
        const map = new Map<number, KpiStage[]>();
        list.forEach(a => {
            const total = kpiInquiry.filter(i => i.ambassador_no === a.no);
            const customers = kpiCustomer.filter(c => c.ambassador_no === a.no);
            map.set(a.no, buildStages(total, customers));
        });
        return map;
    }, [list, kpiInquiry, kpiCustomer]);

    /** 総反響の内訳（⚠️ **顧客ではなく反響そのもの**。未同期を含む） */
    const inquiriesOf = useCallback(
        (no: number) => kpiInquiry.filter(i => i.ambassador_no === no),
        [kpiInquiry]
    );

    const openKpi = (ambassador: Ambassador, stage: KpiStage) => {
        // ⚠️ 0件のときは開かない。空のモーダルが出ると壊れたように見える
        const count = stage.key === 'register' ? inquiriesOf(ambassador.no).length : stage.list.length;
        if (count === 0) return;
        setKpiPage(20);
        setKpiTarget({ ambassador, stage });
    };

    /**
     * 顧客詳細を閉じる。
     *
     * ⚠️⚠️ **閉じたらKPIを取り直す。** 詳細画面で来場日や契約日を直せるため、
     *   ⚠️ 取り直さないと**画面の数字だけが古いまま**になる。
     */
    const closeInformationEdit = async () => {
        setEditId('');
        await loadKpi();
    };

    /** 日付の表示。⚠️ rank と同じく `/` 区切りに揃える */
    const dateLabel = (value: string | null): string => (value ?? '').replace(/-/g, '/');

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
                    <span className="flex-grow-1">{masterError}（担当店舗を選べません）</span>
                </div>
            )}

            {/* ⚠️⚠️ **KPIが出なくても台帳は使える。** 別枠で出して、
                「台帳が壊れた」と誤解されないようにする */}
            {kpiError !== '' && (
                <div className="alert alert-warning d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{kpiError}（歩留まりの数字が出ません。台帳の編集はできます）</span>
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
                    <Table hover bordered className="mb-0 align-middle text-nowrap" style={{ fontSize: '12px', minWidth: '2190px' }}>
                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr>
                                <th className="bg-light text-center" style={{ width: '60px' }}>No</th>
                                {COLUMNS.map(c => (
                                    <th key={c.key} className="bg-light" style={{ width: c.width }}>{c.label}</th>
                                ))}
                                <th className="bg-light" style={{ width: '150px' }}>担当店舗</th>
                                <th className="bg-light" style={{ width: '130px' }}>担当営業</th>
                                <th className="bg-light text-center" style={{ width: '90px' }}>反響数</th>
                                {/* ⚠️ 歩留まり。⚠️⚠️ **判定は shopTrend と同じ**（ambassadorKpi.ts）。
                                    ⚠️ 期間では絞らない（全期間の通算） */}
                                <th className="bg-light text-center" style={{ width: '90px' }}>総反響</th>
                                <th className="bg-light text-center" style={{ width: '100px' }}>初回面談</th>
                                <th className="bg-light text-center" style={{ width: '100px' }}>次アポ</th>
                                <th className="bg-light text-center" style={{ width: '100px' }}>契約</th>
                                <th className="bg-light text-center" style={{ width: '70px' }}>Insta</th>
                                {/* ⚠️ アンバサダーごとに異なるURL。取り違えると成果が別人に付く */}
                                <th className="bg-light text-center" style={{ width: '130px' }}>専用LP</th>
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
                                            onChange={(e) => void saveCell(item.no, 'shop', e.target.value)}
                                        >
                                            <option value="">未設定</option>
                                            {shopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </Form.Select>
                                    </td>

                                    <td>
                                        {/* ⚠️ 担当営業は自由入力。マスタから選ばせない。
                                            アンバサダーの担当は staff_list に載らない人（役職者・
                                            退職済みの引き継ぎ元など）を書くことがあるため。
                                            表記ゆれは許容する方針。 */}
                                        <Form.Control
                                            size="sm"
                                            defaultValue={item.staff ?? ''}
                                            style={cellStyle}
                                            disabled={saving === `${item.no}_staff`}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === (item.staff ?? '')) return;
                                                void saveCell(item.no, 'staff', value);
                                            }}
                                        />
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

                                    {/*
                                      KPI（歩留まり）。
                                      ⚠️⚠️ **1以上のときだけ押せる。** 0件で開くと空のモーダルが出て
                                        壊れたように見える。
                                      ⚠️ 押せる数字だけ下線を付ける（⚠️ 見た目で区別できるようにする）。
                                      ⚠️ ⚠️ **総反響は顧客ではなく反響そのものを数える**（未同期を含む）。
                                    */}
                                    {(stagesByNo.get(item.no) ?? []).map(stage => {
                                        const count = stage.key === 'register'
                                            ? inquiriesOf(item.no).length
                                            : stage.list.length;
                                        const percent = rate(count, stage.denominator);
                                        const clickable = count > 0;

                                        return (
                                            <td key={stage.key} className="text-center">
                                                <span
                                                    className={clickable ? 'fw-bold text-primary' : 'text-muted'}
                                                    style={clickable
                                                        ? { textDecoration: 'underline dotted', cursor: 'pointer' }
                                                        : undefined}
                                                    title={clickable ? `${stage.label}の一覧を開く` : '該当者はいません'}
                                                    onClick={() => openKpi(item, stage)}
                                                >
                                                    {count}
                                                </span>
                                                {/* ⚠️ 分母が0のときは % を出さない。
                                                    ⚠️⚠️ **「まだ誰も来ていない」を 0% と書くと成績不振に見える** */}
                                                {percent !== null && (
                                                    <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                                                        {percent}%
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}

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

                                    {/* アンバサダー専用LP。コピーと、開いて確認する導線 */}
                                    <td className="text-center">
                                        <div className="btn-group btn-group-sm">
                                            <Button
                                                variant={copiedNo === item.no ? 'success' : 'outline-secondary'}
                                                style={{ fontSize: '11px' }}
                                                title={`URLをコピー: ${ambassadorLpUrl(item.no)}`}
                                                onClick={() => void copyLp(item.no)}
                                            >
                                                {copiedNo === item.no ? (
                                                    <><i className="fa-solid fa-check me-1" aria-hidden="true" />済</>
                                                ) : (
                                                    <><i className="fa-regular fa-copy me-1" aria-hidden="true" />URL</>
                                                )}
                                            </Button>

                                            {/* ⚠️ Button ではなく a にする。中クリックや右クリックからの
                                                「新しいタブで開く」が効かなくなるため */}
                                            <a
                                                href={ambassadorLpUrl(item.no)}
                                                target="_blank"
                                                // ⚠️ noopener が無いと、開いた先から window.opener 経由で
                                                //   このページを操作されうる（タブナビング）
                                                rel="noopener noreferrer"
                                                className="btn btn-outline-secondary"
                                                style={{ fontSize: '11px' }}
                                                title={`別タブで開く: ${ambassadorLpUrl(item.no)}`}
                                            >
                                                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                                <span className="visually-hidden">専用LPを別タブで開く</span>
                                            </a>
                                        </div>
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
                                    <td colSpan={COLUMNS.length + 11} className="text-center text-muted py-5">
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
                「専用LP」はアンバサダーごとに異なるURLです（<i className="fa-regular fa-copy" aria-hidden="true" /> コピー / <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> 別タブで開く）。
                ⚠️ 取り違えて配布すると、その紹介の成果が別のアンバサダーに計上されます。
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
                            onChange={(e) => setNewData(prev => ({ ...prev, shop: e.target.value }))}
                            style={{ fontSize: '13px' }}
                        >
                            <option value="">未設定</option>
                            {shopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-2">
                        <Form.Label className="text-muted mb-1" style={{ fontSize: '12px' }}>担当営業</Form.Label>
                        {/* ⚠️ 一覧側と同じく自由入力。選択式にしないこと */}
                        <Form.Control
                            size="sm"
                            value={newData.staff}
                            placeholder="担当者名を入力"
                            onChange={(e) => setNewData(prev => ({ ...prev, staff: e.target.value }))}
                            style={{ fontSize: '13px' }}
                        />
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

            {/*
              KPIの内訳。
              ⚠️⚠️ **rank（components/rank/RankOrder.tsx）と同じ作りに揃えてある。**
                ⚠️ 顧客名クリックで InformationEdit、20件ずつのページ送り。
              ⚠️ ⚠️ **ランクや見込み月の編集は置かない。** 台帳は成果を見る画面であり、
                ⚠️ ここで案件を触らせると、どこで直したのか分からなくなる。
            */}
            <Modal show={kpiTarget !== null} onHide={() => setKpiTarget(null)} size="xl">
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                        {kpiTarget?.ambassador.name ?? ''}
                        <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                            {kpiTarget?.stage.label}
                        </span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {kpiTarget === null ? null : kpiTarget.stage.key === 'register' ? (
                        // ⚠️⚠️ **総反響は顧客ではなく反響そのもの。**
                        //   ⚠️ 未同期の反響には顧客が存在せず、⚠️ **来場日も契約日も無い。**
                        //   ⚠️ ⚠️ **同じ表で出すと「全部空欄の行」に見える**ので表を分けている。
                        <>
                            <div className="text-muted mb-2" style={{ fontSize: '11px' }}>
                                ※未同期の反響を含みます。顧客として取り込むまで、来場日などは記録されません。
                            </div>
                            <Table bordered striped style={{ fontSize: '11px' }} className="align-middle">
                                <tbody>
                                    <tr>
                                        <td>No</td>
                                        <td>反響日</td>
                                        <td>お名前</td>
                                        <td>事業区分</td>
                                        <td>同期</td>
                                    </tr>
                                    {inquiriesOf(kpiTarget.ambassador.no)
                                        .slice(kpiPage - 20, kpiPage)
                                        .map((item, index) => (
                                            <tr key={item.inquiry_no}>
                                                <td>{kpiPage - 20 + index + 1}</td>
                                                <td>{dateLabel(item.inquiry_date)}</td>
                                                <td>
                                                    {Number(item.sync) === 1 && (item.master_data_id ?? '') !== '' ? (
                                                        <div
                                                            style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                                            onClick={() => setEditId(item.master_data_id ?? '')}
                                                        >
                                                            {item.name ?? ''}
                                                        </div>
                                                    ) : (
                                                        <span>{item.name ?? ''}</span>
                                                    )}
                                                </td>
                                                <td>{item.division ?? ''}</td>
                                                <td>
                                                    {Number(item.sync) === 1
                                                        ? <Badge bg="primary" className="fw-normal">同期済み</Badge>
                                                        : <Badge bg="warning" text="dark" className="fw-normal">未同期</Badge>}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </Table>
                        </>
                    ) : (
                        <Table bordered striped style={{ fontSize: '11px' }} className="align-middle">
                            <tbody>
                                <tr>
                                    <td>No</td>
                                    <td>事業区分</td>
                                    <td>店舗</td>
                                    <td>担当営業</td>
                                    <td>お客様名</td>
                                    <td>反響日</td>
                                    <td>初回来場日</td>
                                    <td>契約日</td>
                                    <td>状況</td>
                                </tr>
                                {kpiTarget.stage.list.slice(kpiPage - 20, kpiPage).map((item, index) => (
                                    <tr key={item.id}>
                                        <td>{kpiPage - 20 + index + 1}</td>
                                        <td>{item.division ?? ''}</td>
                                        <td>{item.shop}</td>
                                        <td>{item.staff}</td>
                                        <td>
                                            {/* ⚠️ rank と同じ見た目・同じ動き（顧客詳細を開く） */}
                                            <div
                                                style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                                onClick={() => setEditId(item.id)}
                                            >
                                                {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1" aria-hidden="true" />}
                                                {item.customer}
                                            </div>
                                        </td>
                                        <td>{dateLabel(item.register)}</td>
                                        <td>{dateLabel(item.interview)}</td>
                                        <td>{dateLabel(item.contract)}</td>
                                        <td>{item.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}

                    {/* ページ送り。⚠️ rank と同じく20件ずつ */}
                    {kpiTarget !== null && (() => {
                        const length = kpiTarget.stage.key === 'register'
                            ? inquiriesOf(kpiTarget.ambassador.no).length
                            : kpiTarget.stage.list.length;
                        return (
                            <div className="d-flex justify-content-around" style={{ fontSize: '12px' }}>
                                <div className="text-primary" style={{ cursor: 'pointer' }}
                                    onClick={() => setKpiPage(kpiPage - 20)}>
                                    {(length > 20 && kpiPage > 20) && '前の20件'}
                                </div>
                                <div className="text-primary" style={{ cursor: 'pointer' }}
                                    onClick={() => setKpiPage(kpiPage + 20)}>
                                    {(length > 20 && length > kpiPage) && '次の20件'}
                                </div>
                            </div>
                        );
                    })()}
                </Modal.Body>
            </Modal>

            {/* ⚠️ rank と同じ。⚠️⚠️ **閉じたときにKPIを取り直す**（日付が変わりうるため） */}
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </div>
    );
};

export default AmbassadorList;
