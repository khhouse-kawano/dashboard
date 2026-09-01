# 分析API VPSデプロイ手順

Claude Desktop から KPI・歩留まりを確認するための分析APIを、VPS上で公開するまでの手順。

## ⚠️ 登場するサーバーは2つ。混同しないこと

この手順では**別々の2台**を行き来する。「サーバーパネル」「サーバーID」はどちらか一方にしか
存在しないため、以下の呼び名で厳密に区別する。**本文でもこの呼び名だけを使う。**

| | ① **レンタルサーバー** | ② **VPS** |
|---|---|---|
| 正式名 | エックスサーバー（共用レンタルサーバー） | Xserver VPS |
| 用途 | **本番DB** ＋ 既存のPHP API・React | **新規の分析API（Express）** |
| アドレス | `khg-marketing.info` | `162.43.5.127` / `api.khg-marketing.info` |
| 管理画面 | **サーバーパネル** | **VPSパネル** |
| サーバーID | **あり**（FTPユーザー名と同じ） | なし |

- 「サーバーパネル」「サーバーID」「MySQL設定」「SSH設定」は**すべて ①**
- ② の VPSパネルで触るのは**パケットフィルターだけ**

### SSHも2種類ある

| | 誰から誰へ | ポート | 用途 |
|---|---|---|---|
| **SSH-A** | 作業者のPC → **② VPS** | 22 | VPSの管理作業（この手順の作業場所） |
| **SSH-B** | **② VPS** → **① レンタルサーバー** | 10022 | DBへのトンネル（autossh が常駐） |

`.env.prod` の `SSH_HOST` / `SSH_USER` / `SSH_PORT` は **SSH-B 用**、つまり **① の情報**。
SSH-A（VPSへのログイン情報）は `.env.prod` には書かない。

### 鍵を作る場所と登録する場所は別サーバー

SSH-B の鍵は **② VPS 上で作り**、**公開鍵を ① のサーバーパネルに登録**する。

```
構成:
Claude Desktop（マネージャー5名のPC）
   └─ ローカルMCPサーバー（stdio）
        └─ HTTPS ─→ ② VPS 162.43.5.127
                      caddy (443) ─→ express-api (3001) ─→ ssh-tunnel (3306)
                                                              └─ SSH-B ─→ ① レンタルサーバーのMySQL
```

---

## 事前に確認・決めること

### 1. ① レンタルサーバーのMySQLは直接つなげない

① レンタルサーバーは3306番をファイアウォールで閉じており、**① のサーバーパネルに許可IPを
登録する機能自体が無い**。VPSから本番DBを参照する手段はSSHのポートフォワーディングだけ。

副次的な利点として、SSH経由なので通信全体が暗号化される。仮に3306番を直接開けられた
としても、MySQLの平文通信をインターネットに流すのは避けるべきだった。

### 2. 読み取り専用ユーザーを用意できるか（未確認）

分析APIは集計しか行わないので、`SELECT` だけを持つMySQLユーザーで接続したい。
万一APIに欠陥があっても、本番データを書き換えられないようにするため。

⚠️ **① レンタルサーバーのサーバーパネルで権限を絞れるかは未確認。**
パネルのアクセス権設定はDB単位の付与しかできない可能性が高く、その場合は
`GRANT SELECT` を自分で実行する権限も無いことが多い。

絞れなかった場合の緩和策（どれも「防御が1枚薄い」ことに変わりはない）:

- アプリ側で書き込みを一切行わない（分析機能は `SELECT` しか発行していない）
- 監査ログ `analysis_query_log` で不審な利用を検知できるようにしておく
- APIキーに有効期限を付け、定期的に入れ替える

パネルで絞れるかを最初に確認し、**絞れるなら必ず絞ること**。

---

## 手順

### 0. ② VPS の初期設定（Ubuntu）

分析APIを載せる前に、② VPS 自体を安全な状態にする。ここは1回だけの作業。

#### 0-1. SSH-A で接続する

作業者のPC（Windows 11 は OpenSSH 同梱）から。

```powershell
ssh root@162.43.5.127
```

入れない場合は ② VPSパネルの「コンソール接続」を使う。**SSH設定をミスして入れなくなった
ときの復旧手段でもある**ので、使えることを先に確認しておくと安全。

#### 0-2. OSの更新とバージョン確認

```bash
apt update && apt upgrade -y
lsb_release -a          # 22.04 か 24.04 かで sshd の再起動方法が変わる
```

#### 0-3. 作業用ユーザーを作る

root で常用しない。Docker の操作もこのユーザーで行う。

```bash
adduser deploy                    # パスワードを設定
usermod -aG sudo deploy
```

#### 0-4. SSH-A を鍵認証にする

⚠️ **鍵は作業者のPC上で作る。** ② VPS 上で作ってはいけない（秘密鍵がサーバーに残る）。
後で作る SSH-B の鍵とは別物。

作業者のPC（PowerShell）で:

```powershell
ssh-keygen -t ed25519 -C "shinji-kawano@work-pc" -f $env:USERPROFILE\.ssh\xserver_vps

# 公開鍵を ② VPS の deploy ユーザーへ登録する。
# Trim() で改行・CR を落とす（CRが混ざると authorized_keys が無効になる）
$key = (Get-Content "$env:USERPROFILE\.ssh\xserver_vps.pub" -Raw).Trim()
ssh root@162.43.5.127 "install -d -m 700 -o deploy -g deploy /home/deploy/.ssh && printf '%s\n' '$key' >> /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys"
```

**⚠️ ここで必ず別のウィンドウを開き、鍵でログインできることを確認する。**

```powershell
ssh -i $env:USERPROFILE\.ssh\xserver_vps deploy@162.43.5.127
```

確認できてから、パスワード認証と root ログインを止める。

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF

sudo sshd -t                      # 構文確認。エラーが出たら再起動しない

# Ubuntu 24.04 は sshd がソケット起動なので socket 側を再起動する
sudo systemctl restart ssh.socket 2>/dev/null || sudo systemctl restart ssh
```

再起動後、**今つないでいるセッションは閉じずに**別ウィンドウでログインし直せることを確認する。

#### 0-5. ファイアウォール（ufw）

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp             # SSH-A
sudo ufw allow 80/tcp             # Let's Encrypt の HTTP-01 検証
sudo ufw allow 443/tcp            # 分析API
sudo ufw enable
sudo ufw status verbose
```

⚠️ **② VPSパネルのパケットフィルターとは別物。両方で許可しないと通らない。**

⚠️⚠️ **Docker は ufw を迂回する。** `ports:` で公開したポートは Docker が直接
iptables に穴を開けるため、**ufw で拒否していても外部から到達する**。
`docker-compose.prod.yml` が 3001番と3306番を `ports:` に書いていないのは
この性質があるからで、「ufw で塞いでいるから大丈夫」ではない。
後から `ports:` を足すと、ufw の設定に関係なくインターネットに露出する。

#### 0-6. Docker と Docker Compose

Ubuntu 標準の `docker.io` は古いため、Docker 公式リポジトリから入れる。

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# deploy ユーザーが sudo なしで docker を使えるようにする
sudo usermod -aG docker deploy
```

⚠️ `docker` グループは実質 root 権限に等しい。付与するのは作業者のユーザーだけにする。

一度ログアウトして入り直してから確認する。

```bash
docker compose version
docker run --rm hello-world
```

以降の手順（1〜8）は `deploy` ユーザーで作業する。

### 1. DNS

`api.khg-marketing.info` の A レコードを `162.43.5.127` に向ける。

```
api.khg-marketing.info.  A  162.43.5.127
```

⚠️ Caddy が Let's Encrypt の証明書を取るには、**DNSが引ける状態になってから**
起動する必要がある。伝播前に起動すると取得に失敗し、リトライを繰り返す。
`dig api.khg-marketing.info` で解決できることを確認してから次へ進む。

### 2. ② VPS のファイアウォール

⚠️ **設定箇所が2つある。両方開けないと通らない。**

1. **② VPSパネル**のパケットフィルター（Xserver VPS の管理画面）
2. **② VPS のOS側**（`ufw` 等）

開けるのは3つだけ。

| ポート | 用途 |
|---|---|
| 22 | **SSH-A**（作業者のPC → ② VPS）。可能なら接続元IPを絞る |
| 80 | Let's Encrypt のHTTP-01検証とHTTPSへのリダイレクト |
| 443 | 分析API |

**SSH-B（② → ① の10022番）は開ける必要がない。** ② から外へ出ていく通信であり、
受信ポートではないため。

⚠️ **3001番（Express）と3306番は絶対に開けない。**
`docker-compose.prod.yml` でも `ports` に書いていない。書くと Caddy を迂回でき、
TLSも認証前のレート制限も効かない口が開く。

### 3. SSH-B の鍵（② で作成 → ① に登録）

**② VPS 上で**鍵を作り、公開鍵を **① レンタルサーバーのサーバーパネル**「SSH設定」に登録する。

```bash
mkdir -p ~/dashboard/secrets && cd ~/dashboard

# パスフレーズ無しで作る（autossh が自動で張り直すため、対話入力できない）
ssh-keygen -t ed25519 -N "" -f secrets/id_ed25519 -C "vps-analysis-api"
chmod 600 secrets/id_ed25519

cat secrets/id_ed25519.pub   # この内容を ① のサーバーパネルに登録する
```

ホスト鍵を事前に登録する。`StrictHostKeyChecking=yes` にしているため、
これが無いとトンネルが張れない。

```bash
ssh-keyscan -p 10022 <SSH_HOST> > secrets/known_hosts
```

⚠️ `StrictHostKeyChecking=no` にして省略しないこと。中間者攻撃を検知できなくなる。

手動で1度つないで、鍵で入れることを確認しておく。

```bash
ssh -i secrets/id_ed25519 -p 10022 <SSH_USER>@<SSH_HOST>
```

### 4. 環境変数

```bash
cp .env.prod.example .env.prod
vi .env.prod   # 値を埋める
chmod 600 .env.prod
```

`REMOTE_DB_HOST` は **`localhost`** を指定する。

⚠️ 直感に反するので理由を明記する。`ssh -L 3306:REMOTE_DB_HOST:3306` の
`REMOTE_DB_HOST` は **② VPS ではなく ① レンタルサーバーの内部で名前解決される**。
① の MySQL は同一サーバー上にあるため、① から見たホスト名は `localhost` になる
（① 上の `.htaccess` も `DB_HOST=localhost:3306` で動いている）。

① のサーバーパネルに「MySQLホスト名」の項目が見つからないのはこのためで、
探しても出てこないのが正常。

`DB_NAME` / `DB_USER` / `DB_PASS` は ① のサーバーパネル「MySQL設定」で確認する。

### 5. DBのマイグレーション

APIキーと監査ログのテーブルを本番DBに作る。

`ssh-tunnel` コンテナはホストにポートを公開していないため、
マイグレーションのときだけ **② VPS 上で**別途トンネルを張る。

```bash
ssh -i secrets/id_ed25519 -p 10022 -N -L 13306:<REMOTE_DB_HOST>:3306 <SSH_USER>@<SSH_HOST> &
mysql -h 127.0.0.1 -P 13306 -u <DB_USER> -p <DB_NAME> \
  < backend-express/scripts/sql/2026-08-31_analysis_api_key.sql
kill %1
```

### 6. 起動

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

`express-api` は起動時にDB疎通を確認し、失敗すると終了する。
トンネルがまだ張れていない場合はここで落ちるが、`restart: unless-stopped` により
自動で再試行するため、トンネルが安定すれば自然に立ち上がる。
ログに `DB 接続 OK` と `登録ルート N 件` が出れば成功。

### 7. 疎通確認

```bash
# 認証が要るので401が返るのが正常
curl -i https://api.khg-marketing.info/api/v1/analysis/meta

# ヘルスチェックは認証不要
curl https://api.khg-marketing.info/api/health
```

### 8. APIキーの発行

マネージャー1人につき1本発行する。使い回さないこと（誰の操作か追えなくなり、
1人分だけ止めることもできなくなる）。

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec express-api \
  node dist/cli/issueAnalysisKey.js --staff-id 1 --label "A部長 ノートPC" --days 365
```

⚠️ **キーは発行時にしか表示されない。** DBにはハッシュしか残らないので、
控え忘れたら再発行するしかない（それが正しい挙動）。
チャットやメールに貼らず、パスワード管理ツール経由で本人に渡すこと。

失効させるとき:

```sql
UPDATE analysis_api_key SET revoked_at = NOW() WHERE id = <id>;
```

---

## 運用

### 監視すべきもの

| 対象 | 確認方法 | 落ちるとどうなるか |
|---|---|---|
| SSHトンネル | `docker compose ... logs ssh-tunnel` | APIが全滅（DB接続不能） |
| 証明書の更新 | Caddy のログ | 期限切れで全リクエスト失敗 |
| APIキーの有効期限 | `analysis_api_key.expires_at` | 期限日に突然使えなくなる |

### 監査ログの確認

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

### レート制限

接続元IP単位で 120回/分、APIキー単位で 60回/分。
超えると 429 を返す。手作業の分析としては十分に余裕があるが、
MCPクライアントが暴走した場合はここで止まる。

変更するときは `backend-express/src/middlewares/analysisRateLimit.ts`。
