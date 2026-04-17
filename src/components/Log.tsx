import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from "../context/AuthContext";
import MenuDev from "./MenuDev";

type UserLog = { time: string, url: string };
type LogList = { name: string, timestamp: string, log: UserLog[] };

const Log = () => {
    const [logList, setLogList] = useState<LogList[]>([]);
    const [log, setLog] = useState<UserLog[]>([]);
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const headers = {
        Authorization: "4081Kokubu",
        "Content-Type": "application/json",
    };
    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "login_log" }, { headers });
                const filteredData = response.data.map(item => {
                    let parsedLog: UserLog[] = [];
                    try {
                        if (item.log) {
                            const tmp = JSON.parse(item.log);
                            parsedLog = Array.isArray(tmp) ? tmp : [];
                        }
                    } catch {
                        parsedLog = [];
                    }

                    return {
                        ...item,
                        log: parsedLog
                    };
                });
                setLogList(filteredData);
            } catch (error) {
                console.error("Error fetching user data:", error);
                setLogList([]);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="outer-container">
            <div className="d-flex">
                <div className="modal_menu" style={{ width: "20%" }}>
                    <MenuDev brand={brand} />
                </div>
                <div className="content database bg-white p-2">
                    <Table bordered hover>
                        <thead>
                            <tr>
                                <td style={{ width: '20%' }}>最終利用時刻</td>
                                <td style={{ width: '20%' }}>氏名</td>
                                <td>利用ログ</td>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '12px' }}>
                            {logList
                                .filter(item => item.timestamp)
                                .sort((a, b) => {
                                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                                }).map((item, index) => {
                                    const isLog = item.log.length > 0;
                                    const isExpand = log.length > 0;
                                    return (
                                        <tr key={index}>
                                            <td>{item.timestamp}</td>
                                            <td>{item.name}</td>
                                            <td>{isLog && <div className="bg-info text-white px-2 py-1 rounded text-center" style={{ width: 'fit-content', cursor: 'pointer' }}
                                                onClick={() => isLog ? setLog(item.log) : null}>開く</div>}
                                                { isExpand && <div className="bg-danger text-white px-2 py-1 rounded text-center" style={{ width: 'fit-content', cursor: 'pointer' }}
                                                    onClick={() => isLog ? setLog(item.log) : null}>閉じる</div>}
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default Log;
