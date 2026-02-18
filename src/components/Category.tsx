import { useNavigate } from 'react-router-dom';
import React, { useState, useContext, useEffect } from 'react';
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext";
import Logo from "../assets/images/logo.png";

const Category = () => {
    const [open, setOpen] = useState(false);
    const { brand } = useContext(AuthContext);
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    const { setCategory } = useContext(AuthContext);

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "") navigate("/login");
    }, []);

    const goToDashboard = async (categoryValue: string) => {
        await setCategory(categoryValue);
        await navigate('/company');
    };

    return (
        <>
            <div className="home_logo"><img src={Logo} className='w-100' /></div>
            <div className="d-md-flex align-items-center justify-content-center home_menu">
                <div className="bg-primary text-center text-white py-3 px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('order')}>注文営業</div>
                <div className="bg-success text-center text-white py-3 px-4 px-md-5 rounded-pill mx-md-3 my-4 pointer" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('spec')}>建売営業</div>
                <div className="bg-warning text-center text-white py-3 px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: '700', letterSpacing: '1px' }}
                    onClick={() => goToDashboard('used')}>中古住宅</div>
            </div>
        </>
    )
}

export default Category