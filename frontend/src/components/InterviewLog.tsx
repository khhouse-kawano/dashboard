import React, { useEffect, useState, useRef } from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../utils/headers';
type InterviewAction = {
    day: string;
    action: string;
    note: string;
};
type InterviewList = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: boolean
};
type Customer = {
    customer: string,
    medium: string,
    register: string
};
type Props = {
    idValue: string,
    setInterviewId: React.Dispatch<React.SetStateAction<string>>
};

const InterviewLog = ({ idValue, setInterviewId }: Props) => {
    const [interviewLog, setInterviewLog] = useState<InterviewList>({
        id: '',
        shop: '',
        name: '',
        interview_log: [],
        add: false
    });
    const [interview, setInterview] = useState<InterviewAction>({
        day: '',
        action: '',
        note: ''
    });
    const [customer, setCustomer] = useState<Customer>({
        customer: '',
        medium: '',
        register: ''
    });
    const dayRef = useRef<HTMLInputElement | null>(null);
    const actionRef = useRef<HTMLSelectElement | null>(null);
    const textRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!idValue) return;
        const postData = {
            id: idValue,
            request: 'interviewLog'
        };
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
            const interview = response.data.interview ?? {};
            const interviewResData: InterviewList = {
                id: interview.id ?? '',
                shop: interview.shop ?? '',
                name: interview.name ?? '',
                interview_log:
                    typeof interview.interview_log === 'string' && interview.interview_log.trim() !== ''
                        ? JSON.parse(interview.interview_log)
                        : interview.interview_log ?? [],
                add: false
            };

            setInterviewLog(interviewResData);
            setCustomer(response.data.customer);
            console.log(response.data.customer)
        };

        fetchData();
    }, [idValue]);

    const handleSave = async () => {
        if (!interview.day || !interview.action) {
            alert('未入力の項目があります');
            return;
        };

        const newInterviewLog = {
            ...interviewLog,
            id: idValue,
            interview_log: [
                ...interviewLog.interview_log,
                { day: interview.day, action: interview.action, note: interview.note }
            ],
            request: 'interviewLog_update_interview'
        };

        setInterviewLog(prev => ({
            ...prev,
            interview_log: [
                ...prev.interview_log,
                { day: interview.day, action: interview.action, note: interview.note }
            ]
        }));

        const fetchData = async () => {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/gateway/", newInterviewLog, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        fetchData();
        setInterview({
            day: '', action: '', note: ''
        });
        [dayRef, actionRef, textRef].forEach(ref => {
            if (ref.current) ref.current.value = '';
        });
    };

    const listClose = () => {
        setInterviewId('');
        setInterviewLog({
            id: '',
            shop: '',
            name: '',
            interview_log: [],
            add: false
        });
        setCustomer({
            customer: '',
            medium: '',
            register: ''
        });
    };

    const inputStyle = { border: '1px solid #D3D3D3', borderRadius: '7px', height: '25px', width: '150px', paddingLeft: '10px', margin: '5px' };

    return (
        <>
            <Modal show={!!idValue} onHide={listClose} size='lg'>
                <Modal.Header closeButton>{customer.customer}様 商談ステップ</Modal.Header>
                <Modal.Body>
                    <Table>
                        <tbody style={{ fontSize: '12px', border: 'transparent' }} className='align-middle'>
                            <tr>
                                <td style={{ width: '15%' }}>
                                    <div className="p-2">日付</div>
                                </td>
                                <td style={{ width: '15%' }}>
                                    <div className="p-2">アクション内容</div>
                                </td>
                                <td>
                                    <div className="p-2">備考</div>
                                </td>
                            </tr>
                            <tr className='table-light'>
                                <td>
                                    <div className="p-2">{customer.register}</div>
                                </td>
                                <td>
                                    <div className="p-2">反響取得</div>
                                </td>
                                <td>
                                    <div className="p-2">{customer.medium}</div>
                                </td>
                            </tr>
                            {interviewLog.interview_log.length > 0 && <tr>
                                <td colSpan={4} className='text-center'>↓</td>
                            </tr>}
                            {[...interviewLog.interview_log]
                                .sort((a, b) => {
                                    return new Date(a.day.replace(/\//g, '-')).getTime() - new Date(b.day.replace(/\//g, '-')).getTime()
                                })
                                .map((item, index) =>
                                    <>
                                        <tr className='table-light'>
                                            <td>
                                                <input type="date" value={item.day} style={inputStyle}
                                                    onChange={(e) => {
                                                        setInterviewLog(prev => ({
                                                            ...prev,
                                                            add: true,
                                                            interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                { ...log, day: e.target.value } : log)
                                                        }));
                                                    }} />
                                            </td>
                                            <td>
                                                <select style={inputStyle} value={item.action}
                                                    onChange={(e) => setInterviewLog(prev => ({
                                                        ...prev,
                                                        add: true,
                                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                                            { ...log, action: e.target.value } : log)
                                                    }))}>
                                                    <option value="">アクション内容</option>
                                                    <option value="資料送付">資料送付</option>
                                                    <option value="初回面談">初回面談</option>
                                                    <option value="2回目以降面談">2回目以降面談</option>
                                                    <option value="オンライン面談">オンライン面談</option>
                                                    <option value="LINEグループ作成">LINEグループ作成</option>
                                                    <option value="事前審査">事前審査</option>
                                                    <option value="契約">契約</option>
                                                </select>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center ">
                                                    <textarea style={{ ...inputStyle, height: 'auto', width: '80%' }} placeholder='面談内容を記載' value={item.note} rows={item.note.length / 13 + 1}
                                                        onChange={(e) => setInterviewLog(prev => ({
                                                            ...prev,
                                                            add: true,
                                                            interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                { ...log, note: e.target.value } : log)
                                                        }))}></textarea>
                                                    <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)', width: '20%', maxWidth: '38px' }}
                                                        onClick={() => {
                                                            if (window.confirm('商談ステップを削除しますか?')) {
                                                                setInterviewLog(prev => ({
                                                                    ...prev,
                                                                    add: true,
                                                                    interview_log: prev.interview_log.filter((_, i) => i !== index)
                                                                }));
                                                            }
                                                        }}>削除</div>
                                                </div>
                                            </td>
                                        </tr>
                                        {interviewLog.interview_log.length > index + 1 && <tr>
                                            <td colSpan={4} className='text-center'>↓</td>
                                        </tr>}
                                    </>
                                )}
                            <tr>
                                <td colSpan={4} className='text-center'>↓</td>
                            </tr>
                            <tr>
                                <td>
                                    <input type="date" style={inputStyle}
                                        ref={dayRef}
                                        onChange={(e) => setInterview(prev => ({
                                            ...prev,
                                            day: e.target.value
                                        }))} />
                                </td>
                                <td>
                                    <select style={inputStyle}
                                        ref={actionRef}
                                        onChange={(e) => setInterview(prev => ({
                                            ...prev,
                                            action: e.target.value,
                                        }))}
                                        value={interview.action}>
                                        <option value="">アクション内容</option>
                                        <option value="資料送付">資料送付</option>
                                        <option value="初回面談">初回面談</option>
                                        <option value="2回目以降面談">2回目以降面談</option>
                                        <option value="オンライン面談">オンライン面談</option>
                                        <option value="LINEグループ作成">LINEグループ作成</option>
                                        <option value="事前審査">事前審査</option>
                                        <option value="契約">契約</option>
                                    </select>
                                </td>
                                <td>
                                    <div className="d-flex align-items-center">
                                        <textarea style={{ ...inputStyle, width: '80%' }} placeholder='面談内容を記載'
                                            ref={textRef}
                                            onBlur={(e) => setInterview(prev => ({
                                                ...prev,
                                                id: idValue,
                                                note: e.target.value
                                            }))}
                                        ></textarea>
                                        <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)', width: '20%', maxWidth: '38px' }}
                                            onClick={() => handleSave()
                                            }>追加</div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal></>
    )
}

export default InterviewLog