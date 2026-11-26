# デプロイ手順 v2.2.304　物件DB を表示する件数分だけ読む（② で絞り込み・並べ替え・ページ分け）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「物件DB」（1ページ分ずつ読むこと・URL に条件が出ること） | ① DB `backend/scripts/sql/2026-11-26_update_log_2.2.304.sql` |
| 2 | `property_list`（GET）に `page` が付いたら、② が絞り込み・PV の計算・並べ替えをして1ページ分（物件・ポータル3つ・ひもづく顧客と件数）だけを返す。`page` が無ければ今までどおり全件 | ② VPS（features/propertyGet.ts） |
| 3 | 物件DB（建売）・掲載物件一覧（中古）が、開いたとき20件分だけを読む。ページ送り・表示件数・絞り込み・並べ替えで読み直す。条件とページを URL に出す（`?shop=` `rank` `name` `address` `staff` `company=1` `contract=1` `sort` `dir` `page` `perPage`。SUUMO 掲載順位の `?date=` は残す） | Dashboard（frontend の build） |

- ⚠️ v2.2.303 を先に済ませてください（v2.2.303 の SQL の直し＝`SET SQL_SAFE_UPDATES` で挟む形も、この版で main に入ります）。
- ① PHP は変わりません（`property_list` は v2.2.301 から GET の許可リストに入っています）。表の変更もありません（テーブル定義書の SQL もありません）。
- ② は `page` が無いと今までどおり全件を返すので、② を先に上げても今の画面は動きます。画面を先に上げると、② に届くまでは予備（① の全件 POST）で開きます（開くのが遅いだけ）。
- 送る量：開いたとき 約3.8MB（全件）→ 約200KB（20件分。ローカルの 11/26 朝の写しで測定）

## 順序
```
1. GitHub で v2.2.304 を production へマージ（PR）
2. ① SQL：2026-11-26_update_log_2.2.304.sql   ← ⚠️ 1回だけ
3. ② VPS
4. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-26_update_log_2.2.304.sql
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
- `git log` が v2.2.304 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。
- 確認（トークン無しで 401 なら ② まで届いています）：
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=property_list&category=spec&page=1'
  ```

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/DatabaseProperty.tsx`
  - `src/components/database/listUrl.ts`（URL に残すパラメータを指定できるようにした。ほかの画面の動きは同じ）
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 建売の「物件DB」を開く。表が20件で出て、件数が今までと同じ。ブラウザの開発者ツールで `request=property_list&category=spec&page=1&perPage=20` の GET が1回出て、`property` の POST が出ない。
2. ページを送る・表示件数を変える・「反響数」などの見出しで並べ替える・店舗やランク・物件名で絞る。表と件数が変わり、アドレスに条件が出る（例 `?rank=Aランク&page=2`）。絞り込み・並べ替えを変えると1ページ目に戻る。
3. そのアドレスで開き直すと、同じ一覧・同じページが出る。
4. 「SUUMO掲載順位」で前の日を選んだまま絞り込んでも、アドレスの `date=` が消えない。
5. 「詳細」を押すと、物件の詳細が今までどおり開く。
6. 中古の「掲載物件一覧」でも 1・2 が同じように動く。

## 切り戻し
- 画面：前の build に戻せば、今までどおり全件を読みます（② の `page` 無しは変わっていないため）。
- ②：前の版に戻しても、今の画面は予備（① の全件 POST）で開きます。
