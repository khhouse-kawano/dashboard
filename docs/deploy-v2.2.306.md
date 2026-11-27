# デプロイ手順 v2.2.306　顧客DB の「商談・架電記録から検索」を複数の語で（すべて含む／いずれかを含む）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド3本（顧客DB・顧客DB（建売営業）・顧客DB（中古リノベ）の「商談・架電記録から検索」） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.306.sql` |
| 2 | `database_list` の条件 `recordMode`（`and`＝すべて含む／`or`＝いずれかを含む）。語を空白（半角・全角）で区切り5語まで。and はそのお客様の記録全体にすべての語があるか。`recordMode` が無い（古い画面）ときは今までどおり区切らない | ② VPS（features/database/recordSearch.ts・features/database/list.ts） |
| 3 | 3事業の顧客DB の記録の検索に「すべて含む／いずれかを含む」のラジオボタン（初めは「すべて含む」）。抜き出した文のすべての語に色。合わせ方を URL（`?recordMode=or`）に出す（既定は出さない） | Dashboard（frontend の build） |

- ⚠️ v2.2.305 を先に済ませてください。① PHP・表の変更はありません（`database_list` は GET の許可リストに入っています）。
- ② を先に上げても今の画面は今までどおり動きます（`recordMode` を送らないので区切らない）。画面を先に上げると、② に届くまでは語を区切らずに探します（「ローン 土地」は1つの語として探す）。順序は ② → 画面にしてください。

## 順序
```
1. GitHub で v2.2.306 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.306.sql   ← ⚠️ 1回だけ
3. ② VPS
4. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.306.sql
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
- `git log` が v2.2.306 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/recordSearch.tsx`（ラジオボタン・すべての語に色）
  - `src/components/database/DatabaseKaeru.tsx`・`DatabaseOrder.tsx`・`DatabaseResale.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 建売の顧客DB の「商談・架電記録」の枠に「ローン　土地」（全角スペース）を入れて検索する。「すべて含む」が選ばれていて、両方の語に黄色が付く。
2. 「いずれかを含む」に変えると探し直し、件数が増える。アドレスに `recordMode=or` が付く。そのアドレスで開き直すと同じ状態で開く。
3. 1語だけで探したときの件数が、今までと同じ。
4. 注文・中古の顧客DB でも 1・2 が同じ。

## 切り戻し
- 画面：前の build に戻せば、今までどおり（区切らない1語の検索）。② は `recordMode` が無ければ今までどおりなので、そのままでよいです。
