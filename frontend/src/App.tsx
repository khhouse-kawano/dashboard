import React, { Suspense, lazy, useEffect, useState } from "react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Calendar from "./components/calendar/Calendar";
import Category from "./components/Category";
import DailyAction from "./components/DailyAction";
import ShopRouter from './components/shop/ShopRouter';
import BudgetAccounting from "./components/BudgetAccounting";
import DatabaseRouter from "./components/database/DatabaseRouter";
import DatabaseProperty from "./components/database/DatabaseProperty";
import RankRouter from "./components/rank/RankRouter";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/customer/CustomerRouter";
import { ShopTrendRouter } from "./components/shopTrend/ShopTrendRouter";
import Company from "./components/company/Company";
import NewCampaign from "./components/campaign/NewCampaign";
import ListRouter from "./components/list/ListRouter";
import Photo from "./components/photo/Photo";
import Hab from "./components/Hab";
import BudgetKaeru from "./components/BudgetKaeru";
import Market from "./components/Market";
import LoanRates from "./components/header/market/LoanRates";
import Login from "./components/Login";
import KengakuCloud from "./components/KengakuCloud";
import ActiveUser from "./components/ActiveUser";
import { GoogleMapContext } from "./context/GoogleMapContext";
import { useJsApiLoader } from "@react-google-maps/api";
import MenuD from "./components/Menu";
import Dev from "./components/Dev";
import Header from "./components/header/Header";
import HeaderPage from "./components/header/HeaderPage";
import { HEADER_SCREENS } from "./components/header/headerScreens";
import CustomerTrendRouter from "./components/customerTrend/CustomerTrendRouter";
import MapRouter from "./components/map/MapRouter";
import { useIsSp } from './utils/isSp';
import CampaignRouter from './components/campaign/CampaignRouter';
import DatabaseBroker from "./components/database/DatabaseBroker";
import InsideSales from "./components/insideSales/InsideSales";
// ⚠️ v2.2.221: 不動産企画係（category = realty）の画面は components/realty にまとめた
import RealtyRoute from "./components/realty/RealtyRoute";
import Summary from "./components/realty/summary/Summary";
import MonthlySalesReport from "./components/realty/report/MonthlySalesReport";
import LeadSell from "./components/realty/sell/LeadSell";
import LeadBuy from "./components/realty/buy/LeadBuy";
import LeadOpportunity from "./components/realty/deals/LeadOpportunity";
import LeadResale from "./components/realty/resale/LeadResale";
import WeeklyPlan from "./components/realty/weekly/WeeklyPlan";
import Compliance from "./components/realty/compliance/Compliance";
import RealtySettings from "./components/realty/settings/RealtySettings";
import MonthlySales from "./components/realty/sales/MonthlySales";
import BaikaiMonthly from "./components/realty/bmonthly/BaikaiMonthly";
import LostAnalysis from "./components/realty/lost/LostAnalysis";
import RealtyPending from "./components/realty/RealtyPending";
import CallQueue from "./components/realty/callq/CallQueue";
import CallNavi from "./components/realty/navi/CallNavi";
import UsedCallQueue from "./components/callq/UsedCallQueue";
import Guide from "./components/guide/Guide";
import SharedReportView from "./components/report/SharedReportView";

// ⚠️ v2.2.262: 不動産企画係の営業手順書は画像が多いので、開いたときだけ読み込む
const RealtyManual = lazy(() => import("./components/realty/manual/RealtyManual"));

const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];

export default function App() {
  const clientId = process.env.REACT_APP_CLIENT_ID;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <GoogleMapContext.Provider value={{ isLoaded }}>
      <GoogleOAuthProvider clientId={clientId || ""}>
        <Router basename="/dashboard">
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </Router>
      </GoogleOAuthProvider>
    </GoogleMapContext.Provider>
  );
}

function AppInner() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuKey, setMenuKey] = useState(0);
  const reload = () => {
    setMenuKey(prev => prev + 1);
  };
  const isSp = useIsSp();

  useEffect(() => {
    if (!isSp) return;
    setOpen(true);
  }, []);

  /**
   * ⚠️⚠️ **業務ガイド（v2.2.194）は別ウインドウで開く専用の画面。**
   *   ⚠️ ヘッダー・メニュー・アクティブユーザー・要確認を出さない（⚠️ 出すとガイドの窓にも二重に出る）。
   *   ⚠️ ログイン確認（AuthProvider）はほかの画面と同じく効く。
   */
  //   ⚠️ 記事は `/guide?id=12`（⚠️ `/guide/12` にすると再読み込みで真っ白になる。Guide.tsx の説明）。
  if (currentPath === '/guide') {
    return (
      <Routes>
        <Route path="/guide" element={<Guide />} />
      </Routes>
    );
  }

  // ⚠️ v2.2.268: 共有したレポート（`/report?k=…`）も業務ガイドと同じく、ヘッダー・メニューを出さない全画面。
  //   ⚠️ ログイン確認（AuthProvider）は効く（未ログインならログイン画面へ移り、ログイン後に戻る）
  if (currentPath === '/report') {
    return (
      <Routes>
        <Route path="/report" element={<SharedReportView />} />
      </Routes>
    );
  }


  return (
    <>
      <ActiveUser />
      {/*
        ⚠️⚠️ **「要確認」モーダル（2026-09-28）。**
          ⚠️ ⚠️ **ここに1つだけ置くこと。** MenuD は **PC用とSP用で2回**描画されるので、
            ⚠️ Menu.tsx の中に置くと**モーダルが二重に出る。**
          ⚠️ ⚠️ **ActiveUser と同じ並びに置く**（2026-09-28）。
            ⚠️ あちらの「要確認」ボタンは `/home` でも出るので、
            ⚠️ **メニューの条件の中に入れるとボタンを押しても開かない。**
          ⚠️ 出す・出さないの判定（注文営業のみ・スマホでは出さない・本日確認済みか・
            0件か・自動で出さない画面か）は **DailyAction.tsx 側が持っている。**
      */}
      <DailyAction />
      <div className='outer-container'>
        {currentPath !== '/login' && <Header key={menuKey} />}
        {/**
          * ⚠️⚠️ **ヘッダーの高さぶんだけ空ける。**
          *   Header.tsx は `position-fixed` なので場所を取らない。
          *   ⚠️ メニューが折り返すと高さが 30px → 60px と変わるため、
          *     Header.tsx が実測して `--header-h` に入れている（ResizeObserver）。
          *   ⚠️ 固定値（pt-4 = 24px）に戻すと、**折り返したときに
          *     画面の上部がヘッダーに隠れる。**
          *   ⚠️ 変数がまだ無い初回描画では既定の 30px を使う。
          */}
        <div className="d-flex" style={{ paddingTop: 'calc(var(--header-h, 30px) + 6px)' }}>
          {currentPath !== '/home' && currentPath !== '/login' && <>
            {/* PC用メニュー */}
            <div className="modal_menu">
              <MenuD key={menuKey} onReload={reload} />
            </div>

            {/* スマホ用ヘッダー */}
            <div className="header_sp">
              <i
                className="fa-solid fa-bars hamburger"
                onClick={() => setOpen(true)}
              />
            </div>

            {/* スマホ用：メニュー展開時の背景（外側タップで閉じる用） */}
            {open && (
              <div className="overlay_sp" onClick={() => setOpen(false)} />
            )}

            {/* スマホ用メニュー */}
            <div className={`modal_menu_sp ${open ? "open" : ""}`}>
              <i
                className="fa-solid fa-xmark hamburger position-absolute"
                onClick={() => setOpen(false)}
              />
              <MenuD key={menuKey} onReload={reload} />
            </div>

          </>}
          <Routes>
            <Route path="/" element={<Category />} />
            <Route path="/home" element={<Category />} />
            <Route path="/login" element={<Login />} />
            <Route path="/company" element={<Company />} />
            <Route path="/customer" element={<Customer />} />
            <Route path="/shop" element={<ShopRouter />} />
            <Route path="/shopTrend" element={<ShopTrendRouter />} />
            <Route path="/customerTrend" element={<CustomerTrendRouter />} />
            <Route path="/list" element={<ListRouter onReload={reload} />} />
            <Route path="/database" element={<DatabaseRouter onReload={reload} key={menuKey} />} />
            <Route path="/budget" element={<BudgetAccounting />} />
            <Route path="/rank" element={<RankRouter />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/campaign" element={<CampaignRouter />} />
            <Route path="/editcampaign" element={<NewCampaign />} />
            <Route path="/map" element={<MapRouter />} />
            <Route path="/specBudget" element={<BudgetKaeru />} />
            <Route path="/market" element={<Market />} />
            {/* ⚠️ v2.2.240: 金利データ（ヘッダーの「金利データ」） */}
            <Route path="/loanRates" element={<LoanRates />} />
            {/* ⚠️ v2.2.241: ヘッダーのメニューの画面（⚠️ それまではヘッダーのモーダル）。⚠️ 一覧・URL・見られる人は header/headerScreens.tsx
                ⚠️ key に path を渡す（⚠️ 渡さないと、架電状況の注文 → 建売のように同じ部品のページへ移ったとき、前の画面の状態が残って取り直さない） */}
            {HEADER_SCREENS.filter((s) => s.path).map((s) => (
              <Route key={s.path} path={s.path} element={<HeaderPage key={s.path} screen={s} />} />
            ))}
            <Route path="/property" element={<DatabaseProperty />} />
            <Route path="/photo" element={<Photo />} />
            <Route path="/kengakuCloud" element={<KengakuCloud />} />
            <Route path="/insideSales" element={<InsideSales/>} />
            {/* ⚠️ v2.2.239: 中古リノベの今日の架電キュー */}
            <Route path="/usedCallQueue" element={<UsedCallQueue />} />
            {/* ⚠️ v2.2.221: 不動産企画係の画面。⚠️ 担当事業が realty / all の人だけ（RealtyRoute）
                ⚠️⚠️ v2.2.223: URL は**1段**に戻した（v2.2.220 までと同じ）。⚠️ `/realty/summary` のような2段にしないこと。
                  index.html が画面の部品を相対パス（./static/...）で読むため、2段の URL で再読み込みすると
                  /dashboard/realty/static/... を取りに行き、HTML が返って真っ白になる（Guide.tsx の注記と同じ） */}
            <Route path="/summary" element={<RealtyRoute><Summary /></RealtyRoute>} />
            <Route path="/report" element={<RealtyRoute><MonthlySalesReport /></RealtyRoute>} />
            <Route path="/leadSell" element={<RealtyRoute><LeadSell /></RealtyRoute>} />
            <Route path="/leadBuy" element={<RealtyRoute><LeadBuy /></RealtyRoute>} />
            <Route path="/leadOpportunity" element={<RealtyRoute><LeadOpportunity /></RealtyRoute>} />
            <Route path="/leadResale" element={<RealtyRoute><LeadResale /></RealtyRoute>} />
            <Route path="/broker" element={<RealtyRoute><DatabaseBroker /></RealtyRoute>} />
            {/* ⚠️ v2.2.223: 週次行動計画・コンプライアンス・設定（本番アプリから移植） */}
            <Route path="/realtyWeekly" element={<RealtyRoute><WeeklyPlan /></RealtyRoute>} />
            <Route path="/realtyCompliance" element={<RealtyRoute><Compliance /></RealtyRoute>} />
            <Route path="/realtyManual" element={<RealtyRoute><Suspense fallback={<div className="p-3 text-secondary small">読み込み中…</div>}><RealtyManual /></Suspense></RealtyRoute>} />
            <Route path="/realtySettings" element={<RealtyRoute><RealtySettings /></RealtyRoute>} />
            {/* ⚠️ v2.2.225: 以前のアプリのメニューから移した画面・まだ移していない画面の案内（realty/RealtyMenu.tsx） */}
            <Route path="/realtySales" element={<RealtyRoute><MonthlySales /></RealtyRoute>} />
            <Route path="/realtyBaikaiMonthly" element={<RealtyRoute><BaikaiMonthly /></RealtyRoute>} />
            <Route path="/realtyLost" element={<RealtyRoute><LostAnalysis /></RealtyRoute>} />
            {/* ⚠️ v2.2.226: 今日の架電キュー・架電ナビ（一括査定） */}
            <Route path="/realtyCallQueue" element={<RealtyRoute><CallQueue /></RealtyRoute>} />
            <Route path="/realtyCallNavi" element={<RealtyRoute><CallNavi /></RealtyRoute>} />
            <Route path="/realtyPending" element={<RealtyRoute><RealtyPending /></RealtyRoute>} />
            {/* ⚠️ v2.2.221〜222 の2段の URL。⚠️ 画面の中から移ってきたときだけ効く（再読み込みは上の理由で届かない） */}
            <Route path="/realty/summary" element={<Navigate to="/summary" replace />} />
            <Route path="/realty/report" element={<Navigate to="/report" replace />} />
            <Route path="/realty/sell" element={<Navigate to="/leadSell" replace />} />
            <Route path="/realty/buy" element={<Navigate to="/leadBuy" replace />} />
            <Route path="/realty/deals" element={<Navigate to="/leadOpportunity" replace />} />
            <Route path="/realty/resale" element={<Navigate to="/leadResale" replace />} />
            <Route path="/realty/ledger" element={<Navigate to="/broker" replace />} />
            <Route path="*" element={<Category />} />

          </Routes>
        </div>
      </div>
      {/* // <AuthProvider>
    //   <Router basename="/home/">
    //     <Routes>
    //       <Route path="/" element={<Home />} />
    //       <Route path="*" element={<Home />} />
    //     </Routes>
    //   </Router>
    // </AuthProvider>
    // <AuthProvider>
    //   <Router basename="/home/">
    //     <Routes>
    //       <Route path="/" element={<Home />} />
    //       <Route path="*" element={<Home />} />
    //     </Routes>
    //   </Router>
    // </AuthProvider> */}
    </>
  );
}
