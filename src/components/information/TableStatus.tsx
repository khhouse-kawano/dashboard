import React, { memo, useContext } from 'react';
import { safeFormate } from '../../utils/informationUtils';
import { inputStyle } from '../../utils/informationUtils';
import AuthContext from '../../context/AuthContext';

type Maker = {
    label: string,
    letter: string
};

type Props = {
    information: Record<string, string>
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    setShowLostReason: React.Dispatch<React.SetStateAction<boolean>>,
    competitorsRef: React.RefObject<HTMLInputElement | null>,
    competitorsInput: string,
    handleCompetitorsDelete: () => void,
    handleCompetitors: (maker?: string) => void,
    setCompetitorsInput: React.Dispatch<React.SetStateAction<string>>,
    makerList: Maker[]
}

const TableStatus = ({ information, setInformation, idMapping, setShowLostReason, competitorsRef, competitorsInput, handleCompetitorsDelete, handleCompetitors, setCompetitorsInput, makerList }: Props) => {
    const { category } = useContext(AuthContext);

    return (
        <>
            {/* 1. ステータス選択エリア */}
            <div className="d-flex align-items-center mb-2">
                <select style={inputStyle} value={safeFormate(information[idMapping('ステータス')])}
                    onChange={(e) => {
                        setInformation(prev => (
                            {
                                ...prev,
                                [idMapping('ステータス')]: e.target.value
                            }
                        ));
                        if (e.target.value === '失注') setShowLostReason(true);
                    }}>
                    {category === 'spec' ?
                        <>
                            <option value="見込み">見込み</option>
                            <option value="追客中">追客中</option>
                            <option value="接触（通話・返信）">接触（通話・返信）</option>
                            <option value="来店あり">来店あり</option>
                            <option value="申込み済み">申込み済み</option>
                            <option value="事前取得（現金確認含む）">事前取得（現金確認含む）</option>
                            <option value="契約済み">契約済み</option>
                            <option value="アポイント確定">アポイント確定</option>
                        </> : <>
                            <option value='見込み'>見込み</option>
                            <option value='会社管理'>会社管理</option>
                            <option value='失注'>失注</option>
                            <option value='重複'>重複</option>
                            <option value='契約済み'>契約済み</option>
                            <option value="解約">解約</option></>}
                </select>
            </div>

            {information[idMapping('ステータス')] === '失注' && (
                <div className="bg-light p-3 rounded border mt-2">

                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>失注情報の入力{!information.competitor_lost_contract_reason && <i className="fa-solid fa-triangle-exclamation text-danger me-1"></i>}</div>
                    </div>

                    <div className="mb-3 d-flex align-items-center">
                        <span className="me-3 fw-bold text-secondary" style={{ fontSize: '12px' }}>失注理由:</span>
                        <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information.competitor_lost_contract_reason)}
                            onChange={(e) => {
                                setInformation(prev => ({ ...prev, competitor_lost_contract_reason: e.target.value }));
                            }}>
                            <option value="">選択してください</option>
                            {["競合負け", "計画中止", "身内の反対", "音信不通", "建築エリア外", "その他"].map(reason => (
                                <option value={reason} key={reason}>{reason}</option>
                            ))}
                        </select>
                    </div>

                    {information.competitor_lost_contract_reason === '競合負け' && (
                        <>
                            <div className="d-flex flex-wrap align-items-center mb-3 p-2 bg-white rounded border" style={{ fontSize: '12px' }}>
                                <span className="fw-bold me-3 text-secondary">失注先{information.competitor_name ? ':' : 'を選択'}</span>
                                {information.competitors_text ? (
                                    information.competitors_text.split(',')
                                        .filter(c => c !== 'null' && c.trim() !== '')
                                        .map((c, cIndex) => (
                                            <div className={`me-2 mb-1 px-2 py-1 rounded border ${information.competitor_name === c ? 'bg-warning border-warning fw-bold text-dark' : 'bg-light text-secondary'}`}
                                                key={cIndex}
                                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                onClick={() => setInformation(prev => ({
                                                    ...prev,
                                                    competitor_name: c === information.competitor_name ? '' : c
                                                }))}>
                                                {c}
                                            </div>
                                        ))
                                ) : (
                                    <div className="d-flex align-items-center flex-grow-1 mt-1 mt-md-0">
                                        <div className="position-relative flex-grow-1 me-2">
                                            <input
                                                type='text'
                                                className="form-control form-control-sm border-0 shadow-none px-1"
                                                style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                                                placeholder={!information.competitors_text ? '競合他社名を入力...' : ''}
                                                ref={competitorsRef} // 👈 Backspaceの判定などで使うため残しておいてOKです

                                                value={competitorsInput || ''} // 🌟 👈 ココを追加！！（ReactのStateと同期させる）

                                                onKeyDown={(e) => {
                                                    // 入力欄が空の状態でBackspaceを押した時の処理
                                                    if (e.key === 'Backspace' && !competitorsInput) {
                                                        handleCompetitorsDelete();
                                                    }
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault(); // Enterキーでの意図しない画面リロードを防止
                                                        handleCompetitors();
                                                    }
                                                }}
                                                onChange={(e) => setCompetitorsInput(e.target.value)}
                                            />

                                            {competitorsInput && (
                                                <div className="position-absolute bg-white border rounded shadow-sm w-100 py-1"
                                                    style={{ top: '100%', left: 0, marginTop: '2px', zIndex: 1000, maxHeight: '150px', overflowY: 'auto' }}>
                                                    {makerList.map((m, mIndex) => (
                                                        <div key={mIndex}
                                                            className="px-2 py-1 text-dark"
                                                            style={{ cursor: 'pointer', fontSize: '12px' }}
                                                            onMouseEnter={(e) => e.currentTarget.classList.add('bg-light')}
                                                            onMouseLeave={(e) => e.currentTarget.classList.remove('bg-light')}
                                                            onClick={() => {
                                                                handleCompetitors(m.label);
                                                                setInformation(prev => ({
                                                                    ...prev,
                                                                    competitor_name: m.label
                                                                }));
                                                            }}
                                                        >
                                                            {m.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            className="btn btn-primary btn-sm text-nowrap shadow-sm px-3"
                                            onClick={() => handleCompetitors()}
                                        >
                                            追加
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="fw-bold mb-2 text-secondary mt-3" style={{ fontSize: '12px' }}>詳細な他決・失注理由（複数選択可）</div>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {['価格・予算', '間取り・プラン提案', 'デザイン・外観', '性能', '土地・立地条件（他社物件）', '営業の対応（スピード・相性）', '保証・アフターサポート', '会社のブランド・信頼性', '縁戚・知人の紹介', 'その他'].map(reason => {
                                    const currentReasons = information.customized_input_01JRF9CZSW65A151WR30NA4PB3
                                        ? String(information.customized_input_01JRF9CZSW65A151WR30NA4PB3).split(',')
                                        : [];
                                    const isChecked = currentReasons.includes(reason);

                                    return (
                                        <div key={reason} className="form-check form-check-inline m-0">
                                            <input
                                                className="form-check-input shadow-sm"
                                                type="checkbox"
                                                id={`detail-reason-${reason}`}
                                                checked={isChecked}
                                                onChange={() => {
                                                    let newArray = [...currentReasons];
                                                    if (isChecked) {
                                                        newArray = newArray.filter(r => r !== reason);
                                                    } else {
                                                        newArray.push(reason);
                                                    }
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        customized_input_01JRF9CZSW65A151WR30NA4PB3: newArray.filter(Boolean).join(',')
                                                    }));
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <label
                                                className="form-check-label text-dark"
                                                htmlFor={`detail-reason-${reason}`}
                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                {reason}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            <textarea
                                placeholder='具体的な理由や詳細を入力してください（他社名、金額差など）'
                                style={{ fontSize: '12px', borderRadius: '5px', border: '1px solid #cfcfcf', width: '100%', height: '60px', padding: '8px', resize: 'none' }}
                                value={safeFormate(information.customized_input_01JSE7H4MQES619NBWX6PQDFRH)}
                                onChange={(e) => setInformation(prev => ({
                                    ...prev,
                                    customized_input_01JSE7H4MQES619NBWX6PQDFRH: e.target.value
                                }))}
                            ></textarea>
                        </>
                    )}
                </div>
            )}</>
    )
}

export default memo(TableStatus, (prevProps, nextProps) => {
    const statusKey = prevProps.idMapping('ステータス');

    const fieldsToCheck = [
        statusKey,
        'competitor_lost_contract_reason',
        'competitors_text',
        'competitor_name',
        'customized_input_01JRF9CZSW65A151WR30NA4PB3',
        'customized_input_01JSE7H4MQES619NBWX6PQDFRH'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.competitorsInput !== nextProps.competitorsInput) return false;
    if (prevProps.makerList !== nextProps.makerList) return false;

    return true;
});