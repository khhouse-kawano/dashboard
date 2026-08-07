import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { shopFormate } from '../../utils/shopFormate';
import InformationEditKaeru from '../information/InformationEditKaeru';
import { generateULID } from '../../utils/createULID';
import Modal from 'react-bootstrap/Modal';
import { setStyleClassSpec } from '../../utils/setStyleClassSpec';
import { thisYear } from '../../utils/thisYear';
import { dateFormate, monthFormate, handleBlack, toHalfWidth } from './listUtils';
import { kataToHira } from '../../utils/kataToHira';
import { extractNumbers } from '../../utils/extraNumbers';
import { useIsSp } from '../../utils/isSp';

type Shop = { brand: string, shop: string, section: string, area: string };

type InquiryCustomer = Record<string, string | number>;

type Customer = { register: string, shop: string, interview: string, medium: string, tour: string };

type Staff = { name: string, shop: string, period: string, section: string, category: number };

type Props = {
    onReload: () => void;
};

type Black = {
    mobile: string,
    mail: string
};

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };

const targetSection = ['不動産営業1課', '不動産営業2課'];

const isDup = (item: InquiryCustomer) => {
    const bl = String(item.black_list || '');
    return bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const notNeedSync = (item: InquiryCustomer) => {
    const bl = String(item.black_list || '');
    return Number(item.sync) === 1 || bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const ListKaeru = ({ onReload }: Props) => {
    const { authority, category, token } = useContext(AuthContext);
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
    const [editId, setEditId] = useState('');
    const [blackList, setBlackList] = useState<Black[]>([]);
    const [searchId, setSearchId] = useState('');
    
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);

    const [checkedIds, setCheckedIds] = useState<string[]>([]);

    const loaderRef = useRef<HTMLDivElement>(null);
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
                const response = await apiClient.post('', { request: 'list', category });
                setCustomerList(response.data.summary);
                setShopArray(response.data.shop);
                setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && targetSection.includes(s.section)));
                setMediumArray(response.data.medium.map((m: any) => m.medium));
                setOriginalList(response.data.inquiry);
                setOriginalBeforeList(response.data.survey || []);
                setBlackList(response.data.black);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        fetchData();
    }, [category]);

    useEffect(() => {
        const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? monthArray.indexOf(endMonth) : monthArray.length - 1;
        const filteredMonth = monthArray.slice(startIndex, endIndex + 1);
        setSelectedMonth(filteredMonth);
    }, [startMonth, endMonth, monthArray]);

    useEffect(() => {
        if (isSp) {
            setTargetSync(null);
        }
    }, [isSp]);


    const isSync = (list: InquiryCustomer, value: string) => {
        const bl = String(list.black_list || '');
        return bl.split(value).length % 2 !== 0
    };

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;

        const rawKana = `${item.first_name_kana || ""}${item.last_name_kana || ""}`;
        const fullKana = kataToHira(rawKana);
        const normalizedTargetKana = kataToHira(targetKana);

        const formattedMobile = extractNumbers(String(item.mobile || item.landline || ''));
        const normalizedTargetMobile = extractNumbers(targetMobile);

        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;
        const resMedium = String(item.response_medium || '');
        const inqDate = String(item.inquiry_date || '');
        const itemShop = String(item.shop || '');

        return (
            selectedMonth.includes(monthFormate(inqDate)) &&
            (targetShop === '' || itemShop === targetShop) &&
            (mediumValue === '' || resMedium.includes(mediumValue)) &&
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
        setCheckedIds([]); 
    }, [filteredInquiryList]);

    useEffect(() => {
        setSurveyBeforeList(filteredBeforeList);
    }, [originalBeforeList, selectedMonth]);

    const filteredBeforeList = useMemo(() => {
        const filtered = originalBeforeList.filter(item => selectedMonth.includes(monthFormate(item.dateStr || '')));
        return filtered;
    }, [originalBeforeList, selectedMonth]);

    const filteredInterview = useMemo(() => {
        return customerList.filter(c => selectedMonth.includes(monthFormate(c.interview || '')));
    }, [customerList, selectedMonth]);

    const filteredInquiry = useMemo(() => {
        return originalList.filter(c => selectedMonth.includes(monthFormate(String(c.inquiry_date || ''))));
    }, [originalList, selectedMonth]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLength((prev) => {
                        if (prev < totalLength) return prev + 20;
                        return prev;
                    });
                }
            },
            { rootMargin: '200px' } 
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) observer.unobserve(currentLoader);
        };
    }, [totalLength]);


    const handleSync = async (idValues: string | string[]) => {
        const idsToProcess = Array.isArray(idValues) ? idValues : [idValues];
        const targets = inquiryList.filter(i => idsToProcess.includes(String(i.inquiry_id)));

        if (targets.length === 0) return;

        // 💡 店舗または担当が未設定のチェック
        const unassigned = targets.find(t => {
            const shop = String(t.shop || '');
            const staff = String(t.staff || '');
            return !shop || shop.includes('店舗未設定') || !staff;
        });
        if (unassigned) {
            alert(`同期に失敗しました。 ※店舗または担当営業が未選択の顧客が含まれています。`);
            return;
        }

        const confirmMsg = targets.length === 1 
            ? `${targets[0].shop || ''} ${targets[0].first_name || ''} ${targets[0].last_name || ''}様 顧客情報を取り込みますか?`
            : `選択した ${targets.length} 件の顧客情報を一括で取り込みますか?`;

        if (!window.confirm(confirmMsg)) {
            console.log("キャンセルされました。");
            return;
        }

        let successCount = 0;
        let failCount = 0;
        let lastMessage = '';
        let updatedList = [...originalList];

        for (const filteredCustomer of targets) {
            const filteredShop = String(filteredCustomer.shop || '');
            const phone_number_1 = toHalfWidth(String(filteredCustomer.mobile || '')) || toHalfWidth(String(filteredCustomer.landline || ''));
            const phone_number_2 = phone_number_1 === toHalfWidth(String(filteredCustomer.landline || '')) ? '' : toHalfWidth(String(filteredCustomer.landline || ''));

            const postData = {
                id: generateULID(),
                inquiry_id: filteredCustomer.inquiry_id,
                in_charge_user: filteredCustomer.staff ? filteredCustomer.staff : `${filteredShop} 管理`,
                customer_contacts_name: `${filteredCustomer.first_name || ''} ${filteredCustomer.last_name || ''}`,
                customer_contacts_name_kana: `${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`,
                in_charge_store: filteredShop,
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: filteredCustomer.inquiry_date || '',
                customer_contacts_phone_number: phone_number_1, 
                customer_contacts_mobile_phone_number: phone_number_2, 
                customer_contacts_email: filteredCustomer.mail || '',
                postal_code: filteredCustomer.zip || '',
                full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                sales_promotion_name: filteredCustomer.response_medium || '',
                remarks: filteredCustomer.note || '',
                reserved_interview: filteredCustomer.reserved_date || '',
                hp_campaign: filteredCustomer.hp_campaign || '',
                status: '追客中',
                planned_construction_site: filteredCustomer.area || '',
                category,
                request: 'list',
                roll: 'insert'
            };

            try {
                const response = await apiClient.post("", postData);
                
                if (response.data && response.data.status === 'success') {
                    successCount++;
                    lastMessage = response.data.message || '同期が完了しました。';
                    
                    const returnedPgId = response.data.pg_id?.pg_id || postData.id;
                    updatedList = updatedList.map(o => o.inquiry_id === filteredCustomer.inquiry_id ? ({
                        ...o,
                        pg_id: returnedPgId,
                        sync: 1 
                    }): o);

                } else {
                    failCount++;
                }
            } catch (error) {
                console.error("データ取得エラー:", error);
                failCount++;
            }
        }

        setOriginalList(updatedList);

        if (targets.length === 1) {
            if (successCount > 0) alert(lastMessage);
            else alert('同期に失敗しました。');
        } else {
            alert(`一括同期が完了しました。\n成功: ${successCount}件\n失敗: ${failCount}件`);
        }

        setCheckedIds([]); 
        onReload();
    };

    const handleCheck = (id: string) => {
        setCheckedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
    };

    const listChange = async (id: string, listValue: string, demandValue: string) => {
        const postData = {
            list: listValue,
            roll: demandValue,
            inquiry_id: id,
            request: 'list',
            category
        };

        const keyMap = {
            shop_change: 'shop',
            staff_change: 'staff',
            tag: 'black_list',
        } as const;

        const updatedOriginal = originalList.map(item => {
            if (item.inquiry_id !== id) return item;
            const key = keyMap[demandValue as keyof typeof keyMap];
            if (demandValue === 'tag') {
                return {
                    ...item,
                    [key]: `${item[key] || ''} ${listValue}`.trim(),
                };
            }
            return {
                ...item,
                [key]: listValue,
            };
        });

        setOriginalList(updatedOriginal);

        try {
            const response = await apiClient.post('', postData);
            if (!response.data || response.data.length === 0) {
                alert('処理に失敗しました。');
                return;
            }
        } catch (error) {
            console.error('エラー:', error);
        }

        if (demandValue === 'tag' && (listValue === 'duplicate' || listValue === 'support' || listValue === 'black')) onReload();
    };

    const modalShow = async (request: string, idValue: number, campaignValue: string) => {
        if (request === 'beforeSurvey') {
            const modalFilter = surveyBeforeList.find(item => item.id === idValue);
            if (modalFilter) {
                await setModalBeforeContent({
                    id: modalFilter.id,
                    sync: 0,
                    brand: modalFilter.brand,
                    dateStr: modalFilter.dateStr,
                    name: modalFilter.name,
                    considerationStart: modalFilter.considerationStart,
                    desiredMoveIn: modalFilter.desiredMoveIn,
                    visitedCompanies: modalFilter.visitedCompanies,
                    reasonForConsidering: modalFilter.reasonForConsidering,
                    reasonOther: modalFilter.reasonOther,
                    futurePlan: modalFilter.futurePlan,
                    futureOther: modalFilter.futureOther,
                    desiredSize: modalFilter.desiredSize,
                    desiredLayout: modalFilter.desiredLayout,
                    priorityItem: modalFilter.priorityItem,
                    expectedResidents: modalFilter.expectedResidents,
                    totalBudget: modalFilter.totalBudget,
                    monthlyRepayment: modalFilter.monthlyRepayment,
                    annualIncome: modalFilter.annualIncome,
                    yearsOfService: modalFilter.yearsOfService,
                    otherIncomePerson: modalFilter.otherIncomePerson,
                    otherAnnualIncome: modalFilter.otherAnnualIncome,
                    ownFunds: modalFilter.ownFunds,
                    otherLoans: modalFilter.otherLoans,
                    thingsToDo: modalFilter.thingsToDo,
                    thingsToDoOther: modalFilter.thingsToDoOther,
                    housingType: modalFilter.housingType,
                    housingTypeOther: modalFilter.housingTypeOther,
                    landArea: modalFilter.landArea,
                    referrerName: modalFilter.referrerName,
                    emailAddress: modalFilter.emailAddress,
                    campaign: campaignValue
                });
                await setShow(true);
            }
        }
    };

    const modalClose = async () => {
        await setShow(false);
    };

    const inquiryFilter = (shopValue: string) => {
        return filteredInquiry.filter(c => (shopValue ? c.shop === shopValue : true)).length;
    };

    const unSyncFilter = (shopValue: string) => {
        return filteredInquiry.filter(c => {
            const bl = String(c.black_list || '');
            return (shopValue ? c.shop === shopValue : true) && 
                (Number(c.sync) === 0 && 
                bl.split('duplicate').length % 2 !== 0 && 
                bl.split('support').length % 2 !== 0 && 
                bl.split('black').length % 2 !== 0);
        }).length;
    };

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => s.category === 1 && (shopValue ? s.shop === shopValue : true)).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return filteredInterview.filter(c => (shopValue ? c.shop === shopValue : true)).length;
    };

    const isBlack = (mailValue: string, mobileValue: string, blackValue: string) => {
        const bl = blackValue || '';
        const safeMail = mailValue || '';
        const safeMobile = mobileValue || '';
        return blackList.some(b =>
            (safeMail && b.mail.includes(safeMail)) ||
            (toHalfWidth(safeMobile) && toHalfWidth(b.mobile).includes(toHalfWidth(safeMobile)))
        ) || (bl.split('black').length % 2 === 0);
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
            title: value?.hp_campaign ? String(value.hp_campaign) : String(value?.response_medium || ''),
            text: String(value?.note || '')
        });
    }, [searchId, inquiryList]);

    return (
        <>
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
                        <select className="target" onChange={(e) => setTargetShop(e.target.value)} style={{ fontSize: '13px' }}>
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

                    {checkedIds.length > 0 && (
                        <div className="bg-success text-white px-3 py-1 rounded m-1 d-flex justify-content-center align-items-center" 
                            style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            onClick={() => handleSync(checkedIds)}>
                            <i className="fa-solid fa-check-double me-2"></i> {checkedIds.length}件を一括同期
                        </div>
                    )}

                    <div className="bg-primary text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => setEditId('new')}>新規登録</div>
                </div>

                <div className='p-0 inquiry'>
                    {!isSp &&
                        <Table striped bordered hover className='inquiry_table'>
                            <thead className='sticky-header' style={{ fontSize: "10px" }}>
                                <tr className='sticky-header' style={{ textAlign: 'center' }}>
                                    <td className="sticky-column" style={{ width: '130px' }}>店舗名</td>
                                    <td style={{ width: '70px' }}>グループ全体</td>
                                    {shopArray.filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店')).map((value, index) => (<td key={index} className='text-center' style={{ width: '90px' }}>{value.shop.replace('店', '')}</td>))}
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: "12px" }}>
                                {['反響合計(未同期)', '反響目標(単月)', '来場合計', '来場目標(単月)'].map((category, cIndex) => <tr key={cIndex} className='text-center'>
                                    <td className="sticky-column">{category}</td>
                                    {[{ brand: '', shop: 'グループ全体', section: '', area: '' }, ...shopArray].filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店'))
                                        .map((value, sIndex) => {
                                            let totalValue;
                                            if (cIndex === 0) {
                                                totalValue = (`${inquiryFilter(sIndex === 0 ? '' : value.shop)}(${unSyncFilter(sIndex === 0 ? '' : value.shop)})`);
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

                    <Table striped bordered hover style={{ width: isSp ? '1100px' : '1500px', fontSize: isSp ? "8px" : "12px" }}>
                        <thead className='sticky-header'>
                            <tr className='sticky-header align-middle'>
                                <td style={{ width: '100px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
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
                                const formattedValue = shopFormate(String(item.shop || ''), String(item.brand || ''), shopArray) ?? '';
                                const styleClass = setStyleClassSpec(String(item.shop || ''));
                                const bl = String(item.black_list || '');
                                const itemShop = String(item.shop || '');
                                const itemStaff = String(item.staff || ''); // 💡 nullガード

                                const formattedShops = shopArray.map(shopItem => ({
                                    ...shopItem,
                                    shop: shopFormate(shopItem.shop, shopItem.brand, shopArray) ?? ''
                                }));
                                
                                return (
                                    <tr key={index} style={{ textAlign: 'left' }}
                                        className={isBlack(String(item.mail || ''), String(item.mobile || ''), bl) ? 'table-danger align-middle' : Number(item.sync) === 1 || bl.split('duplicate').length % 2 === 0 || bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 ? 'table-primary align-middle' : 'align-middle'}>
                                        
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }} className={`${isSp ? '' : 'sticky-column'}`}>
                                            <div className="d-flex align-items-center justify-content-center gap-3">
                                                {Number(item.sync) !== 1 && !isDup(item) && !isBlack(String(item.mail || ''), String(item.mobile || ''), bl) && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={checkedIds.includes(String(item.inquiry_id))} 
                                                        onChange={() => handleCheck(String(item.inquiry_id))} 
                                                        style={{ cursor: 'pointer', transform: 'scale(1.3)' }} 
                                                    />
                                                )}
                                                <>{bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || itemShop.includes('重複') ? <i className="fa-solid fa-xmark"></i> :
                                                    Number(item.sync) === 1 ? <span style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                        onClick={() => String(item.pg_id || '').length === 26 ? setEditId(String(item.pg_id)) : null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                        <i className='fa-solid fa-arrows-rotate'
                                                            style={{ opacity: (itemShop && itemStaff) ? '1' : '.3', cursor: (itemShop && itemStaff) ? 'pointer' : 'not-allowed', fontSize: '14px' }}
                                                            onClick={() => (itemShop && itemStaff) ? handleSync(String(item.inquiry_id)) : null}
                                                        ></i>
                                                }</>
                                            </div>
                                            {isBlack(String(item.mail || ''), String(item.mobile || ''), bl) &&
                                                <div className='text-danger mt-1'><i className="fa-solid fa-triangle-exclamation"></i><span style={{ fontSize: '9px' }}>ブラックリスト</span></div>}
                                        </td>
                                        
                                        <td style={{ textAlign: 'center' }}>
                                            {item.note ?
                                                <i className="fa-solid fa-magnifying-glass" style={{ cursor: 'pointer' }}
                                                    onClick={() => setSearchId(String(item.inquiry_id))}></i> : '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {Number(item.sync) === 1 ? item.shop :
                                                <select style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(String(item.inquiry_id), e.target.value, 'shop_change')}>
                                                    <option value='' className='bg-white text-dark'>店舗未設定</option>
                                                    {formattedShops.map((shopValue, shopIndex) => {
                                                        return (
                                                            <option key={shopIndex} selected={shopValue.shop === formattedValue} className='bg-white text-dark'>{shopValue.shop}</option>
                                                        )
                                                    }
                                                    )}
                                                </select>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <select style={{ ...styleClass, opacity: item.shop ? '1' : '.5', fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(String(item.inquiry_id), e.target.value, 'staff_change')} disabled={!item.shop}>
                                                <option value='' className='bg-white text-dark'>担当営業を選択</option>
                                                {staffList.filter(staffValue => staffValue.shop === formattedValue).map((staffValue, shopIndex) =>
                                                    <option key={shopIndex} selected={staffValue.name === item.staff} className='bg-white text-dark'>{staffValue.name}</option>
                                                )}
                                                {item.shop && <option value={`${item.shop}`} className='bg-white text-dark'>{item.shop} 店舗管理</option>}
                                            </select>
                                        </td>
                                        <td>{dateFormate(String(item.inquiry_date || ''))}</td>
                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}</td>
                                        <td>{item.first_name || ''}{item.last_name || ''}</td>
                                        <td>{kataToHira(`${item.first_name_kana || ''}${item.last_name_kana || ''}`)}</td>
                                        <td>{extractNumbers(String(item.mobile || item.landline || ''))}</td>
                                        <td>{item.pref || ''}{item.city || ''}{item.town || ''}{item.street || ''}{item.building || ''}</td>
                                        <td>{item.property || ''}</td>
                                        <td>{item.area || ''}</td>
                                        <td>
                                            <div className='d-flex'>
                                                <div className={`bg-primary text-white rounded-pill px-2 me-2 tag ${bl.split('duplicate').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(String(item.inquiry_id), 'duplicate', 'tag')}>重複</div>
                                                <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${bl.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(String(item.inquiry_id), 'gift', 'tag')}>ギフト券進呈済み</div>
                                                <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${bl.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(String(item.inquiry_id), 'support', 'tag')}>業者</div>
                                                <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${bl.split('black').length % 2 === 0 ? 'checked' : ''}`}
                                                    onClick={() => {
                                                        listChange(String(item.inquiry_id), 'black', 'tag');
                                                        handleBlack(String(item.brand || ''), `${item.first_name || ''}${item.last_name || ''}`, String(item.mobile || ''), String(item.mail || ''), String(item.zip || ''), `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`, category);
                                                    }}>ブラックリスト</div>
                                            </div>
                                        </td>
                                    </tr>);
                            })}
                        </tbody>
                    </Table>

                    <div ref={loaderRef} style={{ height: '30px', textAlign: 'center', paddingBottom: '20px' }}>
                        {totalLength > displayLength && <span className="text-muted" style={{ fontSize: '12px' }}>読み込み中...</span>}
                    </div>

                </div>
            </div>
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <Modal show={!!searchId} onHide={() => setSearchId('')}>
                <Modal.Header closeButton>{customerDetail.title}からの反響</Modal.Header>
                <Modal.Body>
                    {(customerDetail.text || '').split('\n').map((item, index) =>
                        <div key={index} style={{ fontSize: '11px' }}>{item}</div>
                    )}
                </Modal.Body>
            </Modal>
        </>
    )
}
export default ListKaeru;