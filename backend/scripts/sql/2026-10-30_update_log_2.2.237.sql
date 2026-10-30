-- =====================================================================
-- v2.2.237 売り反響などの反響元「HOME's」（s が小文字）を「HOME'S」にそろえる ＋ update_log
--   （末尾に業務ガイド「売り反響・買い反響の歩留まり（不動産企画係）」の上書き）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（データの修正は何度流しても同じだが、4 の更新履歴は流すたびに1行増える）
-- ⚠️ 一覧の反響元の選択肢（画面）は "HOME'S"。設定の反響元・反響単価と既存の行が "HOME's" だったため、選択欄が空に見えていた。
-- ⚠️ 照合順序が大文字・小文字を区別しないため、比較は BINARY で "HOME's" だけを選ぶ。
-- ⚠️ 取り込み時の元データの写し（raw_data）と変更履歴（kind = logs）は記録なので直さない。
-- =====================================================================

-- 1. 反響元（売り反響・媒介獲得台帳・買い反響など、source 列のすべて）
UPDATE brokerage_listings SET source = 'HOME''S' WHERE BINARY source = 'HOME''s';

-- 1-2. 一覧の選択欄で空（NULL）に上書きされた反響元を戻す（⚠️ 反響元が空の行だけ）
--   ⚠️ v2.2.236 までは、選択肢に無い反響元の行で選択欄を触っただけで source が NULL になっていた（LeadSell.tsx を v2.2.237 で修正）
--   a) HOME'S の査定依頼メールの自動登録（extId = homes:…）は "HOME'S"
UPDATE brokerage_listings SET source = 'HOME''S'
 WHERE kind = 'leads' AND extId LIKE 'homes:%' AND (source IS NULL OR source = '');
--   b) 以前のアプリから取り込んだ行は、取り込み時の元データの写し（raw_data.source）に戻す（"HOME's" は "HOME'S" に）
UPDATE brokerage_listings
   SET source = REPLACE(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.source')), 'HOME''s', 'HOME''S')
 WHERE kind = 'leads' AND (source IS NULL OR source = '')
   AND JSON_VALID(raw_data) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.source')), '') NOT IN ('', 'null');

-- 2. 設定（反響元の一覧と、反響単価のキー）。⚠️ JSON の中の "HOME's" をそのまま "HOME'S" に置き換える
UPDATE app_state SET data = REPLACE(data, '"HOME''s"', '"HOME''S"') WHERE `key` = 'settings' AND BINARY data LIKE '%"HOME''s"%';

-- 3. 確認（1・2列目は 0、3列目は 1 ならよい。4列目は戻せなかった売り反響の数（画面で手で選び直す））
SELECT
  (SELECT COUNT(*) FROM brokerage_listings WHERE BINARY source = 'HOME''s') AS source_lower_left,
  (SELECT COUNT(*) FROM app_state WHERE `key` = 'settings' AND BINARY data LIKE '%"HOME''s"%') AS settings_lower_left,
  (SELECT JSON_VALID(data) FROM app_state WHERE `key` = 'settings') AS settings_json_ok,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'leads' AND (source IS NULL OR source = '')) AS leads_source_empty_left;

-- 4. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.237', '2026-10-30', '売り反響の反響元「HOME''s」を、一覧の選択肢と同じ「HOME''S」にそろえた（既存の反響・媒介獲得台帳・買い反響・設定の反響元と反響単価、HOME''S の査定依頼メールの自動登録）。売り反響の一覧で、反響元の欄を触っただけで反響元が消える不具合を直した。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-245.md：売り反響・買い反響の歩留まり（不動産企画係）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '売り反響・買い反響の歩留まり（不動産企画係）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('売り反響・買い反響の歩留まり（不動産企画係）', 'common', '画面の使い方', '売り反響・買い反響の画面の上に出るタイル・反響元別・担当者別のファネルの数え方。以前のアプリと同じ。', '不動産企画係の「売り反響(一括査定)」「買い反響(ポータル)」の画面の上には、歩留まりのタイルと表が出ます。数え方は以前のアプリとまったく同じです。

## 対象期間
左上で選びます。
- **月別（今期）**：今期の12か月から1か月
- **通期（期ごと）**：1期分（期首月は[[設定（不動産企画係）]]の値）
- **全期間**：過去すべて

開いたときは今月です。下の一覧も、選んだ期間に受信した反響になります。

## 数え方（受信月コホート）
選んだ期間に**受信した反響**が、いまどこまで進んでいるかを数えます。

売り反響
- **通電**：通電日が入っているか、段階が「通電済」「訪問査定予定」「訪問査定済」「査定書提出」「媒介受託」
- **訪問査定**：訪問査定日が入っているか、段階が「訪問査定済」「査定書提出」「媒介受託」
- **査定書提出**：段階が「査定書提出」「媒介受託」
- **媒介受託**：段階が「媒介受託」

買い反響
- **通電**：通電日が入っているか、段階が「通電済」「内見予約」「内見済」「購入申込」「成約」
- **内見**：内見日が入っているか、段階が「内見済」「購入申込」「成約」
- **購入申込**：段階が「購入申込」「成約」
- **成約**：段階が「成約」

## 架電の数
- 架電だけは「その期間に**した**架電」を数えます（受信した月ではありません）
- 📞架電だけを数えます。LINE・メールはタイルの下に別に出します
- 担当者別の表では、反響の担当者で数えます
- タイルの「本日」「今週」は、期間に関係なくチーム全体の数です

## 反響元別（ポータル別）の表
- 反響単価は[[設定（不動産企画係）]]の値です。反響費用＝反響の数×反響単価
- 媒介獲得単価（申込単価）＝反響費用÷媒介受託（購入申込）

> 注意：率は小数第1位まで。分母が0のときは「―」です。

## HOME''S の査定依頼メールの自動登録
LIFULL HOME''S の「＜実名＞査定依頼がありました」のメールは、届いてから数分で**売り反響に自動で登録**されます（5分おきに直近1日分のメールを確かめます）。
- 反響元は「HOME''S」、段階は「リード受信」、担当は空です。担当は一覧で割り当ててください
- 物件の所在地・物件種別（区分）・売却理由・売却希望時期・お名前・電話・メールが入ります
- 間取り・面積・築年・現況・名義・ご要望・お客様の記入・同時送信社数・査定IDは**備考**に入ります
- 同じ査定IDのメールや、前後90日に**同じ電話番号の売り反響**がすでにあるときは、登録しません（コールセンターの明細などで先に入っている場合も二重になりません）

> 注意：＜匿名＞の査定依頼（連絡先が無いもの）は登録しません。HOME''S の Manager で確認してください。
', 245, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
