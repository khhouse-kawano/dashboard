import { useNavigate } from 'react-router-dom';
import React, { useState, useContext, useEffect } from 'react';
import AuthContext from "../context/AuthContext";
import Logo from "../assets/images/logo.png";
import apiClient from '../utils/apiClient';
import Table from "react-bootstrap/Table";
import { useIsSp } from '../utils/isSp';

type Log = { no: number, version: string, date: string, note: string };

const Category = () => {
    const { version } = useContext(AuthContext);
    const navigate = useNavigate();
    const { setCategory } = useContext(AuthContext);
    const [log, setLog] = useState<Log[]>([]);
    const isSp = useIsSp();

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post("", { request: 'update_log' },);
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
            <div className="d-block w-100">
                <div className="home_logo position-relative">
                    <img src={Logo} className='w-100' />
                    <div className="position-absolute" style={{ bottom: '-10px', right: '3px' }}>ver{version}</div>
                </div>
                <div className="d-md-flex align-items-center justify-content-center home_menu">
                    <div className="bg-primary text-center text-white py-2 py-md-3 px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('order')}>注文営業</div>
                    <div className="bg-success text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill mx-md-3 my-4 pointer" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('spec')}>建売営業</div>
                    <div className="bg-warning text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('used')}>中古住宅</div>
                </div>
                <div style={{ width: '90%', maxWidth: '568px', margin: '30px auto 0', height: '180px', overflowY: 'scroll' }}>
                    <Table striped>
                        <tbody style={{ fontSize: '10px' }}>
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
                                    <tr key={`${item}_${index}`}>
                                        <td>{index + 1}</td>
                                        <td>{item.version}</td>
                                        <td>{item.date}</td>
                                        <td>{item.note.split('\n').map((line, lineIndex) =>
                                            <div key={lineIndex}>{line}</div>)}</td>
                                    </tr>)}
                        </tbody>
                    </Table>
                </div>
            </div>
        </>
    )
}

export default Category