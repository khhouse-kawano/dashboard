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

```tsx
import React from 'react';

/**
 * Nexus（自社の別システム）へ移行できる顧客に付けるアイコン。
 *
 * ⚠️ 出すかどうかは呼び出し側が `isNexus()` / `isNexusRow()` で決める。
 *   ⚠️ **このコンポネント自身は判定しない**（画面ごとにデータの形が違うため）。
 *
 * ⚠️ 色は指示どおり **ネイビー背景・白文字**で固定。
 *   ⚠️ Bootstrap の `bg-primary` は明るい青なので使わないこと。
 */
type Props = {
    /** 余白の付け方が画面ごとに違うので外から渡す（例: 'me-1' / 'mt-1'） */
    className?: string;
};

const NexusBadge = ({ className }: Props) => (
    <span
        className={`d-inline-block rounded fw-bold ${className ?? ''}`}
        style={{
            backgroundColor: '#1b2a56',
            color: '#ffffff',
            fontSize: '9px',
            letterSpacing: '0.5px',
            padding: '1px 5px',
            whiteSpace: 'nowrap'
        }}
        title="Nexusへ移行できる形式です（フリガナがカタカナ・姓名間が半角スペース）"
    >
        Nexus
    </span>
);

export default NexusBadge;
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

```tsx
                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }} className='d-flex align-items-center'>
                    {/* ⚠️ Nexus へ移行できる形のときだけ出す。⚠️ 新規登録中は判定しない（まだ空） */}
                    {id !== 'new' && isNexus(information) && <NexusBadge className='me-1' />}
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

```tsx
                                            {/* ⚠️ Nexus アイコンは顧客名の**下（改行して2行目）**に出す。指示どおり横には並べない */}
                                            <td><GiftDot gift={item.gift} />{item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}
                                                {isNexusRow(item.customer, item.customer_contacts_name_kana) && <><br /><NexusBadge /></>}</td>
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

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **顧客名の注意書き（`InformationEditKaeru.tsx` の `OverlayTriggerComponent` 参考）はオーナー対応。** ⚠️ 今回は入れていない |
| 2 | ⚠️⚠️ **半角カナは SQL でも画面でも直らない。** ⚠️ 手順1-2 の件数を見て手で直すこと |
| 3 | ⚠️ `handleSave` の検査は ⚠️ **注文事業だけ**。⚠️ 建売・中古で同じことをするなら `InformationEditKaeru.tsx` / `InformationEditResale.tsx` にも同じ4行を足す |
| 4 | ⚠️⚠️ **既存顧客を開いて保存すると、スペースが無いだけで止まる。** ⚠️ 19,486/24,609 は通るが、⚠️ **残り2割は保存時に必ず直すことになる**（狙いどおりだが問い合わせが来る想定） |
| 5 | ⚠️ 退避テーブル `master_data_kana_backup_20260925` は ⚠️ **数日おいてから消すこと** |
| 6 | ⚠️ 判定を変えるときは ⚠️ **`nexusUtils.ts` だけを直す。** 画面3箇所すべてがここを通っている |
