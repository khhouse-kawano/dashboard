# 2026-10-02-02　営業別契約率に「担当変更理由」8列を追加（v2.2.161）

## 依頼（ReadMeClaude.md）

> 新たにv2.2.161にて作業
>
> - StaffContractRate.tsx の改修
>   - 情報の追加にともなうサイズ変更 lg => **fullscreen**
>   - 先頭行の契約率の右に**担当変更理由**の列を8つ追加
>     UIを重視して `<tr colspan={2}>` にして既存の `<SortHead>` 要素上部に**担当営業別契約率**の行を追加
>     新たに追加する8つの列の上には**担当変更理由**の行を追加
>     以下の8つの列を追加して既存の `<SortHead>` 同様に歩留まりでソート可能にする
>     **失注** **計画中止** **計画延期** **ブラックリスト** **建築エリア外** **物貰い** **連絡不能** **その他**
>
>     1. 基準列(営業名)と master_data の first_interviewed_user が一致(スペースを空文字に置換して突合)
>     2. last_action_step_migration_item_name が上記8つに含まれる場合
>
>     1,2を満たせばカウントする

### ⚠️ 追加で確認した指示（期間の扱い）

⚠️ 指示書に書かれていなかったため確認した。回答:

> step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99で判断
> ※担当変更理由は反響取得日を基準に抽出
> の文言を追加する

---

## ⚠️ 着手前に実測したこと

### ⚠️⚠️ なぜ `last_action_step_migration_item_date` を使わないか

⚠️ 当初こちらを候補に挙げたが、⚠️⚠️ **日付の欠落が多すぎた。**

| 対象8理由の全件 | ⚠️ 日付が空 | 読める形式 |
|---|---|---|
| 3,462 | ⚠️⚠️ **1,252（36.2%）** | 2,210 |

⚠️ 反響取得日（`step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99`）は:

| 対象8理由の全件 | 反響日が空 | ⚠️ 読める形式 |
|---|---|---|
| 3,462 | ⚠️ **5** | ⚠️⚠️ **3,457（99.9%）** |

⚠️⚠️ **利用者の指定（反響取得日）が正しい。**

⚠️ なお ⚠️⚠️ **この列は「使用禁止カラム3つ」には含まれない**（カラムコメントも `※反響取得日`）。

### ⚠️ 値の分布（`last_action_step_migration_item_name`）

⚠️ 指定された8つはすべて実在した。⚠️⚠️ **`その他` が突出している。**

| 理由 | 全件 | ⚠️ 画面の98名と突合 |
|---|---|---|
| ⚠️⚠️ **その他** | 2,149 | ⚠️⚠️ **2,017** |
| 失注 | 389 | 365 |
| 計画延期 | 287 | 266 |
| 連絡不能 | 229 | 219 |
| 計画中止 | 238 | 218 |
| 物貰い | 143 | 130 |
| ブラックリスト | 22 | 21 |
| 建築エリア外 | 5 | 5 |
| **合計** | **3,462** | ⚠️ **3,241（93.6%）** |

⚠️ 同じ列には `反響(名簿取得)` 10,627件、`初回面談` 1,167件、`契約` 579件なども入っている。
⚠️⚠️ **これらは担当変更の理由ではないので含めない。**

⚠️ 前任（`first_interviewed_user`）が空の86件は ⚠️⚠️ **どの営業にも計上されない**（正しい挙動）。

---

## 版を上げる3点（⚠️ 着手時点でそろえた）

| # | 何を | 結果 |
|---|---|---|
| 1 | ブランチ | `v2.2.161` |
| 2 | `frontend/src/utils/version.ts` | `'2.2.160'` → ⚠️ `'2.2.161'` |
| 3 | `backend/scripts/sql/2026-10-02_update_log_2.2.161.sql` | 新規 |
| 4 | ⚠️⚠️ **ローカルDBへ流した** | ⚠️ `no=257` で確認済み |

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.161', '2026-10-02', '営業別契約率に担当変更理由の8列（失注・計画中止・計画延期・ブラックリスト・建築エリア外・物貰い・連絡不能・その他）を追加した。担当変更前の営業の実績として数え、反響取得日で期間を判定する。画面を全画面表示にした。');
```

| no | version | date |
|---|---|---|
| 257 | 2.2.161 | 2026-10-02 |
| 256 | 2.2.160 | 2026-10-01 |
| 255 | 2.2.159 | 2026-10-01 |

---

## 変更したファイル

| ディレクトリ | ファイル | |
|---|---|---|
| `backend-express/src/features/` | ⚠️ **staffContract.ts** | ⚠️ 集計の追加 |
| `frontend/src/components/header/` | ⚠️ **StaffContractRate.tsx** | ⚠️ 2段見出し・8列追加 |
| `frontend/src/components/header/` | **Header.tsx** | ⚠️ 全画面化（1行追加） |
| `frontend/src/utils/` | **version.ts** | 版 |
| `backend/scripts/sql/` | **2026-10-02_update_log_2.2.161.sql** | ⚠️ 新規 |

⚠️⚠️ **① の PHP は変更していない。** ⚠️ DB の構造も変えていない。

---

## ① `backend-express/src/features/staffContract.ts`

### ⚠️ 追加した定数（全文）

```ts
/**
 * 反響取得日。⚠️ 担当変更理由（下の `CHANGE_REASONS`）の**期間判定だけ**に使う。
 *
 * ⚠️⚠️ **`last_action_step_migration_item_date` は使わない。**
 *   ⚠️ 実測（2026-10-02）: ⚠️ **対象3,462件中1,252件（36.2%）が空**で、
 *     ⚠️ 期間を指定した途端に3分の1が消える。
 *   ⚠️ 反響取得日は ⚠️ **3,457件（99.9%）入っている。**
 */
const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日

/**
 * 担当変更理由。⚠️⚠️ **画面に並べる順もこの順。**
 *
 * ⚠️ `master_data.last_action_step_migration_item_name` の値と**完全一致**で見る。
 *   ⚠️ 同じ列には `反響(名簿取得)` `初回面談` `契約` など商談フェーズの値も入っており、
 *   ⚠️ ⚠️ **そちらは担当変更の理由ではないので含めない。**
 *
 * ⚠️ 実測（2026-10-02 / 画面の98名と突合できた件数）:
 *   ⚠️ ⚠️ **その他 2,017 件が突出している**（全体の62%）。
 *   ⚠️ 失注365 / 計画延期266 / 連絡不能219 / 計画中止218 / 物貰い130 /
 *   ⚠️ ブラックリスト21 / 建築エリア外5。
 */
export const CHANGE_REASONS = [
  '失注',
  '計画中止',
  '計画延期',
  'ブラックリスト',
  '建築エリア外',
  '物貰い',
  '連絡不能',
  'その他',
] as const;

export type ChangeReason = (typeof CHANGE_REASONS)[number];

const REASON_SET = new Set<string>(CHANGE_REASONS);

/** 全部0の理由カウンタ。⚠️ **画面が列を引けるよう、0でもキーを欠かさない** */
const emptyReasons = (): Record<string, number> => {
  const counter: Record<string, number> = {};
  for (const reason of CHANGE_REASONS) counter[reason] = 0;
  return counter;
};
```

⚠️ 追加した関数は ⚠️ **`emptyReasons()` の1つだけ**。

### ⚠️ `ContractRow` に足した3つの列

```ts
  /**
   * ⚠️⚠️ **担当変更前の営業**（＝前任）。
   *   ⚠️ ⚠️ **「初回面談をした人」ではない。** ⚠️ 名前に惑わされないこと。
   *     ⚠️ 以前使っていたCRMのデータ構造をそのまま引き継いでいるための命名であり、
   *     ⚠️ `in_charge_user` が変更されたときに**変更前の担当がここへ入る**。
   *
   * ⚠️ 担当変更理由の8列は**この人の実績として数える**（2026-10-02 の指示）。
   */
  first_interviewed_user: string | null;
  /** 最後に記録されたアクション名。⚠️ 担当変更理由の判定に使う */
  last_action: string | null;
  /**
   * 反響取得日。
   * ⚠️⚠️ **担当変更理由の期間判定はこの日付で行う**（2026-10-02 の指示）。
   */
  col_inquiry: string | null;
```

### ⚠️ クエリ（⚠️⚠️ **クエリの本数は増やしていない**）

```ts
    query<ContractRow>(
      `SELECT id, in_charge_user, status,
              ${COL_INTERVIEW} AS col_interview,
              ${COL_SCREENING} AS col_screening,
              ${COL_APPOINTMENT} AS col_appointment,
              ${COL_CONTRACT} AS col_contract,
              first_interviewed_user,
              last_action_step_migration_item_name AS last_action,
              ${COL_INQUIRY} AS col_inquiry
         FROM master_data`
    ),
```

### ⚠️⚠️ 追加した集計（全文）

```ts
  // -------------------------------------------------------------------------
  // 担当変更理由（2026-10-02 追加）
  //
  // ⚠️⚠️ **突合キーは `first_interviewed_user`（＝担当変更前の営業）。**
  //   ⚠️ ⚠️ **`in_charge_user`（現担当）ではない。**
  //     ⚠️ 「自分が担当していた顧客が、どういう理由で手を離れたか」を見るため。
  //
  // ⚠️⚠️ **期間は反響取得日で判定する**（⚠️ `COL_INQUIRY` のコメントを参照）。
  //
  // ⚠️ 実測（2026-10-02）: ⚠️ 8理由は全3,462件。
  //   ⚠️ ⚠️ **うち3,241件（93.6%）が画面の98名と突合する。**
  //   ⚠️ 前任が空の86件は**どの営業にも計上されない**（正しい挙動）。
  // -------------------------------------------------------------------------
  const reasonByStaff = new Map<string, Record<string, number>>();
  for (const row of contracted) {
    const reason = String(row.last_action ?? '').trim();
    if (!REASON_SET.has(reason)) continue;

    const key = norm(row.first_interviewed_user);
    if (key === '') continue;

    if (!inRange(toMonth(row.col_inquiry), range)) continue;

    const counter = reasonByStaff.get(key) ?? emptyReasons();
    counter[reason] += 1;
    reasonByStaff.set(key, counter);
  }
```

⚠️ `norm()` は既存のもの（⚠️ 半角・全角の空白を落とす）をそのまま使っている。
⚠️⚠️ **指示書の「スペースを空文字に置換して突合」はこれで満たしている。**

### ⚠️ 返り値

```ts
      // ⚠️⚠️ **0件の人にも全キーを入れて返す。** ⚠️ 画面が列を引けなくなる
      reasons: reasonByStaff.get(key) ?? emptyReasons(),
```

```ts
      /**
       * 担当変更理由の並び。⚠️⚠️ **画面の列順はこれをそのまま使う。**
       *   ⚠️ ⚠️ **画面側に8つを書き写さないこと。** ⚠️ 増減したときに食い違う。
       */
      reasonLabels: [...CHANGE_REASONS],
```

`StaffContractRow` に追加した項目:

```ts
  /**
   * 担当変更理由ごとの件数。⚠️ キーは `CHANGE_REASONS` の8つ。
   *
   * ⚠️⚠️ **0件でもキーは必ず入っている**（⚠️ 画面が列を引くため）。
   * ⚠️ ⚠️ **突合は前任（`first_interviewed_user`）、期間は反響取得日。**
   *   ⚠️ 左の契約率の列とは**母集団も日付の基準も違う**。足し引きできる数字ではない。
   */
  reasons: Record<string, number>;
```

---

## ② `frontend/src/components/header/StaffContractRate.tsx`

### ⚠️ 並べ替えキー

⚠️⚠️ **理由名をそのままキーにしない**（⚠️ `name` など既存キーと衝突しうる）。

```ts
/**
 * 担当変更理由の列の並べ替えキー。
 *
 * ⚠️⚠️ **理由名を直接キーにしない。** ⚠️ `name` など既存のキーと衝突する恐れがある。
 *   ⚠️ `reason:失注` のように接頭辞を付けて区別する。
 */
const REASON_PREFIX = 'reason:';

type SortKey =
    | 'name' | 'shop' | 'section' | 'talk' | 'next' | 'nextRate' | 'contract' | 'contractRate'
    | `${typeof REASON_PREFIX}${string}`;
type SortOrder = 'asc' | 'desc';
```

### ⚠️ `valueOf()`（変更後の全文）

```ts
/** 並べ替え用の値。⚠️ 率の null は **一番下**へ回す（-1） */
const valueOf = (row: Row, key: SortKey): number | string => {
    // ⚠️ 担当変更理由の列。⚠️⚠️ **0件の人も 0 として並べる**（除外しない）
    if (key.startsWith(REASON_PREFIX)) {
        return row.reasons?.[key.slice(REASON_PREFIX.length)] ?? 0;
    }
    switch (key) {
        case 'name': return row.name;
        case 'shop': return row.shop;
        case 'section': return row.section;
        case 'talk': return row.talk;
        case 'next': return row.next;
        case 'nextRate': return rate(row.next, row.talk) ?? -1;
        case 'contract': return row.contract;
        case 'contractRate': return rate(row.contract, row.talk) ?? -1;
        // ⚠️ 上の if で理由の列は処理済み。ここへは来ない
        default: return 0;
    }
};
```

### ⚠️ `SortHead`（変更後の全文）

⚠️ `divider` を足しただけ。⚠️ 並べ替えの作法は従来どおり。

```tsx
    const SortHead = ({ label, keyName, align = 'left', width, note, divider = false }: {
        label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string; note?: string;
        /** ⚠️ 区分の境目に線を入れる。⚠️ 担当変更理由の**先頭の列だけ** true */
        divider?: boolean;
    }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`sc_th sc_th_sort text-${align}${divider ? ' sc_divider' : ''}`}
                style={{ width }}
                title={note ?? 'クリックで並べ替え'}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    // ⚠️ 別の列は降順から始める（⚠️ 件数や率は「多い順」を先に見たい）
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
            >
                {label}
                <span className={`sc_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };
```

### ⚠️⚠️ 2段見出し（全文）

```tsx
                                {/*
                                    ⚠️⚠️ **見出しは2段。** ⚠️ 上段が区分、下段が列。
                                      ⚠️ ⚠️ **下段の `top` は上段の高さぶんずらしてある**
                                        （CSS の `.sc_th_group` / `.sc_th` を参照）。
                                        ⚠️ **高さを変えるなら両方直すこと。** 重なって読めなくなる。
                                */}
                                <tr>
                                    <th className="sc_th sc_th_group" colSpan={8}>担当営業別契約率</th>
                                    <th className="sc_th sc_th_group sc_group_reason" colSpan={reasonLabels.length}>
                                        担当変更理由
                                    </th>
                                </tr>
                                <tr>
                                    <SortHead label="営業名" keyName="name" width="150px" />
                                    <SortHead label="店舗" keyName="shop" width="150px" />
                                    <SortHead label="課" keyName="section" width="120px" />
                                    <SortHead label="商談顧客数" keyName="talk" align="right" width="86px" />
                                    <SortHead label="次アポ数" keyName="next" align="right" width="78px" />
                                    <SortHead label="次アポ率" keyName="nextRate" align="right" width="80px" />
                                    <SortHead label="契約数" keyName="contract" align="right" width="80px"
                                        note="顧客情報の状況が「契約済み」の人数" />
                                    <SortHead label="契約率" keyName="contractRate" align="right" width="78px"
                                        note="契約数 ÷ 商談顧客数" />

                                    {/* ⚠️ 担当変更理由。⚠️⚠️ **並びは ② が返す順をそのまま使う** */}
                                    {reasonLabels.map((label, index) => (
                                        <SortHead
                                            key={label}
                                            label={label}
                                            keyName={`${REASON_PREFIX}${label}`}
                                            align="right"
                                            width="84px"
                                            // ⚠️ 最初の1列だけ左に区切り線を入れて、区分の境目を示す
                                            divider={index === 0}
                                            note={`この営業が担当していたときに「${label}」で止まった顧客の人数（反響取得日で期間を判定）`}
                                        />
                                    ))}
                                </tr>
```

⚠️ 指示書の `<tr colspan={2}>` は ⚠️⚠️ **`<th colSpan={8}>` と `<th colSpan={8}>` の2セル**として実装した
（⚠️ `colSpan` は `<tr>` ではなく `<th>` の属性。⚠️ 意図（2つの区分に割る）はそのまま満たしている）。

### ⚠️ 本文のセル

```tsx
                                            {/* ⚠️ 担当変更理由。⚠️⚠️ **0は薄く出す**（空欄にしない。無記録と区別がつかなくなる） */}
                                            {reasonLabels.map((label, index) => {
                                                const count = row.reasons?.[label] ?? 0;
                                                return (
                                                    <td
                                                        key={label}
                                                        className={`sc_td sc_num sc_reason${count === 0 ? ' sc_zero' : ''}${index === 0 ? ' sc_divider' : ''}`}
                                                    >
                                                        {count}
                                                    </td>
                                                );
                                            })}
```

⚠️ 0件の行の `colSpan` も固定値をやめた。

```tsx
                                        {/* ⚠️ 列数は 8 ＋ 担当変更理由。⚠️ **固定値を書かない**（列が増えると崩れる） */}
                                        <td className="sc_empty" colSpan={8 + reasonLabels.length}>
                                            対象の営業がいません。
                                        </td>
```

### ⚠️⚠️ CSS（⚠️ **順序に意味がある**）

```css
                /* ⚠️ 見出しは下段（列）。⚠️⚠️ **上段が 28px あるぶん下げて貼り付ける。** */
                .sc_th { position: sticky; top: 28px; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 8px 10px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }

                /* ⚠️⚠️ **上段（区分）の高さを 28px に固定している。**
                      ⚠️ 下段の top: 28px がこの値に依存している。
                      ⚠️⚠️ **ここでバッククォートを使わないこと**（テンプレートリテラルが切れる）。
                      ⚠️ ⚠️ **片方だけ変えると見出しが重なって読めなくなる。**
                      ⚠️ padding ではなく height + line-height で決めているのは、
                        ⚠️ 高さを確実に 28px に保つため（padding だと字詰めで揺れる）。
                      ⚠️⚠️ **必ず .sc_th より後ろに置くこと。**
                        ⚠️ 同じ詳細度なので、前に置くと .sc_th の top: 28px に負けて
                        ⚠️ **上段まで 28px 下がり、見出しが重なる。** */
                .sc_th_group { top: 0; z-index: 4; height: 28px; line-height: 28px;
                               padding: 0 10px; text-align: center; background: #eef2f7;
                               color: #374151; letter-spacing: .04em; }
                /* ⚠️ 担当変更理由の区分。⚠️ 左の契約率と**別物だと一目で分かる色**にする */
                .sc_group_reason { background: #eef6ee; color: #2f5d3a; }

                /* ⚠️ 区分の境目。⚠️ 担当変更理由の**先頭の列だけ**に入る */
                .sc_divider { border-left: 2px solid #d7e3d9; }
```

```css
                /* ⚠️ 担当変更理由の数値。⚠️ 左の契約率の列と地色で分ける */
                .sc_reason { background: #fafdfa; color: #2f5d3a; }
                .sc_row:hover > .sc_reason { background: #f1f7f2; }
```

⚠️ `min-width` は `760px` → ⚠️ **`1480px`**（⚠️ 16列になったため）。

### ⚠️⚠️ 注記（指示どおり追加。⚠️ 消さないこと）

```tsx
                        {/* ⚠️⚠️ **この1行は 2026-10-02 の指示で入れたもの。消さないこと。**
                              ⚠️ 左の契約率が商談日・契約日で期間を見るのに対し、
                              ⚠️ ⚠️ **担当変更理由だけ反響取得日で見ている。**
                                ⚠️ 書いておかないと、同じ行の中で基準が違うことに気づけない。 */}
                        ※ <b>担当変更理由は反響取得日を基準に抽出</b>しています。
                        担当が変わる前の営業（変更前の担当）の件数として数えています。
```

---

## ③ `frontend/src/components/header/Header.tsx`

⚠️ 全画面メニューの配列に ⚠️ **1行足しただけ**。

```ts
        // ⚠️ 営業別契約率は 2026-10-02 に**担当変更理由の8列**が増えて**16列**になった。
        //   ⚠️ xl のままだと右半分が隠れて横スクロール頼みになる（2026-10-02 の指示で全画面）。
        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
        //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
        '日報/営業別契約率',
```

---

## 動作確認

### ⚠️ 型・ビルド

```bash
cd backend-express && npx tsc --noEmit     # -> エラーなし
cd frontend && npx react-scripts build     # -> Compiled with warnings
```

⚠️ 警告は ⚠️ **App.tsx など既存ファイルのもの**で、今回の2ファイルには1件も出ていない。
⚠️ ⚠️ **`frontend/tsconfig.json` の include が壊れているため（TS18003）、型検査は build でしか行えない。**

| 成果物 | |
|---|---|
| ⚠️⚠️ **`static/js/main.491bba8c.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ v2.2.155 から変更なし |

### ⚠️⚠️ 実データでの突合（⚠️ API と SQL を別々に出して照合）

⚠️ 全期間:

| 理由 | ⚠️ API | ⚠️ SQL |
|---|---|---|
| 失注 | 365 | 365 |
| 計画中止 | 218 | 218 |
| 計画延期 | 266 | 266 |
| ブラックリスト | 21 | 21 |
| 建築エリア外 | 5 | 5 |
| 物貰い | 130 | 130 |
| 連絡不能 | 219 | 219 |
| ⚠️ その他 | ⚠️ 2,017 | ⚠️ 2,017 |
| ⚠️⚠️ **合計** | ⚠️⚠️ **3,241** | ⚠️⚠️ **3,241** |

⚠️ 期間を 2026-04〜2026-06 に絞った場合:

| | 件数 |
|---|---|
| ⚠️ API | ⚠️ **799** |
| ⚠️ SQL | ⚠️ **799** |

⚠️⚠️ **一致。** ⚠️ 内訳は 失注96 / 計画中止68 / 計画延期80 / ブラックリスト8 /
⚠️ 建築エリア外0 / 物貰い47 / 連絡不能63 / ⚠️ その他437。

⚠️ ⚠️ **既存の列は変わっていない**（⚠️ 98名 / 商談3,521 / 契約867）。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`その他` が 2,017件（62%）と突出している。** ⚠️ 指示どおり列には入れたが、⚠️ **並べ替えの既定にすると他が見えなくなる**。⚠️ 既定は従来どおり商談顧客数の降順のまま |
| 2 | ⚠️⚠️ **左の契約率と右の理由は、母集団も日付の基準も違う。** ⚠️ 左＝現担当・商談日／契約日、⚠️ 右＝**前任・反響取得日**。⚠️ **足し引きできる数字ではない**。画面の注記で明示した |
| 3 | ⚠️ 前任が空の86件は ⚠️ **どの営業にも出ない**。⚠️ 合計3,462 → 画面合計3,241 の差（221件）は、⚠️ 前任が空か、⚠️ **報告対象の98名に居ない人** |
| 4 | ⚠️⚠️ **2段見出しの高さ 28px は CSS の2箇所が噛み合っている。** ⚠️ 片方だけ変えると重なる |
| 5 | ⚠️ 全画面にしたことで ⚠️ **左上に閉じるボタンが自動で出る**。⚠️ コンポーネント側には作っていない |
| 6 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（⚠️ API・集計値・ビルドは実データで確認済み） |
| 7 | ⚠️ ② の再ビルドが要る版である（⚠️ `staffContract.ts` を変更したため）。⚠️ **デプロイ手順書は別途** |
