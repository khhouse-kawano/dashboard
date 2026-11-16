# ① 本番 DB を手元（WSL）へバックアップする手順

⚠️ この手順は**オーナーが実行**します（鍵・パスワード・crontab を扱うため）。

## 1. しくみ
```
[WSL の cron]（平日・土曜 9〜18時の毎時15分。その日の分が無いときだけ動く＝1日1回）
   │ ssh（バックアップ専用の鍵・パスフレーズ無し）
   ▼
[① xs200571.xsrv.jp]  mysqldump xs200571_kawano | gzip → ~/db_backup/（2本だけ残す）
   │ rsync（途中で切れても続きから）＋ sha256 で一致を確かめる
   ▼
[手元] /mnt/c/Users/shinji-kawano/react/dashboard/db_backup/
        daily/   … 日ごと 7本
        monthly/ … 月の最初の1本を 3か月分
        logs/backup.log・logs/LAST_FAILED（失敗したときだけある）・latest.txt
   │ 必要なときに手で
   ▼
[ローカルの開発用 DB] dashboard-mariadb-db-1 の local_db（db_restore_local.sh）
```

| ファイル | 役目 |
|---|---|
| `backend/scripts/backup/db_backup.sh` | バックアップ（cron から呼ぶ） |
| `backend/scripts/backup/db_restore_local.sh` | 手元のバックアップを開発用 DB に読み込む（手で実行） |
| `backend/scripts/backup/dashboard-backup.conf.example` | 設定の見本（パスワードは書かない） |

- 対象：① の Dashboard の DB `xs200571_kawano`（XServer のパネル上で約 866MB。圧縮すると数百MB の見込み）。
- ⚠️ バックアップには**お客様の個人情報**が入っています。`db_backup/` は `.gitignore` 済みです。ほかの人・ほかの場所へ写さないでください。
- ⚠️ **C ドライブの空きが約 25GB（使用率 95%）**です。1本数百MB × 最大10本（日ごと7・月ごと3）で、数GB 使います。空きが 5GB を切ると取らずに失敗として記録します（`MIN_FREE_GB`）。
- ⚠️ パスワードは ① の `~/.my_backup.cnf` にだけ置きます。手元・スクリプト・リポジトリには置きません。
- Ubuntu は 24.04 のままで大丈夫です（必要な cron・rsync・ssh・mysqldump はそろっていて、cron も動いています）。

---

## 2. ① 側の準備（1回だけ）
いつもの方法で ① に ssh で入ります（`ssh dashboard`）。

### 2-1. DB の接続情報のファイルを作る
```bash
cat > ~/.my_backup.cnf <<'EOF'
[client]
user=xs200571_kawano
password=ここに MySQL のパスワード
host=localhost
default-character-set=utf8mb4
EOF
chmod 600 ~/.my_backup.cnf
```
- ユーザー名とパスワードは、サーバーパネルの「MySQL設定」にあるものです（`xs200571_kawano` の DB を使えるユーザー）。
- ⚠️ パスワードは、チャットやメールに貼らないでください。

### 2-2. つながるか確かめる
```bash
mysql --defaults-extra-file=~/.my_backup.cnf -e "SELECT COUNT(*) FROM update_log" xs200571_kawano
mysqldump --defaults-extra-file=~/.my_backup.cnf --no-tablespaces --single-transaction --no-data xs200571_kawano | head -5
```
- 件数と `-- MariaDB dump` で始まる行が出ればよいです。
- `Access denied … PROCESS privilege` が出たら、`--no-tablespaces` が抜けています（スクリプトには入っています）。

`exit` で ① から出ます。

---

## 3. WSL 側の準備（1回だけ）
WSL（Ubuntu-24.04）のターミナルで実行します。

### 3-1. バックアップ専用の鍵を作る
⚠️ いまの `~/.ssh/xs200571_2.key` にはパスフレーズが付いているため、人が入力できない cron からは使えません（`Permission denied (publickey)` になる）。バックアップだけに使う鍵を別に作ります。
```bash
ssh-keygen -t ed25519 -N "" -C "dashboard-db-backup" -f ~/.ssh/xs200571_backup_ed25519
cat ~/.ssh/xs200571_backup_ed25519.pub
```

### 3-2. 公開鍵を ① に登録する
サーバーパネル（xs200571）→「SSH設定」→「公開鍵登録・更新」→ 上で表示した1行（`ssh-ed25519 AAAA… dashboard-db-backup`）を貼って登録します。
- ⚠️ 貼るのは `.pub`（公開鍵）だけです。`.pub` の付かない秘密鍵は貼らないでください。
- いまの登録（3本）はそのまま残ります。

### 3-3. ssh の設定を足す
```bash
cat >> ~/.ssh/config <<'EOF'

Host dashboard-backup
    HostName xs200571.xsrv.jp
    User xs200571
    Port 10022
    IdentityFile ~/.ssh/xs200571_backup_ed25519
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh -o BatchMode=yes dashboard-backup 'echo つながりました; ls -l ~/.my_backup.cnf'
```
- 「つながりました」と `-rw-------` の行が出ればよいです。
- `Permission denied` のときは、3-2 の登録が反映されているかを確かめます。

### 3-4. 設定ファイルを置く
```bash
mkdir -p ~/.config
cp /mnt/c/Users/shinji-kawano/react/dashboard/backend/scripts/backup/dashboard-backup.conf.example ~/.config/dashboard-backup.conf
chmod 600 ~/.config/dashboard-backup.conf
```
- 既定のままで動きます。保存先・残す本数を変えたいときだけ、このファイルを直します。

---

## 4. 初回を手で実行する
```bash
bash /mnt/c/Users/shinji-kawano/react/dashboard/backend/scripts/backup/db_backup.sh --force
echo "exit=$?"
tail -3 /mnt/c/Users/shinji-kawano/react/dashboard/db_backup/logs/backup.log
ls -lh /mnt/c/Users/shinji-kawano/react/dashboard/db_backup/daily/
```
- `exit=0`、ログに `完了: xs200571_kawano_YYYYMMDD_HHMM.sql.gz（○○M・○○秒）` が出ればよいです。
- 数分かかります（① で圧縮 → 手元へ転送）。
- 失敗したときは、ログの最後の行と、下の「6. うまくいかないとき」を見てください。

---

## 5. cron に登録する
```bash
crontab -e
```
エディタが開いたら、最後に次の2行を足して保存します（初めてのときはエディタを選ぶよう聞かれます。`1`（nano）が簡単です）。
```cron
# Dashboard ① 本番 DB のバックアップ（月〜土の 9〜18時、毎時15分に呼ぶ。その日の分が無いときだけ取る）
15 9-18 * * 1-6 /bin/bash /mnt/c/Users/shinji-kawano/react/dashboard/backend/scripts/backup/db_backup.sh >/dev/null 2>&1
```
確かめる：
```bash
crontab -l
systemctl is-active cron        # active ならよい
```
- 1日1回だけ取ります。PC や WSL が止まっていた時間があっても、その日のうちに動いた最初の回で取ります。
- 翌日以降、`logs/backup.log` に毎日1行ずつ `完了:` が増えていれば動いています。

> 注意：cron は **WSL（Ubuntu-24.04）が動いているあいだだけ**動きます。Docker Desktop の WSL 連携が有効なら、ふだんは動いています。PC を起動してから一度も WSL を使わない日があるときは、Windows の「タスク スケジューラ」で、ログオン時に次を実行させると確実です。
> `wsl.exe -d Ubuntu-24.04 -u dashboard -- bash /mnt/c/Users/shinji-kawano/react/dashboard/backend/scripts/backup/db_backup.sh`

---

## 6. うまくいかないとき
| ログの最後の行 | 見るところ |
|---|---|
| `① での mysqldump に失敗` | `ssh -o BatchMode=yes dashboard-backup true` が通るか（3-2・3-3）。① に `~/.my_backup.cnf` があるか（2-1）。DB 名 |
| `rsync に失敗` | 回線が切れた。もう一度実行すれば続きから受け取ります（cron の次の回で自動で取り直します） |
| `受け取ったファイルが ① と一致しません` | 転送中に壊れた。もう一度実行 |
| `手元の空きが ○GB しかありません` | C ドライブの空きを作る、または `KEEP_DAILY` を減らす |
| `スキップ: ほかのバックアップが実行中` | 前の回が終わっていない（問題なし） |
| 何も増えない | `crontab -l` に行があるか、`systemctl is-active cron`、WSL が動いているか |

- 失敗しているあいだは `db_backup/logs/LAST_FAILED` があります（成功すると消えます）。

---

## 7. 開発用 DB に読み込む（必要なときに手で）
```bash
bash /mnt/c/Users/shinji-kawano/react/dashboard/backend/scripts/backup/db_restore_local.sh
```
- いちばん新しいバックアップを、ローカルの `dashboard-mariadb-db-1` の `local_db` に読み込みます。`local_db` と入力すると始まります。
- ⚠️ ローカルの表のうち、本番にある表は本番の内容で**上書き**されます（ローカルで入れた試験のデータ・仮スタッフは消えます）。ローカルにしか無い表はそのまま残ります。本番には何もしません。
- 読み込んだあと、本番にまだ出していない版の `update_log` の SQL（`backend/scripts/sql/*_update_log_<版>.sql`）を自動で流し直します（流さないと、手元の版の更新履歴が無くなり画面が真っ白になるため）。
- 終わったら `docker restart dashboard-express-api-1` で ② を読み直します。
- ファイルを指定するとき：`db_restore_local.sh /mnt/c/…/db_backup/monthly/xs200571_kawano_20261101_0915.sql.gz`

---

## 8. 止める・やめる
- 一時的に止める：`crontab -e` で行の先頭に `#` を付ける。
- やめる：`crontab -e` で行を消す → サーバーパネルの「SSH設定」で `dashboard-db-backup` の公開鍵を削除 → ① の `~/.my_backup.cnf` と `~/db_backup/` を消す。
