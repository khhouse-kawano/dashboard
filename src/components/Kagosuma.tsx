import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';

const Kagosuma = () => {
  const [show, setShow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const urls = [
    'https://kagosma.jp/maker/kokubuhousing/',
    'https://kagosma.jp/maker/dayjusthouse/',
    'https://kagosma.jp/maker/nagomikoumuten/',
    'https://kagosma.jp/maker/2lhome/',
    'https://kagosma.jp/modelhouse/dayjusthouse-kagoshimakita-02/',
    'https://kagosma.jp/case/dayjusthouse-case23/',
    'https://kagosma.jp/modelhouse/kokubuhousing-satsumasendai2/',
    'https://kagosma.jp/modelhouse/nagomi-aira-nabekura/',
    'https://kagosma.jp/modelhouse/2lhome-hiroki/',
    'https://kagosma.jp/case/kokubuhousing-case40/',
    'https://kagosma.jp/case/nagomi-case05/',
    'https://tateruya.jp/miyazaki/maker/kokubuhousing/',
    'https://tateruya.jp/miyazaki/maker/dayjusthouse/',
    'https://tateruya.jp/miyazaki/modelhouse/kokubuhousing-miyazaki-2f-2/',
    'https://tateruya.jp/miyazaki/modelhouse/dayjusthouse-miyazaki-hiraya/',
    'https://tateruya.jp/miyazaki/case/kokubuhousing-case17/',
    'https://tateruya.jp/miyazaki/case/dayjusthouse-case11/',
    'https://tateruya.jp/oita/maker/kokubuhousing/',
    'https://tateruya.jp/oita/modelhouse/kokubuhousing-imatsuru-2f/',
    'https://tateruya.jp/oita/case/kokubuhousing-case09/',
    'https://tateruya.jp/kumamoto/maker/kokubuhousing/',
    'https://tateruya.jp/kumamoto/event/kokubuhousing-yatsushiro/',
    'https://tateruya.jp/kumamoto/maker/jusfyhome/',
    'https://tateruya.jp/saga/maker/kokubuhousing/',
  ];

  const handleClick = async () => {
    setShow(true);
    for (let i = 0; i < urls.length; i++) {
      setCurrentIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // 3秒ごとに切り替え
    }
    setShow(false);
  };

  const modalClose = () => {
    setShow(false);
  };

  return (
    <>
      <div
        className="bg-primary text-white rounded-pill p-3"
        style={{
          width: 'fit-content',
          letterSpacing: '1px',
          margin: '100px auto',
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        アクセススタート
      </div>

      <Modal show={show} onHide={modalClose} size="xl">
        <div style={{ height: '80vh', position: 'relative' }}>
          <div
            className="bg-primary text-white p-4 text-center rounded"
            style={{
              opacity: '.88',
              position: 'absolute',
              top: '30vh',
              width: '50vw',
              left: 'calc(50% - 25vw)',
              fontSize: 'min( 5vw, 20px )'
            }}
          >
            残り{urls.length - currentIndex}ページ /<br/> 全 {urls.length}ページ
          </div>
          {urls[currentIndex] ? (
            <iframe
              src={urls[currentIndex]}
              title="preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="text-center">読み込み中...</div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Kagosuma;
