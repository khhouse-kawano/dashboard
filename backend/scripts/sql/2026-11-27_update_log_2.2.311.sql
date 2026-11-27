-- =====================================================================
-- v2.2.311 建売営業のメニューに「土地仕入」を追加（仕入KPI管理 v7.3 の移行） ＋ update_log ＋ 業務ガイド9本 ＋ テーブル定義書16テーブル
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 先に 2026-11-27_land_acquisition_tables.sql（テーブルの作成）を流すこと
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.311', '2026-11-27', '建売営業のメニューを「建売営業」と「土地仕入」に分けました。土地仕入に、仕入ダッシュボード・日次・アプローチ・仕入案件一覧・業者マスタ・仕入分析・個人別実績・目標・月次入力・仕入設定を追加しました（仕入KPI管理からの移行）。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（9本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/flow-050.md：土地仕入の流れ（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '土地仕入の流れ（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('土地仕入の流れ（建売営業）', 'spec', '業務の流れ', '土地仕入れチームの仕事を Dashboard で進める順番。業者へのアプローチから、案件・買付・契約・決済まで。', '左のメニューの「土地仕入」は、土地仕入れチームの画面です（2026年11月に「仕入KPI管理」から移しました）。建売営業の人なら誰でも見られます。

## 毎日やること
1. [[日次・アプローチ（建売営業）]] で、業者への訪問・架電などを1件ずつ記録する（件数だけでよいものは「まとめ入力」）
2. 土地の情報が出たら「案件候補」にしておき、「案件化待ち」から案件にする
3. 1日の終わりに「簡易日報」を書く

## 案件を進める
1. [[仕入案件一覧（建売営業）]] で、案件のステータスを進める（情報取得 → 社長提案 → 買付 → 契約 → 決済完了。見送りもある）
2. 買付を出したら、買付提出先と返答期日を入れる。返答が来たら、返答結果（承諾・否決・保留・再交渉）を入れる
3. 見送り・否決になったら、失注理由を選ぶ

> 注意：返答期日を過ぎた買付や、今日が期日の買付は、[[仕入ダッシュボード（建売営業）]] の「買付 返答期日アラート」に赤く出ます。毎朝確かめてください。

## 数字を見る
- [[仕入ダッシュボード（建売営業）]] で、業者AP・情報取得・社長提案・買付・契約・仕入区画の実績と目標を見ます
- どこで詰まっているかは [[仕入分析（建売営業）]]、1人ずつの数字と月次レビューは [[個人別実績（建売営業）]] で見ます
- 業者ごとの付き合いは [[業者マスタ（建売営業）]] で見ます

## 月のはじめ・終わりにやること
- [[目標・月次入力（建売営業）]] で、その月の目標を入れる
- 月末に [[個人別実績（建売営業）]] で月次レビュー（育成フェーズ・ボトルネック・上長コメント）を残す

> 要確認：Dashboard で記録を始めたら、今までの仕入KPI管理には入れないでください（両方に入れると数字が合わなくなります）。図面などの資料は、まだ仕入KPI管理にあります。

## 関係する記事
- [[仕入設定（建売営業）]]
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-090.md：仕入ダッシュボード（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '仕入ダッシュボード（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('仕入ダッシュボード（建売営業）', 'spec', '画面の使い方', '土地仕入れの KPI（業者AP・情報取得・社長提案・買付・契約・仕入区画）の実績と目標、買付の返答期日アラート、案件化待ち、担当者別・エリア別・月次推移。', '左のメニュー「土地仕入」→「仕入ダッシュボード」。土地仕入れチームの数字をまとめて見る画面です。

[[画面:仕入ダッシュボード]]

## 上の欄
- 担当：チーム全員・エリアの合算・1人ずつから選びます
- 集計期間：「毎月」は選んだ月だけ、「通期」は年度（6月〜翌5月）の累計です
- 選んだ条件は画面のアドレスにも付きます。アドレスを開き直すと、同じ条件で出ます

## カードの見方
- 業者AP：アプローチを1件ずつ記録した数と、まとめ入力の件数の合計
- 情報取得：案件の情報取得日の数と、アプローチ・まとめ入力で入れた情報取得の数の合計（案件にした分は二重に数えません）
- 社長提案・買付・契約：案件のその日付が入った数
- 仕入区画：契約日が入った案件の区画数
- 月次入力で手で入れた数があれば、それも足します
- バーの縦の線は、月（通期なら年度）の経過です。バーが線より右なら、目標のペースに乗っています

> 注意：目標が入っていない指標は、達成率が「—」になります。

## 買付 返答期日アラート
返答待ちの買付（ステータスが買付で、返答結果が未登録）を、急ぐ順に出します。選んだ月に関係なく、いまの返答待ち全部です。
- 期限超過・本日が期日は赤く出ます
- 「返答・期日」を押すと、案件の画面が開きます

## 案件化待ちリスト
「案件候補」にしたアプローチのうち、まだ案件にしていないものです。「案件にする」を押すと、業者名・所在地などが入った状態で案件の登録画面が開きます。

## 表
- 担当者別 進捗：行を押すと、その人に絞ります
- エリア別 集計：チーム全員のときに出ます。行を押すと、そのエリアに絞ります
- 月次推移：年度の12か月です。行を押すと、その月に切り替えます
', 90, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-100.md：日次・アプローチ（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '日次・アプローチ（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('日次・アプローチ（建売営業）', 'spec', '画面の使い方', '業者へのアプローチを1件ずつ記録する。まとめ入力（件数だけ）、簡易日報、日別の記録、案件化待ち。', '左のメニュー「土地仕入」→「日次・アプローチ」。毎日の行動を入れる画面です。

[[画面:日次・アプローチ]]

## はじめに
- 上の「担当者」と「日付」を選びます。ログインした人が担当者に結び付いていれば、開いたときに自分が選ばれます（結び付けは [[仕入設定（建売営業）]]）
- 上のカードに、その人のその月の実績と目標が出ます

## アプローチを1件ずつ記録
- 業者名は、業者マスタにある名前が候補に出ます。無い名前を入れると、業者マスタに新しく足されます
- 種別（訪問・架電・受電・メール・FAX・直案件・業者持込）、反応、情報取得数（このアプローチで得た土地情報の件数）を入れます
- 直案件・業者持込を選ぶと「案件候補」に印が付きます。印を付けたものは「案件化待ち」に出ます
- 記録したものは下の「個人アプローチ履歴」に出ます。「直す」「削除」もそこからできます

## まとめ入力
1件ずつ記録しない訪問・架電などの件数を、日ごとにまとめて入れます。
- 1日・1人につき1件です。同じ日にもう一度保存すると上書きされます

## 簡易日報
本日の活動・取得情報・課題・明日の予定を書きます。1日・1人につき1本で、同じ日に保存すると上書きされます。

## 日別の記録
その月の日ごとの件数です。行を押すと、その日に切り替わります（まとめ入力・日報の欄にその日の内容が出ます）。

## 案件化待ち
案件候補のアプローチです。「案件にする」を押すと、案件の登録画面が開きます。案件にすると、ここから消えます。
', 100, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-110.md：仕入案件一覧（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '仕入案件一覧（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('仕入案件一覧（建売営業）', 'spec', '画面の使い方', '土地の仕入案件の一覧と登録・編集。ステータス、買付の返答、事業収支（買付上限）、失注理由、決済完了の実績。', '左のメニュー「土地仕入」→「仕入案件一覧」。土地の情報（案件）を、情報取得から決済まで管理する画面です。

[[画面:仕入案件一覧]]

## 一覧
- 開いたときは30件出ます。下までスクロールすると、次の30件が出ます
- 上の欄で、担当・ステータス・種別・買付の返答・対象期間・検索で絞れます。条件は画面のアドレスにも付きます
- 対象期間は、情報取得日・社長提案日・買付日・契約日・決済日のどれかがその月に入る案件です
- 見出しを押すと並べ替えます。空の欄の案件は、いちばん下に出ます
- 上のカードの「買付 返答の要対応」やステータスのカードを押すと、その案件に絞ります

## 一覧のまま直せること
- ステータス：選び直すと保存されます。「○○へ」のボタンで次の工程に進めます
- 買付の返答：返答待ち・承諾・否決・保留・再交渉を選べます
- ステータスを進めると、空いている日付に今日が入ります。買付にすると、返答期日に買付日の7日後が入ります（日数は設定で変わります）
- 契約・決済完了に進めたとき、返答が入っていなければ「承諾」になります

> 注意：ステータスを前に戻すときは、確認が出ます。見送りにしたときは、案件の画面が開くので失注理由を選んでください。

## 案件の画面（「開く」・「案件を登録」）
- 基本：担当者・種別・業者名・所在地・区画数・土地面積（坪でも入れられます）・想定仕入価格
- 情報提供業者・仕入条件：売主名・媒介業者名・購入金額・契約条件。坪単価は自動で計算します
- 事業収支シミュレーション：想定総販売価格・建築費・解体造成費・諸経費率・目標利益率から、買付上限額を出します
- 買付の返答管理：買付提出先・返答期日・返答結果・回答日
- 見送り・失注の記録：失注理由と詳細

> 注意：図面などの資料の添付は、まだ移していません。今は仕入KPI管理で見てください。

## CSV で書き出す
上の「CSV で書き出す」で、今の絞り込みの案件をすべて CSV に書き出します（Excel でそのまま開けます）。「決済完了の実績」のときは、決済完了の案件の列になります。

## 決済完了の実績
上の「決済完了の実績」に切り替えると、決済まで進んだ案件を、過去の実績として探せます（決済日の新しい順。購入金額・坪単価・契約条件で比べられます）。
', 110, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-120.md：業者マスタ（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '業者マスタ（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('業者マスタ（建売営業）', 'spec', '画面の使い方', '土地の情報をくれる業者の一覧と登録・編集。ランク・温度感・最終接触・アプローチ数・買取実績。', '左のメニュー「土地仕入」→「業者マスタ」。土地の情報をくれる不動産業者・工務店などの一覧です。

[[画面:業者マスタ]]

## 一覧
- 開いたときは30社出ます。下までスクロールすると、次の30社が出ます
- 検索・区分・ランク・温度感・社内担当で絞れます。条件は画面のアドレスにも付きます
- 見出しを押すと並べ替えます（はじめは最終接触の新しい順）
- 最終接触は、アプローチの記録の最後の日と、手で入れた最終訪問日の新しいほうです。30日以上は黄色、60日以上は赤で出ます
- 買取実績は、手で入れた買取数と、決済完了まで進んだ案件の区画数の合計です

## 業者の画面
行を押すと開きます。連絡先・社内担当・ランク（A＝最重要〜E＝実績なし）・温度感などを直せます。下に、その業者へのアプローチ履歴と、その業者からの案件が出ます。
- 業者名を変えると、案件・アプローチに出ている業者名も変わります
- 「業者マスタから外す」を押しても、案件・アプローチの業者名は残ります

## テキストから自動で抜き出す
業者の画面の「会社概要・名刺・署名などのテキストから自動で抜き出す」に、ホームページの会社概要やメールの署名を貼り付けて、ボタンを押します。業者名・電話番号・メール・住所・エリア・担当者名・URL を抜き出し、空いている欄だけに入れます（入っている値は変えません）。確かめてから保存してください。

## CSV で書き出す
上の「CSV で書き出す」で、今の絞り込みの業者をすべて CSV に書き出します（アプローチ数・買取実績・最終接触も入ります）。
', 120, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-130.md：仕入設定（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '仕入設定（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('仕入設定（建売営業）', 'spec', '画面の使い方', '土地仕入れチームの担当者（Dashboard のログインとの結び付け）、年度・アラート、適正在庫、選択肢、反響ソース、KPI の定義、更新履歴、仕入KPI管理からの取り込み。', '左のメニュー「土地仕入」→「仕入設定」。土地仕入の画面の設定です。

[[画面:仕入設定]]

## 担当者
- 担当者に Dashboard のスタッフを結び付けると、その人がログインしたとき、[[日次・アプローチ（建売営業）]] などで自分が選ばれます
- 1人のスタッフは、1人の担当者にだけ結び付けられます
- エリアを変えると、エリアの合算の数字も変わります
- 停止中にした担当者は、選択肢とチームの目標から外れます。過去の記録は残ります

## 年度・買付 返答期日のアラート
対象年度（6月始まり）と、返答期日の既定（買付日から何日後）、アラートを出し始める日数（期日の何日前から）を変えられます。

## 適正在庫
担当者・詳細エリアごとに、適正在庫・在庫・販売を入れます。「行を足す」で増やし、「保存」でその年度の分をまとめて入れ替えます。数字は [[仕入分析（建売営業）]] に出ます。

## 選択肢
反応・感触、失注理由、契約条件、業者の区分、育成フェーズ、ボトルネックなどの選択肢を足したり止めたりできます。止めた選択肢は、新しく選べなくなるだけで、保存済みの記録には残ります。

> 注意：アプローチ種別の名前を変えると、集計では「訪問」に数えられます。種別は変えずに使ってください。

## 反響ソース
土地の情報がどこから来たか（業者・ポータルなど）を登録します。1件でも登録すると、案件の画面で選べるようになります。

## KPI の定義
カードに出す KPI の名前・単位・使うかどうかを変えられます。新しい KPI（手入力の KPI）も足せます。足した KPI の目標と実績は [[目標・月次入力（建売営業）]] で入れます。
- 業者AP・情報取得・社長提案・買付・契約・仕入区画は、記録から自動で数えます（数え方は変えられません）

## 更新履歴
誰が・いつ・何を変えたかの新しい200件です。

## 仕入KPI管理から取り込む（マスターのみ）
今までの仕入KPI管理の「設定・データ → 書き出し・バックアップ」で書き出した JSON を選ぶと、まず件数だけを確かめます。「取り込む」を押すと入れ替えます。
- 取り込むと、土地仕入の記録（案件・業者・アプローチ・まとめ入力・日報・目標など）は、すべてそのファイルの内容に入れ替わります
- 担当者とスタッフの結び付けは残ります。名前で結び付けられる担当者は、自動で結び付けます

> 注意：図面などの資料は、この版では取り込みません。

> 要確認：取り込むのは、Dashboard で記録を始める前に1回だけにしてください。あとから取り込むと、Dashboard で入れた記録が消えます。
', 130, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-140.md：仕入分析（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '仕入分析（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('仕入分析（建売営業）', 'spec', '画面の使い方', '土地仕入れのボトルネック診断（工程ごとの転換率の低下）、担当者別の転換率、達成率ヒートマップ、失注・見送りの要因、適正在庫。', '左のメニュー「土地仕入」→「仕入分析」。数字の流れのどこで詰まっているかを見る画面です。

[[画面:仕入分析]]

## 上の欄
担当（チーム全員・エリアの合算・1人ずつ）、集計期間（毎月・通期）、対象月を選びます。条件は画面のアドレスにも付きます。「印刷 / PDF」で印刷できます。

## ボトルネック診断
業者AP → 情報取得 → 社長提案 → 買付 → 契約の、工程ごとの転換率（次の工程に進んだ割合）を出し、下がっている工程に印を付けます。
- 毎月：先月と比べます。1人のときはチーム、チーム全員のときは年度の平均とも比べます
- 通期：年間目標から逆算した転換率と比べます
- 「低下」にするのは、相対で15%以上かつ3ポイント以上下がった工程だけです。母数が3件未満の工程は「—」にして判定しません

## 担当者別 工程別転換率
担当者ごとの転換率です。いちばん下は目標から逆算した転換率で、これを下回っている工程が、その人の詰まりどころです。

## 達成率ヒートマップ
担当者・エリア・チームごとに、月ごとの達成率を色で並べます（緑＝100%以上、黄＝70%以上、赤＝70%未満）。右上で、全指標の平均か、1つの指標かを選べます。

## 失注・見送りの要因
期間中に動いた案件のうち、見送り・買付の否決になったものを、失注理由ごとに数えます。「未登録」が多いときは、[[仕入案件一覧（建売営業）]] で理由を入れてください。

## 適正在庫
担当者・詳細エリアごとの適正在庫・在庫・過不足・販売・充足率です。数字は [[仕入設定（建売営業）]] で入れます（自動では動きません）。
', 140, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-150.md：個人別実績（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '個人別実績（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('個人別実績（建売営業）', 'spec', '画面の使い方', '担当者1人の KPI の実績と目標、ボトルネック、年度の累計、エリアの中での比較、月次レビュー（育成フェーズ・ボトルネック・上長コメント）。', '左のメニュー「土地仕入」→「個人別実績」。担当者1人の数字と、月ごとの面談の記録（月次レビュー）を見る画面です。

[[画面:個人別実績]]

## 見られるもの
- 上のカード：その人の KPI の実績・目標・達成率と、平均達成率（ペース内か遅れか）
- ボトルネック診断：チームと比べて下がっている工程
- 年度の累計と年間目標
- 買付の返答期日アラート：その人の返答待ちの買付
- エリアの中での比較：同じエリアの人の数字
- 最近のアプローチと担当案件

ログインした人が担当者に結び付いていれば、開いたときに自分が選ばれます。

## 月次レビュー
対象月の、育成フェーズ・ボトルネック・良かった事（本人）・重点課題（翌月のテーマ）・上長コメントを入れて「保存」します。1人・1か月に1件で、同じ月に保存すると上書きされます。
- 下の表に、これまでのレビューが出ます。行を押すと、その月に切り替わります
- 育成フェーズとボトルネックの選択肢は、[[仕入設定（建売営業）]] で変えられます
', 150, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-160.md：目標・月次入力（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '目標・月次入力（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('目標・月次入力（建売営業）', 'spec', '画面の使い方', '担当者ごとの月間目標・年間目標と、記録から数えられない実績の手入力。', '左のメニュー「土地仕入」→「目標・月次入力」。目標と、手で足す実績を入れる画面です。

[[画面:目標・月次入力]]

## 月間目標
上で対象月を選び、担当者 × KPI の表に目標を入れて「保存」します。

## 手入力の実績
記録（アプローチ・まとめ入力・案件）から自動で数えた実績に、ここで入れた数を足します。各欄の下の「自動」が、自動で数えた数です。
- 1件ずつ記録していない分を補うときに使います
- 仕入設定で足した KPI（手入力の KPI）は、ここで入れた数だけで数えます

## 年間目標
年度（6月〜翌5月）の目標です。通期の達成率に使います。

> 注意：0 か空にして保存すると、その欄は消えます。チームの目標は、稼働中の担当者の目標を足したものです。
', 160, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);

-- ---------------------------------------------------------------
-- テーブル定義書（16 テーブル）。backend/scripts/tabledef/build-tabledef-sql.cjs で作成（2.2.311）
-- ⚠️ 先に table_definition / column_definition の表があること（2026-11-25_update_log_2.2.301.sql）
-- ⚠️ 原稿に無い列の説明は消す（原稿が正）
-- ---------------------------------------------------------------
-- land_area：土地仕入のエリア
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_area', '土地仕入のエリア', 'spec', '建売営業の「土地仕入」（v2.2.311〜）のエリア（鹿児島都城・熊本・宮崎・大分）。担当者をエリアに分け、エリアごとに合算する。
書くところ：初期値（2026-11-27_land_acquisition_tables.sql）、取り込み land:import（移行元に無いエリア名は作る）。読むところ：land_master・land_summary。
⚠️ どのエリアにも入らない担当者（area_id が NULL）は「その他」。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_area' AND column_name NOT IN ('id', 'name', 'label', 'sort', 'active', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_area', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_area', 'name', 'エリア名（保存値。移行元の値と同じ）', '改修', '2.2.311', NOW()),
  ('land_area', 'label', '表示名（空なら name。例 鹿児島（都城）エリア）', '改修', '2.2.311', NOW()),
  ('land_area', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_area', 'active', '1＝使う', '改修', '2.2.311', NOW()),
  ('land_area', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_area', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_member：土地仕入の担当者
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_member', '土地仕入の担当者', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の担当者（仕入れチームの人）。1行が1人。案件・アプローチなどは担当者をこの id で持つ。
書くところ：② land:member_save（仕入設定。スタッフとの結び付け・エリア・停止中）、取り込み land:import（名前で突き合わせる。記録にだけ出てくる名前は停止中で作る）。
読むところ：土地仕入の全部の画面（land_master）。
⚠️ name は移行元の表記（名字だけ。例 松窪）。⚠️ Dashboard のスタッフとは staff_id で結ぶ（取り込みのとき、スタッフの名前がこの名前で始まり、1人に決まれば自動で結ぶ）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_member' AND column_name NOT IN ('id', 'name', 'area_id', 'staff_id', 'active', 'sort', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_member', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_member', 'name', '担当者名（移行元の表記）', '改修', '2.2.311', NOW()),
  ('land_member', 'area_id', 'エリア（land_area.id。NULL はその他）', '改修', '2.2.311', NOW()),
  ('land_member', 'staff_id', 'Dashboard のスタッフ（staff.id）。ログインした人を自分の担当にする。1人のスタッフは1人の担当者にだけ', '改修', '2.2.311', NOW()),
  ('land_member', 'active', '1＝稼働中 / 0＝停止中（選択肢とチームの目標から外す。過去の記録は残す）', '改修', '2.2.311', NOW()),
  ('land_member', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_member', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_member', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_kpi_def：土地仕入の KPI の定義
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_kpi_def', '土地仕入の KPI の定義', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の KPI の一覧。仕入ダッシュボードのカードはこの並びで出す。
初期値は移行元の6指標（業者AP・情報取得・社長提案・買付・契約・仕入区画。calc = auto）。
⚠️ これから KPI を足すための受け皿。calc = manual の KPI は、手入力の実績（land_manual_actual）だけで数える。目標は land_target に kpi_key で入れる。
⚠️ calc = auto の数え方は logic.ts の computeActual に書いてある（kpi_key を変えると数えなくなる）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_kpi_def' AND column_name NOT IN ('id', 'kpi_key', 'label', 'unit', 'calc', 'description', 'sort', 'active', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_kpi_def', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'kpi_key', 'KPI のキー（land_target・land_manual_actual の kpi_key）', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'label', '画面の名前', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'unit', '単位（件・区画など）', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'calc', 'auto＝記録から自動で数える（＋手入力） / manual＝手入力だけ', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'description', '数え方の説明（カードに出す）', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'active', '1＝使う（0 にするとカード・集計から外れる）', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_kpi_def', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_target：土地仕入の目標
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_target', '土地仕入の目標', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の目標。担当者 × 期間 × KPI に1行（縦に持つので、KPI を足しても列は増えない）。
書くところ：取り込み land:import（移行元の月間目標・年間目標）。画面からの入力は v2.2.312 の「目標・月次入力」。
読むところ：仕入ダッシュボード（land_summary）。⚠️ チームの目標は稼働中の担当者だけを足す（移行元と同じ）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_target' AND column_name NOT IN ('id', 'period_type', 'period', 'member_id', 'kpi_key', 'value', 'updated_by', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_target', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_target', 'period_type', 'month＝月間目標 / year＝年間目標', '改修', '2.2.311', NOW()),
  ('land_target', 'period', 'month は YYYY-MM、year は年度の始まりの年（6月始まり。例 2026）', '改修', '2.2.311', NOW()),
  ('land_target', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_target', 'kpi_key', 'KPI（land_kpi_def.kpi_key）', '改修', '2.2.311', NOW()),
  ('land_target', 'value', '目標の値', '改修', '2.2.311', NOW()),
  ('land_target', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_target', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_manual_actual：土地仕入の手入力の実績
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_manual_actual', '土地仕入の手入力の実績', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の、手で入れる実績。担当者 × 月 × KPI に1行。自動で数えた実績に足す（calc = manual の KPI はこれだけ）。
書くところ：取り込み land:import（移行元の月次入力）。画面からの入力は v2.2.312 の「目標・月次入力」。読むところ：land_summary（logic.ts の computeActual）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_manual_actual' AND column_name NOT IN ('id', 'ym', 'member_id', 'kpi_key', 'value', 'updated_by', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_manual_actual', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'ym', '月（YYYY-MM）', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'kpi_key', 'KPI（land_kpi_def.kpi_key）', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'value', '足す値', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_manual_actual', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_source：土地仕入の反響ソース
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_source', '土地仕入の反響ソース', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の反響ソース（土地の情報がどこから来たか）。⚠️ これから設定するための受け皿で、作った時点では空。
案件（land_deal.source_id）・アプローチ（land_approach.source_id）から指す。1行でも入ると、案件の画面に「反響ソース」の選択が出る。
読むところ：land_master。画面からの登録は v2.2.312 の「仕入設定」。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_source' AND column_name NOT IN ('id', 'name', 'kind', 'memo', 'sort', 'active', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_source', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_source', 'name', '反響ソースの名前', '改修', '2.2.311', NOW()),
  ('land_source', 'kind', '種類（業者・ポータル・自社サイトなど。自由）', '改修', '2.2.311', NOW()),
  ('land_source', 'memo', 'メモ', '改修', '2.2.311', NOW()),
  ('land_source', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_source', 'active', '1＝使う', '改修', '2.2.311', NOW()),
  ('land_source', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_source', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_option：土地仕入の選択肢
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_option', '土地仕入の選択肢', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の画面の選択肢。初期値は移行元と同じ。list_key ごとに並び順で出す。
list_key：deal_kind（案件種別）・ap_type（アプローチ種別）・reaction（反応）・reply_result（買付の返答結果）・lost_reason（失注理由）・deal_terms（契約条件）・vendor_kind（業者の区分）・phase（育成フェーズ）・bottleneck（ボトルネック）。
⚠️ ステータス（情報取得〜見送り）は工程の決まりに使うので、ここには置かない（logic.ts の STATUS）。
⚠️ ap_type の値は、まとめ入力の列（logic.ts の AP_BREAKDOWN）と対応している。名前を変えると集計で訪問に数えられる。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_option' AND column_name NOT IN ('id', 'list_key', 'value', 'sort', 'active');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_option', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_option', 'list_key', '選択肢の種類', '改修', '2.2.311', NOW()),
  ('land_option', 'value', '選択肢の値', '改修', '2.2.311', NOW()),
  ('land_option', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_option', 'active', '1＝出す', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_setting：土地仕入の設定
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_setting', '土地仕入の設定', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の設定（1行が1つの設定）。
fy_start＝年度の始まりの年（6月始まり）、alert_lead_days＝買付の返答期日の既定（買付日の何日後）、alert_warn_days＝何日前から「もうすぐ」にするか。
書くところ：初期値、取り込み land:import（移行元の値）。読むところ：② の全部（loadSettings）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_setting' AND column_name NOT IN ('setting_key', 'setting_value', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_setting', 'setting_key', '設定の名前', '改修', '2.2.311', NOW()),
  ('land_setting', 'setting_value', '値（文字で持つ）', '改修', '2.2.311', NOW()),
  ('land_setting', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_vendor：土地仕入の業者マスタ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_vendor', '土地仕入の業者マスタ', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の業者マスタ。土地の情報をくれる不動産業者・工務店など。1行が1社。
書くところ：② land:vendor_save・land:vendor_delete、案件・アプローチの保存（名前が無ければ作る。ensureVendor）、取り込み land:import。
読むところ：業者マスタ（LandVendors.tsx。② land_vendor_list・land_vendor_get）、案件・アプローチの業者名の候補。
⚠️ 買取実績 ＝ buy_count（手入力）＋ 決済完了の案件の区画数（land_deal から毎回数える）。
⚠️ 消すのは delete_flag = 1（案件・アプローチの業者名は残る）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_vendor' AND column_name NOT IN ('id', 'legacy_id', 'name', 'vkind', 'contact', 'tel', 'email', 'area', 'addr', 'url', 'owner_member_id', 'vendor_rank', 'temp', 'last_visit', 'buy_count', 'memo', 'delete_flag', 'created_by', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_vendor', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_vendor', 'legacy_id', '移行元の id（取り込んだ行だけ）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'name', '業者名', '改修', '2.2.311', NOW()),
  ('land_vendor', 'vkind', '区分（land_option の vendor_kind）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'contact', '先方の担当者名', '改修', '2.2.311', NOW()),
  ('land_vendor', 'tel', '電話番号', '改修', '2.2.311', NOW()),
  ('land_vendor', 'email', 'メールアドレス', '改修', '2.2.311', NOW()),
  ('land_vendor', 'area', '業者のエリア（自由に書く）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'addr', '住所', '改修', '2.2.311', NOW()),
  ('land_vendor', 'url', 'ホームページ・参照 URL', '改修', '2.2.311', NOW()),
  ('land_vendor', 'owner_member_id', '社内担当（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'vendor_rank', 'ランク（A＝最重要〜E＝実績なし）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'temp', '温度感（◎〇△✕）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'last_visit', '最終訪問日（手入力）。最終接触はこれとアプローチの最後の日の新しいほう', '改修', '2.2.311', NOW()),
  ('land_vendor', 'buy_count', '買取数（手入力・過去の実績）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'memo', 'メモ', '改修', '2.2.311', NOW()),
  ('land_vendor', 'delete_flag', '削除の印（1＝業者マスタから外した）', '改修', '2.2.311', NOW()),
  ('land_vendor', 'created_by', '登録した人', '改修', '2.2.311', NOW()),
  ('land_vendor', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_vendor', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_vendor', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_approach：土地仕入のアプローチ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_approach', '土地仕入のアプローチ', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の、業者へのアプローチ（訪問・架電など）を1件ずつ記録したもの。1行が1回。
書くところ：② land:approach_save・land:approach_delete（日次・アプローチ LandDaily.tsx）、取り込み land:import。
読むところ：日次・アプローチ（land_approach_list・land_daily）、仕入ダッシュボード（業者AP・情報取得の実績、案件化待ち）、業者の画面。
⚠️ 業者AP ＝ この表の件数 ＋ まとめ入力（land_daily_count）。⚠️ 情報取得には info_count から、このアプローチから作った案件の数を引いて足す。
⚠️ 消すのは delete_flag = 1。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_approach' AND column_name NOT IN ('id', 'legacy_id', 'ap_date', 'ap_time', 'member_id', 'vendor_id', 'vendor_name', 'ap_type', 'contact', 'reaction', 'info_count', 'memo', 'address', 'map_url', 'land_m2', 'is_candidate', 'source_id', 'delete_flag', 'created_by', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_approach', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_approach', 'legacy_id', '移行元の id（取り込んだ行だけ）', '改修', '2.2.311', NOW()),
  ('land_approach', 'ap_date', '日付', '改修', '2.2.311', NOW()),
  ('land_approach', 'ap_time', '時刻（任意。HH:MM）', '改修', '2.2.311', NOW()),
  ('land_approach', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_approach', 'vendor_id', '業者（land_vendor.id）', '改修', '2.2.311', NOW()),
  ('land_approach', 'vendor_name', '業者名', '改修', '2.2.311', NOW()),
  ('land_approach', 'ap_type', '種別（訪問・架電・受電・メール・FAX・直案件・業者持込）。まとめ入力の列と対応する', '改修', '2.2.311', NOW()),
  ('land_approach', 'contact', '訪問先・架電先の担当者名', '改修', '2.2.311', NOW()),
  ('land_approach', 'reaction', '反応・感触（land_option の reaction）', '改修', '2.2.311', NOW()),
  ('land_approach', 'info_count', 'このアプローチで得た土地情報の件数', '改修', '2.2.311', NOW()),
  ('land_approach', 'memo', '取得情報（売主の事情・価格感・条件など）', '改修', '2.2.311', NOW()),
  ('land_approach', 'address', '物件所在地（任意）', '改修', '2.2.311', NOW()),
  ('land_approach', 'map_url', '地図の URL', '改修', '2.2.311', NOW()),
  ('land_approach', 'land_m2', '土地面積（㎡・任意）', '改修', '2.2.311', NOW()),
  ('land_approach', 'is_candidate', '案件候補（1＝案件化待ちに出す。案件にすると外れる）。直案件・業者持込は既定で1', '改修', '2.2.311', NOW()),
  ('land_approach', 'source_id', '反響ソース（land_source.id。これから設定）', '改修', '2.2.311', NOW()),
  ('land_approach', 'delete_flag', '削除の印（1＝削除）', '改修', '2.2.311', NOW()),
  ('land_approach', 'created_by', '記録した人', '改修', '2.2.311', NOW()),
  ('land_approach', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_approach', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_approach', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_daily_count：土地仕入のまとめ入力
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_daily_count', '土地仕入のまとめ入力', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の「まとめ入力」。1件ずつ記録しないアプローチの件数を、日ごとにまとめて入れる。1日・1担当者に1行（同じ日に保存すると上書き）。
書くところ：② land:daily_save（全部0で保存・削除で行を消す）、取り込み land:import。
読むところ：日次・アプローチ（land_daily）、仕入ダッシュボード（業者AP・情報取得の実績）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_daily_count' AND column_name NOT IN ('id', 'legacy_id', 'count_date', 'member_id', 'cnt_visit', 'cnt_call', 'cnt_recv', 'cnt_mail', 'cnt_fax', 'cnt_direct', 'cnt_bring', 'cnt_info', 'note', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_daily_count', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'legacy_id', '移行元の id（取り込んだ行だけ）', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'count_date', '日付', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_visit', '訪問の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_call', '架電の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_recv', '受電の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_mail', 'メールの件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_fax', 'FAX の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_direct', '直案件の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_bring', '業者持込の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'cnt_info', '情報取得の件数', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'note', 'メモ', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_daily_count', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_report：土地仕入の簡易日報
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_report', '土地仕入の簡易日報', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の簡易日報。1日・1担当者に1本（同じ日に保存すると上書き）。
書くところ：② land:report_save（削除で行を消す）、取り込み land:import。読むところ：日次・アプローチ（land_daily）。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_report' AND column_name NOT IN ('id', 'legacy_id', 'report_date', 'member_id', 'done', 'info', 'issue', 'next_plan', 'created_by', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_report', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_report', 'legacy_id', '移行元の id（取り込んだ行だけ）', '改修', '2.2.311', NOW()),
  ('land_report', 'report_date', '日付', '改修', '2.2.311', NOW()),
  ('land_report', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_report', 'done', '本日の活動', '改修', '2.2.311', NOW()),
  ('land_report', 'info', '取得情報・進捗', '改修', '2.2.311', NOW()),
  ('land_report', 'issue', '課題・相談事項', '改修', '2.2.311', NOW()),
  ('land_report', 'next_plan', '明日の予定', '改修', '2.2.311', NOW()),
  ('land_report', 'created_by', '書いた人', '改修', '2.2.311', NOW()),
  ('land_report', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_report', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_report', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_deal：土地仕入の仕入案件
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_deal', '土地仕入の仕入案件', 'spec', '建売営業の「土地仕入」（v2.2.311〜。移行元は仕入KPI管理 v7.3）の仕入案件。1行が1件の土地の情報。
書くところ：② features/landAcquisition の land:deal_save・land:deal_delete、移行元の取り込み land:import（importLegacy.ts）。
読むところ：仕入案件一覧（LandDeals.tsx。② land_deal_list）、仕入ダッシュボード（land_summary。実績の数え方は logic.ts の computeActual）、業者の画面（land_vendor_get）。
⚠️ 買付の上限額・坪単価は保存しない（logic.ts の simMaxOffer・tsuboUnitOf で毎回計算する）。
⚠️ ステータスを変えると、空いている日付に今日が入る（logic.ts の applyStatus。買付なら返答期日＝買付日＋既定の日数）。
⚠️ 消すのは delete_flag = 1。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_deal' AND column_name NOT IN ('id', 'legacy_id', 'member_id', 'kind', 'vendor_id', 'vendor_name', 'address', 'map_url', 'lots', 'land_m2', 'price', 'seller_name', 'agent_name', 'buy_price', 'terms', 'terms_memo', 'status', 'info_date', 'prop_date', 'offer_date', 'contract_date', 'settle_date', 'memo', 'sim_sales', 'sim_build', 'sim_demolition', 'sim_expense_rate', 'sim_profit_rate', 'offer_to', 'reply_due', 'reply_result', 'reply_date', 'reply_memo', 'lost_reason', 'lost_memo', 'ap_id', 'source_id', 'delete_flag', 'created_by', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_deal', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_deal', 'legacy_id', '移行元の id（取り込んだ行だけ）', '改修', '2.2.311', NOW()),
  ('land_deal', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_deal', 'kind', '案件種別（新規開拓・既存持込）', '改修', '2.2.311', NOW()),
  ('land_deal', 'vendor_id', '情報取得元の業者（land_vendor.id）', '改修', '2.2.311', NOW()),
  ('land_deal', 'vendor_name', '業者名（業者マスタの名前を変えると、そろえて書き換える）', '改修', '2.2.311', NOW()),
  ('land_deal', 'address', '物件所在地', '改修', '2.2.311', NOW()),
  ('land_deal', 'map_url', '地図の URL（空なら画面が所在地から作る）', '改修', '2.2.311', NOW()),
  ('land_deal', 'lots', '区画数。契約日が入ると「仕入区画」に数える', '改修', '2.2.311', NOW()),
  ('land_deal', 'land_m2', '土地面積（㎡）', '改修', '2.2.311', NOW()),
  ('land_deal', 'price', '想定仕入価格（万円）', '改修', '2.2.311', NOW()),
  ('land_deal', 'seller_name', '売主名', '改修', '2.2.311', NOW()),
  ('land_deal', 'agent_name', '媒介業者名', '改修', '2.2.311', NOW()),
  ('land_deal', 'buy_price', '購入金額（仕入金額・万円）。坪単価は、これが無ければ想定仕入価格で計算する', '改修', '2.2.311', NOW()),
  ('land_deal', 'terms', '契約条件（land_option の deal_terms）', '改修', '2.2.311', NOW()),
  ('land_deal', 'terms_memo', '契約条件の補足', '改修', '2.2.311', NOW()),
  ('land_deal', 'status', 'ステータス（情報取得・社長提案・買付・契約・決済完了・見送り）。並び順が工程の順', '改修', '2.2.311', NOW()),
  ('land_deal', 'info_date', '情報取得日。「情報取得」の実績の月', '改修', '2.2.311', NOW()),
  ('land_deal', 'prop_date', '社長提案日', '改修', '2.2.311', NOW()),
  ('land_deal', 'offer_date', '買付日', '改修', '2.2.311', NOW()),
  ('land_deal', 'contract_date', '契約日（現場）', '改修', '2.2.311', NOW()),
  ('land_deal', 'settle_date', '決済日（ゴール）。決済完了の区画は業者の買取実績に足す', '改修', '2.2.311', NOW()),
  ('land_deal', 'memo', '概要メモ', '改修', '2.2.311', NOW()),
  ('land_deal', 'sim_sales', '事業収支の想定総販売価格（万円）', '改修', '2.2.311', NOW()),
  ('land_deal', 'sim_build', '想定建築費（万円）', '改修', '2.2.311', NOW()),
  ('land_deal', 'sim_demolition', '予想解体・造成費（万円）', '改修', '2.2.311', NOW()),
  ('land_deal', 'sim_expense_rate', '諸経費率（%。既定5）', '改修', '2.2.311', NOW()),
  ('land_deal', 'sim_profit_rate', '目標利益率（%。既定15）', '改修', '2.2.311', NOW()),
  ('land_deal', 'offer_to', '買付提出先（返答をもらう相手）', '改修', '2.2.311', NOW()),
  ('land_deal', 'reply_due', '買付の返答期日。返答待ち（買付で返答結果が空）のアラートに使う', '改修', '2.2.311', NOW()),
  ('land_deal', 'reply_result', '返答結果（承諾・否決・保留・再交渉。空は返答待ち）', '改修', '2.2.311', NOW()),
  ('land_deal', 'reply_date', '回答日', '改修', '2.2.311', NOW()),
  ('land_deal', 'reply_memo', '返答メモ', '改修', '2.2.311', NOW()),
  ('land_deal', 'lost_reason', '失注理由（land_option の lost_reason）。見送り・否決の案件で集計する', '改修', '2.2.311', NOW()),
  ('land_deal', 'lost_memo', '失注の詳細メモ', '改修', '2.2.311', NOW()),
  ('land_deal', 'ap_id', '発生元のアプローチ（land_approach.id）。そのアプローチの情報取得数から、案件の数を引いて数える', '改修', '2.2.311', NOW()),
  ('land_deal', 'source_id', '反響ソース（land_source.id。これから設定）', '改修', '2.2.311', NOW()),
  ('land_deal', 'delete_flag', '削除の印（1＝削除）', '改修', '2.2.311', NOW()),
  ('land_deal', 'created_by', '登録した人（Dashboard のスタッフ名。移行元の行は移行元の担当者名）', '改修', '2.2.311', NOW()),
  ('land_deal', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_deal', 'created_at', '登録日時', '改修', '2.2.311', NOW()),
  ('land_deal', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_review：土地仕入の月次レビュー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_review', '土地仕入の月次レビュー', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の、担当者ごとの月次レビュー（育成フェーズ・ボトルネック・上長のコメント）。担当者 × 月に1行。
書くところ：取り込み land:import（移行元のキーは「YYYY-MM|名前」）。画面は v2.2.312 の「個人別実績」。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_review' AND column_name NOT IN ('id', 'ym', 'member_id', 'phase', 'bottleneck', 'good', 'theme', 'comment', 'updated_by', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_review', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_review', 'ym', '月（YYYY-MM）', '改修', '2.2.311', NOW()),
  ('land_review', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_review', 'phase', '育成フェーズ（land_option の phase）', '改修', '2.2.311', NOW()),
  ('land_review', 'bottleneck', 'ボトルネック（land_option の bottleneck）', '改修', '2.2.311', NOW()),
  ('land_review', 'good', '良かった事（本人）', '改修', '2.2.311', NOW()),
  ('land_review', 'theme', '重点課題（翌月のテーマ）', '改修', '2.2.311', NOW()),
  ('land_review', 'comment', '上長のコメント', '改修', '2.2.311', NOW()),
  ('land_review', 'updated_by', '最後に直した人', '改修', '2.2.311', NOW()),
  ('land_review', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_stock：土地仕入の適正在庫
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_stock', '土地仕入の適正在庫', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の適正在庫（担当者 × 詳細エリアごとの適正在庫・在庫・販売）。手で入れる（自動では動かない。移行元と同じ）。
過不足＝在庫−適正在庫、充足率＝在庫÷適正在庫（画面で計算する）。
書くところ：取り込み land:import。画面は v2.2.312 の「仕入設定」・「仕入分析」。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_stock' AND column_name NOT IN ('id', 'fy', 'member_id', 'area_name', 'proper', 'stock', 'sales', 'sort', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_stock', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_stock', 'fy', '年度（6月始まりの年）', '改修', '2.2.311', NOW()),
  ('land_stock', 'member_id', '担当者（land_member.id）', '改修', '2.2.311', NOW()),
  ('land_stock', 'area_name', '詳細エリア（霧島市など）', '改修', '2.2.311', NOW()),
  ('land_stock', 'proper', '適正在庫', '改修', '2.2.311', NOW()),
  ('land_stock', 'stock', '在庫', '改修', '2.2.311', NOW()),
  ('land_stock', 'sales', '販売', '改修', '2.2.311', NOW()),
  ('land_stock', 'sort', '並び順', '改修', '2.2.311', NOW()),
  ('land_stock', 'updated_at', '最後に直した日時', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- land_audit：土地仕入の更新履歴
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('land_audit', '土地仕入の更新履歴', 'spec', '建売営業の「土地仕入」（v2.2.311〜）の更新履歴（誰が・いつ・何を）。② の保存のたびに1行足す（書けなくても本体の保存は止めない）。
書くところ：② features/landAcquisition（audit）、取り込み land:import（移行元の履歴も入れる）。画面は v2.2.312 の「仕入設定」。', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'land_audit' AND column_name NOT IN ('id', 'at', 'user_name', 'act', 'target', 'name', 'note');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('land_audit', 'id', '連番', '改修', '2.2.311', NOW()),
  ('land_audit', 'at', '日時（日本時間）', '改修', '2.2.311', NOW()),
  ('land_audit', 'user_name', 'した人（Dashboard のスタッフ名。移行元の行は移行元の担当者名）', '改修', '2.2.311', NOW()),
  ('land_audit', 'act', '操作（create・update・delete・status・reply・lost・daily・report・target・member・import・system）', '改修', '2.2.311', NOW()),
  ('land_audit', 'target', '対象（案件・業者・アプローチ・まとめ入力・日報・担当者・移行）', '改修', '2.2.311', NOW()),
  ('land_audit', 'name', '対象の名前（業者名など）', '改修', '2.2.311', NOW()),
  ('land_audit', 'note', '内容（ステータスの「前 → 後」など）', '改修', '2.2.311', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
