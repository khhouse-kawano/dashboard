---
table: ieuru_resale
title: イエウール 査定依頼の取り込み元
business: used
source: 改修
---
イエウール（売却査定サイト。中古住宅専門店）の査定依頼メールの内容。1行が1人（メールアドレスで見分ける）。
sync の runIeuru.ts（Gmail を IMAP で読む）が、1件ずつ ① の request ieuru_resale_update（handlers/ieuru_resale_update.php）へ送る。同じメールアドレスの行があれば UPDATE、無ければ INSERT。
そのあと portal/ieuru_resale.php が、その行を反響一覧（inquiry_customer_resale。`ieuru_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `ieul:<依頼日>:<氏名>`。氏名＋依頼日で重複を見る）へ足す（どちらも INSERT だけ）。
実行結果の画面（header/system/SyncLog.tsx）に名前が出る。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざる列がある（requestsToCompany・replacementFlag・buildingName・totalFloorArea はほぼ全行、comment・mansionName など）。下流では混ざらない列だけを使う。
⚠️ イエウールの依頼番号は取り出していない（以前の売却リードの extId `ieul:<番号>` とは結べない）。

## 列
- no: 連番（自動採番）
- id: 行の ID（`ie_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `ieuru_` ＋この値
- email: メールアドレス。同じ人かどうかの鍵
- name: お名前
- nameKana: フリガナ
- age: 年齢
- address: 住所（お客様）
- mobile: 電話番号
- preferredContactTime: 希望連絡時間
- reasonForAssessment: 査定理由（売却リードの reason に入る）
- requestsToCompany: 査定会社への要望。⚠️ 次の見出しが混ざる
- replacementFlag: 買い替え有無。⚠️ 次の見出しが混ざる
- assessmentMethod: 査定方法
- comment: コメント
- requestDate: 依頼日時。売却リードの受付日・重複判定に使う
- concurrentAssessments: 同時査定社数
- propertyType: 物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）
- propertyAddress: 物件住所（反響一覧の area・売却リードの所在地に入る）
- mansionName: マンション名
- roomNumber: 部屋番号
- buildingName: 建物名。⚠️ 次の見出しが混ざる
- exclusiveArea: 専有面積
- buildingArea: 建物面積
- landArea: 土地面積
- totalFloorArea: 延べ床面積。⚠️ 次の見出しが混ざる
- floorPlan: 間取り
- buildingAge: 築年数
- propertyStatus: 物件の状況
- relationshipToProperty: 物件との関係
- ownershipPeriod: 所有年数
- surroundingEnvironment: 周辺環境
- buildingStructure: 建物構造
- roadFrontage: 接面状況
- propertyAppeal: おうちの魅力
- purchaseAssessment: 買取査定
- assessmentAmountHighAndFast: 「高く売った場合」と「早く売った場合」の査定額
- priceMovement: 過去〜将来の値動き
- amountAfterTaxes: 査定額から税金を引いた手元に残る金額
- concerns: 気になること
- whatToDoIfSoldHigher: 予想より高く売れたら何がしたいか
- registered: システム受付日時（メールの受信日時）。反響一覧の反響日になる
- remarks: メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
