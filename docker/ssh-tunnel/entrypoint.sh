#!/bin/sh
# =============================================================
# エックスサーバーのMySQLへのSSHトンネルを張り、切れたら張り直す。
#
# 必要な環境変数（.env.prod で渡す）
#   SSH_HOST      … エックスサーバーのホスト名。例: svXXXX.xserver.jp
#   SSH_PORT      … SSHのポート。エックスサーバーは 10022
#   SSH_USER      … サーバーID
#   REMOTE_DB_HOST … MySQLのホスト名。サーバーパネルのMySQL情報に出ている値
#   REMOTE_DB_PORT … 通常 3306
# =============================================================
set -eu

: "${SSH_HOST:?SSH_HOST が未設定です}"
: "${SSH_USER:?SSH_USER が未設定です}"
SSH_PORT="${SSH_PORT:-10022}"
REMOTE_DB_HOST="${REMOTE_DB_HOST:?REMOTE_DB_HOST が未設定です}"
REMOTE_DB_PORT="${REMOTE_DB_PORT:-3306}"

# ⚠️ 待ち受けは 0.0.0.0 にする。
#   既定の 127.0.0.1 だとこのコンテナの中からしか繋がらず、
#   別コンテナの express-api から見えない。
#   コンテナはDockerの内部ネットワークにしか露出しておらず、
#   ホストのポートも公開しないため外部からは到達できない。
LISTEN_ADDR="0.0.0.0"
LISTEN_PORT="3306"

echo "[ssh-tunnel] ${LISTEN_ADDR}:${LISTEN_PORT} -> ${REMOTE_DB_HOST}:${REMOTE_DB_PORT} (via ${SSH_USER}@${SSH_HOST}:${SSH_PORT})"

# autossh 自身の死活監視ポートを無効にし、SSH の ServerAliveInterval に任せる。
# 監視ポートを使う方式は、コンテナ内で余計なポートを開ける割に利点が無い。
export AUTOSSH_GATETIME=0
export AUTOSSH_POLL=60

exec autossh -M 0 -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "ExitOnForwardFailure=yes" \
  -o "StrictHostKeyChecking=yes" \
  -o "UserKnownHostsFile=/home/tunnel/.ssh/known_hosts" \
  -o "IdentitiesOnly=yes" \
  -i /home/tunnel/.ssh/id_ed25519 \
  -p "${SSH_PORT}" \
  -L "${LISTEN_ADDR}:${LISTEN_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT}" \
  "${SSH_USER}@${SSH_HOST}"
