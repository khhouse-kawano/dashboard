# 物件DB（property_db）とポータルの物件データ（v2.2.301 の検討）

## 結論
ポータルの物件データ（SUUMO・HOME'S・at home の summary）**だけ**では、物件DB の代わりにはならない。
物件DB（いえらぶ）を元にしたまま、**ポータルのデータで補う**作りにした（v2.2.301 の `property_db_portal`）。

理由
1. **ポータルに載っている物件しか無い**。掲載前・掲載を止めた物件・いえらぶにしか無い物件（ポータルに出さない物件）が消える。物件DB の「契約済みの物件を表示」（最新の取得日で無くなった物件）も作れなくなる。
2. **いえらぶにしか無い項目がある**。担当（property_staff）・取引態様（transaction_type）・取扱（agency）・構造・用途地域・掲載先の指示・期限など。画面の「担当」「取扱」「自社物件を表示」「店舗」の絞り込みがこれを使う。
3. **3つのポータルで項目の書き方が違う**（下の対応表）。物件ごとに「どのポータルの値を使うか」を決める必要があり、同じ物件でも値がずれる（例：HOME'S の「48年」は築年数、いえらぶの「1978年12月」は建築年月）。
4. **summary の表はアカウントの列を持たない**（建売と中古の行が1つの表に混ざる）。どの店舗の物件かは、物件DB の店舗名か、送ってきたアカウントでしか分からない。

## 物件の結び付け（共通の番号）
いえらぶの6桁の物件番号（`property_db.property_id`、UNIQUE）が、どのポータルにも入っている。

| ポータル | 列 | 例 | いえらぶの番号との関係 |
|---|---|---|---|
| SUUMO | `suumo_resale_summary.management_no`（貴社物件管理NO） | 241105 | そのまま |
| SUUMO | `suumo_resale_summary.bulk_upload_code`（一括入稿物件コード） | 1503190000241105 | 末尾6桁（使っていない） |
| HOME'S | `homes_summary_db.company_management_number`（自社管理番号） | 271232 | そのまま |
| at home | `athome_summary_db.management_no`（管理番号） | 355050000271232 | `355050000`＋6桁 |

- ポータル独自の番号（HOME'S の property_id、at home の property_no）は、いえらぶの番号と関係しない。
- ⚠️ `355050000` と6桁は決め打ち。いえらぶの番号が7桁になる・at home の会社コードが変わると結べなくなる（結べない行は飛ばして数を返す）。
- ローカルの DB（2026-11-25 時点の本番の写し）では、SUUMO 696件・HOME'S 787件・at home 783件のうち、物件DB に無い番号は HOME'S 4件・at home 5件だけ（at home の1件は番号の形が違う）。

## 列の対応（補うのに使っている列）
| 物件DB の列 | いえらぶの例 | SUUMO | HOME'S | at home |
|---|---|---|---|---|
| address（住所） | 鹿児島県鹿児島市西千石町6-30 | address（同じ） | address（同じ） | address |
| property_name（物件名） | 西千石町第七トーカンマンション(公開) | （basic_info の中。取り出さない） | property_name | building_name |
| room_number（部屋番号） | 605(非公開) | — | room_section | — |
| layout（間取り） | 4DK | （catch_and_layout の文の中） | layout | — |
| building_area（面積） | 壁芯67.99㎡ | — | exclusive_area（67.99）→「67.99㎡」 | — |
| transportation（交通） | 鹿児島市電１系統「高見馬場」駅 徒歩5分 | （station_detail に徒歩が無い） | railway_line・station・walk_minutes → 「路線「駅」駅 徒歩5分」 | line_station |
| price（価格） | 900万円 | min_price（円）→「900万円」 | price_rent（900万）→「900万円」 | price_man_yen（万円）→「1480万円」 |
| price_raw（価格の履歴） | [{"date":"2026/11/24","value":"9000000"}] | min_price | price_rent×10000 | price_man_yen×10000 |

使っていない列
- 築年：HOME'S の construction_year は「48年」（築年数）、いえらぶは「1978年12月」。書き方が違う。
- 種別：HOME'S・at home は「マンション」、いえらぶは「中古マンション」。言葉が違う。
- 担当・取引態様・取扱など：ポータルに無い。

## 書き換えの決まり（2026-11-25 の決定：b）
- 物件DB にある物件：**空の列（NULL か ''）だけ**埋める。値の入っている列は上書きしない（いえらぶを正とする）。価格の履歴も、空のときに1件目を入れるだけ。
- 物件DB に無い物件：送ってきたアカウントの店舗で作る（SUUMO・at home の kaeru／HOME'S の spec → 本店、resale／used → 中古住宅専門店）。
  - 取得日（registered）は、その店舗の今の最新の取得日にする（今日にすると、ほかの物件がすべて「契約済み」に見える）。
- 番号の無い行では物件を作らない（重複する。realty-handoff.md の決まり）。

## 流れ
```
sync（Heroku）の summary の処理（suumo_summary(_2)・homes_summary(_2)・athome_summary(_2)）
  1. 今までどおり ① の summary（suumo_db_resale_summary・homes_summary_db・athome_db_summary）へ送る
  2. 同じ行を ② の property_db_portal へ送る（合い言葉 SYNC_LOG_SECRET。500件ずつ）
       → ② が物件DB の空の列を埋め、無い物件を作る
```
- 2 が失敗しても 1 の結果は変わらない（失敗は sync のエラーメールに出る）。

## これからの課題（今回はやっていない）
- いえらぶの取り込みが手作業（CSV）になったので、いえらぶに載せずポータルに載せた物件は、v2.2.301 から物件DB に加わる。担当・取扱は空なので、「店舗」「自社物件を表示」の絞り込みには出ない。
- SUUMO の物件名・間取りは、文の中（basic_info・catch_and_layout）にしか無いので取り出していない。決まった形で取り出せるか、実際の書き出しで確かめてから足す。
