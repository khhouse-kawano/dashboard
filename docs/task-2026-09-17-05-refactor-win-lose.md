# 指示（2026-09-17）　勝因・敗因まわりのリファクタリング

⚠️ 依頼: 「デプロイ＆ビルド前に再度リファクタリングを。⚠️ **バックエンドはフォールバックぶんまで**」

⚠️ 対象は v2.2.136 で入れた [task-2026-09-17-03](task-2026-09-17-03-win-lose-reason.md) ／
[task-2026-09-17-04](task-2026-09-17-04-lost-missing-fields.md) の分。⚠️ **動きは変えない**方針で点検した。

⚠️ 着手前に計画を提示し、⚠️ **「進めてよい」の承認を得ている。**

---

## ⚠️ 点検で見つかった2件（着手前に報告済み）

### ⚠️ 1. 失注判定の写しが ⚠️ **もう1か所あった**

⚠️ `frontend/src/components/Menu.tsx`（139〜151行）。⚠️ **前の指示で見落としていた5か所目。**

⚠️ ここは ⚠️ **② が件数を返さなかったときの予備の計算**である。
⚠️ 通常は `serverCounts` を使うので表に出ないが、⚠️ **① へ退避したときだけ古い基準の件数が出ていた。**

### ⚠️ 2. 失注理由の選択肢に ⚠️ **誤字**（既存の不具合）

| 場所 | 値 |
|---|---|
| `TableStatus.tsx`（入力側） | `音信不通` |
| ⚠️ `LostStatusList.tsx`（絞り込み） | ⚠️ **`音信普通`** |

⚠️ 実データは ⚠️ **`音信不通` が117件**。⚠️ つまり ⚠️ **失注リストで「音信普通」を選ぶと必ず0件**だった。

---

## ⚠️ 失注の対象期間（利用者からの確認に対する回答）

| 条件 | 内容 |
|---|---|
| ステータス | `失注` |
| ⚠️ 基準にする日付 | ⚠️ **反響取得日**（`step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99`）。⚠️ **失注日ではない** |
| 期間 | ⚠️ **2026-06-01 より後**（⚠️ `>` なので **6/1 当日は入らない**）かつ**今日より前** |
| 表示 | `show_dashboard = 1` |

⚠️ ⚠️ **`LostStatusList.tsx` の表2つの絞り込みだけ起点が `2026-01-01` になっている。**
⚠️ ただし ⚠️ **取得時に既に 6/1 で絞られている**ため、⚠️ **表示結果は変わらない**（厳しいほうが勝つ）。
⚠️ ⚠️ **起点そのものは変えていない。** 変えると件数が動くため、別の指示として扱う。

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | ⚠️ `informationUtils.ts` | ⚠️ **項目の定義を1か所に集約** |
| `frontend/src/components/information/` | `TableStatus.tsx` | ⚠️ ラベル・選択肢・列名を定数から取る |
| `frontend/src/components/` | `LostStatusList.tsx` | ⚠️ **誤字の解消**／列名を定数から |
| `frontend/src/components/` | ⚠️ `Menu.tsx` | ⚠️ **5か所目の判定を置換** |
| `backend-express/src/features/` | `menu.ts` | ⚠️ SQL を式の組み立てに分解 |
| `backend/src/handlers/` | ⚠️ `menu.php` | ⚠️ **② と同じ形に揃えた（フォールバック分）** |

## 追加した定数・関数

| 名前 | ファイル | 役割 |
|---|---|---|
| `LOST_REASON_KEY` / `COMPETITOR_KEY` | `informationUtils.ts` | 列名 |
| ⚠️ `LOST_REASON_OPTIONS` | `informationUtils.ts` | ⚠️ 失注理由の選択肢（⚠️ **誤字の解消**） |
| `LOST_TO_COMPETITOR` | `informationUtils.ts` | `'競合負け'` |
| ⚠️ `FIELD_LABEL` | `informationUtils.ts` | ⚠️ **項目キー → 画面の名前** |
| `lostFieldLabel()` | `informationUtils.ts` | 上の引き当て |
| ⚠️ `LOST_FIELDS` / `WIN_FIELDS` | `informationUtils.ts` | ⚠️ **未入力一覧と必須の唯一の定義** |
| `LostField` 型 | `informationUtils.ts` | `{ key, blocksSave }` |
| `isBlank()`（⚠️ **公開に変更**） | `informationUtils.ts` | 未入力の判定 |
| `REGISTER_DATE` / `isBlankSql()` / `LOST_REQUIRED_COLUMNS` | `menu.ts` | SQL の部品 |
| `$register_date` / `$is_blank_sql` / `$lost_required_columns` | ⚠️ `menu.php` | ⚠️ **② と1対1** |

---

## ⚠️ 中心になった考え方

### ⚠️ 「一覧に出す項目」と「保存を止める項目」は**わざと違う**

| 項目 | 一覧に出す | ⚠️ 保存を止める |
|---|---|---|
| 失注先 | ⚠️ **出す** | ⚠️ **止めない** |
| 他決理由 | ⚠️ **出す** | ⚠️ **止めない** |
| 敗因 | 出す | ⚠️ **止める** |
| 価格差 | 出す | ⚠️ **止める** |
| 今後の対策 | 出す | ⚠️ **止める** |

⚠️ 失注先・他決理由は指示書で「これまで同様」だったため、⚠️ **急に保存できなくすると既存の運用が止まる。**
⚠️ この差を `blocksSave` の1フラグで表し、⚠️ **`missingLostFields()` と `statusRequiredError()` を同じ配列から作る。**

### ⚠️ 任意の項目は `LOST_FIELDS` に入れない

⚠️ 他社営業・他社のキャンペーンは ⚠️ **任意**なので一覧に出さない。
⚠️ ⚠️ **入れると「埋めようのない項目」で要回答が永久に減らなくなる。**
⚠️ ただし ⚠️ **入力欄の見出しには名前が要る**ので、ラベルだけ `FIELD_LABEL` に持たせた。

---

## `frontend/src/utils/informationUtils.ts`（⚠️ 追加・変更した部分の**全文**）

```ts
/** 詳細な他決・失注理由（複数選択）の列 */
export const LOST_DETAIL_KEY = 'customized_input_01JRF9CZSW65A151WR30NA4PB3';

/** 失注理由の列 */
export const LOST_REASON_KEY = 'competitor_lost_contract_reason';

/** 競合他社（失注先）の列。⚠️ 契約済みの「競合を選択」も同じ列 */
export const COMPETITOR_KEY = 'competitor_name';

/**
 * 失注理由の選択肢。
 *
 * ⚠️⚠️ **入力側（TableStatus.tsx）と絞り込み側（LostStatusList.tsx）で共有する。**
 *   ⚠️ 以前は別々に書かれており、絞り込み側だけ **`音信普通`** という
 *     ⚠️ **誤字**になっていた（正しくは `音信不通`。実データ117件）。
 *   ⚠️ そのため**「音信普通」で絞ると必ず0件**だった（2026-09-17 に解消）。
 *
 * ⚠️ 並びは入力側に合わせてある。⚠️ **値を変えると既存データと突き合わなくなる。**
 */
export const LOST_REASON_OPTIONS = [
    '競合負け', '計画中止', '身内の反対', '音信不通', '建築エリア外', 'その他',
] as const;

/** ⚠️ 競合の情報を尋ねる失注理由。⚠️ これ以外では失注先も敗因も聞かない */
export const LOST_TO_COMPETITOR = '競合負け';

/**
 * 失注（競合負け）で埋めてほしい項目。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここが唯一の定義である。**
 *   ⚠️ 「未入力箇所の一覧」（`missingLostFields`）と
 *     「保存時の必須」（`statusRequiredError`）の**両方をここから作る**。
 *   ⚠️ 項目を足すときは**この配列に1行足すだけ**にすること。
 *
 * ⚠️⚠️ **`blocksSave` が2種類あるのは意図的である。**
 *   ⚠️ `true`  … 未入力だと**保存を止める**（2026-09-17 の指示で必須になったもの）
 *   ⚠️ `false` … 一覧には出すが**保存は止めない**
 *     ⚠️ 失注先・他決理由は指示で「これまで同様」だったため、
 *       ⚠️ **急に保存できなくすると既存の運用が止まる。**
 *
 * ⚠️ `label` は**画面にそのまま出る**。
 *   ⚠️ 一覧では「〇〇未入力」、保存時は「必須項目が未入力です:〇〇」になる。
 *   ⚠️ ⚠️ **TableStatus.tsx の入力欄の見出しもこの label を使う。**
 *     ⚠️ ここだけ変えると、一覧・警告・入力欄で名前が食い違う。
 * ─────────────────────────────────────────────
 */
export type LostField = { key: string; blocksSave: boolean };

/**
 * 項目キー → 画面に出す名前。
 *
 * ⚠️⚠️ **入力欄の見出し・一覧の「〇〇未入力」・保存時の警告が、すべてここを見る。**
 *   ⚠️ 名前を変えるときは**ここだけ**直すこと。
 * ⚠️ `competitor_name` は契約済みの画面では「競合」と出すが、
 *   ⚠️ **一覧では常に「失注先」**なのでこちらを正とする
 *   （契約済みの見出しは `competitorPicker('競合')` で個別に渡している）。
 */
export const FIELD_LABEL: Record<string, string> = {
    [COMPETITOR_KEY]: '失注先',
    [LOST_DETAIL_KEY]: '他決理由',
    [LOSE_REASON_KEY]: '敗因',
    [WIN_REASON_KEY]: '勝因',
    [PRICE_GAP_KEY]: '価格差',
    [SALES_PERSON_KEY]: '他社営業',
    [COUNTERMEASURE_KEY]: '今後の対策',
    [RIVAL_CAMPAIGN_KEY]: '他社のキャンペーン',
};

/** ⚠️ 項目キーから画面の名前を引く。⚠️ 見つからなければキーをそのまま返す */
export const lostFieldLabel = (key: string): string => FIELD_LABEL[key] ?? key;

/**
 * ⚠️⚠️ **一覧の「未入力箇所」に出す項目。並び順もこのとおりに出る。**
 *   ⚠️ **任意の項目（他社営業・他社のキャンペーン）は入れないこと。**
 *     ⚠️ 入れると**埋めようのない項目で要回答が減らなくなる。**
 */
export const LOST_FIELDS: LostField[] = [
    { key: COMPETITOR_KEY, blocksSave: false },
    { key: LOST_DETAIL_KEY, blocksSave: false },
    { key: LOSE_REASON_KEY, blocksSave: true },
    { key: PRICE_GAP_KEY, blocksSave: true },
    { key: COUNTERMEASURE_KEY, blocksSave: true },
];

/** ⚠️ 契約済みで埋めてほしい項目。⚠️ 勝因だけが必須（2026-09-17 の指示） */
export const WIN_FIELDS: LostField[] = [
    { key: WIN_REASON_KEY, blocksSave: true },
];

/**
 * 未入力とみなす値。
 *
 * ⚠️⚠️ **文字列の `'null'` も未入力である。**
 *   ⚠️ 一覧系の SQL は `COALESCE(..., '')` を通すが、
 *     ⚠️ **DB に文字列として `null` が入っている行が実在する。**
 *   ⚠️ `!value` だけでは拾えない。
 * ⚠️ 空白だけの入力も未入力として扱う。
 */
export const isBlank = (value: unknown): boolean => {
    const text = String(value ?? '').trim();
    return text === '' || text === 'null';
};

/**
 * 失注の「未入力箇所」。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **失注の要回答判定は、以前この5か所に写されていた。**
 *     frontend/src/components/Menu.tsx（② が数えなかったときの予備）
 *     frontend/src/components/database/DatabaseOrder.tsx（loseLength）
 *     frontend/src/components/LostStatusList.tsx（一覧の絞り込み・表示で計3回）
 *   ⚠️ **2026-09-17 にここへ集約した。** ⚠️ 判定を足すときはここだけ直す。
 *
 * ⚠️⚠️ **② の menu.ts / ① の menu.php にも同じ判定が SQL である。**
 *   ⚠️ 言語が違うので共有できない。⚠️ **3つとも直すこと。**
 *
 * ⚠️⚠️ **`競合負け` 以外では、失注理由さえ入っていれば未入力なし。**
 *   ⚠️ 計画中止・音信不通などで競合の情報を求めない。
 *
 * ⚠️ 返すのは**画面に出すラベルの配列**。⚠️ **空配列なら未入力なし。**
 * ⚠️ 期間の絞り込み（2026-06-01 以降）は**ここではしない。** 呼び出し側の仕事である。
 * ─────────────────────────────────────────────
 */
export const missingLostFields = (item: Record<string, unknown>): string[] => {
    if (isBlank(item[LOST_REASON_KEY])) return ['失注理由'];

    if (item[LOST_REASON_KEY] !== LOST_TO_COMPETITOR) return [];

    return LOST_FIELDS.filter(f => isBlank(item[f.key])).map(f => lostFieldLabel(f.key));
};

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
 * ⚠️⚠️ **判定に使うのは `LOST_FIELDS` / `WIN_FIELDS` の `blocksSave` だけ。**
 *   ⚠️ ⚠️ **一覧に出る項目と、保存を止める項目はわざと違う。**
 *     ⚠️ 失注先・他決理由は一覧に出すが**保存は止めない**（従来の運用を壊さないため）。
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

    /** ⚠️ 並び順のまま最初の1つを返す。⚠️ 一度に1項目だけ知らせる */
    const firstMissing = (fields: LostField[]): string | null => {
        const found = fields.find(f => f.blocksSave && isBlank(information[f.key]));
        return found === undefined ? null : lostFieldLabel(found.key);
    };

    if (status === '契約済み') return firstMissing(WIN_FIELDS);

    if (status === '失注' && information[LOST_REASON_KEY] === LOST_TO_COMPETITOR) {
        return firstMissing(LOST_FIELDS);
    }

    return null;
};

```

---

## `backend-express/src/features/menu.ts`（⚠️ 差し替えた全文）

```ts
/**
 * 反響取得日を 'YYYY-MM-DD' に揃える式。
 *
 * ⚠️⚠️ **本番データに '/' 区切りと '-' 区切りが混在している。**
 *   ⚠️ 片方だけだと `STR_TO_DATE` が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ ① の menu.php と**同じ2段構え**にしてある。
 */
const REGISTER_DATE = `
  COALESCE(
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
  )`;

/**
 * その列が未入力か。
 *
 * ⚠️⚠️ **`'null'` という文字列が実データに入っている。** 空文字と同じ扱いにする。
 *   ⚠️ `IS NULL` では拾えない。⚠️ フロントの `isBlank()` と同じ考え方である。
 * ⚠️ 空白だけの入力も未入力として扱うため `TRIM` を通す。
 *
 * ⚠️ 列名は**この関数の呼び出し側で決め打ちしたものしか渡さない。**
 *   ⚠️ 外部からの値を渡さないこと（SQL に直接埋め込むため）。
 */
const isBlankSql = (column: string): string =>
    `TRIM(COALESCE(${column}, '')) IN ('', 'null')`;

/**
 * 失注（競合負け）で埋めてほしい列。
 *
 * ⚠️⚠️ **フロントの `LOST_FIELDS`（informationUtils.ts）と同じ並び・同じ顔ぶれにすること。**
 *   ⚠️ 食い違うと、**メニューのバッジと失注一覧の件数が合わなくなる。**
 * ⚠️ ① の menu.php にも同じ一覧がある（計3か所）。**3つとも直すこと。**
 */
const LOST_REQUIRED_COLUMNS = [
    'competitor_name',
    'customized_input_01JRF9CZSW65A151WR30NA4PB3',
    'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
    // ⚠️ 2026-09-17 に追加（価格差・今後の対策）
    'competitor_price_gap',
    'competitor_countermeasure',
];

/**
 * 失注したが理由が埋まっていない顧客。
 *
 * ⚠️ 条件は次のどちらかに当たれば「未記入」。
 *     ① 失注理由そのものが無い
 *     ② 理由が「競合負け」なのに `LOST_REQUIRED_COLUMNS` のどれかが空
 *
 * ⚠️⚠️ **2026-09-17 に価格差・今後の対策を足したため件数が増える。**
 *   ⚠️ ローカルの実測（対象283件）で **39件 → 108件**。
 *   ⚠️ 新しい列なので**既存は全件が空**である。**不具合ではない。**
 *
 * ⚠️ 期間は**反響取得日**が 2026-06-01 より後、かつ今日より前。
 *   ⚠️ **失注した日ではない。** ⚠️ フロントの各画面も同じ起点である。
 */
const LOST_SQL = `
  SELECT COUNT(*) AS c
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(status, '') = '失注'
     AND ${REGISTER_DATE} > '2026-06-01'
     AND ${REGISTER_DATE} < NOW()
     AND (
          ${isBlankSql('competitor_lost_contract_reason')}
       OR (competitor_lost_contract_reason = '競合負け'
           AND (${LOST_REQUIRED_COLUMNS.map(isBlankSql).join('\n             OR ')}))
     )
`;
```

---

## ⚠️ `backend/src/handlers/menu.php`（⚠️ **フォールバック分**・差し替えた全文）

⚠️⚠️ **② と1対1で見比べられる形にした**のが今回の主眼である。

```php
/**
 * 反響取得日を 'YYYY-MM-DD' に揃える式。
 *
 * ⚠️⚠️ **本番データに '/' 区切りと '-' 区切りが混在している。**
 *   ⚠️ 片方だけだと STR_TO_DATE が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ ② の backend-express/src/features/menu.ts の REGISTER_DATE と同じもの。
 */
$register_date = "
      COALESCE(
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
      )";

/**
 * その列が未入力かを表す式。
 *
 * ⚠️⚠️ **'null' という文字列が実データに入っている。** 空文字と同じ扱いにする。
 *   ⚠️ IS NULL では拾えない。⚠️ ② の isBlankSql() と同じ考え方である。
 * ⚠️ 空白だけの入力も未入力として扱うため TRIM を通す。
 *
 * ⚠️ 列名は**この関数の呼び出し側で決め打ちしたものしか渡さない。**
 *   ⚠️ 外部からの値を渡さないこと（SQL に直接埋め込むため）。
 */
$is_blank_sql = function ($column) {
    return "TRIM(COALESCE($column, '')) IN ('', 'null')";
};

/**
 * 失注（競合負け）で埋めてほしい列。
 *
 * ⚠️⚠️ **② の LOST_REQUIRED_COLUMNS、フロントの LOST_FIELDS と
 *   同じ並び・同じ顔ぶれにすること。**
 *   ⚠️ 食い違うと、**メニューのバッジと失注一覧の件数が合わなくなる。**
 */
$lost_required_columns = [
    'competitor_name',
    'customized_input_01JRF9CZSW65A151WR30NA4PB3',
    'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
    // ⚠️ 2026-09-17 に追加（価格差・今後の対策）
    'competitor_price_gap',
    'competitor_countermeasure',
];

$lost_blank_conditions = implode("\n             OR ", array_map($is_blank_sql, $lost_required_columns));

// 失注したが理由が埋まっていない顧客。
// ⚠️ 条件は次のどちらかに当たれば「未記入」。
//     ① 失注理由そのものが無い
//     ② 理由が「競合負け」なのに $lost_required_columns のどれかが空
// ⚠️ 期間は**反響取得日**が 2026-06-01 より後、かつ今日より前（失注日ではない）。
$sql_lost = "SELECT COUNT(*) AS c
        FROM master_data
       WHERE show_dashboard = 1
         AND COALESCE(status, '') = '失注'
         AND $register_date > '2026-06-01'
         AND $register_date < NOW()
         AND (
              " . $is_blank_sql('competitor_lost_contract_reason') . "
           OR (competitor_lost_contract_reason = '競合負け'
               AND ($lost_blank_conditions))
         )";
```

---

## `frontend/src/components/Menu.tsx`（⚠️ 5か所目・置換後）

```tsx
            /**
             * ⚠️⚠️ **判定は informationUtils の `missingLostFields()` に集約した**
             *   （2026-09-17）。⚠️ 以前はここに条件が写されており、
             *   ⚠️ **② が数えなかったときだけ古い基準の件数が出ていた。**
             * ⚠️ ここで条件を書き足さないこと。
             */
            return target < today && base < target && item.status === '失注' && missingLostFields(item).length > 0 && Number(item.trash) === 1;
```

## `frontend/src/components/information/TableStatus.tsx`（⚠️ 変更点）

⚠️ `freeField()` から ⚠️ **ラベル引数を外した**（`FIELD_LABEL` から引くため）。

```tsx
    const freeField = (
        itemKey: string,
        required: boolean,
        type: 'text' | 'number' | 'textarea',
        placeholder = ''
    ) => {
        /**
         * ⚠️⚠️ **見出しは `LOST_FIELDS` / `WIN_FIELDS` の label を引く。**
         *   ⚠️ ここに文字列を手書きすると、
         *     ⚠️ **一覧の「〇〇未入力」・保存時の警告と名前が食い違う。**
         */
        const label = lostFieldLabel(itemKey);
        const value = safeFormate(information[itemKey]);
        // ⚠️ 判定は informationUtils と同じものを使う（'null' も空として扱う）
        const empty = isBlank(value);
```

⚠️ 失注理由の選択肢も共有に変えた。

```tsx
                            {/* ⚠️ 選択肢は informationUtils と共有する。⚠️ **ここに書き足さないこと** */}
                            {LOST_REASON_OPTIONS.map(reason => (
                                <option value={reason} key={reason}>{reason}</option>
                            ))}
```

⚠️ 直書きの列名 `competitor_lost_contract_reason` と文字列 `'競合負け'` を
⚠️ **`LOST_REASON_KEY` / `LOST_TO_COMPETITOR` に置き換えた。**

## `frontend/src/components/LostStatusList.tsx`（⚠️ 変更点）

```tsx
                                {/**
                                  * ⚠️⚠️ **選択肢は informationUtils と共有する**（2026-09-17）。
                                  *   ⚠️ 以前はここに手書きされており、**`音信普通`** という
                                  *     ⚠️ **誤字**だった（正しくは `音信不通`。実データ117件）。
                                  *   ⚠️ そのため**この理由で絞ると必ず0件**になっていた。
                                  */}
                                {LOST_REASON_OPTIONS.map(reason =>
                                    <option value={reason} key={reason}>{reason}</option>
                                )}
```

---

## 検証

### ⚠️⚠️ リファクタリング前後で件数が変わらないこと

| 確認 | 結果 |
|---|---|
| 稼働中の ② の `menu` | ⚠️ **`lost: 108`**（⚠️ **リファクタリング前と同じ**） |
| ① の `menu.php` が組み立てる SQL | ⚠️ **② と同じ式**であることを出力して確認 |

### ⚠️⚠️ フロントの判定と SQL が一致すること

⚠️ `informationUtils.ts` を単体で JS に変換し、⚠️ **SQL と同じ283件を通した。**

| | 件数 |
|---|---|
| 対象 | 283件 |
| ⚠️ **未入力あり** | ⚠️ **108件**（⚠️ **SQL と完全一致**） |

⚠️ 内訳（延べ）

| 項目 | 件数 |
|---|---|
| 価格差 | 105 |
| 今後の対策 | 105 |
| 敗因 | 25 |
| 失注先 | 23 |
| 他決理由 | 13 |
| 失注理由 | 3 |

### ビルド・型

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（② Express） | ⚠️ **エラー0** |
| `npm run build`（フロント） | ⚠️ **成功**（`Compiled with warnings.`） |
| ⚠️ 追加した警告 | ⚠️ **無し**（⚠️ 出ているものは**すべて改修前からある**） |
| `php -l`（`menu.php`） | ⚠️ **構文エラーなし** |

### ⚠️ 未実施

| # | 確認 | 期待 |
|---|---|---|
| 1 | 失注リストで ⚠️ **「音信不通」で絞る** | ⚠️ **件数が出る**（⚠️ 従来は必ず0件） |
| 2 | 顧客詳細の失注理由の選択肢 | ⚠️ **6つとも従来どおり** |
| 3 | 入力欄の見出し | ⚠️ **「価格差」「敗因」「今後の対策」「他社のキャンペーン」**（⚠️ キー名が出ていないこと） |
| 4 | ⚠️ ② を止めてメニューを開く | ⚠️ **反響一覧のバッジと同じ件数**（⚠️ 予備の計算） |

---

## ⚠️ やらなかったこと（計画どおり）

| # | 内容 | 理由 |
|---|---|---|
| 1 | `lostList` と `database(order)` の SELECT 列の共通化 | ⚠️ **移植元の PHP と1対1で見比べられなくなる** |
| 2 | `menu.ts` と `menu.php` の SQL 統合 | ⚠️ **言語が違うので共有できない。** 形を揃えるまでにとどめた |
| 3 | 失注理由の値そのものの整理（⚠️ NULL が1,179件） | ⚠️ **DB の中身の話。** 利用者の判断が要る |
| 4 | ⚠️ 起点（2026-06-01）の見直し | ⚠️ **件数が動く。** 別の指示として扱う |

---

## ⚠️ 残作業（デプロイ）

| 順 | 作業 |
|---|---|
| 1 | ⚠️ ① の phpMyAdmin で **`2026-09-17_master_data_win_lose.sql`** |
| 2 | `v2.2.136` を push → PR → `production` |
| 3 | ⚠️ ② VPS で Express を再ビルド |
| 4 | ⚠️ ① へフロント ⚠️ **＋ PHP 3ファイル**（`menu.php` / `lostList.php` / `database_order.php`） |
| 5 | ⚠️ ① の phpMyAdmin で **`2026-09-17_update_log_2.2.136.sql`** |

⚠️⚠️ **1 を最初に。** ⚠️ 列が無いまま PHP を上げると ⚠️ **`Unknown column` でメニューと一覧が開かなくなる。**

---

## ⚠️ 追補（2026-09-17）　価格差の単位を「万円」と明示

⚠️ 依頼: 「価格差については入力値そのまま？ であれば**万円を input タグの横などにも追記**してほしい／
**またコメントにも追加する**／**バージョンは変えないでいい**」

### ⚠️ 回答

⚠️⚠️ **入力値をそのまま保存している。換算していない。**
⚠️ `competitor_price_gap` は TEXT で、`input` の値をそのまま `bindValue` するだけである。
⚠️ 案内はプレースホルダの「他社との差額（円）」だけで、⚠️ **入力すると消えて分からなくなっていた。**

### 変更

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | `informationUtils.ts` | ⚠️ **`PRICE_GAP_UNIT` を追加**（`'万円'`） |
| `frontend/src/components/information/` | `TableStatus.tsx` | ⚠️ `freeField()` に `unit` を追加。⚠️ **欄の右横に出す** |
| `backend/scripts/sql/` | `2026-09-17_master_data_win_lose.sql` | ⚠️ **列コメントに「（万円）」** |
| `docs/` | `deploy-v2.2.136.md` | ⚠️ 手順と確認項目に反映 |

⚠️ ⚠️ **`version.ts` は `2.2.136` のまま**（指示）。

### 追加した定数

```ts
/**
 * 価格差の単位。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **入力値はそのまま保存する。単位の換算はしていない。**
 *   ⚠️ `competitor_price_gap` は TEXT で、⚠️ **画面に打った数字がそのまま入る。**
 *   ⚠️ そのため ⚠️ **この表示だけが「何の単位か」を決めている。**
 *
 * ⚠️⚠️ **ここを変えると、既に入力済みのデータの意味まで変わる。**
 *   ⚠️ 例）`500` は「500万円」から「500円」になってしまう。
 *   ⚠️ 変えるときは**既存データの換算を必ず併せて考えること。**
 *
 * ⚠️ 契約済み側と失注側の**両方**がこれを使う（同じ列に入るため）。
 * ⚠️ ⚠️ **プレースホルダには書かない。** 入力すると消えて分からなくなる。
 * ─────────────────────────────────────────────
 */
export const PRICE_GAP_UNIT = '万円';
```

### `freeField()` の入力欄（変更後）

```tsx
                ) : (
                    <div className="d-flex align-items-center gap-2">
                        <input
                            type={type}
                            placeholder={placeholder}
                            className="form-control form-control-sm"
                            style={{ fontSize: '12px', maxWidth: type === 'number' ? '200px' : '100%' }}
                            value={value}
                            onChange={(e) => change(e.target.value)}
                        />
                        {/**
                          * ⚠️⚠️ **単位は欄の横に出す。プレースホルダに書かない**（2026-09-17 の指示）。
                          *   ⚠️ プレースホルダは**入力すると消える**ため、
                          *     ⚠️ **あとから見た人に単位が分からない。**
                          *   ⚠️⚠️ **入力値はそのまま保存される（変換しない）。**
                          *     ⚠️ 単位の表示を変えるときは、**既存データの意味も変わる**ことに注意。
                          */}
                        {unit !== '' && (
                            <span className="text-secondary text-nowrap" style={{ fontSize: '12px' }}>{unit}</span>
                        )}
                    </div>
                )}
```

⚠️ 呼び出しは**2か所とも同じ単位**にしてある（⚠️ **同じ列に入るため**）。

```tsx
                    {/* ⚠️ 単位は欄の横に出す。⚠️ **入力値はそのまま保存される** */}
                    {freeField(PRICE_GAP_KEY, false, 'number', '他社との差額', PRICE_GAP_UNIT)}
```

```tsx
                                    {/* ⚠️ 単位は契約済み側と必ず同じにする（同じ列に入るため） */}
                                    {freeField(PRICE_GAP_KEY, true, 'number', '他社との差額', PRICE_GAP_UNIT)}
```

### DB のコメント

```sql
  ADD COLUMN competitor_price_gap       TEXT DEFAULT NULL COMMENT '競合との価格差（万円）。入力値そのまま。契約済み=任意／失注=必須',
```

⚠️⚠️ **既に ALTER を流したあと**でコメントだけ足す場合は、SQL ファイル末尾のこちらを使う。
⚠️ `ADD COLUMN` をもう一度流すと `Duplicate column name` で失敗する。

```sql
ALTER TABLE master_data
  MODIFY competitor_price_gap TEXT DEFAULT NULL COMMENT '競合との価格差（万円）。入力値そのまま。契約済み=任意／失注=必須';
```

### 検証

| 確認 | 結果 |
|---|---|
| ローカルDBへ `MODIFY` を適用 | ⚠️ **コメントに「（万円）」が入った**（`SHOW FULL COLUMNS` で確認） |
| ⚠️ 型・既定値 | ⚠️ **`text` / `Null=YES` / `Default=NULL` のまま** |
| `npm run build` | ⚠️ **成功**（追加した警告なし） |
| ⚠️ `version.ts` | ⚠️ **`2.2.136` のまま** |

⚠️ ⚠️ **画面での確認は未実施**（欄の右に「万円」が出ること・入力しても消えないこと）。
