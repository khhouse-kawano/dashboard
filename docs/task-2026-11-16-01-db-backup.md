# ① 本番 DB を手元（WSL）へバックアップする仕組み

日付：2026-11-16　ブランチ：v2.2.269（アプリの変更なし・版は上げていない）

## 依頼
- ① の DB のバックアップを XServer の中だけでなく、ssh で mysqldump → rsync で手元へ。保存先はこのプロジェクト（開発用にも使う）。cron 設定。.sh・crontab など必要な処理。
- 途中の指示：「作業はオーナーで実行するのでエージェントは手順をかくこと」→ 鍵の作成・ssh の設定・① のファイル・crontab の登録は行わず、手順書に書いた。
- 途中の指示：「必要であれば Ubuntu 26 まで上げたい」→ 不要と回答（24.04 LTS に cron・rsync・ssh・mysqldump がそろい、systemd・cron も動いている）。

## 調べたこと（読み取りだけ）
- ① は xs200571.xsrv.jp（khg-marketing.info・day-just-house.com・k-snap.jp）。DB は xs200571_kawano（約 866MB、MariaDB 10.5）と xs200571_dayjust（約 33MB）。SSH は公開鍵のみ・ポート 10022・国外アクセス制限あり・登録済みの鍵 3本（XServer の契約情報の読み取り）。
- WSL（Ubuntu-24.04、ユーザー dashboard、TZ Asia/Tokyo、systemd=true、cron active）。`~/.ssh/config` に Host dashboard（xs200571・鍵 xs200571_2.key）・khg（khgweb.xbiz.jp＝会社HP のサーバー）・vps。
- `ssh -o BatchMode=yes dashboard` は Permission denied。鍵 xs200571_2.key はパスフレーズ付きで、cron からは使えない → バックアップ専用の鍵（パスフレーズ無し）を作る手順にした。
- C ドライブの空き 25GB（使用率 95%）。

## 作ったもの
- `backend/scripts/backup/db_backup.sh`：① で mysqldump（--single-transaction --quick --routines --triggers --no-tablespaces --hex-blob、utf8mb4、nice）→ gzip → 「-- Dump completed」と gzip を確かめて ① の ~/db_backup/ へ（2本残す）→ rsync --partial で手元へ → sha256 一致・gzip を確かめる → daily 7本・monthly 3本に整理。1日1回（その日の分があれば何もしない。--force で取り直し）、flock（~/.cache）、空き 5GB 未満は取らない、ログ logs/backup.log・失敗時 logs/LAST_FAILED、latest.txt。パスワードは ① の ~/.my_backup.cnf だけ。
- `backend/scripts/backup/db_restore_local.sh`：最新（または指定）のバックアップを docker の local_db に読み込む（`local_db` と入力して確認・--yes で省略）。読み込み後、本番の update_log の最新の版より新しい `*_update_log_<版>.sql` を流し直す。
- `backend/scripts/backup/dashboard-backup.conf.example`：設定の見本（~/.config/dashboard-backup.conf に写す）。
- `.gitattributes`（新規）：`*.sh text eol=lf`（core.autocrlf=true のため）。
- `.gitignore`：`/db_backup/`。
- `docs/db-backup.md`：オーナーの手順（① の .my_backup.cnf → 専用の鍵 → パネルで公開鍵登録 → ssh の設定 → 設定ファイル → 初回を手で → crontab → うまくいかないとき → 開発用 DB への読み込み → 止め方）。

## 確認
- `bash -n` で両方の文法 OK（WSL）。
- 接続しない試験（/tmp だけ）：接続できない → exit 1・ログと LAST_FAILED に理由、今日の分があればすぐ終わりログも増えない、空き不足 → exit 1、同時実行 → 「スキップ: ほかのバックアップが実行中」（最初はロックの場所が XDG_RUNTIME_DIR の有無で変わり止められなかった → ~/.cache に固定して直した）、復元でバックアップが無い → exit 1。
- ⚠️ 未確認：① への実際の接続・mysqldump・rsync・ローカルへの読み込み（専用の鍵の登録と ① の .my_backup.cnf はオーナーの作業のため）。手順書の 4 で初回を確かめる。

## スクリプト（全文）
### `backend/scripts/backup/db_backup.sh`
```bash
#!/usr/bin/env bash
# =====================================================================
# ① 本番（XServer xs200571）の DB を手元（WSL）へバックアップする。
#
#   1. ssh で ① に入り、mysqldump → gzip で ① の ~/db_backup/ に書く（終わりの印と gzip を確かめる）
#   2. rsync で手元へ引く（途中で切れても続きから）。① と手元の sha256 を比べる
#   3. 手元で世代を整理する（日ごと KEEP_DAILY 本・月ごと KEEP_MONTHLY 本）。① 側は REMOTE_KEEP 本だけ残す
#
# ⚠️ パスワードはこのファイルにも手元にも置かない。① の ~/.my_backup.cnf（chmod 600）を mysqldump が読む。
# ⚠️ ssh はバックアップ専用の鍵（パスフレーズ無し）を ~/.ssh/config の Host dashboard-backup で使う。
# ⚠️ 1日1回だけ取る（cron は営業時間に1時間ごとに呼び、その日の分が無いときだけ動く。PC・WSL が止まっていた日の取りこぼしを防ぐ）。
#    手で今すぐ取り直すときは --force。
# ⚠️ 設定は ~/.config/dashboard-backup.conf（無くても既定値で動く）。手順は docs/db-backup.md。
# =====================================================================
set -Eeuo pipefail
umask 077

CONF="${DASHBOARD_BACKUP_CONF:-$HOME/.config/dashboard-backup.conf}"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

SSH_HOST="${SSH_HOST:-dashboard-backup}"          # ~/.ssh/config の Host
DB_NAME="${DB_NAME:-xs200571_kawano}"             # ① の Dashboard の DB
MY_CNF="${MY_CNF:-.my_backup.cnf}"                 # ① のホームからの場所
REMOTE_DIR="${REMOTE_DIR:-db_backup}"              # ① のホームからの場所
REMOTE_KEEP="${REMOTE_KEEP:-2}"                    # ① に残す本数
BACKUP_DIR="${BACKUP_DIR:-/mnt/c/Users/shinji-kawano/react/dashboard/db_backup}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_MONTHLY="${KEEP_MONTHLY:-3}"
MIN_FREE_GB="${MIN_FREE_GB:-5}"                    # 手元の空きがこれより少なければ取らない

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly" "$BACKUP_DIR/logs"
LOG="$BACKUP_DIR/logs/backup.log"
log() { printf '%s %s\n' "$(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }
fail() { log "失敗: $*"; printf '%s %s\n' "$(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S')" "$*" >"$BACKUP_DIR/logs/LAST_FAILED"; exit 1; }
trap 'fail "予期しないエラー（行 $LINENO）"' ERR

# ⚠️ 同時に2つ動かない（/mnt/c では flock が効かないことがあるので、ロックは WSL 側に置く）
# ⚠️ 場所は固定する。XDG_RUNTIME_DIR は手で動かすときだけあり、cron では無いため、使うと別々のロックになる
mkdir -p "$HOME/.cache"
LOCK="$HOME/.cache/dashboard-db-backup.lock"
exec 9>"$LOCK"
if ! flock -n 9; then log "スキップ: ほかのバックアップが実行中"; exit 0; fi

TODAY="$(TZ=Asia/Tokyo date +%Y%m%d)"
if [ "$FORCE" -eq 0 ] && compgen -G "$BACKUP_DIR/daily/${DB_NAME}_${TODAY}_*.sql.gz" >/dev/null; then
  exit 0   # 今日の分はある（cron の2回目以降。ログは残さない）
fi

FREE_GB="$(df -BG --output=avail "$BACKUP_DIR" | tail -1 | tr -dc '0-9')"
[ "${FREE_GB:-0}" -ge "$MIN_FREE_GB" ] || fail "手元の空きが ${FREE_GB}GB しかありません（${MIN_FREE_GB}GB 以上必要）"

NAME="${DB_NAME}_$(TZ=Asia/Tokyo date +%Y%m%d_%H%M).sql.gz"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30)
log "開始: $NAME（$SSH_HOST）"
START=$(date +%s)

# ---- 1. ① で mysqldump
# ⚠️ --single-transaction: 表を止めずに一貫した写しを取る（InnoDB）。--no-tablespaces: XServer では PROCESS 権限が無いため必須
# ⚠️ 終わりの印「-- Dump completed」が無ければ途中で切れたとみなす
REMOTE_SHA="$(ssh "${SSH_OPTS[@]}" "$SSH_HOST" bash -s -- "$DB_NAME" "$MY_CNF" "$REMOTE_DIR" "$NAME" "$REMOTE_KEEP" <<'REMOTE'
set -euo pipefail
umask 077
DB="$1"; CNF="$HOME/$2"; DIR="$HOME/$3"; NAME="$4"; KEEP="$5"
[ -f "$CNF" ] || { echo "① に $CNF がありません" >&2; exit 2; }
mkdir -p "$DIR"; chmod 700 "$DIR"
nice -n 10 mysqldump --defaults-extra-file="$CNF" \
  --single-transaction --quick --routines --triggers --no-tablespaces \
  --default-character-set=utf8mb4 --hex-blob "$DB" | gzip -c > "$DIR/$NAME.part"
gzip -t "$DIR/$NAME.part"
zcat "$DIR/$NAME.part" | tail -n 1 | grep -q 'Dump completed' || { echo "ダンプが途中で終わっています" >&2; exit 3; }
mv "$DIR/$NAME.part" "$DIR/$NAME"
ls -1t "$DIR"/"$DB"_*.sql.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
sha256sum "$DIR/$NAME" | cut -d' ' -f1
REMOTE
)" || fail "① での mysqldump に失敗（ssh 接続・~/${MY_CNF}・DB 名を確かめる）"

# ---- 2. rsync で手元へ
PART="$BACKUP_DIR/daily/.$NAME.part"
rsync -a --partial --timeout=600 -e "ssh ${SSH_OPTS[*]}" "$SSH_HOST:$REMOTE_DIR/$NAME" "$PART" \
  || fail "rsync に失敗（もう一度実行すると続きから受け取る）"
LOCAL_SHA="$(sha256sum "$PART" | cut -d' ' -f1)"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || fail "受け取ったファイルが ① と一致しません（sha256）"
gzip -t "$PART" || fail "受け取ったファイルが壊れています（gzip）"
mv "$PART" "$BACKUP_DIR/daily/$NAME"
printf '%s\n' "$NAME" >"$BACKUP_DIR/latest.txt"

# ---- 3. 世代の整理（月の最初の1本を monthly に写す）
MONTH="$(TZ=Asia/Tokyo date +%Y%m)"
if ! compgen -G "$BACKUP_DIR/monthly/${DB_NAME}_${MONTH}*.sql.gz" >/dev/null; then
  cp "$BACKUP_DIR/daily/$NAME" "$BACKUP_DIR/monthly/$NAME"
fi
ls -1t "$BACKUP_DIR/daily/${DB_NAME}_"*.sql.gz | tail -n +"$((KEEP_DAILY + 1))" | xargs -r rm -f
ls -1t "$BACKUP_DIR/monthly/${DB_NAME}_"*.sql.gz | tail -n +"$((KEEP_MONTHLY + 1))" | xargs -r rm -f
rm -f "$BACKUP_DIR/daily/".*.part 2>/dev/null || true

SIZE="$(du -h "$BACKUP_DIR/daily/$NAME" | cut -f1)"
log "完了: $NAME（$SIZE・$(( $(date +%s) - START ))秒）"
rm -f "$BACKUP_DIR/logs/LAST_FAILED"
```
### `backend/scripts/backup/db_restore_local.sh`
```bash
#!/usr/bin/env bash
# =====================================================================
# 手元に取った ① 本番の DB を、ローカルの開発用 DB（docker の dashboard-mariadb-db-1 / local_db）に読み込む。
#
#   使い方:  db_restore_local.sh                 … いちばん新しいバックアップを読み込む（確認あり）
#            db_restore_local.sh <ファイル.sql.gz> … 指定したものを読み込む
#            db_restore_local.sh --yes            … 確認を省く
#
# ⚠️⚠️ ローカルの local_db の表を、本番の内容で上書きする（本番にある表だけ。ローカルにしか無い表は残る）。
#   ⚠️ ローカルで試しに入れたデータ・仮スタッフは消える。本番には何もしない。
# ⚠️ 読み込んだあと、本番にまだ出していない版の update_log の SQL（backend/scripts/sql/*_update_log_<版>.sql）を自動で流し直す。
#   ⚠️ 流さないと、手元の版（version.ts）の更新履歴が無くなり、画面が真っ白になる。
# ⚠️ パスワードはコンテナの環境変数（MARIADB_ROOT_PASSWORD）のまま使い、表示しない。
# =====================================================================
set -Eeuo pipefail

CONF="${DASHBOARD_BACKUP_CONF:-$HOME/.config/dashboard-backup.conf}"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"
BACKUP_DIR="${BACKUP_DIR:-/mnt/c/Users/shinji-kawano/react/dashboard/db_backup}"
CONTAINER="${CONTAINER:-dashboard-mariadb-db-1}"
LOCAL_DB="${LOCAL_DB:-local_db}"
PROJECT_DIR="${PROJECT_DIR:-/mnt/c/Users/shinji-kawano/react/dashboard}"

YES=0; FILE=""
for a in "$@"; do
  case "$a" in
    --yes) YES=1 ;;
    *) FILE="$a" ;;
  esac
done
if [ -z "$FILE" ]; then
  FILE="$(ls -1t "$BACKUP_DIR"/daily/*.sql.gz 2>/dev/null | head -1 || true)"
fi
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "バックアップが見つかりません（$BACKUP_DIR/daily）。先に db_backup.sh を実行してください。" >&2; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || { echo "コンテナ $CONTAINER が動いていません（Docker Desktop を起動）。" >&2; exit 1; }

echo "読み込むファイル: $FILE（$(du -h "$FILE" | cut -f1)）"
echo "読み込み先:       $CONTAINER の $LOCAL_DB（⚠️ 本番にある表は上書きされます）"
if [ "$YES" -ne 1 ]; then
  read -r -p "続けるなら $LOCAL_DB と入力してください: " ans
  [ "$ans" = "$LOCAL_DB" ] || { echo "やめました。"; exit 1; }
fi

gzip -t "$FILE"
mysql_local() { docker exec -i "$CONTAINER" sh -c "mariadb --default-character-set=utf8mb4 -uroot -p\"\$MARIADB_ROOT_PASSWORD\" $LOCAL_DB"; }

echo "読み込み中…（数分かかります）"
START=$(date +%s)
zcat "$FILE" | mysql_local
echo "読み込み完了（$(( $(date +%s) - START ))秒）"

# ---- 本番にまだ出していない版の update_log を流し直す
PROD_MAX="$(echo "SELECT version FROM update_log;" | mysql_local | tail -n +2 | sort -V | tail -1)"
echo "本番の最新の版: ${PROD_MAX:-（無し）}"
shopt -s nullglob
for f in "$PROJECT_DIR"/backend/scripts/sql/*_update_log_*.sql; do
  v="$(basename "$f" .sql)"; v="${v##*_update_log_}"
  if [ -n "$PROD_MAX" ] && [ "$(printf '%s\n%s\n' "$PROD_MAX" "$v" | sort -V | tail -1)" = "$v" ] && [ "$v" != "$PROD_MAX" ]; then
    echo "流し直す: $(basename "$f")"
    mysql_local < "$f" >/dev/null
  fi
done
echo "SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;" | mysql_local
echo "終わりました。② は変わったデータを読み直すので、必要なら docker restart dashboard-express-api-1"
```
