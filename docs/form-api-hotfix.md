# キャンペーンフォームAPI 緊急修正（第1段階）

作成: 2026-09-16

⚠️ **目的は1つだけ。「公開フォームから任意の宛先へメールを送れる」状態を止めること。**

⚠️ 振り分けや文面は**一切変えない**。挙動を変えずに穴だけ塞ぐ。

---

## ⚠️ ファイル全体を貼らない理由

本番の `index.php` には **DB の接続情報が平文で書かれている**。
⚠️ 修正版をこのリポジトリに置くと、**資格情報がリポジトリに残る**。
⚠️ そのため**変更する箇所だけ**を以下に書く。

---

## 対象

| # | ファイル | 場所 | 変更 |
|---|---|---|---|
| 1 | `index.php` | `khg-marketing.info/api/` | ⚠️ メールヘッダの無害化（下の A・B） |
| 2 | `index.php` | 各ブランドサイトの `form/api/`（**8サイト**） | ⚠️ デバッグ出力の削除（下の C） |

⚠️ **8サイトの一覧**（`form_get/src/components/Form.tsx` より）

```
https://kh-house.jp/form/api/
https://day-just-house.com/form/api/
https://www.nagomi-koumuten.jp/form/api/
https://furukomi-home.com/form/api/
https://2lhome.net/form/api/
https://miyazaki.pg-house.jp/form/api/
https://jusfy-home.com/form/api/
https://kh-house.jp/khg/form/api/
```

---

## ⚠️ 何が起きているのか

```php
$headers_response = 'From:' . $brand_name . ' <pgcloud@khg-marketing.info>' . "\r\n" .
    'Cc:' . $data['mail_cc'] . "\r\n" .          // ⚠️ リクエストの値をそのまま
    'Content-type: text/html; charset=UTF-8';
mail($data['mail_to'], $subject_response, $message_response, $headers_response);
```

⚠️ `mail_cc` は**ブラウザから送られてくる値**である（`Confirm.tsx` が組み立てている）。
⚠️ 改行を含む値を送れば、`Cc:` の行に続けて **`Bcc:` を自前で追加できる**。

```
Cc: normal@example.com
Bcc: victim1@example.com, victim2@example.com, ...
```

⚠️ 結果、**`khg-marketing.info` の名前で任意の宛先へ送信できる**。
⚠️ 悪用されるとドメインの評判が落ち、**正規のメールが届かなくなる**。

⚠️ `mail_to` には `FILTER_VALIDATE_EMAIL` が掛かっているが、**`mail_cc` には何も無い**。

---

## A. 無害化する関数を1つ足す

⚠️ `try {` の**直前**（`$authHeader = ...` の下あたり）に置く。

```php
/**
 * ⚠️⚠️ メールヘッダに入れる宛先を無害化する。
 *
 *   ⚠️ mail_cc はブラウザから送られてくる値なので、改行を含められる。
 *     そのままヘッダへ入れると `Bcc:` を追加され、
 *     **任意の宛先へ送信できてしまう**（ヘッダインジェクション）。
 *
 *   ⚠️ 改行を落とすだけでは不十分。カンマ区切りの各アドレスを
 *     FILTER_VALIDATE_EMAIL で確かめ、通ったものだけを残す。
 *
 *   ⚠️⚠️ **改行は「削除」ではなく「カンマに置換」する。**
 *     削除すると `ok@a.jp\r\nBcc: 悪い宛先` が
 *     `ok@a.jpBcc: 悪い宛先` という1つの不正な文字列になり、
 *     ⚠️ **正当な宛先まで丸ごと消える**（社内通知の Cc が届かなくなる）。
 *     カンマに置き換えれば、正当な分は残り、注入された行だけが落ちる。
 *
 *   ⚠️ 空文字を返した場合、呼び出し側は Cc 行そのものを出さないこと。
 *     `Cc:` だけの空行を残すと、サーバーによってはヘッダが壊れる。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }

    // ⚠️ 改行（CR / LF / タブ）を区切りに変える。ここが本体
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);

    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }

    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    $clean = array_slice(array_unique($clean), 0, 20);

    return implode(',', $clean);
}
```

---

## B. ヘッダを組み立てている3か所を直す

⚠️ **3か所ある。1つでも漏らすと意味が無い。**

| # | 分岐 | 目印 |
|---|---|---|
| B-1 | `form_register` | `$subject_response = $brand_name . '/' . $data['campaign'] . 'からの登録がありました。';` の下 |
| B-2 | `registration` → `owners_house` | `owners_house@khg-marketing.info` を含む方 |
| B-3 | `registration` → `homepage` | `pgcloud@khg-marketing.info` を含む方（B-1 と似ているので取り違えない） |

### 変更前（3か所とも同じ形）

```php
$headers_response = 'From:' . $brand_name . ' <pgcloud@khg-marketing.info>' . "\r\n" .
    'Cc:' . $data['mail_cc'] . "\r\n" .
    'Content-type: text/html; charset=UTF-8';
```

### 変更後

```php
// ⚠️ Cc は無害化してから使う。空なら Cc 行ごと出さない
$safeCc = safeAddressList(isset($data['mail_cc']) ? $data['mail_cc'] : '');

$headers_response = 'From:' . $brand_name . ' <pgcloud@khg-marketing.info>' . "\r\n" .
    ($safeCc !== '' ? 'Cc:' . $safeCc . "\r\n" : '') .
    'Content-type: text/html; charset=UTF-8';
```

⚠️ **B-2 だけ差出人が `owners_house@khg-marketing.info`** である。
⚠️ `From:` の行はそのまま残すこと（`pgcloud` に書き換えない）。

### ⚠️ 送信先（`mail_to`）も同じ扱いにする

3か所とも、直後の送信はこうなっている。

```php
if (!empty($data['mail_to']) && filter_var($data['mail_to'], FILTER_VALIDATE_EMAIL)) {
    mail($data['mail_to'], $subject_response, $message_response, $headers_response);
}
```

⚠️ `mail_to` は単一アドレスの検証がすでに掛かっているので**このままでよい**。
⚠️ ただし `FILTER_VALIDATE_EMAIL` を**外さないこと**。外すと第1引数からも注入できる。

---

## C. 8サイトのプロキシからデバッグ出力を消す

`form/api/index.php` の以下**3行を削除**する。

```php
error_log('=== DEBUG HEADERS === ' . print_r($headers, true));
error_log('=== DEBUG HTTP_AUTHORIZATION === ' . ($_SERVER['HTTP_AUTHORIZATION'] ?? 'なし'));
error_log('=== DEBUG TOKEN === ' . ($authToken ?: 'なし'));
```

⚠️ **全リクエストのヘッダをサーバーのログに書き続けている。**
⚠️ 8サイトすべてに入っている。
⚠️ 削除しても動作は変わらない（ログを出しているだけ）。

---

## ⚠️ D. DB のパスワード変更（別途）

⚠️ 接続情報が `index.php` に平文で書かれており、**ローカルの控え
（`react/form_get/index.php`）にも同じものが入っている**。
⚠️ リポジトリの履歴からは消せないため、**パスワードの変更が必要**。

⚠️ 変更するときは、**この値を使っている全ファイル**を同時に直すこと。
⚠️ 1つ漏らすとそのフォームだけ静かに落ちる。

---

## 確認手順

### 1. 正常系（⚠️ 先にこちらを確認する）

⚠️ 実際のフォームから1件送信し、

- 顧客にサンクスメールが届くこと
- ⚠️ **社内通知が今までどおりの宛先に届くこと**（Cc を含む）
- `inquiry_customer` に1行増えること

### 2. 塞がったことの確認

⚠️ **本番へ悪用のテストを撃たないこと。** 下は「読んで確認する」ためのもの。

`mail_cc` に改行を含む値が来ても、`safeAddressList()` が

- 改行を落とす
- `FILTER_VALIDATE_EMAIL` を通らない断片を捨てる

ため、⚠️ **`Bcc:` の行は組み立てられない。**

### 3. ログ

⚠️ 8サイトのサーバーログに `=== DEBUG` が**出なくなる**こと。

---

## ⚠️ 戻し方

⚠️ A・B は**関数を1つ足して3か所を書き換えただけ**なので、
変更前の3行に戻せば元に戻る。
⚠️ C は削除のみなので、戻す必要は無い。

⚠️ 作業前に `~/`（**公開ディレクトリの外**）へバックアップを取ること。
⚠️ `index.php.bak` のように同じ場所へ置くと、**Web から読めてしまい
DB の接続情報が漏れる**。

---

## この後（第2段階の下準備）

⚠️ 恒久対応は「宛先をブラウザに持たせない」こと。
`form_table.mail_to` / `mail_cc` に入っているのだから、
⚠️ **サーバー側で引けばリクエストの値は要らない**。

⚠️ ただし `Confirm.tsx` は `brand === 'khg'` のとき
**店舗ごとに mail_cc を上書きしている**（かえるホーム・PG HOUSE など）。
⚠️ そのまま DB 参照に変えると**通知先が変わる**フォームが出る。
⚠️ 第2段階（Express化）で、この分岐ごと `form_table` 側へ移すこと。
