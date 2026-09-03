import TopPc from '../assets/images/topImg.webp';
import TopSp from '../assets/images/topImgSp.webp';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE, API_HEADERS } from '../config';

type Props = {
    customerData: Record<string, string>
};

const Top = ({ customerData }: Props) => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showLogin, setShowLogin] = useState(false);
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (customerData.id) {
            navigate(`/?page=tag&id=${customerData.id}`, { replace: true });
        }
    }, [customerData.id]);

    const [password, setPassword] = useState(['', '', '', '']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, value: string) => {
        // 全角英数字を半角英数字に変換
        const halfWidthValue = value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });

        // 変換後の最後の1文字を取得
        const newValue = halfWidthValue.slice(-1);

        // (オプション) 数字以外を入力させたくない場合は、以下のコメントアウトを外してください
        // if (newValue !== '' && !/^[0-9]+$/.test(newValue)) return;

        const newPassword = [...password];
        newPassword[index] = newValue;
        setPassword(newPassword);

        if (newValue !== '' && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Backspace') {
            if (password[index] === '' && index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handleLoginSubmit = () => {
        const fullPassword = password.join('');
        const fetchData = async () => {
            try {
                const postData = {
                    pass: fullPassword,
                    request: 'k-snap_login'
                };
                const response = await axios.post(API_BASE, postData, { headers: API_HEADERS });
                if (response.data.status === 'success') {
                    const dashboardId = response.data.id;
                    navigate(`/?page=tag&id=${dashboardId}`, { state: { fromTop: true, replace: true } })
                } else if (response.data.status === 'not_found') {
                    alert('パスワードが違います！');
                    setPassword(['', '', '', '']);
                    return;
                } else {
                    alert('もう一度入力してください！');
                    return;
                }
            } catch (err) {
                console.error(err);
                alert('もう一度入力してください！')
            }
        };

        fetchData();
    };

    return (
        <>
            <div style={{ width: '100vw', height: '100vh' }}>
                <img
                    src={isMobile ? TopSp : TopPc}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    alt="K-Snap Top"
                />
            </div>

            {isMobile ? (
                <div
                    className="d-flex flex-column align-items-center"
                    style={{ position: 'fixed', bottom: '3vw', width: '100%', gap: '15px' }}
                >
                    <div
                        className="bg-white rounded-pill py-2 text-center"
                        style={{ width: '70%', maxWidth: '300px', boxShadow: "0px 5px 15px 0px #7c7c7c59", fontWeight: '300', cursor: 'pointer' }}
                        onClick={() => navigate('/?page=tag', { state: { fromTop: true, replace: true } })}
                    >
                        スタート
                    </div>
                    <div
                        className="bg-white rounded-pill py-2 text-center"
                        style={{ width: '70%', maxWidth: '300px', boxShadow: "0px 5px 15px 0px #7c7c7c59", fontWeight: '300', cursor: 'pointer' }}
                        onClick={() => setShowLogin(true)}
                    >
                        ログイン
                    </div>
                </div>
            ) : (
                <div
                    className="d-flex justify-content-around"
                    style={{ position: 'fixed', bottom: '40px', width: '560px', left: 'calc(50% - 280px)' }}
                >
                    <div
                        className="bg-white px-5 rounded-pill py-1 text-center"
                        style={{ boxShadow: "0px 5px 15px 0px #7c7c7c59", fontWeight: '300', cursor: 'pointer' }}
                        onClick={() => navigate('/?page=tag', { state: { fromTop: true, replace: true } })}
                    >
                        スタート
                    </div>
                    <div
                        className="bg-white px-5 rounded-pill py-1 text-center"
                        style={{ boxShadow: "0px 5px 15px 0px #7c7c7c59", fontWeight: '300', cursor: 'pointer' }}
                        onClick={() => setShowLogin(true)}
                    >
                        ログイン
                    </div>
                </div>
            )}
            <Modal show={showLogin} onHide={() => setShowLogin(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="w-100 text-center fw-bold">ログイン</Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4 pb-5 pt-3">
                    <p className="text-center text-muted mb-4" style={{ fontSize: '0.9rem' }}>
                        4桁のパスワードを入力してください
                    </p>

                    <div className="d-flex justify-content-center gap-3 mb-4">
                        {password.map((digit, index) => (
                            <Form.Control
                                key={index}
                                ref={(el: HTMLInputElement | null) => { inputRefs.current[index] = el; }}
                                type="text"             // 💡 "password" から "text" に変更
                                maxLength={1}          // 💡 1文字制限は保持
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="text-center fw-bold"
                                style={{
                                    width: '55px',
                                    height: '65px',
                                    fontSize: '28px',
                                    borderRadius: '12px',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            />
                        ))}
                    </div>

                    <div className="text-center mt-4">
                        <Button
                            variant="dark"
                            className="rounded-pill px-5 py-2"
                            onClick={handleLoginSubmit}
                            disabled={password.join('').length < 4}
                        >
                            ログインする
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default Top;