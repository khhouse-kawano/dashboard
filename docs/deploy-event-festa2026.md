# おうちづくりフェスタ2026 デプロイ手順（v2.2.120）

対象は3か所。**この順番で行う。**

1. 【① レンタルサーバー】DB（SQL）
2. 【① レンタルサーバー】PHP
3. 【② VPS】Express
4. 【① レンタルサーバー】フロント（build）＋ LP

⚠️ **順番を入れ替えないこと。** テーブルに列が無い状態で ② を上げると、
反響一覧の取得や予約の受付が 500 で失敗する。

---

## サーバーの区別（毎回確認する）

| | ① レンタルサーバー | ② VPS |
|---|---|---|
| ホスト | `sv13020.xserver.jp` | `162.43.5.127` |
| ドメイン | `khg-marketing.info` | `api.khg-marketing.info` |
| 管理画面 | **サーバーパネル**（①のみ） | VPSパネル |
| 中身 | 本番DB・PHP・React の build | Docker（express-api / caddy / ssh-tunnel） |

⚠️ `kh-house.jp`（LPのドメイン）は**第3のサーバー** `sv11135.xbiz.ne.jp`（Xserver ビジネス）。
LPの配置先はこちらであり、① とは別。

---

## 0. 事前確認

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git log --oneline -1
```

⚠️ ブランチは `v2.2.120`。`frontend/src/utils/version.ts` が `2.2.120` であること
（**ブランチ名と一致していないと、利用者の画面が古いまま残る**）。

コミットして push し、GitHub で production へマージする。

```powershell
git add -A
git commit -m "add the festa2026 reservation form, event check-in and map embed"
git push origin HEAD
```

⚠️ **`git push origin HEAD:production` はしないこと。** production にはマージコミットが
あり fast-forward できない。ブラウザで
`https://github.com/khhouse-kawano/dashboard/compare/production...v2.2.120`
を開いて PR を作り、マージする。

---

## 1. 【① レンタルサーバー】SQL のインポート

サーバーパネル → phpMyAdmin。

### 1-1. 事前チェック（⚠️ 必ず先に実行）

```sql
SELECT id, COUNT(*) c FROM event_db GROUP BY id HAVING c > 1;
```

⚠️ **0件でなければ次へ進まないこと。** `id` に UNIQUE を張るため、
重複があると ALTER が失敗する。1件でも出たら報告してほしい。

### 1-2. インポート

`backend/scripts/sql/2026-09-07_event_reservation.sql`

⚠️ シェルのパイプ経由（`mysql < file`）は使わないこと。日本語のコメントが
文字化けする。**phpMyAdmin のインポート機能**を使う。

### 1-3. 確認

```sql
SHOW COLUMNS FROM event_db;
```

以下が並んでいれば成功。

- `kana` / `request` / `agree` / `reserved_at`
- `id` の Key が `UNI`

---

## 2. 【① レンタルサーバー】PHP のアップロード

配置先はすべて `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 |
|---|---|
| `backend/src/handlers/listAction/list_event.php` | `handlers/listAction/list_event.php` |

⚠️ このファイルは**更新できる列を絞る**変更。EventList の入力欄と対になっている。
片方だけ戻すと「画面では編集できるのに保存されない」状態になる。

⚠️ 前回の作業（紹介キャンペーン）が未反映なら、あわせて上げる。

| ローカル | ① の配置先 |
|---|---|
| `backend/src/core/express_proxy.php` | `core/express_proxy.php` |
| `backend/src/handlers/introductory.php` | `handlers/introductory.php` |

---

## 3. 【② VPS】Express の更新

### 3-1. SSH で入る

```bash
ssh deploy@162.43.5.127
```

### 3-2. `.env.prod` に2行を追記

```bash
cd ~/dashboard
nano .env.prod
```

追記する内容。

```
EVENT_CHECKIN_PASSCODE=0642
EVENT_NOTIFY_TO=mkt@kh-house.jp
```

⚠️ `EVENT_CHECKIN_PASSCODE` が**未設定だと当日の受付が一切できない**（全リクエストが 401）。
「未設定なら素通し」にはしていない。設定漏れで来場者の氏名が公開される事故より、
受付が動かないほうが安全という判断。

⚠️ この合い言葉は**リポジトリには入っていない。** ここだけに書く。
イベント終了後は値を変えるか空にする。

nano の操作:

| キー | 動作 |
|---|---|
| `Ctrl` + `O` → `Enter` | 保存 |
| `Ctrl` + `X` | 終了 |

確認（⚠️ 値そのものは表示しない）。

```bash
grep -c '^EVENT_CHECKIN_PASSCODE=.\+' .env.prod
grep -c '^EVENT_NOTIFY_TO=.\+' .env.prod
```

⚠️ **両方 `1` が返ること。** `0` なら値が空か、行が無い。

### 3-3. コードを取得

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
git log --oneline -1
```

⚠️ `git reset --hard` は追跡外のファイルを消さないので `.env.prod` は残る
（`.gitignore` 対象）。手順3-2で書いた内容は失われない。

### 3-4. ビルドして再作成

```bash
dcp build express-api
dcp up -d --force-recreate --renew-anon-volumes express-api
```

⚠️⚠️ **`--renew-anon-volumes` が必須。** 今回 `qrcode` パッケージを追加したため、
これを付けないと匿名ボリュームの古い `node_modules` が残り
`Cannot find module 'qrcode'` で起動に失敗する（ローカルでも実際に起きた）。

⚠️⚠️ **`dcp` を使うこと。** 素の `docker compose` は `.env.prod` を読まない
（自動で読むのは `.env` という名前だけ）。以前これで caddy が空の `ACME_EMAIL` で
作り直され、クラッシュループして 443 が落ちた。

### 3-5. 起動確認

```bash
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。
`Restarting (1)` なら失敗。10秒待って再実行すると確実。

```bash
dcp logs --tail 300 express-api | grep -E 'event_reservation|event_checkin'
```

⚠️ **5件出るのが正常。**

```
event_reservation::         — 【書き込み・認証なし】…来場予約受付
event_checkin::             — 【合い言葉】…照会（記録しない）
event_checkin:lookup:       — 【合い言葉】…照会（記録しない）
event_checkin:checkin:      — 【書き込み・合い言葉】…来場時刻を記録する
event_checkin:checkout:     — 【書き込み・合い言葉】…退場時刻を記録する
```

⚠️ `Cannot find module 'qrcode'` が出たら手順3-4の `--renew-anon-volumes` を忘れている。

---

## 4. 【① レンタルサーバー】フロントの build

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常（既存の警告のみ）。`Failed to compile` なら止める。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。

⚠️ `index.html` の上書き漏れに注意。漏れると**古い JS を読み続ける**ため、
新機能が出てこない。

---

## 5. 【kh-house.jp】LP のアップロード

`C:\Users\shinji-kawano\Downloads\20260425_kokubu_ouchi_festa_LP_NK\` から、
`kh-house.jp/festa/` へ配置する。

| ローカル | 配置先 |
|---|---|
| `index.html` | `festa/index.html` |
| `reservation/index.html` | `festa/reservation/index.html` |
| `img/` | `festa/img/` |

⚠️ **アップロードしないもの**（不要なうえ容量が大きい）。

- `Links/`（psd / eps の素材）
- `*.ai` / `*.pdf`
- `.DS_Store`
- `index.html.before-post-api` / `index.html.before-map`（私が作ったバックアップ）

⚠️ `reservation/` ディレクトリを作り忘れると、QRから開いたときに 404 になる。

---

## 6. 動作確認

### 6-1. 予約の受付（②へ直接）

【あなたのPC（PowerShell）で実行】

```powershell
curl.exe -s -o NUL -w "HTTP=%{http_code}`n" -X POST https://api.khg-marketing.info/api/gateway -H "Content-Type: application/json" -d '{\"request\":\"event_reservation\"}'
```

⚠️ **`HTTP=400` が正常。** 中身が空なので検証で弾かれる。
`HTTP=000` なら ② に到達できていない（caddy を確認）。

### 6-2. 受付の合い言葉

```powershell
curl.exe -s -X POST https://api.khg-marketing.info/api/gateway -H "Content-Type: application/json" -d '{\"request\":\"event_checkin\",\"roll\":\"lookup\",\"id\":\"festa2026_0000000000000000\",\"passcode\":\"wrong\"}'
```

⚠️ `{"status":"error","message":"合い言葉が違います。"}` が返ること。

正しい合い言葉だと、存在しないIDなので
`{"status":"error","message":"該当する予約が見つかりません。"}` になる。
**これが返れば合い言葉の設定が効いている。**

### 6-3. ダッシュボード

ブラウザで **Ctrl + Shift + R**（キャッシュを無視して再読込）してから、
「集客イベント → 反響一覧」を開く。

- 既存89件（住まいるフェスティバル2026）が表示されること
- 編集できるのが**お名前・電話番号・メールアドレス**の3列だけであること
- 下へスクロールすると20件ずつ増えること
- 「特設URLはこちら」が絞り込んだイベントのページを開くこと

### 6-4. LP から実際に1件予約する（⚠️ 本番データが1件増える）

`https://kh-house.jp/festa/` を開いて、自分のメールアドレスで送信する。

確認項目:

- 完了画面に QR が出る
- 自分宛に `【おうちづくりフェスタ2026】ご予約ありがとうございます` が届き、
  **PNG が添付されている**
- `mkt@kh-house.jp` に `【おうちづくりフェスタ2026／予約】…様` が届き、
  こちらも **PNG が添付されている**
- 差出人が `国分ハウジング <noreply@khg-marketing.info>` であること
- ダッシュボードの反響一覧に出ること

⚠️ メールが届かない場合、`kh-house.jp` 宛は ① のローカル配送問題が再発している
可能性がある。過去に `noreply@kh-house.jp` を ① 上に作ったことで
**宛先ドメインが自分のものと判定され**、外部へ出ずに詰まった。
差出人ではなく**宛先ドメイン**で決まるため、From を変えても直らない。

### 6-5. 受付（スタッフのスマホ）

届いたメールの QR をスマホの標準カメラで読む。

1. `kh-house.jp/festa/reservation/?id=festa2026_...` が開く
2. QR が再表示される（⚠️ この時点では氏名は出ない）
3. 「スタッフの方はこちら（受付）」→ 合い言葉 `0642` を入力
4. 氏名・来場予定が出て「チェックイン」が押せる
5. 押したあと、もう一度同じQRを読むと「**退場する**」が出る

⚠️ カメラでの読み取りは HTTPS でないと動かない（本番は HTTPS なので問題ない）。

### 6-6. 検証データの削除

【① レンタルサーバー】phpMyAdmin で、手順6-4で作った1件を消す。

```sql
SELECT no, id, name, mail, check_in_time, check_out_time
  FROM event_db WHERE title = 'おうちづくりフェスタ2026';
```

⚠️ **`no` を確認してから消すこと。** `title` 指定の DELETE は本番の予約が
入り始めたあとに実行すると全件消える。

```sql
DELETE FROM event_db WHERE no = <確認した番号>;
```

---

## 切り戻し

| 症状 | 対処 |
|---|---|
| ② が不調で画面が止まる | 【①】`core/express_proxy.php` の許可リストから該当行を消してアップロード。**数秒で戻る** |
| ② を全停止したい | 【①】`.htaccess` に `SetEnv EXPRESS_PROXY_DISABLED 1` の1行 |
| 予約フォームを止めたい | 【kh-house.jp】LPの `index.html` を `index.html.before-post-api` に戻す |
| 受付を止めたい | 【②】`.env.prod` の `EVENT_CHECKIN_PASSCODE=` を空にして `dcp up -d --force-recreate express-api` |

---

## ⚠️ つまずきやすい点（過去に実際に起きたもの）

1. **`dcp` を使わずに `docker compose` を実行** → `.env.prod` が読まれず、
   コンテナが空の環境変数で作り直されて壊れる。その場では成功して見える。
2. **Express専用の request が ① で 404** → 許可リストではなく
   **② が到達不能**なサイン。まず `dcp ps` で caddy を見る。
3. **npm 依存を足したのに `--renew-anon-volumes` を忘れる** →
   `Cannot find module` で起動しない。`build` だけでは足りない。
4. **`version.ts` の更新漏れ** → 利用者の画面が古いまま残る。
5. **`git push origin HEAD:production`** → fast-forward できず拒否される。PR を使う。
