import React, { useState, useEffect, useContext, useRef } from 'react'
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYears } from '../../utils/getYears';

/**
 * 人事マスタ（staff_list テーブル）の編集画面。
 *
 * ⚠️ ログイン権限（staff テーブル）は EditAuth.tsx の担当であり、
 *   ここでは一切触らない。両テーブルは連携していないため、
 *   ここでスタッフを登録してもログインはできない。
 *   ログイン用アカウントは EditAuth 側で別途作成する。
 */

type Staff = Record<string, string>;
type Section = Record<string, string>;
type Shop = Record<string, string>;

const POSITION_OPTIONS = ['一般', '常務', '部長', '課長', '課長代理', '店長', '店長代理', 'IC', '管理用'];

const EditStaff = () => {
        const [staffList, setStaffList] = useState<Staff[]>([]);
        const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
        const [shopList, setShopList] = useState<Shop[]>([]);
        const [sectionList, setSectionList] = useState<Section[]>([]);
        const [targetSection, setTargetSection] = useState('');
        const [targetShop, setTargetShop] = useState('');
        const [targetStats, setTargetStatus] = useState('');
        const [targetPosition, setTargetPosition] = useState('');
        const [newStaff, setNewStaff] = useState(false);
        const [targetYear, setTargetYear] = useState('');
        /** 氏名サジェストの候補（staff テーブルの氏名）。入力の手間を省くためだけに使う */
        const [authNames, setAuthNames] = useState<string[]>([]);
        const [nameSuggestOpen, setNameSuggestOpen] = useState(false);

        // 氏名 input は非制御（uncontrolled）にして ref から値を読む。
        // 制御コンポーネントにすると1文字打つたびに state が更新され、
        // 数千行のテーブル全体が再レンダリングされて入力がもたつく。
        const nameInputRef = useRef<HTMLInputElement>(null);
        // サジェストの絞り込みだけは state が必要なので、遅延させて更新する。
        const [nameKeyword, setNameKeyword] = useState('');
        const nameKeywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

        useEffect(() => {
                return () => {
                        if (nameKeywordTimer.current) clearTimeout(nameKeywordTimer.current);
                };
        }, []);
        const now = new Date();
        const year = now.getFullYear();
        const thisYear = now.getMonth() <= 4 ? year : year + 1;

        const [newStaffData, setNewStaffData] = useState<Staff>({
                khg_id: '',
                name: '',
                position: '一般',
                status: '在籍',
                section: '',
                shop: '',
                category: '0',
                rank: '0',
                report: '0',
                multi: '0',
                estate: '0',
                inside: '0',
                period: ''
        });

        const { authority } = useContext(AuthContext);

        const safeFormate = (value: string) => {
                return value ?? '';
        };

        useEffect(() => {
                const fetchData = async () => {
                        try {
                                const response = await apiClient.post('', { request: "header_staff_edit" });
                                setOriginalStaffList(response.data.staff);
                                setShopList(response.data.shop);
                                setSectionList(response.data.section);
                                setAuthNames(response.data.auth_names ?? []);

                                setNewStaffData(prev => ({
                                        ...prev,
                                        section: response.data.section[0]?.name ?? '',
                                        shop: response.data.shop[0]?.shop ?? '',
                                        period: String(thisYear)
                                }));
                        } catch (err) {
                                console.error(err);
                        }
                };

                fetchData();
                setTargetYear(String(thisYear));
        }, []);

        useEffect(() => {
                const filtered = originalStaffList.filter(o =>
                        (targetShop ? o.shop === targetShop : true) &&
                        (targetStats ? o.status === targetStats : true) &&
                        (targetSection ? o.section === targetSection : true) &&
                        (targetYear ? o.period === targetYear : true) &&
                        (targetPosition ? o.position === targetPosition : true)
                );
                setStaffList(filtered);
        }, [originalStaffList, targetShop, targetStats, targetSection, targetYear, targetPosition]);

        const handleChange = (id: string, key: string, value: string) => {
                const fetchData = async () => {
                        const postData = {
                                id,
                                [key]: value,
                                request: "header_staff_update"
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

        const handleSaveNewStaff = async () => {
                // 氏名は非制御 input のため state ではなく ref から読む
                const name = (nameInputRef.current?.value ?? '').trim();

                if (!name) {
                        alert('氏名を入力してください。');
                        return;
                }

                try {
                        const postData = {
                                ...newStaffData,
                                name,
                                request: "header_staff_insert"
                        };

                        const response = await apiClient.post('', postData);

                        if (response.data.status === 'success') {
                                // id はサーバーが採番した実IDでなければならない。
                                // 仮IDを入れると、登録直後にその行を編集しても
                                // 存在しないIDで UPDATE され保存されない。
                                if (!response.data.id) {
                                        alert('登録は完了しましたが、IDが取得できませんでした。画面を再読み込みしてください。');
                                        return;
                                }
                                const createdRecord = { ...newStaffData, name, id: String(response.data.id) };

                                setOriginalStaffList(prev => [createdRecord, ...prev]);
                                // 行がアンマウントされるので非制御 input の値は自動的にクリアされる
                                setNewStaff(false);
                                setNameSuggestOpen(false);
                                setNameKeyword('');

                                setNewStaffData({
                                        khg_id: '',
                                        name: '',
                                        position: '一般',
                                        status: '在籍',
                                        section: sectionList[0]?.name ?? '',
                                        shop: shopList[0]?.shop ?? '',
                                        category: '0',
                                        rank: '0',
                                        report: '0',
                                        multi: '0',
                                        estate: '0',
                                        inside: '0',
                                        period: targetYear
                                });
                        } else {
                                alert('登録に失敗しました: ' + response.data.message);
                        }
                } catch (err) {
                        console.error(err);
                        alert('通信エラーが発生しました。');
                }
        };

        const isOrdinary = authority === 'ordinary'

        // 氏名は「山田 太郎」「山田太郎」のように空白の有無がぶれるため、
        // 空白（半角・全角）を除いた形で照合する。
        const normalizeName = (value: string) => value.replace(/[\s　]/g, '');

        const normalizedKeyword = normalizeName(nameKeyword);
        const nameSuggestions = normalizedKeyword
                ? authNames.filter(n => normalizeName(n).includes(normalizedKeyword)).slice(0, 8)
                : [];

        /** 入力のたびに再レンダリングしないよう、絞り込み用のキーワードだけを遅延更新する */
        const handleNameInput = () => {
                setNameSuggestOpen(true);
                if (nameKeywordTimer.current) clearTimeout(nameKeywordTimer.current);
                nameKeywordTimer.current = setTimeout(() => {
                        setNameKeyword(nameInputRef.current?.value ?? '');
                }, 200);
        };

        const applyNameSuggestion = (value: string) => {
                // 非制御なので DOM に直接書き込む
                if (nameInputRef.current) nameInputRef.current.value = value;
                if (nameKeywordTimer.current) clearTimeout(nameKeywordTimer.current);
                setNameKeyword(value);
                setNameSuggestOpen(false);
        };

        return (
                <>
                        <div className="bg-white p-4 rounded shadow-sm border">
                                <div className="d-flex align-items-center mb-3">
                                        {/* 💡 ③ 選択セレクトボックスのデザイン・クラス・幅を完全に他と統一 */}
                                        <div className="m-1">
                                                <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetYear(e.target.value)} value={String(targetYear)}>
                                                        {getYears().map((year => <option key={year} value={year}>{year}年度</option>))}
                                                </select>
                                        </div>
                                        <div className="m-1">
                                                <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetSection(e.target.value)}>
                                                        <option value=''>所属を選択</option>
                                                        {sectionList.map(section => <option key={section.name} value={section.name}>{section.name}</option>)}
                                                </select>
                                        </div>
                                        <div className="m-1">
                                                <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetPosition(e.target.value)}>
                                                        <option value=''>役職を選択</option>
                                                        {POSITION_OPTIONS.map(position => <option key={position} value={position}>{position}</option>)}
                                                </select>
                                        </div>
                                        <div className="m-1">
                                                <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetShop(e.target.value)}>
                                                        <option value=''>店舗を選択</option>
                                                        {shopList.map(shop => <option key={shop.shop} value={shop.shop}>{shop.shop}</option>)}
                                                </select>
                                        </div>
                                        <div className="m-1">
                                                <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetStatus(e.target.value)}>
                                                        <option value=''>ステータスを選択</option>
                                                        <option value='在籍'>在籍</option>
                                                        <option value='休職'>休職</option>
                                                        <option value='退職'>退職</option>
                                                </select>
                                        </div>

                                        <div className="ms-auto m-1">
                                                {newStaff ? (
                                                        <div className="d-flex gap-2">
                                                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewStaff}>
                                                                        <i className="fa-solid fa-check me-1"></i>登録する
                                                                </button>
                                                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={() => { setNewStaff(false); setNameSuggestOpen(false); setNameKeyword(''); }}>
                                                                        キャンセル
                                                                </button>
                                                        </div>
                                                ) : (
                                                        <button className="btn btn-primary btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }}
                                                                onClick={() => {
                                                                        setNewStaffData(prev => ({ ...prev, period: targetYear }));
                                                                        setNewStaff(true);
                                                                }}>
                                                                <i className="fa-solid fa-user-plus me-1"></i>新規追加
                                                        </button>
                                                )}
                                        </div>
                                </div>

                                <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                        <Table hover className="align-middle mb-0" style={{ minWidth: '1810px' }}>
                                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                                        <tr className="text-secondary border-bottom" style={{ fontSize: '12px' }}>
                                                                {/* 背景色が透過してスクロールした文字が見えないように、各 <th> に背景色を設定します */}
                                                                <th className="py-3 text-center" style={{ width: '70px', backgroundColor: '#f8f9fa' }}>No (ID)</th>
                                                                <th className="py-3" style={{ width: '120px', backgroundColor: '#f8f9fa' }}>年度</th>
                                                                <th className="py-3" style={{ width: '140px', backgroundColor: '#f8f9fa' }}>氏名</th>
                                                                <th className="py-3" style={{ width: '120px', backgroundColor: '#f8f9fa' }}>役職</th>
                                                                <th className="py-3" style={{ width: '130px', backgroundColor: '#f8f9fa' }}>ステータス</th>
                                                                <th className="py-3" style={{ width: '160px', backgroundColor: '#f8f9fa' }}>所属</th>
                                                                <th className="py-3" style={{ width: '160px', backgroundColor: '#f8f9fa' }}>店舗</th>
                                                                <th className="py-3 text-center" style={{ width: '100px', backgroundColor: '#f8f9fa' }}>反響一覧</th>
                                                                <th className="py-3 text-center" style={{ width: '130px', backgroundColor: '#f8f9fa' }}>店舗担当別反響</th>
                                                                <th className="py-3 text-center" style={{ width: '160px', backgroundColor: '#f8f9fa' }}>全社報告フォーマット</th>
                                                                <th className="py-3 text-center" style={{ width: '110px', backgroundColor: '#f8f9fa' }}>併売店スタッフ</th>
                                                                <th className="py-3 text-center" style={{ width: '130px', backgroundColor: '#f8f9fa' }}>土地新着ネット</th>
                                                                <th className="py-3 text-center" style={{ width: '140px', backgroundColor: '#f8f9fa' }}>インサイドセールス</th>
                                                        </tr>
                                                </thead>
                                                <tbody style={{ fontSize: '13px' }}>

                                                        {/* 新規登録行 */}
                                                        {newStaff && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                                                <td className="p-2">
                                                                        <BsForm.Control
                                                                                size="sm"
                                                                                type="text"
                                                                                placeholder="ID"
                                                                                value={newStaffData.khg_id}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, khg_id: e.target.value }))}
                                                                                className="text-center"
                                                                                style={{ fontSize: '12px' }}
                                                                        />
                                                                </td>
                                                                <td className="p-2">
                                                                        <BsForm.Select
                                                                                size="sm"
                                                                                value={newStaffData.period}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, period: e.target.value }))}
                                                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                                                                disabled={isOrdinary}
                                                                        >
                                                                                {getYears().map(year => <option key={year} value={year}>{year}年度</option>)}
                                                                        </BsForm.Select>
                                                                </td>
                                                                <td className="p-2">
                                                                        {/* 氏名の予測変換。候補は staff（ログイン権限）テーブルの氏名。
                                                                            入力の手間を省くだけで、両テーブルを紐付けるものではない。 */}
                                                                        <div style={{ position: 'relative' }}>
                                                                                <BsForm.Control
                                                                                        size="sm"
                                                                                        type="text"
                                                                                        placeholder="氏名を入力"
                                                                                        ref={nameInputRef}
                                                                                        defaultValue=""
                                                                                        onChange={handleNameInput}
                                                                                        onFocus={() => setNameSuggestOpen(true)}
                                                                                        // 候補のクリックは onMouseDown で拾うため、blur は少し遅らせる必要はない。
                                                                                        // ここで即座に閉じても onMouseDown の方が先に発火する。
                                                                                        onBlur={() => setNameSuggestOpen(false)}
                                                                                        onKeyDown={(e: React.KeyboardEvent) => {
                                                                                                if (e.key === 'Escape') setNameSuggestOpen(false);
                                                                                        }}
                                                                                        autoComplete="off"
                                                                                        className="fw-bold"
                                                                                        style={{ fontSize: '12px' }}
                                                                                />
                                                                                {nameSuggestOpen && nameSuggestions.length > 0 && (
                                                                                        <div
                                                                                                className="bg-white border rounded shadow-sm"
                                                                                                style={{
                                                                                                        position: 'absolute',
                                                                                                        top: '100%',
                                                                                                        left: 0,
                                                                                                        zIndex: 20,
                                                                                                        minWidth: '220px',
                                                                                                        maxHeight: '200px',
                                                                                                        overflowY: 'auto',
                                                                                                        marginTop: '2px'
                                                                                                }}
                                                                                        >
                                                                                                {nameSuggestions.map(suggestion => (
                                                                                                        <div
                                                                                                                key={suggestion}
                                                                                                                // input の blur より先に発火させるため onClick ではなく onMouseDown
                                                                                                                onMouseDown={(e) => {
                                                                                                                        e.preventDefault();
                                                                                                                        applyNameSuggestion(suggestion);
                                                                                                                }}
                                                                                                                className="px-2 py-1 text-dark"
                                                                                                                style={{ fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                                                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f7ff')}
                                                                                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                                                                        >
                                                                                                                {suggestion}
                                                                                                        </div>
                                                                                                ))}
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                </td>
                                                                <td className="p-2">
                                                                        <BsForm.Select
                                                                                size="sm"
                                                                                value={newStaffData.position}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, position: e.target.value }))}
                                                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                                                        >
                                                                                {POSITION_OPTIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                                                        </BsForm.Select>
                                                                </td>
                                                                <td>
                                                                        <BsForm.Select
                                                                                size="sm"
                                                                                value={newStaffData.status}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, status: e.target.value }))}
                                                                                className='border-light-subtle text-primary'
                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                disabled={isOrdinary}
                                                                        >
                                                                                <option value="在籍">● 在籍</option>
                                                                                <option value="休職">休職</option>
                                                                                <option value="退職">退職</option>
                                                                        </BsForm.Select>
                                                                </td>
                                                                <td>
                                                                        <BsForm.Select
                                                                                size="sm"
                                                                                value={newStaffData.section}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, section: e.target.value }))}
                                                                                className="border-light-subtle text-muted"
                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                disabled={isOrdinary}
                                                                        >
                                                                                {sectionList.map((section, sIndex) => <option key={sIndex} value={section.name}>{section.name}</option>)}
                                                                        </BsForm.Select>
                                                                </td>
                                                                <td>
                                                                        <BsForm.Select
                                                                                size="sm"
                                                                                value={newStaffData.shop}
                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, shop: e.target.value }))}
                                                                                className="border-light-subtle text-muted"
                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                disabled={isOrdinary}
                                                                        >
                                                                                {shopList.map((shop, sIndex) => <option value={shop.shop} key={sIndex}>{shop.shop}</option>)}
                                                                        </BsForm.Select>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.category === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, category: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                        disabled={isOrdinary}
                                                                                />
                                                                        </div>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.rank === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, rank: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                />
                                                                        </div>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.report === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, report: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                        disabled={isOrdinary}
                                                                                />
                                                                        </div>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.multi === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, multi: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                        disabled={isOrdinary}
                                                                                />
                                                                        </div>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.estate === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, estate: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                        disabled={isOrdinary}
                                                                                />
                                                                        </div>
                                                                </td>
                                                                <td className="text-center">
                                                                        <div className="d-flex justify-content-center">
                                                                                <BsForm.Check
                                                                                        type="switch"
                                                                                        checked={newStaffData.inside === "1"}
                                                                                        onChange={(e) => setNewStaffData(prev => ({ ...prev, inside: e.target.checked ? "1" : "0" }))}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                        disabled={isOrdinary}
                                                                                />
                                                                        </div>
                                                                </td>
                                                        </tr>}

                                                        {/* 既存スタッフ一覧 */}
                                                        {[...staffList.filter(s => s.khg_id).sort((a, b) => {
                                                                return Number(a.khg_id) - Number(b.khg_id);
                                                        }), ...staffList.filter(s => !s.khg_id)]
                                                                .map((item, index) => (
                                                                        <tr key={item.id ?? index} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                                                                <td className="text-center text-muted" style={{ fontSize: '12px' }}>{item.khg_id ?? '-'}</td>
                                                                                <td className="p-2">
                                                                                        <BsForm.Select
                                                                                                size="sm"
                                                                                                value={item.period}
                                                                                                onChange={(e) => {
                                                                                                        setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, period: e.target.value } : p));
                                                                                                        handleChange(item.id, 'period', e.target.value);
                                                                                                }}
                                                                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                                                                                disabled={isOrdinary}
                                                                                        >
                                                                                                {getYears().map(year => <option key={year} value={year}>{year}年度</option>)}
                                                                                        </BsForm.Select>
                                                                                </td>

                                                                                <td className="fw-bold text-dark">{safeFormate(item.name)}</td>

                                                                                <td className="p-2">
                                                                                        <BsForm.Select
                                                                                                size="sm"
                                                                                                value={item.position || '一般'}
                                                                                                onChange={(e) => {
                                                                                                        setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, position: e.target.value } : p));
                                                                                                        handleChange(item.id, 'position', e.target.value);
                                                                                                }}
                                                                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                                                                        >
                                                                                                {POSITION_OPTIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                                                                        </BsForm.Select>
                                                                                </td>

                                                                                <td>
                                                                                        <BsForm.Select
                                                                                                size="sm"
                                                                                                value={item.status}
                                                                                                onChange={(e) => {
                                                                                                        setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, status: e.target.value } : p));
                                                                                                        handleChange(item.id, 'status', e.target.value);
                                                                                                }}
                                                                                                className={`border-light-subtle text-${item.status === '在籍' ? 'primary' : 'secondary'}`}
                                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                                disabled={isOrdinary}
                                                                                        >
                                                                                                <option value="死籍" style={{ display: 'none' }}>取得中</option>
                                                                                                <option value="在籍">● 在籍</option>
                                                                                                <option value="休職">休職</option>
                                                                                                <option value="退職">退職</option>
                                                                                        </BsForm.Select>
                                                                                </td>
                                                                                <td>
                                                                                        <BsForm.Select
                                                                                                size="sm"
                                                                                                value={item.section}
                                                                                                onChange={(e) => {
                                                                                                        setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, section: e.target.value } : p));
                                                                                                        handleChange(item.id, 'section', e.target.value);
                                                                                                }} className="border-light-subtle text-muted"
                                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                                disabled={isOrdinary}
                                                                                        >
                                                                                                {sectionList.map((section, sIndex) => <option key={sIndex} value={section.name}>{section.name}</option>)}
                                                                                        </BsForm.Select>
                                                                                </td>
                                                                                <td>
                                                                                        <BsForm.Select
                                                                                                size="sm"
                                                                                                value={item.shop}
                                                                                                onChange={(e) => {
                                                                                                        setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, shop: e.target.value } : p));
                                                                                                        handleChange(item.id, 'shop', e.target.value);
                                                                                                }}
                                                                                                className="border-light-subtle text-muted"
                                                                                                style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
                                                                                                disabled={isOrdinary}
                                                                                        >
                                                                                                {shopList.map((shop, sIndex) => <option value={shop.shop} key={sIndex}>{shop.shop}</option>)}
                                                                                        </BsForm.Select>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-category-${index}`}
                                                                                                        checked={Number(item.category) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.category) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, category: newValue } : p));
                                                                                                                handleChange(item.id, 'category', newValue);
                                                                                                        }} style={{ cursor: 'pointer' }}
                                                                                                        disabled={isOrdinary}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-rank-${index}`}
                                                                                                        checked={Number(item.rank) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.rank) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, rank: newValue } : p));
                                                                                                                handleChange(item.id, 'rank', newValue);
                                                                                                        }}
                                                                                                        style={{ cursor: 'pointer' }}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-report-${index}`}
                                                                                                        checked={Number(item.report) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.report) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, report: newValue } : p));
                                                                                                                handleChange(item.id, 'report', newValue);
                                                                                                        }} style={{ cursor: 'pointer' }}
                                                                                                        disabled={isOrdinary}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-multi-${index}`}
                                                                                                        checked={Number(item.multi) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.multi) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, multi: newValue } : p));
                                                                                                                handleChange(item.id, 'multi', newValue);
                                                                                                        }} style={{ cursor: 'pointer' }}
                                                                                                        disabled={isOrdinary}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-estate-${index}`}
                                                                                                        checked={Number(item.estate) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.estate) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, estate: newValue } : p));
                                                                                                                handleChange(item.id, 'estate', newValue);
                                                                                                        }} style={{ cursor: 'pointer' }}
                                                                                                        disabled={isOrdinary}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                                <td className="text-center">
                                                                                        <div className="d-flex justify-content-center">
                                                                                                <BsForm.Check
                                                                                                        type="switch"
                                                                                                        id={`switch-inside-${index}`}
                                                                                                        checked={Number(item.inside) === 1}
                                                                                                        onChange={() => {
                                                                                                                const newValue = Number(item.inside) === 1 ? "0" : "1";
                                                                                                                setStaffList(prev => prev.map(p => p.id === item.id ? { ...p, inside: newValue } : p));
                                                                                                                handleChange(item.id, 'inside', newValue);
                                                                                                        }} style={{ cursor: 'pointer' }}
                                                                                                        disabled={isOrdinary}
                                                                                                />
                                                                                        </div>
                                                                                </td>
                                                                        </tr>
                                                                ))}
                                                </tbody>
                                        </Table>
                                </div>
                        </div>
                </>
        )
}

export default EditStaff