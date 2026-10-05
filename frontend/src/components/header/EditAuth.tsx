import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';

/**
 * ログイン権限（staff テーブル）の編集画面。
 *
 * ⚠️ 人事マスタ（staff_list テーブル）は EditStaff.tsx の担当であり、
 *   ここでは一切触らない。両テーブルは連携していないため、
 *   ここでアカウントを作っても人事マスタには登録されない。
 *   人事登録は EditStaff 側で別途行う。
 *
 * ログインは login.php がメールアドレスだけで本人を特定する仕組みのため、
 * メールアドレスの重複は登録できない（サーバー側で弾いている）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ 2026-10-05（v2.2.163）に作り替えた。
 *
 *   ⚠️ 氏名・権限・事業区分・メールアドレス・パスワードを**この画面で直せる**ようにした。
 *
 *   ⚠️⚠️ **文字の入力欄は非制御（defaultValue + ref）にしてある。**
 *     ⚠️ 制御コンポーネントにすると1文字打つたびに state が更新され、
 *       ⚠️ **200行を超える表全体が描き直されて入力がもたつく。**
 *     ⚠️ 保存はフォーカスが外れたとき（または Enter）に1回だけ行う。
 *
 *   ⚠️⚠️ **パスワードは表示しない。** ⚠️ サーバーも値を返さない（有無だけ）。
 *     ⚠️ 入力したときだけ ② がハッシュにして保存する。
 *
 *   ⚠️⚠️ **総アクセス時間は一覧と別に取る**（`header_auth_access_time`）。
 *     ⚠️ 計算にログ485万件を読むため、⚠️ **一覧を先に出して時間は後から埋める。**
 *
 *   ⚠️ 以前は一覧の取得で ⚠️⚠️ **全員の api_token と password が届いていた**
 *     （サーバー側の不具合。② と ① の両方で塞いだ）。
 * ─────────────────────────────────────────────
 */

/**
 * 権限（staff.brand）。⚠️ 表示名と保存値の対応は 2026-10-05 の指示書どおり。
 * ⚠️⚠️ **② の AUTH_BRANDS（features/staffAdmin.ts）と同じ並び・同じ値にすること。**
 *   ⚠️ ここだけ増やしても ② が「許可されていない権限です」で弾く。
 */
const BRAND_OPTIONS = [
    { value: 'Master', label: '開発者権限' },
    { value: 'BrandAdmin', label: 'マネージャー' },
    { value: 'ordinary', label: '一般' },
    { value: 'Consulting', label: 'コンサル' },
] as const;

/**
 * 事業区分（staff.shop）。⚠️ 店舗名ではない。
 *
 * ⚠️⚠️ **Category.tsx の入場判定がこの値を見ている。**
 *   ⚠️ 空だとどの事業区分にも入れない（2026-10-05 に実際に起きた）。
 * ⚠️ `all` は指示書には無かったが、⚠️ 全事業を見る人（Master / BrandAdmin の多く）が
 *   この値なので加えた（利用者と確認済み）。
 * ⚠️⚠️ **② の AUTH_SHOPS と同じ値にすること。**
 */
const SHOP_OPTIONS = [
    { value: 'order', label: '注文' },
    { value: 'spec', label: '建売' },
    { value: 'used', label: '中古' },
    { value: 'all', label: '全事業' },
] as const;

type Staff = {
    id: string;
    name: string;
    brand: string;
    shop: string;
    mail: string;
    heartbeat: string;
    /** ⚠️ パスワードが設定されているか。⚠️⚠️ **値そのものは届かない** */
    has_password: number;
};

type Field = 'name' | 'brand' | 'shop' | 'mail' | 'password';

const FIELD_LABEL: Record<Field, string> = {
    name: '氏名', brand: '権限', shop: '事業区分', mail: 'メールアドレス', password: 'パスワード',
};

/**
 * 権限の並び順。⚠️ 選択肢の順に並べ、⚠️⚠️ **選択肢に無い値の人は最後に出す。**
 *   ⚠️ 以前は Master / BrandAdmin / ordinary の3つだけを出しており、
 *   ⚠️ ⚠️ **それ以外の権限（insideSales・空など）の人は一覧から消えていた。**
 */
const brandOrder = (brand: string): number => {
    const index = BRAND_OPTIONS.findIndex(o => o.value === brand);
    return index === -1 ? BRAND_OPTIONS.length : index;
};

/** 「◯時間◯分◯秒」。⚠️ 以前の表示（calculateTotalAccessTime）と同じ形 */
const formatSeconds = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0秒';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (hours > 0) result += `${hours}時間`;
    if (minutes > 0 || hours > 0) result += `${minutes}分`;
    result += `${seconds}秒`;
    return result;
};

/**
 * 選択肢に無い現在の値を、選択肢の先頭に「現在の値」として足す。
 *
 * ⚠️⚠️ **足さないと、select は先頭の選択肢を表示してしまう。**
 *   ⚠️ 見た目は「開発者権限」なのに実際は `insideSales`、のようにずれ、
 *   ⚠️ ⚠️ **触っていないのに変わったように見える／うっかり保存して権限が変わる。**
 */
const withCurrent = (
    options: ReadonlyArray<{ value: string; label: string }>,
    current: string
): { value: string; label: string; disabled?: boolean }[] => {
    if (options.some(o => o.value === current)) return [...options];
    return [{ value: current, label: current === '' ? '（未設定）' : `（現在の値: ${current}）`, disabled: true }, ...options];
};

const EditAuth = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [accessTimes, setAccessTimes] = useState<Record<string, number> | null>(null);
    const [newAuth, setNewAuth] = useState(false);
    const [newBrand, setNewBrand] = useState<string>('ordinary');
    // ⚠️⚠️ **事業区分は空から始める。** ⚠️ 既定値を入れると、選んだように見えて触らずに保存される
    const [newShop, setNewShop] = useState<string>('');
    const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ⚠️ 新規登録行の文字入力は非制御。⚠️ 登録時に ref から読む
    const newNameRef = useRef<HTMLInputElement>(null);
    const newMailRef = useRef<HTMLInputElement>(null);
    const newPasswordRef = useRef<HTMLInputElement>(null);

    const { authority } = useContext(AuthContext);

    // 権限の変更・新規作成は開発者権限のみ。⚠️ ② も Master 以外を 403 で弾く
    const isReadOnly = authority !== 'Master';

    const showNotice = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
        setNotice({ text, tone });
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), tone === 'ok' ? 2000 : 5000);
    }, []);

    useEffect(() => () => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'header_edit_auth' });
                setStaffList((response.data.staff ?? []).filter((s: Staff) => s.mail));
            } catch (err) {
                console.error(err);
                showNotice('一覧を取得できませんでした。', 'error');
                return;
            }

            // ⚠️⚠️ **一覧を出してから取る。** ⚠️ 初回は数十秒かかることがある（② の再起動直後）
            try {
                const response = await apiClient.post('', { request: 'header_auth_access_time' });
                const times = response.data?.times ?? {};
                const byId: Record<string, number> = {};
                Object.keys(times).forEach(id => { byId[String(id)] = Number(times[id]); });
                setAccessTimes(byId);
            } catch (err) {
                // ⚠️ 時間が出なくても一覧の編集はできる。⚠️ 画面は止めない
                console.error(err);
                setAccessTimes({});
            }
        };
        fetchData();
    }, [showNotice]);

    /**
     * 1項目を保存する。
     * ⚠️ 成功したら画面の行も直す。⚠️ 失敗したら false を返す（呼び出し側で入力を元に戻す）。
     */
    const saveField = async (id: string, field: Field, value: string): Promise<boolean> => {
        try {
            const response = await apiClient.post('', { request: 'header_auth_update', id, field, value });
            if (response.data?.status !== 'success') {
                showNotice(response.data?.message ?? `${FIELD_LABEL[field]}を保存できませんでした。`, 'error');
                return false;
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showNotice(message ?? `${FIELD_LABEL[field]}を保存できませんでした。`, 'error');
            return false;
        }

        setStaffList(prev => prev.map(p => {
            if (p.id !== id) return p;
            // ⚠️ パスワードは値を持たない。⚠️ 「設定済み」にするだけ
            return field === 'password' ? { ...p, has_password: 1 } : { ...p, [field]: value };
        }));
        showNotice(`${FIELD_LABEL[field]}を保存しました。`);
        return true;
    };

    /**
     * 文字の入力欄（氏名・メール）のフォーカスが外れたとき。
     * ⚠️ 変わっていなければ送らない。⚠️ 失敗したら元の値に戻す。
     */
    const commitText = async (e: React.FocusEvent<HTMLInputElement>, item: Staff, field: 'name' | 'mail') => {
        const input = e.currentTarget;
        const next = input.value.trim();
        const before = item[field];
        if (next === before) {
            input.value = before;
            return;
        }
        const ok = await saveField(item.id, field, next);
        if (!ok) input.value = before;
    };

    /** パスワード。⚠️ 空なら何もしない。⚠️ 保存後は欄を空に戻す（⚠️ 画面に残さない） */
    const commitPassword = async (e: React.FocusEvent<HTMLInputElement>, item: Staff) => {
        const input = e.currentTarget;
        const next = input.value;
        if (next === '') return;
        await saveField(item.id, 'password', next);
        input.value = '';
    };

    /** Enter で確定（＝フォーカスを外す）、Esc で元に戻す */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, original: string) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            e.currentTarget.value = original;
            e.currentTarget.blur();
        }
    };

    const resetNewAuth = () => {
        setNewAuth(false);
        setNewBrand('ordinary');
        setNewShop('');
    };

    const handleSaveNewAuth = async () => {
        // ⚠️ 文字の欄は非制御なので state ではなく ref から読む
        const name = (newNameRef.current?.value ?? '').trim();
        const mail = (newMailRef.current?.value ?? '').trim();
        const password = newPasswordRef.current?.value ?? '';

        if (!name) {
            alert('氏名を入力してください。');
            return;
        }
        if (!mail) {
            alert('ログイン用メールアドレスを入力してください。');
            return;
        }
        // ⚠️⚠️ **事業区分は必須。** ⚠️ 空で作ると、その人はどの事業区分の画面にも入れない
        if (!newShop) {
            alert('事業区分を選択してください。');
            return;
        }

        try {
            const response = await apiClient.post('', {
                request: 'header_auth_insert',
                name, mail, password, brand: newBrand, shop: newShop,
            });

            if (response.data.status === 'success') {
                // id はサーバーが採番した実IDでなければならない。
                // 仮IDを入れると、直後に権限を変更しても存在しないIDで UPDATE され保存されない。
                if (!response.data.id) {
                    alert('登録は完了しましたが、IDが取得できませんでした。画面を再読み込みしてください。');
                    return;
                }
                const created: Staff = {
                    id: String(response.data.id),
                    name, mail, brand: newBrand, shop: newShop,
                    heartbeat: '',
                    has_password: password === '' ? 0 : 1,
                };
                setStaffList(prev => [created, ...prev]);
                setAccessTimes(prev => (prev === null ? prev : { ...prev, [created.id]: 0 }));
                resetNewAuth();
                showNotice('ログイン用アカウントを作成しました。');
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(message ?? '通信エラーが発生しました。');
        }
    };

    const sorted = [...staffList].sort((a, b) => brandOrder(a.brand) - brandOrder(b.brand));

    const accessTimeOf = (id: string) => {
        if (accessTimes === null) return <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>計算中…</span>;
        const value = accessTimes[id];
        return value === undefined ? '—' : formatSeconds(value);
    };

    const inputStyle: React.CSSProperties = { fontSize: '12px' };
    const selectStyle: React.CSSProperties = { fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' };

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="d-flex align-items-center mb-3 gap-3">
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        ログイン用アカウントの一覧です。人事マスタ（スタッフ編集）とは連動していません。
                        {!isReadOnly && <span className="ms-1">氏名・メールアドレス・パスワードは、入力して欄の外を押すか Enter で保存されます（Esc で取り消し）。</span>}
                    </div>
                    {notice && (
                        <div
                            className={`small fw-bold px-2 py-1 rounded ${notice.tone === 'ok' ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle'}`}
                            style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                            role="status"
                        >
                            {notice.text}
                        </div>
                    )}
                    <div className="ms-auto">
                        {newAuth ? (
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewAuth}>
                                    <i className="fa-solid fa-check me-1"></i>登録する
                                </button>
                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={resetNewAuth}>
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-primary btn-sm px-3"
                                style={{ fontSize: '12px', fontWeight: 'bold' }}
                                onClick={() => setNewAuth(true)}
                                disabled={isReadOnly}
                            >
                                <i className="fa-solid fa-user-plus me-1"></i>新規追加
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1280px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3 text-center" style={{ width: '50px' }}>No</th>
                                <th className="py-3" style={{ width: '160px' }}>氏名</th>
                                <th className="py-3" style={{ width: '150px' }}>権限</th>
                                <th className="py-3" style={{ width: '130px' }}>事業区分</th>
                                <th className="py-3">ログイン用メールアドレス</th>
                                <th className="py-3" style={{ width: '170px' }}>パスワード</th>
                                <th className="py-3" style={{ width: '160px' }}>最終アクセス日時</th>
                                <th className="py-3" style={{ width: '140px' }}>総アクセス時間</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>

                            {/* 新規登録行 */}
                            {newAuth && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                <td className="text-center text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="text" placeholder="氏名を入力"
                                        ref={newNameRef} defaultValue="" autoComplete="off"
                                        className="fw-bold" style={inputStyle}
                                    />
                                </td>
                                <td className="p-2">
                                    <BsForm.Select
                                        size="sm" value={newBrand}
                                        onChange={(e) => setNewBrand(e.target.value)}
                                        className="border-light-subtle text-dark" style={selectStyle}
                                    >
                                        {BRAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2">
                                    <BsForm.Select
                                        size="sm" value={newShop}
                                        onChange={(e) => setNewShop(e.target.value)}
                                        className={`border-light-subtle ${newShop ? 'text-dark' : 'text-danger'}`} style={selectStyle}
                                    >
                                        <option value="" disabled>選択してください</option>
                                        {SHOP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="email" placeholder="ログイン用メールアドレスを入力"
                                        ref={newMailRef} defaultValue="" autoComplete="off" style={inputStyle}
                                    />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="password" placeholder="任意"
                                        ref={newPasswordRef} defaultValue="" autoComplete="new-password" style={inputStyle}
                                    />
                                </td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                            </tr>}

                            {sorted.map((item, index) => (
                                <tr key={item.id} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                    <td className="text-center text-muted" style={{ fontSize: '12px' }}>{index + 1}</td>
                                    <td className="p-2">
                                        {/* ⚠️⚠️ 非制御。⚠️ key に id を含めているので、並び替えても別人の値が残らない */}
                                        <BsForm.Control
                                            size="sm" type="text"
                                            defaultValue={item.name ?? ''}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitText(e, item, 'name')}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, item.name ?? '')}
                                            disabled={isReadOnly} autoComplete="off"
                                            className="fw-bold text-dark border-0 bg-transparent" style={inputStyle}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Select
                                            size="sm" value={item.brand ?? ''}
                                            onChange={(e) => { void saveField(item.id, 'brand', e.target.value); }}
                                            className="border-light-subtle text-dark" style={selectStyle}
                                            disabled={isReadOnly}
                                        >
                                            {withCurrent(BRAND_OPTIONS, item.brand ?? '').map(o =>
                                                <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                                        </BsForm.Select>
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Select
                                            size="sm" value={item.shop ?? ''}
                                            onChange={(e) => { void saveField(item.id, 'shop', e.target.value); }}
                                            // ⚠️ 未設定は赤。⚠️ その人はどの事業区分の画面にも入れない
                                            className={`border-light-subtle ${item.shop ? 'text-dark' : 'text-danger'}`} style={selectStyle}
                                            disabled={isReadOnly}
                                        >
                                            {withCurrent(SHOP_OPTIONS, item.shop ?? '').map(o =>
                                                <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                                        </BsForm.Select>
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Control
                                            size="sm" type="email"
                                            defaultValue={item.mail ?? ''}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitText(e, item, 'mail')}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, item.mail ?? '')}
                                            disabled={isReadOnly} autoComplete="off"
                                            className="text-muted border-0 bg-transparent" style={inputStyle}
                                        />
                                    </td>
                                    <td className="p-2">
                                        {/* ⚠️⚠️ パスワードは表示しない。⚠️ 入れたときだけ保存し、欄は空に戻す */}
                                        <BsForm.Control
                                            size="sm" type="password"
                                            placeholder={Number(item.has_password) === 1 ? '設定済み（変更時のみ入力）' : '未設定'}
                                            defaultValue=""
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitPassword(e, item)}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, '')}
                                            disabled={isReadOnly} autoComplete="new-password"
                                            style={inputStyle}
                                        />
                                    </td>
                                    <td className="text-muted" style={{ fontSize: '12px' }}>{item.heartbeat ?? ''}</td>
                                    <td className="fw-bold text-secondary">{accessTimeOf(item.id)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </>
    );
};

export default EditAuth;
