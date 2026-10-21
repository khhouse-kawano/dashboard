# デプロイ手順 v2.2.198（左メニューに業務ガイドの検索）

⚠️ v2.2.197 は main にマージ済み。このブランチは main（v2.2.197 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 左メニューの業務ガイドの検索・記事を右側に出す枠・画面の版 | ① フロント（dashboard） |
| 2 | 更新履歴 ＋ 記事1本（業務ガイドの使い方） | ① DB |

- ⚠️ **② VPS は変更なし**（再ビルド不要。既存の `guide_list`・`guide_article` を使う）。⚠️ ① の PHP も変更なし。表の変更も無し。

## 順序
```
0. GitHub で v2.2.198 を main → production へマージ
1. ① フロント（build）
2. ① SQL（update_log ＋ 記事）
```

## 手順1　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.8bec2bb0.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順2　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-19_update_log_2.2.198.sql`（前半が update_log の1行、後半が記事1本）
- phpMyAdmin の「インポート」でファイルごと流す（文字コード UTF-8）。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = '業務ガイドの使い方';
```

## 確認（ログインした状態で・PC）
1. 左のメニューのロゴの下に「業務ガイドを探す」。「契約」と入れる → いまの事業と「全事業共通」の記事だけが、事業の札付きで出る。
2. 記事を押す → メニューの右側に記事が出る。「× 閉じる」・Esc で閉じる。
3. 記事の「↗ 〜を開く」→ 記事が閉じて、その画面が開く。
4. 不動産企画係では検索欄が出ない。スマホでは記事を押すと業務ガイドの画面に移る。
