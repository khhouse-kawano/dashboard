import React from 'react';

// ==========================================
// 💡 型定義
// ==========================================
type Props = {
    selectedMonth: string;
    setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
    availableMonths: string[];
    handleAddClick: () => void;
    isAdding: boolean;
    headerLabel: {
        title: string;
        describe: string;
    };
};

// ==========================================
// 💡 コンパクトな共通スタイル
// ==========================================
const customStyles = {
    headerWrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottom: '1px solid #dee2e6',
        paddingBottom: '12px',
        marginBottom: '16px',
        width: '100%',
    } as React.CSSProperties,
    
    titleArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '4px',
    } as React.CSSProperties,
    
    titleText: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#495057',
        letterSpacing: '0.5px',
        margin: 0,
    } as React.CSSProperties,
    
    selectBox: {
        width: '140px',
        height: '26px',
        fontSize: '11px',
        padding: '2px 24px 2px 8px', // 右側は矢印アイコン用の余白
        border: '1px solid #0d6efd',
        borderRadius: '4px',
        color: '#0d6efd',
        backgroundColor: '#fff',
        fontWeight: 'bold',
        outline: 'none',
        cursor: 'pointer',
    } as React.CSSProperties,

    describeText: {
        fontSize: '11px',
        color: '#6c757d',
        margin: 0,
    } as React.CSSProperties,

    primaryBtn: {
        backgroundColor: '#0d6efd',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '0 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        height: '26px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        opacity: 1,
    } as React.CSSProperties,
};

const LeadHeader: React.FC<Props> = ({ 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths, 
    handleAddClick, 
    isAdding, 
    headerLabel 
}) => {
    return (
        <div style={customStyles.headerWrapper}>
            <div>
                <div style={customStyles.titleArea}>
                    <h1 style={customStyles.titleText}>
                        <i className="bi bi-house-door me-2" style={{ color: '#0d6efd' }}></i>
                        {headerLabel.title}
                    </h1>
                    
                    {/* form-selectクラスはドロップダウンの矢印UIを維持するために残しつつ、スタイルを上書き */}
                    <select
                        className="form-select shadow-sm"
                        style={customStyles.selectBox}
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        <option value="">全期間</option>
                        {availableMonths.map(m => {
                            const [y, mon] = m.split('-');
                            return <option key={m} value={m}>{`${y}年${Number(mon)}月 受信分`}</option>;
                        })}
                    </select>
                </div>
                
                <p style={customStyles.describeText}>
                    {headerLabel.describe}
                </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                    className="shadow-sm" 
                    style={{ ...customStyles.primaryBtn, opacity: isAdding ? 0.6 : 1, cursor: isAdding ? 'not-allowed' : 'pointer' }} 
                    onClick={handleAddClick} 
                    disabled={isAdding}
                >
                    <i className="bi bi-plus-lg"></i> 反響を追加
                </button>
            </div>
        </div>
    );
}

export default LeadHeader;