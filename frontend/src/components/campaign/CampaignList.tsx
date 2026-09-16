import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchList, CampaignListRow } from './campaignApi';
import { CAMPAIGN_BRANDS, brandLogo } from './brands';
import Table from "react-bootstrap/Table";

interface CampaignListProps {
    activeTab: string | null;
}

const CampaignList: React.FC<CampaignListProps> = () => {
    const [formList, setFormList] = useState<CampaignListRow[]>([]);
    const [brandValue, setBrandValue] = useState<string>('');
    /** ⚠️ 取得に失敗したことを画面に出すため。空なら問題なし */
    const [loadError, setLoadError] = useState<string>('');
    const navigate = useNavigate();

    useEffect(() => {
        /**
         * ⚠️⚠️ **ブランド未選択のうちは叩かない。**
         *   ⚠️ 以前は `brand: ''` で毎回1回リクエストしていた（必ず0件が返るだけ）。
         */
        if (!brandValue) {
            setFormList([]);
            setLoadError('');
            return;
        }

        const fetchData = async () => {
            setLoadError('');
            try {
                const response = await fetchList(brandValue);
                setFormList(response.data ?? []);
            } catch (error) {
                /**
                 * ⚠️⚠️ **握りつぶさない。**
                 *   ⚠️ 以前は `catch (error) { }` で**何もしていなかった**。
                 *     通信に失敗しても一覧が空で表示されるだけなので、
                 *     ⚠️ 「キャンペーンが1件も無い」のと**見分けがつかなかった**。
                 */
                console.error('キャンペーン一覧の取得に失敗:', error);
                setLoadError('キャンペーン一覧を取得できませんでした。');
                setFormList([]);
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
                <div className="row pt-5 px-3">
                    <div className="text-center pb-5 fw-bold">ブランドを選択してください</div>
                    <div className="d-flex align-items-center flex-wrap justify-content-center">
                        {CAMPAIGN_BRANDS.map(item =>
                            <div key={item} className="hover" style={{ cursor: 'pointer', width: '15%', margin: '3%' }} onClick={() => setBrandValue(item)} >
                                <img src={brandLogo(item)} alt={item} className="w-100" />
                            </div>)}
                    </div>
                </div>
            </div>
            : <>
                <div className='bg-light w-75 row' style={{ position: 'fixed', bottom: '0', height: '130px', zIndex: '100' }}>
                    <div className="col"></div>
                    <div className="p-3 rounded-pill hover col" style={{ margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'blue', color: '#fff' }} onClick={() => createForm(brandValue)}>新たにキャンペーンを作成</div>
                    <div className="col"></div>
                    <div className="p-3 rounded-pill hover col" style={{ margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'red', color: '#fff' }} onClick={() => setBrandValue('')}>ブランド選択に戻る</div>
                    <div className="col"></div>
                </div>
                <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', paddingBottom: '200px' }}>
                    <div className="pt-3" style={{ width: '200px', margin: '0 auto' }}>
                        <img src={brandLogo(brandValue)} alt={brandValue} className="w-100" />
                    </div>
                    {/**
                      * ⚠️⚠️ **取得に失敗したことを必ず画面に出す。**
                      *   ⚠️ 以前は失敗しても一覧が空になるだけで、
                      *     「1件も無い」のと**見分けがつかなかった**。
                      */}
                    {!loadError ||
                        <div className="w-100 pt-4 text-center" style={{ fontSize: '14px', color: 'red' }}>
                            {loadError}<br />
                            <span style={{ fontSize: '12px', color: '#666' }}>時間をおいて再読み込みしてください。</span>
                        </div>}

                    {/* ⚠️ 0件のときも黙らない。登録が無いのか失敗なのかを分ける */}
                    {loadError || formList.length > 0 ||
                        <div className="w-100 pt-4 text-center" style={{ fontSize: '14px', color: '#666' }}>
                            このブランドのキャンペーンはまだありません。
                        </div>}

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
                                            <td style={{ verticalAlign: 'middle' }}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a></td>
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