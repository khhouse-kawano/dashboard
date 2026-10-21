# 2026-10-21 v2.2.206 段階0：ログインの古い経路の削除・K-SNAP の書き込みを ② へ

## 指示
「0を進めて」（`docs/plan-2026-10-21-php-to-express.md` の段階0）

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/utils | version.ts | `newVersion = '2.2.206'` |
| backend/scripts/sql | 2026-10-21_update_log_2.2.206.sql（新規） | update_log の1行（ローカル no=307） |
| backend/src/handlers | login.php | credential（Google の IDトークン）が無ければ 401。メールアドレスだけで入れる古い経路を削除 |
| backend/src/core | express_proxy.php | expressProxyRequests() に `k-snap_login`、expressProxyExclusive() に `k-snap_show`・`k-snap_customer_update` |
| backend/src/handlers | k-snap_show.php・k-snap_customer_update.php | コメントだけ（② が処理する／このファイルは切り戻し用） |

- 関数の追加なし。② のコードの変更なし（K-SNAP の処理は 2026-09-03 から `backend-express/src/features/ksnap/index.ts` にある）。
- kyusyu の CORS_ORIGINS は VPS の .env.prod の作業（`docs/task-2026-10-21-04-pg-kyusyu-cors.md`）。コードの変更なし。

## login.php（変更後の本人確認の部分）
```php
$credential = (string)($data['credential'] ?? '');

// ⚠️ credential が無いときも Google の検証に失敗したときも 401。
//   v2.2.206 で、メールアドレスだけを受け取る古い経路（本人確認なし）を削除した。
$mail = $credential !== '' ? verifyGoogleIdToken($credential) : null;

if ($mail === null) {
    // ⚠️ 理由は返さない。error_log にだけ残る（core/google_auth.php を参照）
    http_response_code(401);
    echo json_encode([
        'message' => 'error',
        'details' => 'ログインに失敗しました。もう一度お試しください。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
```
削除した部分（`else` の中）:
```php
    error_log('login: 旧経路（mail 直接送信）が使われました mail=' . (string)($data['mail'] ?? ''));
    $mail = (string)($data['mail'] ?? '');
```
- 画面（Login.tsx）は `{ request: 'login', credential: token }` だけを送る。ほかに login を呼ぶものは無い（Dev.tsx は送信しないダミー）。

## express_proxy.php（差分）
```diff
@@ expressProxyRequests()
-        // ⚠️ 以下は**絶対に追加しないこと。** 書き込み系のため、
-        //   自動フォールバックで二重実行される。
-        //     k-snap_update          … 画像アップロード（そもそも ② では動かない）
-        //     k-snap_show            … UPDATE
-        //     k-snap_customer_update … INSERT / UPDATE
+        // ⚠️ 書き込み系はここに書かない（自動フォールバックで二重実行される）。
+        //     k-snap_show・k-snap_customer_update … v2.2.206 から expressProxyExclusive() に入れた
+        //     k-snap_update（画像アップロード）    … multipart は転送しない。① のまま
         'k-snap',
         'k-snap_edit',
         'k-snap_load',
         'k-snap_customer',
         'kSnap',
+        // ⚠️ v2.2.206。公開ギャラリーのログイン（参照のみ）。⚠️ 認証を要求しない（顧客向け）
+        'k-snap_login',
@@ expressProxyExclusive()
         'customer_pageviews',
+
+        // ⚠️ 2026-10-21（v2.2.206）。K-SNAP の書き込み（① から外す段階0）。② の features/ksnap/index.ts は PHP と同じ動き。
+        //   ⚠️ k-snap_show … 写真の公開／営業名の表示の切り替え（UPDATE）
+        //   ⚠️ k-snap_customer_update … 公開ギャラリーの閲覧ログ・お気に入り（INSERT / UPDATE）。応答は空（PHP と同じ）
+        //   ⚠️ ① の PHP ハンドラは残っている。障害時はこの2行を消せば ① に戻る。
+        'k-snap_show',
+        'k-snap_customer_update',
     ];
```

## PHP と ② の比較（移す前に確認）
| request | ① PHP | ② features/ksnap/index.ts |
|---|---|---|
| k-snap_login | pass を trim して空なら error／`SELECT id ... WHERE pass = ? LIMIT 1`／success・not_found | 同じ（runKSnapLogin） |
| k-snap_show | key は show_snap・staff_show だけ（それ以外 invalid_column）／UPDATE | 同じ（runKSnapShow） |
| k-snap_customer_update | tag・bookmark・setting・path・log のうち来たものだけ。id があれば UPDATE、無ければ INSERT。何も出力しない | 同じ（runKSnapCustomerUpdate）。空の応答 |

## テスト（① localhost:8080 経由）
| 確認 | 結果 |
|---|---|
| login 本文なし | 401 ログインに失敗しました |
| login `mail` だけ（古い経路） | 401 |
| login 偽の credential | 401 |
| k-snap_login 存在しないパス | 200 `X-Handled-By: express` `{"status":"not_found"}` |
| k-snap_login 空 | 200 express `{"status":"error"}` |
| k-snap_show 許可外の列 | 200 express `{"status":"invalid_column"}` |
| k-snap_show 無い id | 200 express `{"status":"success"}`（0行の UPDATE） |
| k-snap_customer_update 新規 → 更新（テストid） | 200 express・空の応答。DB に1行入り bookmark が更新された → テストの行は削除済み |
| tracking_site_list トークン無し | 401 express（② まで届く） |
- ⚠️ 最初の k-snap_customer_update は 502 だった。原因はテストデータ（`log` 列は JSON だけ受け付ける CHECK がある）。JSON で送り直して成功。PHP でも同じく失敗する。
- PHP の構文（php -l）：4ファイルとも問題なし。
- 本番の ② に k-snap_login・k-snap_show（許可外の列）を直接送り、`not_found`・`invalid_column` が返ることを確認（データは変えていない）。
- フロントのビルド：`main.0d91622e.js`（2.2.206 を含む）。
- 画面の変更が無いので Playwright での確認はしていない。

## リファクタリング
- 変更が小さく、重複・不要な処理は無し。変更なし。

## 業務ガイドの記事
- 画面の変更なし。記事の変更なし。
