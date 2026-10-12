# 2026-10-12 v2.2.187 顧客一覧：氏名②の並びを「アイコン（縦中央）／氏名①・氏名②」に

## 依頼
customer_contacts_name_2 は
```
アイコン（縦真ん中そろえ）氏名①
                          氏名②
```
のバランスに（task-2026-10-12-01 の続き）。

## 変更（frontend/src/components/database）
| ファイル | 内容 |
|---|---|
| **customerName2.tsx** | `CustomerName2`（2行目だけの部品）を **`CustomerNameCell`** に置き換え。props: `icons` / `name` / `name2` / `after` |
| **DatabaseOrder.tsx** | 顧客名のマスを `CustomerNameCell` に。icons = ギフトのドット・Nexus・カメラ（並びは今までどおり） |
| **DatabaseKaeru.tsx** | 同上。icons = ギフトのドット・重複顧客 |
| **DatabaseResale.tsx** | 同上。icons = 重複顧客、after = 媒介編集／媒介追加（氏名①の右、今までどおり） |

### CustomerNameCell の並び
- 氏名②あり: `display: flex; align-items: center` で左にアイコン（2行に対して縦の真ん中）、右に氏名①・氏名②を縦に（左端をそろえる）。氏名②は少し小さい灰色
- 氏名②なし: `{icons}{name}{after}` をそのまま並べる（**今までと同じ1行**。行の高さは変わらない）

### 追加・削除した関数
- 追加: `CustomerNameCell`
- 削除: `CustomerName2`（task-01 で作ったもの。どこからも使わなくなったため）
- 変更なし: `cleanCustomerName` / `hasCustomerName2`（検索は task-01 のまま）

## 確認
- eslint 新規警告なし、`npm run build` 成功 → **`main.590cf219.js`**（※ その後 task-2026-10-12-03 で `main.03efcb3d.js` に）
- 画面での見た目は未確認

## 差分（task-01 からの差、全文）
```diff
diff --git a/frontend/src/components/database/DatabaseKaeru.tsx b/frontend/src/components/database/DatabaseKaeru.tsx
index b848ef46..94c22e12 100644
--- a/frontend/src/components/database/DatabaseKaeru.tsx
+++ b/frontend/src/components/database/DatabaseKaeru.tsx
@@ -16,7 +16,7 @@ import { thisYear } from '../../utils/thisYear';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
 import { sortStaff } from '../header/useAmbassadorMaster';
 import { GiftDot, GiftLegend } from './GiftMark';
-import { CustomerName2, cleanCustomerName } from './customerName2';
+import { CustomerNameCell, cleanCustomerName } from './customerName2';
 
 type shopList = { brand: string, shop: string, section: string };
 // ⚠️ position / khg_id は担当営業セレクトの並べ替えに使う（2026-09-14 追加）。
@@ -655,10 +655,15 @@ const DatabaseKaeru = ({ }: Props) => {
                                                     setEditId(item.id);
                                                 }}>編集</div></td>
                                             <td>{item.shop}</td>
-                                            <td><GiftDot gift={item.gift} />{(isDuplicate && item.integration) && <span style={{ cursor: 'pointer' }}
-                                                onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}
-                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目 */}
-                                                <CustomerName2 value={item.customer_2} /></td>
+                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」 */}
+                                            <td><CustomerNameCell
+                                                icons={<>
+                                                    <GiftDot gift={item.gift} />
+                                                    {(isDuplicate && item.integration) && <span style={{ cursor: 'pointer' }}
+                                                        onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}
+                                                </>}
+                                                name={item.customer ?? ''}
+                                                name2={item.customer_2} /></td>
                                             <td>{item.staff ?? ''}</td>
                                             <td>{item.status ?? ''}</td>
                                             <td>{formate(item.register)}</td>
diff --git a/frontend/src/components/database/DatabaseOrder.tsx b/frontend/src/components/database/DatabaseOrder.tsx
index 41f11632..691fcfcc 100644
--- a/frontend/src/components/database/DatabaseOrder.tsx
+++ b/frontend/src/components/database/DatabaseOrder.tsx
@@ -19,7 +19,7 @@ import { missingLostFields } from '../../utils/informationUtils';
 import { sortStaff } from '../header/useAmbassadorMaster';
 import NexusBadge from '../NexusBadge';
 import { isNexusRow } from '../../utils/nexusUtils';
-import { CustomerName2, cleanCustomerName } from './customerName2';
+import { CustomerNameCell, cleanCustomerName } from './customerName2';
 
 // --- 型定義 ---
 type ShopList = { brand: string; shop: string; section: string };
@@ -681,12 +681,16 @@ const DatabaseOrder = ({ onReload }: Props) => {
                                               ⚠️⚠️ **Nexus アイコンはギフトのドットの隣に置く**（2026-09-25 の指示）。
                                                 ⚠️ **改行しないこと。** 行の高さが揃わなくなり、一覧が読みにくくなる。
                                             */}
-                                            <td><GiftDot gift={item.gift} />
-                                                {/* ⚠️ `item.rank` は `Sランク` の形。⚠️ **表示用に「ランク」を落とす前の値**を渡すこと */}
-                                                {isNexusRow(item.customer, item.customer_contacts_name_kana, item.rank) && <NexusBadge className='me-1' />}
-                                                {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}
-                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目（⚠️ その行だけ高くなる。2026-10-12 に了承済み） */}
-                                                <CustomerName2 value={item.customer_2} /></td>
+                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」（⚠️ その行だけ高くなる。2026-10-12 に了承済み） */}
+                                            <td><CustomerNameCell
+                                                icons={<>
+                                                    <GiftDot gift={item.gift} />
+                                                    {/* ⚠️ `item.rank` は `Sランク` の形。⚠️ **表示用に「ランク」を落とす前の値**を渡すこと */}
+                                                    {isNexusRow(item.customer, item.customer_contacts_name_kana, item.rank) && <NexusBadge className='me-1' />}
+                                                    {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}
+                                                </>}
+                                                name={safeFormate(item.customer)}
+                                                name2={item.customer_2} /></td>
                                             <td>{safeFormate(item.staff)}</td>
                                             <td>{safeFormate(item.status)}</td>
                                             <td>{safeFormate(item.register)}</td>
diff --git a/frontend/src/components/database/DatabaseResale.tsx b/frontend/src/components/database/DatabaseResale.tsx
index 2f5fe476..99b31108 100644
--- a/frontend/src/components/database/DatabaseResale.tsx
+++ b/frontend/src/components/database/DatabaseResale.tsx
@@ -14,7 +14,7 @@ import { toHalfWidth } from './databaseUtils';
 import PropertyRegister from './PropertyRegister';
 import { BrokerData } from './PropertyRegister';
 import { generateNewId } from './databaseUtils';
-import { CustomerName2 } from './customerName2';
+import { CustomerNameCell } from './customerName2';
 
 type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, position: string };
 type CustomerList = Record<string, string>;
@@ -615,10 +615,13 @@ const DatabaseResale = ({ onReload, key }: Props) => {
                                                 <div style={{ cursor: 'pointer' }}
                                                     onClick={() => handleCopy(item.id)}><i className="fa-solid fa-user-plus"></i></div></td>
                                             <td>{item.shop}</td>
-                                            <td>{isDuplicate && <span style={{ cursor: 'pointer' }}
-                                                onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}
-                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目 */}
-                                                <CustomerName2 value={item.customer_2} />
+                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」。⚠️ 媒介のボタンは氏名①の右（今までどおり） */}
+                                            <td><CustomerNameCell
+                                                icons={isDuplicate && <span style={{ cursor: 'pointer' }}
+                                                    onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}
+                                                name={item.customer ?? ''}
+                                                name2={item.customer_2}
+                                                after={<>
                                                 {isBroker && <span className='bg-warning rounded ms-1 p-1 fw-bold'
                                                     style={{ fontSize: '9px', textDecoration: 'underline dotted', cursor: 'pointer' }}
                                                     onClick={() => {
@@ -632,7 +635,8 @@ const DatabaseResale = ({ onReload, key }: Props) => {
                                                         setBrokerCustomer(item.id);
                                                         handleAddNew();
                                                     }}>
-                                                    媒介追加</span>}</td>
+                                                    媒介追加</span>}
+                                                </>} /></td>
                                             <td>{item.staff ?? ''}</td>
                                             <td>{item.status ?? ''}</td>
                                             <td>{item.call_status}</td>
diff --git a/frontend/src/components/database/customerName2.tsx b/frontend/src/components/database/customerName2.tsx
index 4971ea8e..91018b9e 100644
--- a/frontend/src/components/database/customerName2.tsx
+++ b/frontend/src/components/database/customerName2.tsx
@@ -6,7 +6,7 @@ import React from 'react';
  * ⚠️ 顧客一覧（DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx）の3画面で使う。
  * ⚠️ サーバーは `customer_2` という名前で返す（⚠️ ② features/database/queries.ts と
  *   ① handlers/databaseAction/database_*.php の両方。⚠️ 片方だけだと、どちらが応答したかで出たり出なかったりする）。
- * ⚠️ 値が無い（NULL は '' で返る）・空白だけのときは何も出さない（⚠️ 1行のまま）。
+ * ⚠️ 値が無い（NULL は '' で返る）・空白だけのときは ⚠️ **今までと同じ1行の並び**（アイコン → 氏名①）。
  */
 
 /** 空白（半角・全角）を消した名前。⚠️ 検索の比較に使う（既存の _cleanCustomer と同じ規則） */
@@ -16,16 +16,38 @@ export const cleanCustomerName = (value: unknown): string =>
 /** 氏名② があるか */
 export const hasCustomerName2 = (value: unknown): boolean => cleanCustomerName(value) !== '';
 
+type CustomerNameCellProps = {
+    /** 氏名の左に出すアイコン（ギフトのドット・Nexus・カメラ・重複顧客 など）。⚠️ 並びは各画面のまま渡す */
+    icons?: React.ReactNode;
+    /** 氏名① */
+    name: React.ReactNode;
+    /** 氏名②（customer_2） */
+    name2: unknown;
+    /** 氏名①の右に続けて出すもの（中古の「媒介編集」「媒介追加」など） */
+    after?: React.ReactNode;
+};
+
 /**
- * 顧客名のマスの2行目（氏名②）。⚠️ 値が無ければ null。
- * ⚠️ 1行目（氏名①）と区別するため、少し小さい灰色の文字にする。
+ * 顧客名のマスの中身（v2.2.187 修正: 2026-10-12 の指示で並びを変更）。
+ *
+ *   氏名②あり:   [アイコン] 氏名①
+ *                 （縦中央）  氏名②
+ *     ⚠️ アイコンは ⚠️ **氏名①②の2行に対して縦の真ん中**にそろえる。⚠️ 氏名①と②は左端をそろえる。
+ *     ⚠️ 氏名②は少し小さい灰色（⚠️ 氏名①と区別するため）。
+ *   氏名②なし:   [アイコン] 氏名①  … ⚠️ 今までと同じ（⚠️ 行の高さを変えない）
  */
-export const CustomerName2 = ({ value }: { value: unknown }) => {
-    if (!hasCustomerName2(value)) return null;
-    const text = String(value).trim();
+export const CustomerNameCell = ({ icons, name, name2, after }: CustomerNameCellProps) => {
+    if (!hasCustomerName2(name2)) {
+        return <>{icons}{name}{after}</>;
+    }
+    const text = String(name2).trim();
     return (
-        <div style={{ fontSize: '0.85em', color: '#6c757d', lineHeight: 1.3 }} title={`氏名②：${text}`}>
-            {text}
+        <div style={{ display: 'flex', alignItems: 'center' }}>
+            {icons && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center' }}>{icons}</span>}
+            <div style={{ minWidth: 0 }}>
+                <div>{name}{after}</div>
+                <div style={{ fontSize: '0.85em', color: '#6c757d', lineHeight: 1.3 }} title={`氏名②：${text}`}>{text}</div>
+            </div>
         </div>
     );
 };
```
