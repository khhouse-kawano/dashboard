# 作業記録 v2.2.264　全社報告用フォーマット（company）の速さ・見やすさ、不動産企画係の売上

## 依頼（2026-11-11。ReadMeClaude.md）
- 「/frontend/src/components/company/ディレクトリの改修」
  - レンダリング速度の改善（ステート・useCallback などのスマートな運用）
  - UI：グループ・事業部・課・店舗の総計が見分けにくい → 罫線の太さ・境界のスペースで区切る。list ディレクトリをはじめ SaaS 風に。横幅いっぱいをやめて余白。上のコントロールも list に寄せる
  - realty との連携：category === realty の場合も売上を反映（クリックしてモーダルは不要）。顧客を押したとき、ログイン中の category と顧客の category が違えば alert「閲覧権限がありません」
- 追加：「関数などのコンポネント化、それにともなう新たなファイルの生成は必要であれば推進してよい」
- 決定：「1. 別事業部扱いでよい（category もわけているため）　2. 提案通りの useRef 仕様がよい」
- 途中の指示
  - （スクリーンショット）中古住宅専門店の下の「不動産企画係」の店舗の行は不要 → 出さないようにした
  - 「category === resale で開いたときに不動産企画係を中古リノベの次に配置する」→ この画面の category は `used`。中古リノベのすぐ次に置いた

## 遅かった原因と直し方
| 原因 | 直し方 |
|---|---|
| セルの部品（TableContract・TableAchievement）を Company の中で定義していて、描き直すたびに全セルを作り直していた | 部品をファイルの一番上の階層へ（CompanyTable.tsx）。セルは `React.memo`（文字が同じなら描き直さない） |
| セルごとに顧客・予算の配列を端から探していた（店舗 × 担当 × 月 × ランク） | 集計を画面から分けた（companyAggregate.ts）。`useMemo` の2段：①契約の振り分け ②行とセルの文字づくり。表は並べるだけ |
| 予算の欄に1文字入れるたびに state を変え、表全体を描き直し、毎回保存していた | 入力中の文字は欄（`useRef`）だけが持ち、欄を離れたとき（Enter でも）に保存。Esc で戻す |
| 上のバーが `position: fixed` で、高さを ResizeObserver で測って表をずらしていた（測るたびに描き直し） | バーは普通に置き、表だけが動く並びに。測る処理と state を削除 |
| 表に渡す関数が毎回作り直されていた | `useCallback` で固定 |
| staffList を useEffect ＋ state で作っていた（1回余分に描く） | `useMemo` に |

### 時間（ローカルの開発ビルド・Playwright。ミリ秒。注文／建売／中古）
| 操作 | 前 | 後 |
|---|---|---|
| 予算の欄に1文字入れて消す | 4717／3817／3605 | 348／313／276 |
| 期を変える | 4861／5292／4396 | 1174／1774／1310 |
| 昨年実績を表示 | 1996／2237／2243 | 1358／1185／1651 |
| キャンセル数を消す | 2074／2076／1884 | 620／608／619 |
| 併売店をまとめる | 2141／1919／1864 | 934／676／662 |
- 最初の表示（17〜27秒）は、開発サーバーの起動直後の読み込みとデータの取得が大半で、前後で差は出ていない（本番のビルドではもっと短い）。

## 数え方を変えていないことの確認
- 着手前に、今の画面の全セルの文字を書き出した（`scratchpad/c264/capture.cjs`）。3つの事業 × 6つの表示（今期・昨年実績あり・キャンセル非表示・併売店まとめ・前の期・入力の後）。
- 改修後に同じ条件で書き出して比べた（`diff.cjs`）。**18ファイル・92,007 セルで違い 0**。
  - 比べるときに除いたもの：新しく入れた余白の行、新しい「不動産企画係」の事業部の行、出さなくした「不動産企画係」の店舗の行（中古住宅専門店の下。今期6行・前の期2行）。
  - 途中で「不動産企画係」の店舗の行を外す前は、93,915 セルで違い 0 だった。
- ⚠️ 以前からの少し変わった数え方も、そのまま写している（companyAggregate.ts の先頭の注記）。例：店舗の予算の行のランク「契約済み」は 0、中古リノベの担当の行は「個人目標 → 合計」の順、まとめ表示のときの昨年の月ごとの数は親店舗だけ。

## 見た目
- 表を余白のあるカードに（左右 18px 以上。月の列は 70px → 64px）。罫線は細い横線が基本。
- グループ：見出し・グループ予算・グループ実績の3行を上に固定。
- 事業部：前に広い余白と事業部の名前。上に 3px の線。名前のセルは濃い色で「事業部」の札。
- 課：前に余白。上に 2px の線。名前のセルは課ごとの色で「課」の札。
- 店舗：前に細い余白。上に 1px の線。名前のセルの左に課の色の帯。
- 予算の行は赤、実績の行は青、不動産企画係の売上は緑。押せるセルだけ手の形・ホバーで下線。
- 上のバー：list と同じ `.target` の選択欄、ボタン、チェック。右に単位の注記。
- ⚠️ 札と余白の見出しは CSS の `::before`（セルの文字に混ぜない。表の文字を比べるテストのため）。
- ⚠️ 余白は `.co_scroll` ではなく中の `.co_pad` に付ける（`.co_scroll` に付けると、固定する行・列がその分ずれて止まる。テストで見つけて直した）。

## 不動産企画係
- ⚠️ 下の説明のうち「昨年実績を出さない」「中古リノベの予算」は、デプロイ前の再確認で変えた（末尾の節を参照）。
- ② の `company` の返事に `realty_deals` を足した（`brokerage_listings` の kind = 'deals'。**担当・共同担当・割合・段階・価格・手数料・手入力の印・リフォーム粗利・契約日だけ**。お客様の名前・物件は返さない）。
- 売上は `realty/summary/kpi.ts` の `sumByStaffMonth(deals, dealSales)`（月次売上管理と同じ。契約日の月・失注は除く・仲介手数料＋リフォーム粗利・共同担当は割合で按分）。万円・小数1桁。
- 行：事業部の「予算」（`company_achievement` の shop「不動産企画係」）と「売上」、担当別（staff_list の不動産企画係の担当。一覧に居ない人の売上があれば「その他」）。
- 場所：不動産企画係なら先頭、中古リノベ（used）なら中古リノベのすぐ次、注文・建売は最後。
- 売上のセルは押せない。ランクの列は無い。グループ予算・グループ実績には入れていない。
- 中古住宅専門店の下の「不動産企画係」の店舗の行は出さない（「店舗を選択」からも外した）。⚠️ 中古リノベの事業部の合計は顧客データ（中専）から数えているので変わらない。
- 不動産企画係のメニュー（Dashboard の見出しの下）に「全社報告用フォーマット」を足した。事業部の並びは 中古リノベ → 注文 → 建売。

## 閲覧権限
- 顧客詳細でお客様を押したとき、顧客の事業（注文 → order・建売 → spec・中専 → used）がログイン中の category と違えば `alert('閲覧権限がありません')`、編集画面は開かない。不動産企画係のときは、どの顧客も開かない。
- ⚠️ 見た目の入口（CustomerDetail.tsx）。編集画面のデータの権限は、それぞれの画面と ② が確かめる。

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/company/ | Company.tsx | 1,249行 → 約210行。データの取得と state、`useMemo` 2段、`useCallback`。**消した関数**：TableAchievement・TableContract・achievementLength・calculateContractList・calculateContractListBroker・contractTable・contractTable_used・budgetTotal・isProspect・matchesRank・includesThisMonth・shopNamesOf・isVisibleShop（集計へ移した）。**消した state**：staffList・targetDivision・toolbarBox |
| 同 | **companyAggregate.ts**（新規） | `aggregateContracts`・`buildRows`・`multiChildrenOf`、定数 `RANKS`・`DIVISION_MAPPING`・`DIVISION_ORDER`・`CUSTOMER_CATEGORY`・`REALTY_NAME`。中の関数：calculateContractList・calculateContractListBroker・contractCell・budgetCell・inputCell・contractShopRows・usedShopRows・realtyRows |
| 同 | **CompanyTable.tsx**（新規） | `CompanyTable`・`Row`・`NumTd`・`BudgetInput`・`HeadTd` |
| 同 | **CompanyToolbar.tsx**（新規） | 上のバー |
| 同 | **companyStyle.ts**（新規） | `COMPANY_STYLE`・`SECTION_COLORS`（クラス名は `co_`） |
| 同 | **companyTypes.ts**（新規） | Staff・Shop・Section・Customer・Achievement・RealtyDeal・NumCell・InputCell・Head・RowModel |
| 同 | CustomerDetail.tsx | `category` を受け取り、事業が違えば alert |
| 同 | companyUtils.ts | 使わなくなった sortStyle・tableStyle・tdStyle・cancelStyle・lastYearStyle を削除 |
| frontend/src/components/realty/ | RealtyMenu.tsx | 「全社報告用フォーマット」 |
| backend-express/src/features/company/ | queries.ts・index.ts | `REALTY_DEALS_SQL`、返事に `realty_deals` |
| backend/scripts/guide/articles/ | order/screen-100.md・spec/screen-060.md・used/screen-040.md | 記事 |
| backend/scripts/sql/ | 2026-11-11_update_log_2.2.264.sql | 更新履歴と記事3本 |
- Ranking.tsx・QuarterSummary.tsx は変えていない（渡す値も同じ）。共通の CSS（SearchBox.css）も変えていない（以前のクラスは使わなくなっただけ）。
- ① の company.php・express_proxy.php は変えていない（新しい request は無い）。

## 業務ガイドの記事
- 「全社報告用フォーマット」「全社報告用フォーマット（建売営業）」「全社報告用フォーマット（中古リノベ）」に、節「表の見方（区切り）」「予算・個人目標の入れ方」「不動産企画係」「ほかの事業のお客様」を追加。中古リノベには「不動産企画係の行は事業部に移った」を追加。

## テスト（ローカル・Playwright 3100）
- 全セルの比較：上のとおり違い 0。画面のエラー 0。
- 動き（`scratchpad/c264/ui.cjs`。33項目すべて OK）
  - 区切りの線（3px・2px・1px）、札、余白の行、表の左右の余白
  - 下・右へ動かしても、上の3行と左の2列が残る（0・34・68px）
  - 「課を選択」でその課へ、「課を選択」に戻すと先頭へ
  - 予算：入力中は保存しない／Esc で戻る／Enter で1回だけ保存し店舗の合計が変わる／DB に入る（① 経由）／Tab で離れても保存。⚠️ 値は元に戻した
  - 顧客詳細が開く／同じ事業は alert なし／ほかの事業は「閲覧権限がありません」で編集画面は開かない
  - 不動産企画係：メニューから開ける／事業部が先頭／月の合計 = 合計の列／担当別の合計 = 事業部の合計／売上は押せない／**DB から別に計算した合計（4,379.3 万円）と一致**／中古リノベの下に店舗の行が無い
  - 建売・中古・スマホ幅（390px）で開ける、ページは横にはみ出さない
- 並び：used「中古リノベ ＞ 不動産企画係 ＞ 注文 ＞ 建売」、order「注文 ＞ 建売 ＞ 中古リノベ ＞ 不動産企画係」、spec「建売 ＞ 中古リノベ ＞ 注文 ＞ 不動産企画係」、realty「不動産企画係 ＞ 中古リノベ ＞ 注文 ＞ 建売」。
- ① 経由でトークン無し：`company` は 401（② まで届く）。
- 型チェック（②・フロント）・ESLint（company・RealtyMenu）はエラー 0。
- リファクタリング（使わなくなったスタイルの削除）のあとに、全セルの比較と動きのテストをもう一度通した。
- 仮スタッフ 999999 は消した（0件）。3100 は netstat → taskkill で止めた。
- ⚠️ コンソールの `value prop should not be null` は、顧客の編集画面（InformationEdit）を開いたときの既存の警告。今回の変更とは関係ない。

## デプロイ前の再確認（2026-11-11。「再度歩留まりが合うかの確認、リファクタリング、エージェント側での評価をしたうえで修正」）
### 1. 数字の突き合わせ（`scratchpad/c264/verify.cjs`）
- ① 経由で `company` のデータを取り、**画面の集計（companyAggregate.ts）を使わずに**単純な式で数え直して、画面の数字と比べた。注文・中古リノベの2つの事業 × 今期・前の期。**110項目すべて一致**。
  - グループ・事業部・課・店舗の実績（月ごと・合計・昨年・仲介）、グループ・事業部・店舗の予算、中古リノベの粗利、不動産企画係の売上（月ごと・合計・担当別・昨年）・予算。
- 積み上げ：グループ実績 = 注文 ＋ 建売／事業部 = 課の合計 ＋ 課に属さない店舗の契約（前の期の建売に 6件）／課 = 店舗の合計／グループ予算 = 注文 ＋ 建売の予算。
- 前の期の注文で「担当の合計 < 店舗の実績」の店舗が5つ（今の担当の一覧に居ない人の契約が、店舗の実績にだけ入る。改修前と同じ）。

### 2. 別のエージェントによる評価（コードの読み比べ）
- 重大（数字が変わる・壊れる）：**なし**。数え方（`==`→`===`、Set、groupBy、まとめ表示、予算の合計、中古リノベの行、sorter の使い回し）は、元のコードと1つずつ突き合わせて同じと確認。memo の比較・useMemo/useCallback の依存にも漏れなし。`REALTY_DEALS_SQL` は名前・物件・連絡先を返していない。
- 中・軽の指摘と対応

| 指摘 | 対応 |
|---|---|
| 予算の保存に失敗すると、画面に保存できていない値が残り、同じ値を入れ直しても送られない | **直した**。失敗したら画面の値を入力前に戻す（Company.tsx の changeAchievement）。欄も合計も戻り、入れ直すと送る |
| 不動産企画係の「月次売上管理と同じ」は、合計に入れる人・期・丸めが違う | 注記を実態に直した（担当 × 月の金額は同じ。合計は売上のある全員・6月〜5月・万円小数1桁）。実データでは期首は 6月で同じ、担当の一覧に居ない人の売上は無し |
| 中古リノベの事業部の予算に、不動産企画係の予算が入ったまま（実データで確認：24,500 = 13,100 ＋ 11,400） | **直した**。中古リノベの事業部の予算から不動産企画係を除く（⚠️ 意図して変えた唯一の数字） |
| 行の key が表全体で1つの並びになり、重複の条件が広がった | **直した**。key に事業部・課・並び順を入れた（実データに重複は無かった） |
| スマホでも上のバーが出るようになった | **直した**。768px 以下では出さない（以前と同じ） |
| 中古リノベの店舗・担当のセルが、金額 0 でも押せる | **直した**（金額が 0 より大きいときだけ押せる。以前と同じ） |
| 日本語入力の確定の Enter で保存される／全角の数字で合計が NaN | **直した**（確定の Enter は無視。全角は半角にして保存） |
| 不動産企画係に昨年実績が出ない | **足した**（昨年の同じ月・昨年の期の売上） |
| 使っていない `lastYearStyle`・export（`SECTION_COLORS`・`DIVISION_MAPPING`）・型の `'realty'`・不要な `report === 1`・注記の食い違い | **整理した** |
| `isNew`／`data-new`（前後を比べるテスト用の印）が本番のコードに残る | 残した（次に数え方を直すときも同じテストを使うため。注記あり） |
| `guideScreens.ts` の「全社報告用フォーマット」に realty が無い | 変えていない（不動産企画係の画面は、業務ガイドの「画面を開く」に1つも登録されていない。v2.2.262 と同じ扱い） |
| ② が案件ごとの価格・手数料を全スタッフに返す（担当 × 月に集計して返せば最小） | 変えていない。集計の式（kpi.ts）を ② にも持つと二重管理になるため。返すのは数字と担当だけ。将来の課題 |

### 3. 修正のあとの再テスト
- 全セルの比較：18ファイル・92,007 セルで違い 0（ほかに、意図して変えた中古リノベの事業部の予算のセル 195）。
- 検算：110項目すべて一致（中古リノベ ＋ 不動産企画係の予算 = 以前の中古リノベの事業部の予算、も確認）。
- 動き：38項目 OK（追加：保存に失敗 → alert・欄と合計が戻る・入れ直すと送る・DB は変わらない／全角は半角で保存／スマホではバーを出さない／不動産企画係の昨年実績）。
- 型チェック・ESLint はエラー 0。仮スタッフ 999999 は消した。3100 は止めた。

## 残っていること
- 「閲覧権限がありません」は、全事業を見られる人でも、事業を切り替えないとほかの事業の顧客を開けない（指示どおり）。
- 不動産企画係の予算は、`company_achievement` の shop「不動産企画係」の値をそのまま出している（この画面では直せない。以前の店舗の行でも直せなかった）。

## git diff（CustomerDetail.tsx・companyUtils.ts・RealtyMenu.tsx・② の company・version.ts）
```diff
diff --git a/backend-express/src/features/company/index.ts b/backend-express/src/features/company/index.ts
index bd03d5161..72c38a97c 100644
--- a/backend-express/src/features/company/index.ts
+++ b/backend-express/src/features/company/index.ts
@@ -5,6 +5,7 @@ import {
   CONTRACT_KAERU_SQL,
   CONTRACT_RESALE_SQL,
   CONTRACT_SQL,
+  REALTY_DEALS_SQL,
   SECTION_SQL,
   SHOP_SQL,
   STAFF_SQL,
@@ -45,7 +46,7 @@ export const runCompany = async (): Promise<CompanyResult> => {
    *   .contract / .contract_kaeru / .contract_resale / .achievement
    *   をそのまま読む。
    */
-  const [staff, shop, section, contract, contractKaeru, contractResale, achievement] =
+  const [staff, shop, section, contract, contractKaeru, contractResale, achievement, realtyDeals] =
     await Promise.all([
       query<DynamicRow>(STAFF_SQL),
       query<DynamicRow>(SHOP_SQL),
@@ -54,6 +55,8 @@ export const runCompany = async (): Promise<CompanyResult> => {
       query<DynamicRow>(CONTRACT_KAERU_SQL),
       query<DynamicRow>(CONTRACT_RESALE_SQL),
       query<DynamicRow>(ACHIEVEMENT_SQL),
+      // ⚠️ v2.2.264: 不動産企画係の商談案件（数字と担当だけ）。⚠️ ① の PHP には無いキー
+      query<DynamicRow>(REALTY_DEALS_SQL),
     ]);
 
   return {
@@ -66,6 +69,7 @@ export const runCompany = async (): Promise<CompanyResult> => {
       contract_kaeru: contractKaeru,
       contract_resale: contractResale,
       achievement,
+      realty_deals: realtyDeals,
     },
   };
 };
diff --git a/backend-express/src/features/company/queries.ts b/backend-express/src/features/company/queries.ts
index 185d0c665..cf0cf65b0 100644
--- a/backend-express/src/features/company/queries.ts
+++ b/backend-express/src/features/company/queries.ts
@@ -142,3 +142,16 @@ export const CONTRACT_RESALE_SQL = `
 
 /** 契約目標。⚠️ 絞り込みなしの全件（フロントが期で絞る） */
 export const ACHIEVEMENT_SQL = `SELECT category, name, period, value FROM company_achievement`;
+
+/**
+ * 不動産企画係の商談案件（v2.2.264）。会社実績の「不動産企画係」の事業部の売上に使う。
+ *
+ * ⚠️ **数字と担当だけ**を返す（お客様の名前・物件・連絡先は返さない。`company` は全スタッフが読むため）。
+ * ⚠️ 売上の数え方はフロントの realty/summary/kpi.ts（月次売上管理と同じ）。
+ *   契約日＝計上月・失注は除く・売上＝仲介手数料（手入力がなければ標準の率）＋リフォーム粗利・共同担当は割合で按分。
+ * ⚠️ 消した案件（show_dashboard = 0）は除く（realty の loadRecords と同じ条件）。
+ * ⚠️ ① の company.php には無い（② が止まって ① が代わりに返したときは、不動産企画係の売上が空になるだけ）。
+ */
+export const REALTY_DEALS_SQL = `SELECT staff, subStaff, subRatio, phase, price, fee, feeManual, reformGp, contractDate
+  FROM brokerage_listings
+  WHERE kind = 'deals' AND (show_dashboard IS NULL OR show_dashboard <> 0)`;
diff --git a/frontend/src/components/company/CustomerDetail.tsx b/frontend/src/components/company/CustomerDetail.tsx
index cc6ea6924..90b7c5fd4 100644
--- a/frontend/src/components/company/CustomerDetail.tsx
+++ b/frontend/src/components/company/CustomerDetail.tsx
@@ -2,6 +2,7 @@ import React from 'react';
 import Table from "react-bootstrap/Table";
 import Modal from 'react-bootstrap/Modal';
 import { CustomerName } from '../../utils/deletedCustomer';
+import { CUSTOMER_CATEGORY } from './companyAggregate';
 
 type Customer = Record<string, string>;
 
@@ -9,10 +10,18 @@ type Props = {
     show: boolean,
     setShow: React.Dispatch<React.SetStateAction<boolean>>,
     contract: Customer[],
-    setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>
+    setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>,
+    /** ログイン中の事業（order / spec / used / realty） */
+    category: string
 };
 
-const CustomerDetail = ({ show, setShow, contract, setEditId }: Props) => {
+const idMapping: Record<string, string> = {
+    '注文': 'order',
+    '建売': 'kaeru',
+    '中専': 'resale'
+};
+
+const CustomerDetail = ({ show, setShow, contract, setEditId, category }: Props) => {
     const modalClose = async () => {
         setShow(false);
     };
@@ -33,17 +42,18 @@ const CustomerDetail = ({ show, setShow, contract, setEditId }: Props) => {
                                 <td>{categoryValue === '中専' ? '粗利額' : '担当営業'}</td>
                             </tr>
                             {contract.map((c, index) => {
-                                const idMapping = {
-                                    '注文': 'order',
-                                    '建売': 'kaeru',
-                                    '中専': 'resale'
-                                };
                                 const contractDate = categoryValue === '中専' ? (c.contract_reform || c.contract_buy || c.contract_sell || '-')
                                     : c.contract || c.contract_broker || '-';
                                 return <tr key={index}>
                                     <td>{contractDate}</td>
                                     {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
                                     <td><CustomerName row={c} onClick={() => {
+                                        // ⚠️ v2.2.264: ほかの事業の顧客は開かない（2026-11-11 の指示。ログイン中の事業と、顧客の事業が違うとき）
+                                        //   ⚠️ 見た目の入口。編集画面のデータの権限は、それぞれの画面と ② が確かめる
+                                        if (CUSTOMER_CATEGORY[c.category] !== category) {
+                                            alert('閲覧権限がありません');
+                                            return;
+                                        }
                                         setEditId(prev => ({
                                             ...prev,
                                             [idMapping[c.category]]: c.id
@@ -62,4 +72,4 @@ const CustomerDetail = ({ show, setShow, contract, setEditId }: Props) => {
     )
 }
 
-export default CustomerDetail
\ No newline at end of file
+export default CustomerDetail
diff --git a/frontend/src/components/company/companyUtils.ts b/frontend/src/components/company/companyUtils.ts
index 64b0c65e5..5d28ad22f 100644
--- a/frontend/src/components/company/companyUtils.ts
+++ b/frontend/src/components/company/companyUtils.ts
@@ -1,9 +1,3 @@
-export const sortStyle = { position: 'fixed' as const, zIndex: '1000', backgroundColor: '#fff', width: '100%', height: '60px' };
-
-export const tableStyle = (isSp: boolean) => { return ({ fontSize: isSp ? '9px' : '12px' }) };
-
-export const tdStyle = (isSp: boolean) => { return ({ width: isSp ? '40px' : '70px', minWidth: isSp ? '40px' : '70px', maxWidth: isSp ? '40px' : '70px', letterSpacing: '1px' }) };
-
 export const dateFormate = (date: string) => {
     return date ? date.replace(/-/g, '/') : ''
 };
@@ -28,6 +22,4 @@ const today = new Date();
 
 export const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
 
-export const cancelStyle = { background: 'red', color: 'white', padding: '0px 3px', fontSize: '8px', borderRadius: '50%', marginLeft: '3px' };
-
 export const lastYearStyle = { top: '10px', fontSize: '8px', backgroundColor: '#f3f3f3', width: '15px', height: '15px', borderRadius: '50%', color: '#555555' };
\ No newline at end of file
diff --git a/frontend/src/components/realty/RealtyMenu.tsx b/frontend/src/components/realty/RealtyMenu.tsx
index 8db2ade34..9b5ef3c35 100644
--- a/frontend/src/components/realty/RealtyMenu.tsx
+++ b/frontend/src/components/realty/RealtyMenu.tsx
@@ -52,6 +52,8 @@ export const REALTY_MENU: Group[] = [
     {
         // ⚠️ 2026-10-28: Dashboard にだけある画面は最後に残す
         label: 'Dashboard', items: [
+            // ⚠️ v2.2.264: 全社の実績（不動産企画係を1つの事業部として売上を出す。company/Company.tsx）。名前・アイコンは Menu.tsx の項目と同じ
+            { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット' },
             { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書' },
             { id: 'property', path: '/property', icon: 'fa-building', label: '掲載物件一覧', spOk: true },
         ],
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 1c8024ab6..1c0fd5c24 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.263';
+export const newVersion = '2.2.264';
```

## 全文：frontend/src/components/company/Company.tsx
```tsx
import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import AuthContext from "../../context/AuthContext";
import { getPeriod } from '../../utils/getPeriod';
import InformationEdit from '../information/InformationEdit';
import InformationEditKaeru from '../information/InformationEditKaeru';
import InformationEditResale from '../information/InformationEditResale';
import { thisYear } from '../../utils/thisYear';
import apiClient from '../../utils/apiClient';
import CustomerDetail from './CustomerDetail';
import Ranking from './Ranking';
import QuarterSummary from './QuarterSummary';
import CompanyToolbar from './CompanyToolbar';
import CompanyTable from './CompanyTable';
import type { CommitBudget } from './CompanyTable';
import { COMPANY_STYLE } from './companyStyle';
import { formattedThisMonth } from './companyUtils';
import { DIVISION_ORDER, REALTY_NAME, aggregateContracts, buildRows, multiChildrenOf } from './companyAggregate';
import type { Achievement, Customer, RealtyDeal, Section, Shop, Staff } from './companyTypes';

/**
 * 全社報告用フォーマット（会社実績）。
 *
 * ─────────────────────────────────────────────
 * v2.2.264 で、1つだった画面を分けた（2026-11-11 の指示：表示の速さ・見やすさ）。
 *   Company.tsx          … データの取得と、画面の状態（このファイル）
 *   companyAggregate.ts  … 集計（契約の振り分け・行とセルの文字づくり）。⚠️ 数え方の決まりはここの注記
 *   CompanyTable.tsx     … 表（並べるだけ。セルは memo）
 *   CompanyToolbar.tsx   … 上のバー
 *   companyStyle.ts      … 見た目
 *
 * ⚠️ 速さのために守ること
 *   ・部品（セル・行）を Company の中で定義しない（描き直すたびに全セルを作り直すことになる）
 *   ・表に渡す関数は useCallback で固定する（変わると全セルを描き直す）
 *   ・集計は useMemo の2段（契約の振り分け → 行づくり）。予算の保存では、1段目は動かない
 *   ・予算の入力中は state を変えない（欄を離れたときに保存。CompanyTable.tsx の BudgetInput）
 *
 * ⚠️⚠️ **「要確認」モーダルはこの画面が持っていない**（2026-09-28 に移した）。
 *   ⚠️ 「URL が変わるたびに出す」ため `App.tsx` に1つだけ置いてある。**ここに戻さないこと。**
 *
 * ⚠️ 不動産企画係（v2.2.264）
 *   ・1つの事業部として売上を出す（② の company が返す realty_deals。数え方は月次売上管理と同じ）
 *   ・事業が不動産企画係のときも開ける（不動産企画係の事業部を先頭に出す。中古リノベのときは中古リノベのすぐ次、注文・建売は最後）
 *   ・売上のセルは押せない。⚠️ 中古リノベの下にあった「不動産企画係」の店舗の行は出さない（事業部として出すため）
 * ─────────────────────────────────────────────
 */

const EMPTY_EDIT_ID: Record<string, string> = { order: '', kaeru: '', resale: '' };

const Company = () => {
    const { token, authority, category } = useContext(AuthContext);

    const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [realtyDeals, setRealtyDeals] = useState<RealtyDeal[]>([]);
    const [show, setShow] = useState(false);
    const [contract, setContract] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetYear, setTargetYear] = useState<number | null>(thisYear);
    const [editId, setEditId] = useState<Record<string, string>>(EMPTY_EDIT_ID);
    const [showLastYear, setShowLastYear] = useState(false);
    const [showCancel, setShowCancel] = useState(true);
    /**
     * 併売店をまとめるか。⚠️ 既定は false（false のときは従来の表示と1つも変わらない）。
     *   true にすると、子店舗の行を隠し、親店舗の行が「自店＋子店」を数え、重複している担当の行を1本にまとめる。
     */
    const [showMulti, setShowMulti] = useState<boolean>(false);
    const [showRanking, setShowRanking] = useState(false);
    /** 4半期サマリー（注文と建売）。⚠️ 中身は QuarterSummary.tsx。契約・予算は、この画面のデータをそのまま渡す */
    const [showQuarterSummary, setShowQuarterSummary] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post('', { request: 'company' });
            setOriginalStaffList(response.data.staff);
            setShopList(response.data.shop);
            setSectionList(response.data.section);
            setCustomerList([...response.data.contract, ...response.data.contract_kaeru, ...response.data.contract_resale]);
            setAchievement(response.data.achievement);
            // ⚠️ ② だけが返す（① が代わりに返したときは無い → 不動産企画係の売上は空）
            setRealtyDeals(response.data.realty_deals ?? []);
        };
        fetchData();
    }, []);

    const divisionArray: string[] = useMemo(() => DIVISION_ORDER[category] ?? DIVISION_ORDER.order, [category]);
    const staffList = useMemo(() => originalStaffList.filter(o => o.period === String(targetYear)), [originalStaffList, targetYear]);
    const monthArray: string[] = useMemo(() => getPeriod(Number(targetYear) - 1, 6), [targetYear]);
    const lastYearMonthArray: string[] = useMemo(() => getPeriod(Number(targetYear) - 2, 6), [targetYear]);

    /** まとめ表示で隠す店舗（＝子店舗）の名前 */
    const mergedChildShops = useMemo(() => {
        const set = new Set<string>();
        multiChildrenOf(shopList).forEach(children => children.forEach(c => set.add(c)));
        return set;
    }, [shopList]);
    /** バーの「店舗を選択」に出す店舗（⚠️ まとめ表示中は、隠れている子店舗を選ばせない） */
    const jumpShops = useMemo(
        // ⚠️ 不動産企画係は店舗の行が無い（事業部として出す）ので、ここには出さない
        () => shopList.filter(s => s.section && s.shop !== REALTY_NAME && !(showMulti && mergedChildShops.has(s.shop))),
        [shopList, showMulti, mergedChildShops]);

    // 1段目：契約を グループ → 事業部 → 課 → 店舗 に分ける（⚠️ 予算の保存・表示の切り替えでは動かない）
    const aggregated = useMemo(
        () => aggregateContracts(customerList, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList),
        [customerList, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList]);

    // 2段目：行とセルの文字を作る
    const rows = useMemo(() => buildRows({
        customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti,
        agg: aggregated, realtyDeals, thisMonth: formattedThisMonth,
        // ⚠️ 不動産企画係の事業部の場所：不動産企画係なら先頭、中古リノベ（used）なら中古リノベのすぐ次、注文・建売は最後
        realtyPlace: category === 'realty' ? 'first' : category === 'used' ? 'afterUsed' : 'last',
    }), [customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti, aggregated, realtyDeals, category]);

    /** その行まで表を動かす。⚠️ 行が無い（「〜を選択」を選んだ）ときは、表の先頭へ */
    const moveToTarget = useCallback((targetValue: string) => {
        const target = targetValue ? document.getElementById(targetValue) : null;
        if (!target) {
            document.querySelector('.co_scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const informationEditClose = useCallback(() => setEditId(EMPTY_EDIT_ID), []);

    /**
     * 予算を保存する（⚠️ 欄を離れたときに呼ばれる）。画面の値を先に直してから送る。
     * ⚠️ 保存に失敗したら、画面の値を元に戻す（戻さないと、保存できていない値が表に残り、同じ値を入れ直しても送られない）。
     */
    const changeAchievement: CommitBudget = useCallback(async (periodValue, categoryValue, nameValue, achievementValue) => {
        const same = (a: Achievement) => a.category === categoryValue && a.period === periodValue && a.name === nameValue;
        /** 直す前の値（null は、行が無かった） */
        let before: string | null = null;
        setAchievement(prev => {
            const hit = prev.find(same);
            before = hit ? hit.value : null;
            return hit
                ? prev.map(a => (same(a) ? { ...a, value: achievementValue } : a))
                : [...prev, { category: categoryValue, period: periodValue, name: nameValue, value: achievementValue }];
        });
        try {
            await apiClient.post('', { request: 'change_company_achievement', category: categoryValue, name: nameValue, period: periodValue, value: achievementValue });
        } catch (error) {
            console.error('Error updating achievement:', error);
            const restore = before;
            setAchievement(prev => (restore === null ? prev.filter(a => !same(a)) : prev.map(a => (same(a) ? { ...a, value: restore } : a))));
            alert('予算を保存できませんでした。入力前の値に戻しました。通信の状態を確かめて、もう一度入力してください。');
        }
    }, []);

    const showCustomer = useCallback((list: Customer[]) => {
        if (list.length === 0) return;
        setContract(list);
        setShow(true);
    }, []);

    const toggleLastYear = useCallback(() => setShowLastYear(v => !v), []);
    const toggleCancel = useCallback(() => setShowCancel(v => !v), []);
    const toggleMulti = useCallback(() => setShowMulti(v => !v), []);
    const openRanking = useCallback(() => setShowRanking(true), []);
    const openQuarter = useCallback(() => setShowQuarterSummary(true), []);

    return (
        <>
            <div className='content company co_page p-0'>
                <style>{COMPANY_STYLE}</style>
                <CompanyToolbar
                    category={category}
                    targetYear={targetYear}
                    divisionArray={divisionArray}
                    sectionList={sectionList}
                    shops={jumpShops}
                    showLastYear={showLastYear}
                    showCancel={showCancel}
                    showMulti={showMulti}
                    canMerge={mergedChildShops.size > 0}
                    onYear={setTargetYear}
                    onJump={moveToTarget}
                    onRanking={openRanking}
                    onQuarter={openQuarter}
                    onLastYear={toggleLastYear}
                    onCancel={toggleCancel}
                    onMulti={toggleMulti}
                />
                <CompanyTable
                    rows={rows}
                    monthArray={monthArray}
                    targetYear={targetYear}
                    showLastYear={showLastYear}
                    showCancel={showCancel}
                    onOpen={showCustomer}
                    onCommit={changeAchievement}
                />
            </div>
            <CustomerDetail show={show} setShow={setShow} contract={contract} setEditId={setEditId} category={category} />
            <InformationEdit id={editId.order} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
            <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement} />
            {(category === 'order' || category === 'spec') &&
                <QuarterSummary
                    // ⚠️ 事業が変わったら作り直す（⚠️ 中で反響を1回だけ取って持っているため）
                    key={category}
                    show={showQuarterSummary}
                    setShow={setShowQuarterSummary}
                    category={category}
                    targetYear={targetYear}
                    customerList={customerList}
                    shopList={shopList}
                    sectionList={sectionList}
                    achievement={achievement}
                    staffList={staffList}
                />}
        </>
    )
}

export default Company;
```

## 全文：frontend/src/components/company/companyAggregate.ts
```tsx
import { safeFormate } from '../../utils/informationUtils';
import { staffSorter } from '../../utils/staffSorter';
import { dealSales, sumByStaffMonth } from '../realty/summary/kpi';
import { dateFormate, monthFormate, lastYearMonthFormate } from './companyUtils';
import type { Achievement, Customer, Head, InputCell, NumCell, RealtyDeal, RowModel, Section, Shop, Staff, Td } from './companyTypes';

/**
 * 全社報告用フォーマット（会社実績）の集計（v2.2.264 で Company.tsx から分けた）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **数え方は、分ける前の Company.tsx と1つも変えていない。**
 *   以前は画面を描くたびに、セルごとに顧客・予算の配列を端から探していた（店舗 × 担当 × 月 × ランク）。
 *   いまは次の2段で先に数えておき、表（CompanyTable.tsx）は並べるだけにしている。
 *     1. aggregateContracts … 契約をグループ → 事業部 → 課 → 店舗に分ける（顧客・期・店舗が変わったときだけ）
 *     2. buildRows          … 行とセルの文字まで作る（予算・併売店のまとめ方が変わったときも）
 *   ⚠️ 改修の前後で、全セルの文字が同じことを確かめている（docs/task-2026-11-11-02）。
 *     数え方を直すときは、同じやり方で前後を比べること。
 *
 * ⚠️ 以前からの決まり（⚠️ どれも理由があるので、そろえ直さないこと）
 *   ・建売は status を見ない（isProspect）。建売の Sランクは当月の契約だけ（matchesRank）
 *   ・日付は `2026-09-05` と `2026/09` の2つの形がある（dateFormate・monthFormate でそろえて比べる）
 *   ・併売店の子は「multi = 1 かつ parent_shop あり」。まとめ表示では子の行を隠し、親が子の分も数える
 *   ・まとめ表示の担当は氏名でまとめ、**親店舗の行を残す**（先に入ったものを残す。Map の上書きにしない）
 *   ・店舗の予算の行のランク「契約済み」は 0 になる（担当名「予算」で絞るため。以前からの表示）
 *   ・⚠️ v2.2.264 で変えた数字は1つだけ：中古リノベの事業部の予算から、不動産企画係の予算を除いた
 *   ・中古リノベの店舗は、課に関係なく「中古住宅専門店」の店舗を並べる。合計と個人目標の列の順が注文・建売と逆
 *     （⚠️ v2.2.264 から「不動産企画係」の店舗だけは出さない。不動産企画係の事業部として別に出す）
 * ─────────────────────────────────────────────
 */

export const RANKS = ['契約済み', 'Sランク', 'Aランク', 'Bランク', 'Cランク'];

const DIVISION_MAPPING: Record<string, string> = {
    '注文事業': '注文',
    '建売分譲事業': '建売',
    '中古リノベ': '中専',
};

/** 事業（ログイン中の category）ごとの、事業部の並び。⚠️ realty は v2.2.264 で追加 */
export const DIVISION_ORDER: Record<string, string[]> = {
    order: ['注文事業', '建売分譲事業', '中古リノベ'],
    spec: ['建売分譲事業', '中古リノベ', '注文事業'],
    used: ['中古リノベ', '注文事業', '建売分譲事業'],
    realty: ['中古リノベ', '注文事業', '建売分譲事業'],
};

/** 顧客の事業（注文・建売・中専）→ ログイン中の category */
export const CUSTOMER_CATEGORY: Record<string, string> = { '注文': 'order', '建売': 'spec', '中専': 'used' };

export const REALTY_NAME = '不動産企画係';
const USED_DIVISION = '中古リノベ';
const USED_SECTION = '中古住宅専門店';
const CONTRACT_DIVISIONS = ['注文事業', '建売分譲事業'];

type Ctx = { monthArray: string[]; lastYearMonthArray: string[]; shopList: Shop[] };

const isContracted = (c: Customer): boolean => c.status === '契約済み' || c.status === '解約';

/** 契約（contract）で絞る。⚠️ 分ける前の calculateContractList と同じ */
const calculateContractList = (ctx: Ctx, list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string): Customer[] => {
    if (!list || !Array.isArray(list)) return [];
    const { monthArray, lastYearMonthArray, shopList } = ctx;
    const lastYear = category.endsWith('_lastYear');
    // ⚠️ 以前は今期と昨年の両方を毎回絞っていた。使うほうだけを絞る（結果は同じ）
    const base = lastYear
        ? list.filter(c => c.contract && isContracted(c) && (month ? dateFormate(c.contract).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract))))
        : list.filter(c => c.contract && isContracted(c) && (month ? dateFormate(c.contract).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract))));
    if (category === 'group' || category === 'group_lastYear') return base;
    if ((category === 'division' || category === 'division_lastYear') && division) return base.filter(b => b.category === DIVISION_MAPPING[division]);
    if (category === 'section' || category === 'section_lastYear') {
        const targetShops = new Set(shopList.filter(s => s.section === section).map(s => s.shop));
        return base.filter(b => targetShops.has(b.shop));
    }
    if (category === 'staff') return base.filter(b => b.staff === staff && b.shop === shop);
    if (category === 'staff_lastYear') return base.filter(b => b.staff === staff);
    if (category === 'shop' || category === 'shop_lastYear') return base.filter(b => b.shop === shop);
    return [];
};

/** 仲介の契約（contract_broker。建売だけ）で絞る。⚠️ 分ける前の calculateContractListBroker と同じ */
const calculateContractListBroker = (ctx: Ctx, list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string): Customer[] => {
    if (division && division !== '建売分譲事業') return [];
    if (!list || !Array.isArray(list)) return [];
    const { monthArray, lastYearMonthArray, shopList } = ctx;
    const lastYear = category.endsWith('_lastYear');
    const base = lastYear
        ? list.filter(c => c.contract_broker && c.category === '建売' && isContracted(c) && (month ? dateFormate(c.contract_broker).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract_broker))))
        : list.filter(c => c.contract_broker && c.category === '建売' && isContracted(c) && (month ? dateFormate(c.contract_broker).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract_broker))));
    if (category === 'group' || category === 'division' || category === 'group_lastYear' || category === 'division_lastYear') return base;
    if (category === 'section' || category === 'section_lastYear') {
        const targetShops = new Set(shopList.filter(s => s.section === section).map(s => s.shop));
        return base.filter(b => targetShops.has(b.shop));
    }
    if (category === 'staff') return base.filter(b => b.staff === staff && b.shop === shop);
    if (category === 'staff_lastYear') return base.filter(b => b.staff === staff);
    if (category === 'shop' || category === 'shop_lastYear') return base.filter(b => b.shop === shop);
    return [];
};

type Monthly = Record<string, Customer[]>;
type Level = {
    total: Customer[]; lastYear: Customer[]; monthly: Monthly; lastYearMonthly: Monthly;
    total_broker: Customer[]; lastYear_broker: Customer[]; monthly_broker: Monthly; lastYearMonthly_broker: Monthly;
};
type ShopLevel = { total: Customer[]; lastYear: Customer[]; total_broker: Customer[]; lastYear_broker: Customer[] };
export type Aggregated = { group: Level; divisions: Record<string, Level>; sections: Record<string, Level>; shops: Record<string, ShopLevel> };

/** 契約を グループ → 事業部 → 課 → 店舗 に分ける（上の段で絞った結果を、下の段がさらに絞る） */
export const aggregateContracts = (customerList: Customer[], monthArray: string[], lastYearMonthArray: string[], divisionArray: string[], sectionList: Section[], shopList: Shop[]): Aggregated => {
    const ctx: Ctx = { monthArray, lastYearMonthArray, shopList };
    const byMonth = (fn: (m: string) => Customer[]): Monthly => Object.fromEntries(monthArray.map(m => [m, fn(m)]));
    const level = (total: Customer[], lastYear: Customer[], totalBroker: Customer[], lastYearBroker: Customer[], kind: string, division?: string, section?: string): Level => ({
        total,
        lastYear,
        monthly: byMonth(m => calculateContractList(ctx, total, kind, m, division, section)),
        lastYearMonthly: byMonth(m => calculateContractList(ctx, lastYear, `${kind}_lastYear`, m, division, section)),
        total_broker: totalBroker,
        lastYear_broker: lastYearBroker,
        monthly_broker: byMonth(m => calculateContractListBroker(ctx, totalBroker, kind, m, division, section)),
        lastYearMonthly_broker: byMonth(m => calculateContractListBroker(ctx, lastYearBroker, `${kind}_lastYear`, m, division, section)),
    });

    const group = level(
        calculateContractList(ctx, customerList, 'group'),
        calculateContractList(ctx, customerList, 'group_lastYear'),
        calculateContractListBroker(ctx, customerList, 'group'),
        calculateContractListBroker(ctx, customerList, 'group_lastYear'),
        'group');

    const divisions = Object.fromEntries(divisionArray.map(div => [div, level(
        calculateContractList(ctx, group.total, 'division', '', div),
        calculateContractList(ctx, group.lastYear, 'division_lastYear', '', div),
        calculateContractListBroker(ctx, group.total_broker, 'division', '', div),
        calculateContractListBroker(ctx, group.lastYear_broker, 'division_lastYear', '', div),
        'division', div)]));

    const sections = Object.fromEntries(sectionList.map(sec => [sec.name, level(
        calculateContractList(ctx, divisions[sec.division]?.total || [], 'section', '', '', sec.name),
        calculateContractList(ctx, divisions[sec.division]?.lastYear || [], 'section_lastYear', '', '', sec.name),
        calculateContractListBroker(ctx, divisions[sec.division]?.total_broker || [], 'section', '', '', sec.name),
        calculateContractListBroker(ctx, divisions[sec.division]?.lastYear_broker || [], 'section_lastYear', '', '', sec.name),
        'section', '', sec.name)]));

    const shops = Object.fromEntries(shopList.map(shp => [shp.shop, {
        total: calculateContractList(ctx, sections[shp.section]?.total || [], 'shop', '', '', '', shp.shop),
        lastYear: calculateContractList(ctx, sections[shp.section]?.lastYear || [], 'shop_lastYear', '', '', '', shp.shop),
        total_broker: calculateContractListBroker(ctx, sections[shp.section]?.total_broker || [], 'shop', '', '', '', shp.shop),
        lastYear_broker: calculateContractListBroker(ctx, sections[shp.section]?.lastYear_broker || [], 'shop_lastYear', '', '', '', shp.shop),
    }]));

    return { group, divisions, sections, shops };
};

/**
 * 併売店の親子関係。親店舗名 → 子店舗名の配列。
 * ⚠️ 子の判定は「multi = 1 かつ parent_shop が入っている」（multi だけでは決まらない。親にも multi = 1 がある）
 */
export const multiChildrenOf = (shopList: Shop[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    shopList.forEach(sh => {
        const parent = (sh.parent_shop ?? '').trim();
        if (sh.multi !== 1 || !parent) return;
        map.set(parent, [...(map.get(parent) ?? []), sh.shop]);
    });
    return map;
};

// ---------------------------------------------------------------------------
// セル
// ---------------------------------------------------------------------------

const LY_TOTAL = 23;
const LY_MONTH = -5;

const numCell = (over: Partial<NumCell> & Pick<NumCell, 'tone' | 'main'>): NumCell => ({
    t: 'num', broker: 0, cancel: 0, ly: null, lyBroker: 0, lyRight: LY_MONTH, list: [], active: false, colSpan: 1, rowSpan: 1, ...over,
});

/** 契約のセル（⚠️ 分ける前の TableContract と同じ） */
const contractCell = (list: Customer[], brokerList: Customer[], opt: { row?: number; col?: number; lastYear?: Customer[] | null; lastYearBroker?: Customer[]; division?: string } = {}): NumCell => {
    const { row = 1, col = 1, lastYear = null, lastYearBroker = [], division } = opt;
    const showBroker = brokerList.length > 0;
    const click = showBroker ? [...list, ...brokerList] : list;
    const common = { tone: 'contract' as const, active: list.length > 0 || showBroker, list: click, colSpan: col, rowSpan: row, lyRight: col === 2 ? LY_TOTAL : LY_MONTH };
    if (division === USED_DIVISION) {
        // ⚠️ 中古リノベは粗利の合計（万円）。件数・仲介・解約・昨年実績は出さない
        const total = list.reduce((acc, cur) => acc + Number(cur?.price ?? 0) * 100, 0) / 100;
        return numCell({ ...common, main: total > 0 ? total.toLocaleString() : '0' });
    }
    return numCell({
        ...common,
        main: String(list.length),
        broker: brokerList.length,
        cancel: list.filter(o => o.status === '解約').length,
        ly: lastYear !== null ? String(lastYear.length) : null,
        lyBroker: lastYearBroker.length,
    });
};

/** 予算の合計のセル（⚠️ 分ける前の TableAchievement と同じ） */
const budgetCell = (value: number, lastYear: number, col: number): NumCell =>
    numCell({ tone: 'budget', main: String(value), active: !!value && value > 0, ly: String(lastYear), colSpan: col, lyRight: col === 2 ? LY_TOTAL : LY_MONTH });

const inputCell = (tone: InputCell['tone'], category: InputCell['category'], name: string, period: string, value: string): InputCell =>
    ({ t: 'input', tone, category, name, period, value, colSpan: 1 });

const head = (text: string, variant: Head['variant'], over: Partial<Head> = {}): Head => ({ text, variant, rowSpan: 1, colSpan: 1, ...over });

/** 並びを保ったまま、キーごとに分ける */
const groupBy = (list: Customer[], key: (o: Customer) => string | undefined): Map<string | undefined, Customer[]> => {
    const map = new Map<string | undefined, Customer[]>();
    for (const o of list) {
        const k = key(o);
        const arr = map.get(k);
        if (arr) arr.push(o);
        else map.set(k, [o]);
    }
    return map;
};

// ---------------------------------------------------------------------------
// 行
// ---------------------------------------------------------------------------

export type BuildInput = {
    customerList: Customer[];
    achievement: Achievement[];
    staffList: Staff[];
    shopList: Shop[];
    sectionList: Section[];
    monthArray: string[];
    lastYearMonthArray: string[];
    divisionArray: string[];
    showMulti: boolean;
    agg: Aggregated;
    realtyDeals: RealtyDeal[];
    /** 今月（`YYYY/MM`。companyUtils の formattedThisMonth） */
    thisMonth: string;
    /**
     * 不動産企画係の事業部を出す場所。
     *   first … 先頭（ログイン中の事業が不動産企画係）／ afterUsed … 中古リノベのすぐ次（中古リノベ）／ last … 最後（注文・建売）
     */
    realtyPlace: 'first' | 'afterUsed' | 'last';
};

export const buildRows = (input: BuildInput): RowModel[] => {
    const { customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti, agg, realtyDeals, thisMonth, realtyPlace } = input;
    const ctx: Ctx = { monthArray, lastYearMonthArray, shopList };
    const thisMonthKey = monthFormate(thisMonth);
    const firstPeriod = (monthArray[0] ?? '').slice(0, 7);
    const sorter = staffSorter();

    // ── 予算（company_achievement）
    //   ⚠️ 足し算は元の並びのまま行う（小数の予算があっても、以前と同じ結果になるように）
    const ach = achievement.map(a => {
        const mk = monthFormate(a.period);
        return { a, mk, inYear: monthArray.includes(mk), inLastYear: lastYearMonthArray.includes(mk) };
    });
    const sumAch = (pick: (x: typeof ach[number]) => boolean): number => ach.reduce((cur, x) => (pick(x) ? cur + Number(x.a.value) : cur), 0);
    /** month があればその月、無ければ今期（lastYear なら昨年の同じ月・昨年の期） */
    const inPeriod = (x: typeof ach[number], month: string, lastYear: boolean): boolean =>
        month
            ? x.mk === (lastYear ? lastYearMonthFormate(month, '-') : monthFormate(month))
            : (lastYear ? x.inLastYear : x.inYear);
    const groupBudget = (month: string, lastYear: boolean): number => sumAch(x => inPeriod(x, month, lastYear) && x.a.category === 'shop'
        // ⚠️ 今期だけ、中古住宅専門店・不動産企画係を除く（昨年は除いていない。以前からの数え方）
        && (lastYear || (x.a.name !== USED_SECTION && x.a.name !== REALTY_NAME)));
    const shopsBudget = (shops: Set<string>, month: string, lastYear: boolean): number => sumAch(x => inPeriod(x, month, lastYear) && shops.has(safeFormate(x.a.name)));
    /** 最初に見つかった予算の値（⚠️ 空・0 のときは ''）。キーは category・name・period */
    const achValue = new Map<string, string>();
    for (const { a } of ach) {
        const k = `${a.category}\t${a.name}\t${a.period}`;
        if (!achValue.has(k)) achValue.set(k, a.value);
    }
    const valueOf = (category: string, name: string, period: string): string => achValue.get(`${category}\t${name}\t${period}`) || '';
    /** 店舗の今期の予算の合計 */
    const shopYearBudget = (shop: string): number => sumAch(x => x.a.category === 'shop' && x.a.name === shop && x.inYear);

    // ── 見込み客とランク
    const isProspect = (o: Customer): boolean => (o.category === '建売' ? true : o.status === '見込み');
    const includesThisMonth = (value: string | undefined | null): boolean => !!value && (value.includes(thisMonth) || value.includes(thisMonthKey));
    const matchesRank = (o: Customer, r: string): boolean => {
        if (!safeFormate(o.rank).includes(r)) return false;
        if (o.category === '建売' && r === 'Sランク') return includesThisMonth(o.contract) || includesThisMonth(o.contract_broker);
        return true;
    };
    const prospects = customerList.filter(o => isProspect(o) && (o.rank_period <= thisMonth || !o.rank_period));

    // ── 中古リノベ
    const usedList = customerList.filter(c => c.category === '中専');
    const usedContractList = usedList.filter(c => c.status === '契約済み' && (c.contract_reform || c.contract_buy || c.contract_sell));
    const withPrice = (u: Customer): Customer => ({ ...u, price: String(Number(u.contraction_contract_price ?? 0)) });
    const withProspectPrice = (u: Customer): Customer => ({ ...u, price: String(Number(u.contract_land_application_date ?? 0) + Number(u.contract_building_application_date ?? 0)) });
    const usedInMonths = (u: Customer, months: string[]): boolean =>
        months.includes(monthFormate(u.contract_reform)) || months.includes(monthFormate(u.contract_sell)) || months.includes(monthFormate(u.contract_buy));
    const usedInMonth = (u: Customer, month: string): boolean => {
        const m = dateFormate(month);
        return dateFormate(u.contract_reform).includes(m) || dateFormate(u.contract_sell).includes(m) || dateFormate(u.contract_buy).includes(m);
    };
    const budgetTotal = (list: Customer[]): number => list.reduce((acc, cur) => acc + Math.round(Number(cur.contraction_contract_price ?? 0) * 10), 0) / 10;

    // ── 併売店
    const multiChildren = multiChildrenOf(shopList);
    const mergedChildShops = new Set<string>();
    multiChildren.forEach(children => children.forEach(c => mergedChildShops.add(c)));
    const shopNamesOf = (shopName: string): string[] => (showMulti ? [shopName, ...(multiChildren.get(shopName) ?? [])] : [shopName]);
    const isVisibleShop = (shopName: string): boolean => !(showMulti && mergedChildShops.has(shopName));

    const rows: RowModel[] = [];

    // ── グループ
    {
        const ranks = RANKS.map(r => contractCell(
            r === '契約済み' ? (agg.group.monthly?.[thisMonthKey] || []) : prospects.filter(o => matchesRank(o, r)),
            r === '契約済み' ? (agg.group.monthly_broker?.[thisMonthKey] || []) : [],
            { row: 2 }));
        rows.push({
            key: 'group-budget', level: 'group', first: true, sticky: 1, kind: 'budget',
            heads: [head('グループ予算', 'budget', { colSpan: 2 })],
            tds: [...monthArray.map(m => budgetCell(groupBudget(m, false), groupBudget(m, true), 1)), budgetCell(groupBudget('', false), groupBudget('', true), 2)],
            ranks,
        });
        rows.push({
            key: 'group-result', level: 'group', first: false, sticky: 2, kind: 'result',
            heads: [head('グループ実績', 'result', { colSpan: 2 })],
            tds: [
                ...monthArray.map(m => contractCell(agg.group.monthly?.[m] || [], agg.group.monthly_broker?.[m] || [], { lastYear: agg.group.lastYearMonthly?.[m] || [], lastYearBroker: agg.group.lastYearMonthly_broker?.[m] || [] })),
                contractCell(agg.group.total || [], agg.group.total_broker || [], { col: 2, lastYear: agg.group.lastYear || [], lastYearBroker: agg.group.lastYear_broker || [] }),
            ],
            ranks: null,
        });
    }

    /** 注文・建売の店舗（⚠️ 分ける前の contractTable と同じ） */
    const contractShopRows = (section: Section, division: string, color: number, sectionProspects: Customer[]): void => {
        // ランクごとに、担当・店舗で分けておく（⚠️ 以前は行ごとに課の見込み客を端から探していた）
        const rankIndex = RANKS.slice(1).map(r => {
            const matched = sectionProspects.filter(o => matchesRank(o, r));
            return { byStaff: groupBy(matched, o => o.staff), byShop: groupBy(matched, o => o.shop) };
        });
        const divisionTotal = agg.divisions[division]?.total || [];

        shopList
            .filter(shop => shop.section === section.name && !shop.shop.includes('FH') && isVisibleShop(shop.shop))
            .forEach(shop => {
                const shopNames = shopNamesOf(shop.shop);
                // ⚠️ まとめ表示では氏名でまとめる。shopNames は [親, ...子] の順なので、先に入る＝親が残る
                let shopStaffList: Staff[];
                if (showMulti) {
                    const seen = new Map<string, Staff>();
                    shopNames.forEach(name => {
                        staffList.filter(st => st.shop === name && st.report === 1).forEach(st => {
                            if (!seen.has(st.name)) seen.set(st.name, st);
                        });
                    });
                    shopStaffList = Array.from(seen.values());
                } else {
                    shopStaffList = staffList.filter(st => st.shop === shop.shop && st.report === 1);
                }
                const lines = [...shopStaffList,
                    { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 },
                    { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                    .sort(sorter).filter(staff => staff.report === 1);
                const staffLength = shopStaffList.length + 2;

                const baseShopTotal = shopNames.flatMap(n => agg.shops[n]?.total ?? []);
                const baseShopTotalBroker = shopNames.flatMap(n => agg.shops[n]?.total_broker ?? []);
                const baseShopLastYear = shopNames.flatMap(n => agg.shops[n]?.lastYear ?? []);
                const baseShopLastYearBroker = shopNames.flatMap(n => agg.shops[n]?.lastYear_broker ?? []);
                // ⚠️ まとめ表示のときは括弧の併売数を出さない（本数そのものが子店舗を含むため）
                const isShopMulti = shop.multi === 1 && !showMulti;
                const shopBudgetTotal = shopYearBudget(shop.shop);

                lines.forEach((staff, staffIndex) => {
                    const isShop = staffIndex === staffLength - 1;
                    const isAchievement = staffIndex === staffLength - 2;
                    const isStaff = staffIndex < staffLength - 2;
                    const isStaffMulti = staff.multi === 1 && !showMulti;
                    const mine = (o: Customer): boolean => o.staff === staff.name && shopNames.includes(o.shop ?? '');

                    const shopContract = isShop ? baseShopTotal : baseShopTotal.filter(mine);
                    const shopContractBroker = isShop ? baseShopTotalBroker : baseShopTotalBroker.filter(mine);
                    const shopContractLastYear = isShop ? baseShopLastYear : calculateContractList(ctx, baseShopLastYear, 'staff_lastYear', '', '', '', shop.shop, staff.name);
                    const shopContractLastYearBroker = isShop ? baseShopLastYearBroker : calculateContractListBroker(ctx, baseShopLastYearBroker, 'staff_lastYear', '', '', '', shop.shop, staff.name);
                    // ⚠️ 括弧の併売数（店舗名からブランド名を除いた部分一致の推測値）。使う行だけ数える
                    const needMulti = isShop ? isShopMulti : isStaffMulti;
                    const multiContract = !needMulti ? [] : divisionTotal.filter(o => (isShop ? o.shop?.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name));
                    const lastYearKind = isShop ? 'shop_lastYear' : 'staff_lastYear';

                    const tds: Td[] = [];
                    if (isAchievement) {
                        monthArray.forEach(month => tds.push(inputCell('shop', 'shop', shop.shop, month, valueOf('shop', shop.shop, month))));
                        tds.push(numCell({ tone: 'budgetFixed', main: String(shopBudgetTotal), active: true, colSpan: 2 }));
                    } else {
                        monthArray.forEach(month => {
                            const m = dateFormate(month);
                            const period = shopContract.filter(o => dateFormate(o.contract).includes(m));
                            const periodBroker = shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(m));
                            const periodLastYear = calculateContractList(ctx, shopContractLastYear, lastYearKind, month, '', '', shop.shop, staff.name);
                            const periodLastYearBroker = calculateContractListBroker(ctx, shopContractLastYearBroker, lastYearKind, month, '', '', shop.shop, staff.name);
                            const multiPeriod = isShop && isShopMulti ? multiContract.filter(o => dateFormate(o.contract).includes(m)) : [];
                            tds.push(numCell({
                                tone: 'contract',
                                main: `${period.length}${isShop && isShopMulti ? `(${multiPeriod.length})` : ''}`,
                                broker: periodBroker.length,
                                cancel: period.filter(o => o.status === '解約').length,
                                ly: String(periodLastYear.length),
                                lyBroker: periodLastYearBroker.length,
                                list: [...period, ...periodBroker],
                                active: period.length > 0 || periodBroker.length > 0,
                            }));
                        });
                        tds.push(numCell({
                            tone: 'contract',
                            main: `${shopContract.length}${needMulti ? `(${multiContract.length})` : ''}`,
                            broker: shopContractBroker.length,
                            cancel: shopContract.filter(o => o.status === '解約').length,
                            ly: String(shopContractLastYear.length),
                            lyBroker: shopContractLastYearBroker.length,
                            lyRight: isShop ? LY_TOTAL : LY_MONTH,
                            list: [...shopContract, ...shopContractBroker],
                            active: shopContract.length > 0 || shopContractBroker.length > 0,
                            colSpan: isShop ? 2 : 1,
                        }));
                        if (isStaff) tds.push(inputCell('staff', 'staff', staff.name, firstPeriod, valueOf('staff', staff.name, firstPeriod)));
                    }

                    const ranks = isShop ? null : RANKS.map((r, rankIndexNo) => {
                        const target = r === '契約済み'
                            ? shopContract.filter(o => dateFormate(o.contract).includes(thisMonth))
                            : ((isStaff ? rankIndex[rankIndexNo - 1].byStaff.get(staff.name) : rankIndex[rankIndexNo - 1].byShop.get(shop.shop)) ?? []);
                        const targetBroker = r === '契約済み' ? shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(thisMonth)) : [];
                        return contractCell(target, targetBroker, { row: isAchievement ? 2 : 1 });
                    });

                    rows.push({
                        key: `${division}/${section.name}/${shop.shop}/${staffIndex}:${staff.name}`,
                        id: staffIndex === 0 ? shop.shop : undefined,
                        level: 'shop', first: staffIndex === 0, gapBefore: staffIndex === 0 ? 1 : undefined,
                        kind: isAchievement ? 'budget' : isShop ? 'result' : 'staff',
                        heads: [
                            ...(staffIndex === 0 ? [head(shop.shop, 'shop', { rowSpan: staffLength, color })] : []),
                            head(staff.name, isAchievement ? 'budget' : isShop ? 'result' : 'name', { second: true }),
                        ],
                        tds, ranks,
                    });
                });
            });
    };

    /** 中古リノベの店舗（⚠️ 分ける前の contractTable_used と同じ。課に関係なく「中古住宅専門店」の店舗を並べる） */
    const usedShopRows = (keyPrefix: string): void => {
        // ⚠️ v2.2.264: 「不動産企画係」の店舗は出さない（1つの事業部として別に出すため。2026-11-11 の指示）。
        //   ⚠️ 中古リノベの事業部の合計は顧客データ（中専）から数えているので、行を隠しても変わらない
        shopList.filter(s => s.section === USED_SECTION && s.shop !== REALTY_NAME).forEach((s, sIndex) => {
            const targetStaffs = staffList.filter(st => st.shop === s.shop);
            const staffNames = new Set(targetStaffs.map(t => t.name));
            const baseLength = targetStaffs.length;
            // ⚠️ ランクの列だけ、報告対象（report = 1）の人数で数える（以前からの数え方）
            const staffLength = staffList.filter(st => st.shop === s.shop && st.report === 1).length + 2;
            const lines = [...targetStaffs,
                { name: '予算', shop: s.shop, section: USED_SECTION, report: 1, sort: 0, multi: 0 },
                { name: '実績', shop: s.shop, section: USED_SECTION, report: 1, sort: -1, multi: s.multi }]
                .sort(sorter);

            lines.forEach((staff, staffIndex) => {
                const isShop = staffIndex === baseLength + 1;
                const isStaff = staffIndex <= baseLength - 1;
                const isAchievement = staffIndex === baseLength;
                const mine = (u: Customer): boolean => (isShop ? staffNames.has(u.staff) : u.staff === staff.name);
                const usedStaffs = usedContractList.filter(mine);
                const totalContracts = usedStaffs.filter(u => usedInMonths(u, monthArray));
                const totalBudget = budgetTotal(totalContracts);
                const lastYearBudget = budgetTotal(usedStaffs.filter(u => usedInMonths(u, lastYearMonthArray)));

                const tds: Td[] = [];
                monthArray.forEach(month => {
                    if (isAchievement) {
                        const v = sumAch(x => x.a.category === 'shop' && x.a.name === s.shop && dateFormate(x.a.period) === dateFormate(month));
                        tds.push(numCell({ tone: 'budgetFixed', main: (v || 0).toLocaleString(), active: true }));
                        return;
                    }
                    const periodContracts = usedStaffs.filter(u => usedInMonth(u, month));
                    const periodBudget = budgetTotal(periodContracts);
                    if (isShop) {
                        const lastMonth = `${Number(month.split('-')[0] ?? 0) - 1}-${month.split('-')[1]}`;
                        tds.push(numCell({ tone: 'contract', main: periodBudget.toLocaleString(), ly: String(budgetTotal(usedStaffs.filter(u => usedInMonth(u, lastMonth)))), lyRight: LY_TOTAL, list: periodBudget > 0 ? periodContracts : [], active: periodBudget > 0 }));
                    } else if (isStaff) {
                        tds.push(numCell({ tone: 'contract', main: periodBudget > 0 ? periodBudget.toLocaleString() : '0', list: periodBudget > 0 ? periodContracts : [], active: periodBudget > 0 }));
                    }
                });
                const totalCell = (col: number): NumCell => numCell({ tone: 'contract', main: totalBudget.toLocaleString(), ly: String(lastYearBudget), lyRight: LY_TOTAL, list: totalBudget > 0 ? totalContracts : [], active: totalBudget > 0, colSpan: col });
                if (isAchievement) tds.push(numCell({ tone: 'budgetFixed', main: shopYearBudget(s.shop).toLocaleString(), active: true, colSpan: 2 }));
                if (isShop) tds.push(totalCell(2));
                // ⚠️ 担当の行は「個人目標 → 合計」の順（注文・建売と逆。以前からの並び）
                if (isStaff) tds.push(inputCell('staff', 'staff', staff.name, firstPeriod, valueOf('staff', staff.name, firstPeriod)), totalCell(1));

                const ranks = staffIndex === staffLength - 1 ? null : RANKS.map(r => {
                    const useShop = staffIndex === staffLength - 2;
                    const who = (o: Customer): boolean => (useShop ? staffNames.has(o.staff) : o.staff === staff.name);
                    const list = r === '契約済み'
                        ? usedList.filter(o => o.status === '契約済み' && who(o) && (dateFormate(o.contract_reform).includes(thisMonth) || dateFormate(o.contract_sell).includes(thisMonth) || dateFormate(o.contract_buy).includes(thisMonth))).map(withPrice)
                        : usedList.filter(o => o.status === '見込み' && safeFormate(o.rank).includes(r) && who(o)).map(withProspectPrice);
                    return contractCell(list, [], { row: useShop ? 2 : 1, division: USED_DIVISION });
                });

                rows.push({
                    key: `${keyPrefix}${s.shop}/${staffIndex}:${staff.name}`,
                    level: 'shop', first: staffIndex === 0, gapBefore: staffIndex === 0 ? 1 : undefined,
                    kind: isAchievement ? 'budget' : isShop ? 'result' : 'staff',
                    heads: [
                        ...(staffIndex === 0 ? [head(s.shop, 'shop', { rowSpan: targetStaffs.length + 2, color: sIndex })] : []),
                        head(staff.name, isAchievement ? 'budget' : isShop ? 'result' : 'name', { second: true }),
                    ],
                    tds, ranks,
                });
            });
        });
    };

    /**
     * 不動産企画係（1つの事業部として出す。v2.2.264）。
     * ⚠️ 担当 × 月の金額は、月次売上管理（realty/sales/MonthlySales.tsx）と同じ（同じ sumByStaffMonth・dealSales）。
     *   違うのは次の3つ。
     *     ・合計に入れる人 … こちらは売上のある全員（担当の一覧に居ない人は「その他」）。月次売上管理は設定の担当者だけ
     *     ・期 … こちらは 6月〜5月。月次売上管理は設定の期首月から12か月（⚠️ 2026-11 時点の期首は 6月で同じ）
     *     ・丸め … こちらは万円・小数1桁。⚠️ 合計の列は「円の合計を丸めた値」なので、月のセルを足した値と 0.数万円ずれることがある
     * ⚠️ 昨年実績は、昨年の同じ月（合計は昨年の期）の売上。
     */
    const realtyRows = (): void => {
        const sales = sumByStaffMonth(realtyDeals, dealSales);
        const nameKey = (v: string): string => v.replace(/[\s　]/g, '');
        /** 円 → 万円（小数1桁） */
        const man = (yen: number): string => (Math.round(yen / 1000) / 10).toLocaleString();
        const salesCell = (yen: number, lastYearYen: number, col = 1): NumCell =>
            numCell({ tone: 'sales', main: man(yen), ly: man(lastYearYen), lyRight: col === 2 ? LY_TOTAL : LY_MONTH, active: yen > 0, colSpan: col });
        /** 12か月（昨年の同じ月つき）＋ 合計（昨年の期つき） */
        const salesCells = (names: string[]): NumCell[] => [
            ...monthArray.map(m => salesCell(sumOf(names, [m]), sumOf(names, [lastYearMonthFormate(m, '-') ?? '']))),
            salesCell(sumOf(names, monthArray), sumOf(names, lastYearMonthArray), 2),
        ];
        const sumOf = (names: string[], months: string[]): number => names.reduce((acc, n) => acc + months.reduce((a, m) => a + (sales[n]?.[m] ?? 0), 0), 0);

        const allNames = Object.keys(sales);
        const members = staffList.filter(st => st.shop === REALTY_NAME).sort(sorter);
        const memberKeys = new Set(members.map(m => nameKey(m.name)));
        // ⚠️ 担当の一覧に居ない人（退職・表記ちがい）の売上は「その他」にまとめる（事業部の合計と合うように）
        const others = allNames.filter(n => !memberKeys.has(nameKey(n)));
        const lines = [
            ...members.map(m => ({ label: m.name, names: allNames.filter(n => nameKey(n) === nameKey(m.name)) })),
            ...(sumOf(others, monthArray) !== 0 ? [{ label: 'その他', names: others }] : []),
        ];
        const budget = (month: string): number => sumAch(x => x.a.category === 'shop' && x.a.name === REALTY_NAME && (month ? x.mk === monthFormate(month) : x.inYear));

        rows.push({
            key: 'realty-budget', id: `${REALTY_NAME}（事業部）`, level: 'division', first: true, gapBefore: 3, gapLabel: REALTY_NAME, kind: 'budget', isNew: true,
            heads: [head(REALTY_NAME, 'division', { rowSpan: 2 }), head('予算', 'budget', { second: true })],
            tds: [...monthArray.map(m => numCell({ tone: 'budget', main: budget(m).toLocaleString(), active: budget(m) > 0 })), numCell({ tone: 'budget', main: budget('').toLocaleString(), active: budget('') > 0, colSpan: 2 })],
            ranks: null,
        });
        rows.push({
            key: 'realty-result', level: 'division', first: false, kind: 'result', isNew: true,
            heads: [head('売上', 'result', { second: true })],
            tds: salesCells(allNames),
            ranks: null,
        });
        lines.forEach((line, index) => {
            rows.push({
                key: `realty-staff-${index}`, level: 'shop', first: index === 0, gapBefore: index === 0 ? 1 : undefined, kind: 'staff', isNew: true,
                heads: [
                    ...(index === 0 ? [head('担当別', 'shop', { rowSpan: lines.length, color: 0 })] : []),
                    head(line.label, 'name', { second: true }),
                ],
                tds: salesCells(line.names),
                ranks: null,
            });
        });
    };

    if (realtyPlace === 'first') realtyRows();

    // ── 事業部 → 課 → 店舗
    divisionArray.forEach(division => {
        const isUsed = division === USED_DIVISION;
        const level = agg.divisions[division];
        // ⚠️ v2.2.264: 中古リノベの事業部の予算には、不動産企画係の予算を入れない（不動産企画係は別の事業部として出すため）。
        //   shop_list では「不動産企画係」が中古リノベの店舗なので、除かないと両方の事業部に出る（実績は以前から入っていない）
        const divisionShops = new Set(shopList.filter(s => s.division === division && !(isUsed && s.shop === REALTY_NAME)).map(s => s.shop));
        const prospectList = prospects.filter(o => o.category === DIVISION_MAPPING[division]);

        const ranks = RANKS.map(r => {
            if (isUsed) {
                const list = r === '契約済み'
                    ? usedList.filter(u => u.status === '契約済み' && (monthFormate(u.contract_reform).includes(thisMonthKey) || monthFormate(u.contract_buy).includes(thisMonthKey) || monthFormate(u.contract_sell).includes(thisMonthKey))).map(withPrice)
                    : usedList.filter(u => u.status !== '契約済み' && safeFormate(u.rank)?.includes(r)).map(withProspectPrice);
                return contractCell(list, [], { row: 2, division });
            }
            return contractCell(
                r === '契約済み' ? (level?.monthly?.[thisMonthKey] || []) : prospectList.filter(o => matchesRank(o, r)),
                r === '契約済み' ? (level?.monthly_broker?.[thisMonthKey] || []) : [],
                { row: 2, division });
        });
        rows.push({
            key: `div-${division}-budget`, id: division, level: 'division', first: true, gapBefore: 3, gapLabel: division, kind: 'budget',
            heads: [head(division, 'division', { rowSpan: 2 }), head('予算', 'budget', { second: true })],
            tds: [...monthArray.map(m => budgetCell(shopsBudget(divisionShops, m, false), shopsBudget(divisionShops, m, true), 1)), budgetCell(shopsBudget(divisionShops, '', false), shopsBudget(divisionShops, '', true), 2)],
            ranks,
        });
        rows.push({
            key: `div-${division}-result`, level: 'division', first: false, kind: 'result',
            heads: [head('実績', 'result', { second: true })],
            tds: [
                ...monthArray.map(m => contractCell(
                    isUsed ? usedContractList.filter(u => u.status === '契約済み' && usedInMonth(u, m)).map(withPrice) : (level?.monthly?.[m] || []),
                    level?.monthly_broker?.[m] || [],
                    { lastYear: level?.lastYearMonthly?.[m] || [], lastYearBroker: level?.lastYearMonthly_broker?.[m] || [], division })),
                contractCell(
                    isUsed ? usedContractList.filter(u => usedInMonths(u, monthArray)).map(withPrice) : (level?.total || []),
                    level?.total_broker || [],
                    { col: 2, lastYear: level?.lastYear || [], lastYearBroker: level?.lastYear_broker || [], division }),
            ],
            ranks: null,
        });

        sectionList.filter(s => s.division === division).forEach((section, sectionIndex) => {
            const sec = agg.sections[section.name];
            const sectionShops = new Set(shopList.filter(s => s.section === section.name).map(s => s.shop));
            const sectionProspects = prospectList.filter(o => sectionShops.has(o.shop));

            // ⚠️ 中古住宅専門店は、課の予算・実績の2行を出さない
            if (section.name !== USED_SECTION) {
                rows.push({
                    key: `sec-${section.name}-budget`, id: section.name, level: 'section', first: true, gapBefore: 2, kind: 'budget',
                    heads: [head(section.name, 'section', { rowSpan: 2, color: sectionIndex }), head('予算', 'budget', { second: true })],
                    tds: [...monthArray.map(m => budgetCell(shopsBudget(sectionShops, m, false), shopsBudget(sectionShops, m, true), 1)), budgetCell(shopsBudget(sectionShops, '', false), shopsBudget(sectionShops, '', true), 2)],
                    ranks: RANKS.map(r => contractCell(
                        r === '契約済み' ? (sec?.monthly?.[thisMonthKey] || []) : sectionProspects.filter(o => matchesRank(o, r)),
                        r === '契約済み' ? (sec?.monthly_broker?.[thisMonthKey] || []) : [],
                        { row: 2 })),
                });
                rows.push({
                    key: `sec-${section.name}-result`, level: 'section', first: false, kind: 'result',
                    heads: [head('実績', 'result', { second: true })],
                    tds: [
                        ...monthArray.map(m => contractCell(sec?.monthly?.[m] || [], sec?.monthly_broker?.[m] || [], { lastYear: sec?.lastYearMonthly?.[m] || [], lastYearBroker: sec?.lastYearMonthly_broker?.[m] || [] })),
                        contractCell(sec?.total || [], sec?.total_broker || [], { col: 2, lastYear: sec?.lastYear || [], lastYearBroker: sec?.lastYear_broker || [] }),
                    ],
                    ranks: null,
                });
            }

            if (CONTRACT_DIVISIONS.includes(division)) contractShopRows(section, division, sectionIndex, sectionProspects);
            else usedShopRows(`${section.name}-`);
        });

        if (isUsed && realtyPlace === 'afterUsed') realtyRows();
    });

    if (realtyPlace === 'last') realtyRows();

    return rows;
};
```

## 全文：frontend/src/components/company/CompanyTable.tsx
```tsx
import React, { memo, useEffect, useRef } from 'react';
import { RANKS } from './companyAggregate';
import { dateFormate } from './companyUtils';
import type { Customer, Head, InputCell, NumCell, RowModel } from './companyTypes';

/**
 * 全社報告用フォーマットの表（v2.2.264 で Company.tsx から分けた）。
 *
 * ⚠️ 行とセルの中身は companyAggregate.ts の buildRows が作る。ここは並べるだけ（顧客・予算の配列を探さない）。
 * ⚠️ セルは memo。予算を1つ保存すると行の配列は作り直されるが、文字が変わらないセルは描き直さない。
 * ⚠️ 部品は必ずこのファイルの一番上の階層に置く（以前は Company の中で定義していて、描き直すたびに全セルを作り直していた）。
 */

/** 見出し2列 ＋ 12か月 ＋ 合計・個人目標 ＋ 区切り ＋ ランク5列 */
const COLUMN_COUNT = 2 + 12 + 2 + 1 + RANKS.length;

const sameList = (a: Customer[], b: Customer[]): boolean => a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

type NumProps = { cell: NumCell; showLastYear: boolean; showCancel: boolean; onOpen: (list: Customer[]) => void };

const NumTd = memo(({ cell, showLastYear, showCancel, onOpen }: NumProps) => {
    // ⚠️ 不動産企画係の売上（sales）は押せない（お客様の一覧を持っていない）
    const clickable = cell.tone === 'contract' && cell.list.length > 0;
    const on = cell.active ? ` co_on-${cell.tone === 'budgetFixed' ? 'budget' : cell.tone}` : '';
    return (
        <td rowSpan={cell.rowSpan} colSpan={cell.colSpan} className={`${on}${clickable ? ' co_click' : ''}`}
            onClick={clickable ? () => onOpen(cell.list) : undefined}>
            <div className="co_n">
                {cell.main}
                {cell.broker > 0 && <span className="co_broker">({cell.broker})</span>}
                {showCancel && cell.cancel > 0 && <span className="co_cancel">{cell.cancel}</span>}
                {showLastYear && cell.ly !== null &&
                    <span className="co_ly" style={{ right: `${cell.lyRight}px` }}>
                        {cell.ly}
                        {cell.lyBroker > 0 && <span className="co_broker">({cell.lyBroker})</span>}
                    </span>}
            </div>
        </td>
    );
}, (a, b) =>
    a.showLastYear === b.showLastYear && a.showCancel === b.showCancel && a.onOpen === b.onOpen
    && a.cell.tone === b.cell.tone && a.cell.main === b.cell.main && a.cell.broker === b.cell.broker && a.cell.cancel === b.cell.cancel
    && a.cell.ly === b.cell.ly && a.cell.lyBroker === b.cell.lyBroker && a.cell.lyRight === b.cell.lyRight && a.cell.active === b.cell.active
    && a.cell.colSpan === b.cell.colSpan && a.cell.rowSpan === b.cell.rowSpan && sameList(a.cell.list, b.cell.list));

export type CommitBudget = (period: string, category: string, name: string, value: string) => void;

/**
 * 予算の入力欄。
 * ⚠️ 入力中の文字は欄（useRef）だけが持つ。**欄を離れたとき（または Enter）に保存する**（2026-11-11 の決定）。
 *   以前は1文字ごとに保存し、そのたびに表全体を描き直していた。
 * ⚠️ Esc で入力前の値に戻す。
 * ⚠️ 保存に失敗したときは、Company.tsx が値を元に戻す（cell.value が戻り、下の useEffect が欄も戻す）。
 */
const BudgetInput = memo(({ cell, onCommit }: { cell: InputCell; onCommit: CommitBudget }) => {
    const ref = useRef<HTMLInputElement | null>(null);
    const saved = useRef(cell.value);
    useEffect(() => {
        saved.current = cell.value;
        // ⚠️ 入力中の欄は書き換えない（ほかの欄の保存で表が作り直されても、打っている文字を消さない）
        if (ref.current && document.activeElement !== ref.current) ref.current.value = cell.value;
    }, [cell.value]);

    const commit = () => {
        // ⚠️ 全角の数字は半角にそろえて保存する（全角のままだと合計が NaN になる）
        const value = (ref.current?.value ?? '').normalize('NFKC').trim();
        if (ref.current) ref.current.value = value;
        if (value === saved.current) return;
        saved.current = value;
        onCommit(cell.period, cell.category, cell.name, value);
    };
    return (
        <td colSpan={cell.colSpan} className={`co_in-${cell.tone}`}>
            <input ref={ref} type="text" className="co_in" defaultValue={cell.value} inputMode="decimal"
                aria-label={`${cell.name} ${cell.category === 'shop' ? `${cell.period} の予算` : '個人目標'}`}
                onBlur={commit}
                onKeyDown={(e) => {
                    // ⚠️ 日本語入力の確定の Enter では保存しない
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') { e.currentTarget.value = saved.current; e.currentTarget.blur(); }
                }} />
        </td>
    );
}, (a, b) => a.onCommit === b.onCommit && a.cell.value === b.cell.value && a.cell.name === b.cell.name
    && a.cell.period === b.cell.period && a.cell.category === b.cell.category && a.cell.tone === b.cell.tone && a.cell.colSpan === b.cell.colSpan);

const HeadTd = ({ h }: { h: Head }) => (
    <td rowSpan={h.rowSpan} colSpan={h.colSpan}
        className={`${h.second ? 'co_c2' : 'co_c1'} co_h-${h.variant}${h.color !== undefined ? ` co_col${h.color % 6}` : ''}`}>
        {h.text}
    </td>
);

type RowProps = { row: RowModel; showLastYear: boolean; showCancel: boolean; onOpen: (list: Customer[]) => void; onCommit: CommitBudget };

const Row = ({ row, showLastYear, showCancel, onOpen, onCommit }: RowProps) => (
    <>
        {row.gapBefore &&
            <tr className={`co_gap co_gap${row.gapBefore}`} aria-hidden="true">
                <td colSpan={COLUMN_COUNT} data-label={row.gapLabel ?? ''}></td>
            </tr>}
        <tr id={row.id} data-new={row.isNew ? '1' : undefined}
            className={`co_l-${row.level} co_k-${row.kind}${row.first ? ' co_first' : ''}${row.sticky ? ` co_s${row.sticky}` : ''}`}>
            {row.heads.map((h, i) => <HeadTd key={i} h={h} />)}
            {row.tds.map((td, i) => (td.t === 'input'
                ? <BudgetInput key={i} cell={td} onCommit={onCommit} />
                : <NumTd key={i} cell={td} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} />))}
            <td className="co_sep"></td>
            {row.ranks?.map((cell, i) => <NumTd key={`r${i}`} cell={cell} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} />)}
        </tr>
    </>
);

type Props = {
    rows: RowModel[];
    monthArray: string[];
    targetYear: number | null;
    showLastYear: boolean;
    showCancel: boolean;
    onOpen: (list: Customer[]) => void;
    onCommit: CommitBudget;
};

const CompanyTable = ({ rows, monthArray, targetYear, showLastYear, showCancel, onOpen, onCommit }: Props) => (
    <div className="co_scroll">
        <div className="co_pad">
        <div className="co_card">
            <table className="co_tbl">
                <tbody>
                    <tr className="co_s0">
                        <td colSpan={2} className="co_c1">{Number(targetYear) - 1}/06~{Number(targetYear)}/05</td>
                        {monthArray.map(month => <td className="co_m" key={month}>{dateFormate(month)}</td>)}
                        <td className="co_m">合計</td>
                        <td className="co_m">個人目標</td>
                        <td className="co_sep"></td>
                        {RANKS.map(r => <td className="co_m" key={r}>{r}</td>)}
                    </tr>
                    {rows.map(row => <Row key={row.key} row={row} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} onCommit={onCommit} />)}
                </tbody>
            </table>
        </div>
        </div>
    </div>
);

export default memo(CompanyTable);
```

## 全文：frontend/src/components/company/CompanyToolbar.tsx
```tsx
import React, { memo } from 'react';
import { getYears } from '../../utils/getYears';
import { REALTY_NAME } from './companyAggregate';
import type { Section, Shop } from './companyTypes';

/**
 * 全社報告用フォーマットの上のバー（v2.2.264 で Company.tsx から分けた）。見た目は反響一覧（list）のバーに寄せている。
 *
 * ⚠️ 以前は `position: fixed` で、高さを測って表をずらしていた。いまは表だけが動く並びなので、測らない。
 * ⚠️ 「事業部・課・店舗を選択」は、その行まで表を動かすだけ（絞り込みではない）。
 */

type Props = {
    category: string;
    targetYear: number | null;
    divisionArray: string[];
    sectionList: Section[];
    /** 選べる店舗（まとめ表示で隠れている子店舗は入れない） */
    shops: Shop[];
    showLastYear: boolean;
    showCancel: boolean;
    showMulti: boolean;
    /** 併売店の親子が1つでも設定されているか（無ければ「併売店をまとめる」を出さない） */
    canMerge: boolean;
    onYear: (year: number) => void;
    onJump: (id: string) => void;
    onRanking: () => void;
    onQuarter: () => void;
    onLastYear: () => void;
    onCancel: () => void;
    onMulti: () => void;
};

const CompanyToolbar = ({ category, targetYear, divisionArray, sectionList, shops, showLastYear, showCancel, showMulti, canMerge, onYear, onJump, onRanking, onQuarter, onLastYear, onCancel, onMulti }: Props) => {
    const hasSummary = category === 'order' || category === 'spec';
    const btnClass = `co_btn${category === 'spec' ? ' spec' : ''}`;
    return (
        <div className="co_toolbar">
            <div className="m-1">
                <select className="target" aria-label="期" onChange={(e) => onYear(Number(e.target.value))} value={String(targetYear)}>
                    {getYears().map(year => <option key={year} value={year}>{year}年5月期</option>)}
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="事業部へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">事業部を選択</option>
                    {divisionArray.map(division => <option key={division} value={division}>{division}</option>)}
                    <option value={`${REALTY_NAME}（事業部）`}>{REALTY_NAME}</option>
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="課へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">課を選択</option>
                    {sectionList.map(section => <option key={section.name} value={section.name}>{section.name}</option>)}
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="店舗へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">店舗を選択</option>
                    {shops.map((shop, index) =>
                        <option key={index} value={shop.shop}>{shop.brand === 'KHF' && `${shop.division}_`}{shop.shop}</option>)}
                </select>
            </div>
            {hasSummary && <button type="button" className={btnClass} onClick={onRanking}>契約棟数ランキング</button>}
            {hasSummary && <button type="button" className={btnClass} onClick={onQuarter}>4半期サマリー</button>}
            <label className="co_check"><input type="checkbox" checked={showLastYear} onChange={onLastYear} />昨年実績を表示</label>
            <label className="co_check"><input type="checkbox" checked={showCancel} onChange={onCancel} />キャンセル数を表示</label>
            {canMerge && <label className="co_check"><input type="checkbox" checked={showMulti} onChange={onMulti} />併売店をまとめる</label>}
            <span className="co_note">注文・建売は棟数（緑の括弧は仲介）／中古リノベ・不動産企画係は万円</span>
        </div>
    );
};

export default memo(CompanyToolbar);
```

## 全文：frontend/src/components/company/companyStyle.ts
```tsx
/**
 * 全社報告用フォーマットの見た目（v2.2.264）。クラス名は `co_` で始める（共通の CSS を汚さない）。
 *
 * ⚠️ 階層の見分け方（2026-11-11 の指示：グループ・事業部・課・店舗の区切りが見にくい）
 *   グループ … 上に固定（見出し・グループ予算・グループ実績の3行）
 *   事業部   … 前に広い余白（事業部の名前の帯）＋ 太い線。名前のセルは濃い色で「事業部」の札
 *   課       … 前に余白 ＋ 中くらいの線。名前のセルは課ごとの色で「課」の札
 *   店舗     … 前に細い余白。名前のセルの左に課の色の帯
 * ⚠️ 札と余白の見出しは CSS の ::before で出す（セルの文字に混ぜない。表の文字を比べるテストのため）。
 * ⚠️ 固定する行の高さは 34px に決めてある（2行目・3行目の top がこの高さに合わせてある）。
 */

/** 課の色（名前のセルの背景・帯）。課の並びの順に使う */
const SECTION_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2'];
const SECTION_TINTS = ['#eff6ff', '#ecfdf5', '#fffbeb', '#fef2f2', '#f1f5f9', '#ecfeff'];

const PAGE = '#f4f6f8';

export const COMPANY_STYLE = `
.content.company.co_page { overflow: hidden; background: ${PAGE}; }
.co_toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; padding: 8px 14px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
.co_toolbar > * { white-space: nowrap; flex-shrink: 0; }
.co_toolbar .target { font-size: 13px; }
.co_btn { font-size: 13px; background: #fff; color: #0d6efd; border: 1px solid #0d6efd; border-radius: 6px; padding: 3px 10px; margin: 4px; cursor: pointer; }
.co_btn:hover { background: #0d6efd; color: #fff; }
.co_btn.spec { color: #198754; border-color: #198754; }
.co_btn.spec:hover { background: #198754; color: #fff; }
.co_check { font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; margin: 4px 6px; color: #374151; }
.co_note { font-size: 11px; color: #6b7280; margin-left: auto; padding-right: 4px; }

/* ⚠️ 余白は .co_scroll ではなく中の .co_pad に付ける（.co_scroll に付けると、固定する行・列がその分だけずれて止まる） */
.co_scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
.co_pad { display: flex; justify-content: center; width: max-content; min-width: 100%; box-sizing: border-box; padding: 14px 18px 48px; }
.co_card { width: max-content; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.co_tbl { border-collapse: separate; border-spacing: 0; font-size: 12px; font-variant-numeric: tabular-nums; color: #1f2937; margin: 0; }
.co_tbl td { padding: 4px 6px; height: 30px; text-align: center; vertical-align: middle; background: #fff; border-bottom: 1px solid #eef0f3; border-right: 1px solid #f3f4f6; white-space: nowrap; }
.co_tbl .co_m { min-width: 64px; width: 64px; max-width: 64px; }

/* 左の2列（固定） */
.co_tbl td.co_c1, .co_tbl td.co_c2 { position: sticky; z-index: 10; white-space: normal; line-height: 1.35; border-right: 1px solid #e5e7eb; }
.co_tbl td.co_c1 { left: 0; min-width: 104px; width: 104px; max-width: 104px; }
.co_tbl td.co_c2 { left: 104px; min-width: 104px; width: 104px; max-width: 104px; text-align: left; padding-left: 10px; }
.co_tbl td.co_c1[colspan="2"] { min-width: 208px; width: 208px; max-width: 208px; }

/* 上に固定する3行 */
.co_tbl tr.co_s0 > td, .co_tbl tr.co_s1 > td, .co_tbl tr.co_s2 > td { position: sticky; z-index: 20; height: 34px; }
.co_tbl tr.co_s0 > td { top: 0; background: #f8fafc; color: #475569; font-weight: 600; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; }
.co_tbl tr.co_s1 > td { top: 34px; }
.co_tbl tr.co_s2 > td { top: 68px; border-bottom: 2px solid #cbd5e1; }
.co_tbl tr.co_s0 > td.co_c1, .co_tbl tr.co_s1 > td.co_c1, .co_tbl tr.co_s2 > td.co_c1 { z-index: 30; }
.co_tbl tr.co_s1 > td.co_c1, .co_tbl tr.co_s2 > td.co_c1 { font-weight: 700; letter-spacing: .06em; text-align: center; }

/* 見出しのセル */
.co_tbl td.co_h-budget { color: #b42318; background: #fef3f2; }
.co_tbl td.co_h-result { color: #1d4ed8; background: #eff6ff; font-weight: 600; }
.co_tbl td.co_h-division { background: #111827; color: #fff; font-weight: 700; font-size: 13px; }
.co_tbl td.co_h-section { font-weight: 700; }
.co_tbl td.co_h-shop { font-weight: 600; border-left: 4px solid #cbd5e1; }
.co_tbl td.co_h-division::before, .co_tbl td.co_h-section::before { display: block; width: max-content; margin: 0 auto 3px; font-size: 9px; font-weight: 600; letter-spacing: .1em; border-radius: 3px; padding: 0 6px; line-height: 1.6; }
.co_tbl td.co_h-division::before { content: '事業部'; background: #374151; color: #e5e7eb; }
.co_tbl td.co_h-section::before { content: '課'; background: rgba(15,23,42,.08); color: #334155; }
${SECTION_COLORS.map((c, i) => `.co_tbl td.co_h-section.co_col${i} { background: ${SECTION_TINTS[i]}; border-left: 4px solid ${c}; }
.co_tbl td.co_h-shop.co_col${i} { border-left-color: ${c}; }`).join('\n')}

/* 区切り（まとまりの最初の行の上の線） */
.co_tbl tr.co_l-division.co_first > td { border-top: 3px solid #111827; }
.co_tbl tr.co_l-section.co_first > td { border-top: 2px solid #64748b; }
.co_tbl tr.co_l-shop.co_first > td { border-top: 1px solid #94a3b8; }
.co_tbl tr.co_l-division.co_k-result > td, .co_tbl tr.co_l-section.co_k-result > td { border-bottom: 1px solid #cbd5e1; }
.co_tbl tr.co_l-shop.co_k-result > td { border-bottom: 1px solid #cbd5e1; }

/* 余白の行（事業部・課・店舗の前） */
.co_tbl tr.co_gap > td { background: ${PAGE}; border: 0; padding: 0; height: 5px; }
.co_tbl tr.co_gap.co_gap2 > td { height: 14px; }
.co_tbl tr.co_gap.co_gap3 > td { height: 40px; vertical-align: bottom; text-align: left; }
.co_tbl tr.co_gap.co_gap3 > td::before { content: attr(data-label); position: sticky; left: 4px; display: inline-block; padding: 0 0 6px 2px; font-size: 14px; font-weight: 700; color: #111827; letter-spacing: .06em; }
.co_tbl td.co_sep { background: ${PAGE}; border: 0; min-width: 14px; width: 14px; max-width: 14px; padding: 0; }

/* 数字のセル */
.co_n { position: relative; }
.co_tbl td.co_on-contract { color: #1d4ed8; background: #eff6ff; font-weight: 600; }
.co_tbl td.co_on-budget { color: #b42318; background: #fef3f2; }
.co_tbl td.co_on-sales { color: #0f766e; background: #f0fdfa; font-weight: 600; }
.co_tbl td.co_click { cursor: pointer; }
.co_tbl td.co_click:hover { background: #dbeafe; text-decoration: underline; }
.co_tbl tr.co_k-staff:hover > td:not(.co_on-contract):not(.co_on-sales):not(.co_c1):not(.co_sep) { background: #fafafa; }
.co_broker { color: #198754; margin-left: 3px; }
.co_cancel { background: #ef4444; color: #fff; padding: 0 4px; font-size: 8px; border-radius: 8px; margin-left: 3px; font-weight: 600; }
.co_ly { position: absolute; top: 9px; font-size: 8px; background: #f1f5f9; min-width: 15px; height: 15px; line-height: 15px; border-radius: 8px; color: #64748b; font-weight: 400; padding: 0 2px; }

/* 予算の欄（欄を離れたときに保存する） */
.co_tbl td.co_in-shop { background: #fef3f2; }
.co_in { width: 46px; height: 22px; text-align: center; border-radius: 5px; color: #b42318; font-size: 12px; background: transparent; border: 1px solid transparent; outline: none; }
.co_in-shop .co_in:hover { border-color: #fda29b; }
.co_in-staff .co_in { border: 1px dashed #e5e7eb; }
.co_in-staff .co_in:hover { border-color: #fda29b; }
.co_in:focus { background: #fff; border: 1px solid #f97066; box-shadow: 0 0 0 2px rgba(249,112,102,.2); }

@media screen and (max-width: 768px) {
  /* ⚠️ スマホでは上のバーを出さない（以前と同じ） */
  .co_toolbar { display: none; }
  .co_pad { padding: 6px 4px 30px; }
  .co_tbl { font-size: 9px; }
  .co_tbl .co_m { min-width: 40px; width: 40px; max-width: 40px; }
  .co_tbl td { padding: 2px 3px; }
  .co_tbl td.co_c1, .co_tbl td.co_c2 { min-width: 64px; width: 64px; max-width: 64px; }
  .co_tbl td.co_c2 { left: 64px; padding-left: 4px; }
  .co_tbl td.co_c1[colspan="2"] { min-width: 128px; width: 128px; max-width: 128px; }
  .co_in { width: 30px; font-size: 9px; }
}
`;
```

## 全文：frontend/src/components/company/companyTypes.ts
```tsx
/**
 * 全社報告用フォーマット（会社実績）の型（v2.2.264 で Company.tsx から分けた）。
 *
 * ⚠️ 集計（companyAggregate.ts）が「行の配列」を作り、表（CompanyTable.tsx）はそれを並べるだけにしている。
 *   描くときに顧客や予算の配列を探さない（以前はセルごとに探していて遅かった）。
 */

export type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };

/**
 * 店舗。
 * ⚠️ `parent_shop` は併売店（multi = 1）の親店舗名。運用側が手作業で設定する。
 *   ⚠️ 未設定なら null。**親店舗自身も null** である（自分を指さない）。
 *   列の追加: backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql
 */
export type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number, parent_shop: string | null };
export type Section = { name: string, division: string };
export type Customer = Record<string, string>;
export type Achievement = { category: string, name: string, period: string, value: string };
/** 不動産企画係の商談案件（② の company が返す数字と担当だけ。v2.2.264） */
export type RealtyDeal = Record<string, unknown>;

/** 数字のセル（契約数・粗利・売上・予算の合計）。⚠️ 表示する文字まで集計の時点で決めておく */
export type NumCell = {
    t: 'num';
    /**
     * contract … 数があれば青（押せる）／ budget … 数があれば赤 ／ budgetFixed … いつも赤 ／ sales … 不動産企画係の売上（押せない）
     */
    tone: 'contract' | 'budget' | 'budgetFixed' | 'sales';
    main: string;
    /** 仲介（建売）。0 なら出さない */
    broker: number;
    /** 解約。0 なら出さない（「キャンセル数を表示」のときだけ出す） */
    cancel: number;
    /** 昨年実績（「昨年実績を表示」のときだけ出す）。null なら出さない */
    ly: string | null;
    lyBroker: number;
    /** 昨年実績の丸の位置（右からの px） */
    lyRight: number;
    /** 押したときに顧客詳細に出す顧客（空なら押せない） */
    list: Customer[];
    active: boolean;
    colSpan: number;
    rowSpan: number;
};

/** 予算の入力欄（店舗の月ごとの予算・担当の個人目標） */
export type InputCell = {
    t: 'input';
    /** 店舗の予算の行（赤い背景）か、担当の個人目標か */
    tone: 'shop' | 'staff';
    category: 'shop' | 'staff';
    name: string;
    period: string;
    value: string;
    colSpan: number;
};

export type Td = NumCell | InputCell;

/** 行の左の見出し（事業部・課・店舗の名前、担当名・予算・実績） */
export type Head = {
    text: string;
    rowSpan: number;
    colSpan: number;
    /** division・section・shop … 事業部・課・店舗の名前のセル ／ name … 担当名 ／ budget・result … 予算・実績の見出し */
    variant: 'division' | 'section' | 'shop' | 'name' | 'budget' | 'result';
    /** 課の色（0〜5。課・店舗の名前のセルの左の帯） */
    color?: number;
    /** 2列目（固定する位置が違う） */
    second?: boolean;
};

export type RowLevel = 'group' | 'division' | 'section' | 'shop';

export type RowModel = {
    key: string;
    /** 上のバーの「事業部・課・店舗を選択」で移る先 */
    id?: string;
    level: RowLevel;
    /** そのまとまりの最初の行（上に区切りの線を引く） */
    first: boolean;
    /** 上に固定する行（グループ予算 = 1、グループ実績 = 2） */
    sticky?: 1 | 2;
    /** 行の種類（色分けに使う） */
    kind: 'budget' | 'result' | 'staff';
    heads: Head[];
    tds: Td[];
    /** ランクの5列（null の行は、上の行のセルが2行ぶん） */
    ranks: NumCell[] | null;
    /** この行の前に空ける余白（事業部 = 3、課 = 2、店舗 = 1） */
    gapBefore?: 1 | 2 | 3;
    /** 余白の行に出す見出し（事業部の名前） */
    gapLabel?: string;
    /** v2.2.264 で足した行（不動産企画係の事業部）。⚠️ 以前の表と比べるテストで見分けるための印 */
    isNew?: boolean;
};
```

## 全文：frontend/src/components/company/CustomerDetail.tsx
```tsx
import React from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';
import { CustomerName } from '../../utils/deletedCustomer';
import { CUSTOMER_CATEGORY } from './companyAggregate';

type Customer = Record<string, string>;

type Props = {
    show: boolean,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    contract: Customer[],
    setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    /** ログイン中の事業（order / spec / used / realty） */
    category: string
};

const idMapping: Record<string, string> = {
    '注文': 'order',
    '建売': 'kaeru',
    '中専': 'resale'
};

const CustomerDetail = ({ show, setShow, contract, setEditId, category }: Props) => {
    const modalClose = async () => {
        setShow(false);
    };
    const categoryValue = contract[0]?.category ?? '';
    return (
        <>
            <Modal show={show} onHide={modalClose}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '12px' }}>顧客詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td>契約日</td>
                                <td>お客様名</td>
                                <td>{categoryValue === '中専' ? '担当営業' : '担当店舗'}</td>
                                <td>{categoryValue === '中専' ? '粗利額' : '担当営業'}</td>
                            </tr>
                            {contract.map((c, index) => {
                                const contractDate = categoryValue === '中専' ? (c.contract_reform || c.contract_buy || c.contract_sell || '-')
                                    : c.contract || c.contract_broker || '-';
                                return <tr key={index}>
                                    <td>{contractDate}</td>
                                    {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
                                    <td><CustomerName row={c} onClick={() => {
                                        // ⚠️ v2.2.264: ほかの事業の顧客は開かない（2026-11-11 の指示。ログイン中の事業と、顧客の事業が違うとき）
                                        //   ⚠️ 見た目の入口。編集画面のデータの権限は、それぞれの画面と ② が確かめる
                                        if (CUSTOMER_CATEGORY[c.category] !== category) {
                                            alert('閲覧権限がありません');
                                            return;
                                        }
                                        setEditId(prev => ({
                                            ...prev,
                                            [idMapping[c.category]]: c.id
                                        }));
                                    }}>{c.customer} 様</CustomerName>
                                        {c.contract_broker && <span className='bg-success text-white rounded px-1 ms-1' style={{fontSize: '9px'}}>仲介</span>}</td>
                                    <td>{categoryValue === '中専' ? c.staff || '-' : c.shop}</td>
                                    <td>{categoryValue === '中専' ? `${c.contraction_contract_price || '-'}万円` : c.staff}</td>
                                </tr>
                            }
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal></>
    )
}

export default CustomerDetail
```

## 全文：frontend/src/components/company/companyUtils.ts
```tsx
export const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : ''
};

export const monthFormate = (date: string) => {
    return date ? date.replace(/\//g, '-').slice(0, 7) : ''
};

export const lastYearMonthFormate = (date: string, type: string) => {
    if (!date) return '';
    if (type === '-') {
        const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
        return `${Number(year) - 1}-${month}`;
    }
    if (type === '/') {
        const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
        return `${Number(year) - 1}/${month}`;
    }
};

const today = new Date();

export const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
```

## 分ける前の Company.tsx は git の履歴を参照（`git show origin/main:frontend/src/components/company/Company.tsx`。1,249行）
