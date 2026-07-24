import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopOrder from './ShopOrder';

const CustomerRouter = () => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!category) {
            navigate('/home')
        }
    }, [category]);

    return (
        <>
            {category === 'order' && <ShopOrder />}
        </>
    )
}

export default CustomerRouter