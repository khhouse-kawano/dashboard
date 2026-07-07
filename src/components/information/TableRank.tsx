import React, {memo} from 'react';
import { inputStyle } from '../../utils/informationUtils';
import { safeFormate } from '../../utils/informationUtils';
import { buttonStyle } from '../../utils/informationUtils';

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    thisMonth: string,
    setShowDetail: React.Dispatch<React.SetStateAction<string>>
}

const TableRank = ({ information, setInformation, idMapping, thisMonth, setShowDetail }: Props) => {
    return (
        <>
            <div className="d-flex align-items-center">
                <select style={{ ...inputStyle, width: '130px' }} value={safeFormate(information[idMapping('顧客ランク')])}
                    onChange={(e) => {
                        setInformation(prev => (
                            {
                                ...prev,
                                [idMapping('顧客ランク')]: e.target.value
                            }
                        ));
                    }}>
                    <option value="">選択してください</option>
                    <option value='Sランク'>Sランク</option>
                    <option value='Aランク'>Aランク</option>
                    <option value='Bランク'>Bランク</option>
                    <option value='Cランク'>Cランク</option>
                    <option value='Dランク'>Dランク</option>
                    <option value='Eランク'>Eランク</option>
                </select>
                <input type="month" style={{ ...inputStyle, width: '100px' }}
                    value={information.rank_period && information.rank_period >= thisMonth ? information.rank_period.replace(/\//g, '-') : thisMonth}
                    onChange={(e) => {
                        const formattedMonth = e.target.value.replace(/-/g, '/');
                        setInformation(prev => (
                            {
                                ...prev,
                                rank_period: formattedMonth
                            }
                        ));
                    }} />
                <div style={buttonStyle}
                    onClick={() => setShowDetail('rank')}>ランク設定</div>
            </div></>
    )
}

export default memo(TableRank, (prevProps, nextProps) => {
    const rankKey = prevProps.idMapping('顧客ランク');

    const fieldsToCheck = [
        rankKey,
        'rank_period'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.thisMonth !== nextProps.thisMonth) return false;

    return true; 
});