---
table: guide_article
title: 業務ガイドの記事
business: common
source: 改修
---
業務ガイド（v2.2.194〜。画面 frontend/src/components/guide/Guide.tsx、別ウインドウの /guide）の記事が1行1本。
② の features/guide.ts が読み書きする（guide_list・guide_article・guide_save。① に PHP は無い）。読むのはログインした全員、書くのは Master / BrandAdmin だけ。
エージェントは原稿 backend/scripts/guide/articles/ から build-guide-sql.cjs で SQL を作って入れる（CLAUDE.md「業務ガイドの記事」）。
⚠️ 記事は消さない（published = 0 で隠す）。⚠️ 保存のたびに直前の内容を guide_history に積む。
⚠️ タイトルを変えると [[ ]] のリンクが切れる。事業が違ってもタイトルは重複できない。

## 列
- id: 連番（自動採番）。guide_history.article_id から参照される
- title: 記事のタイトル（例: 契約したら（注文営業））。⚠️ [[ ]] リンクの照合キー。一意
- division: 事業区分（order 注文営業 / spec 建売営業 / used 中古リノベ / common 共通）
- section: 分類（用語 / 画面の使い方 / 業務の流れ）
- summary: 一覧に出す1行の説明
- body: 本文（Markdown）。⚠️ 60,000 バイトまで（② で検査）
- sort: 分類の中の並び順（小さいほど上）
- published: 1 = 出す / 0 = 隠す
- updated_by: 最後に保存した人（staff.name）
- created_at: 作った日時
- updated_at: 最後に保存した日時
