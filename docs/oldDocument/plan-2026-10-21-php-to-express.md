# 計画：① PHP への通信をなくし、② Express へ寄せる（2026-10-21・案）

## きっかけ
- PHP 本体に Critical の脆弱性2件（php2shell。CVE-2026-109618 / 109619。外部から任意のコード実行）。修正版は 2026-10-21 23:00（日本時間）公開。回避策（session.upload_progress を無効）は効かないと判明。
- 脆弱性は**こちらのコードが動く前**に PHP 本体で突かれる。request を ② へ転送していても、入口が PHP（index.php・express_proxy.php）なら攻撃面は残る。
- ② の VPS で動いているのは caddy・express-api・ssh-tunnel だけで、PHP は無い。今回の件は ② には影響しない。
- DB は ① にある。② も SSH トンネルで ① の DB を使う。

## 方針
1. 外部の入口（ブランドサイトのフォーム・画面）は、**PHP を通らずに ② の `api.khg-marketing.info` へ直接**送る。
2. ① の PHP は、② からしか呼べないようにする（.htaccess で VPS の IP だけ許可）。
   - ② には、② に無い request を ① へ渡す仕組み（gateway/phpFallback.ts）が既にある。全部を移し終える前でも、① を外から見えなくできる。
3. ① だけで処理している request を、画面ごとに ② へ移す。
4. DB の移設は最終段階として別に判断する。

## 現状（2026-10-21 の調査）

### 画面（dashboard）が送る request
| 区分 | 数 |
|---|---|
| ② だけで処理（落ちたら 502） | 約44 |
| ② で処理し、落ちたら ① の PHP で処理 | 約48（うち書き込み11） |
| ② だけにあり、① に処理が無い（落ちたら 404） | 12 |
| ① の PHP だけで処理（画面から） | 約56 |
| ① の PHP だけで処理（GAS・sync・ポータルの取り込み） | 約45 |

- 画面の通信先は `frontend/src/utils/baseURL.ts` の `REACT_APP_API_BASE_URL`（今は ① の `/dashboard/api/gateway/`）。
- ② はトークン（staff.api_token）を自分で確認できる（gateway/auth.ts）。トークンを**発行**する login・get_token は ① にしかない。

### 外部のフォームなど
| 呼び出し元 | 送信先 | PHP |
|---|---|---|
| キャンペーンのフォーム（form_get。272 フォーム・8 ブランド） | ② gateway。**失敗したら各ブランドの `form/api/` → `khg-marketing.info/api/`（form_register）** | 失敗時に ① の PHP。landing_params・line_id が欠ける |
| FormBuilder の buildHtml のフォーム | ② だけ | なし |
| アンバサダーのフォーム | ② だけ | なし |
| フェスタの予約・チェックイン | ② だけ | なし |
| 見学クラウド（ie-miru） | ② だけ | 旧 `khg-marketing.info/api/kengakuCloud/all/` が残っている可能性 |
| tracker.js・cv.js | ② だけ | なし |
| K-SNAP の公開ギャラリー（react/ksnap） | ① gateway。参照は ② へ転送 | **k-snap_login・k-snap_customer_update は ① だけ**（② には実装済み） |
| smile2026 | ① gateway（handlers/event.php が無く 404） | 使われていない |
| GAS（introductory・pgh_order・homes_db_kaeru・catalog_resale_update・catalog_mail） | ① gateway | ① だけ |
| projects/sync（Heroku）・ポータルの取り込み | ① gateway | ① だけ（inquiry_update は ② へ転送） |

- ① の外向けの処理には、認証・CAPTCHA・流量の上限が無い（db.php が CORS `*`）。
- dashboard の外にも PHP がある：`khg-marketing.info/api/`（form_post・catalog・recommend・spreadSheet）、`/ma/`、`/property/api/`、`/survey/api/`、`/mail_list/`、各ブランドドメインの festa・newForm などの PHP、WordPress。

## 段階
| 段階 | 内容 | 対象 | 効果 |
|---|---|---|---|
| 0（すぐ） | login.php の本人確認なしの古い経路を消す（期限 2026-09-17 超過）／kyusyu.pg-house.jp を CORS_ORIGINS に（VPS の作業）／K-SNAP の3つを転送の許可リストへ | ①・② | なりすましを防ぐ。フォームが ① へ落ちる原因を減らす |
| 1（フォーム） | キャンペーンのフォームの失敗時の送信先を ① の PHP から外す／全ブランドの origin が CORS_ORIGINS にあるか点検／K-SNAP の公開ギャラリーの送信先を ② に／旧 kengakuCloud・smile2026 などの使っていない PHP を止める | form_get・ksnap・① | 外部のフォームの入口から PHP が外れる |
| 2（画面の入口） | login・get_token・heartbeat・login_log・show_version を ② に移す／画面の送信先を `https://api.khg-marketing.info/api/gateway` に変える（② に無い request は ② が ① へ渡す） | frontend・② | 画面の入口から PHP が外れる |
| 3（GAS・sync） | GAS・projects/sync の送信先を ② に変える（② に無い request は ① へ渡る） | GAS・sync | 外から ① の gateway を呼ぶ相手がいなくなる |
| 4（① を閉じる） | ① の `/dashboard/api/` を VPS の IP だけ許可にする | ① .htaccess | **dashboard の PHP がインターネットから見えなくなる** |
| 5（移植） | ① だけの request を画面ごとに ② へ（書き込みは ② だけで処理する一覧へ） | ② | ① に頼る部分が減る |
| 6（保存先） | 競合の PDF・K-SNAP の画像のアップロードと配信を ② へ（保存先を決める） | ② | ファイルも ① から外れる |
| 7（DB） | DB を ① から VPS へ（別に判断） | — | ① が乗っ取られてもデータに届かない |

## 決めてほしいこと
1. 段階1：キャンペーンのフォームで ② が落ちたとき、どうするか
   - a. エラーを出す（② の監視が前提）
   - b. 失敗した送信をブラウザに残し、次に開いたときに送り直す
   - c. ① の PHP へ落とすのは残し、ただし送信先を `khg-marketing.info/api/` 以外にはしない（今のまま）
2. 段階4で、② が落ちたら ① も使えなくなる（今は ① の PHP が代わりに処理する）。それを受け入れるか。

## 要確認
- ② の phpFallback が multipart（ファイルのアップロード）を ① へ渡せるか（段階2の前に確認）。
- ① のレンタルサーバーで、.htaccess の `Require ip` が使えるか。② の VPS の外向きの IP。
- GAS・sync の送信先の書き換えができる場所（スクリプトが repo の外にあるもの：introductory の GAS、runPGMail）。
