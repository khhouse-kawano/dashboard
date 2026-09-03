# K-SNAP について

スナップ写真の共有機能。**フロントとAPIが別リポジトリに分かれている**ため、
どちらを触るときも相手側への影響を確認してください。

| | 場所 |
|---|---|
| 公開ギャラリー（顧客向け画面） | **別リポジトリ**（`react/ksnap`）／公開URL **https://k-snap.jp/** |
| スタッフ向け画面 | このリポジトリ `frontend/src/components/photo/` `frontend/src/components/information/KSnap.tsx` |
| API（PHP） | このリポジトリ `backend/src/handlers/k-snap*.php` ＋ `backend/src/core/ksnap.php` |
| API（Express） | このリポジトリ `backend-express/src/features/ksnap/` |
| 画像 | ① の `public_html/dashboard/api/images/` |
| このディレクトリ | ⚠️ **移行元の控え。編集しても反映されない** |

---

## ⚠️ リポジトリをまたぐ契約

公開ギャラリーは、このリポジトリのAPIを `request` 名で呼んでいます。
**レスポンスの形を変えると、型チェックに引っかからずに公開ギャラリーが壊れます。**

| request | 公開ギャラリー | スタッフ画面 |
|---|---|---|
| `k-snap_login` | ✅ | |
| `k-snap` | ✅ | |
| `k-snap_customer` | ✅ | |
| `k-snap_customer_update` | ✅ | |
| `k-snap_edit` | ✅ | ✅ |
| `k-snap_load` | ✅ | ✅ |
| `k-snap_update` | ✅ | ✅ |
| `k-snap_show` | | ✅ |
| `shop_list` | ✅ | ✅ |
| `kSnap` | | ✅ |

⚠️ **上記を変更したら、必ず公開ギャラリー側でも動作確認してください。**
特に以下は破壊的です。

| 変更 | 影響 |
|---|---|
| `{ status, ... }` で包む／外す | 呼び出し側の参照が全て外れる |
| 列を減らす | 表示が空欄になる（エラーにならない） |
| `SELECT *` を明示列に変える | 列追加時に片方だけ古くなる |
| `show_flag` / `show_snap` の条件を変える | 非公開の写真が顧客に見える |

## ⚠️ 公開ギャラリーは別ドメイン（クロスオリジン）

```
https://k-snap.jp/  →  https://khg-marketing.info/dashboard/api/gateway/
```

配置は ① の `public_html/k-snap/`（`k-snap.jp` のドキュメントルート）。
同じディレクトリは `https://khg-marketing.info/k-snap/` からも見えるため、
**リクエストURIがホストによって変わる**（`/` と `/k-snap/`）。
`.htaccess` でパスを直書きした条件は片方でしか効かない。

| 項目 | 現状 |
|---|---|
| CORS | ① の `core/db.php` が `Access-Control-Allow-Origin: *` を返すため動く |
| ⚠️ フロントを ② へ直接向ける場合 | `CORS_ORIGINS` に `https://k-snap.jp` を追加しないと**顧客側が止まる** |
| ルーティング | クエリパラメータ（`?id=` `?page=`）。パスは `/` の1つだけ。`basename="/"` が正しい |

⚠️ `k-snap_customer` はパスワードを含む顧客行を返す。**公開ドメインから
`Access-Control-Allow-Origin: *` で到達できる**状態であることを認識しておくこと。

## ⚠️ 画像の配信元は3箇所で一致させる

| 場所 | 定義 |
|---|---|
| API（保存先） | `backend/src/core/ksnap.php` の `ksnapImageDir()`（① では `KSNAP_IMAGE_DIR`） |
| スタッフ画面 | `frontend/src/utils/ksnapImage.ts` |
| 公開ギャラリー | 別リポジトリの `src/config.ts` |

⚠️ 1箇所だけ変えると「保存はできるが表示できない」状態になり、原因が分かりにくいです。

## ⚠️ 認証を一括強化するときの注意

`k-snap*` と `shop_list` には**顧客向け（公開）とスタッフ向けが混在**しています。
顧客はスタッフのトークンを持たないため、**顧客向けに認証を要求すると公開ギャラリーが止まります。**

| 区分 | request |
|---|---|
| 顧客向け（認証不可） | `k-snap_login` / `k-snap` / `k-snap_customer` / `k-snap_customer_update` / `shop_list` |
| スタッフ向け（認証すべき） | `k-snap_edit` / `k-snap_load` / `k-snap_update` / `k-snap_show` / `kSnap` |

---

## 移行時に変えた点（2026-09-03）

移行元（① の `/k-snap/api/`）と現在の実装で挙動が異なる箇所です。
SQLとレスポンスの形は変えていません。

| | 内容 |
|---|---|
| 1 | 暗号鍵をソース直書きから環境変数へ（`KSNAP_OWNER_KEY` / `KSNAP_OWNER_IV`）。**値は同じ** |
| 2 | 画像アップロードに拡張子ホワイトリストと `getimagesize()` による実体検証を追加 |
| 3 | 画像の保存先を `/k-snap/images/` から `/dashboard/api/images/` へ |
| 4 | 新規登録で画像が保存できなかった場合にエラーを返す（従来は画像なしのレコードができた） |
| 5 | 例外メッセージをレスポンスに含めない（SQLやパスの漏洩防止） |
| 6 | `shop_list` を `demand` 形式から `request` 形式へ |

⚠️ **2 は緩めないでください。** 移行前は利用者が送ったファイル名の拡張子をそのまま使っており、
`evil.php` を公開ディレクトリに置ける状態でした。
`images/.htaccess` で `.php` へのアクセスも拒否しています（多層防御）。

⚠️ `php_flag engine off` は書かないこと。① の PHP は `fpm-fcgi` で動いており、
`mod_php` のディレクティブは未知として扱われて**そのディレクトリ全体が 500 になります。**

## Express へ移植していないもの

`k-snap_update`（画像アップロード）だけは ② VPS で動かせません。
画像の保存先が ① のファイルシステムであり、② から書き込めないためです
（SSHトンネルは MySQL の TCP だけを通しています）。

## ⚠️ 未対応の課題

| | 内容 |
|---|---|
| 1 | `k-snap_login` はパスワードを平文比較・試行回数の制限なし |
| 2 | `k-snap_customer` は `SELECT *` のため**パスワードも返る**。id を変えれば他人の分も取得できる |
| 3 | `k-snap_customer_update` は id の持ち主確認が無く、**他人の閲覧履歴を上書きできる** |
| 4 | `k-snap_show` は認証が無く、**誰でも任意の写真を非公開にできる** |
| 5 | ① の `/k-snap/api/` は公開ギャラリーを切り替えるまで削除できない |
