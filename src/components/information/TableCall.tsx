import React, { memo, useState } from 'react';
import { inputStyle } from '../../utils/informationUtils';
import { actionButton } from '../../utils/informationUtils';
import { safeFormate, dateFormate } from '../../utils/informationUtils';

type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string,
    status: string
};
type CallLog = {
    id: string;
    shop: string;
    staff: string;
    name: string;
    status: string;
    reserved_status: string;
    call_log: CallAction[];
    add: Boolean;
};
type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    callLog: CallLog,
    setCallLog: React.Dispatch<React.SetStateAction<CallLog>>,
    interviewer: string,
    call: CallAction,
    setCall: React.Dispatch<React.SetStateAction<CallAction>>
};

const actions = ['通電', '未通電', 'SMS送信', 'メール送信', '資料郵送', '次回架電日'];

const TableCall = ({ information, setInformation, callLog, setCallLog, interviewer, call, setCall }: Props) => {
    const [callSort, setCallSort] = useState('asc');

    const newCall = () => (
        <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
            <div className="">
                <input type="date" style={inputStyle} value={call.day}
                    onChange={(e) => setCall(prev => ({
                        ...prev,
                        day: e.target.value, staff: interviewer
                    }))} />
            </div>
            <div className="">
                <input type="time" step="60" style={inputStyle} value={call.time}
                    onChange={(e) => setCall(prev => ({
                        ...prev,
                        time: e.target.value, staff: interviewer
                    }))} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                <select style={inputStyle}
                    onChange={(e) => setCall(prev => ({
                        ...prev,
                        action: e.target.value, staff: interviewer
                    }))}
                    value={call.action}>
                    <option value="">アクション内容</option>
                    {actions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
            </div>
            <div className="">
                <textarea value={call.note} style={{ ...inputStyle, width: '360px' }} placeholder='アクション内容・ヒアリング内容を記載'
                    onChange={(e) => setCall(prev => ({
                        ...prev,
                        note: e.target.value, staff: interviewer
                    }))} ></textarea></div>
            <div className="text-primary" style={actionButton}
                onClick={() => {
                    if (!call.day && !call.action && !call.note) {
                        alert('未入力の項目があります');
                        return;
                    };
                    setCallLog(prev => ({
                        ...prev,
                        id: information.id,
                        name: information.customer_contacts_name,
                        staff: interviewer,
                        status: information.call_status,
                        call_log: [
                            ...prev.call_log,
                            { day: call.day, time: call.time, action: call.action, note: call.note, staff: call.staff, status: information.status }
                        ],
                        add: true
                    }));
                    setCall({
                        status: '', day: '', time: '', action: '', note: '', staff: ''
                    });
                }
                }>追加</div>
        </div>
    );

    const callAction = (index: number) => (
        <div style={{ color: '#868686ff', marginBottom: '7px' }}>
            {callSort === 'desc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-up"></i>
            </div>}
            <div style={{ textAlign: 'center' }}>
                {callLog.call_log[index]['action'] === '架電' && <i className="fa-solid fa-phone-volume"></i>}
                {callLog.call_log[index]['action'] === 'SMS送信' && <i className="fa-solid fa-message"></i>}
                {callLog.call_log[index]['action'] === 'メール送信' && <i className="fa-solid fa-envelope"></i>}
                {callLog.call_log[index]['action'] === '資料郵送' && <i className="fa-solid fa-truck"></i>}
            </div>
            {callSort === 'asc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-down"></i>
            </div>}
        </div>
    );

    return (
        <>
            <div className="d-flex align-items-center mb-2">
                <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電ステータス</div>
                <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                    <select style={inputStyle}
                        onChange={(e) => {
                            setInformation(prev => (
                                {
                                    ...prev,
                                    call_status: e.target.value
                                }
                            ));
                            setCallLog(prev => ({
                                ...prev,
                                status: e.target.value
                            }));
                        }}
                        value={information.call_status}>
                        <option value="">架電ステータスを選択</option>
                        <option value="未通電">未通電</option>
                        <option value="継続">継続</option>
                        <option value="来場アポ">来場アポ</option>
                        <option value="来場済み">来場済み</option>
                        <option value="架電停止">架電停止</option>
                    </select>
                </div>
                <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>来場予定日</div>
                <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                    <input type="date" style={inputStyle} value={callLog.reserved_status ? callLog.reserved_status : ''}
                        onChange={(e) => setCallLog(prev => ({
                            ...prev,
                            reserved_status: e.target.value
                        }))} />
                </div>
            </div>
            <div style={{ padding: '15px', border: '1px solid #dddddda9', borderRadius: '7px' }}>
                <div className="mb-3">
                    <textarea style={{ ...inputStyle, width: '93%', height: 'auto' }} placeholder='架電用メモ欄' value={safeFormate(information.memo_other_related_person)} rows={Math.max(2, safeFormate(information.memo_other_related_person).length / 50)}
                        onChange={(e) => setInformation(prev => ({
                            ...prev,
                            memo_other_related_person: e.target.value
                        }))}></textarea>
                </div>
                <div
                    className="text-primary text-center mb-3"
                    style={{ ...actionButton, width: '75px', cursor: 'pointer' }}
                    onClick={() => setCallSort(callSort === 'asc' ? 'desc' : 'asc')}
                >
                    <i
                        className={`fas ${callSort === 'asc' ? 'fa-arrow-down' : 'fa-arrow-up'}`}
                        style={{ marginRight: '5px' }}
                    ></i>
                    {callSort === 'asc' ? '古い順' : '新しい順'}
                </div>
                {callSort === 'desc' && newCall()}
                {callLog.call_log &&
                    callLog.call_log
                        .sort((a, b) => {
                            const dayA = new Date(dateFormate(a.day)).getTime();
                            const dayB = new Date(dateFormate(b.day)).getTime();
                            return callSort === 'asc' ? dayA - dayB : dayB - dayA
                        })
                        .map((item, index) => <>
                            {callSort === 'desc' && callAction(index)}
                            <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                <div className="">
                                    <input type="date" value={item.day} style={inputStyle}
                                        onChange={(e) => setCallLog(prev => ({
                                            ...prev,
                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                { ...log, day: e.target.value, staff: interviewer } : log)
                                        }))} />
                                </div>
                                <div className="">
                                    <input type="time" value={item.time} style={inputStyle}
                                        onChange={(e) => setCallLog(prev => ({
                                            ...prev,
                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                { ...log, time: e.target.value, staff: interviewer } : log)
                                        }))} />
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                    <select style={inputStyle} value={item.action}
                                        onChange={(e) => setCallLog(prev => ({
                                            ...prev,
                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                { ...log, action: e.target.value, staff: interviewer } : log)
                                        }))}>
                                        <option value="">アクション内容</option>
                                        {actions.map(item => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <textarea style={{ ...inputStyle, width: '360px', height: 'auto' }} placeholder='アクション内容・ヒアリング内容を記載' value={item.note} rows={Math.max(2, item.note.length / 50)}
                                        onChange={(e) => setCallLog(prev => ({
                                            ...prev,
                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                { ...log, note: e.target.value, staff: interviewer } : log)
                                        }))}></textarea>
                                </div>
                                <div className="text-danger" style={actionButton}
                                    onClick={() => {
                                        setCallLog(prev => ({
                                            ...prev,
                                            call_log: prev.call_log.filter((_, i) => i !== index),
                                            add: true
                                        }));
                                    }}>削除</div>
                            </div>
                            {callSort === 'asc' && callAction(index)}
                        </>)}
                {callSort === 'asc' && newCall()}
            </div></>
    )
}

export default memo(TableCall, (prevProps, nextProps) => {
    if (prevProps.call !== nextProps.call) return false;
    if (prevProps.callLog !== nextProps.callLog) return false;

    const fieldsToCheck = [
        'call_status',
        'memo_other_related_person',
        'id',
        'customer_contacts_name',
        'status'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.interviewer !== nextProps.interviewer) return false;

    return true;
});