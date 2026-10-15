# v2.2.177 修正: 架電状況の `Cannot read properties of undefined (reading 'map')`

## 症状（利用者から）
```
CallStatusList.tsx:175 Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at CallStatusList.tsx:175:1   ← parsedCallLogs の callLogList.map
    ... CallStatusList.tsx:116    ← setCallLogList(response.data.callLog)
```

## 原因
- 応答に `callLog` が無いまま `setCallLogList(undefined)` していた → 次の描画で `.map` が落ちる（画面が真っ白）。
  - 直後の `response.data.shop.filter` も例外になり catch でアラートは出るが、⚠️ state は既に undefined。
- ⚠️ 応答の形自体（callLog / shop / customer / staff）はローカルでは正常（order 61MB・spec 51MB・used 46MB、3秒前後）。
  ⚠️ 本番で callLog が無かったのは、⚠️ **エラーの本文や途中で切れた応答**が返ったときと考えられる（⚠️ 応答が大きい）。⚠️ 本番の ② / ① のログで確認が必要。

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/header/` | **CallStatusList.tsx** | 取得直後に callLog / shop / customer / staff が配列か確かめ、⚠️ 揃っていなければ **何も state に入れず** 失敗扱い（アラート＋console.error にキー一覧）。`parsedCallLogs` も配列でなければ空 |

- build OK（main.a896f6a8.js）。deploy-v2.2.177.md のファイル名を差し替えた。

## 差分
```diff
diff --git a/frontend/src/components/header/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
index 02b01caa..6d889937 100644
--- a/frontend/src/components/header/CallStatusList.tsx
+++ b/frontend/src/components/header/CallStatusList.tsx
@@ -113,16 +113,28 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
             setRendering(true);
             try {
                 const response = await apiClient.post('', { request: 'callStatusList', category: categoryValue });
-                setCallLogList(response.data.callLog);
+                /*
+                  ⚠️⚠️ 応答の形を先に確かめる（v2.2.177 修正: `Cannot read properties of undefined (reading 'map')`）。
+                    ⚠️ 応答は 45〜60MB と大きく、⚠️ エラーの本文（{ status: 'error' … }）や途中で切れた応答だと
+                      ⚠️ callLog が無い。⚠️ 以前はそのまま setCallLogList(undefined) して ⚠️ **描画で落ちていた**（画面が真っ白）。
+                    ⚠️ 配列が揃っていなければ ⚠️ **何も state に入れずに**失敗として扱う。
+                */
+                const body = response?.data;
+                if (!body || !Array.isArray(body.callLog) || !Array.isArray(body.shop)
+                    || !Array.isArray(body.customer) || !Array.isArray(body.staff)) {
+                    console.error('架電状況の応答が正しくありません', typeof body === 'object' && body ? Object.keys(body) : typeof body);
+                    throw new Error('invalid callStatusList response');
+                }
+                setCallLogList(body.callLog);
                 const divisionMapping: Record<string, string> = {
                     'order': '注文事業',
                     'spec': '建売分譲事業',
                     'used': '中古リノベ'
                 };
-                const filteredShopList = response.data.shop.filter((s: any) => s.division === divisionMapping[categoryValue] && s.show_flag === 1);
+                const filteredShopList = body.shop.filter((s: any) => s.division === divisionMapping[categoryValue] && s.show_flag === 1);
                 setShopArray(filteredShopList);
-                setOriginalDatabase(response.data.customer);
-                setStaffArray(response.data.staff.filter((s: any) => Number(s.period) === thisYear));
+                setOriginalDatabase(body.customer);
+                setStaffArray(body.staff.filter((s: any) => Number(s.period) === thisYear));
 
                 if (categoryValue === 'order') {
                     setInsideSalesCategory('inside_sales');
@@ -172,7 +184,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
     }, [staffArray, targetShop]);
 
     const parsedCallLogs = useMemo(() => {
-        return callLogList.map(log => ({
+        // ⚠️ 念のため配列でなければ空（⚠️ 描画で落とさない）
+        return (Array.isArray(callLogList) ? callLogList : []).map(log => ({
             ...log,
             parsedActions: parseLogs(log.call_log)
         }));
```
