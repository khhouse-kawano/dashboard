-- ---------------------------------------------------------------------------
-- Instagram と Web検索 を販促媒体別の行に出す（2026-09-18 の指示）
--
-- ⚠️⚠️ **画面のコードは変えていない。** 行は `medium_kaeru.show_graph = 1` から作る。
--   ⚠️ 表記ゆれを寄せた結果、この2つに大きな販促費が集まるようになったため、
--     ⚠️ **「ホームページ反響」に埋もれさせない。**
--
-- ⚠️ ローカルの実測（2026-09-18 / budget / section = 'spec'）
--     Instagram（SNS広告 を寄せた分）   ¥88,081,670
--     Web検索（インターネット検索 を寄せた分） ¥98,218,945
--   ⚠️ 合計 **¥186,300,615**（⚠️ 建売の販促費 ¥282,481,113 の **66%**）が
--     ⚠️ **1行にまとまって見えなくなっていた。**
--
-- ⚠️⚠️ **`show_graph = 1` を増やすと「ホームページ反響」の行はその分だけ減る。**
--   ⚠️ 総反響の行は変わらない。**合計が合わなくなったわけではない。**
--
-- ⚠️ 表記の寄せ先は frontend/src/components/customer/customerKaeruUtils.ts の
--   `MEDIUM_ALIAS`。⚠️ **片方だけ変えないこと。**
--
-- ⚠️ 実行先は ⚠️ **① レンタルサーバー（Xserver）の phpMyAdmin**。
-- ---------------------------------------------------------------------------

UPDATE medium_kaeru
   SET show_graph = 1
 WHERE medium IN ('Instagram', 'Web検索');

-- ⚠️ 確認。⚠️ **6件が 1 になっていること**
--   （SUUMO / HOME'S / アットホーム / 公式LINE / Instagram / Web検索）
-- SELECT no, medium, show_graph FROM medium_kaeru ORDER BY show_graph DESC, no;
