import React from 'react';

/**
 * 建売営業（category = spec）のメニューの「土地仕入」（v2.2.311〜）。Menu.tsx が spec のときだけ、建売営業の項目の下に出す。
 *
 * ⚠️ 移行元は「仕入KPI管理 v7.3」（1ページのアプリ）。機能ごとに画面を分けた。
 * ⚠️ まだ移していない画面は「移行中」を付け、/landPending?view=… で移行元のアプリを案内する。移したら path を差し替える。
 * ⚠️ URL は1段にする（`/land/…` にしない。App.tsx の注記）。
 * ⚠️ 項目を足す・名前を変えたら guide/guideScreens.ts の GUIDE_SCREENS もそろえる。
 */
export type LandMenuItem = { id: string; path: string; icon: string; label: string; pending?: boolean };

export const LAND_MENU: LandMenuItem[] = [
    { id: 'landDashboard', path: '/landDashboard', icon: 'fa-chart-line', label: '仕入ダッシュボード' },
    { id: 'landDaily', path: '/landDaily', icon: 'fa-shoe-prints', label: '日次・アプローチ' },
    { id: 'landDeals', path: '/landDeals', icon: 'fa-map-location-dot', label: '仕入案件一覧' },
    { id: 'landVendors', path: '/landVendors', icon: 'fa-building', label: '業者マスタ' },
    { id: 'analysis', path: '/landPending?view=analysis', icon: 'fa-magnifying-glass-chart', label: '仕入分析', pending: true },
    { id: 'member', path: '/landPending?view=member', icon: 'fa-user', label: '個人別実績', pending: true },
    { id: 'targets', path: '/landPending?view=targets', icon: 'fa-bullseye', label: '目標・月次入力', pending: true },
    { id: 'landSettings', path: '/landSettings', icon: 'fa-gear', label: '仕入設定' },
];

/** 移行中の画面の名前（LandPending.tsx が使う） */
export const landPendingLabelOf = (view: string): string => LAND_MENU.find((i) => i.pending && i.path.endsWith(`=${view}`))?.label ?? '';

/** 見出し（建売営業・土地仕入）。⚠️ 見た目は不動産企画係のメニュー（RealtyMenu.tsx の rlt-menu-grp）と同じ */
const STYLE = `
.land-menu-grp { font-size: 10px; font-weight: bold; color: #868e96; letter-spacing: .08em; padding: 10px 8px 2px 12px; }
.land-menu-pending { font-size: 8px; padding: 1px 4px; border-radius: 3px; background: #e9ecef; color: #6c757d; margin-left: 6px; }
`;
export const LandMenuHeading = ({ label }: { label: string }) => (
    <>
        <style>{STYLE}</style>
        <div className="land-menu-grp">{label}</div>
    </>
);

type Props = { isActive: (path: string) => boolean; onNavigate: (path: string) => void };

const LandMenu: React.FC<Props> = ({ isActive, onNavigate }) => (
    <>
        <LandMenuHeading label="土地仕入" />
        {LAND_MENU.map((item) => (
            <div key={item.id} className={`position-relative category_menu ps-3 ${isActive(item.path) ? 'selected' : ''}`} onClick={() => onNavigate(item.path)}>
                <i className={`fa-solid ${item.icon} me-1 text-secondary`}></i>
                {item.label}
                {item.pending && <span className="land-menu-pending">移行中</span>}
            </div>
        ))}
    </>
);

export default LandMenu;
