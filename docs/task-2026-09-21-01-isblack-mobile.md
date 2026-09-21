# 指示（2026-09-21）　isBlack の電話番号判定を直す

⚠️ 依頼（`ReadMeClaude.md`）:
> `ListKaeru.tsx` / `ListOrder.tsx` / `ListResale.tsx` の isBlack 判定方法修正
> 電話番号が不備のある場合(9桁以下)、半角数字以外の文字列だった場合、false だった場合は
> isBlack の条件としないように修正

⚠️ 確認事項への回答: ⚠️ **「記号は無視して数字だけで判定」**（利用者が選択）。

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/list/` | ⚠️ `listUtils.ts` | ⚠️ **`isValidMobile()` を新規追加** |
| `frontend/src/components/list/` | `ListOrder.tsx` | `isBlack` の条件 |
| `frontend/src/components/list/` | `ListKaeru.tsx` | `isBlack` の条件 |
| `frontend/src/components/list/` | `ListResale.tsx` | `isBlack` の条件 |

⚠️ ⚠️ **バックエンドの改修は無い。** ⚠️ 突合はフロントで行っている。

---

## ⚠️ なぜ必要だったか

⚠️ 突合は ⚠️ **`includes()`（部分一致）** である。

```ts
toHalfWidth(b.mobile).includes(toHalfWidth(safeMobile))
```

⚠️⚠️ **短い番号は必ず誰かに当たる。**
⚠️ 実データ（`inquiry_customer`）に次のような値が入っていた。

| 値 | 桁 | 何か |
|---|---|---|
| `090` | 3 | 入力途中 |
| `1` | 1 | 誤入力 |
| `8992521` | 7 | ⚠️ **郵便番号らしきもの** |
| `000000001` | 9 | ダミー |

⚠️ ⚠️ **実測でブラックリスト該当が 183件 → 141件。⚠️ 42件が誤検知だった。**

| 画面 | 修正前 | ⚠️ 修正後 |
|---|---|---|
| ⚠️ **注文（ListOrder）** | 183件 | ⚠️ **141件** |
| 建売（ListKaeru） | 0件 | 0件 |
| 中古（ListResale） | 3件 | 3件 |

---

## ⚠️ 「半角数字以外」をどう扱ったか

⚠️⚠️ **記号で弾いてはいけない。**

⚠️ 実データの ⚠️ **4,561件**が `="08064284025"` という **Excel 由来の形**で入っている。
⚠️ 中身は正しい携帯番号なので、⚠️ **厳格に弾くとこの4,561件が突合されなくなる。**

⚠️ `toHalfWidth()` がもともと数字以外を落とすので、⚠️ **そこを通してから桁数を見る**形にした。

```ts
export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');
```

⚠️ ⚠️ **この関数は既存のもの。変えていない。**

---

## ⚠️ 追加した関数（`list/listUtils.ts`）

```ts
/** 電話番号として成立する最低の桁数。⚠️ 固定電話の市外局番込みで10桁 */
const MOBILE_MIN_DIGITS = 10;

/**
 * ブラックリストの突合に使える電話番号か。
 *
 * ⚠️⚠️ **不備のある番号で照合してはいけない**（2026-09-18 の指示）。
 *   ⚠️ 突合は `includes()`（部分一致）なので、⚠️ **短い番号は必ず誰かに当たる。**
 *     ⚠️ 実データに `090` `1` `8992521`（郵便番号らしきもの）が入っており、
 *     ⚠️ **無関係な顧客が赤く表示されていた。**
 *   ⚠️ 実測（注文）で ⚠️ **183件 → 141件**。⚠️ **42件が誤検知だった。**
 *
 * ⚠️⚠️ **記号は無視して数字だけで判定する**（2026-09-18 の指示）。
 *   ⚠️ 実データの 4,561件が `="08064284025"` という Excel 由来の形になっている。
 *     ⚠️ 中身は正しい携帯番号なので、⚠️ **記号で弾いてはいけない。**
 *   ⚠️ `toHalfWidth()` が数字以外を落とすので、ハイフン付きもここを通る。
 *
 * ⚠️ `'false'` や `'null'` は数字が1つも無いので桁数0になり、自然に false になる。
 *   ⚠️ それでも明示しているのは、⚠️ **実データにこの値が入る**ことを残すため。
 */
export const isValidMobile = (value: unknown): boolean => {
    const raw = String(value ?? '').trim();
    if (raw === '' || raw === 'null' || raw.toLowerCase() === 'false') return false;
    return toHalfWidth(raw).length >= MOBILE_MIN_DIGITS;
};
```

---

## ⚠️ 修正した関数（3画面とも同じ形）

### `ListOrder.tsx`

```tsx
    /**
     * ブラックリスト該当か。
     * 名簿テーブル（black_list）に一致するか、この反響に black タグが立っている場合。
     *
     * ⚠️ テーブル名 black_list（名簿）と、旧カラム名 black_list（タグ文字列）は
     *   まったくの別物だった。タグ側はフラグカラムへ移行済み。
     *
     * ⚠️⚠️ **電話番号は `isValidMobile()` を通ったときだけ使う**（2026-09-18 の指示）。
     *   ⚠️ 9桁以下の番号で部分一致させると**無関係な顧客が当たる。**
     *   ⚠️ 実測でこの画面の該当が **183件 → 141件**（⚠️ **42件が誤検知**）になる。
     *   ⚠️ 判定は list/listUtils.ts に置いてある。⚠️ **3画面とも同じものを使うこと。**
     */
    const isBlack = (item: InquiryCustomer) => {
        const safeMail = item.mail || '';
        const safeMobile = item.mobile || '';
        return blackList.some(b =>
            (safeMail && b.mail.includes(safeMail)) ||
            (isValidMobile(safeMobile) && isValidMobile(b.mobile)
                && toHalfWidth(b.mobile).includes(toHalfWidth(safeMobile)))
        ) || isTagOn(item, 'black');
    };
```

### `ListKaeru.tsx`

```tsx
    /**
     * ブラックリスト該当か。
     * 名簿テーブル（black_list）に一致するか、この反響に black タグが立っている場合。
     *
     * ⚠️⚠️ **電話番号は `isValidMobile()` を通ったときだけ使う**（2026-09-18 の指示）。
     *   ⚠️ 9桁以下の番号で部分一致させると**無関係な顧客が当たる。**
     *   ⚠️ 判定は list/listUtils.ts に置いてある。⚠️ **3画面とも同じものを使うこと。**
     */
    const isBlack = (item: InquiryCustomer) => {
        const safeMail = String(item.mail || '');
        const safeMobile = String(item.mobile || '');
        return blackList.some(b =>
            (safeMail && b.mail.includes(safeMail)) ||
            (isValidMobile(safeMobile) && isValidMobile(b.mobile)
                && toHalfWidth(b.mobile).includes(toHalfWidth(safeMobile)))
        ) || isTagOn(item, 'black');
    };
```

### `ListResale.tsx`

```tsx
    /**
     * ブラックリスト該当か。
     * 名簿テーブル（black_list）に一致するか、この反響に black タグが立っている場合。
     *
     * ⚠️⚠️ **電話番号は `isValidMobile()` を通ったときだけ使う**（2026-09-18 の指示）。
     *   ⚠️ 9桁以下の番号で部分一致させると**無関係な顧客が当たる。**
     *   ⚠️ 判定は list/listUtils.ts に置いてある。⚠️ **3画面とも同じものを使うこと。**
     */
    const isBlack = (item: InquiryCustomer) => {
        const safeMail = item.mail || '';
        const safeMobile = item.mobile || '';
        return blackList.some(b =>
            (safeMail && b.mail.includes(safeMail)) ||
            (isValidMobile(safeMobile) && isValidMobile(b.mobile)
                && toHalfWidth(b.mobile).includes(toHalfWidth(safeMobile)))
        ) || isTagOn(item, 'black');
    };
```

⚠️⚠️ **名簿側（`b.mobile`）にも `isValidMobile()` を掛けている。**
⚠️ 名簿に短い番号が登録されていると、⚠️ **こちらも誰にでも当たる**ため。
⚠️ `black_list` の実データに9桁以下は無かったが、⚠️ **画面から自由に登録できる**ので守る。

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ メールアドレスの突合 | ⚠️ **指示は電話番号のみ** |
| 2 | ⚠️ 部分一致を完全一致に変える | ⚠️ **指示に無い。** ⚠️ 既存の運用が変わる |
| 3 | ⚠️ 不備のある番号を DB から直す | ⚠️ **データの修正は別の判断** |
| 4 | ⚠️ `EditBlackList` 側の入力チェック | ⚠️ **指示に無い**（⚠️ 今後 9桁以下を弾くかは要相談） |

---

## 検証

| 確認 | 結果 |
|---|---|
| ⚠️ 注文の該当件数 | ⚠️ **183件 → 141件**（SQL で実測） |
| 建売の該当件数 | 0件 → 0件 |
| 中古の該当件数 | 3件 → 3件 |
| ⚠️ `="080…"` 形式の4,561件 | ⚠️ **引き続き突合される** |
| `npm run build` | ⚠️ **成功** |
| ⚠️ 3画面の新規警告 | ⚠️ **0件** |

### ⚠️ 未実施

⚠️ **画面での確認**（⚠️ 反響一覧の赤い行が減っていること）。
