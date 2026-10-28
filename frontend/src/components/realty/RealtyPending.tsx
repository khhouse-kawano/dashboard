import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { REALTY_CSS } from './common/realtyState';
import { pendingLabelOf } from './RealtyMenu';

/**
 * まだ移していない画面の案内（v2.2.225）。メニューの「移行中」の項目から開く（/realtyPending?view=…）。
 * ⚠️ 移し終えたら RealtyMenu.tsx の path を本物の画面に差し替える。
 */

/** 以前のアプリ（移すまではこちらを使う） */
const OLD_APP_URL = 'https://khf-eigyokanri.netlify.app/';

const RealtyPending: React.FC = () => {
    const [params] = useSearchParams();
    const label = pendingLabelOf(params.get('view') ?? '') || 'この画面';
    return (
        <div className="rlt-page">
            <style>{REALTY_CSS}</style>
            <div className="rlt-head"><h1><i className="fa-solid fa-person-digging me-2" style={{ color: '#0d6efd' }}></i>{label}</h1></div>
            <div className="rlt-card">
                <div className="rlt-body" style={{ paddingTop: 16, fontSize: 13 }}>
                    <p>「{label}」は、いま Dashboard へ移している途中です。移し終えるまでは、以前のアプリの同じ画面をお使いください。</p>
                    <a className="rlt-btn" href={OLD_APP_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}>
                        以前のアプリを開く <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default RealtyPending;
