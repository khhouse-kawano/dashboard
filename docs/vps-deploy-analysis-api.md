# 分析API VPSデプロイ手順・運用ガイド

Claude Desktop から注文事業のKPI・歩留まりを確認するための分析APIを、VPS上で公開・運用するための手順書。

**この手順書は 2026-09-01 に実施した初回デプロイの結果を反映している。** 事前に書いた想定と実際が違った箇所には ⚠️ で理由を記した。次に同じ作業をする人が同じ場所で詰まらないようにするのが目的。

---

## ⚠️ 登場するサーバーは2つ。混同しないこと

この手順では**別々の2台**を行き来する。「サーバーパネル」「サーバーID」はどちらか一方にしか存在しないため、以下の呼び名で厳密に区別する。**本文でもこの呼び名だけを使う。**

| | ① **レンタルサーバー** | ② **VPS** |
|---|---|---|
| 正式名 | エックスサーバー（共用レンタルサーバー） | Xserver VPS |
| 用途 | **本番DB** ＋ 既存のPHP API・React | **新規の分析API（Express）** |
| アドレス | `khg-marketing.info` | `162.43.5.127` / `api.khg-marketing.info` |
| 管理画面 | **サーバーパネル** | **VPSパネル** |
| サーバーID | **あり**（FTPユーザー名と同じ） | なし |
| OS | 非公開（共用） | Ubuntu 24.04 LTS |

- 「サーバーパネル」「サーバーID」「MySQL設定」「SSH設定」「DNSレコード設定」「phpMyAdmin」は**すべて ①**
- ② の VPSパネルで触るのは**パケットフィルターとコンソール接続だけ**

### SSHも2種類ある

| | 誰から誰へ | ポート | 用途 |
|---|---|---|---|
| **SSH-A** | 作業者のPC → **② VPS** | 22 | VPSの管理作業（この手順の作業場所） |
| **SSH-B** | **② VPS** → **① レンタルサーバー** | 10022 | DBへのトンネル（autossh が常駐） |

`.env.prod` の `SSH_HOST` / `SSH_USER` / `SSH_PORT` は **SSH-B 用**、つまり **① の情報**。SSH-A（VPSへのログイン情報）は `.env.prod` には書かない。

### ② VPS 上に存在する鍵は3種類

用途ごとに分けている。1つ漏れても他に波及させないため。

| ファイル | 向き | 備考 |
|---|---|---|
| `~/.ssh/authorized_keys` | 作業者のPC → ② VPS を許可 | 公開鍵。VPS契約時の鍵を root からコピー |
| `~/.ssh/github_deploy` | ② VPS → GitHub | 読み取り専用のデプロイキー |
| `~/dashboard/secrets/id_ed25519` | ② VPS → ① レンタルサーバー | SSH-B。`docker-compose.prod.yml` がマウントする |

⚠️ **同じ鍵を複数の用途に使い回さないこと。** 「GitHubへの接続を止めたい」ときに ① への接続も同時に死ぬ。

---

## 構成

```
Claude Desktop（マネージャーのPC）
   └─ MCPサーバー（同じPCでローカル実行 / stdio）
        └─ HTTPS + Authorization: Bearer
             └─ ② VPS 162.43.5.127 / api.khg-marketing.info
                  caddy (80/443)          ← 唯一の公開面
                    └─ express-api (3001) ← 非公開。Docker内部のみ
                         └─ ssh-tunnel (3306) ← 非公開。Docker内部のみ
                              └─ SSH-B (10022)
                                   └─ ① レンタルサーバーの MySQL (127.0.0.1:3306)
```

### なぜこの形なのか

| 判断 | 理由 |
|---|---|
| DBへは**SSHトンネル**経由 | ① は3306番を閉じており、許可IPを登録する機能も無い。ポートフォワーディング以外の手段が無い。副次的に通信全体が暗号化される |
| **Caddy** を前段に置く | Let's Encrypt の証明書取得と更新を自動化する。nginx + certbot だと更新用 cron を別に用意することになり、失敗に気づきにくい。証明書の有効期限は90日しかない |
| MCPサーバーは**各PCでローカル実行** | Claude Desktop のカスタムコネクタ（リモートMCP）は OAuth 2.1 を要求する。stdio 方式なら OAuth の実装が不要 |
| APIキーは**SHA-256ハッシュ**で保存 | 受信して照合するだけなので平文に戻す必要が無い。DBが漏れてもキー本体は復元できない |
| 返すのは**集計値のみ** | 氏名・連絡先・住所・メモ本文は指標にも軸にも含めない。顧客単位のダンプは約23,000件で15〜20Mトークンになり、そもそもClaudeのコンテキストに載らない |

---

## 事前に確認・決めること

### 1. ① の MySQL は TCP で待ち受けているか（**要検証**）

SSHポートフォワードは **TCP しか転送できない**。① の MySQL が Unixソケット専用だとトンネル方式が成立しない。

⚠️ **「① の PHP からDBが使えている」ことは TCP が開いている証明にならない。** `.htaccess` の `DB_HOST=localhost:3306` のように `localhost` を指定すると、MySQL クライアントはソケット接続を選ぶ。

必ず `127.0.0.1` を明示して検証する（後述の手順3-4）。

> **2026-09-01 の実測結果**: ① の MySQL は **TCP 127.0.0.1:3306 で待ち受けている**。トンネル方式で問題なく動作する。

### 2. 読み取り専用ユーザーを用意できるか（**未解決**）

分析APIは集計しか行わないので、`SELECT` だけを持つMySQLユーザーで接続したい。万一APIに欠陥があっても本番データを書き換えられないようにするため。

⚠️ **① のサーバーパネルは「DBへのアクセス権を与える／与えない」の二択で、`GRANT SELECT` のような粒度の指定ができない。** 2026-09-01 時点では絞れていない。

現在の緩和策（いずれも「防御が1枚薄い」ことに変わりはない）:

- **分析API専用のMySQLユーザーを作り、既存アプリのユーザーとは分けた**（後述）。監査時にどちらの接続かログで区別できる
- アプリ側で書き込みを一切行わない（`query.ts` は `SELECT` しか組み立てない）
- 監査ログ `analysis_query_log` に全リクエストを記録
- APIキーに有効期限（365日）を設定

phpMyAdmin から `GRANT SELECT ON db.* TO 'user'@'localhost';` が実行できるかは未検証。実行できるなら絞ること。

---

# 手順

## ステップ0: ② VPS の初期設定（1回だけ）

分析APIを載せる前に、② VPS 自体を安全な状態にする。

### 0-1. SSH-A で接続する

```powershell
# 【作業者のPC（PowerShell）】
ssh root@162.43.5.127
```

入れない場合は **② VPSパネル**の「コンソール接続」（シリアルコンソール）を使う。**SSH設定をミスして入れなくなったときの唯一の復旧手段**でもあるので、使えることを先に確認しておくと安全。

初回接続時に出るホスト鍵のフィンガープリントは、VPSパネルに表示されている値と照合する。

### 0-2. OSの更新

```bash
# 【② VPS】
apt update && apt upgrade -y
cat /etc/os-release          # Ubuntu 24.04 LTS を確認
reboot
```

### 0-3. 作業用ユーザーを作る

root で常用しない。

```bash
# 【② VPS】
adduser deploy               # パスワードを設定
usermod -aG sudo deploy
```

Docker を後で入れる場合は、そのあとで `usermod -aG docker deploy` を実行する。

確認:

```bash
# 【② VPS】
id deploy
# uid=1000(deploy) gid=1000(deploy) groups=1000(deploy),27(sudo),988(docker)
```

### 0-4. 公開鍵を deploy にコピーする

VPS契約時に登録した鍵が `root` に入っているので、それを流用する。**新しい鍵を作って秘密鍵を転送するより安全**（秘密鍵がネットワークを通らない）。

```bash
# 【② VPS】
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
ls -l /home/deploy/.ssh/
```

`-rw------- deploy deploy` になっていること。権限が緩いと SSH が鍵の使用を拒否する。

### 0-5. ⚠️ 鍵でログインできることを確認する（最重要）

**root のセッションを開いたまま、別のウィンドウで確認する。**

```powershell
# 【作業者のPC（PowerShell / 新しいウィンドウ）】
ssh deploy@162.43.5.127
```

プロンプトの末尾が **`$`**（一般ユーザー）になっていること。`#` は root。

```bash
# 【② VPS（deploy でログイン中）】
whoami                       # deploy
sudo whoami                  # root（パスワードを聞かれる）
docker ps                    # 見出しだけ表示されればOK
```

⚠️ **ここが通らないまま次の 0-6 に進むと、二度と入れなくなる。**

### 0-6. sshd を締める

まず現状を調べる。**変更前に必ず実行する。**

```bash
# 【② VPS】
ls -l /etc/ssh/sshd_config.d/
grep -n "^Include" /etc/ssh/sshd_config
sudo sshd -T | grep -Ei "^(permitrootlogin|passwordauthentication|pubkeyauthentication)"
```

⚠️ **`sshd_config` は「最初に現れた値が勝つ」。** `Include /etc/ssh/sshd_config.d/*.conf` の行番号より前に書かれた設定、および `sshd_config.d/` 内で**ファイル名の順序が早いファイル**の設定が優先される。

Ubuntu 24.04 には `50-cloud-init.conf` が置かれていることがあり、そこに `PasswordAuthentication yes` があると、後ろの番号（99など）で `no` と書いても**効かない**。「設定したつもりで実は無効」という最悪の状態になる。

> **2026-09-01 の実測**: `sshd_config.d/` は空、`Include` は12行目、`passwordauthentication` は既に `no`、`permitrootlogin` は `without-password`。競合するファイルは無かったため `99-` で問題なし。

設定ファイルを書く。

⚠️ **ヒアドキュメント（`<<'EOF'`）は貼り付けが途中で崩れると `> ` プロンプトで固まる。** 復帰は `Ctrl + C`。**1行の `printf` 形式を推奨する。**

```bash
# 【② VPS】
printf '%s\n' '# rootログイン禁止（作業は deploy + sudo で行う）' 'PermitRootLogin no' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PubkeyAuthentication yes' | sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null
cat /etc/ssh/sshd_config.d/99-hardening.conf
```

文法チェックと、**再起動前の効果確認**。

```bash
# 【② VPS】
sudo sshd -t                 # 何も出なければ正常
sudo sshd -T | grep -Ei "^(permitrootlogin|passwordauthentication|pubkeyauthentication)"
# permitrootlogin no          ← これを確認してから再起動する
```

`sshd -T` は設定ファイルを読み直して「実際に効く値」を表示する。**再起動せずに結果が分かる**ので必ず先に確認する。

```bash
# 【② VPS】
sudo systemctl restart ssh   # 失敗したら sudo systemctl restart ssh.socket
```

⚠️ **既存のSSHセッションは再起動しても切断されない。** これが唯一の保険なので、開いたまま別ウィンドウで確認する。

```powershell
# 【作業者のPC（PowerShell / 新しいウィンドウ）】
ssh deploy@162.43.5.127      # 入れること
ssh root@162.43.5.127        # Permission denied (publickey) で弾かれること
```

### 0-7. ファイアウォール（ufw）

⚠️ **SSH を許可する前に `ufw enable` すると即座に締め出される。** 「許可を先に登録 → 最後に有効化」の順を厳守する。

```bash
# 【② VPS】
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH       # 最重要。忘れると入れなくなる
sudo ufw allow 80/tcp        # Let's Encrypt の HTTP-01 検証
sudo ufw allow 443/tcp       # 分析API
sudo ufw status verbose      # ← 有効化前にルール一覧を目視確認
sudo ufw enable              # Proceed with operation (y|n)? → y
sudo ufw status verbose
```

**SSH-B（② → ① の10022番）は開ける必要がない。** ② から外へ出ていく通信であり、受信ポートではないため。

⚠️⚠️ **Docker は ufw を迂回する。** `ports:` で公開したポートは Docker が直接 iptables に穴を開けるため、**ufw で拒否していても外部から到達する**。`docker-compose.prod.yml` が 3001番と3306番を `ports:` に書いていないのはこの性質があるからで、「ufw で塞いでいるから大丈夫」ではない。**後から `ports:` を足すと、ufw の設定に関係なくインターネットに露出する。**

### 0-8. ② VPSパネルのパケットフィルター

⚠️ **ufw とは別のファイアウォール。両方で許可しないと通らない。**

- **パケットフィルター** … Xserver のネットワーク層。VPS に届く前に遮断
- **ufw** … VPS の OS 内。VPS に届いた後に遮断

VPSパネル → 対象VPS → 「パケットフィルター設定」で以下を許可する。

| プロトコル | ポート | 送信元 |
|---|---|---|
| TCP | 22 | 全て許可する（絞れるなら絞る） |
| TCP | 80 | 全て許可する |
| TCP | 443 | 全て許可する |

「Web」プリセットを追加すれば 80/443 がまとめて開く。

⚠️ 初期状態では **22番だけ**が開いている。80/443 は自分で追加する必要がある。

⚠️ 22番の送信元を固定IPに絞ればセキュリティは上がるが、**IPが変わると自分も入れなくなる**（復旧はシリアルコンソール）。鍵認証のみ・root禁止まで済んでいればパスワード総当たりは無効化されているので、固定IPが確実でなければやらない方が無難。

### 0-9. Docker と Docker Compose

Xserver VPS の Ubuntu テンプレートには**最初から入っていることがある**。まず確認する。

```bash
# 【② VPS】
docker --version
docker compose version
```

入っていない場合、Ubuntu 標準の `docker.io` は古いため Docker 公式リポジトリから入れる。

```bash
# 【② VPS】
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

⚠️ `docker` グループは実質 root 権限に等しい。付与するのは作業者のユーザーだけにする。

グループの反映には**ログインし直しが必要**。`docker ps` で `permission denied` が出たら `exit` して入り直す。

### 0-10. 自動セキュリティ更新

放置しても脆弱性修正が適用されるようにする。**専任で見る人がいない環境では必須。**

```bash
# 【② VPS】
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # <Yes> を選択（矢印キーとEnter）
cat /etc/apt/apt.conf.d/20auto-upgrades
# APT::Periodic::Update-Package-Lists "1";
# APT::Periodic::Unattended-Upgrade "1";
```

⚠️ **カーネルとライブラリの更新は再起動するまで反映されない。** 動いているプロセスは古いものをメモリに読み込んだままになる。

```bash
# 【② VPS】
ls /var/run/reboot-required   # 存在すれば再起動が必要
```

**月1回程度、業務時間外に `sudo reboot` する運用を推奨。** 3コンテナすべて `restart: unless-stopped` なので、再起動後は自動復帰する。

### 0-11. 作業者のPC側の設定（任意）

離席で SSH が切れるのを防ぐ。`C:\Users\<ユーザー名>\.ssh\config` に追記する。

```
Host 162.43.5.127
    User deploy
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

⚠️ `ServerAliveKeepAlive` というオプションは**存在しない**。書くと `Bad configuration option` で SSH 自体が起動しなくなる。

以降は `ssh 162.43.5.127` だけで繋がる。

---

## ステップ1: DNS

`api.khg-marketing.info` の A レコードを `162.43.5.127` に向ける。

⚠️ **「サブドメイン設定」ではなく「DNSレコード設定」を使う。**

| 機能 | 動作 |
|---|---|
| **サブドメイン設定** | ① 上にWebサイトの領域を作り、**A レコードを ① 自身のIPに向ける**。今回は不要かつ逆向き |
| **DNSレコード設定** | DNSレコードだけを設定できる。**これを使う** |

### 1-1. ネームサーバーの確認

```powershell
# 【作業者のPC（PowerShell）】
nslookup -type=NS khg-marketing.info 8.8.8.8
```

⚠️ 外部DNS（`8.8.8.8`）を明示すること。社内ルーターがNS問い合わせに応答せずタイムアウトすることがある。

`ns1〜ns5.xserver.jp` が返れば ① のサーバーパネルで設定できる。

### 1-2. A レコードを追加

**① レンタルサーバーのサーバーパネル** → 「DNSレコード設定」→ `khg-marketing.info` → 「DNSレコード追加」

| 項目 | 値 |
|---|---|
| ホスト名 | `api` |
| 種別 | A |
| 内容 | `162.43.5.127` |
| TTL | `3600` |

⚠️ ホスト名は `api` **だけ**。`api.khg-marketing.info` と入力すると `api.khg-marketing.info.khg-marketing.info` になる画面がある。

### 1-3. すでにサブドメイン設定で作ってしまった場合

削除する。残すと ① 側に使われない領域と無料SSLの更新エラーが残り、将来の担当者が確実に混乱する。

1. 「サブドメイン設定」で `api` を**削除**（⚠️ ドキュメントルート内のファイルも消える。中身がないことを確認する）
2. 「DNSレコード設定」で `api` の A レコードが残っていれば、内容を `162.43.5.127` に**変更**

### 1-4. 反映確認

```powershell
# 【作業者のPC（PowerShell）】
nslookup api.khg-marketing.info 8.8.8.8
# Address: 162.43.5.127
```

⚠️⚠️ **`162.43.5.127` が返るまで Caddy を起動しないこと。** Let's Encrypt には「同一ドメインで週50回」の失敗上限があり、DNSが ① を指した状態で起動すると失敗を繰り返して**1週間証明書が取れなくなる**。

⚠️ 以前 ① のIPを返していた場合、TTL（3600秒＝最大1時間）はキャッシュが残る。

---

## ステップ2: ② VPS にコードを配置

GitHub のプライベートリポジトリを**読み取り専用のデプロイキー**で clone する。

| 方式 | 漏洩時の影響範囲 |
|---|---|
| **デプロイキー（読み取り専用）** | **このリポジトリを読めるだけ** |
| パーソナルアクセストークン | アカウントがアクセスできる全リポジトリ |

### 2-1. 鍵を作る

```bash
# 【② VPS】
git --version                # 無ければ sudo apt install -y git
ssh-keygen -t ed25519 -C "vps-github-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

`-N ""` はパスフレーズなし。`git pull` を自動化する可能性があるため。鍵ファイルは 600 で作られる。

### 2-2. GitHub に登録

リポジトリの **Settings → Deploy keys → Add deploy key**

| 項目 | 値 |
|---|---|
| Title | `vps-162.43.5.127` |
| Key | 2-1 で表示された公開鍵 |
| Allow write access | ⚠️ **チェックしない** |

### 2-3. SSH設定

```bash
# 【② VPS】
printf '%s\n' 'Host github.com' '    HostName github.com' '    User git' '    IdentityFile ~/.ssh/github_deploy' '    IdentitiesOnly yes' > ~/.ssh/config
chmod 600 ~/.ssh/config
```

`IdentitiesOnly yes` は「この鍵だけを使う」指定。これが無いと他の鍵も順に試され、GitHub 側に拒否されることがある。

### 2-4. 接続テスト

```bash
# 【② VPS】
ssh -T git@github.com
```

初回はフィンガープリントの確認が出る。GitHub の ED25519 鍵は `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`。一致を確認して `yes`。

`Hi <org>/<repo>! You've successfully authenticated, but GitHub does not provide shell access.` が正常。**`does not provide shell access` はエラーではない。**

### 2-5. ブランチ運用

**② VPS が追うのは `production` ブランチだけ。** バージョンごとのブランチ名を打ち替えさせない。

| ブランチ | 役割 |
|---|---|
| `v2.2.***` | 開発用。機能単位で切る |
| **`production`** | **本番用。② VPS はこれだけを追う** |
| `main` | 統合先 |

```
v2.2.110 ─┐
v2.2.111 ─┼→ merge → production ←── ② VPS
v2.2.112 ─┘
```

⚠️ **バージョンブランチを直接 VPS に追わせない。** デプロイのたびにブランチ名を打ち替えることになり、いずれ間違える。加えて「本番で動いているのはどのブランチか」が答えられなくなる。`production` に固定すれば「本番＝`production` の先頭」と断言できる。

### 2-6. clone

```bash
# 【② VPS】
git clone --depth 1 -b production git@github.com:<org>/<repo>.git ~/dashboard
cd ~/dashboard && ls && git branch --show-current && git log --oneline -1
```

`--depth 1` は「最新1コミットだけ取得」。このリポジトリは過去のビルド成果物（`backup/`）を含み全履歴が重いため。

⚠️ 配置先は **`/home/deploy/dashboard`**。`/var/www` や `/opt` に置くと毎回 `sudo` が必要になり、ファイル所有者が root になって扱いにくい。

### 2-7. 既存の clone を production に切り替える（移行時のみ）

バージョンブランチで clone 済みの場合。

```bash
# 【② VPS】
cd ~/dashboard
git fetch --depth 1 origin production
git checkout -B production FETCH_HEAD
git branch --show-current
```

`-B` は「そのブランチが無ければ作り、あれば移動する」。これで `git branch --show-current` が実態と一致する。

⚠️ `.env.prod` と `secrets/` は `.gitignore` で除外されているため、この操作では消えない。

### 2-6. 必要なファイルが揃っているか確認

```bash
# 【② VPS】
cd ~/dashboard && ls docker-compose.prod.yml .env.prod.example docker/caddy/Caddyfile docker/ssh-tunnel/ && ls backend-express/src/features/analysis/ backend-express/src/cli/
```

---

## ステップ3: SSH-B（② VPS → ① レンタルサーバー）

### 3-1. ① 側の準備

**① レンタルサーバーのサーバーパネル** → 「SSH設定」

1. 状態を **ON** にする（初期状態は無効）
2. ホスト名（`svXXXX.xserver.jp`）とサーバーIDをメモ

⚠️ 「**公開鍵登録・設定**」を使う。「公開鍵認証用鍵ペアの生成」を選ぶと ① 側で鍵が作られ、**秘密鍵をダウンロードして ② に持ち込む**必要が生じる。秘密鍵をネットワーク経由で移動させるのは避ける。

⚠️ **既存の公開鍵（VS Code拡張用など）を消さないこと。** 登録UIが追加式か上書き式かを確認し、上書き式なら既存の公開鍵をテキストに退避してから作業する。公開鍵は秘密情報ではないのでメモ帳に保存して問題ない。

### 3-2. ② VPS で鍵を作る

`docker-compose.prod.yml` が `./secrets/id_ed25519` をマウントする設計なので、**最初からその場所に作る**。

```bash
# 【② VPS】
mkdir -p ~/dashboard/secrets && chmod 700 ~/dashboard/secrets
ssh-keygen -t ed25519 -C "vps-to-xserver-tunnel" -f ~/dashboard/secrets/id_ed25519 -N ""
chmod 600 ~/dashboard/secrets/id_ed25519
ls -l ~/dashboard/secrets/
cat ~/dashboard/secrets/id_ed25519.pub    # ← ① に登録する
```

パスフレーズ無しにするのは、autossh が自動で張り直すため対話入力ができないから。

`secrets/` は `.gitignore` で除外済み。

コメント `vps-to-xserver-tunnel` を付けているので、① の登録一覧で「どれが VPS 用か」が見分けられる。

### 3-3. ホスト鍵を登録

`StrictHostKeyChecking=yes` にしているため、事前に `known_hosts` が必要。コンテナは対話的に「本当に接続しますか？」と聞けない。

```bash
# 【② VPS】
XS_HOST=svXXXX.xserver.jp     # ← 実際の値に置き換える
XS_USER=サーバーID             # ← 実際の値に置き換える
echo "$XS_USER@$XS_HOST"

ssh-keyscan -p 10022 "$XS_HOST" > ~/dashboard/secrets/known_hosts
cat ~/dashboard/secrets/known_hosts
```

鍵の種類ごとに2〜3行出る。**空なら失敗**（① の SSH設定が OFF か、ホスト名の誤り）。

⚠️ この変数は**今開いているシェルの中だけ**有効。SSH を切断すると消える。

⚠️ `StrictHostKeyChecking=no` にして省略しないこと。中間者攻撃を検知できなくなる。ただし `ssh-keyscan` は「いま接続できた相手の鍵」を無検証で記録するため、初回接続時のリスクは残る（以降の変更は検知できる）。

### 3-4. 手動で疎通確認

⚠️ **Docker で起動する前に必ず手で確認する。** コンテナ内で失敗するとログが読みにくく、切り分けに時間がかかる。

```bash
# 【② VPS】
ssh -i ~/dashboard/secrets/id_ed25519 -o UserKnownHostsFile=~/dashboard/secrets/known_hosts -o StrictHostKeyChecking=yes -p 10022 "$XS_USER@$XS_HOST"
```

① のシェルに入れたら、**TCP で MySQL に繋がるかを確認する**（ステップ「事前に確認すること」の1）。

```bash
# 【① レンタルサーバー】
mysql -h 127.0.0.1 -P 3306 -u <DB_USER> -p <DB_NAME> -e "SELECT COUNT(*) FROM staff_list;"
exit
```

⚠️ **`-h 127.0.0.1` を明示する。** `-h localhost` だとソケット接続になり、トンネルが使えるかの判定にならない。

⚠️ **`-p` の後にパスワードを書かない。** コマンド履歴とプロセス一覧に残る。`-p` だけ書いて対話入力する。

| 結果 | 意味 |
|---|---|
| 件数が返る | ✅ トンネル方式が使える |
| `Can't connect to MySQL server on '127.0.0.1'` | ❌ TCP で待ち受けていない。**設計変更が必要** |
| `Access denied for user` | ネットワークは到達している。認証情報の問題 |

### 3-5. 分析API専用のMySQLユーザーを作る

⚠️ **既存ユーザーのパスワードをリセットしてはいけない。** ① で動いている PHP アプリ（`.htaccess` に記載）が即座にDB接続できなくなり、ダッシュボード全体が停止する。

**① のサーバーパネル** → 「MySQL設定」で**2段階**の操作を行う。

1. 「**MySQLユーザ追加**」でユーザーを作る（例: `xs200571_analysis`）
2. 「**MySQL一覧**」タブで、対象DBの「**アクセス権所有ユーザ**」にそのユーザーを**追加**

⚠️⚠️ **2 を忘れると、ユーザーは存在するのに `Access denied` になる。** 最も見落としやすい箇所。

⚠️ 既存ユーザーのアクセス権は**外さない**。

---

## ステップ4: `.env.prod`

```bash
# 【② VPS】
cd ~/dashboard
cp .env.prod.example .env.prod
chmod 600 .env.prod
nano .env.prod
```

`nano` の操作: `Ctrl + O` → `Enter` で保存、`Ctrl + X` で終了。画面下部の `^` は `Ctrl` を意味する。

| 変数 | 入れる値 | 確認場所 |
|---|---|---|
| `ACME_EMAIL` | 受信できるメールアドレス | 証明書の失効通知先 |
| `SSH_HOST` | `svXXXX.xserver.jp` | **① のサーバーパネル「SSH設定」** |
| `SSH_PORT` | `10022` | 記入済み |
| `SSH_USER` | ① のサーバーID | **① のサーバーパネル** |
| `REMOTE_DB_HOST` | `localhost` | 記入済み（下記の理由） |
| `REMOTE_DB_PORT` | `3306` | 記入済み |
| `DB_NAME` | データベース名 | **① のサーバーパネル「MySQL設定」** |
| `DB_USER` | **3-5 で作った分析専用ユーザー** | 同上 |
| `DB_PASS` | そのユーザーのパスワード | 設定したもの |

⚠️ `=` の前後に空白を入れない。クォートも不要。

### `REMOTE_DB_HOST` が `localhost` である理由

`ssh -L 3306:REMOTE_DB_HOST:3306` の `REMOTE_DB_HOST` は **② VPS ではなく ① レンタルサーバーの内部で名前解決される**。① の MySQL は同一サーバー上にあるため、① から見たホスト名は `localhost` になる。

① のサーバーパネルに「MySQLホスト名」の項目が見つからないのはこのためで、**探しても出てこないのが正常**。

### 記入漏れの確認（パスワードを表示しない）

```bash
# 【② VPS】
awk -F= '/^[A-Z_]+=/ {print $1 "=" (length($2)>0 ? "設定済み" : "★空欄★")}' .env.prod
```

9項目すべて「設定済み」になっていること。

⚠️ `grep -c '=' .env.prod` はコメント行の区切り線（`# =====`）も数えるので数が合わない。上の `awk` を使う。

---

## ステップ5: DBのマイグレーション

APIキーと監査ログのテーブルを本番DBに作る。既存テーブルには一切触らない（`CREATE TABLE IF NOT EXISTS`）。

| テーブル | 用途 |
|---|---|
| `analysis_api_key` | APIキーの照合（SHA-256ハッシュ）・失効・有効期限 |
| `analysis_query_log` | 誰がいつ何を集計したかの監査ログ |

### 方法A: phpMyAdmin（推奨・ブラウザ作業）

1. **① のサーバーパネル** → 「phpMyAdmin」
2. ⚠️ **左サイドバーで対象データベースをクリックして選択する**
3. 「SQL」タブで `backend-express/scripts/sql/2026-08-31_analysis_api_key.sql` の内容を実行

⚠️⚠️ **データベースを選択しないと `#1109 'staff_list' は information_schema では不明な表です` になる。** phpMyAdmin の SQL タブは `information_schema` を選択した状態で開くことがある。同じ理由で `SHOW COLUMNS FROM staff_list` も失敗する。

⚠️ `SELECT ... FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()` も、DBが選択されていないと `DATABASE()` が NULL になり**何も返さない**。テーブル定義を調べるなら `SHOW COLUMNS FROM \`DB名\`.\`テーブル名\`;` の方が確実。

### 方法B: ② VPS からトンネル経由

```bash
# 【② VPS】
sudo apt install -y mariadb-client
ssh -i ~/dashboard/secrets/id_ed25519 -o UserKnownHostsFile=~/dashboard/secrets/known_hosts -p 10022 -N -L 13306:localhost:3306 "$XS_USER@$XS_HOST" &

mysql -h 127.0.0.1 -P 13306 -u <DB_USER> -p <DB_NAME> < backend-express/scripts/sql/2026-08-31_analysis_api_key.sql

jobs                         # バックグラウンドのSSHを確認
kill %1                      # 閉じる
```

⚠️ テスト用は **13306**（本番の3306と混同しないため）。

⚠️ `kill %1` が `そのようなジョブはありません` になる場合、別セッションで張ったか既に終了している。`pgrep -af "13306"` で確認し、出たプロセスIDを `kill` する。

### 確認

```sql
SHOW TABLES LIKE 'analysis_%';   -- 2件返ること
```

---

## ステップ6: 起動（段階的に）

⚠️ **3つのコンテナを一気に上げない。** 失敗したときに原因が分からなくなる。依存関係の順に1つずつ確認する。

```
ssh-tunnel  →  express-api  →  caddy
（DB接続）      （API本体）      （TLS・公開）
```

### 6-1. コマンドを短縮する

```bash
# 【② VPS】
echo "alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'" >> ~/.bashrc
source ~/.bashrc
alias dcp
```

⚠️⚠️ **`--env-file .env.prod` の指定は必須。** Docker Compose が自動で読むのは `.env` という名前だけで、`.env.prod` は読まない。省略すると変数が空になり、原因の分かりにくい失敗をする。エイリアスにしておけば指定漏れが起きない。

```bash
# 【② VPS】
dcp config --services        # caddy / express-api / ssh-tunnel の3つ
```

⚠️ ここでエラーが出たら `.env.prod` の書式に問題がある。

### 6-2. ビルド

```bash
# 【② VPS】
dcp build
```

このリポジトリでは1分程度で終わる（React のビルドが含まれないため）。速すぎて不安になるが正常。

確認:

```bash
# 【② VPS】
docker images                # dashboard-express-api / dashboard-ssh-tunnel があること
docker run --rm --entrypoint sh dashboard-express-api -c "ls dist && ls dist/cli"
```

⚠️ `dcp images` は「**作成済みコンテナ**のイメージ」を一覧するコマンドで、コンテナが無い段階では空になる。イメージの有無は `docker images` で見る。

⚠️ `dist/cli/issueAnalysisKey.js` があることを確認する。APIキー発行に使う。CLI を `scripts/` ではなく `src/cli/` に置いているのは、`tsconfig.json` の `include: ["src/**/*.ts"]` から外れるとビルドされず、本番イメージには `tsx` も入っていない（`--omit=dev`）ため実行できないから。

### 6-3. SSHトンネル

```bash
# 【② VPS】
dcp up -d ssh-tunnel
dcp ps                       # STATUS が Up
dcp logs ssh-tunnel
```

⚠️ **正常時はログがほとんど出ない。** autossh は接続に成功すると静かに待機する。「ログが空」＝正常の可能性が高い。

⚠️ `Restarting` を繰り返している場合は失敗。`restart: unless-stopped` により落ちても再試行し続けるため、10秒待って `dcp ps` を再実行すると確実。

| ログ | 原因 |
|---|---|
| `Permission denied (publickey)` | 公開鍵の登録漏れ、または `SSH_USER` の誤り |
| `Host key verification failed` | `known_hosts` の不一致 |
| `Connection refused` | `SSH_HOST` / `SSH_PORT` の誤り |
| `Could not resolve hostname` | `SSH_HOST` のタイプミス |
| `Bad owner or permissions` | 秘密鍵の権限が 600 でない |

**トンネル越しにDBへ到達できるかを実証する**（`.env.prod` の値をそのまま使うので手打ちミスが原因から除外できる）。

```bash
# 【② VPS】
cd ~/dashboard && set -a && . ./.env.prod && set +a && \
docker run --rm --network dashboard_default -e MYSQL_PWD="$DB_PASS" mariadb:10.11 \
  mariadb -h ssh-tunnel -P 3306 -u "$DB_USER" "$DB_NAME" -e "SELECT COUNT(*) FROM staff_list;"
```

⚠️ このコマンドは `.env.prod` の値をシェルの環境変数に読み込む。`echo $DB_PASS` すれば見えるので、以降の操作に注意する（SSH を切断すれば消える）。

⚠️ ネットワーク名が違う場合は `docker network ls` で確認する。

### 6-4. Express API

```bash
# 【② VPS】
dcp up -d express-api
dcp logs express-api
dcp ps
```

期待されるログ:

```
[INFO] DB 接続 OK: ssh-tunnel:3306/<DB名>
[INFO] Express API 起動: http://localhost:3001 (NODE_ENV=production)
[INFO] 登録ルート 10 件:
  🔒 GET    /api/v1/analysis/meta      — ...
  🔒 GET    /api/v1/analysis/pivot     — ...
  🔒 GET    /api/v1/analysis/funnel    — ...
  🔒 GET    /api/v1/analysis/unsynced  — ...
```

**`DB 接続 OK` と 🔒 付きの4ルートが最重要。** この Express は起動時に必ずDB疎通を確認してから待ち受けを始める（`server.ts` の `pingDatabase()`）。「サーバーは立っているのに全リクエストが500」という分かりにくい状態を避けるため。

ヘルスチェック（3001番は外部公開していないので Docker 内部から叩く）:

```bash
# 【② VPS】
docker run --rm --network dashboard_default curlimages/curl:latest -s http://express-api:3001/api/health
# {"status":"ok",...,"database":"connected","routeCount":10,...}
```

### 6-5. Caddy（最後の関門）

⚠️⚠️ **起動した瞬間に Let's Encrypt へ証明書を要求する。** 以下がすべて揃っていることを確認してから実行する。

- DNS が `162.43.5.127` を返す
- VPSパネルのパケットフィルターで 80/443 開放
- ufw で 80/443 開放
- `.env.prod` の `ACME_EMAIL` 記入済み
- `express-api` が動作中

```bash
# 【② VPS】
dcp up -d caddy
dcp logs caddy 2>&1 | grep -iE "certificate|error|obtain|challenge"
dcp ps
```

`certificate obtained successfully` が出れば成功。通常10〜30秒。

`dcp ps` で caddy に `0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp` が表示されること。

| ログ | 原因 |
|---|---|
| `no valid A records found` | DNS が未反映 |
| `timeout during connect` | 80番が塞がれている（パケットフィルター or ufw） |
| `unauthorized: Invalid response from http://...` | 別のサーバー（① など）が応答している |
| `too many failed authorizations` | **レート制限到達。1週間待つことになる** |

⚠️ **失敗が続く場合は即座に止める。**

```bash
# 【② VPS】
dcp stop caddy
```

放置すると `restart: unless-stopped` により再試行を繰り返し、週50回の上限を消費する。

---

## ステップ7: 疎通確認

```powershell
# 【作業者のPC（PowerShell）】
curl.exe -i https://api.khg-marketing.info/api/health
```

⚠️ PowerShell では `curl` が `Invoke-WebRequest` のエイリアスなので **`curl.exe` と明示する**。

| 確認項目 | 期待される内容 |
|---|---|
| ステータス | `200` |
| `strict-transport-security` ヘッダ | あり（Caddyfile のセキュリティヘッダが効いている） |
| `"database":"connected"` | **インターネット → Caddy → Express → トンネル → ① の本番DB が全通** |

認証が効いているかの確認:

```powershell
# 【作業者のPC（PowerShell）】
curl.exe -s -o NUL -w "status=%{http_code}" https://api.khg-marketing.info/api/v1/analysis/meta
```

⚠️ **`status=401` が正しい動作。** `200` が返ったら認証をすり抜けているので、即座に `dcp stop caddy` で入口を閉じて調査する。

---

## ステップ8: APIキーの発行

キーは **`staff.brand = 'Master'` のスタッフにしか発行できない**（CLIが権限を検証して弾く）。

対象者の `staff.id` を調べる（phpMyAdmin）:

```sql
SELECT id, name, brand FROM staff WHERE brand = 'Master' ORDER BY id;
```

発行:

```bash
# 【② VPS】
dcp exec express-api node dist/cli/issueAnalysisKey.js \
  --staff-id 12 --label "○○部長 ノートPC" --days 365
```

| 引数 | 意味 |
|---|---|
| `--staff-id` | `staff.id` |
| `--label` | 用途がわかる名前。棚卸しと失効判断に使う |
| `--days` | 有効日数。省略すると無期限 |

⚠️ **`--days` は必ず指定する。** 無期限にすると退職者のキーが永久に有効なまま残る。

⚠️⚠️ **キーは発行時にしか表示されない。** DBにはSHA-256ハッシュしか残らないので、控え忘れたら再発行するしかない（DBが漏れてもキーを復元できない設計であり、正しい挙動）。

### キーの取り扱い

| やること | やらないこと |
|---|---|
| パスワード管理ツールで本人に渡す | **チャット・メールに貼る** |
| **1人1キー**で発行する | 全員で1つを共有する |
| ラベルに所有者を明記する | `test` のような名前にする |

1人1キーにする理由は、**漏洩時にその人のキーだけを失効させられる**ことと、監査ログで誰の操作か特定できること。

### 失効

```sql
UPDATE analysis_api_key SET revoked_at = NOW() WHERE id = <id>;
```

`revoked_at` が入っていれば認証は即座に拒否される。**再起動は不要。**

### 一覧（キー本体は表示されない）

```sql
SELECT id, staff_id, label, key_prefix, expires_at, revoked_at, last_used_at
  FROM analysis_api_key ORDER BY id;
```

---

## ステップ9: MCPサーバーの配布

```
Claude Desktop
    ↓ stdio（標準入出力。ローカルプロセス間通信）
MCPサーバー（同じPCで Node.js として動く）
    ↓ HTTPS + Authorization: Bearer
② VPS の分析API
```

⚠️ **APIキーは MCPサーバーのプロセスの環境変数にしか存在しない。** Claude Desktop の会話には現れないので、Claude 自身がキーを読み取ることはできない。

### 9-1. ビルド

```powershell
# 【利用者のPC（PowerShell）】
cd <リポジトリ>\mcp-server
npm install
npm run build
```

`dist/index.js` が生成される。必要なのは Node.js 20以上。

### 9-2. 設定ファイル

```
C:\Users\<ユーザー名>\AppData\Roaming\Claude\claude_desktop_config.json
```

⚠️ `AppData` は**既定で非表示のフォルダ**。エクスプローラーのアドレスバーに `%APPDATA%\Claude` と入力すれば直接開ける。

⚠️ **確実なのは Claude Desktop の設定画面から開く方法。** 設定（歯車）→「開発者」→「構成を編集」。Claude Desktop が実際に読んでいるファイルが開くので、場所を探す必要がない。

⚠️ アプリ本体（`Claude.exe`）は `%LOCALAPPDATA%\AnthropicClaude\` にある。**本体の場所と設定ファイルの場所は別。**

既に他のMCPサーバーを登録している場合は `mcpServers` の中に**追記**する（ファイル全体を置き換えない）。`mcpServers` はトップレベルのキー。

```json
{
  "mcpServers": {
    "khg-analysis": {
      "command": "node",
      "args": ["C:\\Users\\<ユーザー名>\\<パス>\\mcp-server\\dist\\index.js"],
      "env": {
        "KHG_ANALYSIS_API_URL": "https://api.khg-marketing.info",
        "KHG_ANALYSIS_API_KEY": "khg_kpi_で始まる44文字以上のキー全体"
      }
    }
  }
}
```

⚠️ **パスは `\\`（バックスラッシュ2つ）。** JSON では `\` がエスケープ文字なので1つだとパスが壊れる。

⚠️ **`KHG_ANALYSIS_API_KEY` はキー全体を貼る。** `khg_kpi_` の後に43文字続く。プレフィックスだけでは認証されない。

⚠️ JSON はコメントも末尾カンマも許さない。

構文の検証（キーを表示せずに）:

```powershell
# 【利用者のPC（PowerShell）】
try { Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" -Raw | ConvertFrom-Json -ErrorAction Stop | Out-Null; "JSON OK" } catch { "JSON エラー: " + $_.Exception.Message }
```

### 9-3. 再起動

設定ファイルは**起動時にしか読まれない。**

1. **タスクトレイ**の Claude アイコンを右クリック → 終了
2. Claude Desktop を起動

⚠️ ウィンドウの × では常駐が残り、設定が再読み込みされない。

### 9-4. 動作確認

設定 → 「開発者」で `khg-analysis` が接続済みになっているか確認する。

チャットで:

```
分析APIで使える集計軸と指標を教えて
```

⚠️ **Claude が「どのディレクトリですか」「対象を特定できればソースから洗い出します」と聞いてきたら、MCPが接続されていない。** ツールが見えないため、コードを読んで調べようとしている。ソースから読めるのは定義だけで実際の集計値は取れないので、この方向に進めても意味がない。

| 症状 | 原因 |
|---|---|
| ツールが一覧に出ない | JSON構文エラー。`\\` と末尾カンマを確認 |
| `KHG_ANALYSIS_API_KEY が設定されていません` | `env` の記述漏れ |
| `認証に失敗しました` | キーの貼り間違い（前後の空白、途中の改行）、失効、期限切れ |
| 応答がない／すぐ落ちる | `node` が PATH にない → `command` を `node.exe` のフルパスにする |

ログ:

```powershell
# 【利用者のPC（PowerShell）】
Get-Content "$env:APPDATA\Claude\logs\mcp-server-khg-analysis.log" -Tail 30
```

---

# 運用

## 更新の反映

### 1. あなたのPC — 開発ブランチを production に取り込む

```powershell
# 【作業者のPC（PowerShell）】
git checkout production
git merge v2.2.111          # ← 一段落した開発ブランチ
git push origin production
```

⚠️ **push しないと ② VPS には届かない。** VPS は GitHub からしかコードを取得しない。コミットしただけでは反映されない。

⚠️ `scp` で直接送らないこと。VPS上のコードとGitの履歴がずれ、「本番で動いているのはどのコミットか」が分からなくなる。障害時に切り分け不能になる。

### 2. ② VPS — 常に同じ1行

```bash
# 【② VPS】
cd ~/dashboard && git fetch --depth 1 origin production && git reset --hard FETCH_HEAD && dcp build express-api && dcp up -d --force-recreate express-api
```

```bash
# 【② VPS】
git log --oneline -1
dcp logs --tail 30 express-api
```

⚠️ **ブランチ名を打ち替えないこと。** 追うのは常に `production`。

⚠️ `git reset --hard` は追跡中のファイルの変更を捨てるが、`.env.prod` と `secrets/` は `.gitignore` で除外されているため消えない。

### 3. 変更箇所ごとの反映範囲

| 変更したファイル | 反映に必要な作業 |
|---|---|
| `backend-express/src/features/analysis/*.ts` | ② VPS で1回 |
| `backend-express/` のその他 | 同上 |
| **`mcp-server/src/index.ts`** | **全利用者のPCで再ビルド・再配布** |
| `frontend/` `backend/`（PHP） | ① レンタルサーバーへ別途デプロイ。VPSとは無関係 |

⚠️⚠️ **Claude への指示・注意事項は `mcp-server` のツール説明文ではなく `meta.ts` に書く。** MCP側に書くと、文言を1文字直すだけで利用者全員のPCを回ることになる。集計の解釈に関する注意（ファネルの非単調性など）はすべて `meta.ts` に集約されている。

⚠️⚠️ **`--force-recreate` を付ける。** 付けないと「設定が変わっていない」と判断されてコンテナが再利用され、**新しいイメージが使われない**ことがある。

⚠️ **ログのタイムスタンプが現在時刻に変わったかを必ず確認する。** `docker logs` はコンテナ起動以降の全履歴を表示するため、作り直していないと古いログがそのまま見え、「直したのに直っていない」と誤認する。

## 監視すべきもの

| 対象 | 確認方法 | 落ちるとどうなるか |
|---|---|---|
| SSHトンネル | `dcp logs ssh-tunnel` / `dcp ps` | APIが全滅（DB接続不能） |
| 証明書の更新 | `dcp logs caddy` | 期限切れで全リクエスト失敗（有効期限90日） |
| APIキーの有効期限 | `analysis_api_key.expires_at` | 期限日に突然使えなくなる |
| OS更新後の再起動 | `ls /var/run/reboot-required` | 脆弱性が残り続ける |

## 障害対応（ランブック）

### まず状況を掴む

```bash
# 【② VPS】
dcp ps                       # 3つとも Up か
docker stats --no-stream     # CPU / メモリ
df -h                        # ディスク残量
free -h                      # メモリ残量
```

### 症状別

#### API が 502 / 503 を返す

Caddy は動いているが `express-api` に転送できない状態。

```bash
# 【② VPS】
dcp ps
dcp logs --tail 50 express-api
```

`express-api` が `Restarting` なら、DB接続に失敗して起動時に終了している。次項へ。

#### `express-api` が起動しない（`DB 接続 OK` が出ない）

トンネルを疑う。

```bash
# 【② VPS】
dcp ps ssh-tunnel
dcp logs --tail 50 ssh-tunnel
dcp restart ssh-tunnel
sleep 10
dcp restart express-api
dcp logs --tail 20 express-api
```

それでも駄目なら、コンテナを介さず手動でSSH-Bを試して切り分ける（ステップ3-4）。① 側の SSH設定が OFF になっていないか、鍵の登録が消えていないかを確認する。

#### API が全リクエストで証明書エラー

```bash
# 【② VPS】
dcp logs caddy 2>&1 | grep -iE "certificate|error|obtain" | tail -30
```

更新失敗の典型的な原因は **80番が塞がれた**こと。パケットフィルターと ufw の両方を確認する。

```bash
# 【② VPS】
sudo ufw status verbose
```

#### 特定の利用者だけ 401

そのキーが失効または期限切れ。

```sql
SELECT id, label, key_prefix, expires_at, revoked_at, last_used_at
  FROM analysis_api_key WHERE key_prefix LIKE 'khg_kpi_%';
```

`expires_at` が過去、または `revoked_at` に値があれば拒否される。再発行する（ステップ8）。

#### 429 が返る

レート制限（IP単位120回/分、キー単位60回/分）。手作業の分析では通常到達しないので、**MCPクライアントの暴走を疑う**。

```sql
SELECT created_at, endpoint, status, client_ip
  FROM analysis_query_log ORDER BY id DESC LIMIT 50;
```

閾値は `backend-express/src/middlewares/analysisRateLimit.ts`。

#### 集計が遅い / タイムアウト

```sql
SELECT endpoint, group_by, metrics, row_count, duration_ms, created_at
  FROM analysis_query_log WHERE duration_ms > 5000 ORDER BY id DESC LIMIT 30;
```

⚠️ **① は共用レンタルサーバー**なので、重い集計を連続で投げると既存のダッシュボードも遅くなる。軸の組み合わせを減らすか期間を絞る。

上限は 2000行 / 250KB（`query.ts` の `MAX_ROWS` / `MAX_BYTES`）。超えるとエラーで打ち切る。

#### 全体を作り直したい

```bash
# 【② VPS】
dcp down                     # コンテナを削除（ボリュームは残る）
dcp up -d ssh-tunnel
dcp up -d express-api
dcp up -d caddy
```

⚠️ **`dcp down -v` は実行しないこと。** `-v` はボリュームも削除するため、`caddy-data` に保存された**証明書が消える**。取り直しになり、Let's Encrypt のレート制限に近づく。

## 監査ログの確認

```sql
-- 誰がいつ何を引いたか
SELECT l.created_at, s.name, l.endpoint, l.group_by, l.row_count, l.duration_ms, l.status
  FROM analysis_query_log l
  LEFT JOIN staff s ON s.id = l.staff_id
 ORDER BY l.id DESC LIMIT 50;

-- 使われていないキーの棚卸し
SELECT id, key_prefix, label, last_used_at, expires_at, revoked_at
  FROM analysis_api_key ORDER BY last_used_at IS NULL DESC, last_used_at;
```

## 定期作業

| 頻度 | 作業 |
|---|---|
| 月1回 | `ls /var/run/reboot-required` を確認し、必要なら業務時間外に `sudo reboot` |
| 四半期 | APIキーの棚卸し（`last_used_at` が古いものを失効） |
| 年1回 | APIキーの再発行（`--days 365` の期限前に） |
| 随時 | 退職者が出たらそのキーを `revoked_at` で失効 |

## 残っているリスク

| リスク | 現状 | 緩和策 |
|---|---|---|
| **MySQLユーザーの権限を絞れていない** | 分析APIが書き込み可能な権限で接続 | アプリは `SELECT` のみ発行。監査ログで検知。phpMyAdmin から `GRANT SELECT` が可能なら絞る |
| **Linuxを操作できる人が1名のみ** | バス係数1 | 2人目を確保する。この手順書はその引き継ぎ資料も兼ねる |
| ① が共用サーバー | 重い集計が既存アプリに影響 | 行数・バイト数・レート制限で抑制 |
| `ssh-keyscan` の初回信頼 | 初回接続時の中間者攻撃は検知できない | 以降の鍵変更は検知される |
