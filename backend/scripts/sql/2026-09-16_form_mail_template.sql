-- ---------------------------------------------------------------------------
-- キャンペーンフォームのメール本文を編集できるようにする（2026-09-16 の指示）
--
-- ⚠️⚠️ **DEFAULT '' を必ず付けること。**
--   ⚠️ ① の `khg-marketing.info/api/` にある `form_post` は
--     これらの列を知らないまま INSERT する。
--   ⚠️ 既定値が無いと **新規登録がまるごと失敗する**。
--
-- ⚠️⚠️ **`notice_*` という名前にしないこと。**
--   ⚠️ `form_table.notice` は既にあり、**フォーム画面の「注意書き」**である。
--     社内通知メールと取り違えると事故る。ここでは `internal_*` を使う。
--
-- ⚠️⚠️ **既存340件へ本文を書き写さない。**
--   ⚠️ 空のときは実装側の既定文面を使う（mailTemplate.ts の DEFAULT_*）。
--   ⚠️ 書き写すと、将来ひな型を直しても**古い本文が全件に残り続ける**。
-- ---------------------------------------------------------------------------

ALTER TABLE form_table
  ADD COLUMN thanks_subject   TEXT     NOT NULL DEFAULT '' COMMENT 'サンクスメールの件名。空なら既定',
  ADD COLUMN thanks_body      LONGTEXT NOT NULL DEFAULT '' COMMENT 'サンクスメールの本文。空なら既定',
  ADD COLUMN internal_subject TEXT     NOT NULL DEFAULT '' COMMENT '社内通知メールの件名。空なら既定',
  ADD COLUMN internal_body    LONGTEXT NOT NULL DEFAULT '' COMMENT '社内通知メールの本文。空なら既定';
