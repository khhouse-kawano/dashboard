# デプロイ手順 v2.2.244　不動産企画係：反響から商談までのつながり

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | brokerage_listings に失注理由の列（lostReason・lostDate・lostNote）を足し、取り込み済みの値を原本から写す。買い反響の「内見済み」を「内見済」に直す | ① DB `backend/scripts/sql/2026-11-04_realty_deal_lost.sql` |
| 2 | 保存・取り込みで失注理由の列を受け付ける（`features/realty/index.ts`・`importer.ts`） | ⚠️ **② VPS（再ビルド）** |
| 3 | ② が落ちたときの代わり（broker_update.php）でも失注理由の列を受け付ける | ① PHP 1ファイル |
| 4 | 反響の段階 → 媒介台帳・商談案件の自動のつながり、商談案件管理の作り直し、選択肢の統一、版の番号 | ① フロント |
| 5 | 更新履歴・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（新規）・「不動産企画係の画面（入口と権限）」（上書き） | ① DB `backend/scripts/sql/2026-11-04_update_log_2.2.244.sql` |

新しい request はありません（`planner:records`・`broker:update` は今までどおり）。

## 順序
```
0. GitHub で v2.2.244 を production へマージ（PR）
1. ① SQL（列の追加）                  ← ⚠️ 先に。② とフロントが新しい列に書く
2. ② 再ビルド                         ← ⚠️ 実行中の Claude による分析が無いときに
3. ① PHP 1ファイル
4. ① フロント
5. ① SQL（更新履歴・業務ガイド）       ← ⚠️ 1回だけ
```

### 手順1　【① SQL】列の追加
phpMyAdmin（または SSH の mysql）で `2026-11-04_realty_deal_lost.sql` を流します。何度流しても同じ結果になります。
- 最後の SELECT で `naiken_mi` が 0 ならよいです
- `lost_with_reason` は、失注の商談案件のうち、以前のアプリで理由が入っていたものの数です（ローカルでは0でした）

SSH で流すとき（`-p` だけにして、パスワードは聞かれてから入力）:
```bash
mysql --default-character-set=utf8mb4 -h MYSQLホスト名 -u MYSQLユーザー名 -p DB名 < 2026-11-04_realty_deal_lost.sql
```

### 手順2　【② VPS で実行】再ビルド
実行中の分析が無いことを ① の phpMyAdmin で確かめます（0行ならよい）:
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
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"broker","roll":"update"}'
```
⚠️ `認証が必要です。`（401）ならよいです。

### 手順3　【① FTP】PHP 1ファイル
| ① の場所 | 元のファイル |
|---|---|
| `/dashboard/api/gateway/handlers/brokerAction/broker_update.php` | `backend/src/handlers/brokerAction/broker_update.php` |

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"broker","roll":"update"}'
```
⚠️ `認証が必要です。`（401）ならよいです。

### 手順4　【① フロント】いつもの手順

### 手順5　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-04_update_log_2.2.244.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.244 で、1行だけならよいです。

## 終わったら（動作確認）
不動産企画係の画面に入れる人で確かめます。
1. 「商談案件管理」に、以前のアプリの商談案件が出る
   - 契約済・決済完了などの案件と、担当者別サマリーが出ればよいです
   - 「決済完了を隠す」を外すと、決済完了の案件も出ます
2. 「売り反響」「買い反響」で、段階の選択肢が以前のアプリと同じ名前になっている（通電済・訪問査定予定・内見済 など）
3. ⚠️ 本番で試すときは、実際の反響を「媒介受託」「購入申込」にしないでください。台帳・案件が本当に作られます

## 注意
- ⚠️ 段階を「媒介受託」にすると媒介獲得台帳に、「購入申込」にして「OK」を押すと商談案件に、**本当に1件が作られます**。間違えて作ったときは、台帳・案件の画面で消してください（商談案件管理の「編集」→「削除」）。
- 媒介獲得台帳の「買付有」から商談案件を作る「買付登録」は、まだ入っていません（次の版の予定）。
- 買取再販の消費税（土地建物の按分）は、v2.2.245・v2.2.246 で入れる予定です。

## 切り戻し
- 画面だけ戻す：① のフロントを v2.2.243 に戻す（商談案件管理は前の形に戻ります）
- 列は残してかまいません。② と PHP は新しい列を受け付けるだけなので、戻さなくても前の画面は動きます
- 「内見済み」→「内見済」の修正は戻さなくてよいです（以前のアプリの正しい値）
