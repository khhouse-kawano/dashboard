# デプロイ手順 v2.2.230　他社広告（Meta 広告ライブラリ）の取り込みを ② に／画像を dashboard/img/meta に

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 合い言葉 `META_SCRAPER_KEY` を新設 | ⚠️ ② VPS の `.env.prod`・① の `.htaccess`（SetEnv）・拡張機能の `config.js`。**3か所とも同じ値**（値は自分で決める。英数字32文字以上を勧める） |
| 2 | `request: 'meta_scrape'`（新規。拡張機能から受ける。画像は ① に渡す） | ⚠️ **② VPS（再ビルド）** |
| 3 | 予備の受け口 `meta_scrape`・画像の受け口 `meta_scrape_image`・共通の処理 | ① PHP 3ファイル（新規） |
| 4 | 画像の置き場所 `dashboard/img/meta/` を作り、今ある画像を移す | ① サーバー（ファイルマネージャー または SSH） |
| 5 | 他社広告ライブラリの画像の URL を新しい置き場所に | ① フロント（いつもの手順） |
| 6 | 送り先を ② → ①（予備）に、合い言葉を付ける | 拡張機能 `C:\Users\shinji-kawano\extensions\meta`（このPC。直してある） |
| 7 | 更新履歴 | ① DB `backend/scripts/sql/2026-10-29_update_log_2.2.230.sql` |

⚠️ 表の変更は**ありません**（meta_ads はそのまま）。

## 順序
```
0. GitHub で v2.2.230 を main → production へマージ
1. 合い言葉を決め、② の .env.prod と ① の .htaccess に入れる
2. ① 画像の置き場所を作り、今ある画像をコピー     ← ⚠️ 5 より前（先にフロントを上げると画像が全部出なくなる）
3. ① PHP（3ファイル）
4. ② 再ビルド                                    ← ⚠️ 実行中の Claudeによる分析が無いときに
5. ① フロント
6. ① SQL（更新履歴）
7. 拡張機能の config.js に合い言葉を入れ、Chrome の拡張機能の画面で「再読み込み」
8. 古い受け口 khg-marketing.info/api/meta/ を止める（任意。⚠️ 7 で新しい送り先に保存できたのを確かめてから）
```

### 手順1　合い言葉を入れる
- ② VPS の `~/dashboard/.env.prod` に1行: `META_SCRAPER_KEY=<合い言葉>`
- ① の `.htaccess` のうち、`SetEnv MEMBER_ENTRY_KEY` が書いてあるファイルの同じ並びに1行（`backend/.env` 方式で入れているならそちらに `META_SCRAPER_KEY=<合い言葉>`）:
```
SetEnv META_SCRAPER_KEY <合い言葉>
```
- ⚠️ 値をリポジトリ・チャットに書かないこと
- ② に入ったかの確認（値は出ない）:
```bash
dcp exec express-api sh -c 'test -n "$META_SCRAPER_KEY" && echo SET || echo EMPTY'
```
  ⚠️ 手順4（再ビルド）の後に流す。`EMPTY` なら .env.prod の行を見直して `dcp up -d express-api`

### 手順2　【① サーバー】画像の置き場所と、今ある画像のコピー
- `dashboard/` の下に `img/meta/` を作る（`dashboard/img/` が無ければ一緒に作る）。権限は 755
- `api/meta/images/` の中身（約3,800ファイル）を、すべて `dashboard/img/meta/` へ**コピー**する（移動ではなくコピー。古い受け口を止めるまでは元も残す）
  - SSH なら（`ドキュメントルート` は khg-marketing.info の公開フォルダ）:
```bash
mkdir -p ドキュメントルート/dashboard/img/meta && cp -p ドキュメントルート/api/meta/images/* ドキュメントルート/dashboard/img/meta/
```
```bash
ls ドキュメントルート/api/meta/images | wc -l; ls ドキュメントルート/dashboard/img/meta | wc -l
```
  - ⚠️ 2つの数が同じならよい
- 確かめ: ブラウザで `https://khg-marketing.info/dashboard/img/meta/（どれか1つのファイル名）` を開いて画像が出る
- ⚠️ フロントの「いつもの手順」で `dashboard/` を丸ごと消して入れ直している場合は、`img/` を消さないこと（`api/` と同じ扱い）

### 手順3　【① FTP】PHP 3ファイル（新規）
アップロード（`/dashboard/api/gateway/` の下）:
- `core/meta_scrape.php`
- `handlers/meta_scrape.php`
- `handlers/meta_scrape_image.php`

確認（合い言葉なし。⚠️ 何も保存されない）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"meta_scrape"}'
```
⚠️ `合い言葉が違います。`（401）ならよい。

### 手順4　【② VPS で実行】再ビルド
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
⚠️ `.env.prod` を変えたので、`up -d` で作り直すこと（restart では新しい値が入らない）。

確認（合い言葉なし）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"meta_scrape"}'
```
⚠️ `合い言葉が違います。`（401）ならよい。⚠️ 404・転送の話が出るなら ② が古い。

### 手順5　【① フロント】いつもの手順

### 手順6　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-29_update_log_2.2.230.sql`

### 手順7　拡張機能
1. `C:\Users\shinji-kawano\extensions\meta\config.js` を開き、`const META_SCRAPER_KEY = '';` の `''` の中に手順1の値を入れる
2. scraper.ts が使う Chrome（user_data）は起動のたびに拡張機能を読み込むので、そのまま `scraper.ts` を流せばよい
   - ふだんの Chrome に入れている場合は、chrome://extensions で「Ad Library Scraper」の再読み込みを押す
3. 1社だけ試し、ボタンが「✅ DB保存完了」または「⏭️ 保存済スキップ」になる・他社広告ライブラリに新しい広告の画像が出ることを確かめる
   - ⚠️「❌ エラー」なら、拡張機能の画面の「Service Worker」を開いてログを見る（401 なら合い言葉が3か所で違う）

### 手順8　古い受け口を止める（任意）
- `api/meta/` の PHP は合い言葉が無く、誰でも送れる。新しい送り先で保存できたら、`api/meta/index.php`（または中の PHP）の名前を変えて止めるのを勧める
- 画像（`api/meta/images/`）は、しばらく様子を見てから消す

## 終わったら（動作確認）
- 他社広告ライブラリで画像が今までどおり出る（URL が `https://khg-marketing.info/dashboard/img/meta/...`）
- 拡張機能で新しい広告を保存すると、一覧に出て画像も出る

## 注意
- ⚠️ ② がつながらない・5xx のときは、拡張機能が ① の予備へ自動で送り直す。① に保存されても画像の置き場所は同じ（dashboard/img/meta/）
- ⚠️ ② は画像を ① に置けなかったときは登録しない（502）。その場合も拡張機能が ① へ送り直す
