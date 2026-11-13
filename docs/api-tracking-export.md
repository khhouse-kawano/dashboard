# トラッキングデータ読み出し API（v2.2.266〜）

広告などの流入（着地）と、その流入から来た顧客の進み具合（反響 → 来場 → 次アポ → 契約）を、JSON で取り出す API です。読むだけで、書き込みはできません。

| | |
|---|---|
| 着地 | `GET https://api.khg-marketing.info/api/export/tracking/touches` |
| 顧客 | `GET https://api.khg-marketing.info/api/export/tracking/customers?category=order`（注文）／`category=spec`（建売） |
| 認証 | `Authorization: Bearer <鍵>` |
| 返事 | JSON（UTF-8） |

> v2.2.265 にあった `conversions`（CV）は v2.2.266 でやめました（呼ぶと `404`）。流入と成果の結びつけは、下の「5. 流入と顧客の KPI を結びつける」の方法で行ってください。

## 1. 鍵の扱い（必ず守ってください）
- 鍵は **`Authorization` ヘッダーだけ**で送ります。URL（`?key=…`）に入れても通りません。URL はサーバーやプロキシのログ、ブラウザの履歴に残るためです。
- 鍵は管理者から1人（1つのツール）に1つ渡します。他の人と使い回さないでください。
- 鍵はソースコードやリポジトリに書かず、環境変数やシークレットの管理機能（GitHub Actions の Secrets、GCP の Secret Manager など）に入れてください。
- ブラウザ（フロントエンドの JavaScript）からは呼べません（CORS を許可していません）。サーバーやスクリプトから呼んでください。
- 鍵が漏れたかもしれないときは、すぐ管理者に連絡してください。その鍵を止めて、新しい鍵を渡します。
- 1つの IP アドレスから **1分に60回まで**です（2つの API の合計）。超えると `429` になります（鍵が違う失敗も数えます）。

## 2. パラメータ
### touches（すべて省略できます）
| 名前 | 内容 | 例 |
|---|---|---|
| `from` | 着地した日時が、この日時**以上**（日本時間） | `2026-11-01` / `2026-11-01T09:00:00` |
| `to` | 着地した日時が、この日時**未満**（日本時間） | `2026-12-01` |
| `site_id` | サイトの ID で絞る | `3` |
| `brand` | ブランドで絞る | `kh` `djh` `nagomi` `fh` `2l` `pg` `jh` `khf` |
| `after_id` | この `id` より後だけを返す（続き・差分の取り込みに使う） | `120345` |
| `limit` | 1回に返す件数。省略すると **1000件**。上限はありません | `5000` |

- 日時は `YYYY-MM-DD`（その日の 0:00）か `YYYY-MM-DDTHH:MM(:SS)` で、**日本時間**として扱います。

### customers（`category` は必須）
| 名前 | 内容 | 例 |
|---|---|---|
| `category` | **必須**。`order`（注文住宅）か `spec`（建売） | `order` |
| `from` | **反響取得日**が、この日**以上** | `2026-10-01` |
| `to` | **反響取得日**が、この日**未満** | `2026-11-01` |
| `after_id` | この `id` より後だけを返す（続きを取るのに使う） | `26903` |
| `limit` | 1回に返す件数。省略すると **1000件**。上限はありません | `5000` |

- `from`・`to` は `YYYY-MM-DD`（日付だけ）です。時刻は付けられません。
- `from`・`to` を付けると、反響取得日が入っていない（読めない）顧客は返りません。全員を取りたいときは付けないでください。
- `id` は注文と建売で**別々に振られた番号**です。そのため `category` ごとに呼び、続きも `category` ごとに取ります。

### 共通
- 期間の上限はありません。ただし、とても大きな `limit` を指定すると返事が重くなります（2026-11 時点で、着地を全件取ると約13万件・約100MB・数秒〜）。通常は `limit=1000〜10000` で続きを取ってください。
- 知らないパラメータ（書き間違い。touches に `category`、customers に `site_id` など）や、同じ名前を2つ付けると `400` になります。

## 3. 返事
```json
{
  "data": [ { "id": 120346, "...": "..." } ],
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

- 値が無い項目は `null` です。

### 続きの取り方
```
1回目: ?from=2026-11-01&to=2026-12-01&limit=5000
2回目: ?from=2026-11-01&to=2026-12-01&limit=5000&after_id=<1回目の next_after_id>
… has_more が false になるまで
```
### 差分の取り込み（毎日など）
- **touches**：行は増えるだけで、後から変わりません。前回の最後の `next_after_id` を保存しておき、次は `after_id=<保存した値>` だけで呼ぶと、新しく増えた行だけが返ります。
- **customers**：**毎回全件を取り直して、置き換えてください。** 顧客は後から変わります（来場日・契約日・ステータスが後で入る／`landing_params` が反響の数日後に入ることがある／名寄せや削除で返らなくなる）。`after_id` だけの差分では、この変化を取りこぼします。件数は多くありません（2026-11 時点で数百件）。

## 4. 項目
### touches（着地。サイトに来た1回 = 1行）
| 項目 | 内容 |
|---|---|
| `id` | 行の番号（増えるだけ） |
| `created_at` | 着地した日時（`+09:00` 付きの ISO 8601） |
| `site_id` / `site_name` / `brand` | サイト |
| `visitor_id` | ブラウザごとの ID（khg_vid。同じブラウザなら同じ値）。**顧客の `visitor_id` と結びつく** |
| `source` | 流入元（utm_source → Facebook/Instagram → Google → Yahoo → Flyer の順で決めたもの）。広告のパラメータが無い訪問は `direct`・`organic/google`・`social/instagram`・`referral/<ドメイン>` |
| `gclid` `gbraid` `wbraid` | Google 広告のクリック ID |
| `fbclid` | Meta 広告のクリック ID |
| `yclid` | Yahoo! 広告のクリック ID |
| `gad_source` `gad_campaignid` | Google 広告が付けるパラメータ |
| `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` | UTM |
| `flyer` | チラシの QR などのパラメータ |
| `landing_url` | 着地したページ（`?` 以降を除く） |
| `referrer` | 直前のページ |
| `user_agent` | ブラウザ |

- 広告のパラメータ（上の `gclid`〜`flyer`）が1つも無い行は、自然検索・直接・SNS・他サイトからの訪問です。広告だけを見るときは、どれかが入っている行に絞ってください。

### customers（顧客。`landing_params` が入っている顧客だけ。1人 = 1行）
| 項目 | 内容 |
|---|---|
| `id` | 行の番号（`category` ごとに別の番号。続きを取るのに使う） |
| `customer_id` | 顧客DB の顧客 ID（26文字。社内の画面の顧客と同じ） |
| `category` | `order`（注文住宅）／`spec`（建売） |
| `store` | 担当の店舗 |
| `status` | 顧客のステータス（`見込み`・`追客中`・`契約済み`・`失注`・`重複` など。値は社内の運用で増えることがあります） |
| `promotion_medium` | 販促媒体（反響の入口。`ホームページ反響`・ポータル名など） |
| `inquiry_date` | 反響取得日 |
| `visit_date` | 初回来場日（建売は、面談と物件案内のうち早い日） |
| `next_appointment_date` | 次アポ日（第二面談） |
| `application_date` | 申込日（**建売だけ**。注文は常に `null`） |
| `contract_date` | 契約日（建売は、自社契約と仲介契約のうち早い日） |
| `visitor_id` | `landing_params` の中の `khg_vid`（ブラウザごとの ID）を取り出したもの。**touches の `visitor_id` と結びつけるのに使う**。無い・形が違うときは `null` |
| `landing_params` | 反響のときにブラウザが覚えていた流入の情報（URL の `?` 以降の形の文字列。例 `utm_source=google&utm_campaign=xxx&gclid=xxx&khg_vid=xxxxxxxx-…`） |

- 日付はすべて `YYYY-MM-DD`（日本の日付。時刻はありません）。入っていなければ `null` です。
- 氏名・電話・メール・住所などの個人情報は返しません。
- 名寄せで1人にまとめた顧客（まとめられた側）と、個人情報の削除で削除済みにした顧客は返りません。
- `status` が `重複` の顧客は返ります。数えるときは除いてください（社内の集計も除いています）。
- まれに、入力ミスの日付（`0024-…` のような年）が入っています。集計では 2015 年より前の日付を無視するのが安全です。

## 5. 流入と顧客の KPI を結びつける
「どの広告・キャンペーンから来た人が、反響 → 来場 → 次アポ → 契約まで進んだか」は、次の手順で出します。

### 5-1. 考え方
1. ブラウザには、サイトに来た時点で ID（`khg_vid`）が振られます。そのブラウザでの着地はすべて、touches に同じ `visitor_id` で記録されます。
2. そのブラウザから反響（問い合わせ・来場予約など）があると、顧客の `landing_params` に同じ `khg_vid` が入ります（入る条件は 5-4）。
3. だから **touches の `visitor_id` ＝ customers の `visitor_id`** で結べば、その顧客が反響までにどんな流入を経てきたかが分かります。
4. 顧客の工程（来場・次アポ・契約）の日付が入っているかで、どこまで進んだかを数えます。

### 5-2. 手順
1. touches を取る（初回は全件。以後は `after_id` で差分）。
2. customers を `category=order` と `category=spec` の両方、全件取る（毎回置き換え）。顧客は **`category` と `id` の組**で1人を表します（`id` だけでは注文と建売がぶつかります）。
3. `status = '重複'` の顧客と、`visitor_id` が `null` の顧客を除く。
4. 顧客ごとに、同じ `visitor_id` の touches のうち、**反響取得日の終わり（その日の 23:59:59 日本時間）までの着地**を集める。反響の後の着地は、反響のきっかけではないので除きます。`inquiry_date` が `null` の顧客は日付で切らずに使います。
5. どの着地を「その顧客の流入」とするか決める（アトリビューション）。
   - **最初の着地（ファーストタッチ）**：最初に何で知ったか。
   - **最後の広告の着地（ラストタッチ）**：反響の直前に何で戻ってきたか。`landing_params` に入っている値もこれに近い（ブラウザが最後に覚えた、パラメータ付きの着地）。
   - 社内の「業者別の歩留まり」の画面は「反響までに、その広告から一度でも来ていたか」で数えています。数字を比べるときは数え方をそろえてください。
6. 流入（`source`・`utm_campaign`・`gad_campaignid` など）ごとに、顧客の数を数える。
   - 反響：人数
   - 来場：`visit_date` が入っている人数
   - 次アポ：`next_appointment_date` が入っている人数
   - 契約：`contract_date` が入っている人数（建売は申込 `application_date` も別に数えられます）
   - 後の工程の日付だけが入っていて、前の工程の日付が空のこともあります（入力漏れ）。社内の画面に近づけるなら「後の工程に進んだ人は、前の工程も通った」として数えてください。

### 5-3. 例
#### SQL（BigQuery などに touches・customers をそのまま入れた場合）
```sql
-- 顧客（重複と、ビジターIDの無い人を除く）
WITH c AS (
  SELECT category, id, visitor_id, inquiry_date, visit_date, next_appointment_date, contract_date
  FROM customers
  WHERE visitor_id IS NOT NULL AND (status IS NULL OR status <> '重複')
),
-- 顧客ごとの、反響の日までの着地（広告のパラメータがあるものだけ）。古い順に番号
j AS (
  SELECT c.*, t.source, t.utm_campaign, t.gad_campaignid, t.created_at AS touched_at,
         ROW_NUMBER() OVER (PARTITION BY c.category, c.id ORDER BY t.created_at) AS n
  FROM c
  JOIN touches t
    ON t.visitor_id = c.visitor_id
   AND (c.inquiry_date IS NULL
        OR t.created_at < TIMESTAMP_ADD(TIMESTAMP(c.inquiry_date, 'Asia/Tokyo'), INTERVAL 1 DAY))
  WHERE COALESCE(t.gclid, t.gbraid, t.wbraid, t.fbclid, t.yclid, t.gad_source, t.gad_campaignid,
                 t.utm_source, t.utm_medium, t.utm_campaign, t.utm_term, t.utm_content, t.flyer) IS NOT NULL
)
-- 最初の広告の着地（ファーストタッチ）で集計
SELECT source, utm_campaign,
       COUNT(*)                         AS inquiries,
       COUNTIF(visit_date IS NOT NULL OR next_appointment_date IS NOT NULL OR contract_date IS NOT NULL) AS visits,
       COUNTIF(next_appointment_date IS NOT NULL OR contract_date IS NOT NULL)                          AS next_appointments,
       COUNTIF(contract_date IS NOT NULL) AS contracts
FROM j
WHERE n = 1          -- ラストタッチにするなら ORDER BY t.created_at DESC にして n = 1
GROUP BY source, utm_campaign
ORDER BY inquiries DESC;
```
- touches の `created_at` は `+09:00` 付きの文字列です。取り込むときにタイムスタンプ型に直してください。

#### Python（pandas）
```python
import os, requests, pandas as pd

BASE = 'https://api.khg-marketing.info/api/export/tracking'
HEADERS = {'Authorization': f"Bearer {os.environ['KHG_TRACKING_KEY']}"}

def fetch(path, **params):
    rows, after_id = [], 0
    while True:
        r = requests.get(f'{BASE}/{path}', headers=HEADERS,
                         params={**params, 'after_id': after_id, 'limit': 5000}, timeout=120)
        r.raise_for_status()
        body = r.json()
        rows += body['data']
        after_id = body['next_after_id']
        if not body['has_more']:
            return pd.DataFrame(rows)

touches = fetch('touches')
customers = pd.concat([fetch('customers', category='order'),
                       fetch('customers', category='spec')], ignore_index=True)

touches['created_at'] = pd.to_datetime(touches['created_at'])            # +09:00 付き
ad_cols = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid', 'gad_source', 'gad_campaignid',
           'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer']
ads = touches[touches[ad_cols].notna().any(axis=1)]                      # 広告の着地だけ

c = customers[customers['visitor_id'].notna() & (customers['status'] != '重複')].copy()
# 反響取得日の終わり（日本時間）。日付が無い人は切らない
c['inquiry_end'] = (pd.to_datetime(c['inquiry_date'], errors='coerce')
                    + pd.Timedelta(days=1)).dt.tz_localize('Asia/Tokyo')

j = c.merge(ads, on='visitor_id', suffixes=('', '_t'))
j = j[j['inquiry_end'].isna() | (j['created_at'] < j['inquiry_end'])]
# ファーストタッチ（顧客ごとに最も古い着地の1行。ラストタッチなら keep='last'）
first = j.sort_values('created_at').drop_duplicates(['category', 'id'], keep='first')

reached = lambda *cols: first[list(cols)].notna().any(axis=1)
first['visit'] = reached('visit_date', 'next_appointment_date', 'contract_date')
first['next'] = reached('next_appointment_date', 'contract_date')
first['contract'] = first['contract_date'].notna()

kpi = (first.groupby(['source', 'utm_campaign'], dropna=False)
       .agg(inquiries=('id', 'size'), visits=('visit', 'sum'),
            next_appointments=('next', 'sum'), contracts=('contract', 'sum'))
       .sort_values('inquiries', ascending=False))
print(kpi)
```

#### touches を使わずに見る（簡易）
顧客の `landing_params` には、反響のときブラウザが最後に覚えていた広告のパラメータ（`utm_campaign`・`gclid` など）が入っています。URL のクエリとして読めば（Python なら `urllib.parse.parse_qs`）、touches と結ばなくてもラストタッチに近い集計ができます。

### 5-4. 注意（結びつかない顧客がいる理由）
- **`landing_params`（と `visitor_id`）が入るのは、自社サイトから反響した顧客だけです。**
  - 自社のフォームから送った反響：送ったときにそのまま入ります。
  - 自社のフォームでないサイト（建売のサイトなど）の反響：サイトの送信（cv.js が記録）と、社内に届いた反響を、メール・電話で後から突き合わせて入れます（5分おき。送信から15日以内）。**反響の直後はまだ空で、数分〜数日後に入ることがあります。**
  - 突き合わせができなかった反響（メール・電話が送信と違う、確認画面で止めたなど）には入りません。
  - **ポータル（SUUMO など）・電話・来場・紹介などの反響には入りません。** この API の顧客は全顧客の一部です。広告の成果を「全反響に対する割合」で見るときは注意してください。
- **ビジター ID はブラウザごと**です。同じ人でもスマホとパソコン、別のブラウザ、シークレットウィンドウ、閲覧データの削除のあとは別の ID になります。広告をスマホで見て、後でパソコンから問い合わせた人は結びつきません。
  - 自社サイトどうしのリンクで移った場合は、同じ ID を引き継ぎます。
- ID を振る仕組み（tracker.js）をサイトに入れる前の着地は、touches にありません（2026-10-20 ごろから）。それより前に反響した顧客は、`landing_params` があっても touches と結びつかないことがあります。
- 1つの `visitor_id` に複数の顧客が結びつくことがあります（家族で同じ端末を使う、注文と建売の両方に問い合わせたなど）。
- 工程の日付は、店舗の担当者が入力します。入力が遅れることがあるので、直近の月の来場・契約は少なめに出ます。
- 顧客の `status` や工程の日付は後から変わります。集計は毎回取り直したデータで行ってください（3. の差分の取り込みを参照）。

## 6. エラー
| 状態 | `error` | いつ |
|---|---|---|
| 400 | `bad_request` | パラメータの形が違う・`category` が無い（`message` に理由） |
| 401 | `unauthorized` | 鍵が無い・違う |
| 404 | — | パスの間違い（`conversions` を含む）、GET 以外のメソッド |
| 429 | `too_many_requests` | 1分に60回を超えた |
| 500 | `internal_error` | サーバー側の失敗（時間をおいてもう一度） |

## 7. 例（curl）
```bash
# 環境変数に鍵を入れておく（シェルの履歴に鍵を残さない）
export KHG_TRACKING_KEY='（渡された鍵）'

curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" \
  'https://api.khg-marketing.info/api/export/tracking/touches?from=2026-11-01&to=2026-11-02&limit=1000'

curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" \
  'https://api.khg-marketing.info/api/export/tracking/customers?category=order&limit=1000'
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
- **誰が使ったか**：② のログに、呼ばれるたびに `tracking export: customers key=<鍵の目印8文字> ip=… category=order … rows=…` が出ます（鍵そのものは出ません）。目印は次で調べられます：`printf '%s' '<鍵>' | sha256sum | cut -c1-8`
  ```bash
  dcp logs --since 24h express-api | grep "tracking export"
  ```
