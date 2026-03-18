import React, { useState, useContext } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import MenuDev from "./MenuDev";
import Img1 from '../assets/images/kengakuImg1.png';
import Img2 from '../assets/images/kengakuImg2.png';
import Img3 from '../assets/images/kengakuImg3.png';
import Img4 from '../assets/images/kengakuImg4.png';
import Img5 from '../assets/images/kengakuImg5.png';
import Img6 from '../assets/images/kengakuImg6.png';
import Img7 from '../assets/images/kengakuImg7.png';
import Img8 from '../assets/images/kengakuImg8.png';
import Img9 from '../assets/images/kengakuImg9.png';
import Img10 from '../assets/images/kengakuImg10.png';

const KengakuCloud = () => {
    const { brand } = useContext(AuthContext);
    const [open, setOpen] = useState(false);

    const ttlStyle = {
        color: 'blue',
        fontWeight: '700',
        textDecoration: 'underline',
        fontSize: '16px',
        letterSpacing: '1px',
        cursor: 'pointer',
        marginBottom: '20px'
    };

    const ttlFont = {
        textDecoration: 'underline',
    };
    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}>
                    <MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i className="fa-solid fa-bars hamburger"
                        onClick={() => setOpen(true)} />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i className="fa-solid fa-xmark hamburger position-absolute"
                        onClick={() => setOpen(false)} />
                    <MenuDev brand={brand} />
                </div>
                <div className='content database bg-white p-2'>
                    <div className="m-2">
                        <img src="https://kengakucloud.jp/cms/wp-content/themes/KengakuCloud2024/images/common/header_logo.svg" alt="" />
                    </div>
                    <div className="m-2">
                        <div style={ttlStyle} onClick={()=>{
                            const id = document.getElementById('#1');
                            id?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                        }}>1.イベントを作成する</div>
                        <div style={ttlStyle} onClick={()=>{
                            const id = document.getElementById('#2');
                            id?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                        }}>2.予約フォームの設定</div>
                    </div>

                    <div id='#1' className='m-2 p-2 rounded' style={{ fontSize: '13px', letterSpacing: '1px', backgroundColor: '#f1f1f1' }}>
                        <div style={ttlFont} className='py-2 fw-bold'>1.イベントを作成する</div>
                        <ul style={{ lineHeight: '30px' }}>
                            <li><a href="https://www.ie-miru.jp/staff/sign_in?utm_source=servicesite&utm_medium=link&utm_campaign=servicesite-login&utm_content=login" target='_blank'>管理画面</a>でログイン。</li>
                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        「イベント」にポインターを合わせると新たにメニューが表示されるので、「AIアシストで作成」「自分で作成」のいずれかをクリック。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img1} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        「イベント名」「イベントの種類」「イベントの開催形式」の必須項目を入力。<span className='text-danger'>イベントの開催形式については原則「予約制」を選択する。</span><br />
                                        餅まき等、地域貢献や不特定多数との関係性を築くようなイベントの場合は「オープン」でも可。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img2} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        次の画面でも必要事項を入力。<span className='text-danger'>「開催日の設定」</span>については最初未設定のため、忘れないように入力する。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img4} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        「共用カレンダー」の設定は<span className='text-danger'>不要。</span>
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img3} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        「開催場所」の設定は要注意。<span className='text-danger'>完成見学会などの場合は「マップの微調整」機能を使って広域エリアでサークルにするか、非公開に設定する。</span><br />
                                        店舗やモデルハウスでのイベントについては、必ず正確な位置にピンを立てるように設定する。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img5} className='w-100' /></div>
                                </div>
                            </li>

                            <li>ページのコンテンツ制作については割愛します。<br />
                                <span className='text-danger'>きれいなデザインのテンプレやCanvaとの連携が可能なため、ビズクリエイション社の支援を参考に</span>ページ作りの工夫をしてみてください。
                                <br />ページ作りにおける疑問があれば、川野まで個別にご相談ください。</li>
                        </ul>
                    </div>

                    <div id='#2' className='m-2 p-2 rounded' style={{ fontSize: '13px', letterSpacing: '1px', backgroundColor: '#f1f1f1' }}>
                        <div style={ttlFont} className='py-2 fw-bold'>2.予約フォームの設定</div>
                        <ul style={{ lineHeight: '30px' }}>
                            <li>予約フォームについてはPGクラウドやDashboardとの連携のため、原則以下の設定にしてください。</li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        全ての項目に✓が入っていることを確認して、<span className='text-danger'>「質問を追加」</span>をクリック。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img6} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        <span className='text-danger'>「ご年齢」「ご予約のきっかけ」「【来場予約特典条件】」</span>をクリックして質問に追加して<span className='text-danger'>「必須項目」にもチェックを入れる。</span>
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img7} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        最終的にこのような形になればOK。<br />
                                        <span className='text-danger'>「ご年齢」「ご予約のきっかけ」が追加されて「必須項目」にチェックが入っていることを確認して「保存する」</span>をクリック。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img8} className='w-100' /></div>
                                </div>
                            </li>

                            <li>最後に改めて完成したページを確認して<span className='text-danger'>「店舗＋広報」のLINEグループへご連絡ください。</span>
                                <br />必要に応じて広告配信の設定等必要なので、準備出来次第速やかに公開します。</li>
                            {/* <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        詳細設定での各項目の変更は不要。<br />
                                        <span className='text-danger'>そのまま「公開設定を進む」</span>をクリック。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img9} className='w-100' /></div>
                                </div>
                            </li>

                            <li>
                                <div className="d-md-flex my-5">
                                    <div style={{ width: '350px' }} className='me-md-2'>
                                        基本的には<span className='text-danger'>「公開」を選択、「埋込先HPへ公開する」「iemiruへ公開する」グループHPにチェックが入った状態で「公開」</span>をクリック。<br/>
                                        案内したお客様限定のイベント等では、「限定公開」にする。
                                    </div>
                                    <div style={{ width: '350px' }}><img src={Img10} className='w-100' /></div>
                                </div>
                            </li> */}
                        </ul>
                    </div>
                </div>
            </div>
        </div >)
}

export default KengakuCloud