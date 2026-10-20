# デプロイ手順 v2.2.201（見学クラウドの予約にも顧客ID・広告の情報を付ける）

⚠️ v2.2.200 は main にマージ済み。このブランチは main から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | tracker.js（リンクに顧客IDを付ける・引き継ぐ）・見学クラウドの受け口が landing_params を受ける | ⚠️ **② VPS（再ビルド）** |
| 2 | 画面の版 | ① フロント（dashboard） |
| 3 | 更新履歴 ＋ 記事1本（トラッキング設定） | ① DB |
| 4 | 見学クラウドをサイトとして登録 | ダッシュボード |
| 5 | 見学クラウドの GTM：tracker.js のタグを追加・送信タグを v5 に | ⚠️ **GTM（GTM-KRKCML59・GTM-5B9M9KGV）** |

- ⚠️ ① PHP・表の作成は無し。form_get も変えない。
- ⚠️ 自社サイト（kh-house.jp）の GTM のタグはそのままでよい（tracker.js が新しくなれば、見学クラウドへのリンクに顧客IDが付く）。

## 順序
```
0. GitHub で v2.2.201 を main → production へマージ
1. ② 再ビルド
2. ① フロント
3. ① SQL（更新履歴 ＋ 記事）
4. ダッシュボードで見学クラウドを登録
5. 見学クラウドの GTM を直して公開   ← ⚠️ 必ず 1 の後
```
- ⚠️ 5 を 1 より先にすると、古い ② が `landing_params` を知らないため、予約の URL パラメータの欄に `landing_params=…` という値が入る（予約自体は保存される）。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -c "LINK_HOSTS" backend-express/public/tracker.js
grep -c "readLandingParams" backend-express/src/features/kengakuCloud/entry.ts
```
⚠️ どちらも 1 以上なら v2.2.201 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認:
```bash
curl -s https://api.khg-marketing.info/t/v1/tracker.js | grep -c "ie-miru.jp"
```
⚠️ `1` が出ればよい。⚠️ tracker.js はブラウザに1時間キャッシュされる（すぐ試すときはシークレットウィンドウで）。

## 手順2　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- 変わるのは画面の版だけ。
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順3　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.201.sql`（前半が update_log の1行、後半が記事1本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = 'トラッキング設定';
```

## 手順4　【ダッシュボード】見学クラウドを登録
1. 「反響管理 → トラッキング設定」→「サイトを登録」
2. サイト名「見学クラウド（ie-miru）」、ブランドは（なし）、許可するオリジン `https://www.ie-miru.jp`
3. 保存 → 開いたタグのうち「GTM 用」をコピー

## 手順5　【GTM】見学クラウドに入っているコンテナを直して公開
対象：**GTM-KRKCML59**（見学クラウドの全ページ）と **GTM-5B9M9KGV**（/kokubuhousinggroup）
1. **tracker.js のタグを追加**（⚠️ GTM-KRKCML59 だけ。両方に入れると着地が2回記録される）
   - 種類：カスタム HTML。中身：手順4でコピーした「GTM 用」
   - トリガー：ページビュー（すべてのページ）。⚠️ 自社サイトの鍵のタグを見学クラウドで動かさないこと
2. **送信タグを v5 に差し替え**（GTM-KRKCML59 の「予約内容の送信」タグ、GTM-5B9M9KGV の同じタグの両方）
   - 中身：`Downloads/gtm_reserve_send_v5.html`（v4 に `landing_params` を送る数行を足しただけ。トリガーは今のまま）
3. プレビューで確かめてから公開

## 確認（本番）
1. シークレットウィンドウで `https://kh-house.jp/?utm_source=test201&utm_campaign=deploycheck` を開く
2. 見学予約のリンク（www.ie-miru.jp）を押す → 見学クラウドの URL の末尾に `utm_source=test201`・`khg_vid=…` が付いている
3. テスト用のイベントで予約を完了する
4. 反響一覧（注文）→ その予約の「流入：test201」→ 顧客IDと、kh-house.jp での着地が出る
5. トラッキング設定：kh-house.jp の着地は1件増え、見学クラウドの着地は増えない
