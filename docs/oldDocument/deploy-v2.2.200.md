# デプロイ手順 v2.2.200（トラッキング設定：GTM 用のタグ）

⚠️ v2.2.199 から切ってある。v2.2.199 の main 未マージの2件（手順書の確認コマンド・touches.ts のコメント）も一緒に入る。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | トラッキング設定の「タグ」に GTM 用とフッター用の2種類・画面の版 | ① フロント（dashboard） |
| 2 | 更新履歴 ＋ 記事1本（トラッキング設定） | ① DB |

- ⚠️ ② VPS は**変更なし**（再ビルド不要。touches.ts はコメントだけ）。
- ⚠️ ① PHP・表の作成も無し。
- ⚠️ 登録済みのサイト（サイトキー）はそのまま使える。GTM に入れ済みのタグ（要素を作る書き方）もそのままでよい。

## 順序
```
0. GitHub で v2.2.200 を main → production へマージ
1. ① フロント（build）
2. ① SQL（update_log ＋ 記事）
```

## 手順1　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.1c40eccc.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順2　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.200.sql`（前半が update_log の1行、後半が記事1本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = 'トラッキング設定';
```

## 確認（ログインした状態で）
1. 「反響管理 → トラッキング設定」→ 行の「タグ」→「GTM 用」と「フッター用」の2つが出る。
2. 「GTM 用」の「コピー」→ ボタンが「コピーしました」になる。
3. 残りのサイトは、GTM を使うサイトは「GTM 用」をカスタム HTML（トリガー All Pages）に、使わないサイトは「フッター用」をフッターに入れる（⚠️ どちらか一方だけ）。
