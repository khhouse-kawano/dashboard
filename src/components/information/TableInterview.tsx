import React, { memo, useState, useEffect, useContext } from 'react';
import TableInput from './TableInput';
import { inputStyle, toHalfWidth, dateFormate, actionButton, safeFormate } from '../../utils/informationUtils';
import AuthContext from '../../context/AuthContext';

type InterviewAction = {
    day: string;
    action: string;
    note: string;
    staff: string;
};

type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: Boolean
};

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    interviewLog: InterviewLog,
    setInterviewLog: React.Dispatch<React.SetStateAction<InterviewLog>>,
    actionMap: Record<string, string>,
    interview: InterviewAction,
    setInterview: React.Dispatch<React.SetStateAction<InterviewAction>>,
    userName: string
};

const getMigratedAction = (actionStr: string) => {
    if (!actionStr) return '';
    const baseAction = actionStr.split(',')[0];

    switch (baseAction) {
        case '物件案内':
            return '初回面談';
        case '事前取得（現金確認含む）':
        case 'ローン事前承認済み':
            return '2回目以降面談';
        case '次回アクション':
            return '';
        default:
            return actionStr;
    }
};

const getDisplayNote = (actionStr: string, noteStr: string) => {
    if (!actionStr) return noteStr || '';
    const baseAction = actionStr.split(',')[0];
    const mappedActionStr = getMigratedAction(actionStr);
    const mappedBase = mappedActionStr ? mappedActionStr.split(',')[0] : '';

    // 旧KPIであり、新しいKPIに丸め込まれている場合
    if (baseAction !== mappedBase && baseAction !== '') {
        const prefix = `${baseAction}\n`;
        // 何度も同じプレフィックスが付くのを防ぐ
        if (!(noteStr || '').includes(`${baseAction}`)) {
            return prefix + (noteStr || '');
        }
    }
    return noteStr || '';
};

const TableInterview = ({ information, setInformation, interviewLog, setInterviewLog, actionMap, interview, setInterview, userName }: Props) => {
    const { category } = useContext(AuthContext);
    const [interviewSort, setInterviewSort] = useState('asc');

    const stars = ['売買契約', '媒介取得', 'リフォーム契約'];

    const [localValue, setLocalValue] = useState(information.contraction_contract_price ?? '');
    useEffect(() => {
        setLocalValue(information.contraction_contract_price ?? '');
    }, [information.contraction_contract_price]);

    const [localDetailValue, setLocalDetailValue] = useState(information.additional_contraction_contract_price ?? '');
    useEffect(() => {
        setLocalDetailValue(information.additional_contraction_contract_price ?? '');
    }, [information.additional_contraction_contract_price]);

    const registerAction = () => (
        <>
            {interviewSort === 'desc' && actionIcon()}
            <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                <div>
                    <TableInput information={information} setInformation={setInformation} itemKey='step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'
                        type='date' />
                </div>
                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                    <select style={inputStyle} disabled>
                        <option value="反響取得">反響取得</option>
                    </select>
                </div>
                <div className="ms-2">
                    {information.sales_promotion_name}からの反響取得</div>
                {information.reserved_interview && <div className="ms-3 d-flex align-items-center">
                    <div>来場予約日</div>
                    <div>
                        <TableInput information={information} setInformation={setInformation} itemKey='reserved_interview'
                            type='date' />
                    </div>
                </div>}
            </div>
            {interviewSort === 'asc' && actionIcon()}
        </>
    );

    const newAction = () => (
        <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
            <div>
                <input type="date" style={inputStyle} value={dateFormate(interview.day)}
                    onChange={(e) => setInterview(prev => ({
                        ...prev,
                        day: e.target.value
                    }))} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                <select style={{
                    ...inputStyle,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                }}
                    title={interview.action || "アクション内容"}
                    onChange={(e) => {
                        const formattedValue = e.target.value.split(',')[0] ?? e.target.value;
                        setInterview(prev => ({
                            ...prev,
                            action: e.target.value,
                            note: e.target.value.includes('契約') ? '契約' : prev.note
                        }));
                        const key = actionMap[formattedValue];
                        if (key) {
                            setInformation(prev => ({
                                ...prev,
                                [key]: interview.day
                            }));
                        }

                        if (formattedValue === '自社契約' || formattedValue === '仲介契約') {
                            const property = e.target.value.split(',')[1];
                            setInformation(prev => ({
                                ...prev,
                                property_contract_name: property
                            }));
                        }
                    }}>
                    <option value="">アクション内容</option>
                    {Object.keys(actionMap).map(item => {
                        if ((item === '自社契約' || item === '仲介契約') && information.property_name) {
                            return information.property_name.split(',').map((property, pIndex) =>
                                <option value={`${item},${property}`} key={pIndex}>{item}({property})</option>)
                        }
                        return <option value={item} key={item}>{(stars.includes(item) && category === 'used') && '★'}{item}</option>
                    }
                    )}
                </select>
            </div>
            <div>
                <textarea value={interview.note} style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載'
                    onChange={(e) => setInterview(prev => ({
                        ...prev,
                        note: e.target.value
                    }))} ></textarea></div>
            <div className="text-primary" style={actionButton}
                onClick={() => {
                    if (!interview.day || !interview.action) {
                        alert('未入力の項目があります');
                        return;
                    };
                    setInterviewLog(prev => ({
                        ...prev,
                        id: information.id,
                        name: information.customer_contacts_name,
                        status: information.call_status,
                        interview_log: [
                            ...prev.interview_log,
                            { day: interview.day, action: interview.action, note: interview.note, staff: userName }
                        ],
                        add: true
                    }));
                    const key = actionMap[interview.action];
                    if (key && !information[key]) {
                        setInformation(prev => ({
                            ...prev,
                            [key]: interview.day
                        }));
                    }
                    setInterview({
                        day: '', action: '', note: '', staff: ''
                    });
                }
                }>追加</div>
        </div>
    )

    const actionIcon = () => (
        <div style={{ color: '#868686ff', marginBottom: '7px' }}>
            {interviewSort === 'desc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-up"></i>
            </div>}
            <div style={{ textAlign: 'center' }}>
                <i className="fa-solid fa-file-pen"></i>
            </div>
            {interviewSort === 'asc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-down"></i>
            </div>}
        </div>
    );

    return (
        <>
            <div
                className="text-primary text-center mb-3"
                style={{ ...actionButton, width: '75px', cursor: 'pointer' }}
                onClick={() => setInterviewSort(interviewSort === 'asc' ? 'desc' : 'asc')}
            >
                <i
                    className={`fas ${interviewSort === 'asc' ? 'fa-arrow-down' : 'fa-arrow-up'}`}
                    style={{ marginRight: '5px' }}
                ></i>
                {interviewSort === 'asc' ? '古い順' : '新しい順'}
            </div>
            {interviewSort === 'desc' && newAction()}
            {interviewSort === 'asc' && registerAction()}
            {interviewLog.interview_log &&
                interviewLog.interview_log
                    .sort((a, b) => {
                        const dayA = new Date(a.day).getTime();
                        const dayB = new Date(b.day).getTime();
                        return interviewSort === 'asc' ? dayA - dayB : dayB - dayA;
                    })
                    .map((item, index) => {
                        const displayNote = getDisplayNote(item.action, item.note);

                        return (
                            <React.Fragment key={index}>
                                {interviewSort === 'desc' && actionIcon()}
                                <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                    <div>
                                        <input type="date" value={dateFormate(item.day)} style={inputStyle}
                                            onChange={(e) => {
                                                setInterviewLog(prev => ({
                                                    ...prev,
                                                    add: true,
                                                    interview_log: prev.interview_log.map((log, i) => i === index ?
                                                        { ...log, day: e.target.value } : log)
                                                }));
                                                const mappedAction = getMigratedAction(item.action);
                                                const key = actionMap[mappedAction.split(',')[0]];
                                                if (key) {
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        [key]: e.target.value
                                                    }));
                                                }
                                            }} />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                        <div>
                                            <select style={{
                                                ...inputStyle,
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden'
                                            }}
                                                title={item.action || "アクション内容"}
                                                onChange={(e) => {
                                                    const newActionValue = e.target.value;

                                                    const mappedOldAction = getMigratedAction(item.action);
                                                    const oldFormattedValue = mappedOldAction.split(',')[0] ?? mappedOldAction;
                                                    const oldKey = actionMap[oldFormattedValue];

                                                    const newFormattedValue = newActionValue.split(',')[0] ?? newActionValue;
                                                    const newKey = actionMap[newFormattedValue];

                                                    setInterviewLog(prev => ({
                                                        ...prev,
                                                        add: true,
                                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                                            { ...log, action: newActionValue } : log)
                                                    }));

                                                    setInformation(prev => {
                                                        const updated = { ...prev };
                                                        if (oldKey) {
                                                            updated[oldKey] = '';
                                                        }
                                                        if (newKey) {
                                                            updated[newKey] = item.day;
                                                        }
                                                        return updated;
                                                    });

                                                    if (newFormattedValue === '自社契約' || newFormattedValue === '仲介契約') {
                                                        const property = newActionValue.split(',')[1];
                                                        setInformation(prev => ({
                                                            ...prev,
                                                            property_contract_name: property
                                                        }));
                                                    }
                                                }}
                                                value={getMigratedAction(item.action)}>
                                                <option value="">アクション内容</option>
                                                {Object.keys(actionMap).map(actionItem => {
                                                    if ((actionItem === '自社契約' || actionItem === '仲介契約') && information.property_name) {
                                                        return information.property_name.split(',').map((property, pIndex) =>
                                                            <option value={`${actionItem},${property}`} key={pIndex}>{actionItem}({property})</option>)
                                                    }
                                                    return <option value={actionItem} key={actionItem}>{(stars.includes(actionItem) && category === 'used') && '★'}{actionItem}</option>
                                                }
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <textarea style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載'
                                            value={displayNote}
                                            rows={Math.max(2, displayNote.split('\n').length, Math.ceil(displayNote.length / 50))}
                                            onChange={(e) => setInterviewLog(prev => ({
                                                ...prev,
                                                add: true,
                                                interview_log: prev.interview_log.map((log, i) => i === index ?
                                                    { ...log, note: e.target.value } : log)
                                            }))}></textarea>
                                    </div>
                                    <div className="text-danger" style={actionButton}
                                        onClick={() => {
                                            const mappedAction = getMigratedAction(item.action);
                                            const formattedValue = mappedAction.split(',')[0] ?? mappedAction;
                                            const key = actionMap[formattedValue];

                                            setInformation(prev => ({
                                                ...prev,
                                                [key]: ''
                                            }));
                                            setInterviewLog(prev => ({
                                                ...prev,
                                                add: true,
                                                interview_log: prev.interview_log.filter((_, i) => i !== index)
                                            }));
                                        }}>削除</div>
                                </div>
                                {interviewSort === 'asc' && actionIcon()}
                            </React.Fragment>
                        );
                    })}
            {interviewSort === 'asc' && newAction()}
            {interviewSort === 'desc' && registerAction()}
            {category === 'used' && <div className="d-flex align-items-center mt-4" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                <div className='me-2'>
                    契約内容
                </div>
                <div className='me-2'>
                    <input
                        type="text"
                        inputMode="numeric"
                        style={inputStyle}
                        placeholder='予算額'
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value);
                        }}
                        onBlur={() => {
                            let finalValue = localValue;
                            const halfValue = toHalfWidth(finalValue);
                            finalValue = halfValue.replace(/[^0-9-.,]/g, '');

                            setLocalValue(finalValue);
                            setInformation(prev => ({
                                ...prev,
                                contraction_contract_price: finalValue
                            }));
                        }}
                    />万円
                </div>
                <div>
                    <textarea
                        style={{ ...inputStyle, width: '550px', height: 'auto' }}
                        placeholder='予算詳細'
                        value={localDetailValue}
                        onChange={(e) => {
                            setLocalDetailValue(e.target.value);
                        }}
                        onBlur={() => {
                            setInformation(prev => ({
                                ...prev,
                                additional_contraction_contract_price: localDetailValue
                            }));
                        }}
                    ></textarea>
                </div>
            </div>}
        </>
    )
}

export default memo(TableInterview, (prevProps, nextProps) => {
    if (prevProps.interview !== nextProps.interview) return false;
    if (prevProps.interviewLog !== nextProps.interviewLog) return false;

    const fieldsToCheck = [
        'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
        'sales_promotion_name',
        'reserved_interview',
        'property_name',
        'property_tour_name',
        'id',
        'customer_contacts_name',
        'call_status',
        'contraction_contract_price',
        'additional_contraction_contract_price'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    return true;
});