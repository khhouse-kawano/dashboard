import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { shopFormate } from '../../utils/shopFormate';
import { setStyleClass } from '../../utils/setStyleClass';
import { mediumFormate } from '../../utils/mediumFormate';
import InformationEdit from '../information/InformationEdit';
import { generateULID } from '../../utils/createULID';
import { monthFormate, handleBlack, toHalfWidth } from './listUtils';
import { useIsSp } from '../../utils/isSp';
import OrderModal from './OrderModal';
import SmileFestival from './SmileFestival';

type Shop = { brand: string, shop: string, section: string, area: string };

type Medium = { medium: string, list_medium: number };

type InquiryCustomer = {
    id: number, inquiry_id: string, pg_id: string, inquiry_date: string, medium: string, response_medium: string, first_name: string, last_name: string,
    first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, zip: string, pref: string, city: string, town: string, street: string,
    building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, black_list: string, hp_campaign: string,
    duplicate: string, hotlead_url: string,
};

type Customer = { register: string, shop: string, interview: string, medium: string };

type Staff = { name: string, pg_id: string, shop: string, category: number, robo_id: string, period: string, section: string };

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };

type Props = {
    onReload: () => void;
};

type Black = {
    mobile: string,
    mail: string
};

const targetSection = ['鹿児島営業1課', '鹿児島営業2課', '鹿児島営業3課', '宮崎営業課', '熊本営業課', '大分・佐賀営業課',];

const monthArray = getYearMonthArray(2025, 1);

const isDup = (item: InquiryCustomer) => {
    const bl = item.black_list || '';
    return bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const notNeedSync = (item: InquiryCustomer) => {
    const bl = item.black_list || '';
    return item.sync === 1 || bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const ListOrder = ({ onReload }: Props) => {
    const { authority, token, category } = useContext(AuthContext);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [inquiryList, setInquiryList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(0);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetShop, setTargetShop] = useState<string>('');
    const [totalLength, setTotalLength] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);
    const [editId, setEditId] = useState('');
    const [blackList, setBlackList] = useState<Black[]>([]);

    const [checkedIds, setCheckedIds] = useState<string[]>([]);

    const isSp = useIsSp();
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setStartMonth(`${year}/${month}`);
        setEndMonth(`${year}/${month}`);
        setSelectedMonth([`${year}/${month}`]);
        const thisYear = now.getMonth() <= 4 ? year : year + 1;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'list', category });
                setCustomerList(response.data.summary);
                setShopArray(response.data.shop);
                setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && targetSection.includes(s.section)));
                setMediumArray(response.data.medium.filter((m: Medium) => m.list_medium === 1));
                setOriginalList(response.data.inquiry);
                setOriginalBeforeList(response.data.survey);
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
    }, [startMonth, endMonth]);

    useEffect(() => {
        if (isSp) {
            setTargetSync(null);
        }
    }, [isSp]);

    const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;

    const isSync = (list: InquiryCustomer, value: string) => {
        const bl = list.black_list || '';
        return bl.split(value).length % 2 !== 0
    };

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;
        const resMedium = item.response_medium || '';
        const inqDate = item.inquiry_date || '';
        const itemShop = item.shop || '';

        return (
            selectedMonth.includes(monthFormate(inqDate)) &&
            (targetShop === '' || itemShop.includes(targetShop)) &&
            (mediumValue === '' || resMedium === mediumValue) &&
            (targetSync === null || (targetSync === 0 ?
                (item.sync === targetSync && (isSync(item, 'duplicate') && isSync(item, 'support') && isSync(item, 'black')))
                : item.sync === targetSync || !isSync(item, 'duplicate') || !isSync(item, 'support') || !isSync(item, 'black'))) &&
            (targetName === '' || fullName.includes(targetName)) &&
            (targetAddress === '' || fullAddress.includes(targetAddress)))
    }), [originalList, selectedMonth, targetShop, mediumValue, targetSync, targetName, targetAddress]);

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
        return originalList.filter(c => selectedMonth.includes(monthFormate(c.inquiry_date || '')));
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


    // 💡 修正: 指定された同期成功後のロジックを復元し、一括処理にも対応
    const handleSync = async (idValues: string | string[]) => {
        const idsToProcess = Array.isArray(idValues) ? idValues : [idValues];
        const targets = inquiryList.filter(i => idsToProcess.includes(i.inquiry_id));

        if (targets.length === 0) return;

        const unassigned = targets.find(t => shopFormate(t.shop || '', t.brand || '', shopArray)?.includes('店舗未設定'));
        if (unassigned) {
            alert(`同期に失敗しました。 ※店舗が未選択の顧客が含まれています。`);
            return;
        }

        const confirmMsg = targets.length === 1
            ? `${shopFormate(targets[0].shop || '', targets[0].brand || '', shopArray)} ${targets[0].first_name || ''} ${targets[0].last_name || ''}様 顧客情報を取り込みますか?`
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
            const filteredShop = shopFormate(filteredCustomer.shop || '', filteredCustomer.brand || '', shopArray) ?? '';
            const filteredMedium = mediumFormate(filteredCustomer.medium || '');
            const brandValue = filteredCustomer.brand ?? '';
            const mailValue = filteredCustomer.mail ?? '';
            const surveyID = surveyBeforeList.find(s => s.brand === brandValue && s.emailAddress === mailValue)?.id ?? '0';
            const targetData = surveyBeforeList.find(item => item.id === surveyID);

            const phone_number_1 = toHalfWidth(filteredCustomer.mobile || '') || toHalfWidth(filteredCustomer.landline || '');
            const phone_number_2 = phone_number_1 === toHalfWidth(filteredCustomer.landline || '') ? '' : toHalfWidth(filteredCustomer.landline || '');

            const brands: Record<string, string> = {
                'KH': '国分ハウジング',
                'DJ': 'デイジャストハウス',
                'なご': 'なごみ工務店',
                '2L': 'ニーエルホーム',
                'JH': 'ジャスフィーホーム',
                'FH': 'フルコミホーム',
                'PG': 'PG HOUSE'
            };

            const brandValueStr = brands[filteredShop.slice(0, 2)] || '';

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
                customer_contacts_email: mailValue,
                postal_code: filteredCustomer.zip || '',
                full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                sales_promotion_name: filteredCustomer.response_medium || '',
                remarks: targetData ? `反響経路:${filteredCustomer.hp_campaign}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
                    : '',
                reserved_interview: filteredCustomer.reserved_date || '',
                response_status: filteredMedium,
                hp_campaign: filteredCustomer.hp_campaign || '',
                status: '見込み',
                planned_construction_site: filteredCustomer.area || '',
                request: 'list',
                section: shopArray.find(s => s.shop === filteredShop)?.section ?? '',
                brand: brandValueStr,
                category,
                roll: 'insert'
            };

            try {
                const response = await apiClient.post("", postData);
                if (response.data && response.data.status === 'success') {
                    successCount++;
                    lastMessage = response.data.message || '同期が完了しました。';

                    // 💡 指定された元のロジックを適用
                    const pg_id = response.data.pg_id?.pg_id ?? '';
                    updatedList = updatedList.map(o => o.inquiry_id === filteredCustomer.inquiry_id ? ({
                        ...o,
                        pg_id,
                        sync: 1
                    }) : o);
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error("データ取得エラー:", error);
                failCount++;
            }
        }

        // 💡 状態を一度に更新
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

        const updated = inquiryList.map(item => {
            if (item.inquiry_id !== id) return item;
            const key = keyMap[demandValue as keyof typeof keyMap];
            if (demandValue === 'tag') {
                return {
                    ...item,
                    [key]: `${item[key as keyof InquiryCustomer] || ''} ${listValue}`.trim(),
                };
            }
            return {
                ...item,
                [key]: listValue,
            };
        });

        setInquiryList(updated);

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

    const [modalContent, setModalContent] = useState<string>('');

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
        return filteredInquiry.filter(c => (shopValue ? c.shop === shopValue : true) && (c.sync === 0 && (c.black_list.split('duplicate').length % 2 !== 0 && c.black_list.split('support').length % 2 !== 0 && c.black_list.split('black').length % 2 !== 0))).length;
    }

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => s.category === 1 && (shopValue ? s.shop === shopValue : true)).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return filteredInterview.filter(c => (shopValue ? c.shop == shopValue : true)).length;
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


    // 特設イベント用
    const eventTitle = '住まいるフェスティバル';
    const [eventSummary, setEventSummary] = useState(false);

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
                                    <option key={index} value={item.medium}>{item.medium}</option>
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
                            <input type="text" className='target' placeholder='住所で検索' onChange={(e) => setTargetAddress(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                    </>}

                    <div className="bg-primary text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => setEditId('new')}>新規登録</div>

                    {checkedIds.length > 0 && (
                        <div className="bg-success text-white px-3 py-1 rounded m-1 d-flex justify-content-center align-items-center"
                            style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            onClick={() => handleSync(checkedIds)}>
                            <i className="fa-solid fa-check-double me-2"></i> {checkedIds.length}件を一括同期
                        </div>
                    )}
                    <div className="bg-danger text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => setEventSummary(true)}>{eventTitle}</div>
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

                    <Table striped bordered hover style={{ width: isSp ? '1200px' : '1800px', fontSize: isSp ? "8px" : "12px" }}>
                        <thead className='sticky-header'>
                            <tr className='sticky-header'>
                                {/* 💡 チェックボックスと同期ボタンを同じカラムに統合 */}
                                <td style={{ width: '80px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
                                <td style={{ width: '60px', textAlign: 'center' }}>事前アンケート</td>
                                <td style={{ width: '80px', textAlign: 'center' }}>店舗名</td>
                                <td style={{ width: '80px', textAlign: 'center' }}>担当営業</td>
                                <td style={{ width: '40px' }}>反響日</td>
                                <td style={{ width: '90px' }}>反響媒体</td>
                                <td style={{ width: '80px' }}>お客様名</td>
                                <td style={{ width: '200px' }}>連絡先</td>
                                <td style={{ width: '130px' }}>詳細</td>
                                <td style={{ width: '120px' }}>予定地</td>
                                <td style={{ width: '400px' }}>顧客タグ</td>
                            </tr>
                        </thead>
                        <tbody>
                            {inquiryList.slice(0, displayLength).map((item, index) => {
                                const formattedValue = shopFormate(item.shop || '', item.brand || '', shopArray) ?? '';
                                const styleClass = setStyleClass(item.shop || '');
                                const bl = item.black_list || '';

                                return (
                                    <tr key={index} style={{ textAlign: 'left' }}
                                        className={isBlack(item.mail, item.mobile, bl) ? 'table-danger align-middle' : notNeedSync(item) ? 'table-primary align-middle' : 'align-middle'}>

                                        {/* 💡 横並びのレイアウト調整 */}
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }} className={`${isSp ? '' : 'sticky-column'}`}>
                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                {item.sync !== 1 && !isDup(item) && !isBlack(item.mail, item.mobile, bl) && (
                                                    <input
                                                        type="checkbox"
                                                        checked={checkedIds.includes(item.inquiry_id)}
                                                        onChange={() => handleCheck(item.inquiry_id)}
                                                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                                    />
                                                )}
                                                <>{isDup(item) ? <i className="fa-solid fa-xmark"></i> :
                                                    item.sync === 1 ? <span style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                        onClick={() => (item.pg_id || '').length === 26 ? setEditId(item.pg_id) : null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                        <i className='fa-solid fa-arrows-rotate pointer'
                                                            onClick={() => handleSync(item.inquiry_id)}
                                                        ></i>
                                                }</>
                                            </div>
                                            {isBlack(item.mail, item.mobile, bl) &&
                                                <div className='text-danger mt-1'><i className="fa-solid fa-triangle-exclamation"></i><span style={{ fontSize: '9px' }}>ブラックリスト</span></div>}
                                        </td>

                                        <td style={{ textAlign: 'center' }}>{surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)?.id ? (
                                            <span style={{ textDecoration: 'none', backgroundColor: 'green', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                onClick={() => {
                                                    setModalContent('beforeSurvey');
                                                    modalShow('beforeSurvey', surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)!.id, item.hp_campaign || '');
                                                }}><i className="fa-solid fa-magnifying-glass-plus"></i></span>)
                                            : ('-')}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{(() => {
                                            const formattedShops = shopArray.map(shopItem => ({
                                                ...shopItem,
                                                shop: shopFormate(shopItem.shop, shopItem.brand, shopArray) ?? ''
                                            }))
                                            return (
                                                <>{item.sync === 1 ? item.shop :
                                                    <select style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}>
                                                        {formattedShops.map((shopValue, shopIndex) => {
                                                            return (
                                                                <option key={shopIndex} selected={shopValue.shop === formattedValue} style={{ backgroundColor: '#fff', color: '#000' }}>{shopValue.shop}</option>
                                                            )
                                                        }
                                                        )}
                                                    </select>}</>
                                            );
                                        })()}</td>
                                        <td style={{ textAlign: 'center' }}>{(() => {
                                            return (
                                                <select style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')}>
                                                    <option value=''>担当営業を選択</option>
                                                    {staffList.filter(staffValue =>
                                                        (formattedValue.includes('全店舗管理') ? staffValue.shop.includes(item.brand || '') && staffValue.shop.includes('霧島店') : staffValue.shop === formattedValue) &&
                                                        staffValue.category === 1).map((staffValue, shopIndex) =>
                                                            <option key={shopIndex} selected={staffValue.name === item.staff} style={{ backgroundColor: '#fff', color: '#000' }}>{staffValue.name}</option>
                                                        )}
                                                </select>
                                            );
                                        })()}</td>
                                        <td>{item.inquiry_date}</td>
                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}</td>
                                        <td>{item.first_name || ''}{item.last_name || ''}</td>
                                        <td>{item.pref || ''}{item.city || ''}{item.town || ''}{item.street || ''}{item.building || ''}<br />{toHalfWidth(item.mobile || '')}{(!item.mobile && item.landline) && `/${toHalfWidth(item.landline || '')}`}</td>
                                        <td>{item.duplicate && (item.duplicate || '').split(',').map((value, vIndex) => {
                                            return (
                                                <div key={vIndex} style={styleClass} className='mb-1'>{(formattedValue.includes('ホットリード') ? <a href={item.hotlead_url} target='_blank' rel="noreferrer" style={{ color: '#fff' }}>#{value}</a> : value)}</div>
                                            )
                                        })}</td>
                                        <td>{item.area || ''}</td>
                                        <td>
                                            <div className='d-flex'>
                                                <div className={`bg-primary text-white rounded-pill px-2 me-2 tag ${bl.split('duplicate').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'duplicate', 'tag')}>重複</div>
                                                <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${bl.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'gift', 'tag')}>ギフト券進呈済み</div>
                                                <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${bl.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'support', 'tag')}>業者</div>
                                                <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${bl.split('black').length % 2 === 0 ? 'checked' : ''}`}
                                                    onClick={() => {
                                                        listChange(item.inquiry_id, 'black', 'tag');
                                                        handleBlack(item.brand || '', `${item.first_name || ''}${item.last_name || ''}`, item.mobile || '', item.mail || '', item.zip || '', `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`, category);
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
            <OrderModal show={show} modalClose={modalClose} modalContent={modalContent} modalBeforeContent={modalBeforeContent} />
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <SmileFestival eventSummary={eventSummary} setEventSummary={setEventSummary} />
        </>
    )
}
export default ListOrder;