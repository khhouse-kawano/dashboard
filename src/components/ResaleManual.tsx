import React, { useEffect, useState, useContext } from 'react';
import MenuDev from "./MenuDev";
import AuthContext from '../context/AuthContext';
import { useNavigate } from "react-router-dom";
import RankImg from '../assets/images/rankImg.png';
import mediumImg from '../assets/images/mediumImg.png';
import logImg from '../assets/images/logImg.png';
import interviewImg from '../assets/images/interviewImg.png';
import contractImg from '../assets/images/contractImg.png';
import summaryImg from '../assets/images/summaryImg.png';
import summaryImg2 from '../assets/images/summaryImg2.png';

const ResaleManual = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!brand || !token || !category) navigate("/login");
    }, []);


    return (
        <>
            <div className='outer-container'>
                <div className="d-flex">
                    <div className="modal_menu">
                        <MenuDev brand={brand} />
                    </div>
                    <div className="header_sp">
                        <i
                            className="fa-solid fa-bars hamburger"
                            onClick={() => setOpen(true)}
                        />
                    </div>
                    <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                        <i
                            className="fa-solid fa-xmark hamburger position-absolute"
                            onClick={() => setOpen(false)}
                        />
                        <MenuDev brand={brand} />
                    </div>
                    <div className='bg-white p-2' style={{ overflowY: 'scroll', height: '100vh' }}>
                        <div style={{ lineHeight: '30px' }}>
                            <div className="mb-4">
                                <div className="h2 mb-2">いえらぶクラウド入力マニュアル</div>
                                <div className="p">以下にDashboardを運用するうえで必要な情報、作業方法、いえらぶクラウドへの入力方法を説明します。</div>
                            </div>
                            <div className="mb-4">
                                <div className="h4 mb-2">目次</div>
                                <div className="ul">
                                    <ul>
                                        <li><a href="#nav1">ランク</a></li>
                                        <li><a href="#nav2">反響元</a></li>
                                        <li><a href="#nav3">応対履歴</a></li>
                                        <li><a href="#nav4">初回面談</a></li>
                                        <li><a href="#nav5">契約</a></li>
                                        <li><a href="#nav6">予実サマリー</a></li>
                                    </ul>
                                </div>
                            </div>
                            <div className="my-5" id='nav1'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">ランク</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">各自の案件を把握するうえで、今後は以下の各ランクをもとに確認します。<br />応対するたび常に最新のステータスにしておくことで、正確な見込みを把握できます。</div>
                                <ul>
                                    <li>Aランク・・・今月契約予定。入金日、契約日が確定している顧客。</li>
                                    <li>Bランク・・・今月契約見込み。確度が高い顧客。</li>
                                    <li>Cランク・・・今月契約見込み。勝負案件。</li>
                                    <li>Dランク・・・継続追客中の顧客。</li>
                                    <li>Eランク・・・長期管理顧客。</li>
                                </ul>
                                <div className="w-75"><img src={RankImg} className='w-100' /></div>
                            </div>

                            <div className="my-5" id='nav2'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">反響元</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">最適な広告配信及び、正確な反響単価を測るために各顧客の反響元を必ず入力してください。
                                </div>
                                <div className="w-75"><img src={mediumImg} className='w-100' /></div>
                            </div>

                            <div className="my-5" id='nav3'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">応対履歴</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">行動量、案件の進捗状況の把握のために何かしらのアクションを起こすたびに入力する癖をつけてください。対応中はこちらのページを常に開いておくような習慣づけをすること。<br />
                                    特に以下の項目が進捗状況を把握するうえで重要ですので、応対するたびに常に最新のステータスにしておくように心掛けてください。
                                </div>
                                <ul>
                                    <li>査定更新・・・「顧客(売)」の場合、査定をするたびにこのステータスで更新する。</li>
                                    <li>媒介取得・・・「顧客(売)」の場合、媒介取得のタイミングでこのステータスに更新する。</li>
                                    <li>来店・来場・・・第三者が見てもわかるように、短く簡潔に面談内容のメモを記入。</li>
                                </ul>
                                <div className="w-75"><img src={logImg} className='w-100' /></div>
                            </div>

                            <div className="my-5" id='nav4'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">初回面談</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">KPI測定をするうえで最も重要な指標のひとつとなります。初めて来場されるお客様について、契約への温度差がどうあれ必ず入力すること。<br />
                                    極めて確度の低い、「ものもらい」のような顧客であっても必ず入力してください。広告の最適化のために、顧客と実際に接触できたか否かは大変重要な指標となります。
                                </div>
                                <div className="w-75"><img src={interviewImg} className='w-100' /></div>
                            </div>

                            <div className="my-5" id='nav5'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">契約</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">契約に至った場合、顧客種別にかかわらず「売買契約」の項目に「契約日」を入力すること。Dashboardにはこちらに入力された日付で計上されるので正しく入力してください。
                                </div>
                                <div className="w-75"><img src={contractImg} className='w-100' /></div>
                            </div>

                            <div className="my-5" id='nav6'>
                                <div className="d-flex align-items-center">
                                    <div className="h4 mb-2">予実サマリー</div>
                                    <div className="p text-danger fw-bold ms-1">※入力必須</div>
                                </div>
                                <div className="p mb-2">いえらぶクラウドで契約日が入力された顧客、予実サマリーの画面に反映されます。<br />
                                    こちらの画面で契約実績を入力してください。
                                </div>
                                <div className="w-75 mb-2"><img src={summaryImg} className='w-100' /></div>
                                <div className="p mb-2">また見込み顧客についても必ず入力すること。当月の見込み額を把握するうえで重要になります。
                                </div>
                                <div className="w-75 mb-2"><img src={summaryImg2} className='w-100' /></div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default ResaleManual