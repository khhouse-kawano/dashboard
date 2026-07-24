import React, {memo} from 'react';

type Maker = {
    label: string,
    letter: string
};

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    competitorsRef: React.RefObject<HTMLInputElement | null>,
    competitorsInput: string,
    handleCompetitorsDelete: () => void,
    handleCompetitors: (maker?: string) => void,
    setCompetitorsInput: React.Dispatch<React.SetStateAction<string>>,
    makerList: Maker[]
}
const TableCompetitor = ({ information, setInformation, competitorsRef, competitorsInput ,handleCompetitorsDelete, handleCompetitors, setCompetitorsInput, makerList}: Props) => {
    return (
        <>
            <div className="text-secondary" style={{ fontSize: '10px' }}>※予測変換リストを追加したい場合は広報・マーケティング課まで</div>
            <div className="d-flex align-items-stretch w-100 gap-2 mb-3">
                <div className="d-flex flex-wrap align-items-center flex-grow-1 p-1 bg-white border rounded shadow-sm" style={{ minHeight: '34px' }}>
                    {information.competitors_text && information.competitors_text.split(',')
                        .filter(c => c !== 'null' && c.trim() !== '')
                        .map((c, cIndex) => (
                            <div className={`badge border d-flex align-items-center me-1 my-1 px-2 py-1 shadow-sm bg-light text-secondary border-secondary`}
                                key={cIndex} style={{ fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onClick={() => setInformation(prev => ({
                                    ...prev,
                                    competitor_name: c === information.competitor_name ? '' : c
                                }))}>
                                {c}
                                <span className="ms-2 fw-bold"
                                    style={{ cursor: 'pointer', fontSize: '10px', opacity: 0.5 }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInformation(prev => {
                                            const arr = (prev.competitors_text ?? '').split(',').map(s => s.trim()).filter(s => s !== '' && s !== 'null');
                                            arr.splice(cIndex, 1);
                                            return {
                                                ...prev,
                                                competitors_text: arr.length ? arr.join(',') : '',
                                                competitor_name: prev.competitor_name === c ? '' : prev.competitor_name
                                            }
                                        });
                                    }}>
                                    ✕
                                </span>
                            </div>
                        ))}

                    <div className="position-relative flex-grow-1" style={{ minWidth: '120px' }}>
                        <input
                            type='text'
                            className="form-control form-control-sm border-0 shadow-none px-1"
                            style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                            placeholder={!information.competitors_text ? '競合他社名を入力...' : ''}
                            ref={competitorsRef}
                            value={competitorsInput}
                            onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !competitorsInput) {
                                    handleCompetitorsDelete();
                                }
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCompetitors();
                                }
                            }}
                            onChange={(e) => setCompetitorsInput(e.target.value)}
                        />

                        {competitorsInput && (
                            <div className="position-absolute bg-white border rounded shadow-sm w-100 py-1"
                                style={{ top: '100%', left: 0, marginTop: '2px', zIndex: 1050, maxHeight: '200px', overflowY: 'auto' }}>
                                {makerList.map((m, mIndex) => (
                                    <div key={mIndex}
                                        className="px-2 py-1 text-dark"
                                        style={{ cursor: 'pointer', fontSize: '12px' }}
                                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-light')}
                                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-light')}
                                        onClick={() => handleCompetitors(m.label)}
                                    >
                                        {m.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    className="btn btn-primary btn-sm shadow-sm px-3 text-nowrap"
                    onClick={() => handleCompetitors()}
                >
                    追加
                </button>
            </div></>
    )
}

export default memo(TableCompetitor, (prevProps, nextProps) => {
    if (prevProps.competitorsInput !== nextProps.competitorsInput) return false;

    const fieldsToCheck = [
        'competitors_text',
        'competitor_name'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.makerList !== nextProps.makerList) return false;

    return true; 
});