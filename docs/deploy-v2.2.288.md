# デプロイ手順 v2.2.288　顧客DB（建売）：入居希望地で検索・入居希望地の列

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 顧客DB（建売）の顧客の一覧に、入居希望地の3列（planned_construction_site・_2・_3）を足して返す | ② VPS（features/database/queries.ts） |
| 2 | ② が落ちたときの予備・非表示の切り替え・名寄せのあとに返す一覧にも、同じ3列を足す | ① PHP 3ファイル（databaseAction/database_spec.php・database_spec_trash.php、integrateAction/integrate_spec.php） |
| 3 | 「住所で検索」の右に「入居希望地で検索」。表の「架電件数」の右に「入居希望地」の列 | Dashboard（frontend の build） |
| 4 | 更新履歴1行・業務ガイド「顧客DB（建売営業）」の記事 | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.288.sql` |

- ⚠️ v2.2.287 までを先に済ませてください。表の変更はありません。
- ⚠️ 画面（手順5）は ② と ① PHP の後に上げてください。先に上げても画面は落ちませんが、入居希望地の列が空のままになり、検索しても0件になります。
- 顧客1人あたり3列ぶん、応答が少し大きくなります（建売は約1万2千件）。

## 順序
```
1. GitHub で v2.2.288 を production へマージ（PR）
2. ② VPS
3. ① PHP 3ファイル
4. ① SQL：2026-11-23_update_log_2.2.288.sql   ← ⚠️ 1回だけ
5. Dashboard の画面を build してアップロード
```

### 手順2　【② VPS】
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
- `git log` が v2.2.288 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① PHP】
次の3ファイルを ① の同じ場所へアップロードします（上書き）。
- `backend/src/handlers/databaseAction/database_spec.php`
- `backend/src/handlers/databaseAction/database_spec_trash.php`
- `backend/src/handlers/integrateAction/integrate_spec.php`

### 手順4　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.288.sql
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：`src/components/database/DatabaseKaeru.tsx`・`src/utils/version.ts`

## 終わったら（動作確認）
- 建売営業で 顧客DB を開くと、「住所で検索」の右に「入居希望地で検索」が出る（PC だけ。スマホには出ません）。
- 「霧島市」などと入れると、少し待ってから一覧が絞られ、件数が減る。
- 表の「架電件数」の右に「入居希望地」の列が出て、入居希望地が2つ以上ある人は縦に並ぶ。
- 非表示にした／元に戻したあとも、入居希望地の列が消えない。

## 切り戻し
画面を前の build に戻せば、検索欄と列は消えます。② と ① PHP は列が増えるだけなので、戻さなくて構いません。
