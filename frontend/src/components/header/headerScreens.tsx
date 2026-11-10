import React from 'react';
import { useNavigate } from 'react-router-dom';
import EditStaff from './system/EditStaff';
import EditAuth from './system/EditAuth';
import EditShop from './system/EditShop';
import UploadLoan from './system/UploadLoan';
import SecurityLog from './system/SecurityLog';
import SyncLog from './system/SyncLog';
import BudgetTable from './system/BudgetTable';
import EditBlackList from './inquiry/EditBlackList';
import BudgetSimulator from './inquiry/BudgetSimulator';
import AfterInterview from './inquiry/AfterInterview';
import DuplicateInquirySummary from './inquiry/DuplicateInquirySummary';
import OwnersHouseApplication from './inquiry/OwnersHouseApplication';
import TrackingSettings from './inquiry/TrackingSettings';
import MetaAdsDashboard from './competitor/MetaAdsDashboard';
import CompetitorMaterials from './competitor/CompetitorMaterials';
import CompetitorSummary from './competitor/CompetitorSummary';
import CompetitorAnalysisReports from './competitor/CompetitorAnalysisReports';
import CallStatusList from './callStatus/CallStatusList';
import DailyReports from './activity/DailyReports';
import StaffContractRate from './activity/StaffContractRate';
import RankingLoader from './activity/RankingLoader';
import AmbassadorList from './ambassador/AmbassadorList';
import { InquiryAmbassador } from './ambassador/InquiryAmbassador';
import InquiryIntroductory from './introductory/InquiryIntroductory';
import IntroductorySummary from './introductory/IntroductorySummary';
import EventList from './event/EventList';
import EventSummary from './event/EventSummary';
import EventBudget from './event/EventBudget';
import FestaDashboard from './event/FestaDashboard';
import GoogleReview from './review/GoogleReview';
import ClaudeAnalysis from './claude/ClaudeAnalysis';
import ClaudeIcon from './claude/ClaudeIcon';
import { openDailyAction } from '../DailyAction';

/**
 * ヘッダーのメニューから開く画面の一覧（v2.2.241 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ v2.2.240 まではヘッダーのモーダルで開いていた。v2.2.241 から App.tsx のルートで開くページにした。
 * ⚠️ ここが1か所の元。次の3つがこの一覧を読む（⚠️ 片方だけに足さない）:
 *   ・Header.tsx … メニューの項目（allow が false の項目は出さない）
 *   ・App.tsx    … ルート（HeaderPage が allow を確かめ、false なら「権限がありません」を出す）
 *   ・guide/guideScreens.ts … 業務ガイドの「画面を開く」（⚠️ authority・divisions を allow と同じ条件にそろえる）
 *
 * ⚠️ URL は1段にする（⚠️ `/a/b` は再読み込みで真っ白になる。App.tsx の realty の注記）。
 * ⚠️⚠️ **allow を外すだけでは権限は閉じない。** ② もそれぞれ確かめている（各画面の注記）。
 * ─────────────────────────────────────────────
 */

export type MenuKey = 'システム管理' | '反響管理' | '他社動向' | '架電状況' | '活動サマリー' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';

/** ヘッダーに並べる順 */
export const MENU_KEYS: MenuKey[] = ['システム管理', '反響管理', '他社動向', '活動サマリー', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];

/**
 * 他社動向メニューの最後に出す項目。
 * ⚠️ 画面にはロゴ＋「による競合分析」で出す（⚠️ この文字列そのものは画面に出さない。中で見分けるための鍵）。
 * ⚠️⚠️ **開いても Claude は呼ばれない。課金は発生しない。** 保存済みのレポート（HTML）を見るだけの画面である。
 */
export const CLAUDE_COMPETITOR_ITEM = 'Claudeによる競合分析';

/**
 * 「Claudeによる分析」を使える権限（v2.2.217）。⚠️ ② の AI_ANALYSIS_AUTHORITY と同じ値にすること。
 *   ⚠️ ボタンを隠すだけでは閉じない。② の ai_analysis_* / kpi_* も同じ3つを確かめている。
 */
export const AI_ANALYSIS_AUTHORITY = ['Master', 'BrandAdmin', 'Manager'];

export interface ScreenAccess {
    authority: string;
    category: string;
}

export interface HeaderScreen {
    /** メニュー。⚠️ 無いのはヘッダー左上の「Claudeによる分析」だけ */
    menu?: MenuKey;
    /** 項目名（⚠️ メニューの中で一意。業務ガイドの記事・guideScreens.ts もこの名前で書いている） */
    item: string;
    /** 画面に出す名前（⚠️ 無ければ item） */
    label?: React.ReactNode;
    /** URL。⚠️ アクションボードだけは無い（action で開く） */
    path?: string;
    /** ページではなく、押したときに呼ぶ */
    action?: () => void;
    /** 見られる人。⚠️ 無ければ全員 */
    allow?: (access: ScreenAccess) => boolean;
    /**
     * 本文の周りに余白を付ける。
     * ⚠️ v2.2.240 まで xl のモーダル（余白あり）で開いていた画面。全画面モーダルで開いていた画面は余白を自分で持つ
     */
    padded?: boolean;
    /** 見出しの右に出すリンク（⚠️ 集客サマリーの「広告費入力」） */
    link?: { label: string; icon: string; path: string };
    /** 本文 */
    render?: () => React.ReactNode;
}

const isMaster = ({ authority }: ScreenAccess) => authority === 'Master';
const isAdmin = ({ authority }: ScreenAccess) => authority === 'Master' || authority === 'BrandAdmin';

const claudeLabel = (text: string) => (
    <span className="d-inline-flex align-items-center" style={{ gap: '2px' }}>
        <ClaudeIcon height={15} />
        {text}
    </span>
);

/** 月次日報。⚠️ 上部の「最新の他社分析」から競合分析のページへ移る（⚠️ v2.2.240 までは同じモーダルの中身を切り替えていた） */
const DailyReportsPage = () => {
    const navigate = useNavigate();
    return <DailyReports onOpenCompetitorReports={() => navigate('/competitorReports')} />;
};

/** 架電状況。⚠️ source を渡すと CallStatusList は自前のモーダルを使わずにその場に描く（顧客DBから開くときはモーダル） */
const callStatus = (source: 'order' | 'spec' | 'used') => () => (
    <CallStatusList callStatusShow setCallStatusShow={() => undefined} source={source} />
);

export const HEADER_SCREENS: HeaderScreen[] = [
    // ── システム管理
    { menu: 'システム管理', item: '店舗編集', path: '/editShop', padded: true, render: () => <EditShop /> },
    { menu: 'システム管理', item: 'スタッフ編集・追加', path: '/editStaff', padded: true, render: () => <EditStaff /> },
    { menu: 'システム管理', item: '権限編集', path: '/editAuth', padded: true, render: () => <EditAuth /> },
    // ⚠️ ローン情報更新は ⚠️⚠️ **Master だけ**（お客様に出る金利を確定するため。② の loan_rate_upload も auth: 'master'）
    { menu: 'システム管理', item: 'ローン情報更新', path: '/uploadLoan', allow: isMaster, padded: true, render: () => <UploadLoan /> },
    // ⚠️ v2.2.242: セキュリティログは ⚠️⚠️ **Master だけ**（IP・ログインの記録が並ぶため。② の security_log_list も auth: 'master'）
    { menu: 'システム管理', item: 'セキュリティログ', path: '/securityLog', allow: isMaster, render: () => <SecurityLog /> },
    // ⚠️ v2.2.259: 同期の実行結果は ⚠️⚠️ **Master だけ**（② の sync_log_list も auth: 'master'）
    { menu: 'システム管理', item: '同期の実行結果', path: '/syncLog', allow: isMaster, render: () => <SyncLog /> },
    // ⚠️ v2.2.243: 予算テーブルは ⚠️⚠️ **Master と BrandAdmin**（budget へ CSV で追加できるため。② の budget_table_* も同じ2つ）
    { menu: 'システム管理', item: '予算テーブル', path: '/budgetTable', allow: isAdmin, render: () => <BudgetTable /> },

    // ── 反響管理
    // ⚠️ 販促媒体設定はまだ中身が無い（v2.2.240 までと同じく「準備中」を出す）
    { menu: '反響管理', item: '販促媒体設定', path: '/mediaSettings', padded: true },
    { menu: '反響管理', item: 'ブラックリスト設定', path: '/blackList', render: () => <EditBlackList /> },
    { menu: '反響管理', item: '広告費シミュレーター', path: '/budgetSimulator', allow: isMaster, render: () => <BudgetSimulator /> },
    { menu: '反響管理', item: '事後アンケート', path: '/afterInterview', padded: true, render: () => <AfterInterview name="" staff="" id="" shop="" /> },
    { menu: '反響管理', item: '重複反響サマリー', path: '/duplicateInquiry', render: () => <DuplicateInquirySummary /> },
    { menu: '反響管理', item: 'オーナーズハウス募集', path: '/ownersHouse', render: () => <OwnersHouseApplication /> },
    // ⚠️ アクセス解析は Master / BrandAdmin（② の tracking_site_* も確かめる）
    { menu: '反響管理', item: 'アクセス解析', path: '/accessAnalysis', allow: isAdmin, render: () => <TrackingSettings /> },

    // ── 他社動向
    { menu: '他社動向', item: '他社広告ライブラリ', path: '/competitorAds', render: () => <MetaAdsDashboard /> },
    { menu: '他社動向', item: '他社資料', path: '/competitorMaterials', render: () => <CompetitorMaterials /> },
    { menu: '他社動向', item: '競合サマリー', path: '/competitorSummary', render: () => <CompetitorSummary /> },
    // ⚠️ 読むのは全員、登録・削除は Master だけ（画面の中で isMaster を見ている。② も analysis_report_upload / _delete は master）
    {
        menu: '他社動向', item: CLAUDE_COMPETITOR_ITEM, label: claudeLabel('による競合分析'), path: '/competitorReports',
        render: () => <CompetitorAnalysisReports />,
    },

    // ── 活動サマリー
    { menu: '活動サマリー', item: '月次日報', path: '/dailyReports', render: () => <DailyReportsPage /> },
    // ⚠️ 営業別契約率は ⚠️⚠️ **Master と BrandAdmin のみ**（個人別の成績が並ぶため。② の staff_contract も同じ2つ）
    { menu: '活動サマリー', item: '営業別契約率', path: '/staffContractRate', allow: isAdmin, render: () => <StaffContractRate /> },
    // ⚠️ アクションボードは ⚠️ **注文営業だけ**。⚠️ ページにしない（App.tsx の DailyAction を開く。右上の「要確認」と同じ画面）
    { menu: '活動サマリー', item: 'アクションボード', action: openDailyAction, allow: ({ category }) => category === 'order' },
    { menu: '活動サマリー', item: '契約数ランキング', path: '/ranking', padded: true, render: () => <RankingLoader /> },

    // ── 架電状況
    { menu: '架電状況', item: '注文営業', path: '/callStatusOrder', padded: true, render: callStatus('order') },
    { menu: '架電状況', item: '建売営業', path: '/callStatusSpec', padded: true, render: callStatus('spec') },
    { menu: '架電状況', item: '中古営業', path: '/callStatusUsed', padded: true, render: callStatus('used') },

    // ── 公式アンバサダー
    { menu: '公式アンバサダー', item: 'アンバサダー管理', path: '/ambassador', render: () => <AmbassadorList /> },
    { menu: '公式アンバサダー', item: '反響一覧', path: '/ambassadorInquiry', render: () => <InquiryAmbassador /> },

    // ── 紹介キャンペーン
    { menu: '紹介キャンペーン', item: '反響一覧', path: '/introductoryInquiry', render: () => <InquiryIntroductory /> },
    { menu: '紹介キャンペーン', item: '紹介キャンペーンサマリー', path: '/introductorySummary', render: () => <IntroductorySummary /> },

    // ── 集客イベント
    { menu: '集客イベント', item: '反響一覧', path: '/eventInquiry', render: () => <EventList /> },
    {
        menu: '集客イベント', item: '集客サマリー', path: '/eventSummary', render: () => <EventSummary />,
        link: { label: '広告費入力', icon: 'fa-solid fa-yen-sign', path: '/eventBudget' },
    },
    { menu: '集客イベント', item: '広告費入力', path: '/eventBudget', padded: true, render: () => <EventBudget /> },
    { menu: '集客イベント', item: 'おうちづくりフェスタ2026', path: '/festa', render: () => <FestaDashboard /> },

    // ── Google口コミ
    { menu: 'Google口コミ', item: '口コミ集計', path: '/googleReview', render: () => <GoogleReview /> },

    // ── ヘッダー左上の「Claudeによる分析」（⚠️ メニューではなく独立したボタン。v2.2.217 から3つの権限だけ）
    {
        item: 'Claudeによる分析', label: claudeLabel('による分析'), path: '/claudeAnalysis',
        allow: ({ authority }) => AI_ANALYSIS_AUTHORITY.includes(authority), render: () => <ClaudeAnalysis />,
    },
];

export const canOpenScreen = (screen: HeaderScreen, access: ScreenAccess): boolean => screen.allow === undefined || screen.allow(access);

/** `メニュー/項目`（⚠️ メニューの無い画面は項目名だけ）で引く。⚠️ 業務ガイド（guideScreens.ts の header）が使う */
export const headerScreenOf = (key: string): HeaderScreen | undefined =>
    HEADER_SCREENS.find((s) => (s.menu ? `${s.menu}/${s.item}` : s.item) === key);

/** メニューの項目（⚠️ 見られない項目は除く） */
export const menuItemsOf = (menu: MenuKey, access: ScreenAccess): HeaderScreen[] =>
    HEADER_SCREENS.filter((s) => s.menu === menu && canOpenScreen(s, access));
