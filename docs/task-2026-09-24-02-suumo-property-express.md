# SUUMO掲載順位の保存を Express へ移す（v2.2.147）

⚠️ 指示（`ReadMeClaude.md`）:

> # UI改修
> v2.2.146はビルド済み
> v2.2.147にて作業開始
>
> ## 要件
> - C:\Users\shinji-kawano\extensions\meta_scraper suumo_scraperのExpress化

⚠️ 口頭での補足（2026-09-24）:

> 保存APIの改修だけでよい
> これはオーナー（私）が週に1度だけローカルで実行している作業

---

## ⚠️ 何を移したか

| | 移す前 | 移した後 |
|---|---|---|
| 収集（playwright） | ⚠️ **オーナーのPCで週1回** | ⚠️ **変更なし** |
| 送信先 | `https://khg-marketing.info/dashboard/api/gateway/` | ⚠️ **変更なし** |
| 保存 | ⚠️ ① の `suumo_property.php` | ⚠️⚠️ **② の Express** |

⚠️⚠️ **スクレイパー（`C:\Users\shinji-kawano\extensions\meta_scraper\suumo_scraper.ts`）は1行も触っていない。**
⚠️ ⚠️ **送信先が ① のままなので、再配布もしなくてよい。**
⚠️ ① のゲートウェイが ② へ転送する。

⚠️ 読み出し側（`property::suumo`）は 2026-09-03 に移植済みだった。
⚠️ ⚠️ **今回で `suumo_property` テーブルの読み書きが両方 ② になった。**

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend-express/src/features/` | ⚠️ **`suumoProperty.ts`** | ⚠️ **新規** |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ `suumo_property` を登録 |
| `backend/src/core/` | ⚠️ **`express_proxy.php`** | ⚠️⚠️ **`expressProxyExclusive()` に1行** |
| `frontend/src/utils/` | `version.ts` | `2.2.147` |
| `backend/scripts/sql/` | ⚠️ **`2026-09-24_update_log_2.2.147.sql`** | ⚠️ **新規** |

⚠️ ⚠️ **① の `suumo_property.php` は消していない。** ⚠️ 切り戻し先として残す。

---

## 1. 追加したファイル（全文）

### `backend-express/src/features/suumoProperty.ts`

```ts
import { execute } from '../db/pool';

/**
 * SUUMO 掲載順位の収集結果を1件保存する。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/suumo_property.php`
 *
 * ⚠️⚠️ **呼び出し元はブラウザではない。**
 *   `C:\Users\shinji-kawano\extensions\meta_scraper\suumo_scraper.ts`
 *   （playwright のスクレイパー）が **オーナーのPCで週1回**実行される。
 *   ⚠️ 送信先は ① のゲートウェイのままで、① が ② へ転送する。
 *
 * ⚠️ 読み出し側（`property::suumo`）は features/property.ts に移植済み。
 *   ⚠️ **同じテーブルの読み書きが別ファイルに分かれている**ことに注意。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **`suumo_property` には UNIQUE キーが無い。**
 *   ⚠️ 二重に実行すれば**同じ物件が2行できる**。
 *   ⚠️ そのため ① の `expressProxyExclusive()`（フォールバック禁止）に登録している。
 *     ⚠️ **`expressProxyRequests()` に移してはいけない。**
 *
 * ⚠️ 代償: ② が落ちている間は 502 になり、そのエリアは保存されない。
 *   ⚠️ 週1の手動実行なので、掛け直せばよい。
 */

/** ⚠️ 列はすべて `text`。数値も文字列で入っている（`rank` も含む） */
const INSERT_SQL =
    'INSERT INTO suumo_property ' +
    // ⚠️⚠️ **`rank` はバックチックで囲むこと。** ⚠️ 予約語（ウィンドウ関数）である
    '(`rank`, `area`, `company`, `name`, `price`, `plan`, `url`, `registered_at`) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

/**
 * 値を1つ、列に入れられる形へ寄せる。
 *
 * ⚠️ 移植元は `$data['x'] ?? null` で、**型を見ていない**。
 *   ⚠️ `rank` は数値で送られてくるが列は `text` なので、PDO が文字列にして入れていた。
 *   ⚠️ ここでも同じく文字列へ寄せる。数値のまま渡すと
 *     **既存の行（文字列）と型が揃わない**。
 *
 * ⚠️ `undefined` と `null` は null のまま返す（移植元と同じ）。
 */
const asColumn = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // ⚠️ 配列やオブジェクトは想定していない。
    //   ⚠️ 移植元は PDO が bindValue で落ちていたので、ここでも保存しない
    return null;
};

export interface SuumoPropertyInsertResult {
    httpStatus: number;
    body: { status: 'success' | 'error'; message: string };
}

/**
 * ⚠️⚠️ **応答の形を変えないこと。**
 *   ⚠️ スクレイパーは `response.data.status === 'success'` だけを見ている
 *     （suumo_scraper.ts の POST 部分）。
 *   ⚠️ 失敗しても **HTTP は 200** で返す。移植元がそうしており、
 *     ここだけ 500 にすると axios が例外を投げて
 *     **「通信エラー」と表示され、原因の切り分けが変わる**。
 */
export const runSuumoPropertyInsert = async (
    body: Record<string, unknown>
): Promise<SuumoPropertyInsertResult> => {
    try {
        await execute(INSERT_SQL, [
            asColumn(body.rank),
            asColumn(body.area),
            asColumn(body.company),
            asColumn(body.name),
            asColumn(body.price),
            asColumn(body.plan),
            asColumn(body.url),
            asColumn(body.registered_at),
        ]);

        return { httpStatus: 200, body: { status: 'success', message: 'DB保存完了' } };
    } catch (error) {
        // ⚠️ 移植元は error_log に出していた。② では標準エラーに出す（docker logs で読める）
        console.error('[suumo_property] INSERT に失敗しました:', error);
        return { httpStatus: 200, body: { status: 'error', message: 'DB保存エラー' } };
    }
};
```

### ⚠️ 移植元（`backend/src/handlers/suumo_property.php`。⚠️ **残してある**）

```php
<?php
// $pdo, $data は定義済みとする

try {
    // 💡 テーブルの全カラム（id以外）に対するINSERT文
    $sql = "INSERT INTO suumo_property (rank, area, company, name, price, plan, url, registered_at)
            VALUES (:rank, :area, :company, :name, :price, :plan, :url, :registered_at)";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':rank', $data['rank'] ?? null);
    $stmt->bindValue(':area', $data['area'] ?? null);
    $stmt->bindValue(':company', $data['company'] ?? null);
    $stmt->bindValue(':name', $data['name'] ?? null);
    $stmt->bindValue(':price', $data['price'] ?? null);
    $stmt->bindValue(':plan', $data['plan'] ?? null);
    $stmt->bindValue(':url', $data['url'] ?? null);
    $stmt->bindValue(':registered_at', $data['registered_at'] ?? null);

    $stmt->execute();

    echo json_encode(["status" => "success", "message" => "DB保存完了"]);

} catch (PDOException $e) {
    error_log("DB INSERT ERROR: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "DB保存エラー"]);
}
```

---

## 2. ゲートウェイへの登録

`backend-express/src/gateway/registry.ts`（⚠️ `property::suumo` の登録の直後に追加）

```ts
import { runSuumoPropertyInsert } from '../features/suumoProperty';
```

```ts
// ---------------------------------------------------------------------------
// SUUMO 掲載順位の収集（書き込み）。2026-09-24 移植。
//
// ⚠️⚠️ **呼び出し元は画面ではない。**
//   `C:\Users\shinji-kawano\extensions\meta_scraper\suumo_scraper.ts`
//   （playwright）を **オーナーが週1回ローカルで実行**する。
//   ⚠️ 送信先は ① のゲートウェイのままで、① が ② へ転送する。
//     スクレイパーは改造していないので、再配布は不要。
//
// ⚠️⚠️ **`suumo_property` には UNIQUE キーが無い。**
//   ⚠️ 二重実行で同じ物件が2行できるため、① では
//     `expressProxyExclusive()`（フォールバック禁止）に登録している。
//   ⚠️ **`expressProxyRequests()` へ移してはいけない。**
//
// ⚠️ auth: 'none'。⚠️⚠️ **スクレイパーは Token を送らない**（Content-Type のみ）。
//   ⚠️ 'staff' にすると収集が全件 401 で止まる。
//   ⚠️ google_review:save と同じ状態であり、認証強化は
//     GATEWAY_REQUIRE_AUTH の一括適用で行う。
//
// ⚠️ 読み出し側は上の property::suumo。同じテーブルだがファイルが別。
// ---------------------------------------------------------------------------

register({
  request: 'suumo_property',
  summary: '【書き込み・フォールバック禁止】SUUMO掲載順位の収集結果を1件保存する',
  phpSource: 'backend/src/handlers/suumo_property.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runSuumoPropertyInsert(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

⚠️ ⚠️ **roll / category は使わない。** ⚠️ キーは `suumo_property::` になる。

---

## 3. ① の転送設定

`backend/src/core/express_proxy.php` の ⚠️ **`expressProxyExclusive()`**（⚠️ `satbase_update` の次）

```php
        // -----------------------------------------------------------------
        // 2026-09-24 移植。SUUMO掲載順位の収集結果の保存。
        //
        // ⚠️⚠️ **呼び出し元は画面ではない。**
        //   extensions/meta_scraper/suumo_scraper.ts（playwright）を
        //   **オーナーが週1回ローカルで実行**する。
        //   ⚠️ スクレイパーの送信先は ① のままなので、再配布は不要。
        //
        // ⚠️⚠️ ① に PHP ハンドラが**実在する**（suumo_property.php。消していない）。
        //   ⚠️ **`suumo_property` には UNIQUE キーが無い。**
        //     転送に失敗したまま ① でも実行されると、
        //     **同じ物件が2行できる**。そのためフォールバックを禁止する。
        //
        // ⚠️ 代償: ② が落ちている間は 502 になり、そのエリアは保存されない。
        //   ⚠️ 週1の手動実行なので、掛け直せばよい。
        // ⚠️ 切り戻しはこの1行を消すだけ。① の PHP がそのまま処理を再開する。
        // -----------------------------------------------------------------
        'suumo_property',
```

---

## ⚠️ なぜ `expressProxyRequests()` ではないのか

| | |
|---|---|
| `expressProxyRequests()` | ⚠️ ② が落ちたら ⚠️ **① で実行する**（フォールバック） |
| ⚠️ **`expressProxyExclusive()`** | ⚠️⚠️ **② が落ちたら 502。① では実行しない** |

⚠️⚠️ **`suumo_property` には UNIQUE キーが無い。**
⚠️ ⚠️ **② で保存できた直後に応答だけ失われると、① でもう一度 INSERT され、同じ物件が2行できる。**
⚠️ `meta_ads:bookmark` や `information:log:common` と同じ理由である。

---

## ⚠️ なぜ `auth: 'none'` なのか

⚠️⚠️ **スクレイパーは Token ヘッダを送らない。**

```ts
const response = await axios.post(API_ENDPOINT, { ...prop, request: 'suumo_property' }, {
    headers: { "Content-Type": "application/json" }
});
```

⚠️ ⚠️ **`'staff'` にすると収集が全件 401 で止まる。**
⚠️ 移植元の PHP も認証していない。⚠️ `google_review:save` と同じ状態である。
⚠️ **認証強化は `GATEWAY_REQUIRE_AUTH` の一括適用で行う。**

---

## ⚠️ 確認（2026-09-24・ローカル）

| # | 確認 | 結果 |
|---|---|---|
| 1 | `npx tsc --noEmit` | ⚠️ **エラー無し** |
| 2 | `npm run build` | ⚠️ **成功** |
| 3 | ② の起動ログ | ⚠️ **`suumo_property::` が登録された** |
| 4 | ⚠️ **ローカルの ② へ1件POST** | ⚠️ **HTTP 200** |
| 5 | ⚠️⚠️ **DBの行** | ⚠️⚠️ **1行だけ入った（二重登録なし）。日本語も正しい** |
| 6 | ⚠️ `rank` | ⚠️ **文字列 `1` として入った**（⚠️ 既存行と同じ形） |
| 7 | ⚠️ 検証用の行 | ⚠️ **削除済み** |

⚠️ 4〜7 で使ったのは `url = https://example.invalid/verify` の1行のみ。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`suumo_property` を `expressProxyRequests()` へ移さないこと。** ⚠️ 二重登録の経路になる |
| 2 | ⚠️⚠️ **① の `suumo_property.php` を消さないこと。** ⚠️ 切り戻し先である |
| 3 | ⚠️ 収集は ⚠️ **1物件1リクエスト**（33エリア×最大100件＝約3,300回）。⚠️ **まとめ送りは今回見送った**（スクレイパーの再配布が必要になるため） |
| 4 | ⚠️ ② が落ちている週は ⚠️ **そのエリアが保存されない**。⚠️ **掛け直すこと** |
| 5 | ⚠️ `suumo_property` は ⚠️ **行が増え続ける**（現在11,991行）。⚠️ `property::suumo` は**全件返している** |
