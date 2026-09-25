# 2026-09-25 (2) Nexus 移行のためのフリガナ・顧客名の整備（v2.2.149）

## 依頼

`ReadMeClaude.md`（v2.2.149）より。

> Dashboard は現在 **Nexus** という別の自社システムと連携しているが、顧客データを移行するうえでいくつかのルールがある
> 1. 顧客のふりがなが **カタカナ**
> 2. 顧客名の姓名間に **半角スペース**
> 1・2 を満たせば `isNexus=true` 等の関数を準備

- ⚠️ **連絡先や住所は顧客によって取得できないケースもある**（予約なく面談してヒアリングできなかった等）ので判定に入れない。
- 顧客名の注意書き（`InformationEditKaeru.tsx` 参考）は ⚠️ **オーナーがのちほど対応する**ため今回は入れていない。
- エージェントの担当は ⚠️ **置換用SQLの準備・ローカルDBでの実行・登録時の置換処理**。

## オーナー確認（2026-09-25）

| 論点 | 回答 |
|---|---|
| `isNexus` が見る欄 | ⚠️ **氏名①・フリガナ①のみ**（氏名②は空が多く、含めると大半が false になる） |
| `list/` の置換処理 | ⚠️ **3つすべて**（ListOrder / ListKaeru / ListResale） |
| `information/` と `database/` | ⚠️⚠️ **Order のみ。** ⚠️ **建売分譲・中古リノベは含まない** |

---

## 追加したファイル

### 1. `frontend/src/utils/nexusUtils.ts`（新規）

```ts
/**
 * Nexus（自社の別システム）へ顧客データを移行できる形かどうかを判定する。
 *
 * ⚠️⚠️ **移行のルールは2つだけ**（2026-09-25 の指示）。
 *   1. ふりがなが **カタカナ**
 *   2. 顧客名の姓名間に **半角スペース**
 *
 * ⚠️ **連絡先・住所は判定に入れないこと。**
 *   予約なしで来場した顧客など、**聞き取れずに空のままになる欄**である。
 *   必須にすると入力できない顧客が出る。
 *
 * ⚠️ 判定するのは **氏名①・フリガナ①だけ**（2026-09-25 にオーナーが指定）。
 *   氏名②（配偶者など）は空のことが多く、含めると大半が false になる。
 *
 * ⚠️ 対象は **注文事業のみ**。建売分譲・中古リノベの画面には入れていない。
 */

/** ひらがな。⚠️ `ゝ ゞ`（U+309D/309E）は下の KANA_ITERATION で別に扱う */
const HIRAGANA_RANGE = /[ぁ-ゖ]/u;

/**
 * ひらがな → カタカナ。
 *
 * ⚠️ `ぁ-ゖ` に **0x60 を足すだけ**でカタカナになる
 *   （小書きの ぁぃぅ、濁点つきの がざだば、`ゔ` もこの範囲に入る）。
 * ⚠️ 繰り返し記号だけは範囲外なので個別に置き換える。
 * ⚠️ **長音符（ー）・中黒（・）・スペースはそのまま残す。**
 */
const KANA_ITERATION: Record<string, string> = {
    'ゝ': 'ヽ', // ゝ → ヽ
    'ゞ': 'ヾ', // ゞ → ヾ
};

export const hiraToKata = (value: string): string =>
    (value ?? '')
        .replace(/[ぁ-ゖ]/gu, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
        .replace(/[ゝゞ]/gu, (char) => KANA_ITERATION[char] ?? char);

/** ひらがなが1文字でも混ざっているか。⚠️ 空文字は false（未入力は咎めない） */
export const hasHiragana = (value: string): boolean =>
    HIRAGANA_RANGE.test(value ?? '') || /[ゝゞ]/u.test(value ?? '');

/**
 * カタカナだけで書かれているか。
 *
 * ⚠️ 許すのは **カタカナ・長音符・中黒・スペース**だけ。
 *   ⚠️ 空文字は false を返す（移行できる形ではないため）。
 */
export const isKatakanaOnly = (value: string): boolean => {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;
    return /^[ァ-ヺーヽヾ・\s　]+$/u.test(trimmed);
};

/**
 * 姓名が半角スペースで分かれているか。
 *
 * ⚠️⚠️ **全角スペースは通さない。** Nexus 側が半角しか受け付けない。
 * ⚠️ 前後の空白は数えない（`' 国分太郎'` は分かれていない）。
 */
export const hasHalfWidthSpace = (value: string): boolean => {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;
    return / /u.test(trimmed);
};

/**
 * Nexus へ移行できる顧客か。
 *
 * ⚠️ 画面では **この結果でアイコンを出すだけ**である。
 *   保存を止めるのは handleSave 側の個別チェック（文言が項目ごとに違うため）。
 */
export const isNexus = (information: Record<string, string>): boolean =>
    hasHalfWidthSpace(information?.customer_contacts_name ?? '')
    && isKatakanaOnly(information?.customer_contacts_name_kana ?? '');

/** 一覧の行（`customer` / `customer_contacts_name_kana`）用。⚠️ 中身の判定は isNexus と同じ */
export const isNexusRow = (name?: string, kana?: string): boolean =>
    hasHalfWidthSpace(name ?? '') && isKatakanaOnly(kana ?? '');

/** ⚠️ 指示書の文言そのまま。変えるときはオーナーに確認すること */
export const NEXUS_ALERT_SPACE = '姓名間に半角スペースを入力すること。例）×国分太郎 〇国分 太郎';
export const NEXUS_ALERT_KANA = 'ふりがなはカタカナで入力すること。';
```

### 2. `frontend/src/components/NexusBadge.tsx`（新規コンポネント）

⚠️⚠️ **2026-09-25 に見た目を2度直している。**
⚠️ 当初は角丸の「Nexus」タグだったが、⚠️ **リンクに見える**との指摘で ⚠️ **丸囲みの `N`** にした。
⚠️ ただし ⚠️ **顧客情報編集の見出しだけは文字で「Nexus連携済み」**（オーナー指定）。

```tsx
import React from 'react';

/**
 * Nexus（自社の別システム）へ移行できる顧客に付けるアイコン。
 *
 * ⚠️ 出すかどうかは呼び出し側が `isNexus()` / `isNexusRow()` で決める。
 *   ⚠️ **このコンポネント自身は判定しない**（画面ごとにデータの形が違うため）。
 *
 * ⚠️⚠️ **角丸の「Nexus」タグにしないこと**（2026-09-25 の指示）。
 *   ⚠️ 文字を四角で囲むと **リンクかボタンに見える。**
 *   ⚠️ **押しても何も起きない**ので、問い合わせのもとになる。
 *   ⚠️ 大文字の `N` を**ネイビーの丸で囲む**形で固定する。
 *
 * ⚠️ Nexus へ直接リンクする案は **2026-09-25 に見送った。**
 *   ⚠️ Nexus 側の ID は **乱数の UUID** で、Dashboard の ULID からは導けない。
 *   ⚠️ **対応表を持たないかぎりリンクは作れない**（作るなら列の追加が要る）。
 */
type Props = {
    /** 余白の付け方が画面ごとに違うので外から渡す（例: 'me-1' / 'mt-1'） */
    className?: string;
    /**
     * 文字で出すときの文言。
     *
     * ⚠️ 渡さなければ **丸囲みの `N`**（一覧の行に置く形）。
     * ⚠️ 渡すと **その文字を入れた帯**になる（顧客情報編集の見出しに置く形）。
     *   ⚠️⚠️ **一覧の行には渡さないこと。** 行が横に伸びてリンクに見える。
     */
    label?: string;
};

/** ⚠️ 丸の直径。⚠️ **文字サイズと揃えること**（ずらすと楕円になる） */
const CIRCLE_SIZE = '14px';

/** ⚠️ 顧客データベースの凡例に出す文言（2026-09-25 の指示どおり） */
export const NEXUS_LEGEND_LABEL = '国分Nexus連携済み';
/** ⚠️ 顧客情報編集の見出しに出す文言（⚠️ **こちらは「国分」を付けない**） */
export const NEXUS_HEADER_LABEL = 'Nexus連携済み';

const BASE_STYLE = {
    backgroundColor: '#1b2a56',
    color: '#ffffff',
    fontSize: '9px',
    lineHeight: 1,
    verticalAlign: 'middle' as const
};

const NexusBadge = ({ className, label }: Props) => (
    label === undefined
        ? (
            <span
                className={`d-inline-flex align-items-center justify-content-center rounded-circle fw-bold ${className ?? ''}`}
                style={{ ...BASE_STYLE, width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
                title={NEXUS_LEGEND_LABEL}
            >
                N
            </span>
        )
        : (
            <span
                className={`d-inline-block rounded fw-bold ${className ?? ''}`}
                style={{ ...BASE_STYLE, letterSpacing: '0.5px', padding: '2px 6px', whiteSpace: 'nowrap' }}
            >
                {label}
            </span>
        )
);

export default NexusBadge;
```

### 2-b. `frontend/src/components/database/GiftMark.tsx`（⚠️ **凡例を1つ増やした**）

⚠️ `GiftLegend` に `nexus` を足した。⚠️⚠️ **注文事業だけ true にすること。**

```tsx
import NexusBadge, { NEXUS_LEGEND_LABEL } from '../NexusBadge';

type GiftLegendProps = {
    /**
     * ⚠️ Nexus アイコンの説明も並べる。
     *   ⚠️⚠️ **注文事業（DatabaseOrder）だけ true にすること。**
     *     ⚠️ 建売分譲にはこのアイコンを出していないので、
     *       ⚠️ **凡例だけ出すと「どこにも無い印」の説明になる。**
     */
    nexus?: boolean;
};

/** テーブル上部に置く凡例 */
export const GiftLegend = ({ nexus }: GiftLegendProps) => (
    <div className="d-flex align-items-center" style={{ fontSize: '10px', gap: '12px' }}>
        <span>
            <i
                className="fa-solid fa-circle me-1 text-success"
                style={{ fontSize: DOT_SIZE, verticalAlign: 'middle' }}
            />
            {GREEN_LABEL}
        </span>
        <span>
            <i
                className="fa-solid fa-circle me-1 text-danger"
                style={{ fontSize: DOT_SIZE, verticalAlign: 'middle' }}
            />
            {RED_LABEL}
        </span>
        {nexus && (
            <span className="d-flex align-items-center">
                <NexusBadge className="me-1" />
                {NEXUS_LEGEND_LABEL}
            </span>
        )}
    </div>
);
```

### 3. `backend/scripts/sql/2026-09-25_kana_to_katakana.sql`（新規・生成物）

⚠️ 手書きでは必ず取りこぼすため ⚠️ **スクリプトで生成した。**

構成:

| 手順 | 内容 |
|---|---|
| 1-1 | ⚠️ **これから変換される件数**を数える |
| 1-2 | ⚠️⚠️ **半角カナの件数**（⚠️ **このSQLでは直らない**） |
| 2 | ⚠️ **退避テーブル** `master_data_kana_backup_20260925` を作る |
| 3-1〜3-12 | ⚠️ **UPDATE を12本に分割**（⚠️ `REPLACE` を88重ねるとパーサ深度に当たるため16文字ずつ） |
| 4 | ⚠️⚠️ **検証（すべて 0 になること）** |
| （コメント） | ⚠️ **戻し方**と ⚠️ **退避テーブルの後片付け** |

⚠️ 変換対象は `master_data` の `customer_contacts_name_kana` と `customer_contacts_name_kana_2` のみ。
⚠️ **漢字・英字・半角カナ・全角スペース・中黒には触らない。**
⚠️ **何度実行しても同じ結果になる**（カタカナはもう置換されない）。

UPDATE の形（1本目）:

```sql
UPDATE master_data
   SET customer_contacts_name_kana = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_contacts_name_kana, 'ぁ', 'ァ'), 'あ', 'ア'), 'ぃ', 'ィ'), 'い', 'イ'), 'ぅ', 'ゥ'), 'う', 'ウ'), 'ぇ', 'ェ'), 'え', 'エ'), 'ぉ', 'ォ'), 'お', 'オ'), 'か', 'カ'), 'が', 'ガ'), 'き', 'キ'), 'ぎ', 'ギ'), 'く', 'ク'), 'ぐ', 'グ')
 WHERE customer_contacts_name_kana REGEXP '[ぁ-ゖゝゞ]';
```

### 4. `backend/scripts/sql/2026-09-25_update_log_2.2.149.sql`（新規）

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.149', '2026-09-25', '顧客情報の登録時に、顧客名の姓名間の半角スペースとフリガナのカタカナを確認するようにした。Nexusへ移行できる顧客にアイコンを表示する。');
```

---

## 修正したファイル

### 5. `frontend/src/components/information/InformationEdit.tsx`

**(a) import を2行追加**

```tsx
import NexusBadge from '../NexusBadge';
import { isNexus, hasHalfWidthSpace, hasHiragana, NEXUS_ALERT_SPACE, NEXUS_ALERT_KANA } from '../../utils/nexusUtils';
```

**(b) `handleSave` — `statusRequiredError()` の直後に検査を追加**

```tsx
        /**
         * ⚠️⚠️ **Nexus へ移行できる形かどうかの検査**（2026-09-25 の指示）。
         *   ⚠️ 顧客名とフリガナは**こちらでコントロールできる**ので保存前に止める。
         *     ⚠️ **連絡先・住所は止めないこと。** 聞き取れずに空のままになる顧客がいる。
         *   ⚠️ 見るのは **氏名①・フリガナ①だけ**。氏名②は空のことが多い。
         *   ⚠️ 判定と文言は utils/nexusUtils.ts に置いてある。
         */
        if (!hasHalfWidthSpace(information.customer_contacts_name ?? '')) {
            alert(NEXUS_ALERT_SPACE);
            return;
        }
        if (hasHiragana(information.customer_contacts_name_kana ?? '')) {
            alert(NEXUS_ALERT_KANA);
            return;
        }
```

⚠️ 置いた場所が ⚠️ **`setSending(false)` より前**であること。⚠️ 後ろに置くと ⚠️ **保存ボタンが押せないまま戻る。**

**(c) `Modal.Header` — アイコンを付ける**

⚠️ import は `import NexusBadge, { NEXUS_HEADER_LABEL } from '../NexusBadge';`

```tsx
                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }} className='d-flex align-items-center'>
                    {/* ⚠️ 見出しは**文字で「Nexus連携済み」**（2026-09-25 の指示）。⚠️ 一覧の丸囲み `N` とは形が違う */}
                    {id !== 'new' && isNexus(information) && <NexusBadge className='me-1' label={NEXUS_HEADER_LABEL} />}
                    {id === 'new' ? <div>新規顧客登録 </div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div>
                    <div style={{ background: 'rgb(233, 233, 233)', fontSize: '11px' }} className='ms-1 fw-bold p-1 rounded'>※着色部分は特典進呈申請の際の必須項目</div>
                </Modal.Header>
```

**(d) placeholder**

| 前 | 後 |
|---|---|
| `defaultValue='ふりがな①'` | ⚠️ **`defaultValue='フリガナ①'`** |
| `defaultValue='ふりがな②'` | ⚠️ **`defaultValue='フリガナ②'`** |

⚠️ ⚠️ **`InformationEditKaeru.tsx` / `InformationEditResale.tsx` は変えていない**（オーナー指定で Order のみ）。

### 6. `frontend/src/components/database/DatabaseOrder.tsx`

**(a) import**

```tsx
import NexusBadge from '../NexusBadge';
import { isNexusRow } from '../../utils/nexusUtils';
```

**(b) `CustomerItem` に1項目**

```ts
    /** フリガナ。⚠️ Nexus アイコンの判定にだけ使う（検索には使っていない） */
    customer_contacts_name_kana?: string;
```

**(c) 顧客名のセル**

⚠️⚠️ **当初は改行して2行目に置いていたが、2026-09-25 にドットの隣へ移した。**

```tsx
                                            {/*
                                              ⚠️⚠️ **Nexus アイコンはギフトのドットの隣に置く**（2026-09-25 の指示）。
                                                ⚠️ **改行しないこと。** 行の高さが揃わなくなり、一覧が読みにくくなる。
                                            */}
                                            <td><GiftDot gift={item.gift} />
                                                {isNexusRow(item.customer, item.customer_contacts_name_kana) && <NexusBadge className='me-1' />}
                                                {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}</td>
```

**(d) 凡例に `nexus` を渡す**

```tsx
                    {/* ⚠️ nexus は**注文事業だけ**。建売分譲にはこのアイコンを出していない */}
                    <GiftLegend nexus />
```

### 7. ⚠️⚠️ API の2箇所（⚠️ **注文の一覧はフリガナを返していなかった**）

⚠️ 建売（`database_spec`）は元から返しているが、⚠️ **注文だけ抜けていた。**

`backend/src/handlers/databaseAction/database_order.php`

```php
  COALESCE(customer_contacts_name, '') AS customer,
  -- 2026-09-25 に追加。DatabaseOrder.tsx の Nexus アイコンの判定で使う。
  -- 返さないと画面側が undefined になり、アイコンが一切出なくなる。
  -- ② の backend-express/src/features/database/queries.ts にも同じ1行がある。
  COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
  COALESCE(in_charge_store, '') AS shop,
```

`backend-express/src/features/database/queries.ts`（`CUSTOMER_SQL.order`）

```ts
  COALESCE(customer_contacts_name, '') AS customer,
  /*
    ⚠️ 2026-09-25 に追加。DatabaseOrder.tsx の Nexus アイコンの判定で使う。
      ⚠️ 返さないと画面側が undefined になり、⚠️ **アイコンが一切出なくなる。**
      ⚠️ ① の database_order.php にも同じ1行を足してある。
  */
  COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
  COALESCE(in_charge_store, '') AS shop,
```

⚠️⚠️ **この2つは必ず揃えること。** ⚠️ ② が落ちたとき ① にフォールバックするため、片方だけだと ⚠️ **アイコンが出たり消えたりする。**

### 8. `frontend/src/components/list/` — 登録時の置換（⚠️ **3ファイル**）

`ListOrder.tsx`

```tsx
                /**
                 * ⚠️⚠️ **フリガナは必ずカタカナに直してから登録する**（2026-09-25 の指示）。
                 *   ⚠️ 反響フォームは**ひらがなで送ってくる顧客が多い。**
                 *   ⚠️ Nexus へ移行できるのはカタカナだけなので、**入口で揃えておく。**
                 *   ⚠️ 変換は utils/nexusUtils.ts の `hiraToKata()`。
                 *   ⚠️ 姓名間の半角スペースは**この行がもともと入れている。**
                 */
                customer_contacts_name_kana: hiraToKata(`${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`).trim(),
```

`ListKaeru.tsx`

```tsx
                /**
                 * ⚠️⚠️ **フリガナは必ずカタカナに直してから登録する**（2026-09-25 の指示）。
                 *   ⚠️ 反響フォームは**ひらがなで送ってくる顧客が多い。**
                 *   ⚠️ Nexus へ移行できるのはカタカナだけなので、**入口で揃えておく。**
                 *
                 * ⚠️ **画面の検索（ふりがな）は `kataToHira()` を通しているので影響しない。**
                 *   ⚠️ 検索しているのは `first_name_kana` という**元データ側**であり、
                 *     ⚠️ ここで作るのは **Dashboard へ登録する値**である（別物）。
                 */
                customer_contacts_name_kana: hiraToKata(`${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`).trim(),
```

`ListResale.tsx`

```tsx
                /**
                 * ⚠️⚠️ **フリガナは必ずカタカナに直してから登録する**（2026-09-25 の指示）。
                 *   ⚠️ 反響フォームは**ひらがなで送ってくる顧客が多い。**
                 *   ⚠️ Nexus へ移行できるのはカタカナだけなので、**入口で揃えておく。**
                 *   ⚠️ 変換は utils/nexusUtils.ts の `hiraToKata()`。
                 */
                customer_contacts_name_kana: hiraToKata(`${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`).trim(),
```

⚠️ それぞれ `import { hiraToKata } from '../../utils/nexusUtils';` を追加している。

### 9. `frontend/src/utils/version.ts`

```ts
export const newVersion = '2.2.149';
```

---

## ローカルDBでの実行結果（2026-09-25）

⚠️ `dashboard-mariadb-db-1` / `local_db` で ⚠️ **手順1〜4をそのまま通した。**

| 見たもの | 実行前 | 実行後 |
|---|---|---|
| `customer_contacts_name_kana` にひらがな | ⚠️ **8,745件** | ⚠️⚠️ **0件** |
| `customer_contacts_name_kana_2` にひらがな | 40件 | ⚠️⚠️ **0件** |
| 退避テーブルの行数 | — | 8,752件 |

⚠️⚠️ **半角カナは直らない**（⚠️ `kana` 34件 / `kana_2` 1件）。⚠️ **手で直すしかない。**

変換後の `show_dashboard = 1` の顧客（24,609件）:

| | 件数 |
|---|---|
| 姓名間に半角スペースあり | 21,279 |
| フリガナが入っている | 22,083 |
| ⚠️⚠️ **`isNexus` が真になる** | ⚠️ **19,486（79%）** |

⚠️ ⚠️ **本番①ではまだ実行していない。** ⚠️ デプロイ手順書に手順として載せてある。

---

## 確認したこと

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| `react-scripts build`（①） | ⚠️ **成功** → ⚠️ `main.51fd52d1.js` |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

---

## ⚠️⚠️ Nexus へのリンクは作れない（2026-09-25 に調べた結論）

⚠️ オーナーから ⚠️ **「URL を比べてリンクを作れないか」**と相談があったので調べた。⚠️⚠️ **できない。**

| | |
|---|---|
| Dashboard | ⚠️ **ULID**（26文字）`01VTQ9GW7JXKJKQRR67W7W46W2` |
| Nexus | `/crm/{UUID}/contracts/{UUID}/site-surveys` |

⚠️ ULID を128bitとして UUID の形に直すと `01deae98-70f2-ece5-3be3-063f0fc21b82` になり、
⚠️⚠️ **Nexus の `002947d0-deac-…` とは全くの別物。**

⚠️⚠️ **Nexus の2本はどちらもバージョン4の UUID（＝乱数）である。**
⚠️ **ULID からも氏名からも計算で導けない。** ⚠️ **変換関数は原理的に作れない。**

⚠️ オーナーの話では ⚠️ **2本目（`contracts/` の後ろ）が顧客に紐づく ID**。

⚠️ DB 側にも対応表は無い。
⚠️ ⚠️ **`nexus` という テーブルが1つあるが**、⚠️ 2025-07-14 の書き出し用（144行・列は氏名や店舗のみ）で
⚠️⚠️ **UUID を持っておらず、コードからも一切参照されていない。**

⚠️ 作るなら `master_data` に ⚠️ **`nexus_id` 列を足し、Nexus からのエクスポートと
氏名＋フリガナ＋電話で突合して埋める**しかない。
⚠️⚠️ **2026-09-25 にオーナー判断で「一旦やめる」となった。**

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **顧客名の注意書き（`InformationEditKaeru.tsx` の `OverlayTriggerComponent` 参考）はオーナー対応。** ⚠️ 今回は入れていない |
| 2 | ⚠️⚠️ **半角カナは SQL でも画面でも直らない。** ⚠️ 手順1-2 の件数を見て手で直すこと |
| 3 | ⚠️ `handleSave` の検査は ⚠️ **注文事業だけ**。⚠️ 建売・中古で同じことをするなら `InformationEditKaeru.tsx` / `InformationEditResale.tsx` にも同じ4行を足す |
| 4 | ⚠️⚠️ **既存顧客を開いて保存すると、スペースが無いだけで止まる。** ⚠️ 19,486/24,609 は通るが、⚠️ **残り2割は保存時に必ず直すことになる**（狙いどおりだが問い合わせが来る想定） |
| 5 | ⚠️ 退避テーブル `master_data_kana_backup_20260925` は ⚠️ **数日おいてから消すこと** |
| 6 | ⚠️ 判定を変えるときは ⚠️ **`nexusUtils.ts` だけを直す。** 画面3箇所すべてがここを通っている |
| 7 | ⚠️⚠️ **アイコンを四角い「Nexus」タグに戻さないこと。** ⚠️ **リンクに見える**と指摘を受けて丸囲みの `N` にした |
| 8 | ⚠️ `GiftLegend` の `nexus` は ⚠️ **注文事業だけ**。⚠️ 建売で true にすると ⚠️ **無い印の説明が出る** |
| 9 | ⚠️⚠️ **Nexus へのリンクは作れない**（上記）。⚠️ 作るなら ⚠️ **`master_data` への列追加と突合**が要る |
