# 2026-09-28 (8) 担当営業の列と、イベント同期の反響取得日（v2.2.151）

⚠️ [task-2026-09-28-07](task-2026-09-28-07-event-sync-shop-select.md) の続き。⚠️ **同じ版**。

## 依頼（`ReadMeClaude.md`・2件）

**1件目**

- ⚠️ `DailyAction.tsx` の ⚠️ **来場日未入力テーブル と KPIテーブル**に、
  ⚠️ **顧客名の右隣に「担当営業」の列**を追加する
- ⚠️ `master_data` の `in_charge_user` を表記する

**2件目**

- ⚠️ `EventList.tsx` — ⚠️ **`syncStart` を発火したとき**
  （⚠️ 指示書は `unSync` とあったが ⚠️ **`syncStart` の誤り**との訂正あり）
- ⚠️ `master_data.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99`（反響取得日）に
  ⚠️ **`reserved_at` の値を `YYYY/MM/DD` 形式で**登録する

---

## ⚠️⚠️ 途中で起きたこと — 開発環境の 502

⚠️ 作業中に ⚠️ **「syncStart を開発環境で実行したら 502 が返る」**との報告。

### ⚠️ 原因は私の書き間違い

⚠️⚠️ **`dailyAction.ts` のテンプレートリテラルの中にバッククォートを書いた。**

```
src/features/dailyAction.ts(183,23): error TS1005: ',' expected.
```

⚠️ ⚠️ **② が起動できず、全リクエストが 502 になっていた。**

### ⚠️ なぜブラウザまで 502 が届いたか

⚠️ 通常は ② が落ちても ⚠️ **① へ自動フォールバック**する。⚠️ **しかし `list:insert` は違う。**

```
🔒 list:insert:order  — 【書き込み・フォールバック禁止】顧客台帳への登録
```

⚠️⚠️ **書き込みは二重実行を避けるためフォールバックしない。** ⚠️ **502 がそのまま返る。**

⚠️ ⚠️ **バッククォートを外して復旧済み。** ⚠️ 同じ場所に警告コメントを残した（⚠️ **この日3度目**）。

### ⚠️⚠️ ついでに見つけた登録漏れ（⚠️ **v2.2.150 から本番に入っている**）

⚠️ ログに ⚠️ **`ループ検知: ① から転送された "daily_action" が ② に未登録です`** が出ていた。

⚠️ 原因は ⚠️⚠️ **ゲートウェイの鍵が `request:roll:category` の完全一致**だから。

| | |
|---|---|
| ② の登録 | `daily_action:list:` （⚠️ **category 無し**） |
| ⚠️ 画面が送る | ⚠️⚠️ **`daily_action:list:order`** |

⚠️ ⚠️ **毎回外れて 502 → ① へフォールバック**していた。
⚠️ ⚠️ **画面は動くのでログを見ないと気づけない**（⚠️ 無駄な往復とエラーログが出続ける）。

```ts
/**
 * ⚠️⚠️ **`category` ごとに登録すること**（2026-09-28 に気づいて足した）。
 *   ⚠️ 鍵は `request:roll:category` の**完全一致**である（`findEntry` を参照）。
 *   ⚠️ ⚠️ **DailyAction.tsx は `category` を送っている**ため、
 *     ⚠️ `category` 無しの登録だけだと**毎回ここで外れ、502 を返して ① へ落ちていた。**
 *     ⚠️ 画面は ① のフォールバックで動くので、⚠️ **ログを見ないと気づけない。**
 *   ⚠️ 出るのは注文（order）だけだが、⚠️ **`category` 無しも残す**
 *     （⚠️ 比較ツールなど `category` を送らない呼び出しのため）。
 */
['', 'order'].forEach((category) => {
  register({
    request: 'daily_action',
    roll: 'list',
    category,
    summary: '要確認の顧客（未同期・来場日未入力）と本日の予定',
    phpSource: 'backend/src/handlers/daily_action.php',
    auth: 'staff',
    handler: async (ctx) => runDailyAction(ctx.staff?.id ?? null),
  });
});
```

---

## 1. 担当営業の列

### ⚠️ `backend-express/src/features/dailyAction.ts`

⚠️ `CANCEL_SQL` と `TODAY_SQL` の**顧客名の直後**に足した。

```sql
         COALESCE(m.customer_contacts_name, '') AS customer,
         /*
           ⚠️ 担当営業（2026-09-28 の指示）。⚠️ **来場日未入力と本日の予定にだけ出す。**
             ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
           ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
             ⚠️ 失注や長期化で **「◯◯店 管理」に付け替えられている**ことがあり、
             ⚠️ ⚠️ **そのまま「◯◯店 管理」と表示される。** 誰の担当か分からない行はそれが正しい。
             ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。
           ⚠️⚠️ **ここはテンプレートリテラルの中。バッククォートを書かないこと**（文字列が終わる）。
         */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
```

⚠️ 型とセクション:

```ts
  /** ⚠️ 担当営業。⚠️ **来場日未入力の行だけが持つ**（未同期にはまだ担当がいない） */
  staff?: string;
```

```ts
  /**
   * ⚠️ 担当営業の列を出すかどうか。
   *   ⚠️⚠️ **未同期以外は true**（2026-09-28 の指示）。
   *   ⚠️ 未同期は `inquiry_customer` 由来で、⚠️ **まだ担当が決まっていない。**
   */
  hasStaff: boolean;
```

```ts
    { label: '未同期', hasDays: true, hasCampaign: true, hasStaff: false, rows: unsync },
    { label: '来場日未入力', hasDays: true, hasCampaign: false, hasStaff: true, rows: cancel },
    ...TODAY_STEPS.map((step) => ({
      label: `本日の${step.label}`,
      hasDays: false,
      hasCampaign: false,
      hasStaff: true,
      rows: today.filter((row) => row.step === step.label),
    })),
```

### ⚠️ `backend/src/handlers/daily_action.php`

⚠️ 同じ列・同じ `hasStaff` を返す（⚠️ **フォールバックで形が変わらないように**）。

```php
         /* ⚠️ 担当営業（2026-09-28）。⚠️ **来場日未入力と本日の予定にだけ出す。**
            ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
            ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
              ⚠️ 「◯◯店 管理」に付け替えられている行はそのまま表示される。
              ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。 */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
```

```php
    // ⚠️ hasStaff は**未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない
    ["label" => "未同期", "hasDays" => true, "hasCampaign" => true, "hasStaff" => false, "rows" => $response_unsync],
    ["label" => "来場日未入力", "hasDays" => true, "hasCampaign" => false, "hasStaff" => true, "rows" => $response_cancel],
```

### ⚠️ `frontend/src/components/DailyAction.tsx`

```tsx
    /** ⚠️ 担当営業。⚠️ **未同期以外が持つ**（未同期はまだ担当が決まっていない） */
    staff?: string;
```
```tsx
    /** ⚠️⚠️ **未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない */
    hasStaff: boolean;
```
```tsx
                                        <th className='da_th'>顧客名</th>
                                        {/* ⚠️ 担当営業は**顧客名のすぐ右**（指示）。⚠️ 未同期には出さない */}
                                        {section.hasStaff && <th className='da_th' style={{ width: '120px' }}>担当営業</th>}
```
```tsx
                                            <td className='da_td da_name'>{orUnset(row.customer)}</td>
                                            {section.hasStaff && (
                                                /* ⚠️ 「◯◯店 管理」のままの行もある。⚠️ **そのまま出す**（誰の担当か分からない状態が正） */
                                                <td className='da_td da_ellipsis' title={orUnset(row.staff ?? '')}>
                                                    {orUnset(row.staff ?? '')}
                                                </td>
                                            )}
```

---

## 2. イベント同期の反響取得日

### ⚠️ `frontend/src/components/header/EventList.tsx`

⚠️⚠️ **もともと `check_in_time`（来場した日時）を入れていた。**

```tsx
    /**
     * 反響取得日。
     *
     * ⚠️⚠️ **`reserved_at`（予約を受け付けた日時）を入れる**（2026-09-28 の指示）。
     *   ⚠️ それまでは `check_in_time`（来場した日時）を入れていた。
     *   ⚠️ ⚠️ **反響取得日は「問い合わせが来た日」**なので、予約日のほうが正しい。
     *
     * ⚠️ `reserved_at` は ⚠️ **手入力で作られた行には入らない**（実測で203件中89件が空）。
     *   ⚠️ ⚠️ **空のときは従来どおり `check_in_time` を使う。**
     *     ⚠️ ここを空で入れると、⚠️ **反響一覧にも推移にも出てこない顧客**ができる。
     *
     * ⚠️ `formatToYYYYMMDD` は `YYYY/MM/DD`（0埋めあり）を返す。
     *   ⚠️⚠️ **スラッシュ区切りであること。** ハイフンだと画面の集計から漏れる。
     */
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99:
        formatToYYYYMMDD(item.reserved_at) || formatToYYYYMMDD(item.check_in_time),
```

⚠️⚠️ **`reserved_at` が空のときのフォールバックは、指示には無い判断である。**
⚠️ ⚠️ **89件が空**で、そのまま入れると ⚠️ **反響取得日が空の顧客**ができるため入れた。
⚠️ ⚠️ **不要なら1行消せば厳密に `reserved_at` だけになる。**

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| ⚠️ 型チェック（①） | ⚠️ **エラーなし** |
| `react-scripts build` | ⚠️ **成功** → ⚠️ **`main.94cbeff7.js`** |
| ⚠️ ② の起動 | ⚠️ **復旧（502 は解消）** |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ（⚠️ **完全一致**）

```
  未同期            rows=55  hasStaff=false | kind,days,shop,register,customer,medium,campaign
  来場日未入力   rows=19  hasStaff=true  | kind,days,shop,register,customer,staff,medium
  本日の初回面談 rows=0   hasStaff=true  | (0件)
  本日の事前審査 rows=0   hasStaff=true  | (0件)
  本日の2回目以降面談 rows=4   hasStaff=true  | step,shop,register,customer,staff,medium
  本日の契約      rows=1   hasStaff=true  | step,shop,register,customer,staff,medium
```

⚠️ 来場日未入力19件のうち:

| | |
|---|---|
| 担当が空 | ⚠️ **0件** |
| ⚠️ **「◯◯店 管理」** | ⚠️⚠️ **6件**（⚠️ そのまま表示される） |

### ⚠️ `event_db` の実データ

```
全 203 件 / reserved_at が空 89 件 / check_in_time が空 123 件 / 同期済み 3 件
```

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **テンプレートリテラル（SQL・`<style>`）にバッククォートを書かないこと**（⚠️ **この日3度やった**） |
| 2 | ⚠️⚠️ **`list:insert` はフォールバック禁止。** ⚠️ ② が落ちると **ブラウザに 502 が直接返る** |
| 3 | ⚠️⚠️ **ゲートウェイの鍵は `request:roll:category` の完全一致。** ⚠️ **category ごとに登録すること** |
| 4 | ⚠️ 担当営業は ⚠️ **`in_charge_user` をそのまま**（指示）。⚠️ **「◯◯店 管理」も直さない** |
| 5 | ⚠️ 未同期の表には ⚠️ **担当営業を出さない**（⚠️ まだ担当が決まっていない） |
| 6 | ⚠️⚠️ **反響取得日の `reserved_at` が空のときは `check_in_time` に落ちる**（⚠️ **指示に無い判断**）。⚠️ 不要なら1行消す |
| 7 | ⚠️ 反響取得日は ⚠️ **`YYYY/MM/DD`**。⚠️ ハイフンだと画面の集計から漏れる |
