# 作業記録 2026-11-04-01　セキュリティログ・ログアウトボタン（v2.2.242）

## 依頼（ReadMeClaude.md）
- 新しいブランチで作業開始（→ `v2.2.242`）
- エラーログや侵入の形跡を調べるためのテーブルを用意し、適宜保存してフロントから閲覧できるようにする
- ヘッダー右上に固定でログアウトボタンを置く（right-from-bracket のようなアイコン）
  - クリックしたら api-token を空にする
  - staff テーブルに login と logout を追加して実行日時を記録する（または別の名前の longtext のカラム）

## 決めたこと（2026-11-03〜04 に利用者に確認）
- ログアウトボタンの位置：**案A**。右上の固定パネル（ActiveUser.tsx）の名前の行に置く
  - ⚠️ このパネルは画面の幅が 768px 以上のときだけ出るので、**スマホには出ない**（計画のときに「スマホでも出る」と説明したのは誤り。下の「残っていること」）
- staff には `last_login_at`・`last_logout_at`（DATETIME）だけを足す。履歴は新しい表 `security_log` に残す（longtext の列は作らない）
- 既存の `login_log` は残し、今までどおり書く
- ログアウトした直後だけ、ログイン画面の Google One Tap を止める
- 「要注意」の目印は初期値（下の「仕組み」）
- 「ふだんと違う IP」の判定は今回は入れない（IP を記録するだけ）
- IP・User-Agent を記録する（異常なユーザーやロボットを見つけるため）

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql/ | **2026-11-04_security_log.sql（新規）** | 表 `security_log`、staff に `last_login_at`・`last_logout_at`（ローカルに流した） |
| backend/scripts/sql/ | **2026-11-04_update_log_2.2.242.sql（新規）** | 更新履歴（no = 341）＋業務ガイド3本（ローカルに流した） |
| backend/src/core/ | **security_log.php（新規）** | ① で書く `securityLog()`・接続元 `securityLogClient()`・致命的エラーの記録 `securityLogRegisterFatalHandler()` |
| backend/src/ | index.php | 不正な request（400）・転送専用で ② に届かない（502）・存在しない request（404）を記録。致命的エラーの記録を登録 |
| backend/src/core/ | authz.php | `requireStaff` の 401、`requireAuthority`・`requireShop` の 403 を記録 |
| backend/src/core/ | express_proxy.php | ② へ転送するとき `X-Client-IP`・`X-Client-UA`・`X-Client-Referer` を渡す。`security_log_list` を `expressProxyRequests()` と `expressProxyExclusive()` の両方に |
| backend/src/handlers/ | login.php | ログインの成功（`last_login_at` も）・失敗（Google の確認に失敗／名簿にない（ドメインだけ））を記録 |
| backend/src/handlers/ | **logout.php（新規）** | `api_token` を空に・`last_logout_at`・記録 |
| backend-express/src/features/ | **securityLog.ts（新規）** | ② で書く `recordSecurityEvent`・一覧 `listSecurityLog` |
| backend-express/src/gateway/ | index.ts | 不正な request（400）・ループ検知（502）・認証の 401/403・業務処理が返した 401/403 を記録 |
| backend-express/src/gateway/ | auth.ts | 403 のとき拒否した人も返す（記録に人を残すため） |
| backend-express/src/gateway/ | phpFallback.ts | ① へ転送するとき `x-client-ip`（req.ip）を付ける |
| backend-express/src/gateway/ | registry.ts | `security_log_list`（master） |
| backend-express/src/middlewares/ | errorHandler.ts | 500（想定外）・REST の 401/403・存在しないパス（404）を記録 |
| frontend/src/components/header/system/ | **SecurityLog.tsx（新規）** | 画面（ヘッダー「システム管理 → セキュリティログ」`/securityLog`。Master だけ） |
| frontend/src/components/header/ | headerScreens.tsx | 「セキュリティログ」を追加（allow: Master） |
| frontend/src/utils/ | **logout.ts（新規）** | ログアウトの処理 |
| frontend/src/components/ | ActiveUser.tsx | 名前の行にログアウトのボタン（fa-right-from-bracket。確認つき） |
| frontend/src/components/ | Login.tsx | ログアウト直後は One Tap を出さず「ログアウトしました。」を出す。ログインに成功したら目印を消す |
| frontend/src/components/guide/ | guideScreens.ts | `'セキュリティログ': { header: 'システム管理/セキュリティログ', authority: ['Master'] }` |
| frontend/src/utils/ | version.ts | 2.2.242 |
| backend/scripts/guide/articles/common/ | **screen-195.md（新規）**・screen-170.md・screen-105.md | 下の「業務ガイド」 |
| docs/ | deploy-v2.2.242.md（新規） | デプロイ手順 |
| docs/oldDocument/ | 3本を移動 | deploy-v2.2.238.md・task-2026-11-02-01・task-2026-11-02-02（作って2日） |

## 仕組み
### 表 security_log（1件1行）
- 列：occurred_at・last_at・count・server（php/express）・event・status・request・roll・staff_id・staff_name・ip・via_ip・user_agent・path（Referer のパス）・message・bucket
- 種類（event）：
  - `login`・`login_failed`・`logout`：ログイン・ログアウトの記録
  - `auth_failed`（401）・`forbidden`（403）：認証・権限で弾いたもの
  - `bad_request`（400）・`unknown_request`（404）：不正な要求・存在しない処理を呼んだもの
  - `server_error`（500）・`proxy_error`（502）：サーバー側の問題
- **まとめ方**：`auth_failed`・`forbidden`・`bad_request`・`unknown_request` は「サーバー・種類・IP・request・roll・人・1分」が同じものを1行にまとめ、`count` を増やす（`bucket` = SHA1。UNIQUE。`ON DUPLICATE KEY UPDATE`）。ほかの種類はまとめない（bucket は NULL）
- **日時は DB の `NOW()`**：① と ② の時計がずれていても揃う。一覧の既定の期間も DB の `CURDATE()` で決める
- **古い行**：180日より前の行は、書くとき（500回に1回）と一覧を開いたときに消す（1回に5000行まで）
- **書き込みに失敗しても本来の処理は止めない**：① は例外を握って error_log へ。② は待たずに投げて logger へ
- message にパスワード・トークン・メールアドレス・お客様の情報を入れない
  - 名簿にないアカウントでのログイン失敗は、ドメインだけを残す（例 `*@gmail.com`）
  - PHP の致命的エラーは、ファイル名と行だけを残す（サーバーのパスは残さない）
  - ② の 500 は、エラーの種類と1行目の先頭200字だけを残す

### 接続元（IP）
- 画面からの通信は ① を経由するので、② から見た相手は ① になる
- そこで ① は ② へ転送するときに `X-Client-IP`（REMOTE_ADDR）・`X-Client-UA`・`X-Client-Referer` を付ける
- ② は `X-Forwarded-By: xserver-php` が付いているときだけ、その値を `ip` にする。直接の相手（req.ip。Caddy の後ろなので trust proxy で実際の相手）は `via_ip` に残す
- 逆方向（② → ① の転送）では、② が `x-client-ip` に req.ip を付ける。① は `X-Forwarded-By` があるときだけ使い、REMOTE_ADDR を `via_ip` に残す
- ⚠️ 名乗りの値は偽れるので、偽れない直接の相手（via_ip）を必ず一緒に残している。`ip` と `via_ip` が違えば中継されている

### 要注意の目印（一覧で計算。期間だけで数え、画面の絞り込みには左右されない）
- 同じ IP から1分に失敗（401・403・400・404）30回以上
- 同じ IP から5分にログイン失敗5回以上
- 同じ IP から1時間に、存在しない処理（400・404）10回以上
- User-Agent が空、またはツールの名前（curl・python・headless・bot・sqlmap など）

### 一覧（security_log_list・Master だけ）
- 本文：from・to（YYYY-MM-DD。既定は直近7日）・event・ip（ip か via_ip に一致）・q（人・request・パス・メッセージ・User-Agent の一部）
- 返すもの：rows（新しい順に2000行まで。超えたら truncated）・totals（種類ごとの件数。count の合計）・ipCount・flags（IP → 理由）・thresholds

### ログアウト
1. 右上のパネルのアイコンを押す → 「ログアウトしますか？」
2. ① の `logout` で `api_token` を空にし、`last_logout_at` と `logout` の記録を残す
   - UPDATE の条件に今のトークンも入れているので、調べてから空にするまでの間に別の端末で入り直した新しいトークンは消さない
3. 通信に失敗しても、画面側は次の処理を必ず行う
   - `googleLogout()` を呼ぶ
   - sessionStorage に `just_logged_out` を付ける
   - localStorage の token・authority・userName・shopName を消す（category は残す）
   - `/dashboard/login` へ移る
4. ログイン画面は、`just_logged_out` があると One Tap を出さず、「ログアウトしました。」を出す。ログインに成功したら目印を消す
- ⚠️ api_token は1人1本なので、ほかの端末も、次に画面を移ったときにログイン画面に戻る

## 業務ガイド（直した記事）
- **セキュリティログ（新規・全事業共通・sort 195）**：記録される種類、見方、要注意の目印、社内の回線では同じ IP に見えること、保存期間（180日）。「要確認：不審なアクセスが続くときの連絡先と対応は社内ルールを確かめる」を入れた
- **アクティブユーザー（右上のパネル）**：ログアウトのボタンと「ログアウト」の節を追加。ほかの端末も次に画面を移ったときにログイン画面に戻ること、共用のパソコンではログアウトすること、スマホにはボタンが無いことを書いた
- **ヘッダーのメニュー**：見られる人に「セキュリティログ：管理者だけ」、項目ごとの記事に [[セキュリティログ]] を追加

## テスト（ローカル）
- ② 型チェック・① PHP の構文チェック（php -l。6ファイル）・フロントの型チェック・本番用ビルド、いずれも通過。新しいファイルに lint の警告なし
- ① 経由（curl）
  - トークンなしで `security_log_list` → 401（② に届いている）
  - Manager のトークン → 403
  - Master → 200
  - それぞれ記録が残ることを DB で確かめた（401 は1分の中で `×2` にまとまる。ip は ① から渡した値、via_ip は ① のコンテナ）
- ① の記録
  - 存在しない request（404）・`../etc`（400）・トークンなしの logout（401）
  - Google の認証情報なしの login（login_failed）
  - Manager で Master 専用の PHP（credential_list）を呼ぶ → 403（人と「必要: Master」が残る）
  - 一時的なテスト用のハンドラを置いて PHP の致命的エラーを起こし、server_error がパス抜きで残ることを確かめた（ハンドラはすぐ消した）
- ② の記録：② に直接 `GET /wp-login.php` → unknown_request（404）
- ロボットの真似（User-Agent `python-requests`、存在しない request を35回）→ 1行（×35）にまとまり、その IP に「1分に失敗 35 回」「1時間に存在しない処理を 38 回」「ツールの User-Agent」が付いた
- Playwright（3100）
  - Master：メニューに「セキュリティログ」が出る。画面の KPI・要注意の札・表・期間の既定（直近7日）を確かめた。種類で絞る・要注意だけ・IP を押して絞る・件数で並べ替え、1024px でもはみ出さない
  - Manager：メニューに出ない。`/securityLog` を直接開くと「この画面を見る権限がありません」
  - ログアウト：確認で「キャンセル」なら何も起きない。「OK」でログイン画面へ移り、「ログアウトしました。」が出る。localStorage の token・authority が消え、DB の api_token が空、`last_logout_at` と `logout` の記録が残る。古いトークンでの通信は 401
  - 業務ガイド：新しい記事3本が表示され、「セキュリティログを開く」のボタンが付き、壊れたボタンが無い
- 後片付け：テスト用スタッフ（id 999999）と、テストで入れたセキュリティログの行を削除。開発サーバー（3100）を止めた

## リファクタリング
- securityLog.ts：日付を JavaScript で求める関数を消して DB の日付にした。行の組み立てを短くし、余分な空行を消した
- ツールの User-Agent の目印を「返す行」ではなく「期間」で数えるようにした（ほかの目印とそろえた）
- 整理のあと、② の型チェック・① 経由の確認・Playwright をもう一度通した

## 残っていること・気になること
- ⚠️ **スマホにはログアウトのボタンが無い**（右上のパネルが PC だけのため）。必要ならスマホのメニュー（左のハンバーガー）に足す
- ⚠️ **本番の ① で REMOTE_ADDR が利用者の本当の IP になっているか**は、デプロイ後に一覧で確かめる。レンタルサーバーの前段の中継の IP が入る場合は、取り方を変える必要がある
- ① の PHP ハンドラ（約170本）の多くは、もともと認証を確かめていない（authz.php の注記のとおり）。そこへの不正な呼び出しは「認証の失敗」としては残らない。今回は記録の仕組みまでで、認証の強化は別の課題
- 記録しているのは失敗・エラーだけなので、「正常なアクセスの量」からロボットを見つけることはできない（今回の決定どおり）
- 右上のパネルが、画面の右端（セキュリティログの絞り込みバーの「要注意の IP だけ」など）に重なる。パネルは動かすか隠せる（前からある重なり）

---

## 追加したファイル（全文）

### backend/scripts/sql/2026-11-04_security_log.sql
```sql
-- =====================================================================
-- v2.2.242 セキュリティログ（security_log）と、staff の最後のログイン／ログアウト日時
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何度流しても同じ結果になる（IF NOT EXISTS）
-- ⚠️ update_log の SQL（2026-11-04_update_log_2.2.242.sql）より先に流すこと
--
-- 書く場所:
--   ① backend/src/core/security_log.php（ログイン・ログアウト・401/403・不正な request・存在しない request・502・PHP の致命的エラー）
--   ② backend-express/src/features/securityLog.ts（ゲートウェイの 401/403・ループ検知・500・存在しないパス）
-- 読む場所: ② security_log_list（Master だけ）→ 画面「システム管理 → セキュリティログ」
--
-- ⚠️ 失敗の連打（401・404 など）は「同じ種類・同じ IP・同じ request・同じ人・同じ1分」を1行にまとめ、count を数える（bucket）。
--   ⚠️ ログイン・ログアウト・ログインの失敗・500・502 はまとめない（bucket は NULL）。
-- ⚠️ 180日より古い行は、書くとき（ときどき）と一覧を開いたときに消す。
-- ⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れないこと。
-- =====================================================================

CREATE TABLE IF NOT EXISTS security_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  occurred_at DATETIME        NOT NULL COMMENT '最初に起きた日時（まとめた行は、その1分の最初）',
  last_at     DATETIME        NOT NULL COMMENT '最後に起きた日時（まとめた行で count が増えると更新）',
  count       INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'まとめた件数',
  server      VARCHAR(8)      NOT NULL COMMENT 'php（①）/ express（②）',
  event       VARCHAR(32)     NOT NULL COMMENT 'login / login_failed / logout / auth_failed / forbidden / bad_request / unknown_request / server_error / proxy_error',
  status      SMALLINT        NULL     COMMENT '返した HTTP ステータス',
  request     VARCHAR(100)    NOT NULL DEFAULT '' COMMENT 'request（② の存在しないパスはパス）',
  roll        VARCHAR(100)    NOT NULL DEFAULT '',
  staff_id    INT             NULL,
  staff_name  VARCHAR(100)    NOT NULL DEFAULT '',
  ip          VARCHAR(45)     NOT NULL DEFAULT '' COMMENT '接続元（② では ① から渡された値）',
  via_ip      VARCHAR(45)     NOT NULL DEFAULT '' COMMENT '直接つないできた相手（① を経由したとき ① の IP。ip と違えば中継されている）',
  user_agent  VARCHAR(255)    NOT NULL DEFAULT '',
  path        VARCHAR(255)    NOT NULL DEFAULT '' COMMENT 'どの画面から（Referer のパス）',
  message     VARCHAR(500)    NOT NULL DEFAULT '',
  bucket      CHAR(40)        NULL     COMMENT 'まとめる行の鍵（SHA1）。まとめない行は NULL',
  PRIMARY KEY (id),
  UNIQUE KEY uq_security_log_bucket (bucket),
  KEY idx_security_log_time (occurred_at),
  KEY idx_security_log_ip (ip, occurred_at),
  KEY idx_security_log_event (event, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='セキュリティログ（v2.2.242）';

-- staff の最後のログイン／ログアウト（⚠️ 履歴は security_log。⚠️ login_log も今までどおり書く）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at  DATETIME NULL COMMENT '最後にログインした日時（v2.2.242）';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_logout_at DATETIME NULL COMMENT '最後にログアウトした日時（v2.2.242）';

-- 確認（security_log の件数が出て、staff の列が2つ出ればよい）
SELECT COUNT(*) AS security_log_rows FROM security_log;
SHOW COLUMNS FROM staff LIKE 'last_log%';
```

### backend/src/core/security_log.php
```php
<?php

/**
 * セキュリティログ（security_log）を ① で書く（v2.2.242 新規）。
 *
 * ─────────────────────────────────────────────
 *   表 : backend/scripts/sql/2026-11-04_security_log.sql
 *   ② 側の同じ処理 : backend-express/src/features/securityLog.ts（⚠️ まとめ方・列の長さを揃えること）
 *   画面 : frontend/src/components/header/system/SecurityLog.tsx（読むのは ② の security_log_list）
 *
 * ⚠️⚠️ **ここで失敗しても本来の処理を止めない。** 例外は握って error_log にだけ残す。
 * ⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れないこと。
 * ⚠️ 失敗の連打（SECURITY_LOG_AGGREGATE の種類）は「同じ種類・IP・request・人・1分」を1行にまとめる。
 * ─────────────────────────────────────────────
 */

/** まとめる種類（⚠️ ② の AGGREGATE_EVENTS と同じ） */
const SECURITY_LOG_AGGREGATE = ['auth_failed', 'forbidden', 'bad_request', 'unknown_request'];

/** 古い行を消す日数と、書くときに掃除する確率（⚠️ ② と同じ） */
const SECURITY_LOG_KEEP_DAYS = 180;
const SECURITY_LOG_CLEANUP_ONE_IN = 500;

/** 長さで切る（⚠️ 表の列の長さ。⚠️ 改行などの制御文字は空白に） */
function securityLogText($value, int $max): string
{
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$value) ?? '';
    return mb_substr(trim($text), 0, $max);
}

/** IP の形をしているときだけ返す（⚠️ ヘッダーの値は利用者が自由に書けるため） */
function securityLogIp($value): string
{
    $ip = trim((string)$value);
    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
}

/**
 * 接続元。
 * ⚠️ ② から転送されてきたとき（X-Forwarded-By: express-gateway）は、② が渡す X-Client-IP を接続元にし、
 *   直接つないできた相手（② の IP）を via_ip に残す。⚠️ ip と via_ip が違えば中継されている。
 *   ⚠️ 名乗りは偽れるので、via_ip（REMOTE_ADDR。偽れない）を必ず一緒に残す。
 */
function securityLogClient(): array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $remote = securityLogIp($_SERVER['REMOTE_ADDR'] ?? '');
    $forwardedBy = (string)($headers['X-Forwarded-By'] ?? $headers['x-forwarded-by'] ?? '');
    $claimed = securityLogIp($headers['X-Client-IP'] ?? $headers['x-client-ip'] ?? '');
    $viaGateway = $forwardedBy !== '' && $claimed !== '';
    $referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $path = $referer === '' ? '' : (string)(parse_url($referer, PHP_URL_PATH) ?? '');
    return [
        'ip' => $viaGateway ? $claimed : $remote,
        'via_ip' => $viaGateway ? $remote : '',
        'user_agent' => securityLogText($_SERVER['HTTP_USER_AGENT'] ?? '', 255),
        'path' => securityLogText($path, 255),
    ];
}

/**
 * 1件書く。
 *
 * @param array $event event（必須）・status・request・roll・staff（staff の行）・message
 * @param PDO|null $pdo 無ければ $GLOBALS['pdo']（db.php が作る）
 */
function securityLog(array $event, ?PDO $pdo = null): void
{
    $pdo = $pdo ?? ($GLOBALS['pdo'] ?? null);
    if (!($pdo instanceof PDO)) return;

    try {
        $client = securityLogClient();
        $type = securityLogText($event['event'] ?? '', 32);
        $staff = is_array($event['staff'] ?? null) ? $event['staff'] : [];
        $staffId = isset($staff['id']) ? (int)$staff['id'] : null;
        $request = securityLogText($event['request'] ?? ($GLOBALS['request'] ?? ''), 100);
        $data = $GLOBALS['data'] ?? [];
        $roll = securityLogText($event['roll'] ?? (is_array($data) && is_scalar($data['roll'] ?? null) ? $data['roll'] : ''), 100);
        // ⚠️ まとめる鍵（⚠️ 1分は DB の NOW() で区切る。② と同じ並び）
        $key = in_array($type, SECURITY_LOG_AGGREGATE, true)
            ? implode('|', ['php', $type, $client['ip'], $request, $roll, (string)($staffId ?? '')])
            : '';

        $stmt = $pdo->prepare(
            "INSERT INTO security_log
               (occurred_at, last_at, count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message, bucket)
             VALUES (NOW(), NOW(), 1, 'php', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     IF(? = '', NULL, SHA1(CONCAT(?, '|', DATE_FORMAT(NOW(), '%Y%m%d%H%i')))))
             ON DUPLICATE KEY UPDATE count = count + 1, last_at = NOW()"
        );
        $stmt->execute([
            $type,
            isset($event['status']) ? (int)$event['status'] : null,
            $request,
            $roll,
            $staffId,
            securityLogText($staff['name'] ?? '', 100),
            $client['ip'],
            $client['via_ip'],
            $client['user_agent'],
            $client['path'],
            securityLogText($event['message'] ?? '', 500),
            $key,
            $key,
        ]);

        if (random_int(1, SECURITY_LOG_CLEANUP_ONE_IN) === 1) {
            $pdo->exec('DELETE FROM security_log WHERE occurred_at < NOW() - INTERVAL ' . SECURITY_LOG_KEEP_DAYS . ' DAY LIMIT 5000');
        }
    } catch (Throwable $e) {
        error_log('security_log: 書き込みに失敗しました（' . $e->getMessage() . '）');
    }
}

/**
 * PHP の致命的エラー（キャッチされない例外を含む）を server_error として残す。⚠️ index.php で1回だけ呼ぶ。
 * ⚠️ 応答の中身は変えない（記録するだけ）。
 */
function securityLogRegisterFatalHandler(): void
{
    register_shutdown_function(static function (): void {
        $error = error_get_last();
        if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
        // ⚠️ メッセージにはファイルの場所が入るので、ファイル名と行だけにする（⚠️ サーバーのパスを残さない）
        $first = strtok((string)$error['message'], "\n");
        securityLog([
            'event' => 'server_error',
            // ⚠️ 実際に返したステータス（⚠️ PHP の致命的エラーは、何もしなければ 200 のまま返る）
            'status' => http_response_code() ?: null,
            'message' => basename((string)$error['file']) . ':' . $error['line'] . ' ' . preg_replace('#(/[^\s:]+)+/#', '', (string)$first),
        ]);
    });
}
```

### backend/src/handlers/logout.php
```php
<?php

/**
 * ログアウト（v2.2.242 新規）。右上のパネル（frontend/src/components/ActiveUser.tsx）のボタンから呼ぶ。
 *
 * リクエスト:
 *   { "request": "logout" }（⚠️ トークンは Token ヘッダー。apiClient が付ける）
 *
 * ─────────────────────────────────────────────
 * ⚠️ staff.api_token を空にする。⚠️ api_token は1人1本なので、⚠️ **ほかの端末でも同時にログアウトになる**
 *   （⚠️ ログインし直すと別の端末が落ちるのと同じ仕組み。login.php の注記を参照）。
 * ⚠️ 最後のログアウト日時（staff.last_logout_at）と、セキュリティログに logout を残す。
 * ⚠️ トークンが無効でも、画面は自分の保存した値を消してログイン画面へ移る（frontend/src/utils/logout.ts）。
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/authz.php';

$staff = requireStaff($pdo, $headers);
$token = $headers['Token'] ?? $headers['token'] ?? '';

try {
    // ⚠️ トークンも条件に入れる（⚠️ 調べてから空にするまでの間に、別の端末で入り直した新しいトークンは消さない）
    $stmt = $pdo->prepare("UPDATE staff SET api_token = '', last_logout_at = NOW() WHERE id = ? AND api_token = ?");
    $stmt->execute([$staff['id'], $token]);
} catch (PDOException $e) {
    error_log('logout: 更新に失敗しました（' . $e->getMessage() . '）');
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'ログアウトの記録に失敗しました。'], JSON_UNESCAPED_UNICODE);
    exit;
}

securityLog(['event' => 'logout', 'status' => 200, 'staff' => $staff], $pdo);

echo json_encode(['status' => 'ok'], JSON_UNESCAPED_UNICODE);
```

### backend-express/src/features/securityLog.ts
```tsx
import type { Request } from 'express';
import { isIP } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';
import type { SqlParam } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * セキュリティログ（security_log）。v2.2.242 新規。
 *
 * ─────────────────────────────────────────────
 *   recordSecurityEvent … ② で起きた 401・403・ループ検知（502）・500・存在しないパス（404）・不正な request（400）を書く
 *   listSecurityLog     … security_log_list（⚠️ Master だけ）。画面: frontend/src/components/header/system/SecurityLog.tsx
 *
 *   表 : backend/scripts/sql/2026-11-04_security_log.sql
 *   ① 側の同じ処理 : backend/src/core/security_log.php（⚠️ まとめ方・列の長さを揃えること）
 *
 * ⚠️⚠️ **書くのに失敗しても本来の処理を止めない。** 待たずに投げ、失敗は logger にだけ残す。
 * ⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れないこと。
 * ⚠️ 画面からの通信は ① を経由するので、② から見た接続元は ① になる。
 *   ⚠️ ① が付ける X-Client-IP は、X-Forwarded-By（xserver-php）が付いているときだけ接続元として使い、
 *     ⚠️ 直接の相手（req.ip。Caddy の後ろなので trust proxy で実際の相手）を via_ip に残す（名乗りは偽れるため）。
 * ─────────────────────────────────────────────
 */

export type SecurityEvent =
  | 'login' | 'login_failed' | 'logout'
  | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request'
  | 'server_error' | 'proxy_error';

/** まとめる種類（⚠️ ① の SECURITY_LOG_AGGREGATE と同じ） */
const AGGREGATE_EVENTS: ReadonlySet<SecurityEvent> = new Set(['auth_failed', 'forbidden', 'bad_request', 'unknown_request']);

/** 古い行を消す日数と、書くときに掃除する確率（⚠️ ① と同じ） */
const KEEP_DAYS = 180;
const CLEANUP_ONE_IN = 500;

/** 長さで切る（⚠️ 表の列の長さ。⚠️ 改行などの制御文字は空白に） */
const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);

/** IP の形をしているときだけ返す（⚠️ IPv4 を表す IPv6（::ffff:）は IPv4 に戻す） */
const ipOf = (value: unknown): string => {
  const raw = String(value ?? '').trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return isIP(raw) === 0 ? '' : raw;
};

const pathOf = (referer: string): string => {
  if (referer === '') return '';
  try {
    return new URL(referer).pathname;
  } catch {
    return '';
  }
};

/** 接続元（上の注記） */
const clientOf = (req: Request): { ip: string; viaIp: string; userAgent: string; path: string } => {
  const direct = ipOf(req.ip);
  const fromPhp = (req.header('X-Forwarded-By') ?? '').includes('xserver-php');
  const claimed = fromPhp ? ipOf(req.header('X-Client-IP')) : '';
  const viaPhp = claimed !== '';
  return {
    ip: viaPhp ? claimed : direct,
    viaIp: viaPhp ? direct : '',
    userAgent: text(viaPhp ? req.header('X-Client-UA') : req.header('User-Agent'), 255),
    path: text(pathOf(String((viaPhp ? req.header('X-Client-Referer') : req.header('Referer')) ?? '')), 255),
  };
};

export interface SecurityEventInput {
  event: SecurityEvent;
  status?: number;
  request?: string;
  roll?: string;
  staff?: { id?: number | string | null; name?: string | null } | null;
  message?: string;
}

/**
 * 1件書く。⚠️ 待たない（呼び出し側は await しない）。⚠️ 失敗しても例外を投げない。
 */
export const recordSecurityEvent = (req: Request, input: SecurityEventInput): void => {
  void (async () => {
    try {
      const client = clientOf(req);
      const request = text(input.request, 100);
      const roll = text(input.roll, 100);
      const staffId = input.staff?.id === undefined || input.staff?.id === null ? null : Number(input.staff.id);
      // ⚠️ まとめる鍵（⚠️ 1分は DB の NOW() で区切る。① と同じ並び）
      const key = AGGREGATE_EVENTS.has(input.event)
        ? ['express', input.event, client.ip, request, roll, staffId === null ? '' : String(staffId)].join('|')
        : '';
      const params: SqlParam[] = [
        input.event, input.status ?? null, request, roll, staffId, text(input.staff?.name, 100),
        client.ip, client.viaIp, client.userAgent, client.path, text(input.message, 500), key, key,
      ];
      await execute(
        `INSERT INTO security_log
           (occurred_at, last_at, count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message, bucket)
         VALUES (NOW(), NOW(), 1, 'express', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 IF(? = '', NULL, SHA1(CONCAT(?, '|', DATE_FORMAT(NOW(), '%Y%m%d%H%i')))))
         ON DUPLICATE KEY UPDATE count = count + 1, last_at = NOW()`,
        params
      );
      if (Math.floor(Math.random() * CLEANUP_ONE_IN) === 0) await cleanup();
    } catch (error) {
      logger.error('security_log: 書き込みに失敗しました', error instanceof Error ? error.message : error);
    }
  })();
};

const cleanup = async (): Promise<void> => {
  await execute(`DELETE FROM security_log WHERE occurred_at < NOW() - INTERVAL ${KEEP_DAYS} DAY LIMIT 5000`);
};

// ---------------------------------------------------------------------------
// 一覧（security_log_list）
// ---------------------------------------------------------------------------

/**
 * 「要注意」の目印の基準（初期値。2026-11-04 に利用者が了承）。⚠️ 画面にもこの値を出す（thresholds）。
 *   ⚠️ 記録しているのは失敗・エラーだけ（正常なアクセスは残していない）。⚠️ なので回数は「失敗の回数」。
 */
const THRESHOLDS = {
  /** 同じ IP から1分の失敗（401・403・400・404）がこの回数以上 */
  failuresPerMinute: 30,
  /** 同じ IP から5分のログインの失敗がこの回数以上 */
  loginFailuresPer5Min: 5,
  /** 同じ IP から1時間の「存在しない request・パス」（400・404）がこの回数以上 */
  probesPerHour: 10,
};

/** ツールや自動操作の User-Agent（⚠️ 空も含める） */
const TOOL_AGENT = /curl|wget|python|httpclient|go-http|java\/|okhttp|axios\/|node-fetch|undici|headless|phantomjs|selenium|puppeteer|playwright|bot\b|crawl|spider|scan|zgrab|masscan|nmap|sqlmap|nikto/i;

/** 一度に返す行の上限（⚠️ 画面に出すのは新しい順にこの数まで） */
const MAX_ROWS = 2000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EVENTS: ReadonlySet<string> = new Set([
  'login', 'login_failed', 'logout', 'auth_failed', 'forbidden', 'bad_request', 'unknown_request', 'server_error', 'proxy_error',
]);

interface LogRow extends RowDataPacket {
  id: number; occurred_at: string; last_at: string; count: number; server: string; event: string; status: number | null;
  request: string; roll: string; staff_id: number | null; staff_name: string; ip: string; via_ip: string;
  user_agent: string; path: string; message: string;
}
interface CountRow extends RowDataPacket { event: string; total: string | number }
interface IpRow extends RowDataPacket { ip: string; peak: string | number }
interface NumRow extends RowDataPacket { n: string | number }
interface AgentRow extends RowDataPacket { ip: string; user_agent: string }
interface RangeRow extends RowDataPacket { from_day: string; to_day: string }

/**
 * 一覧。⚠️ 期間（from・to。日付）は既定で直近7日。⚠️ 開いたときに古い行も消す。
 * 本文: from / to（YYYY-MM-DD）・event・ip・q（人・request・パス・メッセージの一部）
 */
export const listSecurityLog = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  await cleanup().catch((error) => logger.error('security_log: 古い行の削除に失敗しました', error));

  // ⚠️ 既定の期間は DB の日付で決める（⚠️ occurred_at は DB の NOW()。サーバーの時計と DB の時計がずれていても合う）
  const [today] = await query<RangeRow>(
    "SELECT DATE_FORMAT(CURDATE() - INTERVAL 6 DAY, '%Y-%m-%d') AS from_day, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS to_day"
  );
  const from = DAY.test(String(body.from ?? '')) ? String(body.from) : today.from_day;
  const to = DAY.test(String(body.to ?? '')) ? String(body.to) : today.to_day;
  const event = EVENTS.has(String(body.event ?? '')) ? String(body.event) : '';
  const ip = text(body.ip, 45);
  const q = text(body.q, 100);

  // ⚠️ 期間は to の日の終わりまで（⚠️ 文字列で比べる。occurred_at は DATETIME）
  const range = ['occurred_at >= ?', 'occurred_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const rangeParams: SqlParam[] = [from, to];
  const where = [...range];
  const params: SqlParam[] = [...rangeParams];
  if (event !== '') { where.push('event = ?'); params.push(event); }
  if (ip !== '') { where.push('(ip = ? OR via_ip = ?)'); params.push(ip, ip); }
  if (q !== '') {
    where.push('(staff_name LIKE ? OR request LIKE ? OR path LIKE ? OR message LIKE ? OR user_agent LIKE ?)');
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like, like, like);
  }

  const rows = await query<LogRow>(
    `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%d %H:%i:%s') AS occurred_at, DATE_FORMAT(last_at, '%Y-%m-%d %H:%i:%s') AS last_at,
            count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message
       FROM security_log WHERE ${where.join(' AND ')}
      ORDER BY occurred_at DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
    params
  );
  const truncated = rows.length > MAX_ROWS;

  // ⚠️ KPI と目印は ⚠️ **期間だけ**で数える（⚠️ 種類・IP・キーワードの絞り込みに左右されない）
  const totals = await query<CountRow>(
    `SELECT event, SUM(count) AS total FROM security_log WHERE ${range.join(' AND ')} GROUP BY event`,
    rangeParams
  );
  const ipCount = await query<NumRow>(
    `SELECT COUNT(DISTINCT ip) AS n FROM security_log WHERE ${range.join(' AND ')} AND ip <> ''`,
    rangeParams
  );

  const flags: Record<string, string[]> = {};
  const flag = (target: string, reason: string): void => {
    if (target === '') return;
    (flags[target] ??= []).push(reason);
  };
  const failureBursts = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, DATE_FORMAT(occurred_at, '%Y%m%d%H%i') AS m, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event IN ('auth_failed', 'forbidden', 'bad_request', 'unknown_request') GROUP BY ip, m
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.failuresPerMinute]
  );
  failureBursts.forEach((r) => flag(r.ip, `1分に失敗 ${Number(r.peak)} 回`));
  const loginBursts = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, FLOOR(UNIX_TIMESTAMP(occurred_at) / 300) AS w, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event = 'login_failed' GROUP BY ip, w
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.loginFailuresPer5Min]
  );
  loginBursts.forEach((r) => flag(r.ip, `5分にログイン失敗 ${Number(r.peak)} 回`));
  const probes = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, DATE_FORMAT(occurred_at, '%Y%m%d%H') AS h, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event IN ('bad_request', 'unknown_request') GROUP BY ip, h
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.probesPerHour]
  );
  probes.forEach((r) => flag(r.ip, `1時間に存在しない処理を ${Number(r.peak)} 回`));
  const agents = await query<AgentRow>(
    `SELECT DISTINCT ip, user_agent FROM security_log
      WHERE ${range.join(' AND ')} AND event NOT IN ('login', 'logout') LIMIT 5000`,
    rangeParams
  );
  agents.forEach((r) => {
    if (r.user_agent === '') flag(r.ip, 'User-Agent が空');
    else if (TOOL_AGENT.test(r.user_agent)) flag(r.ip, 'ツールの User-Agent');
  });

  const out = rows.slice(0, MAX_ROWS).map((r) => ({
    id: Number(r.id), occurredAt: r.occurred_at, lastAt: r.last_at, count: Number(r.count), server: r.server, event: r.event,
    status: r.status === null ? null : Number(r.status), request: r.request, roll: r.roll,
    staffId: r.staff_id === null ? null : Number(r.staff_id), staffName: r.staff_name,
    ip: r.ip, viaIp: r.via_ip, userAgent: r.user_agent, path: r.path, message: r.message,
  }));
  // ⚠️ 同じ理由が何度も入らないように
  Object.keys(flags).forEach((k) => { flags[k] = Array.from(new Set(flags[k])); });

  return {
    status: 'ok',
    from, to,
    totals: Object.fromEntries(totals.map((t) => [t.event, Number(t.total)])),
    ipCount: Number(ipCount[0]?.n ?? 0),
    flags,
    thresholds: THRESHOLDS,
    rows: out,
    truncated,
    maxRows: MAX_ROWS,
  };
};
```

### frontend/src/components/header/system/SecurityLog.tsx
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';

/**
 * セキュリティログ（v2.2.242 新規）。ヘッダーの「システム管理 → セキュリティログ」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② security_log_list（backend-express/src/features/securityLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは ①（backend/src/core/security_log.php）と ②（recordSecurityEvent）。
 *
 * ⚠️ 記録しているのは、ログイン・ログアウトと、失敗・エラーだけ（⚠️ 正常なアクセスは残していない）。
 * ⚠️ 失敗の連打は「同じ種類・IP・処理・人・1分」で1行にまとめ、件数（×N）で出す。
 * ⚠️ KPI と「要注意の IP」は期間だけで数える（⚠️ 種類・IP・キーワードの絞り込みに左右されない）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 sl_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

type EventKey = 'login' | 'login_failed' | 'logout' | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request' | 'server_error' | 'proxy_error';

interface LogRow {
    id: number;
    occurredAt: string;
    lastAt: string;
    count: number;
    server: string;
    event: EventKey;
    status: number | null;
    request: string;
    roll: string;
    staffId: number | null;
    staffName: string;
    ip: string;
    viaIp: string;
    userAgent: string;
    path: string;
    message: string;
}

interface Thresholds { failuresPerMinute: number; loginFailuresPer5Min: number; probesPerHour: number }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: Partial<Record<EventKey, number>>;
    ipCount: number;
    flags: Record<string, string[]>;
    thresholds: Thresholds;
    rows: LogRow[];
    truncated: boolean;
    maxRows: number;
}

/** 種類の名前と色（⚠️ 赤＝要確認・黄＝失敗・紫＝探り・緑＝成功・灰＝ログアウト） */
const EVENTS: Record<EventKey, { label: string; tone: 'ok' | 'muted' | 'warn' | 'probe' | 'bad' }> = {
    login: { label: 'ログイン', tone: 'ok' },
    logout: { label: 'ログアウト', tone: 'muted' },
    login_failed: { label: 'ログイン失敗', tone: 'bad' },
    auth_failed: { label: '認証の失敗', tone: 'warn' },
    forbidden: { label: '権限で拒否', tone: 'warn' },
    bad_request: { label: '不正な要求', tone: 'probe' },
    unknown_request: { label: '存在しない処理', tone: 'probe' },
    server_error: { label: 'サーバーエラー', tone: 'bad' },
    proxy_error: { label: '② に届かない', tone: 'bad' },
};
const EVENT_KEYS = Object.keys(EVENTS) as EventKey[];

type SortKey = 'occurredAt' | 'event' | 'count' | 'staffName' | 'ip' | 'request';

const sum = (totals: ListResponse['totals'], keys: EventKey[]): number => keys.reduce((n, k) => n + (totals[k] ?? 0), 0);

const SecurityLog = () => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [event, setEvent] = useState('');
    const [ip, setIp] = useState('');
    const [q, setQ] = useState('');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('occurredAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    /** ⚠️ 期間・種類・IP・キーワードは ② で絞る（⚠️ 新しい順に上限まで返るため、画面で絞ると古い行が抜ける） */
    const load = useCallback(async (filter: { from: string; to: string; event: string; ip: string; q: string }) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'security_log_list', ...filter });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            setFrom(body.from);
            setTo(body.to);
        } catch (e) {
            console.error('セキュリティログの取得に失敗しました:', e);
            setError('セキュリティログを読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日。DB の日付）
    useEffect(() => { void load({ from: '', to: '', event: '', ip: '', q: '' }); }, [load]);

    const apply = (next: Partial<{ event: string; ip: string }> = {}) =>
        void load({ from, to, event: next.event ?? event, ip: next.ip ?? ip, q });

    const flags = useMemo(() => data?.flags ?? {}, [data]);

    const rows = useMemo(() => {
        const list = (data?.rows ?? []).filter((r) => !flaggedOnly || flags[r.ip] !== undefined);
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, flaggedOnly, flags, sortKey, sortOrder]);

    const totals = data?.totals ?? {};
    const flaggedIps = Object.keys(flags);

    const th = (label: string, key: SortKey, width?: number) => {
        const active = sortKey === key;
        return (
            <th className="sl_th sl_th_sort" style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'occurredAt' || key === 'count' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`sl_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: number, tone?: 'bad' | 'warn') => (
        <div className="sl_kpi_card">
            <div className="sl_kpi_label">{label}</div>
            <div className={`sl_kpi_value${tone && value > 0 ? ` is_${tone}` : ''}`}>{value.toLocaleString()}</div>
        </div>
    );

    return (
        <div className="sl_wrap">
            <style>{`
                .sl_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .sl_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .sl_note { font-size: 11px; color: #6b7280; }
                .sl_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .sl_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sl_check { display: flex; align-items: center; gap: 6px; font-size: 12px; padding-bottom: 6px; cursor: pointer; }
                .sl_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .sl_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sl_kpi_label { font-size: 11px; color: #6b7280; }
                .sl_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sl_kpi_value.is_bad { color: #b91c1c; }
                .sl_kpi_value.is_warn { color: #b45309; }
                .sl_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .sl_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .sl_alerts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
                .sl_alert { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 999px; font-size: 11px;
                            padding: 2px 10px; cursor: pointer; }
                .sl_alert:hover { background: #fee2e2; }
                .sl_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .sl_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sl_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sl_th_sort { cursor: pointer; user-select: none; }
                .sl_th_sort:hover { background: #eef2f7; }
                .sl_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sl_sort_icon.is_active { color: #2563eb; }
                .sl_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .sl_row:hover > .sl_td { background: #f8fafc; }
                .sl_row.is_flagged > .sl_td:first-child { box-shadow: inset 3px 0 0 #dc2626; }
                .sl_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sl_sub { font-size: 11px; color: #9ca3af; }
                .sl_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sl_pill.is_ok { background: #dcfce7; color: #166534; }
                .sl_pill.is_muted { background: #f3f4f6; color: #4b5563; }
                .sl_pill.is_warn { background: #fef3c7; color: #92400e; }
                .sl_pill.is_probe { background: #ede9fe; color: #5b21b6; }
                .sl_pill.is_bad { background: #fee2e2; color: #991b1b; }
                .sl_count { font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; white-space: nowrap; }
                .sl_ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; white-space: nowrap; }
                .sl_ip_btn { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; }
                .sl_ip_btn:hover { text-decoration: underline; }
                .sl_flag { display: inline-block; margin-left: 4px; font-size: 10px; font-weight: 700; color: #fff; background: #dc2626;
                           border-radius: 4px; padding: 0 5px; }
                .sl_ua { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4b5563; }
                .sl_msg { min-width: 160px; overflow-wrap: anywhere; }
                .sl_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sl_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sl_inner">
                <div className="sl_note">
                    ログイン・ログアウトと、失敗・エラーの記録です（正常な操作は記録していません）。管理者だけが見られます。
                </div>

                <div className="sl_bar">
                    <div>
                        <div className="sl_label">期間</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={from}
                                onChange={(e) => setFrom(e.target.value)} aria-label="期間の始め" />
                            <span className="sl_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={to}
                                onChange={(e) => setTo(e.target.value)} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="sl_label">種類</div>
                        <select className="form-select form-select-sm" style={{ width: 150 }} value={event}
                            onChange={(e) => { setEvent(e.target.value); apply({ event: e.target.value }); }} aria-label="種類">
                            <option value="">すべて</option>
                            {EVENT_KEYS.map((k) => <option key={k} value={k}>{EVENTS[k].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="sl_label">IP</div>
                        <input className="form-control form-control-sm" style={{ width: 150 }} value={ip} placeholder="例: 203.0.113.5"
                            onChange={(e) => setIp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="IP" />
                    </div>
                    <div>
                        <div className="sl_label">キーワード</div>
                        <input className="form-control form-control-sm" style={{ width: 200 }} value={q} placeholder="人・処理・画面・内容"
                            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="キーワード" />
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                    <label className="sl_check">
                        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
                        要注意の IP だけ
                    </label>
                </div>

                {error !== '' && <div className="sl_error" role="alert">{error}</div>}

                {data && (
                    <>
                        <div className="sl_kpi">
                            {kpi('ログイン', totals.login ?? 0)}
                            {kpi('ログイン失敗', totals.login_failed ?? 0, 'bad')}
                            {kpi('認証の失敗・権限で拒否', sum(totals, ['auth_failed', 'forbidden']), 'warn')}
                            {kpi('不正な要求・存在しない処理', sum(totals, ['bad_request', 'unknown_request']), 'warn')}
                            {kpi('サーバーエラー', sum(totals, ['server_error', 'proxy_error']), 'bad')}
                            {kpi('接続元の IP', data.ipCount)}
                            {kpi('要注意の IP', flaggedIps.length, 'bad')}
                        </div>

                        {flaggedIps.length > 0 && (
                            <div className="sl_alerts">
                                <span className="sl_note">要注意の IP（押すとその IP だけ）:</span>
                                {flaggedIps.map((k) => (
                                    <button type="button" key={k} className="sl_alert" title={flags[k].join(' / ')}
                                        onClick={() => { setIp(k); apply({ ip: k }); }}>
                                        {k}（{flags[k].join('・')}）
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="sl_caution">
                            要注意の目安：同じ IP から 1分に失敗 {data.thresholds.failuresPerMinute} 回以上／5分にログイン失敗 {data.thresholds.loginFailuresPer5Min} 回以上／
                            1時間に存在しない処理 {data.thresholds.probesPerHour} 回以上／User-Agent が空かツールの名前。
                            会社の回線から入ると、社員が同じ IP に見えることがあります。IP の右の小さな文字は、中継したサーバーの IP です。
                            {data.truncated && <><br />⚠️ 新しい順に {data.maxRows.toLocaleString()} 行までを出しています。期間を短くするか、種類・IP で絞ってください。</>}
                        </div>

                        <div className="sl_table_wrap">
                            <table className="sl_table">
                                <thead>
                                    <tr>
                                        {th('日時', 'occurredAt', 150)}
                                        {th('種類', 'event', 120)}
                                        {th('件数', 'count', 60)}
                                        {th('処理', 'request', 160)}
                                        {th('人', 'staffName', 110)}
                                        {th('IP', 'ip', 170)}
                                        <th className="sl_th">画面</th>
                                        <th className="sl_th">User-Agent</th>
                                        <th className="sl_th">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr><td className="sl_td sl_empty" colSpan={9}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
                                    )}
                                    {rows.map((r) => {
                                        const ev = EVENTS[r.event] ?? { label: r.event, tone: 'muted' as const };
                                        const flagged = flags[r.ip] !== undefined;
                                        return (
                                            <tr key={r.id} className={`sl_row${flagged ? ' is_flagged' : ''}`}>
                                                <td className="sl_td sl_time">
                                                    {r.occurredAt}
                                                    {r.count > 1 && r.lastAt !== r.occurredAt && <div className="sl_sub">〜 {r.lastAt.slice(11)}</div>}
                                                </td>
                                                <td className="sl_td">
                                                    <span className={`sl_pill is_${ev.tone}`}>{ev.label}</span>
                                                    <div className="sl_sub">{r.server === 'php' ? '①' : '②'}{r.status !== null ? ` ・ ${r.status}` : ''}</div>
                                                </td>
                                                <td className="sl_td sl_count">{r.count > 1 ? `×${r.count}` : '1'}</td>
                                                <td className="sl_td">{r.request}{r.roll !== '' && <span className="sl_sub"> : {r.roll}</span>}</td>
                                                <td className="sl_td">{r.staffName}</td>
                                                <td className="sl_td sl_ip">
                                                    <button type="button" className="sl_ip_btn" title="この IP だけを出す"
                                                        onClick={() => { setIp(r.ip); apply({ ip: r.ip }); }}>{r.ip}</button>
                                                    {flagged && <span className="sl_flag" title={flags[r.ip].join(' / ')}>要注意</span>}
                                                    {r.viaIp !== '' && <div className="sl_sub">経由 {r.viaIp}</div>}
                                                </td>
                                                <td className="sl_td sl_sub">{r.path}</td>
                                                <td className="sl_td"><div className="sl_ua" title={r.userAgent}>{r.userAgent}</div></td>
                                                <td className="sl_td sl_msg">{r.message}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SecurityLog;
```

### frontend/src/utils/logout.ts
```tsx
import { googleLogout } from '@react-oauth/google';
import apiClient from './apiClient';

/**
 * ログアウト（v2.2.242 新規）。右上のパネル（components/ActiveUser.tsx）のボタンから呼ぶ。
 *
 * ─────────────────────────────────────────────
 * 1. ① の logout（backend/src/handlers/logout.php）で staff.api_token を空にし、日時を残す
 *    ⚠️ 失敗しても（トークンが無効・通信できない）2 以降は必ず行う（⚠️ 画面を閉じられない状態にしない）
 * 2. Google の自動選択を止め、ログイン画面の One Tap を出さない目印を付ける（JUST_LOGGED_OUT。Login.tsx が読む）
 *    ⚠️ 付けないと、ログイン画面に戻った直後に One Tap からそのまま入り直してしまうことがある（2026-11-04 の決定）
 * 3. 保存しているログインの情報を消して、ログイン画面へ（⚠️ 再読み込みで AuthProvider の状態ごと消す）
 * ─────────────────────────────────────────────
 */

/** ⚠️ sessionStorage のキー（⚠️ そのタブだけ。ログインに成功したら Login.tsx が消す） */
export const JUST_LOGGED_OUT = 'just_logged_out';

/** ⚠️ 消す値（⚠️ category は残す。次に入ったときの事業を選び直す画面で上書きされる） */
const AUTH_KEYS = ['token', 'authority', 'userName', 'shopName'];

export const logout = async (): Promise<void> => {
    try {
        await apiClient.post('', { request: 'logout' });
    } catch (error) {
        console.error('ログアウトの記録に失敗しました（画面からはログアウトします）:', error);
    }
    googleLogout();
    try {
        sessionStorage.setItem(JUST_LOGGED_OUT, '1');
    } catch {
        // ⚠️ 保存できない環境（プライベートモードなど）でも、ログアウトは続ける
    }
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.replace('/dashboard/login');
};
```

### backend/scripts/guide/articles/common/screen-195.md
````markdown
---
title: セキュリティログ
section: 画面の使い方
sort: 195
summary: ログイン・ログアウトと、失敗・エラーの記録を見て、不審なアクセスを見つける画面（管理者だけ）。
---
ヘッダーの「システム管理 → セキュリティログ」（管理者だけ）。Dashboard へのログイン・ログアウトと、失敗やエラーの記録を見る画面です。ロボットや不審なアクセスがないかを確かめるために使います。

[[画面:セキュリティログ]]

> 注意：記録しているのは、ログイン・ログアウトと、失敗・エラーだけです。ふだんの操作（画面を開く・保存する）は記録していません。

## 記録される種類
- **ログイン**：ログインした
- **ログイン失敗**：Google の確認に失敗した、またはスタッフの名簿にないアカウントで入ろうとした
- **ログアウト**：右上のパネルからログアウトした（[[アクティブユーザー（右上のパネル）]]）
- **認証の失敗**：ログインしていない、または期限の切れた状態で操作しようとした
- **権限で拒否**：見られない画面・できない操作をしようとした
- **不正な要求・存在しない処理**：Dashboard に無い処理を呼ぼうとした（ロボットが中を探るときによく出ます）
- **サーバーエラー・② に届かない**：サーバー側で問題が起きた

同じ人・同じ接続元からの失敗が1分のうちに続いたときは、1行にまとめて「×件数」で出します。

## 見方
1. 上の「期間」を選びます（はじめは直近7日）。必要なら「種類」「IP」「キーワード」（人・処理・画面・内容）で絞り、「表示」を押します
2. 上の数字で、期間の中の件数を見ます。赤い数字（ログイン失敗・サーバーエラー・要注意の IP）が多いときは中身を確かめます
3. 「要注意の IP」の赤い札を押すと、その接続元の記録だけになります。表の IP を押しても同じです
4. 「要注意の IP だけ」に印を付けると、目印の付いた接続元の行だけになります

## 要注意の目印
次のどれかに当てはまる接続元（IP）には、赤い「要注意」の札が付きます。
- 1分のうちに失敗が30回以上
- 5分のうちにログインの失敗が5回以上
- 1時間のうちに、存在しない処理を10回以上呼んだ
- ブラウザではなくツール（プログラム）からのアクセス、またはブラウザの名前が空

> 会社の回線から使うと、社員がみな同じ IP に見えることがあります。「要注意」が付いても、人の欄と内容を見て、社員の操作ではないかを先に確かめてください。

> 要確認：社外からの不審なアクセスが続いているときの連絡先と対応（IP の遮断など）は、社内のルールを確かめてください。

## 記録の保存期間
記録は180日たつと消えます。
````

## 変更したファイル（差分）

```diff
diff --git a/backend-express/src/gateway/auth.ts b/backend-express/src/gateway/auth.ts
index f84238bc4..2e3aa1d0e 100644
--- a/backend-express/src/gateway/auth.ts
+++ b/backend-express/src/gateway/auth.ts
@@ -33,7 +33,7 @@ interface StaffRow extends RowDataPacket, AuthenticatedStaff {}
 /** 認証結果。失敗時は返すべきステータスとJSONを持つ */
 export type GatewayAuthResult =
   | { ok: true; staff: AuthenticatedStaff | null }
-  | { ok: false; status: number; body: { status: 'error'; message: string } };
+  | { ok: false; status: number; body: { status: 'error'; message: string }; staff?: AuthenticatedStaff };
 
 /**
  * トークンを取り出す。
@@ -114,6 +114,8 @@ export const checkGatewayAuth = async (
       ok: false,
       status: 403,
       body: { status: 'error', message: 'この操作を行う権限がありません。' },
+      // ⚠️ v2.2.242: だれが拒否されたかをセキュリティログに残すため（gateway/index.ts）
+      staff,
     };
   }
 
diff --git a/backend-express/src/gateway/index.ts b/backend-express/src/gateway/index.ts
index 742039619..36190e3c1 100644
--- a/backend-express/src/gateway/index.ts
+++ b/backend-express/src/gateway/index.ts
@@ -4,6 +4,7 @@ import { env, isProduction } from '../config/env';
 import { publicFormRateLimit } from '../middlewares/publicFormRateLimit';
 import { logger } from '../utils/logger';
 import { checkGatewayAuth } from './auth';
+import { recordSecurityEvent } from '../features/securityLog';
 import { forwardToPhp } from './phpFallback';
 import { entryCount, findEntry, listEntries } from './registry';
 import type { GatewayBody, GatewayContext } from './types';
@@ -81,6 +82,8 @@ export const createGatewayRouter = (): Router => {
       const request = asString(body.request);
 
       if (request === '' || !REQUEST_PATTERN.test(request)) {
+        // ⚠️ v2.2.242: セキュリティログ（⚠️ ① の index.php と同じく bad_request）
+        recordSecurityEvent(req, { event: 'bad_request', status: 400, request });
         // ⚠️ PHP と同じメッセージ・同じ 400 を返す。
         //   フロントがこの文言で分岐している可能性があるため変えない。
         res
@@ -116,6 +119,7 @@ export const createGatewayRouter = (): Router => {
             `ループ検知: ① から転送された "${request}" が ② に未登録です。` +
               '① の expressProxyRequests() から外すか、② を再デプロイしてください。'
           );
+          recordSecurityEvent(req, { event: 'proxy_error', status: 502, request, roll, message: 'ループ検知（② に未登録）' });
           // 500番台を返すと ① 側が自動でフォールバックし、
           // ① 自身のPHPで処理される（画面は止まらない）
           res.status(502).json({
@@ -139,6 +143,14 @@ export const createGatewayRouter = (): Router => {
       // -------------------------------------------------------------
       const authResult = await checkGatewayAuth(req, entry.auth, env.gatewayRequireAuth);
       if (!authResult.ok) {
+        recordSecurityEvent(req, {
+          event: authResult.status === 401 ? 'auth_failed' : 'forbidden',
+          status: authResult.status,
+          request,
+          roll,
+          staff: authResult.staff,
+          message: authResult.status === 401 ? (req.header('Token') ? 'トークンが無効' : 'トークンなし') : '権限が足りない',
+        });
         // ⚠️ PHP と同じステータス・同じ文言で返す。
         //   フロントは response.data.message を画面に出す。
         res.status(authResult.status).json(authResult.body);
@@ -159,6 +171,18 @@ export const createGatewayRouter = (): Router => {
 
       const result = await entry.handler(ctx);
 
+      // ⚠️ v2.2.242: 業務処理の中で 401・403 を返したもの（担当事業の確認など）もセキュリティログに残す
+      if (res.statusCode === 401 || res.statusCode === 403) {
+        recordSecurityEvent(req, {
+          event: res.statusCode === 401 ? 'auth_failed' : 'forbidden',
+          status: res.statusCode,
+          request,
+          roll,
+          staff: authResult.staff,
+          message: '処理の中で拒否',
+        });
+      }
+
       // ハンドラが自分でレスポンスを送った場合（ファイル出力など）は何もしない
       if (res.headersSent) return;
 
diff --git a/backend-express/src/gateway/phpFallback.ts b/backend-express/src/gateway/phpFallback.ts
index a06ea638c..aa7e25095 100644
--- a/backend-express/src/gateway/phpFallback.ts
+++ b/backend-express/src/gateway/phpFallback.ts
@@ -46,6 +46,10 @@ const buildForwardHeaders = (req: Request): Record<string, string> => {
   // 転送されたものだと分かるようにしておく。① 側のログで区別できる
   headers['x-forwarded-by'] = 'express-gateway';
 
+  // ⚠️ v2.2.242: 接続元を ① のセキュリティログに渡す（① から見ると接続元は ② になるため）。
+  //   ⚠️ 利用者が送ってきた同じ名前のヘッダーは上で写っているので、必ず上書きする（req.ip は Caddy の後ろの実際の相手）
+  headers['x-client-ip'] = req.ip ?? '';
+
   return headers;
 };
 
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 1c9a96145..9872fe88e 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -144,6 +144,7 @@ import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate';
+import { listSecurityLog } from '../features/securityLog';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runMemberEntry } from '../features/memberEntry/entry';
 import { runHousingBazarEntry } from '../features/housingBazar/entry';
@@ -3027,6 +3028,21 @@ register({
   ),
 });
 
+/**
+ * セキュリティログの一覧（v2.2.242）。features/securityLog.ts 参照。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+ *   ⚠️ ① の express_proxy.php の ⚠️ **転送リストと転送専用リストの両方**に入れてある。
+ * ⚠️ 読むのは Master だけ（ヘッダーの「システム管理 → セキュリティログ」）。⚠️ 書くのは ①（core/security_log.php）と ②（recordSecurityEvent）。
+ */
+register({
+  request: 'security_log_list',
+  summary: 'セキュリティログ（期間の行・種類ごとの件数・要注意の IP）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'master',
+  handler: async (ctx) => listSecurityLog(ctx.body),
+});
+
 // ---------------------------------------------------------------------------
 // 反響の付帯情報の更新（同期サービス projects/sync から呼ばれる）
 //
diff --git a/backend-express/src/middlewares/errorHandler.ts b/backend-express/src/middlewares/errorHandler.ts
index 150dbf6ff..0e9de2770 100644
--- a/backend-express/src/middlewares/errorHandler.ts
+++ b/backend-express/src/middlewares/errorHandler.ts
@@ -3,6 +3,7 @@ import { isProduction } from '../config/env';
 import { AppError } from '../errors/AppError';
 import type { ErrorCode } from '../errors/AppError';
 import { logger } from '../utils/logger';
+import { recordSecurityEvent } from '../features/securityLog';
 
 /**
  * エラーレスポンスの形は全エンドポイントで統一する。
@@ -72,6 +73,8 @@ const normalize = (err: unknown): Normalized => {
 
 /** どのルートにも一致しなかったリクエスト。errorHandler の直前に置く */
 export const notFoundHandler: RequestHandler = (req, res) => {
+  // ⚠️ v2.2.242: 存在しないパスを探る動き（ロボットなど）をセキュリティログに残す（⚠️ クエリ文字列は残さない）
+  recordSecurityEvent(req, { event: 'unknown_request', status: 404, request: `${req.method} ${req.path}` });
   res.status(404).json({
     error: {
       code: 'NOT_FOUND',
@@ -99,6 +102,15 @@ export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
     logger.warn(`${label} ${message}`);
   }
 
+  // ⚠️ v2.2.242: セキュリティログ（500・401・403）。⚠️ 中身の詳しい内容（SQL の値など）は残さない（種類と先頭だけ）
+  const request = typeof req.body?.request === 'string' ? req.body.request : `${req.method} ${req.path}`;
+  if (unexpected) {
+    const detail = err instanceof Error ? `${err.name}: ${err.message.split(/\r?\n/)[0].slice(0, 200)}` : 'unknown';
+    recordSecurityEvent(req, { event: 'server_error', status: statusCode, request, message: `${detail} [${req.requestId}]` });
+  } else if (statusCode === 401 || statusCode === 403) {
+    recordSecurityEvent(req, { event: statusCode === 401 ? 'auth_failed' : 'forbidden', status: statusCode, request, message });
+  }
+
   res.status(statusCode).json({
     error: {
       code,
diff --git a/backend/scripts/guide/articles/common/screen-105.md b/backend/scripts/guide/articles/common/screen-105.md
index b468715b7..652c81ca2 100644
--- a/backend/scripts/guide/articles/common/screen-105.md
+++ b/backend/scripts/guide/articles/common/screen-105.md
@@ -18,7 +18,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 
 ## 見られる人
 だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
-- **ローン情報更新**・**広告費シミュレーター**：管理者だけ
+- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**：管理者だけ
 - **アクセス解析**・**営業別契約率**：管理者・ブランド管理者だけ
 - **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
 - **アクションボード**：注文営業だけ
@@ -34,3 +34,4 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 - [[アクセス解析]]
 - [[アンバサダーの反響一覧]]
 - [[オーナーズハウス募集]]
+- [[セキュリティログ]]
diff --git a/backend/scripts/guide/articles/common/screen-170.md b/backend/scripts/guide/articles/common/screen-170.md
index 2d482c669..236575887 100644
--- a/backend/scripts/guide/articles/common/screen-170.md
+++ b/backend/scripts/guide/articles/common/screen-170.md
@@ -2,7 +2,7 @@
 title: アクティブユーザー（右上のパネル）
 section: 画面の使い方
 sort: 170
-summary: 右上のパネルの見方と、隠し方・戻し方。
+summary: 右上のパネルの見方と、ログアウト・隠し方・戻し方。
 ---
 画面の右上に出ているパネルです（PC のみ）。
 
@@ -10,9 +10,18 @@ summary: 右上のパネルの見方と、隠し方・戻し方。
 - **要確認**：その日に確認するお客様の一覧を開く
 - **業務ガイド**：このガイドを別ウインドウで開く（[[業務ガイドの使い方]]）
 - 自分の名前と、いま使っている人の数
+- **ログアウトのボタン**（名前の右の、四角から矢印が出ているアイコン）：ログアウトする（下の「ログアウト」）
 - **▾**：使っている人の一覧を開く・閉じる
 - **×**：パネルを右端に隠す
 
+## ログアウト
+名前の右のアイコンを押し、「ログアウトしますか？」で「OK」を押すと、ログイン画面に戻ります。
+- ログアウトすると、**ほかのパソコンやスマホで開いている Dashboard も、次に画面を移ったときにログイン画面に戻ります**（ログインしている状態は1人に1つのため）
+- もう一度使うときは、ログイン画面の「Google でログイン」から入ります
+- 共用のパソコンで使い終わったときは、ログアウトしてください
+
+> 注意：パネルは PC（画面の幅が広いとき）にだけ出ます。スマホにはログアウトのボタンがありません。
+
 ## 隠したパネルを戻すには
 右端に残る「‹ ● 人数」のつまみを押します。隠した状態は、ほかの画面へ移っても、再読み込みしても保たれます。
 
diff --git a/backend/src/core/authz.php b/backend/src/core/authz.php
index 95974f23a..b22e014ea 100644
--- a/backend/src/core/authz.php
+++ b/backend/src/core/authz.php
@@ -1,5 +1,8 @@
 <?php
 
+// ⚠️ v2.2.242: 401・403 をセキュリティログに残す
+require_once __DIR__ . '/security_log.php';
+
 /**
  * 認証（誰か）と認可（何をしてよいか）。
  *
@@ -32,6 +35,8 @@ function requireStaff(PDO $pdo, array $headers): array
     $staff = ($token === '') ? false : getUserByToken($pdo, $token);
 
     if (!$staff) {
+        // ⚠️ v2.2.242: セキュリティログ（⚠️ トークンそのものは残さない）
+        securityLog(['event' => 'auth_failed', 'status' => 401, 'message' => $token === '' ? 'トークンなし' : 'トークンが無効'], $pdo);
         http_response_code(401);
         echo json_encode(
             ['status' => 'error', 'message' => '認証が必要です。'],
@@ -63,6 +68,7 @@ function requireAuthority(array $staff, array $allowed): void
             $authority === '' ? '(空)' : $authority,
             implode('/', $allowed)
         ));
+        securityLog(['event' => 'forbidden', 'status' => 403, 'staff' => $staff, 'message' => '権限が足りない（必要: ' . implode('/', $allowed) . '）']);
 
         http_response_code(403);
         echo json_encode(
@@ -107,6 +113,7 @@ function requireShop(PDO $pdo, array $headers, array $allowedShops): array
     $shop = (string)($staff['shop'] ?? '');
     if (!in_array($shop, $allowedShops, true)) {
         error_log(sprintf('authz denied: staff_id=%s shop=%s required=%s', $staff['id'] ?? '?', $shop === '' ? '(空)' : $shop, implode('/', $allowedShops)));
+        securityLog(['event' => 'forbidden', 'status' => 403, 'staff' => $staff, 'message' => '担当事業が対象外（必要: ' . implode('/', $allowedShops) . '）'], $pdo);
         http_response_code(403);
         echo json_encode(['status' => 'error', 'message' => 'この操作を行う権限がありません。'], JSON_UNESCAPED_UNICODE);
         exit;
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 62df9ab8b..e4f38b2c7 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -402,6 +402,8 @@ function expressProxyRequests(): array
         // ⚠️ v2.2.240。金利データ（プラン別金利）。⚠️ ② だけ（① に PHP は無い）。upload は書き込み（Master だけ）
         'loan_plan_rate_list',
         'loan_plan_rate_upload',
+        // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
+        'security_log_list',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
@@ -887,6 +889,8 @@ function expressProxyExclusive(): array
         // ⚠️ v2.2.240。金利データ（プラン別金利）。⚠️ ② だけ（① に PHP は無い）。upload は書き込み（Master だけ）
         'loan_plan_rate_list',
         'loan_plan_rate_upload',
+        // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
+        'security_log_list',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
@@ -1243,6 +1247,20 @@ function forwardToExpress(array $data): bool
     // ② 側でループ検知に使う。これが付いていると ② は ① へ転送し返さない
     $headers[] = 'X-Forwarded-By: xserver-php';
 
+    // ⚠️ v2.2.242: 接続元を ② のセキュリティログに渡す（② から見ると接続元は ① になるため）。
+    //   ⚠️ ② は X-Forwarded-By が付いているときだけ使い、直接の相手（① の IP）も via_ip に残す。
+    //   ⚠️ 改行などの制御文字は落とす（ヘッダーを壊さないため）
+    foreach ([
+        'X-Client-IP' => $_SERVER['REMOTE_ADDR'] ?? '',
+        'X-Client-UA' => $_SERVER['HTTP_USER_AGENT'] ?? '',
+        'X-Client-Referer' => $_SERVER['HTTP_REFERER'] ?? '',
+    ] as $name => $value) {
+        $value = substr(preg_replace('/[\x00-\x1F\x7F]+/', ' ', (string)$value) ?? '', 0, 500);
+        if ($value !== '') {
+            $headers[] = $name . ': ' . $value;
+        }
+    }
+
     $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
     if ($body === false) {
         error_log('express_proxy: リクエストのJSON化に失敗しました');
diff --git a/backend/src/handlers/login.php b/backend/src/handlers/login.php
index ffae84d07..5f76676b3 100644
--- a/backend/src/handlers/login.php
+++ b/backend/src/handlers/login.php
@@ -12,6 +12,8 @@
  */
 
 require_once __DIR__ . '/../core/google_auth.php';
+// ⚠️ v2.2.242: ログインの成功・失敗をセキュリティログに残す
+require_once __DIR__ . '/../core/security_log.php';
 
 // ---------------------------------------------------------------------------
 // 1. 本人確認
@@ -24,6 +26,7 @@ $mail = $credential !== '' ? verifyGoogleIdToken($credential) : null;
 
 if ($mail === null) {
     // ⚠️ 理由は返さない。error_log にだけ残る（core/google_auth.php を参照）
+    securityLog(['event' => 'login_failed', 'status' => 401, 'message' => $credential === '' ? 'Google の認証情報なし' : 'Google の確認に失敗'], $pdo);
     http_response_code(401);
     echo json_encode([
         'message' => 'error',
@@ -43,6 +46,9 @@ $stmt->execute([$mail]);
 $user = $stmt->fetch(PDO::FETCH_ASSOC);
 
 if (!$user) {
+    // ⚠️ メールアドレスは残さない（ドメインだけ。社外のアカウントからの試しかを見分けるため）
+    $domain = strrchr($mail, '@');
+    securityLog(['event' => 'login_failed', 'status' => 200, 'message' => 'スタッフの名簿にない（' . ($domain === false ? '?' : '*' . $domain) . '）'], $pdo);
     echo json_encode([
         'message' => 'error',
         'details' => 'メールまたはパスワードが違います',
@@ -63,6 +69,14 @@ $stmt->execute([$timestamp, $user['name']]);
 $token = generateToken();
 storeToken($pdo, $user['mail'], $token);
 
+// ⚠️ v2.2.242: 最後のログイン日時（staff.last_login_at）とセキュリティログ。⚠️ 失敗してもログインは止めない
+try {
+    $pdo->prepare("UPDATE staff SET last_login_at = NOW() WHERE id = ?")->execute([$user['id']]);
+} catch (PDOException $e) {
+    error_log('login: last_login_at の更新に失敗しました（' . $e->getMessage() . '）');
+}
+securityLog(['event' => 'login', 'status' => 200, 'staff' => $user], $pdo);
+
 echo json_encode([
     "message" => "success",
     "token" => $token,
diff --git a/backend/src/index.php b/backend/src/index.php
index 111b0c342..1607ec1a9 100644
--- a/backend/src/index.php
+++ b/backend/src/index.php
@@ -7,6 +7,9 @@ require_once __DIR__ . '/core/db.php';
 require_once __DIR__ . '/core/token.php';
 require_once __DIR__ . '/core/helpers.php';
 require_once __DIR__ . '/core/express_proxy.php';
+// ⚠️ v2.2.242: セキュリティログ（core/security_log.php）。⚠️ 致命的エラーも server_error として残す
+require_once __DIR__ . '/core/security_log.php';
+securityLogRegisterFatalHandler();
 
 header("Content-Type: application/json; charset=utf-8");
 
@@ -16,6 +19,7 @@ header("Content-Type: application/json; charset=utf-8");
 // portal/xxx のようなサブディレクトリ指定だけを例外的に通す。
 // ドットを許可しないことで ".." による親ディレクトリ参照を封じている。
 if ($request === '' || !preg_match('#^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$#', $request)) {
+    securityLog(['event' => 'bad_request', 'status' => 400, 'request' => is_scalar($request) ? $request : '']);
     http_response_code(400);
     echo json_encode(
         ['status' => 'error', 'message' => '不正なリクエストです。'],
@@ -56,6 +60,7 @@ if (shouldProxyToExpress($request, $proxyData)) {
     //   消せば ① 自身の PHP が処理する（PHPハンドラは残してある）。
     if (isExclusiveToExpress($request, $proxyData)) {
         error_log("express_proxy: {$request} は転送専用のため ① では処理しません（502）");
+        securityLog(['event' => 'proxy_error', 'status' => 502, 'message' => '② に届かない（転送専用）']);
         http_response_code(502);
         echo json_encode(
             [
@@ -73,6 +78,7 @@ $handler = __DIR__ . "/handlers/" . $request . ".php";
 // 存在しない場合に PHP の Fatal error をそのまま返すと、
 // サーバーの絶対パスが外部に漏れる。JSON で 404 を返す。
 if (!is_file($handler)) {
+    securityLog(['event' => 'unknown_request', 'status' => 404]);
     http_response_code(404);
     echo json_encode(
         ['status' => 'error', 'message' => '該当する処理がありません。'],
diff --git a/frontend/src/components/ActiveUser.tsx b/frontend/src/components/ActiveUser.tsx
index 3e6a17c99..3c611eb22 100644
--- a/frontend/src/components/ActiveUser.tsx
+++ b/frontend/src/components/ActiveUser.tsx
@@ -4,6 +4,7 @@ import { useLocation } from "react-router-dom";
 import apiClient from '../utils/apiClient';
 import { openDailyAction, DAILY_CATEGORIES, NO_DAILY_ACTION } from './DailyAction';
 import { isGuideCategory, openGuide } from './guide/openGuide';
+import { logout } from '../utils/logout';
 
 type User = { id?: string | number, name: string, heartbeat: string };
 
@@ -360,6 +361,24 @@ const ActiveUser: React.FC = () => {
                         </div>
 
                         <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
+                            {/* ⚠️ v2.2.242: ログアウト（⚠️ 名前の行・指示「右上に固定」。utils/logout.ts）。⚠️ 押し間違いを防ぐため確かめる */}
+                            <button
+                                type="button"
+                                onClick={() => { if (window.confirm('ログアウトしますか？')) void logout(); }}
+                                aria-label="ログアウト"
+                                title="ログアウト"
+                                style={{
+                                    background: 'transparent',
+                                    border: 'none',
+                                    cursor: 'pointer',
+                                    padding: 4,
+                                    fontSize: 13,
+                                    lineHeight: 1,
+                                    color: '#6c757d'
+                                }}
+                            >
+                                <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
+                            </button>
                             <button
                                 onClick={() => setCollapsed(prev => !prev)}
                                 aria-label={collapsed ? "Show active users" : "Hide active users"}
diff --git a/frontend/src/components/Login.tsx b/frontend/src/components/Login.tsx
index a6e1050f6..e2683bae7 100644
--- a/frontend/src/components/Login.tsx
+++ b/frontend/src/components/Login.tsx
@@ -7,6 +7,7 @@ import "bootstrap/dist/css/bootstrap.min.css";
 import Logo from "../assets/images/logo.png";
 import { GoogleLogin } from '@react-oauth/google';
 import apiClient from '../utils/apiClient';
+import { JUST_LOGGED_OUT } from '../utils/logout';
 
 type Value = { mail: string, password: string, error: string };
 
@@ -20,6 +21,17 @@ const Login = () => {
   const navigate = useNavigate();
   const location = useLocation(); // 💡 現在のURL情報を取得
   const { setAuthority, setToken, setUserName } = useContext(AuthContext);
+  /**
+   * ⚠️ v2.2.242: ログアウトした直後か（utils/logout.ts が付ける目印）。
+   *   ⚠️ 直後は One Tap を出さない（⚠️ 出すと、そのまま入り直してしまうことがある）。⚠️ ボタンからは入れる。
+   */
+  const [justLoggedOut] = useState(() => {
+    try {
+      return sessionStorage.getItem(JUST_LOGGED_OUT) === '1';
+    } catch {
+      return false;
+    }
+  });
 
   const handleGoogleSuccess = (credentialResponse: any) => {
     const newValidationMessage: Value = { mail: "", password: "", error: "" };
@@ -34,6 +46,11 @@ const Login = () => {
         const response = await apiClient.post("", { request: 'login', credential: token });
         console.log("API Response:", response);
         if (response.data.message === "success") {
+          try {
+            sessionStorage.removeItem(JUST_LOGGED_OUT);
+          } catch {
+            // ⚠️ 消せなくてもログインは続ける
+          }
           setAuthority(response.data.authority);
           setToken(response.data.token);
           setUserName(response.data.userName);
@@ -90,6 +107,12 @@ const Login = () => {
           国分ハウジンググループの<br />
           Workspaceアカウントでログインしてください。
         </p>
+        {/* ⚠️ v2.2.242: ログアウトした直後 */}
+        {justLoggedOut && !validationMessage.error && (
+          <div className="alert alert-secondary p-2 mb-md-4 mb-3 small" role="status">
+            ログアウトしました。
+          </div>
+        )}
         {/* エラーアラート */}
         {validationMessage.error && (
           <div className="alert alert-danger p-2 mb-md-4 mb-3 small" role="alert">
@@ -106,7 +129,7 @@ const Login = () => {
                 error: "認証がキャンセルされたか、エラーが発生しました",
               }));
             }}
-            useOneTap
+            useOneTap={!justLoggedOut}
           />
         </div>
         {/* フッター */}
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 0cdf47b92..76364b277 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -102,6 +102,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '店舗編集': { header: 'システム管理/店舗編集' },
     'スタッフ編集・追加': { header: 'システム管理/スタッフ編集・追加' },
     '権限編集': { header: 'システム管理/権限編集' },
+    // ⚠️ v2.2.242。headerScreens.tsx と同じく Master だけ
+    'セキュリティログ': { header: 'システム管理/セキュリティログ', authority: ['Master'] },
 };
 // GUIDE_SCREENS_END
 
diff --git a/frontend/src/components/header/headerScreens.tsx b/frontend/src/components/header/headerScreens.tsx
index a06a236d9..d3545b7ec 100644
--- a/frontend/src/components/header/headerScreens.tsx
+++ b/frontend/src/components/header/headerScreens.tsx
@@ -4,6 +4,7 @@ import EditStaff from './system/EditStaff';
 import EditAuth from './system/EditAuth';
 import EditShop from './system/EditShop';
 import UploadLoan from './system/UploadLoan';
+import SecurityLog from './system/SecurityLog';
 import EditBlackList from './inquiry/EditBlackList';
 import BudgetSimulator from './inquiry/BudgetSimulator';
 import AfterInterview from './inquiry/AfterInterview';
@@ -121,6 +122,8 @@ export const HEADER_SCREENS: HeaderScreen[] = [
     { menu: 'システム管理', item: '権限編集', path: '/editAuth', padded: true, render: () => <EditAuth /> },
     // ⚠️ ローン情報更新は ⚠️⚠️ **Master だけ**（お客様に出る金利を確定するため。② の loan_rate_upload も auth: 'master'）
     { menu: 'システム管理', item: 'ローン情報更新', path: '/uploadLoan', allow: isMaster, padded: true, render: () => <UploadLoan /> },
+    // ⚠️ v2.2.242: セキュリティログは ⚠️⚠️ **Master だけ**（IP・ログインの記録が並ぶため。② の security_log_list も auth: 'master'）
+    { menu: 'システム管理', item: 'セキュリティログ', path: '/securityLog', allow: isMaster, render: () => <SecurityLog /> },
 
     // ── 反響管理
     // ⚠️ 販促媒体設定はまだ中身が無い（v2.2.240 までと同じく「準備中」を出す）
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 4dfbf13f1..98941de2a 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.241';
+export const newVersion = '2.2.242';
```

⚠️ update_log の SQL（2026-11-04_update_log_2.2.242.sql）は、更新履歴1行と、build-guide-sql.cjs が出した記事3本の SQL です（本文は上の記事と同じなので省略）。
