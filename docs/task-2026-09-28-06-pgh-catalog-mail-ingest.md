# 2026-09-28 (6) 【PG HOUSE九州】資料請求メールの取り込み

⚠️ ⚠️ **このタスクは v2.2.150 とは別物**（⚠️ フロントは触っていない）。

## 依頼（`ReadMeClaude.md` と、その後のやりとり）

- ⚠️ **GASファイル作成** — 下記のメールを取得してテーブルに保存する

```
件名 : 【PG HOUSE九州】資料請求がありました。
from : no-reply@kyusyu.pg-house.jp

お名前：中島健太
ふりがな：なかしまけんた
郵便番号：8994301
住所：鹿児島県 霧島市国分重久1063-1-201
ご連絡先電話番号：08064508761
連絡可能時間：08064508761
メールアドレス：ken.chelcea@icloud.com
ご質問等：
お申込のきっかけを選択してください：Youtube
ご紹介者のお名前：
その他の内容：
問い合わせのページURL：https://kyusyu.pg-house.jp/contact/
```

- ⚠️ 保存テーブルは `inquiry_customer` ／ ⚠️ ブランドは `PGH` ／ ⚠️ 店舗は `PGH店舗未設定`
- ⚠️ 追記: ⚠️ **`medium` はホームページ反響とする**
- ⚠️ 追記: ⚠️ **GASファイルは作ってもらえれば自分で貼り付ける**
- ⚠️⚠️ **訂正: 「Express を `C:\Users\shinji-kawano\projects\sync` に構築」は誤り。**
  ⚠️ ⚠️ **DB登録は Dashboard プロジェクト内から行う。**

## オーナー判断

| 論点 | 回答 |
|---|---|
| 区切りの無い氏名・ふりがな | ⚠️⚠️ **全体を `first_name` へ**（⚠️ `last_name` は空） |
| 反響媒体 | ⚠️ **「お申込のきっかけ」を `response_medium` に使う** |
| `medium` | ⚠️ **「ホームページ反響」で固定** |
| ⚠️ 置き場所 | ⚠️⚠️ **Dashboard 内**（⚠️ `projects/sync` は使わない） |

---

## ⚠️ 経緯（⚠️ **一度作って戻した**）

⚠️ 当初「`projects/sync` に Express を構築」という指示だったため、⚠️ そちらに
route / controller / service と GAS を作った。⚠️⚠️ **その後「誤り」との訂正があり、全て取り消した。**

⚠️ 取り消したもの（⚠️ **いずれも未コミットだったため痕跡は残っていない**）:

```
projects/sync/gas/runPghCatalog.gs               … 削除
projects/sync/src/services/runPghCatalog.ts      … 削除
projects/sync/src/controllers/pghCatalogController.ts … 削除
projects/sync/src/routes/pghCatalogRoutes.ts     … 削除
projects/sync/src/app.ts                         … git checkout で復元
```

⚠️ ⚠️ **`projects/sync` に元からあった変更（`runCompetitorPlaces` 等）には触れていない。**

⚠️ この寄り道で分かったこと（⚠️ **今後の判断材料として残す**）:

| # | |
|---|---|
| 1 | ⚠️ `projects\sync` は ⚠️ **既存の大きな Express + TS プロジェクト**。⚠️ 新規の空フォルダではない |
| 2 | ⚠️⚠️ **MySQL ドライバを持っていない。** ⚠️ 書き込みは全部 `postGateway()` で ① 経由 |
| 3 | ⚠️ `runPGMail.ts` は ⚠️ **資料請求の「お礼メールを送る側」**。⚠️ 取り込みとは別物 |

---

## ⚠️ 調べて分かったこと

### ⚠️ 1. 参照GASとは本文の書式が違う

| | 参照GAS（catalog_resale） | ⚠️ **今回** |
|---|---|---|
| 書式 | `【お名前】` → ⚠️ **次の行が値** | ⚠️⚠️ **`お名前：中島健太`（同じ行・全角コロン）** |

⚠️ ⚠️ **抽出ロジックは流用できず、コロンで割る形に書き直した。**

### ⚠️⚠️ 2. `inquiry_customer` に `inquiry_id` の一意キーが無い

```
PRIMARY         id
idx_ic_pg_id    pg_id           （非ユニーク）
idx_ic_response response_medium （非ユニーク）
```

⚠️⚠️ **`INSERT IGNORE` では重複を防げない。**
⚠️ 既存のポータル取り込みは `portalInsertNewOnly()`（⚠️ **鍵を SELECT してから入れる**）で防いでいる。⚠️ **今回もこれを通す。**

### ⚠️ 3. 反響日はスラッシュ区切りでないと画面に出ない

⚠️ メニューの未同期バッジは `SUBSTRING(inquiry_date, 1, 7)` を `'2025/06'` と比べている
（`backend-express/src/features/menu.ts`）。
⚠️⚠️ **ハイフンで入れるとバッジにも「要確認」にも出てこない。**

---

## 構成

```
Gmail ─(GAS)→ ① https://khg-marketing.info/dashboard/api/gateway/
             → backend/src/handlers/pgh_order.php
             → inquiry_customer
```

⚠️ ⚠️ **既存の GAS（catalog_resale）とまったく同じ入口**である。

---

## 追加したファイル

### ⚠️ 1. `backend/scripts/gas/runPghCatalog.gs`（新規・⚠️ **利用者が貼り付ける**）

⚠️⚠️ **書き換えるところはない。** ⚠️ 送り先は既存の入口と同じ。

```js
/**
 * ⚠️ 送信先。
 *   ⚠️ 既存の GAS（catalog_resale）と**同じ入口**である。
 *   ⚠️ ⚠️ **書き換える必要はない。**
 */
const PGH_CATALOG_API_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
```

⚠️ 拾う項目（⚠️ **左がメール本文の見出し**）:

```js
const PGH_CATALOG_FIELDS = {
  'お名前': 'name',
  'ふりがな': 'kana',
  'フリガナ': 'kana',            // ⚠️ 表記ゆれ対策
  '郵便番号': 'zip',
  '住所': 'address',
  'ご連絡先電話番号': 'tel',
  '連絡可能時間': 'contactTime',
  'メールアドレス': 'email',
  'ご質問等': 'question',
  'お申込のきっかけを選択してください': 'trigger',
  'ご紹介者のお名前': 'introducer',
  'その他の内容': 'other',
  '問い合わせのページURL': 'pageUrl'
};
```

⚠️ 抽出（⚠️ **全角・半角どちらのコロンも受ける**。⚠️ **見出しに無い行は直前の項目の続き**）:

```js
function extractPghCatalogData(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const result = {};
  Object.keys(PGH_CATALOG_FIELDS).forEach(function (label) {
    result[PGH_CATALOG_FIELDS[label]] = '';
  });

  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // ⚠️ 署名や区切り線が来たら打ち切る
    if (trimmed.indexOf('--') === 0 || trimmed.indexOf('個人情報') === 0) break;

    const matched = trimmed.match(/^([^：:]+)\s*[：:]\s*(.*)$/);

    if (matched) {
      const label = matched[1].trim();
      const key = PGH_CATALOG_FIELDS[label];

      if (key) {
        currentKey = key;
        result[key] = matched[2].trim();
        continue;
      }
      // ⚠️ 見出しに無い `xxx：yyy` は、直前の項目の続きとして扱う
    }

    if (currentKey && trimmed !== '') {
      result[currentKey] = result[currentKey] ? result[currentKey] + '\n' + trimmed : trimmed;
    }
  }

  // ⚠️ 郵便番号に 〒 やハイフンが混ざることがある。数字だけにして渡す
  if (result.zip) result.zip = result.zip.replace(/[〒\-ー－\s]/g, '').trim();

  return result;
}
```

⚠️ 送信（⚠️⚠️ **`{ request, data: [...] }` の形が必須**）:

```js
/**
 * ⚠️⚠️ **`{ request, data: [...] }` の形にすること。**
 *   ⚠️ 受け側の `portalReadBulkPayload()` がこの2つを見ている。
 *   ⚠️ ⚠️ **形が違うと 400 で弾かれる。**
 */
function postPghCatalog(rows) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ request: 'pgh_order', data: rows }),
    muteHttpExceptions: true
  };
  ...
}
```

⚠️ メイン（⚠️ **トリガーはこれを指定する**。⚠️ **まとめて1回で送る**）:

```js
function runPghCatalog() {
  // ⚠️ 1日以内。⚠️⚠️ **重複は受け側が messageId で弾く**ので、既読判定はしない
  const query = 'from:no-reply@kyusyu.pg-house.jp subject:"資料請求" newer_than:1d';
  ...
      // ⚠️ 氏名が取れないものは送らない。⚠️ **誰のことか分からない行を作らない**
      if (!extracted.name) {
        Logger.log('お名前が取れなかったためスキップ: ' + msg.getId());
        continue;
      }

      rows.push({
        ...extracted,
        registered: registered,
        // ⚠️⚠️ **重複排除の鍵。** ⚠️ 受け側が inquiry_id に使う
        messageId: msg.getId(),
        // ⚠️ 取りこぼしても後から読めるよう、本文をそのまま添える
        remarks: body
      });
  ...
  postPghCatalog(rows);
}
```

### ⚠️ 2. `backend/src/handlers/pgh_order.php`（新規）

⚠️⚠️ **値の組み立ては全部ここ。** ⚠️ GAS は割って送るだけ。

```php
/** ⚠️ ブランドと店舗は固定（利用者の指示。2026-09-28） */
const PGH_BRAND = 'PGH';
const PGH_SHOP  = 'PGH店舗未設定';

/**
 * ⚠️ 媒体。
 *   ⚠️ `medium` は ⚠️ **「ホームページ反響」で固定**（利用者の指示）。
 *   ⚠️ `response_medium` は ⚠️ **「お申込のきっかけ」をそのまま**入れる。
 *     ⚠️⚠️ **medium_list に無い値が入りうる。** その場合は販促媒体別の集計から漏れる。
 *     ⚠️ 新しい値が出てきたら medium_list に足すこと。
 */
const PGH_MEDIUM      = 'ホームページ反響';
const PGH_HP_CAMPAIGN = '資料請求';
```

**追加した関数**

```php
/**
 * ひらがなをカタカナに直す。
 *
 * ⚠️⚠️ **frontend/src/utils/nexusUtils.ts の hiraToKata と同じ挙動にしてある。**
 *   ⚠️ v2.2.149 で「フリガナはカタカナ」に揃えたので、⚠️ **入口でも合わせる。**
 *   ⚠️ ⚠️ **ここでひらがなのまま入れると、Nexus へ移行できない顧客が増える。**
 *
 * ⚠️ `mb_convert_kana($s, 'C')` は**ひらがな→カタカナ**の変換。
 *   ⚠️ 繰り返し記号（ゝ ゞ）も併せて直す（⚠️ `C` では変わらない）。
 */
function pghHiraToKata(string $value): string
{
    $converted = mb_convert_kana($value, 'C', 'UTF-8');
    return str_replace(['ゝ', 'ゞ'], ['ヽ', 'ヾ'], $converted);
}

/**
 * 反響日。
 *
 * ⚠️⚠️ **`YYYY/MM/DD` のスラッシュ区切りにすること。**
 *   ⚠️ メニューの未同期バッジは `SUBSTRING(inquiry_date, 1, 7)` を
 *     `'2025/06'` と比べている（backend-express/src/features/menu.ts）。
 *   ⚠️ ⚠️ **ハイフンで入れるとバッジにも「要確認」にも出てこない。**
 */
function pghInquiryDate(string $registered): string
{
    $head = str_replace('-', '/', substr(trim($registered), 0, 10));
    return preg_match('#^\d{4}/\d{2}/\d{2}$#', $head) === 1 ? $head : '';
}

/**
 * 住所を都道府県とそれ以降に割る。
 *
 * ⚠️ 見本は `鹿児島県 霧島市国分重久1063-1-201`（⚠️ **県のあとに空白**）。
 * ⚠️⚠️ **市区町村までは割らない。** 表記が安定せず、誤って割ると住所が壊れる。
 *   ⚠️ 既存の townlife / catalog も同じ判断で building にまとめている。
 *
 * @return array{0:string,1:string} [pref, building]
 */
function pghSplitAddress(string $address): array
{
    $text = trim(preg_replace('/\s+/u', ' ', $address) ?? '');

    foreach (PGH_PREFECTURES as $pref) {
        if (mb_strpos($text, $pref) === 0) {
            return [$pref, trim(mb_substr($text, mb_strlen($pref)))];
        }
    }
    return ['', $text];
}

/**
 * 電話番号。
 *
 * ⚠️ 既存の取り込み（townlife など）に合わせて ⚠️ **`mobile` に入れる。**
 *   ⚠️ 固定電話か携帯かはメール本文から判別できない。
 * ⚠️ 全角数字やハイフンが混ざることがあるので、⚠️ **数字だけにする。**
 */
function pghTel(string $tel): string
{
    $halfWidth = mb_convert_kana($tel, 'n', 'UTF-8');
    return preg_replace('/\D/', '', $halfWidth) ?? '';
}

/**
 * GAS から届いた1通ぶんを `inquiry_customer` の形に直す。
 *
 * ⚠️⚠️ **氏名は分割しない**（利用者の判断。2026-09-28）。
 *   ⚠️ 本文が `中島健太` のように**区切りを持たない**ため、姓名を推測すると誤る。
 *   ⚠️ ⚠️ **まるごと `first_name` に入れ、`last_name` は空にする。**
 *   ⚠️ 既存の資料請求（catalog_resale）も同じ扱いにしてある。
 *   ⚠️ ⚠️ **同期するときに人が直す前提。**
 *
 * @return array<string,string>|null 鍵か氏名が無ければ null
 */
function pghToInquiry(array $row): ?array
{
    $messageId = trim((string)($row['messageId'] ?? ''));
    $name      = trim((string)($row['name'] ?? ''));

    // ⚠️ 鍵と氏名が無いものは作らない。⚠️ **誰のことか分からない行を増やさない**
    if ($messageId === '' || $name === '') {
        return null;
    }

    [$pref, $building] = pghSplitAddress((string)($row['address'] ?? ''));
    $trigger = trim((string)($row['trigger'] ?? ''));

    return [
        // ⚠️ 接頭辞を付けて他の媒体と衝突させない（例: townlife は 'townlife' + id）
        'inquiry_id'      => 'pgh_hp_' . $messageId,
        'inquiry_date'    => pghInquiryDate((string)($row['registered'] ?? '')),
        'medium'          => PGH_MEDIUM,
        'response_medium' => $trigger !== '' ? $trigger : PGH_MEDIUM,
        'first_name'      => $name,
        'last_name'       => '',
        'first_name_kana' => pghHiraToKata(trim((string)($row['kana'] ?? ''))),
        'last_name_kana'  => '',
        'mobile'          => pghTel((string)($row['tel'] ?? '')),
        'mail'            => trim((string)($row['email'] ?? '')),
        'zip'             => trim((string)($row['zip'] ?? '')),
        'pref'            => $pref,
        'building'        => $building,
        'brand'           => PGH_BRAND,
        'shop'            => PGH_SHOP,
        'hp_campaign'     => PGH_HP_CAMPAIGN,
        // ⚠️ 本文まるごと。⚠️ 連絡可能時間・ご質問等・紹介者はここから読める
        'remarks'         => trim((string)($row['remarks'] ?? '')),
    ];
}
```

**本体**

```php
$rows = portalReadBulkPayload('pgh_order');

foreach (array_chunk($rows, $batchSize) as $chunk) {
    $inquiryRows = [];

    foreach ($chunk as $row) {
        if (!is_array($row)) { continue; }
        $inquiry = pghToInquiry($row);
        if ($inquiry === null) { continue; }
        // ⚠️ NOT NULL の列があるため、空文字のまま入れる（null にしない）
        $inquiryRows[] = portalNormalizeRow($inquiry, false);
    }
    ...
        $res = portalInsertNewOnly($pdo, 'inquiry_customer', $inquiryRows, 'inquiry_id');
    ...
}
```

⚠️⚠️ **`pghToInquiry()` が作る列しか入らない。** ⚠️ **GAS が余計な値を送っても無視される**
（⚠️ 実測で `sync:1` `delete_flag:1` を送っても 0 のままだった）。

⚠️ ⚠️ **`express_proxy.php` には足していない。** ⚠️ **書き込みなので ② へ転送してはいけない**（⚠️ 自動フォールバックで二重に走る）。

---

## 確認したこと（ローカル）

⚠️ ⚠️ **GAS が送る形（`{request, data:[...]}`）そのままで通した。**

| | |
|---|---|
| ⚠️ **1回目** | ⚠️ **`inserted:1 / skipped:0`** |
| ⚠️⚠️ **2回目（同じ内容）** | ⚠️⚠️ **`inserted:0 / skipped:1`**（重複排除） |
| ⚠️ **氏名なしの行** | ⚠️⚠️ **捨てられた**（2行送って1行だけ入った） |
| ⚠️⚠️ **余計な列** | ⚠️⚠️ **`sync:1` `delete_flag:1` を送っても 0 のまま** |
| ⚠️ 郵便番号 `〒899-4301` | ⚠️ **`8994301`** |
| ⚠️ 電話 `080-6450-8761` | ⚠️ **`08064508761`** |
| ⚠️ ふりがな | ⚠️⚠️ **`なかしまけんた` → `ナカシマケンタ`** |
| ⚠️ 後片付け | ⚠️ **試した行はローカルDBから削除済み** |

⚠️ 入った行:

```json
{
    "inquiry_id": "pgh_hp_TESTMSG0002",
    "inquiry_date": "2026/09/28",
    "medium": "ホームページ反響",
    "response_medium": "Youtube",
    "first_name": "中島健太",
    "first_name_kana": "ナカシマケンタ",
    "mobile": "08064508761",
    "zip": "8994301",
    "pref": "鹿児島県",
    "building": "霧島市国分重久1063-1-201",
    "brand": "PGH",
    "shop": "PGH店舗未設定",
    "hp_campaign": "資料請求",
    "sync": 0,
    "delete_flag": 0
}
```

---

## ⚠️ まだ終わっていないこと

| # | |
|---|---|
| 1 | ⚠️ **`pgh_order.php` を ① へアップロード** |
| 2 | ⚠️ **GAS を Apps Script に貼り、トリガーを設定**（⚠️ **書き換えるところは無い**） |
| 3 | ⚠️ 本番のメールで1通、⚠️ **反響一覧に出ることを確認** |

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`inquiry_date` は `YYYY/MM/DD`。** ⚠️ ハイフンにすると **バッジにも要確認にも出ない** |
| 2 | ⚠️⚠️ **`inquiry_customer` に一意キーが無い。** ⚠️ **必ず `portalInsertNewOnly()` を通すこと** |
| 3 | ⚠️⚠️ **`pgh_order` を `express_proxy.php` に足さないこと**（⚠️ 書き込みが二重に走る） |
| 4 | ⚠️ 列を増やすときは ⚠️ **`pghToInquiry()` を直す**（⚠️ **ここに無い列は入らない**） |
| 5 | ⚠️ `response_medium` に ⚠️ **`medium_list` に無い値が入りうる**。⚠️ 集計から漏れるので、出てきたら足す |
| 6 | ⚠️⚠️ **氏名は分割していない。** ⚠️ Nexus（v2.2.149）の半角スペース条件は満たさない。⚠️ **同期時に人が直す前提** |
| 7 | ⚠️ 見本では ⚠️ **`連絡可能時間` に電話番号が入っていた**（⚠️ フォーム側の不具合と思われる）。⚠️ `remarks` で追える |
| 8 | ⚠️ GAS の検索は ⚠️ **`newer_than:1d`**。⚠️ **1日以上止まると取りこぼす**（⚠️ 既読判定をしていないため、広げても重複はしない） |
| 9 | ⚠️ この入口は ⚠️ **合い言葉を持たない**（⚠️ 既存の `catalog_resale_update` と同じ）。⚠️ 認証を入れるなら**既存の取り込みと一括で**行うこと |
