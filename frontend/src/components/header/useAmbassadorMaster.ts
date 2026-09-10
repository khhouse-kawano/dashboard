import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { DIVISION_KEYS, SHOP_DIVISION } from './divisions';
import { positions } from '../../utils/positions';

/**
 * 反響画面の店舗・担当営業マスタ。
 *
 * ⚠️ **3画面で共用している。** 条件を変えると全部に効く。
 *     AmbassadorList.tsx      公式アンバサダー台帳
 *     InquiryAmbassador.tsx   アンバサダー反響一覧
 *     InquiryIntroductory.tsx 紹介キャンペーン反響一覧
 *   片方だけ別のマスタに戻すと、同じ「担当店舗」なのに画面によって
 *   選べる店舗が違う、という状態になる。
 *
 * ⚠️ 店舗の条件は `show_flag = 1`（2026-09-06 に report_flag = 1 から変更）。
 *   担当を割り振る操作なので「今運用している店舗」が適切という判断。
 *   条件は backend-express/src/features/ambassador/master.ts にある。
 *
 * ⚠️ request 名は `ambassador_master` のままだが、アンバサダー専用ではない。
 *   先にアンバサダーで作ったという経緯によるもの。
 */

export type MasterShop = {
    /** shop_list.id。⚠️ 並び替えの最終キー */
    id: number | null;
    brand: string | null;
    shop: string | null;
    section: string | null;
    area: string | null;
    /** 事業区分。⚠️ '注文事業' / '建売分譲事業' / '中古リノベ' 等。表示名とは違う */
    division: string | null;
    /** 報告対象か。⚠️ 1 以外は管理用の擬似店舗が含まれるため選択肢から外す */
    report_flag: number | null;
};

export type MasterStaff = {
    name: string;
    shop: string;
    section: string;
    position: string;
    /** 年度。'2026' のような文字列 */
    period: string;
    status: string;
    /**
     * 社員番号。
     * ⚠️ text 型で NOT NULL だが**空文字が入る**（当年度の営業職207件中36件）。
     *   空なのはすべて「◯◯店 管理」という店舗管理用の擬似担当者。
     */
    khg_id: string | null;
};

/**
 * 当年度。
 *
 * ⚠️ 年度の切り替わりは考慮していない（暦年で判定する）。
 *   staff_list.period が暦年で運用されているため、これに合わせている。
 *   4月始まりに変えるなら staff_list 側の運用とセットで直すこと。
 */
const thisYear = (): string => String(new Date().getFullYear());

// ---------------------------------------------------------------------------
// 店舗の絞り込みと並び替え
// ---------------------------------------------------------------------------

/**
 * 選択肢に出す店舗の条件。
 *
 * ⚠️⚠️ **`report_flag = 1` で絞る。** `show_flag = 1` だけだと
 *   管理用の擬似店舗が混ざる。ローカルDBでの実測では53件中14件が該当し、
 *   その内訳は
 *
 *     KH店舗未設定 / DJH店舗未設定 / JH店舗未設定 / PGH店舗未設定 /
 *     2L店舗未設定 / なごみ店舗未設定 / FH店舗未設定 / ブランド・店舗未設定
 *     KH全店舗管理 / DJH全店舗管理 / 2L全店舗管理 / なごみ全店舗管理
 *
 *   反響の担当としてこれらを選べてしまうと、担当者の画面に出てこない
 *   顧客ができる。
 *
 * ⚠️ 代償として実在する2店舗も消える（**FH鹿児島店 / JH八代店**。
 *   どちらも注文事業で report_flag = 0）。これらに反響を割り当てる必要が
 *   出たら shop_list 側の report_flag を 1 にすること。
 *   ⚠️ この関数を緩めて対処しないこと。擬似店舗がまた出てくる。
 */
export const filterReportShops = (rows: MasterShop[]): MasterShop[] =>
    rows.filter(s => Number(s.report_flag) === 1);

/**
 * 事業区分の並び順。
 *
 * ⚠️ divisions.ts から導出する。ここに配列を書くと定義が2箇所になり、
 *   区分を増やしたときに片方だけ直して並びが崩れる。
 */
const DIVISION_ORDER: string[] = DIVISION_KEYS.map(k => SHOP_DIVISION[k]);

/**
 * ブランドの並び順。
 *
 * ⚠️⚠️ **この順序を入れ替えてはいけない。** 判定は「先に一致したもの」を
 *   採るため、`DJH` を `JH` より**前**に置く必要がある。
 *   `'DJH宮崎店'.includes('JH')` は true なので、`JH` が先だと
 *   DJH の店舗が JH のグループに並んでしまう。
 */
const BRAND_ORDER = ['KH', 'DJH', 'なごみ', '2L', 'JH', 'PGH'];

/**
 * 一覧に無いものを最後へ回すための順位。
 *
 * ⚠️ 事業区分・ブランドのどちらも、一覧に無い値は末尾に置く。
 *   先頭に来ると、見慣れない店舗が最上位に出て誤選択の元になる。
 */
const UNKNOWN_ORDER = 999;

const indexOrLast = (list: string[], value: string): number => {
    const i = list.indexOf(value);
    return i < 0 ? UNKNOWN_ORDER : i;
};

/** 店舗名に含まれるブランドの順位。⚠️ 先に一致したものを採る（DJH と JH のため） */
const brandOrderOf = (shop: string): number => {
    for (let i = 0; i < BRAND_ORDER.length; i++) {
        if (shop.includes(BRAND_ORDER[i])) return i;
    }
    // ⚠️ 建売の「鹿児島1係」「熊本係」、中古の「中古住宅専門店」「外販」など、
    //   ブランド名を含まない店舗が実在する（実測9件）。末尾に回す
    return UNKNOWN_ORDER;
};

/**
 * 店舗の並び替え。① 事業区分 → ② ブランド → ③ id の昇順。
 *
 * ⚠️ 元の配列を破壊しない（sort は破壊的なので複製してから並べる）。
 *   state の配列を直接並べ替えると React が変更を検知できない。
 */
export const sortShops = (rows: MasterShop[]): MasterShop[] =>
    [...rows].sort((a, b) => {
        const da = indexOrLast(DIVISION_ORDER, (a.division ?? '').trim());
        const db = indexOrLast(DIVISION_ORDER, (b.division ?? '').trim());
        if (da !== db) return da - db;

        const ba = brandOrderOf((a.shop ?? '').trim());
        const bb = brandOrderOf((b.shop ?? '').trim());
        if (ba !== bb) return ba - bb;

        // ⚠️ id は int。null は末尾へ回す
        const ia = a.id ?? Number.MAX_SAFE_INTEGER;
        const ib = b.id ?? Number.MAX_SAFE_INTEGER;
        return ia - ib;
    });

// ---------------------------------------------------------------------------
// 担当営業の並び替え
// ---------------------------------------------------------------------------

/**
 * 役職一覧に無い役職の順位。
 *
 * ⚠️ utils/positions.ts は現在7件（常務〜一般）なので 10 で必ず末尾になる。
 *   ⚠️⚠️ **positions.ts が10件以上に増えたらこの値も上げること。**
 *     増やし忘れると、役職不明の担当者が課長などより前に並ぶ。
 */
const UNKNOWN_POSITION_ORDER = 10;

/**
 * 社員番号が空のときの順位。
 *
 * ⚠️⚠️ **10 のような小さい値にしてはいけない。**
 *   khg_id の実値は 100007〜100480 の6桁で、10 を入れると
 *   「末尾に回す」つもりが**全員より前**に来てしまう。
 *   実値より確実に大きい 999999 を使う。
 *
 * ⚠️ khg_id が7桁に増えたらこの値も上げること。
 */
const UNKNOWN_KHG_ID_ORDER = 999999;

/**
 * 社員番号を数値にする。空なら末尾へ回す値を返す。
 *
 * ⚠️ khg_id は **text 型**。文字列比較だと桁数が違ったときに
 *   '99999' > '100480' となって崩れるため、数値にしてから比べる。
 */
const khgIdOrderOf = (khgId: string | null): number => {
    const text = (khgId ?? '').trim();
    if (text === '') return UNKNOWN_KHG_ID_ORDER;
    const n = Number(text);
    // ⚠️ 数字以外が入っていた場合も末尾へ。NaN で比較すると順序が不定になる
    return Number.isFinite(n) ? n : UNKNOWN_KHG_ID_ORDER;
};

/**
 * 担当営業を並べる。① 役職（positions.ts の順）→ ② 社員番号（khg_id）の昇順。
 *
 * ⚠️ 元の配列を破壊しない（sort は破壊的なので複製してから並べる）。
 *   state の配列を直接並べ替えると React が変更を検知できない。
 *
 * ⚠️ 一覧に無い役職、社員番号が空のものはそれぞれ末尾に回る。
 *   ⚠️ 社員番号が空なのは「◯◯店 管理」という店舗管理用の擬似担当者なので、
 *     実在の担当者より後に出るのが望ましい。
 *
 * ⚠️ ②まで同じ場合はサーバー側（staff_list の sort, id）の順が残る。
 *   Array.prototype.sort は安定ソートのため。
 */
export const sortStaff = (rows: MasterStaff[]): MasterStaff[] =>
    [...rows].sort((a, b) => {
        const pa = positions.indexOf((a.position ?? '').trim());
        const pb = positions.indexOf((b.position ?? '').trim());
        const oa = pa < 0 ? UNKNOWN_POSITION_ORDER : pa;
        const ob = pb < 0 ? UNKNOWN_POSITION_ORDER : pb;
        if (oa !== ob) return oa - ob;

        return khgIdOrderOf(a.khg_id) - khgIdOrderOf(b.khg_id);
    });

export const useAmbassadorMaster = () => {
    const [shopList, setShopList] = useState<MasterShop[]>([]);
    const [staffList, setStaffList] = useState<MasterStaff[]>([]);
    /** ⚠️ マスタが取れなくても本体の閲覧は続けられるようにする。画面は止めない */
    const [masterError, setMasterError] = useState('');

    useEffect(() => {
        const fetchMaster = async () => {
            try {
                const res = await apiClient.post('', { request: 'ambassador_master' });
                if (res.data?.status !== 'ok') {
                    setMasterError(res.data?.message ?? '店舗・担当営業のマスタを取得できませんでした。');
                    return;
                }
                setShopList(res.data.shop ?? []);
                setStaffList(res.data.staff ?? []);
            } catch {
                // ⚠️ 黙らせない。選択肢が空なのか通信が失敗したのか区別できないと、
                //   「担当が選べない」という問い合わせの原因が特定できない
                setMasterError('店舗・担当営業のマスタを取得できませんでした。分析サーバーが停止している可能性があります。');
            }
        };
        void fetchMaster();
    }, []);

    /**
     * 選択肢に使う店舗。
     *
     * ⚠️⚠️ **絞り込みと並び替えをここで一度だけ行う。**
     *   このフックは3画面で共用しているため、片方の画面だけ別の並びに
     *   すると「同じ担当店舗なのに画面によって選べる店舗も順序も違う」
     *   状態になる。
     *
     *   絞り込み: report_flag = 1（管理用の擬似店舗を外す）
     *   並び替え: ① 事業区分 → ② ブランド → ③ id
     */
    const usableShops = useMemo(
        () => sortShops(filterReportShops(shopList)),
        [shopList]
    );

    /** 重複を除いて店舗名を並べる。⚠️ 並び順は usableShops の順を保つ */
    const toShopNames = (rows: MasterShop[]): string[] => {
        const seen = new Set<string>();
        const out: string[] = [];
        rows.forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            out.push(name);
        });
        return out;
    };

    /** 全店舗。事業区分を持たない画面（台帳）で使う */
    const shopOptions = useMemo(() => toShopNames(usableShops), [usableShops]);

    /**
     * 指定した事業区分の店舗。
     *
     * ⚠️ 引数は `shop_list.division` の値（'注文事業' 等）。表示名（'注文'）ではない。
     *   変換は divisions.ts の SHOP_DIVISION を使うこと。
     *
     * ⚠️ 区分で絞らないと、建売の反響に注文事業の店舗を割り当てられてしまう。
     *   同期先のテーブルが違うため、担当者の画面に出てこない顧客ができる。
     *
     * ⚠️ 一致する店舗が無い場合は空を返す（全店舗にフォールバックしない）。
     *   フォールバックすると、間違った選択肢が正しい顔をして出てしまう。
     */
    const shopOptionsForDivision = useCallback((shopDivision: string): string[] => {
        const target = shopDivision.trim();
        if (target === '') return [];
        return toShopNames(usableShops.filter(s => (s.division ?? '').trim() === target));
    }, [usableShops]);

    /** 当年度の営業職だけに絞ったもの */
    const currentStaff = useMemo(() => {
        const year = thisYear();
        // ⚠️ period は文字列型の列だが、数値で入っている可能性もある。
        //   String() で両側をそろえてから比較する
        //
        // ⚠️ 役職の順に並べる（utils/positions.ts の順）。
        //   選択肢の先頭に店長・課長が来るようにするため。
        //   ⚠️ 役職が同じなら社員番号（khg_id）の昇順。
        //   ⚠️ 一覧に無い役職・社員番号が空のものは末尾に回る（sortStaff 参照）
        return sortStaff(staffList.filter(s => String(s.period) === year));
    }, [staffList]);

    /**
     * 指定した店舗の担当営業。
     *
     * ⚠️ 店舗が未選択のときは**空を返す。** 全員を出すと、
     *   別店舗の担当者を割り当てられてしまう。
     *
     * ⚠️ 現在保存されている担当者が候補に無いことがある（異動・退職・年度替わり）。
     *   呼び出し側で、保存済みの値を選択肢に補って表示すること。
     *   補わないと select の値が空になり、次に触った瞬間に担当が消える。
     */
    const staffOptionsFor = useCallback((shop: string | null): string[] => {
        const target = (shop ?? '').trim();
        if (target === '') return [];

        const seen = new Set<string>();
        const out: string[] = [];
        currentStaff.forEach(s => {
            if (s.shop !== target) return;
            const name = (s.name ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            out.push(name);
        });
        return out;
    }, [currentStaff]);

    return {
        shopOptions,
        shopOptionsForDivision,
        staffOptionsFor,
        masterError,
        thisYear: thisYear(),
    };
};
