# 2026-09-28 (1) 要確認モーダルと、担当者の並び順（v2.2.150）

⚠️⚠️ **この文書は「第1稿」である。** ⚠️ 同じ日に ⚠️ **UI改修の追加指示**があり、
⚠️ **テーブルの分割・1日1回の制御・`first_name` の絞り込み**を入れた。
⚠️ ⚠️ **最終形は [task-2026-09-28-02](task-2026-09-28-02-daily-action-ui.md) を見ること。**
⚠️ 以下は ⚠️ **最初に作ったときの記録**で、一部は既に置き換わっている。

## 依頼（`ReadMeClaude.md`）

1. `frontend/src/components/company/Company.tsx` の改修
   - staff の並びを ⚠️ **以前実装したソート関数処理**で並べ替える（⚠️ position の index 昇順 → khg_id 昇順）
2. ⚠️ **UIの相談** — `Menu.tsx` の `cancelList` / `unSyncList` をモーダルで出したい
   - ⚠️ `Category.tsx` の `goToDashboard` で遷移した先で表示
   - ⚠️ `isSp` なら出さない ／ ⚠️ `!isSp` なら `size='lg'` ／ ⚠️ `category === 'order'` のみ
   - 【要確認】放置日数 / 店舗 / 反響日 / 顧客名 / 反響媒体（⚠️ **当日の分は出さない・日数が長いほど濃く**）
   - 【本日の予定】初回面談 / 事前審査 / 2回目以降面談 / 契約 が ⚠️ **本日**の顧客

> 非常に大切なアクションにも関わらず…意識が甘すぎるため、全員に **晒す** ことでアクションをうながす

## オーナー判断（2026-09-28）

| 論点 | 回答 |
|---|---|
| ソート | ⚠️ **`staffSorter` を正（`utils/positions.ts`）に揃える** |
| データ取得 | ⚠️ **新しいAPIを追加** |
| 放置日数の色 | ⚠️ **〜2日＝薄い黄 / 3〜5日＝橙 / 6日以上＝赤** |

---

## 調べて分かったこと

### ⚠️ 1. 並べ替えは既に入っていた。⚠️⚠️ **壊れていたのは役職の配列**

⚠️ `Company.tsx:591` と `:760` は ⚠️ **以前から `staffSorter()` を通していた。**
⚠️⚠️ ただし ⚠️ **`staffSorter.ts` だけが独自の配列**を持っていた。

| どこ | 配列 |
|---|---|
| `utils/positions.ts`（⚠️ **他7ファイルが使う正**） | 常務, 部長, 課長, 課長代理, 店長, 店長代理, 一般 |
| ⚠️⚠️ **`utils/staffSorter.ts`（旧）** | ⚠️ **課長, 課長代理, 店長, 店長代理, 一般, IC** |

⚠️⚠️ **`常務` と `部長` が抜けていたため、該当者が「該当なし」扱いで末尾に落ちていた**（本来は先頭）。
⚠️ ローカルDBの `report = 1` は一般334 / 店長70 / 店長代理33 / 課長代理3 / 課長2 で、⚠️ **今は表面化していない。**
⚠️ `EditStaff.tsx` の選択肢には ⚠️ **`常務` も `部長` も `IC` も `管理用` もある。**

### ⚠️⚠️ 2. Menu.tsx は、もう一覧データを持っていない

⚠️ 2026-09-14 に ⚠️ **サーバー側で COUNT するよう変えてある**（⚠️ **18.2MB → 数十バイト**）。
⚠️ 今 `Menu.tsx` が受け取るのは `sync` / `cancel` / `lost` / `estate` の ⚠️ **数字だけ。**
⚠️⚠️ **`unSyncList` / `cancelList` は旧形式のフォールバック経路でしか埋まらない。**

⚠️ ⚠️ **昔の形に戻すのは不可**（Menu は全ページで走る）。⚠️ **別経路のAPIを新設した。**

---

## 追加したファイル

### 1. `backend-express/src/features/dailyAction.ts`（新規）

⚠️ 全文は長いので、⚠️ **関数と定数をそのまま載せる。**

```ts
/**
 * 日付の列を DATE に揃える式。
 *
 * ⚠️⚠️ **本番データは 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在している。**
 *   ⚠️ 片方しか見ないと `STR_TO_DATE` が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ 末尾に時刻や空白が付いた値があるため `SUBSTRING(...,1,10)` で切る
 *   （⚠️ 実測で `inquiry_date` に空白付きの値が1件あった）。
 */
const asDate = (column: string): string =>
  `STR_TO_DATE(REPLACE(SUBSTRING(${column}, 1, 10), '/', '-'), '%Y-%m-%d')`;

const INQUIRY_DATE = asDate('inquiry_date');
const RESERVED_DATE = asDate('reserved_interview');
const REGISTER_DATE = asDate('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');

/** 本日の予定に出す4つの工程。⚠️ 表示名は画面（TableInterview）の言い方に揃える */
const TODAY_STEPS: { column: string; label: string }[] = [
  { column: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', label: '初回面談' },
  { column: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', label: '事前審査' },
  { column: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', label: '2回目以降面談' },
  { column: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', label: '契約' },
];

const UNSYNC_SQL = `
  SELECT 'unsync' AS kind,
         DATEDIFF(CURDATE(), ${INQUIRY_DATE}) AS days,
         CASE WHEN TRIM(COALESCE(shop, '')) <> '' THEN TRIM(shop)
              WHEN TRIM(COALESCE(brand, '')) <> '' THEN CONCAT(TRIM(brand), '店舗未設定')
              ELSE '' END AS shop,
         DATE_FORMAT(${INQUIRY_DATE}, '%Y-%m-%d') AS register,
         TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS customer,
         COALESCE(NULLIF(TRIM(response_medium), ''), NULLIF(TRIM(medium), ''), '') AS medium
    FROM inquiry_customer
   WHERE COALESCE(sync, 0) = 0
     AND COALESCE(duplicate_flag, 0) <> 1
     AND COALESCE(support_flag, 0) <> 1
     AND COALESCE(black_flag, 0) <> 1
     AND SUBSTRING(inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
     AND DATEDIFF(CURDATE(), ${INQUIRY_DATE}) > 0
   ORDER BY days DESC
   LIMIT ?
`;

const CANCEL_SQL = `
  SELECT 'cancel' AS kind,
         DATEDIFF(CURDATE(), ${RESERVED_DATE}) AS days,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(cancel_status, '') = ''
     AND COALESCE(status, '') <> '重複'
     AND ${RESERVED_DATE} > '2026-01-01'
     AND DATEDIFF(CURDATE(), ${RESERVED_DATE}) > 0
   ORDER BY days DESC
   LIMIT ?
`;

const TODAY_SQL = `
  ${TODAY_STEPS.map(
    (step) => `
  SELECT ? AS step,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(status, '') <> '重複'
     AND ${asDate(step.column)} = CURDATE()`
  ).join('\n   UNION ALL\n')}
   ORDER BY shop, customer
   LIMIT ?
`;

const SYNC_START_MONTH = '2025/06';
const ROW_LIMIT = 200;

export const runDailyAction = async (): Promise<DailyActionResponse> => {
  // ⚠️ 3クエリは互いに独立しているので並列で投げる
  const [unsync, cancel, today] = await Promise.all([
    query<AttentionRow>(UNSYNC_SQL, [SYNC_START_MONTH, ROW_LIMIT]),
    query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]),
    query<TodayRow>(TODAY_SQL, [...TODAY_STEPS.map((s) => s.label), ROW_LIMIT]),
  ]);

  /**
   * ⚠️ 2つの表を1つに混ぜ、⚠️ **放置日数の長い順**に並べ直す。
   *   ⚠️ 種類ごとに分けると「どちらがより放置されているか」が見えない。
   */
  const attention = [...unsync, ...cancel].sort((a, b) => Number(b.days) - Number(a.days));

  return {
    attention,
    today,
    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT,
  };
};

export const dailyAction = defineFeature({
  name: '本日のアクション',
  basePath: '/daily-action',
  routes: {
    'GET /': route({
      summary: '要確認の顧客（未同期・来場未入力）と本日の予定',
      auth: true,
      query: z.object({}).optional(),
      handler: async () => runDailyAction(),
    }),
  },
});
```

⚠️ 型:

```ts
export interface AttentionRow extends RowDataPacket {
  kind: 'unsync' | 'cancel';
  days: number; shop: string; register: string; customer: string; medium: string;
}
export interface TodayRow extends RowDataPacket {
  step: string; shop: string; register: string; customer: string; medium: string;
}
export interface DailyActionResponse {
  attention: AttentionRow[];
  today: TodayRow[];
  /** ⚠️ 上限で切り捨てたかどうか。⚠️ 画面に「他◯件」と出すために返す */
  truncated: boolean;
}
```

⚠️⚠️ **判定条件は `menu.ts` と同じもの。** ⚠️ **片方だけ直すとバッジの件数と行数が食い違う。**
⚠️ ⚠️ **当日分は出さない**（`DATEDIFF > 0`）ので、⚠️ **バッジの件数よりわずかに少なく出る。**

⚠️ 指示書の「`step_..._FDW7` が該当日の顧客は表示せず」は、⚠️ **この条件下で初回面談日は必ず空**なので、
⚠️ **予約日で当日を除く形**にした（⚠️ コードにも同じ注記を残してある）。

### 2. `backend/src/handlers/daily_action.php`（新規・① のフォールバック）

⚠️ 中身は上と同じSQL。⚠️ **PHP 側だけ関数で日付式を作っている。**

```php
function dailyActionDate(string $column): string
{
    return "STR_TO_DATE(REPLACE(SUBSTRING($column, 1, 10), '/', '-'), '%Y-%m-%d')";
}
```

⚠️ 本日の予定はプレースホルダを工程ごとに作る:

```php
$today_parts = [];
$today_params = [];
foreach ($today_steps as $index => $step) {
    $step_date = dailyActionDate($step['column']);
    $today_parts[] = "SELECT :label$index AS step, ... AND $step_date = CURDATE()";
    $today_params[":label$index"] = $step['label'];
}
$sql_today = implode("\n   UNION ALL\n", $today_parts) . "\n   ORDER BY shop, customer\n   LIMIT $row_limit";
```

⚠️ 並べ替えと型の揃え:

```php
$attention = array_merge($response_unsync, $response_cancel);
usort($attention, function ($a, $b) {
    return (int) $b['days'] - (int) $a['days'];
});

// ⚠️ days は PDO が文字列で返すため、Express と同じ数値に揃える
foreach ($attention as &$row) {
    $row['days'] = (int) $row['days'];
}
unset($row);

$result = [
    "attention" => $attention,
    "today" => $response_today,
    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit,
];
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
```

### 3. `frontend/src/components/DailyActionModal.tsx`（新規コンポネント）

⚠️ 主要な部分をそのまま載せる。

```tsx
/**
 * 放置日数の色。
 *
 * ⚠️ 段階はオーナー指定（2026-09-28）。
 *   ⚠️ 〜2日 … 薄い黄
 *   ⚠️ 3〜5日 … 橙
 *   ⚠️ 6日以上 … 赤
 *
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。** 表の2箇所が同じ関数を通る。
 */
const daysStyle = (days: number): React.CSSProperties => {
    if (days >= 6) return { backgroundColor: '#dc3545', color: '#ffffff', fontWeight: 700 };
    if (days >= 3) return { backgroundColor: '#fd7e14', color: '#ffffff', fontWeight: 700 };
    return { backgroundColor: '#fff3cd', color: '#664d03', fontWeight: 700 };
};

/** ⚠️ 行の種類の見出し。⚠️ 何をすればよいかが分かる言い方にする */
const KIND_LABEL: Record<AttentionRow['kind'], string> = {
    unsync: '未同期',
    cancel: '来場未入力',
};

const KIND_STYLE: Record<AttentionRow['kind'], string> = {
    unsync: 'bg-secondary',
    cancel: 'bg-dark',
};

/** ⚠️ 空の値は「(未設定)」と出す。空欄だと入力漏れなのか取得漏れなのか分からない */
const orUnset = (value: string): string => (value ?? '').trim() === '' ? '(未設定)' : value;
```

```tsx
    /** ⚠️ 出さない条件。⚠️ **取りに行く前に判定する**（無駄な通信を避ける） */
    const isTarget = show && !isSp && category === 'order';

    useEffect(() => {
        if (!isTarget || loaded) return;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'daily_action', category });
                setAttention(response.data?.attention ?? []);
                setToday(response.data?.today ?? []);
                setTruncated(response.data?.truncated === true);
            } catch (e) {
                /**
                 * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
                 *   「今日は0件だった」と誤解される。**
                 */
                console.error('要確認・本日の予定の取得に失敗しました', e);
                setError('要確認・本日の予定を取得できませんでした。分析サーバーが停止している可能性があります。');
            } finally {
                setLoaded(true);
            }
        };
        fetchData();
    }, [isTarget, loaded, category]);

    if (!isTarget) return null;
```

⚠️⚠️ **担当者で絞り込んでいない。** ⚠️ 「晒す」ことが狙いなので、⚠️ **全員に全件を見せる。**

---

## 修正したファイル

### 4. `frontend/src/utils/staffSorter.ts`（⚠️ **全面的に書き直した**）

```ts
import { positions } from './positions';

/**
 * 担当営業の並び順。役職の順 → 社員番号の順。
 *
 * ⚠️⚠️ **役職の一覧は `utils/positions.ts` を使うこと。**
 *   ⚠️ 2026-09-28 まで、このファイルだけ**独自の配列**を持っていた。
 *     ⚠️ `常務` と `部長` が抜けており、⚠️ **該当者が末尾に落ちていた**（本来は先頭）。
 *   ⚠️ ⚠️ **ここに配列を書き戻さないこと。** 他に7ファイルが `positions.ts` を見ている。
 *
 * ⚠️ `positions.ts` に無い役職は**その後ろ**に回す。
 *   ⚠️ `EditStaff.tsx` の選択肢には `IC` と `管理用` があるため必ず出てくる。
 *   ⚠️⚠️ **`IC` は従来「一般の次」だったので、その並びを保つ。**
 *     ⚠️ `positions.ts` に足すと他7ファイルの並びまで変わるため、ここで足している。
 */
const TAIL_POSITIONS: string[] = ['IC', '管理用'];
const POSITION_ORDER: string[] = [...positions, ...TAIL_POSITIONS];

/** ⚠️ 一覧に無い役職・未設定はさらに後ろ */
const UNKNOWN_POSITION_ORDER = POSITION_ORDER.length;

/**
 * 社員番号が空のときの順位。
 *
 * ⚠️⚠️ **小さい値にしてはいけない。** 実値は6桁（100007〜100480）なので、
 *   小さいと**空の人が先頭に来る。**
 */
const UNKNOWN_KHG_ID_ORDER = 999999;

/** ⚠️ 表の末尾に置く集計行。⚠️ 担当者ではないので役職も社員番号も持たない */
const SUMMARY_ROWS: Record<string, number> = {
    予算: 1000,
    実績: 1001,
};

export const staffSorter = () => {
    const getPositionScore = (item: any) => {
        const summary = SUMMARY_ROWS[item.name];
        if (summary !== undefined) return summary;

        const index = POSITION_ORDER.indexOf((item.position ?? '').trim());
        return index !== -1 ? index : UNKNOWN_POSITION_ORDER;
    };

    const getIdNumber = (item: any) => {
        const id = (item.khg_id ?? '').trim();
        if (id === '') return UNKNOWN_KHG_ID_ORDER;
        const n = Number(id);
        // ⚠️ 数字以外が入っていた場合も末尾へ。NaN で比較すると順序が不定になる
        return Number.isFinite(n) ? n : UNKNOWN_KHG_ID_ORDER;
    };

    return (a: any, b: any) => {
        const scoreA = getPositionScore(a);
        const scoreB = getPositionScore(b);

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        // ⚠️ 予算・実績どうしは入れ替えない（上の表で順番が決まっている）
        if (scoreA >= 1000) return 0;

        return getIdNumber(a) - getIdNumber(b);
    };
};
```

⚠️⚠️ **`staffSorter` を使っているのは5コンポネント。**
⚠️ `CallStatusList.tsx` / `Company.tsx`（2箇所） / `RankOrder.tsx` / `RankKaeru.tsx` / `RankResale.tsx`
⚠️ ⚠️ **すべて「常務・部長が先頭に来る」方向に変わる。** ⚠️ `IC` の位置は従来どおり。

### 5. `frontend/src/components/company/Company.tsx`

```tsx
import DailyActionModal from '../DailyActionModal';
import { useLocation, useNavigate } from 'react-router-dom';
```

```tsx
    const location = useLocation();
    const navigate = useNavigate();

    /**
     * ⚠️⚠️ **本日のアクションのモーダル**（2026-09-28）。
     *
     * ⚠️ `Category.tsx` の `goToDashboard` から来たときだけ出す。
     *   ⚠️ ⚠️ **あちらで出すことはできない。** 直後に `navigate()` するため、
     *     ⚠️ **出した瞬間に消える。**
     *
     * ⚠️ 目印は `location.state.fromCategory`。⚠️ 開いたら**すぐ消す**
     *   （⚠️ 消さないと**再読み込みのたびに出る**）。
     *
     * ⚠️ 出す条件（`!isSp` / `category === 'order'`）は
     *   ⚠️ **モーダル側が持っている。** ⚠️ ここで二重に書かないこと。
     */
    const [showDailyAction, setShowDailyAction] = useState(false);

    useEffect(() => {
        if ((location.state as { fromCategory?: boolean } | null)?.fromCategory !== true) return;
        setShowDailyAction(true);
        // ⚠️ replace で目印だけ落とす。履歴を増やさない
        navigate(location.pathname + location.search, { replace: true, state: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);
```

```tsx
            {/* ⚠️ 出す・出さないの判定はモーダル側。⚠️ ここは「来たかどうか」だけを渡す */}
            <DailyActionModal show={showDailyAction} onClose={() => setShowDailyAction(false)} />
```

### 6. `frontend/src/components/Category.tsx`

```tsx
        await setCategory(categoryValue);
        /**
         * ⚠️⚠️ **`fromCategory` は「本日のアクション」のモーダルの目印**（2026-09-28）。
         *   ⚠️ 遷移先（`Company.tsx`）がこれを見て1回だけ開き、⚠️ **すぐ消す。**
         *   ⚠️ ⚠️ **ここでモーダルを出すことはできない。**
         *     ⚠️ 直後に `navigate()` するので**出した瞬間に消える。**
         */
        await navigate(navigateMap[categoryValue] ?? '/home', { state: { fromCategory: true } });
```

### 7. `backend/src/core/express_proxy.php`

```php
        // 2026-09-28 追加。参照のみ。
        // ⚠️ 判定条件は menu と同じ母集団で、返す列だけが違う。
        //   ⚠️ **menu の条件を直したら daily_action も直すこと**（両方とも ①②）。
        'daily_action',
```

⚠️ ⚠️ **`expressProxyExclusive()` ではなく `expressProxyRequests()` に入れた**（⚠️ **参照のみなので ① へのフォールバックが安全**）。

### 8. `backend-express/src/features/index.ts` / `src/gateway/registry.ts`

```ts
import { dailyAction } from './dailyAction';
export const features: Feature[] = [versions, staff, analysis, menu, dailyAction];
```

```ts
register({
  request: 'daily_action',
  summary: '要確認の顧客（未同期・来場未入力）と本日の予定',
  phpSource: 'backend/src/handlers/daily_action.php',
  auth: 'none',
  handler: async () => runDailyAction(),
});
```

### 9. `frontend/src/utils/version.ts` ／ `backend/scripts/sql/2026-09-28_update_log_2.2.150.sql`

```ts
export const newVersion = '2.2.150';
```

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.150', '2026-09-28', '注文営業のダッシュボードを開いたときに、要確認の顧客と本日の予定を表示するようにした。会社実績の担当者の並び順を役職順に揃えた。');
```

⚠️ ⚠️ **ローカルDBにも流し済み**（`no = 242`）。

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| `react-scripts build`（①） | ⚠️ **成功** → ⚠️ **`main.e7d84d09.js`** |
| ⚠️⚠️ **① と ② の応答** | ⚠️⚠️ **完全一致**（下表） |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ

| | ② Express | ① PHP |
|---|---|---|
| キー | `attention` / `today` / `truncated` | ⚠️ **同じ** |
| attention | 97件 | ⚠️ **97件** |
| today | 0件 | ⚠️ **0件** |
| `days` の型 | `int` | ⚠️ **`int`** |
| ⚠️ **中身** | — | ⚠️⚠️ **全行一致** |

⚠️ 内訳: ⚠️ **未同期 47件（最長145日）／ 来場未入力 50件（最長22日）。**

⚠️ **本日の予定はローカルでは0件**だったので、⚠️ **日付を `2026-09-10` に替えて検証**した。

| 工程 | 件数 |
|---|---|
| 初回面談 | 16 |
| 2回目以降面談 | 7 |
| 事前審査 | 1 |
| 契約 | 1 |

⚠️ ⚠️ **4工程とも拾えている。**

### ⚠️ 未同期の行は欠けている列が多い

⚠️ 実測47件のうち ⚠️ **店舗が空 17件 ／ 氏名が空 17件 ／ `response_medium` が空 18件。**

| 列 | 対応 |
|---|---|
| 媒体 | ⚠️ **`medium` で補った** → ⚠️⚠️ **空 0件になった** |
| 店舗 | ⚠️ `ブランド + 店舗未設定` で補う（⚠️ **ブランドも空の17件は残る**） |
| 氏名 | ⚠️⚠️ **補えない。** ⚠️ 画面に「(未設定)」と出る |

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`menu` の判定条件を直したら `daily_action` も直すこと。** ⚠️ ①② の4ファイルにある |
| 2 | ⚠️⚠️ **`menu` を「全件返す」形に戻さないこと**（⚠️ 18.2MB。全ページで走る） |
| 3 | ⚠️ 当日分を出さないので、⚠️ **バッジの件数よりモーダルの行数が少し少ない。** ⚠️ 不具合ではない |
| 4 | ⚠️ ⚠️ **未同期は氏名が空の行が3割ある。** ⚠️ 反響フォーム側の問題で、APIでは埋められない |
| 5 | ⚠️ 色の境目を変えるときは ⚠️ **`DailyActionModal.tsx` の `daysStyle()` だけ**を直す |
| 6 | ⚠️ 1表あたり ⚠️ **200行で打ち切る**（`ROW_LIMIT`）。⚠️ 切れたら画面に断りが出る |
| 7 | ⚠️⚠️ **担当者で絞っていない**（⚠️ 「晒す」のが狙い）。⚠️ 絞る話が出たら狙いごと相談すること |
| 8 | ⚠️ `staffSorter` は ⚠️ **5コンポネントが使う。** ⚠️ 常務・部長が先頭に来る方向に変わる |
| 9 | ⚠️⚠️ **② の再ビルドと ① の PHP 2本の差し替えが必要**（⚠️ どちらか片方だけだと動かない） |
