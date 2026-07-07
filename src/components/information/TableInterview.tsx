import React, { memo, useState } from 'react';
import TableInput from './TableInput';
import { inputStyle } from '../../utils/informationUtils';
import { dateFormate } from '../../utils/informationUtils';
import { actionButton } from '../../utils/informationUtils';

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

const TableInterview = ({ information, setInformation, interviewLog, setInterviewLog, actionMap, interview, setInterview, userName }: Props) => {
    const [interviewSort, setInterviewSort] = useState('asc');

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
                <select style={inputStyle}
                    onChange={(e) => {
                        const formattedValue = e.target.value.includes('物件案内') ? '物件案内' : e.target.value;
                        setInterview(prev => ({
                            ...prev,
                            action: e.target.value,
                            note: e.target.value === '契約' ? '契約' : prev.note
                        }));
                        const key = actionMap[formattedValue];
                        if (key) {
                            setInformation(prev => ({
                                ...prev,
                                [key]: interview.day
                            }));
                        }
                        if (formattedValue === '物件案内') {
                            const property = e.target.value.split(',')[1];
                            const newArray = information.property_tour_name ? information.property_tour_name.split(',') : [];
                            setInformation(prev => ({
                                ...prev,
                                property_tour_name: [...newArray, property].join(',')
                            }))
                        }
                    }}>
                    <option value="">アクション内容</option>
                    {Object.keys(actionMap).map(item => {
                        if (item === '物件案内' && information.property_name) {
                            return information.property_name.split(',').map((property, pIndex) =>
                                <option value={`物件案内,${property}`} key={pIndex}>物件案内({property})</option>)
                        }
                        return <option value={item} key={item}>{item}</option>
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
                    .map((item, index) => <>
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
                                        const key = actionMap[item.action];
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
                                    <select style={inputStyle}
                                        onChange={(e) => {
                                            const formattedValue = e.target.value.includes('物件案内') ? '物件案内' : e.target.value;
                                            setInterviewLog(prev => ({
                                                ...prev,
                                                add: true,
                                                interview_log: prev.interview_log.map((log, i) => i === index ?
                                                    { ...log, action: e.target.value } : log)
                                            }));
                                            const key = actionMap[formattedValue];
                                            if (key) {
                                                setInformation(prev => ({
                                                    ...prev,
                                                    [key]: item.day
                                                }));
                                            }
                                            if (formattedValue === '物件案内') {
                                                const property = e.target.value.split(',')[1];
                                                const newArray = information.property_tour_name ? information.property_tour_name.split(',') : []; setInformation(prev => ({
                                                    ...prev,
                                                    property_tour_name: [...newArray, property].join(',')
                                                }))
                                            }
                                        }}
                                        value={item.action}>
                                        <option value="">アクション内容</option>
                                        {Object.keys(actionMap).map(item => {
                                            if (item === '物件案内' && information.property_name) {
                                                return information.property_name.split(',').map((property, pIndex) =>
                                                    <option value={`物件案内,${property}`} key={pIndex}>物件案内({property})</option>)
                                            }
                                            return <option value={item} key={item}>{item}</option>
                                        }
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <textarea style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載' value={item.note} rows={Math.max(2, item.note.length / 50)}
                                    onChange={(e) => setInterviewLog(prev => ({
                                        ...prev,
                                        add: true,
                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                            { ...log, note: e.target.value } : log)
                                    }))}></textarea>
                            </div>
                            <div className="text-danger" style={actionButton}
                                onClick={() => {
                                    const key = actionMap[item.action];
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
                    </>)}
            {interviewSort === 'asc' && newAction()}
            {interviewSort === 'desc' && registerAction()}
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
        'call_status'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    return true;
});