# 建売の「ホームページ反響」を CustomerTrendKaeru と同じ判定にする（v2.2.143）

⚠️ 指示:

> インターネット検索 / SNS広告 / Amazonギフトカード / チラシ / LP制作
> の項目をホームページ反響の広告費として計上する
>
> **CustomerTrendKaeru.tsx のホームページ反響計**と同じロジックで
> ホームページ反響の歩留まりを計上する
>
> Web検索

⚠️ 「Web検索」＝ ⚠️ **販促費側の `インターネット検索`** のこと（確認済み。別名表で対応済みのため追加作業なし）。

---

## ⚠️ 何が変わるか（実データ・2026-09-22）

| | 旧 | 新 |
|---|---|---|
| ⚠️ **ホームページ反響（件数）** | ⚠️ 5,798 | ⚠️ **6,270**（⚠️ **+472**） |
| その他（未分類） | — | 288 |
| 単独行の合計 | — | 1,842 |
| 総反響 | 8,400 | 8,400 |
| ⚠️ **ホームページ反響の広告費** | ⚠️ 205,623,000 前後 | ⚠️ **203,216,989** |

⚠️ ⚠️ **1,842 + 6,270 + 288 = 8,400** で総反響と一致する（⚠️ **二重計上も取りこぼしも無い**）。

⚠️ 件数が増えたのは、⚠️ **反響媒体が `medium_kaeru` に無い顧客・空の顧客**が
⚠️ **「その他（未分類）」から「ホームページ反響」へ移った**ため。

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend-express/src/features/customer/` | `queries.ts` | ⚠️ **`hp_campaign` を返す**（spec のみ） |
| `backend/src/handlers/customerAction/` | `customer_spec.php` | ⚠️ **同じ変更**（⚠️ **①② は同じ形に**） |
| `frontend/src/components/customer/` | ⚠️ **`customerKaeruUtils.ts`** | ⚠️ **判定と媒体一覧を追加** |
| 同上 | ⚠️ **`CustomerKaeru.tsx`** | ⚠️ **行の振り分けを差し替え** |

⚠️⚠️ **`CustomerTrendKaeru.tsx` には手を入れていない。** ⚠️ **あちらが正である。**

---

## 1. 広告費（名指しで決める）

⚠️⚠️ **顧客側と同じ判定にはできない。**
⚠️ 販促費に `hp_campaign` は無く、⚠️ **`Amazonギフトカード` のように `medium_kaeru` に無い名前**も含めるため。

```ts
export const HOMEPAGE_BUDGET_MEDIUMS: string[] = [
    'インターネット検索',
    'SNS広告',
    'Amazonギフトカード',
    'チラシ',
    'LP制作',
];

/** その販促費が「ホームページ反響」の広告費か */
export const isHomepageBudget = (medium: string): boolean =>
    HOMEPAGE_BUDGET_MEDIUMS.includes(cleanMedium(medium));
```

⚠️ 内訳（`section = 'spec'` / `response_medium = 0` / 反響のある店舗）

| medium | 金額 |
|---|---|
| インターネット検索 | 105,045,842 |
| SNS広告 | 93,702,101 |
| Amazonギフトカード | 3,600,828 |
| チラシ | 801,819 |
| LP制作 | 66,399 |
| ⚠️ **合計** | ⚠️ **203,216,989** |

---

## 2. 歩留まり（CustomerTrendKaeru と同じ判定）

⚠️ 写した元:

```ts
const isHpGroup = !isAnyDisplayMedium && (isHp(o.hp_campaign) || !o.medium || !o.hp_campaign);
```

### 追加した関数（`customerKaeruUtils.ts`）

```ts
/**
 * ⚠️ ポータル経由かどうか。
 *
 * ⚠️⚠️ **CustomerTrendKaeru.tsx の `isHp()` をそのまま写したもの。**
 *   ⚠️ ⚠️ **中身を変えないこと。** 変えるなら両方である。
 *   ⚠️ `ALLGRIT` は公式LINE、`カゴスマ` は `カゴスマ・タテルヤ` の実データ名。
 */
const PORTALS: string[] = ['SUUMO', 'ALLGRIT', "HOME'S", 'アットホーム', 'タウンライフ', 'カゴスマ'];

export const isHpCampaign = (value: string): boolean => {
    if (!value) return false;
    return !PORTALS.some(p => value.includes(p));
};

/** 正式名として扱う値の一覧（別名表に無ければ自分自身だけ） */
const aliasesOf = (canonical: string): string[] => MEDIUM_ALIAS[canonical] ?? [canonical];

/**
 * その顧客が、単独行として出している媒体（`show_graph = 1`）に当たるか。
 *
 * ⚠️⚠️ **反響媒体だけでなく `hp_campaign` も見る**（CustomerTrendKaeru と同じ）。
 *   ⚠️ ⚠️ **見ないと、ポータル経由の反響が「ホームページ反響」に流れ込む。**
 *   ⚠️ 突き合わせは別名も含めて行う（`公式LINE` は実データでは `ALLGRIT`）。
 */
export const matchesShownMedium = (
    customerMedium: string,
    hpCampaign: string,
    shownMedium: string
): boolean => {
    if (normalizeMedium(customerMedium) === shownMedium) return true;

    const campaign = cleanMedium(hpCampaign);
    if (campaign === '') return false;
    return aliasesOf(shownMedium).some(alias => campaign.includes(alias));
};

/**
 * その顧客が「ホームページ反響」に入るか。
 *
 * ⚠️⚠️ **CustomerTrendKaeru.tsx の `isHpGroup` と同じ式である。**
 *
 * ⚠️ ⚠️ **「単独行のどれにも当たらない」ことが先に来る。**
 *   ⚠️ これが無いと ⚠️ **同じ顧客が SUUMO とホームページ反響の両方に数えられる。**
 *
 * ⚠️⚠️ **反響媒体が空の顧客もここに入る**（`!o.medium`）。
 *   ⚠️ ⚠️ **`show_graph = 0` の媒体かどうかは、もう見ていない**（2026-09-22 に変更）。
 */
export const isHomepageCustomer = (
    customerMedium: string,
    hpCampaign: string,
    shownMediums: string[]
): boolean => {
    const matchesAnyShown = shownMediums.some(
        shown => matchesShownMedium(customerMedium, hpCampaign, shown)
    );
    if (matchesAnyShown) return false;

    return isHpCampaign(hpCampaign)
        || cleanMedium(customerMedium) === ''
        || cleanMedium(hpCampaign) === '';
};
```

### 差し替えた振り分け（`CustomerKaeru.tsx`・顧客側）

```tsx
            const base = filteredCustomers.filter(c => {
                if (value.medium === '総反響') return true;

                /**
                 * ⚠️⚠️ **2026-09-22 に判定を CustomerTrendKaeru.tsx と同じものへ変えた**
                 *   （利用者の指示）。⚠️ **`hp_campaign` も見るようになった。**
                 *   ⚠️ ⚠️ **数字は変わる。** 以前は `medium_kaeru` に載っている
                 *     `show_graph = 0` の媒体だけを拾っていたため、
                 *     ⚠️ **台帳に無い媒体や空の媒体は「その他（未分類）」に落ちていた。**
                 */
                if (value.medium === HOMEPAGE_ROW) {
                    return isHomepageCustomer(c.medium, c.hp_campaign, shownMediums);
                }

                /**
                 * ⚠️ どの行にも当てはまらない反響。
                 * ⚠️⚠️ **ホームページ反響に吸収された顧客は必ず外すこと。**
                 *   ⚠️ 外さないと ⚠️ **同じ顧客が2つの行に数えられる。**
                 */
                if (value.medium === OTHER_ROW) {
                    if (isHomepageCustomer(c.medium, c.hp_campaign, shownMediums)) return false;
                    return !shownMediums.some(
                        shown => matchesShownMedium(c.medium, c.hp_campaign, shown)
                    );
                }

                // ⚠️ 単独行。⚠️ **反響媒体だけでなく `hp_campaign` も見る**（同上）
                return matchesShownMedium(c.medium, c.hp_campaign, value.medium);
            });
```

### 差し替えた振り分け（販促費側）

```tsx
                .filter(item => {
                    if (value.medium === '総反響') return true;

                    /**
                     * ⚠️⚠️ **ホームページ反響の広告費は、媒体名を名指しで決めている**
                     *   （2026-09-22 の指示。`HOMEPAGE_BUDGET_MEDIUMS`）。
                     *   ⚠️ ⚠️ **顧客側と同じ判定にはできない。**
                     *     ⚠️ 販促費に `hp_campaign` は無く、
                     *       ⚠️ **`Amazonギフトカード` のように `medium_kaeru` に無い名前も含める**ため。
                     */
                    if (value.medium === HOMEPAGE_ROW) return isHomepageBudget(item.medium);

                    // ⚠️ 販促費側は `SNS広告` / `インターネット検索` / `カゴスマ` で入っている
                    const medium = normalizeMedium(item.medium);

                    /**
                     * ⚠️ どの行にも乗らなかった販促費。
                     * ⚠️⚠️ **ホームページ反響に数えたものは必ず外すこと**（二重計上になる）。
                     */
                    if (value.medium === OTHER_ROW) {
                        if (isHomepageBudget(item.medium)) return false;
                        return !shownMediums.includes(medium);
                    }

                    return medium === value.medium;
                })
```

---

## ⚠️ 廃止したもの

| 何 | なぜ |
|---|---|
| ⚠️ **`groupedMediums`** | ⚠️ `show_graph = 0` の一覧で判定しなくなったため |
| ⚠️ **`knownMediums`** | ⚠️ 同上 |

⚠️⚠️ **二重計上を防ぐ仕組みは無くなっていない。**
⚠️ ⚠️ **`isHomepageCustomer()` が先に単独行との一致を見て弾いている。**

⚠️ また、「ホームページ反響」の行は ⚠️ **常に出すように変えた。**
⚠️ ⚠️ **`medium_kaeru` の中身で行が消えると、反響媒体が空の顧客の行き先が無くなるため。**

---

## 追加した列（①②）

```sql
COALESCE(hp_campaign, '') as hp_campaign,
```

⚠️ ⚠️ **`master_data_kaeru.hp_campaign` は既存の列**（`customerTrend` が既に使っている）。
⚠️ **テーブル変更は不要。**

---

## 確認（2026-09-22・ローカル）

| 確認 | 結果 |
|---|---|
| `npm run build`（frontend） | ⚠️ **成功**（⚠️ **今回の変更による新しい警告は無し**） |
| 件数の内訳 | ⚠️ **1,842 + 6,270 + 288 = 8,400**（⚠️ **総反響と一致**） |
| 広告費 | ⚠️ **203,216,989** |

---

## ⚠️ ブラウザでの確認（未実施）

- [ ] 顧客分析（建売）→ ⚠️ **ホームページ反響の反響数が 6,270 前後**
- [ ] ⚠️⚠️ **CustomerTrendKaeru の「ホームページ反響計」と件数が一致する**
- [ ] ⚠️ 単独行（SUUMO / HOME'S / アットホーム / 公式LINE）＋ホームページ反響＋その他 ＝ 総反響
- [ ] ⚠️ ホームページ反響の広告費が ⚠️ **約2億320万**
- [ ] ⚠️ 「その他（未分類）」が 288 前後（⚠️ **0 にはならない**）
- [ ] 店舗・期間で絞っても合計が崩れない
