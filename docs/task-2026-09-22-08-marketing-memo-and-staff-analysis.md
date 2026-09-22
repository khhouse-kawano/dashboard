# マーケ用メモ欄・スタッフ別分析・来場数/次アポ数（v2.2.145）

⚠️ 指示（`ReadMeClaude.md`）:

> - SatBaseDatabase.tsx の改修
>     モーダルの横幅いっぱいテーブルを表示しているため視認性が悪い-> p-5等を加えて要素間の間隔も少しあける
> - TableInterview.tsx の改修
>     TableCall.tsx と同じようなメモ欄の追加 **架電用メモ欄**と同じサイズで上部に配置
>     **マーケ用メモ欄**を placeholder に設定
>     master_data / master_data_kaeru / master_data_resale にカラムとコメント追加
>     TEXT DEFAULT NULL ／ 適切な英名を使う ／ ホワイトリストへの追加も忘れないように
> - 分析用APIにスタッフごとの推論もできるようにする
>     master_data の in_charge_user ／ interview_sheet の interview_log の staff の値を使う
>     Claude Desktop から「●●の契約実績を分析して」といったプロンプトに対応できるようにする
> - 来場数と次アポ数についてもレポートを出せるようにしてほしい
>     shopTrend/ShopTrend コンポネントの KPI を参照する

⚠️ 会話での追加指示:

> 上位工程に進んだ人は下位も達成 にする理由は営業マンがちゃんと入力しないから
> 至る所に見られるDashboardのKPIを丸める考えはこの営業マンの習性がもとになっている

> CustomerTrendKaeru.tsx では show_graph = 1 の値は使わず以前のKPIに戻す

⚠️ 確認して決めたこと:

| | 決定 |
|---|---|
| 列名 | ⚠️ **`memo_marketing`** |
| スタッフ分析 | ⚠️ **軸を追加**（専用エンドポイントは作らない） |
| 来場数・次アポ数 | ⚠️ **別の指標として追加**（⚠️ **既存の数字は変えない**） |

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend/scripts/sql/` | ⚠️ **`2026-09-22_memo_marketing.sql`** | ⚠️ **新規**（3テーブルに ALTER） |
| 同上 | `2026-09-22_update_log_2.2.145.sql` | 新規 |
| `backend/src/core/` | ⚠️ **`allowed_columns.php`** | ⚠️ **`memo_marketing` を追加**（⚠️ **ここが唯一の正**） |
| `backend/src/handlers/informationAction/` | `information_order_update.php` ほか ⚠️ **5本** | ⚠️ INSERT / UPDATE / bind に追加 |
| `backend-express/src/features/information/` | `masterDataColumns.ts` | ⚠️ PHP からの生成物を追従 |
| `frontend/src/components/` | `MasterData.ts` / `MasterDataSelected.ts` / `MasterDataWithMeta.ts` | 型に追加 |
| `frontend/src/components/information/` | ⚠️ **`TableInterview.tsx`** | ⚠️ **マーケ用メモ欄を上部に追加** |
| `frontend/src/components/header/` | `SatBaseDatabase.tsx` | ⚠️ 余白と間隔 |
| `frontend/src/components/customerTrend/` | ⚠️ **`CustomerTrendKaeru.tsx`** | ⚠️⚠️ **表の行を直書きへ戻した** |
| `backend-express/src/features/analysis/` | `dimensions.ts` / `metrics.ts` / `query.ts` / `meta.ts` | ⚠️ スタッフ軸・来場数・次アポ数 |

---

## 1. マーケ用メモ欄

### 1-1. SQL（3テーブル）

```sql
ALTER TABLE master_data
  ADD COLUMN memo_marketing TEXT DEFAULT NULL
  COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';
```

⚠️ `master_data_kaeru` / `master_data_resale` にも同じものを実行する。

⚠️⚠️ **3テーブルすべてに入れること。**
⚠️ 書き込みの許可リスト（`allowed_columns.php`）は ⚠️ **3テーブル共通**である。
⚠️ ⚠️ **1つでも列が無いと、その事業の画面で保存がまるごと失敗する**（`Unknown column`）。
⚠️ **メモだけでなく他の項目も保存されない。**

### 1-2. 通した経路（⚠️ **架電用メモと同じ**）

| ファイル | 何を足したか |
|---|---|
| ⚠️ `allowed_columns.php` | ⚠️ **`'memo_marketing',`**（⚠️ **ここが正。TS は生成物**） |
| `masterDataColumns.ts` | 同じ列名 |
| `information_order_update.php` | `UPDATE` の SET / `$data` / `bindNullable` |
| `information_spec_add.php` | `INSERT` の列 / 値 / `$data` / `bindNullable` |
| `information_spec_update.php` | update と同じ3か所 |
| `information_used_add.php` | add と同じ4か所 |
| `information_used_update.php` | update と同じ3か所 |

⚠️ ⚠️ **`information_order_add.php` には入れていない。**
⚠️ **架電用メモも入っていない**（注文の新規登録は最小限の項目しか受け取らない）。

### 1-3. 画面（`TableInterview.tsx`）

```tsx
            {/*
              * ⚠️ マーケ用メモ欄（2026-09-22 の指示）。
              *   ⚠️ 架電シート（TableCall.tsx）の「架電用メモ欄」と ⚠️ **同じ大きさ・同じ作り**。
              *   ⚠️ ⚠️ **面談の記録（interview_log）とは別物**で、
              *     ⚠️ 顧客台帳の `memo_marketing` 列に入る。
              *   ⚠️ ⚠️ **3事業とも列がある**（master_data / _kaeru / _resale）。
              *     ⚠️ 片方でも列が無いと、⚠️ **その事業の保存がまるごと失敗する。**
              */}
            <div className="mb-3">
                <textarea style={{ ...inputStyle, width: '93%', height: 'auto' }} placeholder='マーケ用メモ欄'
                    value={safeFormate(information.memo_marketing)}
                    rows={Math.max(2, safeFormate(information.memo_marketing).length / 50)}
                    onChange={(e) => setInformation(prev => ({
                        ...prev,
                        memo_marketing: e.target.value
                    }))}></textarea>
            </div>
```

⚠️ 面談シートの ⚠️ **いちばん上**（並び替えボタンより前）。

---

## ⚠️ 2. 分析APIにスタッフ軸

```ts
  staff: {
    label:
      '担当者（master_data.in_charge_user）。' +
      '⚠️ 現在の担当者であり、担当替えがあると過去の実績ごと移る',
    sql: () => groupExpr('m.in_charge_user'),
  },
```

⚠️⚠️ **氏名だが、顧客ではなく自社の担当者である。** ⚠️ 店舗・営業課と同じ扱い。
⚠️ ⚠️ **顧客の氏名は今までどおり軸にしない。**

⚠️ これで Claude Desktop から次のように引ける。

```
GET /analysis/pivot?groupBy=staff&metrics=leads,visits,contracts&rates=contractRatePct
GET /analysis/funnel?staff=●● &groupBy=month
```

### 2-1. 面談シートの staff（`interviewsLed`）

⚠️ `interview_sheet.interview_log` の各面談に `staff`（実施した人）が入っている。
⚠️ ⚠️ **`in_charge_user` と一致するかを数える。**

```ts
  interviewsLed: {
    kind: 'count',
    needsInterview: true,
    label:
      '担当者本人が実施した面談の記録がある顧客数（interview_sheet の staff と一致）。' +
      '⚠️ staff が記録されている面談ログは全体の1割ほどしかないため、下限値である',
    sql:
      "SUM(m.in_charge_user IS NOT NULL AND m.in_charge_user <> ''" +
      " AND JSON_SEARCH(iv.interview_log, 'one', m.in_charge_user, NULL, '$[*].staff') IS NOT NULL)",
  },
```

⚠️ 結合側も直した（`query.ts`）。

```ts
    /**
     * ⚠️ `interview_log` の本文も持ち出す（2026-09-22）。
     *   ⚠️ ⚠️ **中身は返さない。** ⚠️ 担当者名と突き合わせて
     *     ⚠️ **「本人が面談したか」を数えるためだけ**に使う（METRICS.interviewsLed）。
     *   ⚠️ `MAX()` なのは、⚠️ **1顧客1行がほぼ前提**だから
     *     （実測 18,161行 / 18,160人）。⚠️ 複数行あれば新しくない方を落とす。
     */
```

⚠️⚠️ **`staff` が入っている面談ログは全体の1割ほど**（実測 18,161行中 1,838行）。
⚠️ ⚠️ **0 件でも「面談していない」という意味にはならない。**


### ⚠️⚠️ 2-2. `in_charge_user` はそのまま使えない（2026-09-22 追記）

⚠️ 利用者から:

> master_data の in_charge_user は失注や案件の長期化が発生すると **管理** に変更することがあるため
> master_data の first_interviewed_user のカラムも要確認 => コメント通り変更される前の営業が入る

⚠️ 実測（`show_dashboard = 1` の 24,607件）

| | 件数 |
|---|---|
| ⚠️⚠️ **`in_charge_user` が「◯◯店 管理」** | ⚠️ **17,822件（72%）** |
| `first_interviewed_user`（列コメント「※旧担当」）あり | 7,133件 |
| ⚠️ **管理かつ旧担当あり**（救える） | ⚠️ **4,700件** |
| 契約済みのうち担当が管理 | 49件 / 991件 |

⚠️⚠️ **`in_charge_user` のままでは、営業の7割が「KH鹿児島店 管理」に吸い込まれる。**

```ts
export const STAFF_SQL =
  "CASE WHEN m.in_charge_user LIKE '%管理%'" +
  " AND TRIM(COALESCE(m.first_interviewed_user, '')) <> ''" +
  ' THEN m.first_interviewed_user ELSE m.in_charge_user END';
```

⚠️ ⚠️ **旧担当も空なら「◯◯店 管理」のまま出す。**
⚠️ **勝手に「(未設定)」へ寄せない。救えなかった件数が見えなくなる。**

| 軸 | 中身 |
|---|---|
| ⚠️ **`staff`** | ⚠️ **上の読み替え済み**（営業別の実績はこちら） |
| `staffCurrent` | ⚠️ `in_charge_user` の生の値（誰が管理案件を抱えているか） |

⚠️ ⚠️ **絞り込みも同じ式を使う**（`query.ts` の `buildWhere` が軸の SQL をそのまま使う）。
⚠️ `interviewsLed` の突き合わせも ⚠️ **同じ `STAFF_SQL`** にしてある。

⚠️ 効果（2025-01 以降・契約数の上位）

| 担当 | 旧: 反響 | ⚠️ **新: 反響** | 契約 |
|---|---|---|---|
| 上玉利 幹太 | 70 | ⚠️ **153** | 22 |
| 小松 光志 | 75 | ⚠️ **126** | 24 |
| 井上 健太郎 | 57 | ⚠️ **72** | 26 |

⚠️⚠️ **失注した案件が本人の実績に戻るため、反響数が増えて契約率は下がる。**
⚠️ ⚠️ **これが実態である。**

---

## ⚠️ 3. 来場数・次アポ数（⚠️ **ダッシュボードと同じ数え方**）

⚠️ 利用者の説明:

> 上位工程に進んだ人は下位も達成 にする理由は営業マンがちゃんと入力しないから

```ts
/**
 * ⚠️⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
 *
 * ⚠️ ⚠️ **理由は「営業が前の工程の日付を入れないから」である**（2026-09-22 に利用者から）。
 *   ⚠️ 契約日は必ず入るが、⚠️ **初回面談日が空のまま契約済みの顧客が実在する。**
 *   ⚠️ ⚠️ **実態として工程を飛ばしたわけではない。** ⚠️ 入力の問題である。
 *   ⚠️ 素直に数えると ⚠️ **契約数 > 面談数**のような逆転が起きる。
 *
 * ⚠️ ⚠️ **ダッシュボードの KPI（shopTrend/ShopTrend*.tsx）はすべてこの数え方**であり、
 *   ⚠️ **分析APIの firstInterview / secondInterview とは数字が違う。**
 *   ⚠️ 画面と突き合わせるときは、⚠️ **こちらの指標を使うこと。**
 */
const reachedOrBeyond = (phases: PhaseKey[]): string =>
  `SUM(${phases.map(p => `${phaseDate(p)} IS NOT NULL`).join(' OR ')})`;
```

| 指標 | 数え方 | ShopTrend の名前 |
|---|---|---|
| ⚠️ **`visits`** | 初回面談 or 第二面談 or 事前審査 or 契約 | ⚠️ **実来場数** |
| ⚠️ **`nextAppointments`** | 第二面談 or 事前審査 or 契約 | ⚠️ **次アポ数** |
| `reservations` | 来場予約日あり or 初回面談 | 来場予約数 |

⚠️ 比率も足した（`visitRatePct` / `nextAppointmentRatePct`）。

⚠️⚠️ **既存の `firstInterview` / `secondInterview` は変えていない。**
⚠️ ⚠️ **meta に「どちらを見るか」を書いた**（Claude Desktop には画面の文脈が無いため）。


### ⚠️ 3-1. 既定のファネルにも入れた（2026-09-22 追記）

⚠️ 利用者の指示:

> 数値が shopTrend ディレクトリの KPI 設定になり歩留まりが揃うことが大切

⚠️ ⚠️ **既定のファネル（`FUNNEL_METRICS`）に `visits` と `nextAppointments` を入れた。**
⚠️ ⚠️ **入れないと、Claude は `firstInterview` を来場数として語る**（画面と合わない）。

```ts
export const FUNNEL_METRICS: MetricKey[] = [
  'leads',
  'energized',
  'firstInterview',
  'visits',
  'secondInterview',
  'nextAppointments',
  'preScreening',
  'contracts',
  'lost',
];
```

⚠️ 比率はファネルが全種返すので、⚠️ **`visitRatePct` / `nextAppointmentRatePct` も自動で入る。**

### ⚠️ 3-2. MCP サーバー側の穴を塞いだ

⚠️⚠️ **`get_funnel` の軸の一覧（`z.enum`）に `staff` が無く、Claude Desktop から弾かれていた。**
⚠️ ⚠️ **② に軸を足しただけでは、MCP 経由では使えない。**

| 直したところ | |
|---|---|
| 軸の一覧 | ⚠️ **`'staff'` を追加** |
| 入力 | ⚠️ **`staff`（担当者で絞る）を追加** |
| 説明文 | ⚠️ 担当者の質問への使い方／⚠️ **画面と突き合わせるなら visits を使う**こと |

---

## ⚠️ 4. CustomerTrendKaeru.tsx を直書きへ戻した

⚠️ 利用者の指摘:

> CustomerTrendKaeru.tsx のKPIの設定が変わっていることに気がついた
> Web検索 Instagram はホームページ反響に丸めていたはず

⚠️ ⚠️ **こちらの改修ではない。** ⚠️ **このファイルは v2.2.141 以降1行も触っていない。**

⚠️ 原因は ⚠️ **2026-09-11 に表の行を `medium_kaeru.show_graph = 1` から作る形へ変えていた**こと。
⚠️ ⚠️ **運用側で `show_graph` を変えると、表の行が黙って増減する。**

```tsx
  const displayMediums = ['SUUMO', `HOME'S`, 'ALLGRIT', 'アットホーム'];
```

⚠️ ⚠️ **ここは「KPIの定義」であって、媒体マスタの表示設定ではない。**

⚠️ 併せて、使わなくなった `mediumList` の state と `MediumType` を外した。

### ⚠️ 見つけた別の不具合

⚠️⚠️ **コードは `sort_key` 列を読んでいたが、`medium_kaeru` にこの列は無い。**

```tsx
.sort((a, b) => (Number(a.sort_key) || 0) - (Number(b.sort_key) || 0))
```

⚠️ `Number(undefined)` は NaN → `|| 0` で ⚠️ **全部 0 になり並び順が不定**だった（⚠️ **エラーは出ない**）。
⚠️ ⚠️ **直書きに戻したことで、この問題も消えた。**

---

## ⚠️ 5. ホームページ反響の行に色を付ける

⚠️ 利用者の指示:

> CustomerKaeru.tsx はこのままでよい(show_graph=1)
> その代わり CustomerKaeru.tsx ではホームページ反響の行を table-primary 等で視認性よく
> CustomerTrendKaeru.tsx も同様にホームページ反響及び展開した行を table-primary 等で視認性をよく

⚠️ ⚠️ **`CustomerKaeru.tsx` は `show_graph = 1` のままにする**（利用者の判断）。
⚠️ **2つの画面で行の顔ぶれが違いうることは、色を付けて見分けられるようにすることで受け入れる。**

### `CustomerKaeru.tsx`

```tsx
                                    const isHomepageRow = value.medium === HOMEPAGE_ROW;

                                    return (
                                        <tr key={value.id ?? `medium-${index}`} className={isHomepageRow ? 'table-primary' : undefined}>
                                            <td className={`sticky-column${isHomepageRow ? ' table-primary' : ''}`} style={{ textAlign: 'center' }}>{value.medium}</td>
```

### `CustomerTrendKaeru.tsx`

```tsx
              const isHomepageRow = medium === 'ホームページ反響計'
                || (showSummary && hpMediums.includes(medium));

              return (
                <React.Fragment key={mediumIndex}>
                  <tr className={isHomepageRow ? 'table-primary' : undefined}>
                    <td className={`align-middle sticky-column text-center${isHomepageRow ? ' table-primary' : ''}`} style={theme.tdName} rowSpan={1}>
```

⚠️⚠️ **「詳細を表示」で開く内訳（会員登録・資料請求・来場予約・先取物件・その他）も同じ色にしている。**
⚠️ ⚠️ **どこまでが内訳なのかが分からなくなるため。**

⚠️⚠️ **`sticky-column` の `td` にも当てること。**
⚠️ ⚠️ **固定列は背景を自前で持っており、`tr` だけに付けると1列目が白いまま残る。**

---

## 確認（2026-09-22・ローカル）

### ⚠️ 分析API（一時キーで実測）

| 確認 | 結果 |
|---|---|
| `meta` に staff 軸と新指標 | ⚠️ **すべて出る** |
| ⚠️ **`pivot?groupBy=staff`** | ⚠️ **200 / 161人** |
| ⚠️ **`interviewsLed`** | ⚠️ **人により 0〜18**（⚠️ 記録のある人だけ立つ） |
| ⚠️ **visits > firstInterview** | ⚠️ **2026年: 2,667 > 2,637**（⚠️ **差は30件**） |
| ⚠️ **nextAppointments > secondInterview** | ⚠️ **2026年: 1,374 > 1,274**（⚠️ **差は100件**） |

⚠️ 実測（スタッフ別・契約数の上位）

```
森吉 大樹    leads 48 / visits 45 / nextAppointments 37 / contracts 27 / 契約率 56.3%
井上 健太郎  leads 57 / visits 48 / nextAppointments 36 / contracts 26 / 契約率 45.6%
上玉利 幹太  leads 70 / visits 38 / nextAppointments 35 / contracts 24 / 契約率 34.3%
```

⚠️ 検証に使った API キーは ⚠️ **一時的に作り、確認後に削除した**。⚠️ **値はどこにも書き出していない。**

### その他

| 確認 | 結果 |
|---|---|
| ALTER TABLE（3テーブル） | ⚠️ **`memo_marketing` が入ることを確認** |
| `php -l`（6ファイル） | ⚠️ **エラー0件** |
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `npm run build`（frontend） | ⚠️ **成功**（⚠️ **今回の変更による新しい警告は無し**） |

---

## ⚠️ ブラウザでの確認（未実施）

- [ ] 面談シートの上部に ⚠️ **マーケ用メモ欄**が出る（3事業とも）
- [ ] ⚠️⚠️ **入力 → 保存 → 開き直して残っている**（⚠️ **注文・建売・中古のすべてで**）
- [ ] ⚠️ 架電用メモと ⚠️ **混ざっていない**
- [ ] SatBaseサマリーの ⚠️ **余白が広がって読みやすい**
- [ ] ⚠️⚠️ **反響推移（建売）の表が SUUMO / HOME'S / 公式LINE / アットホーム の4行**
- [ ] ⚠️⚠️ **Web検索・Instagram が独立行として出ていない**
- [ ] ⚠️ **ホームページ反響の行に色が付いている**（⚠️ **顧客分析・反響推移の両方**）
- [ ] ⚠️⚠️ **「詳細を表示」で開いた内訳にも色が付いている**（⚠️ **1列目も含めて**）
- [ ] Claude Desktop で「●●の契約実績を分析して」

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`CustomerKaeru.tsx` は `show_graph = 1` のまま**（利用者の判断）。⚠️ **反響推移と行の顔ぶれがずれうる**ので、⚠️ **両画面ともホームページ反響の行に色を付けて見分けられるようにした** |
| 2 | ⚠️ `medium_kaeru.show_graph` は ⚠️ **他の画面がまだ使っている**。⚠️ **消さないこと** |
| 3 | ⚠️ `interviewsLed` は ⚠️ **下限値**。⚠️ 面談ログに staff を入れる運用が広がれば精度が上がる |
| 4 | ⚠️ スタッフ軸は ⚠️ **担当替えで過去の数字が動く**。⚠️ 月次で固定したいなら別の設計が要る |

---

## ⚠️ 6. 追加の指示（2026-09-22 夕方）

### ⚠️ 6-1. マーケ用メモ欄に文字が出なかった

⚠️ 利用者:

> 入力しても文字がフロントに反映されない **依存関係等を要確認**

⚠️⚠️ **原因は `memo` の比較リストの書き忘れ。**

⚠️ `TableInterview` は ⚠️ **`React.memo` に自前の比較関数**を付けており、
⚠️ ⚠️ **列名を並べた `fieldsToCheck` に入っていない列は、変わっても再描画されない。**

⚠️ ⚠️ **`setInformation` は動いていて値は保持されている。** ⚠️ **画面だけが更新されない。**
⚠️ **エラーは出ない。** ⚠️ 打った文字が消えたように見える。

```tsx
    /**
     * ⚠️⚠️ **この画面で値を表示・入力している列は、すべてここに書くこと。**
     *
     *   ⚠️ ⚠️ **書き忘れると、入力しても画面に文字が出ない。**
     *     ⚠️ `setInformation` は動いて値は保持されるが、
     *       ⚠️ **この比較が true を返して再描画されない**ため、
     *       ⚠️ ⚠️ **打った文字が消えたように見える。**
     *     ⚠️ **エラーは出ない。**
     *
     *   ⚠️ 2026-09-22、⚠️ **`memo_marketing` を書き忘れて実際に起きた。**
     */
    const fieldsToCheck = [
        ...
        // ⚠️ マーケ用メモ欄（2026-09-22 追加）
        'memo_marketing'
    ];
```

### 6-2. rank/ と map/ も SaaS 風に

⚠️⚠️ **表の中身には触っていない。**

| ディレクトリ | やり方 |
|---|---|
| `rank/`（3ファイル） | ⚠️ **`.rk_plain` を表の外側に被せる。** ⚠️ 2段見出し（colSpan / rowSpan）はそのまま |
| `map/`（3ファイル） | ⚠️ **`.rk_screen` を画面の外側に付ける。** ⚠️ Bootstrap の Card / Form.Select の色と角だけ揃える |

⚠️ ⚠️ **セルを書き換えると数字がずれる**ため、⚠️ **見出しと絞り込みだけを差し替えた。**

⚠️ 見出しと月の選択は `rk_head` / `rk_bar` に寄せ、⚠️ **`<option selected>` を `value` 制御に直した**（React では効かない書き方だった）。

### ⚠️ 6-3. first_interviewed_user の記録開始（2026年6月）

⚠️ 利用者:

> first_interviewed_user の記録を始めたのが2026年6月からだということを推論の参考にする

⚠️ meta の注意点に足した。⚠️ ⚠️ **古い月ほど「◯◯店 管理」のまま残り、営業別の実績が小さく出る。**

⚠️ ⚠️ **ただし実測では、値自体は2026年6月より前にも入っている。**

| 年 | 反響 | 旧担当あり |
|---|---|---|
| 2025 | 13,125 | ⚠️ **11,340（86%）** |
| 2026 | 8,781 | 4,450（51%） |

⚠️ ⚠️ **「埋まっていること」と「運用として維持されていたこと」は別**なので、両方を meta に書いてある。
⚠️ **どちらを信じるかは Claude ではなく読む人が決められるようにした。**
