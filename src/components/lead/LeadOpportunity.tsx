import React, { useEffect, useState, useMemo, useContext } from 'react';
import apiClient from '../../utils/apiClient';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import AuthContext from '../../context/AuthContext';
import LeadEdit from './LeadEdit';
import DocumentViewer from './DocumentViewer';
import PlannerGenerator from './PlannerGenerator';
// ==========================================
// 💡 型定義
// ==========================================
type OpportunityLead = {
    internal_id: string;
    kind: string; // 'ledger' | 'buyLeads' | 'buyLead'
    id: string;
    no: string;
    addr1?: string | null;
    addr2?: string | null;
    addr?: string | null;
    price?: string | number | null;
    budget?: string | number | null;
    staff: string | null;
    portal: string | null;
    seller?: string | null;
    customer?: string | null;
    name?: string | null;
    source?: string | null;
    category?: string | null;
    phase: string | null;
    targetProperty?: string | null;
    property?: string | null;
    contractDate: string | null;
    settleDate?: string | null;
    contactDate: string | null;
    visitDate: string | null;
    receivedDate: string | null;
    note?: string | null;
    [key: string]: any;
};

// 💡 追加: DocumentViewerへ渡す初期データの型定義
type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null; // 追加: 区分
    phone?: string | null;    // 追加: 連絡先(電話)
    mail?: string | null;     // 追加: 連絡先(メール)
    addr: string | null;
    price: number | null;
    fee: number | null;
};

// ==========================================
// 💡 ヘルパー関数
// ==========================================
const dateFormate = (date: string | null) => {
    return (date === '0000-00-00' || !date) ? '' : date;
};

const formatDate = (dateStr: string | null | Date) => {
    if (!dateStr || String(dateStr).startsWith('0000')) return '―';
    if (dateStr instanceof Date) {
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }
    return dateStr.replace(/-/g, '/');
};

const formatYen = (num: string | number | null) => {
    if (!num) return '―';
    return `¥${Number(num).toLocaleString()}`;
};

const calcRate = (part: number, total: number) => {
    if (total === 0) return '0.0%';
    return ((part / total) * 100).toFixed(1) + '%';
};

// 💡 仲介手数料の自動計算（800万円以下: 30万円、800万円超: 3% + 6万円）
const calcBrokerageFee = (priceVal: string | number | null | undefined): number | null => {
    if (!priceVal) return null;
    // 数字以外の文字を除去して数値化
    const price = Number(String(priceVal).replace(/[^\d.-]/g, ''));
    if (isNaN(price) || price === 0) return null;

    // データが万円単位（例: 3000）か、円単位（例: 30000000）かを判定して円に統一
    const actualPrice = price < 1000000 ? price * 10000 : price;

    if (actualPrice <= 8000000) {
        return 300000;
    } else {
        return actualPrice * 0.03 + 60000;
    }
};

// 経過日数の計算
const calcElapsedDays = (targetDate: string | null) => {
    if (!targetDate || targetDate.startsWith('0000')) return '―';
    const start = new Date(targetDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? `${diffDays}日` : '―';
};

const LeadOpportunity = () => {
    const { userName } = useContext(AuthContext);

    const [leads, setLeads] = useState<OpportunityLead[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [staffList, setStaffList] = useState<string[]>([]);
    const [displayLimit, setDisplayLimit] = useState<number>(15);

    // 💡 DocumentViewerの状態管理
    const [documentShow, setDocumentShow] = useState(false);
    const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);

    // 💡 フィルター用ステート
    const [selectedStaff, setSelectedStaff] = useState<string>('');
    const [selectedPhase, setSelectedPhase] = useState<string>('');
    const [hideSettled, setHideSettled] = useState<boolean>(true); // デフォルトで決済完了を隠す

    const [plannerShow, setPlannerShow] = useState(false);

    // モーダル制御・状態管理用
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    // 💡 修正: 共通コンポーネントに合わせて customerInfo として状態を管理する
    const [customerInfo, setCustomerInfo] = useState<Partial<OpportunityLead>>({});

    // 💡 データの取得と整形
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'planner', roll: 'lead' });
                if (response.data && response.data.lead) {
                    // 有効な商談フェーズ（決済完了も一旦含めて取得し、フロントでフィルタリング）
                    const validPhases = ['媒介受託', '購入申込', '内見済み', '契約済', '決済完了'];

                    const responseLead = response.data.lead
                        .filter((l: any) =>
                            (l.kind === 'ledger' || l.kind === 'buyLead' || l.kind === 'buyLeads') &&
                            validPhases.includes(l.phase)
                        )
                        .map((l: any) => ({
                            ...l,
                            contactDate: dateFormate(l.contactDate),
                            receivedDate: dateFormate(l.receivedDate),
                            visitDate: dateFormate(l.visitDate),
                            contractDate: dateFormate(l.contractDate),
                            settleDate: dateFormate(l.settleDate)
                        }));

                    setLeads(responseLead);

                    if (response.data.staff) {
                        // 重複排除してセット
                        const staffs = Array.from(new Set(response.data.staff.map((s: any) => s.name))) as string[];
                        setStaffList(staffs);
                    }
                }
            } catch (e) {
                alert('通信エラーが発生しました');
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // 💡 フィルター適用後のデータ
    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            if (selectedStaff && l.staff !== selectedStaff) return false;
            if (selectedPhase && l.phase !== selectedPhase) return false;
            if (hideSettled && l.phase === '決済完了') return false;
            return true;
        });
    }, [leads, selectedStaff, selectedPhase, hideSettled]);

    // 💡 担当者別サマリー（filteredLeadsをベースに集計）
    const staffSummary = useMemo(() => {
        const summary: Record<string, any> = {};
        let total = { count: 0, contract: 0, pending: 0, sell: 0, buy: 0 };

        filteredLeads.forEach(lead => {
            const staff = lead.staff || '未割当';
            if (!summary[staff]) {
                summary[staff] = { count: 0, contract: 0, pending: 0, sell: 0, buy: 0 };
            }

            const isSell = lead.kind === 'ledger';
            const isContracted = ['契約済', '決済完了'].includes(lead.phase || '');

            summary[staff].count++;
            total.count++;

            if (isSell) { summary[staff].sell++; total.sell++; }
            else { summary[staff].buy++; total.buy++; }

            if (isContracted) {
                summary[staff].contract++; total.contract++;
            } else {
                summary[staff].pending++; total.pending++;
            }
        });

        const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
        return { sorted, total };
    }, [filteredLeads]);

    // ==========================================
    // 💡 ハンドラー関数
    // ==========================================
    const handleNameClick = (lead: OpportunityLead) => {
        setCustomerInfo(lead);
        setIsEditModalOpen(true);
    };

    const handleSaveCustomerInfo = () => {
        console.log(`[API UPDATE] Save Opportunity Info:`, customerInfo);
        // APIへのダミー関数呼び出し
        if (customerInfo.id) {
            setLeads(prev => prev.map(l => l.id === customerInfo.id ? { ...l, ...customerInfo } as OpportunityLead : l));
        }
        setIsEditModalOpen(false);
    };

    // 💡 追加: 契約書ボタンクリック時の処理
    const handleOpenDocument = (lead: OpportunityLead) => {
        const isSell = lead.kind === 'ledger';
        const customerName = isSell ? lead.seller : (lead.customer || lead.name);
        const priceVal = isSell ? lead.price : lead.budget;

        // 費用と価格の算出
        const fee = calcBrokerageFee(priceVal);
        const parsedPrice = priceVal ? Number(String(priceVal).replace(/[^\d.-]/g, '')) : null;
        const actualPrice = parsedPrice ? (parsedPrice < 1000000 ? parsedPrice * 10000 : parsedPrice) : null;

        // 媒介種別のバリデーション
        const bt = lead.baikaiType;
        const validBaikaiTypes = ['専任媒介', '専属専任媒介', '一般媒介'];
        const safeBaikaiType = validBaikaiTypes.includes(bt) ? bt : '専任媒介';

        const data: initialData = {
            name: customerName || null,
            baikaiType: safeBaikaiType as '専任媒介' | '専属専任媒介' | '一般媒介',
            category: lead.category || null,
            phone: lead.phone || null,
            mail: lead.mail || null,
            addr: lead.addr1 || lead.addr || null,
            price: actualPrice,
            fee: fee
        };

        setCurrentInitialData(data);
        setDocumentShow(true);
    };

    // 💡 動的なリードカテゴリの判定（売・買の切り分け）
    const currentLeadCategory = customerInfo?.kind === 'ledger' ? 'sellOpportunity' : 'buyOpportunity';

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>

            {/* 💡 ヘッダー＆フィルターセクション */}
            <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 pb-2 border-bottom" style={{ minWidth: '1200px' }}>
                <div>
                    <h4 className="fw-bold text-secondary mb-2 d-flex align-items-center gap-3" style={{ letterSpacing: '1px' }}>
                        <div><i className="bi bi-briefcase me-2 text-primary"></i>商談・契約管理（統合）</div>
                    </h4>
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        購入申込・媒介受託以降の有効な商談を一元管理します。仲介手数料は800万円を基準に自動算出されます。
                    </div>
                </div>

                <div className="d-flex align-items-center gap-3 mt-3 mt-md-0">
                    <div className="form-check form-switch d-flex align-items-center gap-2">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="hideSettledSwitch"
                            checked={hideSettled}
                            onChange={() => setHideSettled(!hideSettled)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label className="form-check-label text-muted fw-bold" htmlFor="hideSettledSwitch" style={{ fontSize: '12px', cursor: 'pointer', marginTop: '2px' }}>
                            決済完了を隠す
                        </label>
                    </div>

                    <select
                        className="form-select form-select-sm shadow-sm"
                        style={{ width: '150px', fontSize: '12px', fontWeight: 'bold' }}
                        value={selectedPhase}
                        onChange={(e) => setSelectedPhase(e.target.value)}
                    >
                        <option value="">全フェーズ</option>
                        {['媒介受託', '購入申込', '内見済み', '契約済', '決済完了'].map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        className="form-select form-select-sm shadow-sm"
                        style={{ width: '150px', fontSize: '12px', fontWeight: 'bold' }}
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                    >
                        <option value="">全担当者</option>
                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {!isLoading && (
                <>
                    {/* 💡 担当者別サマリー */}
                    <Card className="shadow-sm border-0 rounded-3 mb-4" style={{ minWidth: '1000px', maxWidth: '1200px' }}>
                        <Card.Header className="bg-white border-bottom-0 pt-3 pb-2">
                            <h6 className="fw-bold text-dark mb-0">担当者別 サマリー</h6>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="bg-light">
                                    <tr>
                                        <th className="text-secondary fw-bold text-start ps-3">担当者</th>
                                        <th className="text-secondary fw-bold text-end">総案件数</th>
                                        <th className="text-secondary fw-bold text-end">未決(進行中)</th>
                                        <th className="text-secondary fw-bold text-end">契約済(決済含)</th>
                                        <th className="text-secondary fw-bold text-end">契約率</th>
                                        <th className="text-secondary fw-bold text-end">【内訳】売案件</th>
                                        <th className="text-secondary fw-bold text-end">【内訳】買案件</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffSummary.sorted.map(([staff, stats]) => (
                                        <tr key={staff}>
                                            <td className="text-start ps-3 fw-bold text-dark">{staff}</td>
                                            <td className="text-end fw-bold fs-6 text-primary">{stats.count}</td>
                                            <td className="text-end fw-bold text-danger">{stats.pending}</td>
                                            <td className="text-end fw-bold text-success">{stats.contract}</td>
                                            <td className="text-end text-success">{calcRate(stats.contract, stats.count)}</td>
                                            <td className="text-end fw-bold text-muted">{stats.sell}</td>
                                            <td className="text-end fw-bold text-muted">{stats.buy}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-light border-top border-2">
                                        <td className="text-start ps-3 fw-bold text-dark">チーム合計</td>
                                        <td className="text-end fw-bold fs-6 text-primary">{staffSummary.total.count}</td>
                                        <td className="text-end fw-bold text-danger">{staffSummary.total.pending}</td>
                                        <td className="text-end fw-bold text-success">{staffSummary.total.contract}</td>
                                        <td className="text-end fw-bold text-success">{calcRate(staffSummary.total.contract, staffSummary.total.count)}</td>
                                        <td className="text-end fw-bold text-muted">{staffSummary.total.sell}</td>
                                        <td className="text-end fw-bold text-muted">{staffSummary.total.buy}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>

                    {/* 💡 メインリスト（反響一覧テーブル） */}
                    <div className="card shadow-sm border-0 rounded-3" style={{ minWidth: '1600px' }}>
                        <div className="card-header bg-white border-bottom-0 pt-3 pb-2 d-flex justify-content-between align-items-center">
                            <h6 className="fw-bold text-dark mb-0">進行中 商談・契約一覧</h6>
                            <span className="badge bg-light text-secondary border">{filteredLeads.length} 件</span>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive w-100">
                                <style>{`
                                    .table-generous th, .table-generous td {
                                        padding: 12px 16px !important;
                                        vertical-align: middle;
                                    }
                                `}</style>
                                <table className="table table-hover align-middle mb-0 text-center text-nowrap table-generous" style={{ fontSize: '11px' }}>
                                    <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <tr>
                                            <th className="text-secondary fw-bold">No.</th>
                                            <th className="text-secondary fw-bold text-start">物件名 / 所在地</th>
                                            <th className="text-secondary fw-bold">種別</th>
                                            <th className="text-secondary fw-bold text-end">物件価格</th>
                                            <th className="text-secondary fw-bold text-end">仲介手数料(見込)</th>
                                            <th className="text-secondary fw-bold">担当</th>
                                            <th className="text-secondary fw-bold">顧客名</th>
                                            <th className="text-secondary fw-bold">進捗フェーズ</th>
                                            <th className="text-secondary fw-bold">契約日</th>
                                            <th className="text-secondary fw-bold">決済予定日</th>
                                            <th className="text-secondary fw-bold">経過日数</th>
                                            <th className="text-secondary fw-bold text-start">備考</th>
                                            <th className="text-secondary fw-bold">書類</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.length > 0 ? (
                                            filteredLeads.slice(0, displayLimit).map((lead, index) => {
                                                const isSell = lead.kind === 'ledger';
                                                const customerName = isSell ? lead.seller : (lead.customer || lead.name);
                                                const price = isSell ? lead.price : lead.budget;
                                                const fee = calcBrokerageFee(price);

                                                // 経過日数は契約日があればそこから、なければ受信日から算出
                                                const baseDateForDays = lead.contractDate ? lead.contractDate : lead.receivedDate;

                                                return (
                                                    <tr key={lead.id}>
                                                        <td className="text-muted">{index + 1}</td>
                                                        <td className="text-start text-truncate" style={{ maxWidth: '250px' }} title={lead.targetProperty || lead.property || `${lead.addr1 || ''}${lead.addr2 || ''}`}>
                                                            {lead.targetProperty || lead.property || `${lead.addr1 || ''}${lead.addr2 || ''}`}
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${isSell ? 'bg-danger' : 'bg-primary'} bg-opacity-10 text-${isSell ? 'danger' : 'primary'} border border-${isSell ? 'danger' : 'primary'}`}>
                                                                {isSell ? '売' : '買'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end fw-bold text-dark">{formatYen(price ?? 0)}</td>
                                                        <td className="text-end fw-bold text-success">{formatYen(fee)}</td>
                                                        <td>{lead.staff || '―'}</td>
                                                        <td className="fw-bold">
                                                            <span
                                                                style={{ color: '#3182ce', textDecoration: 'underline dotted', cursor: 'pointer', fontSize: '12px' }}
                                                                onClick={() => handleNameClick(lead)}
                                                            >
                                                                {customerName || '―'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="fw-bold bg-light px-2 py-1 rounded border">{lead.phase || '―'}</span>
                                                        </td>
                                                        <td>{formatDate(lead.contractDate || '')}</td>
                                                        <td>{formatDate(lead.settleDate || '')}</td>
                                                        <td className="text-muted">{calcElapsedDays(baseDateForDays)}</td>
                                                        <td className="text-start text-truncate text-muted" style={{ maxWidth: '150px' }} title={lead.note || ''}>
                                                            {lead.note || '―'}
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }}
                                                                onClick={() => handleOpenDocument(lead)}>
                                                                <i className="fa-solid fa-file-contract me-1 text-secondary"></i>契約書
                                                            </button>
                                                            <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }}
                                                                onClick={() => setPlannerShow(true)}>
                                                                <i className="fa-solid fa-calculator me-1 text-secondary"></i>精算書
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={13} className="py-5 text-center text-muted">
                                                    該当する商談データが見つかりません。
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <LeadEdit
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveCustomerInfo}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                leadCategory={currentLeadCategory}
                staffList={staffList}
            />

            {/* 💡 DocumentViewerの組み込み */}
            <DocumentViewer
                documentShow={documentShow}
                setDocumentShow={setDocumentShow}
                initialData={currentInitialData}
            />
            <PlannerGenerator
                plannerShow={plannerShow}
                setPlannerShow={setPlannerShow}
            />
        </div>
    );
};

export default LeadOpportunity;