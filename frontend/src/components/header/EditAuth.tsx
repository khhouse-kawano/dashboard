import React, { useState, useEffect, useContext } from 'react';
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
 */

const BRAND_OPTIONS = [
    { value: 'Master', label: '開発者権限' },
    { value: 'BrandAdmin', label: '管理者権限' },
    { value: 'ordinary', label: '一般' },
] as const;

type Brand = typeof BRAND_OPTIONS[number]['value'];

type Staff = {
    id: string;
    name: string;
    brand: Brand;
    mail: string;
    heartbeat: string;
    log: string; // JSON文字列
};

/** 新規登録フォームで入力する項目だけを持つ型 */
type NewAuth = Pick<Staff, 'name' | 'mail' | 'brand'>;

const EMPTY_NEW_AUTH: NewAuth = { name: '', mail: '', brand: 'ordinary' };

const EditAuth = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [newAuth, setNewAuth] = useState(false);
    const [newAuthData, setNewAuthData] = useState<NewAuth>(EMPTY_NEW_AUTH);

    const { authority } = useContext(AuthContext);

    // 権限の変更・新規作成は開発者権限のみ。既存の制御にあわせる。
    const isReadOnly = authority === 'BrandAdmin';

    const safeFormate = (value: string) => {
        return value ?? '';
    };

    // 💡 ログ文字列をパースして「総アクセス時間」を秒単位で合算・フォーマットする関数
    const calculateTotalAccessTime = (logStr: string): string => {
        if (!logStr) return '0秒';
        try {
            const logs = JSON.parse(logStr);
            if (!Array.isArray(logs) || logs.length === 0) return '0秒';

            // 時系列順にソート
            const parsedLogs = logs
                .map(item => ({
                    dateObj: new Date(item.time.replace(/-/g, '/'))
                }))
                .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

            let totalSeconds = 0;
            let sessionStart = parsedLogs[0].dateObj;
            let lastLogTime = parsedLogs[0].dateObj;

            for (let i = 1; i < parsedLogs.length; i++) {
                const currentLogTime = parsedLogs[i].dateObj;
                // 前のログとの差分（秒）
                const diff = (currentLogTime.getTime() - lastLogTime.getTime()) / 1000;

                // ✨ 修正ポイント：1分（60秒）「未満」の時だけセッションを継続する
                if (diff < 60) {
                    lastLogTime = currentLogTime;
                } else {
                    // 1分以上あいたらセッション終了。ここまでの滞在時間を確定して加算
                    totalSeconds += Math.floor((lastLogTime.getTime() - sessionStart.getTime()) / 1000);

                    // 新しいセッションの起点としてセット
                    sessionStart = currentLogTime;
                    lastLogTime = currentLogTime;
                }
            }
            // ループが終わった後、最後のセッションの滞在時間を加算
            totalSeconds += Math.floor((lastLogTime.getTime() - sessionStart.getTime()) / 1000);

            // 「◯時間◯分◯秒」にフォーマット
            if (totalSeconds === 0) return '0秒';
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            let result = '';
            if (hours > 0) result += `${hours}時間`;
            if (minutes > 0 || hours > 0) result += `${minutes}分`;
            result += `${seconds}秒`;
            return result;

        } catch (e) {
            return '0秒';
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: "header_edit_auth" });
                setStaffList(response.data.staff.filter((s: any) => s.mail));
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    const handleChange = (id: string, value: string) => {
        const fetchData = async () => {
            const postData = {
                id,
                brand: value,
                request: "header_auth_update"
            };
            try {
                const response = await apiClient.post('', postData);
                console.log(response.data.status);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    };

    const handleSaveNewAuth = async () => {
        if (!newAuthData.name.trim()) {
            alert('氏名を入力してください。');
            return;
        }
        if (!newAuthData.mail.trim()) {
            alert('ログイン用メールアドレスを入力してください。');
            return;
        }

        try {
            const postData = {
                ...newAuthData,
                request: "header_auth_insert"
            };

            const response = await apiClient.post('', postData);

            if (response.data.status === 'success') {
                // id はサーバーが採番した実IDでなければならない。
                // 仮IDを入れると、直後に権限を変更しても存在しないIDで UPDATE され保存されない。
                if (!response.data.id) {
                    alert('登録は完了しましたが、IDが取得できませんでした。画面を再読み込みしてください。');
                    return;
                }
                const created: Staff = {
                    ...newAuthData,
                    id: String(response.data.id),
                    heartbeat: '',
                    log: '',
                };
                setStaffList(prev => [created, ...prev]);
                setNewAuth(false);
                setNewAuthData(EMPTY_NEW_AUTH);
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました。');
        }
    };

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="d-flex align-items-center mb-3">
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        ログイン用アカウントの一覧です。人事マスタ（スタッフ編集）とは連動していません。
                    </div>
                    <div className="ms-auto">
                        {newAuth ? (
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewAuth}>
                                    <i className="fa-solid fa-check me-1"></i>登録する
                                </button>
                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={() => { setNewAuth(false); setNewAuthData(EMPTY_NEW_AUTH); }}>
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
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1100px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3 text-center" style={{ width: '50px' }}>No</th>
                                <th className="py-3" style={{ width: '140px' }}>氏名</th>
                                <th className="py-3" style={{ width: '150px' }}>権限</th>
                                <th className="py-3">ログイン用メールアドレス</th>
                                <th className="py-3" style={{ width: '180px' }}>最終アクセス日時</th>
                                <th className="py-3" style={{ width: '160px' }}>総アクセス時間</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>

                            {/* 新規登録行 */}
                            {newAuth && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                <td className="text-center text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm"
                                        type="text"
                                        placeholder="氏名を入力"
                                        value={newAuthData.name}
                                        onChange={(e) => setNewAuthData(prev => ({ ...prev, name: e.target.value }))}
                                        className="fw-bold"
                                        style={{ fontSize: '12px' }}
                                    />
                                </td>
                                <td className="p-2">
                                    <BsForm.Select
                                        size="sm"
                                        value={newAuthData.brand}
                                        onChange={(e) => setNewAuthData(prev => ({ ...prev, brand: e.target.value as Brand }))}
                                        className="border-light-subtle text-dark"
                                        style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                    >
                                        {BRAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm"
                                        type="email"
                                        placeholder="ログイン用メールアドレスを入力"
                                        value={newAuthData.mail}
                                        onChange={(e) => setNewAuthData(prev => ({ ...prev, mail: e.target.value }))}
                                        style={{ fontSize: '12px' }}
                                    />
                                </td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                            </tr>}

                            {[
                                ...staffList.filter(s => s.brand === 'Master'),
                                ...staffList.filter(s => s.brand === 'BrandAdmin'),
                                ...staffList.filter(s => s.brand === 'ordinary')
                            ].map((item, index) => (
                                <tr key={item.id ?? index} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                    <td className="text-center text-muted" style={{ fontSize: '12px' }}>{index + 1}</td>
                                    <td className="fw-bold text-dark">{safeFormate(item.name)}</td>
                                    <td>
                                        <BsForm.Select
                                            size="sm"
                                            value={item.brand}
                                            onChange={(e) => {
                                                const nextValue = e.target.value as Brand;
                                                setStaffList(prev =>
                                                    prev.map(p => p.id === item.id ? { ...p, brand: nextValue } : p)
                                                );
                                                handleChange(item.id, nextValue);
                                            }}
                                            className="border-light-subtle text-dark"
                                            style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                            disabled={isReadOnly}
                                        >
                                            {BRAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </BsForm.Select>
                                    </td>
                                    <td className="text-muted">{safeFormate(item.mail)}</td>
                                    <td className="text-muted" style={{ fontSize: '12px' }}>{safeFormate(item.heartbeat)}</td>
                                    <td className="fw-bold text-secondary">
                                        {calculateTotalAccessTime(item.log)}
                                    </td>
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
