# デプロイ手順 v2.2.197（顧客情報の担当営業：他店舗の営業も選べる）

⚠️ v2.2.196 は main にマージ済み。このブランチは main（v2.2.196 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 顧客情報（注文営業）の担当営業の選び方・画面の版 | ① フロント（dashboard） |
| 2 | 更新履歴 ＋ 記事1本（顧客DB） | ① DB |

- ⚠️ **② VPS は変更なし**（再ビルド不要）。⚠️ ① の PHP も変更なし。表の変更も無し。

## 順序
```
0. GitHub で v2.2.197 を main → production へマージ
1. ① フロント（build）
2. ① SQL（update_log ＋ 記事）
```

## 手順1　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.bda8fade.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順2　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-19_update_log_2.2.197.sql`（前半が update_log の1行、後半が記事1本）
- phpMyAdmin の「インポート」でファイルごと流す（文字コード UTF-8）。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = '顧客DB';
```

## 確認（ログインした状態で・注文営業）
1. 顧客DB でお客様を開き、「担当営業」を押す → 担当店舗の営業と「◯◯店 管理」だけが出て、一番下に「他店舗の営業を表示（N人）」。
2. 「他店舗の営業を表示」→ 店舗ごとに営業が並ぶ。上の欄で名前を探せる。
3. 他店舗の営業を選ぶ → 欄の右に「他店舗：◯◯店」。担当店舗は変わらない。保存して開き直しても同じ人が出る。
4. 担当が他店舗の営業・名簿に無い人のお客様を開く → 一覧の先頭に「現在の担当」。
5. 「◯◯店 管理」を選ぶ → 店舗管理への変更理由の入力が出る（以前と同じ）。
