# 2026-10-09 フェスタLP（index.html）当日版：予約バナーを newAnchor.jpg に

## 依頼
task-2026-10-09-07 で外したアンカーリンクの画像3つ（img2sp.jpg / img5sp.jpg / img10sp.jpg）の位置に、**newAnchor.jpg** を入れる。

## 変更（`Downloads\20260425_kokubu_ouchi_festa_LP_NK\index.html`、リポジトリ外）
- 元の3か所（img1sp_2 の後・img4sp_2 の後・img9sp_2 の後）に `<a class="lp__anchor" href="#form">` ＋ `img/newAnchor.jpg` を戻した
- newAnchor.jpg: 768×273（width / height 属性も合わせた）、alt「ご予約はこちらから」（画像の文言と同じ）
- index_bk.html は変更なし（差し替え前の版）

## 0:00 にアップロードするもの
- index.html
- img/img1sp_2.jpg・img4sp_2.jpg・img9sp_2.jpg・**newAnchor.jpg**

## 差分（index_bk.html → index.html、07 と合わせた最終形）
```diff
262c262
<         src="img/img1sp.jpg"
---
>         src="img/img1sp_2.jpg"
264c264
<         height="1130"
---
>         height="1068"
271c271
<           src="img/img2sp.jpg?20260928"
---
>           src="img/newAnchor.jpg"
273c273
<           height="988"
---
>           height="273"
287c287
<         src="img/img4sp.jpg"
---
>         src="img/img4sp_2.jpg"
289c289
<         height="3059"
---
>         height="3005"
296c296
<           src="img/img5sp.jpg?20260928"
---
>           src="img/newAnchor.jpg"
298c298
<           height="994"
---
>           height="273"
326c326
<         src="img/img9sp.jpg"
---
>         src="img/img9sp_2.jpg"
328c328
<         height="718"
---
>         height="658"
335c335
<           src="img/img10sp.jpg?20260928"
---
>           src="img/newAnchor.jpg"
337c337
<           height="869"
---
>           height="273"
```
