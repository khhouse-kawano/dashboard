---
table: spreadSheet
title: スプレッドシートのリンク集
business: common
source: 改修
---
社内で使う Google スプレッドシートの登録簿。1行が1シート（名前・URL・説明・分類）。
① の spreadSheet.php（全件を返す）と spreadSheet_update.php（URL で重複を確かめて登録・修正）が読み書きする。
⚠️ Dashboard の画面（frontend/src）からの呼び出しは見当たらない。khg-marketing.info/api/ の別アプリ（spreadSheet）が使っている（推定。docs/oldDocument/plan-2026-10-21-php-to-express.md）。

## 列
- no: 連番（修正のキー）
- name: シート名
- url: シートの URL。⚠️ 同じ URL は2行にできない（spreadSheet_update.php が弾く）
- description: 説明
- category: 分類（共通 / 注文住宅営業 / 広報・マーケティング / 生産部関係 / 中古住宅専門店 / 重要会議体）
- tag: タグ（自由入力）
- display [推論]: （推定）1 = 一覧に出す。登録の処理は書かない（既定値のまま）
