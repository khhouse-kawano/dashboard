import React from 'react'

type Props = {
    selectedMonth: string,
    setSelectedMonth: React.Dispatch<React.SetStateAction<string>>,
    availableMonths: string[],
    handleAddClick: () => void,
    isAdding: boolean,
    headerLabel: {
        title: string,
        describe: string
    }
};


const LeadHeader = ({ selectedMonth, setSelectedMonth, availableMonths, handleAddClick, isAdding, headerLabel }: Props) => {
    return (
        <>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <div>
                    <h4 className="fw-bold text-secondary mb-2 d-flex align-items-center gap-3" style={{ letterSpacing: '1px' }}>
                        <div><i className="bi bi-house-door me-2 text-primary"></i>{headerLabel.title}</div>
                        <select
                            className="form-select form-select-sm shadow-sm border-primary fw-bold text-primary"
                            style={{ width: '160px', cursor: 'pointer', fontSize: '14px' }}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            <option value="">全期間</option>
                            {availableMonths.map(m => {
                                const [y, mon] = m.split('-');
                                return <option key={m} value={m}>{`${y}年${Number(mon)}月 受信分`}</option>
                            })}
                        </select>
                    </h4>
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        {headerLabel.describe}
                    </div>
                </div>
                <div className="d-flex gap-2 mt-3 mt-md-0">
                    <button className="btn btn-primary shadow-sm btn-sm fw-bold" onClick={handleAddClick} disabled={isAdding}>
                        <i className="bi bi-plus-lg me-1"></i>反響を追加
                    </button>
                </div>
            </div></>
    )
}

export default LeadHeader