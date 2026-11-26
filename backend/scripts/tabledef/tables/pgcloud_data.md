---
table: pgcloud_data
title: PG CLOUD の顧客データの写し
business: order
source: 推論
---
（推定）以前の顧客管理システム PG CLOUD から書き出した注文住宅の顧客データ。1行が1人。
コードからの使用箇所なし（推定：顧客DB を Dashboard に移す前後に取り込んだ写し）。
登録日は 2025/01/20 までで止まっている（700件）。username は顧客DB（master_data）の id とは一致しない。
⚠️ 年収・家族・借入など機微な個人情報を含む。使わないなら整理の対象（推定）。

## 列
- username: （推定）PG CLOUD 上の顧客の ID・ログイン名
- shop: 担当店舗（例 DJH霧島店）
- staff: 担当営業
- register: （推定）登録日・登録区分
- interview: （推定）面談日
- tag: タグ
- address: 住所
- situation: 状況（例 見込み・重複・失注）
- label: （推定）ラベル
- estate: （推定）土地の有無
- furigana: フリガナ
- rank: 顧客ランク（例 Aランク〜Eランク）
- landline: 固定電話
- mobile: 携帯番号
- mail: メールアドレス
- sex: 性別
- birthday: 生年月日
- employment: 勤務形態
- company: 勤務先
- companyAddress: 勤務先の住所
- companyTerm: 勤続年数
- income: 年収
- family: 家族
- primarySchool: 小学校区
- juniorHighSchool: 中学校区
- zip: 郵便番号
- anotherAddress: （推定）別の住所
- house: （推定）今の住まいの形態
- utilityExpenses: （推定）光熱費
- rent: 家賃
- budget: 予算
- estateBudget: 土地の予算
- contractDate: 契約日
- repayment: （推定）希望の返済額
- bonus: （推定）ボーナス払い
- debt: 借入
- note: 備考
- brand: ブランド（例 国分ハウジング・デイジャストハウス・なごみ工務店）
- firstInterviewer: 初回面談の担当
- lastAction: 最終アクション
- lastActionDate: 最終アクションの日
- recentPlan: （推定）直近の予定
- registerDate: 登録日（例 2025年01月20日）
- telephone: （推定）電話の記録
- firstInterview: （推定）初回面談日
- contract: （推定）契約
- cancel: （推定）キャンセル
- transfer: （推定）引き継ぎ
- introductionName: 紹介者名
- introduction: 紹介の区分
- introductionDate: 紹介日
- registerName: 登録した人
- updateName: 更新した人
