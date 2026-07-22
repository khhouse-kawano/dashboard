import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import MapOrder from './MapOrder';
import MapResale from './MapResale';
import MapKaeru from './MapKaeru';
import { useNavigate } from 'react-router-dom';
const MapRouter = () => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!category) {
            navigate('/home')
        }
    }, [category]);
    return (
        <>
            {category === 'order' && <MapOrder />}
            {category === 'spec' && <MapKaeru  />}
            {category === 'used' && <MapResale  />}
            </>
    )
}

export default MapRouter

