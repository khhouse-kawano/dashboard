# 2026-09-28 (2) 要確認モーダルのUI改修（v2.2.150）

⚠️ [task-2026-09-28-01](task-2026-09-28-01-daily-action-and-staff-sort.md) の続き。⚠️ **同じ版**。

## 依頼（`ReadMeClaude.md`）

- ⚠️ **未同期・来場日未入力・各KPIは全て別のテーブルで表示する**
- 歩留まりは `Menu.tsx` の `unSyncList` / `cancelList` に揃える
- ⚠️ モーダルタイトル `本日のアクション` → ⚠️ **要確認**
- ⚠️ **モーダルヘッダーの closeButton は不要**
- ⚠️ **上部に数値のサマリー**（⚠️ 0件は出さない・⚠️ **固定**）
- ⚠️⚠️ **毎回開くのは UX がよくない** → ⚠️ `staff` に `check_daily_action date default null` を足し、
  ⚠️ **その日の日付が入っていない人にだけ出す**。⚠️ **「確認しました」で登録**（⚠️ ボタンはサマリー内）

### ⚠️ 途中の追記・訂正（同日）

| # | 内容 |
|---|---|
| 1 | ⚠️ **未同期は `inquiry_customer.first_name` が真の行だけ** |
| 2 | ⚠️⚠️ **「`unSyncList`・`cancelList` に揃える」は誤り。** ⚠️ **該当日を含まない（当日除外）を優先してよい** |

⚠️ ⚠️ **2 により、当日除外（`DATEDIFF > 0`）は第1稿のまま残した。**
⚠️ そのため ⚠️ **メニューのバッジより少なく出る。これは意図どおり。**

## オーナー判断

| 論点 | 回答 |
|---|---|
| 閉じ方 | ⚠️⚠️ **「確認しました」だけ**（⚠️ 背景クリック・ESC も効かせない） |
| 全部0件のとき | ⚠️ **モーダルを出さない**（⚠️ 登録もしない） |

---

## 追加したファイル

### 1. `backend/scripts/sql/2026-09-28_staff_check_daily_action.sql`（新規）

```sql
-- ⚠️⚠️ **`staff_list` ではなく `staff`。**
--   ⚠️ `staff` … ログインに使う側（mail / password / api_token を持つ）
--   ⚠️ `staff_list` … 担当営業のマスタ（店舗・役職・社員番号）
--   ⚠️ ⚠️ **間違えると誰の確認かが結び付かない。**
ALTER TABLE staff
  ADD COLUMN check_daily_action DATE DEFAULT NULL;
```

⚠️ ⚠️ **ローカルDBに実行済み。**

### 2. `frontend/src/components/DailyAction.tsx`（⚠️ **`DailyActionModal.tsx` から改名**）

⚠️ 指示書の呼び方（`DailyAction.tsx`）に合わせた。⚠️ **中身はほぼ書き直し。**

```tsx
/**
 * 放置日数の色。
 *
 * ⚠️ 段階はオーナー指定（2026-09-28）。
 *   ⚠️ 〜2日 … 薄い黄
 *   ⚠️ 3〜5日 … 橙
 *   ⚠️ 6日以上 … 赤
 *
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。**
 */
const daysStyle = (days: number): React.CSSProperties => {
    if (days >= 6) return { backgroundColor: '#dc3545', color: '#ffffff', fontWeight: 700 };
    if (days >= 3) return { backgroundColor: '#fd7e14', color: '#ffffff', fontWeight: 700 };
    return { backgroundColor: '#fff3cd', color: '#664d03', fontWeight: 700 };
};

/** ⚠️ 空の値は「(未設定)」と出す。空欄だと入力漏れなのか取得漏れなのか分からない */
const orUnset = (value: string): string => (value ?? '').trim() === '' ? '(未設定)' : value;

/**
 * 上部のサマリー。
 *
 * ⚠️⚠️ **固定（sticky）にする**（指示）。⚠️ 下までスクロールしても
 *   「確認しました」に手が届くようにするため。
 * ⚠️ ⚠️ **0件の項目は出さない**（指示）。
 */
const summaryStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #dee2e6',
    // ⚠️ Modal.Body の padding を打ち消して端まで白を敷く。敷かないと
    //   スクロールした行が両脇から透けて見える
    margin: '-1rem -1rem 0.75rem',
    padding: '0.75rem 1rem',
};
```

⚠️ 取得と「確認しました」:

```tsx
    /** ⚠️ 取りに行ってよいか。⚠️ **通信の前に判定する**（無駄な通信を避ける） */
    const canFetch = show && !isSp && category === 'order';

    useEffect(() => {
        if (!canFetch || loaded) return;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'daily_action', roll: 'list', category });
                setSections(response.data?.sections ?? []);
                setTotal(Number(response.data?.total ?? 0));
                setTruncated(response.data?.truncated === true);
                setAllowed(response.data?.show === true);
            } catch (e) {
                console.error('要確認の取得に失敗しました', e);
                setError('要確認を取得できませんでした。');
            } finally {
                setLoaded(true);
            }
        };
        fetchData();
    }, [canFetch, loaded, category]);

    /**
     * 「確認しました」。
     *
     * ⚠️⚠️ **記録に失敗しても閉じる。** ⚠️ 閉じられないほうが困る
     *   （⚠️ 閉じる手段がこのボタンしかないため）。
     * ⚠️ 失敗した場合は**翌日以降もまた出る**だけで、害は無い。
     */
    const handleCheck = async () => {
        if (sending) return;
        setSending(true);
        try {
            await apiClient.post('', { request: 'daily_action', roll: 'check', category });
        } catch (e) {
            console.error('確認済みの記録に失敗しました', e);
        } finally {
            setSending(false);
            onClose();
        }
    };

    // ⚠️ 出さない条件。⚠️ **0件・確認済み・取得失敗のいずれでも出さない**
    if (!canFetch || !loaded || error !== '' || !allowed || total === 0) return null;

    const visible = sections.filter((section) => section.rows.length > 0);
```

⚠️ モーダルの枠（⚠️ **closeButton 無し・背景と ESC を殺している**）:

```tsx
        <Modal
            show={show}
            size='lg'
            centered
            scrollable
            /* ⚠️⚠️ **閉じる手段は下のボタンだけ**（指示）。背景も ESC も効かせない */
            backdrop='static'
            keyboard={false}
            onHide={() => { /* ⚠️ 何もしない。react-bootstrap が要求するので置いてある */ }}
        >
            {/* ⚠️ closeButton は付けない（指示） */}
            <Modal.Header>
                <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>要確認</div>
            </Modal.Header>
```

⚠️ サマリー（⚠️ **ボタンもこの中**）:

```tsx
                <div style={summaryStyle}>
                    <div className='d-flex flex-wrap align-items-center justify-content-between'>
                        <div className='d-flex flex-wrap align-items-center' style={{ gap: '10px' }}>
                            {visible.map((section) => (
                                <span key={section.label} style={{ fontSize: '12px' }}>
                                    {section.label}
                                    <span className='fw-bold text-danger ms-1' style={{ fontSize: '14px' }}>
                                        {section.rows.length}
                                    </span>
                                    件
                                </span>
                            ))}
                        </div>
                        <button
                            className='btn btn-primary btn-sm rounded-pill px-4'
                            style={{ fontSize: '12px', whiteSpace: 'nowrap', opacity: sending ? 0.5 : 1 }}
                            onClick={handleCheck}
                        >
                            確認しました
                        </button>
                    </div>
                </div>
```

⚠️ 表（⚠️ **セクションごとに1つ**。⚠️ 放置日数の列は `hasDays` のときだけ）:

```tsx
                {visible.map((section) => (
                    <div key={section.label} className='mb-3'>
                        <div className={`fw-bold mb-1 ${section.hasDays ? 'text-danger' : 'text-primary'}`} style={{ fontSize: '13px' }}>
                            {section.label}
                            <span className='text-dark ms-1' style={{ fontSize: '11px' }}>{section.rows.length}件</span>
                        </div>
                        <Table bordered hover size='sm' className='mb-0'>
                            <thead>
                                <tr style={{ fontSize: '11px' }}>
                                    {/* ⚠️ 放置日数の列は未同期・来場日未入力だけ。本日の予定には無い */}
                                    {section.hasDays && <td style={{ width: '70px' }} className='text-center'>放置日数</td>}
                                    <td style={{ width: '130px' }}>店舗</td>
                                    <td style={{ width: '95px' }}>反響日</td>
                                    <td>顧客名</td>
                                    <td style={{ width: '120px' }}>反響媒体</td>
                                </tr>
                            </thead>
                            <tbody>
                                {section.rows.map((row, index) => (
                                    <tr key={`${section.label}-${row.customer}-${index}`}>
                                        {section.hasDays && (
                                            <td style={{ ...cellStyle, ...daysStyle(Number(row.days)), textAlign: 'center' }}>
                                                {Number(row.days)}日
                                            </td>
                                        )}
                                        <td style={cellStyle}>{orUnset(row.shop)}</td>
                                        <td style={cellStyle}>{orUnset(row.register)}</td>
                                        <td style={cellStyle}>{orUnset(row.customer)}</td>
                                        <td style={cellStyle}>{orUnset(row.medium)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                ))}
```

---

## 修正したファイル

### 3. `backend-express/src/features/dailyAction.ts`

**(a) 未同期の絞り込み**

```ts
     AND TRIM(COALESCE(first_name, '')) <> ''
```

⚠️ コメント:

```ts
 * ⚠️⚠️ **氏名（`first_name`）が入っている行だけを出す**（2026-09-28 の追記）。
 *   ⚠️ 実測47件のうち ⚠️ **17件は氏名が空**だった（反響フォーム側の取りこぼし）。
 *   ⚠️ ⚠️ **誰のことか分からない行を晒しても動きようがない。**
 *   ⚠️ そのぶん ⚠️ **メニューのバッジより少なく出る。**
 *
 * ⚠️⚠️ **当日の反響は出さない**（`DATEDIFF > 0`）。⚠️ まだ「放置」ではないため。
 *   ⚠️ 2026-09-28 に一度「Menu.tsx のバッジに揃える」と言われたが、
 *     ⚠️ ⚠️ **同日中に「該当日を含まないを優先してよい」と訂正があった。**
 *   ⚠️ ⚠️ **そのぶんバッジより少なく出る。これは不具合ではない。**
```

**(b) 応答をセクションに分けた（⚠️ 型ごと変更）**

```ts
/**
 * 1つの表。
 *
 * ⚠️⚠️ **2026-09-28 に「全て別のテーブルで表示する」へ変わった。**
 *   ⚠️ 以前は未同期と来場未入力を1つに混ぜ、本日の予定も1表にしていた。
 *   ⚠️ ⚠️ **混ぜると何をすればよいかが読み取れない**というのが変更の理由。
 */
export interface DailySection {
  /** ⚠️ 画面の見出しにそのまま出す */
  label: string;
  /** ⚠️ 放置日数の列を出すかどうか。⚠️ **本日の予定には無い** */
  hasDays: boolean;
  rows: (AttentionRow | TodayRow)[];
}

export interface DailyActionResponse {
  /** ⚠️ 表示する順に並べてある。⚠️ **0件の表も含む**（画面側で落とす） */
  sections: DailySection[];
  /** ⚠️ 全部の合計。⚠️⚠️ **0 ならモーダルを出さない** */
  total: number;
  /** ⚠️ 上限で切り捨てたかどうか。⚠️ 画面に断りを出すために返す */
  truncated: boolean;
  /**
   * ⚠️⚠️ **モーダルを出してよいか。**
   *   ⚠️ `staff.check_daily_action` が**本日**なら false。
   *   ⚠️ ⚠️ **誰か分からない（Token が無い）ときは true。**
   *     ⚠️ 出しすぎるほうが、出ないより安全という判断。
   */
  show: boolean;
}
```

**(c) 確認済みの判定と記録**

```ts
/**
 * その人が今日もう確認したか。
 *
 * ⚠️ `staff` はログインに使うテーブル（⚠️ **`staff_list` ではない**）。
 * ⚠️ 列は backend/scripts/sql/2026-09-28_staff_check_daily_action.sql で追加した。
 */
const CHECKED_SQL = `
  SELECT COUNT(*) AS c
    FROM staff
   WHERE id = ?
     AND check_daily_action = CURDATE()
`;

/** ⚠️ 「確認しました」を押したときに入れる。⚠️ **押した日だけを持つ**（履歴ではない） */
const CHECK_SQL = `
  UPDATE staff
     SET check_daily_action = CURDATE()
   WHERE id = ?
`;

export const runDailyAction = async (staffId: number | null): Promise<DailyActionResponse> => {
  // ⚠️ クエリは互いに独立しているので並列で投げる
  const [unsync, cancel, today, checked] = await Promise.all([
    query<AttentionRow>(UNSYNC_SQL, [SYNC_START_MONTH, ROW_LIMIT]),
    query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]),
    query<TodayRow>(TODAY_SQL, [...TODAY_STEPS.map((s) => s.label), ROW_LIMIT]),
    staffId === null
      ? Promise.resolve([] as CountRow[])
      : query<CountRow>(CHECKED_SQL, [staffId]),
  ]);

  /**
   * ⚠️ 本日の予定は工程ごとの表に割る。
   *   ⚠️ `TODAY_SQL` は工程名を `step` に入れて返しているので、それで振り分ける。
   *   ⚠️ ⚠️ **並びは `TODAY_STEPS` のとおり**（商談が進む順）。入れ替えないこと。
   */
  const sections: DailySection[] = [
    { label: '未同期', hasDays: true, rows: unsync },
    { label: '来場日未入力', hasDays: true, rows: cancel },
    ...TODAY_STEPS.map((step) => ({
      label: `本日の${step.label}`,
      hasDays: false,
      rows: today.filter((row) => row.step === step.label),
    })),
  ];

  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);

  return {
    sections,
    total,
    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT,
    show: Number(checked[0]?.c ?? 0) === 0,
  };
};

/**
 * 「確認しました」を記録する。
 *
 * ⚠️⚠️ **誰か分からないときは何もしない**（⚠️ `false` を返す）。
 *   ⚠️ 全員の行を更新してしまう事故を避けるため、⚠️ **`id` が無い UPDATE は投げない。**
 */
export const runDailyActionCheck = async (staffId: number | null): Promise<{ status: string }> => {
  if (staffId === null) return { status: 'error' };
  await query(CHECK_SQL, [staffId]);
  return { status: 'success' };
};
```

⚠️ ルート:

```ts
      handler: async ({ ctx }) => runDailyAction(ctx.staff?.id ?? null),
```

### 4. `backend-express/src/gateway/registry.ts`（⚠️ **roll を付けた・認証を上げた**）

```ts
/**
 * ⚠️⚠️ **`auth: 'staff'` にしてある。** ⚠️ menu（'none'）とはここが違う。
 *   ⚠️ 「その人が今日もう確認したか」を `staff.check_daily_action` で見るため、
 *     ⚠️ ⚠️ **誰が見ているかが分からないと判定できない。**
 *   ⚠️ フロント（utils/apiClient.ts）は `Token` ヘッダを必ず付けている。
 *
 * ⚠️⚠️ **roll は 'list'（参照）だけを登録する。**
 *   ⚠️ 「確認しました」の記録（roll: 'check'）は **UPDATE** なので、
 *     ⚠️ ⚠️ **② へ転送しない。① だけで処理する。**
 *     ⚠️ 自動フォールバックがあるため、書き込みを転送すると**二重に走りうる。**
 */
register({
  request: 'daily_action',
  roll: 'list',
  summary: '要確認の顧客（未同期・来場日未入力）と本日の予定',
  phpSource: 'backend/src/handlers/daily_action.php',
  auth: 'staff',
  handler: async (ctx) => runDailyAction(ctx.staff?.id ?? null),
});
```

### 5. `backend/src/handlers/daily_action.php`

**(a) roll の分岐と「確認しました」**

```php
$roll = $data['roll'] ?? '';

/**
 * トークンからログイン中のスタッフを引く。
 *
 * ⚠️ `$headers` は db.php が `getallheaders()` で用意している。
 * ⚠️ ⚠️ **`requireStaff()` は使わない。** あれは 401 を返して `exit` する。
 *   ⚠️ 一覧のほうは**誰か分からなくても出したい**（出ないより出しすぎるほうが安全）。
 */
$daily_action_token = $headers['Token'] ?? $headers['token'] ?? '';
$daily_action_user = $daily_action_token === '' ? false : getUserByToken($pdo, $daily_action_token);

if ($roll === 'check') {
    // ⚠️⚠️ **誰か分からないときは何もしない。** 全員の行を更新する事故を避ける
    if (!$daily_action_user || empty($daily_action_user['id'])) {
        echo json_encode(["status" => "error"], JSON_UNESCAPED_UNICODE);
        return;
    }
    $stmt_check = $pdo->prepare("UPDATE staff SET check_daily_action = CURDATE() WHERE id = ?");
    $stmt_check->execute([$daily_action_user['id']]);
    echo json_encode(["status" => "success"], JSON_UNESCAPED_UNICODE);
    return;
}
```

**(b) 応答をセクションに分けた**

```php
// ⚠️ days は PDO が文字列で返すため、Express と同じ数値に揃える
$to_int_days = function (array $rows): array {
    foreach ($rows as &$row) {
        $row['days'] = (int) $row['days'];
    }
    unset($row);
    return $rows;
};
$response_unsync = $to_int_days($response_unsync);
$response_cancel = $to_int_days($response_cancel);

/**
 * ⚠️⚠️ **表は種類ごとに分ける**（2026-09-28 の指示）。
 *   ⚠️ 以前は未同期と来場日未入力を1つに混ぜていた。
 *   ⚠️ ⚠️ **混ぜると何をすればよいかが読み取れない**というのが変更の理由。
 * ⚠️ 並びは Express の runDailyAction() と**同じ順**にすること。
 */
$sections = [
    ["label" => "未同期", "hasDays" => true, "rows" => $response_unsync],
    ["label" => "来場日未入力", "hasDays" => true, "rows" => $response_cancel],
];
foreach ($today_steps as $step) {
    $sections[] = [
        "label" => "本日の" . $step['label'],
        "hasDays" => false,
        // ⚠️ array_values で添字を詰める。詰めないと json_encode がオブジェクトにする
        "rows" => array_values(array_filter($response_today, function ($row) use ($step) {
            return $row['step'] === $step['label'];
        })),
    ];
}

$total = 0;
foreach ($sections as $section) {
    $total += count($section['rows']);
}

/**
 * ⚠️⚠️ **その人が今日もう確認したか。**
 *   ⚠️ `staff.check_daily_action` が本日なら出さない。
 *   ⚠️ ⚠️ **誰か分からないときは出す**（出ないより出しすぎるほうが安全）。
 */
$show = true;
if ($daily_action_user && !empty($daily_action_user['check_daily_action'])) {
    $show = $daily_action_user['check_daily_action'] !== date('Y-m-d');
}

// ⚠️ キーの順序も Express と揃えている
$result = [
    "sections" => $sections,
    "total" => $total,
    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit,
    "show" => $show,
];
```

### 6. `backend/src/core/express_proxy.php`（⚠️ **roll まで書いた**）

```php
        // ⚠️⚠️ **roll まで書いていることに意味がある。**
        //   ⚠️ 'daily_action' とだけ書くと roll = 'check'（UPDATE）も転送される。
        //   ⚠️ ⚠️ **自動フォールバックがあるため、書き込みは二重に走りうる。**
        //   ⚠️ 「確認しました」の記録は ① だけで処理すること。
        'daily_action:list',
```

### 7. `frontend/src/components/company/Company.tsx`

```tsx
import DailyAction from '../DailyAction';
```
```tsx
            <DailyAction show={showDailyAction} onClose={() => setShowDailyAction(false)} />
```

⚠️ ⚠️ **`DailyActionModal.tsx` は削除した**（改名）。

---

## 確認したこと（ローカル）

⚠️⚠️ **ローカルDBが更新されていた**（⚠️ `master_data` 24,609 → **25,669** ／ `inquiry_customer` → 18,905）。
⚠️ そのため ⚠️ **第1稿の件数（47 / 50）とは一致しない。**

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| `react-scripts build`（①） | ⚠️ **成功** → ⚠️ **`main.be22a024.js`** |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ（⚠️ **完全一致**）

| セクション | `hasDays` | 件数 |
|---|---|---|
| 未同期 | true | ⚠️ **55** |
| 来場日未入力 | true | ⚠️ **19** |
| 本日の初回面談 | false | 0 |
| 本日の事前審査 | false | 0 |
| 本日の2回目以降面談 | false | ⚠️ **4** |
| 本日の契約 | false | ⚠️ **1** |
| ⚠️ **合計** | | ⚠️ **79** |

⚠️ DB を直接数えても ⚠️ **55 / 19 で一致。**
⚠️ ⚠️ **未同期は「氏名あり55 / 氏名不問74」**。⚠️ **19件が氏名なしで落ちている。**
⚠️ ⚠️ **返ってきた55件の氏名は空0件。**

### ⚠️ 1日1回の制御

| やったこと | 結果 |
|---|---|
| 実行前 | `check_daily_action = NULL` |
| ⚠️ `roll: 'check'` | ⚠️ **HTTP 200 / `status=success`** |
| 実行後 | ⚠️ **`2026-09-28`** |
| ⚠️ もう一度 `roll: 'list'` | ⚠️⚠️ **`show=false`**（⚠️ もう出ない） |
| ⚠️ **トークン無しで `list`** | ⚠️ **`show=true`**（⚠️ 誰か分からないときは出す） |
| 後片付け | ⚠️ **`NULL` に戻した** |

⚠️ ⚠️ **トークンの値は一度も表示していない**（⚠️ コンテナ内のPHPから直接使った）。

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`ALTER TABLE staff` を本番①でも実行すること。** ⚠️ 忘れると `list` が 500 になる |
| 2 | ⚠️⚠️ **`express_proxy.php` は `'daily_action:list'`。** ⚠️ **`'daily_action'` に戻さないこと**（⚠️ 書き込みが二重に走る） |
| 3 | ⚠️ 閉じる手段は ⚠️ **ボタンだけ**。⚠️ **押さない限り翌日も出る** |
| 4 | ⚠️ 記録に失敗しても ⚠️ **閉じる**（⚠️ 閉じられないほうが困る）。⚠️ **また出るだけ** |
| 5 | ⚠️⚠️ **当日分は出さない。** ⚠️ **メニューのバッジより少ない。不具合ではない** |
| 6 | ⚠️ 未同期は ⚠️ **氏名がある行だけ**。⚠️ 実測で **19件が落ちている** |
| 7 | ⚠️ 色の境目は ⚠️ **`DailyAction.tsx` の `daysStyle()`** だけを直す |
| 8 | ⚠️⚠️ **担当者で絞っていない**（⚠️ 「晒す」のが狙い） |
| 9 | ⚠️ `runDailyActionCheck()` は ⚠️ **② に置いてあるが、ゲートウェイには登録していない**。⚠️ **① だけで処理している**（⚠️ 将来 ② へ寄せるときのために残した） |
