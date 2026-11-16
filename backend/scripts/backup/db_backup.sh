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
