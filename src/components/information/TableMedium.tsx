import React, { memo } from 'react';
import { inputStyle } from '../../utils/informationUtils';
import { safeFormate } from '../../utils/informationUtils';
import { labelStyle } from '../../utils/informationUtils';

type Medium = { id: number; medium: string, list_medium: number };

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    setShowDetail: React.Dispatch<React.SetStateAction<string>>,
    mediumArray: Medium[]
}

const TableMedium = ({ information, setInformation, idMapping, setShowDetail, mediumArray }: Props) => {
    return (
        <>
            <div className="d-flex align-items-center">
                <select style={inputStyle} value={safeFormate(information[idMapping('反響媒体')])}
                    onChange={(e) => {
                        setInformation(prev => (
                            {
                                ...prev,
                                [idMapping('反響媒体')]: e.target.value
                            }
                        ));
                        if (e.target.value === '紹介') setShowDetail('medium');
                        if (e.target.value === 'イベント') setShowDetail('event');
                    }}>
                    <option value=''>反響媒体を選択</option>
                    {mediumArray.filter(item => item.list_medium === 1 && !/(Amazonギフトカード|HOTLEAD|アポラック|システム利用料)/.test(item.medium)).map((item, index) =>
                        <option key={index} value={item.medium}>{item.medium}</option>
                    )}
                    <option value='イベント'>イベント</option>
                </select>
                {(information[idMapping('反響媒体')] === '紹介' && information.introduction_person_category)
                    ? <div className="ms-2">紹介者:{safeFormate(information.introduction_person_category)}</div> :
                    (information[idMapping('反響媒体')] === '紹介' && !information.introduction_person_category) ?
                        <div className="bg-primary text-white py-1 px-2 rounded" style={{ ...labelStyle, width: 'fit-content', cursor: 'pointer' }}
                            onClick={() => setShowDetail('medium')}>紹介者を入力</div> : ''}
                {(information[idMapping('反響媒体')] === 'イベント' && information.customized_input_01JRCT12N9X24PCQ5QZPAYKB93)
                    ? <div className="ms-2">イベント名:{safeFormate(information.customized_input_01JRCT12N9X24PCQ5QZPAYKB93)}</div> :
                    (information[idMapping('反響媒体')] === 'イベント' && !information.customized_input_01JRCT12N9X24PCQ5QZPAYKB93) ?
                        <div className="bg-primary text-white py-1 px-2 rounded" style={{ ...labelStyle, width: 'fit-content', cursor: 'pointer' }}
                            onClick={() => setShowDetail('event')}>イベント名を入力</div> : ''}
            </div></>
    )
}

export default memo(TableMedium, (prevProps, nextProps) => {
    // 1. idMappingを使って、対象となるキー名を取得
    const mediumKey = prevProps.idMapping('反響媒体');

    // 2. このコンポーネントの表示・条件分岐に直接関係する information のキーだけを監視する
    const fieldsToCheck = [
        mediumKey,                                      // 反響媒体の値
        'introduction_person_category',                 // 紹介者
        'customized_input_01JRCT12N9X24PCQ5QZPAYKB93'   // イベント名
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }
    if (prevProps.mediumArray.length !== nextProps.mediumArray.length) return false;

    return true;
});