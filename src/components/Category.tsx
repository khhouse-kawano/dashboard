import { useNavigate } from 'react-router-dom';
import React, { useState, useContext, useEffect } from 'react';
import AuthContext from "../context/AuthContext";
import Logo from "../assets/images/logo.png";
import axios from 'axios';
import { headers } from '../utils/headers';
import Table from "react-bootstrap/Table";
import ActiveUser from './ActiveUser';

type Log = { no: number, version: string, date: string, note: string };

const Category = () => {
    const { brand, token, version } = useContext(AuthContext);
    const navigate = useNavigate();
    const { setCategory } = useContext(AuthContext);
    const [log, setLog] = useState<Log[]>([]);

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "") navigate("/login");
        const fetchData = async () => {
            const response = await axios.post(
                "https://khg-marketing.info/dashboard/api/",
                { demand: 'update_log' },
                { headers }
            );
            setLog(response.data);
        }
        fetchData();
    }, []);

    const goToDashboard = async (categoryValue: string) => {
        await setCategory(categoryValue);
        await navigate('/company');
    };

    return (
        <>
            <div className="home_logo position-relative">
                <img src={Logo} className='w-100' />
                <div className="position-absolute" style={{ bottom: '-10px', right: '3px' }}>ver{version}</div>
            </div>
            <div className="d-md-flex align-items-center justify-content-center home_menu">
                <div className="bg-primary text-center text-white py-3 px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('order')}>注文営業</div>
                <div className="bg-success text-center text-white py-3 px-4 px-md-5 rounded-pill mx-md-3 my-4 pointer" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('spec')}>建売営業</div>
                <div className="bg-warning text-center text-white py-3 px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('used')}>中古住宅</div>
            </div>
            <div style={{ width: '90%', maxWidth: '568px', margin: '30px auto 0', height: '180px', overflowY: 'scroll' }}>
                <Table>
                    <tbody style={{ fontSize: '12px' }}>
                        <tr>
                            <td>No</td>
                            <td>version</td>
                            <td>日付</td>
                            <td>詳細</td>
                        </tr>
                        {log
                            .sort((a, b) => {
                                return b.no - a.no
                            })
                            .map((item, index) =>
                                <tr>
                                    <td>{index + 1}</td>
                                    <td>{item.version}</td>
                                    <td>{item.date}</td>
                                    <td>{item.note.split('\n').map((line, lineIndex) =>
                                        <div key={lineIndex}>{line}</div>)}</td>
                                </tr>)}
                    </tbody>
                </Table>
            </div>
        </>
    )
}

export default Category