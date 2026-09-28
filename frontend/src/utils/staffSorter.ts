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
