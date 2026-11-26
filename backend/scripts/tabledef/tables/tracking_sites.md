---
table: tracking_sites
title: アクセス解析のサイト
business: common
source: 改修
---
アクセス解析（広告流入トラッキング、v2.2.199）のタグを貼るサイト。1サイト＝1行（国分ハウジング・DAY JUST HOUSE・かえるホーム など）。
登録・更新は「反響管理 → アクセス解析」のサイトの設定（request tracking_site_list・tracking_site_save。features/tracking/sites.ts）。
公開の受け口（tracker.js → ② /api/track/…）が site_key でサイトを決め、tracking_touches・tracking_pageviews・tracking_conversions の site_id に入れる。

## 列
- id: 連番（各 tracking_ 表の site_id）
- site_key: タグに埋め込むキー（s_＋16文字）。公開される識別子で、認証には使わない
- name: サイト名
- brand: ブランドキー（kh / djh / nagomi / fh / 2l / pg / jh / khf）。meta_ad_items.brand と同じ。NULL のサイトもある
- allowed_origins: 着地を受け付けるオリジン（JSON 配列）。例 ["https://kh-house.jp"]
- is_active: 0 = 無効（着地を保存しない）
- memo: 社内メモ（設置場所など）
- cv_pages: 完了ページ（CV にするページ。v2.2.287）。[{"pattern":"パスの先頭","kind":"CV の種類"}]。上から順に見て最初に当てはまったもの。NULL・[] なら反響の流入の記録（khg_vid）で数える
- updated_by: 最後に登録・更新した人
- created_at: 登録日時
- updated_at: 更新日時
