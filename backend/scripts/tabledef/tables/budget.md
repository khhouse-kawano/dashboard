---
table: budget
title: 販促費・広告費
business: common
source: 改修
---
販促費・広告費の明細。1行が「1か月 × 1店舗 × 1媒体」の1伝票（同じ組み合わせが複数行あってよい）。
書くのは ② budgetTable.ts（ヘッダー「システム管理 → 予算テーブル」の CSV 追加。Master・BrandAdmin）と ② eventBudget.ts（イベント費用の入力。medium = 'イベント'）。
読むのは顧客・店舗別反響推移・反響推移・予算シミュレーター・イベント集計・Claudeによる分析（adspend）・経理の予算画面（① budget_accounting.php）など。広告費の集計はほぼ `response_medium = 0 AND section = ?` で絞る。
⚠️ UNIQUE キーが無い。同じ CSV を2回入れると2組になる（画面の確認で数を出すだけで、登録は止めない）。
⚠️ 「販管・広告費」は category の MKT（広告費）と PR（販促費）の合計。画面の「販促媒体別広告費」は MKT だけ。⚠️ 当月分は登録が遅れる。
⚠️ 見出しの文字（category・company・section など）がそのまま値に入った行が1行ある（CSV の見出しを取り込んだもの。推定）。

## 列
- id: 連番
- budget_period: 計上月（text。'2026/10/01' の形。⚠️ '2025/12/1' のように0の無い値もある）。月は先頭7文字で比べる
- shop: 店舗名（shop_list.shop）。建売は課の単位（宮崎係 など）で入っている行がある
- medium: 販促媒体（medium_list.medium。例 SUUMO・イベント）。⚠️ 建売は medium_list に無い名前（ネット など）が多い
- budget_value: 金額（円）。⚠️ 返金・修正の負の値もある
- note: 件名（イベント費用入力の「タイトル」）
- company: 請求先（取引先の会社名）
- remarks: 詳細（メモ）。v2.2.243 で company の括弧書きをここへ移した
- response_medium: 1 = 反響媒体（看板・CM/ラジオなど、反響の経路として数えるもの）。広告費の集計は 0 の行だけを使う
- category: MKT = 広告費（ポータル・チラシ・SNS広告・来場特典など） / PR = 販促費（CM/ラジオ・看板・販促物・システム利用料など）
- section: 事業。order 注文 / spec 建売 / use 中古（⚠️ used ではなく use）。空の行はどの集計にも出ない
- order_section: 課（section_list.name。例 鹿児島営業1課・不動産営業1課）
