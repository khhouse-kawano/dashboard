---
table: pgcloud
title: 来場予約フォームの控え
business: order
source: 改修
---
ホームページのキャンペーンフォーム（来場予約・見積もり・オーナー様邸見学など）の受付の控え。1行が1件の送信。列名が日本語。
② の campaign_form:entry（features/campaignForm/entry.ts）・estimate（features/estimate/entry.ts）・owners_house_reservation（features/ownersHouse/reservation.ts）が、反響一覧（inquiry_customer）に保存したあとに同じ内容を INSERT する。② に届かないときは ① の同じ名前の PHP が書く。
読むのは ① の cancelList.php・survey.php（ブランド・店舗・年齢・携帯番号・きっかけだけ。来場フォームの集計）。
⚠️ 失敗しても反響は保存済みなので、受付は止めない（ログだけ残す）。⚠️ INSERT では21列すべてを埋める（既定値が無い列があるため）。
⚠️ 列名に「・」を含むものは SQL でバッククォートで囲む。

## 列
- id: 連番（自動採番）
- タイムスタンプ: 受付日時（YYYY/MM/DD HH:MM:SS）
- ブランド: ブランド（例 KH・DJH・JH・PG HOUSE・PGH・なごみ・2L）
- 店舗: 店舗（ブランドの接頭辞＋来場希望の店舗。空なら「<ブランド>店舗未設定」）
- 姓: 姓
- 名: 名
- セイ: 姓（カナ）
- メイ: 名（カナ）
- 郵便番号: 郵便番号
- 都道府県: 都道府県
- 市・区: 市・区
- 町村・番地: 町村・番地
- ビル名・建物名: ビル名・建物名
- ご予約のきっかけ: ご予約のきっかけ（反響一覧の response_medium と同じ）
- その他質問: その他・ご質問
- 希望日: 来場希望日
- 希望時間: 来場希望時間
- 携帯番号: 携帯番号
- メールアドレス: メールアドレス
- 年齢: 年齢
- キャンペーン名: キャンペーン名（反響一覧の hp_campaign と同じ）
- キャンペーンID: キャンペーンID（form_table の campaign_id）
