import React, { memo } from 'react';

type Props = {
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    itemKey: string;
    options: string[];
    idPrefix: string;
};

const TableCheckboxGroup = ({ information, setInformation, itemKey, options, idPrefix }: Props) => {
    const currentValues = information[itemKey]?.split(',').filter(Boolean) ?? [];

    return (
        <div className="d-flex flex-wrap">
            {options.map((item, index) => {
                const elementId = `${idPrefix}_${index}`;
                const isChecked = currentValues.includes(item);

                return (
                    <div key={item} className="form-check me-2" style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            value={item} 
                            id={elementId} 
                            checked={isChecked}
                            onChange={(e) => {
                                const { checked, value } = e.target;
                                setInformation(prev => {
                                    const current = prev[itemKey]?.split(',').filter(Boolean) ?? [];
                                    const updated = checked ? [...new Set([...current, value])] : current.filter(v => v !== value);
                                    return {
                                        ...prev,
                                        [itemKey]: updated.join(',')
                                    };
                                });
                            }} 
                        />
                        <label className="form-check-label" htmlFor={elementId}>
                            {item}
                        </label>
                    </div>
                );
            })}
        </div>
    );
};

export default memo(TableCheckboxGroup, (prevProps, nextProps) => {
    return prevProps.information[prevProps.itemKey] === nextProps.information[nextProps.itemKey];
});