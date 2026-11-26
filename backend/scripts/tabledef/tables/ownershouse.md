---
table: ownershouse
title: オーナーズハウス・モデルハウスの物件
business: order
source: 改修
---
kh-house.jp/owners_house/ に出す見学先（オーナーズハウス・モデルハウス・完成見学会）の物件。1物件＝1行（v2.2.283 から ① の DB のこの表が元）。
登録・編集は Dashboard の「オーナーズハウス」（ownershouse/OwnersHouseAdmin.tsx・OwnersHouseEditModal.tsx・OwnersHouseImages.tsx。request owners_house_admin_list・owners_house_admin_save・owners_house_admin_image。② features/ownersHouse/admin.ts・images.ts）。
読むのは公開サイト（request owners_house_list・owners_house_detail。flag = '1' だけ。認証なし）と見学予約（owners_house_reservation。id で物件を引き、店舗・ブランドを決める）。
⚠️ no = 1 は列名が入った見出しの行。管理画面は読まない・直させない。
⚠️ 個人情報は持たない（公開してよい物件情報だけ）。

## 列
- no: 連番（主キー）。⚠️ no = 1 は列名が入った見出しの行（category = 'category'）。サイトも管理画面も出さない
- id: 物件ID（8桁の数字の文字列。例 00000002）。サイトの物件ページの URL（owners?id=）に使う。新しい物件は最大＋1
- category: 種別：オーナーズハウス／モデルハウス／完成見学会。地図のピンの色・見出しの出し分けに使う
- pref: 都道府県（「都府県」を抜いた形。例 鹿児島）。サイトの県の絞り込み。lg_code.pref_short
- area: 市区町村（「市区町村」を抜いた形。例 霧島）。サイトのエリアの絞り込み。lg_code.city_short（一覧に無い呼び名もある：出水阿久根・加世田・肝属）
- lg_code: 地方公共団体コード（lg_code.code）。管理画面で市区町村を選ぶと入る
- name: 所在地の表示（番地なし。例 鹿児島県霧島市国分府中町）
- title: 物件の見出し（オーナーズハウスのとき、一覧・物件ページ・地図の吹き出しに出す）
- brand: ブランド略称（KH / DJH / Nagomi / 2L / FH / PGH / JH）。見学予約の通知先を決める（② ownersHouse/reservation.ts の BRANDS）
- shop: 管理店舗（shop_list の division = 注文事業 の店舗名）。物件ページの「管理店舗」・見学予約の店舗
- shop_zip: 管理店舗の郵便番号
- shop_address: 管理店舗の住所
- staff: 担当（オーナー様が書いてきた内容のまま）
- tag: タグ（カンマ区切り）。サイトの #タグ の絞り込み
- feature_1: 特徴1（物件ページの箱）
- feature_2: 特徴2（物件ページの箱）
- feature_3: 特徴3（物件ページの箱）
- feature_4: 特徴4（物件ページの箱）
- feature_5: 特徴5（⚠️ いまのサイトは出していない）
- img_1: 画像1（メイン。一覧のサムネイル・地図の吹き出し）。ファイル名（<ID>/<ID>_01_xxxxxx.jpg）。http で始まる値は引っ越し前の URL
- img_2: 画像2（メイン）。ファイル名。http で始まる値は引っ越し前の URL
- img_3: 画像3（メイン）。ファイル名。http で始まる値は引っ越し前の URL
- img_4: 画像4（メイン）。ファイル名。http で始まる値は引っ越し前の URL
- img_5: 画像5（カルーセル）。ファイル名。http で始まる値は引っ越し前の URL
- img_6: 画像6（カルーセル）。ファイル名
- img_7: 画像7（カルーセル）。ファイル名
- img_8: 画像8（カルーセル）。ファイル名
- img_9: 画像9（カルーセル）。ファイル名
- img_10: 画像10（カルーセル）。ファイル名
- img_11: 画像11（カルーセル）。ファイル名
- img_12: 画像12（カルーセル）。ファイル名
- img_13: 画像13（カルーセル）。ファイル名
- img_14: 画像14（カルーセル）。ファイル名
- map_address: 物件ページの地図（Google マップ埋め込みの iframe）。管理画面で保存すると lat_and_long から作り直す
- lat_and_long: 緯度, 経度（「31.36, 130.81」の形）。サイトの地図のピン。管理画面の地図で決める
- structure: 構造（平屋・2階建てなど）
- large: 延床面積（例 110.96㎡）
- plan: 間取り（例 4LDK）
- flag: 公開（'1' = サイトに出す。それ以外は出さない）
- updated_at: 管理画面で最後に保存した日時
- updated_by: 管理画面で最後に保存したスタッフ名
