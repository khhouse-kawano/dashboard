-- ============================================================================
-- brokerage_listings: extId に UNIQUE 制約を追加
--
--   目的
--     ポータル同期（sumai / athome / ieuru / iei / homes）の重複取込を
--     DB レベルで止める。現在は各ハンドラの NOT EXISTS だけが頼りで、
--     同じ反響が同時にPOSTされると2件入り得る。
--
--   実行: docker exec -i dashboard-mariadb-db-1 \
--           mariadb -ulocal_user -plocal_password local_db < このファイル
--
--   冪等性: 手順1は対象0件なら何もしない。手順3は既に制約があるとエラーに
--           なるため、その場合は「Duplicate key name」を確認して読み飛ばすこと。
--
-- ----------------------------------------------------------------------------
-- ⚠ 実行前に必ず読むこと
--
--   brokerAction/broker_update.php は UPSERT を使っている:
--     INSERT INTO brokerage_listings (id, extId, ...) VALUES (...)
--     ON DUPLICATE KEY UPDATE ...
--
--   UNIQUE キーが id と extId の2本になると、「id は新規だが extId が既存行と
--   同じ」レコードを保存したときに、**extId 側で衝突して別の行が更新される**。
--   画面から extId を手入力して既存と同じ値にした場合が該当する。
--
--   現状のリスクは低い:
--     ・新規リードは extId: null で作られる（LeadSell.tsx）
--     ・broker_update.php は空文字を NULL に変換している
--     ・NULL は UNIQUE 制約の対象外（複数行が NULL を持てる）
--   ただしゼロではないため、extId を画面で編集させる運用がある場合は
--   この ALTER を見送るか、broker_update.php 側で重複チェックを足すこと。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 手順1. 空文字の extId を NULL に寄せる
--
--   実測で76件ある。UNIQUE 制約では NULL は何行あっても衝突しないが、
--   空文字は「同じ値」として扱われるため、このままでは ALTER が失敗する。
--   意味的にも「外部IDなし = NULL」が正しく、フロントの型も
--   `extId: string | null`（LeadSell.tsx）で NULL を前提にしている。
-- ---------------------------------------------------------------------------
UPDATE brokerage_listings
SET    extId = NULL
WHERE  extId = '';

-- ---------------------------------------------------------------------------
-- 手順2. 重複が残っていないか確認
--
--   ここが 0 でなければ ALTER は失敗する。0 でない場合は先に重複を解消すること
--   （どちらを残すかは業務判断が必要なため、自動では消さない）。
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS `重複しているextId(0であること)`
FROM (
    SELECT extId
    FROM   brokerage_listings
    WHERE  extId IS NOT NULL
    GROUP  BY extId
    HAVING COUNT(*) > 1
) t;

-- ---------------------------------------------------------------------------
-- 手順3. UNIQUE 制約を追加
--
--   extId は VARCHAR(100) / utf8mb4 なので索引長は 400 バイト。
--   InnoDB の上限（3072 バイト）に十分収まる。
-- ---------------------------------------------------------------------------
ALTER TABLE brokerage_listings
  ADD UNIQUE KEY `uk_extId` (`extId`);

-- ---------------------------------------------------------------------------
-- 手順4. 結果確認
-- ---------------------------------------------------------------------------
SELECT
    SUM(extId IS NULL) AS `extIdがNULL`,
    SUM(extId = '')    AS `空文字(0であること)`,
    COUNT(*)           AS `総行数`
FROM brokerage_listings;

SHOW INDEX FROM brokerage_listings WHERE Key_name = 'uk_extId';
