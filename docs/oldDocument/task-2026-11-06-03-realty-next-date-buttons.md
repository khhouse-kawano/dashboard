# 作業記録 v2.2.255　不動産企画係：顧客情報編集の日付ボタンの位置

## 依頼
- 2026-11-06（画面の写し：顧客情報編集（買））「次回架電日のアイコンボタンの位置がずれているので次のブランチで直す」→ 計画を出して「よい」

## 原因
- `LeadEdit.tsx` の `nextQuickButtons`（明日・3日後・1週間後・2週間後・1ヶ月後）は、次回連絡日の列とは別の **`col-12` の行**として置いていた → いつも左端に出る
  - 売り反響：次回連絡日が7つ目＝左端の列なので、たまたま揃って見えていた
  - 買い反響：次回連絡日が6つ目＝右端の列なので、ボタンが左の「通電日」の下に出ていた（依頼の画像）
  - 「追客終了」で終了理由の欄が増えたときも、同じようにずれていた

## 直したこと
- ボタンを、次回連絡日（商談は次回アクション予定日）の**列の中、入力欄のすぐ下**に移した。列の位置が変わっても、いつも欄の真下に出る
- ボタンの動き（今日から数えた日付を入れる）は変えていない
- この部品は売り反響・買い反響・チームサマリー・架電キューの編集で共通なので、どこでも直る。商談（Opportunity）の欄も同じ形だったので、そろえた

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/common | LeadEdit.tsx | `nextQuickButtons` の外側を `col-12` の行から普通の `div` に（`marginTop` を `-4px` → `4px`）。買い・売り・商談の3か所で、次回連絡日の列の中に入れた |
| backend/scripts/guide/articles/common | screen-247.md | 記事「反響から商談案件へのつながり（不動産企画係）」の「反響を登録する」に、日付ボタンの説明を1行 |
| backend/scripts/sql | 2026-11-06_update_log_2.2.255.sql（新規） | 更新履歴＋記事の SQL |
| frontend/src/utils | version.ts | 2.2.255 |

- ⚠️ ②・① の PHP・DB は変えていない

## テスト（ローカル）
- ① 経由：通信は変えていない（既存の画面の配置だけ）。データの読み書きは無し
- Playwright（3100、`scratchpad/pw_255.cjs`）。保存はしない
  - 買い反響：編集を開く → 「明日」ボタンの左端が次回連絡日の入力欄の左端と同じ（ずれ 0px）、入力欄の4px 下、欄の幅の中
  - 買い反響（追客終了を選んで終了理由の欄が増えたとき）：同じく真下
  - 売り反響：同じ2つ
  - 「3日後」を押すと次回連絡日に今日＋3日が入る（売り・買い）
  - 画面のエラー 0
- 一時スタッフ（id 999999）は消した。開発サーバーは止めた（3100 に v2.2.254 のときのサーバーが残っていたので、それも止めた）
- リファクタリング：変えたのは配置だけで、整理するところは無かった

## 業務ガイド
- 記事「反響から商談案件へのつながり（不動産企画係）」（common/screen-247.md）：「次回連絡日の欄のすぐ下の「明日」「3日後」「1週間後」「2週間後」「1ヶ月後」を押すと、今日から数えた日付が入ります」
- SQL は `2026-11-06_update_log_2.2.255.sql` の末尾。ローカルに流した（update_log は no=354）

## 修正した部品（全文）

### frontend/src/components/realty/common/LeadEdit.tsx の nextQuickButtons
```tsx
    // 💡 次回連絡日クイック設定ボタン（source.html の nextBar() 相当）
    // ⚠️ v2.2.255: 次回連絡日の列の中（入力欄の下）に置く。以前は col-12 の行で、買い反響では左端（通電日の下）に出ていた
    const nextQuickButtons = (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {NEXT_QUICK.map(q => (
                <button
                    key={q.label}
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    style={{ fontSize: '10px' }}
                    onClick={() => setCustomerInfo({ ...customerInfo, nextDate: addDaysISO(null, q.days) })}
                >
                    {q.label}
                </button>
            ))}
        </div>
    );
```

### 次回連絡日の列（買い・売り。商談は見出しが「次回アクション予定日」）
```tsx
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日 <span className="text-danger">*必須</span></label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                        {nextQuickButtons}
                                    </div>
```

## git diff
```diff
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index 6b4f10285..ead08c821 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -10,6 +10,7 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 売り反響・買い反響の画面の右上の「**反響を追加**」を押すと、登録の画面が開きます。
 - 受信日は必須です。売り反響は売主名か物件所在地のどちらか、買い反響は顧客名が必須です
 - 次回連絡日と次回アクションも必須です（編集のときと同じ）
+  - 次回連絡日の欄のすぐ下の「明日」「3日後」「1週間後」「2週間後」「1ヶ月後」を押すと、今日から数えた日付が入ります（売り反響・買い反響・商談案件の編集画面も同じ）
 - 同じ連絡先（電話・メール）、または同じ名前で同じ受信日の反響がすでにあると、確かめる画面が出ます。別の人なら「OK」で登録できます
 - 登録のときに選べる段階は、はじめのほうの段階だけです。媒介受託・購入申込・成約・追客終了は、登録したあとに一覧で変えます
 - 入れた電話番号・メールアドレスは、一覧の「連絡先」にも「電話 / メール」の形で入ります。あとで編集画面で電話番号・メールアドレスを直したときも、連絡先は同じ形に作り直されます（電話番号・メールアドレスを変えずに保存したときは、連絡先はそのままです）
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index 5bf78eb64..0eac13053 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -348,8 +348,9 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     };
 
     // 💡 次回連絡日クイック設定ボタン（source.html の nextBar() 相当）
+    // ⚠️ v2.2.255: 次回連絡日の列の中（入力欄の下）に置く。以前は col-12 の行で、買い反響では左端（通電日の下）に出ていた
     const nextQuickButtons = (
-        <div className="col-12" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '-4px' }}>
+        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
             {NEXT_QUICK.map(q => (
                 <button
                     key={q.label}
@@ -469,8 +470,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                                     <div className="col-md-4">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日 <span className="text-danger">*必須</span></label>
                                         <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
+                                        {nextQuickButtons}
                                     </div>
-                                    {nextQuickButtons}
                                     <div className="col-12">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション(メモ)</label>
                                         <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
@@ -507,8 +508,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                                     <div className="col-md-4">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日 <span className="text-danger">*必須</span></label>
                                         <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
+                                        {nextQuickButtons}
                                     </div>
-                                    {nextQuickButtons}
                                     <div className="col-12">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション(メモ)</label>
                                         <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
@@ -563,8 +564,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                                     <div className="col-md-4">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション予定日 <span className="text-danger">*必須</span></label>
                                         <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
+                                        {nextQuickButtons}
                                     </div>
-                                    {nextQuickButtons}
                                     <div className="col-12">
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション内容</label>
                                         <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index eeaf58dcf..d15d48b08 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.254';
+export const newVersion = '2.2.255';
```
