import { inputStyle, safeFormate } from "../../utils/informationUtils";
import React, { memo } from 'react';

type InputProps = {
    itemKey: string;
    defaultValue?: string;
    widthValue?: string;
    numeric?: boolean;
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    list?: string[]
};

const TableSelect = ({ itemKey, widthValue, information, setInformation, list, defaultValue }: InputProps) => {
    return (
        <select
            style={widthValue ? { ...inputStyle, width: widthValue } : inputStyle}
            value={safeFormate(information[itemKey])}
            onChange={(e) => {
                setInformation(prev => (
                    {
                        ...prev,
                        [itemKey]: e.target.value
                    }
                ));
            }}>
            {defaultValue && <option value=''>{defaultValue}</option>}
            {list?.map(l =>
                <option value={l} key={l}>{l}</option>
            )}
        </select>
    );
};

export default memo(TableSelect, (prevProps, nextProps) => {
    const isValueEqual = prevProps.information[prevProps.itemKey] === nextProps.information[nextProps.itemKey];    
    const isListEqual = (prevProps.list || []).join(',') === (nextProps.list || []).join(',');
    return isValueEqual && isListEqual;
});