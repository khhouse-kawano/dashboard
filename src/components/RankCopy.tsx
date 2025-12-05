import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import Pagination from 'react-bootstrap/Pagination';
import AuthContext from '../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import MenuDev from "./MenuDev";

type Shop = { brand: string; shop: string; section: string; area: string; }
type Section = { name: string, category: string }
type Customer = {
    id: string; name: string; status: string; medium: string; rank: string; register: string; reserve: string; shop: string; staff: string; section: string;
    contract: string; sales_meeting: string; latest_date: string; last_meeting: string; estate: string; meeting: string; appointment: string; line_group: string; screening: string;
    rival: string; period: string; survey: string; importance: string; note: string; budget: string
}
type Staff = { id: number; name: string; pg_id: string; shop: string; mail: string; status: string; category: number; }
type Goal = { id: number; period: string; shop: string; section: string; goal: number }
type Expect = { id: number; date: string; shop: string; section: string; staff: string; count: number }
type ExpectList = { date: string; section: string; shop: string; count: number };

const RankDev = () => {
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [lastMeeting, setLastMeeting] = useState<string>('前回営業会議');
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [originalSectionList, setOriginalSectionList] = useState<Section[]>([]);
    const [totalResponse, setTotalResponse] = useState<number>(0);
    const [totalReserve, setTotalReserve] = useState<number>(0);
    const [totalContract, setTotalContract] = useState<number>(0);
    const [totalARank, setTotalARank] = useState<number>(0);
    const [totalBRank, setTotalBRank] = useState<number>(0);
    const [totalCRank, setTotalCRank] = useState<number>(0);
    const [totalDRank, setTotalDRank] = useState<number>(0);
    const [totalERank, setTotalERank] = useState<number>(0);
    const [totalDownRank, setTotalDownRank] = useState<number>(0);
    const [totalLastARank, setTotalLastARank] = useState<number>(0);
    const [totalLastBRank, setTotalLastBRank] = useState<number>(0);
    const [totalLastCRank, setTotalLastCRank] = useState<number>(0);
    const [totalResponseArray, setTotalResponseArray] = useState<number[]>([]);
    const [totalReserveArray, setTotalReserveArray] = useState<number[]>([]);
    const [totalContractArray, setTotalContractArray] = useState<number[]>([]);
    const [totalARankArray, setTotalARankArray] = useState<number[]>([]);
    const [totalBRankArray, setTotalBRankArray] = useState<number[]>([]);
    const [totalCRankArray, setTotalCRankArray] = useState<number[]>([]);
    const [totalDRankArray, setTotalDRankArray] = useState<number[]>([]);
    const [totalERankArray, setTotalERankArray] = useState<number[]>([]);
    const [totalDownRankArray, setTotalDownRankArray] = useState<number[]>([]);
    const [totalLastARankArray, setTotalLastARankArray] = useState<number[]>([]);
    const [totalLastBRankArray, setTotalLastBRankArray] = useState<number[]>([]);
    const [totalLastCRankArray, setTotalLastCRankArray] = useState<number[]>([]);
    const [expandedSectionState, setExpandedSectionState] = useState<boolean[]>([false, false, false, false, false, false]);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
    const [selectedRank, setSelectedRank] = useState<string>('');
    const [show, setShow] = useState(false);
    const [modalCategory, setModalCategory] = useState<string>('');
    const [modalList, setModalList] = useState<Customer[]>([]);
    const [prevModalList, setPrevModalList] = useState<Customer[]>([]);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [totalCurrentLength, setTotalCurrentLength] = useState<number>(0);
    const [totalPrevLength, setTotalPrevLength] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [prevPage, setPrevPage] = useState<number>(0);
    const [contractGoal, setContractGoal] = useState<Goal[]>([]);
    const [expectedContract, setExpectedContract] = useState<Expect[]>([]);
    const [expectedList, setExpectedList] = useState<ExpectList[]>([]);
    const [open, setOpen] = useState(false);
    const [topHeight, setTopHeight] = useState(500); // 初期高さ
    const containerRef = useRef<HTMLDivElement>(null);
    const isResizing = useRef(false);
    const [clientX, setClientX] = useState<number>(0)
    const [clientY, setClientY] = useState<number>(0)

    const getYearMonthArray = (startYear: number, startMonth: number) => {
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}/${month}/${day}`;

    useEffect(() => {
        // if (!brand || brand.trim() === "") {
        //     navigate("/");
        //     return;
        // }
        const monthArray = getYearMonthArray(2025, 1);
        setMonthArray(monthArray);
        setSelectedMonth(`${String(year)}/${month}`)

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerResponse, shopResponse, staffResponse, contractResponse, contractExResponse, sectionResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_detail" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_goal" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_expected" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "section_list" }, { headers })
                ]);
                const customerArray: Customer[] = customerResponse.data;
                await setCustomerList(customerArray);
                await setShopArray(shopResponse.data);
                await setStaffList(staffResponse.data);
                const filteredSection = sectionResponse.data.map(item => ({ name: item.name, category: item.name }));
                await setSectionList(filteredSection);
                await setOriginalSectionList(filteredSection);
                await setContractGoal(contractResponse.data);
                await setExpectedContract(contractExResponse.data);
                // await setShopArray(shopList);
                // await setCustomerList(customerArray);
                // await setStaffList(staffArray);
                // const sectionFilter = [...new Set(customerArray.filter(item => item.section !== '').map(item => item.section))].map(section => ({name: section,category: section})).sort((a, b) => a.name.localeCompare(b.name));
                // await setSectionList(sectionFilter);
                // await setContractGoal(contractGoalArray);     
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current || !containerRef.current) return;

            const containerTop = containerRef.current.getBoundingClientRect().top;
            const newHeight = e.clientY - containerTop;
            setTopHeight(newHeight);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [])

    useEffect(() => {
        const raw = customerList[0]?.last_meeting;
        if (!raw) {
            setLastMeeting('前回営業会議');
            return;
        }

        const entries = raw.split(',');
        const latest = entries[entries.length - 1];
        const datePart = latest.trim().split(' ')[0] || '前回営業会議';

        setLastMeeting(datePart);

        const countMatchedItems = (
            filterArray: { section?: string; shop?: string; staff?: string; name: string }[],
            target: { name: string; category: string }
        ): number => {
            return filterArray.filter(item => item.shop !== "").filter(item => {
                if (item.section === target.name && item.section === target.category) {
                    return item.section === target.name;
                } else if (item.shop === target.name) {
                    return item.shop === target.name;
                } else {
                    return item.staff === target.name;
                }
            }).length;
        };

        setTotalResponseArray(
            sectionList.map(target => countMatchedItems(totalResponseFilter, target))
        );

        setTotalReserveArray(
            sectionList.map(target => countMatchedItems(totalReserveFilter, target))
        );

        setTotalContractArray(
            sectionList.map(target => countMatchedItems(totalContractFilter, target))
        );

        setTotalARankArray(
            sectionList.map(target => countMatchedItems(rankFilters.A, target))
        );

        setTotalBRankArray(
            sectionList.map(target => countMatchedItems(rankFilters.B, target))
        );

        setTotalCRankArray(
            sectionList.map(target => countMatchedItems(rankFilters.C, target))
        );

        setTotalDRankArray(
            sectionList.map(target => countMatchedItems(rankFilters.D, target))
        );

        setTotalERankArray(
            sectionList.map(target => countMatchedItems(rankFilters.E, target))
        );

        setTotalLastARankArray(
            sectionList.map(target => countMatchedItems(lastRankFilters.A, target))
        );

        setTotalLastBRankArray(
            sectionList.map(target => countMatchedItems(lastRankFilters.B, target))
        );

        setTotalLastCRankArray(
            sectionList.map(target => countMatchedItems(lastRankFilters.C, target))
        );

        setTotalDownRankArray(
            sectionList.map(target => countMatchedItems(rankDownFilter, target))
        );

        setTotalResponse(totalResponseFilter.length);

        setTotalReserve(totalReserveFilter.length);

        setTotalContract(totalContractFilter.length);

        setTotalDownRank(rankDownFilter.length);

        type RankKey = 'A' | 'B' | 'C' | 'D' | 'E';

        const rankSetters: Record<RankKey, React.Dispatch<React.SetStateAction<number>>> = {
            A: setTotalARank,
            B: setTotalBRank,
            C: setTotalCRank,
            D: setTotalDRank,
            E: setTotalERank,
        };

        (Object.keys(rankSetters) as RankKey[]).forEach(key => {
            rankSetters[key](rankFilters[key]?.length || 0);
        });

        type LastRankKey = 'A' | 'B' | 'C';

        const lastRankSetters: Record<LastRankKey, React.Dispatch<React.SetStateAction<number>>> = {
            A: setTotalLastARank,
            B: setTotalLastBRank,
            C: setTotalLastCRank,
        };

        (Object.keys(lastRankSetters) as LastRankKey[]).forEach(key => {
            lastRankSetters[key](lastRankFilters[key]?.length || 0);
        });
    }, [customerList, selectedMonth, sectionList]);


    useEffect(() => {
        const convertedList: ExpectList[] = expectedContractFilter.map(({ date, section, shop, count }) => ({
            date, section, shop, count
        }));

        setExpectedList(convertedList);
    }, [selectedMonth, expectedContract]);

    const userFilter = (month: string) => {
        const monthValue = month;
        setSelectedMonth(monthValue);
    };
    type SectionItem = {
        name: string;
        category: 'section' | 'shop' | 'staff';
    };

    const expandSection = (section?: string, shop?: string) => {
        const key = section === '' ? shop : section;
        if (!key) return;

        const isSection = Boolean(section);
        const isShop = !originalSectionList.some(item => item.name === key);

        const updatedList = [...sectionList];
        const currentIndex = updatedList.findIndex(item => item.name === key);
        const isExpanded = expandedMap[key];

        let children: SectionItem[] = [];

        if (isSection) {
            children = shopArray
                .filter(item => item.section === section)
                .map(item => ({ name: item.shop, category: 'shop' }));
        } else if (isShop) {
            children = staffList
                .filter(item => item.shop === shop && item.category === 1)
                .map(item => ({ name: item.name, category: 'staff' }));
        }

        if (currentIndex === -1) {
            const newParent = { name: key, category: isSection ? 'section' : 'shop' };
            setSectionList([newParent, ...children]);
            setExpandedMap(prev => ({ ...prev, [key]: true }));
            return;
        }

        if (isExpanded) {
            let childNames = children.map(c => c.name);

            // セクションの場合は店舗とそのスタッフも削除対象に追加
            if (isSection) {
                const shopsInSection = shopArray.filter(item => item.section === section).map(item => item.shop);
                const staffInSection = staffList
                    .filter(item => shopsInSection.includes(item.shop) && item.category === 1)
                    .map(item => item.name);

                childNames = [...shopsInSection, ...staffInSection];
            }

            const filtered = updatedList.filter((item, i) =>
                !(i > currentIndex && childNames.includes(item.name))
            );

            setSectionList(filtered);
            setExpandedMap(prev => ({ ...prev, [key]: false }));

            // セクション内の店舗・スタッフの展開状態も閉じる
            if (isSection) {
                const shopsInSection = shopArray.filter(item => item.section === section).map(item => item.shop);
                const staffInSection = staffList
                    .filter(item => shopsInSection.includes(item.shop) && item.category === 1)
                    .map(item => item.name);

                const keysToClose = [...shopsInSection, ...staffInSection];
                setExpandedMap(prev => {
                    const updated = { ...prev };
                    keysToClose.forEach(k => {
                        updated[k] = false;
                    });
                    return updated;
                });
            }
        } else {
            updatedList.splice(currentIndex + 1, 0, ...children);
            setSectionList(updatedList);
            setExpandedMap(prev => ({ ...prev, [key]: true }));
        }
    };

    const modalShow = async (category: string, section: string, detail: string) => {
        await setModalCategory(category);
        if (category === '契約(契約見込み)' && section === 'all') {
            (selectedMonth === `${String(year)}/${month}` ? await setModalList([...totalContractFilter, ...rankFilters.A]) : await setModalList([...totalContractFilter]));
            (selectedMonth === `${String(year)}/${month}` ? await setTotalCurrentLength([...totalContractFilter, ...rankFilters.A].length) : await setTotalCurrentLength([...totalContractFilter].length));
        } else if (category === '契約(契約見込み)' && detail === 'staff') {
            const contracted = totalContractFilter.filter(item => item.staff === section);
            const rankA = rankFilters.A.filter(item => item.staff === section);
            (selectedMonth === `${String(year)}/${month}` ? await setModalList([...contracted, ...rankA]) : await setModalList([...contracted]));
            (selectedMonth === `${String(year)}/${month}` ? await setTotalCurrentLength([...contracted, ...rankA].length) : await setTotalCurrentLength([...contracted].length));
        } else if (category === '契約(契約見込み)') {
            const contracted = totalContractFilter.filter(item => section.includes('課') ? item.section === section : item.shop === section);
            const rankA = rankFilters.A.filter(item => section.includes('課') ? item.section === section : item.shop === section);
            (selectedMonth === `${String(year)}/${month}` ? await setModalList([...contracted, ...rankA]) : await setModalList([...contracted]));
            (selectedMonth === `${String(year)}/${month}` ? await setTotalCurrentLength([...contracted, ...rankA].length) : await setTotalCurrentLength([...contracted].length));
        } else if (category === 'ランクダウン' && section === 'all') {
            await setModalList([...rankDownFilter]);
            await setTotalCurrentLength([...rankDownFilter].length);
        } else if (category === 'ランクダウン' && detail === 'staff') {
            const targetList = rankDownFilter.filter(item => item.staff === section);
            await setModalList([...targetList]);
            await setTotalCurrentLength([...targetList].length);
        } else if (category === 'ランクダウン') {
            const targetList = rankDownFilter.filter(item => section.includes('課') ? item.section === section : item.shop === section);
            await setModalList([...targetList]);
            await setTotalCurrentLength([...targetList].length);
        } else if (category.includes('ランク') && section === 'all') {
            switch (category) {
                case 'Aランク':
                    await setModalList([...rankFilters.A]);
                    await setPrevModalList([...lastRankFilters.A]);
                    await setTotalCurrentLength([...rankFilters.A].length);
                    await setTotalPrevLength([...lastRankFilters.A].length);
                    break;
                case 'Bランク':
                    await setModalList([...rankFilters.B]);
                    await setPrevModalList([...lastRankFilters.B]);
                    await setTotalCurrentLength([...rankFilters.B].length);
                    await setTotalPrevLength([...lastRankFilters.B].length);
                    break;
                case 'Cランク':
                    await setModalList([...rankFilters.C]);
                    await setPrevModalList([...lastRankFilters.C]);
                    await setTotalCurrentLength([...rankFilters.C].length);
                    await setTotalPrevLength([...lastRankFilters.C].length);
                    break;
            }
        } else if (category.includes('ランク') && detail === 'staff') {
            switch (category) {
                case 'Aランク':
                    await setModalList([...rankFilters.A.filter(item => item.staff === section)]);
                    await setPrevModalList([...lastRankFilters.A.filter(item => item.staff === section)]);
                    await setTotalCurrentLength([...rankFilters.A.filter(item => item.staff === section)].length);
                    await setTotalPrevLength([...lastRankFilters.A.filter(item => item.staff === section)].length);
                    break;
                case 'Bランク':
                    await setModalList([...rankFilters.B.filter(item => item.staff === section)]);
                    await setPrevModalList([...lastRankFilters.B.filter(item => item.staff === section)]);
                    await setTotalCurrentLength([...rankFilters.B.filter(item => item.staff === section)].length);
                    await setTotalPrevLength([...lastRankFilters.B.filter(item => item.staff === section)].length);
                    break;
                case 'Cランク':
                    await setModalList([...rankFilters.C.filter(item => item.staff === section)]);
                    await setPrevModalList([...lastRankFilters.C.filter(item => item.staff === section)]);
                    await setTotalCurrentLength([...rankFilters.C.filter(item => item.staff === section)].length);
                    await setTotalPrevLength([...lastRankFilters.C.filter(item => item.staff === section)].length);
                    break;
            }
        } else if (category.includes('ランク')) {
            switch (category) {
                case 'Aランク':
                    await setModalList([...rankFilters.A.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setPrevModalList([...lastRankFilters.A.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setTotalCurrentLength([...rankFilters.A.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    await setTotalPrevLength([...lastRankFilters.A.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    break;
                case 'Bランク':
                    await setModalList([...rankFilters.B.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setPrevModalList([...lastRankFilters.B.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setTotalCurrentLength([...rankFilters.B.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    await setTotalPrevLength([...lastRankFilters.B.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    break;
                case 'Cランク':
                    await setModalList([...rankFilters.C.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setPrevModalList([...lastRankFilters.C.filter(item => section.includes('課') ? item.section === section : item.shop === section)]);
                    await setTotalCurrentLength([...rankFilters.C.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    await setTotalPrevLength([...lastRankFilters.C.filter(item => section.includes('課') ? item.section === section : item.shop === section)].length);
                    break;
            }
        }

        await setShow(true);
    }

    const modalClose = async () => {
        await setShow(false);
        await setTotalCurrentLength(0);
        await setTotalPrevLength(0);
        await setCurrentPage(0);
        await setPrevPage(0);
    };

    useEffect(() => {
        console.log(sectionList)
    }, [sectionList])

    const totalResponseFilter = useMemo(() => {
        return customerList.filter(item => item.register.includes(selectedMonth));
    }, [customerList, selectedMonth]);

    const totalReserveFilter = useMemo(() => {
        return customerList.filter(item => item.reserve.includes(selectedMonth));
    }, [customerList, selectedMonth]);

    const totalContractFilter = useMemo(() => {
        return customerList.filter(item => item.contract.includes(selectedMonth));
    }, [customerList, selectedMonth]);

    const rankFilters = useMemo(() => {
        const result = { A: [], B: [], C: [], D: [], E: [] } as Record<'A' | 'B' | 'C' | 'D' | 'E', typeof customerList>;

        customerList.forEach(item => {
            if (item.status !== '契約済み') {
                if (item.rank === 'Aランク' && item.shop !== '') result.A.push(item);
                else if (item.rank === 'Bランク' && item.shop !== '') result.B.push(item);
                else if (item.rank === 'Cランク' && item.shop !== '') result.C.push(item);
                else if (item.rank === 'Dランク' && item.shop !== '') result.D.push(item);
                else if (item.rank === 'Eランク' && item.shop !== '') result.E.push(item);
            }
        });

        return result;
    }, [customerList]);

    const lastRankFilters = useMemo(() => {
        const result = { A: [], B: [], C: [] } as Record<'A' | 'B' | 'C', typeof customerList>;

        customerList.filter(item => item.shop !== "").forEach(item => {
            const latestEntry = item.sales_meeting.split(',').pop();

            if (latestEntry?.includes('Aランク') && !latestEntry?.includes('契約済み')) result.A.push(item);
            else if (latestEntry?.includes('Bランク') && !latestEntry?.includes('契約済み')) result.B.push(item);
            else if (latestEntry?.includes('Cランク') && !latestEntry?.includes('契約済み')) result.C.push(item);
        });

        return result;
    }, [customerList]);

    const rankDownFilter = useMemo(() =>
        customerList.filter(item => {
            const last = item.sales_meeting.split(',').pop();
            return (last?.includes('Aランク') || last?.includes('Bランク') || last?.includes('Cランク')) && (item.rank === 'Dランク' || item.rank === 'Eランク' || item.rank === '') && item.shop !== '' && !item.status.includes('契約済み');
        }), [customerList]
    );

    const contractGoalFilter = useMemo(() => {
        return contractGoal.filter(item => item.period === selectedMonth);
    }, [customerList, selectedMonth])


    const expectedContractFilter = useMemo(() => {
        return expectedContract.filter(item => item.date.includes(selectedMonth));
    }, [expectedContract, selectedMonth])

    const expectedChange = async (count: number, shop: string, date: string, section: string) => {
        const index = expectedList.findIndex(
            item => item.date === date && item.shop === shop
        );

        let updatedList: ExpectList[];

        if (index !== -1) {
            updatedList = expectedList.map(item =>
                item.date === date && item.shop === shop ? { ...item, count } : item
            );
        } else {
            const newItem: ExpectList = { date, section, shop, count };
            updatedList = [...expectedList, newItem];
        }

        setExpectedList(updatedList);
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/",
                    {
                        demand: "contract_ex_update",
                        shop: shop,
                        date: date,
                        section: section,
                        count: count
                    }, {
                    headers
                });
                console.log(response.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();

    };

    return (
        <div className="outer-container" style={{ width: "100vw" }}>
            <div className="d-flex">
                <div className="modal_menu">
                    <MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i
                        className="fa-solid fa-bars hamburger"
                        onClick={() => setOpen(true)}
                    />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i
                        className="fa-solid fa-xmark hamburger position-absolute"
                        onClick={() => setOpen(false)}
                    />
                    <MenuDev brand={brand} />
                </div>
                <div className="content customer p-2">
                    <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                    <div className="row mt-3 mb-4" >
                        <div className="col d-flex">
                            <select className="target" name="startMonth" onChange={(event) => userFilter(event.target.value)}>
                                <option value="20">全期間</option>
                                {monthArray.map((startMonth, index) => (
                                    <option key={index} value={startMonth} selected={selectedMonth === startMonth}>{startMonth}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col d-flex align-items-center" style={{ fontSize: '13px' }}>
                            {customerList.length > 0 ? `最終更新 ${customerList[0]['latest_date']}` : null}
                        </div>
                        <div className="col-4"></div>
                    </div>
                    <div className="table-wrapper">
                        <div className="list_table rank">
                            <Table hover bordered>
                                <thead>
                                    <tr style={{ fontSize: "12px", textAlign: 'center' }}>
                                        <td>店舗</td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{selectedMonth}の総反響数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>総反響</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>来場者数/総反響</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場率</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{selectedMonth}の来場者数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場数</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>契約者数/来場者数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約率</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{selectedMonth}の目標数 なごみ工務店は店舗数で割った数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>目標数</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{selectedMonth}の契約者数 ()内はAランクも合わせた数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約数</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>契約者数/予算 ()内は見込み達成率</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>達成率</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{selectedMonth}の契約が見込める数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>当月契約確約数</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td className='text-center'>
                                            <div className='mb-1'>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>今月契約予定(契約日確定)</Tooltip>}>
                                                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Aランク</span>
                                                </OverlayTrigger>
                                            </div><div className='d-flex justify-content-center'><div className='col'>{today}</div><div className='col'>{lastMeeting}</div></div>
                                        </td>
                                        <td className='text-center'>
                                            <div className='mb-1'>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>今月見込み(確度高い)</Tooltip>}>
                                                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Bランク</span>
                                                </OverlayTrigger>
                                            </div><div className='d-flex justify-content-center'><div className='col'>{today}</div><div className='col'>{lastMeeting}</div></div>
                                        </td>
                                        <td className='text-center'>
                                            <div className='mb-1'>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>今月見込み(勝負案件)</Tooltip>}>
                                                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Cランク</span>
                                                </OverlayTrigger>
                                            </div><div className='d-flex justify-content-center'><div className='col'>{today}</div><div className='col'>{lastMeeting}</div></div>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>継続顧客</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Dランク</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>中長期管理</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Eランク</span>
                                            </OverlayTrigger>
                                        </td>
                                        <td>
                                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{lastMeeting}時点のA~CランクからD~Eランクにダウンした数</Tooltip>}>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>ランクダウン</span>
                                            </OverlayTrigger>
                                        </td>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ fontSize: "12px", textAlign: 'center' }}>
                                        <td>注文営業全体</td>
                                        <td>{totalResponse}</td>
                                        <td>{Number.isFinite(totalReserve / totalResponse) ? `${Math.ceil(totalReserve / totalResponse * 100)}%` : 0}</td>
                                        <td>{totalReserve}</td>
                                        <td>{Number.isFinite(totalContract / totalReserve) ? `${Math.ceil(totalContract / totalReserve * 100)}%` : 0}</td>
                                        <td>{contractGoalFilter.reduce((acc, cur) => acc + cur.goal, 0)}</td>
                                        <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('契約(契約見込み)', 'all', '')}><div style={{ textDecoration: 'underline' }}>{totalContract}<span style={{ color: "blue" }}>{selectedMonth !== `${String(year)}/${month}` || ` (${totalContract + totalARank})`}</span></div></td>
                                        {(() => {
                                            const goal = contractGoalFilter.reduce((acc, cur) => acc + cur.goal, 0);
                                            const goalAchievement = goal && Number.isFinite(totalContract / goal) ? `${Math.ceil(totalContract / goal * 100)}%` : '-';
                                            const goalExpected = goal && Number.isFinite((totalContract + totalARank) / goal) ? `(${Math.ceil((totalContract + totalARank) / goal * 100)}%)` : '';
                                            return (
                                                <td>{goalAchievement}<span style={{ color: "blue" }}>{selectedMonth !== `${String(year)}/${month}` || goalExpected}</span></td>
                                            )
                                        })()}
                                        <td>{expectedList.reduce((acc, curr) => acc + curr.count, 0)}</td>
                                        <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Aランク', 'all', '')}>
                                            <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalARank}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastARank}</div></div>
                                        </td>
                                        <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Bランク', 'all', '')}>
                                            <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalBRank}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastBRank}</div></div>
                                        </td>
                                        <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Cランク', 'all', '')}>
                                            <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalCRank}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastCRank}</div></div>
                                        </td>
                                        <td>{totalDRank}</td>
                                        <td>{totalERank}</td>
                                        <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('ランクダウン', 'all', '')}>{totalDownRank}</td>
                                    </tr>
                                    {sectionList.map((section, sectionIndex) => {
                                        const bgArray = ["table-primary ", "table-success ", "table-warning  ", "table-danger ", "table-secondary ", "table-info "];
                                        let bgClass;
                                        if (originalSectionList.some(o => o.name === section.name)) {
                                            bgClass = bgArray[originalSectionList.findIndex(o => o.name === section.name)];
                                        } else if (section.category === 'shop') {
                                            const targetSection = shopArray.find(s => s.shop === section.name)?.section;
                                            console.log(bgArray[originalSectionList.findIndex(o => o.name === targetSection)])
                                            bgClass = bgArray[originalSectionList.findIndex(o => o.name === targetSection)];
                                        } else {
                                            bgClass = '';
                                        }
                                        return (
                                            <tr className={bgClass} style={{ fontSize: "12px", textAlign: 'center' }}>
                                                <td style={{ textAlign: 'left', cursor: 'pointer' }}
                                                    onClick={() => originalSectionList.some(o => o.name === section.name) ? expandSection(section.name, '') : expandSection('', section.name)}
                                                ><i className={`fa-solid ${expandedMap[section.name] ? 'fa-minus' : 'fa-plus'} ${section.category !== 'staff' || 'd-none'} me-2 p-1 pointer-icon`} onClick={() => originalSectionList.some(o => o.name === section.name) ? expandSection(section.name, '') : expandSection('', section.name)}></i>{section.name}</td>
                                                <td>{totalResponseArray[sectionIndex]}</td>
                                                <td>{Number.isFinite(totalReserveArray[sectionIndex] / totalResponseArray[sectionIndex]) ? `${Math.ceil(totalReserveArray[sectionIndex] / totalResponseArray[sectionIndex] * 100)}%` : '0%'}</td>
                                                <td>{totalReserveArray[sectionIndex]}</td>
                                                <td>{Number.isFinite(totalContractArray[sectionIndex] / totalReserveArray[sectionIndex]) ? `${Math.ceil(totalContractArray[sectionIndex] / totalReserveArray[sectionIndex] * 100)}%` : '0%'}</td>
                                                <td>{(() => {
                                                    const goal = section.name === section.category ?
                                                        contractGoalFilter.filter(c => c.section === section.name).reduce((acc, cur) => acc + cur.goal, 0) :
                                                        contractGoalFilter.filter(c => c.shop === section.name).reduce((acc, cur) => acc + cur.goal, 0);
                                                    const goalValue = goal === 0 ? '-' : goal
                                                    return (goalValue)
                                                })()}</td>
                                                <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('契約(契約見込み)', section.name, section.category)}><div style={{ textDecoration: 'underline' }}>{totalContractArray[sectionIndex]}<span style={{ color: "blue" }}>{selectedMonth !== `${String(year)}/${month}` || ` (${totalContractArray[sectionIndex] + totalARankArray[sectionIndex]})`}</span></div></td>
                                                {(() => {
                                                    const goal = section.name === section.category ?
                                                        contractGoalFilter.filter(c => c.section === section.name).reduce((acc, cur) => acc + cur.goal, 0) :
                                                        contractGoalFilter.filter(c => c.shop === section.name).reduce((acc, cur) => acc + cur.goal, 0);
                                                    const goalAchievement = goal && Number.isFinite(totalContractArray[sectionIndex] / goal) ? `${Math.ceil(totalContractArray[sectionIndex] / goal * 100)}%` : '-';
                                                    const goalExpected = goal && Number.isFinite((totalContractArray[sectionIndex] + totalLastARankArray[sectionIndex]) / goal) ? `(${Math.ceil((totalContractArray[sectionIndex] + totalARankArray[sectionIndex]) / goal * 100)}%)` : '';
                                                    return (
                                                        <td>{goalAchievement}<span style={{ color: "blue" }}>{selectedMonth !== `${String(year)}/${month}` || goalExpected}</span></td>
                                                    )
                                                })()}
                                                {(() => {
                                                    const keywords = originalSectionList.map(section => section.name);
                                                    let expected;
                                                    let shopValue: string | undefined;
                                                    let sectionValue: string | undefined;
                                                    if (keywords.some(keyword => section.name === keyword)) {
                                                        expected = expectedList.filter(e => e.section === section.name).reduce((acc, curr) => acc + curr.count, 0);
                                                    } else if (section.category === 'shop' && (shopArray.some(shopName => section.name === shopName.shop))) {
                                                        expected = expectedList.filter(e => e.shop === section.name).reduce((acc, curr) => acc + curr.count, 0);
                                                        shopValue = shopArray.find(item => item.shop === section.name)?.shop;
                                                        sectionValue = shopArray.find(item => item.shop === shopValue)?.section;
                                                    }
                                                    return (
                                                        <td>{shopArray.some(shopName => section.name === shopName.shop) ? <input type="number" className="form-control" style={{ fontSize: '12px', width: '70px', margin: '0 auto', textAlign: 'center' }} value={expected}
                                                            onChange={(e) => expectedChange(Number(e.target.value), section.name, selectedMonth, sectionValue as string)} /> :
                                                            section.category === 'staff' ? '-' : expected}</td>
                                                    )
                                                })()}
                                                <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Aランク', section.name, section.category)}>
                                                    <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalARankArray[sectionIndex]}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastARankArray[sectionIndex]}</div></div>
                                                </td>
                                                <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Bランク', section.name, section.category)}>
                                                    <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalBRankArray[sectionIndex]}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastBRankArray[sectionIndex]}</div></div>
                                                </td>
                                                <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('Cランク', section.name, section.category)}>
                                                    <div className='d-flex justify-content-center'><div className='col' style={{ textDecoration: 'underline' }}>{totalCRankArray[sectionIndex]}</div><div className='col' style={{ textDecoration: 'underline' }}>{totalLastCRankArray[sectionIndex]}</div></div>
                                                </td>
                                                <td>{totalDRankArray[sectionIndex]}</td>
                                                <td>{totalERankArray[sectionIndex]}</td>
                                                <td style={{ cursor: 'pointer' }} className='hover' onClick={() => modalShow('ランクダウン', section.name, section.category)}>{totalDownRankArray[sectionIndex]}</td>
                                            </tr>
                                        )
                                    }
                                    )}
                                </tbody>
                            </Table>
                            <Modal show={show} onHide={modalClose} size={modalCategory === '契約(契約見込み)' || modalCategory === 'ランクダウン' ? 'lg' : 'xl'}>
                                <Modal.Header closeButton>
                                    <Modal.Title style={{ fontSize: '15px' }}>顧客情報詳細</Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    <div className='row'>
                                        <div className='col p-2'>
                                            <div className='text-center' style={{ fontSize: '12px' }}>{today}_{modalCategory} <i className="fa-solid fa-crown ps-1"></i>契約済み</div>
                                            <Table striped style={{ fontSize: '12px' }} hover>
                                                <thead>
                                                    <tr>
                                                        <td>店舗</td>
                                                        <td>担当営業</td>
                                                        <td>お客様名</td>
                                                        <td>反響日</td>
                                                        <td>来場日</td>
                                                        <td>前回ランク</td>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {modalList.slice(currentPage, (currentPage + 20)).map((item, index) => {
                                                        const prevRank = item.sales_meeting.split(',').pop()?.split(' ')[1];
                                                        const rankArray = ['Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
                                                        const prevRankIndex = rankArray.findIndex(rank => rank === prevRank);
                                                        const currentRankIndex = rankArray.findIndex(rank => rank === item.rank);
                                                        let shift;
                                                        if (item.status === '契約済み') {
                                                            shift = <i className="fa-solid fa-crown ps-1"></i>;
                                                        } else if (!item.sales_meeting.includes('ランク')) {
                                                            shift = <>新規<i className="fa-solid fa-star ps-1"></i></>;
                                                        } else if (item.rank === '') {
                                                            shift = "";
                                                        } else if (currentRankIndex > prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-down ps-1"></i>;
                                                        } else if (currentRankIndex < prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-up ps-1"></i>;
                                                        } else if (currentRankIndex === prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-right ps-1"></i>;
                                                        }
                                                        return (
                                                            <tr key={index} className={item.status === '契約済み' ? 'table-danger' : ''}>
                                                                <td>{item.shop}</td>
                                                                <td>{item.staff}</td>
                                                                <td><div style={{ position: 'relative', display: 'inline-block' }}
                                                                    onMouseEnter={(e) => {
                                                                        setHoveredIdx(index);
                                                                        setClientX(e.clientX);
                                                                        setClientY(e.clientY);
                                                                    }}
                                                                    onMouseLeave={() => {
                                                                        setHoveredIdx(null);
                                                                        setClientX(0);
                                                                        setClientY(0);
                                                                    }}>
                                                                    <button style={{ textDecoration: 'underline dotted', cursor: 'pointer', background: 'transparent', border: 'none' }}>{item.name}</button>
                                                                    {hoveredIdx === index && (
                                                                        <div className={`customer_detail ${clientY > 250 && clientY < 499 ? 'middle' : ''} ${clientY > 500 ? 'under' : ''} ${clientX > 800 ? 'right' : ''}`}>
                                                                            <Table>
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>お客様名</td>
                                                                                        <td className='fw-bold'>店舗</td>
                                                                                        <td className='fw-bold'>営業</td>
                                                                                        <td className='fw-bold'>名簿取得日</td>
                                                                                        <td className='fw-bold'>販促媒体</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.name}</td>
                                                                                        <td>{item.shop}</td>
                                                                                        <td>{item.staff}</td>
                                                                                        <td>{item.register}</td>
                                                                                        <td>{item.medium}</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>次回アポ</td>
                                                                                        <td className='fw-bold'>LINEグループ作成</td>
                                                                                        <td className='fw-bold'>事前審査</td>
                                                                                        {/* <td className='fw-bold'>競合会社</td> */}
                                                                                        <td className='fw-bold'>土地</td>
                                                                                        <td className='fw-bold'>希望予算</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.appointment}</td>
                                                                                        <td>{item.line_group}</td>
                                                                                        <td>{item.screening}</td>
                                                                                        {/* <td>{item.rival}</td> */}
                                                                                        <td>{item.estate}</td>
                                                                                        <td>{item.budget}</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>契約スケジュール</td>
                                                                                        <td className='fw-bold'>重視項目</td>
                                                                                        <td className='fw-bold'></td>
                                                                                        <td className='fw-bold'></td>
                                                                                        <td className='fw-bold'></td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.period}</td>
                                                                                        <td>{item.importance}</td>
                                                                                        <td></td>
                                                                                        <td></td>
                                                                                        <td></td>
                                                                                    </tr>
                                                                                    <tr className='fw-bold'>
                                                                                        <td colSpan={6} >商談後アンケート・感想</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td colSpan={6} >{item.survey.split('\n').map((line, index) => (<React.Fragment key={index}>{line}<br /></React.Fragment>))}</td>
                                                                                    </tr>
                                                                                    <tr className='fw-bold'>
                                                                                        <td colSpan={6} >次回アポまで対応内容・担当者の感覚</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td colSpan={6} >{item.note.split('\n').map((line, index) => (<React.Fragment key={index}>{line}<br /></React.Fragment>))}</td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </Table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                </td>
                                                                <td>{item.register}</td>
                                                                <td>{item.reserve}</td>
                                                                <td>{prevRank}{shift}</td>
                                                            </tr>)
                                                    })}
                                                </tbody>
                                            </Table>
                                            <div className='row' style={{ fontSize: '12px' }}>
                                                {currentPage === 0 ? <div className='col text-center'></div> : <div className='col text-center text-primary pointer' style={{ textDecoration: 'underline' }} onClick={() => setCurrentPage(currentPage - 20)}>前の20件</div>}
                                                {totalCurrentLength - currentPage > 20 ? <div className='col text-center text-primary pointer' style={{ textDecoration: 'underline' }} onClick={() => setCurrentPage(currentPage + 20)}>次の20件</div> : <div className='col text-center'></div>}
                                            </div>
                                        </div>
                                        {modalCategory === '契約(契約見込み)' || modalCategory === 'ランクダウン' ? null : <div className='col p-2'>
                                            <div className='text-center' style={{ fontSize: '12px' }}>{customerList[0]?.last_meeting ? customerList[0]?.last_meeting?.split(",").pop()?.split(" ")[0] : "前回営業会議"}_{modalCategory} <i className="fa-solid fa-crown ps-1"></i>契約済み</div>
                                            <Table striped style={{ fontSize: '12px' }} hover>
                                                <thead>
                                                    <tr>
                                                        <td>店舗</td>
                                                        <td>担当営業</td>
                                                        <td>お客様名</td>
                                                        <td>反響日</td>
                                                        <td>来場日</td>
                                                        <td>現在ランク</td>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {prevModalList.slice(prevPage, (prevPage + 20)).map((item, index) => {
                                                        const prevRank = item.sales_meeting.split(',').pop()?.split(' ')[1];
                                                        const rankArray = ['Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
                                                        const prevRankIndex = rankArray.findIndex(rank => rank === prevRank);
                                                        const currentRankIndex = rankArray.findIndex(rank => rank === item.rank);
                                                        let shift;
                                                        if (item.status === '契約済み') {
                                                            shift = <i className="fa-solid fa-crown ps-1"></i>;
                                                        } else if (!item.sales_meeting.includes('ランク')) {
                                                            shift = <>新規<i className="fa-solid fa-star ps-1"></i></>;
                                                        } else if (item.rank === '') {
                                                            shift = "";
                                                        } else if (currentRankIndex > prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-down ps-1"></i>;
                                                        } else if (currentRankIndex < prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-up ps-1"></i>;
                                                        } else if (currentRankIndex === prevRankIndex) {
                                                            shift = <i className="fa-solid fa-arrow-right ps-1"></i>;
                                                        }
                                                        return (
                                                            <tr key={index + 10000} className={item.status === '契約済み' ? 'table-danger' : ''}>
                                                                <td>{item.shop}</td>
                                                                <td>{item.staff}</td>
                                                                <td><div style={{ position: 'relative', display: 'inline-block' }}
                                                                    onMouseEnter={(e) => {
                                                                        setHoveredIdx(index + 10000);
                                                                        setClientX(e.clientX);
                                                                        setClientY(e.clientY);
                                                                    }}
                                                                    onMouseLeave={() => {
                                                                        setHoveredIdx(null);
                                                                        setClientX(0);
                                                                        setClientY(0);
                                                                    }}>
                                                                    <button style={{ textDecoration: 'underline dotted', cursor: 'pointer', background: 'transparent', border: 'none' }}>{item.name}</button>
                                                                    {hoveredIdx === index + 10000 && (
                                                                        <div className={`customer_detail ${clientY > 250 && clientY < 499 ? 'middle' : ''} ${clientY > 500 ? 'under' : ''} ${clientX > 800 ? 'right' : ''}`}>
                                                                            <Table>
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>お客様名</td>
                                                                                        <td className='fw-bold'>店舗</td>
                                                                                        <td className='fw-bold'>営業</td>
                                                                                        <td className='fw-bold'>名簿取得日</td>
                                                                                        <td className='fw-bold'>販促媒体</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.name}</td>
                                                                                        <td>{item.shop}</td>
                                                                                        <td>{item.staff}</td>
                                                                                        <td>{item.register}</td>
                                                                                        <td>{item.medium}</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>次回fafasアポ</td>
                                                                                        <td className='fw-bold'>LINEグループ作成</td>
                                                                                        <td className='fw-bold'>事前審査</td>
                                                                                        {/* <td className='fw-bold'>競合会社</td> */}
                                                                                        <td className='fw-bold'>土地</td>
                                                                                        <td className='fw-bold'>希望予算</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.appointment}</td>
                                                                                        <td>{item.line_group}</td>
                                                                                        <td>{item.screening}</td>
                                                                                        {/* <td>{item.rival}</td> */}
                                                                                        <td>{item.estate}</td>
                                                                                        <td>{item.budget}</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className='fw-bold'>契約スケジュール</td>
                                                                                        <td className='fw-bold'>重視項目</td>
                                                                                        <td className='fw-bold'></td>
                                                                                        <td className='fw-bold'></td>
                                                                                        <td className='fw-bold'></td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td>{item.period}</td>
                                                                                        <td>{item.importance}</td>
                                                                                        <td></td>
                                                                                        <td></td>
                                                                                        <td></td>
                                                                                    </tr>
                                                                                    <tr className='fw-bold'>
                                                                                        <td colSpan={6} >商談後アンケート・感想</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td colSpan={6} >{item.survey.split('\n').map((line, index) => (<React.Fragment key={index}>{line}<br /></React.Fragment>))}</td>
                                                                                    </tr>
                                                                                    <tr className='fw-bold'>
                                                                                        <td colSpan={6} >次回アポまで対応内容・担当者の感覚</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td colSpan={6} >{item.note.split('\n').map((line, index) => (<React.Fragment key={index}>{line}<br /></React.Fragment>))}</td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </Table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                </td>
                                                                <td>{item.register}</td>
                                                                <td>{item.reserve}</td>
                                                                <td>{item.status === '契約済み' ? item.status : item.rank}{shift}</td>
                                                            </tr>)
                                                    })}
                                                </tbody>
                                            </Table>
                                            <div className='row' style={{ fontSize: '12px' }}>
                                                {prevPage === 0 ? <div className='col text-center'></div> : <div className='col text-center text-primary pointer' style={{ textDecoration: 'underline' }} onClick={() => setPrevPage(prevPage - 20)}>前の20件</div>}
                                                {totalPrevLength - prevPage > 20 ? <div className='col text-center text-primary pointer' style={{ textDecoration: 'underline' }} onClick={() => setPrevPage(prevPage + 20)}>次の20件</div> : <div className='col text-center'></div>}
                                            </div>
                                        </div>}
                                    </div>
                                </Modal.Body>
                            </Modal>
                        </div>
                    </div></div></div></div>
    )
}

export default RankDev;