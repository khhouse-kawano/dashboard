import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/esm/Table';
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext.js";
import { useNavigate } from "react-router-dom";

type PieDataType = {
    labels: string[];
    datasets: {
        data: number[];
        backgroundColor: string[];
        borderColor: string[];
        borderWidth: number;
    }[];
};
type Customer = { id_related: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; rank: string };
type Budget = { budget_period: string; budget_value: number; medium: string; shop: string }
const Dev = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [originalCustomers, setOriginalCustomers] = useState<Customer[]>([]);
    const [registeredCustomer, setRegisteredCustomer] = useState<Customer[]>([]);
    const [reservedCustomer, setReservedCustomer] = useState<Customer[]>([]);
    const [contractCustomer, setContractCustomer] = useState<Customer[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [expandShop, setExpandShop] = useState<{ [key: number]: boolean }>({});
    const [areaArray, setAreaArray] = useState<string[]>([]);
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [mediumList, setMediumList] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<string>('registered');
    const [sortOrder, setSortOrder] = useState<string>('desc');
    const staffMapping = [{ name: '桑田 哲朗', area: '' },
    { name: '愛甲 博之', area: '鹿児島店' },
    { name: '濵田 春菜', area: '業務担当' },
    { name: '福﨑 研志', area: '' },
    { name: '野口 将希', area: '熊本店' },
    { name: '永田 千恵', area: '業務担当' },
    { name: '小園 裕樹', area: '鹿児島店' },
    { name: '柿内 智徳', area: '鹿児島店' },
    { name: '的場 雄大', area: '鹿児島店' },
    { name: '松窪 麻世', area: '' },
    { name: '義富 麻美', area: '' },
    { name: '西村 陽奈', area: '' },
    { name: '吉田 優貴', area: '鹿児島店' },
    { name: '馬場﨑 香里', area: '業務担当' },
    { name: '亀高 秀行', area: '鹿児島店' },
    { name: '鎌田 将暉', area: '' },
    { name: '川口 創楽', area: '宮崎店' },
    { name: '緒方 啓太', area: '' },
    { name: '上山 力', area: '鹿児島店' },
    { name: '東中川 洸', area: '鹿児島店' },
    { name: '増田 美智', area: '' },
    { name: '岡元 弘樹', area: '宮崎店' },
    { name: '永田 倫也', area: '' },
    { name: '難波 亨成', area: '宮崎店' },
    { name: '坂下 裕樹', area: '' },
    { name: '石川 健太', area: '鹿児島店' },
    { name: '池山 和希', area: '鹿児島店' },
    { name: '山之口 美沙輝', area: '宮崎店' },
    { name: '岡崎 真夕', area: '' },
    { name: '森 賀都征', area: '宮崎店' },
    { name: '上村 康一郎', area: '' },
    { name: '時任 聡一朗', area: '' },
    { name: '大澤 雄一郎', area: '宮崎店' },
    { name: '古田 昌之', area: '大分店' },
    { name: '井立 了仁', area: '' },
    { name: '高村 和宏', area: '熊本店' },
    { name: '宇都宮 尊', area: '宮崎店' },
    { name: '丸尾 歩実', area: '' },
    { name: '武田 秀士', area: '大分店' }];

    const mediumMapping = {
        "かえる-会員登録": "SNS広告・インターネット検索",
        "かえるHP(会員登録）": "SNS広告・インターネット検索",
        "かえる-来場予約": "SNS広告・インターネット検索",
        "SUUMO": "SUUMO",
        "HOME'S": "HOME'S",
        "かえる-資料請求": "SNS広告・インターネット検索",
        "ALLGRIT-アンケート": "公式LINE",
        "かえるHP(先取り物件)": "SNS広告・インターネット検索",
        "かえる-先取り物件": "SNS広告・インターネット検索",
        "アットホーム": "athome",
        "カゴスマ(一括資料請求)": "カゴスマ",
        "タウンライフ(一括資料請求)": "タウンライフ",
        "不動産HP(会員登録）": "SNS広告・インターネット検索",
        "不動産HP(資料請求)": "SNS広告・インターネット検索",
        "カエール査定(一戸建て)": "SNS広告・インターネット検索",
        "SUUMO見学予約": "SUUMO",
        "かえる-物件の資料請求": "SNS広告・インターネット検索",
        "カエール査定(土地)": "SNS広告・インターネット検索",
        "かえるHP(来場予約)": "SNS広告・インターネット検索",
        "かえるHP(資料請求)": "SNS広告・インターネット検索",
        "不動産HP(希望条件マッチング）": "SNS広告・インターネット検索",
        "カエール査定(マンション)": "SNS広告・インターネット検索",
        "不動産HP(お問い合わせ)": "SNS広告・インターネット検索",
        "不動産HP(来場予約)": "SNS広告・インターネット検索",
        "かえるHP(会員退会）": "SNS広告・インターネット検索",
        "不動産HP(お気軽相談)": "SNS広告・インターネット検索",
        "不明": ""
    };

    const areas = ['鹿児島店', '宮崎店', '大分店', '熊本店'];

    const tables = ['table-primary', 'table-danger', 'table-success', 'table-secondary'];

    useEffect(() => {
        if (!brand || brand.trim() === "") navigate("/");
        const getYearMonthArray = (startYear: number, startMonth: number) => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const yearMonthArray: string[] = [];
            let year = startYear;
            let month = startMonth;

            while (
                year < currentYear ||
                (year === currentYear && month <= currentMonth)) {
                const formattedMonth = month.toString().padStart(2, "0");
                yearMonthArray.push(`${year}/${formattedMonth}`);

                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }
            }

            return yearMonthArray;
        };
        setMonthArray(getYearMonthArray(2025, 1));
        setAreaArray(areas);
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "kaeru_report" }, { headers });
                setOriginalCustomers(customerResponse.data);
                console.log(customerResponse.data)
            } catch (error) {
                console.error('データ取得エラー:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        let startDate: Date | undefined;
        if (startMonth !== '') {
            const [year, month] = startMonth.split('/').map(Number);
            startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        } else {
            startDate = new Date(2025, 0, 1, 0, 0, 0, 0);
        }


        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const filteredRegister = originalCustomers.filter(item => {
            const registered = new Date(item.registered);
            return (
                (startDate ? registered >= startDate : true) &&
                (endDate ? registered <= endDate : true)
            )
        });
        setRegisteredCustomer(filteredRegister);

        const filteredReserve = originalCustomers.filter(item => {
            const reserved = new Date(item.reserved);
            return (
                (startDate ? reserved >= startDate : true) &&
                (endDate ? reserved <= endDate : true)
            )
        });
        setReservedCustomer(filteredReserve);

        const filteredContract = originalCustomers.filter(item => {
            const contract = new Date(item.contract);
            return (
                (startDate ? contract >= startDate : true) &&
                (endDate ? contract <= endDate : true)
            )
        });
        setContractCustomer(filteredContract);

        let mediumArray: string[] = [];
        for (const [key, _] of Object.entries(mediumMapping)) {
            mediumArray.push(key);
        }
        setMediumList(mediumArray);
    }, [originalCustomers, startMonth, endMonth]);

    const expand = (area: string) => {
        const index = areas.indexOf(area);
        setExpandShop(prev => ({
            ...prev,
            [index]: !prev[index]
        }));

        const newArea = areas[index];
        const newStaffs = staffMapping.filter(item => item.area === newArea).map(item => item.name);
        if (newStaffs.every(item => areaArray.includes(item))) {
            const newArray = areaArray.filter(item => !newStaffs.includes(item));
            setAreaArray(newArray);
        } else {
            setAreaArray(prev => {
                const newArray = [...prev];
                const start = newArray.indexOf(area);
                newArray.splice(start + 1, 0, ...newStaffs);
                return newArray;
            });
        }
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    return (
        <>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i className="fa-solid fa-bars hamburger"
                        onClick={() => setOpen(true)} />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i className="fa-solid fa-xmark hamburger position-absolute"
                        onClick={() => setOpen(false)} />
                    <MenuDev brand={brand} />
                </div>
                <div className='content calendar bg-white p-2'>
                    <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                    <div className="d-flex flex-wrap mb-3">
                        <div className="m-1">
                            <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                                <option value="" selected>開始月を選択</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                <option value="" selected>終了月を選択</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {isLoading ? (<p className="ms-3"><i className="fa-solid fa-spinner me-2 spinning"></i>Now Loading</p>) :
                        <div className="table-wrapper mt-3">
                            <div className="list_table kaeru">
                                <div className="mb-3">
                                    <Table bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '20%' }}>チーム別反響</td>
                                                <td>総反響</td>
                                                <td>来場数</td>
                                                <td>契約数</td>
                                                <td>Aランク</td>
                                                <td>Bランク</td>
                                                <td>Cランク</td>
                                                <td>Dランク</td>
                                                <td>Eランク</td>
                                            </tr>
                                            <tr>
                                                <td>かえるホーム合計</td>
                                                <td>{registeredCustomer.length}</td>
                                                <td>{reservedCustomer.length}</td>
                                                <td>{contractCustomer.length}</td>
                                                <td>{originalCustomers.filter(item => item.rank === 'A').length}</td>
                                                <td>{originalCustomers.filter(item => item.rank === 'B').length}</td>
                                                <td>{originalCustomers.filter(item => item.rank === 'C').length}</td>
                                                <td>{originalCustomers.filter(item => item.rank === 'D').length}</td>
                                                <td>{originalCustomers.filter(item => item.rank === 'E').length}</td>
                                            </tr>
                                            {areaArray.filter(area => area !== '').map((area, index) => {
                                                const staffArray = staffMapping.filter(staff => staff.area === area).map(staff => staff.name);
                                                let allCustomersInAreaRegister;
                                                let customersInAreaRegister;
                                                let customersInAreaReserve;
                                                let customersInAreaContract;
                                                if (areas.includes(area)) {
                                                    allCustomersInAreaRegister = originalCustomers.filter(c => staffArray.includes(c.staff));
                                                    customersInAreaRegister = registeredCustomer.filter(c => staffArray.includes(c.staff));
                                                    customersInAreaReserve = reservedCustomer.filter(c => staffArray.includes(c.staff));
                                                    customersInAreaContract = contractCustomer.filter(c => staffArray.includes(c.staff));
                                                } else {
                                                    allCustomersInAreaRegister = originalCustomers.filter(c => c.staff === area);
                                                    customersInAreaRegister = registeredCustomer.filter(c => c.staff === area);
                                                    customersInAreaReserve = reservedCustomer.filter(c => c.staff === area);
                                                    customersInAreaContract = contractCustomer.filter(c => c.staff === area);
                                                }


                                                let tableClass;
                                                if (areas.includes(area)) {
                                                    tableClass = tables[areas.indexOf(area)];
                                                }
                                                return (
                                                    <tr key={index} onClick={() => expand(area)} className={tableClass} style={{ cursor: 'pointer' }}>
                                                        <td><div className={`${areas.includes(area) ? 'kaeru_icon' : ''} ${expandShop[areas.indexOf(area)] ? ' minus' : ''}`}>{area}</div></td>
                                                        <td>{customersInAreaRegister.length}</td>
                                                        <td>{customersInAreaReserve.length}</td>
                                                        <td>{customersInAreaContract.length}</td>
                                                        <td>{allCustomersInAreaRegister.filter(item => item.rank === 'A').length}</td>
                                                        <td>{allCustomersInAreaRegister.filter(item => item.rank === 'B').length}</td>
                                                        <td>{allCustomersInAreaRegister.filter(item => item.rank === 'C').length}</td>
                                                        <td>{allCustomersInAreaRegister.filter(item => item.rank === 'D').length}</td>
                                                        <td>{allCustomersInAreaRegister.filter(item => item.rank === 'E').length}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="">
                                    <Table bordered striped style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '20%' }}>反響経路別反響</td>
                                                <td style={{ position: 'relative' }}>総反響
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'registered')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'registered')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>来場数
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'reserve')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'reserve')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>契約数
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'contract')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'contract')}>▼</span>
                                                </td>
                                                <td>Aランク</td>
                                                <td>Bランク</td>
                                                <td>Cランク</td>
                                                <td>Dランク</td>
                                                <td>Eランク</td>
                                            </tr>
                                            {[...mediumList].sort((a, b) => {
                                                let countA;
                                                let countB;
                                                if (sortKey === 'registered') {
                                                    countA = a === '不明' ?
                                                        registeredCustomer.filter(item => item.medium === '').length : registeredCustomer.filter(item => item.medium === a).length;
                                                    countB = b === '不明' ?
                                                        registeredCustomer.filter(item => item.medium === '').length : registeredCustomer.filter(item => item.medium === b).length;
                                                } else if(sortKey === 'reserve') {
                                                    countA = a === '不明' ?
                                                        reservedCustomer.filter(item => item.medium === '').length : reservedCustomer.filter(item => item.medium === a).length;
                                                    countB = b === '不明' ?
                                                        reservedCustomer.filter(item => item.medium === '').length : reservedCustomer.filter(item => item.medium === b).length;
                                                }  else if(sortKey === 'contract') {
                                                    countA = a === '不明' ?
                                                        contractCustomer.filter(item => item.medium === '').length : contractCustomer.filter(item => item.medium === a).length;
                                                    countB = b === '不明' ?
                                                        contractCustomer.filter(item => item.medium === '').length : contractCustomer.filter(item => item.medium === b).length;
                                                } 
                                                return (sortOrder === 'desc' ? countB - countA : countA - countB)
                                            })
                                                .map((medium, index) => {
                                                    let customersInMediumRegister;;
                                                    let customersInMediumReserve;
                                                    let customersInMediumContract;
                                                    let allCustomersInMediumRegister;
                                                    if (medium === '不明') {
                                                        customersInMediumRegister = registeredCustomer.filter(item => item.medium === "");
                                                        customersInMediumReserve = reservedCustomer.filter(item => item.medium === "");
                                                        customersInMediumContract = contractCustomer.filter(item => item.medium === "");
                                                        allCustomersInMediumRegister = originalCustomers.filter(item => item.medium === "");
                                                    } else {
                                                        customersInMediumRegister = registeredCustomer.filter(item => item.medium === medium);
                                                        customersInMediumReserve = reservedCustomer.filter(item => item.medium === medium);
                                                        customersInMediumContract = contractCustomer.filter(item => item.medium === medium);
                                                        allCustomersInMediumRegister = originalCustomers.filter(item => item.medium === medium);
                                                    }
                                                    return (
                                                        <tr key={index}>
                                                            <td>{medium}</td>
                                                            <td>{customersInMediumRegister.length}</td>
                                                            <td>{customersInMediumReserve.length}</td>
                                                            <td>{customersInMediumContract.length}</td>
                                                            <td>{allCustomersInMediumRegister.filter(item => item.rank === 'A').length}</td>
                                                            <td>{allCustomersInMediumRegister.filter(item => item.rank === 'B').length}</td>
                                                            <td>{allCustomersInMediumRegister.filter(item => item.rank === 'C').length}</td>
                                                            <td>{allCustomersInMediumRegister.filter(item => item.rank === 'D').length}</td>
                                                            <td>{allCustomersInMediumRegister.filter(item => item.rank === 'E').length}</td>
                                                        </tr>)
                                                }
                                                )}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        </div>}
                </div>
            </div>

        </>
    )
}

export default Dev