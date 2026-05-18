import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopTrendOrder from './ShopTrendOrder';
import ShopTrendKaeru from './ShopTrendKaeru';

export const ShopTrendRouter = () => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!category) {
            navigate('/home')
        }
    }, [category]);
    return (
        <>
            {category === 'order' && <ShopTrendOrder />}
            {category === 'spec' && <ShopTrendKaeru />}
        </>
    )
}
