import { inputStyle, safeFormate, toHalfWidth, dateFormate } from "../../utils/informationUtils";
import React, { memo, useState, useEffect } from 'react';

type InputProps = {
    itemKey: string;
    defaultValue?: string;
    widthValue?: string;
    numeric?: boolean;
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    type?: string;
    formattedValue?: string;
};

const TableInput = ({ itemKey, defaultValue, widthValue, numeric, information, setInformation, type, formattedValue }: InputProps) => {
    
    // 修正: ?? を使って条件を整理しました
    const [localValue, setLocalValue] = useState(
        formattedValue ?? (type === 'date' ? dateFormate(information[itemKey]) : safeFormate(information[itemKey]))
    );

    // 修正: useEffect 側も useState の初期値と同じロジックにしておくことをお勧めします
    // （そうしないと、再レンダリング時に type === 'date' のフォーマットが失われる可能性があります）
    useEffect(() => {
        setLocalValue(
            formattedValue ?? (type === 'date' ? dateFormate(information[itemKey]) : safeFormate(information[itemKey]))
        );
    }, [information[itemKey], formattedValue, type]);

    return (
        <input
            type={type ?? 'text'}
            placeholder={defaultValue}
            style={widthValue ? { ...inputStyle, width: widthValue } : inputStyle}
            value={localValue} 
            onChange={(e) => {
                setLocalValue(e.target.value);
            }}
            onBlur={(e) => {
                let finalValue = e.target.value;
                
                if (numeric) {
                    const halfValue = toHalfWidth(finalValue);
                    finalValue = halfValue.replace(/[^0-9-]/g, '');
                    setLocalValue(finalValue);
                }
                
                setInformation((prev: any) => ({
                    ...prev,
                    [itemKey]: finalValue
                }));
            }}
        />
    );
};

export default memo(TableInput, (prevProps, nextProps) => {
    const isValueEqual = prevProps.information[prevProps.itemKey] === nextProps.information[nextProps.itemKey];
    const isFormattedEqual = prevProps.formattedValue === nextProps.formattedValue;
    return isValueEqual && isFormattedEqual;
});