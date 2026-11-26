---
table: before_survey
title: 事前アンケートの回答
business: order
source: 改修
---
来場予約のあとにお客様が答える事前アンケート（khg-marketing.info/survey_<ブランド>/）。1行＝1回答。
書くのは ② before_survey_entry（v2.2.207〜。認証なし。ブラウザから ② へ直接送り、あわせて通知メールを出す）。同期サービス（projects/sync）が反響と突き合わせて顧客へ取り込み、inquiry_update:before_survey で sync = 1 にする。
⚠️ 列のコメントはアンケートの設問の文そのもの。

## 列
- id: 連番（自動採番）。sync からは sbid という名前で届く
- sync: 0 = 未同期・1 = 同期済み（sync の inquiry_update:before_survey が 1 にする）
- brand: ブランド（KH / DJH / なごみ / FH / PGH / JH / 2L）。反響の brand と突き合わせる
- dateStr: 回答日（yyyy/MM/dd・日本時間）
- name: お名前(漢字)
- considerationStart: 新しいお住まいについて、いつ頃からご検討を始められたか教えてください。
- desiredMoveIn: ご入居希望時期を教えてください。
- visitedCompanies: 今まで何社の住宅会社様へご訪問されたか教えてください。
- reasonForConsidering: 新しいお住まいをご検討される理由を教えてください。(複数選択可)
- reasonOther: （ご検討の理由で「その他」を選択された方）内容をご記入ください。
- futurePlan: 今後の行動予定について教えてください。
- futureOther: （今後の行動予定で「その他」を選択された方）内容をご記入ください。
- desiredSize: お家の広さはどのくらいをご希望か教えてください。
- desiredLayout: ご希望の間取りを教えてください。
- priorityItem: 重視している項目を教えてください。
- expectedResidents: ご入居予定の人数を教えてください。
- totalBudget: おうちづくりの総予算を教えてください。
- monthlyRepayment: ご希望の月々の返済額を教えてください。
- annualIncome: 前年度の年収を教えてください。
- yearsOfService: 勤続年数を教えてください。
- otherIncomePerson: その他、ご年収がある方がいらっしゃるか教えてください。(複数選択可)
- otherAnnualIncome: ご年収がある方のご年収を教えてください。
- ownFunds: 自己資金でのお支払いのご予定があるか教えてください。
- otherLoans: その他ローンがございましたら教えてください。(複数選択可)
- thingsToDo: ご来場日は何をご希望ですか？(複数選択可)
- thingsToDoOther: （ご来場日のご希望で「その他」を選択された方）内容をご記入ください。
- housingType: どのような新しいお住いをご希望ですか？(複数選択可)
- housingTypeOther: （お住まいのご希望で「その他」を選択された方）内容をご記入ください。
- landArea: ご希望の土地のエリアを教えてください。
- referrerName: ご紹介者さま(公式アンバサダー含む)がいる場合はご紹介者さまの氏名をご記入ください。
- emailAddress: メールアドレス
