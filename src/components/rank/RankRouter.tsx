import AuthContext from '../../context/AuthContext';
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RankOrder from './RankOrder';
import RankKaeru from './RankKaeru';

const RankRouter = () => {
  const { category } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!category) {
      navigate('/home')
    }
  }, [category]);
  return (
    <>
      {category === 'order' && <RankOrder />}
      {category === 'spec' && <RankKaeru />}
    </>
  )
}

export default RankRouter