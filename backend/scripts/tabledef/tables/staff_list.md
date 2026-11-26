---
table: staff_list
title: 人事マスタ（担当営業）
business: common
source: 改修
---
担当営業の登録簿。1行が「1人 × 年度（period）」で、年度が変わると同じ人の行が増える。
画面はヘッダーの「システム管理 → スタッフ」（header/system/EditStaff.tsx。② staffAdmin.ts の header_staff_edit / header_staff_insert / header_staff_update）。インサイドセールスの管理店舗は架電ステータスの設定（② callStatusMaster.ts）が書く。
反響一覧・顧客DB・案件一覧・全社報告・営業別契約率・KPI など多くの画面が、担当営業の選択肢や担当別の集計に読む（各画面で category / rank / report / inside などで絞る）。
⚠️ ログイン用の staff とは別の表で、連携していない。
⚠️ 同じ人が年度ごとに複数行あるので、名前で数えるときは period で絞るか GROUP BY name で畳む。
⚠️ id と inside・managed_shops を除き NOT NULL・既定値なし。INSERT では全列を埋める。

## 列
- id: 連番
- name: 氏名。⚠️ 「姓 名」と「姓名」が混在する（突き合わせは空白を除いて行う）
- pg_id: PG CLOUD（顧客管理）での担当者ID。反響一覧（注文）・面談アンケートが使う
- shop: 所属店舗（shop_list.shop。例 KH鹿児島店・インサイドセールス）。⚠️ staff.shop（担当事業）とは意味が違う
- section: 所属の課（section_list.name）
- mail: メールアドレス。⚠️ 画面には返さない
- robo_id [推論]: （推定）外部の連携ツールでの担当者ID。読む処理なし
- status: 在籍 / 退職
- category: 1 = 反響一覧に出す（担当営業の選択肢）
- rank: 1 = 案件一覧（ランク）・店舗担当別反響・顧客DB の担当営業に出す
- multi: 1 = 併売店舗のスタッフ
- khg_id: 社員番号（スタッフ画面の「No (ID)」。並びに使う）
- sort: 並び順（小さいほど上）
- report: 1 = 全社報告用フォーマット・営業別契約率・紹介の担当別に出す
- estate: 1 = 土地新着ネット（スタッフ画面のスイッチ）
- memo: 担当営業メモ（案件一覧で書く。rank の memo）
- period: 年度（文字列 '2026' など）。6月始まり（1〜5月はその年、6月以降は翌年）
- position: 役職（一般 / 店長 / 店長代理 / 課長 / IC / 管理用 など）。新規登録の既定は 一般
- inside: 1 = インサイドセールスの担当（ISの担当者はこれで引く。staff.brand = insideSales ではない）
- managed_shops: インサイドセールスの管理店舗（店舗名の JSON 配列。v2.2.293）。NULL は未設定
