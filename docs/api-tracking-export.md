# トラッキングデータ読み出し API（v2.2.265〜）

広告の流入（着地）とフォーム送信（CV）の記録を、JSON で取り出す API です。読むだけで、書き込みはできません。

| | |
|---|---|
| 着地 | `GET https://api.khg-marketing.info/api/export/tracking/touches` |
| CV | `GET https://api.khg-marketing.info/api/export/tracking/conversions` |
| 認証 | `Authorization: Bearer <鍵>` |
| 返事 | JSON（UTF-8） |

## 1. 鍵の扱い（必ず守ってください）
- 鍵は **`Authorization` ヘッダーだけ**で送ります。URL（`?key=…`）に入れても通りません。URL はサーバーやプロキシのログ、ブラウザの履歴に残るためです。
- 鍵は管理者から1人（1つのツール）に1つ渡します。他の人と使い回さないでください。
- 鍵はソースコードやリポジトリに書かず、環境変数やシークレットの管理機能（GitHub Actions の Secrets、GCP の Secret Manager など）に入れてください。
- ブラウザ（フロントエンドの JavaScript）からは呼べません（CORS を許可していません）。サーバーやスクリプトから呼んでください。
- 鍵が漏れたかもしれないときは、すぐ管理者に連絡してください。その鍵を止めて、新しい鍵を渡します。
- 1つの IP アドレスから **1分に60回まで**です。超えると `429` になります（鍵が違う失敗も数えます）。

## 2. パラメータ（2つの API で共通。すべて省略できます）
| 名前 | 内容 | 例 |
|---|---|---|
| `from` | この日時**以上**（日本時間） | `2026-11-01` / `2026-11-01T09:00:00` |
| `to` | この日時**未満**（日本時間） | `2026-12-01` |
| `site_id` | サイトの ID で絞る | `3` |
| `brand` | ブランドで絞る | `kh` `djh` `nagomi` `fh` `2l` `pg` `jh` `khf` |
| `after_id` | この `id` より後だけを返す（続き・差分の取り込みに使う） | `120345` |
| `limit` | 1回に返す件数。省略すると **1000件**。上限はありません | `5000` |

- 日時は `YYYY-MM-DD`（その日の 0:00）か `YYYY-MM-DDTHH:MM(:SS)` で、**日本時間**として扱います。
- 期間の上限はありません。ただし、とても大きな `limit` を指定すると返事が重くなります（2026-11 時点で、着地を全件取ると約13万件・約100MB・数秒〜）。通常は `limit=1000〜10000` で続きを取ってください。
- 知らないパラメータ（書き間違い）や、同じ名前を2つ付けると `400` になります。

## 3. 返事
```json
{
  "data": [ { "id": 120346, "created_at": "2026-11-12T10:15:03+09:00", "...": "..." } ],
  "count": 1000,
  "next_after_id": 121345,
  "has_more": true
}
```
| 名前 | 内容 |
|---|---|
| `data` | 記録の配列。`id` の小さい順 |
| `count` | `data` の件数 |
| `next_after_id` | 続きを取るときに `after_id` へ入れる値（`data` の最後の `id`） |
| `has_more` | まだ続きがあるか |

- 日時はすべて `+09:00`（日本時間）付きの ISO 8601 です。
- 値が無い項目は `null` です。

### 続きの取り方
```
1回目: ?from=2026-11-01&to=2026-12-01&limit=5000
2回目: ?from=2026-11-01&to=2026-12-01&limit=5000&after_id=<1回目の next_after_id>
… has_more が false になるまで
```
### 差分の取り込み（毎日など）
前回の最後の `next_after_id` を保存しておき、次は `after_id=<保存した値>` だけで呼ぶと、新しく増えた行だけが返ります（`from`・`to` は不要）。

## 4. 項目
### touches（着地。広告などのパラメータ付きでサイトに来た1回 = 1行）
| 項目 | 内容 |
|---|---|
| `id` | 行の番号（増えるだけ） |
| `created_at` | 着地した日時 |
| `site_id` / `site_name` / `brand` | サイト |
| `visitor_id` | ブラウザごとの ID（khg_vid。同じブラウザなら同じ値） |
| `source` | 流入元（utm_source → Facebook/Instagram → Google → Yahoo → Flyer の順で決めたもの） |
| `gclid` `gbraid` `wbraid` | Google 広告のクリック ID |
| `fbclid` | Meta 広告のクリック ID |
| `yclid` | Yahoo! 広告のクリック ID |
| `gad_source` `gad_campaignid` | Google 広告が付けるパラメータ |
| `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` | UTM |
| `flyer` | チラシの QR などのパラメータ |
| `landing_url` | 着地したページ（`?` 以降を除く） |
| `referrer` | 直前のページ |
| `user_agent` | ブラウザ |

### conversions（自社のフォームでないサイトの CV。同じ人の同じ送信は1行にまとめる）
| 項目 | 内容 |
|---|---|
| `id` | 行の番号 |
| `created_at` | **最後に**送った日時（同じ人がもう一度送ると新しくなる） |
| `site_id` / `site_name` / `brand` | サイト |
| `visitor_id` | ブラウザごとの ID（touches の `visitor_id` と結びつく） |
| `form` | フォームの種類（ページのパスの1段目。`member`・`shop_reserve` など） |
| `email_hash` | メールアドレス（小文字・前後の空白なし）の SHA-256（16進・小文字）。無ければ `null` |
| `tel_hash` | 電話番号（数字だけ）の SHA-256。無ければ `null` |
| `landing_params` | 送ったときにブラウザが覚えていた流入の情報（文字列） |
| `page_url` | フォームのページ（`?` 以降を除く） |
| `matched` | 社内の反響と結びついたか（true / false） |
| `matched_at` | 結びついた日時 |
| `matched_inquiry_id` | 結びついた反響の ID（社内用） |

> ⚠️ `email_hash`・`tel_hash` は**個人情報として扱ってください。** 電話番号は桁数が少ないので、SHA-256 でも総当たりで元の番号に戻せます。広告媒体（Google 広告の拡張コンバージョン、Meta のコンバージョン API など）へ送る以外の目的で使ったり、保存したデータを社外に出したりしないでください。

## 5. エラー
| 状態 | `error` | いつ |
|---|---|---|
| 400 | `bad_request` | パラメータの形が違う（`message` に理由） |
| 401 | `unauthorized` | 鍵が無い・違う |
| 404 | — | パスの間違い、GET 以外のメソッド |
| 429 | `too_many_requests` | 1分に60回を超えた |
| 500 | `internal_error` | サーバー側の失敗（時間をおいてもう一度） |

## 6. 例
```bash
# 環境変数に鍵を入れておく（シェルの履歴に鍵を残さない）
export KHG_TRACKING_KEY='（渡された鍵）'

curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" \
  'https://api.khg-marketing.info/api/export/tracking/touches?from=2026-11-01&to=2026-11-02&limit=1000'
```
```python
import os, requests
URL = 'https://api.khg-marketing.info/api/export/tracking/conversions'
headers = {'Authorization': f"Bearer {os.environ['KHG_TRACKING_KEY']}"}
after_id, rows = 0, []
while True:
    r = requests.get(URL, headers=headers, params={'after_id': after_id, 'limit': 5000}, timeout=120)
    r.raise_for_status()
    body = r.json()
    rows += body['data']
    after_id = body['next_after_id']
    if not body['has_more']:
        break
```

---

## 管理者向け（鍵の発行・止め方）
鍵は ② VPS の `~/dashboard/.env.prod` の `TRACKING_EXPORT_KEYS` に、カンマ区切りで入れます。
1. 鍵を作る（64文字）：`openssl rand -hex 32`
2. `.env.prod` の `TRACKING_EXPORT_KEYS=` の後ろに足す（例 `TRACKING_EXPORT_KEYS=鍵A,鍵B`）。32文字より短い鍵は使われません。
3. 作り直す：`cd ~/dashboard && dcp up -d express-api` → `dcp ps express-api` で `Up` を確かめる
4. 鍵は、チャットやメールの本文に貼らず、パスワードの共有の仕組みなどで渡す。

- **止める**：その鍵を `.env.prod` から消して、3 と同じく作り直す。
- **入れ替える**：新しい鍵を足して作り直す → 使う側が新しい鍵に切り替える → 古い鍵を消して作り直す（止まる時間がありません）。
- **誰が使ったか**：② のログに、呼ばれるたびに `tracking export: touches key=<鍵の目印8文字> ip=… rows=…` が出ます（鍵そのものは出ません）。目印は次で調べられます：`printf '%s' '<鍵>' | sha256sum | cut -c1-8`
  ```bash
  dcp logs --since 24h express-api | grep "tracking export"
  ```
