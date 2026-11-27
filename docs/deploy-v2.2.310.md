# デプロイ手順 v2.2.310　見学クラウドの予約で「建築予定時期」「質問・ご連絡事項」を受け取り、社内通知のメールにも載せる

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「反響が来たら」（注文。見学クラウドのお知らせメールの節を追加） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.310.sql` |
| 2 | `kengaku_cloud`（見学クラウドの予約の受け口）：建築予定時期を受け取り、備考の先頭に「建築予定時期：○○」を入れる。社内通知のメールに「建築予定時期」「ご質問・ご連絡事項」の行を足す | ② VPS（features/kengakuCloud/entry.ts） |
| 3 | 画面の版の表示（version.ts）だけ | Dashboard（frontend の build） |
| 4 | 見学クラウドの GTM「予約内容の保存」タグを v4 に差し替え（`build_timing` を保存する） | GTM（全ブランドのコンテナ） |

- 表の変更はありません（テーブル定義書の SQL もありません）。① PHP の変更もありません（GTM は ② の `api.khg-marketing.info/api/gateway` へ直接送る）。
- ⚠️ ② を先に上げてから GTM を差し替えてください。GTM だけ先に変えると、② が建築予定時期を読まないままになります。
- ② を上げた時点で、GTM が v3 のままでも建築予定時期は入ります（v3 は見出しの文字「建築予定時期について」を名前にして送っていて、② はそれも読む）。v4 は名前をそろえるための差し替えです。
- 「質問・ご連絡事項」は今までも備考に保存していました（反響一覧の画面には出ない）。今回からメールにも載ります。

## 順序
```
1. GitHub で v2.2.310 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.310.sql   ← ⚠️ 1回だけ
3. ② VPS
4. Dashboard の画面を build してアップロード
5. GTM：「予約内容の保存」タグを gtm_reserve_save_v4.html に差し替えて公開
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.310.sql
```
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

### 手順3　【② VPS】
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
```
- `git log` が v2.2.310 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします（変えたのは `src/utils/version.ts` だけ）。

### 手順5　【GTM】
- 対象：見学クラウドに入っている GTM の、全ブランドのコンテナの「予約内容の保存」タグ（今は v3）
- 中身：`Downloads/gtm_reserve_save_v4.html`（v3 の対応表に2行足しただけ。トリガーは今のまま「DOM Ready（すべてのページ）」）
- 送信タグ（`gtm_reserve_send_v5.html`）は変えません
- 担当者への依頼文：`Downloads/GTM担当者への依頼_見学クラウド_v2.2.310.txt`
- 調べたときに、確認画面に保存タグと tracker.js が2つずつ入っていました。同じタグが2回登録されていないかも見てもらってください（二重でも結果は同じ上書きなので、害はありません）

## 終わったら（動作確認）
1. 見学クラウドでテストの予約をする（建築予定時期を選び、質問を書く）
2. 社内通知のメールに「建築予定時期：○○」「ご質問・ご連絡事項：○○」が出る
3. ① DB で備考を見る（お客様の値は画面に出さず、テストの行だけを見る）
```sql
SELECT inquiry_id, remarks FROM inquiry_customer WHERE inquiry_id LIKE 'kengakucloud_%' ORDER BY id DESC LIMIT 1;
```
4. テストの反響は、反響一覧で個人情報削除するか、対象外のタグを付ける

## 切り戻し
- ② ：前のコミットに戻せば、今までどおり（建築予定時期は保存しない・メールに載らない）。
- GTM：v3 に戻しても、② はそのまま動きます（v3 の名前も読むため）。
