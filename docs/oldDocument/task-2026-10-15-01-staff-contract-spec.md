# 2026-10-15 営業別契約率に「部門」（注文営業／建売営業）を追加・契約数ランキングへ改名（v2.2.191）

## 依頼
- ヘッダー「活動サマリー」の項目
  - 営業別契約率 … category === spec（建売）でも同じロジックで出せるか → 可能なら上部のコントロールに **部門** を追加
    - 注文営業: `master_data` / 建売営業: `master_data_kaeru`
  - 契約率ランキング → **契約数ランキング** に改名
- 確認事項への回答（2026-10-15）: 「物件案内」は**次アポに入れない**（商談顧客には入れる）

## 変更ファイル一覧
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features | **staffContract.ts** | 型 `Department`・`DepartmentConfig`、定数 `SPEC_NEXT_ACTIONS`・`SPEC_TALK_ACTIONS`・`DEPARTMENTS`、関数 `toDepartment` を追加。`runStaffContract` に第3引数 `department`、内部関数 `actionOf` を追加。定数 `TARGET_DIVISION` を削除（`DEPARTMENTS.order.division` へ） |
| backend-express/src/gateway | **registry.ts** | `staff_contract` で `department` を受け取って渡す |
| frontend/src/components/header | **StaffContractRate.tsx** | 型 `Department`・定数 `DEPARTMENTS`・state `department`、絞り込みバーに「部門」 |
| frontend/src/components/header | **Header.tsx** | 「契約率ランキング」→「契約数ランキング」（メニュー・クリック判定・コメント） |
| frontend/src/components/company | **RankingLoader.tsx** | コメントの名称だけ |
| frontend/src/utils | **version.ts** | 2.2.191 |
| backend/scripts/sql | **2026-10-15_update_log_2.2.191.sql**（新規） | update_log（ローカルDBは no=287 で投入済み） |
| docs | deploy-v2.2.191.md（新規） | デプロイ手順 |
| docs → docs/oldDocument | 2日以上前の docs 55件 | CLAUDE.md のルールで移動 |

## 調査結果（ローカルDB 2026-10-15）
| 項目 | 注文 | 建売 |
|---|---|---|
| 顧客の表 | master_data | master_data_kaeru（同じ列構成。商談フェーズの列IDも同じ） |
| 契約済み | — | 870件 |
| フェーズ列の入力 | — | 初回面談 2,439 / 事前審査 230 / 第二面談 140 / 契約 821 / 反響取得日 11,294 |
| 商談シート | 6,634件 | 10,603件（id は重ならない。どちらにも無い 1,322件） |
| 事業区分（shop_list / section_list） | 注文事業 | **建売分譲事業**（不動産営業1課・2課 / 鹿児島1係 など12店舗） |
| 前任（first_interviewed_user） | — | 281件しか入っていない → 担当変更理由はほぼ0 |

建売の商談ログの action（9,273件）: 接触 3,953 / 初回面談 2,468 / 申し込み 832 / 契約 549 / 事前取得（現金確認含む）422 / 物件案内 418 / ローン事前承認済み 227 / 2回目以降面談 222 / 自社契約 80 / 仲介契約 10 / ＋「自社契約,○○(公開)」のような物件名付き

## 建売の判定
| 区分 | action |
|---|---|
| 商談顧客 | 初回面談・**物件案内**・2回目以降面談・申し込み・事前取得（現金確認含む）・ローン事前承認済み・契約・自社契約・仲介契約 |
| 次アポ | 上から初回面談・物件案内を除いたもの |
- 物件名付き（`自社契約,熊本　南区近見(公開)`）は `,` の前で判定（建売のみ。注文は従来どおり完全一致）
- 契約数・フェーズ列・担当変更理由の扱いは注文と同じ（表だけ master_data_kaeru）
- 商談シートは**建売の顧客 id だけ**に絞る（絞らないと注文の記録の `staff` が建売の営業に数えられる）
  - ⚠️ 注文は絞らない（v2.2.190 までと数字を変えないため）。絞ると2名の商談顧客数が1〜3人減り、注記の件数も 18,559 → 6,634 になる

## 確認（ローカル）
- 注文: 変更前後で `runStaffContract` の返り値（全期間・2026-04〜09）が **バイト単位で一致**
- 建売: 25名 / 商談顧客 2,348 / 次アポ 1,016 / 契約 622 / 担当変更理由 95（全期間）。課は不動産営業1課・2課、店舗12
- フロント: `npm run build` 成功（main.24d29da0.js）。型エラーは既存ファイルのみ（CompetitorMaterials.tsx など。今回の変更と無関係）

---

## backend-express/src/features/staffContract.ts（追加・変更部分）

```ts
/** 次アポ（＝初回面談のあとに進んだ）とみなす action */
const NEXT_ACTIONS = new Set(['2回目以降面談', '事前審査', '契約']);

/**
 * 部門（v2.2.191）。⚠️ 画面の「部門」の選択肢。
 *   ⚠️ order … 注文営業（`master_data`） / spec … 建売営業（`master_data_kaeru`）
 */
export type Department = 'order' | 'spec';

interface DepartmentConfig {
  /** 顧客の表。⚠️ SQL に直接埋め込むので、**この定数以外の値を入れないこと** */
  table: 'master_data' | 'master_data_kaeru';
  /** 対象の事業区分。⚠️ `shop_list.division` / `section_list.division` の実際の値 */
  division: string;
  /** 商談顧客とみなす action */
  talk: Set<string>;
  /** 次アポとみなす action */
  next: Set<string>;
  /**
   * ⚠️ `自社契約,物件名(公開)` のように後ろに物件名が付いた action を、
   *   **`,` の前だけで判定するか。** ⚠️ 注文は判定しない（従来どおり完全一致）。
   */
  stripProperty: boolean;
  /**
   * 商談シートを**この部門の顧客の id だけ**に絞るか。
   *
   * ⚠️⚠️ **商談シートは注文・建売・中古で同じ表**（⚠️ 実測 18,559件 = 注文 6,634 / 建売 10,603 / その他 1,322）。
   *   ⚠️ 建売は絞る（⚠️ 絞らないと注文の記録の `staff` が建売の営業に数えられる）。
   *   ⚠️ ⚠️ **注文は絞らない**（⚠️ v2.2.190 までの数字を変えないため）。
   *     ⚠️ 絞ると注文でも2名の商談顧客数が1〜3人減り、注記の件数も 18,559 → 6,634 になる（実測 2026-10-15）。
   */
  onlyOwnSheets: boolean;
}

/**
 * 建売の商談ログの action（実測 2026-10-15 / 建売顧客の記録 9,273件）。
 *   ⚠️ 物件案内 418 / 申し込み 832 / 事前取得 422 / ローン事前承認済み 227 /
 *   ⚠️ 自社契約 80（＋物件名付き）/ 仲介契約 10（＋物件名付き）。
 *
 * ⚠️⚠️ **「物件案内」は商談顧客には入れるが、次アポには入れない**（2026-10-15 の指示）。
 *   ⚠️ 建売では初回面談の前に物件案内をすることがあるため。
 */
const SPEC_NEXT_ACTIONS = new Set([
  '2回目以降面談', '申し込み', '事前取得（現金確認含む）', 'ローン事前承認済み',
  '契約', '自社契約', '仲介契約',
]);
const SPEC_TALK_ACTIONS = new Set(['初回面談', '物件案内', ...SPEC_NEXT_ACTIONS]);

const DEPARTMENTS: Record<Department, DepartmentConfig> = {
  // ⚠️ `shop_list.division` の実際の値（⚠️ 「注文営業」という値は無い）
  order: { table: 'master_data', division: '注文事業', talk: TALK_ACTIONS, next: NEXT_ACTIONS, stripProperty: false, onlyOwnSheets: false },
  // ⚠️ 「建売営業」「建売事業」という値も無い。⚠️ **`建売分譲事業`**
  spec: { table: 'master_data_kaeru', division: '建売分譲事業', talk: SPEC_TALK_ACTIONS, next: SPEC_NEXT_ACTIONS, stripProperty: true, onlyOwnSheets: true },
};

/** ⚠️ 決まった値以外は order として扱う（⚠️ 既定は今までどおり注文） */
export const toDepartment = (value: string): Department => (value === 'spec' ? 'spec' : 'order');
```

`runStaffContract`（変更箇所。ほかは従来どおり）
```ts
/**
 * 営業別の契約率を返す。
 *
 * @param period 年度。⚠️ `staff_list.period` の値（例 '2027'）
 * @param department 部門（v2.2.191）。⚠️ 省略時は注文（今までどおり）
 * ...
 */
export const runStaffContract = async (
  period: string,
  range: MonthRange = { start: '', end: '' },
  department: Department = 'order'
): Promise<StaffContractResult> => {
  const target = period.trim() === '' ? '2027' : period.trim();
  const dept = DEPARTMENTS[department];

  /** ⚠️ 物件名付きの action は `,` の前だけで見る（⚠️ 建売のみ） */
  const actionOf = (entry: LogEntry): string => {
    const action = String(entry.action ?? '');
    return dept.stripProperty ? action.split(',')[0].trim() : action;
  };

  const [staff, sheets, contracted, sections, shops] = await Promise.all([
    query<StaffRow>(
      `SELECT s.name, s.shop, s.section
         FROM staff_list s
         JOIN shop_list sl ON sl.shop = s.shop
        WHERE s.period = ? AND s.report = 1 AND sl.division = ?
        ORDER BY s.sort, s.id`,
      [target, dept.division]
    ),
    // ⚠️ 2列だけ引く。⚠️⚠️ **`SELECT *` にすると不要な列まで流れる**
    query<SheetRow>(`SELECT id, interview_log FROM interview_sheet${dept.onlyOwnSheets ? ` WHERE id IN (SELECT id FROM ${dept.table})` : ''}`),
    query<ContractRow>(
      `SELECT id, in_charge_user, status,
              ${COL_INTERVIEW} AS col_interview,
              ${COL_SCREENING} AS col_screening,
              ${COL_APPOINTMENT} AS col_appointment,
              ${COL_CONTRACT} AS col_contract,
              first_interviewed_user,
              last_action_step_migration_item_name AS last_action,
              ${COL_INQUIRY} AS col_inquiry
         FROM ${dept.table}`
    ),
    query<MasterRow>(
      'SELECT `no`, name FROM section_list WHERE division = ? ORDER BY `no`',
      [dept.division]
    ),
    query<ShopMasterRow>(
      'SELECT id AS `no`, shop AS name, section FROM shop_list WHERE division = ? ORDER BY id',
      [dept.division]
    ),
  ]);

  // ...（中略：従来どおり）

  for (const sheet of sheets) {
    const fallback = ownerOf.get(sheet.id) ?? '';
    let had = false;

    for (const entry of toLog(sheet.interview_log)) {
      const action = actionOf(entry);
      const logged = norm(entry.staff);
      if (logged !== '') had = true;

      const who = logged !== '' ? logged : fallback;
      if (who === '') continue;

      if (!inRange(toMonth(entry.day), range)) continue;

      if (dept.talk.has(action)) bucketOf(who).talk.add(sheet.id);
      if (dept.next.has(action)) bucketOf(who).next.add(sheet.id);
    }
    if (had) sheetsWithStaff += 1;
  }

  // ...（中略：従来どおり）

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      period: target,
      // ⚠️ 集計した部門（v2.2.191）。⚠️ 画面の見出しに使う
      department,
      range,
      rows,
      // ...（従来どおり）
    },
  };
};
```

## backend-express/src/gateway/registry.ts
```ts
import { runStaffContract, toDepartment } from '../features/staffContract';
```
```ts
register({
  request: 'staff_contract',
  summary: '営業別の商談顧客数・次アポ数・契約数。注文・建売（Master / BrandAdmin のみ）',
  phpSource: '（新規。PHP版なし）',
  auth: 'staff',
  handler: async (ctx) => {
    const brand = ctx.staff?.brand ?? '';
    if (!STAFF_CONTRACT_AUTHORITY.includes(brand)) {
      ctx.res.status(403);
      return { status: 'error', message: 'この操作を行う権限がありません。' };
    }

    const text = (key: string) => (typeof ctx.body[key] === 'string' ? (ctx.body[key] as string) : '');

    // ⚠️ 期間は `YYYY-MM`。⚠️⚠️ **既定は全期間**（空文字）
    // ⚠️ 部門（v2.2.191）。⚠️⚠️ **'spec' 以外はすべて注文**（⚠️ 古い画面は送ってこない）
    const result = await runStaffContract(text('period'), {
      start: text('startMonth').trim(),
      end: text('endMonth').trim(),
    }, toDepartment(text('department')));
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

## frontend/src/components/header/StaffContractRate.tsx
```tsx
/**
 * 部門（v2.2.191）。⚠️ ② の `department` にそのまま送る値。
 *   ⚠️ 注文営業 … `master_data` / 建売営業 … `master_data_kaeru`
 */
type Department = 'order' | 'spec';
const DEPARTMENTS: { value: Department; label: string; division: string }[] = [
    { value: 'order', label: '注文営業', division: '注文事業' },
    { value: 'spec', label: '建売営業', division: '建売分譲事業' },
];
```
```tsx
    /**
     * 部門（v2.2.191）。⚠️ 既定は注文営業（⚠️ 今までの画面と同じ）。
     *   ⚠️⚠️ **期間と同じくサーバーで切り替える**（⚠️ 顧客の表も営業も別になるため）。
     */
    const [department, setDepartment] = useState<Department>('order');
```
```tsx
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'staff_contract',
                department,
                startMonth,
                endMonth,
            });
            // ...（従来どおり）
        } finally {
            setLoading(false);
        }
    }, [department, startMonth, endMonth]);
```
見出し
```tsx
                <span className="sc_note">
                    {DEPARTMENTS.find(d => d.value === department)?.division}
                    {period === '' ? '' : ` / ${period}年度`}（報告対象）
                </span>
```
絞り込みバーの先頭
```tsx
                        {/* ⚠️ 部門（v2.2.191）。⚠️⚠️ **変えたら課・店舗の選択を外す**（⚠️ 課も店舗も部門ごとに別物） */}
                        <div>
                            <div className="sc_bar_label">部門</div>
                            <Form.Select
                                size="sm" value={department} style={{ width: '120px', fontSize: '12px' }}
                                onChange={(e) => {
                                    setDepartment(e.target.value === 'spec' ? 'spec' : 'order');
                                    setTargetSection(''); setTargetShop('');
                                }}
                            >
                                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </Form.Select>
                        </div>
```
- 「絞り込みを外す」は部門を戻さない（部門は絞り込みではなく集計対象の切り替えのため）

## frontend/src/components/header/Header.tsx
```tsx
        '活動サマリー': [
            '月次日報',
            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['営業別契約率'] : []),
            ...(category === 'order' ? ['アクションボード'] : []),
            '契約数ランキング',
        ],
```
```tsx
                                        // ⚠️ 契約数ランキング（v2.2.169）も自前のモーダル
                                        if (menu === '活動サマリー' && item === '契約数ランキング') {
                                            setShowRanking(true);
                                            return;
                                        }
```
（ほか、コメント中の名称3か所・RankingLoader.tsx のコメント1か所を置換）
