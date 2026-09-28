# 2026-09-28 (6) 【PG HOUSE九州】資料請求メールの取り込み

⚠️ ⚠️ **このタスクは v2.2.150 とは別物**（⚠️ フロントは触っていない）。
⚠️ ⚠️ **リポジトリを2つ跨ぐ**（⚠️ `react/dashboard` と ⚠️ `projects/sync`）。

## 依頼（`ReadMeClaude.md`）

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

- ⚠️ **Express を `C:\Users\shinji-kawano\projects\sync` に構築**
- ⚠️ 保存テーブルは `inquiry_customer` ／ ⚠️ ブランドは `PGH` ／ ⚠️ 店舗は `PGH店舗未設定`
- ⚠️ 追記: ⚠️ **`medium` はホームページ反響とする**
- ⚠️ 追記: ⚠️ **GASファイルは作ってもらえれば自分で貼り付ける**

## オーナー判断

| 論点 | 回答 |
|---|---|
| 受け側の置き場所 | ⚠️ **既存の `projects\sync` に足す** |
| 区切りの無い氏名・ふりがな | ⚠️⚠️ **全体を `first_name` へ**（⚠️ `last_name` は空） |
| 反響媒体 | ⚠️ **「お申込のきっかけ」を `response_medium` に使う** |
| `medium` | ⚠️ **「ホームページ反響」で固定** |

---

## ⚠️ 調べて分かったこと

### ⚠️ 1. `projects\sync` は既存の大きなプロジェクトだった

⚠️ **新規の空フォルダではない。** ⚠️ Express + TypeScript の構成が既にある。

```
src/app.ts        … ルーティング（/api/portal, /api/mail_scraping …）
src/routes/       … Router を返すだけ
src/controllers/  … 受けて service を呼ぶだけ
src/services/     … 実処理（runSuumoOrder, runTownlifeOrder, runPGMail …）
src/utils/postGateway.ts … ① の api/gateway/ へ 500件ずつ送る
```

⚠️⚠️ **MySQL ドライバを持っていない。** ⚠️ 書き込みは ⚠️ **すべて ① 経由**である。
⚠️ ⚠️ **そのため ① 側にもハンドラが1本要る**（⚠️ 依頼には書かれていないが必須）。

⚠️ `runPGMail.ts` が既にあるが、⚠️ **あれは資料請求の「お礼メールを送る側」**で別物。

### ⚠️ 2. 参照GASとは本文の書式が違う

| | 参照GAS（catalog_resale） | ⚠️ **今回** |
|---|---|---|
| 書式 | `【お名前】` → ⚠️ **次の行が値** | ⚠️⚠️ **`お名前：中島健太`（同じ行・全角コロン）** |

⚠️ ⚠️ **抽出ロジックは流用できず、コロンで割る形に書き直した。**

### ⚠️⚠️ 3. `inquiry_customer` に `inquiry_id` の一意キーが無い

```
PRIMARY         id
idx_ic_pg_id    pg_id           （非ユニーク）
idx_ic_response response_medium （非ユニーク）
```

⚠️⚠️ **`INSERT IGNORE` では重複を防げない。**
⚠️ 既存のポータル取り込みは `portalInsertNewOnly()`（⚠️ **鍵を SELECT してから入れる**）で防いでいる。⚠️ **今回もこれを通す。**

### ⚠️ 4. 反響日はスラッシュ区切りでないと画面に出ない

⚠️ メニューの未同期バッジは `SUBSTRING(inquiry_date, 1, 7)` を `'2025/06'` と比べている
（`backend-express/src/features/menu.ts`）。
⚠️⚠️ **ハイフンで入れるとバッジにも「要確認」にも出てこない。**

---

## 追加したファイル

### ⚠️ 1. `projects/sync/gas/runPghCatalog.gs`（新規・⚠️ **利用者が貼り付ける**）

⚠️⚠️ **貼り付けたあと、先頭の2つを書き換えること。**

```js
const PGH_CATALOG_API_URL = 'https://（sync の公開URL）/api/pgh_catalog';
const PGH_CATALOG_TOKEN = '（受け側と同じ合い言葉）';
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

⚠️ メイン（⚠️ **トリガーはこれを指定する**）:

```js
function runPghCatalog() {
  // ⚠️ 1日以内。⚠️⚠️ **重複は受け側が messageId で弾く**ので、既読判定はしない
  const query = 'from:no-reply@kyusyu.pg-house.jp subject:"資料請求" newer_than:1d';
  const threads = GmailApp.search(query);
  ...
      const payload = {
        ...extracted,
        registered: registered,
        // ⚠️⚠️ **重複排除の鍵。** ⚠️ 受け側が inquiry_id に使う
        messageId: msg.getId(),
        // ⚠️ 取りこぼしても後から読めるよう、本文をそのまま添える
        remarks: body
      };

      // ⚠️ 氏名が取れないものは送らない。⚠️ **誰のことか分からない行を作らない**
      if (payload.name) { postPghCatalog(payload); }
}
```

⚠️ 送信は `X-Sync-Token` ヘッダ付き・`muteHttpExceptions: true`（⚠️ **失敗の中身をログに残すため**）。

### ⚠️ 2. `projects/sync/src/services/runPghCatalog.ts`（新規）

⚠️⚠️ **判断はここに集めた。** ⚠️ GAS は**割って送るだけ**（⚠️ 貼り替えが要るため）。

```ts
/** ⚠️ ブランドと店舗は固定（利用者の指示。2026-09-28） */
const BRAND = "PGH";
const SHOP = "PGH店舗未設定";

/**
 * ⚠️ 媒体。
 *   ⚠️ `medium` は ⚠️ **「ホームページ反響」で固定**（利用者の指示）。
 *   ⚠️ `response_medium` は ⚠️ **「お申込のきっかけ」をそのまま**入れる。
 *     ⚠️⚠️ **medium_list に無い値が入りうる。** その場合は販促媒体別の集計から漏れる。
 *     ⚠️ 新しい値が出てきたら medium_list に足すこと。
 */
const MEDIUM = "ホームページ反響";
const HP_CAMPAIGN = "資料請求";
```

⚠️ カナ変換（⚠️ **v2.2.149 の `nexusUtils.ts` と同じ実装**）:

```ts
/**
 * ⚠️⚠️ **ダッシュボードの frontend/src/utils/nexusUtils.ts と同じ実装。**
 *   ⚠️ v2.2.149 で「フリガナはカタカナ」に揃えたので、⚠️ **入口でも合わせる。**
 *   ⚠️ ⚠️ **ここでひらがなのまま入れると、Nexus へ移行できない顧客が増える。**
 * ⚠️ 繰り返し記号（ゝ ゞ）は +0x60 の範囲外なので個別に直す。
 */
const hiraToKata = (value: string): string =>
    (value ?? "").replace(/[\u3041-\u3096\u309D\u309E]/gu, (char) => {
        if (char === "\u309D") return "\u30FD";
        if (char === "\u309E") return "\u30FE";
        return String.fromCharCode(char.charCodeAt(0) + 0x60);
    });
```

⚠️ 反響日（⚠️⚠️ **スラッシュ区切り必須**）:

```ts
/**
 * ⚠️⚠️ **`YYYY/MM/DD` のスラッシュ区切りにすること。**
 *   ⚠️ メニューの未同期バッジは `SUBSTRING(inquiry_date, 1, 7)` を
 *     `'2025/06'` と比べている（backend-express/src/features/menu.ts）。
 *   ⚠️ ⚠️ **ハイフンで入れるとバッジにも「要確認」にも出てこない。**
 */
const toInquiryDate = (registered: string): string => {
    const head = (registered ?? "").trim().slice(0, 10).replace(/-/g, "/");
    return /^\d{4}\/\d{2}\/\d{2}$/.test(head) ? head : "";
};
```

⚠️ 住所（⚠️ **都道府県だけ切り出す**）:

```ts
/**
 * ⚠️ 見本は `鹿児島県 霧島市国分重久1063-1-201`（⚠️ **県のあとに空白**）。
 * ⚠️⚠️ **市区町村までは割らない。** 表記が安定せず、誤って割ると住所が壊れる。
 *   ⚠️ 既存の townlife / catalog も同じ判断で building にまとめている。
 */
const splitAddress = (address: string): { pref: string; building: string } => {
    const text = (address ?? "").replace(/\s+/gu, " ").trim();
    const pref = PREFECTURES.find((p) => text.startsWith(p)) ?? "";
    const building = pref === "" ? text : text.slice(pref.length).trim();
    return { pref, building };
};
```

⚠️ 変換の本体:

```ts
/**
 * ⚠️⚠️ **氏名は分割しない**（利用者の判断。2026-09-28）。
 *   ⚠️ 本文が `中島健太` のように**区切りを持たない**ため、姓名を推測すると誤る。
 *   ⚠️ ⚠️ **まるごと `first_name` に入れ、`last_name` は空にする。**
 *   ⚠️ 既存の資料請求（catalog_resale）も同じ扱いにしてある。
 *   ⚠️ ⚠️ **同期するときに人が直す前提。**
 */
export const toInquiryRow = (payload: PghCatalogPayload): GatewayRow | null => {
    const messageId = (payload.messageId ?? "").trim();
    const name = (payload.name ?? "").trim();

    // ⚠️ 鍵と氏名が無いものは作らない。⚠️ **誰のことか分からない行を増やさない**
    if (messageId === "" || name === "") return null;

    const { pref, building } = splitAddress(payload.address ?? "");

    return {
        // ⚠️ 接頭辞を付けて他の媒体と衝突させない（例: townlife は 'townlife' + id）
        inquiry_id: `pgh_hp_${messageId}`,
        inquiry_date: toInquiryDate(payload.registered ?? ""),
        medium: MEDIUM,
        response_medium: (payload.trigger ?? "").trim() || MEDIUM,
        first_name: name,
        last_name: "",
        first_name_kana: hiraToKata((payload.kana ?? "").trim()),
        last_name_kana: "",
        mobile: toTel(payload.tel ?? ""),
        mail: (payload.email ?? "").trim(),
        zip: (payload.zip ?? "").trim(),
        pref,
        building,
        brand: BRAND,
        shop: SHOP,
        hp_campaign: HP_CAMPAIGN,
        // ⚠️ 本文まるごと。⚠️ 連絡可能時間・ご質問等・紹介者はここから読める
        remarks: (payload.remarks ?? "").trim(),
    };
};
```

⚠️ 送信（⚠️ **配列でも受けられる**）:

```ts
export const runPghCatalog = async (
    input: PghCatalogPayload | PghCatalogPayload[]
): Promise<{ received: number; sent: number; inserted: number; errors: string[] }> => {
    const payloads = Array.isArray(input) ? input : [input];
    const rows: GatewayRow[] = [];
    for (const payload of payloads) {
        const row = toInquiryRow(payload);
        if (row === null) { console.warn("[pgh_order] messageId か お名前 が無いためスキップ"); continue; }
        rows.push(row);
    }
    if (rows.length === 0) return { received: payloads.length, sent: 0, inserted: 0, errors: [] };
    const result = await postGateway("pgh_order", rows);
    return { received: payloads.length, sent: result.total, inserted: result.inserted, errors: result.errors };
};
```

### ⚠️ 3. `projects/sync/src/controllers/pghCatalogController.ts`（新規）

⚠️⚠️ **合い言葉を必ず確かめる**（⚠️ **未設定なら素通しにせず 503**）。

```ts
        const expected = (process.env.PGH_CATALOG_TOKEN ?? "").trim();
        const given = String(req.headers["x-sync-token"] ?? "").trim();

        if (expected === "") {
            console.error("[pgh_order] PGH_CATALOG_TOKEN が未設定のため受け付けません");
            res.status(503).json({ ok: false, message: "受け口が設定されていません" });
            return;
        }
        if (given !== expected) {
            console.warn("[pgh_order] 合い言葉が違うため拒否しました");
            res.status(401).json({ ok: false, message: "認証が必要です" });
            return;
        }
```

⚠️⚠️ **他の取り込みと違って、先に 200 を返さない。**

```ts
 * ⚠️⚠️ **他の取り込みと違って、応答を返し切ってから処理しない。**
 *   ⚠️ 他（portal / mailScraping）は数分かかるので先に 200 を返しているが、
 *     ⚠️ ⚠️ **こちらは1通ぶんで1秒もかからない。**
 *   ⚠️ ⚠️ **先に返すと、GAS のログに「入ったのか落ちたのか」が残らない。**
 *     ⚠️ 反響は取りこぼすと気づけないため、結果まで見せる。
```

### ⚠️ 4. `projects/sync/src/routes/pghCatalogRoutes.ts`（新規）

```ts
import { Router } from "express";
import { pghCatalogController } from "../controllers/pghCatalogController";

const router = Router();

router.options("/", (_req, res) => {
    res.sendStatus(200);
});

router.post("/", pghCatalogController.handlePghCatalog);
export default router;
```

### ⚠️ 5. `projects/sync/src/app.ts`（1行追加）

```ts
// 【PG HOUSE九州】資料請求メール。⚠️ 送り元は Gmail の GAS（gas/runPghCatalog.gs）
app.use("/api/pgh_catalog", pghCatalogRoutes);
```

### ⚠️ 6. `backend/src/handlers/pgh_order.php`（新規・⚠️ **① 側**）

⚠️⚠️ **受け口テーブル（`*_db`）を作っていない。**

```php
 * ⚠️⚠️ **受け口テーブル（*_db）を作っていない。**
 *   ⚠️ SUUMO などのポータルは、ポータル側の生データを残すために `suumo_db` を持つ。
 *   ⚠️ ⚠️ **こちらはメール本文そのものを `remarks` に入れてある**ので、
 *     ⚠️ 生データを別に持つ意味が薄い。⚠️ **テーブルを1つ増やさない判断。**
 *   ⚠️ そのため `portalRunBulkImport()` は使わず、`portalInsertNewOnly()` を直接呼ぶ。
```

⚠️ 許可した列だけ入れる（⚠️⚠️ **`sync` などの運用フラグは受け取らない**）:

```php
$allowedColumns = [
    'inquiry_id', 'inquiry_date', 'medium', 'response_medium',
    'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
    'mobile', 'mail', 'zip', 'pref', 'building',
    'brand', 'shop', 'hp_campaign', 'remarks',
];
```

```php
        // ⚠️⚠️ **鍵の無い行は入れない。** 重複排除ができず、毎回増え続けるため
        if (trim((string)($filtered['inquiry_id'] ?? '')) === '') {
            continue;
        }
```

```php
        $res = portalInsertNewOnly($pdo, 'inquiry_customer', $inquiryRows, 'inquiry_id');
```

⚠️ ⚠️ **`express_proxy.php` には足していない。** ⚠️ **書き込みなので ② へ転送してはいけない**（⚠️ 自動フォールバックで二重に走る）。

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（sync） | ⚠️ **エラーなし** |
| ⚠️ **見本メールの抽出** | ⚠️ **12項目すべて取れた** |
| ⚠️ **ふりがなのカタカナ変換** | ⚠️⚠️ **`なかしまけんた` → `ナカシマケンタ`** |
| ⚠️ **住所の分解** | ⚠️ `鹿児島県` / `霧島市国分重久1063-1-201` |
| ⚠️ **① への投入** | ⚠️ **1回目 `inserted:1`** |
| ⚠️⚠️ **重複排除** | ⚠️⚠️ **2回目 `inserted:0 / skipped:1`** |
| ⚠️⚠️ **許可列の絞り込み** | ⚠️⚠️ **`sync:1` を送っても `sync` は 0 のまま**（弾けている） |
| ⚠️ 後片付け | ⚠️ **試した行はローカルDBから削除済み** |

⚠️ 入った行:

```json
{
    "inquiry_id": "pgh_hp_TESTMSG0001",
    "inquiry_date": "2026/09/28",
    "medium": "ホームページ反響",
    "response_medium": "Youtube",
    "first_name": "中島健太",
    "first_name_kana": "ナカシマケンタ",
    "pref": "鹿児島県",
    "building": "霧島市国分重久1063-1-201",
    "brand": "PGH",
    "shop": "PGH店舗未設定",
    "hp_campaign": "資料請求",
    "sync": 0
}
```

---

## ⚠️ まだ終わっていないこと

| # | |
|---|---|
| 1 | ⚠️⚠️ **`projects/sync` の `.env` に `PGH_CATALOG_TOKEN` を足す**（⚠️ **こちらでは触っていない**） |
| 2 | ⚠️ **GAS を Apps Script に貼り、先頭2つを書き換え、トリガーを設定**（⚠️ 利用者が実施） |
| 3 | ⚠️ **`pgh_order.php` を ① へアップロード** |
| 4 | ⚠️ `projects/sync` を公開先へ反映（⚠️ **未コミット。別リポジトリのため触っていない**） |

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`inquiry_date` は `YYYY/MM/DD`。** ⚠️ ハイフンにすると **バッジにも要確認にも出ない** |
| 2 | ⚠️⚠️ **`inquiry_customer` に一意キーが無い。** ⚠️ **必ず `portalInsertNewOnly()` を通すこと** |
| 3 | ⚠️⚠️ **`pgh_order` を `express_proxy.php` に足さないこと**（⚠️ 書き込みが二重に走る） |
| 4 | ⚠️ 列を増やすときは ⚠️ **`pgh_order.php` の許可リストも直す**（⚠️ **無い列は黙って捨てられる**） |
| 5 | ⚠️ `response_medium` に ⚠️ **`medium_list` に無い値が入りうる**。⚠️ 集計から漏れるので、出てきたら足す |
| 6 | ⚠️⚠️ **氏名は分割していない。** ⚠️ Nexus（v2.2.149）の半角スペース条件は満たさない。⚠️ **同期時に人が直す前提** |
| 7 | ⚠️ 見本では ⚠️ **`連絡可能時間` に電話番号が入っていた**（⚠️ フォーム側の不具合と思われる）。⚠️ `remarks` で追える |
| 8 | ⚠️ GAS の検索は ⚠️ **`newer_than:1d`**。⚠️ **1日以上止まると取りこぼす**（⚠️ 既読判定をしていないため、広げても重複はしない） |
