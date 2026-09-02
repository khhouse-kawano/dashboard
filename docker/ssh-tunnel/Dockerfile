# =============================================================
# エックスサーバーのMySQLへ常時つなぐSSHトンネル
#
# なぜトンネルが要るのか
#   エックスサーバー（レンタルサーバー）はMySQLの3306番をファイアウォールで
#   閉じており、サーバーパネルに許可IPを登録する機能も無い。
#   VPSから本番DBを参照する手段はSSHのポートフォワーディングだけになる。
#
#   副次的な利点として、SSH経由なので通信全体が暗号化される。
#   仮に3306番を直接開けられたとしても、MySQLの平文通信を
#   インターネットに流すのは避けるべきだった。
#
# なぜ autossh なのか
#   素の ssh -L は接続が切れたらそのまま終わる。VPSと東京リージョンの
#   レンタルサーバー間でも回線の瞬断は起きるため、切断を検知して
#   張り直す仕組みが要る。autossh はそれを行う。
# =============================================================
FROM alpine:3.20

# autossh … 切断検知と自動再接続
# openssh-client … ssh 本体
RUN apk add --no-cache autossh openssh-client

# root で常駐させない
RUN adduser -D -u 1000 tunnel
USER tunnel
WORKDIR /home/tunnel

COPY --chown=tunnel:tunnel entrypoint.sh /home/tunnel/entrypoint.sh

ENTRYPOINT ["/bin/sh", "/home/tunnel/entrypoint.sh"]
