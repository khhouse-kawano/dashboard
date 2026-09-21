import apiClient from "../../utils/apiClient";

export const monthFormate = (date: string) => {
    return date ? date.replace(/-/g, '/').slice(0, 7) : '';
};

export const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : '';
};

export const handleBlack = async (brandValue: string, nameValue: string, mobileValue: string, mailValue: string, zipValue: string, addressValue: string, category: string) => {
    const fetchData = async () => {
        try {
            const response = await apiClient.post('',
                {
                    mobile: mobileValue,
                    mail: mailValue,
                    brand: brandValue,
                    name: nameValue,
                    zip: zipValue,
                    address: addressValue,
                    request: 'list',
                    category,
                    roll: 'black'
                });
            console.log(response.data.status);
        } catch (err) {
            console.error(err);
        }
    };
    fetchData();
};

/**
 * 全角数字・長音符・記号を変換し、数字とハイフンのみを抽出する（電話番号・郵便番号等に最適）
 */
export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');

/** 電話番号として成立する最低の桁数。⚠️ 固定電話の市外局番込みで10桁 */
const MOBILE_MIN_DIGITS = 10;

/**
 * ブラックリストの突合に使える電話番号か。
 *
 * ⚠️⚠️ **不備のある番号で照合してはいけない**（2026-09-18 の指示）。
 *   ⚠️ 突合は `includes()`（部分一致）なので、⚠️ **短い番号は必ず誰かに当たる。**
 *     ⚠️ 実データに `090` `1` `8992521`（郵便番号らしきもの）が入っており、
 *     ⚠️ **無関係な顧客が赤く表示されていた。**
 *   ⚠️ 実測（注文）で ⚠️ **183件 → 141件**。⚠️ **42件が誤検知だった。**
 *
 * ⚠️⚠️ **記号は無視して数字だけで判定する**（2026-09-18 の指示）。
 *   ⚠️ 実データの 4,561件が `="08064284025"` という Excel 由来の形になっている。
 *     ⚠️ 中身は正しい携帯番号なので、⚠️ **記号で弾いてはいけない。**
 *   ⚠️ `toHalfWidth()` が数字以外を落とすので、ハイフン付きもここを通る。
 *
 * ⚠️ `'false'` や `'null'` は数字が1つも無いので桁数0になり、自然に false になる。
 *   ⚠️ それでも明示しているのは、⚠️ **実データにこの値が入る**ことを残すため。
 */
export const isValidMobile = (value: unknown): boolean => {
    const raw = String(value ?? '').trim();
    if (raw === '' || raw === 'null' || raw.toLowerCase() === 'false') return false;
    return toHalfWidth(raw).length >= MOBILE_MIN_DIGITS;
};

/** ブラックリスト名簿の1件。⚠️ `black_list` テーブルから必要な2列だけ */
export type BlackListEntry = { mobile: string; mail: string };

/**
 * ブラックリスト名簿に載っているか。
 *
 * ⚠️⚠️ **注文・建売・中古の3画面で共有している。**
 *   ⚠️ 2026-09-21 まで**3ファイルに同じ式が写してあり**、
 *     ⚠️ 片方だけ直すと画面によって赤くなる行が変わっていた。
 *   ⚠️ 各画面の `isBlack()` は、これに**タグ（`isTagOn`）を OR する**だけにしてある。
 *
 * ⚠️⚠️ **電話番号は両側が `isValidMobile()` を通ったときだけ使う。**
 *   ⚠️ 突合は `includes()`（部分一致）なので、⚠️ **短い番号は誰にでも当たる。**
 *   ⚠️ 名簿側も見るのは、⚠️ **画面から短い番号を登録できてしまう**ため。
 *
 * ⚠️ メールは従来どおり素の部分一致。⚠️ **指示の対象外なので変えていない。**
 */
export const matchesBlackList = (
    mail: unknown,
    mobile: unknown,
    blackList: ReadonlyArray<BlackListEntry>
): boolean => {
    const safeMail = String(mail ?? '');
    const safeMobile = String(mobile ?? '');
    const canUseMobile = isValidMobile(safeMobile);
    const halfMobile = toHalfWidth(safeMobile);

    return blackList.some(b =>
        (safeMail !== '' && b.mail.includes(safeMail)) ||
        (canUseMobile && isValidMobile(b.mobile) && toHalfWidth(b.mobile).includes(halfMobile))
    );
};

export const styles = {
    label: { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', fontWeight: '500', display: 'block' },
    input: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '100%', paddingLeft: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    textarea: { border: '1px solid #D3D3D3', borderRadius: '4px', width: '100%', padding: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    buttonSecondary: { color: '#495057', backgroundColor: '#f8f9fa', border: '1px solid #d2d6da', borderRadius: '6px', padding: '0 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    buttonPrimary: { color: '#ffffff', backgroundColor: '#5e72e4', border: '1px solid #5e72e4', borderRadius: '6px', padding: '0 24px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    buttonDanger: { color: '#ffffff', backgroundColor: '#eb4848', border: '1px solid #eb4848', borderRadius: '6px', padding: '0 24px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
};

export const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];

export const formatToYYYYMMDD = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';

    // スペースで区切って日付部分("2026/8/23")だけを取得
    const datePart = dateStr.split(' ')[0];

    // スラッシュまたはハイフンで年・月・日に分割
    const parts = datePart.split(/[\/\-]/);

    // 年・月・日が揃っていなければ、そのまま返す（安全対策）
    if (parts.length !== 3) return datePart;

    const year = parts[0];
    const month = parts[1].padStart(2, '0'); // 1桁なら "08" にする
    const day = parts[2].padStart(2, '0');   // 1桁なら "03" にする

    return `${year}/${month}/${day}`;
};
/**
 * 一覧の「開始月」の初期値。**当月の1か月前**を 'YYYY/MM' で返す。
 *
 * ⚠️⚠️ 2026-09-09 まで開始月・終了月ともに当月にしていたため、
 *   月初に開くと当月の数件しか見えなかった。開始月だけ1か月前にする。
 *
 * ⚠️ 1月は前年の12月になる。`month - 1` を文字列で作ると '00' になるので、
 *   Date に計算させる（`new Date(y, m - 2, 1)` は m が1のとき前年12月）。
 *
 * @param options.monthArray 選択肢（getYearMonthArray の戻り値）。
 *   ⚠️ 渡した場合、1か月前が選択肢に無ければ**先頭**を返す。
 *     選択肢に無い値を state に入れると、select の表示と
 *     絞り込みの条件が食い違う。
 */
export const previousMonthValue = (options?: { monthArray?: string[] }): string => {
    const now = new Date();
    // ⚠️ getMonth() は 0 起点。前月は getMonth() - 1 なので第2引数は -1 でよい
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const value = `${prev.getFullYear()}/${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const list = options?.monthArray;
    if (list === undefined || list.length === 0) return value;
    return list.includes(value) ? value : (list[0] as string);
};

/** 当月を 'YYYY/MM' で返す（終了月の初期値） */
export const currentMonthValue = (): string => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * 上部サマリーの集計対象から外す店舗か。
 *
 * ⚠️⚠️ **判定を1箇所にまとめてある。** 2026-09-09 まで
 *   `!item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店')`
 *   を ListOrder / ListKaeru の中で**3回ずつ**書いていた。
 *   片方だけ直すと見出しと数値で列がずれる。
 *
 * ⚠️ 条件は当時のまま変えていない。
 *   'FH' は部分一致なので 'FH' を含む店舗すべてが外れる。
 */
export const isSummaryShop = (shop: string): boolean =>
    !shop.includes('未設定') && !shop.includes('FH') && !shop.includes('JH八代店');

/**
 * 上部サマリーのテーブル幅（px）。
 *
 * ⚠️⚠️ 幅を指定しないと画面いっぱいに広がり、店舗数が少ないときに
 *   1列が異常に太くなる（2026-09-09 の指摘）。
 *   店舗名とKPIしか入らないので1列100pxで足りる。
 *
 * ⚠️⚠️ **この幅を使う Table に `className='inquiry_table'` を付けないこと。**
 *   SearchBox.css に
 *     .inquiry_table { width: 2600px !important; }
 *   があり、`!important` は**インラインの style にも勝つ**。
 *   クラスを付けたままだとこの計算結果が無視され、常に 2600px になる。
 *   （2026-09-09 に style だけ直して効かなかった原因がこれ）
 *   ⚠️ 下段の反響一覧の Table は 2600px が要るのでクラスを残す。
 *     上部サマリーの Table だけ外す。
 *
 * @param columns 見出しの列数（「グループ全体」などの固定列も含める）
 * @param labelWidth 左端のラベル列の幅
 */
export const summaryTableWidth = (columns: number, labelWidth: number): number =>
    labelWidth + columns * SUMMARY_COLUMN_WIDTH;

/** 1列の幅。⚠️ ここを変えるときは各テーブルの td の width も合わせること */
export const SUMMARY_COLUMN_WIDTH = 100;
