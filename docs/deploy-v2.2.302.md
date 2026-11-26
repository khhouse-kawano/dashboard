# デプロイ手順 v2.2.302　テーブル定義書を見られる人を Master かつ スタッフ ID 1 に絞る

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行 | ① DB `backend/scripts/sql/2026-11-26_update_log_2.2.302.sql` |
| 2 | `table_definition` が、Master でもスタッフ ID 1 以外には 403「この操作を行う権限がありません。」を返す | ② VPS（features/tableDefinition.ts・gateway/registry.ts） |
| 3 | `get_token` がスタッフの `id` も返す（画面がメニューを出すかの判定に使う） | ① PHP `backend/src/handlers/get_token.php` |
| 4 | 「システム管理 → テーブル定義書」がスタッフ ID 1 の Master にだけ出る（URL で直接開いても、業務ガイドの「開く」でも同じ） | Dashboard（frontend の build） |

- ⚠️ v2.2.301 を先に済ませてください。表の変更はありません（テーブル定義書の原稿・SQL もありません）。
- ⚠️ **本番の staff の id 1 が川野さんであることを先に確かめてください**（ローカルでは id 1 = 川野 慎司・Master）。違うときは、②の `TABLE_DEFINITION_STAFF_ID`（features/tableDefinition.ts）と画面の `TABLE_DEFINITION_STAFF_ID`（headerScreens.tsx）を本番の id に直してから上げます。
  ```sql
  SELECT id, name, brand FROM staff WHERE id = 1;
  ```
- 業務ガイドの記事「テーブル定義書」は変えていません（ほかの Master が記事の「開く」を押すと「このアカウントでは開けません」と出ます）。
- 順序を逆にしても壊れません。① PHP より先に画面を上げると、上げ終わるまで ID 1 の人にもメニューが出ません（URL で開いても権限なしと出ます）。

## 順序
```
1. GitHub で v2.2.302 を production へマージ（PR）
2. ① SQL：2026-11-26_update_log_2.2.302.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：handlers/get_token.php をアップロード
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-26_update_log_2.2.302.sql
```
- 確認：
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
- `git log` が v2.2.302 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/handlers/get_token.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=table_definition'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/context/AuthContext.ts`
  - `src/context/AuthProvider.tsx`
  - `src/components/header/headerScreens.tsx`
  - `src/components/header/Header.tsx`
  - `src/components/header/HeaderPage.tsx`
  - `src/components/guide/useGuideScreenReceiver.ts`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 川野さん（ID 1・Master）で「システム管理」を開く。「テーブル定義書」が出て、開くと一覧・列が今までどおり出る。
2. ほかの Master で「システム管理」を開く。「テーブル定義書」が出ない（セキュリティログなどほかの項目は出る）。アドレスに `/dashboard/tableDefinition` を入れて開いても「この画面を見る権限がありません。」と出る。
3. Master 以外は今までどおりメニューに出ない。

## 切り戻し
- 画面・② を前の版に戻せば、v2.2.301 と同じ（Master 全員が見られる）に戻ります。get_token.php は `id` を足しただけなので、戻さなくても前の画面に影響はありません。
