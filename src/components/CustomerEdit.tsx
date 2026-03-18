import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type { MasterData } from "./MasterData";
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import { databaseList } from '../utils/databaseList';
import type { MasterDataSelected } from "./MasterDataSelected";
import FamilyInfo from './FamilyInfo';
import { headers } from '../utils/headers';
import {columnMapping} from '../utils/columnMapping';

type UpdatedData = { id: string, shop: string, remarks: string };
type DatabaseList = { value: string, id: string, status: boolean };
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
};

type Call = {
    status: string;
} & CallAction;

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
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number };
type InterviewAction = {
    day: string;
    action: string;
    note: string;
};
type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: Boolean
};
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; trash: number, section: string, cancel_status: string, campaign: string, second_reserve: string, note: string, survey: string, gift: string, rank_period: string };

type Props = {
    handleSetSelected: (target: string, block: string) => void,
    setMasterData: React.Dispatch<React.SetStateAction<MasterData>>,
    setUpdatedData: React.Dispatch<React.SetStateAction<UpdatedData>>,
    setInterviewLog: React.Dispatch<React.SetStateAction<InterviewLog>>,
    setInterview: React.Dispatch<React.SetStateAction<InterviewAction>>,
    setCall: React.Dispatch<React.SetStateAction<Call>>,
    setCallLog: React.Dispatch<React.SetStateAction<CallLog>>,
    setOriginalDatabase: React.Dispatch<React.SetStateAction<customerList[]>>,
    masterData: MasterData,
    selected: MasterDataSelected,
    staffArray: staffList[],
    mediumArray: string[],
    interviewLog: InterviewLog,
    interview: InterviewAction,
    callLog: CallLog,
    call: Call,
    actionMap: Record<string, string>,
    giftDate: string,
    rankPeriod: string
}

const CustomerEdit = ({ handleSetSelected,
    setMasterData,
    setUpdatedData,
    setInterviewLog,
    setInterview,
    setCall,
    setCallLog,
    setOriginalDatabase,
    masterData,
    interview,
    selected,
    staffArray,
    mediumArray,
    interviewLog,
    call,
    callLog,
    actionMap,
    giftDate,
    rankPeriod }: Props) => {
    const [familyModalShow, setFamilyMShow] = useState(false);
    // const [newGiftDate, setNewGiftDate] = useState(giftDate);
    const [newRankPeriod, setNewRankPeriod] = useState(rankPeriod);
    const idMapping = (text: string) => {
        const targetId = databaseList.find(d => d.value === text)?.id ?? '';
        return targetId;
    };

    const modalClose = () => {
        setFamilyMShow(false);
    };

    const toHalfWidth = (str: string) => {
        return str.replace(/[！-～]/g, (s) =>
            String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
        ).replace(/　/g, ' ');
    };

    // const handleGiftDate = async (idValue: string, newDate: string) => {
    //     if (!idValue) return;
    //     const postData = {
    //         id: idValue,
    //         gift: newDate,
    //         demand: 'update_gift_date'
    //     };

    //     try {
    //         const response = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
    //         console.log(response.data.status);
    //         await setOriginalDatabase(response.data.customers);
    //     } catch (e) {
    //         console.error(e);
    //     }
    // };

    const inquiryReasons: string[] = ['友人・知人から聞いた', 'SNS(Instagram/Facebook/youtube/その他)', '看板を見た', '親・親戚から聞いた', 'インターネット検索', '新聞を見た', 'まとめサイトを見た', 'チラシを見た', 'その他'];

    const houseHuntingMotivation: string[] = ['家賃がもったいない', '子どもが進学する', '土地をもらった', '家族が増える（減る）', '友人・知人が家を建てた', '家づくりは特に考えていない', '土地が見つかった', '親から勧められた', '工事費用が高くなる前に', '年齢的にそろそろ', '賃貸だと老後（退職後）が心配', '今の住まいが狭い', '水回り（キッチン・風呂・トイレ・洗面）が不便', '騒音が気になる', '収納が足りない', 'その他', '気密・断熱性にこだわりたい', '間取りにこだわりたい', '他人とは違った家にしたい', '耐震性にこだわりたい', 'インテリアにこだわりたい', '外観デザインにこだわりたい', '建築予定地が既にある', '収納にこだわりたい', '注文住宅にこだわりはない']


    return (
        <>
            <div className='table-wrapper'>
                <Table responsive style={{ fontSize: '12px', textAlign: 'left' }} bordered striped className='list_table database'>
                    <tbody>
                        <tr id={idMapping('お客様名')} className={idMapping('お客様名') ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('お客様名'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>お客様名</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='名前（漢字）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('お客様名')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('お客様名')]: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                [idMapping('お客様名')]: e.target.value
                                            }
                                        ));
                                    }} />
                                <input type='text' placeholder='名前（かな）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData[idMapping('名前（かな）')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('名前（かな）')]: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                [idMapping('名前（かな）')]: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>担当店舗</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px', paddingLeft: '15px' }}>{masterData.in_charge_store}</td>
                        </tr>
                        <tr id={idMapping('担当営業')} className={selected[idMapping('担当営業')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('担当営業'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>担当営業</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select
                                    style={{
                                        border: '1px solid #D3D3D3',
                                        borderRadius: '3px',
                                        height: '30px',
                                        width: '150px',
                                        paddingLeft: '10px'
                                    }}
                                    value={masterData[idMapping('担当営業')] || ""}
                                    onChange={(e) => {
                                        const selected = staffArray.find(item => item.name === e.target.value);
                                        const staffId = selected?.pg_id ?? '';
                                        setMasterData(prev => ({
                                            ...prev,

                                            [idMapping('担当営業')]: selected?.name || "",
                                            in_charge_user_id: selected?.pg_id || ""
                                        }));
                                        setUpdatedData(prev => ({
                                            ...prev,
                                            id: masterData.id,
                                            shop: masterData.in_charge_store,
                                            [idMapping('担当営業')]: staffId
                                        }));
                                    }}
                                >
                                    {staffArray
                                        .filter(item => item.shop === masterData.in_charge_store)
                                        .map((item, index) => (
                                            <option key={index} value={item.name}>
                                                {item.name}
                                            </option>
                                        ))}
                                </select>
                            </td>
                        </tr>
                        <tr id={idMapping('ステータス')} className={selected[idMapping('ステータス')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('ステータス'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>ステータス</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('ステータス')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('ステータス')]: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                [idMapping('ステータス')]: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value='見込み'>見込み</option>
                                    <option value='会社管理'>会社管理</option>
                                    <option value='失注'>失注</option>
                                    <option value='重複'>重複</option>
                                    <option value='契約済み' disabled>契約済み</option>
                                </select><span style={{ fontSize: '10px', fontWeight: '500', letterSpacing: '0', paddingLeft: '10px' }} className='text-danger'> 契約へのステータス変更はPG CLOUDからおこなってください</span>
                            </td>
                        </tr>
                        <tr id={idMapping('顧客ランク')} className={selected[idMapping('顧客ランク')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('顧客ランク'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>顧客ランク</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <div className="d-flex">
                                    <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('顧客ランク')]}
                                        onChange={(e) => {
                                            setMasterData(prev => (
                                                {
                                                    ...prev,
                                                    [idMapping('顧客ランク')]: e.target.value
                                                }
                                            ));
                                            setUpdatedData(prev => (
                                                {
                                                    ...prev,
                                                    id: masterData.id,
                                                    shop: masterData.in_charge_store,
                                                    [idMapping('顧客ランク')]: e.target.value
                                                }
                                            ));
                                        }}>
                                        <option value="">選択してください</option>
                                        <option value='Aランク'>Aランク</option>
                                        <option value='Bランク'>Bランク</option>
                                        <option value='Cランク'>Cランク</option>
                                        <option value='Dランク'>Dランク</option>
                                        <option value='Eランク'>Eランク</option>
                                    </select>
                                    <input type="month" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '100px', paddingLeft: '10px', marginLeft: '8px' }}
                                        value={newRankPeriod}
                                        onChange={(e) => {
                                            setNewRankPeriod(e.target.value);
                                            const formattedMonth = e.target.value.replace(/-/g, '/');
                                            setMasterData(prev => (
                                                {
                                                    ...prev,
                                                    rank_period: formattedMonth
                                                }
                                            ));
                                        }} />
                                        <div style={{width: '450px', fontSize: '10px', fontWeight: '500'}} className='text-danger ms-2'>※契約見込みの月を指定する。例えば「来月の見込みが高い顧客」であれば「Bランク」にして1か月後を選択。当月見込みの場合は未選択で可。</div>
                                </div>

                            </td>
                        </tr>
                        <tr id={idMapping('反響媒体')} className={selected[idMapping('反響媒体')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('反響媒体'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>反響媒体</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '200px', paddingLeft: '10px' }} value={masterData[idMapping('反響媒体')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('反響媒体')]: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                [idMapping('反響媒体')]: e.target.value
                                            }
                                        ));
                                    }}>
                                    {mediumArray.filter(item => !/(Amazonギフトカード|HOTLEAD|アポラック|システム利用料)/.test(item)).map((item, index) =>
                                        <option key={index} value={item}>{item}</option>
                                    )}
                                </select>
                            </td>
                        </tr>
                        <tr id={idMapping('問い合せのきっかけ')} className={selected[idMapping('問い合せのきっかけ')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('問い合せのきっかけ'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>問い合わせのきっかけ<br />該当する項目は全てチェック</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                {inquiryReasons.map((item, index) =>
                                    <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                                        <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 1)}`} checked={masterData[idMapping('問い合せのきっかけ')]?.split(',').includes(item)}
                                            onChange={(e) => {
                                                const { checked, value } = e.target;
                                                setMasterData(prev => {
                                                    const current = prev.inquiry_reason?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        [idMapping('問い合せのきっかけ')]: updated.join(','),
                                                    };
                                                });
                                                setUpdatedData(prev => {
                                                    const current = masterData.inquiry_reason?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        id: masterData.id,
                                                        shop: masterData.in_charge_store,
                                                        [idMapping('問い合せのきっかけ')]: updated.join(',')
                                                    };
                                                });
                                            }} />
                                        <label className="form-check-label" htmlFor={`check_${String(index + 1)}`}>
                                            {item}
                                        </label>
                                    </div>
                                )}
                            </td>
                        </tr>
                        <tr id={idMapping('建築動機')} className={selected[idMapping('建築動機')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('建築動機'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>建築動機<br />該当する項目は全てチェック</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                {houseHuntingMotivation.slice(0, 16).map((item, index) =>
                                    <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                                        <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 10)}`} checked={masterData[idMapping('建築動機')]?.split(',').includes(item)}
                                            onChange={(e) => {
                                                const { checked, value } = e.target;
                                                setMasterData(prev => {
                                                    const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        [idMapping('建築動機')]: updated.join(','),
                                                    };
                                                });
                                                setUpdatedData(prev => {
                                                    const current = masterData.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        id: masterData.id,
                                                        shop: masterData.in_charge_store,
                                                        [idMapping('建築動機')]: updated.join(',')
                                                    };
                                                });
                                            }} />
                                        <label className="form-check-label" htmlFor={`check_${String(index + 10)}`}>
                                            {item}
                                        </label>
                                    </div>
                                )}
                            </td>
                        </tr>
                        <tr id={idMapping('建築動機')} className={selected[idMapping('建築動機')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('建築動機'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>注文住宅に興味をもったきっかけ<br />該当する項目は全てチェック</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                {houseHuntingMotivation.slice(16, 25).map((item, index) =>
                                    <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                                        <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 10)}`} checked={masterData[idMapping('建築動機')]?.split(',').includes(item)}
                                            onChange={(e) => {
                                                const { checked, value } = e.target;
                                                setMasterData(prev => {
                                                    const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        [idMapping('建築動機')]: updated.join(','),
                                                    };
                                                });
                                                setUpdatedData(prev => {
                                                    const current = masterData.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                    const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                    return {
                                                        ...prev,
                                                        id: masterData.id,
                                                        shop: masterData.in_charge_store,
                                                        [idMapping('建築動機')]: updated.join(',')
                                                    };
                                                });
                                            }} />
                                        <label className="form-check-label" htmlFor={`check_${String(index + 10)}`}>
                                            {item}
                                        </label>
                                    </div>
                                )}
                            </td>
                        </tr>
                        <tr id={idMapping('新築計画')} className={selected[idMapping('新築計画')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('新築計画'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>新築計画</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('新築計画')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('新築計画')]: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="新築平屋">新築平屋</option>
                                    <option value="新築2階建て">新築2階建て</option>
                                    <option value="建て替え平屋">建て替え平屋</option>
                                    <option value="建て替え2階建て">建て替え2階建て</option>
                                    <option value="その他">その他</option>
                                </select>
                            </td>
                        </tr>
                        <tr id={idMapping('入居時期')} className={selected[idMapping('入居時期')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('入居時期'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>入居時期</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('入居時期')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('入居時期')]: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="すぐにでも">すぐにでも</option>
                                    <option value="半年～1年以内">半年～1年以内</option>
                                    <option value="1年～2年以内">1年～2年以内</option>
                                    <option value="2年以上後">2年以上後</option>
                                    <option value="その他">その他</option>
                                </select>
                            </td>
                        </tr>
                        <tr id={idMapping('土地の状況')} className={selected[idMapping('土地の状況')] ? 'table-secondary' : undefined} onClick={() => handleSetSelected(idMapping('土地の状況'), 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の状況</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '300px', paddingLeft: '10px' }} value={masterData[idMapping('土地の状況')]}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                [idMapping('土地の状況')]: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="自分で持っている（購入予定の土地がある）">自分で持っている（購入予定の土地がある）</option>
                                    <option value="親・親族等の土地で建築予定">親・親族等の土地で建築予定</option>
                                    <option value="土地を探している">土地を探している</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='contact' className={selected.contact ? 'table-secondary' : undefined} onClick={() => handleSetSelected('contact', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>連絡先</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='固定電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_phone_number}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_phone_number: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_phone_number: numericOnly
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_phone_number: numericOnly
                                            }
                                        ));
                                    }} />
                                <input type='text' placeholder='携帯電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_mobile_phone_number}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_mobile_phone_number: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_mobile_phone_number: numericOnly
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_mobile_phone_number: numericOnly
                                            }
                                        ));
                                    }} />
                                <input type='text' placeholder='メールアドレス' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '250px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_email}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_email: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_email: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='address' className={selected.address ? 'table-secondary' : undefined} onClick={() => handleSetSelected('address', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>住所</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='郵便番号' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '100px', paddingLeft: '10px' }} value={masterData.postal_code}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                postal_code: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,-]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                postal_code: numericOnly
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                postal_code: numericOnly
                                            }
                                        ));
                                    }} />
                                <input type='text' placeholder='住所' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '400px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.full_address}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                full_address: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                full_address: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='has_owned_land' className={selected.has_owned_land ? 'table-secondary' : undefined} onClick={() => handleSetSelected('has_owned_land', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>土地の有無</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.has_owned_land}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                has_owned_land: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                has_owned_land: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="無">無</option><option value="有">有</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN' className={selected.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>重視項目</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="性能">性能</option>
                                    <option value="デザイン">デザイン</option>
                                    <option value="価格">価格</option>
                                    <option value="アフターサービス">アフターサービス</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='customized_input_01JSE7RNV3VK78YC2GYAG0554D' className={selected.customized_input_01JSE7RNV3VK78YC2GYAG0554D ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>契約スケジュール</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7RNV3VK78YC2GYAG0554D}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="半月内">半月内</option>
                                    <option value="月内">月内</option>
                                    <option value="1か月後">1か月後</option>
                                    <option value="3か月後">3か月後</option>
                                    <option value="9か月後">9か月後</option>
                                    <option value="1年以上後">1年以上後</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='budget' className={selected.budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('budget', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>予算総額</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.budget ? masterData.budget.replace('万円', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                budget: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                budget: `${numericOnly}万円`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                budget: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='monthly_repayment_amount' className={selected.monthly_repayment_amount ? 'table-secondary' : undefined} onClick={() => handleSetSelected('monthly_repayment_amount', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>月々支払予算</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='月々支払予算' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.monthly_repayment_amount ? masterData.monthly_repayment_amount.replace('0000', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                monthly_repayment_amount: `${e.target.value}0000`
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                monthly_repayment_amount: `${numericOnly}0000`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                monthly_repayment_amount: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='repayment_years' className={selected.repayment_years ? 'table-secondary' : undefined} onClick={() => handleSetSelected('repayment_years', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>返済希望年数</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='返済希望年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.repayment_years ? masterData.repayment_years.replace(/[年\/]/g, '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                repayment_years: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                repayment_years: `${numericOnly}年`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                repayment_years: numericOnly
                                            }
                                        ));
                                    }} />年
                            </td>
                        </tr>
                        <tr id='current_rent' className={selected.current_rent ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_rent', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居家賃</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='現居家賃' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.current_rent ? masterData.current_rent.replace('万円', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_rent: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_rent: `${numericOnly}万円`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                current_rent: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='self_budget' className={selected.self_budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('self_budget', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>自己資金</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.self_budget ? masterData.self_budget.replace('0000', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                self_budget: `${e.target.value}0000`
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                self_budget: `${numericOnly}0000`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                self_budget: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='current_utility_costs' className={selected.current_utility_costs ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_utility_costs', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居光熱費</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type="text" placeholder="現居光熱費" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.current_utility_costs ? masterData.current_utility_costs.replace('万円', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_utility_costs: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_utility_costs: numericOnly
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                current_utility_costs: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='current_loan_balance' className={selected.current_loan_balance ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_loan_balance', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>負債総額</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.current_loan_balance ? masterData.current_loan_balance.replace('0000', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_loan_balance: `${e.target.value}0000`
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_loan_balance: `${numericOnly}0000`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                current_loan_balance: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='current_contract_type' className={selected.current_contract_type ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_contract_type', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居契約形態</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.current_contract_type}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                current_contract_type: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                current_contract_type: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="賃貸(マンション)">賃貸(マンション)</option>
                                    <option value="賃貸(戸建)">賃貸(戸建)</option>
                                    <option value="持家(マンション)">持家(マンション)</option>
                                    <option value="持家(戸建)">持家(戸建)</option>
                                    <option value="賃貸(アパート)">賃貸(アパート)</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='customer_contacts_employment_type' className={selected.customer_contacts_employment_type ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employment_type', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>雇用形態</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_employment_type}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_employment_type: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_employment_type: e.target.value
                                            }
                                        ));
                                    }}>
                                    <option value="">選択してください</option>
                                    <option value="経営者">経営者</option>
                                    <option value="正社員">正社員</option>
                                    <option value="契約社員">契約社員</option>
                                    <option value="パート・アルバイト">パート・アルバイト</option>
                                    <option value="派遣社員">派遣社員</option>
                                    <option value="専業主婦">専業主婦</option>
                                </select>
                            </td>
                        </tr>
                        <tr id='customer_contacts_employer_name' className={selected.customer_contacts_employer_name ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employer_name', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先名</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_name}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_employer_name: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_employer_name: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='customer_contacts_employer_address' className={selected.customer_contacts_employer_address ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employer_address', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先住所</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_address}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_employer_address: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_employer_address: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='customer_contacts_years_of_service' className={selected.customer_contacts_years_of_service ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_years_of_service', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤続年数</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='勤続年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.customer_contacts_years_of_service}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_years_of_service: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_years_of_service: `${numericOnly}`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_years_of_service: numericOnly
                                            }
                                        ));
                                    }} />年
                            </td>
                        </tr>
                        <tr id='customer_contacts_annual_income' className={selected.customer_contacts_annual_income ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_annual_income', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>年収</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.customer_contacts_annual_income ? masterData.customer_contacts_annual_income.replace('万円', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_annual_income: `${e.target.value}万円`
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customer_contacts_annual_income: `${numericOnly}万円`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customer_contacts_annual_income: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='desired_land_area' className={selected.desired_land_area ? 'table-secondary' : undefined} onClick={() => handleSetSelected('desired_land_area', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>希望土地面積</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.desired_land_area}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                desired_land_area: e.target.value
                                            }
                                        ));
                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                desired_land_area: numericOnly
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                desired_land_area: numericOnly
                                            }
                                        ));
                                    }} />坪
                            </td>
                        </tr>
                        <tr id='land_budget' className={selected.land_budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('land_budget', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の予算</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' pattern="[A-Za-z0-9]*" placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                    value={masterData.land_budget ? masterData.land_budget.replace('万円', '') : ''}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                land_budget: `${e.target.value}万円`
                                            }
                                        ));

                                    }}
                                    onBlur={(e) => {
                                        const halfValue = toHalfWidth(e.target.value);
                                        const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                land_budget: `${numericOnly}万円`
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                land_budget: numericOnly
                                            }
                                        ));
                                    }} />万円
                            </td>
                        </tr>
                        <tr id='planned_construction_site' className={selected.planned_construction_site ? 'table-secondary' : undefined} onClick={() => handleSetSelected('planned_construction_site', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>建設予定地</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <input type='text' placeholder='建設予定地' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.planned_construction_site}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                planned_construction_site: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                planned_construction_site: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='family_info'>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>家族情報</td>
                            <td><div className="bg-primary px-3 text-white py-1 rounded" style={{ width: 'fit-content', fontWeight: '500', letterSpacing: '1px', cursor: 'pointer' }}
                                onClick={() => setFamilyMShow(true)}>入力・確認</div></td>
                        </tr>
                        <tr id='customized_input_01J95TC6KEES87F0YXH29AJP7K' className={selected.customized_input_01J95TC6KEES87F0YXH29AJP7K ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01J95TC6KEES87F0YXH29AJP7K', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>面談時アンケート</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <textarea placeholder='面談時アンケート' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K}
                                    rows={masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K ? (masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K.match(/\n/g)?.length ?? 0) + 2 : 2}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                customized_input_01J95TC6KEES87F0YXH29AJP7K: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                customized_input_01J95TC6KEES87F0YXH29AJP7K: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='remarks' className={selected.remarks ? 'table-secondary' : undefined} onClick={() => handleSetSelected('remarks', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>備考</td>
                            <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                                <textarea placeholder='次回アポまでの対応内容・担当者の感覚' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={masterData.remarks}
                                    rows={masterData.remarks ? (masterData.remarks.match(/\n/g)?.length ?? 0) + 2 : 2}
                                    onChange={(e) => {
                                        setMasterData(prev => (
                                            {
                                                ...prev,
                                                remarks: e.target.value
                                            }
                                        ));
                                        setUpdatedData(prev => (
                                            {
                                                ...prev,
                                                id: masterData.id,
                                                shop: masterData.in_charge_store,
                                                remarks: e.target.value
                                            }
                                        ));
                                    }} />
                            </td>
                        </tr>
                        <tr id='interview_status' className={selected.interview_status ? 'table-secondary' : undefined} onClick={() => handleSetSelected('interview_status', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>商談ステップ</td>
                            <td>
                                <div className="d-flex align-items-center mb-2">
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>顧客ランク</div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData[idMapping('顧客ランク')]}
                                            onChange={(e) => {
                                                setMasterData(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('顧客ランク')]: e.target.value
                                                    }
                                                ));
                                                setUpdatedData(prev => (
                                                    {
                                                        ...prev,
                                                        id: masterData.id,
                                                        shop: masterData.in_charge_store,
                                                        [idMapping('顧客ランク')]: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value="">選択してください</option>
                                            <option value='Aランク'>Aランク</option>
                                            <option value='Bランク'>Bランク</option>
                                            <option value='Cランク'>Cランク</option>
                                            <option value='Dランク'>Dランク</option>
                                            <option value='Eランク'>Eランク</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ padding: '5px', backgroundColor: '#f1f1f1ff' }}>
                                    <div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                        <div className="">
                                            <input type="date" value={masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 && masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99.replace(/\//g, "-")} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                onChange={(e) => {
                                                    setMasterData(prev => (
                                                        {
                                                            ...prev,
                                                            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value
                                                        }
                                                    ));
                                                    setUpdatedData(prev => (
                                                        {
                                                            ...prev,
                                                            id: masterData.id,
                                                            shop: masterData.in_charge_store,
                                                            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value.replace(/\//g, '-')
                                                        }
                                                    ));
                                                }} />
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                            <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} disabled>
                                                <option value="">反響取得</option>
                                            </select>
                                        </div>
                                        <div className="ms-2">
                                            {masterData.sales_promotion_name}からの反響取得</div>
                                    </div>
                                    <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                        <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                        <div style={{ textAlign: 'center' }}>
                                            <i className="fa-solid fa-file-pen"></i>
                                        </div>
                                        <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                    </div>
                                    {interviewLog.interview_log &&
                                        interviewLog.interview_log
                                            .sort((a, b) => {
                                                const dayA = new Date(a.day).getTime();
                                                const dayB = new Date(b.day).getTime();
                                                return dayA - dayB;
                                            })
                                            .map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                <div className="">
                                                    <input type="date" value={item.day} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                        onChange={(e) => {
                                                            setInterviewLog(prev => ({
                                                                ...prev,
                                                                add: true,
                                                                interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                    { ...log, day: e.target.value } : log)
                                                            }));
                                                            const key = actionMap[item.action];
                                                            if (key) {
                                                                console.log(key)
                                                                const value = e.target.value;
                                                                setMasterData(prev => ({
                                                                    ...prev,
                                                                    [key]: value
                                                                }));
                                                                setUpdatedData(prev => ({
                                                                    ...prev,
                                                                    id: masterData.id,
                                                                    shop: masterData.in_charge_store,
                                                                    [key]: value.replace(/\//g, '-')
                                                                }));
                                                            }

                                                        }} />
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                    <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={item.action}
                                                        onChange={(e) => setInterviewLog(prev => ({
                                                            ...prev,
                                                            add: true,
                                                            interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                { ...log, action: e.target.value } : log)
                                                        }))}>
                                                        <option value="">アクション内容</option>
                                                        <option value="初回面談">初回面談</option>
                                                        <option value="2回目以降面談">2回目以降面談</option>
                                                        <option value="オンライン面談">オンライン面談</option>
                                                        <option value="LINEグループ作成">LINEグループ作成</option>
                                                        <option value="事前審査">事前審査</option>
                                                    </select>
                                                </div>
                                                <div className="">
                                                    <textarea style={{ border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '500px' }} placeholder='面談内容を記載' value={item.note} rows={item.note.split('\n').length}
                                                        onChange={(e) => setInterviewLog(prev => ({
                                                            ...prev,
                                                            add: true,
                                                            interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                { ...log, note: e.target.value } : log)
                                                        }))}></textarea>
                                                </div>
                                                <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                                    onClick={() => {
                                                        item.action === '初回面談' && setMasterData(prev => (
                                                            {
                                                                ...prev,
                                                                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: ''
                                                            }
                                                        ));
                                                        item.action === '初回面談' && setUpdatedData(prev => (
                                                            {
                                                                ...prev,
                                                                id: masterData.id,
                                                                shop: masterData.in_charge_store,
                                                                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: ''
                                                            }
                                                        ));
                                                        item.action === '2回目以降面談' && setMasterData(prev => (
                                                            {
                                                                ...prev,
                                                                step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: ''
                                                            }
                                                        ));
                                                        item.action === '2回目以降面談' && setUpdatedData(prev => (
                                                            {
                                                                ...prev,
                                                                id: masterData.id,
                                                                shop: masterData.in_charge_store,
                                                                step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: ''
                                                            }
                                                        ));
                                                        item.action === '事前審査' && setMasterData(prev => (
                                                            {
                                                                ...prev,
                                                                step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: ''
                                                            }
                                                        ));
                                                        item.action === '事前審査' && setUpdatedData(prev => (
                                                            {
                                                                ...prev,
                                                                id: masterData.id,
                                                                shop: masterData.in_charge_store,
                                                                step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: ''
                                                            }
                                                        ));
                                                        item.action === 'LINEグループ作成' && setMasterData(prev => (
                                                            {
                                                                ...prev,
                                                                step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN: ''
                                                            }
                                                        ));
                                                        item.action === 'LINEグループ作成' && setUpdatedData(prev => (
                                                            {
                                                                ...prev,
                                                                id: masterData.id,
                                                                shop: masterData.in_charge_store,
                                                                step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN: ''
                                                            }
                                                        ));
                                                        setInterviewLog(prev => ({
                                                            ...prev,
                                                            add: true,
                                                            interview_log: prev.interview_log.filter((_, i) => i !== index)
                                                        }));
                                                    }}>削除</div>
                                            </div>
                                                <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <i className="fa-solid fa-file-pen"></i>
                                                    </div>
                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                </div>
                                            </>)}
                                    <div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                        <div className="">
                                            <input type="date" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }} value={interview.day}
                                                onChange={(e) => setInterview(prev => ({
                                                    ...prev,
                                                    day: e.target.value
                                                }))} />
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                            <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                                onChange={(e) => setInterview(prev => ({
                                                    ...prev,
                                                    action: e.target.value,
                                                    note: e.target.value === 'LINEグループ作成' ? 'LINEグループ作成' : prev.note
                                                }))}
                                                value={interview.action}>
                                                <option value="">アクション内容</option>
                                                <option value="初回面談">初回面談</option>
                                                <option value="2回目以降面談">2回目以降面談</option>
                                                <option value="オンライン面談">オンライン面談</option>
                                                <option value="LINEグループ作成">LINEグループ作成</option>
                                                <option value="事前審査">事前審査</option>
                                            </select>
                                        </div>
                                        <div className="">
                                            <textarea value={interview.note} style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '500px' }} placeholder='面談内容を記載'
                                                onChange={(e) => setInterview(prev => ({
                                                    ...prev,
                                                    note: e.target.value
                                                }))} ></textarea></div>
                                        <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                            onClick={() => {
                                                if (!interview.day || !interview.action || !interview.note) {
                                                    alert('未入力の項目があります');
                                                    return;
                                                };
                                                setInterviewLog(prev => ({
                                                    ...prev,
                                                    id: masterData.id,
                                                    name: masterData.customer_contacts_name,
                                                    status: masterData.call_status,
                                                    interview_log: [
                                                        ...prev.interview_log,
                                                        { day: interview.day, action: interview.action, note: interview.note }
                                                    ],
                                                    add: true
                                                }));

                                                const key = actionMap[interview.action];

                                                if (key) {
                                                    setMasterData(prev => ({
                                                        ...prev,
                                                        [key]: interview.day
                                                    }));

                                                    setUpdatedData(prev => ({
                                                        ...prev,
                                                        id: masterData.id,
                                                        shop: masterData.in_charge_store,
                                                        [key]: interview.day
                                                    }));
                                                }

                                                setInterview({
                                                    day: '', action: '', note: ''
                                                });
                                            }
                                            }>追加</div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr id='call_status' className={selected.call_status ? 'table-secondary' : undefined} onClick={() => handleSetSelected('call_status', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電状況</td>
                            <td>
                                <div className="d-flex align-items-center mb-2">
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電ステータス</div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                        <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                            onChange={(e) => {
                                                setMasterData(prev => (
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
                                            value={masterData.call_status}>
                                            <option value="">架電ステータスを選択</option>
                                            <option value="未通電">未通電</option>
                                            <option value="継続">継続</option>
                                            <option value="来場アポ">来場アポ</option>
                                            <option value="来場済み">来場済み</option>
                                            <option value="架電停止">架電停止</option>
                                        </select>
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>架電担当</div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                        <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                            onChange={(e) => {
                                                setMasterData(prev => (
                                                    {
                                                        ...prev,
                                                        staff: e.target.value
                                                    }
                                                ));
                                                setCallLog(prev => ({
                                                    ...prev,
                                                    staff: e.target.value
                                                }));
                                            }}
                                            value={callLog.staff}>
                                            <option value="">架電担当を選択</option>
                                            {staffArray.filter(s => s.estate === 1).map((s, sIndex) =>
                                                <option key={sIndex} value={s.name}>{s.name}</option>
                                            )}
                                        </select>
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>来場予定日</div>
                                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                        <input type="date" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={callLog.reserved_status ? callLog.reserved_status : ''}
                                            onChange={(e) => setCallLog(prev => ({
                                                ...prev,
                                                reserved_status: e.target.value
                                            }))} />
                                    </div>
                                </div>
                                <div style={{ padding: '5px', backgroundColor: '#f1f1f1ff' }}>
                                    {callLog.call_log &&
                                        callLog.call_log.map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                            <div className="">
                                                <input type="date" value={item.day} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                    onChange={(e) => setCallLog(prev => ({
                                                        ...prev,
                                                        call_log: prev.call_log.map((log, i) => i === index ?
                                                            { ...log, day: e.target.value } : log)
                                                    }))} />
                                            </div>
                                            <div className="">
                                                <input type="time" value={item.time} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', marginLeft: '5px', paddingLeft: '2px' }}
                                                    onChange={(e) => setCallLog(prev => ({
                                                        ...prev,
                                                        call_log: prev.call_log.map((log, i) => i === index ?
                                                            { ...log, time: e.target.value } : log)
                                                    }))} />
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={item.action}
                                                    onChange={(e) => setCallLog(prev => ({
                                                        ...prev,
                                                        call_log: prev.call_log.map((log, i) => i === index ?
                                                            { ...log, action: e.target.value } : log)
                                                    }))}>
                                                    <option value="">アクション内容</option>
                                                    <option value="架電">架電</option>
                                                    <option value="SMS送信">SMS送信</option>
                                                    <option value="メール送信">メール送信</option>
                                                    <option value="資料郵送">資料郵送</option>
                                                </select>
                                            </div>
                                            <div className="">
                                                <textarea style={{ border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載' value={item.note} rows={item.note.split('\n').length}
                                                    onChange={(e) => setCallLog(prev => ({
                                                        ...prev,
                                                        call_log: prev.call_log.map((log, i) => i === index ?
                                                            { ...log, note: e.target.value } : log)
                                                    }))}></textarea>
                                            </div>
                                            <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                                onClick={() => {
                                                    setCallLog(prev => ({
                                                        ...prev,
                                                        call_log: prev.call_log.filter((_, i) => i !== index),
                                                        add: true
                                                    }));
                                                }}>削除</div>
                                        </div>
                                            <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                <div style={{ textAlign: 'center' }}>
                                                    {callLog.call_log[index]['action'] === '架電' && <i className="fa-solid fa-phone-volume"></i>}
                                                    {callLog.call_log[index]['action'] === 'SMS送信' && <i className="fa-solid fa-message"></i>}
                                                    {callLog.call_log[index]['action'] === 'メール送信' && <i className="fa-solid fa-envelope"></i>}
                                                    {callLog.call_log[index]['action'] === '資料郵送' && <i className="fa-solid fa-truck"></i>}
                                                </div>
                                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                            </div>
                                        </>)}
                                    <div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                        <div className="">
                                            <input type="date" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }} value={call.day}
                                                onChange={(e) => setCall(prev => ({
                                                    ...prev,
                                                    day: e.target.value
                                                }))} />
                                        </div>
                                        <div className="">
                                            <input type="time" step="60" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '80px', paddingLeft: '2px' }} value={call.time}
                                                onChange={(e) => setCall(prev => ({
                                                    ...prev,
                                                    time: e.target.value
                                                }))} />
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                            <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                                onChange={(e) => setCall(prev => ({
                                                    ...prev,
                                                    action: e.target.value
                                                }))}
                                                value={call.action}>
                                                <option value="">アクション内容</option>
                                                <option value="架電">架電</option>
                                                <option value="SMS送信">SMS送信</option>
                                                <option value="メール送信">メール送信</option>
                                                <option value="資料郵送">資料郵送</option>
                                            </select>
                                        </div>
                                        <div className="">
                                            <textarea value={call.note} style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載'
                                                onChange={(e) => setCall(prev => ({
                                                    ...prev,
                                                    note: e.target.value
                                                }))} ></textarea></div>
                                        <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                            onClick={() => {
                                                if (!call.day && !call.action && !call.note) {
                                                    alert('未入力の項目があります');
                                                    return;
                                                };
                                                setCallLog(prev => ({
                                                    ...prev,
                                                    id: masterData.id,
                                                    name: masterData.customer_contacts_name,
                                                    staff: masterData.in_charge_user,
                                                    status: masterData.call_status,
                                                    call_log: [
                                                        ...prev.call_log,
                                                        { day: call.day, time: call.time, action: call.action, note: call.note }
                                                    ],
                                                    add: true
                                                }));
                                                setCall({
                                                    status: '', day: '', time: '', action: '', note: ''
                                                });
                                            }
                                            }>追加</div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        {/* <tr id='gift' className={selected.remarks ? 'table-secondary' : undefined} onClick={() => handleSetSelected('remarks', 'body')}>
                            <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>ギフト進呈</td>
                            <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                <input type="date" value={newGiftDate.replace(/\//g, '-')} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '100px', paddingLeft: '2px' }}
                                    onChange={(e) => {
                                        const formattedDate = e.target.value.replace(/\//g, '-');
                                        handleGiftDate(masterData.id, formattedDate);
                                        setNewGiftDate(formattedDate);
                                    }} />
                            </td>
                        </tr> */}
                    </tbody>
                </Table>
            </div>
            <Modal show={familyModalShow} onHide={modalClose} size='lg'>
                <FamilyInfo idValue={masterData.id} shopValue={masterData.in_charge_store} nameValue={masterData.customer_contacts_name} modalClose={modalClose} />
            </Modal>
        </>
    )
}

export default CustomerEdit