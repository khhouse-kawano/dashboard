import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from 'axios';
import Table from "react-bootstrap/Table";

interface CampaignListProps {
    activeTab: string | null;
}
type FormList = { registered_date: string; brand: string; url: string; tag: string; campaign: string; campaign_id: string };
type Shop = { brand: string; shop: string; section: string; area: string; }

const CampaignList: React.FC<CampaignListProps> = ({ }) => {
    const [formList, setFormList] = useState<FormList[]>([]);
    const [brandValue, setBrandValue] = useState<string>('');
    const navigate = useNavigate();
    const brandArray = ['kh', 'djh', 'nagomi', '2l', 'fh', 'pg', 'jh']
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const brandParam = queryParams.get('brand');

    useEffect(() => {
        if(brandParam) setBrandValue(brandParam);
    }, [])
    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = { Authorization: 'form_list', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/api/", { brand: brandValue }, { headers });
                await setFormList(response.data.data ?? []);
            } catch (error) {

            }
        };
        fetchData();
    }, [brandValue])

    const editForm = async (brand: string, id: string) => {
        navigate(`/editcampaign?brand=${brand}&id=${id}`);
    };

    const createForm = async (brandValue: string) => {
        navigate(`/editcampaign?brand=${brandValue}`);
    }
    return (

        <div className="bg-light p-3 w-100">{!brandValue ?
            <div className="bg-white" style={{ width: '90%', maxWidth: '1120px', margin: '0 auto', paddingBottom: '200px' }}>
                <div className="row pt-5 px-3 d-flex align-items-center">
                    <div className="text-center pb-5">ブランドを選択してください</div>
                    {brandArray.map(item =>
                        <div className="col hover" style={{ cursor: 'pointer' }} onClick={() => setBrandValue(item)}>
                            <img src={`https://khg-marketing.info/dashboard/form/img/${item}.png`} className="w-100" />
                        </div>)}
                </div>
            </div>
            : <>
                <div className='bg-light w-100 row' style={{ position: 'fixed', bottom: '0', height: '130px', zIndex: '100' }}>
                    <div className="col"></div>
                    <div className="p-3 rounded-pill hover col" style={{ margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'blue', color: '#fff' }} onClick={() => createForm(brandValue)}>新たにキャンペーンを作成</div>
                    <div className="col"></div>
                    <div className="p-3 rounded-pill hover col" style={{ margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'red', color: '#fff' }} onClick={() => setBrandValue('')}>ブランド選択に戻る</div>
                    <div className="col"></div>
                </div>
                <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', paddingBottom: '200px' }}>
                    <div className="pt-3" style={{ width: '200px', margin: '0 auto' }}>
                        <img src={`https://khg-marketing.info/dashboard/form/img/${brandValue}.png`} className="w-100" />
                    </div>
                    {formList.length === 0 ||
                    <><div className="w-100 pt-3" style={{ fontSize: '15px', textAlign: 'center', marginBottom: '10px' }}>キャンペーン一覧</div>
                    <Table>
                        <thead>
                            <tr style={{ fontSize: '11px' }}>
                                <td>登録日</td>
                                <td style={{ minWidth: '100px' }}>キャンペーン名</td>
                                <td>フォームURL</td>
                                <td style={{ width: '50%' }}>埋め込みタグ</td>
                                <td style={{ width: '90px' }}></td>
                            </tr>
                        </thead>
                        <tbody>
                            {formList.map((item, index) => (
                                <tr key={index} style={{ fontSize: '12px' }}>
                                    <td style={{ verticalAlign: 'middle' }}>{item.registered_date}</td>
                                    <td style={{ verticalAlign: 'middle' }}>{item.campaign}</td>
                                    <td style={{ verticalAlign: 'middle' }}><a href={item.url} target="_blank">{item.url}</a></td>
                                    <td style={{ verticalAlign: 'middle' }}><textarea value={item.tag} style={{ width: '100%', border: '1px solid #D3D3D3', borderRadius: '5px' }} rows={4} onFocus={(e) => { e.target.select() }}></textarea></td>
                                    <td style={{ verticalAlign: 'middle' }}><button style={{ backgroundColor: 'red', color: '#fff', border: 'none', borderRadius: '10px', padding: '2px 15px' }} className="hover"
                                        onClick={() => editForm(item.brand, item.campaign_id)}>修正</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table></>}
                </div></>}
        </div>)
}

export default CampaignList