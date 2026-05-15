import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import ListOrder from './ListOrder';
import ListKaeru from './ListKaeru';
import ListResale from './ListResale';
import { useNavigate } from 'react-router-dom';

type Props = {
    onReload: () => void;
};
const ListRouter = ({ onReload }: Props) => {
    const { category } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if(!category){
            navigate('/home')
        }
    }, [category]);

    return (
        <>
            {category === 'order' && <ListOrder onReload={onReload} />}
            {category === 'spec' && <ListKaeru onReload={onReload} />}
            {category === 'used' && <ListResale onReload={onReload} />}
        </>
    )
}

export default ListRouter