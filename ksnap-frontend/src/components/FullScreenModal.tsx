import { useRef, useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { IMAGE_BASE_URL } from '../config';

type Props = {
    fullImg: string,
    setFullImg: React.Dispatch<React.SetStateAction<string>>,
}

export const FullScreenModal = ({ fullImg, setFullImg }: Props) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [spImgStyle, setSpImgStyle] = useState<{ width?: string; height?: string }>({});
    const [isSp, setIsSp] = useState<boolean>(window.innerWidth <= 768);

    // スワイプ（スクロール）可能であることを伝えるヒントの表示状態
    const [showScrollHint, setShowScrollHint] = useState<boolean>(false);

    useEffect(() => {
        const handleResize = () => {
            setIsSp(window.innerWidth <= 768);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleClose = () => {
        setFullImg('');
        setSpImgStyle({});
        setShowScrollHint(false);
    };

    return (
        <>
            <Modal fullscreen show={!!fullImg} onHide={handleClose}>
                <Modal.Body style={{ padding: 0 }}>

                    {/* =======================================
                        1. 画像コンテナ（一番下に敷かれる要素）
                    ======================================= */}
                    <div
                        ref={scrollContainerRef}
                        onClick={() => {
                            if (!isSp) handleClose();
                        }}
                        onScroll={() => {
                            if (showScrollHint) setShowScrollHint(false);
                        }}
                        style={{
                            width: '100vw',
                            height: '100vh',
                            overflow: isSp ? 'auto' : 'hidden',
                            display: 'flex',
                            alignItems: isSp ? 'flex-start' : 'center',
                            justifyContent: isSp ? 'flex-start' : 'center',
                            backgroundColor: '#000',
                        }}
                    >
                        <img
                            src={`${IMAGE_BASE_URL}/${fullImg}`}
                            alt="全画面表示"
                            onLoad={(e) => {
                                if (!isSp) return;
                                const img = e.currentTarget;
                                const screenAspect = window.innerWidth / window.innerHeight;
                                const imgAspect = img.naturalWidth / img.naturalHeight;

                                if (imgAspect > screenAspect) {
                                    setSpImgStyle({ height: '100vh', width: 'auto' });
                                } else {
                                    setSpImgStyle({ width: '100vw', height: 'auto' });
                                }

                                setTimeout(() => {
                                    if (scrollContainerRef.current) {
                                        const container = scrollContainerRef.current;
                                        container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                                        container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;

                                        if (container.scrollWidth > container.clientWidth || container.scrollHeight > container.clientHeight) {
                                            setShowScrollHint(true);
                                            setTimeout(() => setShowScrollHint(false), 3500);
                                        }
                                    }
                                }, 50);
                            }}
                            style={isSp ? {
                                ...spImgStyle,
                                maxWidth: 'none',
                                maxHeight: 'none',
                                opacity: (spImgStyle.width || spImgStyle.height) ? 1 : 0,
                                transition: 'opacity 0.2s ease-in-out'
                            } : {
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                cursor: 'pointer'
                            }}
                        />
                    </div>

                    {isSp && (
                        <div
                            onClick={handleClose}
                            style={{
                                position: 'fixed',
                                top: '20px',
                                right: '20px',
                                zIndex: 9999, // 確実に出すために高めに設定
                                background: 'rgba(0, 0, 0, 0.6)',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '20px',
                                fontWeight: 'bold'
                            }}
                        >
                            ✕
                        </div>
                    )}

                    {/* スクロールヒント (スマホのみ) */}
                    {isSp && showScrollHint && (
                        <div style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: '#fff',
                            padding: '12px 24px',
                            borderRadius: '24px',
                            zIndex: 9999, // 画像の裏に回らないように設定
                            pointerEvents: 'none',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'opacity 0.3s ease-in-out',
                        }}>
                            スワイプで移動できます
                        </div>
                    )}

                    {/* 下部の閉じるボタン */}
                    {isSp && (
                        <div style={{
                            position: 'fixed',
                            zIndex: 9999, // 確実に出すために高めに設定
                            color: '#fff',
                            bottom: '3vh',
                            width: '100%',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                backgroundColor: '#00000062',
                                width: 'fit-content',
                                margin: '0 auto',
                                padding: '5px 14px',
                                borderRadius: '14px',
                                fontSize: '4vw',
                                letterSpacing: '1px'
                            }}
                                onClick={handleClose}>閉じる</div>
                        </div>
                    )}

                </Modal.Body>
            </Modal>
        </>
    )
}