# デプロイ手順 v2.2.309　SatBaseサマリーをシステム管理に戻す（Master だけ・GET で30件ずつ・カードの数）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「SatBaseサマリー（建売営業）」（新規） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.309.sql` |
| 2 | 新しい request `satbase_page`（GET・Master。絞り込み・並べ替えをして `offset` から `limit` 件。既定30件。選択肢とカードの数も返す）。⚠️ `satbase_list`・`satbase_update` を **Master だけ**に（今までは全スタッフ） | ② VPS（features/satbasePage.ts（新規）・gateway/registry.ts） |
| 3 | GET の許可リストと、② へ送るリスト2つに `satbase_page` | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php` |
| 4 | ヘッダー「システム管理 → SatBaseサマリー」（`/satbase`・Master だけ）。GoogleReview にそろえた見た目（絞り込みバー・カード6枚・注意書き・見出しで並べ替え）。30件ずつ GET し、下までスクロールすると次の30件。条件をアドレスに（`keyword` `progress` `sales` `pref` `team` `ad` `insta` `sort` `dir`） | Dashboard（frontend の build） |

- ⚠️ v2.2.308 を先に済ませてください。表の変更はありません（テーブル定義書の SQL もありません）。
- 送る量（ローカルの写しで測定）：開いたとき 約1.9MB（全件の POST）→ 約28KB（30件の GET）。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い `satbase_page` を転送して 502 になります（画面は今までの POST＝全件に切り替わるので開けます）。
- 画面（手順5）を ① PHP より先に上げても開けます（GET が 400 になり、POST＝全件に切り替わる）。
- ⚠️ 物件台帳の写しは、v2.2.231 から取り込まれていません（取り込みの入口が無かったため）。デプロイのあと、SatBase の CSV を「物件更新」から取り込んでください（手順6）。

## 順序
```
1. GitHub で v2.2.309 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.309.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：db.php・express_proxy.php をアップロード
5. Dashboard の画面を build してアップロード
6. SatBase の CSV を「物件更新」から取り込む（Master）
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.309.sql
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
- `git log` が v2.2.309 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/db.php`・`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=satbase_page'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/header/system/SatBaseDatabase.tsx`（`header/unused/` から移して書き直し）
  - `src/components/header/system/SatBaseImport.tsx`（`header/unused/` から移しただけ）
  - `src/components/header/system/satbaseFilter.ts`（新規。② に届かないときの絞り込み・並べ替え・カードの数）
  - `src/components/header/headerScreens.tsx`
  - `src/components/guide/guideScreens.ts`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. Master で「システム管理 → SatBaseサマリー」を開く。30件とカード6枚が出る。開発者ツールで `request=satbase_page` の GET が1回出て、`satbase_list` の POST が出ない。
2. 一覧を下までスクロールすると、次の30件が出る（GET が `offset=30` で出る）。
3. 「県」などで絞ると、件数とカードの数が変わり、アドレスに条件が付く。見出しを押すと並べ替わる。そのアドレスを開き直すと同じ一覧が出る。
4. 「広告出稿」のスイッチを押して戻す（保存できる）。
5. Master 以外では、メニューに出ず、`/satbase` を開くと「権限がありません」が出る。
6. 「物件更新」で SatBase の CSV を取り込み、カードの数が新しくなる。

## 切り戻し
- 画面：前の build に戻せば、メニューから消えます。
- ② ：`satbase_list`・`satbase_update` を Master だけにしたのは、前の画面に影響しません（前の画面には開く入口が無いため）。
- ① PHP：足しただけなので、戻さなくても影響はありません。
