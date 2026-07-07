import React, { memo } from 'react';
import { inputStyle, safeFormate } from '../../utils/informationUtils';

type Props = {
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    itemKey: string;
    placeholder?: string;
};

const TableTextarea = ({ information, setInformation, itemKey, placeholder }: Props) => {
    const value = safeFormate(information[itemKey]);
    
    return (
        <textarea 
            placeholder={placeholder} 
            style={{ ...inputStyle, width: '90%', height: 'auto' }} 
            value={value}
            rows={value ? Math.max(Math.ceil(value.length / 53) + 2, 2) : 2}
            onChange={(e) => {
                setInformation(prev => ({
                    ...prev,
                    [itemKey]: e.target.value
                }));
            }} 
        />
    );
};

export default memo(TableTextarea, (prevProps, nextProps) => {
    return prevProps.information[prevProps.itemKey] === nextProps.information[nextProps.itemKey];
});