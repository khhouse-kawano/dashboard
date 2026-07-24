import React, { useState, useEffect, useContext } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import axios from 'axios';
import { headers } from '../../utils/headers';
import AuthContext from '../../context/AuthContext';

// 型定義を安全な形に拡張
type Staff = {
    id: string;
    name: string;
    brand: 'Master' | 'BrandAdmin' | 'ordinary';
    mail: string;
    heartbeat: string;
    log: string; // JSON文字列
};
type Section = Record<string, string>;
type Shop = Record<string, string>;

const EditAuth = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);

    const { authority } = useContext(AuthContext);

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
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "header_edit_auth" }, { headers });
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
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
                console.log(response.data.status);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    };

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1100px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3 text-center" style={{ width: '50px' }}>No</th>
                                <th className="py-3" style={{ width: '60px' }}>削除</th>
                                <th className="py-3" style={{ width: '140px' }}>氏名</th>
                                <th className="py-3" style={{ width: '150px' }}>権限</th>
                                <th className="py-3">ログイン用メールアドレス</th>
                                <th className="py-3" style={{ width: '180px' }}>最終アクセス日時</th>
                                <th className="py-3" style={{ width: '160px' }}>総アクセス時間</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>
                            {[
                                ...staffList.filter(s => s.brand === 'Master'),
                                ...staffList.filter(s => s.brand === 'BrandAdmin'),
                                ...staffList.filter(s => s.brand === 'ordinary')
                            ].map((item, index) => (
                                <tr key={index} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                    <td className="text-center text-muted" style={{ fontSize: '12px' }}>{index + 1}</td>
                                    <td className="fw-bold text-dark">
                                        <div className="bg-danger text-white rounded text-center px-2 py-0.5" style={{ width: 'fit-content', cursor: 'pointer', fontSize: '11px' }}>削除</div>
                                    </td>
                                    <td className="fw-bold text-dark">{safeFormate(item.name)}</td>
                                    <td>
                                        <BsForm.Select
                                            size="sm"
                                            value={item.brand}
                                            onChange={(e) => {
                                                const nextValue = e.target.value as any;
                                                setStaffList(prev =>
                                                    prev.map(p => p.id === item.id ? { ...p, brand: nextValue } : p)
                                                );
                                                handleChange(item.id, nextValue);
                                            }}
                                            className="border-light-subtle text-dark"
                                            style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                            disabled={authority === 'BrandAdmin'}
                                        >
                                            <option value="Master">開発者権限</option>
                                            <option value="BrandAdmin">管理者権限</option>
                                            <option value="ordinary">一般</option>
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