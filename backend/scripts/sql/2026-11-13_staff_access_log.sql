-- =====================================================================
-- v2.2.266 画面のアクセス記録（staff_access_log）を作る
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。ローカルは docker exec で流す。
-- ⚠️ 何度流しても安全（CREATE TABLE IF NOT EXISTS）。⚠️ 既存の表は変えない（staff.log はこの版では消さない）。
-- ⚠️ 戻すとき: DROP TABLE staff_access_log;（⚠️ 記録はすべて消える）
--
-- 1行 = 担当者が画面を1回開いたこと。
--   書くのは ② の access_log（画面を移ったとき）と heartbeat（20秒ごとに last_seen_at を更新）。
--   ⚠️ 13か月より古い行は ② が毎日消す（features/accessLog.ts）。
--   ⚠️ 担当者・権限・担当事業は、開いた時点の staff の値を写す（あとで変わっても記録は変わらない）。
--   ⚠️ path は ? 以降を残さない（お客様の ID などが入ることがあるため）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS staff_access_log (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    staff_id      INT             NOT NULL COMMENT 'staff.id',
    staff_name    VARCHAR(100)    NOT NULL DEFAULT '' COMMENT '開いた時点の staff.name',
    authority     VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '開いた時点の権限（staff.brand。Master / BrandAdmin / ordinary など）',
    division      VARCHAR(16)     NOT NULL DEFAULT '' COMMENT '開いた時点の担当事業（staff.shop。order / spec / used / all）',
    path          VARCHAR(255)    NOT NULL COMMENT '開いた画面（/company など。? 以降は残さない）',
    opened_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '開いた日時',
    last_seen_at  DATETIME        DEFAULT NULL COMMENT '最後に heartbeat が届いた日時（無ければ 20秒以内に離れた）',
    ip            VARCHAR(45)     NOT NULL DEFAULT '' COMMENT '接続元（① を経由したときは ① が渡した値）',
    user_agent    VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '端末（ブラウザ）',
    PRIMARY KEY (id),
    KEY idx_staff_access_time (opened_at),
    KEY idx_staff_access_staff (staff_id, opened_at),
    KEY idx_staff_access_path (path, opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='画面のアクセス記録（v2.2.266。13か月で消す）';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'staff_access_log';
