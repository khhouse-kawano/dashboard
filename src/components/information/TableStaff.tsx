import React, { memo } from 'react';
import { selectStyle } from '../../utils/informationUtils';
import { safeFormate } from '../../utils/informationUtils';

type Staff = { name: string; shop: string; category: number, section: string, period: string };

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    staffArray: Staff[],
    setShowDetail: React.Dispatch<React.SetStateAction<string>>,
    id: string
}

const TableStaff = ({ information, setInformation, idMapping, staffArray, setShowDetail, id }: Props) => {
    return (
        <>
            <div className="d-flex align-items-center">
                <select
                    style={selectStyle}
                    value={safeFormate(information[idMapping('担当営業')])}
                    onChange={(e) => {
                        const newStaff = e.target.value;
                        const listedCustomer = `${information.in_charge_store} 管理`;

                        const selected = staffArray.find(item => item.name === newStaff);
                        const nextStaffName = selected?.name || newStaff;

                        setInformation(prev => ({
                            ...prev,
                            [idMapping('担当営業')]: nextStaffName,
                            first_interviewed_user: id !== 'new' ? safeFormate(prev[idMapping('担当営業')]) : ''
                        }));

                        if (newStaff === listedCustomer && id !== 'new') {
                            setShowDetail('staff');
                        }
                    }}
                >
                    <option value=''>担当営業を選択</option>
                    {staffArray
                        .filter(item => item.shop === information.in_charge_store)
                        .map((item, index) => (
                            <option key={index} value={item.name}>
                                {item.name}
                            </option>
                        ))}
                    <option value={`${information.in_charge_store} 管理`}>{information.in_charge_store} 管理</option>
                </select>

                {(information[idMapping('担当営業')] === `${information.in_charge_store} 管理` && information.first_interviewed_user)
                    && <div className="ms-2">変更前:{safeFormate(information.first_interviewed_user)}({safeFormate(information.last_action_step_migration_item_name)})</div>}
            </div></>
    )
}

export default memo(TableStaff, (prevProps, nextProps) => {
    const staffKey = prevProps.idMapping('担当営業');

    const fieldsToCheck = [
        staffKey,
        'in_charge_store',
        'first_interviewed_user',
        'last_action_step_migration_item_name'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.staffArray !== nextProps.staffArray) return false;
    if (prevProps.id !== nextProps.id) return false;


    return true;
});