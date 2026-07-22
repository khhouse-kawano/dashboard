import React, { useEffect, useState, useContext, useMemo, useReducer } from 'react';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import ProgressBar from 'react-bootstrap/ProgressBar';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { headers } from '../../utils/headers';
import { shopFormate } from '../../utils/shopFormate';
import InformationEditKaeru from '../information/InformationEditKaeru';
import { generateULID } from '../../utils/createULID';
import Modal from 'react-bootstrap/Modal';
import { setStyleClassSpec } from '../../utils/setStyleClassSpec';
import { thisYear } from '../../utils/thisYear';
import { dateFormate, monthFormate } from './listUtils';
import { kataToHira } from '../../utils/kataToHira';
import { extractNumbers } from '../../utils/extraNumbers';
import { useIsSp } from '../../utils/isSp';

type Shop = { brand: string, shop: string, section: string, area: string };

type InquiryCustomer = Record<string, string>;

type Customer = { register: string, shop: string, interview: string, medium: string, tour: string };

type Staff = { name: string, shop: string };

type Props = {
    onReload: () => void;
};

type Black = {
    mobile: string,
    mail: string
};

const targetSection = ['不動産営業1課', '不動産営業2課'];

const ListKaeru = ({ onReload }: Props) => {
    const { authority } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [inquiryList, setInquiryList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(0);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetKana, setTargetKana] = useState('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetMobile, setTargetMobile] = useState('');
    const [targetShop, setTargetShop] = useState<string>('');
    const [totalLength, setTotalLength] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const { token } = useContext(AuthContext);
    const [editId, setEditId] = useState('');
    const [blackList, setBlackList] = useState<Black[]>([]);
    const [searchId, setSearchId] = useState('');

    const isSp = useIsSp();

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setMonthArray(getYearMonthArray(2025, 1));
        setStartMonth(`${year}/${month}`);
        setEndMonth(`${year}/${month}`);
        setSelectedMonth([`${year}/${month}`]);

        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'list_kaeru' }, { headers });
                await setCustomerList(response.data.summary);
                await setShopArray(response.data.shop);
                await setStaffList(response.data.staff.filter(s => s.period === String(thisYear) && targetSection.includes(s.section)));
                await setMediumArray(response.data.medium.map(m => m.medium));
                await setOriginalList(response.data.inquiry);
                await setBlackList(response.data.black);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? monthArray.indexOf(endMonth) : monthArray.length - 1;
        const filteredMonth = monthArray.slice(startIndex, endIndex + 1);
        setSelectedMonth(filteredMonth);
    }, [startMonth, endMonth]);

    useEffect(() => {
        if (isSp) {
            setTargetSync(null);
        }
    }, [isSp]);


    const isSync = (list: InquiryCustomer, value: string) => {
        return list.black_list.split(value).length % 2 !== 0
    };

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;

        const rawKana = `${item.first_name_kana || ""}${item.last_name_kana || ""}`;
        const fullKana = kataToHira(rawKana);
        const normalizedTargetKana = kataToHira(targetKana);

        const formattedMobile = extractNumbers(item.mobile || item.landline);
        const normalizedTargetMobile = extractNumbers(targetMobile);

        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;

        return (
            selectedMonth.includes(monthFormate(item.inquiry_date)) &&
            (targetShop === '' || item.shop === targetShop) &&
            (mediumValue === '' || item.response_medium.includes(mediumValue)) &&
            (targetSync === null || (targetSync === 0 ?
                (Number(item.sync) === targetSync && (isSync(item, 'duplicate') && isSync(item, 'support') && isSync(item, 'black')))
                : Number(item.sync) === targetSync || !isSync(item, 'duplicate') || !isSync(item, 'support') || !isSync(item, 'black'))) &&
            (targetName === '' || fullName.includes(targetName)) &&

            (targetKana === '' || fullKana.includes(normalizedTargetKana)) &&

            (targetMobile === '' || formattedMobile.includes(normalizedTargetMobile)) &&

            (targetAddress === '' || fullAddress.includes(targetAddress))
        );
    }), [originalList, selectedMonth, targetShop, targetMedium, targetSync, targetName, targetKana, targetAddress, targetMobile]);

    useEffect(() => {
        setInquiryList(filteredInquiryList);
        setTotalLength(filteredInquiryList.length);
        setDisplayLength(20);
    }, [filteredInquiryList]);

    const [progress, setProgress] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const filteredInterview = useMemo(() => {
        return customerList.filter(c => selectedMonth.includes(monthFormate(c.interview)));
    }, [customerList, selectedMonth]);

    const filteredInquiry = useMemo(() => {
        return originalList.filter(c => selectedMonth.includes(monthFormate(c.inquiry_date)));
    }, [originalList, selectedMonth]);

    const handleSync = async (idValue: string) => {
        const filteredCustomer = inquiryList.find(i => i.inquiry_id === idValue);
        const filteredShop = filteredCustomer?.shop ?? '';

        if (!idValue || !filteredCustomer || !filteredShop || filteredShop.includes('店舗未設定')) {
            alert(`同期に失敗しました。${!filteredShop ? ' ※店舗が未選択' : ''}`);
            return;
        }

        if (window.confirm(`${filteredShop} ${filteredCustomer.first_name} ${filteredCustomer.last_name}様 顧客情報を取り込みますか?`)) {
            const postData = {
                id: generateULID(),
                inquiry_id: filteredCustomer.inquiry_id,
                in_charge_user: filteredCustomer.staff ? filteredCustomer.staff : `${filteredShop} 管理`, //担当営業
                customer_contacts_name: `${filteredCustomer.first_name} ${filteredCustomer.last_name}`, //顧客名
                customer_contacts_name_kana: `${filteredCustomer.first_name_kana} ${filteredCustomer.last_name_kana}`, //ふりがな
                in_charge_store: filteredShop, //店舗
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: filteredCustomer.inquiry_date, //反響取得日
                customer_contacts_mobile_phone_number: filteredCustomer.mobile, //携帯
                customer_contacts_phone_number: filteredCustomer.landline, //固定及びその他電話番号
                customer_contacts_email: filteredCustomer.mail,  //メアド
                postal_code: filteredCustomer.zip, //郵便番号
                full_address: `${filteredCustomer.pref} ${filteredCustomer.city} ${filteredCustomer.town} ${filteredCustomer.street} ${filteredCustomer.building}`, //住所
                sales_promotion_name: filteredCustomer.response_medium, //販促媒体
                remarks: filteredCustomer.note,  //反響情報
                reserved_interview: filteredCustomer.reserved_date, //来場予約日
                hp_campaign: filteredCustomer.hp_campaign, //HP反響の場合のCP名
                status: '見込み',
                planned_construction_site: filteredCustomer.area,
                category: '建売',
                request: 'list_kaeru_sync',
            };

            console.log(postData);

            const fetchData = async () => {
                try {
                    const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", postData, { headers });
                    return response.data.customer
                } catch (error) {
                    console.error("データ取得エラー:", error);
                }
            };

            await setIsSyncing(true);
            await setProgress(0);
            const duration = 40000;
            const interval = 200;
            const step = 100 / (duration / interval);

            let elapsed = 0;
            const maxTime = 40000;
            const checkInterval = 2000; // 2秒ごとに

            const timer = setInterval(async () => {
                const updatedList = await fetchData();
                const targetID = updatedList.find(item => item.inquiry_id === idValue)?.pg_id;

                if (targetID) {
                    clearInterval(timer);

                    setOriginalList(updatedList);
                    setProgress(100);
                    alert('同期が完了しました。');
                    setIsSyncing(false);
                } else if (elapsed >= maxTime) {
                    clearInterval(timer);
                    setProgress(100);
                    alert('同期に失敗しました。');
                    setIsSyncing(false);
                } else {
                    elapsed += checkInterval;
                    const ratio = elapsed / maxTime;
                    setProgress(ratio * 100);
                }
            }, checkInterval);
        } else {
            console.log("キャンセルされました。");
        }
        onReload();
    };

    const listChange = async (id: string, listValue: string, demandValue: string) => {
        const keyMap = {
            shop_change: 'shop',
            staff_change: 'staff',
            tag: 'black_list',
        } as const;

        const changeValue = demandValue === 'tag' ?
            `${inquiryList.find(i => i.inquiry_id === id)?.black_list} ${listValue}`.trim()
            : listValue

        const postData = {
            list: changeValue,
            demand: keyMap[demandValue],
            inquiry_id: id,
            request: 'list_kaeru_change'
        };

        const updated = inquiryList.map(item => {
            if (item.inquiry_id !== id) return item;
            const key = keyMap[demandValue];
            if (demandValue === 'tag') {
                return {
                    ...item,
                    [key]: `${item[key]} ${listValue}`.trim(),
                };
            }
            return {
                ...item,
                [key]: listValue,
            };
        });

        setInquiryList(updated);

        try {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });

            if (response.data.length === 0) {
                alert('処理に失敗しました。');
                return;
            }
        } catch (error) {
            console.error('エラー:', error);
        }

        if (demandValue === 'tag' && (listValue === 'duplicate' || listValue === 'support' || listValue === 'black')) onReload();
    };

    const handleBlack = async (brandValue: string, nameValue: string, mobileValue: string, mailValue: string, zipValue: string, addressValue: string) => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/',
                    {
                        mobile: mobileValue,
                        mail: mailValue,
                        brand: brandValue,
                        name: nameValue,
                        zip: zipValue,
                        address: addressValue,
                        request: 'list_black'
                    }, { headers });
                console.log(response.data.status);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    };


    const inquiryFilter = (shopValue: string) => {
        return filteredInquiry.filter(c => (shopValue ? c.shop === shopValue : true) && selectedMonth.includes(monthFormate(c.inquiry_date))).length;
    };

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => shopValue ? s.shop === shopValue : true).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return filteredInterview.filter(c => (shopValue ? c.shop === shopValue : true) && selectedMonth.includes(monthFormate(c.interview))).length;
    };

    const isBlack = (mailValue: string, mobileValue: string, blackValue: string) => {
        return blackList.some(b =>
            (mailValue && b.mail.includes(mailValue)) ||
            (mobileValue && b.mobile.includes(mobileValue))
        ) || (blackValue.split('black').length % 2 === 0);
    };

    const closeInformationEdit = () => setEditId('');

    const [customerDetail, setCustomerDetail] = useState({
        title: '',
        text: ''
    });

    useEffect(() => {
        if (!searchId) return;
        const value = inquiryList.find(i => i.inquiry_id === searchId);
        setCustomerDetail({
            title: value?.hp_campaign ? value?.hp_campaign : value?.response_medium ?? '',
            text: value?.note ?? ''
        });
    }, [searchId]);

    return (
        <>  {isSyncing && <div style={{ position: 'absolute', top: '30vh', width: '60vw', left: 'calc( 50% - 30vw)', zIndex: '2000', height: '220px', backgroundColor: 'white', boxShadow: '0px 5px 15px 0px rgba(0, 0, 0, 0.35)', padding: '80px 100px 100px' }}>
            <span>同期処理中</span>
            <ProgressBar now={progress} label={`${Math.round(progress)}%`} />
        </div>}
            <div className='inquiry_table spec bg-white p-2'>
                <div className="d-flex flex-wrap mb-3 align-items-center" style={{ paddingTop: isSp ? '30px' : '' }}>
                    <div className="m-1">
                        <select className="target" onChange={(e) => setStartMonth(e.target.value)} style={{ fontSize: '13px' }}>
                            {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div>~</div>
                    <div className="m-1">
                        <select className="target" onChange={(e) => setEndMonth(e.target.value)} style={{ fontSize: '13px' }}>
                            {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(e) => setTargetShop(e.target.value)} style={{ fontSize: '13px', }}>
                            <option value=''>全店舗表示</option>
                            {shopArray.map((item, index) =>
                                <option key={index} value={item.shop}>{item.shop}</option>
                            )}
                        </select>
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setTargetMedium(e.target.value)} style={{ fontSize: '13px' }}>
                                <option value=''>全媒体表示</option>
                                {mediumArray.map((item, index) =>
                                    <option key={index} value={item}>{item}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => {
                                const value = e.target.value;
                                setTargetSync(value === '' ? null : Number(value));
                            }} style={{ fontSize: '13px' }}>
                                <option value="">全て表示</option>
                                <option value="1" selected={targetSync === 1}>取込済み</option>
                                <option value="0" selected={targetSync === 0}>未取込</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='氏名で検索' onChange={(e) => setTargetName(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='ふりがな(平仮名)で検索' onChange={(e) => setTargetKana(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='住所で検索' onChange={(e) => setTargetAddress(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='電話番号で検索' onChange={(e) => setTargetMobile(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                    </>}
                    <div className="bg-success text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => setEditId('new')}>新規登録</div>
                </div>
                <div className='p-0 inquiry'>
                    {!isSp &&
                        <Table striped bordered hover style={{ width: '800px' }}>
                            <thead className='sticky-header' style={{ fontSize: "10px" }}>
                                <tr className='sticky-header' style={{ textAlign: 'center' }}>
                                    <td style={{ width: '100px' }}>店舗名</td>
                                    <td style={{ width: '100px' }}>グループ全体</td>
                                    {shopArray.filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店')).map((value, index) => (<td key={index} className='text-center' style={{ width: '90px' }}>{value.shop.replace('店', '')}</td>))}
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: "12px" }}>
                                {['反響合計', '反響目標', '来場合計', '来場目標'].map((category, cIndex) => <tr key={cIndex} className='text-center'>
                                    <td>{category}</td>
                                    {[{ brand: '', shop: 'グループ全体', section: '', area: '' }, ...shopArray].filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店'))
                                        .map((value, sIndex) => {
                                            let totalValue;
                                            if (cIndex === 0) {
                                                totalValue = inquiryFilter(sIndex === 0 ? '' : value.shop);
                                            } else if (cIndex === 1 || cIndex === 3) {
                                                totalValue = achievementFilter(sIndex === 0 ? '' : value.shop, cIndex === 1 ? 8 : 4);
                                            } else {
                                                totalValue = reserveFilter(sIndex === 0 ? '' : value.shop);
                                            }
                                            return <td key={sIndex} className='text-center' style={{ width: '90px' }}>{totalValue}</td>
                                        })}
                                </tr>
                                )}
                            </tbody>
                        </Table>}
                    <Table striped bordered hover style={{ width: isSp ? '1100px' :'1500px', fontSize: isSp ? "8px" :"12px"}}>
                        <thead className='sticky-header'>
                            <tr className='sticky-header align-middle'>
                                <td style={{ width:  '100px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
                                <td style={{ width: '100px', textAlign: 'center' }} >詳細</td>
                                <td style={{ width: '140px', textAlign: 'center' }}>店舗名</td>
                                <td style={{ width: '100px', textAlign: 'center' }}>担当営業</td>
                                <td style={{ width: '140px' }}>反響日</td>
                                <td style={{ width: '160px' }}>反響媒体</td>
                                <td style={{ width: '130px' }}>お客様名</td>
                                <td style={{ width: '130px' }}>ふりがな</td>
                                <td style={{ width: '130px' }}>電話番号</td>
                                <td style={{ width: '200px' }}>住所</td>
                                <td style={{ width: '130px' }}>物件名</td>
                                <td style={{ width: '120px' }}>希望エリア</td>
                                <td style={{ width: '700px' }}>顧客タグ</td>
                            </tr>
                        </thead>
                        <tbody>
                            {inquiryList.slice(0, displayLength).map((item, index) => {
                                const formattedValue = shopFormate(item.shop, item.brand, shopArray) ?? '';
                                const styleClass = setStyleClassSpec(item.shop);
                                const formattedShops = shopArray.map(item => ({
                                    ...item,
                                    shop: shopFormate(item.shop, item.brand, shopArray) ?? ''
                                }));
                                return (
                                    <tr key={index} style={{ textAlign: 'left' }}
                                        className={isBlack(item.mail, item.mobile, item.black_list) ? 'table-danger align-middle' : Number(item.sync) || item.black_list.split('duplicate').length % 2 === 0 || item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 ? 'table-primary align-middle' : 'align-middle'}>
                                        <td style={{ textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>
                                            <>{item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 || item.shop.includes('重複') ? <i className="fa-solid fa-xmark"></i> :
                                                Number(item.sync) === 1 ? <span style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                    onClick={() => item.pg_id.length === 26 ? setEditId(item.pg_id) : null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                    <i className='fa-solid fa-arrows-rotate sticky-column'
                                                        style={{ opacity: (item.shop && item.staff) ? '1' : '.3', cursor: item.shop ? 'pointer' : '' }}
                                                        onClick={() => item.shop ? handleSync(item.inquiry_id) : null}
                                                    ></i>
                                            }</>
                                            {isBlack(item.mail, item.mobile, item.black_list) &&
                                                <div className='text-danger'><i className="fa-solid fa-triangle-exclamation"></i><span style={{ fontSize: '9px' }}>ブラックリスト</span></div>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {item.note ?
                                                <i className="fa-solid fa-magnifying-glass" style={{ cursor: 'pointer' }}
                                                    onClick={() => setSearchId(item.inquiry_id)}></i> : '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {Number(item.sync) ? item.shop :
                                                <select  style={{...styleClass, fontSize: isSp ? '8px' : '12px'}} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}>
                                                    <option value='' className='bg-white text-dark'>店舗未設定</option>
                                                    {formattedShops.map((shopValue, shopIndex) => {
                                                        return (
                                                            <option key={shopIndex} selected={shopValue.shop === formattedValue} className='bg-white text-dark'>{shopValue.shop}</option>
                                                        )
                                                    }
                                                    )}
                                                </select>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}><
                                            select style={{ ...styleClass, opacity: item.shop ? '1' : '.5', fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')} disabled={!item.shop}>
                                            <option value='' className='bg-white text-dark'>担当営業を選択</option>
                                            {staffList.filter(staffValue => staffValue.shop === formattedValue).map((staffValue, shopIndex) =>
                                                <option key={shopIndex} selected={staffValue.name === item.staff} className='bg-white text-dark'>{staffValue.name}</option>
                                            )}
                                            {item.shop && <option value={`${item.shop}`} className='bg-white text-dark'>{item.shop} 店舗管理</option>}
                                        </select>
                                        </td>
                                        <td>{dateFormate(item.inquiry_date)}</td>
                                        <td>{item.response_medium}{item.medium !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign}）</span></>}</td>
                                        <td>{item.first_name}{item.last_name}</td>
                                        <td>{kataToHira(`${item.first_name_kana}${item.last_name_kana}`)}</td>
                                        <td>{extractNumbers(item.mobile || item.landline)}</td>
                                        <td>{item.pref}{item.city}{item.town}{item.street}{item.building}</td>
                                        <td>{item.property}</td>
                                        <td>{item.area}</td>
                                        <td>
                                            <div className='d-flex'>
                                                <div className={`bg-primary text-white rounded-pill px-2 me-2 tag ${item.black_list.split('duplicate').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'duplicate', 'tag')}>重複</div>
                                                <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${item.black_list.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'gift', 'tag')}>ギフト券進呈済み</div>
                                                <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${item.black_list.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'support', 'tag')}>業者</div>
                                                <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${item.black_list.split('black').length % 2 === 0 ? 'checked' : ''}`}
                                                    onClick={() => {
                                                        listChange(item.inquiry_id, 'black', 'tag');
                                                        handleBlack(item.brand, `${item.first_name}${item.last_name}`, item.mobile, item.mail, item.zip, `${item.pref}${item.city}${item.town}${item.street}${item.building}`);
                                                    }}>ブラックリスト</div>
                                            </div>
                                        </td>
                                    </tr>);
                            })}
                        </tbody>
                    </Table>
                    {totalLength <= displayLength ? null :
                        <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                            <span style={{ color: '#fff', fontSize: '12px', padding: '5px 12px', borderRadius: '10px', cursor: 'pointer' }}
                                className='bg-success'
                                onClick={() => setDisplayLength(displayLength + 20)}>
                                {totalLength - displayLength > 19 ? `${displayLength + 20}件を表示/${totalLength}件中` : `${totalLength - displayLength + (20 * (displayLength / 20))}件を表示/${totalLength}件中`}
                            </span>
                        </div>}
                </div>
            </div>
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <Modal show={!!searchId} onHide={() => setSearchId('')}>
                <Modal.Header closeButton>{customerDetail.title}からの反響</Modal.Header>
                <Modal.Body>
                    {customerDetail.text.split('\n').map((item, index) =>
                        <div key={index} style={{ fontSize: '11px' }}>{item}</div>
                    )}
                </Modal.Body>
            </Modal>
        </>

    )
}
export default ListKaeru;
