import React, {memo} from 'react'
import { selectStyle } from '../../utils/informationUtils';
import { safeFormate } from '../../utils/informationUtils';

type Staff = { name: string; shop: string; category: number, section: string, period: string };

type Shop = {
    shop: string,
    section: string
};

type Props = {
    information: Record<string, string>
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    staffArray: Staff[],
    shopArray: Shop[]
};

const TableShop = ({ information, setInformation, idMapping, staffArray, shopArray }: Props) => {
    return (
        <>
            <select
                style={selectStyle}
                value={safeFormate(information[idMapping('担当店舗')])}
                onChange={(e) => {
                    const selected = staffArray.find(item => item.shop === e.target.value);
                    setInformation(prev => ({
                        ...prev,
                        [idMapping('担当店舗')]: e.target.value,
                        [idMapping('担当営業')]: selected?.name || "",
                    }));
                }}
            >
                <option value=''>担当店舗を選択</option>
                {shopArray
                    .map((item, index) => (
                        <option key={index} value={item.shop}>
                            {item.shop}
                        </option>
                    ))}
            </select></>
    )
}

export default memo(TableShop, (prevProps, nextProps) => {
    const shopKey = prevProps.idMapping('担当店舗');

    if (prevProps.information[shopKey] !== nextProps.information[shopKey]) {
        return false;
    }


    if (prevProps.shopArray !== nextProps.shopArray) return false;
    if (prevProps.staffArray !== nextProps.staffArray) return false;


    return true; 
});