# v2.2.177 修正: 架電状況の合計列が合わない ／ show_dashboard = 1 だけを対象に

## 依頼
- CallStatusList.tsx「期間の合計列が合わない」
- 「show_dashboard = 1 のみの条件とする」

## 原因（合計列）
- 月の列は一部だけ表示（店舗スタッフ: `monthArray.slice(12)` = 2026/01〜、インサイドセールス: `slice(8)` = 2025/09〜）。
- ⚠️ 合計列（mIndex === 0）だけ ⚠️ **全期間**で数えていた → 月の列を足しても合計にならない。

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/header/` | **CallStatusList.tsx** | ① 合計列は表示中の月だけ（`insideMonths` / `staffMonths`、`matchMonth` / `matchRegMonth`。月の列と同じ判定を表示中の月で回す → 月の列の合計と一致）② 取得直後に `trash`（= show_dashboard）が 1 の顧客だけを `originalDatabase` に、⚠️ 架電シートもその顧客の id のものだけを `callLogList` に |

## ⚠️ show_dashboard の絞り込みで変わること（ローカル実測・注文）
- 顧客 25,854 → **25,341**
- 架電シート 17,631 → **8,540**
  - 非表示の顧客の分: 48
  - ⚠️ **注文の顧客台帳に無い id: 9,043**（建売・中古の顧客の架電シート）→ ⚠️ 数えなくなる
  - ⚠️ v2.2.177 の「店舗で絞らない」改修のあと、⚠️ 店舗スタッフ表示では他事業の顧客への架電まで数えていた。⚠️ この絞り込みで ⚠️ **その事業の顧客への架電だけ**になる（⚠️ 所属店舗以外でも同じ事業なら数える）。
- インサイドセールス表示は以前から店舗（注文の店舗）で絞っていたので、変わるのは非表示の顧客の分だけ。

## 確認
- build OK（main.18637aa9.js）。deploy-v2.2.177.md のファイル名を差し替え。⚠️ ブラウザ未確認

## 差分
```diff
diff --git a/frontend/src/components/header/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
index 6d889937..a730b33f 100644
--- a/frontend/src/components/header/CallStatusList.tsx
+++ b/frontend/src/components/header/CallStatusList.tsx
@@ -125,7 +125,15 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                     console.error('架電状況の応答が正しくありません', typeof body === 'object' && body ? Object.keys(body) : typeof body);
                     throw new Error('invalid callStatusList response');
                 }
-                setCallLogList(body.callLog);
+                /*
+                  ⚠️ v2.2.177 修正（指示）: ⚠️ **show_dashboard = 1 の顧客だけ**を集計の対象にする。
+                    ⚠️ サーバーは全件返す（⚠️ show_dashboard は `trash` という名前で入っている。⚠️ 名前と中身が逆なので注意）。
+                    ⚠️ 架電シートも ⚠️ **この事業の show_dashboard = 1 の顧客の分だけ**にする
+                      （⚠️ 非表示の顧客への架電を数えない）。⚠️ 顧客台帳に無い id の架電シートも数えない。
+                */
+                const visibleCustomers = body.customer.filter((o: any) => Number(o.trash) === 1);
+                const visibleIds = new Set(visibleCustomers.map((o: any) => String(o.id)));
+                setCallLogList(body.callLog.filter((c: any) => visibleIds.has(String(c.id))));
                 const divisionMapping: Record<string, string> = {
                     'order': '注文事業',
                     'spec': '建売分譲事業',
@@ -133,7 +141,7 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                 };
                 const filteredShopList = body.shop.filter((s: any) => s.division === divisionMapping[categoryValue] && s.show_flag === 1);
                 setShopArray(filteredShopList);
-                setOriginalDatabase(body.customer);
+                setOriginalDatabase(visibleCustomers);
                 setStaffArray(body.staff.filter((s: any) => Number(s.period) === thisYear));
 
                 if (categoryValue === 'order') {
@@ -236,6 +244,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
     };
 
     const renderInsideSalesList = () => {
+        /** ⚠️ 表に出す月（v2.2.177 修正: 合計列もこの月だけで数える） */
+        const insideMonths = monthArray.slice(8);
         // ⚠️ 先頭は合計行。sIndex === 0 を isTotalRow として扱うので、並び順を変えないこと。
         const displayShops: shopList[] = [
             { brand: '', shop: INSIDE_SALES_TOTAL_LABEL, section: INSIDE_SALES_SECTION, show_flag: 1 },
@@ -303,7 +313,14 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                                         </td>
 
                                         {['total', ...monthArray.slice(8)].map((month, mIndex) => {
-                                            const monthMatch = (dateStr: string) => mIndex === 0 ? true : dateFormate(dateStr).includes(month);
+                                            /*
+                                              ⚠️ v2.2.177 修正: 合計列は ⚠️ **表に出ている月（monthArray.slice(8)）の分だけ**。
+                                                ⚠️ 以前は全期間（mIndex === 0 なら true）で、⚠️ 月の列を足しても合計と合わなかった。
+                                                ⚠️ 月の列と同じ判定（includes）を表示中の月で回すので、⚠️ 月の列の合計と必ず一致する。
+                                            */
+                                            const monthMatch = (dateStr: string) => mIndex === 0
+                                                ? insideMonths.some(m => dateFormate(dateStr).includes(m))
+                                                : dateFormate(dateStr).includes(month);
 
                                             let value: string | number = 0;
                                             if (index === 0) value = registerFilter.filter(r => monthMatch(r.register)).length;
@@ -344,6 +361,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
     };
 
     const renderShopStaffList = () => {
+        /** ⚠️ 表に出す月（v2.2.177 修正: 合計列もこの月だけで数える） */
+        const staffMonths = monthArray.slice(12);
         console.log(changedStaff)
         const staffListToRender = [{ name: '合計', shop: '', pg_id: '', category: 0, estate: 1 } as unknown as staffList, ...changedStaff];
         const targetCategories = targetShop === 'estate' ? ['土地新着ネット反響数', '総架電数', '通電数', 'アポ取得数', '架電からの来場数'] : ['総架電数', '通電数', 'アポ取得数', '架電からの来場数'];
@@ -422,13 +441,23 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
 
                                             return ['total', ...monthArray.slice(12)].map((month, mIndex) => {
                                                 const targetMonthStr = mIndex > 0 ? dateFormate(month) : '';
-                                                const matchMonth = (dateStr: string) => mIndex === 0 || dateFormate(dateStr).includes(targetMonthStr);
+                                                /*
+                                                  ⚠️ v2.2.177 修正: 合計列は ⚠️ **表に出ている月（monthArray.slice(12)）の分だけ**。
+                                                    ⚠️ 以前は全期間で、⚠️ 月の列を足しても合計と合わなかった。
+                                                    ⚠️ 月の列と同じ判定を表示中の月で回す（⚠️ 月の列の合計と必ず一致する）。
+                                                */
+                                                const matchMonth = (dateStr: string) => mIndex === 0
+                                                    ? staffMonths.some(m => dateFormate(dateStr).includes(m))
+                                                    : dateFormate(dateStr).includes(targetMonthStr);
+                                                const matchRegMonth = (reg: string) => mIndex === 0
+                                                    ? staffMonths.includes(dateFormate(reg.slice(0, 7)))
+                                                    : dateFormate(reg.slice(0, 7)) === month;
 
                                                 let value = 0;
                                                 let textColorClass = '';
 
                                                 if (category === '土地新着ネット反響数') {
-                                                    value = estateResponses.filter(r => mIndex === 0 || dateFormate(r.register).includes(month)).length;
+                                                    value = estateResponses.filter(r => matchMonth(r.register)).length;
                                                 } else if (category === '総架電数') {
                                                     // 事前フィルタ済みの配列から、月だけを判定するから爆速
                                                     value = preFilteredActions.filter(log => matchMonth(log.day)).length;
@@ -438,10 +467,10 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                                                     value = preFilteredActions.filter(log => matchMonth(log.day)).length;
                                                     textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 15 ? 'text-danger' : 'text-success fw-bold') : '';
                                                 } else if (category === 'アポ取得数') {
-                                                    value = appointCustomerRegs.filter(reg => mIndex === 0 || dateFormate(reg.slice(0, 7)) === month).length;
+                                                    value = appointCustomerRegs.filter(matchRegMonth).length;
                                                     textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 2 ? 'text-danger' : 'text-success fw-bold') : '';
                                                 } else if (category === '架電からの来場数') {
-                                                    value = interviewCustomerRegs.filter(reg => mIndex === 0 || dateFormate(reg.slice(0, 7)) === month).length;
+                                                    value = interviewCustomerRegs.filter(matchRegMonth).length;
                                                 }
 
                                                 return (
```
