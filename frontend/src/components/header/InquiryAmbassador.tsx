import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Badge, Button, Form } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';
import { useAmbassadorMaster } from './useAmbassadorMaster';
import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from './divisions';
import type { DivisionKey } from './divisions';

/**
 * アンバサダー経由の反響一覧。閲覧と同期処理を行う。
 *
 * ⚠️ バックエンドは **Express（② VPS）のみ**。PHPハンドラは存在しない。
 *   ② が落ちるとこの画面は動かない（① にフォールバック先が無い）。
 *
 * 反響の入り口:
 *   https://kh-house.jp/ambassador/?id=<ambassador_list.no> の公開フォームが
 *   ② へ直接 POST する（request: 'ambassador_inquiry' / 認証なし）。
 *   実装は backend-express/src/features/ambassador/inquiry.ts。
 *
 * ⚠️ 担当店舗・担当営業はフォームから受け取っていない（偽装できるため）。
 *   届いた時点では必ず未設定であり、社内で割り振る運用が前提。
 *
 * ⚠️ 同期は master_data（注文事業）へ顧客を作る**取り消せない操作**である。
 *   ・押す前に確認ダイアログを出す
 *   ・成功したら即座にボタンを消す（連打で二重に作らせない）
 *   ・サーバー側もトランザクションと sync = 1 の判定で二重実行を防いでいる
 */

type Inquiry = {
    no: number;
    /** 台帳と照合できたときだけ入る。集計・JOIN はこちらを使う */
    ambassador_no: number | null;
    /** 公開フォームのURL（?id=）から届いた生の値。⚠️ 改ざんされうるので信用しない */
    ambassador_id: string | null;
    name: string | null;
    kana: string | null;
    zip: string | null;
    address: string | null;
    /** ⚠️ address（現住所）とは別物。これから建てたい場所 */
    build_area: string | null;
    mobile: string | null;
    mail: string | null;
    /** 反響時点のアカウント */
    account: string | null;
    shop: string | null;
    staff: string | null;
    /**
     * 事業区分。'注文' / '建売' / '中古'。
     *
     * ⚠️ 同期先のテーブルがこれで変わる（master_data / _kaeru / _resale）。
     *   間違えると、作られたのに担当者の画面に出てこない顧客になる。
     */
    division: string | null;
    inquiry_date: string | null;
    sync: number;
    /** 進呈条件への同意。NULL は同意欄が無かった頃の古いデータ */
    agreed: number | null;
    /** 顧客宛サンクスメール。1=成功 0=失敗 NULL=未送信 */
    mail_sent: number | null;
    /** 社内宛通知メール。1=成功 0=失敗 NULL=未送信 */
    notify_sent: number | null;
    master_data_id: string | null;
    /** 台帳側の現在値（LEFT JOIN） */
    ambassador_name: string | null;
    ambassador_account: string | null;
    ambassador_shop: string | null;
};

type SyncFilter = 'all' | 'unsynced' | 'synced';

const dateLabel = (value: string | null): string => value ?? '—';

/**
 * メール送信結果の印。
 *
 * ⚠️ NULL と 0 を同じ見た目にしない。
 *     NULL … まだ送っていない（メール機能より前の反響）。対応不要
 *     0    … 送ろうとして失敗した ← こちらだけが対応の必要な状態
 *   同じにすると、古い反響に紛れて本当の失敗を見落とす。
 */
const mailMark = (label: string, value: number | null) => {
    if (value === null || value === undefined) {
        return <span className="text-muted" title={`${label}: 未送信`}>{label}—</span>;
    }
    return Number(value) === 1
        ? <span className="text-success" title={`${label}: 送信済み`}>{label}✓</span>
        : <span className="text-danger fw-bold" title={`${label}: 送信に失敗しました`}>{label}✕</span>;
};

/**
 * 紹介アンバサダーの表示名。台帳（ambassador_list）の現在値で `氏名 / アカウント` を作る。
 *
 * ⚠️ 反響側の `account` ではなく台帳側を使う。
 *   アカウント名は変更されるため、反響時点の値を出すと
 *   「今そのアカウントを探しても見つからない」状態になる。
 *
 * ⚠️ 片方しか無い場合に ' / ' だけが残らないようにする。
 */
const ambassadorLabel = (item: Inquiry): string =>
    [item.ambassador_name, item.ambassador_account]
        .map(v => (v ?? '').trim())
        .filter(v => v !== '')
        .join(' / ');

export const InquiryAmbassador = () => {
    const [list, setList] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [syncing, setSyncing] = useState<number | null>(null);
    /** 担当を保存中のセル。`${no}_${key}` */
    const [saving, setSaving] = useState('');

    // ⚠️ 店舗は show_flag = 1、担当営業は category = 1 かつ当年度。
    //   紹介キャンペーン反響一覧・台帳と同じマスタを共用している。
    //   詳細は useAmbassadorMaster.ts
    const { shopOptionsForDivision, staffOptionsFor, masterError } = useAmbassadorMaster();

    const [filter, setFilter] = useState<SyncFilter>('unsynced');
    const [shopFilter, setShopFilter] = useState('');
    const [keyword, setKeyword] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await apiClient.post('', { request: 'inquiry_ambassador' });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '反響一覧の取得に失敗しました。');
                return;
            }
            setList(res.data.inquiry ?? []);
        } catch (e: unknown) {
            // ⚠️ この機能は Express のみ。② が落ちていると必ずここに来る
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '反響情報を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    /**
     * 上部の絞り込みに出す店舗。
     *
     * ⚠️ マスタ（shopOptions）ではなく**実際に届いている反響の店舗**から作る。
     *   マスタから作ると、1件も反響が無い店舗まで並んで探しにくくなる。
     *   割り当て用の select（行ごと）とは目的が違う。
     */
    const filterShopOptions = useMemo(() => {
        const seen = new Set<string>();
        list.forEach(i => { if (i.shop) seen.add(i.shop); });
        return [...seen].sort();
    }, [list]);

    /** 全角・半角と空白の差を無視して比較する */
    const normalize = (value: string): string => value.replace(/[\s　]/g, '').toLowerCase();

    const filtered = useMemo(() => {
        const key = normalize(keyword);
        return list.filter(i => {
            if (filter === 'unsynced' && Number(i.sync) === 1) return false;
            if (filter === 'synced' && Number(i.sync) !== 1) return false;
            if (shopFilter !== '' && i.shop !== shopFilter) return false;
            if (key !== '') {
                const haystack = normalize(
                    [
                        i.name, i.kana, i.account, i.mobile, i.mail,
                        i.ambassador_name, i.ambassador_account, i.build_area,
                    ].filter(Boolean).join(' ')
                );
                if (!haystack.includes(key)) return false;
            }
            return true;
        });
    }, [list, filter, shopFilter, keyword]);

    const unsyncedCount = useMemo(
        () => list.filter(i => Number(i.sync) !== 1).length,
        [list]
    );

    /**
     * その行の担当営業の選択肢。
     *
     * ⚠️ 保存済みの担当者が候補に無いことがある（異動・退職・年度替わり）。
     *   そのまま出すと select の値が空になり、**次にその行を触った瞬間に
     *   担当が消えたように見える。** 保存済みの値は必ず候補へ補う。
     */
    const staffChoices = useCallback((shop: string | null, current: string | null): string[] => {
        const options = staffOptionsFor(shop);
        const saved = (current ?? '').trim();
        if (saved !== '' && !options.includes(saved)) return [saved, ...options];
        return options;
    }, [staffOptionsFor]);

    /**
     * 担当店舗・担当営業を保存する。
     *
     * ⚠️ 同期済みの行はサーバー側で拒否される。
     *   既に作られた顧客の担当は変わらないため、反響側だけ変えると食い違う。
     */
    const saveAssign = useCallback(async (no: number, key: 'shop' | 'staff' | 'division', value: string) => {
        setSaving(`${no}_${key}`);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'inquiry_ambassador',
                roll: 'update',
                no,
                [key]: value,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '保存に失敗しました。');
                return false;
            }
            setList(prev => prev.map(i => i.no === no ? { ...i, [key]: value } : i));
            return true;
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '保存に失敗しました。');
            return false;
        } finally {
            setSaving('');
        }
    }, []);

    /**
     * 担当店舗を変更する。
     *
     * ⚠️ 店舗を変えたら、その店舗に居ない担当営業は**必ず外す。**
     *   残すと「A店なのに担当はB店の人」という組み合わせのまま同期され、
     *   作られた顧客の担当がおかしくなる。画面上は正しく見えるため気づけない。
     */
    const changeShop = async (item: Inquiry, shop: string) => {
        const ok = await saveAssign(item.no, 'shop', shop);
        if (!ok) return;

        const saved = (item.staff ?? '').trim();
        if (saved !== '' && !staffOptionsFor(shop).includes(saved)) {
            await saveAssign(item.no, 'staff', '');
        }
    };

    /**
     * 事業区分を変更する。
     *
     * ⚠️ 区分を変えたら担当店舗と担当営業を**必ず外す。**
     *   店舗の選択肢は区分ごとに入れ替わる（注文事業／建売分譲事業／中古リノベ）。
     *   残すと「中古なのに担当は注文事業の店舗」という組み合わせで同期され、
     *   別のテーブルに、その事業には存在しない店舗名の顧客ができる。
     *   画面上は値が入っているように見えるため気づけない。
     */
    const changeDivision = async (item: Inquiry, division: string) => {
        const ok = await saveAssign(item.no, 'division', division);
        if (!ok) return;

        if ((item.shop ?? '') !== '') await saveAssign(item.no, 'shop', '');
        if ((item.staff ?? '') !== '') await saveAssign(item.no, 'staff', '');
    };

    /**
     * 反響を顧客として取り込む。
     *
     * ⚠️ 取り消せない操作。確認を必ず挟む。
     * ⚠️ 成功後は一覧を再取得しない。sync だけを手元で 1 にする。
     *   再取得すると絞り込み（既定は未同期のみ）から消えて、
     *   「押したのに何も起きていない」ように見える。
     */
    const handleSync = async (item: Inquiry) => {
        if ((item.shop ?? '') === '') {
            setError('担当店舗が未設定のため同期できません。先に店舗を設定してください。');
            return;
        }

        // ⚠️ 確認文に事業区分を必ず出す。取り込み先のテーブルが変わるため、
        //   区分を間違えたまま押されると別事業の顧客ができ、取り消せない
        const division = asDivision(item.division);
        const label = `${item.shop} ${item.name ?? ''}様`;
        if (!window.confirm(
            `${label} を【${division}事業】の顧客として取り込みますか？\n\n※この操作は取り消せません。`
        )) return;

        setSyncing(item.no);
        setError('');
        setNotice('');

        try {
            const res = await apiClient.post('', {
                request: 'inquiry_ambassador',
                roll: 'sync',
                no: item.no,
            });

            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '同期に失敗しました。');
                return;
            }

            setList(prev => prev.map(i =>
                i.no === item.no
                    ? { ...i, sync: 1, master_data_id: res.data.id ?? i.master_data_id }
                    : i
            ));
            setNotice(res.data.message ?? `${label} を取り込みました。`);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '同期に失敗しました。時間をおいて再度お試しください。');
        } finally {
            setSyncing(null);
        }
    };

    const filterButtons: { key: SyncFilter; label: string; count: number }[] = [
        { key: 'unsynced', label: '未同期', count: unsyncedCount },
        { key: 'synced', label: '同期済み', count: list.length - unsyncedCount },
        { key: 'all', label: 'すべて', count: list.length },
    ];

    return (
        <div className="py-2">
            <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                <span className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-brands fa-instagram me-2 text-danger" aria-hidden="true" />
                    アンバサダー反響一覧
                </span>

                {/* ⚠️ 未同期が残っていることが一目で分かるようにする。
                    取り込み漏れは追客漏れに直結する */}
                {unsyncedCount > 0 && (
                    <Badge bg="warning" text="dark" style={{ fontSize: '12px' }}>
                        未同期 {unsyncedCount} 件
                    </Badge>
                )}

                <Button size="sm" variant="outline-secondary" style={{ fontSize: '12px' }} onClick={() => void load()}>
                    <i className="fa-solid fa-rotate me-1" aria-hidden="true" />再読込
                </Button>
            </div>

            {/* 絞り込み */}
            <div className="d-flex align-items-end gap-2 flex-wrap px-3 py-2 mb-2 bg-light border rounded">
                <div className="btn-group btn-group-sm">
                    {filterButtons.map(b => (
                        <button
                            key={b.key}
                            type="button"
                            className={`btn ${filter === b.key ? 'btn-secondary' : 'btn-outline-secondary'}`}
                            style={{ fontSize: '12px' }}
                            onClick={() => setFilter(b.key)}
                        >
                            {b.label} <span className="ms-1">{b.count}</span>
                        </button>
                    ))}
                </div>

                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>担当店舗</Form.Label>
                    <Form.Select
                        size="sm"
                        value={shopFilter}
                        onChange={(e) => setShopFilter(e.target.value)}
                        style={{ width: '160px', fontSize: '12px' }}
                    >
                        <option value="">すべて</option>
                        {filterShopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </Form.Select>
                </div>

                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>検索</Form.Label>
                    <Form.Control
                        size="sm"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="氏名・アカウント・電話番号"
                        style={{ width: '220px', fontSize: '12px' }}
                    />
                </div>

                <span className="text-muted ms-auto" style={{ fontSize: '12px' }}>
                    該当 <strong className="text-primary">{filtered.length}</strong> 件
                </span>
            </div>

            {error !== '' && (
                <div className="alert alert-danger d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="btn-close flex-shrink-0" aria-label="閉じる" />
                </div>
            )}

            {/* ⚠️ マスタの取得失敗は反響の取得失敗とは別に出す。
                同じ枠に出すと「一覧は見えているのにエラーが出ている」理由が分からない */}
            {masterError !== '' && (
                <div className="alert alert-warning d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{masterError}（担当店舗・担当営業を割り当てられません）</span>
                </div>
            )}

            {notice !== '' && (
                <div className="alert alert-success d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-circle-check mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{notice}</span>
                    <button type="button" onClick={() => setNotice('')} className="btn-close flex-shrink-0" aria-label="閉じる" />
                </div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <div className="table-responsive border rounded" style={{ maxHeight: '65vh' }}>
                    <Table hover bordered className="mb-0 align-middle text-nowrap" style={{ fontSize: '12px', minWidth: '1800px' }}>
                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr>
                                <th className="bg-light text-center" style={{ width: '90px' }}>同期</th>
                                <th className="bg-light" style={{ width: '110px' }}>反響日</th>
                                <th className="bg-light" style={{ width: '150px' }}>氏名</th>
                                <th className="bg-light" style={{ width: '140px' }}>ふりがな</th>
                                <th className="bg-light" style={{ width: '130px' }}>電話番号</th>
                                <th className="bg-light" style={{ width: '190px' }}>メールアドレス</th>
                                <th className="bg-light" style={{ width: '260px' }}>住所</th>
                                {/* ⚠️ 住所とは別。担当店舗の割り振りはここを見て決める */}
                                <th className="bg-light" style={{ width: '160px' }}>建築希望地</th>
                                {/* ⚠️ 同期先のテーブルが変わる項目。店舗より先に選ぶ */}
                                <th className="bg-light" style={{ width: '90px' }}>事業区分</th>
                                <th className="bg-light" style={{ width: '170px' }}>担当店舗</th>
                                <th className="bg-light" style={{ width: '150px' }}>担当営業</th>
                                <th className="bg-light" style={{ width: '220px' }}>紹介アンバサダー</th>
                                <th className="bg-light text-center" style={{ width: '70px' }}>同意</th>
                                {/* ⚠️ 社内通知が飛んでいない反響は、誰も気づいていない可能性がある */}
                                <th className="bg-light text-center" style={{ width: '90px' }}>メール</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => {
                                const isSynced = Number(item.sync) === 1;
                                const noShop = (item.shop ?? '') === '';
                                const division: DivisionKey = asDivision(item.division);

                                return (
                                    <tr key={item.no} className={isSynced ? 'text-muted' : ''}>
                                        <td className="text-center">
                                            {isSynced ? (
                                                <Badge bg="primary" className="fw-normal" title={item.master_data_id ?? ''}>
                                                    同期済み
                                                </Badge>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant={noShop ? 'outline-secondary' : 'danger'}
                                                    style={{ fontSize: '11px' }}
                                                    disabled={syncing === item.no || noShop}
                                                    title={noShop ? '担当店舗が未設定のため同期できません' : '顧客として取り込む'}
                                                    onClick={() => void handleSync(item)}
                                                >
                                                    {syncing === item.no ? '処理中…' : '同期'}
                                                </Button>
                                            )}
                                        </td>

                                        <td>{dateLabel(item.inquiry_date)}</td>
                                        <td className="fw-bold text-dark">{item.name ?? ''}</td>
                                        <td>{item.kana ?? ''}</td>
                                        <td>{item.mobile ?? ''}</td>
                                        <td>{item.mail ?? ''}</td>
                                        <td style={{ whiteSpace: 'normal' }}>
                                            {item.zip ? <span className="text-muted me-1">{item.zip}</span> : null}
                                            {item.address ?? ''}
                                        </td>

                                        <td style={{ whiteSpace: 'normal' }}>{item.build_area ?? ''}</td>

                                        {/* ⚠️ 事業区分。同期先のテーブルがこれで決まる */}
                                        <td>
                                            {isSynced ? (
                                                division
                                            ) : (
                                                <Form.Select
                                                    size="sm"
                                                    value={division}
                                                    style={{ fontSize: '12px', padding: '2px 4px' }}
                                                    disabled={saving === `${item.no}_division`}
                                                    title="同期先の事業。変更すると担当店舗・担当営業は外れます"
                                                    onChange={(e) => void changeDivision(item, e.target.value)}
                                                >
                                                    {DIVISION_KEYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                </Form.Select>
                                            )}
                                        </td>

                                        {/* ⚠️ 同期後は変更できない。既に作られた顧客の担当は
                                            変わらないため、ここだけ変えると実態と食い違う */}
                                        <td>
                                            {isSynced ? (
                                                item.shop ?? ''
                                            ) : (
                                                <Form.Select
                                                    size="sm"
                                                    value={item.shop ?? ''}
                                                    className={noShop ? 'border-danger' : ''}
                                                    style={{ fontSize: '12px', padding: '2px 4px' }}
                                                    disabled={saving === `${item.no}_shop`}
                                                    onChange={(e) => void changeShop(item, e.target.value)}
                                                >
                                                    <option value="">未設定</option>
                                                    {/* ⚠️ 選択中の事業区分の店舗だけを出す。
                                                        全店舗を出すと別事業の店舗を割り当ててしまう */}
                                                    {shopOptionsForDivision(SHOP_DIVISION[division])
                                                        .map(s => <option key={s} value={s}>{s}</option>)}
                                                </Form.Select>
                                            )}
                                        </td>

                                        <td>
                                            {isSynced ? (
                                                item.staff ?? ''
                                            ) : (
                                                <Form.Select
                                                    size="sm"
                                                    value={item.staff ?? ''}
                                                    style={{ fontSize: '12px', padding: '2px 4px' }}
                                                    // ⚠️ 店舗が未選択なら担当も選べない。
                                                    //   全店の担当者を出すと別店舗の営業を割り当ててしまう
                                                    disabled={noShop || saving === `${item.no}_staff`}
                                                    title={noShop ? '先に担当店舗を選んでください' : ''}
                                                    onChange={(e) => void saveAssign(item.no, 'staff', e.target.value)}
                                                >
                                                    <option value="">未設定</option>
                                                    {staffChoices(item.shop, item.staff).map(n => <option key={n} value={n}>{n}</option>)}
                                                </Form.Select>
                                            )}
                                        </td>

                                        <td>
                                            {/* ⚠️ 台帳の現在値で「氏名 / アカウント」を出す。
                                                反響時点の account とは別物。アカウント名が
                                                変わっていても、誰の紹介かは台帳側で追える。

                                                ⚠️ 照合できなかった行は必ず警告を出すこと。
                                                URLからidが落ちた・台帳から削除された等が原因で、
                                                黙って空欄にすると成果がどのアンバサダーにも
                                                計上されないまま埋もれる */}
                                            {item.ambassador_no === null ? (
                                                <span
                                                    className="text-warning"
                                                    title={`台帳に未登録（受信したid: ${item.ambassador_id ?? 'なし'}）`}
                                                >
                                                    <i className="fa-solid fa-triangle-exclamation me-1" aria-hidden="true" />
                                                    {item.account ? `@${item.account}` : '不明'}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-dark">{ambassadorLabel(item)}</span>
                                                    <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                                                        (ID:{item.ambassador_no})
                                                    </span>
                                                </>
                                            )}
                                        </td>

                                        <td className="text-center">
                                            {/* ⚠️ 3万円分のギフトカードの進呈条件への同意。
                                                NULL は同意欄が無かった頃の古いデータで、
                                                「未同意」とは意味が違う */}
                                            {item.agreed === null || item.agreed === undefined
                                                ? <span className="text-muted">—</span>
                                                : Number(item.agreed) === 1
                                                    ? <i className="fa-solid fa-circle-check text-success" title="同意あり" aria-hidden="true" />
                                                    : <span className="text-danger" title="同意なし">なし</span>}
                                        </td>

                                        <td className="text-center">
                                            {/* ⚠️ 顧客宛（顧）と社内宛（社）を分けて出す。
                                                失敗したときの対応がまったく違う。
                                                  顧の失敗 … 顧客が受付を確認できていない
                                                  社の失敗 … 社内が反響に気づいていない ← より重い */}
                                            <span className="me-1">{mailMark('顧', item.mail_sent)}</span>
                                            <span>{mailMark('社', item.notify_sent)}</span>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="text-center text-muted py-5">
                                        該当する反響がありません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            <p className="text-muted mt-2 mb-0" style={{ fontSize: '11px' }}>
                <i className="fa-solid fa-circle-info me-1" aria-hidden="true" />
                反響は <code>https://kh-house.jp/ambassador/?id=&lt;アンバサダーID&gt;</code> のフォームから自動で届きます。
                担当店舗は建築希望地を見て設定してください（未設定の反響は同期できません）。
                <br />
                「同期」を押すと選択した<strong>事業区分</strong>の顧客として登録され、販促媒体は「公式アンバサダー」になります。
                ⚠️ 事業区分で登録先が変わります（注文／建売／中古）。この操作は取り消せません。
                <br />
                「メール」の 顧 は顧客宛のサンクスメール、社 は社内宛の通知です。
                ⚠️ <span className="text-danger fw-bold">社✕</span> の行は通知が届いていないため、他の担当者が気づいていない可能性があります。
            </p>
        </div>
    );
};
