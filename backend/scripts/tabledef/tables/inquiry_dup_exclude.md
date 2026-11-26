---
table: inquiry_dup_exclude
title: 重複反響の除外の名簿
business: common
source: 改修
---
事業をまたいだ重複反響の判定（v2.2.276）から外す値の名簿。社員のテストに使ったメール・携帯など。1行が1つの値。
② の inquiryDup/refresh.ts が読み、名簿の値を持つ反響は inquiry_dup_key の鍵を NULL にする（重複の相手にしない）。
⚠️ 値そのものは持たず、正規化した値のハッシュだけを持つ。⚠️ 名簿のメールを持つ行の携帯も除外する（逆も）。
⚠️ 画面は無い。足すときは SQL で入れる（backend/scripts/sql/2026-11-17_update_log_2.2.276.sql を手本に）。足すと次に読んだときに inquiry_dup_key が作り直される。

## 列
- id: 連番（自動採番）
- kind: 値の種類。mail / mobile / domain（メールの @ の後ろ）
- key_hash: SHA2(正規化した値, 256)。正規化は inquiryDup/keys.ts と同じ（NFKC・空白除去・小文字など）
- note: 誰の・なぜ（例 社員のテスト）
- created_at: 登録日時
