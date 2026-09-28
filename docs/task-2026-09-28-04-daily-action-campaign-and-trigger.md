# 2026-09-28 (4) キャンペーン列と、URLごとの表示（v2.2.150）

⚠️ [task-2026-09-28-03](task-2026-09-28-03-daily-action-saas-ui.md) の続き。⚠️ **同じ版**。

## 依頼（`ReadMeClaude.md`）

- ⚠️ **未同期テーブルの右端の列に「キャンペーン」を追加**
  （`inquiry_customer.hp_campaign`。⚠️ **偽の場合は `-`**）
- ⚠️ 相談: ⚠️ **このモーダルの表示基準を `Menu.tsx` の各ボタンで URL が変わるたびに変更できるか**

### ⚠️ 途中の追記（同日）

> ⚠️ `Category.tsx` の `goToDashboard` でも発火するのは残したい

⚠️ ⚠️ **残っている。** ⚠️ URL の変化そのものを見る作りなので、⚠️ **トップからの遷移でも必ず動く**
（⚠️ 詳細は下の「⚠️ goToDashboard からも出るか」）。

## オーナー判断

| 論点 | 回答 |
|---|---|
| 背景クリックで閉じたあと | ⚠️⚠️ **画面を移るたびに出す**（⚠️ 「確認しました」を押すまで） |
| 出す画面の範囲 | ⚠️ **全ページ**（⚠️ `/login` と `/home` 以外） |

---

## 1. キャンペーン列

### ② `backend-express/src/features/dailyAction.ts`

⚠️ `UNSYNC_SQL` にだけ足した。

```sql
         COALESCE(NULLIF(TRIM(i.response_medium), ''), NULLIF(TRIM(i.medium), ''), '') AS medium,
         /*
           ⚠️ キャンペーン名（2026-09-28 の指示）。⚠️ **未同期の表にだけ出す。**
             ⚠️ 実測では ⚠️ **9割以上が空**（1,400件中 1,306件）。
             ⚠️ ⚠️ **空文字で返し、画面がハイフンと出す。**
           ⚠️ 20250426【KH共通】ゴールデンウィークマイホームフェア のように**長い**。
             ⚠️ 画面側で省略表示にしてある。
           ⚠️⚠️ **ここはテンプレートリテラルの中なのでバッククォートを書かないこと**（文字列が終わる）。
         */
         COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
```

⚠️ 型とセクション:

```ts
export interface AttentionRow extends RowDataPacket {
  kind: 'unsync' | 'cancel';
  days: number;
  shop: string;
  register: string;
  customer: string;
  medium: string;
  /** ⚠️ キャンペーン名。⚠️ **未同期の行だけが持つ**（来場日未入力には無い） */
  campaign?: string;
}
```

```ts
  /**
   * ⚠️ キャンペーンの列を出すかどうか。
   *   ⚠️⚠️ **未同期だけ true**（2026-09-28 の指示）。
   *   ⚠️ 来場日未入力・本日の予定は `master_data` 由来で、⚠️ **この列を返していない。**
   */
  hasCampaign: boolean;
```

```ts
  const sections: DailySection[] = [
    { label: '未同期', hasDays: true, hasCampaign: true, rows: unsync },
    { label: '来場日未入力', hasDays: true, hasCampaign: false, rows: cancel },
    ...TODAY_STEPS.map((step) => ({
      label: `本日の${step.label}`,
      hasDays: false,
      hasCampaign: false,
      rows: today.filter((row) => row.step === step.label),
    })),
  ];
```

### ① `backend/src/handlers/daily_action.php`

```php
         COALESCE(NULLIF(TRIM(i.response_medium), ''), NULLIF(TRIM(i.medium), ''), '') AS medium,
         /* ⚠️ キャンペーン名（2026-09-28）。⚠️ **未同期の表にだけ出す。**
            ⚠️ 実測では9割以上が空。⚠️ **空文字で返し、画面が `-` と出す。** */
         COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
```

```php
$sections = [
    // ⚠️ hasCampaign は**未同期だけ true**（2026-09-28 の指示）。
    //   ⚠️ 来場日未入力・本日の予定は master_data 由来で、この列を返していない。
    ["label" => "未同期", "hasDays" => true, "hasCampaign" => true, "rows" => $response_unsync],
    ["label" => "来場日未入力", "hasDays" => true, "hasCampaign" => false, "rows" => $response_cancel],
];
```

### 画面 `frontend/src/components/DailyAction.tsx`

```tsx
/**
 * キャンペーン名。
 *
 * ⚠️ 指示どおり ⚠️ **空なら `-`**（⚠️ 「(未設定)」ではない）。
 *   ⚠️ 実測で ⚠️ **9割以上が空**なので、⚠️ **短い記号のほうが表が静かになる。**
 */
const orDash = (value?: string): string => (value ?? '').trim() === '' ? '-' : (value ?? '');
```

```tsx
                                        {/* ⚠️ キャンペーンは**未同期の表だけ**。⚠️ 右端に置く（指示） */}
                                        {section.hasCampaign && <th className='da_th' style={{ width: '170px' }}>キャンペーン</th>}
```
```tsx
                                            {section.hasCampaign && (
                                                /* ⚠️ 長い名前が多いので省略表示。⚠️ **全文は hover で出す** */
                                                <td className='da_td da_muted da_ellipsis' title={orDash(row.campaign)}>
                                                    {orDash(row.campaign)}
                                                </td>
                                            )}
```

⚠️ CSS:

```css
                /**
                 * ⚠️ キャンペーン名は長い（20250426【KH共通】ゴールデンウィーク… のような値）。
                 *   ⚠️⚠️ **ここは <style>{...} のテンプレートリテラルの中。**
                 *     ⚠️ **バッククォートを書かないこと**（文字列が終わってビルドが落ちる）。
                 *   ⚠️⚠️ **折り返すと行の高さが揃わなくなる**ので省略表示にする。
                 *   ⚠️ 全文は title 属性（hover）で読める。
                 *   ⚠️ ⚠️ **table-layout: fixed が要る。** 無いと max-width が効かず、
                 *     ⚠️ 列が横に伸びて表がはみ出す。
                 */
                .da_table { table-layout: fixed; }
                .da_ellipsis { max-width: 0; overflow: hidden; text-overflow: ellipsis;
                               white-space: nowrap; }
```

---

## 2. URL が変わるたびに出す

### ⚠️⚠️ 置き場所を `App.tsx` にした（⚠️ **`Menu.tsx` ではない**）

⚠️ 相談では `Menu.tsx` と書いたが、⚠️⚠️ **`MenuD` は `App.tsx` で PC用とSP用の2回描画されている。**
⚠️ ⚠️ **`Menu.tsx` の中に置くとモーダルが二重に出る。**

```tsx
            {/*
              ⚠️⚠️ **「要確認」モーダル（2026-09-28）。**
                ⚠️ ⚠️ **ここに1つだけ置くこと。** MenuD は **PC用とSP用で2回**描画されるので、
                  ⚠️ Menu.tsx の中に置くと**モーダルが二重に出る。**
                ⚠️ `/home` と `/login` では描画されない（上の条件の中にある）。
                ⚠️ 出す・出さないの判定（注文営業のみ・スマホでは出さない・
                  本日確認済みか・0件か）は **DailyAction.tsx 側が持っている。**
            */}
            <DailyAction />
```

### ⚠️ コンポネントが自分で判断する形に変えた（⚠️ props を廃止）

```tsx
type ListResponse = {
    sections?: Section[];
    total?: number;
    truncated?: boolean;
    show?: boolean;
};

/**
 * ⚠️⚠️ **取得はブラウザのセッション中で使い回す**（`Menu.tsx` の `fetchMenuOnce` と同じ考え方）。
 *   ⚠️ URL が変わるたびに出す作りなので、⚠️ **毎回取りに行くと ① のDBに負担がかかる。**
 *   ⚠️ ⚠️ **ただし古い数字を出し続けないよう、5分で取り直す。**
 *     ⚠️ 同期や入力を済ませた直後は、⚠️ **最大5分は古い件数が出る。**
 */
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; promise: Promise<ListResponse> } | null = null;

/**
 * ⚠️⚠️ **「確認しました」を押したらこのタブでは二度と出さない。**
 *   ⚠️ サーバーの `show` も false になるが、⚠️ **キャッシュを見に行かせないため**に持つ。
 */
let sessionChecked = false;
```

```tsx
const DailyAction = () => {
    const { category } = useContext(AuthContext);
    const isSp = useIsSp();
    const location = useLocation();
    /** ⚠️ 画面が変わったことの目印。⚠️ `Menu.tsx` の `fullPath` と同じ作り方 */
    const fullPath = location.pathname + location.search;

    /** ⚠️ そもそも出す対象か。⚠️ **通信の前に判定する**（無駄な通信を避ける） */
    const isTarget = !isSp && category === 'order';

    useEffect(() => {
        if (!isTarget || sessionChecked) return;

        let alive = true;
        const now = Date.now();
        if (cached === null || now - cached.at > CACHE_MS) {
            cached = {
                at: now,
                promise: apiClient
                    .post('', { request: 'daily_action', roll: 'list', category })
                    .then((response) => (response.data ?? {}) as ListResponse),
            };
        }

        cached.promise
            .then((data) => {
                if (!alive) return;
                setSections(data.sections ?? []);
                setTotal(Number(data.total ?? 0));
                setTruncated(data.truncated === true);
                // ⚠️⚠️ **0件・確認済みなら開かない。** ⚠️ 空の枠を出しても意味がない
                setOpen(data.show === true && Number(data.total ?? 0) > 0);
            })
            .catch((e) => {
                /**
                 * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
                 *   「今日は0件だった」と誤解される。**
                 * ⚠️ ⚠️ ただし**モーダルは開かない。** 空の枠だけ出しても意味がない。
                 * ⚠️ ⚠️ **失敗したキャッシュは捨てる。** 残すと次の画面でも失敗したままになる
                 */
                cached = null;
                if (!alive) return;
                console.error('要確認の取得に失敗しました', e);
                setOpen(false);
            });

        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPath, isTarget, category]);
```

⚠️ 「確認しました」:

```tsx
        } finally {
            /**
             * ⚠️⚠️ **このタブではもう出さない。**
             *   ⚠️ サーバーの `show` も false になるが、⚠️ **キャッシュが残っている間は
             *     それを見に行ってしまう**ので、手元にも目印を持つ。
             */
            sessionChecked = true;
            setSending(false);
            setOpen(false);
        }
```

⚠️ 背景クリック:

```tsx
            /**
             * ⚠️⚠️ **閉じても「確認済み」にはならない**（`check` を送らない）。
             *   ⚠️ ⚠️ **次に画面を移るとまた出る**（2026-09-28 の判断）。
             */
            onHide={() => setOpen(false)}
```

### ⚠️ goToDashboard からも出るか

⚠️⚠️ **出る。** ⚠️ `App.tsx` の `<DailyAction />` は ⚠️ **`/home` では描画されない**ので、
⚠️ トップ（`/home`）→ 注文営業（`/company`）の遷移で ⚠️ **必ず新しく描画され、効果が走る。**
⚠️ 仮に描画されたままでも ⚠️ **`fullPath` が変わるので同じように動く。**

⚠️ ⚠️ **そのため `fromCategory` という目印は要らなくなり、削除した。**

### ⚠️ 消した配線

`frontend/src/components/company/Company.tsx`

```tsx
    /**
     * ⚠️⚠️ **「要確認」モーダルはこの画面が持っていない**（2026-09-28 に移した）。
     *   ⚠️ 以前は `location.state.fromCategory` を見てここで開いていたが、
     *     ⚠️ ⚠️ **「URL が変わるたびに出す」へ変わった**ため `App.tsx` に1つだけ置いてある。
     *   ⚠️ ⚠️ **ここに戻さないこと。** 会社実績を開いたときしか出なくなる。
     */
```

`frontend/src/components/Category.tsx`

```tsx
        /**
         * ⚠️ ここから遷移すると「要確認」モーダルも出る（2026-09-28）。
         *   ⚠️ ⚠️ **目印は渡していない。** `App.tsx` の `DailyAction` が
         *     ⚠️ **URL の変化そのものを見て開く**ため、この遷移でも必ず動く。
         *   ⚠️ ⚠️ **ここでモーダルを出すことはできない。**
         *     ⚠️ 直後に `navigate()` するので**出した瞬間に消える。**
         */
        await navigate(navigateMap[categoryValue] ?? '/home');
```

---

## ⚠️ つまずいた点

⚠️⚠️ **テンプレートリテラルの中にバッククォートを書いてビルドが落ちた**（⚠️ 2回）。

| どこ | 何を書いたか |
|---|---|
| ⚠️ `dailyAction.ts` の SQL | キャンペーン名の例と、`-` をバッククォートで囲んだ |
| ⚠️ `DailyAction.tsx` の `<style>` | 同じくキャンペーン名の例 |

⚠️ ⚠️ **どちらも「そこで文字列が終わる」。** ⚠️ **同じ場所に警告のコメントを残した。**

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| `react-scripts build`（①） | ⚠️ **成功** → ⚠️ **`main.4ff0e7b1.js`** |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ（⚠️ **完全一致**）

| セクション | 件数 | `hasDays` | ⚠️ `hasCampaign` | 返る列 |
|---|---|---|---|---|
| ⚠️ **未同期** | 55 | true | ⚠️ **true** | ⚠️ `… medium, campaign` |
| 来場日未入力 | 19 | true | false | `… medium` |
| 本日の2回目以降面談 | 4 | false | false | `step, …` |
| 本日の契約 | 1 | false | false | `step, …` |

⚠️ ⚠️ **未同期55件のうち34件にキャンペーンが入っていた**（⚠️ 例: `240000【DJH共通】資料請求`）。
⚠️ 残り21件は空で、⚠️ **画面では `-` と出る。**

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`<DailyAction />` は `App.tsx` に1つだけ。** ⚠️ `Menu.tsx` に移すと **二重に出る** |
| 2 | ⚠️⚠️ **背景クリックで閉じても、画面を移るとまた出る。** ⚠️ 止まるのは**「確認しました」だけ** |
| 3 | ⚠️ 件数は ⚠️ **5分キャッシュ**。⚠️ **同期直後は最大5分古い数字が出る** |
| 4 | ⚠️ キャンペーンは ⚠️ **未同期の表だけ**。⚠️ 他は `master_data` 由来で列を返していない |
| 5 | ⚠️⚠️ **テンプレートリテラル（SQL・`<style>`）にバッククォートを書かないこと** |
| 6 | ⚠️ `table-layout: fixed` を外すと ⚠️ **省略表示が効かず表がはみ出す** |
| 7 | ⚠️ `fromCategory` は ⚠️ **削除済み**。⚠️ 復活させる必要は無い（URL の変化で足りる） |
