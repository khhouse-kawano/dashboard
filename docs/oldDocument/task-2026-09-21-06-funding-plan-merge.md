# 指示（2026-09-21）　資金計画書の改修版の反映と「デジシキ作成」の開放

⚠️ 依頼（`ReadMeClaude.md`）:
> - `C:\Users\shinji-kawano\Downloads\AIデジタル資金計画書.html` の改修版が届いたので Dashboard への反映
> - `InformationEdit.tsx` の **デジシキ作成** を全ユーザーに開放 => KH久留米店のみの指定を外す

---

## 変更・追加したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/public/funding-plan/` | ⚠️ **`index.html`** | ⚠️ **改修版へ差し替え＋連携を当て直し** |
| `frontend/src/components/information/` | `InformationEdit.tsx` | ⚠️ **`canUseFundingPlan` を削除** |
| `backend-express/src/features/fundingPlan/` | `columns.ts` | ⚠️ **`w_dates` を JSON 列に追加** |
| `backend/scripts/sql/` | ⚠️ **`2026-09-21_funding_plan_w_dates.sql`（新規）** | ⚠️ **列の追加** |

⚠️ ⚠️ **① の PHP は触っていない**（`funding_plan` は Express 専用で、PHP ハンドラを作ってはいけない）。

---

## ⚠️ 1. 資金計画書の改修版の反映

### ⚠️ 単純な差し替えはできない

⚠️ 届いた HTML は ⚠️ **原本（localStorage 版）の改修版**で、⚠️ **Dashboard 連携が入っていない。**

| | 現行（連携版） | ⚠️ 届いた改修版 |
|---|---|---|
| 行数 | 3,363 | 3,247 |
| 保存先 | ⚠️ **DB（`funding_plan`）** | ⚠️ **localStorage** |
| 顧客の指定 | ⚠️ **URL の `?id=`** | ⚠️ 画面上のセレクトで切替 |
| 「＋ 新規作成」「複製保存」 | ⚠️ **非表示** | あり |
| 顧客台帳への書き戻し | ⚠️ **`TOUCHED` で追跡** | 無し |

⚠️⚠️ **そのまま上書きすると、保存が端末のブラウザに戻り、他の営業から見えなくなる。**

### 作業方針

⚠️⚠️ **改修版を土台にして、連携のぶんを当て直した**（⚠️ 逆向きにすると新機能が落ちる）。

⚠️ 機械的に行うため、⚠️ **現行と改修版の diff のハンク単位で「戻す側」だけを選んで適用**した
（⚠️ 手で写すと落とす）。⚠️ **当て直した箇所は20。**

| # | 箇所 | 内容 |
|---|---|---|
| 1 | `#custSel` | ⚠️ `disabled` に戻す |
| 2〜3 | ヘッダーのボタン | ⚠️ **「＋ 新規作成」「複製保存」を外す** |
| 4 | `DEF()` の直後 | ⚠️ **`TOUCHED` / `touch()`** |
| 5〜7 | `addRow` / `setK` / `delKid` / `onInput` | ⚠️ `touch()` の呼び出し |
| 8 | `loanSaveMaster()` | ⚠️ **no-op に戻す**（金利は顧客ごとに持つ） |
| 9 | `db()` 一式 | ⚠️ **`API` / `apiPost` / `CUSTOMER_ID` / `PLAN_EXISTS` に置換** |
| 10 | — | ⚠️ `fatal()` |
| 11 | `refreshList()` | ⚠️ **1件だけ表示** |
| 12〜14 | `saveCustomer()` | ⚠️ **API 版に**（⚠️ `touched` を送る） |
| 15 | `newCustomer` / `saveAsCustomer` / `loadCustomer` | ⚠️ **削除** |
| 16 | `delCustomer()` / `bootLoad()` | ⚠️ **API 版に** |
| 17〜19 | `exportJson` / `importJson` | ⚠️ **開いている1顧客だけ**に |
| 20 | 起動処理 | ⚠️ **`bootLoad();` に**（`custSel` の change 等を外す） |

### ⚠️ 改修版で増えた機能（⚠️ **そのまま残した**）

| # | 内容 |
|---|---|
| 1 | ⚠️ **STEP2〜7 の予定日をカレンダーで直接指定**（`w_dates` / `setFlowDate` / `flowDateCell`） |
| 2 | ⚠️ **入力中にフォーカスが外れない**ようにした3か所（`setD` / `setLd` / `updateFlowDates`） |
| 3 | ⚠️ 全角数字の自動変換（`toHankakuNum` / `numOnly`） |
| 4 | `renderSteps()` の分離、CSS 2行（`input.numonly` / `input.fdate`） |

### ⚠️ 判断したこと

⚠️⚠️ **`calc()` の末尾から `renderLands()` が外れているのは改修版に合わせた。**

| | 現行 | ⚠️ 改修版（採用） |
|---|---|---|
| `calc()` 末尾 | `paint(); renderFlow(); renderLoans(); renderLands();` | `paint(); updateFlowDates(); renderLoans();` |

⚠️ `setLd()` が ⚠️ **連動するセルだけを直接書き換える**ようになったため、表ごとの再描画は不要になった。
⚠️ ⚠️ **⑧土地検索の表が更新されない不具合が出たら戻すこと。**

---

## ⚠️⚠️ 見つけた問題: `w_dates` の列が無かった

⚠️⚠️ **改修版の目玉である「予定日の直接指定」は、そのままでは保存されない。**

⚠️ `funding_plan` テーブルに ⚠️ **`w_dates` 列が存在しない**。

```
w_start   date
w_days    longtext
w_done    longtext
          ⚠️ w_dates が無い
```

⚠️⚠️ **許可リスト（`columns.ts`）は「列として存在するものだけ」を採用する**ため、
⚠️ ⚠️ **保存は成功するのに予定日だけ消える。** ⚠️ **エラーは出ない。**

⚠️ 面談中に入力した予定日が、開き直すと消えている状態になる。

### 対応

⚠️ **SQL**（`backend/scripts/sql/2026-09-21_funding_plan_w_dates.sql`）

```sql
ALTER TABLE funding_plan
  ADD COLUMN w_dates LONGTEXT DEFAULT NULL
  COMMENT '⑨段取り表 STEP2〜7の予定日。FLOWと同じ長さの配列。空文字なら日数から自動計算';
```

⚠️ **許可リスト**（`backend-express/src/features/fundingPlan/columns.ts`）

```ts
export const JSON_COLUMNS = [
  'kids', 'k_trigger', 's1', 's2', 's3', 's4', 's5', 'loans', 'w_days', 'w_done',
  // ⑩ 土地検索の候補地メモ（2026-09-10 追加）
  'lands',
  /**
   * ⑨ 段取り表で、STEP2〜7 の予定日を直接指定したもの（2026-09-21 追加）。
   *
   * ⚠️⚠️ **`w_days`（日数）とは別物である。**
   *   ⚠️ STEP2〜7 は日数ではなく**日付そのもの**を選ぶ方式に変わった。
   *   ⚠️ 空文字のときだけ日数からの自動計算に戻る（画面の `flowDates()`）。
   *
   * ⚠️ 列が無いと ⚠️ **保存は成功するのに予定日だけ消える**（無視されるため）。
   *   ⚠️ `backend/scripts/sql/2026-09-21_funding_plan_w_dates.sql` を先に流すこと。
   */
  'w_dates',
] as const;
```

⚠️ **読み込み側**（`funding-plan/index.html` の `bootLoad()`）

```js
    /* ⚠️ 2026-09-21 に w_dates（⑨段取り表の予定日）を足した。
         ⚠️ 配列なので必ずここに入れること。⚠️ 落とすと null で上書きされ、
           setFlowDate() が S.w_dates[i] に代入するところで例外になる。 */
    var JSON_KEYS = ["kids","k_trigger","s1","s2","s3","s4","s5","loans","lands","w_days","w_done","w_dates"];
```

⚠️⚠️ **3か所すべてが要る。** ⚠️ どれか1つでも欠けると予定日が消える。

---

## ⚠️ 2. 「デジシキ作成」を全ユーザーに開放

### 削除した関数（`InformationEdit.tsx`）

```tsx
    const canUseFundingPlan = useMemo(() => {
        if (authority === 'Master') return true;
        return staffArray.some(item =>
            item.name === userName &&
            item.period === String(thisYear) &&
            item.shop === 'KH久留米店'
        );
    }, [authority, staffArray, userName, thisYear]);
```

⚠️ ⚠️ **判定ごと削除した。** ⚠️ 条件を `true` にするだけだと「なぜ残っているのか」が分からなくなるため。

⚠️ `useMemo` の import も外した（⚠️ このファイルで唯一の使用箇所だった）。

### 表示側

```tsx
                              ⚠️⚠️ **2026-09-21 に全ユーザーへ開放した**（指示）。
                                ⚠️ それまでは `canUseFundingPlan` で
                                  **開発者権限（Master）と KH久留米店の担当者**だけに
                                  出していた。⚠️ その判定ごと削除してある。
                                ⚠️ **店舗や権限で再び絞るなら、ここに条件を戻すこと。**
                                  ⚠️ 開く先（funding-plan/index.html）には権限の判定が無く、
                                    `?id=` を知っていれば誰でも開ける。
                                    ⚠️ **絞るならサーバ側（features/fundingPlan/）にも要る。**
                            */}
                            {!isSp && (
                                <FundingPlan
                                    id={information.id}
                                    customerName={information.customer_contacts_name}
                                    isNew={id === 'new'}
                                />
                            )}
```

⚠️ ⚠️ **`isSp`（スマートフォン）で出さないのは従来どおり。**

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ 建売・中古の顧客詳細への追加 | ⚠️ **注文（InformationEdit）だけの機能**。指示の対象外 |
| 2 | ⚠️ `funding_plan` への閲覧権限 | ⚠️ **元から無い。** 全ユーザー開放で対象は広がった（宿題） |
| 3 | ⚠️ 「① お客様カルテ」ページの復活 | ⚠️ 改修版にも無い |
| 4 | ⚠️ `calc()` への `renderLands()` の復帰 | ⚠️ **改修版の意図に従った**（上記） |

---

## 検証

| 確認 | 結果 |
|---|---|
| ⚠️ 統合後 vs 現行の diff | ⚠️ **残るハンクは改修版の新機能だけ**（17ハンク。機械的に確認） |
| ⚠️ localStorage 版の残骸 | ⚠️ **0件**（⚠️ `db()` / `dbSave` / `newCustomer` などの実装は無い。⚠️ **コメント内の言及のみ**） |
| ⚠️ 連携が残っているか | ⚠️ `CUSTOMER_ID` 8 / `apiPost` 4 / `bootLoad` 4 / `TOUCHED` 6 / `PLAN_EXISTS` 5 |
| ⚠️ 新機能が残っているか | ⚠️ `w_dates` 7 / `setFlowDate` 3 / `numOnly` 2 / `updateFlowDates` 4 |
| ⚠️ `<script>` の構文 | ⚠️ **OK**（`new Function()` で検査。99,793文字） |
| ⚠️ `w_dates` 列の追加 | ⚠️ **ローカルに適用済み**（`w_start` / `w_days` / `w_done` / `w_dates` の4列） |
| ⚠️ 列が JSON を受けるか | ⚠️ **ロールバック付きで UPDATE を確認** |
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `npm run build` | ⚠️ **成功** |
| ⚠️ `InformationEdit.tsx` の新規警告 | ⚠️ **0件**（既存3件のみ） |

### ⚠️ 未実施

⚠️⚠️ **ブラウザでの実動作は確認していない。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | 顧客詳細 →「デジシキ作成」 | ⚠️ **全ユーザーにボタンが出る** |
| 2 | 開いた画面 | ⚠️ **お客様セレクトが1件・グレーアウト** |
| 3 | ⚠️ **「＋ 新規作成」「複製保存」** | ⚠️ **無い** |
| 4 | ⚠️ **⑨段取り表 STEP2〜7** | ⚠️ **日付のカレンダーが出る**（日数欄は「－」） |
| 5 | ⚠️ STEP2 に日付を入れる | ⚠️ **STEP3以降がそこから積み上がる** |
| 6 | ⚠️ **保存 → 開き直す** | ⚠️ **予定日が残っている**（⚠️ SQL 未実行だと消える） |
| 7 | 日付を空欄に戻す | ⚠️ **日数からの自動計算に戻る** |
| 8 | ⚠️ 金額欄に全角数字を入力 | ⚠️ **半角に直り、カーソルが飛ばない** |
| 9 | ⚠️ ⑦土地の坪数・坪単価を連続入力 | ⚠️ **フォーカスが外れない** |
| 10 | ⚠️ ⑧土地検索の表 | ⚠️ **更新される**（⚠️ `renderLands()` を外した影響の確認） |
| 11 | 保存 | ⚠️ **「顧客台帳の n 項目にも反映」が出る** |
| 12 | 書出 | ⚠️ **開いている1顧客だけ**の JSON |
