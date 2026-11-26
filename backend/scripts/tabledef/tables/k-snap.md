---
table: k-snap
title: K-SNAP の写真
business: order
source: 改修
---
K-SNAP（お客様向けの施工写真ギャラリー https://k-snap.jp）の写真。1枚＝1行。
登録・編集はスタッフの画面（photo/Form.tsx・Edit.tsx。① handlers/k-snap_update.php。画像は ① に保存するので ② には移していない）。表示の切り替えは k-snap_show（show_snap・staff_show だけ）。
読むのは公開ギャラリー（request k-snap。show_snap = 1 だけ、owner は暗号化して返す）とスタッフの一覧（k-snap_edit・k-snap_load）。② features/ksnap/index.ts。
⚠️ 表の名前にハイフンがあるので SQL では `k-snap` と囲む。

## 列
- id: 連番
- detail: 写真の場所（内観・外観）
- category: 種別（施工事例・オーナーズハウス・モデルハウス・完成見学会）
- plan: 建物（平屋・2階建て）
- pref: 都道府県
- town: 市区町村
- brand: ブランド名（国分ハウジング・デイジャストハウス・なごみ工務店・ニーエルホーム）
- shop: 店舗
- note [推論]: （推定）写真の説明
- tag: タグ（JSON 配列の文字列）。公開ギャラリーの絞り込み
- image: 画像のファイル名（① に保存）
- staff: 登録したスタッフ
- created_at: 登録日時
- show_snap: 公開ギャラリーに出すか（1＝表示中）
- url [推論]: （推定）関連ページ（物件・施工事例のページなど）の URL
- staff_show: 公開ギャラリーに営業名を出すか（1＝表示）
- owner: お施主様名（「○○様邸」の表示に使う）。⚠️ 公開ギャラリーには暗号化して返す（core/ksnap.php・ksnap/owner.ts。同じ名前は同じ暗号文）
