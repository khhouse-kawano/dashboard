# アンバサダー反響フォーム（kh-house.jp）との取り決め

公開フォームから ② VPS の Express へ直接 POST される反響の仕様。

⚠️ **フォームのソースはこのリポジトリに入っていない。**
別サイト（`https://kh-house.jp/ambassador/`）の静的ファイルであり、
型チェックでもテストでも壊れたことを検出できない。
以下のどれかを変えるときは、必ず両方を同時に直すこと。

---

## 経路

```
[顧客のブラウザ]
  https://kh-house.jp/ambassador/?id=<ambassador_list.no>
        │  POST（JSON）※ ① レンタルサーバーを経由しない
        ▼
[② VPS]  https://api.khg-marketing.info/api/gateway
        │  request: "ambassador_inquiry" / 認証なし
        ▼
  inquiry_ambassador テーブル（sync = 0 で保存）
        │
        ▼
[ダッシュボード]  ヘッダー > アンバサダー反響一覧
        │  担当店舗を設定 →「同期」
        ▼
  master_data（注文事業の顧客）
```

⚠️ **① を経由しない。** この機能は Express のみで実装しており、
① に PHP ハンドラは存在しない（作ってもいけない。二重登録の原因になる）。

---

## 送信されるJSON

| キー | 由来（フォームの入力欄） | 保存先の列 | 加工 |
|---|---|---|---|
| `request` | 固定値 `"ambassador_inquiry"` | — | 必須。無いと 400 |
| `id` | URL の `?id=` | `ambassador_id`（生の値） | 台帳に実在すれば `ambassador_no` にも入る |
| `name` | お名前 | `name` | ⚠️ 空なら 400 |
| `kana` | ふりがな | `kana` | |
| `zip` | 郵便番号 | `zip` | 数字7桁ならハイフンを外す |
| `address` | ご住所 | `address` | |
| `area` | **建築希望地** | `build_area` | ⚠️ `address` とは別物 |
| `mail` | メールアドレス | `mail` | |
| `phone` | 電話番号 | **`mobile`** | ⚠️ 列名が違う |
| `insta` | インスタアカウント | `account` | 先頭の `@` を外す |
| `agree` | 進呈条件への同意 | `agreed` | `true` → 1 |

⚠️ `mail` と `phone` が**両方とも空なら 400**。連絡が取れない反響を溜めないため。

⚠️ `shop` / `staff` / `sync` / `master_data_id` は**受け付けない。**
送っても無視される。受け付けると「同期済み」に偽装され、追客から消える。

### 応答

| 状況 | HTTP | 本文 |
|---|---|---|
| 成功 | 200 | `{"status":"ok"}` |
| 入力不備 | 400 | `{"status":"error","message":"..."}` |
| 連投 | 429 | `{"status":"error","message":"..."}` |
| 障害 | 500 | `{"status":"error","message":"..."}` |

⚠️ **成功は `status: "ok"`（`"success"` ではない）。**
フォームの `handleResult()` はこの両方を成功として扱うようにしてある。
片方だけを見る実装に戻すと、DBには保存されているのに画面はエラーになる
（最も気づきにくい壊れ方）。

⚠️ 採番した `no` は返さない。返すと連番から反響の総数を推測されうる。

---

## `ambassador_id` と `ambassador_no` の違い

| 列 | 中身 | 信用してよいか |
|---|---|---|
| `ambassador_id` | URL の `?id=` を**そのまま**保存した値 | ❌ 誰でも書き換えられる |
| `ambassador_no` | 上を `ambassador_list` に照合し、実在を確認できたときだけ入る | ✅ 集計・JOIN はこちらだけ |

⚠️ 照合できなくても**反響は保存する。** URL から id が落ちただけの
正当な反響を失わないため。画面側は「台帳に未登録」と警告表示する。

---

## 防御

このシステムで唯一の「認証なしの書き込み口」であるため、3段で守っている。
**どれか1つでも外すと穴になる。**

1. `middlewares/publicFormRateLimit.ts` — IP単位で 10分に5件まで
2. `features/ambassador/inquiry.ts` — 全項目の検証・長さ上限・制御文字の除去
3. CORS（`CORS_ORIGINS`）— `https://kh-house.jp` のみ

⚠️ **CORS はブラウザの仕組みであり、curl には効かない。**
「このドメインからしか送れない」という防御にはならない。
実効的な防御は 1 と 2、最後の砦は反響一覧での人の目視。

⚠️ `GATEWAY_REQUIRE_AUTH=true`（`'none'` にも認証を要求する一括強化モード）を
有効にすると、**このエンドポイントも 401 になり反響が止まる。**
有効化するときは、ここを例外にする仕組みを先に入れること。

---

## 店舗・担当営業のマスタ（`ambassador_master`）

台帳と反響一覧の両方で、担当の割り当てに使う選択肢。

| 種別 | 取得元 | 条件 |
|---|---|---|
| 店舗 | `shop_list` | `report_flag = 1` |
| 担当営業 | `staff_list` | `category = 1`（営業職）＋ **画面側で当年度に絞る** |

⚠️ **既存の `shop_list` API（`show_flag = 1`）を流用してはいけない。**
実データに `report_flag = 1` かつ `show_flag = 0` の店舗が存在する（ローカルで5件）。
流用するとその店舗が選択肢から黙って消え、担当を割り当てられない反響が生まれる。

⚠️ 年度（`period`）の絞り込みは**画面側**で行う（`String(period) === String(今年)`）。
サーバー側でも絞ると二重になり、年度替わりで誰も出てこないときの
原因の切り分けができなくなる。

⚠️ 担当営業は**店舗を選ぶまで選べない。** 全店の担当者を出すと、
別店舗の営業を割り当ててしまう。店舗を変えたときは、その店舗に居ない
担当営業を自動で外している（外さないと画面上は正しく見えたまま食い違う）。

⚠️ 保存済みの担当者が候補に無いことがある（異動・退職・年度替わり）。
その場合は保存済みの値を候補に補って表示する。補わないと select の値が空になり、
次にその行を触った瞬間に担当が消えたように見える。

## アンバサダー専用LPのURL

`https://kh-house.jp/ambassador/?id=<ambassador_list.no>`

⚠️ **`?id=` である（`/id=` ではない）。** クエリ文字列なので `?` が要る。
`/id=1` にすると LP 側の `URLSearchParams` が id を拾えず、
どのアンバサダー経由か分からない反響として届く。**送信自体は成功するため気づけない。**

⚠️ アンバサダーごとに異なるURL。取り違えて配布すると、その紹介の成果が
別のアンバサダーに計上される。台帳のコピーボタンから取ること。

## Instagram リンク

`account` 列（ハンドル名）から `https://www.instagram.com/<account>/` を組み立てる。
専用の列は持たない。

⚠️ ハンドル名として不正な文字が含まれる行はリンクを出さない。
そのままURLに埋めると、まったく別のアカウントや外部サイトへ飛ぶリンクを
社内画面に作ってしまう。

---

## 変更したときのチェック項目

- [ ] フォームの `key` を変えた → `features/ambassador/inquiry.ts` の対応する `body.xxx`
- [ ] 列を増やした → SQL・`inquiry.ts` の INSERT・`InquiryAmbassador.tsx` の型と列
- [ ] 送信先ドメインを変えた → `.env.prod` の `CORS_ORIGINS`（② の再作成が必要）
- [ ] 応答の形を変えた → フォームの `handleResult()`

## 関連ファイル

| 場所 | ファイル |
|---|---|
| ② API | `backend-express/src/features/ambassador/inquiry.ts` |
| ② マスタ | `backend-express/src/features/ambassador/master.ts`（`ambassador_master`） |
| ② 登録 | `backend-express/src/gateway/registry.ts`（`ambassador_inquiry`） |
| ② 流量制限 | `backend-express/src/middlewares/publicFormRateLimit.ts` |
| DB | `backend/scripts/sql/2026-09-03_ambassador.sql` / `2026-09-04_ambassador_inquiry.sql` |
| 画面 | `frontend/src/components/header/InquiryAmbassador.tsx` / `AmbassadorList.tsx` |
| 画面（共通） | `frontend/src/components/header/useAmbassadorMaster.ts` / `ambassadorLinks.ts` |
| フォーム | ⚠️ **リポジトリ外**（`国分ハウジングで叶える夢のおうち_修正01_フォルダー/form.js`） |
