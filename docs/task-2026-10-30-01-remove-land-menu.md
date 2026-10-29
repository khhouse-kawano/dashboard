# 2026-10-30 ヘッダーの「土地・物件管理」メニューを外す（v2.2.231）

## 依頼
- 仲介物件登録（RegisterBrokerageListings）と建売の予算（BudgetKaeru）が ①ゲートウェイ・② 以外へ通信していると報告 → 「どちらも未使用の機能だった」
- header/Header.tsx から「土地・物件管理」のメニュー自体を消してよい。SatBaseサマリーのコンポーネントのみ残す
- 確認への回答: SatBaseサマリーもメニューから外す（ファイルだけ残す）／v2.2.231 を切る

## 決めたこと
- Header.tsx: MenuKey・menuArray・menuMapping の「土地・物件管理」、画面の対応表の2行、全画面の指定（SatBaseサマリー）を削除。import 2つも削除
- RegisterBrokerageListings.tsx はファイルごと削除（どこからも使われなくなった）
- SatBaseDatabase.tsx・SatBaseImport.tsx は残す（冒頭の説明に「開く口は無い」と追記）。② の satbase の処理もそのまま
- guideScreens.ts から「仲介物件登録」「SatBaseサマリー」を削除（2つを説明する業務ガイドの記事は無い）
- 建売の予算（BudgetKaeru.tsx・/specBudget）はヘッダーの外なので今回は触っていない

## 確認したこと
- トークン無しで ① に投げて 401（meta_ads:list）
- 画面（Playwright）: ヘッダーに「土地・物件管理」が無い・他社動向とシステム管理はある・他社広告ライブラリが開く。ページのエラー 0
- 本番ビルド（Header.tsx の警告 no-empty-pattern は前からのもの）
- リファクタリング: 削除だけの改修なので整理するものは無い
- テスト用の担当者は消した。開発サーバー（3100）は止めた

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | Header.tsx | 「土地・物件管理」を削除 |
| frontend/src/components/header | **RegisterBrokerageListings.tsx（削除）** | 仲介物件登録 |
| frontend/src/components/header | SatBaseDatabase.tsx | 冒頭の説明だけ |
| frontend/src/components/guide | guideScreens.ts | 2つの画面を削除 |
| frontend/src/utils | version.ts | 2.2.231 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.231.sql（新規）** | 更新履歴 |

## コード（差分）
```diff
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 61b9618d..06ff4ffd 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -92,10 +92,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '集客イベントの反響一覧': { menu: '集客イベント/反響一覧' },
     '集客サマリー': { menu: '集客イベント/集客サマリー' },
     'イベントの広告費入力': { menu: '集客イベント/広告費入力' },
     '口コミ集計': { menu: 'Google口コミ/口コミ集計' },
-    '仲介物件登録': { menu: '土地・物件管理/仲介物件登録' },
-    'SatBaseサマリー': { menu: '土地・物件管理/SatBaseサマリー' },
     '店舗編集': { menu: 'システム管理/店舗編集' },
     'スタッフ編集・追加': { menu: 'システム管理/スタッフ編集・追加' },
     '権限編集': { menu: 'システム管理/権限編集' },
 };
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 4245b03c..28eb4c66 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -13,9 +13,8 @@ import AuthContext from '../../context/AuthContext';
 import BudgetSimulator from './BudgetSimulator';
 import AfterInterview from './AfterInterview';
 import apiClient from '../../utils/apiClient';
 import CompetitorSummary from './CompetitorSummary';
-import RegisterBrokerageListings from './RegisterBrokerageListings';
 import DailyReports from './DailyReports';
 import StaffContractRate from './StaffContractRate';
 import ClaudeAnalysis from './ClaudeAnalysis';
 import ClaudeIcon from './ClaudeIcon';
@@ -23,9 +22,8 @@ import CompetitorAnalysisReports from './CompetitorAnalysisReports';
 import IntroductorySummary from './IntroductorySummary';
 import DuplicateInquirySummary from './DuplicateInquirySummary';
 import OwnersHouseApplication from './OwnersHouseApplication';
 import TrackingSettings from './TrackingSettings';
-import SatBaseDatabase from './SatBaseDatabase';
 import AmbassadorList from './AmbassadorList';
 import { InquiryAmbassador } from './InquiryAmbassador';
 import InquiryIntroductory from './InquiryIntroductory';
 import EventList from './EventList';
@@ -40,9 +38,9 @@ import { isGuideCategory, openGuide } from '../guide/openGuide';
 import { useGuideScreenReceiver } from '../guide/useGuideScreenReceiver';
 import { useNavigate } from "react-router-dom";
 
 // 型安全のための定義
-type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '活動サマリー' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
+type MenuKey = 'システム管理' | '反響管理' | '他社動向' | '架電状況' | '活動サマリー' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
 
 /**
  * 他社動向メニューの最後に出す項目。
  *
@@ -102,9 +100,9 @@ const Header = ({ }) => {
      */
     const [showRanking, setShowRanking] = useState<boolean>(false);
     const [modal, setModal] = useState<boolean>(false);
     const [callStatusShow, setCallStatusShow] = useState(true);
-    const menuArray: MenuKey[] = ['システム管理', '反響管理', '土地・物件管理', '他社動向', '活動サマリー', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
+    const menuArray: MenuKey[] = ['システム管理', '反響管理', '他社動向', '活動サマリー', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
     const [newEstate, setNewEstate] = useState<number | null>(0);
 
     const navigate = useNavigate();
     // Claudeによる分析（menuMapping とは独立した導線）
@@ -176,9 +174,11 @@ const Header = ({ }) => {
         ],
         // ⚠️⚠️ **2026-09-22 に土地情報同期・土地情報一覧をメニューから外した**（指示）。
         //   ⚠️ ⚠️ **コンポーネント（SyncEstate / Estate）は消していない。**
         //     ⚠️ Estate は顧客詳細からも開くため、消すとそちらが壊れる。
-        '土地・物件管理': ['仲介物件登録', 'SatBaseサマリー'],
+        // ⚠️⚠️ **v2.2.231（2026-10-30）に「土地・物件管理」のメニューごと外した**（指示。未使用のため）。
+        //   ⚠️ 仲介物件登録（RegisterBrokerageListings.tsx）はファイルも消した。
+        //   ⚠️ SatBaseサマリー（SatBaseDatabase.tsx・SatBaseImport.tsx）は**ファイルだけ残した**（開く口は無い）。戻すときはここと下の2か所・guideScreens.ts に足す。
         // ⚠️ 最後の1つは Claude による競合分析。
         //
         // ⚠️⚠️ **2026-10-01、Master 限定をやめて全員に出すようにした。**
         //   ⚠️ ⚠️ **この画面は Claude を呼ばない。** 保存済みのHTMLを出すだけで、
@@ -241,11 +241,8 @@ const Header = ({ }) => {
         '架電状況/中古営業': <CallStatus callStatusShow={callStatusShow} setCallStatusShow={setCallStatusShow} source='used' />,
         '反響管理/広告費シミュレーター': <BudgetSimulator />,
         '反響管理/事後アンケート': <AfterInterview name={''} staff={''} id={''} shop={''} />,
         '他社動向/競合サマリー': <CompetitorSummary />,
-        '土地・物件管理/仲介物件登録': <RegisterBrokerageListings setModal={setModal} />,
-        // ⚠️ 物件台帳（satbase_property）の一覧。⚠️ **列が40あるので全画面**（下を参照）
-        '土地・物件管理/SatBaseサマリー': <SatBaseDatabase />,
         // ⚠️ v2.2.165: 上部の「最新の他社分析」カードから、同じモーダルのまま他社分析へ切り替える。
         //   ⚠️ どちらも isFullscreenMenu に入っているので、⚠️ 全画面のまま中身だけ替わる。
         '活動サマリー/月次日報': <DailyReports onOpenCompetitorReports={() => setEditMenu(`他社動向/${CLAUDE_COMPETITOR_ITEM}`)} />,
         '活動サマリー/営業別契約率': <StaffContractRate />,
@@ -386,12 +383,8 @@ const Header = ({ }) => {
         // ⚠️ ブラックリスト設定は住所・備考まで10列あり、xl では入力欄が潰れる。
         //   ⚠️ 2026-09-19 の SaaS 化に合わせて全画面にした。
         //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
         '反響管理/ブラックリスト設定',
-        // ⚠️ SatBaseサマリーは**選べる列が40**あり、xl では数列しか入らない。
-        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
-        //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
-        '土地・物件管理/SatBaseサマリー',
         // ⚠️ 営業別契約率は 2026-10-02 に**担当変更理由の8列**が増えて**16列**になった。
         //   ⚠️ xl のままだと右半分が隠れて横スクロール頼みになる（2026-10-02 の指示で全画面）。
         //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
         //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
diff --git a/frontend/src/components/header/SatBaseDatabase.tsx b/frontend/src/components/header/SatBaseDatabase.tsx
index bf42251f..c59afa1e 100644
--- a/frontend/src/components/header/SatBaseDatabase.tsx
+++ b/frontend/src/components/header/SatBaseDatabase.tsx
@@ -3,9 +3,10 @@ import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
 import SatBaseImport from './SatBaseImport';
 
 /**
- * SatBaseサマリー（ヘッダー → 土地・物件管理 → SatBaseサマリー）。
+ * SatBaseサマリー（以前はヘッダー → 土地・物件管理 → SatBaseサマリー）。
+ * ⚠️ v2.2.231 でメニューごと外した（未使用のため）。⚠️ ファイルだけ残している。開く口は無い（Header.tsx の説明）。
  *
  * ─────────────────────────────────────────────
  * ⚠️ 元データは SatBase の物件台帳（中間加工）。
  *   ⚠️ テーブル `satbase_property`（1,910行 / 42列）。
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 5c191619..1ed99d72 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.230';
+export const newVersion = '2.2.231';
```

### 削除した RegisterBrokerageListings.tsx（元の全文）
```tsx
import React, { useState, useEffect } from 'react';

// DB側で自動設定される項目を除いたフォーム用データ型
interface ListingFormData {
    customerId: string;
    address: string;
    propertyType: string;
    listPrice: number | '';
    mediationType: 'EXCLUSIVE_AGENCY' | 'EXCLUSIVE' | 'GENERAL' | '';
    mediationSignedAt: string;
    mediationExpireAt: string;
}

const INITIAL_FORM_DATA: ListingFormData = {
    customerId: '',
    address: '',
    propertyType: '',
    listPrice: '',
    mediationType: '',
    mediationSignedAt: '',
    mediationExpireAt: '',
};

type Props = {
    setModal: React.Dispatch<React.SetStateAction<boolean>>
}

const RegisterBrokerageListings: React.FC<Props> = ({ setModal }) => {
    const [formData, setFormData] = useState<ListingFormData>(INITIAL_FORM_DATA);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 媒介契約日が入力されたら、自動的に3ヶ月後を満了日にセット
    useEffect(() => {
        if (formData.mediationSignedAt) {
            const signedDate = new Date(formData.mediationSignedAt);
            if (!isNaN(signedDate.getTime())) {
                const expireDate = new Date(signedDate.setMonth(signedDate.getMonth() + 3));
                const formattedExpireDate = expireDate.toISOString().split('T')[0];

                setFormData((prev) => ({
                    ...prev,
                    mediationExpireAt: formattedExpireDate,
                }));
            }
        }
    }, [formData.mediationSignedAt]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // APIコールの実装 (PHPバックエンドへ)
            /*
            const response = await fetch('/api/listings/create.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            */

            console.log('送信データ:', formData);
            alert('登録しました（Consoleを確認）');
            setModal(false); // 登録成功後にモーダルを閉じる
        } catch (error) {
            console.error(error);
            alert('エラーが発生しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Header */}
            <div className="modal-header bg-light border-bottom-0 pb-0 pt-4 px-4">
                <h4 className="modal-title fw-bold text-dark">新規物件登録</h4>
                <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModal(false)}
                    aria-label="Close"
                ></button>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Body */}
                <div className="modal-body px-4 py-4">
                    <p className="text-muted mb-4">
                        物件の基本情報および媒介契約の情報を入力してください。<br />
                        <small>※ 物件ID等は登録後にシステムにより自動設定されます。</small>
                    </p>

                    <div className="row g-4">
                        {/* 左カラム: 物件基本情報 */}
                        <div className="col-lg-6 border-end-lg pe-lg-4">
                            <h5 className="fw-semibold text-primary mb-3">
                                <i className="bi bi-house-door me-2"></i>物件基本情報
                            </h5>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">物件所在地 <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" name="address" value={formData.address} onChange={handleChange} placeholder="例: 東京都港区六本木1-1-1" required />
                            </div>

                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">物件種別 <span className="text-danger">*</span></label>
                                    <select className="form-select" name="propertyType" value={formData.propertyType} onChange={handleChange} required>
                                        <option value="">選択してください</option>
                                        <option value="MANSION">中古マンション</option>
                                        <option value="HOUSE">中古戸建</option>
                                        <option value="LAND">土地</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">売出価格 (円) <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <input type="number" className="form-control" name="listPrice" value={formData.listPrice} onChange={handleChange} placeholder="例: 45000000" min="0" required />
                                        <span className="input-group-text">円</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 右カラム: 顧客・契約情報 */}
                        <div className="col-lg-6 ps-lg-4">
                            <h5 className="fw-semibold text-primary mb-3">
                                <i className="bi bi-file-earmark-text me-2"></i>顧客・契約情報
                            </h5>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">売主顧客ID <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" name="customerId" value={formData.customerId} onChange={handleChange} placeholder="例: C-10023" required />
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">媒介種別 <span className="text-danger">*</span></label>
                                <select className="form-select" name="mediationType" value={formData.mediationType} onChange={handleChange} required>
                                    <option value="">選択してください</option>
                                    <option value="EXCLUSIVE_AGENCY">専属専任媒介</option>
                                    <option value="EXCLUSIVE">専任媒介</option>
                                    <option value="GENERAL">一般媒介</option>
                                </select>
                            </div>

                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">媒介契約日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control" name="mediationSignedAt" value={formData.mediationSignedAt} onChange={handleChange} required />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">媒介期間満了日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control bg-light" name="mediationExpireAt" value={formData.mediationExpireAt} onChange={handleChange} required />
                                    <div className="form-text">※契約日から3ヶ月後を自動設定</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer bg-light border-top-0 pt-3 pb-4 px-4 rounded-bottom-4">
                    <button
                        type="button"
                        className="btn btn-outline-secondary px-4"
                        onClick={() => setModal(false)}
                        disabled={isSubmitting}
                    >
                        キャンセル
                    </button>
                    <button type="submit" className="btn btn-primary px-5 fw-bold shadow-sm" disabled={isSubmitting}>
                        {isSubmitting ? '登録中...' : '物件を登録する'}
                    </button>
                </div>
            </form>
        </>
    );
};

export default RegisterBrokerageListings;```
