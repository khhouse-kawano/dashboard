-- ============================================================================
-- 分析API（Claude Desktop から MCP 経由で叩く）の認証キーと監査ログ
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   分析APIはインターネットに公開したVPS上で動く。全店舗の成績を横断で
--   取得できるため、ブラウザ用の staff.api_token をそのまま流用しない。
--   api_token は無期限・失効の仕組みが無く、漏れた時に止める手段が無い。
--
-- なぜ暗号化ではなくハッシュなのか
--   既存の api_credential は Anthropic に送る「送信用」の鍵なので、
--   使うたびに復号する必要があり AES-GCM で暗号化している。
--   こちらは「受信して照合する」だけなので、平文に戻す必要が無い。
--   ハッシュで持てば、DBが漏れてもキーそのものは復元できない。
-- ============================================================================

CREATE TABLE IF NOT EXISTS `analysis_api_key` (
  `id`            int(11)      NOT NULL AUTO_INCREMENT,
  `staff_id`      int(11)      NOT NULL                COMMENT '所有者。staff.id。Master権限のみ',
  `label`         varchar(100) NOT NULL                COMMENT '用途がわかる名前。例: A部長 ノートPC',

  -- 照合用。キー本体は発行時にしか表示せず、DBには残さない。
  --
  -- ⚠️ SHA-256 をソルト無しで使っている。パスワードなら不適切だが、
  --   キーは 32バイトの乱数（256bit）で辞書攻撃も総当たりも成立しないため、
  --   ここでは高速に照合できることを優先している。
  --   人が決めた文字列をキーにしてはならない。
  `key_hash`      char(64)     NOT NULL                COMMENT 'SHA-256(キー本体)。16進64文字',
  `key_prefix`    varchar(24)  NOT NULL                COMMENT '画面表示用の先頭部分。例: khg_kpi_a3f9…',

  `expires_at`    datetime     DEFAULT NULL            COMMENT '有効期限。NULLなら無期限',
  `revoked_at`    datetime     DEFAULT NULL            COMMENT '失効させた時刻。入っていたら即座に拒否',
  `last_used_at`  datetime     DEFAULT NULL            COMMENT '最後に使われた時刻。棚卸しに使う',
  `created_at`    datetime     NOT NULL DEFAULT current_timestamp(),

  PRIMARY KEY (`id`),
  -- 認証は毎リクエスト走る。ハッシュ一致で1件に引けるよう一意索引を張る
  UNIQUE KEY `uk_analysis_api_key_hash` (`key_hash`),
  KEY `idx_analysis_api_key_staff` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析APIの受信用APIキー';


-- ============================================================================
-- 監査ログ
--
-- 誰がいつ何を集計したかを残す。個人情報は集計値に落ちているとはいえ、
-- 全店舗の成績を引ける口なので「いつ誰が引いたか」を追えるようにしておく。
--
-- ⚠️ 検索条件（filters）は残すが、レスポンス本体は残さない。
--   保存する意味が薄いうえ、ログの肥大化と情報の二重保管になるため。
-- ============================================================================

CREATE TABLE IF NOT EXISTS `analysis_query_log` (
  `id`            bigint(20)   NOT NULL AUTO_INCREMENT,
  `api_key_id`    int(11)      DEFAULT NULL            COMMENT 'analysis_api_key.id。認証前に落ちた場合はNULL',
  `staff_id`      int(11)      DEFAULT NULL            COMMENT 'キーの所有者。staff.id',

  `endpoint`      varchar(64)  NOT NULL                COMMENT '例: pivot / funnel / unsynced / meta',
  `group_by`      varchar(255) DEFAULT NULL            COMMENT '集計軸。カンマ区切り',
  `metrics`       varchar(512) DEFAULT NULL            COMMENT '指標。カンマ区切り',
  `basis`         varchar(16)  DEFAULT NULL            COMMENT 'reaction / contract',
  `period_from`   varchar(7)   DEFAULT NULL            COMMENT 'YYYY-MM',
  `period_to`     varchar(7)   DEFAULT NULL            COMMENT 'YYYY-MM',
  `filters`       varchar(512) DEFAULT NULL            COMMENT '絞り込み条件のJSON',

  `row_count`     int(11)      DEFAULT NULL            COMMENT '返した行数',
  `duration_ms`   int(11)      DEFAULT NULL            COMMENT '所要時間',
  `status`        enum('ok','bad_request','unauthorized','rate_limited','error') NOT NULL,
  `error_message` varchar(255) DEFAULT NULL,

  -- 発信元の記録。VPSはリバースプロキシ配下で動くため、
  -- Express 側で trust proxy を設定していないと全て同じIPになる点に注意。
  `client_ip`     varchar(45)  DEFAULT NULL            COMMENT 'IPv6も入るので45文字',
  `request_id`    varchar(64)  DEFAULT NULL            COMMENT 'X-Request-Id。アクセスログとの突き合わせ用',

  `created_at`    datetime     NOT NULL DEFAULT current_timestamp(),

  PRIMARY KEY (`id`),
  KEY `idx_analysis_query_log_key` (`api_key_id`),
  KEY `idx_analysis_query_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析APIの実行履歴（監査用）';
