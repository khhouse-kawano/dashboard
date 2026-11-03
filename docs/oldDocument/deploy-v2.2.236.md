# デプロイ手順 v2.2.236　LIFULL HOME'S の査定依頼メール → 売り反響に自動登録

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `request: 'homes_sale_assessment_entry'`（新規。合い言葉 MEMBER_ENTRY_KEY。売り反響に1行入れる） | ⚠️ **② VPS（再ビルド）** |
| 2 | `homes_sale_assessment_entry` を許可リスト2か所に追加 | ① PHP `core/express_proxy.php` |
| 3 | 版の番号（version.ts）だけ | ① フロント |
| 4 | 更新履歴・業務ガイド「売り反響・買い反響の歩留まり（不動産企画係）」 | ① DB `backend/scripts/sql/2026-10-30_update_log_2.2.236.sql` |
| 5 | GAS `HomesSaleAssessmentToDashboard`（新規。5分おき） | Google Apps Script |

⚠️ 表の変更は**ありません**（brokerage_listings の既存の列だけを使う。重複は extId の UNIQUE と電話番号で見る）。
⚠️ 合い言葉 MEMBER_ENTRY_KEY は、会員登録・カゴスマなどの取り込みと**同じ値**（② の .env.prod には入っている。追加の作業なし）。

## 順序
```
0. GitHub で v2.2.236 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php）
3. ① フロント
4. ① SQL（更新履歴・業務ガイド）
5. GAS を追加してトリガーを設定   ← ⚠️ 1 より後（先に動かすと ② が「該当する処理がありません」を返す）
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
確認（合い言葉なし。⚠️ 何も登録されない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"homes_sale_assessment_entry"}'
```
⚠️ `合い言葉が違います。`（401）ならよい。⚠️ 404・転送の話が出るなら ② が古い。

### 手順2　【① FTP】PHP 1ファイル
`/dashboard/api/gateway/core/express_proxy.php` を上書き。

確認（合い言葉なし）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"homes_sale_assessment_entry"}'
```
⚠️ `合い言葉が違います。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

### 手順3　【① フロント】いつもの手順

### 手順4　【① SQL】更新履歴・業務ガイド
phpMyAdmin、または ① に SSH で入って:
```bash
mysql --default-character-set=utf8mb4 -h <MySQLホスト名> -u <MySQLユーザー> -p <DB名> < ~/2026-10-30_update_log_2.2.236.sql
```

### 手順5　【GAS】スクリプトの追加とトリガー
1. 査定依頼メールが届く Gmail（[marketing] のメーリングリストを受けているアカウント）の Apps Script プロジェクトを開く
   - ⚠️ カゴスマなど他の取り込みと同じプロジェクトなら、スクリプト プロパティ MEMBER_ENTRY_KEY はもう入っている
   - 別のプロジェクトにする場合は、プロジェクトの設定 → スクリプト プロパティ に MEMBER_ENTRY_KEY（同じ値）を入れる。⚠️ 値をチャット・リポジトリに書かない
2. ファイルを追加し、`backend/scripts/gas/HomesSaleAssessmentToDashboard.gs` の中身を貼り付けて保存
3. 関数 `HomesSaleAssessmentToDashboard` を1回手で実行し、実行ログを見る
   - 直近1日に査定依頼メールがあれば `200 査定ID … success`（2回目からは `exists`）
   - メールが無ければ `おわり: 登録 0 件 / …` だけ
   - ⚠️ 401 なら合い言葉が違う。⚠️ 404 なら ② が古い（手順1）
4. トリガーを追加：関数 `HomesSaleAssessmentToDashboard`・時間主導型・**5分おき**

## 終わったら（動作確認）
- 不動産企画係 → 売り反響（一括査定）に、反響元「HOME's」・段階「リード受信」・担当「未割当」で入っている
- 備考に 査定ID・間取り・面積・ご要望・お客様の記入 などが入っている
- 同じお客様の反響が二重に入っていない（同じ査定ID・前後90日に同じ電話番号の売り反響があれば登録しない）

## 注意
- ⚠️ ＜匿名＞の査定依頼（連絡先なし）は取り込まない
- ⚠️ ② が止まっているときは登録されない（① の予備は無い）。② が戻れば、次の実行で直近1日分を取り込み直す
- ⚠️ 1日以上 ② が止まった場合は、GAS の `HOMES_SALE_QUERY` の `newer_than:1d` を一時的に `newer_than:3d` などにして1回手で実行する（取り込み済みは飛ばす）
