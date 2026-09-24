# 指示（2026-09-21）　デプロイ前のリファクタリング

⚠️ 依頼:
> リファクタリングして手順書準備

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/list/` | ⚠️ `listUtils.ts` | ⚠️ **`matchesBlackList()` を新規追加** |
| `frontend/src/components/list/` | `ListOrder.tsx` | ⚠️ `isBlack` が**2行**になった |
| `frontend/src/components/list/` | `ListKaeru.tsx` | 同上 |
| `frontend/src/components/list/` | `ListResale.tsx` | 同上 |
| `frontend/src/components/customer/` | `customerKaeruUtils.ts` | ⚠️ **古くなったコメントの訂正** |

⚠️ ⚠️ **動きは1つも変えていない。** ⚠️ 式をそのまま移しただけである。

---

## ⚠️ 1. ブラックリスト突合を3画面で共有した

### ⚠️ なぜ

⚠️⚠️ **同じ式が3ファイルに写してあった。**
⚠️ 今回の改修で式が長くなり（⚠️ `isValidMobile` が両側に付いた）、
⚠️ ⚠️ **片方だけ直すと画面によって赤くなる行が変わる**危険が上がっていた。

⚠️ 既存のコメントにも ⚠️ **「3画面とも同じものを使うこと」** と書いてあったが、
⚠️ ⚠️ **同じにする仕組みが無かった。**

### 追加した関数（`list/listUtils.ts`）

```ts
/** ブラックリスト名簿の1件。⚠️ `black_list` テーブルから必要な2列だけ */
export type BlackListEntry = { mobile: string; mail: string };

/**
 * ブラックリスト名簿に載っているか。
 *
 * ⚠️⚠️ **注文・建売・中古の3画面で共有している。**
 *   ⚠️ 2026-09-21 まで**3ファイルに同じ式が写してあり**、
 *     ⚠️ 片方だけ直すと画面によって赤くなる行が変わっていた。
 *   ⚠️ 各画面の `isBlack()` は、これに**タグ（`isTagOn`）を OR する**だけにしてある。
 *
 * ⚠️⚠️ **電話番号は両側が `isValidMobile()` を通ったときだけ使う。**
 *   ⚠️ 突合は `includes()`（部分一致）なので、⚠️ **短い番号は誰にでも当たる。**
 *   ⚠️ 名簿側も見るのは、⚠️ **画面から短い番号を登録できてしまう**ため。
 *
 * ⚠️ メールは従来どおり素の部分一致。⚠️ **指示の対象外なので変えていない。**
 */
export const matchesBlackList = (
    mail: unknown,
    mobile: unknown,
    blackList: ReadonlyArray<BlackListEntry>
): boolean => {
    const safeMail = String(mail ?? '');
    const safeMobile = String(mobile ?? '');
    const canUseMobile = isValidMobile(safeMobile);
    const halfMobile = toHalfWidth(safeMobile);

    return blackList.some(b =>
        (safeMail !== '' && b.mail.includes(safeMail)) ||
        (canUseMobile && isValidMobile(b.mobile) && toHalfWidth(b.mobile).includes(halfMobile))
    );
};
```

⚠️ ⚠️ **`toHalfWidth(safeMobile)` と `isValidMobile(safeMobile)` を名簿の件数ぶん
繰り返さないよう、ループの外へ出してある**（⚠️ 名簿152件 × 反響18,000件）。

### ⚠️ 各画面の `isBlack()`（3画面とも2行）

```tsx
    /**
     * ブラックリスト該当か。
     * 名簿テーブル（black_list）に一致するか、この反響に black タグが立っている場合。
     *
     * ⚠️ テーブル名 black_list（名簿）と、旧カラム名 black_list（タグ文字列）は
     *   まったくの別物だった。タグ側はフラグカラムへ移行済み。
     *
     * ⚠️⚠️ **突合そのものは list/listUtils.ts の `matchesBlackList()` にある。**
     *   ⚠️ 注文・建売・中古の**3画面で共有**している。⚠️ **ここに書き戻さないこと。**
     *   ⚠️ 電話番号は `isValidMobile()` を通ったものだけを使う（2026-09-18 の指示）。
     *     ⚠️ 実測でこの画面の該当が **183件 → 141件**（⚠️ **42件が誤検知**）になる。
     */
    const isBlack = (item: InquiryCustomer) =>
        matchesBlackList(item.mail, item.mobile, blackList) || isTagOn(item, 'black');
```

⚠️ import も差し替えた（⚠️ `isValidMobile` → `matchesBlackList`）。
⚠️ ⚠️ **`toHalfWidth` は3画面とも他の用途で使い続けるので残っている。**

---

## ⚠️ 2. 古くなったコメントを直した（`customerKaeruUtils.ts`）

⚠️ 「その他（未分類）」行を足したことで、⚠️ **記述が事実と合わなくなっていた。**

```ts
 * ⚠️⚠️ **`Instagram、Web検索` のような複数選択はそのまま返る。**
 *   ⚠️ 実データに約50件ある。⚠️ **個別の媒体の行には乗らない**（数え方が未決のため）。
 *   ⚠️ 2026-09-21 から ⚠️ **`CustomerKaeru.tsx` の「その他（未分類）」行が受け止める**ので、
 *     ⚠️ **媒体別の合計と総反響は一致する。**
 *   ⚠️ 数え方が決まったら、⚠️ **ここで分解するのではなく画面側の行の作り方を直すこと**
 *     （1人を複数の行に数えるかどうかは集計の話である）。
```

---

## ⚠️ 見送ったリファクタリング

### ⚠️ 期間フィルタ（`startDate` / `endDate`）の共通化

⚠️ 次の7行が ⚠️ **`ShopKaeru` と `CustomerKaeru` に2回ずつ**書かれている。

```ts
        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [y, m] = endMonth.split('/').map(Number);
            endDate = new Date(y, m, 0);   // ⚠️ 月末（day=0 で前月の末日）
        }
```

⚠️⚠️ **見送った理由**: ⚠️ 同じ書き方が ⚠️ **`CustomerOrder` / `BudgetKaeru` / `Calendar` /
`DailyReports` など6画面以上**にある。
⚠️ ⚠️ **2画面だけ共通化すると、かえって「どちらの流儀か」が分からなくなる。**
⚠️ 宿題として手順書に残した。

### ⚠️ `unitPrice()` の共通化

⚠️ `ShopKaeru` と `CustomerKaeru` に同じものがある（1行）。
⚠️ ⚠️ **1行の関数を共有ファイルに出すほうが読みにくい**ため見送り。

### ⚠️ `EditBlackList.tsx` の `cell()` / `newCell()`

⚠️ 似ているが ⚠️ **保存の仕方が違う**（⚠️ 既存行は `onBlur` で送信、新規行は送らない）。
⚠️ ⚠️ **まとめると分岐が増えて読みにくくなる**ため見送り。

---

## 検証

| 確認 | 結果 |
|---|---|
| `npm run build` | ⚠️ **成功** |
| ⚠️ `listUtils` / `ListOrder` / `ShopKaeru` / `EditBlackList` の警告 | ⚠️ **0件** |
| ⚠️ `ListKaeru` / `ListResale` の新規警告 | ⚠️ **0件**（既存のみ） |
| ⚠️ `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| ⚠️ ② に `header_blacklist_*` が登録されたか | ⚠️ **401 が返る**（⚠️ 未登録なら404。`competitor` と同じ挙動） |
| ⚠️ INSERT / UPDATE の SQL | ⚠️ **ロールバック付きで実行し成功**（⚠️ 152件のまま・残骸なし） |
| ⚠️ 「その他（未分類）」の顧客 | ⚠️ **769件 / 8,400件中** |
| ⚠️ 「その他（未分類）」の販促費 | ⚠️ **¥5,540,846 / ¥298,891,204 中** |

⚠️ ⚠️ **`isBlack` の 183件 → 141件 は、リファクタリング前に SQL で実測した値である。**
⚠️ ⚠️ **式は1文字も変えずに移しただけ**なので、件数は変わらない。
