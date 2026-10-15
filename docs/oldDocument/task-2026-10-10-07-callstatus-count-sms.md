# 2026-10-10 v2.2.186 架電状況：SMS送信も総架電数に入れる

## 経緯
- 架電数が少ないという指摘 → 本番 SQL で 高 裕真 の 2026-10 を確認: 通電 6 ／ 未通電 3 ／ **SMS送信 19**
  - 画面の総架電数は 通電＋未通電 の 9 で、数え方自体は正しかった（task-2026-10-10-06 参照）
- 指示: **SMS送信も総架電数にカウントする**（新しいブランチ。⚠️ v2.2.185 が main 未マージのため v2.2.185 から切った）

## 変更（frontend/src/components/header/CallStatusList.tsx）
| 箇所 | 変更前 | 変更後 |
|---|---|---|
| 店舗スタッフ表示の「総架電数」 | 通電・未通電 | **通電・未通電・SMS送信** |
| インサイドセールス表示の「総架電数」（`callFilter`） | 通電・未通電 | **通電・未通電・SMS送信** |
| 通電数 | 通電 | 変更なし |
| インサイドセールス表示の「SMS送信数」の行 | SMS送信 | 変更なし（⚠️ SMS は総架電数と SMS送信数の両方に出る） |

### 追加した定数・関数
- `CALL_COUNT_ACTIONS = ['通電', '未通電', 'SMS送信']`
- `isCallCountAction(action)`
- 2か所の判定をこれに置き換え（両表示で同じ規則にするため）

### 影響
- 土地新着ネット（estate）の「総架電数（目標100件）」の色分けも SMS 込みの数で判定される
- 通電数・アポ取得数・来場数は変わらない

## 変えていないところ（同じ「架電」の数え方をしている別の画面）
- `components/information/InformationEdit.tsx` / `InformationEditKaeru.tsx` / `InformationEditResale.tsx` の `callLength`（顧客ごとの架電回数。通電・未通電のみ）
- `components/information/TableCall.tsx`（電話アイコンは通電・未通電のみ）
- `components/header/DailyReports.tsx`（日報の totalCalls。未通電・通電の対応表）
→ 揃える場合は別途指示

## その他
- version.ts 2.2.186、`backend/scripts/sql/2026-10-10_update_log_2.2.186.sql`
- ⚠️ ローカル DB へは未投入（181〜185 も）

## 確認
- eslint: 新規の警告なし（既存の exhaustive-deps 2件）、`npm run build` 成功 → **`main.d77bae53.js`**

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
index a730b33f..06eaa591 100644
--- a/frontend/src/components/header/CallStatusList.tsx
+++ b/frontend/src/components/header/CallStatusList.tsx
@@ -57,6 +57,15 @@ const filteredStaffName = (value: string) => {
 
 const dateFormate = (value: string) => (value ?? '').replace(/-/g, '/');
 
+/**
+ * 総架電数に数える action（v2.2.186）。
+ * ⚠️ 2026-10-10 の指示で ⚠️ **SMS送信も総架電数に入れる**（それまでは 通電・未通電 だけ）。
+ * ⚠️ 通電数は 通電 だけ（変更なし）。⚠️ インサイドセールス表示の「SMS送信数」の行は別に残る（SMS は両方に出る）。
+ * ⚠️ 店舗スタッフ表示とインサイドセールス表示の両方でこの一覧を使う（⚠️ 片方だけ直さない）。
+ */
+const CALL_COUNT_ACTIONS = ['通電', '未通電', 'SMS送信'];
+const isCallCountAction = (action: string): boolean => CALL_COUNT_ACTIONS.includes(action);
+
 /**
  * インサイドセールスの対象店舗。
  *
@@ -290,7 +299,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
                                 targetInsideSales ? safeFormate(a.staff).includes(safeFormate(targetInsideSales)) : true
                             );
 
-                            const callFilter = base.filter(p => p.action === '通電' || p.action === '未通電');
+                            // ⚠️ v2.2.186: SMS送信も総架電数に入れる（CALL_COUNT_ACTIONS）
+                            const callFilter = base.filter(p => isCallCountAction(p.action));
                             const postFilter = base.filter(p => p.action === '資料郵送');
                             const mailFilter = base.filter(p => p.action === 'メール送信');
                             const smsFilter = base.filter(p => p.action === 'SMS送信');
@@ -433,7 +443,8 @@ const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) =>
 
                                                     if (!isTargetStaff) return false;
 
-                                                    if (category === '総架電数') return log.action === '通電' || log.action === '未通電';
+                                                    // ⚠️ v2.2.186: SMS送信も総架電数に入れる（CALL_COUNT_ACTIONS）
+                                                    if (category === '総架電数') return isCallCountAction(log.action);
                                                     if (category === '通電数') return log.action === '通電';
                                                     return false;
                                                 })
```
