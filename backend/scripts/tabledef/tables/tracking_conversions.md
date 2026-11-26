---
table: tracking_conversions
title: アクセス解析の CV（自社フォーム以外）
business: common
source: 改修
---
自社のフォームでないサイト（まずはかえるホーム）でフォームを送った記録（v2.2.205）。サイト×顧客ID×メール×電話で1行（UNIQUE）。
書くのは ② の公開の受け口（GTM で入れた cv.js →「確認画面へ」で POST /api/track/cv。features/tracking/conversion.ts）。
② が5分ごとに反響（inquiry_customer_kaeru）のメール・電話を同じ方法でハッシュにして突き合わせ、一致したら反響の landing_params に khg_vid と流入の情報を書く（cvMatch.ts）。
アクセス解析の CV の数にも使う（完了ページが記録されないフォームの補い。conversions.ts・sites.ts）。
⚠️ メール・電話は保存しない（SHA-256 だけ）。⚠️ 14日たっても結びつかない行は ② が消す。

## 列
- id: 連番
- site_id: tracking_sites.id
- visitor_id: 顧客ID（khg_vid）
- form: フォームの種類（ページのパスの1段目。member・shop_reserve・search・contact など）
- email_hash: メールアドレス（小文字・前後の空白なし）の SHA-256。無ければ空
- tel_hash: 電話番号（数字だけ）の SHA-256。無ければ空
- landing_params: 送ったときにブラウザが覚えていた流入の情報（対象のキーと khg_vid だけ）
- page_url: フォームのページ（? 以降を除く）
- created_at: 最後に送った日時
- matched_inquiry_id: 結びついた反響の inquiry_id
- matched_at: 結びついた日時（NULL は未突き合わせ）
