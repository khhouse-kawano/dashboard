# 2026-10-15 紹介キャンペーンサマリーの404修正・CLAUDE.md に開発終了条件とデザインポリシーを追記（v2.2.192）

## 依頼
- 開発環境で確認したところ 404 が返る
- CLAUDE.md に「改修後にコード再読・実行テスト・リファクタリング」を開発終了条件とする旨を追記
- デザインポリシーとして GoogleReview.tsx を UI ベンチマークとする旨を追記。特に指示がない場合は GoogleReview.tsx と、それを参照して作られたコンポーネントを基本とする

## 404 の原因
- 画面の通信は ① の PHP（`backend/src/core/express_proxy.php`）を経由し、**許可リストにある request だけ ② へ転送**される
- `introductory_summary` を許可リストに入れていなかったため、① が自分のハンドラを探して `{"status":"error","message":"該当する処理がありません。"}`（404）を返した
- 前回は ② を直接呼んで確認しただけで、① を通す経路を確認していなかった（確認不足）

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/src/core | **express_proxy.php** | `expressProxyRequests()` と `expressProxyExclusive()` の両方に `'introductory_summary'` を追加 |
| backend-express/src/features/introductory | **summary.ts** | リファクタリング: `UNSET_SOURCE` → `UNSET_LABEL`、`UNKNOWN_AREA` を追加、関数 `isUnset` を追加（未入力・不明を並びの最後に）、`SummaryFilter.area` のコメント |
| frontend/src/components/header | **IntroductorySummary.tsx** | リファクタリング: 定数 `UNKNOWN_AREA`・関数 `isUnset` を追加（表の並べ替えで未入力・不明を最後に） |
| （ルート） | **CLAUDE.md** | 「開発終了の条件」「デザインポリシー」を追加 |
| docs | deploy-v2.2.192.md | ① PHP の手順を追加（順序 ② → ① PHP → ① フロント → ① SQL） |

### express_proxy.php（expressProxyRequests の末尾）
```php
        'google_review:summary',

        // -----------------------------------------------------------------
        // 2026-10-15 新規（v2.2.192）。紹介キャンペーンサマリー（header/IntroductorySummary.tsx）。
        //
        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある**（features/introductory/summary.ts）。
        //   ⚠️ ⚠️ **入れないと ① が404を返す**（2026-10-15 に開発環境で発覚）。
        //   ⚠️ expressProxyExclusive() にも入れてある。
        // ⚠️ `inquiry_introductory`（反響一覧）・`introductory`（GAS の受付）とは別物。
        // -----------------------------------------------------------------
        'introductory_summary',
    ];
}
```
### express_proxy.php（expressProxyExclusive の末尾）
```php
        'list:black:used',

        // ⚠️ 2026-10-15 新規（v2.2.192）。紹介キャンペーンサマリー。
        //   ⚠️ ① に PHP ハンドラが無いので、② が落ちたら 502 で止める（① の404より原因が分かる）。
        'introductory_summary',
    ];
}
```

### summary.ts（変更部分）
```ts
/** 紹介元・ブランド・店舗が空のときの表示。⚠️ 紹介元は実測で約4割が空（2026-10-15） */
export const UNSET_LABEL = '（未入力）';
/** エリアが分からないときの表示（⚠️ 店舗が shop_list に無い、または名前に県名が無い） */
export const UNKNOWN_AREA = '（不明）';
```
```ts
const isUnset = (key: string): boolean => key === UNSET_LABEL || key === UNKNOWN_AREA;
```
```ts
/** キーごとの歩留まり。⚠️ 反響の多い順（⚠️ 未入力・不明は最後） */
const groupFunnel = (list: Customer[], keyOf: (c: Customer) => string): FunnelRow[] => {
  const groups = new Map<string, Customer[]>();
  for (const c of list) {
    const key = keyOf(c);
    const found = groups.get(key);
    if (found === undefined) groups.set(key, [c]);
    else found.push(c);
  }
  return [...groups.entries()]
    .map(([key, rows]) => funnelOf(key, rows))
    .sort((a, b) => Number(isUnset(a.key)) - Number(isUnset(b.key)) || b.inquiry - a.inquiry);
};
```
```ts
      source: hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL,
      brand: hasValue(row.brand) ? String(row.brand).trim() : UNSET_LABEL,
      shop: shop === '' ? UNSET_LABEL : shop,
      area: area === '' ? UNKNOWN_AREA : area,
```

### IntroductorySummary.tsx（変更部分）
```tsx
/** ⚠️ ② が空のときに返す表示。⚠️ summary.ts の UNSET_LABEL / UNKNOWN_AREA と同じ */
const UNSET_SOURCE = '（未入力）';
const UNKNOWN_AREA = '（不明）';
const isUnset = (key: string) => key === UNSET_SOURCE || key === UNKNOWN_AREA;
```
```tsx
    const sorted = useMemo(() => [...rows].sort((a, b) => {
        // ⚠️ 未入力・不明は並べ替えに関係なく最後（⚠️ 先頭に来ると目立ちすぎる）
        if (isUnset(a.key) !== isUnset(b.key)) return isUnset(a.key) ? 1 : -1;
        const x = valueOf(a, sortKey);
        const y = valueOf(b, sortKey);
        const diff = typeof x === 'string' || typeof y === 'string'
            ? String(x).localeCompare(String(y), 'ja')
            : x - y;
        if (diff === 0) return a.key.localeCompare(b.key, 'ja');
        return sortOrder === 'asc' ? diff : -diff;
    }), [rows, sortKey, sortOrder]);
```

### CLAUDE.md（追加した節）
```markdown
## 開発終了の条件
改修のあと、次の3つをすべて終えるまで「完了」と報告しないこと。終えていないものがあれば、完了ではなく「未確認」として何が残っているかを書く。
1. **コードの再読**：変更・追加したファイルを最初から読み直す。型・null・境界値・命名・コメントと実装の食い違い・消し忘れを確認する。
2. **実行テスト**：実際に動かして結果を確かめる。型チェックやビルドが通っただけでは完了にしない。
   - **本番と同じ経路で通す**。画面からの通信は ① の PHP（`backend/src/core/express_proxy.php`）を経由して ② へ届く。② を直接呼んで動いても、① を通した確認をしていなければ未確認とする。
   - ② だけにある新しい `request` を作ったら、`express_proxy.php` の `expressProxyRequests()` と `expressProxyExclusive()` の両方に入れる。入れないと ① が 404（該当する処理がありません）を返す。
   - ローカルでは ① が `localhost:8080/`、② が `localhost:3001/api/gateway`。トークン無しで ① に投げて 401（認証が必要です）が返れば ② まで届いている。404 なら許可リストの漏れ。
   - 画面は可能な限りブラウザ（Playwright）で表示して確かめる。
3. **リファクタリング**：今回変更・追加したコードに限って、重複・不要な処理・不要なコメント・使っていない変数や import を整理する。整理したあとは 2 の実行テストをもう一度通す。
   - 対象は今回の改修範囲だけ。既存の動作するコードを指示なくリファクタリングしない、という上のルールはそのまま守る。

## デザインポリシー
- UI のベンチマークは `frontend/src/components/header/GoogleReview.tsx` とする。
- 特に指示がない場合は、毎回 `GoogleReview.tsx` と、それを参照して作られたコンポーネントを基本にして作る。
  - 例：`header/StaffContractRate.tsx`、`header/IntroductorySummary.tsx`、`header/CompetitorSummary.tsx`、`header/EditBlackList.tsx`、`company/QuarterSummary.tsx`、`DailyAction.tsx`
- 合わせる点：コンポーネント専用の `<style>`（クラス名に接頭辞を付けて共通CSSを汚さない）、絞り込みバー、KPI カード、表（見出しクリックでの並べ替え・見出しの固定）、注意書きの枠、色・文字サイズ・余白・角丸。
- 全画面モーダルで開く画面は、閉じるボタンを `Header.tsx` が出すので、コンポーネント側に作らない。
```

## 開発終了の条件に沿った確認（今回の作業に当てはめた）
1. コードの再読: summary.ts・IntroductorySummary.tsx・express_proxy.php を読み直し、上のリファクタリングを実施
2. 実行テスト
   - ① 経由（localhost:8080/、トークン無し）: `introductory_summary` → **401「認証が必要です。」**（② まで届いている）。比較として許可リストに無い request → 404「該当する処理がありません。」（修正前の症状と同じ）
   - ② の集計（tsx で直接）: 指定なし 803/674/504/253、2025-06〜2026-06 453/395/305/158、KH鹿屋店 33（併売店込み）、宮崎県 174、開始月＞終了月 0件。エリアの並びで「（不明）」が最後
   - ② 型チェック通過。PHP 構文チェック（php -l）通過
   - フロント: 型チェックは既存の5件以外なし、ビルド main.af9e5c53.js、Playwright で表示（エリアで店舗の選択肢が絞られる・絞り込みのたびに再取得・（不明）が最後）
3. リファクタリング後に 2 をもう一度通した（上の結果はリファクタリング後のもの）
- ⚠️ 未確認: ログインした状態で開発環境の画面から開く確認（トークンを読まないため、利用者の確認が必要）
