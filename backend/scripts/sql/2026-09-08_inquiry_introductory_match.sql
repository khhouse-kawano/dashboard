-- ===========================================================
-- inquiry_introductory の既存反響を master_data の顧客に紐づける
--
-- 2026-09-08
--
-- ─────────────────────────────────────────────
-- 何をするか
--
--   お友達（紹介された人）が**既に顧客台帳にいる**場合、その顧客の
--   担当店舗・担当営業を反響側にも写し、取り込み済みとして扱う。
--
--     i.shop           ← m.in_charge_store
--     i.staff          ← m.in_charge_user
--     i.sync           ← 1
--     i.master_data_id ← m.id
--
--   突き合わせは **【お友達】電話番号（friendTel）** のみで行う。
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **`mail` では突き合わせない。**
--
--   inquiry_introductory の `mail` は**紹介者（登録者）**のメールアドレスで、
--   お友達のものではない（列コメント参照）。
--   実データで検証したところ
--
--     mail が一致した25組のうち
--       紹介者と氏名一致 … 24組
--       お友達と氏名一致 … **0組**
--
--   つまり mail で当たるのは**紹介者自身の顧客レコード**である。
--   それを master_data_id に入れて sync=1 にすると
--     ・別人の顧客IDが紐づく
--     ・「お友達を取り込み済み」と誤って記録される
--     ・sync=1 の行は担当変更も同期も拒否されるため、
--       **そのお友達は永久に顧客として取り込まれなくなる**
--   という壊れ方をする。だから使わない。
--
-- ⚠️ 逆に friendTel は妥当だった。一致36組のうち
--     お友達と氏名一致（空白無視） … 28組
--     残りも「押川銀次郎/押川 銀次朗」「高野/髙野」のような誤字・異体字、
--     または電話を共有する家族だった。
--
-- ⚠️ ハイフンと空白は無視して照合する。
--   反響は90件中10件がハイフンあり、台帳は2,485件があり／21,546件がなし。
--   完全一致だと表記が違うだけの9件を取りこぼす。
--
-- ⚠️ 複数の顧客に当たる反響が13件ある（2件一致9／3件一致3／5件一致1）。
--   氏名（空白無視）が一致するものを最優先し、次に登録が新しいもの
--   （master_data.no が大きいもの）を1件だけ採る。
--   ⚠️ 家族で電話を共有しているケース（山下羅那／山下昇平）で
--     本人を選べるようにするため、氏名を先に見る。
--
-- ⚠️ `sync = 1` の行は対象外。既に取り込み済みのものを上書きしない。
--
-- ⚠️ 適用は phpMyAdmin のインポート機能を使うこと。
--   シェルのパイプ（mysql < file）だと日本語のコメントが文字化けする。
-- ===========================================================

-- -----------------------------------------------------------
-- 1. 紐づけ先を決める作業表を作る
--
-- ⚠️ 一時表を挟む理由: UPDATE の FROM 句で更新対象と同じ表を参照できない
--   （MySQL/MariaDB の制約）。また、当てる前に中身を目視できる。
-- -----------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_intro_match;

CREATE TEMPORARY TABLE tmp_intro_match (
  inq_no          INT          NOT NULL PRIMARY KEY COMMENT 'inquiry_introductory.no',
  master_data_id  VARCHAR(64)  NOT NULL COMMENT '紐づける master_data.id',
  shop            VARCHAR(64)  NOT NULL COMMENT 'm.in_charge_store',
  staff           VARCHAR(128) NOT NULL COMMENT 'm.in_charge_user',
  friend_name     VARCHAR(128) NOT NULL COMMENT '反響側のお友達氏名（確認用）',
  master_name     VARCHAR(191) NOT NULL COMMENT '台帳側の氏名（確認用）',
  name_matched    TINYINT      NOT NULL COMMENT '1=氏名も一致（空白無視）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tmp_intro_match
    (inq_no, master_data_id, shop, staff, friend_name, master_name, name_matched)
SELECT inq_no, m_id, m_shop, m_staff, friend_name, master_name, name_matched
  FROM (
    SELECT
        i.no                                        AS inq_no,
        m.id                                        AS m_id,
        COALESCE(m.in_charge_store, '')             AS m_shop,
        COALESCE(m.in_charge_user, '')              AS m_staff,
        i.friendName                                AS friend_name,
        COALESCE(m.customer_contacts_name, '')      AS master_name,
        -- ⚠️ 空白（半角・全角）を無視して氏名を比較する。
        --   台帳は「押川 銀次朗」のように姓名の間に空白を入れる運用。
        CASE WHEN REPLACE(REPLACE(COALESCE(m.customer_contacts_name, ''), ' ', ''), '　', '')
                = REPLACE(REPLACE(i.friendName, ' ', ''), '　', '')
             THEN 1 ELSE 0 END                      AS name_matched,
        ROW_NUMBER() OVER (
            PARTITION BY i.no
            ORDER BY
                -- ⚠️ 氏名が一致するものを最優先（家族で電話を共有している場合に本人を選ぶ）
                CASE WHEN REPLACE(REPLACE(COALESCE(m.customer_contacts_name, ''), ' ', ''), '　', '')
                        = REPLACE(REPLACE(i.friendName, ' ', ''), '　', '')
                     THEN 0 ELSE 1 END,
                -- 次に登録が新しいもの。⚠️ no は auto_increment
                m.no DESC
        )                                           AS rn
      FROM inquiry_introductory i
      JOIN master_data m
        ON (
             COALESCE(m.customer_contacts_mobile_phone_number, '') <> ''
             AND REPLACE(REPLACE(m.customer_contacts_mobile_phone_number, '-', ''), ' ', '')
               = REPLACE(REPLACE(i.friendTel, '-', ''), ' ', '')
           )
        OR (
             COALESCE(m.customer_contacts_phone_number, '') <> ''
             AND REPLACE(REPLACE(m.customer_contacts_phone_number, '-', ''), ' ', '')
               = REPLACE(REPLACE(i.friendTel, '-', ''), ' ', '')
           )
     WHERE i.sync <> 1
       -- ⚠️ 空文字で照合しない。'' = '' で全件が当たってしまう
       AND REPLACE(REPLACE(i.friendTel, '-', ''), ' ', '') <> ''
       -- ⚠️ 削除済みの顧客に紐づけない（一覧にも集計にも出ない顧客になる）
       AND COALESCE(m.show_dashboard, 0) = 1
       -- ⚠️ 担当が決まっていない顧客は写せない
       AND COALESCE(m.in_charge_store, '') <> ''
  ) ranked
 WHERE rn = 1;

-- -----------------------------------------------------------
-- 2. 当てる前の確認（⚠️ ここで件数と中身を必ず見る）
-- -----------------------------------------------------------
SELECT '--- 紐づけ対象の件数 ---' AS x;
SELECT COUNT(*) AS 対象件数, SUM(name_matched) AS うち氏名も一致 FROM tmp_intro_match;

SELECT '--- 氏名が一致しなかったもの（目視で確認する）---' AS x;
SELECT inq_no, friend_name AS 反響のお友達, master_name AS 台帳の氏名, shop AS 店舗
  FROM tmp_intro_match WHERE name_matched = 0 ORDER BY inq_no;

-- -----------------------------------------------------------
-- 3. 反映
-- -----------------------------------------------------------
UPDATE inquiry_introductory i
  JOIN tmp_intro_match t ON t.inq_no = i.no
   SET i.shop           = t.shop,
       i.staff          = t.staff,
       i.sync           = 1,
       i.master_data_id = t.master_data_id;

-- -----------------------------------------------------------
-- 4. 反映後の確認
-- -----------------------------------------------------------
SELECT '--- 反映後の状態 ---' AS x;
SELECT COUNT(*) AS 全件,
       SUM(sync = 1) AS 同期済み,
       SUM(COALESCE(master_data_id,'') <> '') AS ID紐づけ済み,
       SUM(COALESCE(shop,'') <> '') AS 店舗設定済み
  FROM inquiry_introductory;

DROP TEMPORARY TABLE IF EXISTS tmp_intro_match;
