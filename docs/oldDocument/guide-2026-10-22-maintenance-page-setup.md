# メンテナンス案内ページの設置手順（5ブランドのサイト）

PHP の脆弱性の公表を受けて、各ブランドのサイトを一時的に止め、案内ページだけを表示する手順です。

## 対象と用意したファイル
置き場所: `C:\Users\shinji-kawano\Downloads\maintenance\`

| フォルダ | サイト |
|---|---|
| `kh` | https://kh-house.jp/ |
| `djh` | https://day-just-house.com/ |
| `nagomi` | https://www.nagomi-koumuten.jp/ |
| `2l` | https://2lhome.net/ |
| `jusfy` | https://jusfy-home.com/ |

各フォルダには次の2つが入っています。
- `maintenance.html`：案内ページです。ロゴはファイルの中に埋め込んであるので、1ファイルだけで表示できます。
- `htaccess.txt`：`.htaccess` に貼る記述です。5サイトとも同じ内容です。

案内の文面は、かえるホーム（https://www.kaeruhome.jp/）と同じです。

## 仕組み
- どのアドレスへのアクセスにも「503（一時的に停止中）」を返し、本文として `maintenance.html` を見せます。
- PHP（WordPress）は**一度も動きません**。管理画面・フォーム・画像も含めて、すべて止まります。
- 503 は検索エンジンに「一時停止」と伝わるので、検索順位への影響を抑えられます。`Retry-After` で「1日後にまた来て」と伝えています。

## 手順（1サイトずつ）
### 1. 今の `.htaccess` を手元に保存する
FTP（またはサーバーのファイルマネージャー）でサイトのいちばん上のフォルダ（`index.php` や `wp-config.php` がある場所）を開きます。そこにある `.htaccess` を手元にダウンロードしておきます。

> 注意：`.htaccess` は隠しファイルです。表示されないときは、FTP ソフトの設定で「隠しファイルを表示」をオンにしてください。

### 2. `maintenance.html` を置く
1 と同じフォルダに、そのブランドの `maintenance.html` をアップロードします。

ブラウザで `https://<ドメイン>/maintenance.html` を開き、ロゴと文面が出ることを確かめます（この時点ではまだサイトは止まっていません）。

### 3. `.htaccess` の**いちばん上**に貼る
サーバー上の `.htaccess` を開き、`htaccess.txt` の中身を**先頭**（`# BEGIN WordPress` より上）に貼って保存します。

```apache
# ===== メンテナンス（ここから）=====
# ⚠️ 既存の .htaccess の「いちばん上」（# BEGIN WordPress より前）に貼る。戻すときはこの塊を消す
ErrorDocument 503 /maintenance.html
<IfModule mod_rewrite.c>
RewriteEngine On
# 社内から確認するときは、次の行の先頭の # を外して IP を入れる
# RewriteCond %{REMOTE_ADDR} !^000\.000\.000\.000$
RewriteCond %{REQUEST_URI} !^/maintenance\.html$
RewriteRule ^ - [R=503,L]
</IfModule>
<IfModule mod_headers.c>
Header always set Retry-After "86400"
<Files "maintenance.html">
Header always set Cache-Control "no-store"
</Files>
</IfModule>
# ===== メンテナンス（ここまで）=====
```

> 注意：WordPress の塊（`# BEGIN WordPress`〜`# END WordPress`）より下に貼ると、WordPress が先に動いてしまいます。必ず上に貼ってください。

### 4. サブフォルダの `.htaccess` を確かめる（⚠️ デイジャストハウスは必須）
サブフォルダに `RewriteEngine On` を含む `.htaccess` があると、**そのフォルダの中だけは手順3の記述が効きません**（Apache の決まりです）。
- デイジャストハウスは WordPress が `/wp/` に入っているので、`/wp/.htaccess` があれば同じ塊をその先頭にも貼ってください。
- ほかのサイトも、`.htaccess` を持つサブフォルダがあれば同じようにします。

### 5. 止まったことを確かめる
スマホ（Wi-Fi を切った状態）か、ふだん使わないブラウザで、次のアドレスを開きます。すべて案内ページになれば完了です。
- `https://<ドメイン>/`
- `https://<ドメイン>/wp-admin/`（デイジャストハウスは `/wp/wp-admin/`）
- 適当な下のページ（例：`https://<ドメイン>/event/`）

> 注意：真っ白な画面や「500 Internal Server Error」が出たときは、貼った位置か内容の誤りです。手順1で保存した `.htaccess` に戻してから、もう一度やり直してください。

## 社内からだけサイトを見たいとき
`# RewriteCond %{REMOTE_ADDR} ...` の行の先頭の `#` を外し、`000\.000\.000\.000` を会社の固定 IP（点の前に `\` を付ける）に書き換えます。その IP からは通常どおりサイトが見えます。

> 要確認：この行は、ローカルの試験ではまだ動作を確かめていません。使うときは、社外の回線（スマホのモバイル通信など）で案内ページが出続けることも確かめてください。

## 再開するとき
1. `.htaccess` から「メンテナンス（ここから）」〜「（ここまで）」の塊を消します（手順4で貼ったサブフォルダの分も消します）。
2. `maintenance.html` は残しておいても害はありません。次に止めるときにも使えます。
3. サイトのトップと、問い合わせフォームが動くことを確かめます。

## ローカルで確かめたこと
Apache（php:8.3-apache）に、WordPress と同じ `.htaccess` の構成で試しました。
- `/`・`/index.php`・`/wp-admin/`・画像・`/?p=1` → すべて 503 で案内ページ。PHP は動かない。
- `/maintenance.html` → 200 で案内ページ。
- `Retry-After: 86400`・`Cache-Control: no-store` が付く。
- 5ページとも、PC（1366px）とスマホ（390px）の幅で表示を確かめました。横にはみ出しません。
