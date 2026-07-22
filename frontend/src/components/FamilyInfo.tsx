import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { headers } from '../utils/headers';
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";

type Props = {
    idValue: string,
    shopValue: string,
    nameValue: string,
    modalClose: () => void;
};

type Info = {
    relation: string,
    name: string,
    kana: string,
    birth: string,
    mail: string,
    mobile: string,
    employmentType: string,
    employer: string,
    employmentYears: string
}

type Family = {
    id: string,
    shop: string,
    name: string,
    family_info: string
}

const FamilyInfo = ({ idValue, shopValue, nameValue, modalClose }: Props) => {
    const [family, setFamily] = useState<Family>({
        id: idValue,
        shop: '',
        name: '',
        family_info: ''
    });

    const [familyMember, setFamilyMember] = useState<Info[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "show_family_info", id: idValue }, { headers });

            await setFamily(response.data);
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!family || !family.family_info) return;
        const parsedFamilyMember = JSON.parse(family.family_info);
        setFamilyMember(parsedFamilyMember);
    }, [family]);

    useEffect(() => {

    }, []);

    const reloadFamilyMember = (targetIndex: number, key: string, value: string) => {
        if (key === 'delete') {
            setFamilyMember(prev =>
                prev.filter((_, i) => i !== targetIndex)
            );
        } else {
            setFamilyMember(prev =>
                prev.map((item, index) =>
                    targetIndex === index ?
                        {
                            ...item,
                            [key]: value
                        } : item
                )
            );
        }
    };

    const addFamily = () => {
        setFamilyMember([...familyMember,
        { relation: '', name: '', kana: '', birth: '', mail: '', mobile: '', employmentType: '', employer: '', employmentYears: '' }])
    };

    const isSave = familyMember.length > 0 && familyMember.every(item => item.name) && familyMember.every(item => item.relation);

    const handleSave = () => {
        if (familyMember.length === 0) return;
        const postData = {
            id: idValue,
            shop: shopValue,
            name: nameValue,
            family_info: familyMember,
            demand: 'update_family_info'
        };

        console.log(postData)
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
            await setFamily(response.data);
        };
        fetchData();

        clearFamily();
    };

    const clearFamily = () => {
        setFamilyMember([]);
        modalClose();
    };

    return (
        <>
            <Modal.Header closeButton>家族情報</Modal.Header>
            <Modal.Body>
                <div className="d-flex flex-wrap">
                    {familyMember.map((f, fIndex) => <div style={{ width: '48%', margin: '1%' }}>
                        <Table bordered striped >
                            <tbody style={{ fontSize: '12px' }} className='align-middle'>
                                <tr>
                                    <td>続柄</td>
                                    <td><select className='target' onChange={(e) => reloadFamilyMember(fIndex, 'relation', e.target.value)}>
                                        <option value=''>続柄を選択</option>
                                        {['配偶者', '息子', '娘', '父', '母', '孫息子', '孫娘', 'その他'].map((item, index) =>
                                            <option key={index} selected={f.relation === item}>{item}</option>)}</select></td>
                                </tr>
                                <tr>
                                    <td>名前</td>
                                    <td><input type='text' value={f.name} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'name', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>ふりがな</td>
                                    <td><input type='text' value={f.kana} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'kana', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>生年月日</td>
                                    <td><input type='date' value={f.birth} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'birth', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>メールアドレス</td>
                                    <td><input type='text' value={f.mail} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'mail', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>電話番号</td>
                                    <td><input type='text' value={f.mobile} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'mobile', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>雇用形態</td>
                                    <td><select className='target' onChange={(e) => reloadFamilyMember(fIndex, 'employment', e.target.value)}>
                                        <option value=''>雇用形態を選択</option>
                                        {['経営者', '正社員', '契約社員', 'パート・アルバイト', '派遣社員', '専業主婦'].map((item, index) =>
                                            <option key={index} selected={f.employmentType === item}>{item}</option>)}</select></td>
                                </tr>
                                <tr>
                                    <td>勤務先</td>
                                    <td><input type='text' value={f.employer} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'employer', e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td>勤続年数</td>
                                    <td><input type='text' value={f.employmentYears} className='target'
                                        onChange={(e) => reloadFamilyMember(fIndex, 'employmentYears', e.target.value)} /></td>
                                </tr>
                            </tbody>
                        </Table>
                        <div className="bg-secondary text-white px-3 py-1 rounded" style={{ width: 'fit-content', fontSize: '12px', margin: `${familyMember.length > 0 ? '20px' : '30px'} auto`, cursor: 'pointer' }}
                            onClick={(e) => reloadFamilyMember(fIndex, 'delete', '')}>削除</div>
                    </div>
                    )}
                </div>
                <div className="bg-danger text-white px-3 py-1 rounded" style={{ width: 'fit-content', fontSize: '12px', margin: `${familyMember.length > 0 ? '20px' : '30px'} auto`, cursor: 'pointer' }}
                    onClick={() => addFamily()}>追加</div>
            </Modal.Body >
            <Modal.Footer>
                <div className="d-flex" style={{ fontSize: '12px' }}>
                    <div className="bg-primary text-white px-3 py-1 rounded me-2" style={{ width: 'fit-content', opacity: isSave ? '1' : '.5', cursor: isSave ? 'pointer' : '' }}
                        onClick={() => isSave ? handleSave() : null}>保存</div>
                    <div className="bg-secondary text-white px-3 py-1 rounded" style={{ width: 'fit-content', cursor: 'pointer' }}
                        onClick={() => clearFamily()}>閉じる</div>
                </div>
            </Modal.Footer>
        </>
    )
}

export default FamilyInfo