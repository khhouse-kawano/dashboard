# デプロイ手順 v2.2.308　媒介獲得台帳：初めに「台帳の編集」のタブ／左5列の固定／30件ずつ GET（スクロールで続き）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（初めに開くタブ・30件ずつ・左5列の固定・アドレスの条件） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.308.sql` |
| 2 | 新しい request `broker_ledger_list`（GET。表示する台帳だけを絞り込み・並べ替えて `offset` から `limit` 件。既定30件） | ② VPS（features/realty/ledgerList.ts（新規）・gateway/registry.ts） |
| 3 | GET の許可リストと、② へ送るリスト2つに `broker_ledger_list` | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php` |
| 4 | 媒介獲得台帳：開いたとき30件だけ GET し、下までスクロールすると次の30件を GET。左の5列（No・編集・反響元・担当・媒介契約日）を固定。条件をアドレスに（`address` `customer` `staff` `propCategory` `status` `ielove` `sort` `dir`）。いえらぶと連携済みの台帳の「編集」で、初めに「台帳の編集」のタブを開く（物件の状況はタブを押したときに読み込む） | Dashboard（frontend の build） |

- ⚠️ v2.2.307 を先に済ませてください。表の変更はありません（テーブル定義書の SQL もありません）。
- 送る量（ローカルの写しで測定）：開いたとき 約10MB（台帳以外も含む全件の POST）→ 約80KB（30件の GET）。② の処理は 0.3 秒ほど。
  - ⚠️ 「⑥ いえらぶ」で絞るときだけ、② がいえらぶの物件と照らし合わせるので数秒かかります（60秒は結果を使い回すので、続きを読むときは速い）。
- 見出しの「反響元」「情報更新日」を押したときの並べ替えが効くようになりました（今までは押しても並びが変わらなかった）。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い `broker_ledger_list` を転送して 502 になります（画面は今までの POST＝全件に切り替わるので開けます）。
- 画面（手順5）を ① PHP より先に上げても開けます（GET が 400 になり、今までの POST＝全件に切り替わる）。

## 順序
```
1. GitHub で v2.2.308 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.308.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：db.php・express_proxy.php をアップロード
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.308.sql
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
- `git log` が v2.2.308 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/db.php`・`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=broker_ledger_list'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/DatabaseBroker.tsx`
  - `src/components/database/brokerLedgerFilter.ts`（新規。② に届かないときの絞り込み・並べ替え）
  - `src/components/database/PropertyRegister.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 媒介獲得台帳を開く。30件だけ出て、「該当 N 件」の横に「30件を表示中」と出る。開発者ツールで `request=broker_ledger_list` の GET が1回出て、`broker` の `list` の POST が出ない。
2. 一覧を下までスクロールすると、次の30件が出る（GET が `offset=30` で出る）。最後まで読むと「続き」の行が消える。
3. 一覧を横に動かしても、左の5列（No〜媒介契約日）が残る。下に動かしても見出しが残る。
4. 「③ 物件ステータス」などで絞ると、件数が変わり、アドレスに条件が付く。そのアドレスを開き直すと同じ一覧が出る。
5. 売り反響の「媒介獲得台帳で No.〇 を開く」で来ると、その台帳の行が黄色で出る（30件より後ろの台帳でも）。
6. いえらぶと連携済みの台帳の「編集」を押すと「台帳の編集」のタブで開く。「保存する」のあとも一覧が同じ件数のまま出る。

## 切り戻し
- 画面：前の build に戻せば、今までの POST（全件を1枚）に戻ります（`broker` の `list` は変えていないため）。
- ② と ① PHP：足しただけなので、戻さなくても前の画面に影響はありません。
