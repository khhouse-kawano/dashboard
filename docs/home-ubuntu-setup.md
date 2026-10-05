# 自宅の開発環境（Ubuntu）の作り方

⚠️ 対象: Ubuntu 22.04 / 24.04（デスクトップ版）
⚠️ 作成: 2026-10-05（v2.2.163）

---

## ⚠️ 何がどこで動くか

| 部品 | どこで動くか | ⚠️ ホストに入れるもの |
|---|---|---|
| ① PHP 8.2 + Apache | ⚠️ Docker（`php-web`） | ⚠️ **不要** |
| ② Express（Node 22） | ⚠️ Docker（`express-api`） | ⚠️ **不要** |
| MariaDB 10.11 | ⚠️ Docker（`mariadb-db`） | ⚠️ **不要** |
| フロント（React / CRA） | ⚠️⚠️ **ホスト** | ⚠️ **Node 20**（会社と同じ 20.18.0） |

⚠️⚠️ **ホストに入れるのは Docker・Node 20・git の3つだけです。** ⚠️ PHP や MariaDB はホストに入れないこと（⚠️ ポートがぶつかる）。

---

## 手順1　基本の道具

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates gnupg unzip
```

---

## 手順2　Docker（公式リポジトリから）

⚠️ Ubuntu 標準の `docker.io` パッケージは古く、⚠️ **`docker compose`（v2）が入らないことがあります。** ⚠️ 公式から入れてください。

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

⚠️ `sudo` なしで docker を使えるようにする:

```bash
sudo usermod -aG docker "$USER"
```

⚠️⚠️ **一度ログアウトして入り直してください**（⚠️ 入り直すまで反映されません）。

確認:

```bash
docker run --rm hello-world
docker compose version
```

---

## 手順3　Node 20（nvm で会社と同じ版に合わせる）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20.18.0
nvm alias default 20.18.0
node -v   # v20.18.0
```

⚠️ `apt install nodejs` は使わないこと（⚠️ 版が合わない）。

---

## 手順4　（任意）GitHub CLI

```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] \
https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh
gh auth login
```

---

## 手順5　リポジトリと設定ファイル

```bash
mkdir -p ~/react && cd ~/react
git clone https://github.com/khhouse-kawano/dashboard.git
cd dashboard
```

⚠️⚠️ **`.env` は git に入っていません。** ⚠️ 会社のPCから**手で**持ってきてください。

| 置き場所 | |
|---|---|
| `backend/.env` | ① PHP 用 |
| `backend-express/.env` | ② Express 用 |
| `.env` / `.env.development`（リポジトリ直下） | フロント用 |

⚠️⚠️ **`.env` にはAPIキーやパスワードが入っています。**
⚠️ メール・チャット・クラウドに貼らず、⚠️ 暗号化したUSBなどで運んでください。
⚠️ ⚠️ **本番の鍵（`.env.production`）は自宅に持ち込まないこと。** ⚠️ 開発用だけでよい。

---

## 手順6　データベースの取り込み

⚠️ DBは、起動時に `docker/mariadb/init/` の SQL を**空のボリュームにだけ**取り込みます。

### ⚠️⚠️ 個人情報の扱い

⚠️ 会社の `docker/mariadb/init/01_xs200571_kawano.sql`（約1.3GB）は ⚠️⚠️ **本番のダンプそのもので、顧客の個人情報が入っています。**

⚠️ 運ぶときは ⚠️ **必ず暗号化**してください（例）:

```bash
# 会社（Git Bash）で暗号化 → パスワードを聞かれる
gpg -c --cipher-algo AES256 docker/mariadb/init/01_xs200571_kawano.sql
# → 01_xs200571_kawano.sql.gpg ができる。⚠️ こちらだけを運ぶ
```

```bash
# 自宅で復号して置く
gpg -d 01_xs200571_kawano.sql.gpg > docker/mariadb/init/01_xs200571_kawano.sql
```

### 起動（⚠️ 初回の取り込みに約5分）

```bash
cd ~/react/dashboard
docker compose up -d
docker compose ps        # mariadb-db が healthy になるまで待つ
```

---

## 手順7　⚠️⚠️ 個人情報をマスクする（取り込んだら**すぐに**）

```bash
docker cp backend/scripts/sql/dev/mask_personal_info.sql dashboard-mariadb-db-1:/tmp/mask.sql
docker exec -i dashboard-mariadb-db-1 sh -c \
  'mariadb --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" local_db \
     -e "SET @confirm_mask = '"'"'YES'"'"'; source /tmp/mask.sql;"'
```

⚠️ 最後に確認の表が出ます。⚠️⚠️ **4行とも件数が 0 なら完了です。**

⚠️ 書き換えるもの: ⚠️ 64表・261列（⚠️ 顧客の氏名・かな・メール・電話・FAX）。
⚠️ 書き換えないもの: ⚠️ スタッフ名・住所・自由記述（⚠️ 詳しくはSQLファイル冒頭）。

### ⚠️⚠️ マスク後に元のダンプを消す

⚠️ `init/` に元のダンプを残すと、⚠️ **ボリュームを作り直したときにマスク前のデータが戻ります。**
⚠️ マスク済みのDBを新しい初期データとして書き出し、元は消してください。

```bash
docker exec dashboard-mariadb-db-1 sh -c \
  'mariadb-dump --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction local_db' \
  > ~/masked_local_db.sql

shred -u docker/mariadb/init/01_xs200571_kawano.sql      # ⚠️ 元のダンプを消す（復元不能）
rm -f ~/01_xs200571_kawano.sql.gpg                        # ⚠️ 暗号化した方も
mv ~/masked_local_db.sql docker/mariadb/init/01_masked_local_db.sql
```

---

## 手順8　フロント

```bash
cd ~/react/dashboard/frontend
npm install
npm start          # ⚠️ 開発サーバー
npm run build      # ⚠️ 型の検査はこれでしか行えない（tsconfig の include が壊れているため）
```

---

## ⚠️ 安全装置について

⚠️ `mask_personal_info.sql` は ⚠️⚠️ **次の2つを満たさないと何もせずに止まります。**

1. ⚠️ 接続先のDB名が `local_db`（⚠️ 本番のDB名では止まる）
2. ⚠️ 実行前に `SET @confirm_mask = 'YES';` を打っている
   （⚠️ **会社のPCのローカルDBも `local_db`** なので、1つ目だけでは会社の開発データを消してしまう）

⚠️ 2026-10-05 に、⚠️ 4通り（確認なし／確認が違う値／別のDB／正しい実行）と ⚠️ 途中で失敗する場合を試し、⚠️ **止まるべきときはすべて止まる**ことを確認済み。
