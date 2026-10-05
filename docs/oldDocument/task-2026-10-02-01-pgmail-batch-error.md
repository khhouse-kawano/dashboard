# 2026-10-02-01　PGMail バッチのエラーメール調査と修正

## 依頼

> `C:\Users\shinji-kawano\projects\sync\src\services\runPGMail.ts` を実行すると
> 件名：【エラー】PGMailバッチ処理
> 本文：APIからのユーザー取得に失敗しました。
> が届くので調べて欲しい

追加指示:

> 進めてください
> たとえエラーで送れなかった場合も再送信は不要

---

## ⚠️⚠️ まず判明したこと：実行主体は `runPGMail.ts` ではない

⚠️ お知らせいただいた件名・本文は、`projects/sync` のどこにも存在しなかった。

| 調べたこと | 結果 |
|---|---|
| `projects` 配下を `PGMail` で全文検索（node_modules / .git 除く） | `sync` の5ファイルのみ |
| `sendErrorMail.ts` の件名 | 「【自動送信】 Dashboard処理作業中にエラー発生」 |
| `runPGMail.ts` が投げる文言 | 「APIからのレスポンスが配列ではありませんでした。」 |

⚠️⚠️ **実際に動いているのは Google Apps Script（GAS）版**だった（利用者から提示）。
⚠️ `runPGMail.ts` は**同じ処理の TypeScript 版で、今回の件には無関係**。

---

## ⚠️ 切り分け

| 試したこと | 結果 |
|---|---|
| ローカル① へ `{"request":"catalog_mail"}` | 200 / 正常な JSON / 171KB |
| ⚠️ **本番① へ同じ POST** | ⚠️ **200 / `application/json` / 1,334件 / 0.28秒** |
| GAS の User-Agent を偽装して本番① | 200（⚠️ UA では弾かれていない） |
| User-Agent なしで本番① | 200 |

⚠️ **API 自体は正常**。UA ベースの遮断でもない。

### ⚠️⚠️ GAS 側は HTTP ステータスでは落ちない

```js
const fetchOptions = {
  muteHttpExceptions: true   // ⚠️⚠️ 403 でも 500 でも例外にならない
};
...
users = JSON.parse(resultText);   // ⚠️⚠️ throw できるのは実質ここだけ
} catch (e) {
  MailApp.sendEmail('mkt@kh-house.jp', '【エラー】PGMailバッチ処理',
    'APIからのユーザー取得に失敗しました。');
```

⚠️⚠️ つまり **① が「JSON でない何か」を返した**ということ。

---

## ⚠️⚠️ 原因（実機で再現・証明済み）

⚠️⚠️ `catalog_mail.php` の**一覧取得側にだけ `try/catch` が無かった**（更新側にはあった）。

検証用に `handlers/catalog_mail_errortest.php` を一時作成し、存在しない列を
指定して `PDOException` を起こして比較した（⚠️ **確認後に削除済み**）。

| | HTTP | 本文 | `JSON.parse` |
|---|---|---|---|
| ⚠️⚠️ **修正前（catch なし）** | ⚠️⚠️ **200** | ⚠️ `<br /><b>Fatal error</b>: Uncaught PDOException...`（HTML 479B） | ⚠️⚠️ **失敗** |
| ⚠️ 修正後（catch あり） | 500 | `{"status":"error","message":"対象者の取得に失敗しました。"}` | 成功 |

⚠️⚠️ **本番は `display_errors` が切ってあるため、本文が空で 200 が返る。**
⚠️ `JSON.parse("")` は `Unexpected end of JSON input` を投げる → ⚠️ **届いたメールと一致**。

⚠️ DB の一時的な混雑（接続上限・クエリタイムアウト）で起きるため、
⚠️ **後から叩くと正常なのと矛盾しない。**

### ⚠️ もう1つ見つかった問題

⚠️⚠️ **1,334件すべてが `note = 'mail'`（送信済み）で、未送信は 0 件だった。**
⚠️ 毎回 174KB を取得して GAS 側で全部スキップしていた。レコードは増え続ける。

---

## 変更したファイル

### ⚠️ `backend/src/handlers/catalog_mail.php`（①のみ。②は無関係）

⚠️ **ファイル全文**（変更後）:

```php
<?php
/**
 * PGハウスのサンクスメール送信バッチ（GAS: runPGMail）用。
 *
 * ⚠️⚠️ **呼び出し元は GAS（Google Apps Script）であり、このリポジトリに無い。**
 *   `UrlFetchApp.fetch()` に `muteHttpExceptions: true` が付いているため、
 *   **GAS側は HTTP ステータスでは例外を出さない**。例外になるのは
 *   `JSON.parse()` だけである。
 *   → ⚠️⚠️ **このファイルは、何があっても必ず JSON を返すこと。**
 *     Fatal error で本文が空になると、GAS 側は
 *     「APIからのユーザー取得に失敗しました。」というメールを出す。
 *
 * $data['id'] が無ければ一覧取得、あれば送信済みフラグの更新。
 */

$id = $data['id'] ?? '';

if (!$id) {
    /**
     * ⚠️ 2026-10-02 まで、この一覧取得側には try/catch が無かった。
     *   そのため DB が一時的に落ちた・混雑した場合に PDOException が
     *   そのまま Fatal error になり、本番は display_errors が切ってあるので
     *   **本文が空のまま 200 が返っていた**。
     *   GAS は `JSON.parse("")` で落ち、原因の分からないエラーメールだけが届いていた。
     */
    try {
        /**
         * ⚠️ 2026-10-02 に `note <> 'mail'`（送信済みの除外）を追加した。
         *   それまでは全件を返しており、**1,334件・174KB のうち未送信は 0 件**だった。
         *   GAS 側も `user.note === 'mail'` でスキップしていたので動作は同じだが、
         *   レコードが増え続けるため毎回の転送量だけが膨らんでいた。
         *
         * ⚠️ `note` は NOT NULL なので `<> 'mail'` で NULL 行が落ちる心配はない。
         *   （NULL 許容に変えた場合は `(note IS NULL OR note <> 'mail')` にすること）
         *
         * ⚠️ `medium = 'ホームページ反響'` のときだけ `reserved_date` を必須にしている。
         *   来場予約のサンクスメールは予約が入っている人にしか出さないため。
         */
        $sql_customer = "SELECT id, first_name, last_name, mail, note, medium
            FROM inquiry_customer 
            WHERE brand LIKE '%PG%' 
            AND note <> 'mail'
            AND (medium = 'タウンライフ' OR medium = 'HOME\'S' OR medium = 'カゴスマ' OR (medium = 'ホームページ反響' AND reserved_date <> ''));";

        $stmt_customer = $pdo->prepare($sql_customer);
        $stmt_customer->execute();
        $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response_customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (PDOException $e) {
        error_log('Catalog Mail Fetch Error: ' . $e->getMessage());

        /**
         * ⚠️⚠️ **配列ではなくオブジェクトを返す。**
         *   GAS 側は `Array.isArray()` で弾いて1件も送らずに終わる。
         *   ⚠️ 空配列 `[]` を返すと「対象0件で正常終了」と区別が付かないので返さない。
         */
        http_response_code(500);
        echo json_encode(
            ['status' => 'error', 'message' => '対象者の取得に失敗しました。'],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }
}

try {
    $sql_customer = "UPDATE inquiry_customer SET note = 'mail' WHERE id = ?;";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute([$id]);

    $result = [
        "status" => 'success',
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    error_log('Mail Update Error: ' . $e->getMessage());

    $result = [
        "status" => 'error',
    ];

    // ⚠️ ここは 2026-10-02 時点で従来どおり 200 で返している。
    //   GAS は更新側の応答を見ていないため、挙動を変えない判断にした。
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
```

⚠️ 変更点は3つだけ。

| # | 変更 | 理由 |
|---|---|---|
| 1 | ⚠️⚠️ **一覧取得を `try/catch` で囲んだ** | ⚠️ Fatal error で本文が空になるのを防ぐ（⚠️ **本命の修正**） |
| 2 | ⚠️ SQL に `AND note <> 'mail'` を追加 | ⚠️ 毎回 174KB → 0B。送信済みを返さない |
| 3 | 更新側の `catch` にコメントを追加 | ⚠️ **挙動は変えていない**（200 のまま） |

⚠️⚠️ **追加した関数・新規ファイルはない。** ⚠️ DB の構造も変えていない。

---

## 動作確認（ローカル①）

```bash
docker exec dashboard-php-web-1 php -l /var/www/html/handlers/catalog_mail.php
# -> No syntax errors detected
```

```bash
curl -s -X POST http://localhost:8080/ -H "Content-Type: application/json" \
  -d '{"request":"catalog_mail"}'
# -> []   （HTTP 200 / 2 bytes。修正前は 171KB）
```

⚠️ `[]` が正しいことを SQL で確認:

| | 件数 |
|---|---|
| 旧 SQL の全件 | 1,334 |
| ⚠️ **新 SQL（`note <> 'mail'`）** | ⚠️ **0** |
| 除外された送信済み | 1,334 |

⚠️ `note` 列: `text` / ⚠️ **NOT NULL** / NULL 行 0件 → `<> 'mail'` で取りこぼしなし。

---

## ⚠️⚠️ 利用者側で必要な作業（GAS）

⚠️⚠️ **GAS はこのリポジトリに無いため、こちらでは修正していない。**

⚠️ 現在の `catch` は受け取った中身を捨てているので、再発時に原因が分からない。
⚠️⚠️ `let response, resultText;` を **`try` の外**で宣言したうえで、`catch` を以下に差し替えること。

```js
  } catch (e) {
    const code = (typeof response !== 'undefined') ? response.getResponseCode() : '(fetch自体が失敗)';
    const head = (typeof resultText !== 'undefined') ? resultText.slice(0, 500) : '(本文なし)';
    Logger.log('API取得エラー: ' + e.toString());
    MailApp.sendEmail('mkt@kh-house.jp', '【エラー】PGMailバッチ処理',
      'APIからのユーザー取得に失敗しました。\n\n'
      + 'HTTPステータス: ' + code + '\n'
      + 'エラー: ' + e.toString() + '\n\n'
      + '--- 応答の先頭500文字 ---\n' + head);
    return;
  }
```

⚠️ `Array.isArray` で弾いた場合も現状は**ログだけで無言終了**する。
⚠️ 今回の修正で ① はエラー時に `{"status":"error", ...}` を返すようになったため、
⚠️ そこでも通知したい場合は以下を足す。

```js
  if (!Array.isArray(users)) {
    Logger.log('APIからのレスポンスが配列ではありません。処理を終了します。');
    MailApp.sendEmail('mkt@kh-house.jp', '【エラー】PGMailバッチ処理',
      '対象者の取得に失敗しました。\n\n' + JSON.stringify(users));
    return;
  }
```

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **再送信は不要**との指示を受けている。送信失敗時は `note` が `'mail'` にならないため**次回実行で自然に再送される**が、今回はそれを変えていない |
| 2 | ⚠️⚠️ **`runPGMail.ts` は使われていない。** ⚠️ GAS 版と二重に存在する。⚠️ `portalService.ts` の `'pg_mail'` から実行できてしまうので、**両方走ると二重送信になる**。⚠️ 整理するかどうかは要判断 |
| 3 | ⚠️⚠️ **この変更は ① の PHP のみ。** ⚠️ [deploy-v2.2.160.md](deploy-v2.2.160.md) には「① の PHP も変更していません」と書いてあるため、⚠️ **v2.2.160 とは別に出すこと** |
| 4 | ⚠️ フロントは一切変更していない。⚠️ `version.ts` も `update_log` も**対象外** |
| 5 | ⚠️ 本番①では**未確認**（⚠️ ローカル①で構文・正常系・異常系とも確認済み） |
