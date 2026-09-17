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

    // ⚠️ 空白だけの入力も未入力として扱う
    const filled = (key: string): boolean => (information[key] ?? '').trim() !== '';

    if (status === '契約済み') {
        if (!filled(WIN_REASON_KEY)) return '勝因';
        return null;
    }

    if (status === '失注' && information.competitor_lost_contract_reason === '競合負け') {
        if (!filled(LOSE_REASON_KEY)) return '敗因';
        if (!filled(PRICE_GAP_KEY)) return '価格差';
        if (!filled(COUNTERMEASURE_KEY)) return '今後の対策';
        return null;
    }

    return null;
};
