# 指示（2026-09-17）　勝因・敗因の入力（`information` ディレクトリ）

⚠️ 依頼（`ReadMeClaude.md` 要旨）: 「v2.2.136 で作業。`InformationEdit.tsx` - `TableStatus.tsx` の改修。
⚠️ **契約済み**のとき **勝因の入力**を表示（価格差＝`input type=number` 自由記述／勝因＝**必須** textarea／
競合を選択＝失注先と同じUI／他社営業＝任意 `input type=text`）。
⚠️ **失注**のとき、失注理由が**競合負け**なら **失注情報の入力**を表示
（失注先を選択・詳細な他決理由はこれまで同様／⚠️ **敗因＝現在の `customized_input_01JSE7H4MQES619NBWX6PQDFRH` の入力箇所**・必須／
他社営業＝任意／価格差＝**必須** number／今後の対策＝**必須** textarea／他社のキャンペーン＝任意 textarea）。
⚠️ **`master_data` に必要なカラムを追加**（適切な英名・`DEFAULT NULL` の `TEXT`）。⚠️ **カラム追加に伴うバックエンド改修も行う。**」

---

## ⚠️ 着手前に確認したこと（利用者が決定）

| # | 論点 | ⚠️ 決定 |
|---|---|---|
| 1 | ⚠️ `TableStatus.tsx` は**3画面で共有**（注文／建売／中古）。どこに出すか | ⚠️ **注文だけに出す** |
| 2 | 「価格差」「他社営業」は契約済み・失注の両方に出る。列を分けるか | ⚠️ **共通の1列ずつ** |

---

## ⚠️ 調査で分かったこと

### ⚠️ 1. `TableStatus.tsx` は3画面で共有されている

| 画面 | category | テーブル |
|---|---|---|
| `InformationEdit.tsx` | `order` | `master_data` |
| ⚠️ `InformationEditKaeru.tsx` | `spec` | ⚠️ `master_data_kaeru` |
| ⚠️ `InformationEditResale.tsx` | `used` | ⚠️ `master_data_resale` |

⚠️⚠️ **列の許可リストは3テーブル共通**（`backend/src/core/allowed_columns.php` → `masterDataColumns.ts`）。
⚠️ そのため ⚠️ **`master_data` にだけ列を足して全画面に出すと、建売・中古で保存が 500 になる。**
⚠️ **実際に再現して確かめた**（下の「検証」）。

### 2. 「入力必須」は固定配列だった

⚠️ `handleSave()` の `requiredList` は ⚠️ **常に必須の項目しか書けない**。
⚠️ 「契約済みなら勝因」のような ⚠️ **条件つき必須は表現できない**ので、判定を新しく足した。

### 3. 「敗因」は既存欄の読み替え

⚠️ 指示どおり ⚠️ **列を増やしていない**。既存の `customized_input_01JSE7H4MQES619NBWX6PQDFRH` のまま。
⚠️ **過去の入力がそのまま「敗因」として読める。**

### 4. 「競合を選択」も既存列

⚠️ 失注先と ⚠️ **同じ `competitor_name`**。⚠️ UI も同じものを使い回した（`competitorPicker()`）。

---

## 追加した列（⚠️ `master_data` のみ・`TEXT DEFAULT NULL`）

| 列名 | 画面の名前 | 出る場面 | 必須 |
|---|---|---|---|
| `competitor_win_reason` | 勝因 | 契約済み | ⚠️ **必須** |
| `competitor_price_gap` | 価格差 | ⚠️ **契約済み・失注の両方** | 契約済み=任意／⚠️ 失注=**必須** |
| `competitor_sales_person` | 他社営業 | ⚠️ **両方** | 任意 |
| `competitor_countermeasure` | 今後の対策 | 失注（競合負け） | ⚠️ **必須** |
| `competitor_campaign` | 他社のキャンペーン | 失注（競合負け） | 任意 |

⚠️ 既存の `competitor_lost_contract_reason` / `competitor_name` に合わせて ⚠️ **`competitor_` 接頭辞**で揃えた。

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/information/` | ⚠️ `TableStatus.tsx` | 契約済みブロック新設／失注ブロック再構成／共通化 |
| `frontend/src/components/information/` | `InformationEdit.tsx` | ⚠️ 条件つき必須の判定を追加 |
| `frontend/src/utils/` | `informationUtils.ts` | ⚠️ 列キーの定数と `statusRequiredError()` |
| `backend/src/core/` | ⚠️ `allowed_columns.php` | ⚠️ **5列を追加（唯一の正）** |
| `backend-express/src/features/information/` | ⚠️ `masterDataColumns.ts` | ⚠️ 上記に合わせて更新 |
| `backend/scripts/sql/` | ⚠️ `2026-09-17_master_data_win_lose.sql`（⚠️ **新規**） | `ALTER TABLE` |

## 追加した定数・関数

| 名前 | ファイル |
|---|---|
| `LOSE_REASON_KEY` / `WIN_REASON_KEY` / `PRICE_GAP_KEY` / `SALES_PERSON_KEY` / `COUNTERMEASURE_KEY` / `RIVAL_CAMPAIGN_KEY` | `informationUtils.ts` |
| `statusRequiredError()` | `informationUtils.ts` |
| `isOrder` / `competitorPicker()` / `freeField()` | `TableStatus.tsx` |

---

## `backend/scripts/sql/2026-09-17_master_data_win_lose.sql`（⚠️ 新規・全文）

```sql
-- ---------------------------------------------------------------------------
-- 勝因・敗因の入力欄で使う列を master_data に追加する（2026-09-17 の指示）
--
-- ⚠️⚠️ **対象は master_data だけ**（注文事業）。
--   ⚠️ 入力欄は `TableStatus.tsx` にあるが、**あの画面は3事業で共有**している。
--     ⚠️ そのため画面側で `category === 'order'` のときだけ出している。
--   ⚠️ 建売（master_data_kaeru）・中古（master_data_resale）へ広げるときは、
--     ⚠️ **この SQL を各テーブルにも流してから**画面の条件を外すこと。
--     ⚠️ 列が無いまま出すと `Unknown column` で**保存がまるごと失敗する**
--       （列の許可リストは3テーブル共通のため）。
--
-- ⚠️⚠️ **DEFAULT NULL にすること**（指示）。
--   ⚠️ 既存 18,000 行以上に既定値を書き込ませない。
--   ⚠️ 「まだ聞いていない」と「空と答えた」を区別できるようにするため。
--
-- ⚠️⚠️ **`価格差` も TEXT である。**
--   ⚠️ 画面は `input type="number"` だが、既存の金額系の列がすべて TEXT で、
--     ⚠️ ここだけ数値型にすると**集計側で型が割れる。**
--
-- ⚠️ 「敗因」は**列を増やしていない**（指示）。
--   ⚠️ 既存の `customized_input_01JSE7H4MQES619NBWX6PQDFRH` をそのまま使う。
--   ⚠️ ラベルが変わるだけなので、**過去の入力もそのまま活きる。**
--
-- ⚠️ 「競合を選択」も列を増やしていない。既存の `competitor_name` を使う
--   （失注先と同じ列・同じUI）。
--
-- ⚠️ 実行先は ⚠️ **① レンタルサーバー（Xserver）の phpMyAdmin**。
-- ---------------------------------------------------------------------------

ALTER TABLE master_data
  ADD COLUMN competitor_win_reason      TEXT DEFAULT NULL COMMENT '勝因。契約済みのとき必須',
  ADD COLUMN competitor_price_gap       TEXT DEFAULT NULL COMMENT '競合との価格差。契約済み=任意／失注=必須',
  ADD COLUMN competitor_sales_person    TEXT DEFAULT NULL COMMENT '競合の営業担当。任意',
  ADD COLUMN competitor_countermeasure  TEXT DEFAULT NULL COMMENT '今後の対策。競合負けのとき必須',
  ADD COLUMN competitor_campaign        TEXT DEFAULT NULL COMMENT '他社のキャンペーン。任意';
```

---

## `frontend/src/utils/informationUtils.ts`（追加分・全文）

```ts
/**
 * 勝因・敗因の入力欄（TableStatus.tsx）で使う列。
 *
 * ⚠️⚠️ **列は master_data にしか無い**（2026-09-17 の SQL）。
 *   ⚠️ 入力欄も `category === 'order'` のときだけ出すこと。
 *     ⚠️ 建売・中古から送ると `Unknown column` で**保存がまるごと失敗する**
 *       （列の許可リストは3テーブル共通のため）。
 *
 * ⚠️ 「敗因」は**新しい列ではない。** 既存の
 *   `customized_input_01JSE7H4MQES619NBWX6PQDFRH` をそのまま使う（指示）。
 *   ⚠️ ラベルが変わるだけなので過去の入力も活きる。
 * ⚠️ 「競合を選択」も既存の `competitor_name`（失注先と同じ列）。
 */
export const LOSE_REASON_KEY = 'customized_input_01JSE7H4MQES619NBWX6PQDFRH';
export const WIN_REASON_KEY = 'competitor_win_reason';
export const PRICE_GAP_KEY = 'competitor_price_gap';
export const SALES_PERSON_KEY = 'competitor_sales_person';
export const COUNTERMEASURE_KEY = 'competitor_countermeasure';
export const RIVAL_CAMPAIGN_KEY = 'competitor_campaign';

/**
 * ステータスに応じた必須項目の検査。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`handleSave()` の `requiredList` では書けない。**
 *   ⚠️ あちらは「常に必須」の固定配列で、
 *     ⚠️ **ステータス次第で必須が変わる**ものは表現できない。
 *
 * ⚠️ 未入力の項目名を返す。⚠️ **すべて埋まっていれば null。**
 *   ⚠️ 例外を投げないこと。呼び出し側は alert を出して中断するだけである。
 *
 * ⚠️⚠️ **注文事業（order）以外では必ず null を返す。**
 *   ⚠️ 建売・中古には入力欄そのものを出していないため、
 *     ⚠️ 検査すると**絶対に保存できなくなる。**
 * ─────────────────────────────────────────────
 */
export const statusRequiredError = (
    information: Record<string, string>,
    category: string,
    status: string
): string | null => {
    if (category !== 'order') return null;

    // ⚠️ 空白だけの入力も未入力として扱う
    const filled = (key: string): boolean => (information[key] ?? '').trim() !== '';

    if (status === '契約済み') {
        if (!filled(WIN_REASON_KEY)) return '勝因';
        return null;
    }

    if (status === '失注' && information.competitor_lost_contract_reason === '競合負け') {
        if (!filled(LOSE_REASON_KEY)) return '敗因';
        if (!filled(PRICE_GAP_KEY)) return '価格差';
        if (!filled(COUNTERMEASURE_KEY)) return '今後の対策';
        return null;
    }

    return null;
};
```

---

## `frontend/src/components/information/InformationEdit.tsx`（追加分）

⚠️ `import` に `statusRequiredError` を追加し、`handleSave()` の既存ループの**直後**に置いた。

```tsx
        /**
         * ⚠️⚠️ **ステータスで変わる必須項目**（2026-09-17 の指示）。
         *   ⚠️ 上の `requiredList` は固定の配列なので、
         *     「契約済みなら勝因」「競合負けなら価格差」のような条件つきは書けない。
         *   ⚠️ 判定は informationUtils の `statusRequiredError()` に置いてある
         *     （⚠️ **TableStatus.tsx のラベルと揃えること**）。
         */
        const statusError = statusRequiredError(information, category, information.status);
        if (statusError !== null) {
            alert(`必須項目が未入力です:${statusError}`);
            return;
        }
```

⚠️ ⚠️ **`InformationEditKaeru.tsx` / `InformationEditResale.tsx` は触っていない。**
⚠️ 入力欄を出していないため、⚠️ **判定を足すと保存できなくなる**（`statusRequiredError()` も `order` 以外は必ず `null` を返す）。

---

## `backend/src/core/allowed_columns.php`（追加分）

```php
'competitor',
'competitor_campaign',
'competitor_countermeasure',
'competitor_lost_contract_date',
'competitor_lost_contract_reason',
'competitor_name',
'competitor_price_gap',
'competitor_sales_person',
'competitor_win_reason',
'competitors_text',
```

⚠️⚠️ **こちらが唯一の正**。⚠️ `masterDataColumns.ts` は ⚠️ **これに合わせる**（下記）。

## `backend-express/src/features/information/masterDataColumns.ts`（追加分）

```ts
 * 生成元: backend/src/core/allowed_columns.php（187件 → 一意 186件）
 *
 * ⚠️⚠️ **2026-09-17 に勝因・敗因の5列を追加した。**
 *   `competitor_campaign` / `competitor_countermeasure` / `competitor_price_gap`
 *   `competitor_sales_person` / `competitor_win_reason`
 *   ⚠️ 列そのものは **master_data にしか無い**（2026-09-17 の SQL）。
 *     ⚠️ この一覧は**3テーブル共通**なので、建売・中古の画面から
 *       これらのキーを送ると `Unknown column` で**保存がまるごと失敗する。**
 *     ⚠️ そのため入力欄は `TableStatus.tsx` で `category === 'order'` に限っている。
 */
```

```ts
  'competitor', 'competitor_campaign', 'competitor_countermeasure',
  'competitor_lost_contract_date', 'competitor_lost_contract_reason',
  'competitor_name', 'competitor_price_gap', 'competitor_sales_person',
  'competitor_win_reason', 'competitors_text', 'contract_application_fee_planned_date',
```

---

## ⚠️ `frontend/src/components/information/TableStatus.tsx`（⚠️ **全文**）

⚠️ 大きく組み替えたので全文を載せる。⚠️ 主な変更点は次のとおり。

| # | 内容 |
|---|---|
| 1 | ⚠️ `isOrder`（`category === 'order'`）を追加 |
| 2 | ⚠️ **`competitorPicker()` に切り出し**（⚠️ 失注先と「競合を選択」で**同じものを使う**） |
| 3 | ⚠️ **`freeField()` を追加**（ラベル・必須の印・未入力の警告アイコンをまとめた） |
| 4 | ⚠️ **契約済みブロックを新設** |
| 5 | ⚠️ 失注ブロックの見出しを分けた（⚠️ **「失注情報の入力」は競合負けのときだけ**） |
| 6 | ⚠️ 既存の textarea を **「敗因」**として `freeField()` に載せ替え |
| 7 | ⚠️ `memo` の比較対象に**5列を追加**（⚠️ **書き忘れると打った文字が出てこない**） |

```tsx
import React, { memo, useContext } from 'react';
import { safeFormate } from '../../utils/informationUtils';
import { inputStyle } from '../../utils/informationUtils';
import { dateFormate } from '../../utils/informationUtils';
import { UNKNOWN_COMPETITOR, requiredStyle } from '../../utils/informationUtils';
import {
    COUNTERMEASURE_KEY, LOSE_REASON_KEY, PRICE_GAP_KEY,
    RIVAL_CAMPAIGN_KEY, SALES_PERSON_KEY, WIN_REASON_KEY,
} from '../../utils/informationUtils';
import AuthContext from '../../context/AuthContext';
import TableInput from './TableInput';

type Maker = {
    label: string,
    letter: string
};

type Props = {
    information: Record<string, string>
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    setShowLostReason: React.Dispatch<React.SetStateAction<boolean>>,
    competitorsRef: React.RefObject<HTMLInputElement | null>,
    competitorsInput: string,
    handleCompetitorsDelete: () => void,
    handleCompetitors: (maker?: string) => void,
    setCompetitorsInput: React.Dispatch<React.SetStateAction<string>>,
    makerList: Maker[]
}

const TableStatus = ({ information, setInformation, idMapping, setShowLostReason, competitorsRef, competitorsInput, handleCompetitorsDelete, handleCompetitors, setCompetitorsInput, makerList }: Props) => {
    const { category, authority } = useContext(AuthContext);

    /**
     * 「失注先不明」のボタン。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **失注先が分からないときも、必ず何か入れてもらうためのもの。**
     *   ⚠️ 空文字や `null` のままだと「要回答」に数えられ続け、
     *     ⚠️ **答えようがないのに件数が減らない**（DatabaseOrder の loseLength）。
     *   ⚠️ `不明` を入れれば判定から外れる。
     *     判定は `!competitor_name || competitor_name === 'null'` なので、
     *     ⚠️ **空文字や 'null' 以外なら何でもよい**が、
     *       ⚠️ 既存データに `不明` が62件あるので**それに揃える**。
     *       ⚠️ 別の表記（「わからない」等）を足すと集計で分かれてしまう。
     *
     * ⚠️ 同じ判定が次の3か所にある。**片方だけ直さないこと。**
     *     frontend/src/components/database/DatabaseOrder.tsx
     *     frontend/src/components/LostStatusList.tsx
     *     backend-express/src/features/menu.ts
     *
     * ⚠️ 候補（competitors_text）がある画面と、入力欄がある画面の
     *   **両方に出す**。⚠️ 片方だけだと、候補があるお客様で選べない。
     * ─────────────────────────────────────────────
     */
    const isUnknown = information.competitor_name === UNKNOWN_COMPETITOR;

    const unknownButton = (
        <div
            key="__unknown__"
            className={`me-2 mb-1 px-2 py-1 rounded border text-nowrap ${isUnknown ? 'bg-warning border-warning fw-bold text-dark' : 'bg-white text-muted'}`}
            style={{ cursor: 'pointer', transition: 'all 0.2s', fontSize: '11px' }}
            title="失注先が分からない場合に選んでください"
            onClick={() => setInformation(prev => ({
                ...prev,
                // ⚠️ もう一度押したら解除する。誤って押しても戻せるように
                competitor_name: isUnknown ? '' : UNKNOWN_COMPETITOR
            }))}
        >
            失注先不明
        </div>
    );

    /**
     * ⚠️⚠️ **勝因・敗因の入力欄は注文事業にしか出さない**（2026-09-17）。
     *   ⚠️ このコンポーネントは **3事業で共有**している
     *     （InformationEdit / InformationEditKaeru / InformationEditResale）。
     *   ⚠️ 新しい5列は **master_data にしか無い。**
     *     ⚠️ 列の許可リスト（allowed_columns.php）は**3テーブル共通**なので、
     *       建売・中古から送ると `Unknown column` で**保存がまるごと失敗する。**
     *   ⚠️ 広げるときは **先に各テーブルへ SQL を流すこと**
     *     （backend/scripts/sql/2026-09-17_master_data_win_lose.sql）。
     */
    const isOrder = category === 'order';

    /**
     * 競合他社を選ぶUI。
     *
     * ⚠️⚠️ **失注先の選択と、契約済みの「競合を選択」で同じものを使う**（指示）。
     *   ⚠️ 入れる列も同じ `competitor_name` である。
     *   ⚠️ **複製しないこと。** 候補の有無で分岐する処理がここにしかない。
     */
    const competitorPicker = (label: string) => (
        <div className="d-flex flex-wrap align-items-center mb-3 p-2 bg-white rounded border" style={{ fontSize: '12px' }}>
            <span className="fw-bold me-3 text-secondary">{label}{information.competitor_name ? ':' : 'を選択'}</span>
            {information.competitors_text ? (
                information.competitors_text.split(',')
                    .filter(c => c !== 'null' && c.trim() !== '')
                    .map((c, cIndex) => (
                        <div className={`me-2 mb-1 px-2 py-1 rounded border ${information.competitor_name === c ? 'bg-warning border-warning fw-bold text-dark' : 'bg-light text-secondary'}`}
                            key={cIndex}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => setInformation(prev => ({
                                ...prev,
                                competitor_name: c === information.competitor_name ? '' : c
                            }))}>
                            {c}
                        </div>
                    ))
                    // ⚠️ 候補があるときも「不明」を選べるようにする（下の unknownButton と同じもの）
                    .concat([unknownButton])
            ) : (
                <div className="d-flex align-items-center flex-grow-1 mt-1 mt-md-0">
                    <div className="position-relative flex-grow-1 me-2">
                        <input
                            type='text'
                            className="form-control form-control-sm border-0 shadow-none px-1"
                            style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                            placeholder={!information.competitors_text ? '競合他社名を入力...' : ''}
                            ref={competitorsRef} // 👈 Backspaceの判定などで使うため残しておいてOKです

                            value={competitorsInput || ''} // 🌟 👈 ココを追加！！（ReactのStateと同期させる）

                            onKeyDown={(e) => {
                                // 入力欄が空の状態でBackspaceを押した時の処理
                                if (e.key === 'Backspace' && !competitorsInput) {
                                    handleCompetitorsDelete();
                                }
                                if (e.key === 'Enter') {
                                    e.preventDefault(); // Enterキーでの意図しない画面リロードを防止
                                    handleCompetitors();
                                }
                            }}
                            onChange={(e) => setCompetitorsInput(e.target.value)}
                        />

                        {competitorsInput && (
                            <div className="position-absolute bg-white border rounded shadow-sm w-100 py-1"
                                style={{ top: '100%', left: 0, marginTop: '2px', zIndex: 1000, maxHeight: '150px', overflowY: 'auto' }}>
                                {makerList.map((m, mIndex) => (
                                    <div key={mIndex}
                                        className="px-2 py-1 text-dark"
                                        style={{ cursor: 'pointer', fontSize: '12px' }}
                                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-light')}
                                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-light')}
                                        onClick={() => {
                                            handleCompetitors(m.label);
                                            setInformation(prev => ({
                                                ...prev,
                                                competitor_name: m.label
                                            }));
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ⚠️ 指示どおり「追加」の左隣に置く */}
                    {unknownButton}

                    <button
                        className="btn btn-primary btn-sm text-nowrap shadow-sm px-3"
                        onClick={() => handleCompetitors()}
                    >
                        追加
                    </button>
                </div>
            )}
        </div>
    );

    /**
     * 自由記述の1項目。
     *
     * ⚠️ 必須のものは**未入力のあいだ赤い印を出す。** 保存時に弾かれる理由が
     *   その場で分かるようにするため（判定は informationUtils の
     *   `statusRequiredError()`。⚠️ **ラベルを変えたら向こうも直すこと**）。
     * ⚠️ 価格差は `type='number'` だが、⚠️ **列は TEXT** である（既存の金額系に合わせた）。
     */
    const freeField = (
        itemKey: string,
        label: string,
        required: boolean,
        type: 'text' | 'number' | 'textarea',
        placeholder = ''
    ) => {
        const value = safeFormate(information[itemKey]);
        const empty = value.trim() === '';
        const change = (v: string) => setInformation(prev => ({ ...prev, [itemKey]: v }));

        return (
            <div className="mb-3">
                <div className="fw-bold mb-1 text-secondary" style={{ fontSize: '12px' }}>
                    {label}
                    {required
                        ? <span style={requiredStyle}>必須</span>
                        : <span className="ms-2 text-muted" style={{ fontSize: '10px' }}>任意</span>}
                    {/* ⚠️ 未入力のうちだけ出す。埋まっていれば消える */}
                    {required && empty && <i className="fa-solid fa-triangle-exclamation text-danger ms-2"></i>}
                </div>
                {type === 'textarea' ? (
                    <textarea
                        placeholder={placeholder}
                        style={{ fontSize: '12px', borderRadius: '5px', border: '1px solid #cfcfcf', width: '100%', height: '60px', padding: '8px', resize: 'none' }}
                        value={value}
                        onChange={(e) => change(e.target.value)}
                    ></textarea>
                ) : (
                    <input
                        type={type}
                        placeholder={placeholder}
                        className="form-control form-control-sm"
                        style={{ fontSize: '12px', maxWidth: type === 'number' ? '200px' : '100%' }}
                        value={value}
                        onChange={(e) => change(e.target.value)}
                    />
                )}
            </div>
        );
    };

    return (
        <>
            {/* 1. ステータス選択エリア */}
            <div className="d-flex align-items-center mb-2">
                <select style={inputStyle} value={safeFormate(information[idMapping('ステータス')])}
                    onChange={(e) => {
                        setInformation(prev => (
                            {
                                ...prev,
                                [idMapping('ステータス')]: e.target.value
                            }
                        ));
                        if (e.target.value === '失注') setShowLostReason(true);
                    }}>
                    {category === 'spec' ?
                        <>
                            <option value="追客中">追客中</option>
                            <option value="接触（通話・返信）">接触（通話・返信）</option>
                            <option value="アポイント確定">アポイント確定</option>
                            <option value="来店あり">来店あり</option>
                            <option value="申込み済み">申込み済み</option>
                            <option value="事前取得（現金確認含む）">事前取得（現金確認含む）</option>
                            <option value="契約済み">契約済み</option>
                            <option value="追客終了">追客終了</option>
                            <option value="解約">解約</option>
                        </> : <>
                            <option value='見込み'>見込み</option>
                            <option value='会社管理'>会社管理</option>
                            <option value='失注'>失注</option>
                            <option value='重複'>重複</option>
                            <option value='契約済み'>{category === 'used' && '★'}契約済み</option>
                            <option value="解約">解約</option></>}
                </select>
            </div>

            {/**
              * ⚠️⚠️ **契約済みのときの「勝因の入力」**（2026-09-17 の指示）。
              *   ⚠️ 失注のときと同じように**理由を記入させる**のが目的である。
              *   ⚠️ **注文事業だけ**に出す（`isOrder` のコメント参照）。
              */}
            {isOrder && information[idMapping('ステータス')] === '契約済み' && (
                <div className="bg-light p-3 rounded border mt-2">

                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>
                            勝因の入力
                            {!safeFormate(information[WIN_REASON_KEY]).trim() && <i className="fa-solid fa-triangle-exclamation text-danger ms-2"></i>}
                        </div>
                    </div>

                    {freeField(PRICE_GAP_KEY, '価格差', false, 'number', '他社との差額（円）')}
                    {freeField(WIN_REASON_KEY, '勝因', true, 'textarea', '選ばれた理由を具体的に入力してください')}

                    {/* ⚠️ 失注先の選択と同じUI・同じ列（competitor_name） */}
                    {competitorPicker('競合')}

                    {freeField(SALES_PERSON_KEY, '他社営業', false, 'text', '競合の営業担当者名')}
                </div>
            )}

            {information[idMapping('ステータス')] === '失注' && (
                <div className="bg-light p-3 rounded border mt-2">

                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        {/* ⚠️ 2026-09-17 に見出しを分けた。⚠️ 「失注情報の入力」は
                               **競合負けのときだけ**出すため（指示） */}
                        <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>失注理由の入力{!information.competitor_lost_contract_reason && <i className="fa-solid fa-triangle-exclamation text-danger me-1"></i>}</div>
                    </div>

                    <div className="mb-3 d-flex align-items-center">
                        <span className="me-3 fw-bold text-secondary" style={{ fontSize: '12px' }}>失注理由:</span>
                        <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information.competitor_lost_contract_reason)}
                            onChange={(e) => {
                                setInformation(prev => ({ ...prev, competitor_lost_contract_reason: e.target.value }));
                            }}>
                            <option value="">選択してください</option>
                            {["競合負け", "計画中止", "身内の反対", "音信不通", "建築エリア外", "その他"].map(reason => (
                                <option value={reason} key={reason}>{reason}</option>
                            ))}
                        </select>
                    </div>

                    {information.competitor_lost_contract_reason === '競合負け' && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                                <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>失注情報の入力</div>
                            </div>

                            {/* ⚠️ 契約済みの「競合を選択」と同じもの。⚠️ **複製しない** */}
                            {competitorPicker('失注先')}
                            <div className="fw-bold mb-2 text-secondary mt-3" style={{ fontSize: '12px' }}>詳細な他決・失注理由（複数選択可）</div>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {['価格・予算', '間取り・プラン提案', 'デザイン・外観', '性能', '土地・立地条件（他社物件）', '営業の対応（スピード・相性）', '保証・アフターサポート', '会社のブランド・信頼性', '縁戚・知人の紹介', 'その他'].map(reason => {
                                    const currentReasons = information.customized_input_01JRF9CZSW65A151WR30NA4PB3
                                        ? String(information.customized_input_01JRF9CZSW65A151WR30NA4PB3).split(',')
                                        : [];
                                    const isChecked = currentReasons.includes(reason);

                                    return (
                                        <div key={reason} className="form-check form-check-inline m-0">
                                            <input
                                                className="form-check-input shadow-sm"
                                                type="checkbox"
                                                id={`detail-reason-${reason}`}
                                                checked={isChecked}
                                                onChange={() => {
                                                    let newArray = [...currentReasons];
                                                    if (isChecked) {
                                                        newArray = newArray.filter(r => r !== reason);
                                                    } else {
                                                        newArray.push(reason);
                                                    }
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        customized_input_01JRF9CZSW65A151WR30NA4PB3: newArray.filter(Boolean).join(',')
                                                    }));
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <label
                                                className="form-check-label text-dark"
                                                htmlFor={`detail-reason-${reason}`}
                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                {reason}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            {/**
                              * ⚠️⚠️ **この欄が「敗因」である**（2026-09-17 の指示）。
                              *   ⚠️ 列は増やしていない。既存の
                              *     `customized_input_01JSE7H4MQES619NBWX6PQDFRH` のまま。
                              *     ⚠️ **過去の入力がそのまま敗因として読める。**
                              *   ⚠️ 必須にするのは注文事業だけ。建売・中古では
                              *     ⚠️ **今までどおり任意**（判定を足すと保存できなくなる）。
                              */}
                            {freeField(
                                LOSE_REASON_KEY, '敗因', isOrder, 'textarea',
                                '負けた理由を具体的に入力してください'
                            )}

                            {/* ⚠️ ここから下は注文事業だけ。⚠️ 列が master_data にしか無い */}
                            {isOrder && (
                                <>
                                    {freeField(SALES_PERSON_KEY, '他社営業', false, 'text', '競合の営業担当者名')}
                                    {freeField(PRICE_GAP_KEY, '価格差', true, 'number', '他社との差額（円）')}
                                    {freeField(COUNTERMEASURE_KEY, '今後の対策', true, 'textarea', '次に同じ競合と当たったときの対策')}
                                    {freeField(RIVAL_CAMPAIGN_KEY, '他社のキャンペーン', false, 'textarea', '他社が実施していた特典・値引きなど')}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
            {information[idMapping('ステータス')] === '解約' && (
                <div className="d-flex align-items-center">
                    <div className="me-1">解約発生日</div>
                    <TableInput type='date' information={information} setInformation={setInformation}
                        itemKey='competitor_lost_contract_date' formattedValue={dateFormate(information.competitor_lost_contract_date)} />
                </div>
            )}
        </>
    )
}

export default memo(TableStatus, (prevProps, nextProps) => {
    const statusKey = prevProps.idMapping('ステータス');

    /**
     * ⚠️⚠️ **ここに書き忘れた列は、入力しても画面が描き直されない。**
     *   ⚠️ 値は state に入るので**保存はされる**が、
     *     ⚠️ **打った文字が出てこない**という分かりにくい壊れ方をする。
     *   ⚠️ 入力欄を増やしたら**必ずここにも足すこと。**
     */
    const fieldsToCheck = [
        statusKey,
        'competitor_lost_contract_reason',
        'competitor_lost_contract_date',
        'competitors_text',
        'competitor_name',
        'customized_input_01JRF9CZSW65A151WR30NA4PB3',
        'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
        // ⚠️ 2026-09-17 に追加した5列（勝因・敗因の入力）
        'competitor_win_reason',
        'competitor_price_gap',
        'competitor_sales_person',
        'competitor_countermeasure',
        'competitor_campaign'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.competitorsInput !== nextProps.competitorsInput) return false;
    if (prevProps.makerList !== nextProps.makerList) return false;

    return true;
});
```

---

## 検証

### ⚠️ ローカルDBへ SQL を適用し、実際に保存した

| 確認 | 結果 |
|---|---|
| `SHOW COLUMNS FROM master_data LIKE 'competitor%'` | ⚠️ **5列とも `text` / `NULL` 可 / 既定値 `NULL`** |
| ⚠️ 注文（`category: 'order'`）で5列を送って保存 | ⚠️ **HTTP 200** |
| ⚠️ DBから読み戻し | ⚠️ **5列とも送った値どおり**（勝因・価格差・他社営業・今後の対策・他社キャンペーン） |

### ⚠️⚠️ 建売から送ると失敗することも確かめた

⚠️ `category: 'spec'` で**同じキー**を送った結果:

```
{"status":"error","message":"顧客情報の登録に失敗しました。"}
HTTP=500
```

⚠️⚠️ **これが「注文だけに出す」理由である。** ⚠️ 欄を全画面に出していたら、
⚠️ **建売・中古で保存ボタンが常に失敗し、入力内容が消えていた。**

### ⚠️ 許可リストの突き合わせ

| 確認 | 結果 |
|---|---|
| `allowed_columns.php` の件数 | ⚠️ 187件（⚠️ **一意 186件**。既存の重複1件はそのまま） |
| `masterDataColumns.ts` の件数 | ⚠️ **186件** |
| ⚠️ 片側にしか無い列 | ⚠️ **0件**（⚠️ **完全一致**） |

### ビルド・型

| 確認 | 結果 |
|---|---|
| `npm run build`（フロント） | ⚠️ **成功**（`Compiled with warnings.`） |
| ⚠️ 追加した警告 | ⚠️ **無し**（⚠️ `TableStatus.tsx` の `'authority' is assigned a value but never used` は**改修前からある**） |
| `npx tsc --noEmit`（② Express） | ⚠️ **エラー0** |

⚠️ 検証で書き換えた行（`master_data.id = 01P03E2KCZ81D45FBPNC5FSY8Y`）は
⚠️ **`status = 見込み` / 5列 NULL に戻し済み**。⚠️ 建売側に残骸が無いことも確認済み（0件）。

### ⚠️ 未実施

⚠️⚠️ **画面を開いての確認は未実施。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | 注文でステータスを**契約済み**にする | ⚠️ **「勝因の入力」**が出る |
| 2 | 勝因を空のまま保存 | ⚠️ **「必須項目が未入力です:勝因」**で止まる |
| 3 | 「競合」の選択 | ⚠️ **失注先とまったく同じUI**（候補チップ／入力＋候補／失注先不明） |
| 4 | **失注 → 競合負け** | ⚠️ 「失注情報の入力」が出る。⚠️ **競合負け以外では出ない** |
| 5 | 敗因・価格差・今後の対策を空で保存 | ⚠️ **その名前で止まる**（敗因→価格差→今後の対策の順） |
| 6 | 文字を打つ | ⚠️ **1文字ごとに消えない**（`memo` の比較対象に入れてある） |
| 7 | ⚠️ **建売・中古の顧客詳細** | ⚠️ **今までとまったく同じ**（⚠️ 新しい欄は**出ない**／⚠️ **保存できる**） |

---

## ⚠️ 残作業

| # | 内容 |
|---|---|
| 1 | ⚠️ 上の**画面での確認** |
| 2 | ⚠️ ① の phpMyAdmin で ⚠️ **`2026-09-17_master_data_win_lose.sql` を実行** |
| 3 | ⚠️ `v2.2.136` を push → PR → `production` へマージ |
| 4 | ⚠️ **② VPS で Express を再ビルド**（⚠️ `masterDataColumns.ts` を変えたため） |
| 5 | ⚠️ ① へフロントをアップロード |

⚠️⚠️ **順序が重要。** ⚠️ **2（SQL）を先に流すこと。**
⚠️ 列が無いまま新しい画面を配ると、⚠️ **契約済み・失注の保存がすべて失敗する。**

⚠️ ⚠️ **切り戻し**は ① で `ALTER TABLE master_data DROP COLUMN …` ではなく、
⚠️ **フロントを前のビルドに戻すだけ**でよい（⚠️ 列が余分にあっても既存処理は動く）。
