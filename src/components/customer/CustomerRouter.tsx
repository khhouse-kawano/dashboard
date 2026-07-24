import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerOrder from './CustomerOrder';
import CustomerKaeru from './CustomerKaeru'

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
            {category === 'order' && <CustomerOrder />}
            {category === 'spec' && <CustomerKaeru />}
        </>
    )
}

export default CustomerRouter