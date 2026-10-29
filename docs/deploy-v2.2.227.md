# デプロイ手順 v2.2.227　反響一覧（ブラックリストの理由・再読み込み・個人情報削除・表の幅）／顧客DBの個人情報削除／担当事業 estate／メニューの固定／favicon

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `privacy_erase`（個人情報削除。新規）、`list:black` に「登録だけ」と理由、担当事業 estate（不動産企画係の権限・権限編集で保存できる値） | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | privacy_erase の5つを ① から ② へ転送／① の不動産企画係の権限に estate | ① PHP `core/express_proxy.php`・`core/authz.php` |
| 3 | 画面（反響一覧・顧客DB・事業を選ぶ画面・権限編集・日報・業務ガイド・メニュー）と favicon | ① フロント（いつもの手順）。⚠️ **public の favicon 7ファイルも上がること**（古い favicon.png は不要） |
| 4 | 更新履歴・業務ガイドの記事6本（修正） | ① DB `backend/scripts/sql/2026-10-29_update_log_2.2.227.sql` |
| 5 | 建売（spec）と以前の不動産企画係アプリの担当者を estate にまとめる | ① DB `backend/scripts/sql/2026-10-29_staff_shop_estate.sql` |

⚠️ 表の変更は**ありません**（staff.shop の値を書き換えるだけ）。

## 順序
```
0. GitHub で v2.2.227 を main → production へマージ
1. ② 再ビルド                         ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php・authz.php） ← ⚠️ 1 より後
3. ① フロント
4. ① SQL（更新履歴・ガイド）
5. ① SQL（担当事業を estate にまとめる） ← ⚠️ 1〜3 より後（先に流すと estate の人が事業を選ぶ画面で「閲覧権限がありません」になる）
```

### 手順1　【② VPS で実行】再ビルド
実行中の分析が無いことを ① の phpMyAdmin で確かめる（0行ならよい）:
```sql
SELECT id, staff_name, status FROM ai_analysis_job WHERE status IN ('queued','running') AND deleted_at IS NULL;
```
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

### 手順2　【① FTP】PHP 2ファイル
アップロード（`/dashboard/api/gateway/` の下）:
- `core/express_proxy.php`（privacy_erase の5つを ② へ転送。② だけ）
- `core/authz.php`（不動産企画係・媒介台帳の権限に estate）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"privacy_erase","roll":"inquiry","category":"spec"}'
```
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"privacy_erase","roll":"master","category":"used"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。⚠️ 502 で「ループ検知」なら ② が古い（手順1）。

### 手順3　【① フロント】いつもの手順
⚠️ `favicon.ico`・`favicon-16x16.png`・`favicon-32x32.png`・`favicon-48x48.png`・`apple-touch-icon.png`・`android-chrome-192x192.png`・`android-chrome-512x512.png` がサーバーの dashboard 直下に入ったことを確かめる。ブラウザのタブのアイコンは、キャッシュで古いまま見えることがある（Ctrl+F5）。

### 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-29_update_log_2.2.227.sql`

### 手順5　【① phpMyAdmin】担当事業を estate にまとめる
ファイル: `backend/scripts/sql/2026-10-29_staff_shop_estate.sql`
- ⚠️ **まず 1) の SELECT だけ流して**、対象の人（建売の人と、以前の不動産企画係アプリの担当者 時任・宮城・永田・岡崎。全事業の人は出ない）を確かめる
- よければファイル全体を流す。最後の確認で spec・realty が 0、estate が控えの人数と同じならよい
- 戻すとき: `backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql`（控え staff_shop_bk_227 から戻す。最後の確認が 0 ならよい）

## 終わったら（動作確認）
- 反響一覧（建売・中古）: 顧客タグのボタンが1段に並ぶ。「🔄 再読み込み」がある。いちばん右に「個人情報削除」
- 「ブラックリスト」を押すと小さな画面が開き、理由を入れないと登録できない（⚠️ 実在のお客様では試さない）
- 顧客DB（建売・中古）の顧客詳細の上に「個人情報削除」（⚠️ 実在のお客様では試さない。元に戻せない）
- 建売の人で入ると、事業を選ぶ画面で建売・中古・不動産企画係に入れて、注文は「閲覧権限がありません」
- 左のメニューが、右側をスクロールしても動かない
- ブラウザのタブのアイコンが新しい

## 注意
- ⚠️ 個人情報削除は元に戻せない。押せるのはその画面を使える全員（2026-10-29 の判断）
- ⚠️ ブラックリストの「登録」は、これまで別の反響で同じ人が登録済みだと逆に解除されていた。この版から、理由を入れて登録したときは解除しない
