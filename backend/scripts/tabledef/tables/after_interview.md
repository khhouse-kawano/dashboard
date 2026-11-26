---
table: after_interview
title: 面談後アンケートの回答
business: order
source: 改修
---
面談のあとにお客様が答えるアンケート（survey の面談後）。1行＝1回答。
書くのは ② survey/public.ts の面談後の保存（認証なし。旧 /survey/api/ の after_interview を移したもの）。同じ回答が30分以内にあれば2行目は入れない。署名が正しく既存のお客様なら customers.after_interview = 1 にする。
読むのは面談後アンケートの一覧（header/inquiry/AfterInterview.tsx、① afterInterview.php）。
⚠️ 列名とフォームの項目名が一致しない（例 confirmedAllItems にフォームの desired が入る）。対応は survey/public.ts の INSERT を見る。
⚠️ 回答の行はいつも残す（上書きしない）。

## 列
- no: 連番（自動採番）
- id: 顧客ID（master_data.id）。新規のお客様は 'new'
- dateStr: 回答日時（'YYYY/MM/DD HH:mm:ss'・日本時間の文字列）
- shop: 店舗
- name: お名前
- phone: 電話番号。⚠️ 今は書いていない（いつも空文字）
- InterviewFeedback: 面談で聞けたこと（フォームの toldInformation。複数選択を「, 」区切り）
- confirmedAllItems: フォームの desired の回答（列名は「全項目を確認できたか」）
- desireOwnership: フォームの condition の回答（列名は「家を持ちたい気持ち」）
- priorityCondition: フォームの importance の回答（重視する条件）
- ourCompanyFirstChoice: フォームの priority の回答（当社が第一候補か）
- otherCompaniesInterested: 気になっている他社（フォームの rival）
- staffName: 担当した営業の名前
- staffHospitality: 担当の対応の満足度（フォームの staffSatisfied）
- proposalFeedback: 面談・提案の満足度（フォームの interviewSatisfied）
- moreInfoOrImprovements: もっと知りたいこと・改善点（自由記述）
- nextConsultationRequests: 次回に相談したいこと（自由記述）
- changeStaffRequested: 担当の変更の希望
