-- おうちづくりフェスタ2026 のLP予約フォーム受付に伴う event_db の拡張。
--
-- 反響元: https://kh-house.jp/festa/ の公開フォーム（② Express が直接受ける）
-- 実装:   backend-express/src/features/event/reservation.ts
--
-- ⚠️ event_db は既存イベント（住まいるフェスティバル2026・89件）でも使っている。
--   イベントの区別は `title` 列で行う。追加する列はすべて NULL 許容にし、
--   既存行に影響が出ないようにしている。

-- ============================================================
-- 1. LPのフォーム項目に対応する列を追加
-- ============================================================

ALTER TABLE `event_db`
  -- ⚠️ 既存イベントのフォームには無かった項目。既存89件は NULL のままになる
  ADD COLUMN `kana` TEXT DEFAULT NULL
      COMMENT 'ふりがな' AFTER `name`,
  ADD COLUMN `request` TEXT DEFAULT NULL
      COMMENT 'マイホームのご検討。⚠️ interview と同じくカンマ区切りで複数保存する' AFTER `interview`,
  ADD COLUMN `agree` TINYINT DEFAULT NULL
      COMMENT '個人情報の取り扱いへの同意。1=同意。⚠️ NULL は同意欄が無かった頃の予約' AFTER `question`,
  ADD COLUMN `reserved_at` DATETIME DEFAULT NULL
      COMMENT '予約を受け付けた日時。⚠️ 公開フォーム経由の反響を時系列で追うために使う' AFTER `agree`;

-- ============================================================
-- 2. id の重複を防ぐ
-- ============================================================

-- ⚠️ `id` は**フォーム側（ブラウザ）で採番している**（festa2026_ + 英数16文字）。
--   QRコードを送信直後に表示する必要があり、サーバーの採番を待てないため。
--   したがって値は改ざんでき、同じ id で二重送信されうる。
--   サーバー側の形式検証と、この UNIQUE キーの2段で防ぐ。
--
-- ⚠️ TEXT 型のため接頭辞長 191 を指定する
--   （utf8mb4 で 191 * 4 = 764 バイト。InnoDB の 767 バイト制限に収まる）。
--
-- ⚠️ 適用前に重複が無いことを確認すること。あると ALTER が失敗する。
--     SELECT id, COUNT(*) c FROM event_db GROUP BY id HAVING c > 1;
--   2026-09-07 時点の本番想定データ（89件）では重複・空ともに 0 件。

ALTER TABLE `event_db` ADD UNIQUE KEY `uk_event_db_id` (`id`(191));
