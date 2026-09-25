-- =====================================================================
-- ふりがな（customer_contacts_name_kana / _kana_2）をカタカナに揃える
--
-- 目的: Nexus へ顧客データを移行できる形にすること。
--       Nexus はふりがなが **カタカナ** でないと受け付けない。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 上から順に、1ブロックずつ実行すること。まとめて流さないこと。
-- ⚠️ 手順2（退避テーブル）を飛ばさないこと。戻せなくなる。
--
-- ⚠️ 変換するのはひらがなだけ。
--    漢字・英字・半角カナ・全角スペース・中黒には触らない。
--    （半角カナで入っている行は手で直すしかない。手順1-2 で数えられる）
--
-- ⚠️ 何度実行しても同じ結果になる（カタカナはもう置換されない）。
-- =====================================================================


-- ---------------------------------------------------------------------
-- 手順1-1　これから変換される件数を数える
--   0件なら以降は実行しなくてよい。
-- ---------------------------------------------------------------------
SELECT
  SUM(CASE WHEN customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_hira,
  SUM(CASE WHEN customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_2_hira
FROM master_data;


-- ---------------------------------------------------------------------
-- 手順1-2　半角カナが入っている行を数える（このSQLでは直らない）
--   0件でないときは、件数をオーナーに伝えてから先へ進むこと。
-- ---------------------------------------------------------------------
SELECT
  SUM(CASE WHEN customer_contacts_name_kana REGEXP '[ｦ-ﾟ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_hankaku,
  SUM(CASE WHEN customer_contacts_name_kana_2 REGEXP '[ｦ-ﾟ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_2_hankaku
FROM master_data;


-- ---------------------------------------------------------------------
-- 手順2　退避テーブルを作る（戻すときに使う）
--   ⚠️ 既にあるときはエラーになる。その日のうちに作り直すなら
--     テーブル名の日付を変えること。DROP はしないこと。
-- ---------------------------------------------------------------------
CREATE TABLE master_data_kana_backup_20260925 AS
SELECT id, customer_contacts_name_kana, customer_contacts_name_kana_2
  FROM master_data
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]' OR customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';


-- 退避できた件数を確認する（手順1-1 の合計以上であること）
SELECT COUNT(*) AS backup_rows FROM master_data_kana_backup_20260925;


-- ---------------------------------------------------------------------
-- 手順3　置換する
--   ⚠️ REPLACE を深く入れ子にできないため、16 文字ずつに分けてある。
--   ⚠️ 番号順にすべて実行すること。1本でも飛ばすとその文字だけ残る。
-- ---------------------------------------------------------------------

-- 手順3-1　customer_contacts_name_kana（ぁ〜ぐ）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'ぁ', 'ァ'), 'あ', 'ア'), 'ぃ', 'ィ'), 'い', 'イ'), 'ぅ', 'ゥ'), 'う', 'ウ'), 'ぇ', 'ェ'), 'え', 'エ'), 'ぉ', 'ォ'), 'お', 'オ'), 'か', 'カ'), 'が', 'ガ'), 'き', 'キ'), 'ぎ', 'ギ'), 'く', 'ク'), 'ぐ', 'グ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-2　customer_contacts_name_kana（け〜だ）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'け', 'ケ'), 'げ', 'ゲ'), 'こ', 'コ'), 'ご', 'ゴ'), 'さ', 'サ'), 'ざ', 'ザ'), 'し', 'シ'), 'じ', 'ジ'), 'す', 'ス'), 'ず', 'ズ'), 'せ', 'セ'), 'ぜ', 'ゼ'), 'そ', 'ソ'), 'ぞ', 'ゾ'), 'た', 'タ'), 'だ', 'ダ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-3　customer_contacts_name_kana（ち〜ば）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'ち', 'チ'), 'ぢ', 'ヂ'), 'っ', 'ッ'), 'つ', 'ツ'), 'づ', 'ヅ'), 'て', 'テ'), 'で', 'デ'), 'と', 'ト'), 'ど', 'ド'), 'な', 'ナ'), 'に', 'ニ'), 'ぬ', 'ヌ'), 'ね', 'ネ'), 'の', 'ノ'), 'は', 'ハ'), 'ば', 'バ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-4　customer_contacts_name_kana（ぱ〜む）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'ぱ', 'パ'), 'ひ', 'ヒ'), 'び', 'ビ'), 'ぴ', 'ピ'), 'ふ', 'フ'), 'ぶ', 'ブ'), 'ぷ', 'プ'), 'へ', 'ヘ'), 'べ', 'ベ'), 'ぺ', 'ペ'), 'ほ', 'ホ'), 'ぼ', 'ボ'), 'ぽ', 'ポ'), 'ま', 'マ'), 'み', 'ミ'), 'む', 'ム')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-5　customer_contacts_name_kana（め〜ゐ）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'め', 'メ'), 'も', 'モ'), 'ゃ', 'ャ'), 'や', 'ヤ'), 'ゅ', 'ュ'), 'ゆ', 'ユ'), 'ょ', 'ョ'), 'よ', 'ヨ'), 'ら', 'ラ'), 'り', 'リ'), 'る', 'ル'), 'れ', 'レ'), 'ろ', 'ロ'), 'ゎ', 'ヮ'), 'わ', 'ワ'), 'ゐ', 'ヰ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-6　customer_contacts_name_kana（ゑ〜ゞ）
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'ゑ', 'ヱ'), 'を', 'ヲ'), 'ん', 'ン'), 'ゔ', 'ヴ'), 'ゕ', 'ヵ'), 'ゖ', 'ヶ'), 'ゝ', 'ヽ'), 'ゞ', 'ヾ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-7　customer_contacts_name_kana_2（ぁ〜ぐ）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'ぁ', 'ァ'), 'あ', 'ア'), 'ぃ', 'ィ'), 'い', 'イ'), 'ぅ', 'ゥ'), 'う', 'ウ'), 'ぇ', 'ェ'), 'え', 'エ'), 'ぉ', 'ォ'), 'お', 'オ'), 'か', 'カ'), 'が', 'ガ'), 'き', 'キ'), 'ぎ', 'ギ'), 'く', 'ク'), 'ぐ', 'グ')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-8　customer_contacts_name_kana_2（け〜だ）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'け', 'ケ'), 'げ', 'ゲ'), 'こ', 'コ'), 'ご', 'ゴ'), 'さ', 'サ'), 'ざ', 'ザ'), 'し', 'シ'), 'じ', 'ジ'), 'す', 'ス'), 'ず', 'ズ'), 'せ', 'セ'), 'ぜ', 'ゼ'), 'そ', 'ソ'), 'ぞ', 'ゾ'), 'た', 'タ'), 'だ', 'ダ')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-9　customer_contacts_name_kana_2（ち〜ば）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'ち', 'チ'), 'ぢ', 'ヂ'), 'っ', 'ッ'), 'つ', 'ツ'), 'づ', 'ヅ'), 'て', 'テ'), 'で', 'デ'), 'と', 'ト'), 'ど', 'ド'), 'な', 'ナ'), 'に', 'ニ'), 'ぬ', 'ヌ'), 'ね', 'ネ'), 'の', 'ノ'), 'は', 'ハ'), 'ば', 'バ')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-10　customer_contacts_name_kana_2（ぱ〜む）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'ぱ', 'パ'), 'ひ', 'ヒ'), 'び', 'ビ'), 'ぴ', 'ピ'), 'ふ', 'フ'), 'ぶ', 'ブ'), 'ぷ', 'プ'), 'へ', 'ヘ'), 'べ', 'ベ'), 'ぺ', 'ペ'), 'ほ', 'ホ'), 'ぼ', 'ボ'), 'ぽ', 'ポ'), 'ま', 'マ'), 'み', 'ミ'), 'む', 'ム')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-11　customer_contacts_name_kana_2（め〜ゐ）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'め', 'メ'), 'も', 'モ'), 'ゃ', 'ャ'), 'や', 'ヤ'), 'ゅ', 'ュ'), 'ゆ', 'ユ'), 'ょ', 'ョ'), 'よ', 'ヨ'), 'ら', 'ラ'), 'り', 'リ'), 'る', 'ル'), 'れ', 'レ'), 'ろ', 'ロ'), 'ゎ', 'ヮ'), 'わ', 'ワ'), 'ゐ', 'ヰ')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';

-- 手順3-12　customer_contacts_name_kana_2（ゑ〜ゞ）
UPDATE master_data
   SET customer_contacts_name_kana_2 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana_2, 'ゑ', 'ヱ'), 'を', 'ヲ'), 'ん', 'ン'), 'ゔ', 'ヴ'), 'ゕ', 'ヵ'), 'ゖ', 'ヶ'), 'ゝ', 'ヽ'), 'ゞ', 'ヾ')
 WHERE customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]';


-- ---------------------------------------------------------------------
-- 手順4　検証する。**すべて 0 になること。**
--   0 でない列が残ったら、手順3 のどれかを実行し忘れている。
-- ---------------------------------------------------------------------
SELECT
  SUM(CASE WHEN customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_hira,
  SUM(CASE WHEN customer_contacts_name_kana_2 REGEXP '[ぁ-ゖゝゞ]' THEN 1 ELSE 0 END) AS customer_contacts_name_kana_2_hira
FROM master_data;


-- ---------------------------------------------------------------------
-- 戻し方（手順3 を実行したあとで元に戻したくなったとき）
--   ⚠️ 退避テーブルを作ったあとに別の更新が入っていると、
--     その更新も一緒に巻き戻る。実行前にオーナーへ確認すること。
-- ---------------------------------------------------------------------
-- UPDATE master_data m
--   JOIN master_data_kana_backup_20260925 b ON b.id = m.id
--    SET m.customer_contacts_name_kana = b.customer_contacts_name_kana,
--        m.customer_contacts_name_kana_2 = b.customer_contacts_name_kana_2;


-- ---------------------------------------------------------------------
-- 後片付け（数日おいて問題がなければ）
-- ---------------------------------------------------------------------
-- DROP TABLE master_data_kana_backup_20260925;
