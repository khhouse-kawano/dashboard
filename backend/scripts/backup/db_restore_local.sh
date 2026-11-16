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
