export const baseStyle = { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '150px', paddingLeft: '10px', color: '#303030' };
export const labelStyle = { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' };
export const buttonStyle = {
    color: '#495057',                  // 入力欄の文字色(#303030)より少しだけ柔らかい色に
    backgroundColor: '#f8f9fa',        // 真っ白ではなく、ごく薄いグレーにして入力欄と区別
    border: '1px solid #d2d6da',       // 枠線も少しだけトーンを変える
    borderRadius: '6px',               // 入力欄(4px)より少しだけ丸くする
    padding: '0 16px',                 // 左右の余白を少し広めに
    fontSize: '11px',
    fontWeight: '600',                 // ほんの少し太字にしてボタンらしさを強調
    letterSpacing: '0.6px',
    marginBottom: '4px',
    cursor: 'pointer',
    height: '35px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', // 影をほんの少しだけ濃くして立体感を出す
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',          // 文字を左右中央に
    width: 'fit-content'
};
export const valueStyle = { fontSize: '12px', letterSpacing: '.6px', verticalAlign: 'middle' };
export const inputStyle = { ...baseStyle, margin: '5px', color: '#303030' };
export const selectStyle = { ...baseStyle };
export const requiredStyle = { border: '1px solid #f87171b4', borderRadius: '4px', color: '#f87171', padding: '3px 5px', marginLeft: '5px', fontSize: '7px' };
export const actionButton = { backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' };
export const safeFormate = (value: string) => {
    return value ?? '';
};
export const toHalfWidth = (str: string) => {
    return str.replace(/[！-～]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    ).replace(/　/g, ' ');
};
export const expandButton = {
    ...buttonStyle,
    height: '28px',
    padding: '2px 10px'
};
export const competitorsStyle = {
    border: 'transparent',
    minWidth: '60px',
    maxWidth: '100%',
    flex: '1',
    outline: 'none',
    boxShadow: 'none'
};

export const dateFormate = (value: string) => {
    return value ? value.replace(/\//g, '-') : '';
};

export const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return "";

    const today = new Date();
    const birthDate = new Date(birthDateString);

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

export const safeParse = (data: any) => {
    if (typeof data !== 'string' || data.trim() === '') return data ?? [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSONの解析に失敗しました。不正なデータです:", data);
        return [];
    }
};

/**
 * 失注先が分からないときに入れる値。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **空文字や `null` にしないための値である。**
 *   ⚠️ 失注先が空のままだと「要回答」に数えられ続け、
 *     ⚠️ **答えようがないのに件数が減らない**。
 *
 * ⚠️ 判定は `!competitor_name || competitor_name === 'null'` なので
 *   ⚠️ **空文字と 'null' 以外なら何でも外れる**が、
 *     ⚠️ 既存データに `不明` が62件あるので**それに揃える**。
 *     ⚠️ 表記を増やすと集計で分かれてしまう。
 *
 * ⚠️ 同じ判定が次の3か所にある。**片方だけ直さないこと。**
 *     frontend/src/components/database/DatabaseOrder.tsx
 *     frontend/src/components/LostStatusList.tsx
 *     backend-express/src/features/menu.ts
 * ─────────────────────────────────────────────
 */
export const UNKNOWN_COMPETITOR = '不明';

/**
 * 勝因・敗因の入力欄（TableStatus.tsx）で使う列。
 *
 * ⚠️⚠️ **列は master_data にしか無い**（2026-09-17 の SQL）。
 *   ⚠️ 入力欄も `category === 'order'` のときだけ出すこと。
 *     ⚠️ 建売・中古から送ると `Unknown column` で**保存がまるごと失敗する**
 *       （列の許可リストは3テーブル共通のため）。
 *
 * ⚠️ 「敗因」は**新しい列ではない。** 既存の
 *   `customized_input_01JSE7H4MQES619NBWX6PQDFRH` をそのまま使う（指示）。
 *   ⚠️ ラベルが変わるだけなので過去の入力も活きる。
 * ⚠️ 「競合を選択」も既存の `competitor_name`（失注先と同じ列）。
 */
export const LOSE_REASON_KEY = 'customized_input_01JSE7H4MQES619NBWX6PQDFRH';
export const WIN_REASON_KEY = 'competitor_win_reason';
export const PRICE_GAP_KEY = 'competitor_price_gap';
export const SALES_PERSON_KEY = 'competitor_sales_person';
export const COUNTERMEASURE_KEY = 'competitor_countermeasure';
export const RIVAL_CAMPAIGN_KEY = 'competitor_campaign';

/** 詳細な他決・失注理由（複数選択）の列 */
export const LOST_DETAIL_KEY = 'customized_input_01JRF9CZSW65A151WR30NA4PB3';

/** 失注理由の列 */
export const LOST_REASON_KEY = 'competitor_lost_contract_reason';

/** 競合他社（失注先）の列。⚠️ 契約済みの「競合を選択」も同じ列 */
export const COMPETITOR_KEY = 'competitor_name';

/**
 * 失注理由の選択肢。
 *
 * ⚠️⚠️ **入力側（TableStatus.tsx）と絞り込み側（LostStatusList.tsx）で共有する。**
 *   ⚠️ 以前は別々に書かれており、絞り込み側だけ **`音信普通`** という
 *     ⚠️ **誤字**になっていた（正しくは `音信不通`。実データ117件）。
 *   ⚠️ そのため**「音信普通」で絞ると必ず0件**だった（2026-09-17 に解消）。
 *
 * ⚠️ 並びは入力側に合わせてある。⚠️ **値を変えると既存データと突き合わなくなる。**
 */
export const LOST_REASON_OPTIONS = [
    '競合負け', '計画中止', '身内の反対', '音信不通', '建築エリア外', 'その他',
] as const;

/** ⚠️ 競合の情報を尋ねる失注理由。⚠️ これ以外では失注先も敗因も聞かない */
export const LOST_TO_COMPETITOR = '競合負け';

/**
 * 失注（競合負け）で埋めてほしい項目。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここが唯一の定義である。**
 *   ⚠️ 「未入力箇所の一覧」（`missingLostFields`）と
 *     「保存時の必須」（`statusRequiredError`）の**両方をここから作る**。
 *   ⚠️ 項目を足すときは**この配列に1行足すだけ**にすること。
 *
 * ⚠️⚠️ **`blocksSave` が2種類あるのは意図的である。**
 *   ⚠️ `true`  … 未入力だと**保存を止める**（2026-09-17 の指示で必須になったもの）
 *   ⚠️ `false` … 一覧には出すが**保存は止めない**
 *     ⚠️ 失注先・他決理由は指示で「これまで同様」だったため、
 *       ⚠️ **急に保存できなくすると既存の運用が止まる。**
 *
 * ⚠️ `label` は**画面にそのまま出る**。
 *   ⚠️ 一覧では「〇〇未入力」、保存時は「必須項目が未入力です:〇〇」になる。
 *   ⚠️ ⚠️ **TableStatus.tsx の入力欄の見出しもこの label を使う。**
 *     ⚠️ ここだけ変えると、一覧・警告・入力欄で名前が食い違う。
 * ─────────────────────────────────────────────
 */
export type LostField = { key: string; blocksSave: boolean };

/**
 * 項目キー → 画面に出す名前。
 *
 * ⚠️⚠️ **入力欄の見出し・一覧の「〇〇未入力」・保存時の警告が、すべてここを見る。**
 *   ⚠️ 名前を変えるときは**ここだけ**直すこと。
 * ⚠️ `competitor_name` は契約済みの画面では「競合」と出すが、
 *   ⚠️ **一覧では常に「失注先」**なのでこちらを正とする
 *   （契約済みの見出しは `competitorPicker('競合')` で個別に渡している）。
 */
export const FIELD_LABEL: Record<string, string> = {
    [COMPETITOR_KEY]: '失注先',
    [LOST_DETAIL_KEY]: '他決理由',
    [LOSE_REASON_KEY]: '敗因',
    [WIN_REASON_KEY]: '勝因',
    [PRICE_GAP_KEY]: '価格差',
    [SALES_PERSON_KEY]: '他社営業',
    [COUNTERMEASURE_KEY]: '今後の対策',
    [RIVAL_CAMPAIGN_KEY]: '他社のキャンペーン',
};

/** ⚠️ 項目キーから画面の名前を引く。⚠️ 見つからなければキーをそのまま返す */
export const lostFieldLabel = (key: string): string => FIELD_LABEL[key] ?? key;

/**
 * 価格差の単位。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **入力値はそのまま保存する。単位の換算はしていない。**
 *   ⚠️ `competitor_price_gap` は TEXT で、⚠️ **画面に打った数字がそのまま入る。**
 *   ⚠️ そのため ⚠️ **この表示だけが「何の単位か」を決めている。**
 *
 * ⚠️⚠️ **ここを変えると、既に入力済みのデータの意味まで変わる。**
 *   ⚠️ 例）`500` は「500万円」から「500円」になってしまう。
 *   ⚠️ 変えるときは**既存データの換算を必ず併せて考えること。**
 *
 * ⚠️ 契約済み側と失注側の**両方**がこれを使う（同じ列に入るため）。
 * ⚠️ ⚠️ **プレースホルダには書かない。** 入力すると消えて分からなくなる。
 * ─────────────────────────────────────────────
 */
export const PRICE_GAP_UNIT = '万円';

/**
 * ⚠️⚠️ **一覧の「未入力箇所」に出す項目。並び順もこのとおりに出る。**
 *   ⚠️ **任意の項目（他社営業・他社のキャンペーン）は入れないこと。**
 *     ⚠️ 入れると**埋めようのない項目で要回答が減らなくなる。**
 */
export const LOST_FIELDS: LostField[] = [
    { key: COMPETITOR_KEY, blocksSave: false },
    { key: LOST_DETAIL_KEY, blocksSave: false },
    { key: LOSE_REASON_KEY, blocksSave: true },
    { key: PRICE_GAP_KEY, blocksSave: true },
    { key: COUNTERMEASURE_KEY, blocksSave: true },
];

/** ⚠️ 契約済みで埋めてほしい項目。⚠️ 勝因だけが必須（2026-09-17 の指示） */
export const WIN_FIELDS: LostField[] = [
    { key: WIN_REASON_KEY, blocksSave: true },
];

/**
 * 未入力とみなす値。
 *
 * ⚠️⚠️ **文字列の `'null'` も未入力である。**
 *   ⚠️ 一覧系の SQL は `COALESCE(..., '')` を通すが、
 *     ⚠️ **DB に文字列として `null` が入っている行が実在する。**
 *   ⚠️ `!value` だけでは拾えない。
 * ⚠️ 空白だけの入力も未入力として扱う。
 */
export const isBlank = (value: unknown): boolean => {
    const text = String(value ?? '').trim();
    return text === '' || text === 'null';
};

/**
 * 失注の「未入力箇所」。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **失注の要回答判定は、以前この5か所に写されていた。**
 *     frontend/src/components/Menu.tsx（② が数えなかったときの予備）
 *     frontend/src/components/database/DatabaseOrder.tsx（loseLength）
 *     frontend/src/components/LostStatusList.tsx（一覧の絞り込み・表示で計3回）
 *   ⚠️ **2026-09-17 にここへ集約した。** ⚠️ 判定を足すときはここだけ直す。
 *
 * ⚠️⚠️ **② の menu.ts / ① の menu.php にも同じ判定が SQL である。**
 *   ⚠️ 言語が違うので共有できない。⚠️ **3つとも直すこと。**
 *
 * ⚠️⚠️ **`競合負け` 以外では、失注理由さえ入っていれば未入力なし。**
 *   ⚠️ 計画中止・音信不通などで競合の情報を求めない。
 *
 * ⚠️ 返すのは**画面に出すラベルの配列**。⚠️ **空配列なら未入力なし。**
 * ⚠️ 期間の絞り込み（2026-06-01 以降）は**ここではしない。** 呼び出し側の仕事である。
 * ─────────────────────────────────────────────
 */
export const missingLostFields = (item: Record<string, unknown>): string[] => {
    if (isBlank(item[LOST_REASON_KEY])) return ['失注理由'];

    if (item[LOST_REASON_KEY] !== LOST_TO_COMPETITOR) return [];

    return LOST_FIELDS.filter(f => isBlank(item[f.key])).map(f => lostFieldLabel(f.key));
};

/**
 * ステータスに応じた必須項目の検査。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`handleSave()` の `requiredList` では書けない。**
 *   ⚠️ あちらは「常に必須」の固定配列で、
 *     ⚠️ **ステータス次第で必須が変わる**ものは表現できない。
 *
 * ⚠️ 未入力の項目名を返す。⚠️ **すべて埋まっていれば null。**
 *   ⚠️ 例外を投げないこと。呼び出し側は alert を出して中断するだけである。
 *
 * ⚠️⚠️ **判定に使うのは `LOST_FIELDS` / `WIN_FIELDS` の `blocksSave` だけ。**
 *   ⚠️ ⚠️ **一覧に出る項目と、保存を止める項目はわざと違う。**
 *     ⚠️ 失注先・他決理由は一覧に出すが**保存は止めない**（従来の運用を壊さないため）。
 *
 * ⚠️⚠️ **注文事業（order）以外では必ず null を返す。**
 *   ⚠️ 建売・中古には入力欄そのものを出していないため、
 *     ⚠️ 検査すると**絶対に保存できなくなる。**
 * ─────────────────────────────────────────────
 */
export const statusRequiredError = (
    information: Record<string, string>,
    category: string,
    status: string
): string | null => {
    if (category !== 'order') return null;

    /** ⚠️ 並び順のまま最初の1つを返す。⚠️ 一度に1項目だけ知らせる */
    const firstMissing = (fields: LostField[]): string | null => {
        const found = fields.find(f => f.blocksSave && isBlank(information[f.key]));
        return found === undefined ? null : lostFieldLabel(found.key);
    };

    if (status === '契約済み') return firstMissing(WIN_FIELDS);

    if (status === '失注' && information[LOST_REASON_KEY] === LOST_TO_COMPETITOR) {
        return firstMissing(LOST_FIELDS);
    }

    return null;
};
