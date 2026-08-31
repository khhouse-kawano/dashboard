import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerTrendOrder from './CustomerTrendOrder';
import CustomerTrendKaeru from './CustomerTrendKaeru';
import CustomerTrendResale from './CustomerTrendResale';

const CustomerTrendRouter = () => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!category) {
            navigate('/home')
        }
    }, [category]);

    return (
        <>
            {category === 'order' && <CustomerTrendOrder  />}
            {category === 'spec' && <CustomerTrendKaeru  />}
            {category === 'used' && <CustomerTrendResale/>}
        </>
    )
}

export default CustomerTrendRouter