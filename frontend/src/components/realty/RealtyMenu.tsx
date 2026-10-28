import React from 'react';

/**
 * 不動産企画係のメニュー（v2.2.225）。Menu.tsx が category = realty のときだけ、通常の項目の代わりに出す。
 *
 * ⚠️ 並び・見出し・名前は以前のアプリ（V18 の VIEWS）と同じ。「ダッシュボード」は Dashboard では「チームサマリー」。
 *   ⚠️ 2026-10-28 の指示: 旧アプリのメニューをそのまま移行。見出し（日々の行動・集計・分析・入力・台帳・点検・管理）も出す。
 *   見た目（アイコン・選ばれたときの色）は Dashboard のメニュー（.category_menu）に合わせる。
 * ⚠️ まだ移していない画面は「移行中」を付け、/realtyPending?view=… で以前のアプリを案内する。移したら path を差し替える。
 * ⚠️ URL は1段にする（`/realty/…` にしない。App.tsx の注記）。
 */

export type RealtyMenuItem = { id: string; path: string; icon: string; label: string; pending?: boolean; spOk?: boolean };
type Group = { label: string; items: RealtyMenuItem[] };

export const REALTY_MENU: Group[] = [
    {
        label: '日々の行動', items: [
            { id: 'callq', path: '/realtyCallQueue', icon: 'fa-phone', label: '今日の架電キュー' },
            { id: 'navi', path: '/realtyCallNavi', icon: 'fa-compass', label: '架電ナビ（一括査定）' },
        ],
    },
    {
        label: '集計・分析', items: [
            { id: 'dash', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー' },
            { id: 'sales', path: '/realtySales', icon: 'fa-chart-column', label: '月次売上管理' },
            { id: 'bmonthly', path: '/realtyBaikaiMonthly', icon: 'fa-chart-area', label: '月次媒介管理' },
            { id: 'lost', path: '/realtyLost', icon: 'fa-puzzle-piece', label: '失注・他決の分析' },
        ],
    },
    {
        label: '入力・台帳', items: [
            { id: 'leads', path: '/leadSell', icon: 'fa-envelope-open-text', label: '売り反響（一括査定）' },
            { id: 'buyleads', path: '/leadBuy', icon: 'fa-house', label: '買い反響（ポータル）' },
            { id: 'deals', path: '/leadOpportunity', icon: 'fa-tags', label: '商談案件管理' },
            { id: 'resale', path: '/leadResale', icon: 'fa-hammer', label: '買取再販案件' },
            { id: 'ledger', path: '/broker', icon: 'fa-file-signature', label: '媒介獲得台帳', spOk: true },
            { id: 'srep', path: '/realtyPending?view=srep', icon: 'fa-bullhorn', label: '売主への販売報告', pending: true },
            { id: 'renew', path: '/realtyPending?view=renew', icon: 'fa-clipboard-list', label: '媒介更新履歴', pending: true },
            { id: 'weekly', path: '/realtyWeekly', icon: 'fa-calendar-week', label: '週次行動計画' },
        ],
    },
    {
        label: '点検・管理', items: [
            { id: 'quality', path: '/realtyPending?view=quality', icon: 'fa-magnifying-glass', label: 'データ品質チェック', pending: true },
            { id: 'comp', path: '/realtyCompliance', icon: 'fa-triangle-exclamation', label: 'コンプライアンス' },
            { id: 'settings', path: '/realtySettings', icon: 'fa-gear', label: '設定・データ管理' },
        ],
    },
    {
        // ⚠️ 2026-10-28: Dashboard にだけある画面は最後に残す
        label: 'Dashboard', items: [
            { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書' },
            { id: 'property', path: '/property', icon: 'fa-building', label: '掲載物件一覧', spOk: true },
        ],
    },
];

/** 移行中の画面の名前（RealtyPending.tsx が使う） */
export const pendingLabelOf = (view: string): string =>
    REALTY_MENU.flatMap(g => g.items).find(i => i.pending && i.id === view)?.label ?? '';

const STYLE = `
.rlt-menu-grp { font-size: 10px; font-weight: bold; color: #868e96; letter-spacing: .08em; padding: 10px 8px 2px 12px; }
.rlt-menu-pending { font-size: 8px; padding: 1px 4px; border-radius: 3px; background: #e9ecef; color: #6c757d; margin-left: 6px; }
`;

type Props = {
    isSp: boolean;
    /** 選ばれているか（Menu.tsx の判定をそのまま使う） */
    isActive: (path: string) => boolean;
    onNavigate: (path: string) => void;
};

const RealtyMenu: React.FC<Props> = ({ isSp, isActive, onNavigate }) => (
    <>
        <style>{STYLE}</style>
        {REALTY_MENU.map(g => {
            // ⚠️ スマホでは以前の Dashboard と同じく、台帳・物件だけ出す（ほかは PC 幅の画面）
            const items = g.items.filter(i => !isSp || i.spOk);
            if (items.length === 0) return null;
            return (
                <React.Fragment key={g.label}>
                    <div className="rlt-menu-grp">{g.label}</div>
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`position-relative category_menu ps-3 ${isActive(item.path) ? 'selected' : ''}`}
                            onClick={() => onNavigate(item.path)}
                        >
                            <i className={`fa-solid ${item.icon} me-1 text-secondary`}></i>
                            {item.label}
                            {item.pending && <span className="rlt-menu-pending">移行中</span>}
                        </div>
                    ))}
                </React.Fragment>
            );
        })}
    </>
);

export default RealtyMenu;
