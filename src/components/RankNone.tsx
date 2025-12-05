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
type Goal = { id: number; period: string; section: string; goal: number }
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
    const [expandedSectionState, setExpandedSectionState] = useState<boolean[]>([false, false, false, false]);
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

    const bgArray = ["table-primary ", "table-success ", "table-warning  ", "table-danger "];

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
        if (!brand || brand.trim() === "") {
            navigate("/");
            return;
        }

    }, [])



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
                    <div className="h3 text-center d-flex align-items-center justify-content-center text-danger" style={{height: '100vw', fontWeight: '800'}}>新組織体系発足のため改修中です。<br/>11/5(水)完了予定</div>
                </div>
            </div>
        </div>
    )
}

export default RankDev;