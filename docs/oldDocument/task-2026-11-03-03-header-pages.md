# 作業記録 2026-11-03-03　ヘッダーのメニューの画面をページに（v2.2.241）

## 依頼（ReadMeClaude.md）
- 新しいブランチで作業開始（→ `v2.2.241`）。大幅な改修
- `frontend/src/components/header/` のコンポーネントを改修する
  - 今：ヘッダーのメニューを押すとモーダルが開く（UX がよくない）
  - v2.2.241：App.tsx でルーティングして表示する、独立したコンポーネントにする
  - ルーティングの設定・ガイドの書き直し
  - Header.tsx の親コンポーネントとしての役割は終える
  - ディレクトリ構成はエージェントに任せる（header の中で役割ごとに分ける？）
  - 閲覧権限は今のまま

## 決めたこと（2026-11-03 に利用者に確認）
- **アクションボードと契約数ランキング**：ランキングだけページにした。アクションボードは右上の「要確認」と同じポップアップを共用しているので、ポップアップのまま
- **権限が無い人が URL を直接開いたとき**：案内を出す（「この画面を見る権限がありません」。画面の部品は描かず、データも取りに行かない）
- **フォルダ**：header の中をメニューごとに分けて、既存のファイルを `git mv` で移す
- エージェントの判断で決めたこと
  - 架電状況の URL は `/callStatusOrder`・`/callStatusSpec`・`/callStatusUsed` に分けた（計画の時点では `?source=` を例に挙げていた）
  - 集客サマリーの「広告費入力」ボタンは、ページの見出しの右に置き、`/eventBudget` へ移る
  - 月次日報の「最新の他社分析」は、`/competitorReports` へ移る

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header/ | **headerScreens.tsx（新規）** | ヘッダーの画面の一覧（メニュー・項目・URL・見られる人・中身）。Header・App・業務ガイドがここを読む。`HEADER_SCREENS`・`MENU_KEYS`・`menuItemsOf`・`canOpenScreen`・`headerScreenOf`・`CLAUDE_COMPETITOR_ITEM`・`AI_ANALYSIS_AUTHORITY` |
| frontend/src/components/header/ | **HeaderPage.tsx（新規）** | ページの枠（見出し「メニュー › 項目」＋高さ固定の本文）と権限の判定 |
| frontend/src/components/header/ | Header.tsx | 書き直し。メニューは `navigate` するだけ。モーダル・state 7つ・menuMapping・editMapping・isFullscreenMenu・closeHeaderModals を削除 |
| frontend/src/ | App.tsx | `HEADER_SCREENS` からルートを作る（`key` に path）。LoanRates の import のパス |
| frontend/src/components/header/event/ | EventList.tsx・FestaDashboard.tsx・EventBudget.tsx | 自前のモーダルを外してページの本文に。開いたときに取得。「閉じる」を削除 |
| frontend/src/components/header/system/ | UploadLoan.tsx | 自前のモーダル（md）を外し、幅 520px の枠に。「閉じる」を削除 |
| frontend/src/components/header/claude/ | ClaudeAnalysis.tsx | `onClose` と左上の「閉じる」を削除 |
| frontend/src/components/company/ | Ranking.tsx | `asPage` を追加（ページの中に描く）。全社報告用フォーマットのポップアップは今のまま |
| frontend/src/components/header/activity/ | **RankingLoader.tsx（company/ から移動）** | ページにした（`show` を削除し、開いたときに取得。`asPage`） |
| frontend/src/components/guide/ | guideScreens.ts | `menu` / `claude` を `header` に統一。URL は headerScreens.tsx から引く。開いている画面の名前はページの見出しも読む |
| frontend/src/components/guide/ | useGuideScreenReceiver.ts | 引数をなくした。ヘッダーの画面も navigate で開く（アクションボードだけ action）。headerScreens の allow で確かめる |
| frontend/src/components/guide/ | GuideScreenButton.tsx | 確認の文言「閉じるか後ろに隠れます」→「閉じるか、ほかの画面に切り替わります」 |
| frontend/src/components/header/** | 移動した 45 ファイル | import のパスだけ（スクリプトで書き換え）。コメントの一部（「閉じるボタンは Header.tsx が出す」など、事実と食い違うもの）を直した |
| frontend/src/components/database/・shop/・DailyAction.tsx | 6 ファイル | import のパスだけ |
| frontend/src/utils/ | version.ts | 2.2.241 |
| backend/scripts/guide/articles/common/ | **screen-105.md（新規）** | 業務ガイド「ヘッダーのメニュー」 |
| backend/scripts/guide/articles/ | common/screen-150.md・screen-180.md・order/spec/used の screen-010.md | 下の「業務ガイド」 |
| backend/scripts/sql/ | **2026-11-03_update_log_2.2.241.sql（新規）** | 更新履歴＋業務ガイド6本（ローカルに流した。no = 340） |
| docs/ | deploy-v2.2.241.md（新規） | デプロイ手順 |

### フォルダの分け方（`frontend/src/components/header/`）
```
header/  Header.tsx, headerScreens.tsx, HeaderPage.tsx, divisions.ts（event・ambassador・introductory の共用なので直下）
  system/       EditShop, EditStaff, EditAuth, UploadLoan
  inquiry/      EditBlackList, BudgetSimulator(+budgetSimulatorUtils), AfterInterview, DuplicateInquirySummary,
                OwnersHouseApplication, TrackingSettings, TrackingDetail, TrackingVendorFunnel
  competitor/   MetaAdsDashboard, MetaAdsSummary, metaAdsUtils, CompetitorMaterials, CompetitorSummary, CompetitorAnalysisReports
  callStatus/   CallStatusList（顧客DB からも開く。そちらはモーダルのまま）
  activity/     DailyReports, StaffContractRate, RankingLoader
  ambassador/   AmbassadorList, InquiryAmbassador, ambassadorKpi, ambassadorLinks, useAmbassadorMaster
  introductory/ InquiryIntroductory, IntroductorySummary
  event/        EventList, EventSummary, EventBudget, FestaDashboard
  review/       GoogleReview, googleReviewUtils
  claude/       ClaudeAnalysis, ClaudeAnalysisPrint, ClaudeAnalysisResult, ClaudeIcon
  market/       LoanRates, LoanRateUpload
  unused/       SatBaseDatabase, SatBaseImport, SyncEstate（開く口が無い。中身はそのまま）
```

### URL の一覧（すべて1段）
| メニュー | 項目 | URL | 見られる人 |
|---|---|---|---|
| システム管理 | 店舗編集 / スタッフ編集・追加 / 権限編集 | /editShop /editStaff /editAuth | 全員 |
| システム管理 | ローン情報更新 | /uploadLoan | Master |
| 反響管理 | 販促媒体設定（準備中のまま） | /mediaSettings | 全員 |
| 反響管理 | ブラックリスト設定 / 事後アンケート / 重複反響サマリー / オーナーズハウス募集 | /blackList /afterInterview /duplicateInquiry /ownersHouse | 全員 |
| 反響管理 | 広告費シミュレーター | /budgetSimulator | Master |
| 反響管理 | アクセス解析 | /accessAnalysis | Master・BrandAdmin |
| 他社動向 | 他社広告ライブラリ / 他社資料 / 競合サマリー / Claudeによる競合分析 | /competitorAds /competitorMaterials /competitorSummary /competitorReports | 全員 |
| 活動サマリー | 月次日報 / 契約数ランキング | /dailyReports /ranking | 全員 |
| 活動サマリー | 営業別契約率 | /staffContractRate | Master・BrandAdmin |
| 活動サマリー | アクションボード | （ポップアップ） | 注文営業 |
| 架電状況 | 注文営業 / 建売営業 / 中古営業 | /callStatusOrder /callStatusSpec /callStatusUsed | 全員 |
| 公式アンバサダー | アンバサダー管理 / 反響一覧 | /ambassador /ambassadorInquiry | 全員 |
| 紹介キャンペーン | 反響一覧 / 紹介キャンペーンサマリー | /introductoryInquiry /introductorySummary | 全員 |
| 集客イベント | 反響一覧 / 集客サマリー / 広告費入力 / おうちづくりフェスタ2026 | /eventInquiry /eventSummary /eventBudget /festa | 全員 |
| Google口コミ | 口コミ集計 | /googleReview | 全員 |
| （左上のボタン） | Claudeによる分析 | /claudeAnalysis | Master・BrandAdmin・Manager |

条件は v2.2.240 の menuMapping・AI_ANALYSIS_AUTHORITY と同じです。② 側の確認は変えていません。

## 仕組み
- **headerScreens.tsx**：1件ごとに `menu`・`item`・`path`（またはアクションボードだけ `action`）・`allow`・`padded`・`link`・`render` を持つ
  - `padded`：v2.2.240 まで xl のモーダル（余白あり）で開いていた画面に余白を付ける。全画面モーダルで開いていた画面は、余白を自分で持っている
- **HeaderPage.tsx**：`.content` の中に見出しと本文
  - 本文（`.hp_body`）の高さは `calc(100vh - var(--header-h) - 6px)` から見出しを引いた分で、中でスクロールする。v2.2.240 までの全画面モーダルの Modal.Body と同じ作りなので、各画面の表の見出しの固定や `height: 100%` がそのまま効く
  - `allow` が false なら案内だけを出す
- **App.tsx**：`HEADER_SCREENS` の path ごとに `<Route>`。`key` に path を渡している。渡さないと、架電状況の注文 → 建売のように同じ部品のページへ移ったとき、前の状態が残って取り直さない
- **業務ガイド**
  - `guideScreens.ts` の `header: 'メニュー/項目'` から `headerScreenOf` で URL を引く
  - 受け取る側（useGuideScreenReceiver）は、切り替えたあとの事業で `allow` を確かめてから navigate する
  - 開いている画面の確認は、モーダルが無ければページの見出し（`.hp_title`）を読む

## 業務ガイド（直した記事）
- **ヘッダーのメニュー（新規・全事業共通・sort 105）**：開き方（ページで開く・「戻る」・閉じるボタンは無い・再読み込みしても同じ画面）、入力途中で移ると消えるという注意、見られる人、項目ごとの記事へのリンク
- **Claudeによる分析**：「閉じるときは左上の『閉じる』（または右上の×）」→「ほかのメニューか『戻る』で移る」
- **業務ガイドの使い方**：開く前の確認の説明を、画面の文言と同じに（「閉じるか、ほかの画面に切り替わります（保存していない内容は消えることがあります）」）
- **反響一覧／反響一覧（建売営業）／反響一覧（中古リノベ）**：「ヘッダーの『ブラックリスト編集』」→「ヘッダーの『反響管理 → ブラックリスト設定』」。実際のメニュー名に合わせた。画面を開くボタンも付くようになる

## テスト（ローカル）
- 型チェック（今回の変更で新しいエラーなし）・本番用ビルド（`react-scripts build`）とも通過。今回のファイルに新しい lint の警告なし
  - EventList の `fetchData` の依存の警告は v2.2.240 までと同じ形
- Playwright（3100・Master・注文営業）
  - ヘッダーの全項目（37）を押して、URL・見出し・本文が出ること、モーダルが残らないこと、横にはみ出さないことを確かめた。コンソールエラー 0
  - URL を直接開く（再読み込み）：/uploadLoan・/budgetSimulator・/accessAnalysis・/staffContractRate・/claudeAnalysis・/eventSummary・/callStatusSpec・/ranking
  - 集客サマリー →「広告費入力」→ ブラウザの「戻る」で集客サマリーに戻る
  - 月次日報の「最新の他社分析」→ /competitorReports
  - 業務ガイドの開き直し（`/home?guide_screen=重複反響サマリー` → /duplicateInquiry、営業別契約率も同じ）。開いている画面の名前としてページの見出しが読める
  - アクションボード：押すと約2.3秒で「要確認」のポップアップが開き、URL は変わらない
  - スクリーンショットで見た目を確かめた：反響一覧（イベント）・フェスタ・広告費入力・ローン情報更新・ランキング・Claudeによる分析・架電状況・スタッフ編集。表の見出しの固定と上部の操作の固定が効いている。ページ全体はスクロールせず、本文の中でスクロールする
- 権限（テスト用スタッフの権限を変えて、建売営業で確認）
  - Manager：ローン情報更新・広告費シミュレーター・アクセス解析・営業別契約率がメニューに出ない。URL を直接開くと「この画面を見る権限がありません」。Claudeによる分析は開ける
  - ordinary：上に加えて Claudeによる分析のボタンが出ず、URL を開いても案内が出る
  - 建売営業ではアクションボードが出ない
- ① 経由：画面が使う既存の request（event_budget・loan_rate_latest・company）をトークンなしで投げて 401。新しい request は無い
- 業務ガイド：ローカル DB に入れ、ガイドの画面で「ヘッダーのメニュー」「反響一覧」「Claudeによる分析」を開き、開くボタンが付くこと・壊れたボタンが無いことを確かめた
- 後片付け：テスト用スタッフ（id 999999）を削除し、開発サーバー（3100）を止めた

## リファクタリング
- 移したファイルのうち EventBudget.tsx・EventList.tsx のコメントの古いパス（`header/useAmbassadorMaster.ts`）を直した。整理のあと、Playwright の全項目のテストをもう一度通した

## 残っていること・気になること
- ⚠️ **入力の途中でほかのページへ移ると、保存していない内容が消える**。v2.2.240 までの広告費入力は、閉じるときに確認を出していた。今の Router（BrowserRouter）では、ページの移動を止める仕組み（useBlocker）が使えないので、確認は外した。業務ガイド「ヘッダーのメニュー」に注意を書いている
- 1440px 前後の幅では、右上の固定パネル（要確認・業務ガイド）がヘッダーの「Google口コミ」に重なり、押しにくい。今回の変更より前からある
- バックエンドのコメントに、移す前のパスが残っている（`backend-express/src/features/` の dailyReport.ts・duplicateSummary.ts・eventBudget.ts・introductory/summary.ts・loanPlanRate.ts・loanRate.ts、`backend/src/handlers/` の budget_simulator.php・daily_report.php）。コメントのためだけに②の再ビルドや①の上書きが要るので、今回は直していない。次にそのファイルを直すときに合わせる
- 各画面の注記に「Header.tsx の全画面モーダル」「isFullscreenMenu」「Modal.Body は p-0」という書き方が残っている。今は HeaderPage の本文のことだと、HeaderPage.tsx の冒頭に書いた
- CLAUDE.md の「全画面モーダルで開く画面は、閉じるボタンを Header.tsx が出す」と、ベンチマークのパス（`header/GoogleReview.tsx` など）は古くなった。CLAUDE.md は書き換えていない
  - 新しいパスは `header/review/GoogleReview.tsx`・`header/activity/StaffContractRate.tsx`・`header/introductory/IntroductorySummary.tsx`・`header/competitor/CompetitorSummary.tsx`・`header/inquiry/EditBlackList.tsx`

---

## 追加したファイル（全文）

### frontend/src/components/header/headerScreens.tsx
```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import EditStaff from './system/EditStaff';
import EditAuth from './system/EditAuth';
import EditShop from './system/EditShop';
import UploadLoan from './system/UploadLoan';
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
```

### frontend/src/components/header/HeaderPage.tsx
```tsx
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { canOpenScreen } from './headerScreens';
import type { HeaderScreen } from './headerScreens';

/**
 * ヘッダーのメニューの画面を、ページとして描く枠（v2.2.241 新規）。⚠️ App.tsx のルートが headerScreens.tsx の1件ごとに使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見出し（メニュー › 項目）＋本文。本文は高さを決めて中でスクロールする。
 *   ⚠️ v2.2.240 までの全画面モーダルの Modal.Body と同じ作り（⚠️ 各画面の表の見出しの固定・height: 100% がそのまま効く）。
 *   ⚠️ 各画面の注記に残っている「Header.tsx の全画面モーダル」「isFullscreenMenu」「Modal.Body は p-0」は、
 *     ⚠️ v2.2.241 からはこの本文（.hp_body。padded の無い画面は余白なし）のこと。⚠️ 余白は今も各画面が自分で持つ。
 * ⚠️ 見られない人（allow が false）には案内だけ出し、⚠️ 画面の部品を描かない（⚠️ データも取りに行かない）。
 *   ⚠️ URL を直接打って開いた場合のため。⚠️ メニューには最初から出していない。
 * ⚠️ 閉じるボタンは無い（ページなので、ほかのメニュー・ブラウザの「戻る」で移る）。
 * ⚠️ 見出しの .hp_title は業務ガイドが「いま開いている画面」として読む（guideScreens.ts の openScreenLabel）。⚠️ クラス名を変えない。
 * ─────────────────────────────────────────────
 */
const HeaderPage = ({ screen }: { screen: HeaderScreen }) => {
    const { authority, category } = useContext(AuthContext);
    const navigate = useNavigate();
    const allowed = canOpenScreen(screen, { authority, category });

    const body = !allowed
        ? <div className="hp_notice">この画面を見る権限がありません。</div>
        : screen.render
            ? screen.render()
            : <div className="hp_notice">現在、{screen.item} のコンポーネントを準備中です。</div>;

    return (
        <div className="content hp_page">
            <style>{`
                .content.hp_page { height: calc(100vh - var(--header-h, 30px) - 6px); overflow: hidden; }
                .hp_head { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; padding: 8px 16px 6px;
                           font-size: 15px; color: #6c757d; }
                .hp_menu { font-size: 12px; color: #8898aa; }
                .hp_sep { font-size: 12px; color: #ced4da; }
                .hp_title { font-size: 15px; font-weight: 700; color: #6c757d; margin: 0; display: inline-flex; align-items: center; }
                .hp_link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
                .hp_body { flex: 1 1 auto; min-height: 0; overflow: auto; }
                .hp_body.is_padded { padding: 8px 16px 16px; }
                .hp_notice { font-size: 13px; color: #6c757d; text-align: center; padding: 32px 16px; }
            `}</style>
            <div className="hp_head">
                {screen.menu && <><span className="hp_menu">{screen.menu}</span><span className="hp_sep" aria-hidden="true">›</span></>}
                <h1 className="hp_title">{screen.label ?? screen.item}</h1>
                {allowed && screen.link && (
                    <button type="button" className="btn btn-sm btn-outline-secondary hp_link" onClick={() => navigate(screen.link!.path)}>
                        <i className={screen.link.icon} aria-hidden="true" />
                        {screen.link.label}
                    </button>
                )}
            </div>
            <div className={`hp_body${screen.padded ? ' is_padded' : ''}`}>{body}</div>
        </div>
    );
};

export default HeaderPage;
```

### backend/scripts/guide/articles/common/screen-105.md
````markdown
---
title: ヘッダーのメニュー
section: 画面の使い方
sort: 105
summary: 画面のいちばん上のメニュー（システム管理・反響管理・他社動向など）の開き方と、見られる人。
---
画面のいちばん上に並んでいるメニュー（システム管理・反響管理・他社動向・活動サマリー・架電状況・公式アンバサダー・紹介キャンペーン・集客イベント・Google口コミ）です。メニューを押すと項目が出て、項目を押すとその画面が開きます。

## 開き方
- 項目を押すと、左のメニューの画面（顧客DB など）と同じように、右側にその画面が出ます。左のメニューはそのまま使えます
- 画面のいちばん上に「反響管理 › 重複反響サマリー」のように、どのメニューのどの項目かが出ます
- 前の画面に戻るときは、ブラウザの「戻る」を押すか、ほかのメニューを押します。閉じるボタンはありません
- 開いている画面のまま再読み込みしても、同じ画面が開きます

> 注意：「広告費入力」などで入力の途中にほかの画面へ移ると、まだ登録していない内容は消えます。移る前に「登録」や「修正」を押してください。

> 以前はポップアップで開いていましたが、2026年11月から画面の中に開くようになりました。中身と使い方は変わっていません。

## 見られる人
だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
- **ローン情報更新**・**広告費シミュレーター**：管理者だけ
- **アクセス解析**・**営業別契約率**：管理者・ブランド管理者だけ
- **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
- **アクションボード**：注文営業だけ

> 見られない画面を、アドレスを直接入れて開いたときは「この画面を見る権限がありません」と出ます。

## 項目ごとの記事
- [[重複反響サマリー]]
- [[紹介キャンペーンサマリー]]
- [[営業別契約率]]
- [[契約数ランキング]]
- [[Claudeによる分析]]
- [[アクセス解析]]
- [[アンバサダーの反響一覧]]
- [[オーナーズハウス募集]]
````

## 書き直したファイル（全文）

### frontend/src/components/header/Header.tsx
```tsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useIsSp } from '../../utils/isSp';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import ClaudeIcon from './claude/ClaudeIcon';
import { isGuideCategory, openGuide } from '../guide/openGuide';
import { useGuideScreenReceiver } from '../guide/useGuideScreenReceiver';
import { useNavigate } from "react-router-dom";
import { AI_ANALYSIS_AUTHORITY, MENU_KEYS, menuItemsOf } from './headerScreens';
import type { HeaderScreen } from './headerScreens';

/**
 * 画面上部のヘッダー（メニュー）。
 *
 * ⚠️ v2.2.241 から、メニューの項目は App.tsx のページへ移るだけ（⚠️ それまではここでモーダルを開いていた）。
 *   ⚠️ 項目・URL・見られる人は headerScreens.tsx にまとめてある。⚠️ ここに項目を書き足さないこと。
 */
const Header = ({ }) => {
    const { authority, category } = useContext(AuthContext);
    const [newEstate, setNewEstate] = useState<number | null>(0);

    const navigate = useNavigate();
    // Claudeによる分析（メニューとは独立した導線）
    const [claudeHover, setClaudeHover] = useState<boolean>(false);
    /**
     * ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけにボタンを出す（Dashboard からの自由分析）。
     *   ⚠️ 競合分析のレポートはこの画面から外し、他社動向 →「Claudeによる競合分析」だけで読む（全員）。
     */
    const canUseClaude = AI_ANALYSIS_AUTHORITY.includes(authority);

    const isSp = useIsSp();

    /**
     * ヘッダーの実際の高さを下のレイアウトへ伝える。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **メニューが折り返すと高さが変わる**（2026-09-15 に flex-wrap を付けた）。
     *   ヘッダーは `position-fixed` なので場所を取らず、下のコンテンツは
     *   App.tsx の余白で避けている。⚠️ 高さが 30px → 60px になっても
     *   余白が固定のままだと、**画面の上部がヘッダーに隠れる。**
     *
     * ⚠️ そこで実測して CSS 変数（--header-h）に入れ、App.tsx がそれを使う。
     *   ⚠️ 片方だけ直さないこと。変数名を変えるなら App.tsx も直す。
     *   ⚠️ v2.2.241: ヘッダーのメニューのページ（HeaderPage.tsx）も、この変数で本文の高さを決めている。
     *
     * ⚠️ ResizeObserver を使うのは、折り返しが**幅の変化で起きる**ため。
     *   リサイズだけを見ていると、メニューの増減に追従できない。
     * ─────────────────────────────────────────────
     */
    const headerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = headerRef.current;
        // ⚠️ スマホではこのヘッダーを描かない。余白も要らないので 0 に戻す
        if (!el) {
            document.documentElement.style.setProperty('--header-h', '0px');
            return;
        }

        const apply = () => {
            document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
        };
        apply();

        const observer = new ResizeObserver(apply);
        observer.observe(el);
        return () => observer.disconnect();
    }, [isSp]);

    /** メニューの項目を開く。⚠️ アクションボードだけはページではなく action（DailyAction を開く） */
    const openScreen = (screen: HeaderScreen): void => {
        if (screen.action) screen.action();
        else if (screen.path) navigate(screen.path);
    };

    // ⚠️ v2.2.196: 業務ガイドの「画面を開く」を受ける（guide/useGuideScreenReceiver.ts）。⚠️ ここで1回だけ
    useGuideScreenReceiver();

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post("", { request: "header" });
            setNewEstate(response.data.estate);
        };
        fetchData();

    }, []);

    const isEstate = (value: string) => {
        return newEstate !== null && newEstate > 0 && value === '土地情報一覧';
    };

    return (
        <>
            {!isSp && <div
                ref={headerRef}
                /**
                 * ⚠️⚠️ `flex-wrap` を外さないこと（2026-09-15 追加）。
                 *   メニューが11項目あり、1024px 前後の幅では**1行に収まらず
                 *   画面外へはみ出す。** 折り返して全部見えるようにしている。
                 * ⚠️ `row-gap` は折り返したときの行間。無いと2行が詰まって読みにくい。
                 */
                className="d-flex flex-wrap align-items-center bg-white border-bottom px-2 position-fixed top-0 start-0 w-100"
                style={{
                    zIndex: 1050,
                    // ⚠️⚠️ **`height` ではなく `minHeight`。**
                    //   固定すると折り返した2行目が**はみ出して見えなくなる。**
                    minHeight: '30px',
                    rowGap: '2px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    userSelect: 'none',
                }}
            >
                {/* Claudeによる分析：メニューとは別の独立したボタン（⚠️ v2.2.217 から3つの権限だけ） */}
                {canUseClaude && (
                    <button
                        type="button"
                        onClick={() => navigate('/claudeAnalysis')}
                        onMouseEnter={() => setClaudeHover(true)}
                        onMouseLeave={() => setClaudeHover(false)}
                        className="border-0 d-flex align-items-center px-2 py-1 me-2"
                        style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            // ロゴ画像内の文字が黒のため、続く「による分析」も黒で揃える
                            color: '#000',
                            backgroundColor: claudeHover ? '#fdf8f6' : 'transparent',
                            borderRadius: '4px',
                            lineHeight: 1,
                            gap: '2px',
                        }}
                        title="Claudeによる分析"
                    >
                        <ClaudeIcon height={15} />
                        による分析
                    </button>
                )}

                <div className='bg-primary rounded-pill text-white me-1 shadow-sm'
                    style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer' }}
                    onClick={() => navigate('/market')}
                >
                    マーケット情報
                </div>
                {/* ⚠️ v2.2.240: 金利データ（⚠️ マーケット情報の右・指示）。⚠️ 色は濃いシアン（bg-info は白い文字が読みにくいため。2026-11-03 の決定）。header/market/LoanRates.tsx */}
                <div className='rounded-pill text-white me-1 shadow-sm'
                    role="button" tabIndex={0}
                    style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0891b2' }}
                    onClick={() => navigate('/loanRates')}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/loanRates'); }}
                    title="商圏内の金融機関の住宅ローン金利"
                >
                    金利データ
                </div>
                {/* ⚠️ v2.2.194: 業務ガイド（⚠️ マーケット情報の右・指示）。⚠️ 別ウインドウで開く。⚠️ 注文営業・建売営業・中古リノベ */}
                {isGuideCategory(category) && (
                    <div className='rounded-pill text-white me-1 shadow-sm'
                        role="button" tabIndex={0}
                        style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0f766e' }}
                        onClick={() => openGuide()}
                        onKeyDown={(e) => { if (e.key === 'Enter') openGuide(); }}
                        title="業務ガイドを別ウインドウで開く"
                    >
                        業務ガイド
                    </div>
                )}
                {MENU_KEYS.map((menu) => (
                    <Dropdown key={menu} className="me-1">
                        <Dropdown.Toggle
                            variant="text"
                            size="sm"
                            className="border-0 px-2.5 py-1 text-dark d-flex align-items-center"
                            style={{
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            {menu}
                        </Dropdown.Toggle>

                        <Dropdown.Menu
                            className="shadow-sm border border-light-subtle py-1"
                            style={{ fontSize: '13px', minWidth: '160px' }}
                        >
                            {menuItemsOf(menu, { authority, category }).map((screen) => (
                                <Dropdown.Item
                                    key={screen.item}
                                    className="py-2 px-3 text-dark position-relative"
                                    onClick={() => openScreen(screen)}
                                >
                                    {/* ⚠️ 競合分析はロゴ＋文言で出す（ヘッダーの「による分析」と同じ形。headerScreens.tsx の label） */}
                                    {screen.label ?? screen.item}
                                    {isEstate(screen.item) && <div className="position-absolute menu_sync" style={{ top: '12px', right: '10px' }}>新着 {newEstate}件</div>}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    </Dropdown>
                ))}


            </div>}
        </>
    );
};

export default Header;
```

## 変更したファイル（差分）

⚠️ 移したファイルは `git diff -M`（移動として表示し、中身の変わった行だけ）。import のパスだけの変更も含む。Header.tsx は上の全文を見る。

```diff
diff --git a/backend/scripts/guide/articles/common/screen-150.md b/backend/scripts/guide/articles/common/screen-150.md
index 166d1c40a..901fc0bad 100644
--- a/backend/scripts/guide/articles/common/screen-150.md
+++ b/backend/scripts/guide/articles/common/screen-150.md
@@ -13,7 +13,7 @@ summary: 知りたいことを文章で頼むと、Claude がダッシュボー
 > 注意：1回の分析に **5〜15分ほど**かかります。待っているあいだにほかの画面を使っても、この画面を閉じても、分析は止まりません。
 
 ## 画面の形
-左に条件と一覧、右に結果が出ます。閉じるときは左上の「閉じる」（または右上の×）を押します。
+左に条件と一覧、右に結果が出ます。ほかの画面に移るときは、ほかのメニューを押すか、ブラウザの「戻る」を押します（[[ヘッダーのメニュー]]）。
 
 ## 分析を頼む（左の「新しい分析」）
 1. **事業部**を選ぶ（注文事業／建売分譲事業）
diff --git a/backend/scripts/guide/articles/common/screen-180.md b/backend/scripts/guide/articles/common/screen-180.md
index 370cfcd7c..51dfd85d4 100644
--- a/backend/scripts/guide/articles/common/screen-180.md
+++ b/backend/scripts/guide/articles/common/screen-180.md
@@ -37,7 +37,7 @@ summary: このガイドの開き方と読み方。
 
 ## 画面を開く
 記事の中の青いボタン（例：「↗ 顧客DBを開く」）を押すと、**ダッシュボードの窓**でその画面が開きます。ガイドの窓はそのまま残るので、読みながら操作できます。本文に画面の名前が出てくるところにも、名前のすぐ後ろに小さい「↗ 開く」ボタンが付いています（働きは同じです）。
-- ダッシュボードの窓で、ほかの画面（お客様の編集など）を開いているときは、開く前に確認が出ます。「開く」を押すと、いまの画面は閉じるか後ろに隠れます
+- ダッシュボードの窓で、ほかの画面（お客様の編集など）を開いているときは、開く前に確認が出ます。「開く」を押すと、いまの画面は閉じるか、ほかの画面に切り替わります（保存していない内容は消えることがあります）
 - 記事の事業と、ダッシュボードで選んでいる事業が違うときは、事業を切り替えて開きます（確認が出ます）
 - ダッシュボードの窓を閉じていたときは、ダッシュボードを開き直してから開きます
 - 灰色のボタンは、いまは開けない画面です（管理者だけの画面、PC でしか開けない画面など）
diff --git a/backend/scripts/guide/articles/order/screen-010.md b/backend/scripts/guide/articles/order/screen-010.md
index d13d7a001..ff5800d46 100644
--- a/backend/scripts/guide/articles/order/screen-010.md
+++ b/backend/scripts/guide/articles/order/screen-010.md
@@ -41,7 +41,7 @@ summary: 届いた反響の確認・割り振り・取込をする画面。
 ## ブラックリストに登録する
 顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
 - 理由が空のままでは登録できません
-- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 理由は、ヘッダーの「反響管理 → ブラックリスト設定」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
 - 外すとき（もう一度押す）は、理由の画面は出ません
 
 ## 個人情報削除
diff --git a/backend/scripts/guide/articles/spec/screen-010.md b/backend/scripts/guide/articles/spec/screen-010.md
index a438f4625..0a63bb38b 100644
--- a/backend/scripts/guide/articles/spec/screen-010.md
+++ b/backend/scripts/guide/articles/spec/screen-010.md
@@ -24,7 +24,7 @@ summary: 届いた反響の確認・割り振り・取込。
 ## ブラックリストに登録する
 顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
 - 理由が空のままでは登録できません
-- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 理由は、ヘッダーの「反響管理 → ブラックリスト設定」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
 - 外すとき（もう一度押す）は、理由の画面は出ません
 
 ## 個人情報削除
diff --git a/backend/scripts/guide/articles/used/screen-010.md b/backend/scripts/guide/articles/used/screen-010.md
index 898991dc8..0bd95ab78 100644
--- a/backend/scripts/guide/articles/used/screen-010.md
+++ b/backend/scripts/guide/articles/used/screen-010.md
@@ -17,7 +17,7 @@ summary: 届いた反響の確認・取込（中古リノベ）。
 ## ブラックリストに登録する
 顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
 - 理由が空のままでは登録できません
-- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 理由は、ヘッダーの「反響管理 → ブラックリスト設定」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
 - 外すとき（もう一度押す）は、理由の画面は出ません
 
 ## 個人情報削除
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index a0cdf1f6a..11b3ca762 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -19,7 +19,7 @@ import Photo from "./components/photo/Photo";
 import Hab from "./components/Hab";
 import BudgetKaeru from "./components/BudgetKaeru";
 import Market from "./components/Market";
-import LoanRates from "./components/header/LoanRates";
+import LoanRates from "./components/header/market/LoanRates";
 import Login from "./components/Login";
 import KengakuCloud from "./components/KengakuCloud";
 import ActiveUser from "./components/ActiveUser";
@@ -28,6 +28,8 @@ import { useJsApiLoader } from "@react-google-maps/api";
 import MenuD from "./components/Menu";
 import Dev from "./components/Dev";
 import Header from "./components/header/Header";
+import HeaderPage from "./components/header/HeaderPage";
+import { HEADER_SCREENS } from "./components/header/headerScreens";
 import CustomerTrendRouter from "./components/customerTrend/CustomerTrendRouter";
 import MapRouter from "./components/map/MapRouter";
 import { useIsSp } from './utils/isSp';
@@ -182,6 +184,11 @@ function AppInner() {
             <Route path="/market" element={<Market />} />
             {/* ⚠️ v2.2.240: 金利データ（ヘッダーの「金利データ」） */}
             <Route path="/loanRates" element={<LoanRates />} />
+            {/* ⚠️ v2.2.241: ヘッダーのメニューの画面（⚠️ それまではヘッダーのモーダル）。⚠️ 一覧・URL・見られる人は header/headerScreens.tsx
+                ⚠️ key に path を渡す（⚠️ 渡さないと、架電状況の注文 → 建売のように同じ部品のページへ移ったとき、前の画面の状態が残って取り直さない） */}
+            {HEADER_SCREENS.filter((s) => s.path).map((s) => (
+              <Route key={s.path} path={s.path} element={<HeaderPage key={s.path} screen={s} />} />
+            ))}
             <Route path="/property" element={<DatabaseProperty />} />
             <Route path="/photo" element={<Photo />} />
             <Route path="/kengakuCloud" element={<KengakuCloud />} />
diff --git a/frontend/src/components/DailyAction.tsx b/frontend/src/components/DailyAction.tsx
index 517081989..e4da12e2e 100644
--- a/frontend/src/components/DailyAction.tsx
+++ b/frontend/src/components/DailyAction.tsx
@@ -7,8 +7,8 @@ import { useIsSp } from '../utils/isSp';
 // ⚠️ 店舗名 → ブランド色。⚠️ **対応表はあちらに持たせたまま使う**（brandColor を参照）
 import { setStyleClass } from '../utils/setStyleClass';
 // ⚠️ v2.2.165: 「最新の他社分析 〇件」。⚠️ 数え方は月次日報と共用（countRecentReports）
-import CompetitorAnalysisReports, { countRecentReports, RECENT_DAYS } from './header/CompetitorAnalysisReports';
-import ClaudeIcon, { CLAUDE_ORANGE } from './header/ClaudeIcon';
+import CompetitorAnalysisReports, { countRecentReports, RECENT_DAYS } from './header/competitor/CompetitorAnalysisReports';
+import ClaudeIcon, { CLAUDE_ORANGE } from './header/claude/ClaudeIcon';
 
 /**
  * 注文営業のダッシュボードを開いた直後に出す「要確認」。
diff --git a/frontend/src/components/company/Ranking.tsx b/frontend/src/components/company/Ranking.tsx
index 211253a61..f7c33dab9 100644
--- a/frontend/src/components/company/Ranking.tsx
+++ b/frontend/src/components/company/Ranking.tsx
@@ -69,10 +69,15 @@ type Props = {
     customerList: Customer[],
     monthArray: string[],
     staffList: Staff[],
-    achievement: Achievement[]
+    achievement: Achievement[],
+    /**
+     * ページの中に描く（v2.2.241。ヘッダーの「活動サマリー → 契約数ランキング」のページ。header/activity/RankingLoader.tsx）。
+     * ⚠️ 無ければ従来どおりモーダル（全社報告用フォーマットの「契約棟数ランキング」）。⚠️ 中身は同じ
+     */
+    asPage?: boolean
 };
 
-const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffList, achievement }: Props) => {
+const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffList, achievement, asPage }: Props) => {
     const { category, authority } = useContext(AuthContext);
     const [targetCustomer, setTargetCustomer] = useState<RankedRow[]>([]);
 
@@ -320,15 +325,14 @@ const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffL
             : <i className="fa-solid fa-sort-up ms-1 text-primary"></i>;
     };
 
-    return (
-        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered size='lg'>
-            <Modal.Header closeButton className="bg-light border-bottom-0 py-2">
-                <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
-                    <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
-                    {DIVISION_LABEL[targetDivision]} 契約ランキング
-                </Modal.Title>
-            </Modal.Header>
-            <Modal.Body className="p-0">
+    const title = (
+        <>
+            <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
+            {DIVISION_LABEL[targetDivision]} 契約ランキング
+        </>
+    );
+    const body = (
+        <>
 
                 {/* 集計単位の切り替え。既定は個人別（従来の表示） */}
                 <Nav
@@ -489,7 +493,24 @@ const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffL
                         )}
                     </tbody>
                 </Table>
-            </Modal.Body>
+        </>
+    );
+
+    if (asPage) {
+        return (
+            <div className="border rounded bg-white overflow-hidden" style={{ maxWidth: '900px' }}>
+                <div className="bg-light fw-bold px-3 py-2" style={{ fontSize: '14px' }}>{title}</div>
+                {body}
+            </div>
+        );
+    }
+
+    return (
+        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered size='lg'>
+            <Modal.Header closeButton className="bg-light border-bottom-0 py-2">
+                <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>{title}</Modal.Title>
+            </Modal.Header>
+            <Modal.Body className="p-0">{body}</Modal.Body>
         </Modal>
     );
 };
diff --git a/frontend/src/components/database/DatabaseKaeru.tsx b/frontend/src/components/database/DatabaseKaeru.tsx
index 94c22e120..64d93e050 100644
--- a/frontend/src/components/database/DatabaseKaeru.tsx
+++ b/frontend/src/components/database/DatabaseKaeru.tsx
@@ -5,7 +5,7 @@ import Table from "react-bootstrap/Table";
 import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
-import CallStatusList from '../header/CallStatusList';
+import CallStatusList from '../header/callStatus/CallStatusList';
 import InformationEditKaeru from '../information/InformationEditKaeru';
 import IntegrateModal from './IntegrateModal';
 import { useIsSp } from '../../utils/isSp';
@@ -14,7 +14,7 @@ import { useDebounce } from './useDebounce';
 import { kataToHira, staffOptionsOf } from './databaseUtils';
 import { thisYear } from '../../utils/thisYear';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
-import { sortStaff } from '../header/useAmbassadorMaster';
+import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
 import { GiftDot, GiftLegend } from './GiftMark';
 import { CustomerNameCell, cleanCustomerName } from './customerName2';
 
diff --git a/frontend/src/components/database/DatabaseOrder.tsx b/frontend/src/components/database/DatabaseOrder.tsx
index 691fcfcc1..2a5033f7e 100644
--- a/frontend/src/components/database/DatabaseOrder.tsx
+++ b/frontend/src/components/database/DatabaseOrder.tsx
@@ -5,7 +5,7 @@ import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import SurveyList from '../Survey';
 import CancelList from '../CancelList';
-import CallStatusList from '../header/CallStatusList';
+import CallStatusList from '../header/callStatus/CallStatusList';
 import LostStatusList from '../LostStatusList';
 import InformationEdit from '../information/InformationEdit';
 import { useIsSp } from '../../utils/isSp';
@@ -16,7 +16,7 @@ import { GiftDot, GiftLegend } from './GiftMark';
 import { thisYear } from '../../utils/thisYear';
 import { missingLostFields } from '../../utils/informationUtils';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
-import { sortStaff } from '../header/useAmbassadorMaster';
+import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
 import NexusBadge from '../NexusBadge';
 import { isNexusRow } from '../../utils/nexusUtils';
 import { CustomerNameCell, cleanCustomerName } from './customerName2';
diff --git a/frontend/src/components/database/DatabaseResale.tsx b/frontend/src/components/database/DatabaseResale.tsx
index 99b311082..109d9e982 100644
--- a/frontend/src/components/database/DatabaseResale.tsx
+++ b/frontend/src/components/database/DatabaseResale.tsx
@@ -5,7 +5,7 @@ import Table from "react-bootstrap/Table";
 import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import InformationEditResale from '../information/InformationEditResale';
-import CallStatusList from '../header/CallStatusList';
+import CallStatusList from '../header/callStatus/CallStatusList';
 import IntegrateModal from './IntegrateModal';
 import { useIsSp } from '../../utils/isSp';
 import { generateULID } from '../../utils/createULID';
diff --git a/frontend/src/components/guide/GuideScreenButton.tsx b/frontend/src/components/guide/GuideScreenButton.tsx
index 19d3e76c7..ad90f6176 100644
--- a/frontend/src/components/guide/GuideScreenButton.tsx
+++ b/frontend/src/components/guide/GuideScreenButton.tsx
@@ -122,7 +122,7 @@ const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = f
                         <span id="gd_confirm_title" className="gd_confirm_title">「{name}」を開きます</span>
                         {confirming.openScreen !== null && (
                             <span className="gd_confirm_text">
-                                ダッシュボードの窓で「{confirming.openScreen}」が開いています。開くと、いまの画面は閉じるか後ろに隠れます。
+                                ダッシュボードの窓で「{confirming.openScreen}」が開いています。開くと、いまの画面は閉じるか、ほかの画面に切り替わります。
                                 <strong>保存していない内容は消えることがあります。</strong>
                             </span>
                         )}
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index e7a2c60ea..0cdf47b92 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -16,27 +16,29 @@
  *     ⚠️ ダッシュボードを `?guide_screen=名前` 付きで開き直す（Header.tsx の useGuideScreenReceiver が読む）。
  *
  * ⚠️⚠️ **ここで画面を隠すのは見た目だけ。** 権限は各画面と ② が守る。
- *   ⚠️ メニューの画面は、受け取った側（Header.tsx）が自分のメニューに出ている項目かも確かめる。
+ *   ⚠️ ヘッダーの画面は、受け取った側（useGuideScreenReceiver.ts）が headerScreens.tsx の allow でも確かめる。
  * ─────────────────────────────────────────────
  */
 
 import { GUIDE_WINDOW } from './openGuide';
 import { canEnterCategory } from '../../utils/shopAccess';
+import { headerScreenOf } from '../header/headerScreens';
 
 export type GuideDivision = 'order' | 'spec' | 'used';
 
 export interface GuideScreen {
     /** 左のメニューのページ。⚠️ 事業でページが違えば事業ごとに書く */
     route?: string | Partial<Record<GuideDivision, string>>;
-    /** ヘッダーのメニュー（`メニュー/項目`。Header.tsx の editMapping・menuMapping と同じ形） */
-    menu?: string;
-    /** ヘッダー左上の「Claudeによる分析」 */
-    claude?: true;
+    /**
+     * ヘッダーの画面（`メニュー/項目`。⚠️ 左上の「Claudeによる分析」は項目名だけ）。⚠️ headerScreens.tsx の headerScreenOf で引く。
+     * ⚠️ v2.2.241 からページ（URL は headerScreens.tsx の path）。⚠️ それまでは menu / claude でモーダルを開いていた
+     */
+    header?: string;
     /** ページのある事業（⚠️ route が文字列のとき必須。事業ごとに書いたときはそのキー）。⚠️ 無ければどの事業でも開ける */
     divisions?: GuideDivision[];
     /** 開ける権限（⚠️ 無ければ全員） */
     authority?: string[];
-    /** PC でしか開けない（⚠️ メニュー・Claude はいつも PC だけ） */
+    /** PC でしか開けない（⚠️ ヘッダーの画面はいつも PC だけ） */
     pcOnly?: true;
 }
 
@@ -67,39 +69,39 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     'マーケット情報': { route: '/market' },
     // ⚠️ v2.2.240。ヘッダーの「金利データ」（マーケット情報の右）
     '金利データ': { route: '/loanRates' },
-    // ── ヘッダーのメニュー（Header.tsx の menuMapping と同じ条件）
-    // ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけ（Header.tsx の AI_ANALYSIS_AUTHORITY と同じ）
-    'Claudeによる分析': { claude: true, authority: ['Master', 'BrandAdmin', 'Manager'] },
-    '重複反響サマリー': { menu: '反響管理/重複反響サマリー' },
-    'ブラックリスト設定': { menu: '反響管理/ブラックリスト設定' },
-    '事後アンケート': { menu: '反響管理/事後アンケート' },
-    // ⚠️ v2.2.215。Header.tsx の menuMapping と同じく全員
-    'オーナーズハウス募集': { menu: '反響管理/オーナーズハウス募集' },
-    '広告費シミュレーター': { menu: '反響管理/広告費シミュレーター', authority: ['Master'] },
-    // ⚠️ v2.2.199（広告流入トラッキング）。Header.tsx の menuMapping と同じく Master / BrandAdmin
-    'アクセス解析': { menu: '反響管理/アクセス解析', authority: ADMIN },
-    '紹介キャンペーンサマリー': { menu: '紹介キャンペーン/紹介キャンペーンサマリー' },
-    '紹介キャンペーンの反響一覧': { menu: '紹介キャンペーン/反響一覧' },
-    '月次日報': { menu: '活動サマリー/月次日報' },
-    '営業別契約率': { menu: '活動サマリー/営業別契約率', authority: ADMIN },
-    'アクションボード': { menu: '活動サマリー/アクションボード', divisions: ['order'] },
-    '契約数ランキング': { menu: '活動サマリー/契約数ランキング' },
-    '他社広告ライブラリ': { menu: '他社動向/他社広告ライブラリ' },
-    '他社資料': { menu: '他社動向/他社資料' },
-    '競合サマリー': { menu: '他社動向/競合サマリー' },
-    'Claudeによる競合分析': { menu: '他社動向/Claudeによる競合分析' },
-    '架電状況（注文営業）': { menu: '架電状況/注文営業' },
-    '架電状況（建売営業）': { menu: '架電状況/建売営業' },
-    '架電状況（中古営業）': { menu: '架電状況/中古営業' },
-    'アンバサダー管理': { menu: '公式アンバサダー/アンバサダー管理' },
-    'アンバサダーの反響一覧': { menu: '公式アンバサダー/反響一覧' },
-    '集客イベントの反響一覧': { menu: '集客イベント/反響一覧' },
-    '集客サマリー': { menu: '集客イベント/集客サマリー' },
-    'イベントの広告費入力': { menu: '集客イベント/広告費入力' },
-    '口コミ集計': { menu: 'Google口コミ/口コミ集計' },
-    '店舗編集': { menu: 'システム管理/店舗編集' },
-    'スタッフ編集・追加': { menu: 'システム管理/スタッフ編集・追加' },
-    '権限編集': { menu: 'システム管理/権限編集' },
+    // ── ヘッダーの画面（⚠️ authority・divisions は headerScreens.tsx の allow と同じ条件）
+    // ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけ（headerScreens.tsx の AI_ANALYSIS_AUTHORITY と同じ）
+    'Claudeによる分析': { header: 'Claudeによる分析', authority: ['Master', 'BrandAdmin', 'Manager'] },
+    '重複反響サマリー': { header: '反響管理/重複反響サマリー' },
+    'ブラックリスト設定': { header: '反響管理/ブラックリスト設定' },
+    '事後アンケート': { header: '反響管理/事後アンケート' },
+    // ⚠️ v2.2.215。全員
+    'オーナーズハウス募集': { header: '反響管理/オーナーズハウス募集' },
+    '広告費シミュレーター': { header: '反響管理/広告費シミュレーター', authority: ['Master'] },
+    // ⚠️ v2.2.199（広告流入トラッキング）。Master / BrandAdmin
+    'アクセス解析': { header: '反響管理/アクセス解析', authority: ADMIN },
+    '紹介キャンペーンサマリー': { header: '紹介キャンペーン/紹介キャンペーンサマリー' },
+    '紹介キャンペーンの反響一覧': { header: '紹介キャンペーン/反響一覧' },
+    '月次日報': { header: '活動サマリー/月次日報' },
+    '営業別契約率': { header: '活動サマリー/営業別契約率', authority: ADMIN },
+    'アクションボード': { header: '活動サマリー/アクションボード', divisions: ['order'] },
+    '契約数ランキング': { header: '活動サマリー/契約数ランキング' },
+    '他社広告ライブラリ': { header: '他社動向/他社広告ライブラリ' },
+    '他社資料': { header: '他社動向/他社資料' },
+    '競合サマリー': { header: '他社動向/競合サマリー' },
+    'Claudeによる競合分析': { header: '他社動向/Claudeによる競合分析' },
+    '架電状況（注文営業）': { header: '架電状況/注文営業' },
+    '架電状況（建売営業）': { header: '架電状況/建売営業' },
+    '架電状況（中古営業）': { header: '架電状況/中古営業' },
+    'アンバサダー管理': { header: '公式アンバサダー/アンバサダー管理' },
+    'アンバサダーの反響一覧': { header: '公式アンバサダー/反響一覧' },
+    '集客イベントの反響一覧': { header: '集客イベント/反響一覧' },
+    '集客サマリー': { header: '集客イベント/集客サマリー' },
+    'イベントの広告費入力': { header: '集客イベント/広告費入力' },
+    '口コミ集計': { header: 'Google口コミ/口コミ集計' },
+    '店舗編集': { header: 'システム管理/店舗編集' },
+    'スタッフ編集・追加': { header: 'システム管理/スタッフ編集・追加' },
+    '権限編集': { header: 'システム管理/権限編集' },
 };
 // GUIDE_SCREENS_END
 
@@ -129,14 +131,14 @@ const DIVISION_SUFFIX = /（(注文営業|建売営業|中古リノベ)）$/;
  * 本文に出てくる言葉 → 開ける画面の名前（v2.2.196・2026-10-16 の指示「画面の名前が出るところには開くボタン」）。
  * ⚠️ GuideMarkdown.tsx の expandMentions が `「〜」` と `[[記事]]` に使う。⚠️ 当てはまらなければ null。
  *   `顧客DB` / `反響一覧（建売営業）` … そのまま（⚠️ 末尾の事業は外す）
- *   `反響管理 → 重複反響サマリー` … ヘッダーのメニューの道順。⚠️ **menu が `反響管理/重複反響サマリー` の画面だけ**
+ *   `反響管理 → 重複反響サマリー` … ヘッダーのメニューの道順。⚠️ **header が `反響管理/重複反響サマリー` の画面だけ**
  *     （⚠️ 最後の言葉だけで探さない。`紹介キャンペーン → 反響一覧` が左のメニューの反響一覧にならないように）
  */
 export const screenNameOf = (text: string): string | null => {
     const trimmed = text.trim();
     if (/[→>＞]/.test(trimmed)) {
         const menu = trimmed.split(/\s*[→>＞]\s*/).join('/');
-        return Object.keys(GUIDE_SCREENS).find((name) => GUIDE_SCREENS[name].menu === menu) ?? null;
+        return Object.keys(GUIDE_SCREENS).find((name) => GUIDE_SCREENS[name].header === menu) ?? null;
     }
     const name = trimmed.replace(DIVISION_SUFFIX, '');
     return GUIDE_SCREENS[name] === undefined ? null : name;
@@ -149,8 +151,8 @@ const divisionsOf = (screen: GuideScreen): GuideDivision[] => {
     return [];
 };
 
-/** PC だけの画面か。⚠️ ヘッダーのメニューと Claude はスマホに出していない（Header.tsx は PC だけ描く） */
-const isPcOnly = (screen: GuideScreen): boolean => screen.pcOnly === true || screen.menu !== undefined || screen.claude === true;
+/** PC だけの画面か。⚠️ ヘッダーの画面はスマホに出していない（Header.tsx は PC だけ描く） */
+const isPcOnly = (screen: GuideScreen): boolean => screen.pcOnly === true || screen.header !== undefined;
 
 /**
  * ガイドの窓でボタンを押せるか（⚠️ 見た目だけ。権限は各画面と ② が守る）。
@@ -193,7 +195,8 @@ export const planScreen = (name: string, articleDivision: string | null, categor
         return { ok: false, message: `「${name}」は${DIVISION_LABEL[division as GuideDivision]}の画面です。担当の事業ではないため開けません。` };
     }
     let path: string | null = null;
-    if (typeof screen.route === 'string') path = screen.route;
+    if (screen.header !== undefined) path = headerScreenOf(screen.header)?.path ?? null;
+    else if (typeof screen.route === 'string') path = screen.route;
     else if (screen.route !== undefined && division !== null) path = screen.route[division] ?? null;
     return { ok: true, division, switchLabel: switching ? DIVISION_LABEL[division as GuideDivision] : null, path };
 };
@@ -266,10 +269,15 @@ export const openDashboardWithScreen = (name: string, articleDivision: string |
  * ダッシュボードの窓で開いている画面の名前（⚠️ 確認の文に使う）。⚠️ 何も開いていなければ null。
  * ⚠️ react-bootstrap のモーダルは `.modal.show` で出ている。
  * ⚠️⚠️ **要確認（DailyAction.tsx の `.da_head`）は数えない**（⚠️ 画面を移るたびに出るもので、閉じても困らない）。
+ * ⚠️ v2.2.241: ヘッダーの画面はページになったので、モーダルが無ければページの見出し（HeaderPage.tsx の `.hp_title`）を読む。
+ *   ⚠️ 入力の途中でほかのページへ移ると、保存していない内容が消えるため。
  */
 export const openScreenLabel = (): string | null => {
     const shown = Array.from(document.querySelectorAll('.modal.show')).filter((m) => m.querySelector('.da_head') === null);
-    if (shown.length === 0) return null;
+    if (shown.length === 0) {
+        const page = (document.querySelector('.hp_title')?.textContent ?? '').trim();
+        return page === '' ? null : page.slice(0, 30);
+    }
     const top = shown[shown.length - 1];
     const title = (top.querySelector('.modal-header')?.textContent ?? '').replace(/\s+/g, ' ').replace(/閉じる/g, '').trim();
     return title === '' ? '画面' : title.slice(0, 30);
diff --git a/frontend/src/components/guide/useGuideScreenReceiver.ts b/frontend/src/components/guide/useGuideScreenReceiver.ts
index e141195a1..f4552461a 100644
--- a/frontend/src/components/guide/useGuideScreenReceiver.ts
+++ b/frontend/src/components/guide/useGuideScreenReceiver.ts
@@ -2,6 +2,7 @@ import { useContext, useEffect, useRef } from 'react';
 import { useLocation, useNavigate } from 'react-router-dom';
 import AuthContext from '../../context/AuthContext';
 import { markCategoryChosen } from '../DailyAction';
+import { canOpenScreen, headerScreenOf } from '../header/headerScreens';
 import {
     DIVISION_PARAM, GUIDE_SCREENS, SCREEN_PARAM, isGuideRequest, openScreenLabel, planScreen, replyToGuide,
 } from './guideScreens';
@@ -14,18 +15,11 @@ import {
  *   1. ガイドの窓からの postMessage（status → open）
  *   2. 開き直したときの URL の目印 `?guide_screen=名前`（⚠️ 読んだら URL から消す）
  * ⚠️ ページはメニューと同じく `navigate(path, { state: { authority } })`（Menu.tsx の handleNavigate と同じ）。
+ *   ⚠️ v2.2.241 からヘッダーのメニューの画面・Claudeによる分析もページ（headerScreens.tsx）なので、同じく navigate だけ。
+ *   ⚠️ アクションボードだけは action（DailyAction を開く）。⚠️ 見られない人には開かない（headerScreens.tsx の allow）。
  * ⚠️ 事業を切り替えるときは Category.tsx の goToDashboard と同じく setCategory ＋ markCategoryChosen。
- * ⚠️ ヘッダーで開いているモーダルは先に閉じる（⚠️ 開いたままページを移ると、新しいページの上に残る）。
  * ─────────────────────────────────────────────
  */
-interface Handlers {
-    /** ヘッダーのメニューの画面を開く。⚠️ そのメニューに出ていない項目（権限が無い）なら false */
-    openMenuItem: (menu: string, item: string) => boolean;
-    openClaude: () => void;
-    /** ヘッダーが開いているモーダルを閉じる */
-    closeHeaderModals: () => void;
-}
-
 type OpenHere = (name: string, articleDivision: string | null) => string | null;
 let openHereRef: { current: OpenHere } | null = null;
 
@@ -37,30 +31,28 @@ let openHereRef: { current: OpenHere } | null = null;
 export const openGuideScreenHere: OpenHere = (name, articleDivision) =>
     openHereRef === null ? `「${name}」は開けません。画面を再読み込みしてください。` : openHereRef.current(name, articleDivision);
 
-export const useGuideScreenReceiver = (handlers: Handlers): void => {
+export const useGuideScreenReceiver = (): void => {
     const { authority, category, shopName, setCategory } = useContext(AuthContext);
     const navigate = useNavigate();
     const location = useLocation();
     // ⚠️ message の受け口は1回だけ付ける。⚠️ 最新の値は ref から読む
-    const latest = useRef({ handlers, authority, category, shopName, setCategory, navigate });
-    latest.current = { handlers, authority, category, shopName, setCategory, navigate };
+    const latest = useRef({ authority, category, shopName, setCategory, navigate });
+    latest.current = { authority, category, shopName, setCategory, navigate };
 
     /** 開く。⚠️ 開けなければ、その理由 */
     const openRef = useRef((name: string, articleDivision: string | null): string | null => {
-        const { handlers: h, authority: a, category: c, shopName: s, setCategory: setC, navigate: nav } = latest.current;
+        const { authority: a, category: c, shopName: s, setCategory: setC, navigate: nav } = latest.current;
         const plan = planScreen(name, articleDivision, c, s);
         if (!plan.ok) return plan.message;
         const screen = GUIDE_SCREENS[name];
+        // ⚠️ ヘッダーの画面は、切り替えたあとの事業で見られるかを確かめる（⚠️ 見られない項目はメニューにも出ていない）
+        const header = screen.header === undefined ? undefined : headerScreenOf(screen.header);
+        if (header && !canOpenScreen(header, { authority: a, category: plan.division ?? c })) return `「${name}」はこのアカウントでは開けません。`;
         if (plan.switchLabel !== null && plan.division !== null) {
             setC(plan.division);
             markCategoryChosen(plan.division);
         }
-        h.closeHeaderModals();
-        if (screen.claude) { h.openClaude(); return null; }
-        if (screen.menu !== undefined) {
-            const [menu, item] = screen.menu.split('/');
-            return h.openMenuItem(menu, item) ? null : `「${name}」はこのアカウントでは開けません。`;
-        }
+        if (header?.action) { header.action(); return null; }
         if (plan.path === null) return `「${name}」は開けません。`;
         nav(plan.path, { state: { authority: a } });
         return null;
diff --git a/frontend/src/components/header/DailyReports.tsx b/frontend/src/components/header/activity/DailyReports.tsx
similarity index 98%
rename from frontend/src/components/header/DailyReports.tsx
rename to frontend/src/components/header/activity/DailyReports.tsx
index d6cde6056..b96ea8ca6 100644
--- a/frontend/src/components/header/DailyReports.tsx
+++ b/frontend/src/components/header/activity/DailyReports.tsx
@@ -1,15 +1,15 @@
 import React, { useEffect, useState, useContext, useMemo } from 'react';
 import Table from 'react-bootstrap/Table';
 import Card from 'react-bootstrap/Card';
-import AuthContext from '../../context/AuthContext';
-import apiClient from '../../utils/apiClient';
-import { countRecentReports, RECENT_DAYS } from './CompetitorAnalysisReports';
-import { CLAUDE_ORANGE } from './ClaudeIcon';
+import AuthContext from '../../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import { countRecentReports, RECENT_DAYS } from '../competitor/CompetitorAnalysisReports';
+import { CLAUDE_ORANGE } from '../claude/ClaudeIcon';
 
 type Props = {
     /**
      * 「最新の他社分析」カードを押したとき（v2.2.165）。
-     * ⚠️ Header.tsx が渡す。⚠️ 同じ全画面モーダルのまま「Claudeによる競合分析」に切り替える。
+     * ⚠️ headerScreens.tsx が渡す。⚠️ v2.2.241 から「Claudeによる競合分析」のページへ移る（それまでは同じモーダルの中身を切り替えていた）。
      * ⚠️ 渡されなければカードは押せない（⚠️ 件数だけ出す）。
      */
     onOpenCompetitorReports?: () => void;
@@ -553,7 +553,7 @@ const DailyReports = ({ onOpenCompetitorReports }: Props) => {
         >
             {/*
               ⚠️ 最新の他社分析（v2.2.165）。⚠️ 日報の見出しの上に置く。
-              ⚠️ 押すと Header.tsx が「Claudeによる競合分析」に切り替える（onOpenCompetitorReports）。
+              ⚠️ 押すと「Claudeによる競合分析」のページへ移る（onOpenCompetitorReports。headerScreens.tsx）。
               ⚠️ 件数が1件以上のときだけ色を付ける（⚠️ 0件のときは控えめに出す）。
             */}
             <style>{`
diff --git a/frontend/src/components/company/RankingLoader.tsx b/frontend/src/components/header/activity/RankingLoader.tsx
similarity index 76%
rename from frontend/src/components/company/RankingLoader.tsx
rename to frontend/src/components/header/activity/RankingLoader.tsx
index ab8e4fdee..7a0e97e0b 100644
--- a/frontend/src/components/company/RankingLoader.tsx
+++ b/frontend/src/components/header/activity/RankingLoader.tsx
@@ -1,11 +1,11 @@
 import React, { useEffect, useMemo, useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import { getPeriod } from '../../utils/getPeriod';
-import { thisYear } from '../../utils/thisYear';
-import Ranking from './Ranking';
+import apiClient from '../../../utils/apiClient';
+import { getPeriod } from '../../../utils/getPeriod';
+import { thisYear } from '../../../utils/thisYear';
+import Ranking from '../../company/Ranking';
 
 /**
- * ヘッダーの「活動サマリー → 契約数ランキング」から開く（v2.2.169 新規）。
+ * ヘッダーの「活動サマリー → 契約数ランキング」のページ（v2.2.169 新規。⚠️ v2.2.241 にモーダルからページにし、company/ から移した）。
  *
  * ─────────────────────────────────────────────
  *   Ranking.tsx は自分でデータを取らない（Company.tsx から受け取る作り）。
@@ -19,28 +19,20 @@ import Ranking from './Ranking';
  *     ・achievement … そのまま
  * ─────────────────────────────────────────────
  *
- * ⚠️ 開いたときだけ取る（⚠️ ヘッダーは全画面に出ているので、開かない人の分まで取らない）。
- *   ⚠️ 一度取ったら閉じても持っておく（⚠️ 開き直すたびに取らない）。
+ * ⚠️ ページを開いたときに取る。
  */
 
 type RankingProps = React.ComponentProps<typeof Ranking>;
 
-type Props = {
-    show: boolean;
-    setShow: React.Dispatch<React.SetStateAction<boolean>>;
-};
-
-const RankingLoader = ({ show, setShow }: Props) => {
+const RankingLoader = () => {
     const [customerList, setCustomerList] = useState<RankingProps['customerList']>([]);
     const [staffList, setStaffList] = useState<RankingProps['staffList']>([]);
     const [achievement, setAchievement] = useState<RankingProps['achievement']>([]);
-    const [loaded, setLoaded] = useState(false);
 
     // ⚠️ Company.tsx の monthArray と同じ（targetYear = thisYear のとき）
     const monthArray = useMemo(() => getPeriod(Number(thisYear) - 1, 6), []);
 
     useEffect(() => {
-        if (!show || loaded) return;
         let alive = true;
         (async () => {
             try {
@@ -50,19 +42,19 @@ const RankingLoader = ({ show, setShow }: Props) => {
                 setCustomerList([...(data.contract ?? []), ...(data.contract_kaeru ?? []), ...(data.contract_resale ?? [])]);
                 setStaffList((data.staff ?? []).filter((s: { period: string }) => s.period === String(thisYear)));
                 setAchievement(data.achievement ?? []);
-                setLoaded(true);
             } catch (error) {
                 // ⚠️ 黙らない。⚠️ 取れないと表が「該当するデータがありません」のままになる
                 console.error('ランキングのデータ取得に失敗しました:', error);
             }
         })();
         return () => { alive = false; };
-    }, [show, loaded]);
+    }, []);
 
     return (
         <Ranking
-            showRanking={show}
-            setShowRanking={setShow}
+            showRanking
+            setShowRanking={() => undefined}
+            asPage
             customerList={customerList}
             monthArray={monthArray}
             staffList={staffList}
diff --git a/frontend/src/components/header/StaffContractRate.tsx b/frontend/src/components/header/activity/StaffContractRate.tsx
similarity index 99%
rename from frontend/src/components/header/StaffContractRate.tsx
rename to frontend/src/components/header/activity/StaffContractRate.tsx
index d2b72e62e..c4805a83e 100644
--- a/frontend/src/components/header/StaffContractRate.tsx
+++ b/frontend/src/components/header/activity/StaffContractRate.tsx
@@ -1,6 +1,6 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import Form from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 /**
  * 営業別の契約率（ヘッダー → 日報 → 営業別契約率）。
@@ -26,7 +26,7 @@ import apiClient from '../../utils/apiClient';
  *
  * ⚠️ 見た目は GoogleReview.tsx に合わせてある（⚠️ 並べ替えは見出しクリック）。
  * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の一覧に入れてある）。
- *   ⚠️ ⚠️ **閉じるボタンは Modal.Header が出すので、ここには作らないこと。** 二重になる。
+ *   ⚠️ ⚠️ **閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。ここにも作らないこと。** 二重になる。
  * ─────────────────────────────────────────────
  */
 
diff --git a/frontend/src/components/header/AmbassadorList.tsx b/frontend/src/components/header/ambassador/AmbassadorList.tsx
similarity index 99%
rename from frontend/src/components/header/AmbassadorList.tsx
rename to frontend/src/components/header/ambassador/AmbassadorList.tsx
index 563bdf068..36feef61d 100644
--- a/frontend/src/components/header/AmbassadorList.tsx
+++ b/frontend/src/components/header/ambassador/AmbassadorList.tsx
@@ -1,8 +1,8 @@
 import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
 import { Table, Badge, Button, Form, Modal } from 'react-bootstrap';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
-import InformationEdit from '../information/InformationEdit';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import InformationEdit from '../../information/InformationEdit';
 import { ambassadorLpUrl, copyToClipboard, instagramUrl } from './ambassadorLinks';
 import { useAmbassadorMaster } from './useAmbassadorMaster';
 import { buildStages, rate } from './ambassadorKpi';
diff --git a/frontend/src/components/header/InquiryAmbassador.tsx b/frontend/src/components/header/ambassador/InquiryAmbassador.tsx
similarity index 99%
rename from frontend/src/components/header/InquiryAmbassador.tsx
rename to frontend/src/components/header/ambassador/InquiryAmbassador.tsx
index 129988510..0232e492c 100644
--- a/frontend/src/components/header/InquiryAmbassador.tsx
+++ b/frontend/src/components/header/ambassador/InquiryAmbassador.tsx
@@ -1,9 +1,9 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import { Table, Badge, Button, Form } from 'react-bootstrap';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import { useAmbassadorMaster } from './useAmbassadorMaster';
-import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from './divisions';
-import type { DivisionKey } from './divisions';
+import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from '../divisions';
+import type { DivisionKey } from '../divisions';
 
 /**
  * アンバサダー経由の反響一覧。閲覧と同期処理を行う。
diff --git a/frontend/src/components/header/ambassadorKpi.ts b/frontend/src/components/header/ambassador/ambassadorKpi.ts
similarity index 100%
rename from frontend/src/components/header/ambassadorKpi.ts
rename to frontend/src/components/header/ambassador/ambassadorKpi.ts
diff --git a/frontend/src/components/header/ambassadorLinks.ts b/frontend/src/components/header/ambassador/ambassadorLinks.ts
similarity index 100%
rename from frontend/src/components/header/ambassadorLinks.ts
rename to frontend/src/components/header/ambassador/ambassadorLinks.ts
diff --git a/frontend/src/components/header/useAmbassadorMaster.ts b/frontend/src/components/header/ambassador/useAmbassadorMaster.ts
similarity index 98%
rename from frontend/src/components/header/useAmbassadorMaster.ts
rename to frontend/src/components/header/ambassador/useAmbassadorMaster.ts
index 7d5b63354..606e8ef7d 100644
--- a/frontend/src/components/header/useAmbassadorMaster.ts
+++ b/frontend/src/components/header/ambassador/useAmbassadorMaster.ts
@@ -1,9 +1,9 @@
 import { useCallback, useEffect, useMemo, useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import { DIVISION_KEYS, SHOP_DIVISION } from './divisions';
-import { positions } from '../../utils/positions';
+import apiClient from '../../../utils/apiClient';
+import { DIVISION_KEYS, SHOP_DIVISION } from '../divisions';
+import { positions } from '../../../utils/positions';
 // ⚠️ 年度の判定はここに寄せる。画面ごとに再実装しないこと（下の thisYear 参照）
-import { thisYear as fiscalYear } from '../../utils/thisYear';
+import { thisYear as fiscalYear } from '../../../utils/thisYear';
 
 /**
  * 反響画面の店舗・担当営業マスタ。
diff --git a/frontend/src/components/header/CallStatusList.tsx b/frontend/src/components/header/callStatus/CallStatusList.tsx
similarity index 99%
rename from frontend/src/components/header/CallStatusList.tsx
rename to frontend/src/components/header/callStatus/CallStatusList.tsx
index 06eaa5917..2a20a3a6f 100644
--- a/frontend/src/components/header/CallStatusList.tsx
+++ b/frontend/src/components/header/callStatus/CallStatusList.tsx
@@ -4,11 +4,11 @@ import Modal from 'react-bootstrap/Modal';
 import Form from 'react-bootstrap/Form';
 import Badge from 'react-bootstrap/Badge';
 import Spinner from 'react-bootstrap/Spinner';
-import apiClient from '../../utils/apiClient';
-import { staffSorter } from '../../utils/staffSorter';
-import { getYearMonthArray } from '../../utils/getYearMonthArray';
-import { thisYear } from '../../utils/thisYear';
-import AuthContext from '../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import { staffSorter } from '../../../utils/staffSorter';
+import { getYearMonthArray } from '../../../utils/getYearMonthArray';
+import { thisYear } from '../../../utils/thisYear';
+import AuthContext from '../../../context/AuthContext';
 
 
 // --- Types ---
diff --git a/frontend/src/components/header/ClaudeAnalysis.tsx b/frontend/src/components/header/claude/ClaudeAnalysis.tsx
similarity index 96%
rename from frontend/src/components/header/ClaudeAnalysis.tsx
rename to frontend/src/components/header/claude/ClaudeAnalysis.tsx
index 98deb9df2..363764319 100644
--- a/frontend/src/components/header/ClaudeAnalysis.tsx
+++ b/frontend/src/components/header/claude/ClaudeAnalysis.tsx
@@ -1,6 +1,6 @@
 import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
-import AuthContext from '../../context/AuthContext';
-import apiClient from '../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
 import { CLAUDE_ORANGE } from './ClaudeIcon';
 import ClaudeAnalysisResult from './ClaudeAnalysisResult';
 import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnalysisResult';
@@ -142,15 +142,11 @@ const downloadHtml = (job: Pick<Job, 'title' | 'prompt' | 'createdAt'>, body: st
 const errorMessageOf = (e: unknown, fallback: string): string =>
     (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
 
-type Props = {
-    /**
-     * 左上の「閉じる」ボタンで呼ぶ（Header.tsx がモーダルを閉じる）。
-     * ⚠️ 全画面モーダルの閉じるボタンは Header.tsx が右上に出すが、利用者の指示（2026-10-26）で左上にも置いた。
-     */
-    onClose: () => void;
-};
-
-const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
+/**
+ * ⚠️ v2.2.241 からページ（header/HeaderPage.tsx の本文に描く）。⚠️ それまでは Header.tsx の全画面モーダルで、
+ *   ⚠️ 左上に「閉じる」ボタンがあった（2026-10-26 の指示）。ページなので外した。
+ */
+const ClaudeAnalysis: React.FC = () => {
     const { authority } = useContext(AuthContext);
     const isMaster = authority === 'Master';
 
@@ -333,17 +329,13 @@ const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
     return (
         <div className="cla_wrap">
             <style>{`
-                /* ⚠️ 全画面モーダルの Modal.Body は p-0 かつ overflow: hidden（Header.tsx）。余白と高さはこちらで持つ */
+                /* ⚠️ ページの本文（HeaderPage.tsx の .hp_body）は余白なし。余白と高さはこちらで持つ */
                 .cla_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                             padding: 12px 32px 20px; box-sizing: border-box; }
                 .cla_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                              min-height: 0; flex: 1; gap: 12px; }
                 .cla_note { font-size: 11px; color: #6b7280; line-height: 1.6; }
                 .cla_head { display: flex; align-items: center; gap: 12px; }
-                .cla_close { flex: none; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #d1d5db;
-                             background: #fff; color: #4b5563; border-radius: 6px; font-size: 12px; padding: 4px 12px; cursor: pointer; }
-                .cla_close:hover { border-color: #9ca3af; color: #1f2937; }
-                .cla_close:focus-visible { outline: 2px solid ${CLAUDE_ORANGE}; outline-offset: 2px; }
                 .cla_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
                              border-radius: 8px; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-start; }
                 .cla_error button { margin-left: auto; border: 0; background: none; color: #b91c1c; cursor: pointer; }
@@ -412,10 +404,6 @@ const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
 
             <div className="cla_inner">
                 <div className="cla_head">
-                    <button type="button" className="cla_close" onClick={onClose}>
-                        <i className="fa-solid fa-xmark" aria-hidden="true" />
-                        閉じる
-                    </button>
                     <span className="cla_note">
                         分析したいことを文章で書くと、Claude がダッシュボードと同じ数字を集めて深掘りし、次の打ち手まで含めたレポートを書きます。
                         広告費の歩留まりは反響日起算、部署・店舗の歩留まりは実績日起算で数えます。
diff --git a/frontend/src/components/header/ClaudeAnalysisPrint.tsx b/frontend/src/components/header/claude/ClaudeAnalysisPrint.tsx
similarity index 100%
rename from frontend/src/components/header/ClaudeAnalysisPrint.tsx
rename to frontend/src/components/header/claude/ClaudeAnalysisPrint.tsx
diff --git a/frontend/src/components/header/ClaudeAnalysisResult.tsx b/frontend/src/components/header/claude/ClaudeAnalysisResult.tsx
similarity index 100%
rename from frontend/src/components/header/ClaudeAnalysisResult.tsx
rename to frontend/src/components/header/claude/ClaudeAnalysisResult.tsx
diff --git a/frontend/src/components/header/ClaudeIcon.tsx b/frontend/src/components/header/claude/ClaudeIcon.tsx
similarity index 93%
rename from frontend/src/components/header/ClaudeIcon.tsx
rename to frontend/src/components/header/claude/ClaudeIcon.tsx
index 3ac253699..396eeba19 100644
--- a/frontend/src/components/header/ClaudeIcon.tsx
+++ b/frontend/src/components/header/claude/ClaudeIcon.tsx
@@ -1,5 +1,5 @@
 import React from 'react';
-import ClaudeImg from '../../assets/images/claude.png';
+import ClaudeImg from '../../../assets/images/claude.png';
 
 /** Anthropic 公式のアクセントカラー。ボタンの縁取りやホバー色に使う */
 export const CLAUDE_ORANGE = '#D97757';
diff --git a/frontend/src/components/header/CompetitorAnalysisReports.tsx b/frontend/src/components/header/competitor/CompetitorAnalysisReports.tsx
similarity index 98%
rename from frontend/src/components/header/CompetitorAnalysisReports.tsx
rename to frontend/src/components/header/competitor/CompetitorAnalysisReports.tsx
index d71997622..acd4d6a80 100644
--- a/frontend/src/components/header/CompetitorAnalysisReports.tsx
+++ b/frontend/src/components/header/competitor/CompetitorAnalysisReports.tsx
@@ -1,8 +1,8 @@
 import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
-import ClaudeIcon, { CLAUDE_ORANGE } from './ClaudeIcon';
-import { toLocalDate } from '../../utils/toLocalDate';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import ClaudeIcon, { CLAUDE_ORANGE } from '../claude/ClaudeIcon';
+import { toLocalDate } from '../../../utils/toLocalDate';
 
 /**
  * Claudeによる競合分析（ヘッダー → 他社動向 → Claudeによる競合分析）。
@@ -26,7 +26,7 @@ import { toLocalDate } from '../../utils/toLocalDate';
  *       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
  *
  * ⚠️ 表が広いので Header.tsx の `isFullscreenMenu` に入れてある。
- *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
+ *   ⚠️ ⚠️ **閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。ここに実装しないこと。**
  * ─────────────────────────────────────────────
  */
 
diff --git a/frontend/src/components/header/CompetitorMaterials.tsx b/frontend/src/components/header/competitor/CompetitorMaterials.tsx
similarity index 99%
rename from frontend/src/components/header/CompetitorMaterials.tsx
rename to frontend/src/components/header/competitor/CompetitorMaterials.tsx
index c9ab29bdd..9541488e7 100644
--- a/frontend/src/components/header/CompetitorMaterials.tsx
+++ b/frontend/src/components/header/competitor/CompetitorMaterials.tsx
@@ -1,13 +1,13 @@
 import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
 import {
     PDF_CATEGORIES,
     UNSORTED_CATEGORY,
     UNSORTED_COMPANY,
     uploadCompetitorPdf,
-} from '../../utils/competitorPdfUpload';
-import type { PdfCategory } from '../../utils/competitorPdfUpload';
+} from '../../../utils/competitorPdfUpload';
+import type { PdfCategory } from '../../../utils/competitorPdfUpload';
 
 /**
  * 他社資料一覧（ヘッダー → 他社動向 → 他社資料）。
@@ -31,7 +31,7 @@ import type { PdfCategory } from '../../utils/competitorPdfUpload';
  *
  * ⚠️ 表が横に広く、フォルダも並べるので Header.tsx の `isFullscreenMenu` に
  *   入れてある。⚠️ **外すと潰れる。**
- *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
+ *   ⚠️ ⚠️ **閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。ここに実装しないこと。**
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **2026-09-21 追加: この画面から「チラシ」を登録できる**（指示）。
diff --git a/frontend/src/components/header/CompetitorSummary.tsx b/frontend/src/components/header/competitor/CompetitorSummary.tsx
similarity index 99%
rename from frontend/src/components/header/CompetitorSummary.tsx
rename to frontend/src/components/header/competitor/CompetitorSummary.tsx
index 4929dbd94..6f1507cc1 100644
--- a/frontend/src/components/header/CompetitorSummary.tsx
+++ b/frontend/src/components/header/competitor/CompetitorSummary.tsx
@@ -1,6 +1,6 @@
 import React, { useState, useMemo, useEffect } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 /**
  * 競合サマリー（ヘッダー → 他社動向 → 競合サマリー）。
diff --git a/frontend/src/components/header/MetaAdsDashboard.tsx b/frontend/src/components/header/competitor/MetaAdsDashboard.tsx
similarity index 99%
rename from frontend/src/components/header/MetaAdsDashboard.tsx
rename to frontend/src/components/header/competitor/MetaAdsDashboard.tsx
index f2567455c..83ee546f5 100644
--- a/frontend/src/components/header/MetaAdsDashboard.tsx
+++ b/frontend/src/components/header/competitor/MetaAdsDashboard.tsx
@@ -1,6 +1,6 @@
 import React, { useState, useEffect, useMemo } from 'react';
 import { Card, Table, Button, Form, Badge, ButtonGroup, InputGroup, Spinner, Pagination, Modal } from "react-bootstrap";
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import {
     AdData, summarizeByAdvertiser, summarizeByTitle, summarizeByMonth,
 } from './metaAdsUtils';
diff --git a/frontend/src/components/header/MetaAdsSummary.tsx b/frontend/src/components/header/competitor/MetaAdsSummary.tsx
similarity index 100%
rename from frontend/src/components/header/MetaAdsSummary.tsx
rename to frontend/src/components/header/competitor/MetaAdsSummary.tsx
diff --git a/frontend/src/components/header/metaAdsUtils.ts b/frontend/src/components/header/competitor/metaAdsUtils.ts
similarity index 100%
rename from frontend/src/components/header/metaAdsUtils.ts
rename to frontend/src/components/header/competitor/metaAdsUtils.ts
diff --git a/frontend/src/components/header/EventBudget.tsx b/frontend/src/components/header/event/EventBudget.tsx
similarity index 95%
rename from frontend/src/components/header/EventBudget.tsx
rename to frontend/src/components/header/event/EventBudget.tsx
index 9e02a9615..b4e04d4d8 100644
--- a/frontend/src/components/header/EventBudget.tsx
+++ b/frontend/src/components/header/event/EventBudget.tsx
@@ -1,8 +1,8 @@
 import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import apiClient from '../../utils/apiClient';
-import { filterReportShops, sortShops } from './useAmbassadorMaster';
-import type { MasterShop } from './useAmbassadorMaster';
+import apiClient from '../../../utils/apiClient';
+import { filterReportShops, sortShops } from '../ambassador/useAmbassadorMaster';
+import type { MasterShop } from '../ambassador/useAmbassadorMaster';
 
 /**
  * 集客イベントの広告費入力。
@@ -77,11 +77,6 @@ type Draft = {
     shops: string[];
 };
 
-type Props = {
-    show: boolean;
-    setShow: React.Dispatch<React.SetStateAction<boolean>>;
-};
-
 const COLOR = {
     ink: '#303030',
     sub: '#6b7280',
@@ -190,7 +185,11 @@ const emptyDraft = (): Draft => ({
     shops: []
 });
 
-const EventBudget = ({ show, setShow }: Props) => {
+/**
+ * 広告費入力（ヘッダーの「集客イベント → 広告費入力」・集客サマリーの上の「広告費入力」）。
+ * ⚠️ v2.2.241 からページ（header/HeaderPage.tsx の本文に描く）。⚠️ それまでは自前のモーダル（xl）だった。
+ */
+const EventBudget = () => {
     const [shops, setShops] = useState<BudgetShop[]>([]);
     const [events, setEvents] = useState<BudgetEvent[]>([]);
 
@@ -232,17 +231,16 @@ const EventBudget = ({ show, setShow }: Props) => {
         }
     }, []);
 
+    // ⚠️ ページを開いたときに取る
     useEffect(() => {
-        if (!show) return;
-        setDone('');
         void load();
-    }, [show, load]);
+    }, [load]);
 
     /**
      * 店舗の並び。
      *
      * ⚠️ **既存の filterReportShops / sortShops をそのまま使う**
-     *   （components/header/useAmbassadorMaster.ts）。
+     *   （components/header/ambassador/useAmbassadorMaster.ts）。
      *   事業区分 → ブランド（KH/DJH/なごみ/2L/JH/PGH）→ id の順。
      *   ⚠️ 並べ替えの規則を複製しないこと。片方だけ直すと画面ごとに順が変わる。
      */
@@ -428,16 +426,6 @@ const EventBudget = ({ show, setShow }: Props) => {
         }
     }, [draft]);
 
-    const close = () => {
-        const dirty = draftHasInput(draft) || entries.some(isDirty);
-        // ⚠️ 入力途中で閉じると消える。必ず確認する
-        if (dirty && !window.confirm('保存していない内容があります。閉じてよろしいですか?')) return;
-        setDraft(emptyDraft());
-        setEdits({});
-        setOpenShopPicker(false);
-        setShow(false);
-    };
-
     /** 案分後の1店舗あたり金額。⚠️ 切り上げ（サーバと同じ） */
     const perShop = (): number | null => {
         const cost = Number(draft.cost);
@@ -491,28 +479,11 @@ const EventBudget = ({ show, setShow }: Props) => {
 
     return (
         <>
-            <Modal show={show} onHide={close} size="xl" centered>
-                <Modal.Header closeButton style={{ borderBottom: `1px solid ${COLOR.line}`, padding: '12px 16px' }}>
-                    <div>
-                        <div style={{ fontSize: '14px', fontWeight: 600, color: COLOR.ink, letterSpacing: '.4px' }}>
-                            広告費入力
-                        </div>
-                        <div style={{ fontSize: '11px', color: COLOR.sub, marginTop: '2px' }}>
-                            集客イベントの広告費を登録・修正します。
-                        </div>
+            {/* ⚠️ v2.2.241: ページの本文（⚠️ それまではモーダル。見出しは HeaderPage が出す。スクロールも HeaderPage の本文） */}
+            <div style={{ border: `1px solid ${COLOR.line}`, borderRadius: '6px', backgroundColor: COLOR.surfaceAlt, padding: '14px 16px' }}>
+                    <div className="mb-3" style={{ fontSize: '11px', color: COLOR.sub }}>
+                        集客イベントの広告費を登録・修正します。
                     </div>
-                </Modal.Header>
-
-                {/* ⚠️ 縦幅を確保する。行を増やすと下の「登録」ボタンまで届かなくなるため、
-                    本文の高さを決めて中でスクロールさせる */}
-                <Modal.Body
-                    style={{
-                        backgroundColor: COLOR.surfaceAlt,
-                        padding: '14px 16px',
-                        maxHeight: '80vh',
-                        overflowY: 'auto'
-                    }}
-                >
                     {error !== '' && (
                         <div
                             className="mb-3"
@@ -778,8 +749,7 @@ const EventBudget = ({ show, setShow }: Props) => {
                             </div>
                         </>
                     )}
-                </Modal.Body>
-            </Modal>
+            </div>
 
             {/*
               店舗選択。
diff --git a/frontend/src/components/header/EventList.tsx b/frontend/src/components/header/event/EventList.tsx
similarity index 96%
rename from frontend/src/components/header/EventList.tsx
rename to frontend/src/components/header/event/EventList.tsx
index ef24a6662..6a0c6a4ea 100644
--- a/frontend/src/components/header/EventList.tsx
+++ b/frontend/src/components/header/event/EventList.tsx
@@ -2,13 +2,13 @@ import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
 import { Table, Spinner, Alert, Modal } from 'react-bootstrap';
 // ⚠️ 2026-09-06 に list/ から header/ へ移動した。listUtils は list/ に残している
 //   （ListOrder / ListKaeru / ListResale も使っており、こちらへ移すと影響が広い）
-import { styles, positions ,formatToYYYYMMDD} from '../list/listUtils';
-import apiClient from '../../utils/apiClient';
-import { generateULID } from '../../utils/createULID';
-import { thisYear } from '../../utils/thisYear';
-import AuthContext from '../../context/AuthContext';
-import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
-import { syncCategoryOfShop } from './divisions';
+import { styles, positions ,formatToYYYYMMDD} from '../../list/listUtils';
+import apiClient from '../../../utils/apiClient';
+import { generateULID } from '../../../utils/createULID';
+import { thisYear } from '../../../utils/thisYear';
+import AuthContext from '../../../context/AuthContext';
+import { filterReportShops, sortShops, MasterShop } from '../ambassador/useAmbassadorMaster';
+import { syncCategoryOfShop } from '../divisions';
 
 /**
  * イベント予約1件。
@@ -240,12 +240,11 @@ const thStyle: React.CSSProperties = {
     fontSize: '11px',
 };
 
-type Props = {
-    eventSummary: boolean,
-    setEventSummary: React.Dispatch<React.SetStateAction<boolean>>
-}
-
-const EventList = ({ eventSummary, setEventSummary }: Props) => {
+/**
+ * 集客イベントの反響一覧（ヘッダーの「集客イベント → 反響一覧」）。
+ * ⚠️ v2.2.241 からページ（header/HeaderPage.tsx の本文に描く）。⚠️ それまでは自前の全画面モーダルだった。
+ */
+const EventList = () => {
     const { category } = useContext(AuthContext);
     const [data, setData] = useState<CustomerData[]>([]);
     const [loading, setLoading] = useState(false);
@@ -309,11 +308,10 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
         }
     };
 
+    // ⚠️ ページを開いたときに取る
     useEffect(() => {
-        if (eventSummary) {
-            fetchData();
-        }
-    }, [eventSummary]);
+        fetchData();
+    }, []);
 
     // ==========================================
     // 💡 追加: 外部からデータが再取得された際に、
@@ -481,7 +479,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                     setDisplayLength((prev) => (prev < total ? prev + PAGE_SIZE : prev));
                 }
             },
-            // ⚠️ 表(.table-responsive)が縦スクロールするわけではなくモーダル全体が
+            // ⚠️ 表(.table-responsive)が縦スクロールするわけではなく外側の枠全体が
             //   スクロールするため、root は既定（ビューポート）でよい。
             //   先読みして体感の待ちを減らす
             { rootMargin: '200px' }
@@ -570,7 +568,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
      * 担当店舗の選択肢。
      *
      * ⚠️⚠️ **既存の `filterReportShops` / `sortShops` をそのまま使う**
-     *   （`components/header/useAmbassadorMaster.ts`）。
+     *   （`components/header/ambassador/useAmbassadorMaster.ts`）。
      *   ⚠️ 絞り込み: `report_flag = 1`（⚠️ **管理用の擬似店舗を外す**）
      *   ⚠️ 並び替え: 事業区分 → ブランド → id
      *   ⚠️ ⚠️ **規則を写さないこと。** 片方だけ直すと画面ごとに順が変わる。
@@ -659,20 +657,15 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
 
     return (
         <>
-            <Modal show={eventSummary} onHide={() => setEventSummary(false)} fullscreen>
-                <Modal.Header closeButton className="py-2">
-                    {/* ⚠️ 複数のイベントを扱うため、特定のイベント名を書かない。
-                        どのイベントを見ているかは右上の絞り込みで示す */}
-                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>イベント予約状況</Modal.Title>
-                </Modal.Header>
-                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>
+            {/* ⚠️ v2.2.241: スクロールするのはこの枠（⚠️ それまでは全画面モーダルの Modal.Body。p-2 と背景色も同じ） */}
+            <div className="p-2" style={{ backgroundColor: '#f8f9fe', height: '100%', overflow: 'auto' }}>
 
                     {/*
                       ⚠️⚠️ 上部の操作（v2.2.166）。⚠️ 「特設URLはこちら」〜絞り込みまでを ⚠️ **上に固定する**。
-                        ⚠️ スクロールしているのは Modal.Body（fullscreen）。⚠️ Body の p-2（8px）ぶん top を上げ、
+                        ⚠️ スクロールしているのは外側の枠（v2.2.240 までは Modal.Body）。⚠️ 枠の p-2（8px）ぶん top を上げ、
                           ⚠️ 同じ色で塗って ⚠️ **固定した行の上に表がのぞかない**ようにしている。
                         ⚠️ 表（.table-responsive）より前に描くので、z-index は表の見出しより上にする。
-                      ⚠️ 絞り込みは ⚠️ **左寄せで「閉じる」の右**に並べる（ps-3 で間隔。2026-10-06 の指示）。
+                      ⚠️ 絞り込みは ⚠️ **左寄せでボタンの右**に並べる（ps-3 で間隔。2026-10-06 の指示。v2.2.241 で「閉じる」は外した）。
                         ⚠️ 並び: イベント → 店舗 → 来場予定日 → 来場予定時間 → 来場状況（来場状況は 2026-10-06 の確認で右端から移した）。
                     */}
                     <div className="d-flex flex-wrap align-items-center mb-2"
@@ -685,12 +678,9 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                                 {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                                 リロード
                             </button>
-                            <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setEventSummary(false)} disabled={loading}>
-                                <i className="fa-solid fa-xmark me-1"></i>閉じる
-                            </button>
                         </div>
 
-                        {/* 💡 絞り込み用セレクトタグ。⚠️ v2.2.166: 左寄せで「閉じる」の右へ（ps-3） */}
+                        {/* 💡 絞り込み用セレクトタグ。⚠️ v2.2.166: 左寄せでボタンの右へ（ps-3） */}
                         <div className="d-flex flex-wrap gap-2 align-items-center ps-3">
                             {/* ⚠️ イベントを変えると来場予定日・時間も戻す（changeEvent の注記参照） */}
                             <select style={{ ...compactInputStyle, width: 'auto' }} value={targetEvent} onChange={(e) => changeEvent(e.target.value)}>
@@ -931,8 +921,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                             </tbody>
                         </Table>
                     </div>
-                </Modal.Body>
-            </Modal>
+            </div>
 
             {/* 💡 追加: 担当者選択モーダル */}
             <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
diff --git a/frontend/src/components/header/EventSummary.tsx b/frontend/src/components/header/event/EventSummary.tsx
similarity index 99%
rename from frontend/src/components/header/EventSummary.tsx
rename to frontend/src/components/header/event/EventSummary.tsx
index e0043707b..a07dab37c 100644
--- a/frontend/src/components/header/EventSummary.tsx
+++ b/frontend/src/components/header/event/EventSummary.tsx
@@ -1,9 +1,9 @@
 import React, { useContext, useEffect, useMemo, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import Table from 'react-bootstrap/Table';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
-import InformationEdit from '../information/InformationEdit';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import InformationEdit from '../../information/InformationEdit';
 
 /**
  * 集客サマリー。
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/event/FestaDashboard.tsx
similarity index 97%
rename from frontend/src/components/header/FestaDashboard.tsx
rename to frontend/src/components/header/event/FestaDashboard.tsx
index 4d06ebc9d..2cdeb4c2f 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/event/FestaDashboard.tsx
@@ -1,13 +1,13 @@
 import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
 import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
-import { styles, positions, formatToYYYYMMDD } from '../list/listUtils';
-import apiClient from '../../utils/apiClient';
-import { generateULID } from '../../utils/createULID';
-import { thisYear } from '../../utils/thisYear';
-import AuthContext from '../../context/AuthContext';
-import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
-import { setStyleClass } from '../../utils/setStyleClass';
-import { syncCategoryOfShop } from './divisions';
+import { styles, positions, formatToYYYYMMDD } from '../../list/listUtils';
+import apiClient from '../../../utils/apiClient';
+import { generateULID } from '../../../utils/createULID';
+import { thisYear } from '../../../utils/thisYear';
+import AuthContext from '../../../context/AuthContext';
+import { filterReportShops, sortShops, MasterShop } from '../ambassador/useAmbassadorMaster';
+import { setStyleClass } from '../../../utils/setStyleClass';
+import { syncCategoryOfShop } from '../divisions';
 
 /**
  * おうちづくりフェスタ2026（v2.2.172 新規）。ヘッダー → 集客イベント → おうちづくりフェスタ2026。
@@ -346,12 +346,11 @@ const stickyStyle = (i: number): React.CSSProperties => ({
 /** 表の列数（同期〜担当営業の11列（⚠️ v2.2.173 で相談内容、v2.2.178 で備考を追加・ストラップとチケットを1列に） ＋ 営業入力 7ブランド×2） */
 const COLUMN_COUNT = 11 +FESTA_BRANDS.length * FESTA_KINDS.length;
 
-type Props = {
-    show: boolean;
-    setShow: React.Dispatch<React.SetStateAction<boolean>>;
-};
-
-const FestaDashboard = ({ show, setShow }: Props) => {
+/**
+ * おうちづくりフェスタ2026（ヘッダーの「集客イベント → おうちづくりフェスタ2026」）。
+ * ⚠️ v2.2.241 からページ（header/HeaderPage.tsx の本文に描く）。⚠️ それまでは自前の全画面モーダルだった。
+ */
+const FestaDashboard = () => {
     const { category } = useContext(AuthContext);
     const [data, setData] = useState<FestaRow[]>([]);
     const [loading, setLoading] = useState(false);
@@ -416,10 +415,10 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         }
     }, [category]);
 
-    // ⚠️ 開いたときに取る（⚠️ ヘッダーは全画面に出ているので、開かない人の分まで取らない）
+    // ⚠️ ページを開いたときに取る
     useEffect(() => {
-        if (show) void fetchData();
-    }, [show, fetchData]);
+        void fetchData();
+    }, [fetchData]);
 
     // ⚠️ 取り直したら、入力欄（defaultValue）の表示も新しい値にそろえる（EventList.tsx と同じ）
     useEffect(() => {
@@ -575,7 +574,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         const current = loaderRef.current;
         if (current) observer.observe(current);
         return () => { if (current) observer.unobserve(current); };
-    }, [filtered.length, show]);
+    }, [filtered.length]);
 
     const visible = useMemo(() => filtered.slice(0, displayLength), [filtered, displayLength]);
 
@@ -596,12 +595,11 @@ const FestaDashboard = ({ show, setShow }: Props) => {
     const hasData = data.length > 0;
 
     useEffect(() => {
-        if (!show) return;
         const measure = () => {
             const body = bodyRef.current;
             const top = topRef.current;
             if (body && top) {
-                // ⚠️ 16px … Modal.Body の上下の余白（p-2）。⚠️ 下限 240px（⚠️ 狭い画面でも数行は見える）
+                // ⚠️ 16px … 外側の枠の上下の余白（p-2。v2.2.240 までは Modal.Body）。⚠️ 下限 240px（⚠️ 狭い画面でも数行は見える）
                 setTableMaxHeight(Math.max(240, body.clientHeight - top.offsetHeight - 16));
             }
             const rows = theadRef.current ? Array.from(theadRef.current.rows) : [];
@@ -618,7 +616,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
             observer.disconnect();
             window.removeEventListener('resize', measure);
         };
-    }, [show, hasData, loading]);
+    }, [hasData, loading]);
 
     // --- 保存 ---
 
@@ -801,11 +799,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
 
     return (
         <>
-            <Modal show={show} onHide={() => setShow(false)} fullscreen>
-                <Modal.Header closeButton className="py-2">
-                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>{FESTA_TITLE}</Modal.Title>
-                </Modal.Header>
-                <Modal.Body ref={bodyRef} className="p-2" style={{ backgroundColor: '#f8f9fe' }}>
+            {/* ⚠️ v2.2.241: スクロールするのはこの枠（⚠️ それまでは全画面モーダルの Modal.Body。p-2 と背景色も同じ） */}
+            <div ref={bodyRef} className="p-2" style={{ backgroundColor: '#f8f9fe', height: '100%', overflow: 'auto' }}>
                     <style>{`
                         .fe_sum_wrap { overflow-x: auto; }
                         .fe_sum { border-collapse: collapse; font-size: 11px; white-space: nowrap; }
@@ -891,9 +886,6 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                             リロード
                         </button>
-                        <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setShow(false)}>
-                            <i className="fa-solid fa-xmark me-1"></i>閉じる
-                        </button>
                         <input
                             style={{ ...inputStyle, width: '220px', marginLeft: '12px' }}
                             placeholder="お名前・ふりがなで検索"
@@ -1240,8 +1232,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             </tbody>
                         </Table>
                     </div>
-                </Modal.Body>
-            </Modal>
+            </div>
 
             {/* 担当者選択モーダル（⚠️ EventList.tsx と同じ） */}
             <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
diff --git a/frontend/src/components/header/AfterInterview.tsx b/frontend/src/components/header/inquiry/AfterInterview.tsx
similarity index 99%
rename from frontend/src/components/header/AfterInterview.tsx
rename to frontend/src/components/header/inquiry/AfterInterview.tsx
index 323504b9f..e3fdf55e9 100644
--- a/frontend/src/components/header/AfterInterview.tsx
+++ b/frontend/src/components/header/inquiry/AfterInterview.tsx
@@ -1,7 +1,7 @@
 import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
 import Table from 'react-bootstrap/Table';
 import Badge from 'react-bootstrap/Badge';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import BsForm from 'react-bootstrap/Form';
 
 export interface InterviewData {
diff --git a/frontend/src/components/header/BudgetSimulator.tsx b/frontend/src/components/header/inquiry/BudgetSimulator.tsx
similarity index 99%
rename from frontend/src/components/header/BudgetSimulator.tsx
rename to frontend/src/components/header/inquiry/BudgetSimulator.tsx
index d6c22523d..9f0cc1c48 100644
--- a/frontend/src/components/header/BudgetSimulator.tsx
+++ b/frontend/src/components/header/inquiry/BudgetSimulator.tsx
@@ -2,8 +2,8 @@ import React, { useState, useMemo, useEffect, useCallback } from 'react';
 import Table from 'react-bootstrap/Table';
 import Form from 'react-bootstrap/Form';
 import Button from 'react-bootstrap/Button';
-import apiClient from '../../utils/apiClient';
-import { getYearMonthArray } from '../../utils/getYearMonthArray';
+import apiClient from '../../../utils/apiClient';
+import { getYearMonthArray } from '../../../utils/getYearMonthArray';
 import {
     AXIS_LABEL, AXIS_ORDER, DIVISION_LABEL, HP_ROW, KPI_DEFS, applyBudget, applyCountKeepUnit,
     applyUnit, canEdit, countKpis, filterCustomers, lastYearMonth, matchesMedium, mediumRows,
diff --git a/frontend/src/components/header/DuplicateInquirySummary.tsx b/frontend/src/components/header/inquiry/DuplicateInquirySummary.tsx
similarity index 99%
rename from frontend/src/components/header/DuplicateInquirySummary.tsx
rename to frontend/src/components/header/inquiry/DuplicateInquirySummary.tsx
index 8c4eb36f9..dcb9dd9e6 100644
--- a/frontend/src/components/header/DuplicateInquirySummary.tsx
+++ b/frontend/src/components/header/inquiry/DuplicateInquirySummary.tsx
@@ -1,8 +1,8 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import Form from 'react-bootstrap/Form';
 import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
-import apiClient from '../../utils/apiClient';
-import { setStyleClass } from '../../utils/setStyleClass';
+import apiClient from '../../../utils/apiClient';
+import { setStyleClass } from '../../../utils/setStyleClass';
 
 /**
  * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
diff --git a/frontend/src/components/header/EditBlackList.tsx b/frontend/src/components/header/inquiry/EditBlackList.tsx
similarity index 99%
rename from frontend/src/components/header/EditBlackList.tsx
rename to frontend/src/components/header/inquiry/EditBlackList.tsx
index 3848f707c..65498afce 100644
--- a/frontend/src/components/header/EditBlackList.tsx
+++ b/frontend/src/components/header/inquiry/EditBlackList.tsx
@@ -1,6 +1,6 @@
 import React, { useState, useEffect, useContext, useMemo } from 'react';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
 
 /**
  * ブラックリスト名簿の編集（ヘッダー → 反響管理 → ブラックリスト設定）。
@@ -26,7 +26,7 @@ import AuthContext from '../../context/AuthContext';
  * ⚠️ 2026-09-19 に SaaS 風の見た目へ作り直した（GoogleReview.tsx に合わせた）。
  *   ⚠️ 表が横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
  *     ⚠️ **外すと列が潰れて読めなくなる。**
- *   ⚠️ 閉じるボタンは Header.tsx 側が出す。⚠️ **ここに実装しないこと（二重になる）。**
+ *   ⚠️ 閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。⚠️ **ここに実装しないこと（二重になる）。**
  * ─────────────────────────────────────────────
  */
 
diff --git a/frontend/src/components/header/OwnersHouseApplication.tsx b/frontend/src/components/header/inquiry/OwnersHouseApplication.tsx
similarity index 99%
rename from frontend/src/components/header/OwnersHouseApplication.tsx
rename to frontend/src/components/header/inquiry/OwnersHouseApplication.tsx
index f4a5a7387..96d9c6d86 100644
--- a/frontend/src/components/header/OwnersHouseApplication.tsx
+++ b/frontend/src/components/header/inquiry/OwnersHouseApplication.tsx
@@ -1,7 +1,7 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import Form from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
-import { ksnapImageUrl } from '../../utils/ksnapImage';
+import apiClient from '../../../utils/apiClient';
+import { ksnapImageUrl } from '../../../utils/ksnapImage';
 
 /**
  * オーナーズハウス募集の一覧（ヘッダー → 反響管理 → オーナーズハウス募集）。（v2.2.215）
diff --git a/frontend/src/components/header/TrackingDetail.tsx b/frontend/src/components/header/inquiry/TrackingDetail.tsx
similarity index 99%
rename from frontend/src/components/header/TrackingDetail.tsx
rename to frontend/src/components/header/inquiry/TrackingDetail.tsx
index 8e87fd22f..392bf1402 100644
--- a/frontend/src/components/header/TrackingDetail.tsx
+++ b/frontend/src/components/header/inquiry/TrackingDetail.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import { Modal } from 'react-bootstrap';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 /**
  * アクセス解析の詳細（v2.2.203 新規）。TrackingSettings.tsx のサマリーで、着地ページ・流入元を押すと開く（size="lg"）。
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/inquiry/TrackingSettings.tsx
similarity index 99%
rename from frontend/src/components/header/TrackingSettings.tsx
rename to frontend/src/components/header/inquiry/TrackingSettings.tsx
index 0819f7ec5..91cc77276 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/inquiry/TrackingSettings.tsx
@@ -1,5 +1,5 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import TrackingDetail, { type DetailAxis } from './TrackingDetail';
 import TrackingVendorFunnel from './TrackingVendorFunnel';
 
@@ -23,7 +23,7 @@ import TrackingVendorFunnel from './TrackingVendorFunnel';
  * ⚠️ v2.2.232 サマリーの表の上に帯グラフ（PV・CV の割合）。流入元タブでは「業者別」（PURE GROWTH・Bander。② の vendors.ts）も出し、
  *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。⚠️ v2.2.233 業者別は国分ハウジング（brand kh）のサイトだけ（VENDOR_BRANDS）。v2.2.234 で DAY JUST HOUSE（djh）、v2.2.235 でかえるホーム（khf）を追加。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
- * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
+ * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
  * ─────────────────────────────────────────────
  */
diff --git a/frontend/src/components/header/TrackingVendorFunnel.tsx b/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
similarity index 99%
rename from frontend/src/components/header/TrackingVendorFunnel.tsx
rename to frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
index 4f62e50d7..ed2e6ad64 100644
--- a/frontend/src/components/header/TrackingVendorFunnel.tsx
+++ b/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import { Modal } from 'react-bootstrap';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 /**
  * 業者別の歩留まり（v2.2.232 新規）。アクセス解析のサマリー → 流入元 → 業者別 → 社名を押すと開く（size="lg"）。
diff --git a/frontend/src/components/header/budgetSimulatorUtils.ts b/frontend/src/components/header/inquiry/budgetSimulatorUtils.ts
similarity index 100%
rename from frontend/src/components/header/budgetSimulatorUtils.ts
rename to frontend/src/components/header/inquiry/budgetSimulatorUtils.ts
diff --git a/frontend/src/components/header/InquiryIntroductory.tsx b/frontend/src/components/header/introductory/InquiryIntroductory.tsx
similarity index 99%
rename from frontend/src/components/header/InquiryIntroductory.tsx
rename to frontend/src/components/header/introductory/InquiryIntroductory.tsx
index d1f069ce4..ce9b6a61a 100644
--- a/frontend/src/components/header/InquiryIntroductory.tsx
+++ b/frontend/src/components/header/introductory/InquiryIntroductory.tsx
@@ -1,9 +1,9 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import { Table, Badge, Button, Form } from 'react-bootstrap';
-import apiClient from '../../utils/apiClient';
-import { useAmbassadorMaster } from './useAmbassadorMaster';
-import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from './divisions';
-import type { DivisionKey } from './divisions';
+import apiClient from '../../../utils/apiClient';
+import { useAmbassadorMaster } from '../ambassador/useAmbassadorMaster';
+import { DIVISION_KEYS, SHOP_DIVISION, asDivision } from '../divisions';
+import type { DivisionKey } from '../divisions';
 
 /**
  * お友達紹介キャンペーンの反響一覧。閲覧と同期処理を行う。
diff --git a/frontend/src/components/header/IntroductorySummary.tsx b/frontend/src/components/header/introductory/IntroductorySummary.tsx
similarity index 99%
rename from frontend/src/components/header/IntroductorySummary.tsx
rename to frontend/src/components/header/introductory/IntroductorySummary.tsx
index 21ff96bf3..54143aa34 100644
--- a/frontend/src/components/header/IntroductorySummary.tsx
+++ b/frontend/src/components/header/introductory/IntroductorySummary.tsx
@@ -1,6 +1,6 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import Form from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 /**
  * 紹介キャンペーンサマリー（ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー）。v2.2.192 新規。
@@ -18,7 +18,7 @@ import apiClient from '../../utils/apiClient';
  * ⚠️ 推論の文章は出さない（AI を動かさない。数字だけ。2026-10-15 の指示）。
  * ⚠️ 見た目は GoogleReview.tsx に合わせてある。
  * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。
- *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出すので、ここには作らないこと。**
+ *   ⚠️ ⚠️ **閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。ここにも作らないこと。**
  * ─────────────────────────────────────────────
  */
 
diff --git a/frontend/src/components/header/LoanRateUpload.tsx b/frontend/src/components/header/market/LoanRateUpload.tsx
similarity index 98%
rename from frontend/src/components/header/LoanRateUpload.tsx
rename to frontend/src/components/header/market/LoanRateUpload.tsx
index 9793dd77d..629332ccc 100644
--- a/frontend/src/components/header/LoanRateUpload.tsx
+++ b/frontend/src/components/header/market/LoanRateUpload.tsx
@@ -1,6 +1,6 @@
 import React, { useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';
+import apiClient from '../../../utils/apiClient';
+import { csvToObjects, decodeCsv, parseCsv } from '../../../utils/csv';
 
 /**
  * 金利データの月の登録（v2.2.240。⚠️ Master だけ。LoanRates.tsx の上部に出す）。
diff --git a/frontend/src/components/header/LoanRates.tsx b/frontend/src/components/header/market/LoanRates.tsx
similarity index 99%
rename from frontend/src/components/header/LoanRates.tsx
rename to frontend/src/components/header/market/LoanRates.tsx
index d0f43b12e..f96189a38 100644
--- a/frontend/src/components/header/LoanRates.tsx
+++ b/frontend/src/components/header/market/LoanRates.tsx
@@ -1,7 +1,7 @@
 import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
 import { Form } from 'react-bootstrap';
-import AuthContext from '../../context/AuthContext';
-import apiClient from '../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
 import LoanRateUpload, { monthLabel } from './LoanRateUpload';
 
 /**
diff --git a/frontend/src/components/header/GoogleReview.tsx b/frontend/src/components/header/review/GoogleReview.tsx
similarity index 99%
rename from frontend/src/components/header/GoogleReview.tsx
rename to frontend/src/components/header/review/GoogleReview.tsx
index df55ca9cb..daf077eab 100644
--- a/frontend/src/components/header/GoogleReview.tsx
+++ b/frontend/src/components/header/review/GoogleReview.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import Form from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import { buildReviewShops, orderByMaster } from './googleReviewUtils';
 import type { ReviewShop, SectionMaster, ShopMaster } from './googleReviewUtils';
 
diff --git a/frontend/src/components/header/googleReviewUtils.ts b/frontend/src/components/header/review/googleReviewUtils.ts
similarity index 100%
rename from frontend/src/components/header/googleReviewUtils.ts
rename to frontend/src/components/header/review/googleReviewUtils.ts
diff --git a/frontend/src/components/header/EditAuth.tsx b/frontend/src/components/header/system/EditAuth.tsx
similarity index 99%
rename from frontend/src/components/header/EditAuth.tsx
rename to frontend/src/components/header/system/EditAuth.tsx
index 3cc92fd81..a5c304fbd 100644
--- a/frontend/src/components/header/EditAuth.tsx
+++ b/frontend/src/components/header/system/EditAuth.tsx
@@ -1,8 +1,8 @@
 import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
 import Table from 'react-bootstrap/Table';
 import BsForm from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
 
 /**
  * ログイン権限（staff テーブル）の編集画面。
diff --git a/frontend/src/components/header/EditShop.tsx b/frontend/src/components/header/system/EditShop.tsx
similarity index 99%
rename from frontend/src/components/header/EditShop.tsx
rename to frontend/src/components/header/system/EditShop.tsx
index f451ef742..655e46c35 100644
--- a/frontend/src/components/header/EditShop.tsx
+++ b/frontend/src/components/header/system/EditShop.tsx
@@ -1,9 +1,9 @@
 import React, { useState, useEffect, useContext } from 'react';
 import Table from 'react-bootstrap/Table';
 import BsForm from 'react-bootstrap/Form';
-import { headers } from '../../utils/headers';
-import AuthContext from '../../context/AuthContext';
-import apiClient from '../../utils/apiClient';
+import { headers } from '../../../utils/headers';
+import AuthContext from '../../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
 
 type Shop = Record<string, string>;
 
diff --git a/frontend/src/components/header/EditStaff.tsx b/frontend/src/components/header/system/EditStaff.tsx
similarity index 99%
rename from frontend/src/components/header/EditStaff.tsx
rename to frontend/src/components/header/system/EditStaff.tsx
index 492b2907e..968107d3a 100644
--- a/frontend/src/components/header/EditStaff.tsx
+++ b/frontend/src/components/header/system/EditStaff.tsx
@@ -1,9 +1,9 @@
 import React, { useState, useEffect, useContext, useRef } from 'react'
 import Table from 'react-bootstrap/Table';
 import BsForm from 'react-bootstrap/Form';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
-import { getYears } from '../../utils/getYears';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
+import { getYears } from '../../../utils/getYears';
 
 /**
  * 人事マスタ（staff_list テーブル）の編集画面。
diff --git a/frontend/src/components/header/UploadLoan.tsx b/frontend/src/components/header/system/UploadLoan.tsx
similarity index 88%
rename from frontend/src/components/header/UploadLoan.tsx
rename to frontend/src/components/header/system/UploadLoan.tsx
index b277b5190..b05ebb29d 100644
--- a/frontend/src/components/header/UploadLoan.tsx
+++ b/frontend/src/components/header/system/UploadLoan.tsx
@@ -1,7 +1,6 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
-import Modal from 'react-bootstrap/Modal';
-import apiClient from '../../utils/apiClient';
-import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';
+import apiClient from '../../../utils/apiClient';
+import { csvToObjects, decodeCsv, parseCsv } from '../../../utils/csv';
 
 /**
  * ローン情報更新（v2.2.168 新規）。ヘッダーの「システム管理 → ローン情報更新」から開く。
@@ -17,15 +16,10 @@ import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';
  *   テンプレート: frontend/public/templates/loan_rate_template.csv
  * ─────────────────────────────────────────────
  *
- * ⚠️ 自前のモーダルを持つ（⚠️ Header の共通モーダル（xl）には載せない。二重になる）。
- * ⚠️ 大きさは react-bootstrap の既定（＝ md）。⚠️ `size` に 'md' は渡せない（型が sm / lg / xl のみ）。
+ * ⚠️ v2.2.241 からページ（header/HeaderPage.tsx の本文に描く）。⚠️ それまでは自前のモーダル（md）だった。
+ *   ⚠️ 幅は以前のモーダルと同じくらい（最大 520px）にそろえている。
  */
 
-type Props = {
-    show: boolean;
-    setShow: React.Dispatch<React.SetStateAction<boolean>>;
-};
-
 /** ② の loan_rate_latest が返す1商品（⚠️ 差分の表示に使う列だけ） */
 type LatestLoan = {
     id: string;
@@ -75,7 +69,7 @@ const validateRecord = (r: Record<string, string>): string | null => {
     return null;
 };
 
-const UploadLoan = ({ show, setShow }: Props) => {
+const UploadLoan = () => {
     const [baseDate, setBaseDate] = useState(today);
     const [latest, setLatest] = useState<LatestLoan[]>([]);
     const [latestAsof, setLatestAsof] = useState('');
@@ -97,17 +91,10 @@ const UploadLoan = ({ show, setShow }: Props) => {
         }
     }, []);
 
-    // ⚠️ 開くたびに初期化する（⚠️ 前回のファイルが残っていると、誤って同じ内容を登録しかねない）
+    // ⚠️ ページを開いたときに取る（⚠️ 入力欄はページを開くたびに空から始まる）
     useEffect(() => {
-        if (!show) return;
-        setBaseDate(today());
-        setFileName('');
-        setRecords([]);
-        setErrors([]);
-        setFileError('');
-        setResult(null);
         loadLatest();
-    }, [show, loadLatest]);
+    }, [loadLatest]);
 
     const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
         const file = e.target.files?.[0];
@@ -193,15 +180,7 @@ const UploadLoan = ({ show, setShow }: Props) => {
     };
 
     return (
-        <Modal show={show} onHide={() => setShow(false)} centered>
-            <Modal.Header closeButton className="py-2">
-                <Modal.Title style={{ fontSize: '15px' }} className="fw-bold">
-                    <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
-                    ローン情報更新
-                </Modal.Title>
-            </Modal.Header>
-
-            <Modal.Body style={{ fontSize: '13px' }}>
+        <div className="border rounded bg-white p-3" style={{ fontSize: '13px', maxWidth: '520px' }}>
                 <div className="text-muted mb-3" style={{ fontSize: '12px' }}>
                     現在の金利の基準日: <b>{latestAsof || '－'}</b>（{latest.length}商品）
                     <div className="mt-1 d-flex flex-wrap gap-3">
@@ -267,15 +246,12 @@ const UploadLoan = ({ show, setShow }: Props) => {
                 {result && (
                     <div className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} py-2 mb-0`}>{result.message}</div>
                 )}
-            </Modal.Body>
-
-            <Modal.Footer className="py-2">
-                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShow(false)}>閉じる</button>
+            <div className="d-flex justify-content-end mt-3">
                 <button type="button" className="btn btn-sm btn-primary" disabled={!canSubmit} onClick={submit}>
                     {submitting ? '登録中…' : '登録して確定'}
                 </button>
-            </Modal.Footer>
-        </Modal>
+            </div>
+        </div>
     );
 };
 
diff --git a/frontend/src/components/header/SatBaseDatabase.tsx b/frontend/src/components/header/unused/SatBaseDatabase.tsx
similarity index 99%
rename from frontend/src/components/header/SatBaseDatabase.tsx
rename to frontend/src/components/header/unused/SatBaseDatabase.tsx
index c59afa1e9..1e9ed2b8a 100644
--- a/frontend/src/components/header/SatBaseDatabase.tsx
+++ b/frontend/src/components/header/unused/SatBaseDatabase.tsx
@@ -1,6 +1,6 @@
 import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
-import apiClient from '../../utils/apiClient';
-import AuthContext from '../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import AuthContext from '../../../context/AuthContext';
 import SatBaseImport from './SatBaseImport';
 
 /**
@@ -26,7 +26,7 @@ import SatBaseImport from './SatBaseImport';
  *   ⚠️ 中身は SatBaseImport.tsx。⚠️ 反映したら一覧を取り直す（`loadProperties`）。
  *
  * ⚠️ 表が横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
- *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
+ *   ⚠️ ⚠️ **閉じるボタンは無い（v2.2.241 からページ。HeaderPage.tsx）。ここに実装しないこと。**
  * ─────────────────────────────────────────────
  */
 
diff --git a/frontend/src/components/header/SatBaseImport.tsx b/frontend/src/components/header/unused/SatBaseImport.tsx
similarity index 99%
rename from frontend/src/components/header/SatBaseImport.tsx
rename to frontend/src/components/header/unused/SatBaseImport.tsx
index e5d0e2cac..74d55af82 100644
--- a/frontend/src/components/header/SatBaseImport.tsx
+++ b/frontend/src/components/header/unused/SatBaseImport.tsx
@@ -1,7 +1,7 @@
 import React, { useEffect, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import apiClient from '../../utils/apiClient';
-import { decodeCsv, parseCsv } from '../../utils/csv';
+import apiClient from '../../../utils/apiClient';
+import { decodeCsv, parseCsv } from '../../../utils/csv';
 
 /**
  * 物件更新（v2.2.170 新規）。SatBaseサマリー（SatBaseDatabase.tsx）の「物件更新」から開く。
diff --git a/frontend/src/components/header/SyncEstate.tsx b/frontend/src/components/header/unused/SyncEstate.tsx
similarity index 93%
rename from frontend/src/components/header/SyncEstate.tsx
rename to frontend/src/components/header/unused/SyncEstate.tsx
index b46b7e1fa..cba9942d4 100644
--- a/frontend/src/components/header/SyncEstate.tsx
+++ b/frontend/src/components/header/unused/SyncEstate.tsx
@@ -1,7 +1,7 @@
 import React, { useEffect, useState } from 'react';
 import axios from 'axios';
-import { baseURL } from '../../utils/baseURL';
-import { headers } from '../../utils/headers';
+import { baseURL } from '../../../utils/baseURL';
+import { headers } from '../../../utils/headers';
 
 type Props = {
     setModal: React.Dispatch<React.SetStateAction<boolean>>
diff --git a/frontend/src/components/shop/ShopKaeru.tsx b/frontend/src/components/shop/ShopKaeru.tsx
index 52f30395f..0d936c00f 100644
--- a/frontend/src/components/shop/ShopKaeru.tsx
+++ b/frontend/src/components/shop/ShopKaeru.tsx
@@ -7,7 +7,7 @@ import UnitPriceGraphModal from './UnitPriceGraphModal';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { toLocalDate } from '../../utils/toLocalDate';
 import apiClient from '../../utils/apiClient';
-import { sortShops } from '../header/useAmbassadorMaster';
+import { sortShops } from '../header/ambassador/useAmbassadorMaster';
 import { UNIT_PRICE_SERIES_SPEC } from './unitPriceSeries';
 // ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
 import { RankingStyle, SortIcon } from '../rankingUi';
diff --git a/frontend/src/components/shop/ShopOrder.tsx b/frontend/src/components/shop/ShopOrder.tsx
index 76fcef242..6fbb948ac 100644
--- a/frontend/src/components/shop/ShopOrder.tsx
+++ b/frontend/src/components/shop/ShopOrder.tsx
@@ -7,7 +7,7 @@ import UnitPriceGraphModal from './UnitPriceGraphModal';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { toLocalDate } from '../../utils/toLocalDate';
 import apiClient from '../../utils/apiClient';
-import { sortShops } from '../header/useAmbassadorMaster';
+import { sortShops } from '../header/ambassador/useAmbassadorMaster';
 import { UNIT_PRICE_SERIES } from './unitPriceSeries';
 // ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
 import { RankingStyle, SortIcon } from '../rankingUi';
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 47a02ddf0..4dfbf13f1 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.240';
+export const newVersion = '2.2.241';
```
