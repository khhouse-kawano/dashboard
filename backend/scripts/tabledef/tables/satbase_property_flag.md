---
table: satbase_property_flag
title: SatBase物件の画面入力値
business: spec
source: 改修
---
SatBaseサマリー（header/SatBaseDatabase.tsx）で画面から入れる値（広告出稿・Instagram投稿のトグル）。1物件 = 1行（v2.2.152）。
satbase_property（SatBase の写し）と分けたのは、CSV で写しを入れ替えてもトグルが消えないようにするため。
書くのは ② satbase_update（追加と更新を兼ねる。先に satbase_property に物件があるかを確かめる）。読むのは ② satbase_list（satbase_property に LEFT JOIN し、無い行は 0）。① に PHP ハンドラは無い。
⚠️ 一度でも触った物件だけ行がある。⚠️ CSV の取り込み（satbase_import・入れ替えの SQL）でこの表に触らない。

## 列
- property_id: 物件ID（主キー）。⚠️ satbase_property.property_id と対応する
- ad_posted: 広告出稿状況。⚠️ 画面のトグル（0=未出稿 / 1=出稿済み）
- instagram_posted: Instagram投稿状況。⚠️ 画面のトグル（0=未投稿 / 1=投稿済み）
- updated: 画面から最後に更新した日時
- updated_by: 画面から最後に更新したスタッフ名
