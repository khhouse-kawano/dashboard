---
table: k-snap_customer
title: K-SNAP のお客様アカウント
business: order
source: 改修
---
K-SNAP の公開ギャラリーにログインするお客様のアカウント。1顧客＝1行。
発行は顧客情報の画面（InformationEdit.tsx の K-SNAP のボタン → request information の roll k-snap。① informationAction/information_k-snap.php）。4文字のパスワードを作ってお客様に伝える。
読み書きは公開ギャラリー（request k-snap_login・k-snap_customer・k-snap_customer_update。② features/ksnap/index.ts）。
⚠️ pass は平文で、ログインの試行回数の制限も無い。⚠️ k-snap_customer は SELECT * なので pass も返る。

## 列
- no: 連番
- pass: ログインのパスワード（4文字）。⚠️ 秘密の値。見ない・書かない
- id: 顧客ID（master_data.id）
- tag [推論]: （推定）お客様が選んだタグ。公開ギャラリーが k-snap_customer_update で書く
- setting [推論]: （推定）お客様の表示の設定
- log [推論]: （推定）お客様の閲覧の記録
- bookmark [推論]: （推定）お客様のブックマーク（お気に入りの写真）
- path [推論]: （推定）お客様が最後に見ていた画面の位置
