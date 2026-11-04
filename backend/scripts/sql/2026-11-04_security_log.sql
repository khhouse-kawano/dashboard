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
