import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatabaseOrder from './DatabaseOrder';
import DatabaseKaeru from './DatabaseKaeru';
import DatabaseResale from './DatabaseResale';

type Props = {
    onReload: () => void,
    key: number
};

const DatabaseRouter = ({ onReload, key }: Props) => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!category) {
            navigate('/home')
        }
    }, [category]);

    return (
        <>
            {category === 'order' && <DatabaseOrder onReload={onReload} key={key} />}
            {category === 'spec' && <DatabaseKaeru onReload={onReload} key={key} />}
            {category === 'used' && <DatabaseResale onReload={onReload} key={key} />}
        </>
    )
}

export default DatabaseRouter