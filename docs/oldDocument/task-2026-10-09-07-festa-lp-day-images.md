# 2026-10-09 フェスタLP（index.html）当日用の画像差し替え

## 依頼
`C:\Users\shinji-kawano\Downloads\20260425_kokubu_ouchi_festa_LP_NK\index.html`
- 2026-10-10 0:00 に公開する当日版を作る
  - img2sp.jpg / img5sp.jpg / img10sp.jpg を外す（いずれも「ご予約はこちらから」のバナー。`<a href="#form">` ごと削除）
  - img1sp.jpg → img1sp_2.jpg ／ img4sp.jpg → img4sp_2.jpg ／ img9sp.jpg → img9sp_2.jpg
- 現状の LP は `index_bk.html` としてすぐ戻せるように残す

## ファイル（リポジトリ外）
| ファイル | 内容 |
|---|---|
| **index_bk.html**（新規） | 差し替え前の index.html の完全なコピー（img フォルダは共通なのでそのまま開ける） |
| **index.html** | 当日版 |

## 画像サイズ（width / height 属性も合わせた）
| 前 | 後 |
|---|---|
| img1sp.jpg 768×1130 | img1sp_2.jpg 768×1068 |
| img4sp.jpg 768×3059 | img4sp_2.jpg 768×3005 |
| img9sp.jpg 768×718 | img9sp_2.jpg 768×658 |

## 0:00 の作業
- index.html と img/img1sp_2.jpg・img4sp_2.jpg・img9sp_2.jpg・newAnchor.jpg をアップロード（⚠️ 08 で予約バナーを newAnchor.jpg に差し替え。task-2026-10-09-08 参照）
- 戻すとき: index_bk.html を index.html として上げ直す
- ⚠️ 予約フォーム（#form）は LP に残っている（バナーを外しただけ）

## 差分（index_bk.html → index.html）
```diff
262c262
<         src="img/img1sp.jpg"
---
>         src="img/img1sp_2.jpg"
264c264
<         height="1130"
---
>         height="1068"
268,277d267
<       <a class="lp__anchor" href="#form">
<         <img
<           class="lp__img"
<           src="img/img2sp.jpg?20260928"
<           width="768"
<           height="988"
<           alt="ご予約はこちらから"
<         />
<       </a>
< 
287c277
<         src="img/img4sp.jpg"
---
>         src="img/img4sp_2.jpg"
289c279
<         height="3059"
---
>         height="3005"
293,302d282
<       <a class="lp__anchor" href="#form">
<         <img
<           class="lp__img"
<           src="img/img5sp.jpg?20260928"
<           width="768"
<           height="994"
<           alt="ご予約はこちらから"
<         />
<       </a>
< 
326c306
<         src="img/img9sp.jpg"
---
>         src="img/img9sp_2.jpg"
328c308
<         height="718"
---
>         height="658"
331,340d310
< 
<       <a class="lp__anchor" href="#form">
<         <img
<           class="lp__img"
<           src="img/img10sp.jpg?20260928"
<           width="768"
<           height="869"
<           alt="ご予約はこちらから"
<         />
<       </a>
```
