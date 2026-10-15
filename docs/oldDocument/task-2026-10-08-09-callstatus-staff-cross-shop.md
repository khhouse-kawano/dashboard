# v2.2.177 架電状況（CallStatusList.tsx）: header へ移動 ／ 店舗スタッフ表示は店舗で絞らずスタッフ名で数える ／ 読み込み中表示

## 依頼（ReadMeClaude.md ＋ 追加指示）
- `CallStatus.tsx` を header ディレクトリへ移動（⚠️ 実体は `CallStatusList.tsx`。Header.tsx が `CallStatus` の名前で読み込んでいる）
- insideSalesCategory が shopStaff のとき、架電数は targetShop と call_sheet.shop を突合せず、スタッフ名で call_log から取る（所属店舗以外の歩留まりも計算できるように）
- 追加（2026-10-08）: ① アポ取得数・架電からの来場数も店舗で絞らない ② ファイル名は変えない ③ 統計が描かれるまで読み込み中を表示

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/` → `frontend/src/components/header/` | **CallStatusList.tsx**（git mv） | import を `../../utils` `../../context` に。追加: state `loading` / `rendering`、`allParsedActions`、`statsOrLoading`（Spinner）。変更: `renderShopStaffList` の `staffLogs`（parsedCallLogs 全件）・アポ/来場（originalDatabase）・総架電数/通電数（allParsedActions）。削除: `targetParsedActions`（使われなくなった） |
| `frontend/src/components/header/` | **Header.tsx** | `import CallStatus from './CallStatusList'` |
| `frontend/src/components/database/` | **DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx** | `import CallStatusList from '../header/CallStatusList'` |
| `frontend/src/utils/` | **version.ts** | 2.2.177 |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.177.sql**（新規） | ローカル no=273 |

⚠️ ②・① PHP・DB の変更なし（⚠️ サーバーの callStatusList は call_sheet を全件返している）。
⚠️ インサイドセールス表示（renderInsideSalesList）は変更なし。土地新着ネット（estate）はもともと店舗で絞っていないので結果は同じ。

## 数え方（店舗スタッフ表示）
| 項目 | 以前 | v2.2.177 |
|---|---|---|
| 総架電数・通電数 | 選んだ店舗の架電シート（call_sheet.shop）の記録 × スタッフ名 | ⚠️ **全架電シート**の記録 × スタッフ名 |
| アポ取得数・架電からの来場数 | 選んだ店舗の架電シート × 選んだ店舗の顧客 | ⚠️ 全架電シート（担当 or 記録にスタッフ名）× ⚠️ この事業の全顧客 |
| 合計行 | 選んだ店舗所属スタッフ全員 | 同じ（⚠️ 数える範囲が全店舗に） |

## 読み込み中表示
- `loading`（取得中）か `rendering`（集計前）の間は表を描かず、Spinner と「架電状況を読み込んでいます…」／「集計しています…」。
- ⚠️ 集計は描画の中で同期的に走る（⚠️ 画面が固まる）ので、⚠️ **先にスピナーを描いてから**（setTimeout 50ms）表を描く。
- 店舗・担当の切り替え時も `rendering` を立てる。

## 確認
- `npm run build` OK（main.e056c1a3.js。警告は既存）
- ⚠️ ブラウザ未確認

## 差分
```diff
diff --git a/frontend/src/components/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
similarity index 100%
rename from frontend/src/components/CallStatusList.tsx
rename to frontend/src/components/header/CallStatusList.tsx
```
diff --git a/frontend/src/components/database/DatabaseKaeru.tsx b/frontend/src/components/database/DatabaseKaeru.tsx
index b047ba32..2902c243 100644
--- a/frontend/src/components/database/DatabaseKaeru.tsx
+++ b/frontend/src/components/database/DatabaseKaeru.tsx
@@ -5,7 +5,7 @@ import Table from "react-bootstrap/Table";
 import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
-import CallStatusList from '../CallStatusList';
+import CallStatusList from '../header/CallStatusList';
 import InformationEditKaeru from '../information/InformationEditKaeru';
 import IntegrateModal from './IntegrateModal';
 import { useIsSp } from '../../utils/isSp';
diff --git a/frontend/src/components/database/DatabaseOrder.tsx b/frontend/src/components/database/DatabaseOrder.tsx
index e089a109..346018cf 100644
--- a/frontend/src/components/database/DatabaseOrder.tsx
+++ b/frontend/src/components/database/DatabaseOrder.tsx
@@ -5,7 +5,7 @@ import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import SurveyList from '../Survey';
 import CancelList from '../CancelList';
-import CallStatusList from '../CallStatusList';
+import CallStatusList from '../header/CallStatusList';
 import LostStatusList from '../LostStatusList';
 import InformationEdit from '../information/InformationEdit';
 import { useIsSp } from '../../utils/isSp';
diff --git a/frontend/src/components/database/DatabaseResale.tsx b/frontend/src/components/database/DatabaseResale.tsx
index 3fa2437b..427a4453 100644
--- a/frontend/src/components/database/DatabaseResale.tsx
+++ b/frontend/src/components/database/DatabaseResale.tsx
@@ -5,7 +5,7 @@ import Table from "react-bootstrap/Table";
 import AuthContext from '../../context/AuthContext';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import InformationEditResale from '../information/InformationEditResale';
-import CallStatusList from '../CallStatusList';
+import CallStatusList from '../header/CallStatusList';
 import IntegrateModal from './IntegrateModal';
 import { useIsSp } from '../../utils/isSp';
 import { generateULID } from '../../utils/createULID';
diff --git a/frontend/src/components/header/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
index 21a07eb8..02b01caa 100644
--- a/frontend/src/components/header/CallStatusList.tsx
+++ b/frontend/src/components/header/CallStatusList.tsx
@@ -3,11 +3,12 @@ import Table from 'react-bootstrap/Table';
 import Modal from 'react-bootstrap/Modal';
 import Form from 'react-bootstrap/Form';
 import Badge from 'react-bootstrap/Badge';
-import apiClient from '../utils/apiClient';
-import { staffSorter } from '../utils/staffSorter';
-import { getYearMonthArray } from '../utils/getYearMonthArray';
-import { thisYear } from '../utils/thisYear';
-import AuthContext from '../context/AuthContext';
+import Spinner from 'react-bootstrap/Spinner';
+import apiClient from '../../utils/apiClient';
+import { staffSorter } from '../../utils/staffSorter';
+import { getYearMonthArray } from '../../utils/getYearMonthArray';
+import { thisYear } from '../../utils/thisYear';
+import AuthContext from '../../context/AuthContext';
 
 
 // --- Types ---
@@ -87,10 +88,29 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
     const categoryValue = source ?? category;
     const [targetInsideSales, setTargetInsideSales] = useState('');
 
+    /**
+     * 読み込み中の表示（v2.2.177）。
+     *
+     * ⚠️ 時間がかかるのは2か所: ① 取得（call_sheet 全件など）② 表の集計（⚠️ 描画の中で全架電記録を数えている）。
+     *   ・loading   … 取得中
+     *   ・rendering … ⚠️ 表を描く前に一度スピナーを描かせるための目印。
+     *     ⚠️ 集計は同期処理で画面が固まるので、⚠️ **先にスピナーを描いてから**（setTimeout）表を描く。
+     *     ⚠️ 店舗・担当を切り替えたときも立てる（⚠️ 集計し直しになるため）。
+     */
+    const [loading, setLoading] = useState(false);
+    const [rendering, setRendering] = useState(true);
+    useEffect(() => {
+        if (!rendering || loading) return;
+        const timer = window.setTimeout(() => setRendering(false), 50);
+        return () => window.clearTimeout(timer);
+    }, [rendering, loading]);
+
     useEffect(() => {
         setMonthArray(getYearMonthArray(2025, 1));
         if (!callStatusShow) return;
         const fetchData = async () => {
+            setLoading(true);
+            setRendering(true);
             try {
                 const response = await apiClient.post('', { request: 'callStatusList', category: categoryValue });
                 setCallLogList(response.data.callLog);
@@ -117,6 +137,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
             } catch (error) {
                 alert('架電状況の取得に失敗しました');
                 console.error(error);
+            } finally {
+                setLoading(false);
             }
         };
         fetchData();
@@ -160,9 +182,15 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
         return parsedCallLogs.filter(c => targetShop !== 'estate' ? targetShopList.includes(c.shop) : true);
     }, [parsedCallLogs, targetShop, targetShopList]);
 
-    const targetParsedActions = useMemo(() => {
-        return targetCallLog.flatMap(log => log.parsedActions);
-    }, [targetCallLog]);
+    /**
+     * ⚠️⚠️ v2.2.177: 店舗スタッフ表示は ⚠️ **架電シートの店舗（call_sheet.shop）で絞らない**（指示書）。
+     *   ⚠️ スタッフ名だけで、⚠️ **全ての架電記録**から数える（⚠️ 所属店舗以外の顧客への架電も入る）。
+     *   ⚠️ 以前は targetCallLog（選んだ店舗の架電シートだけ）から取っていた。
+     * ⚠️ インサイドセールス表示（renderInsideSalesList）は従来どおり targetCallLog を使う。
+     */
+    const allParsedActions = useMemo(() => {
+        return parsedCallLogs.flatMap(log => log.parsedActions);
+    }, [parsedCallLogs]);
 
     const safeFormate = (value: string): string => {
         return (value ?? '').replace(/[\s\u3000]+/g, '');
@@ -325,18 +353,28 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                             const fStaffName = filteredStaffName(staff.name);
                             const validStaffNames = targetShop === 'estate' ? staffArray.filter(s => s.estate === 1).map(s => filteredStaffName(s.name)) : staffArray.filter(s => targetShop ? s.shop === targetShop : true).map(s => filteredStaffName(s.name));
 
-                            const staffLogs = targetCallLog.filter(c => {
+                            /*
+                              ⚠️ v2.2.177: 架電シートは ⚠️ **店舗で絞らない**（parsedCallLogs = 全件）。
+                                ⚠️ そのスタッフが担当（c.staff）か、架電記録に名前がある顧客。
+                                ⚠️ 土地新着ネット（estate）は以前から店舗で絞っていないので結果は同じ。
+                            */
+                            const staffLogs = parsedCallLogs.filter(c => {
                                 if (sIndex > 0) {
                                     return filteredStaffName(c.staff) === fStaffName || c.parsedActions.some(l => filteredStaffName(l.staff) === fStaffName);
                                 }
                                 return validStaffNames.includes(filteredStaffName(c.staff)) || c.parsedActions.some(l => validStaffNames.includes(filteredStaffName(l.staff)));
                             });
 
+                            /*
+                              ⚠️ v2.2.177: アポ取得数・架電からの来場数も ⚠️ **店舗で絞らない**（2026-10-08 合意）。
+                                ⚠️ 架電数だけ全店舗にすると「架電 → アポ → 来場」の比率が合わなくなるため。
+                                ⚠️ 以前は filteredCustomer（選んだ店舗の顧客）で引いていた → ⚠️ originalDatabase（この事業の全顧客）。
+                            */
                             const appointLogIds = new Set(staffLogs.filter(c => c.status === '来場アポ').map(c => c.id));
-                            const appointCustomerRegs = filteredCustomer.filter(o => appointLogIds.has(o.id)).map(o => o.register);
+                            const appointCustomerRegs = originalDatabase.filter(o => appointLogIds.has(o.id)).map(o => o.register);
 
                             const interviewLogIds = new Set(staffLogs.filter(c => c.status === '来場済み').map(c => c.id));
-                            const interviewCustomerRegs = filteredCustomer.filter(o => interviewLogIds.has(o.id)).map(o => o.register);
+                            const interviewCustomerRegs = originalDatabase.filter(o => interviewLogIds.has(o.id)).map(o => o.register);
 
                             const estateResponses = filteredCustomer.filter(o => o.medium === '土地新着ネット' && (sIndex === 0 || o.staff === staff.name));
 
@@ -356,7 +394,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                                         </td>
                                         {(() => {
                                             const preFilteredActions = (category === '総架電数' || category === '通電数')
-                                                ? targetParsedActions.filter(log => {
+                                                // ⚠️ v2.2.177: 全架電記録から（⚠️ 店舗で絞らない。スタッフ名だけ）
+                                                ? allParsedActions.filter(log => {
                                                     const staffName = filteredStaffName(log.staff);
                                                     const isTargetStaff = sIndex > 0 ? staffName === fStaffName : validStaffNames.includes(staffName);
 
@@ -416,6 +455,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                 <Form.Select
                     value={targetShop}
                     onChange={(e) => {
+                        // ⚠️ v2.2.177: 集計し直しになるので先に読み込み中を出す
+                        setRendering(true);
                         setTargetShop(e.target.value);
                         setInsideSalesCategory(e.target.value === 'inside_sales' ? 'inside_sales' : 'shopStaff');
                     }}
@@ -438,6 +479,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                 <Form.Select
                     value={targetInsideSales}
                     onChange={(e) => {
+                        // ⚠️ v2.2.177: 集計し直しになるので先に読み込み中を出す
+                        setRendering(true);
                         setTargetInsideSales(e.target.value)
                     }}
                     style={{ fontSize: '13px' }}
@@ -452,11 +495,27 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
         </div>
     )
 
+    /**
+     * 統計の表、または読み込み中の表示（v2.2.177）。
+     * ⚠️ 取得中・集計前は表を描かない（⚠️ 描くと集計で画面が固まり、スピナーも出ない）。
+     */
+    const statsOrLoading = (loading || rendering)
+        ? (
+            <div className="d-flex flex-column align-items-center justify-content-center bg-white rounded border shadow-sm mb-3"
+                style={{ minHeight: '240px', gap: '10px' }} role="status" aria-live="polite">
+                <Spinner animation="border" variant="primary" />
+                <div className="text-muted" style={{ fontSize: '13px' }}>
+                    {loading ? '架電状況を読み込んでいます…' : '集計しています…'}
+                </div>
+            </div>
+        )
+        : (insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList());
+
     return (
         <>{source ?
             <>
                 { selectCategory}
-                {insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList()}
+                {statsOrLoading}
             </>
             :
             <Modal show={callStatusShow} onHide={() => setCallStatusShow(false)} size="xl" dialogClassName="modal-90w">
@@ -467,7 +526,7 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                 </Modal.Header>
                 <Modal.Body className="bg-light pt-4">
                     {categoryValue !== 'used' && selectCategory}
-                    {insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList()}
+                    {statsOrLoading}
                 </Modal.Body>
             </Modal>}
         </>
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 92a6b5fb..d1eb68eb 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -7,7 +7,7 @@ import Modal from 'react-bootstrap/Modal';
 import Dropdown from 'react-bootstrap/Dropdown';
 import MetaAdsDashboard from './MetaAdsDashboard';
 import CompetitorMaterials from './CompetitorMaterials';
-import CallStatus from '../CallStatusList';
+import CallStatus from './CallStatusList';
 import { useIsSp } from '../../utils/isSp';
 import AuthContext from '../../context/AuthContext';
 import BudgetSimulator from './BudgetSimulator';
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 30346a88..1886dfce 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.176';
+export const newVersion = '2.2.177';
```
