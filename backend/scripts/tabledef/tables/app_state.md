---
table: app_state
title: 不動産企画係の設定と週次計画
business: realty
source: 改修
---
不動産企画係（realty）の設定・週次行動計画・コンプライアンスを JSON で持つ表。key ごとに1行で、いまは settings / weekly / compliance の3行。
形は以前の本番アプリ（Supabase の app_state）と同じ。② の features/realty/state.ts が読み書きし、画面は frontend/src/components/realty/（realtyState.ts）。importer.ts（以前のアプリからの取り込み）・calls.ts・ledgerLink.ts は settings の担当者（$.staff）を読む。
⚠️ 書き込みは項目ごとに JSON_SET で差し込む（全体を書き戻さない。64KB の不具合と、同時編集で消し合うのを避ける）。
⚠️ JSON の形を変えない。⚠️ 取り込みの前の控えは app_state_bk_import。

## 列
- key: settings＝期首年月・担当者と目標・反響元・買いポータル・反響単価・テンプレート・宅建業者情報・契約書の下書き など / weekly＝{ 'YYYY-MM': [週ごとの計画と実績] } / compliance＝コンプライアンスの項目の配列
- data: 設定値の JSON
- updated_at: 更新日時
