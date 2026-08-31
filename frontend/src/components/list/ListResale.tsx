import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Table from "react-bootstrap/Table";
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import InformationEditResale from '../information/InformationEditResale';
import { generateULID } from '../../utils/createULID';
import Modal from 'react-bootstrap/Modal';
import { setStyleClassUsed } from '../../utils/setStyleClassUsed';
import { thisYear } from '../../utils/thisYear';
import { useIsSp } from '../../utils/isSp';
import { dateFormate, monthFormate, handleBlack, toHalfWidth, positions } from './listUtils';

type InquiryCustomer = {
    id: number, inquiry_id: string, pg_id: string, inquiry_date: string, medium: string, response_medium: string, first_name: string, last_name: string, category: string,
    first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, zip: string, pref: string, city: string, town: string, street: string,
    building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, black_list: string, hp_campaign: string,
    duplicate: string, property: string, note: string
};

type Customer = {
    id: string, name: string, status: string, medium: string, rank: string, register: string, reserve: string, shop: string, estate: string, meeting: string, category: string,
    appointment: string, line_group: string, screening: string, rival: string, period: string, survey: string, budget: string, importance: string, note: string, staff: string, section: string, contract: string, sales_meeting: string, latest_date: string, last_meeting: string,
};

type Staff = { name: string, shop: string, position: string };

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };

type Props = {
    onReload: () => void;
};

type Black = {
    mobile: string,
    mail: string
};

const isDup = (item: InquiryCustomer) => {
    const bl = item.black_list || '';
    return bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const notNeedSync = (item: InquiryCustomer) => {
    const bl = item.black_list || '';
    return item.sync === 1 || bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || bl.split('duplicate').length % 2 === 0;
};

const ListResale = ({ onReload }: Props) => {
    const categoryMapping: Record<string, string> = {
        portal_sell: '売り:ポータル',
        portal_buy: '買い:ポータル',
        renove: '買い:中古リノベ',
    };
    const search = useLocation().search;
    const query = new URLSearchParams(search);
    const shopValue = query.get('shop') ?? '';

    const { authority, category, token } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [inquiryList, setInquiryList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(0);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetCategory, setTargetCategory] = useState<string>('');
    const [totalLength, setTotalLength] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [editId, setEditId] = useState('');
    const [blackList, setBlackList] = useState<Black[]>([]);
    const [searchId, setSearchId] = useState('');
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];

    // 💡 一括登録用のチェックボックス管理State
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
                const targetShop = categoryMapping[shopValue] === '買い:中古リノベ' ? '中古住宅専門店' : '不動産企画係';
                const staffResponse = response.data.staff
                    .sort((a, b) => {
                        const positionA = positions.indexOf(a.position) ?? 6;
                        const positionB = positions.indexOf(b.position) ?? 6;
                        return positionA - positionB
                    })
                    .filter((s: Staff) => s.shop  === targetShop)
                setStaffList(staffResponse);
                setMediumArray(response.data.medium.map((m: any) => m.medium));
                setOriginalList(response.data.inquiry);
                setOriginalBeforeList(response.data.survey || []);
                setBlackList(response.data.black);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, [category, shopValue]);

    useEffect(() => {
        const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? monthArray.indexOf(endMonth) : monthArray.length - 1;
        const filteredMonth = monthArray.slice(startIndex, endIndex + 1);
        setSelectedMonth(filteredMonth);
    }, [startMonth, endMonth, monthArray]);

    useEffect(() => {
        setTargetCategory(categoryMapping[shopValue] ?? '');
    }, [shopValue]);

    useEffect(() => {
        if (isSp) {
            setTargetSync(null);
        }
    }, [isSp]);

    const isSync = (list: InquiryCustomer, value: string) => {
        const bl = list.black_list || '';
        return bl.split(value).length % 2 !== 0
    };

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;

        const inqDate = item.inquiry_date || '';
        const itemCategory = item.category || '';
        const resMedium = item.response_medium || '';

        return (
            selectedMonth.includes(monthFormate(inqDate)) &&
            (targetCategory === '' || itemCategory === targetCategory) &&
            (mediumValue === '' || resMedium.includes(mediumValue)) &&
            (targetSync === null || (targetSync === 0 ?
                (item.sync === targetSync && (isSync(item, 'duplicate') && isSync(item, 'support') && isSync(item, 'black')))
                : item.sync === targetSync || !isSync(item, 'duplicate') || !isSync(item, 'support') || !isSync(item, 'black'))) &&
            (targetName === '' || fullName.includes(targetName)) &&
            (targetAddress === '' || fullAddress.includes(targetAddress)))
    }), [originalList, selectedMonth, targetCategory, targetMedium, targetSync, targetName, targetAddress]);

    useEffect(() => {
        setInquiryList(filteredInquiryList);
        setTotalLength(filteredInquiryList.length);
        setDisplayLength(20);
        setCheckedIds([]); // フィルターが変わったら選択状態をリセット
    }, [filteredInquiryList]);

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


    // 💡 指定された元のpg_id更新ロジックを復元し、一括処理に対応
    const handleSync = async (idValues: string | string[]) => {
        const idsToProcess = Array.isArray(idValues) ? idValues : [idValues];
        const targets = inquiryList.filter(i => idsToProcess.includes(i.inquiry_id));

        if (targets.length === 0) return;

        // 中古（ListResale）では category の未設定をチェック
        const unassigned = targets.find(t => !t.category);
        if (unassigned) {
            alert(`同期に失敗しました。 ※カテゴリーが未選択の顧客が含まれています。`);
            return;
        }

        const confirmMsg = targets.length === 1
            ? `${targets[0].category} ${targets[0].first_name || ''} ${targets[0].last_name || ''}様 顧客情報を取り込みますか?`
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
            const categoryValue = filteredCustomer.category || '';
            const phone_number_1 = toHalfWidth(filteredCustomer.mobile || '') || toHalfWidth(filteredCustomer.landline || '');
            const phone_number_2 = phone_number_1 === toHalfWidth(filteredCustomer.landline || '') ? '' : toHalfWidth(filteredCustomer.landline || '');

            const postData = {
                id: generateULID(),
                inquiry_id: filteredCustomer.inquiry_id,
                in_charge_user: filteredCustomer.staff ? filteredCustomer.staff : '中古住宅専門店 店舗管理',
                customer_contacts_name: `${filteredCustomer.first_name || ''} ${filteredCustomer.last_name || ''}`,
                customer_contacts_name_kana: `${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`,
                in_charge_store: categoryValue,
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
                status: '見込み',
                planned_construction_site: filteredCustomer.area || '',
                category: categoryValue,
                request: 'list_resale_sync',
                roll: 'insert'
            };

            try {
                const response = await apiClient.post("", postData);

                if (response.data && response.data.status === 'success') {
                    successCount++;
                    lastMessage = response.data.message || '同期が完了しました。';

                    // 💡 PHPから返ってきた pg_id を安全に取得。万が一取れなければ Reactで生成した postData.id を使う
                    const returnedPgId = response.data.pg_id?.pg_id || postData.id;

                    // 💡 リスト全体をリロードするのではなく、ReactのState上で対象レコードだけを更新する（高速＆省メモリ）
                    updatedList = updatedList.map(o => o.inquiry_id === filteredCustomer.inquiry_id ? ({
                        ...o,
                        pg_id: returnedPgId,
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
            shop_change: 'category',
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
        return inquiryList.filter(c => {
            const inqDate = c.inquiry_date || '';
            const itemCat = c.category || '';
            return (shopValue ? itemCat === shopValue : true) && selectedMonth.includes(monthFormate(inqDate));
        }).length;
    };

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => shopValue ? s.shop === shopValue : true).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return customerList.filter(c => {
            const reserveDate = c.reserve || '';
            const itemShop = c.shop || '';
            return (shopValue ? itemShop === shopValue : true) && selectedMonth.includes(monthFormate(reserveDate));
        }).length;
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
            title: value?.hp_campaign ? value?.hp_campaign : (value?.response_medium || ''),
            text: value?.note || ''
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
                        <select className="target" onChange={(e) => setTargetCategory(e.target.value)} style={{ fontSize: '13px', }} value={targetCategory}>
                            <option value=''>全カテゴリー表示</option>
                            {categoryList.map((item, index) =>
                                <option key={index} value={item}>{item}</option>
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
                            <input type="text" className='target' placeholder='住所で検索' onChange={(e) => setTargetAddress(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                    </>}



                    <div className="bg-warning text-dark px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => setEditId('new')}>新規登録</div>

                    {/* 💡 一括登録ボタン（チェックされている場合のみ表示） */}
                    {checkedIds.length > 0 && (
                        <div className="bg-success text-white px-3 py-1 rounded m-1 d-flex justify-content-center align-items-center"
                            style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            onClick={() => handleSync(checkedIds)}>
                            <i className="fa-solid fa-check-double me-2"></i> {checkedIds.length}件を一括同期
                        </div>
                    )}
                </div>
                <div className='p-0 inquiry'>
                    {!isSp &&
                        <Table striped bordered hover style={{ width: '800px' }}>
                            <thead className='sticky-header' style={{ fontSize: "10px" }}>
                                <tr className='sticky-header' style={{ textAlign: 'center' }}>
                                    <td style={{ width: '100px' }}>カテゴリー</td>
                                    {['中専全体', ...categoryList].map((value, index) => (<td key={index} className='text-center' style={{ width: '90px' }}>{value}</td>))}
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: "12px" }}>
                                {['反響合計', '反響目標', '来場合計', '来場目標'].map((category, cIndex) => <tr key={cIndex} className='text-center'>
                                    <td>{category}</td>
                                    {['中専全体', ...categoryList]
                                        .map((value, sIndex) => {
                                            let totalValue;
                                            if (cIndex === 0) {
                                                totalValue = inquiryFilter(sIndex === 0 ? '' : value);
                                            } else if (cIndex === 1 || cIndex === 3) {
                                                totalValue = achievementFilter(sIndex === 0 ? '' : value, cIndex === 1 ? 8 : 4);
                                            } else {
                                                totalValue = reserveFilter(sIndex === 0 ? '' : value);
                                            }
                                            return <td key={sIndex} className='text-center' style={{ width: '90px' }}>{totalValue}</td>
                                        })}
                                </tr>
                                )}
                            </tbody>
                        </Table>}
                    <Table striped bordered hover style={{ width: isSp ? '1200px' : '1500px', fontSize: isSp ? "8px" : "12px" }}>
                        <thead className='sticky-header'>
                            <tr className='sticky-header align-middle'>
                                {/* 💡 顧客取込列にチェックボックスと同期ボタンを統合 */}
                                <td style={{ width: '100px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
                                <td style={{ width: '100px', textAlign: 'center' }} >顧客詳細</td>
                                <td style={{ width: '140px', textAlign: 'center' }}>カテゴリー</td>
                                <td style={{ width: '100px', textAlign: 'center' }}>担当営業</td>
                                <td style={{ width: '140px' }}>反響日</td>
                                <td style={{ width: '160px' }}>反響媒体</td>
                                <td style={{ width: '130px' }}>お客様名</td>
                                <td style={{ width: '200px' }}>連絡先</td>
                                <td style={{ width: '130px' }}>物件名</td>
                                <td style={{ width: '120px' }}>希望エリア</td>
                                <td style={{ width: '500px' }}>顧客タグ</td>
                            </tr>
                        </thead>
                        <tbody>
                            {inquiryList.slice(0, displayLength).map((item, index) => {
                                const itemCat = item.category || '';
                                const itemShop = item.shop || '';
                                const bl = item.black_list || '';
                                const styleClass = setStyleClassUsed(itemCat);

                                return (
                                    <tr key={index} style={{ textAlign: 'left' }}
                                        className={isBlack(item.mail, item.mobile, bl) ? 'table-danger align-middle' : item.sync === 1 || bl.split('duplicate').length % 2 === 0 || bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 ? 'table-primary align-middle' : 'align-middle'}>

                                        {/* 💡 横並びのレイアウトでチェックボックスと同期ボタンを配置 */}
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }} className={`${isSp ? '' : 'sticky-column'}`}>
                                            <div className="d-flex align-items-center justify-content-center gap-3">
                                                {item.sync !== 1 && !isDup(item) && !isBlack(item.mail, item.mobile, bl) && (
                                                    <input
                                                        type="checkbox"
                                                        checked={checkedIds.includes(item.inquiry_id)}
                                                        onChange={() => handleCheck(item.inquiry_id)}
                                                        style={{ cursor: 'pointer', transform: 'scale(1.3)' }}
                                                    />
                                                )}
                                                <>{bl.split('support').length % 2 === 0 || bl.split('black').length % 2 === 0 || itemShop.includes('重複') ? <i className="fa-solid fa-xmark"></i> :
                                                    item.sync === 1 ? <span style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                        onClick={() => (item.pg_id || '').length === 26 ? setEditId(item.pg_id) : null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                        <i className='fa-solid fa-arrows-rotate'
                                                            style={{ opacity: itemCat ? '1' : '.3', cursor: itemCat ? 'pointer' : '', fontSize: '14px' }}
                                                            onClick={() => itemCat ? handleSync(item.inquiry_id) : null}
                                                        ></i>
                                                }</>
                                            </div>
                                            {isBlack(item.mail, item.mobile, bl) &&
                                                <div className='text-danger mt-1'><i className="fa-solid fa-triangle-exclamation"></i><span style={{ fontSize: '9px' }}>ブラックリスト</span></div>}
                                        </td>

                                        <td style={{ textAlign: 'center' }}>
                                            {item.note ?
                                                <i className="fa-solid fa-magnifying-glass" style={{ cursor: 'pointer' }}
                                                    onClick={() => setSearchId(item.inquiry_id)}></i> : '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <select style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}
                                                value={itemCat}
                                            >
                                                <option value='' className='bg-white text-dark'>カテゴリーを選択</option>
                                                {categoryList.map((categoryItem, cIndex) =>
                                                    <option key={cIndex} className='bg-white text-dark'>{categoryItem}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <select style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')}>
                                                <option value='' className='bg-white text-dark'>担当営業を選択</option>
                                                {staffList.map((staffValue, shopIndex) =>
                                                    <option key={shopIndex} selected={staffValue.name === item.staff} className='bg-white text-dark'>{staffValue.name}</option>
                                                )}
                                                <option value='中古住宅専門店 店舗管理' className='bg-white text-dark'>店舗管理</option>
                                            </select>
                                        </td>
                                        <td>{dateFormate(item.inquiry_date || '')}</td>
                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}</td>
                                        <td>{item.first_name || ''}{item.last_name || ''}</td>
                                        <td>{item.pref || ''}{item.city || ''}{item.town || ''}{item.street || ''}{item.building || ''}<br />{toHalfWidth(item.mobile || '')}{(!item.mobile && item.landline) && `/${toHalfWidth(item.landline || '')}`}</td>
                                        <td>{item.property || ''}</td>
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
            <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
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
export default ListResale;