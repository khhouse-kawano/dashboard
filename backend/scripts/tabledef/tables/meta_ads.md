---
table: meta_ads
title: 他社広告ライブラリ
business: common
source: 改修
---
Meta 広告ライブラリから集めた他社（と自社）のバナー広告。1広告＝1行（ad_hash が UNIQUE）。
書くのは拡張機能（広告ライブラリで「自社DBに保存」）→ ② request meta_scrape（届かなければ ① handlers/meta_scrape.php）。画像は ① の dashboard/img/meta/ に置く。
読むのは画面「他社動向 → 他社広告ライブラリ」（MetaAdsDashboard.tsx。request meta_ads、ブックマークは roll: bookmark）。
⚠️ 自社の Meta 広告の成果（meta_ad_items・meta_ad_daily）とは別物。
⚠️ 同じ広告は2回目以降の取得で行が増えないので、「いつまで出ていたか」は分からない。
⚠️ ad_hash の作り方（features/metaAds/scrape.ts の metaAdHash）を変えると重複判定が効かなくなる。

## 列
- id: 連番
- advertiser_name: 広告主（他社のページ名）
- ad_title: 広告の本文・見出し（空白を詰めた形でハッシュに使う）
- image_filename: 画像のファイル名（ad_xxxxxxxxxxxxxxxx.jpg など）。① の dashboard/img/meta/ に置く
- lp_url: 広告のリンク先（? 以降も含めて生のまま。画面で押して開く）
- ad_hash: 重複判定のキー。sha256(広告主＋本文＋? 以降を除いた URL＋md5(画像の data URL))。UNIQUE
- scraped_date: 取得した日
- created_at: 登録日時
- bookmark: ブックマーク（1＝あり）。画面の☆で切り替える
- advertiser_area: 広告主の地域（全国・鹿児島県・熊本県・大分県・宮崎県・自社 など。空もある）。画面の地域の絞り込み
- advertiser_period: 掲載の開始日（画面に「開始:」で出す。例 2026/07/05 の形の文字列）
