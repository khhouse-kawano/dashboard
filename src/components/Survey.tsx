import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Table from "react-bootstrap/Table";
import { headers } from '../utils/headers';
import axios from 'axios';
import Form from 'react-bootstrap/Form';

type FormList = { brand: string, shop: string, age: string, mobile: string ,medium: string};
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = { brand: string, mail: string, reserve: string, contract: string, second_reserve: string, appoint: string, shop: string };
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; trash: number, section: string, cancel_status: string, second_reserve: string };
type Props = {
    originalDatabase: customerList[];
    form: FormList[];
    surveyList: Survey[];
    masterDataList: MasterDataList[]
};
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number };

const SurveyList = ({ originalDatabase, form, surveyList, masterDataList }: Props) => {
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [dimension, setDimension] = useState('年代');
    const [medium, setMedium] = useState(false);
    const [targetList, setTargetList] = useState({ label: false });
    const [surveyBrand, setSurveyBrand] = useState<Record<string, boolean>>({
        kh: true,
        'なごみ': true,
        djh: true,
        '2l': true,
        jh: true,
        pgh: true
    });
    const [display, setDisplay] = useState<Record<string, boolean>>({
        "反響": true,
        "来場": true,
        "次アポ": true,
        "契約": true
    });
    const [per, setPer] = useState(false);
    const [brand, setBrand] = useState(false);
    const [shop, setShop] = useState(false);
    const [surveyShop, setSurveyShop] = useState({});
    const [surveyMedium, setSurveyMedium] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [mediumResponse, shopResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                ]);
                const filteredShop = shopResponse.data.filter(s => !s.shop.includes('未設定'));
                const checkedShop = {};
                filteredShop.forEach(s => {
                    checkedShop[s.shop] = true
                });
                setSurveyShop(checkedShop);
                const filteredMedium = mediumResponse.data.filter(item => item.list_medium === 1).map((item: MediumType) => item.medium);
                const checkedMedium = {};
                filteredMedium.forEach(m => {
                    checkedMedium[m] = true
                });
                setSurveyMedium(checkedMedium);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    const brandMapping = {
        '国分ハウジング': 'kh',
        'なごみ工務店': 'なごみ',
        'デイジャストハウス': 'djh',
        'ニーエルホーム': '2l',
        'ジャスフィーホーム': 'jh',
        'PG HOUSE': 'pgh'
    };

    const ageRegister = (object: FormList[], basicAge: number) => {
        const filteredBrand = Object.keys(surveyBrand).filter(key => surveyBrand[key]);
        const filteredShop = Object.keys(surveyShop).filter(key => surveyShop[key]).map(shop => shop.includes('2L') ? '2L' : shop);
        const filteredMedium = Object.keys(surveyMedium).filter(key => surveyMedium[key]);
        return object.filter(o => {
            const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
            return Number(o.age) >= basicAge
                && (basicAge <= 70 ? Number(o.age) <= basicAge + 4 : true)
                && filteredBrand.includes(o.brand.toLowerCase())
                && filteredShop.includes(shopValue)
                && filteredMedium.includes(o.medium)
        })
    };

    const ageResult = (object: customerList[], list: FormList[], basicAge: number, key: string) => {
        const filteredBrand = Object.keys(surveyBrand).filter(key => surveyBrand[key]);
        const filteredShop = Object.keys(surveyShop).filter(key => surveyShop[key]).map(shop => shop.includes('2L') ? '2L' : shop);
        const filteredMedium = Object.keys(surveyMedium).filter(key => surveyMedium[key]);
        const phoneList = list.filter(l => {
            const shopValue = `${l.brand.replace('PGH', 'PG HOUSE')}${l.brand === '2L' ? '' : l.shop}`;
            return Number(l.age) >= basicAge
                && (basicAge <= 70 ? Number(l.age) <= basicAge + 4 : true)
                && filteredBrand.includes(l.brand.toLowerCase()) && filteredShop.includes(shopValue) && filteredMedium.includes(l.medium)
        })
            .map(l => l.mobile.replace('-', '').replace('ー', '').trim());
        return object.filter(o => o[key] && phoneList.includes(o.phone_number.replace('-', '').replace('ー', '').trim()));
    };

    const surveyRegister = (object: MasterDataList[], list: Survey[], dimension: string, targetValue: string) => {
        const filteredShop = Object.keys(surveyShop).filter(key => surveyShop[key]).map(shop => shop.includes('2L') ? '2L' : shop);
        const filteredList = list.filter(l => {
        const filteredMedium = Object.keys(surveyMedium).filter(key => surveyMedium[key]);
            const filteredBrand = Object.keys(surveyBrand).filter(key => surveyBrand[key]);
            return filteredBrand.includes(l.brand.toLowerCase())
                && l[dimension].includes(targetValue);
        }).map(l => l.emailAddress);
        return object.filter(o => {
            return filteredList.includes(o.mail) && filteredShop.includes(o.shop);
        }
        )
    };

    const surveyResult = (
        object: MasterDataList[],
        list: Survey[],
        key: string | string[],
        dimension: string,
        targetValue: string
    ) => {
        const filteredBrand = Object.keys(surveyBrand).filter(key => surveyBrand[key]);
        const filteredShop = Object.keys(surveyShop).filter(key => surveyShop[key]).map(shop => shop.includes('2L') ? '2L' : shop);
        const filteredList = list
            .filter(o => o[dimension].includes(targetValue) && filteredBrand.includes(o.brand.toLowerCase()))
            .map(o => o.emailAddress);
        return object.filter(o => {
            if (typeof key === 'string') {
                return o[key] && filteredList.includes(o.mail) && filteredShop.includes(o.shop);
            }
            const allTrue = key.some(k => o[k]);
            return allTrue && filteredList.includes(o.mail) && filteredShop.includes(o.shop);
        }
        )
    };

    const CustomLegend = ({ payload }: { payload?: readonly any[] }) => {
        if (!payload) return null;

        const order = Object.entries(display).map(([key, _]) => key);
        const sorted = [...payload].sort(
            (a, b) => order.indexOf(a.value) - order.indexOf(b.value)
        );

        return (
            <div style={{ display: "flex", gap: "12px", justifyContent: 'center' }}>
                {sorted.map((entry: any, index: number) => (
                    <div
                        key={index}
                        style={{
                            display: "flex",
                            justifyContent: 'center',
                            alignItems: "center",
                            width: "60px",
                            fontSize: '12px'
                        }}
                    >
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                backgroundColor: entry.color,
                                marginRight: 6
                            }}
                        />
                        <span>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    const getValue = (labelIndex: number, dimension: string, itemValue: any) => {
        const keyMap = ['register', 'reserve', 'appoint', 'contract'];
        const key = keyMap[labelIndex];
        const filteredBrand = Object.keys(surveyBrand).filter(k => surveyBrand[k]);
        const filteredShop = Object.keys(surveyShop).filter(k => surveyShop[k]).map(shop => shop.includes('2L') ? '2L' : shop);
        if (dimension === 'age') {
            const age = Number(itemValue);
            if (!per) {
                if (key === 'register') {
                    return ageRegister(form, age).length;
                }
                if (key === 'appoint') {
                    return ageResult(originalDatabase, form, age, 'second_reserve').length;
                }
                return ageResult(originalDatabase, form, age, key).length;
            }
            if (key === 'register') {
                const total = form.filter(o => {
                    const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                    return filteredBrand.includes(o.brand.toLowerCase())
                        && filteredShop.includes(shopValue);
                }).length;

                return Math.ceil(ageRegister(form, age).length / total * 100);
            }
            if (key === 'appoint') {
                const targetList = form.filter(o => {
                    const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                    return o.age && filteredBrand.includes(o.brand.toLowerCase()) && filteredShop.includes(shopValue);
                }).map(o => o.mobile);
                const total = originalDatabase.filter(o =>
                    o.second_reserve && targetList.includes(o.phone_number)
                ).length;
                return Math.ceil(ageResult(originalDatabase, form, age, 'second_reserve').length / total * 100);
            }
            const targetList = form.filter(o => {
                const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                return o.age && filteredBrand.includes(o.brand.toLowerCase()) && filteredShop.includes(shopValue);
            }).map(o => o.mobile);
            const total = originalDatabase.filter(o =>
                o[key] && targetList.includes(o.phone_number)
            ).length;
            return Math.ceil(ageResult(originalDatabase, form, age, key).length / total * 100);
        }
        const valueStr = String(itemValue);
        if (!per) {
            if (key === 'register') {
                return surveyRegister(masterDataList, surveyList, dimension, valueStr).length;
            }
            if (key === 'appoint') {
                return surveyResult(masterDataList, surveyList, ['appoint', 'second_reserve', 'contract'], dimension, valueStr).length;
            }
            return surveyResult(masterDataList, surveyList, key, dimension, valueStr).length;
        }
        if (key === 'register') {
            const total = surveyList.filter(s =>
                filteredBrand.includes(s.brand.toLowerCase())
            ).length;
            return Math.ceil(
                surveyRegister(masterDataList, surveyList, dimension, valueStr).length / total * 100
            );
        }
        if (key === 'appoint') {
            const mailList = surveyList.map(o => o.emailAddress);

            const total = masterDataList.filter(m =>
                (m.appoint || m.second_reserve || m.contract) &&
                mailList.includes(m.mail)
            ).length;

            return Math.ceil(
                surveyResult(masterDataList, surveyList, ['appoint', 'second_reserve', 'contract'], dimension, valueStr).length / total * 100
            );
        }
        const mailList = surveyList.map(o => o.emailAddress);
        const total = masterDataList.filter(m =>
            m[key] && mailList.includes(m.mail)
        ).length;
        return Math.ceil(
            surveyResult(masterDataList, surveyList, key, dimension, valueStr).length / total * 100
        );
    };

    const getGraphData = (dimensionValue: string, key: string, value: string | number) => {
        const filteredBrand = Object.keys(surveyBrand).filter(key => surveyBrand[key]);
        const filteredShop = Object.keys(surveyShop).filter(key => surveyShop[key]).map(shop => shop.includes('2L') ? '2L' : shop); if (dimensionValue === 'age') {
            if (!per) {
                if (key === 'register') {
                    return ageRegister(form, Number(value)).length;
                } else if (key === 'appoint') {
                    return ageResult(originalDatabase, form, Number(value), 'second_reserve').length
                } else {
                    return ageResult(originalDatabase, form, Number(value), key).length
                }
            } else {
                if (key === 'register') {
                    const total = form.filter(o => {
                        const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                        return filteredBrand.includes(o.brand.toLowerCase())
                            && filteredShop.includes(shopValue)
                    }).length;
                    return Math.ceil(ageRegister(form, Number(value)).length / total * 100);
                } else if (key === 'appoint') {
                    const targetList = form.filter(o => {
                        const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                        return o.age && filteredBrand.includes(o.brand.toLowerCase()) && filteredShop.includes(shopValue)
                    }).map(o => o.mobile);
                    const total = originalDatabase.filter(o => o.second_reserve && targetList.includes(o.phone_number)).length;
                    return Math.ceil(ageResult(originalDatabase, form, Number(value), 'second_reserve').length / total * 100);
                } else {
                    const targetList = form.filter(o => {
                        const shopValue = `${o.brand.replace('PGH', 'PG HOUSE')}${o.brand === '2L' ? '' : o.shop}`;
                        return o.age && filteredBrand.includes(o.brand.toLowerCase()) && filteredShop.includes(shopValue)
                    }).map(o => o.mobile);
                    const total = originalDatabase.filter(o => o[key] && targetList.includes(o.phone_number)).length;
                    return Math.ceil(ageResult(originalDatabase, form, Number(value), key).length / total * 100);
                }
            }
        } else {
            if (!per) {
                if (key === 'register') {
                    return surveyRegister(masterDataList, surveyList, dimensionValue, String(value)).length;
                } else if (key === 'appoint') {
                    return surveyResult(masterDataList, surveyList, ['appoint', 'second_reserve', 'contract'], dimensionValue, String(value)).length;
                } else {
                    return surveyResult(masterDataList, surveyList, key, dimensionValue, String(value)).length;
                }
            } else {
                if (key === 'register') {
                    const total = surveyList.filter(s => filteredBrand.includes(s.brand.toLowerCase())).length;
                    return Math.ceil(surveyRegister(masterDataList, surveyList, dimensionValue, String(value)).length / total * 100);
                } else if (key === 'appoint') {
                    const mailList = surveyList.map(o => o.emailAddress);
                    const total = masterDataList.filter(m => (m.appoint || m.second_reserve || m.contract) && mailList.includes(m.mail)).length;
                    return Math.ceil(surveyResult(masterDataList, surveyList, ['appoint', 'second_reserve', 'contract'], dimensionValue, String(value)).length / total * 100);
                } else {
                    const mailList = surveyList.map(o => o.emailAddress);
                    const total = masterDataList.filter(m => m[key] && mailList.includes(m.mail)).length;
                    return Math.ceil(surveyResult(masterDataList, surveyList, key, dimensionValue, String(value)).length / total * 100);
                }
            }
        }
    };

    const dataList = [
        {
            dimension: 'age',
            title: '年代',
            list: [
                { label: '20~24歳', value: 20 },
                { label: '25~29歳', value: 25 },
                { label: '30~34歳', value: 30 },
                { label: '35~39歳', value: 35 },
                { label: '40~44歳', value: 40 },
                { label: '45~49歳', value: 45 },
                { label: '50~54歳', value: 50 },
                { label: '55~59歳', value: 55 },
                { label: '60~64歳', value: 60 },
                { label: '65~69歳', value: 65 },
                { label: '70歳~', value: 70 }
            ]
        },
        {
            dimension: 'annualIncome',
            title: '年収',
            list: [
                { label: '~299万円', value: 299 },
                { label: '300万円~', value: 300 },
                { label: '400万円~', value: 400 },
                { label: '500万円~', value: 500 },
                { label: '600万円~', value: 600 },
                { label: '700万円~', value: 700 },
                { label: '800万円~', value: 800 },
                { label: '900万円~', value: 900 },
                { label: '1000万円~', value: 1000 }
            ]
        },
        {
            dimension: 'totalBudget',
            title: '予算',
            list: [{ label: '～1000万円', value: '～1000万円' },
            { label: '1000～1500万円', value: '1000万円～1500万円' },
            { label: '1500～2000万円', value: '1500万円～2000万円' },
            { label: '2000～2500万円', value: '2000万円～2500万円' },
            { label: '2500～3000万円', value: '2500万円～3000万円' },
            { label: '3000～3500万円', value: '3000万円～3500万円' },
            { label: '4000～4500万円', value: '4000万円～4500万円' },
            { label: '4500～5000万円', value: '4500万円～5000万円' },
            { label: '5000万円～', value: '5000万円～' }]
        },
        {
            dimension: 'expectedResidents',
            title: '入居者数',
            list: [
                { label: '1人', value: '1人' },
                { label: '2人', value: '2人' },
                { label: '3人', value: '3人' },
                { label: '4人', value: '4人' },
                { label: '5人', value: '5人' },
                { label: '6人', value: '6人' },
                { label: '7人以上', value: '7人以上' }
            ]
        },
        {
            dimension: 'priorityItem',
            title: '重視項目',
            list: [
                { label: '価格', value: '価格' },
                { label: '性能', value: '性能' },
                { label: 'デザイン', value: 'デザイン' },
                { label: 'アフターサービス', value: 'アフターサービス' }
            ]
        },
        {
            dimension: 'futurePlan',
            title: '行動予定',
            list: [
                { label: '検討し始めたばかり', value: '家づくりを検討しはじめたばかりなのでいろいろと勉強したい' },
                { label: '土地相談', value: '住みたいエリアの土地情報が欲しい' },
                { label: 'ローン相談', value: 'ローンが不安なので相談したい' },
                { label: '建築プラン', value: '建築プランが欲しい' },
                { label: '資金シミュレーション', value: '資金シミュレーションが欲しい' },
                { label: '見学希望', value: 'いろいろな住宅を見て回りたい' },
                { label: 'その他', value: 'その他' }
            ]
        },
        {
            dimension: 'thingsToDo',
            title: '相談希望',
            list: [
                { label: 'モデルハウス見学', value: '今後の参考にモデルハウスが見たい' },
                { label: '資料が欲しい', value: '家づくりの資料が欲しい' },
                { label: '土地情報が欲しい', value: '探しているエリアの土地情報が欲しい' },
                { label: '資金相談がしたい', value: 'ローンの組み方やお金に関する相談をしたい' },
                { label: 'その他', value: 'その他' }
            ]
        },
        {
            dimension: 'housingType',
            title: '希望住居',
            list: [
                { label: '新築住宅(土地から)', value: '新築住宅(土地から)' },
                { label: '新築住宅(建替え)', value: '新築住宅(建替え)' },
                { label: '建売住宅', value: '建売住宅' },
                { label: '中古住宅', value: '中古住宅' },
                { label: '新築マンション', value: '新築マンション' },
                { label: '中古マンション', value: '中古マンション' },
                { label: 'その他', value: 'その他' }
            ]
        }
    ];

    return (
        <>
            <div className="d-flex bg-white align-items-center" style={{ width: 'fit-content' }}>
                <div className="me-4">
                    <select className='target' onChange={(e) => setDimension(e.target.value)}>
                        {['年代', '年収', '予算', '入居者数', '重視項目', '行動予定', '相談希望', '希望住居'].map((item, index) =>
                            <option key={index} value={item}>{item}</option>
                        )}
                    </select>
                </div>
                <div className="me-4" style={{ width: 'fit-content', fontSize: '12px' }}>
                    <Form>
                        <Form.Check
                            type="switch"
                            id="brand-switch"
                            label="ブランド設定"
                            checked={brand}
                            onChange={() => setBrand(prev => (!prev))}
                        />
                    </Form>
                </div>
                <div className="me-4" style={{ width: 'fit-content', fontSize: '12px' }}>
                    <Form>
                        <Form.Check
                            type="switch"
                            id="shop-switch"
                            label="店舗設定"
                            checked={shop}
                            onChange={() => setShop(prev => (!prev))}
                        />
                    </Form>
                </div>
                <div className="me-4" style={{ width: 'fit-content', fontSize: '12px' }}>
                    <Form>
                        <Form.Check
                            type="switch"
                            id="medium-switch"
                            label="販促媒体設定"
                            checked={medium}
                            onChange={() => setMedium(prev => (!prev))}
                        />
                    </Form>
                </div>
            </div>
            <div className="d-flex my-1 bg-white" style={{ width: 'fit-content', fontSize: '12px' }}>
                <div className="m-1">
                    <Form>
                        <Form.Check
                            type="switch"
                            id="per-switch"
                            label="割合表示"
                            checked={per}
                            onChange={() => setPer(prev => (!prev))}
                        />
                    </Form>
                </div>
                {Object.entries(display).map(([key, _], index) =>
                    <div className="m-1" key={index}>
                        <div className='d-flex align-items-center justify-content-around'>
                            <div className='d-flex align-items-center me-2'>
                                <input
                                    type='checkbox'
                                    id={`show-${index}`}
                                    checked={display[key]}
                                    onChange={() =>
                                        setDisplay(prev => ({ ...prev, [key]: !prev[key] }))
                                    }
                                    className='me-1'
                                />
                                <label htmlFor={`show-${index}`}>{key}を表示</label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {brand &&
                <div style={{ backgroundColor: '#e2e2e2' }} className='p-2 rounded mb-3'>
                    <div className="d-flex">
                        <div style={{ fontSize: '12px' }}>ブランドを設定</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyBrand(prev => Object.fromEntries(Object.keys(prev).map(key => [key, true])))}>すべて選択</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyBrand(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))}>クリア</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-danger'
                            onClick={() => setBrand(false)}>とじる</div>
                    </div>
                    <div className="d-flex my-1" style={{ width: 'fit-content', fontSize: '12px' }}>
                        {Object.entries(brandMapping).map(([key, _], index) => {
                            const brandValue = brandMapping[key];
                            return <div className="m-1" key={index}>
                                <div className='d-flex align-items-center justify-content-around'>
                                    <div className='d-flex align-items-center me-2'>
                                        <input
                                            type='checkbox'
                                            id={`brand-${index}`}
                                            checked={surveyBrand[brandValue]}
                                            onChange={() =>
                                                setSurveyBrand(prev => ({ ...prev, [brandValue]: !prev[brandValue] }))
                                            }
                                            className='me-1'
                                        />
                                        <label htmlFor={`brand-${index}`}>{key}</label>
                                    </div>
                                </div>
                            </div>
                        }
                        )}
                    </div>
                </div>}
            {shop &&
                <div style={{ backgroundColor: '#e2e2e2' }} className='p-2 rounded mb-3'>
                    <div className="d-flex">
                        <div style={{ fontSize: '12px' }}>店舗を設定</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyShop(prev => Object.fromEntries(Object.keys(prev).map(key => [key, true])))}>すべて選択</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyShop(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))}>クリア</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-danger'
                            onClick={() => setShop(false)}>とじる</div>
                    </div>
                    <div className="d-flex my-1 flex-wrap" style={{ width: 'fit-content', fontSize: '12px' }}>
                        {Object.entries(surveyShop).map(([key, _], index) =>
                            <div className="m-1" key={index}>
                                <div className='d-flex align-items-center justify-content-around'>
                                    <div className='d-flex align-items-center me-2'>
                                        <input
                                            type='checkbox'
                                            id={`shop-${index}`}
                                            checked={surveyShop[key]}
                                            onChange={() =>
                                                setSurveyShop(prev => ({ ...prev, [key]: !prev[key] }))
                                            }
                                            className='me-1'
                                        />
                                        <label htmlFor={`shop-${index}`}>{key}</label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>}
            {medium &&
                <div style={{ backgroundColor: '#e2e2e2' }} className='p-2 rounded mb-3'>
                    <div className="d-flex">
                        <div style={{ fontSize: '12px' }}>販促媒体を設定</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyMedium(prev => Object.fromEntries(Object.keys(prev).map(key => [key, true])))}>すべて選択</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-primary'
                            onClick={() => setSurveyMedium(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))}>クリア</div>
                        <div style={{ fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }} className='ms-3 text-danger'
                            onClick={() => setMedium(false)}>とじる</div>
                    </div>
                    <div className="d-flex my-1 flex-wrap" style={{ width: 'fit-content', fontSize: '12px' }}>
                        {Object.entries(surveyMedium).map(([key, _], index) =>
                            <div className="m-1" key={index}>
                                <div className='d-flex align-items-center justify-content-around'>
                                    <div className='d-flex align-items-center me-2'>
                                        <input
                                            type='checkbox'
                                            id={`medium-${index}`}
                                            checked={surveyMedium[key]}
                                            onChange={() =>
                                                setSurveyMedium(prev => ({ ...prev, [key]: !prev[key] }))
                                            }
                                            className='me-1'
                                        />
                                        <label htmlFor={`medium-${index}`}>{key}</label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>}
            <div>
                {[...dataList].filter(d => d.title === dimension).map((dataValue, dataIndex) => <React.Fragment key={dataIndex}><div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dataValue.list.map(item => {
                            return ({
                                name: item.label,
                                register: getGraphData(dataValue.dimension, 'register', item.value),
                                reserve: getGraphData(dataValue.dimension, 'reserve', item.value),
                                appoint: getGraphData(dataValue.dimension, 'appoint', item.value),
                                contract: getGraphData(dataValue.dimension, 'contract', item.value),
                            })
                        }
                        )}>  <text
                            x="50%"
                            y={20}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: 12, fontWeight: "bold" }}
                        >
                                {dataValue.title}別 反響{per ? '割合' : '数'}
                            </text>
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Legend content={CustomLegend} />
                            <Bar dataKey="register" name="反響" fill="#8884d8" hide={!display['反響']} />
                            <Bar dataKey="reserve" name="来場" fill="#82ca9d" hide={!display['来場']} />
                            <Bar dataKey="appoint" name="次アポ" fill="#6EC6FF" hide={!display['次アポ']} />
                            <Bar dataKey="contract" name="契約" fill="#ffc658" hide={!display['契約']} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px', textAlign: 'center' }}>
                            <tr>
                                <td style={{ width: '10%' }}>{dataValue.title}別</td>
                                {dataValue.list.map((item, index) => {
                                    const dataLength = dataValue.list.length;
                                    return <td key={index} style={{ width: `calc( 90% / ${dataLength})` }}>{item.label}</td>
                                }
                                )}
                            </tr>
                            {Object.entries(display).map(([key, value], index) =>
                                <>{value && <tr key={index}>
                                    <td>{key}</td>
                                    {dataValue.list.map((item, itemIndex) =>
                                        <td key={itemIndex} style={{ textAlign: 'right' }}>
                                            {getValue(index, dataValue.dimension, item.value).toLocaleString()}{per && '%'}
                                        </td>
                                    )}
                                </tr>}
                                </>
                            )}
                        </tbody>
                    </Table></React.Fragment>)}
            </div>
        </>

    )
}

export default SurveyList