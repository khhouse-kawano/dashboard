---
table: guide_history
title: 業務ガイドの記事の履歴
business: common
source: 改修
---
業務ガイドの記事（guide_article）を上書きする直前の内容が1行。② の features/guide.ts（guide_save）が更新と同じトランザクションで積む。build-guide-sql.cjs の SQL も上書きの前に積む。
⚠️ 上書きせず積み上げる。消さない。

## 列
- no: 連番（自動採番）
- article_id: どの記事の履歴か（guide_article.id）
- title: 上書き前のタイトル
- section: 上書き前の分類
- summary: 上書き前の1行の説明
- body: 上書き前の本文（Markdown）
- published: 上書き前の公開（1 = 出す / 0 = 隠す）
- edited_by: この内容を保存した人（＝上書きされる前の版を書いた人）
- edited_at: この内容が保存された日時（guide_article.updated_at の写し）
- saved_at: 履歴に積んだ日時（＝上書きされた日時）
