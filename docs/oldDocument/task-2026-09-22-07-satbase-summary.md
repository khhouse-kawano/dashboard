# SatBaseサマリー（物件台帳）を追加する（v2.2.144）

⚠️ 指示（`ReadMeClaude.md`）:

> - KHF物件管理【KHG】 - 中間加工（物件）.csv を読み込みテーブル作成
>     文字型は適切なものを利用してコメントも追記／最後にsqlも準備する
>     **広告出稿状況** **Instagram投稿状況** のカラムを追加
> - Header.tsx の改修
>     **土地・物件管理**から土地情報同期と土地情報一覧を削除
>     **SatBaseサマリー**を追加して…テーブルを表示／SatBaseDatabase.tsx を作成
>     **広告出稿状況** **Instagram投稿状況** この項目のみ編集可とする->トグルボタンでtinyint型
>     項目が多いのでコンポネント上部に表示項目を選べるようなUIを追加する

⚠️ 会話での追加指示:

> テーブルはスクロール位置の監視による30行ずつのレンダリングにするかページネーションにするかパフォーマンスのよいUIとする
> また物件名と各種ステータスで検索機能も追加する
> 物件ID（最初の列のほう）をユニークとする
> 物件IDをNumber処理したうえで降順表示とする
> SNS出稿状況や投稿状況でもフィルター処理ができるようにしてほしい
> 投稿状況や出稿状況はデフォルトが0とする

⚠️ 確認して決めたこと:

| | 決定 |
|---|---|
| テーブル名 | ⚠️ **`satbase_property`** |
| SQL | ⚠️ **CREATE と INSERT（1,910行）の両方** |
| 編集権限 | ⚠️ **ログインしている全員**（`auth: 'staff'`） |
| 空の3列 | ⚠️ **作る。ただし表示項目では既定で未選択** |

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `backend/scripts/sql/` | ⚠️ **`2026-09-22_satbase_property.sql`** | ⚠️ **新規**（CREATE・42列） |
| 同上 | ⚠️ **`2026-09-22_satbase_property_data.sql`** | ⚠️ **新規**（INSERT 1,910行・663KB） |
| 同上 | `2026-09-22_update_log_2.2.144.sql` | 新規 |
| `backend-express/src/features/` | ⚠️ **`satbase.ts`** | ⚠️ **新規** |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ `satbase_list` / `satbase_update` を登録 |
| `backend/src/core/` | `express_proxy.php` | ⚠️ **2か所とも**に2件追加 |
| `frontend/src/components/header/` | ⚠️ **`SatBaseDatabase.tsx`** | ⚠️ **新規** |
| 同上 | `Header.tsx` | ⚠️ メニューの入れ替え |
| `frontend/src/utils/` | `version.ts` | `2.2.144` |

---

## 1. テーブル `satbase_property`

⚠️ CSV の38列 ＋ ⚠️ **追加4列**（`ad_posted` / `instagram_posted` / `updated` / `updated_by`）。

⚠️ ⚠️ **全列に日本語の COMMENT を付けてある。**

```sql
CREATE TABLE IF NOT EXISTS satbase_property (
  property_id                INT(11)       NOT NULL COMMENT '物件ID。⚠️ 主キー。画面はこの値の降順で並べる',
  property_name              VARCHAR(128)  DEFAULT NULL COMMENT '物件名称。例: 2L国分重久ⅡG 2F',
  usage_type                 TINYINT(4)    DEFAULT NULL COMMENT '用途の区分（0〜5の数値。意味は SatBase 側の定義）',
  customer_name              VARCHAR(128)  DEFAULT NULL COMMENT 'お客様名。⚠️ 個人情報。契約済みの物件のみ入る',
  ...
  ad_posted                  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '広告出稿状況。⚠️ 画面のトグルで更新する（0=未出稿 / 1=出稿済み）',
  instagram_posted           TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Instagram投稿状況。⚠️ 画面のトグルで更新する（0=未投稿 / 1=投稿済み）',
  updated                    DATETIME      DEFAULT NULL COMMENT '画面から最後に更新した日時（トグルのみ）',
  updated_by                 VARCHAR(128)  DEFAULT NULL COMMENT '画面から最後に更新したスタッフ名（トグルのみ）',
  PRIMARY KEY (property_id),
  KEY idx_sales_status (sales_status),
  KEY idx_progress_status (progress_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SatBase の物件台帳（中間加工）';
```

### ⚠️ 型を決めるときに見たこと（実データ）

| 列 | 実データ | 決めた型 |
|---|---|---|
| ⚠️ **販売期間** | ⚠️ **`+0` `+12` のような符号付き** | ⚠️ **VARCHAR**（⚠️ 数値にできない） |
| ⚠️ **県** | ⚠️ **`#N/A` が混ざる** | VARCHAR |
| ⚠️ **用途** | 0〜5 | TINYINT |
| ⚠️ **基礎着工日・入金日** | ⚠️ **`1970-01-01` が混ざる**（未入力の代用） | ⚠️ **DATE のまま**（⚠️ **勝手に NULL にしない**） |
| ⚠️ 日付11列 | ⚠️ **`2016-07-01` と `2017/11/25` が混在** | ⚠️ **生成時に `YYYY-MM-DD` へ揃えた** |
| 金額4列 | 最大8桁 | INT |
| ⚠️ 決済日（仕入）/ 契約日（仕入）/ 位置情報 | ⚠️ **全件空** | ⚠️ **作る**（既定で非表示） |
| 物件ID（一般）/ ID（管理職） | ⚠️ **物件IDと同じ値** | ⚠️ **残す**（CSVのまま） |

⚠️ ⚠️ **1,910行すべて取り込めた**（⚠️ **物件IDの重複・欠損は0件**）。

---

## 2. バックエンド（⚠️ **新規＝Express のみ**）

### ⚠️ 2-1. `backend-express/src/features/satbase.ts`（全文）

```ts
/**
 * ⚠️⚠️ **画面から書き換えてよい列。**
 *   ⚠️ ⚠️ **ここに無い列名は受け付けない。** ⚠️ 追加するときは指示を受けてからにすること。
 */
const EDITABLE_COLUMNS = ['ad_posted', 'instagram_posted'] as const;

type EditableColumn = (typeof EDITABLE_COLUMNS)[number];

const isEditableColumn = (value: string): value is EditableColumn =>
  (EDITABLE_COLUMNS as readonly string[]).includes(value);

/**
 * 一覧。
 *
 * ⚠️ 並べ替えは ⚠️ **`property_id` の降順**（新しい物件が上）。
 *   ⚠️ ⚠️ **文字列ではなく数値で並べる**。⚠️ 列が INT なので SQL 側で正しく並ぶ。
 */
export const runSatbaseList = async (): Promise<unknown> => {
  const rows = await query<DynamicRow>(
    'SELECT * FROM satbase_property ORDER BY property_id DESC'
  );

  return { properties: rows };
};

/**
 * トグルの更新。
 *
 * ⚠️⚠️ **列名は許可リストと突き合わせてから SQL に入れる。**
 *   ⚠️ ⚠️ **プレースホルダは列名には使えない**ので、ここを通さないと
 *     ⚠️ **任意の列を書き換えられる穴になる。**
 *
 * ⚠️ 値は 0 か 1 に丸める。⚠️ **画面がトグルなので、それ以外は来ない前提にしない。**
 */
export const runSatbaseUpdate = async (
  input: SatbaseUpdateInput
): Promise<{ status: string; message?: string }> => {
  if (!Number.isInteger(input.propertyId) || input.propertyId <= 0) {
    return { status: 'error', message: '物件が指定されていません。' };
  }

  if (!isEditableColumn(input.column)) {
    // ⚠️ 列名はそのまま返さない（何が書ける列かを外へ知らせない）
    return { status: 'error', message: 'この項目は画面から変更できません。' };
  }

  const value = input.value === 1 ? 1 : 0;

  const result = await execute(
    `UPDATE satbase_property
        SET ${input.column} = ?, updated = NOW(), updated_by = ?
      WHERE property_id = ?`,
    [value, input.staff.slice(0, 128), input.propertyId]
  );

  if (result.affectedRows === 0) {
    return { status: 'error', message: '物件が見つかりませんでした。' };
  }

  return { status: 'ok' };
};
```

⚠️⚠️ **列名を受け取って UPDATE する形にしている。**
⚠️ ⚠️ **プレースホルダは列名に使えない**ため、⚠️ **許可リストが唯一の防波堤**である。

### 2-2. 登録（`registry.ts`）

```ts
register({
  request: 'satbase_list',
  summary: 'SatBase の物件台帳の一覧（全件。絞り込みと並べ替えは画面）',
  phpSource: '（新規。PHP版なし）',
  auth: 'staff',
  handler: async () => runSatbaseList(),
});

register({
  request: 'satbase_update',
  summary: '【書き込み】広告出稿状況 / Instagram投稿状況のトグルを更新する',
  phpSource: '（新規。PHP版なし）',
  auth: 'staff',
  handler: async (ctx) =>
    runSatbaseUpdate({
      propertyId: Number(ctx.body.propertyId ?? 0),
      column: String(ctx.body.column ?? ''),
      value: Number(ctx.body.value ?? 0),
      staff: String(ctx.staff?.name ?? ''),
    }),
});
```

⚠️ ⚠️ **`express_proxy.php` は2か所とも**に追加（⚠️ **① に PHP 版が無いため**）。

---

## 3. 画面（`SatBaseDatabase.tsx`）

### ⚠️ 3-1. 30行ずつ描く（ページ送りにしなかった理由）

⚠️ 1,910行 × 40列を一度に描くと重い。⚠️ ⚠️ **`IntersectionObserver` で末尾が見えたら30行足す。**

```tsx
/** ⚠️ 1回に描画する行数。⚠️ スクロールが最後に届くたびにこれだけ増やす */
const PAGE_SIZE = 30;

    useEffect(() => {
        const target = sentinel.current;
        if (!target) return;

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setVisibleCount(current => Math.min(current + PAGE_SIZE, filtered.length));
            }
        }, { rootMargin: '200px' });

        observer.observe(target);
        return () => observer.disconnect();
    }, [filtered.length, visibleCount]);
```

⚠️⚠️ **依存に `filtered.length` を入れること。**
⚠️ ⚠️ **入れないと、絞り込んだ後に「もう全部出した」状態のまま監視が止まる。**

⚠️ 絞り込みを変えたら ⚠️ **先頭から描き直す**（そうしないと前の行数のまま残る）。

### 3-2. 並び

```tsx
rows.sort((a, b) => Number(b.property_id) - Number(a.property_id));
```

⚠️ サーバーも `ORDER BY property_id DESC` で返すが、⚠️ **画面側でも数値として並べ直す**（指示）。
⚠️ ⚠️ **文字列のまま並べると 999 が 1000 より後ろに来る。**

### 3-3. 絞り込み

| 種類 | 中身 |
|---|---|
| 文字 | ⚠️ **物件名称・物件ID**（部分一致） |
| 選択 | 工程状況 / 販売状況 / 県 / チーム（係） |
| ⚠️ **トグル** | ⚠️ **広告出稿（出稿済み・未出稿）/ Instagram（投稿済み・未投稿）** |

⚠️ 選択肢は ⚠️ **実データから作る**（⚠️ **直書きにすると実態とずれる**。競合サマリーで実際に起きた）。

```tsx
    /**
     * ⚠️ トグル2列の絞り込み。⚠️ **`'' = すべて / '1' = 済み / '0' = 未**。
     *   ⚠️⚠️ **数値ではなく文字列で持つ。** ⚠️ `0` を偽と判定して
     *     ⚠️ **「未」が「すべて」と同じ挙動になる**のを防ぐため。
     */
    const [adPosted, setAdPosted] = useState('');
    const [instagramPosted, setInstagramPosted] = useState('');
```

### 3-4. 表示項目の選択

⚠️ 40列から選ぶ。⚠️ **既定は13列。** ⚠️ ⚠️ **全件空の3列は既定で未選択**（指示）。

⚠️ 選択は ⚠️ **`localStorage`（`satbase_visible_columns`）に保存**する。
⚠️ ⚠️ **保存できない環境（プライベートウィンドウ等）でも画面は動く**ようにしてある。

### ⚠️ 3-5. トグル

```tsx
    /**
     * トグルの更新。
     *
     * ⚠️⚠️ **先に画面を書き換えてから送る**（待たせない）。
     *   ⚠️ ⚠️ **失敗したら元に戻す。** ⚠️ 戻さないと、保存できていないのに
     *     ⚠️ **保存できたように見えたまま**になる。
     */
```

⚠️ ⚠️ **押している間はそのトグルだけ `disabled`**（連打で二重送信しない）。

---

## 4. Header.tsx

| 前 | 後 |
|---|---|
| 仲介物件登録 / ⚠️ **土地情報同期** / ⚠️ **土地情報一覧** | 仲介物件登録 / ⚠️ **SatBaseサマリー** |

```tsx
        // ⚠️⚠️ **2026-09-22 に土地情報同期・土地情報一覧をメニューから外した**（指示）。
        //   ⚠️ ⚠️ **コンポーネント（SyncEstate / Estate）は消していない。**
        //     ⚠️ Estate は顧客詳細からも開くため、消すとそちらが壊れる。
        '土地・物件管理': ['仲介物件登録', 'SatBaseサマリー'],
```

⚠️ ⚠️ **列が40あるので `isFullscreenMenu` に入れてある。**

⚠️ 使われなくなった `import SyncEstate` / `import Estate` / `estateId` の state は外した。

### ⚠️ 申し送りになる副作用

⚠️⚠️ **「土地情報一覧」に出ていた「新着 N件」のバッジが、出る場所を失った。**

```tsx
    const isEstate = (value: string) => {
        return newEstate !== null && newEstate > 0 && value === '土地情報一覧';
    };
```

⚠️ ⚠️ **コードは残してある**（`header` リクエストも呼んでいる）が、⚠️ **もう真にならない。**
⚠️ ⚠️ **新着の土地情報に気づく手段が無くなってよいか、確認が要る。**

---

## 確認（2026-09-22・ローカル）

| 確認 | 結果 |
|---|---|
| CREATE + INSERT の実行 | ⚠️ **1,910行**（物件ID 1〜1949・⚠️ **重複0**） |
| ⚠️ **`ad_posted` / `instagram_posted` の初期値** | ⚠️ **全件 0** |
| ⚠️ トグルの UPDATE | ⚠️ **`updated` / `updated_by` まで入ることを確認**（確認後に戻した） |
| ⚠️ `satbase_list` / `satbase_update` | ⚠️ **ともに 401**（＝ ⚠️ **② に登録できている**） |
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `php -l express_proxy.php` | ⚠️ **エラー0件** |
| `npm run build`（frontend） | ⚠️ **成功**（⚠️ **`SatBaseDatabase.tsx` の警告0件**） |

---

## ⚠️ ブラウザでの確認（未実施）

- [ ] 土地・物件管理 → ⚠️ **SatBaseサマリー**が開く（⚠️ **全画面**）
- [ ] ⚠️⚠️ **土地情報同期・土地情報一覧がメニューから消えている**
- [ ] ⚠️ 物件IDの ⚠️ **降順**（1949 が先頭）
- [ ] ⚠️⚠️ **スクロールで30行ずつ増える**（⚠️ カクつかないか）
- [ ] ⚠️ 物件名称・物件IDで検索できる
- [ ] ⚠️ 工程状況 / 販売状況 / 県 / チームで絞れる
- [ ] ⚠️ **広告出稿・Instagram で絞れる**（⚠️ **「未」が「すべて」にならないか**）
- [ ] ⚠️⚠️ **トグルを押すと保存され、開き直しても残っている**
- [ ] ⚠️ 表示項目を選び直し、⚠️ **開き直しても選択が残っている**
- [ ] ⚠️ 「既定に戻す」で13列に戻る
- [ ] ⚠️ 決済日（仕入）/ 契約日（仕入）/ 位置情報が ⚠️ **既定で出ていない**

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **CSV の再取り込みのとき、`ad_posted` / `instagram_posted` を上書きしないこと**（⚠️ **画面の入力が消える**） |
| 2 | ⚠️⚠️ **「新着 N件」のバッジの行き場が無くなった**（上記） |
| 3 | ⚠️ `customer_name` は ⚠️ **個人情報**。⚠️ 既定では非表示にしてあるが、⚠️ **選べば出る** |
| 4 | ⚠️ 定期的な取り込みの仕組みは ⚠️ **作っていない**（⚠️ **今回は手で1回入れるだけ**） |
| 5 | ⚠️ 用途（`usage_type`）の 0〜5 の ⚠️ **意味が不明**。⚠️ 表示は数値のまま |
