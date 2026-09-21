-- =====================================================================
-- competitor_pdf：既存53ファイルの company / category を埋める
--
-- ⚠️⚠️ **PDF の中身を1件ずつ読んで判断したもの**（2026-09-21）。
--   ⚠️ 53件のうち 49件は画像のみ（スキャン・写真）だったため、
--     ⚠️ **ページを画像として開いて社名と表題を読んだ。**
--
-- ⚠️⚠️ **`company` は「その顧客の competitors_text に載っている名前」しか入れない。**
--   ⚠️ 画面の他社の選択タグは `master_data.competitors_text` から作られる。
--   ⚠️ 載っていない名前を入れると ⚠️ **選び直せない値**になる。
--   ⚠️ 42件で一致した。⚠️ **残り11件は空のままにしてある。**
--
-- ⚠️ `category` は53件すべて判断できた。
--
-- ⚠️⚠️ **`no` ではなく `path` で更新する。**
--   ⚠️ `no` は移行時の採番なので ⚠️ **① とローカルで一致しない。**
--   ⚠️ `path` はファイルの実体を指すので ① でも同じである。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 先に 2026-09-21_competitor_pdf_one_row_per_file.sql を流しておくこと。
-- =====================================================================

START TRANSACTION;

/* 01 ネオデザインホーム資金計画書　宮本様邸（260626）.pdf
      ファイル名: ネオデザインホーム資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'ネオ' WHERE path = '/uploads/competitors/pdf_6a584d0bd6903_1784171787_0.pdf';

/* 02 ナンニチ見積書.pdf
      ファイル名: ナンニチ見積書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'ナンニチ' WHERE path = '/uploads/competitors/pdf_6a8ab21516ef3_1787474453_0.pdf';

/* 03 間取り.pdf
      ファイル名: 間取り／競合1社のみ */
UPDATE competitor_pdf SET category = 'その他', company = '住友林業_BF構法' WHERE path = '/uploads/competitors/pdf_6a3f63429bafb_1782539074_0.pdf';

/* 04 資金計画(3回目).pdf
      ファイル名: 資金計画(3回目)／競合1社のみ */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = '住友林業_BF構法' WHERE path = '/uploads/competitors/pdf_6a3f6342ae283_1782539074_1.pdf';

/* 05 中村様　ネオ資料2026.9.7受領.pdf
      ファイル名: ネオ資料 */
UPDATE competitor_pdf SET category = 'その他', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6aa5532976c4f_1789219625_0.pdf';

/* 06 タマ資料.pdf
      ファイル名: タマ資料 */
UPDATE competitor_pdf SET category = 'その他', company = 'タマホーム_大安心の家' WHERE path = '/uploads/competitors/pdf_6a48c7ebdf71e_1783154667_0.pdf';

/* 07 ヤマサ.pdf
      ファイル名: ヤマサ */
UPDATE competitor_pdf SET category = 'その他', company = 'ヤマサハウス' WHERE path = '/uploads/competitors/pdf_6a48cf4091151_1783156544_0.pdf';

/* 08 小川様　桧家住宅（シアーズホーム）資料.pdf
      ファイル名: 桧家住宅（シアーズホーム）資料 */
UPDATE competitor_pdf SET category = 'その他', company = '桧家住宅' WHERE path = '/uploads/competitors/pdf_6a49ad8415bc6_1783213444_0.pdf';

/* 09 松田様　七呂資料.pdf
      ファイル名: 七呂資料 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a41bb30c533e_1782692656_0.pdf';

/* 10 池田住宅提示資料.pdf
      ファイル名: 池田住宅提示資料 */
UPDATE competitor_pdf SET category = 'その他', company = '池田住宅' WHERE path = '/uploads/competitors/pdf_6a52ed6233e72_1783819618_0.pdf';

/* 11 ネオデザイン資料.pdf
      ファイル名: ネオデザイン資料 */
UPDATE competitor_pdf SET category = 'その他', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6aa74c6a6f248_1789348970_0.pdf';

/* 12 七呂資料.pdf
      ファイル名: 七呂資料 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a879007e0eba_1787269127_0.pdf';

/* 13 ｼﾞｬｽﾄﾎｰﾑ・ﾀﾏﾎｰﾑ図面・見積.pdf
      ファイル名: ジャストホーム・タマホーム図面・見積 → 2社が1ファイル */
UPDATE competitor_pdf SET category = '見積もり・提案書' WHERE path = '/uploads/competitors/pdf_6aab5beb86bb3_1789615083_0.pdf';

/* 14 20260712100551.pdf
      PDF: 資金計画書／株式会社シアーズホーム ジャストホームカンパニー */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'ジャストホーム' WHERE path = '/uploads/competitors/pdf_6a52e9f2b8d98_1783818738_0.pdf';

/* 15 20260712100609.pdf
      PDF: 平面図／サンキューホーム */
UPDATE competitor_pdf SET category = 'その他', company = 'サンキューホーム' WHERE path = '/uploads/competitors/pdf_6a52e9f2b8f2a_1783818738_1.pdf';

/* 16 20260712100623.pdf
      PDF: 立面図／サンキューホーム */
UPDATE competitor_pdf SET category = 'その他', company = 'サンキューホーム' WHERE path = '/uploads/competitors/pdf_6a52e9f2b9097_1783818738_2.pdf';

/* 17 20260712100644.pdf
      PDF: 外観パース／サンキューホーム */
UPDATE competitor_pdf SET category = 'その他', company = 'サンキューホーム' WHERE path = '/uploads/competitors/pdf_6a52e9f2b91cc_1783818738_3.pdf';

/* 18 20260712100659.pdf
      PDF: 配置図／サンキューホーム */
UPDATE competitor_pdf SET category = 'その他', company = 'サンキューホーム' WHERE path = '/uploads/competitors/pdf_6a52e9f2b92a9_1783818738_4.pdf';

/* 19 20260605-NEOデザイン　競合資料.pdf
      ファイル名: NEOデザイン競合資料 */
UPDATE competitor_pdf SET category = 'その他', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6a3cddc4958ef_1782373828_0.pdf';

/* 20 20250218_再来場CP DM.pdf
      PDF: 国分ハウジングの再来場キャンペーンDM → ⚠️ 自社。他社資料ではない */
UPDATE competitor_pdf SET category = 'チラシ' WHERE path = '/uploads/competitors/pdf_6a3dcd5ba3252_1782435163_0.pdf';

/* 21 川口様リブ資金計画書.pdf
      ファイル名: リブ資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'リブワーク' WHERE path = '/uploads/competitors/pdf_6a389014a5cbf_1782091796_0.pdf';

/* 22 川口様リブ図面.pdf
      ファイル名: リブ図面 */
UPDATE competitor_pdf SET category = 'その他', company = 'リブワーク' WHERE path = '/uploads/competitors/pdf_6a389014a6085_1782091796_1.pdf';

/* 23 2026.8.16取得ヤマサハウス.pdf
      ファイル名: ヤマサハウス */
UPDATE competitor_pdf SET category = 'その他', company = 'ヤマサハウス' WHERE path = '/uploads/competitors/pdf_6a8283cb78934_1786938315_0.pdf';

/* 24 2026.8.16取得七呂.pdf
      ファイル名: 七呂 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a8283cb79499_1786938315_1.pdf';

/* 25 シアーズホーム資金計画書.pdf
      ファイル名: シアーズホーム資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'シアーズホーム' WHERE path = '/uploads/competitors/pdf_6a3750f633f61_1782010102_0.pdf';

/* 26 NEO見積もり.pdf
      ファイル名: NEO見積もり */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6a6162ece1ea4_1784767212_0.pdf';

/* 27 S__143048728_0.pdf
      PDF: TamaHome マイホーム資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'タマホーム_大安心の家' WHERE path = '/uploads/competitors/pdf_6a92395520367_1787967829_0.pdf';

/* 28 S__143048729_0.pdf
      PDF: TOTAL HOUSING 資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'トータルハウジング' WHERE path = '/uploads/competitors/pdf_6a92395520d0e_1787967829_1.pdf';

/* 29 S__143048730_0.pdf
      PDF: NEO Design Home 資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6a92395521342_1787967829_2.pdf';

/* 30 S__143048731_0.pdf
      PDF: NEOデザインホーム 標準仕様 */
UPDATE competitor_pdf SET category = 'その他', company = 'NEOデザインホーム' WHERE path = '/uploads/competitors/pdf_6a92395521814_1787967829_3.pdf';

/* 31 S__143106052_0.pdf
      PDF: TOTAL HOUSING パース */
UPDATE competitor_pdf SET category = 'その他', company = 'トータルハウジング' WHERE path = '/uploads/competitors/pdf_6a92395521ba4_1787967829_4.pdf';

/* 32 S__143106053_0.pdf
      PDF: 1階平面図。社名の表記なし */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6a92395521fa1_1787967829_5.pdf';

/* 33 S__143106056_0.pdf
      PDF: 外観パース。社名の表記なし */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6a923955224b9_1787967829_6.pdf';

/* 34 S__143106057_0.pdf
      PDF: 平面図（手描き注記）。社名の表記なし */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6a92395522992_1787967829_7.pdf';

/* 35 S__143106060_0.pdf
      PDF: 1F平面図。社名の表記なし */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6a92395522e27_1787967829_8.pdf';

/* 36 S__143106061_0.pdf
      PDF: 完成予想パース。社名の表記なし */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6a92395523233_1787967829_9.pdf';

/* 37 田口様　南日本資金計画書.pdf
      ファイル名: 南日本資金計画書 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = '南日本ハウス' WHERE path = '/uploads/competitors/pdf_6a33b5b34744d_1781773747_0.pdf';

/* 38 七呂資料.pdf
      ファイル名: 七呂資料 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a95043193137_1788150833_0.pdf';

/* 39 七呂.pdf
      ファイル名: 七呂 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a91479b40912_1787905947_0.pdf';

/* 40 20260830七呂.pdf
      ファイル名: 七呂 */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a94bb6cdb4d9_1788132204_0.pdf';

/* 41 20260830ヤマサ（プランのみ）.pdf
      ファイル名: ヤマサ（プランのみ） */
UPDATE competitor_pdf SET category = 'その他', company = 'ヤマサハウス' WHERE path = '/uploads/competitors/pdf_6a94bb6cdbd9e_1788132204_1.pdf';

/* 42 継南建設.pdf
      ファイル名: 継南建設 */
UPDATE competitor_pdf SET category = 'その他', company = '継南建設' WHERE path = '/uploads/competitors/pdf_6aa64c3ad643a_1789283386_0.pdf';

/* 43 丸商 見積り.pdf
      ファイル名: 丸商 見積り */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = '丸商建設' WHERE path = '/uploads/competitors/pdf_6a9bdca9e583a_1788599465_0.pdf';

/* 44 西山工務店 見積り.pdf
      ファイル名: 西山工務店 見積り */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = '西山工務店' WHERE path = '/uploads/competitors/pdf_6a9bdca9e5ea8_1788599465_1.pdf';

/* 45 資金計画書　森建築合せ.pdf
      ファイル名: 資金計画書 森建築合せ → 台帳に競合の登録が無い */
UPDATE competitor_pdf SET category = '見積もり・提案書' WHERE path = '/uploads/competitors/pdf_6a8d554faf900_1787647311_0.pdf';

/* 46 他社資料.pdf
      ファイル名: 他社資料／競合1社のみ */
UPDATE competitor_pdf SET category = 'その他', company = 'ネクストイノベーション' WHERE path = '/uploads/competitors/pdf_6aa1f2fbe48bd_1788998395_0.pdf';

/* 47 七呂（プラン）.pdf
      ファイル名: 七呂（プラン） */
UPDATE competitor_pdf SET category = 'その他', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6a5c1886b7e43_1784420486_0.pdf';

/* 48 本内容にてプランのご提案及び最終のお見積りをお願い申し上げます.pdf
      ファイル名: 最終のお見積りをお願い → 競合2社のどちらか不明 */
UPDATE competitor_pdf SET category = '見積もり・提案書' WHERE path = '/uploads/competitors/pdf_6aa73839026fb_1789343801_0.pdf';

/* 49 七呂見積.pdf
      ファイル名: 七呂見積 */
UPDATE competitor_pdf SET category = '見積もり・提案書', company = '七呂建設' WHERE path = '/uploads/competitors/pdf_6aa2743cd3225_1789031484_0.pdf';

/* 50 一条ハグミー競合資料.pdf
      ファイル名: 一条ハグミー競合資料 */
UPDATE competitor_pdf SET category = 'その他', company = '一条工務店_i-smart' WHERE path = '/uploads/competitors/pdf_6a9bdb384c18b_1788599096_0.pdf';

/* 51 一条アイスマイル競合資料.pdf
      ファイル名: 一条アイスマイル競合資料 */
UPDATE competitor_pdf SET category = 'その他', company = '一条工務店_i-smart' WHERE path = '/uploads/competitors/pdf_6a9bdb384c95a_1788599096_1.pdf';

/* 52 202606タマホームシフクノ家資金計画.pdf
      ファイル名: タマホームシフクノ家資金計画 → 台帳に競合の登録が無い */
UPDATE competitor_pdf SET category = '見積もり・提案書' WHERE path = '/uploads/competitors/pdf_6a46247a940eb_1782981754_0.pdf';

/* 53 七呂仕様書.pdf
      ファイル名: 七呂仕様書 → 台帳の競合は NEOデザインホームのみ */
UPDATE competitor_pdf SET category = 'その他' WHERE path = '/uploads/competitors/pdf_6aa73822719c2_1789343778_0.pdf';

COMMIT;

-- =====================================================================
-- 確認用
-- ⚠️ category が空の行は 0 件。⚠️ company が空の行は 11 件のはず。
-- =====================================================================
SELECT category, COUNT(*) AS c FROM competitor_pdf GROUP BY category ORDER BY c DESC;

SELECT company, COUNT(*) AS c FROM competitor_pdf GROUP BY company ORDER BY c DESC;
