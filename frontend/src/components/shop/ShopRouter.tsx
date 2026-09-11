import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopOrder from './ShopOrder';
import ShopKaeru from './ShopKaeru';

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
            {category === 'spec' && <ShopKaeru />}
            {/* ⚠️ 'used'（中古）は画面も ② のハンドラも無い。作るなら
                backend-express/src/features/shop/queries.ts の ShopCategory、
                registry.ts、core/express_proxy.php の3箇所も直すこと */}
        </>
    )
}

export default CustomerRouter