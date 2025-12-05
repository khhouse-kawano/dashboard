import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import Table from "react-bootstrap/Table";
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Bar,
    BarChart,
    PieChart,
    Pie,
    Cell
} from "recharts";
import Modal from 'react-bootstrap/Modal';

type Population = {
    pref: string, area: string, age: string, gender: string, year: string, amount: number, age_0_4: number, age_5_9: number
    , age_10_14: number, age_15_19: number, age_20_24: number, age_25_29: number, age_30_34: number, age_35_39: number, age_40_44: number, age_45_49: number
    , age_50_54: number, age_55_59: number, age_60_64: number, age_65_69: number, age_70_74: number, age_75_79: number, age_80_84: number, age_85_89: number
    , age_90_94: number, age_95_99: number, age_100_: number
};
type HouseHolds = {
    pref: string, area: string, type: string, amount: number, one_person_under65: number, one_person_under30: number, one_person_30_64: number,
    one_person_over65: number, wife_husband: number, wife_husband_over65: number, wife_husband_child_under3: number, wife_husband_child_3_5: number,
    wife_husband_child_6_9: number, wife_husband_child_10_17: number, wife_husband_child_18_24: number, wife_husband_child_over25: number
};
type OrderCustomer = { register: string, reserve: string, contract: string, medium: string, full_address: string, shop: string };
type SpecCustomer = { registered: string, reserved: string, contract: string, medium: string, address: string, staff: string };
type Build = { pref: string, area: string, year: string, amount: number, owner: number, rent: number, employer: number, condominiums: number };
type Shop = { section: string, shop: string };
type Staff = { name: string, shop: string };
type Medium = { medium: string, ma_category: string };
type ResponseData = { period: string, orderRegister: number, orderReserve: number, orderContract, specRegister: number, specReserve: number, specContract };
type BuildData = { period: string, order: number, condo: number };
type AgeData = { age: string, amount: number, male: number, female: number };
type HouseholdsData = {
    onePersonUnder30: number, onePerson30_64: number, onePersonOver65: number,
    wifeHusband: number, wifeHusbandOver65: number, wifeHusbandChildUnder3: number, wifeHusbandChild3_5: number, wifeHusbandChild6_9: number, wifeHusbandChild10_17: number,
    wifeHusbandChild18_24: number, wifeHusbandChildOver25: number
}

const Resale = () => {
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [targetCustomer, setTargetCustomer] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [population, setPopulation] = useState<Population[]>([]);
    const [originalPopulation, setOriginalPopulation] = useState<Population[]>([]);
    const { brand } = useContext(AuthContext);
    const [targetPref, setTargetPref] = useState<string>('鹿児島県');
    const [targetGender, setTargetGender] = useState<string>('計');
    const [startAge, setStartAge] = useState('');
    const [endAge, setEndAge] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [generation, setGeneration] = useState<string[]>([]);
    const [targetArea, setTargetArea] = useState('');
    const [originalHouseholds, setOriginalHouseholds] = useState<HouseHolds[]>([]);
    const [households, sethHouseHolds] = useState<HouseHolds[]>([]);
    const [targetFamily, setTargetFamily] = useState('');
    const [originalCustomerList, setOriginalCustomerList] = useState<OrderCustomer[]>([]);
    const [customerList, setCustomerList] = useState<OrderCustomer[]>([]);
    const [originalKhfCustomerList, setOriginalKhfCustomerList] = useState<SpecCustomer[]>([]);
    const [khfCustomerList, setKhfCustomerList] = useState<SpecCustomer[]>([]);
    const [originalBuild, setOriginalBuild] = useState<Build[]>([]);
    const [build, setBuild] = useState<Build[]>([]);
    const [expand, setExpand] = useState({});
    const [shop, setShop] = useState<Shop[]>([]);
    const [targetShop, setTargetShop] = useState({
        section: '',
        shop: ''
    });
    const [staff, setStaff] = useState<Staff[]>([]);
    const [medium, setMedium] = useState<string[]>([]);
    const [targetMedium, setTargetMedium] = useState('');
    const [mediumCategory, setMediumCategory] = useState<Medium[]>([]);
    const [show, setShow] = useState(false);
    const [responseLineData, setResponseLineData] = useState<ResponseData[]>([]);
    const [buildLineData, setBuildLineData] = useState<BuildData[]>([]);
    const [populationLineData, setPopulationLineData] = useState<AgeData[]>([]);
    const [householdsLineData, setHouseholdsLineData] = useState<HouseholdsData[]>([]);
    const [modalTitle, setModalTitle] = useState('');

    const navigate = useNavigate();

    const getYearMonthArray = (startYear, startMonth) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const yearMonthArray: string[] = [];
        let year = startYear;
        let month = startMonth;

        while (
            year < currentYear ||
            (year === currentYear && month <= currentMonth)
        ) {
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

    const generationMapping = [
        'age_0_4',
        'age_5_9',
        'age_10_14',
        'age_15_19',
        'age_20_24',
        'age_25_29',
        'age_30_34',
        'age_35_39',
        'age_40_44',
        'age_45_49',
        'age_50_54',
        'age_55_59',
        'age_60_64',
        'age_65_69',
        'age_70_74',
        'age_75_79',
        'age_80_84',
        'age_85_89',
        'age_90_94',
        'age_95_99',
        'age_100_'
    ];

    useEffect(() => {
        // if (!brand || brand.trim() === "") navigate("/");
        setMonthArray(getYearMonthArray(2025, 1));
        const fetchData = async () => {
            const headers = {
                Authorization: "4081Kokubu",
                "Content-Type": "application/json",
            };
            const [populationResponse, householdsResponse, customerResponse, buildResponse, customerResponse_khf, shopResponse, staffResponse, mediumResponse] = await Promise.all([
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "population" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "households" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "marketing" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "build" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "marketing_khf" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_marketing" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers })
            ]);
            setOriginalPopulation(populationResponse.data);
            setOriginalHouseholds(householdsResponse.data);
            setOriginalCustomerList(customerResponse.data);
            setOriginalBuild(buildResponse.data);
            setOriginalKhfCustomerList(customerResponse_khf.data);
            setShop(shopResponse.data);
            setStaff(staffResponse.data);
            const mediumArray = mediumResponse.data.filter(item => item.ma_medium === 1 && item.ma_category !== '').map(item => item.ma_category) as string[];
            setMedium([...new Set(mediumArray)]);
            setMediumCategory(mediumResponse.data);
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

        const targetGeneration: string[] = [];

        const startNumber = Number(startAge) ? Number(startAge) : 0;
        const endNumber = Number(endAge) ? Number(endAge) : 20;
        for (let i = startNumber; i <= endNumber; i++) {
            targetGeneration.push(generationMapping[i]);
        }
        setGeneration(targetGeneration);
        const filtered = originalPopulation.filter(item =>
            (targetPref !== '' ? item.pref === targetPref : true) &&
            (targetGender !== '' ? item.gender === targetGender : true) &&
            (targetArea !== '' ? item.area.includes(targetArea) : true)
        );
        setPopulation(filtered);
        const filteredCustomer = originalCustomerList.filter(item => {
            const register = new Date(item.register);
            const medium = mediumCategory.filter(m => m.ma_category === targetMedium).map(m => m.medium);
            return (startDate ? register >= startDate : true) &&
                (endDate ? register <= endDate : true) &&
                (targetShop.shop ? item.shop === targetShop.shop : true) &&
                (targetMedium ? medium.includes(item.medium) : true)
        });


        const condominiumsShop = staff.filter(item => item.shop === targetShop.shop).map(item => item.name);
        const filteredKhfCustomer = originalKhfCustomerList.filter(item => {
            const register = new Date(item.registered);
            const medium = mediumCategory.filter(m => m.ma_category === targetMedium).map(m => m.medium);
            return (startDate ? register >= startDate : true) &&
                (endDate ? register <= endDate : true) &&
                (targetShop.shop ? condominiumsShop.includes(item.staff) : true) &&
                (targetMedium ? medium.includes(item.medium) : true)
        });

        if (targetShop.section === '注文') {
            setCustomerList(filteredCustomer);
            setKhfCustomerList([]);
        } else if (targetShop.section === '分譲') {
            setCustomerList([]);
            setKhfCustomerList(filteredKhfCustomer);
        } else if (targetShop.section === '') {
            setCustomerList(filteredCustomer);
            setKhfCustomerList(filteredKhfCustomer);
        }

        const filteredBuild = originalBuild.filter(item => {
            const targetPeriod = new Date(item.year);
            return (startDate ? targetPeriod >= startDate : true) &&
                (endDate ? targetPeriod <= endDate : true)
        });
        setBuild(filteredBuild);
        sethHouseHolds(originalHouseholds);
        setExpand(prev => {
            const newExpand: Record<string, boolean> = {};
            for (const key of Object.keys(prev)) {
                newExpand[key] = false;
            }
            return newExpand;
        });

    }, [originalPopulation, originalCustomerList, originalKhfCustomerList, targetPref, targetGender, startAge, endAge, targetArea, originalBuild, startMonth, endMonth, targetShop, targetMedium]);

    const prefs = ["鹿児島県", "宮崎県", "熊本県", "大分県", "佐賀県"];

    const mediumExpand = async (index: number, area: string) => {
        await setModalTitle(area === '-' ? `${targetPref}全域` : area);
        let filteredBuildLength: BuildData[] = [];
        let filteredResponseLength: ResponseData[] = [];
        const year = [...new Set(originalBuild.map(b => b.year))];
        if (area === '-') {
            filteredBuildLength = year.map(y => {
                const orderLength = originalBuild.filter(b => b.pref === targetPref && b.year === y).reduce((acc, cur) => acc + cur.owner, 0);
                const condoLength = originalBuild.filter(b => b.pref === targetPref && b.year === y).reduce((acc, cur) => acc + cur.condominiums, 0);
                return {
                    period: y,
                    order: orderLength,
                    condo: condoLength
                }
            });
            filteredResponseLength = year.map(y => {
                const registerLength = originalCustomerList.filter(c => c.register?.includes(y) && c.full_address.trim().includes(targetPref)).length;
                const reserveLength = originalCustomerList.filter(c => c.reserve?.includes(y) && c.full_address.trim().includes(targetPref) && c.reserve).length;
                const contractLength = originalCustomerList.filter(c => c.contract?.includes(y) && c.full_address.trim().includes(targetPref) && c.contract).length;
                const registerKhfLength = originalKhfCustomerList.filter(c => c.registered?.includes(y) && c.address.trim().includes(targetPref)).length;
                const reserveKhfLength = originalKhfCustomerList.filter(c => c.reserved?.replace(/-/g, '/').includes(y) && c.address.trim().includes(targetPref) && c.reserved).length;
                const contractKhfLength = originalKhfCustomerList.filter(c => c.contract?.replace(/-/g, '/').includes(y) && c.address.trim().includes(targetPref) && c.contract).length;
                return {
                    period: y,
                    orderRegister: registerLength,
                    orderReserve: reserveLength,
                    orderContract: contractLength,
                    specRegister: registerKhfLength,
                    specReserve: reserveKhfLength,
                    specContract: contractKhfLength
                }
            });
        } else {
            filteredBuildLength = await originalBuild.filter(b => b.area === area).map(b => ({
                period: b.year,
                order: b.owner,
                condo: b.condominiums
            }));
            filteredResponseLength = year.map(y => {
                const registerLength = originalCustomerList.filter(c => c.register?.includes(y) && c.full_address.trim().includes(area)).length;
                const reserveLength = originalCustomerList.filter(c => c.reserve?.includes(y) && c.full_address.trim().includes(area) && c.reserve).length;
                const contractLength = originalCustomerList.filter(c => c.contract?.includes(y) && c.full_address.trim().includes(area) && c.contract).length;
                const registerKhfLength = originalKhfCustomerList.filter(c => c.registered?.includes(y) && c.address.trim().includes(area)).length;
                const reserveKhfLength = originalKhfCustomerList.filter(c => c.reserved?.replace(/-/g, '/').includes(y) && c.address.trim().includes(area) && c.reserved).length;
                const contractKhfLength = originalKhfCustomerList.filter(c => c.contract?.replace(/-/g, '/').includes(y) && c.address.trim().includes(area) && c.contract).length;
                return {
                    period: y,
                    orderRegister: registerLength,
                    orderReserve: reserveLength,
                    orderContract: contractLength,
                    specRegister: registerKhfLength,
                    specReserve: reserveKhfLength,
                    specContract: contractKhfLength
                }
            })
        }
        await setBuildLineData(filteredBuildLength.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()));
        await setResponseLineData(filteredResponseLength.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()));
        console.log(filteredResponseLength)
        const filteredPopulationLength: AgeData[] = generationMapping.map(g => {
            const targetAmount = originalPopulation.find(p => p.pref === targetPref && p.area === area && p.gender === "計");
            const targetMale = originalPopulation.find(p => p.pref === targetPref && p.area === area && p.gender === "男");
            const targetFemale = originalPopulation.find(p => p.pref === targetPref && p.area === area && p.gender === "女")?.[g];
            return {
                age: g.replace('age_', '').replace('_', '~'),
                amount: targetAmount?.[g],
                male: targetMale?.[g],
                female: targetFemale,
            };
        });
        await setPopulationLineData(filteredPopulationLength);

        const houseType = ['総数', '一戸建', '賃貸']
        let filteredHouseholdsLength: HouseholdsData[];
        if (area === '-') {
            filteredHouseholdsLength = houseType.map(h => {
                const onePersonUnder30Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_under30, 0);
                const onePerson30_64Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_30_64, 0);
                const onePersonOver65Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_over65, 0);
                const wifeHusbandLength = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband, 0);
                const wifeHusbandOver65Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_over65, 0);
                const wifeHusbandChildUnder3Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_under3, 0);
                const wifeHusbandChild3_5Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_3_5, 0);
                const wifeHusbandChild6_9Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_6_9, 0);
                const wifeHusbandChild10_17Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_10_17, 0);
                const wifeHusbandChild18_24Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_18_24, 0);
                const wifeHusbandChildOver25Length = originalHouseholds.filter(o => o.pref === targetPref && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_over25, 0);
                return (
                    {
                        onePersonUnder30: onePersonUnder30Length,
                        onePerson30_64: onePerson30_64Length,
                        onePersonOver65: onePersonOver65Length,
                        wifeHusband: wifeHusbandLength,
                        wifeHusbandOver65: wifeHusbandOver65Length,
                        wifeHusbandChildUnder3: wifeHusbandChildUnder3Length,
                        wifeHusbandChild3_5: wifeHusbandChild3_5Length,
                        wifeHusbandChild6_9: wifeHusbandChild6_9Length,
                        wifeHusbandChild10_17: wifeHusbandChild10_17Length,
                        wifeHusbandChild18_24: wifeHusbandChild18_24Length,
                        wifeHusbandChildOver25: wifeHusbandChildOver25Length,
                    })
            });
        } else {
            filteredHouseholdsLength = houseType.map(h => {
                const onePersonUnder30Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_under30, 0);
                const onePerson30_64Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_30_64, 0);
                const onePersonOver65Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.one_person_over65, 0);
                const wifeHusbandLength = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband, 0);
                const wifeHusbandOver65Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_over65, 0);
                const wifeHusbandChildUnder3Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_under3, 0);
                const wifeHusbandChild3_5Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_3_5, 0);
                const wifeHusbandChild6_9Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_6_9, 0);
                const wifeHusbandChild10_17Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_10_17, 0);
                const wifeHusbandChild18_24Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_18_24, 0);
                const wifeHusbandChildOver25Length = originalHouseholds.filter(o => o.area === area && (h === '賃貸' ? (o.type === '長屋建' || o.type === '共同住宅') : o.type === h)).reduce((acc, cur) => acc + cur.wife_husband_child_over25, 0);
                return (
                    {
                        onePersonUnder30: onePersonUnder30Length,
                        onePerson30_64: onePerson30_64Length,
                        onePersonOver65: onePersonOver65Length,
                        wifeHusband: wifeHusbandLength,
                        wifeHusbandOver65: wifeHusbandOver65Length,
                        wifeHusbandChildUnder3: wifeHusbandChildUnder3Length,
                        wifeHusbandChild3_5: wifeHusbandChild3_5Length,
                        wifeHusbandChild6_9: wifeHusbandChild6_9Length,
                        wifeHusbandChild10_17: wifeHusbandChild10_17Length,
                        wifeHusbandChild18_24: wifeHusbandChild18_24Length,
                        wifeHusbandChildOver25: wifeHusbandChildOver25Length,
                    })
            });
        }

        await setHouseholdsLineData(filteredHouseholdsLength);

        await setExpand(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
        await setShow(true);
    };


    const modalClose = async () => {
        await setShow(false);
        setExpand(prev => {
            const newExpand: Record<string, boolean> = {};
            for (const key of Object.keys(prev)) {
                newExpand[key] = false;
            }
            return newExpand;
        });
    }

    const COLORS = [
        { color: "#ff4d4d", key: "onePersonUnder65" },
        { color: "#e83e8c", key: "onePersonUnder30" },
        { color: "#b22222", key: "onePerson30_64" },
        { color: "#800000", key: "onePersonOver65" },
        { color: "#0d6efd", key: "wifeHusband" },
        { color: "#1e90ff", key: "wifeHusbandOver65" },
        { color: "#004080", key: "wifeHusbandChildUnder3" },
        { color: "#4e4eff", key: "wifeHusbandChild3_5" },
        { color: "#000000", key: "wifeHusbandChild6_9" },
        { color: "#333333", key: "wifeHusbandChild10_17" },
        { color: "#4d4d4d", key: "wifeHusbandChild18_24" },
        { color: "#808080", key: "wifeHusbandChildOver25" }
    ];

    return (
        <>
            <div className='outer-container' style={{ width: '100vw' }}>
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
                    <div className="content">
                        <div className="top_content p-3">
                            <div className="d-flex flex-wrap mb-3 align-items-center">
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setTargetPref(e.target.value)}>
                                        <option value="鹿児島県">鹿児島県</option>
                                        <option value="宮崎県">宮崎県</option>
                                        <option value="熊本県">熊本県</option>
                                        <option value="大分県">大分県</option>
                                        <option value="佐賀県">佐賀県</option>
                                    </select>
                                </div>
                                <div className="m-1 m-md-2">
                                    <input type="text" className='target'
                                        placeholder='市町村名で検索' value={targetArea} onChange={(e) => setTargetArea(e.target.value)} />
                                </div>
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setTargetGender(e.target.value)}>
                                        <option value="計">性別を選択</option>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                    </select>
                                </div>
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setStartAge(e.target.value)}>
                                        <option value="">世代を選択</option>
                                        <option value="0">0~4</option>
                                        <option value="1">5~9</option>
                                        <option value="2">10~14</option>
                                        <option value="3">15~19</option>
                                        <option value="4">20~24</option>
                                        <option value="5">25~29</option>
                                        <option value="6">30~34</option>
                                        <option value="7">35~39</option>
                                        <option value="8">40~44</option>
                                        <option value="9">45~49</option>
                                        <option value="10">50~54</option>
                                        <option value="11">55~59</option>
                                        <option value="12">60~64</option>
                                        <option value="13">65~69</option>
                                        <option value="14">70~74</option>
                                        <option value="15">75~79</option>
                                        <option value="16">80~84</option>
                                        <option value="17">85~89</option>
                                        <option value="18">90~94</option>
                                        <option value="19">95~99</option>
                                        <option value="20">100~</option>
                                    </select>
                                </div>
                                ~
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setEndAge(e.target.value)}>
                                        <option value="">世代を選択</option>
                                        <option value="0">0~4</option>
                                        <option value="1">5~9</option>
                                        <option value="2">10~14</option>
                                        <option value="3">15~19</option>
                                        <option value="4">20~24</option>
                                        <option value="5">25~29</option>
                                        <option value="6">30~34</option>
                                        <option value="7">35~39</option>
                                        <option value="8">40~44</option>
                                        <option value="9">45~49</option>
                                        <option value="10">50~54</option>
                                        <option value="11">55~59</option>
                                        <option value="12">60~64</option>
                                        <option value="13">65~69</option>
                                        <option value="14">70~74</option>
                                        <option value="15">75~79</option>
                                        <option value="16">80~84</option>
                                        <option value="17">85~89</option>
                                        <option value="18">90~94</option>
                                        <option value="19">95~99</option>
                                        <option value="20">100~</option>
                                    </select>
                                </div>
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setStartMonth(e.target.value)}>
                                        <option value="">期間を選択</option>
                                        {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                                    </select>
                                </div>
                                ~
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setEndMonth(e.target.value)}>
                                        <option value="">期間を選択</option>
                                        {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                                    </select>
                                </div>
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => {
                                        let sectionValue;
                                        if (e.target.value.includes('かえる')) {
                                            sectionValue = '分譲';
                                        } else if (!e.target.value.includes('かえる') && e.target.value !== '') {
                                            sectionValue = '注文';
                                        } else {
                                            sectionValue = '';
                                        }
                                        setTargetShop({ section: sectionValue, shop: e.target.value });
                                    }}>
                                        <option value="">店舗を選択</option>
                                        {shop.map(item =>
                                            <option value={item.shop}>{item.shop}</option>
                                        )}
                                    </select>
                                </div>
                                <div className="m-1 m-md-2">
                                    <select className='target' onChange={(e) => setTargetMedium(e.target.value)}>
                                        <option value="">販促媒体を選択</option>
                                        {medium.map((item, index) => <option key={index} value={item}>{item}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ overflowX: 'scroll' }}>
                                <Table style={{ fontSize: '12px', textAlign: 'center' }} bordered striped className='list_table resale'>
                                    <thead>
                                        <tr>
                                            <td>No</td>
                                            <td>都道府県</td>
                                            <td>市町村</td>
                                            <td className='table-primary'>注文反響</td>
                                            <td className='table-primary'>注文来場</td>
                                            <td className='table-primary'>注文契約</td>
                                            <td className='table-light text-primary'>注文着工棟数</td>
                                            <td className='table-success'>建売反響</td>
                                            <td className='table-success'>建売来場</td>
                                            <td className='table-success'>建売契約</td>
                                            <td className='table-light text-success'>建売着工棟数</td>
                                            <td>人口計</td>
                                            <td>世帯数</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {population.sort((a, b) => {
                                            const sortOrder = targetShop.shop ? 'amount' : 'area';
                                            let amountA;
                                            let amountB;
                                            if (targetShop.section === '注文') {
                                                amountA = customerList.filter(c => (a.area === '-' ? c.full_address.trim().includes(a.pref) : c.full_address.trim().includes(a.area))).length;
                                                amountB = customerList.filter(c => (b.area === '-' ? c.full_address.trim().includes(b.pref) : c.full_address.trim().includes(b.area))).length;
                                            } else if (targetShop.section === '分譲') {
                                                amountA = khfCustomerList.filter(c => (a.area === '-' ? c.address.trim().includes(a.pref) : c.address.trim().includes(a.area))).length;
                                                amountB = khfCustomerList.filter(c => (b.area === '-' ? c.address.trim().includes(b.pref) : c.address.trim().includes(b.area))).length;
                                            }
                                            return (
                                                sortOrder === 'area' ? prefs.indexOf(a.pref) - prefs.indexOf(b.pref) : amountB - amountA
                                            )
                                        }).map((item, index) => {
                                            const numbers: number[] = [];
                                            Object.keys(item).forEach(key => {
                                                if (generation.includes(key)) {
                                                    numbers.push(item[key]);
                                                }
                                            });
                                            const amount = numbers.reduce((acc, cur) => acc + cur, 0);
                                            const allHouseholds = households.find(h => item.area === '-' ? h.pref === item.pref : h.area === item.area)?.amount;
                                            const buildLength = item.area === '-' ? build.filter(b => b.pref === item.pref).reduce((acc, cur) => acc + cur.owner, 0) : build.filter(b => b.area === item.area).reduce((acc, cur) => acc + cur.owner, 0);
                                            const registerLength = customerList.filter(c => (item.area === '-' ? c.full_address.trim().includes(item.pref) : c.full_address.trim().includes(item.area))).length;
                                            const reserveLength = customerList.filter(c => (item.area === '-' ? c.full_address.trim().includes(item.pref) : c.full_address.trim().includes(item.area)) && c.reserve).length;
                                            const contractLength = customerList.filter(c => (item.area === '-' ? c.full_address.trim().includes(item.pref) : c.full_address.trim().includes(item.area)) && c.contract).length;
                                            const registerKhfLength = khfCustomerList.filter(c => (item.area === '-' ? c.address.trim().includes(item.pref) : c.address.trim().includes(item.area))).length;
                                            const reserveKhfLength = khfCustomerList.filter(c => (item.area === '-' ? c.address.trim().includes(item.pref) : c.address.trim().includes(item.area)) && c.reserved).length;
                                            const contractKhfLength = khfCustomerList.filter(c => (item.area === '-' ? c.address.trim().includes(item.pref) : c.address.trim().includes(item.area)) && c.contract).length;
                                            const buildKhfLength = item.area === '-' ? build.filter(b => b.pref === item.pref).reduce((acc, cur) => acc + cur.condominiums, 0) : build.filter(b => b.area === item.area).reduce((acc, cur) => acc + cur.condominiums, 0);
                                            let show;
                                            if (targetShop.shop === '') {
                                                show = true;
                                            } else if (targetShop.section === '注文' && registerLength > 0) {
                                                show = true;
                                            } else if (targetShop.section === '分譲' && registerKhfLength > 0) {
                                                show = true;
                                            }
                                            return (
                                                <>{show && <tr>
                                                    <td>{index + 1}</td>
                                                    <td>{item.pref}</td>
                                                    <td style={{ textAlign: 'left' }}>{item.area === '-' ? '全域' : item.area}{expand[index] ? <i className="fa-solid fa-minus ms-2 medium_expand bg-secondary text-white p-1 rounded"
                                                        onClick={() => mediumExpand(index, item.area)}></i> :
                                                        <i className="fa-solid fa-plus ms-2 medium_expand bg-primary text-white p-1 rounded"
                                                            onClick={() => mediumExpand(index, item.area)}></i>}</td>
                                                    <td className='table-primary' style={{ textAlign: 'right' }}>{registerLength.toLocaleString()}</td>
                                                    <td className='table-primary' style={{ textAlign: 'right' }}>{reserveLength.toLocaleString()}</td>
                                                    <td className='table-primary' style={{ textAlign: 'right' }}>{contractLength.toLocaleString()}</td>
                                                    <td className='table-light text-primary' style={{ textAlign: 'right' }}>{buildLength ? buildLength.toLocaleString() : 0}</td>
                                                    <td className='table-success' style={{ textAlign: 'right' }}>{registerKhfLength.toLocaleString()}</td>
                                                    <td className='table-success' style={{ textAlign: 'right' }}>{reserveKhfLength.toLocaleString()}</td>
                                                    <td className='table-success' style={{ textAlign: 'right' }}>{contractKhfLength.toLocaleString()}</td>
                                                    <td className='table-light text-success' style={{ textAlign: 'right' }}>{buildKhfLength ? buildKhfLength.toLocaleString() : 0}</td>
                                                    <td style={{ textAlign: 'right' }}>{amount.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'right' }}>{allHouseholds ? allHouseholds.toLocaleString() : '-'}</td>
                                                </tr>}</>
                                            )
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Modal show={show} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="mb-5">
                        <div className="text-center" style={{ fontSize: '12px' }}>{modalTitle} 注文営業反響推移</div>
                        <div style={{ width: "100%", height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={responseLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        content={({ payload }) => (
                                            <div className='d-flex justify-content-center'>
                                                {["orderRegister", "orderReserve", "orderContract", "specReserve", "specReserve", "specContract"].map(key => {
                                                    const entry = payload?.find(p => p.dataKey === key);
                                                    return (
                                                        <div className='m-1' key={key} style={{ color: entry?.color }}>
                                                            {entry?.value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    <Line type="monotone" dataKey="orderRegister" stroke="#dc3545" name='注文総反響' />
                                    <Line type="monotone" dataKey="orderReserve" stroke="#fd7e14" name='注文来場' />
                                    <Line type="monotone" dataKey="orderContract" stroke="#6f42c1" name='注文契約' />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mb-5">
                        <div className="text-center" style={{ fontSize: '12px' }}>{modalTitle} 不動産（建売）営業反響推移</div>
                        <div style={{ width: "100%", height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={responseLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        content={({ payload }) => (
                                            <div className='d-flex justify-content-center'>
                                                {["orderRegister", "orderReserve", "orderContract", "specReserve", "specReserve", "specContract"].map(key => {
                                                    const entry = payload?.find(p => p.dataKey === key);
                                                    return (
                                                        <div className='m-1' key={key} style={{ color: entry?.color }}>
                                                            {entry?.value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    <Line type="monotone" dataKey="specRegister" stroke="#ff6f61" name='建売総反響' />
                                    <Line type="monotone" dataKey="specReserve" stroke="#ffb347" name='建売来場' />
                                    <Line type="monotone" dataKey="specContract" stroke="#a569bd" name='建売契約' />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mb-5">
                        <div className="text-center" style={{ fontSize: '12px' }}>{modalTitle} 着工棟数推移</div>
                        <div style={{ width: "100%", height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={buildLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        content={({ payload }) => (
                                            <div className='d-flex justify-content-center'>
                                                {["order", "condo"].map(key => {
                                                    const entry = payload?.find(p => p.dataKey === key);
                                                    return (
                                                        <div className='m-1' key={key} style={{ color: entry?.color }}>
                                                            {entry?.value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    <Line type="monotone" dataKey="order" stroke="#0d6efd" name='注文住宅着工棟数' />
                                    <Line type="monotone" dataKey="condo" stroke="#198754" name='分譲住宅着工棟数' />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mb-5">
                        <div className="text-center" style={{ fontSize: '12px' }}>{modalTitle} 世代別人口数</div>
                        <div style={{ width: "100%", height: '300px' }}>
                            <ResponsiveContainer width="100%" height={"100%"}>
                                <BarChart
                                    data={populationLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="age" tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        itemSorter={(item) => {
                                            const order = ["amount", "male", "female"]; // 表示したい順番
                                            return order.indexOf(item.dataKey as string);
                                        }}
                                    />
                                    <Bar dataKey="amount" fill="#4e4e4eff" name="合計" />
                                    <Bar dataKey="male" fill="#0d6efd" name="男性" />
                                    <Bar dataKey="female" fill="#e83e8c" name="女性" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {householdsLineData.map((item, index) => {
                        const data = Object.entries(item).map(([key, value]) => {
                            return {
                                name: key,
                                value: value
                            }
                        });
                        const houseType = ['', '一戸建', '賃貸'];
                        const labels: Record<string, string> = {
                            onePersonUnder30: "30歳未満単身世帯",
                            onePerson30_64: "30〜64歳単身世帯",
                            onePersonOver65: "65歳以上単身世帯",
                            wifeHusband: "夫婦のみ世帯",
                            wifeHusbandOver65: "65歳以上夫婦世帯",
                            wifeHusbandChildUnder3: "夫婦＋子(0〜2歳)",
                            wifeHusbandChild3_5: "夫婦＋子(3〜5歳)",
                            wifeHusbandChild6_9: "夫婦＋子(6〜9歳)",
                            wifeHusbandChild10_17: "夫婦＋子(10〜17歳)",
                            wifeHusbandChild18_24: "夫婦＋子(18〜24歳)",
                            wifeHusbandChildOver25: "夫婦＋子(25歳以上)"
                        };
                        return (
                            <div className="my-3">
                                <div className="text-center" style={{ fontSize: '12px' }}>{modalTitle} 世帯数 {houseType[index]}</div>
                                <div style={{ width: "100%", height: '300px' }}>
                                    <ResponsiveContainer width="100%" height={"100%"}>
                                        <PieChart>
                                            <Pie
                                                data={data}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                label
                                            >
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length].color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value, name) => [
                                                    value,
                                                    labels[name as string] ?? name
                                                ]}
                                                wrapperStyle={{
                                                    fontSize: "12px",
                                                    fontFamily: "Arial, sans-serif",
                                                    color: "#333",
                                                }}
                                            />
                                            <Legend formatter={(value) => labels[value] ?? value} wrapperStyle={{
                                                fontSize: "12px",
                                                fontFamily: "Arial, sans-serif",
                                                color: "#333",
                                            }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )
                    }

                    )}
                </Modal.Body>
            </Modal>
        </>
    )
}

export default Resale