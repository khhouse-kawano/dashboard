-- =====================================================================
-- update_log に v2.2.199 を追加する ＋ 業務ガイドの記事
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作ったもの（⚠️ 手で直さない）。
-- ⚠️ 表（tracking_sites / tracking_touches）は別ファイル 2026-10-20_tracking_tables.sql（先に流す）。
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.199', '2026-10-20', '各ブランドサイトに貼るタグ（広告流入トラッキング）を追加した。サイトを見た人に顧客IDを振り、広告から来た情報をフォームのないページに着地しても保持して反響と一緒に届ける。反響一覧（注文）の「流入」から流入履歴が見られる。タグは「反響管理 → トラッキング設定」で発行する。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（2本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-200.md：トラッキング設定
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'トラッキング設定';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('トラッキング設定', 'common', '画面の使い方', '各ブランドサイトに貼るタグの発行。広告から来た人の流入情報と、訪問者ごとの顧客IDを記録する。', 'ヘッダーの「反響管理 → トラッキング設定」（管理者だけ）。各ブランドサイトのフッターに貼る**タグ**を発行する画面です。

[[画面:トラッキング設定]]

## タグがすること
- サイトを見た人**全員**に、**顧客ID**を振ります（同じブラウザなら、日をまたいでも同じID）
- 広告（Google・Meta・Yahoo!）や、utm の付いたURLから来たときは、その情報を覚えます。**フォームの無いLPに着地しても**消えません
- フォームから問い合わせると、顧客IDと広告の情報が、反響と一緒に届きます
- 反響一覧（注文営業）の「流入」から、その人がいつ・どの広告から来たかを見られます（[[反響一覧]]）

> 注意：顧客IDは**サイト（ドメイン）ごと**です。kh-house.jp と day-just-house.com では別のIDになります。

## サイトを登録する
1. 「サイトを登録」を押す
2. サイト名・ブランドを入れる
3. 「許可するオリジン」に、タグを貼るサイトの **https://ドメイン** を入れる（例：https://kh-house.jp。/ 以降は不要。www の有り無しが両方あるなら2行）
4. 「保存する」→ そのサイトのタグが開きます

## タグを貼る
- 「タグ」を押し、「コピー」でタグをコピーします
- サイトの**すべてのページ**のフッターに**1回だけ**貼ります
- WordPress の場合は、WPCode の Footer 欄、またはテーマのフッターに貼ります
- 貼ったあと、広告のURL（例：?utm_source=test）でサイトを開くと、「直近30日の着地」「最後の着地」が増えます

> 注意：ここに無いドメインからの記録は保存しません。ドメインを変えたら「直す」で許可するオリジンも直してください。

## 止める
- 「直す」で「有効」を外すと、記録を止めます。タグを貼ったままでもサイトの表示やフォームには影響しません
- サイトは消せません（記録が残るため）

> 要確認：顧客IDはお客様のブラウザに保存します。公開する前に、プライバシーポリシーへ利用目的を書く必要があります。担当者に確認してください。

## 関係する記事
- [[反響一覧]]
', 200, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-010.md：反響一覧
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧', 'order', '画面の使い方', '届いた反響の確認・割り振り・取込をする画面。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込む画面です。

[[画面:反響一覧]]

## 絞り込み
- 期間（はじめは前月〜今月）
- 店舗・課・媒体
- 取込状況（取込済み／未取込）
- 氏名・住所

## 上の集計
- **反響合計**（括弧内は未同期）
- **反響目標**：営業の人数 × 8（1か月）
- **来場合計**：初回面談の月で数える
- **来場目標**：営業の人数 × 4

## 列の見方
- **重複**：氏名・携帯・メールのうち2つ以上が同じ、別の反響があると表示されます
- **顧客タグ**：重複／ギフト券進呈済み／業者／ブラックリスト
- **流入**（反響媒体の下の青い札）：ホームページの反響で、広告などから来た情報があるときに出ます。札には流入元（Google など）が出ます。押すと、顧客IDと、その人がいつ・どの広告からサイトに来たかが見られます
  - 灰色の「流入：ID」は、広告の情報が無く顧客IDだけがあるもの（自然検索・直接の訪問など）です

## 流入履歴の見方
- **顧客ID**：サイトがお客様ごとに振るIDです。「コピー」で写せます
- **流入元・キャンペーン**：反響と一緒に届いた広告の情報です
- **広告からの着地**：同じお客様が広告からサイトに来た記録（新しい順）。問い合わせの前に何回来ていたかが分かります

> 注意：タグを貼る前の反響には札が出ません。タグについては [[トラッキング設定]] を見てください。

> 注意：ひらがなのフリガナは、取込のときにカタカナへ自動で直ります。

## 関係する記事
- [[反響が来たら]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
