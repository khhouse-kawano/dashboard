# 作業記録 v2.2.252（2つ目の指示）　不動産企画係：担当者の修正依頼4件

## 依頼（担当者からの修正依頼。v2.2.252 で対応）
1. 反響ページの担当者欄が、表示の揺れで出ない・かなり狭くなって見えない → 売り反響・買い反響の表の幅を工夫する
2. 媒介獲得台帳へ紐づけた後の担当者の表記が、名字だけとフルネームで混在する → ぶれを直す SQL を用意する
3. 商談案件管理の精算書で、売主に「田原嘉昭」様が定着して出る。固定資産税等も無関係な数字が先に入っている
4. 商談案件管理で、各案件を編集する機能が無く、修正できない

あわせて、ダウンロードの「以前のアプリ v14.30 と現行（v2.2.248）の相違点・改修依頼の要点.md」を読んだ（今後の版の順番の提案。今回の4件とは別。要点は realty-handoff.md の「5. 次にやること」に入れた）。

## 原因と直し方
| # | 原因 | 直し方 |
|---|---|---|
| 1 | 表の幅は中身から自動で決まる。担当・反響元・フェーズの選択欄は幅100%なので、列が縮む。1366px の画面で、売り反響の担当の選択欄が **38px** だった | 選択欄の列の見出しに最小幅（担当・フェーズ 110px、反響元 100px／ポータル 110px）。直した後は 94px 以上 |
| 2 | 台帳の担当が3通り：以前のアプリと媒介紐付が書く**略称**（「時任」）、台帳の編集画面の選択肢（スタッフ表）の**空白入りの氏名**（「時任 聡一朗」）、反響・商談と同じ**氏名**（「時任聡一朗」） | 利用者の決定で**空白なしの氏名**にそろえる。SQL で今のデータを直し、これから混ざらないようにコードも直す（下） |
| 3 | 精算書の初期値が**見本のデータ**（売主「田原 嘉昭」・買主・固都税 t1〜t4・決済場所・請求書番号・ローン額など）。開くと案件の値を**前の値に重ねて**いたため、案件に無い項目（「買」の案件の売主など）に見本が残った | 以前のアプリ（`defaultData`・`fromDeal`）と同じく、開くたびに空欄の初期値から作り直す。種別で請求先・取引態様を分け、案件の仲介手数料に合うよう値引き欄で調整 |
| 4 | 「編集」ボタンは**表の右端**にあった。表は最小幅1500pxで、1366px の画面ではボタンが 1735px の位置（画面の外） | 「編集」を左端に移した（228px の位置）。物件名を押しても編集画面を開く |

### 2 の詳しい内容（担当者を氏名にそろえる）
- 利用者の決定：氏名にそろえる。「大坪」（設定の担当者に居ない。スタッフ表には中古住宅専門店の「大坪 征也」さん）はそのまま残す
- SQL `2026-11-05_realty_staff_name_unify.sql`
  - 対象：売り反響・買い反響・台帳・商談・買取再販の 担当・共同担当・販売担当
  - 略称は設定（app_state）の担当者の 略称 → 氏名 で置き換える（`JSON_SEARCH` で読む。設定を SQL に書き込まない）。空白は除く。設定に居ない人は空白を除くだけ
  - 控えの表 `brokerage_listings_bk_20261105_staff`（直す前・後）。何回流しても同じ。安全更新モードで確認
  - ローカル（本番の写し）：台帳 188行・買取再販 2行・商談 1行（テスト行を除くと台帳 183行・買取再販 1行）
- これから混ざらないように
  - ② `ledgerLink.ts`：媒介紐付で台帳の担当を**氏名**で書く（`abbrOf` → `staffOf`）。`portal`（以前のアプリで作成時に担当と同じ略称を入れていた列。Dashboard の画面は読まない）は略称のまま
  - ② `importer.ts`：以前のアプリの取り込み直しで、担当・共同担当・販売担当を氏名にそろえる（`staffNameMap`）。原本（raw_data）はそのまま
  - `PropertyRegister.tsx`（台帳の編集画面。中古リノベの画面とも共通）：担当営業の選択肢の**値**を空白なしの氏名に（表示はスタッフ表の名前）。今の値が選択肢に無いときもその値を出す
  - `kpi.ts`：`findStaff`・`staffNameOf`（設定の担当者を氏名か略称で探す。空白は除く）を追加。チームサマリー・月次媒介管理・買付登録の担当の初期値で使う（以前は略称でしか探せず、氏名の台帳は買付登録の担当が空・月次媒介の「担当未設定」に数えられていた）

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/sell | LeadSell.tsx | 反響元・担当・フェーズの列に最小幅 |
| frontend/src/components/realty/buy | LeadBuy.tsx | ポータル・担当・フェーズの列に最小幅 |
| frontend/src/components/realty/deals | **LeadOpportunity.tsx** | 「編集」を左端に、物件名で編集、`openPlanner` を以前のアプリの fromDeal と同じに |
| frontend/src/components/realty/documents | **PlannerGenerator.tsx** | 追加：`ymd`・**`plannerDefaults`**。`brokerageBase` を export。見本の初期値を削除、開くたびに作り直す |
| frontend/src/components/realty/summary | **kpi.ts** | 追加：**`findStaff`**・**`staffNameOf`** |
| frontend/src/components/realty/summary | Summary.tsx | `abbrToName` を `staffNameOf` で |
| frontend/src/components/realty/bmonthly | BaikaiMonthly.tsx | `abbrToName`・「担当未設定」の判定を `staffNameOf`・`findStaff` で。注意の文言 |
| frontend/src/components/realty/common | BuyOfferModal.tsx | 担当の初期値を `findStaff` で |
| frontend/src/components/realty/common | leadLinks.ts | コメント（台帳の担当は氏名） |
| frontend/src/components/database | **PropertyRegister.tsx** | 追加：**`staffOptions`** |
| backend-express/src/features/realty | **ledgerLink.ts** | `abbrOf` → **`staffOf`**。台帳の担当を氏名で |
| backend-express/src/features/realty | **importer.ts** | 追加：`STAFF_COLUMNS`・**`staffNameMap`**。`runImportRecords` で担当をそろえる |
| backend/scripts/sql | **2026-11-05_realty_staff_name_unify.sql**（新規） | 担当者の表記をそろえる |
| backend/scripts/sql | 2026-11-05_update_log_2.2.252.sql | 更新履歴の文を4件分に。記事3本の SQL |
| backend/scripts/guide/articles/common | screen-247.md・screen-243.md・screen-270.md | 記事（下） |

- ⚠️ ① の PHP、`projects/sync`、GAS は変えていない。② の新しい request は無い

## テスト（ローカル）
- ① 経由（`localhost:8080`）
  - トークン無し `planner:ledger_link` → 401
  - 媒介紐付（担当を「時任 聡一朗」で送る）→ 台帳の担当「時任聡一朗」、portal「時任」
  - 取り込み直し：台帳の略称「永田」→「永田倫也」、買取再販の「時任 聡一朗」→「時任聡一朗」、販売担当「岡崎」→「岡崎真夕」、「大坪」はそのまま
- SQL（`--safe-updates`）：テスト行で、台帳の略称・空白入り・全角空白の共同担当・販売担当の略称・設定に居ない人。2回目は変わらない（控えも増えない）
- Playwright（3100）
  - 1366px・1920px：売り・買い反響の担当の選択欄 94px 以上（直す前は 1366px の売り反響で 38px）。商談案件管理の「編集」が画面内（直す前は 1366px で画面の外）
  - 商談案件管理：物件名で編集画面が開く。「買」の案件の精算書で、買主＝案件の顧客・売主は空・固都税 0・見本の値（田原・中元・上福元町・KHF-2026-0087・谷山）がどこにも無い。続けて「売」の案件を開くと、売主＝案件の顧客・買主は空（前の案件の値が残らない）
  - 媒介獲得台帳の編集画面：担当の値「時任聡一朗」が選ばれている。選択肢の値に空白が無い
  - 月次媒介管理：「期間内の全件が設定済み担当に紐づいています」。チームサマリー：表7個。画面のエラー 0
- 1つ目の指示（連絡先）のテストも、まとめて通し直した（すべて OK）
- テストの行・一時スタッフ（id 999999）は消した。開発サーバーは止めた
- リファクタリング：`plannerDefaults` の export を外した（ファイルの中だけで使う）。月次媒介管理の注意の文言を、略称だけでなく氏名にも合う形にした。そのあとテストを通し直した

## 業務ガイド
- 「反響から商談案件へのつながり（不動産企画係）」（screen-247）：商談案件管理の「編集」の場所と物件名、精算書の開き方（売・買で何が入るか、手数料の値引き、決済日）。媒介獲得台帳の担当欄は担当者名
- 「月次媒介管理（不動産企画係）」（screen-243）：台帳の担当欄は担当者の名前（以前のアプリから来た台帳は略称）と突き合わせる
- 「設定（不動産企画係）」（screen-270）：台帳の担当欄には担当者名が入る。略称は以前のアプリから来た台帳のために残す
- SQL は `2026-11-05_update_log_2.2.252.sql` の末尾。ローカルに流した

## 追加・修正した関数（全文）

### frontend/src/components/realty/summary/kpi.ts
```ts
/**
 * 設定の担当者を、氏名か略称で探す（findStaff。v2.2.252）。空白は除いて比べる
 * ⚠️ 台帳の担当は v2.2.252 から氏名（以前のアプリから来たものは略称）。どちらでも同じ人になるようにする
 */
export const findStaff = (list: StaffSetting[] | undefined, v: string): StaffSetting | undefined => {
    const k = v.replace(/[\s　]/g, '');
    if (!k) return undefined;
    return (list ?? []).find(s => str(s.name).replace(/[\s　]/g, '') === k || (!!s.abbr && s.abbr === k));
};

/** 台帳の担当（氏名か略称）→ 設定の氏名（abbrToName）。設定に居なければその値のまま */
export const staffNameOf = (list: StaffSetting[] | undefined, v: string): string => findStaff(list, v)?.name ?? v;
```

### frontend/src/components/realty/documents/PlannerGenerator.tsx
```tsx
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * 精算書の初期値（以前のアプリの defaultData と同じ）。案件ごとの値は空欄、日付は今日と月末。
 * ⚠️ v2.2.252: 以前は見本のデータ（売主「田原 嘉昭」・固都税など）が初期値で、案件に無い項目に見本が残っていた。
 *   精算書を開くたびに、この値から作り直す
 */
const plannerDefaults = (): PlannerInputState => {
    const now = new Date();
    const today = ymd(now);
    const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return {
        propName: '', propZip: '', propAddr: '',
        seller: '', sellerZip: '', sellerAddr: '',
        buyer: '', contractDate: today, delivery: monthEnd,
        place: '', placeAddr: '', startTime: '10:00',
        price: 0, deposit: 0, interim: 0,
        taxBase: '01-01', taxDay: 'buyer', t1: 0, t2: 0, t3: 0, t4: 0,
        mode: 'both', lowPrice: '0', sDisc: 0, sPaid: 0, bDisc: 0, bPaid: 0,
        loanPrin: 0, loanInt: 0, loanFee: 0, sJudi: 27900, sStamp: 0,
        rel: 'other_bank', ch: 'counter', tfCount: 0,
        bJudi: 237600, bArr: 550000, bGuar: 266600, bIns: 60600, bStamp: 0, bLoan: 0,
        billTo: 'both', invNoS: '', invNoB: '', invDate: today, invDue: monthEnd, invReg: 'T', payAcct: 'brokerage',
        rcOn: '1', rcTarget: 'both', rcCustom: 0, rcSign: 'blank', rcStamp: 'free',
        sellerTaxable: '0', sellerInvReg: '', sellerVat: 0,
        sBank: '', sBranch: '', sAcctType: '普通', sAcctNo: '', sAcctName: '', sAcctKana: ''
    };
};

// （コンポーネントの中）
    const [form, setForm] = useState<PlannerInputState>(plannerDefaults);
    // 💡 モーダルを開くたびに、初期値から作り直して案件のデータを入れる（以前のアプリの SETL.open → apply(fromDeal(d))）
    // ⚠️ v2.2.252: 前の値に重ねていたため、見本のデータや、直前に開いた案件の値が残っていた
    useEffect(() => {
        if (!plannerShow) return;
        setForm({ ...plannerDefaults(), ...(initialData ?? {}) });
        setStampAuto({ s: true, b: true });
        setExtras({ s: [], b: [] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plannerShow]);
```

### frontend/src/components/realty/deals/LeadOpportunity.tsx（openPlanner）
```tsx
    /**
     * 以前のアプリの fromDeal(d) → SETL.open(dealId)。⚠️ 入れない項目は精算書の初期値（空欄）のまま
     * ⚠️ v2.2.252: 種別で請求先を分け（「買」は買主側・それ以外は売主側）、案件の仲介手数料に合うよう値引き欄で調整する（以前のアプリと同じ）
     */
    const openPlanner = (d: Row) => {
        const isBuy = str(d.type) === '買';
        const price = num(d.price);
        const disc = Math.max(0, brokerageBase(price, false).net - dealFee(d));
        const data: Partial<PlannerInputState> = {
            propName: str(d.property), price,
            ...(isBuy
                ? { buyer: str(d.customer), mode: 'buyer', billTo: 'buyer', bDisc: disc }
                : { seller: str(d.customer), mode: 'seller', billTo: 'seller', sDisc: disc }),
        };
        if (day(d.contractDate)) data.contractDate = day(d.contractDate);
        if (day(d.settleDate)) { data.delivery = day(d.settleDate); data.invDue = day(d.settleDate); }
        setPlannerData(data);
        setPlannerShow(true);
    };
```

### frontend/src/components/database/PropertyRegister.tsx（staffOptions）
```tsx
    /** 担当営業の選択肢（v2.2.252）。値は空白なしの氏名、表示はスタッフ表の名前。今の値が無ければ足す */
    const staffOptions = useMemo(() => {
        const opts = staffList.map(s => ({ value: removeAllSpaces(s), label: s }));
        const cur = editData.staff || '';
        return cur && !opts.some(o => o.value === cur) ? [...opts, { value: cur, label: cur }] : opts;
    }, [staffList, editData.staff]);
```

### backend-express/src/features/realty/ledgerLink.ts（staffOf）
```ts
/**
 * 設定の担当者（氏名と略称）。⚠️ 名前は空白を除いて突き合わせる
 * ⚠️ v2.2.252: 台帳の担当は**氏名**（設定の名前。反響・商談と同じ）。以前は略称で書いていたが、台帳の編集画面が氏名で保存するため混ざっていた。
 *   portal（以前のアプリで作成時に担当と同じ略称を入れていた列。Dashboard の画面は読まない）は略称のまま
 */
const staffOf = async (tx: Tx, name: string): Promise<{ name: string; abbr: string }> => {
  const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
  let list: unknown = row?.staff;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  const me = norm(name);
  if (Array.isArray(list)) {
    for (const s of list) {
      if (s === null || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      if (norm(r.name) === me || (str(r.abbr) !== '' && norm(r.abbr) === me)) return { name: norm(r.name) || me, abbr: str(r.abbr) };
    }
  }
  return { name: me, abbr: '' };
};
```

### backend-express/src/features/realty/importer.ts（staffNameMap と runImportRecords の追加部分）
```ts
/** 担当の列（v2.2.252） */
const STAFF_COLUMNS = ['staff', 'subStaff', 'sellStaff'] as const;

/**
 * ⚠️ v2.2.252: 担当を「空白なしの氏名」にそろえるための対応表（空白なしの氏名・略称 → 空白なしの氏名）。設定（app_state）の担当者から作る。
 * 以前のアプリは媒介台帳の担当を略称（「時任」）で持つ。Dashboard は台帳も氏名（反響・商談と同じ）
 */
const staffNameMap = async (): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const rows = await query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings' LIMIT 1");
  let list: unknown = rows[0]?.staff;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return map;
  for (const s of list) {
    if (s === null || typeof s !== 'object') continue;
    const name = norm((s as Record<string, unknown>).name);
    const abbr = norm((s as Record<string, unknown>).abbr);
    if (!name) continue;
    map.set(name, name);
    if (abbr && !map.has(abbr)) map.set(abbr, name);
  }
  return map;
};

// runImportRecords の中
  const staffNames = await staffNameMap();
  ...
      // ⚠️ v2.2.252: 担当は空白なしの氏名にそろえる（台帳の略称は設定の氏名へ）。設定に居ない人（退職者など）は空白だけ除く。原本（raw_data）はそのまま
      for (const col of STAFF_COLUMNS) {
        const v = row[col];
        if (typeof v !== 'string' || v.trim() === '') continue;
        row[col] = staffNames.get(norm(v)) ?? norm(v);
      }
```

## 新規ファイル（全文）：backend/scripts/sql/2026-11-05_realty_staff_name_unify.sql
```sql
-- =====================================================================
-- v2.2.252 不動産企画係：担当者の表記を「空白なしの氏名」にそろえる
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何回流しても同じ（そろった値はもう変わらない）
-- ⚠️ 対象: 売り反響・買い反響・媒介獲得台帳・商談案件・買取再販案件の 担当（staff）・共同担当（subStaff）・販売担当（sellStaff）
--   - 媒介獲得台帳の略称（「時任」）→ 設定の担当者の氏名（「時任聡一朗」）。対応は設定（app_state）の担当者の 略称 → 氏名 を読む
--   - 空白入りの氏名（「時任 聡一朗」。台帳の編集画面のスタッフ表の名前）→ 空白を除く
--   - 設定に居ない人（退職者など。例「大坪」）は空白を除くだけ
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、UPDATE の WHERE に主キーの範囲（internal_id > 0）を入れる
-- ⚠️ JSON_TABLE は使わない（MariaDB 10.6 から。① の版が分からないため JSON_SEARCH で読む）
-- =====================================================================

-- 0. 確認（前）：種類・担当ごとの件数
SELECT kind, staff, COUNT(*) AS `件数` FROM brokerage_listings
WHERE kind IN ('leads','buyLeads','ledger','deals','resales') AND IFNULL(staff,'') <> ''
GROUP BY kind, staff ORDER BY kind, staff;

-- 1. 直す行と、直す前・後の値（この表が控えになる。⚠️ 消さない）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_staff (
  internal_id BIGINT NOT NULL PRIMARY KEY,
  kind VARCHAR(32),
  staff_old TEXT, staff_new TEXT,
  sub_old TEXT, sub_new TEXT,
  sell_old TEXT, sell_new TEXT
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO brokerage_listings_bk_20261105_staff (internal_id, kind, staff_old, staff_new, sub_old, sub_new, sell_old, sell_new)
SELECT x.internal_id, x.kind, x.staff, x.staff_new, x.subStaff, x.sub_new, x.sellStaff, x.sell_new
FROM (
  SELECT b.internal_id, b.kind, b.staff, b.subStaff, b.sellStaff,
    -- 空白を除いた値が設定の略称なら、その人の氏名（空白を除く）。違えば空白を除いた値
    CASE WHEN IFNULL(b.staff,'') = '' THEN b.staff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.staff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.staff,' ',''),'　','')) END AS staff_new,
    CASE WHEN IFNULL(b.subStaff,'') = '' THEN b.subStaff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.subStaff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.subStaff,' ',''),'　','')) END AS sub_new,
    CASE WHEN IFNULL(b.sellStaff,'') = '' THEN b.sellStaff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.sellStaff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.sellStaff,' ',''),'　','')) END AS sell_new
  FROM brokerage_listings b
  CROSS JOIN (SELECT JSON_EXTRACT(`data`, '$.staff') AS st FROM app_state WHERE `key` = 'settings') s
  WHERE b.kind IN ('leads','buyLeads','ledger','deals','resales')
) x
WHERE BINARY IFNULL(x.staff,'') <> BINARY IFNULL(x.staff_new,'')
   OR BINARY IFNULL(x.subStaff,'') <> BINARY IFNULL(x.sub_new,'')
   OR BINARY IFNULL(x.sellStaff,'') <> BINARY IFNULL(x.sell_new,'');

-- 2. 直す（控えの表の値で。⚠️ 値が今も直す前のままの行だけ）
UPDATE brokerage_listings
SET staff = (SELECT t.staff_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(staff_old,'') <> BINARY IFNULL(staff_new,''))
  AND BINARY IFNULL(staff,'') = BINARY IFNULL((SELECT t.staff_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

UPDATE brokerage_listings
SET subStaff = (SELECT t.sub_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(sub_old,'') <> BINARY IFNULL(sub_new,''))
  AND BINARY IFNULL(subStaff,'') = BINARY IFNULL((SELECT t.sub_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

UPDATE brokerage_listings
SET sellStaff = (SELECT t.sell_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(sell_old,'') <> BINARY IFNULL(sell_new,''))
  AND BINARY IFNULL(sellStaff,'') = BINARY IFNULL((SELECT t.sell_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

-- 3. 確認（後）：種類・担当ごとの件数（台帳も氏名になり、空白入りが無ければ済み）
SELECT kind, staff, COUNT(*) AS `件数` FROM brokerage_listings
WHERE kind IN ('leads','buyLeads','ledger','deals','resales') AND IFNULL(staff,'') <> ''
GROUP BY kind, staff ORDER BY kind, staff;
SELECT kind, COUNT(*) AS `直した行` FROM brokerage_listings_bk_20261105_staff GROUP BY kind;

-- 戻すとき（控えの表の直す前の値に戻す）:
-- UPDATE brokerage_listings SET
--   staff = (SELECT t.staff_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),
--   subStaff = (SELECT t.sub_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),
--   sellStaff = (SELECT t.sell_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
-- WHERE internal_id > 0 AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff);
-- しばらくして問題が無ければ控えを消す:
-- DROP TABLE brokerage_listings_bk_20261105_staff;
```

## git diff（コード）
```diff
diff --git a/backend-express/src/features/realty/importer.ts b/backend-express/src/features/realty/importer.ts
index 900ae889e..541e8cecc 100644
--- a/backend-express/src/features/realty/importer.ts
+++ b/backend-express/src/features/realty/importer.ts
@@ -1,8 +1,35 @@
 import type { RowDataPacket } from 'mysql2/promise';
 import { executeLarge, query, withTransaction } from '../../db/pool';
+import { norm } from './index';
 import type { Result } from './index';
 import { mailFromContact, phoneFromContact } from './contactSplit';
 
+/** 担当の列（v2.2.252） */
+const STAFF_COLUMNS = ['staff', 'subStaff', 'sellStaff'] as const;
+
+/**
+ * ⚠️ v2.2.252: 担当を「空白なしの氏名」にそろえるための対応表（空白なしの氏名・略称 → 空白なしの氏名）。設定（app_state）の担当者から作る。
+ * 以前のアプリは媒介台帳の担当を略称（「時任」）で持つ。Dashboard は台帳も氏名（反響・商談と同じ）
+ */
+const staffNameMap = async (): Promise<Map<string, string>> => {
+  const map = new Map<string, string>();
+  const rows = await query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings' LIMIT 1");
+  let list: unknown = rows[0]?.staff;
+  if (typeof list === 'string') {
+    try { list = JSON.parse(list); } catch { list = []; }
+  }
+  if (!Array.isArray(list)) return map;
+  for (const s of list) {
+    if (s === null || typeof s !== 'object') continue;
+    const name = norm((s as Record<string, unknown>).name);
+    const abbr = norm((s as Record<string, unknown>).abbr);
+    if (!name) continue;
+    map.set(name, name);
+    if (abbr && !map.has(abbr)) map.set(abbr, name);
+  }
+  return map;
+};
+
 /**
  * 以前の不動産企画係アプリ（khf-eigyokanri.netlify.app）のバックアップを取り込む（v2.2.224。② だけ。マスターだけ）。
  *
@@ -331,6 +358,7 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
   const result = { inserted: 0, updated: 0, unchanged: 0, merged: 0, retired: 0, failed: 0 };
   const warnings: string[] = [];
   const errors: string[] = [];
+  const staffNames = await staffNameMap();
 
   for (const rec of records) {
     const warn = (m: string) => { if (warnings.length < 200) warnings.push(`${rec.kind} ${rec.id} ${m}`); };
@@ -361,6 +389,12 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
         row.extId = null;
         warn('ファイルの中で反響番号が重複しているため、反響番号の列は空にしました（原本には残っています）');
       }
+      // ⚠️ v2.2.252: 担当は空白なしの氏名にそろえる（台帳の略称は設定の氏名へ）。設定に居ない人（退職者など）は空白だけ除く。原本（raw_data）はそのまま
+      for (const col of STAFF_COLUMNS) {
+        const v = row[col];
+        if (typeof v !== 'string' || v.trim() === '') continue;
+        row[col] = staffNames.get(norm(v)) ?? norm(v);
+      }
       // ⚠️ v2.2.251: 反響の電話・メールは、ファイルに無ければ連絡先から取り出す。入っている値は上書きしない（下の updates）
       const fillOnly = new Set<string>();
       if ((rec.kind === 'leads' || rec.kind === 'buyLeads') && row.contact != null) {
diff --git a/backend-express/src/features/realty/ledgerLink.ts b/backend-express/src/features/realty/ledgerLink.ts
index f0f5493dd..3ee01c152 100644
--- a/backend-express/src/features/realty/ledgerLink.ts
+++ b/backend-express/src/features/realty/ledgerLink.ts
@@ -110,19 +110,26 @@ export const problemsOf = (f: LedgerLinkForm, today: string): string[] => {
   return p;
 };
 
-/** 設定の担当者の略称（台帳の担当は略称。以前のアプリと同じ）。⚠️ 名前は空白を除いて突き合わせる */
-const abbrOf = async (tx: Tx, name: string): Promise<string> => {
+/**
+ * 設定の担当者（氏名と略称）。⚠️ 名前は空白を除いて突き合わせる
+ * ⚠️ v2.2.252: 台帳の担当は**氏名**（設定の名前。反響・商談と同じ）。以前は略称で書いていたが、台帳の編集画面が氏名で保存するため混ざっていた。
+ *   portal（以前のアプリで作成時に担当と同じ略称を入れていた列。Dashboard の画面は読まない）は略称のまま
+ */
+const staffOf = async (tx: Tx, name: string): Promise<{ name: string; abbr: string }> => {
   const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
   let list: unknown = row?.staff;
   if (typeof list === 'string') {
     try { list = JSON.parse(list); } catch { list = []; }
   }
-  if (!Array.isArray(list)) return '';
   const me = norm(name);
-  for (const s of list) {
-    if (s !== null && typeof s === 'object' && norm((s as Record<string, unknown>).name) === me) return str((s as Record<string, unknown>).abbr);
+  if (Array.isArray(list)) {
+    for (const s of list) {
+      if (s === null || typeof s !== 'object') continue;
+      const r = s as Record<string, unknown>;
+      if (norm(r.name) === me || (str(r.abbr) !== '' && norm(r.abbr) === me)) return { name: norm(r.name) || me, abbr: str(r.abbr) };
+    }
   }
-  return '';
+  return { name: me, abbr: '' };
 };
 
 /** 変更履歴を1件積む（frontend common/leadUtiles.ts の logChange と同じ形） */
@@ -168,7 +175,7 @@ export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<stri
     );
     const no = Number(max?.m ?? 0) + 1;
     const ledgerId = uid();
-    const abbr = await abbrOf(tx, form.staff);
+    const st = await staffOf(tx, form.staff);
     const by = await resolveMe(tx, staff);
     const note = form.otherBrokers && form.baikaiType === '一般媒介'
       ? `${form.note}${form.note ? '／' : ''}他の依頼先：${form.otherBrokers}`
@@ -207,7 +214,7 @@ export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<stri
           currentStatus, addr1, addr2, price, freq, lastReportDate, reinsDate, priceRevDate, propStatus, keyStatus, keyInfo,
           note, createdAt, propertyId, show_dashboard)
        VALUES ('ledger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '情報整理中', ?, ?, ?, ?, NULL, NULL, NULL, 'アクティブ', NULL, NULL, ?, ?, ?, 1)`,
-      [ledgerId, no, abbr || null, abbr || null, str(lead.source) || null, form.baikaiDate, form.baikaiType, form.expiry,
+      [ledgerId, no, st.name || null, st.abbr || null, str(lead.source) || null, form.baikaiDate, form.baikaiType, form.expiry,
         form.seller, form.contact || null, form.category, form.addr1 || null, form.addr2, form.price, form.freq || null,
         note || null, now.date, propertyId]
     );
diff --git a/frontend/src/components/database/PropertyRegister.tsx b/frontend/src/components/database/PropertyRegister.tsx
index abfac9de0..5cf226abc 100644
--- a/frontend/src/components/database/PropertyRegister.tsx
+++ b/frontend/src/components/database/PropertyRegister.tsx
@@ -82,6 +82,13 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
     const [searchPropertyQuery, setSearchPropertyQuery] = useState('');
     const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
 
+    /** 担当営業の選択肢（v2.2.252）。値は空白なしの氏名、表示はスタッフ表の名前。今の値が無ければ足す */
+    const staffOptions = useMemo(() => {
+        const opts = staffList.map(s => ({ value: removeAllSpaces(s), label: s }));
+        const cur = editData.staff || '';
+        return cur && !opts.some(o => o.value === cur) ? [...opts, { value: cur, label: cur }] : opts;
+    }, [staffList, editData.staff]);
+
     useEffect(() => {
         if (!targetPropertyId) return;
         const fetchData = async () => {
@@ -322,9 +329,14 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                         </div>
                         <div className="col-md-4">
                             <label style={styles.label}>担当営業</label>
+                            {/*
+                              ⚠️ v2.2.252: 値は空白なしの氏名（反響・商談・媒介紐付と同じ）。スタッフ表の名前は「時任 聡一朗」のように空白入りで、
+                                以前はそのまま保存して台帳の担当が「時任」「時任聡一朗」「時任 聡一朗」と混ざっていた。
+                                今の値が選択肢に無い（略称・退職者など）ときも、その値を出す（触っただけで消えないように）
+                            */}
                             <select style={styles.input} value={editData.staff || ''} onChange={e => handleInputChange('staff', e.target.value)}>
                                 <option value="">選択してください</option>
-                                {staffList.map(staff => <option key={staff} value={staff}>{staff}</option>)}
+                                {staffOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                             </select>
                         </div>
 
diff --git a/frontend/src/components/realty/bmonthly/BaikaiMonthly.tsx b/frontend/src/components/realty/bmonthly/BaikaiMonthly.tsx
index 3e984784f..d2a72ce33 100644
--- a/frontend/src/components/realty/bmonthly/BaikaiMonthly.tsx
+++ b/frontend/src/components/realty/bmonthly/BaikaiMonthly.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import { REALTY_CSS, loadRecords } from '../common/realtyState';
-import { fiscalMonths, fmtYen, monthLabel, pct, sumRow, todayStr } from '../summary/kpi';
+import { findStaff, fiscalMonths, fmtYen, monthLabel, pct, staffNameOf, sumRow, todayStr } from '../summary/kpi';
 import type { Row, Settings } from '../summary/kpi';
 
 /**
@@ -207,8 +207,8 @@ const BaikaiMonthly: React.FC = () => {
         const staff = (settings.staff ?? []).filter(s => s.name);
         const baikaiTypes = settings.baikaiTypes ?? [];
         const sources = settings.sources ?? [];
-        /** 略称 → 名前（abbrToName） */
-        const abbrToName = (ab: string) => (settings.staff ?? []).find(x => x.abbr === ab)?.name ?? ab;
+        /** 略称 → 名前（abbrToName）。⚠️ v2.2.252: 台帳の担当は氏名にそろえた。略称・空白入りの氏名でも同じ人にする */
+        const abbrToName = (ab: string) => staffNameOf(settings.staff, ab);
         const byStaff = ledgerCountBy(ledger, l => abbrToName(str(l.staff)) || '（担当未設定）');
         const byType = ledgerCountBy(ledger, l => (baikaiTypes.includes(str(l.baikaiType)) ? str(l.baikaiType) : '未分類'));
         const bySrc = ledgerCountBy(ledger, l => (sources.includes(str(l.source)) ? str(l.source) : '未分類'));
@@ -223,7 +223,7 @@ const BaikaiMonthly: React.FC = () => {
         const teamRow = mks.map(mk => staff.reduce((a, s) => a + (byStaff[String(s.name)]?.[mk] ?? 0), 0));
         const teamTot = teamRow.reduce((a, b) => a + b, 0);
         const teamTgt = staff.reduce((a, s) => a + (Number(s.baikaiTarget) || 0), 0);
-        const unset = ledger.filter(l => str(l.contractDate) && mks.includes(str(l.contractDate).slice(0, 7)) && !(settings.staff ?? []).some(s => s.abbr === str(l.staff))).length;
+        const unset = ledger.filter(l => str(l.contractDate) && mks.includes(str(l.contractDate).slice(0, 7)) && !findStaff(settings.staff, str(l.staff))).length;
         return { mks, staff, baikaiTypes, sources, abbrToName, byStaff, byType, bySrc, byStaffKaitori, dealKaitori, teamRow, teamTot, teamTgt, unset };
     }, [ledger, deals, settings]);
 
@@ -378,7 +378,7 @@ const BaikaiMonthly: React.FC = () => {
                     </tr>
                 </tbody></table></div>
                 <div className="rlt-body small" style={{ paddingTop: 8 }}>
-                    {unset ? `⚠ 期間内で担当略称が設定と一致しない件数：${unset}件（担当未設定・枠外担当）。設定の略称を見直してください。` : '✅ 期間内の全件が設定済み担当に紐づいています。'}
+                    {unset ? `⚠ 期間内で担当が設定の担当者（名前・略称）と一致しない件数：${unset}件（担当未設定・枠外担当）。台帳の担当か、設定の担当者を見直してください。` : '✅ 期間内の全件が設定済み担当に紐づいています。'}
                 </div>
             </div>
 
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index 7b5c9f173..c8077e4c8 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -544,10 +544,11 @@ const LeadBuy = () => {
                         <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                             <tr>
                                 <th style={compactThStyle}>受信日</th>
-                                <th style={compactThStyle}>ポータル</th>
+                                {/* ⚠️ v2.2.252: 選択欄の列は最小幅を付ける（幅100%の選択欄は、表の幅の決まり方しだいで縮んで読めなくなっていた） */}
+                                <th style={{ ...compactThStyle, minWidth: '110px' }}>ポータル</th>
                                 <th style={compactThStyle}>顧客名</th>
-                                <th style={compactThStyle}>担当</th>
-                                <th style={compactThStyle}>フェーズ</th>
+                                <th style={{ ...compactThStyle, minWidth: '110px' }}>担当</th>
+                                <th style={{ ...compactThStyle, minWidth: '110px' }}>フェーズ</th>
                                 <th style={compactThStyle}>架電</th>
                                 <th style={compactThStyle}>架電メモ</th>
                                 <th style={compactThStyle}>最終アクション</th>
diff --git a/frontend/src/components/realty/common/BuyOfferModal.tsx b/frontend/src/components/realty/common/BuyOfferModal.tsx
index a4396a474..e28b8d978 100644
--- a/frontend/src/components/realty/common/BuyOfferModal.tsx
+++ b/frontend/src/components/realty/common/BuyOfferModal.tsx
@@ -4,7 +4,7 @@ import { loadRecords } from './realtyState';
 import { safeParse } from './leadUtiles';
 import { BUYER_ATTRS, guessProperty, isOwnStock, registerBuyOffer, unlinkBuyOffer } from './leadLinks';
 import type { BuyOfferInput, CoBroker } from './leadLinks';
-import { fmtYen, stdFee } from '../summary/kpi';
+import { findStaff, fmtYen, stdFee } from '../summary/kpi';
 import type { Row, StaffSetting } from '../summary/kpi';
 
 /**
@@ -53,12 +53,12 @@ const BuyOfferModal = ({ ledger, staffSettings, userName, onClose, onSaved }: Pr
     useEffect(() => {
         if (!ledger) return;
         const cb = coBrokerOf(ledger.coBroker) ?? {};
-        const abbr = str(ledger.staff);
         setForm({
             kind: 'out', company: str(cb.company), person: str(cb.person), contact: str(cb.contact),
             price: Number(cb.price) || Number(ledger.price) || 0, contractDate: str(cb.contractDate), deliveryDate: str(cb.deliveryDate),
             buyerName: str(cb.buyerName), buyerAttr: str(cb.buyerAttr) || BUYER_ATTRS[0], property: guessProperty(ledger),
-            staff: staffSettings.find(s => s.abbr === abbr)?.name ?? '', noFee: isOwnStock(ledger), note: str(cb.note),
+            // ⚠️ v2.2.252: 台帳の担当は氏名にそろえた。以前のアプリから来た略称でも同じ人にする（findStaff）
+            staff: findStaff(staffSettings, str(ledger.staff))?.name ?? '', noFee: isOwnStock(ledger), note: str(cb.note),
         });
         setLeadId(''); setLeadQ(''); setShowLost(false);
         setLoading(true);
diff --git a/frontend/src/components/realty/common/leadLinks.ts b/frontend/src/components/realty/common/leadLinks.ts
index b2eb661df..f1cc395f7 100644
--- a/frontend/src/components/realty/common/leadLinks.ts
+++ b/frontend/src/components/realty/common/leadLinks.ts
@@ -15,7 +15,8 @@ import { logChange, newRecordId, saveBrokerageRecord } from './leadUtiles';
  *
  * ⚠️ No. は「その種類の最大 + 1」（以前のアプリと同じ）。⚠️ 作る直前に読み直して数える（画面を開いた後に増えた分を拾う）。
  * ⚠️ 二重連携は呼び出し側で防ぐ（ledgerNo / dealId が入っていれば呼ばない）。
- * ⚠️ 媒介台帳の担当は略称（設定の staff.abbr）、反響の担当は氏名。以前のアプリと同じく読み替える。
+ * ⚠️ 担当は氏名（設定の staff.name）。⚠️ v2.2.252 から媒介台帳も氏名（以前は略称 staff.abbr で、以前のアプリから来た台帳は略称のまま）。
+ *   台帳の担当を読むときは summary/kpi.ts の findStaff・staffNameOf で、氏名・略称のどちらでも同じ人にする。
  * ─────────────────────────────────────────────
  */
 
@@ -62,7 +63,7 @@ export const maxExpiryOf = (contractDate: string): string => {
 
 /**
  * 売り反響 → 媒介獲得台帳の「媒介紐付」の画面（common/LedgerLinkModal.tsx）で確かめる値。
- * staff は氏名（台帳には略称で入る）。otherBrokers は一般媒介の他の依頼先（任意。台帳の備考に書き足す）
+ * staff は氏名（v2.2.252 から台帳にも氏名で入る）。otherBrokers は一般媒介の他の依頼先（任意。台帳の備考に書き足す）
  */
 export type LedgerForm = {
     baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
diff --git a/frontend/src/components/realty/deals/LeadOpportunity.tsx b/frontend/src/components/realty/deals/LeadOpportunity.tsx
index 5f4853f35..6dd0530ab 100644
--- a/frontend/src/components/realty/deals/LeadOpportunity.tsx
+++ b/frontend/src/components/realty/deals/LeadOpportunity.tsx
@@ -2,7 +2,7 @@ import React, { useCallback, useContext, useEffect, useMemo, useState } from 're
 import Modal from 'react-bootstrap/Modal';
 import AuthContext from '../../../context/AuthContext';
 import DocumentViewer from '../documents/DocumentViewer';
-import PlannerGenerator, { PlannerInputState } from '../documents/PlannerGenerator';
+import PlannerGenerator, { PlannerInputState, brokerageBase } from '../documents/PlannerGenerator';
 import LeadNotifications from '../common/LeadNotifications';
 import {
     saveBrokerageRecord, recordFieldChanges, softDeleteRecord,
@@ -236,16 +236,22 @@ const LeadOpportunity = () => {
         setDocumentShow(true);
     };
 
-    /** 以前のアプリの fromDeal(d) → SETL.open(dealId) */
+    /**
+     * 以前のアプリの fromDeal(d) → SETL.open(dealId)。⚠️ 入れない項目は精算書の初期値（空欄）のまま
+     * ⚠️ v2.2.252: 種別で請求先を分け（「買」は買主側・それ以外は売主側）、案件の仲介手数料に合うよう値引き欄で調整する（以前のアプリと同じ）
+     */
     const openPlanner = (d: Row) => {
-        const data: Partial<PlannerInputState> = {};
-        if (str(d.property)) data.propName = str(d.property);
-        if (num(d.price)) data.price = num(d.price);
+        const isBuy = str(d.type) === '買';
+        const price = num(d.price);
+        const disc = Math.max(0, brokerageBase(price, false).net - dealFee(d));
+        const data: Partial<PlannerInputState> = {
+            propName: str(d.property), price,
+            ...(isBuy
+                ? { buyer: str(d.customer), mode: 'buyer', billTo: 'buyer', bDisc: disc }
+                : { seller: str(d.customer), mode: 'seller', billTo: 'seller', sDisc: disc }),
+        };
         if (day(d.contractDate)) data.contractDate = day(d.contractDate);
-        if (day(d.settleDate)) data.delivery = day(d.settleDate);
-        if (str(d.customer)) {
-            if (str(d.type) === '買') data.buyer = str(d.customer); else data.seller = str(d.customer);
-        }
+        if (day(d.settleDate)) { data.delivery = day(d.settleDate); data.invDue = day(d.settleDate); }
         setPlannerData(data);
         setPlannerShow(true);
     };
@@ -394,7 +400,8 @@ const LeadOpportunity = () => {
                             <table className="table table-sm table-hover align-middle mb-0 text-nowrap" style={{ fontSize: '11px' }}>
                                 <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                     <tr>
-                                        <th style={th}>No.</th><th style={th}>物件名</th><th style={th} className="text-center">種別</th>
+                                        {/* ⚠️ v2.2.252: 「編集」は左端に置く（表は最小幅1500px。右端だと、狭い画面では横に動かさないと見えなかった） */}
+                                        <th style={th}></th><th style={th}>No.</th><th style={th}>物件名</th><th style={th} className="text-center">種別</th>
                                         <th style={th} className="text-end">成約価格(円)</th><th style={th} className="text-end">仲介手数料(円)</th>
                                         {showReform && <><th style={th} className="text-end">リフォーム受注額</th><th style={th} className="text-end">リフォーム粗利</th><th style={th} className="text-end">粗利率</th></>}
                                         <th style={th}>担当者</th><th style={th}>顧客名</th><th style={th}>進捗フェーズ</th>
@@ -404,7 +411,7 @@ const LeadOpportunity = () => {
                                 </thead>
                                 <tbody>
                                     {list.length === 0 && (
-                                        <tr><td colSpan={showReform ? 16 : 13} className="text-center text-muted py-5">該当する案件がありません</td></tr>
+                                        <tr><td colSpan={showReform ? 17 : 14} className="text-center text-muted py-5">該当する案件がありません</td></tr>
                                     )}
                                     {list.map(d => {
                                         const id = str(d.id);
@@ -415,8 +422,16 @@ const LeadOpportunity = () => {
                                         const phase = str(d.phase);
                                         return (
                                             <tr key={id}>
+                                                <td>
+                                                    <button className="btn btn-outline-primary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openEdit(d)}>編集</button>
+                                                </td>
                                                 <td className="text-muted">{str(d.no)}</td>
-                                                <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>{str(d.property)}</td>
+                                                <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>
+                                                    {/* ⚠️ v2.2.252: 物件名を押しても編集画面を開く */}
+                                                    <span role="button" className="text-primary" style={{ textDecoration: 'underline dotted' }} title="編集画面を開く" onClick={() => openEdit(d)}>
+                                                        {str(d.property) || '（物件名なし）'}
+                                                    </span>
+                                                </td>
                                                 <td className="text-center">{str(d.type)}</td>
                                                 <td className="text-end">{numInput(d, 'price')}</td>
                                                 <td className={`text-end ${num(d.feeManual) ? 'bg-warning bg-opacity-25' : ''}`}>
@@ -457,7 +472,6 @@ const LeadOpportunity = () => {
                                                     <div className="d-flex gap-1">
                                                         <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openDocument(d)} title="媒介契約書・事前説明書を作成">契約書</button>
                                                         <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openPlanner(d)} title="決済精算書・請求書・領収証を作成">精算書</button>
-                                                        <button className="btn btn-outline-primary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openEdit(d)}>編集</button>
                                                     </div>
                                                 </td>
                                             </tr>
diff --git a/frontend/src/components/realty/documents/PlannerGenerator.tsx b/frontend/src/components/realty/documents/PlannerGenerator.tsx
index a60204364..9ff224312 100644
--- a/frontend/src/components/realty/documents/PlannerGenerator.tsx
+++ b/frontend/src/components/realty/documents/PlannerGenerator.tsx
@@ -111,7 +111,7 @@ const transferFee = (rel: string, ch: string, amt: number) => {
     return rows[rows.length - 1][1];
 };
 
-const brokerageBase = (price: number, low: boolean) => {
+export const brokerageBase = (price: number, low: boolean) => {
     let net = 0, formula = '';
     if (price > 4000000) {
         net = price * 0.03 + 60000;
@@ -197,6 +197,35 @@ const s = {
     infoBox: { background: '#e8eef7', borderLeft: '3px solid #1b3a6b', padding: '8px 11px', fontSize: '11.5px', color: '#1b3a6b', marginTop: '8px', lineHeight: 1.6, borderRadius: '0 3px 3px 0' } as React.CSSProperties,
 };
 
+const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
+
+/**
+ * 精算書の初期値（以前のアプリの defaultData と同じ）。案件ごとの値は空欄、日付は今日と月末。
+ * ⚠️ v2.2.252: 以前は見本のデータ（売主「田原 嘉昭」・固都税など）が初期値で、案件に無い項目に見本が残っていた。
+ *   精算書を開くたびに、この値から作り直す
+ */
+const plannerDefaults = (): PlannerInputState => {
+    const now = new Date();
+    const today = ymd(now);
+    const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
+    return {
+        propName: '', propZip: '', propAddr: '',
+        seller: '', sellerZip: '', sellerAddr: '',
+        buyer: '', contractDate: today, delivery: monthEnd,
+        place: '', placeAddr: '', startTime: '10:00',
+        price: 0, deposit: 0, interim: 0,
+        taxBase: '01-01', taxDay: 'buyer', t1: 0, t2: 0, t3: 0, t4: 0,
+        mode: 'both', lowPrice: '0', sDisc: 0, sPaid: 0, bDisc: 0, bPaid: 0,
+        loanPrin: 0, loanInt: 0, loanFee: 0, sJudi: 27900, sStamp: 0,
+        rel: 'other_bank', ch: 'counter', tfCount: 0,
+        bJudi: 237600, bArr: 550000, bGuar: 266600, bIns: 60600, bStamp: 0, bLoan: 0,
+        billTo: 'both', invNoS: '', invNoB: '', invDate: today, invDue: monthEnd, invReg: 'T', payAcct: 'brokerage',
+        rcOn: '1', rcTarget: 'both', rcCustom: 0, rcSign: 'blank', rcStamp: 'free',
+        sellerTaxable: '0', sellerInvReg: '', sellerVat: 0,
+        sBank: '', sBranch: '', sAcctType: '普通', sAcctNo: '', sAcctName: '', sAcctKana: ''
+    };
+};
+
 // ==========================================
 // 💡 4. メインコンポーネント
 // ==========================================
@@ -206,35 +235,20 @@ export const PlannerGenerator = ({ plannerShow, setPlannerShow, initialData }: {
     // 💡 追加: 呼び出し元の案件データで初期値を上書きする（未指定ならサンプルデータのまま）
     initialData?: Partial<PlannerInputState>
 }) => {
-    const today = new Date().toISOString().slice(0, 10);
-
-    const [form, setForm] = useState<PlannerInputState>({
-        propName: '鹿児島市上福元町5866番6 土地建物', propZip: '', propAddr: '鹿児島市上福元町5866番6',
-        seller: '田原 嘉昭', sellerZip: '', sellerAddr: '',
-        buyer: '中元 昭司', contractDate: today, delivery: today,
-        place: '鹿児島銀行 谷山支店', placeAddr: '鹿児島市谷山中央二丁目4番3号', startTime: '10:00',
-        price: 32800000, deposit: 1000000, interim: 0,
-        taxBase: '01-01', taxDay: 'buyer', t1: 14487, t2: 6209, t3: 92740, t4: 19873,
-        mode: 'both', lowPrice: '0', sDisc: 0, sPaid: 0, bDisc: 0, bPaid: 0,
-        loanPrin: 0, loanInt: 0, loanFee: 0, sJudi: 27900, sStamp: 0,
-        rel: 'other_bank', ch: 'counter', tfCount: 1,
-        bJudi: 237600, bArr: 550000, bGuar: 266600, bIns: 60600, bStamp: 0, bLoan: 25000000,
-        billTo: 'both', invNoS: 'KHF-2026-0087-S', invNoB: 'KHF-2026-0087-B', invDate: today, invDue: today, invReg: 'T', payAcct: 'brokerage',
-        rcOn: '1', rcTarget: 'both', rcCustom: 0, rcSign: 'blank', rcStamp: 'free',
-        sellerTaxable: '0', sellerInvReg: '', sellerVat: 0,
-        sBank: '', sBranch: '', sAcctType: '普通', sAcctNo: '', sAcctName: '', sAcctKana: ''
-    });
+    const [form, setForm] = useState<PlannerInputState>(plannerDefaults);
 
     const [stampAuto, setStampAuto] = useState({ s: true, b: true });
     const [extras, setExtras] = useState<ExtraState>({ s: [], b: [] });
 
     const [previewOpen, setPreviewOpen] = useState(false);
 
-    // 💡 追加: モーダルを開くたびに呼び出し元の案件データを反映する（source.html の SETL.open(dealId) 相当）
+    // 💡 モーダルを開くたびに、初期値から作り直して案件のデータを入れる（以前のアプリの SETL.open → apply(fromDeal(d))）
+    // ⚠️ v2.2.252: 前の値に重ねていたため、見本のデータや、直前に開いた案件の値が残っていた
     useEffect(() => {
-        if (plannerShow && initialData) {
-            setForm(prev => ({ ...prev, ...initialData }));
-        }
+        if (!plannerShow) return;
+        setForm({ ...plannerDefaults(), ...(initialData ?? {}) });
+        setStampAuto({ s: true, b: true });
+        setExtras({ s: [], b: [] });
         // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [plannerShow]);
 
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index c553a7a9f..ab673f58b 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -627,10 +627,11 @@ const LeadSell = () => {
             <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
               <tr>
                 <th style={compactThStyle}>受信日</th>
-                <th style={compactThStyle}>反響元</th>
+                {/* ⚠️ v2.2.252: 選択欄の列は最小幅を付ける（幅100%の選択欄は、表の幅の決まり方しだいで縮んで読めなくなっていた） */}
+                <th style={{ ...compactThStyle, minWidth: '100px' }}>反響元</th>
                 <th style={compactThStyle}>売主候補</th>
-                <th style={compactThStyle}>担当</th>
-                <th style={compactThStyle}>フェーズ</th>
+                <th style={{ ...compactThStyle, minWidth: '110px' }}>担当</th>
+                <th style={{ ...compactThStyle, minWidth: '110px' }}>フェーズ</th>
                 <th style={compactThStyle}>架電</th>
                 <th style={compactThStyle}>架電メモ</th>
                 <th style={compactThStyle}>最終アクション</th>
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index 306495eaf..fc133649d 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -11,7 +11,7 @@ import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../commo
 import {
     ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
     emptyCallCell, feeByStaffMonth, fiscalMonths, fmtCnt, fmtYen, fmtYen0, inWindow, ledgerCountByStaffMonth,
-    monthLabel, pct, reformByStaffMonth, reformGpByStaffMonth, salesByStaffMonth, sumRow, todayStr,
+    monthLabel, pct, reformByStaffMonth, reformGpByStaffMonth, salesByStaffMonth, staffNameOf, sumRow, todayStr,
 } from './kpi';
 import type { Row, Settings } from './kpi';
 // ⚠️ v2.2.225: 以前のダッシュボードと同じ並び（営業司令塔は最下段）・買取再販の期限アラート
@@ -371,8 +371,8 @@ const Summary = () => {
         const rfAll = reformByStaffMonth(deals);
         const rgAll = reformGpByStaffMonth(deals);
         const cntAll = dealCountByStaffMonth(deals);
-        // ⚠️ 媒介台帳の担当は略称で入っている
-        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
+        // ⚠️ 媒介台帳の担当は氏名（v2.2.252〜）か略称（以前のアプリから来たもの）
+        const abbrToName = (ab: string) => staffNameOf(staffSettings, ab);
         const bCnt = ledgerCountByStaffMonth(ledger, abbrToName);
 
         const totalBudget = staffSettings.reduce((a, st) => a + (Number(st.budget) || 0), 0);
@@ -443,7 +443,7 @@ const Summary = () => {
     const alerts = useMemo(() => {
         const w = alertWindow();
         const staffSettings = settings.staff ?? [];
-        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
+        const abbrToName = (ab: string) => staffNameOf(staffSettings, ab);
         const newDeals = deals.filter(d => inWindow(dealRegDate(d), w))
             .sort((a, b) => dealRegDate(b).localeCompare(dealRegDate(a)));
         const newLedger = ledger.filter(l => inWindow(String(l.contractDate ?? ''), w))
diff --git a/frontend/src/components/realty/summary/kpi.ts b/frontend/src/components/realty/summary/kpi.ts
index 0547bcfe6..de6645cb8 100644
--- a/frontend/src/components/realty/summary/kpi.ts
+++ b/frontend/src/components/realty/summary/kpi.ts
@@ -216,7 +216,20 @@ export const dealCountByStaffMonth = (deals: Row[]): StaffMonth => {
     return out;
 };
 
-/** 媒介獲得数（ledgerCountBy。契約日の月で数える）。⚠️ 台帳の担当は略称なので名前に直す */
+/**
+ * 設定の担当者を、氏名か略称で探す（findStaff。v2.2.252）。空白は除いて比べる
+ * ⚠️ 台帳の担当は v2.2.252 から氏名（以前のアプリから来たものは略称）。どちらでも同じ人になるようにする
+ */
+export const findStaff = (list: StaffSetting[] | undefined, v: string): StaffSetting | undefined => {
+    const k = v.replace(/[\s　]/g, '');
+    if (!k) return undefined;
+    return (list ?? []).find(s => str(s.name).replace(/[\s　]/g, '') === k || (!!s.abbr && s.abbr === k));
+};
+
+/** 台帳の担当（氏名か略称）→ 設定の氏名（abbrToName）。設定に居なければその値のまま */
+export const staffNameOf = (list: StaffSetting[] | undefined, v: string): string => findStaff(list, v)?.name ?? v;
+
+/** 媒介獲得数（ledgerCountBy。契約日の月で数える）。⚠️ 台帳の担当は氏名か略称なので、設定の氏名に直す */
 export const ledgerCountByStaffMonth = (ledger: Row[], abbrToName: (ab: string) => string): StaffMonth => {
     const out: StaffMonth = {};
     for (const l of ledger) {
```
