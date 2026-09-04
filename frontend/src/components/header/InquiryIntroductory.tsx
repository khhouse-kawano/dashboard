import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Badge, Button, Form } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';
import { useAmbassadorMaster } from './useAmbassadorMaster';
import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from './divisions';
import type { DivisionKey } from './divisions';

/**
 * お友達紹介キャンペーンの反響一覧。閲覧と同期処理を行う。
 *
 * ─────────────────────────────────────────────
 * 反響の入り口は **① の PHP**、この画面は **② の Express**。
 *
 *   受付: 登録通知メール → GAS（Gmail監視）→ ① handlers/introductory.php
 *   閲覧・担当割り当て・同期: request 'inquiry_introductory'（② のみ）
 *
 * ⚠️ ② が落ちるとこの画面は動かない（① にフォールバック先が無い）。
 *   ただし**反響の受付は止まらない**（受付は ① にあるため）。
 *   復旧後にここから取り込める。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **顧客として登録されるのは「お友達」（紹介された人）である。**
 *   紹介者（registrantName）は既存のオーナー様・社員・業者様であり、
 *   顧客として作ってはいけない。紹介者は備考に残す。
 *
 * ⚠️ お友達の情報は氏名・かな・電話番号しか届かない。
 *   メールアドレス・住所は**紹介者のもの**なので顧客には入れない。
 *   入れるとお友達宛の連絡が紹介者に届く。
 *
 * ⚠️ 担当店舗・担当営業・事業区分はメールに含まれない。社内で割り振る運用。
 *
 * ⚠️ 同期は顧客テーブルへ INSERT する**取り消せない操作**である。
 *   ・押す前に確認ダイアログを出す
 *   ・成功したら即座にボタンを消す（連打で二重に作らせない）
 *   ・サーバー側もトランザクションと sync = 1 の判定で二重実行を防いでいる
 */

type Inquiry = {
    no: number;
    campaignName: string | null;
    /** owner / employee / partner。⚠️ 生の値。表示は referrerLabel を通す */
    referrerType: string | null;
    brand: string | null;
    /** 紹介者。⚠️ この人を顧客として作るのではない */
    registrantName: string | null;
    registrantKana: string | null;
    /** ⚠️ 紹介者のメールアドレス。お友達のものではない */
    mail: string | null;
    companyName: string | null;
    postalCode: string | null;
    /** ⚠️ 紹介者の住所 */
    area: string | null;
    tel: string | null;
    mobile: string | null;
    salesStaff: string | null;
    /** 紹介されたお友達。⚠️ 顧客になるのはこの人 */
    friendName: string | null;
    friendKana: string | null;
    friendTel: string | null;
    friendLineId: string | null;
    note: string | null;
    guideStaff: string | null;
    /** メールの受信日時。'YYYY-MM-DD HH:MM:SS' */
    registered: string | null;
    /** 事業区分。⚠️ 同期先のテーブルがこれで変わる */
    division: string | null;
    shop: string | null;
    staff: string | null;
    sync: number;
    master_data_id: string | null;
};

type SyncFilter = 'all' | 'unsynced' | 'synced';

/** ⚠️ 秒まで出すと横に長くなるだけなので日時までにする */
const dateLabel = (value: string | null): string => (value ?? '—').slice(0, 16);

/** 紹介者区分の表示名。GAS の introductoryReferrerTypeMap と対応する */
const REFERRER_LABELS: Record<string, string> = {
    owner: 'オーナー様',
    employee: '社員',
    partner: '業者様',
};

const referrerLabel = (value: string | null): string => {
    const key = (value ?? '').trim();
    return REFERRER_LABELS[key] ?? key;
};

/** 紹介者区分ごとの色。⚠️ 業者様は対応が違うため見分けられるようにする */
const referrerVariant = (value: string | null): string => {
    switch ((value ?? '').trim()) {
        case 'owner': return 'success';
        case 'employee': return 'primary';
        case 'partner': return 'warning';
        default: return 'secondary';
    }
};

const InquiryIntroductory = () => {
    const [list, setList] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [syncing, setSyncing] = useState<number | null>(null);
    /** 担当を保存中のセル。`${no}_${key}` */
    const [saving, setSaving] = useState('');

    // ⚠️ 店舗は show_flag = 1、担当営業は category = 1 かつ当年度。
    //   アンバサダー画面と同じマスタを共用している（request も同じ）。
    //   詳細は useAmbassadorMaster.ts
    const { shopOptionsForDivision, staffOptionsFor, masterError } = useAmbassadorMaster();

    const [filter, setFilter] = useState<SyncFilter>('unsynced');
    const [shopFilter, setShopFilter] = useState('');
    const [keyword, setKeyword] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await apiClient.post('', { request: 'inquiry_introductory' });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '反響一覧の取得に失敗しました。');
                return;
            }
            setList(res.data.inquiry ?? []);
        } catch (e: unknown) {
            // ⚠️ この画面は Express のみ。② が落ちていると必ずここに来る
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
     * ⚠️ マスタではなく**実際に届いている反響の店舗**から作る。
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
                        i.friendName, i.friendKana, i.friendTel, i.friendLineId,
                        i.registrantName, i.registrantKana, i.mail, i.campaignName,
                        i.salesStaff, i.guideStaff,
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
     * 担当店舗・担当営業・事業区分を保存する。
     *
     * ⚠️ 同期済みの行はサーバー側で拒否される。
     *   既に作られた顧客の担当は変わらないため、反響側だけ変えると食い違う。
     */
    const saveAssign = useCallback(async (
        no: number,
        key: 'shop' | 'staff' | 'division',
        value: string
    ) => {
        setSaving(`${no}_${key}`);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'inquiry_introductory',
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
     */
    const changeDivision = async (item: Inquiry, division: string) => {
        const ok = await saveAssign(item.no, 'division', division);
        if (!ok) return;

        if ((item.shop ?? '') !== '') await saveAssign(item.no, 'shop', '');
        if ((item.staff ?? '') !== '') await saveAssign(item.no, 'staff', '');
    };

    /**
     * お友達を顧客として取り込む。
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

        // ⚠️ 確認文には**お友達の名前と事業区分**を出す。紹介者の名前を出すと
        //   誰が顧客になるのかを取り違えたまま押されてしまう
        const division = asDivision(item.division);
        const label = `${item.shop} ${item.friendName ?? ''}様`;
        if (!window.confirm(
            `${label} を【${division}事業】の顧客として取り込みますか？\n\n`
            + `紹介者: ${item.registrantName ?? '（不明）'}\n\n`
            + '※この操作は取り消せません。'
        )) return;

        setSyncing(item.no);
        setError('');
        setNotice('');

        try {
            const res = await apiClient.post('', {
                request: 'inquiry_introductory',
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
                    <i className="fa-solid fa-user-group me-2 text-primary" aria-hidden="true" />
                    紹介キャンペーン反響一覧
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
                        placeholder="お友達・紹介者・電話番号"
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
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <div className="table-responsive border rounded" style={{ maxHeight: '65vh' }}>
                    <Table hover bordered className="mb-0 align-middle text-nowrap" style={{ fontSize: '12px', minWidth: '2000px' }}>
                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr>
                                <th className="bg-light text-center" style={{ width: '90px' }}>同期</th>
                                <th className="bg-light" style={{ width: '120px' }}>受付日時</th>
                                {/* ⚠️ 顧客になるのはお友達。紹介者と並べる順序を入れ替えないこと */}
                                <th className="bg-light" style={{ width: '150px' }}>お友達（顧客）</th>
                                <th className="bg-light" style={{ width: '140px' }}>お友達ふりがな</th>
                                <th className="bg-light" style={{ width: '130px' }}>お友達電話</th>
                                <th className="bg-light" style={{ width: '130px' }}>お友達LINE ID</th>
                                <th className="bg-light" style={{ width: '90px' }}>紹介者区分</th>
                                <th className="bg-light" style={{ width: '150px' }}>紹介者</th>
                                <th className="bg-light" style={{ width: '190px' }}>紹介者メール</th>
                                <th className="bg-light" style={{ width: '120px' }}>希望営業</th>
                                {/* ⚠️ 同期先のテーブルが変わる項目。店舗より先に選ぶ */}
                                <th className="bg-light" style={{ width: '90px' }}>事業区分</th>
                                <th className="bg-light" style={{ width: '170px' }}>担当店舗</th>
                                <th className="bg-light" style={{ width: '150px' }}>担当営業</th>
                                <th className="bg-light" style={{ width: '260px' }}>ご希望内容</th>
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
                                                    variant={noShop ? 'outline-secondary' : 'primary'}
                                                    style={{ fontSize: '11px' }}
                                                    disabled={syncing === item.no || noShop}
                                                    title={noShop ? '担当店舗が未設定のため同期できません' : 'お友達を顧客として取り込む'}
                                                    onClick={() => void handleSync(item)}
                                                >
                                                    {syncing === item.no ? '処理中…' : '同期'}
                                                </Button>
                                            )}
                                        </td>

                                        <td>{dateLabel(item.registered)}</td>

                                        <td className="fw-bold text-dark">{item.friendName ?? ''}</td>
                                        <td>{item.friendKana ?? ''}</td>
                                        <td>{item.friendTel ?? ''}</td>
                                        <td>{item.friendLineId ?? ''}</td>

                                        <td>
                                            {/* ⚠️ 業者様経由は謝礼の扱いが違うため見分けられるようにする */}
                                            <Badge bg={referrerVariant(item.referrerType)} className="fw-normal">
                                                {referrerLabel(item.referrerType) || '不明'}
                                            </Badge>
                                        </td>

                                        <td>
                                            {/* ⚠️ 紹介者は顧客として作られない。備考に残るだけ */}
                                            <span className="text-dark">{item.registrantName ?? ''}</span>
                                            {item.companyName ? (
                                                <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                                                    ({item.companyName})
                                                </span>
                                            ) : null}
                                        </td>

                                        <td>{item.mail ?? ''}</td>

                                        <td>
                                            {/* ⚠️ 紹介者がメールで希望した営業。担当営業の初期値には使わない
                                                （在籍・店舗の確認をせずに割り当てると実在しない担当になる） */}
                                            {item.salesStaff ?? ''}
                                        </td>

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

                                        <td style={{ whiteSpace: 'normal' }}>{item.note ?? ''}</td>
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
                反響はお友達紹介キャンペーンの登録通知メールから自動で届きます（同じメールが複数通届きますが、重複は自動で除かれます）。
                <br />
                ⚠️ 「同期」で顧客として登録されるのは<strong>お友達（紹介された人）</strong>です。紹介者は備考に残ります。
                お友達の情報は氏名・ふりがな・電話番号のみで、<strong>メールアドレスと住所は紹介者のもの</strong>なので顧客には入れません。
                <br />
                販促媒体は「紹介」になります。事業区分で登録先が変わります（注文／建売／中古）。
                ⚠️ この操作は取り消せません。
            </p>
        </div>
    );
};

export default InquiryIntroductory;
