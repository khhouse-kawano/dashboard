/**
 * 建売分譲事業の販促媒体の表記ゆれをまとめる（customer/CustomerKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **3つのテーブルで同じ媒体が別の名前で入っている**（2026-09-18 の指示）。
 *     master_data_kaeru.sales_promotion_name … 顧客が選んだ反響媒体
 *     medium_kaeru                            … ⚠️ **基準にする名前**
 *     budget.medium                           … 販促費
 *   ⚠️ 突合できないと**分子（顧客）と分母（販促費）が別の行に乗り**、
 *     単価がまるで合わなくなる。
 *
 * ⚠️⚠️ **`medium_kaeru` の名前を正とする。** 画面の行もこの名前で出る。
 *
 * ⚠️ 対応表に無いものは**そのまま**扱う（`SUUMO` / `HOME'S` / `チラシ` など。指示）。
 * ─────────────────────────────────────────────
 */

/**
 * 正式名 → その名前として扱う値の一覧。
 *
 * ⚠️⚠️ **キーは `medium_kaeru.medium` に実在する名前にすること。**
 *   ⚠️ 実在しない名前を作ると、⚠️ **その行が画面に出てこない**
 *     （行は `medium_kaeru` から作るため）。
 *
 * ⚠️⚠️ **`インターネット検索` と `ネット` を `Web検索` に入れている**（2026-09-18 に利用者が決定）。
 *   ⚠️ 指示書の原文は `ネット検索` だったが、⚠️ **実データは `インターネット検索`** で
 *     ⚠️ **販促費の最多（¥98,218,945／全体の35%）**である。1文字違いで丸ごと漏れていた。
 *   ⚠️ 顧客側の `ネット` は ⚠️ **4,892件（建売の反響の59%）**で、これも漏れていた。
 *
 * ⚠️ `Youtube` は `medium_kaeru` では `YouTube`（T が大文字）である。
 *   ⚠️ **両方を書いておく。** 大文字小文字を無視する作りにはしていない
 *     （`HOME'S` のような記号混じりで思わぬ一致を生むため）。
 */
export const MEDIUM_ALIAS: Record<string, string[]> = {
    'アットホーム': ['アットホーム', 'athome'],
    'Instagram': ['Instagram', 'SNS広告', 'Facebook'],
    'Web検索': [
        'Web検索', 'WEB検索', 'ネット検索', 'ネット広告',
        // ⚠️ 2026-09-18 に追加（利用者の決定）
        'インターネット検索', 'ネット',
    ],
    'カゴスマ・タテルヤ': ['カゴスマ・タテルヤ', 'カゴスマ'],
    '公式LINE': ['公式LINE', 'ALLGRIT'],
    'その他': ['その他', 'テレビCM', '住宅展示場', 'Yahoo!不動産', 'Youtube', 'YouTube'],
};

/**
 * 値 → 正式名 の引き当て表。
 *
 * ⚠️ 毎回 `Object.entries` を回すと行数×顧客数だけ繰り返すことになるので、
 *   ⚠️ **読み込み時に1度だけ作る。**
 */
const CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MEDIUM_ALIAS)) {
    for (const alias of aliases) CANONICAL.set(alias, canonical);
}

/**
 * 媒体名の掃除。
 *
 * ⚠️⚠️ **実データには末尾の空白と改行が混ざっている。**
 *   ⚠️ 掃除せずに比べると**静かに落ちる**（エラーは出ず、件数がわずかに減るだけ）。
 * ⚠️ budgetSimulatorUtils.ts の `cleanMedium()` と同じ考え方である。
 */
export const cleanMedium = (value: string): string =>
    (value ?? '').replace(/[\r\n]/g, '').trim();

/**
 * 表記を `medium_kaeru` の名前に揃える。
 *
 * ⚠️⚠️ **対応表に無いものはそのまま返す**（指示）。
 *   ⚠️ 勝手に「その他」へ寄せない。⚠️ **寄せると、拾えていないことに気づけなくなる。**
 *
 * ⚠️⚠️ **`Instagram、Web検索` のような複数選択はそのまま返る。**
 *   ⚠️ 実データに約50件ある。⚠️ **個別の媒体の行には乗らない**（数え方が未決のため）。
 *   ⚠️ 2026-09-21 から ⚠️ **`CustomerKaeru.tsx` の「その他（未分類）」行が受け止める**ので、
 *     ⚠️ **媒体別の合計と総反響は一致する。**
 *   ⚠️ 数え方が決まったら、⚠️ **ここで分解するのではなく画面側の行の作り方を直すこと**
 *     （1人を複数の行に数えるかどうかは集計の話である）。
 */
export const normalizeMedium = (value: string): string => {
    const cleaned = cleanMedium(value);
    return CANONICAL.get(cleaned) ?? cleaned;
};

// ---------------------------------------------------------------------------
// ホームページ反響（2026-09-22 の指示）
//
// ⚠️⚠️ **判定は customerTrend/CustomerTrendKaeru.tsx の `matchesMediumRow()` と
//   同じものにすること**（利用者の指示）。
//   ⚠️ ⚠️ **片方だけ直すと、同じ「ホームページ反響」の件数が画面ごとに違う**という
//     いちばん質の悪いズレ方をする。
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **ホームページ反響の広告費として数える `budget.medium`**（2026-09-22 の指示）。
 *
 * ⚠️ ⚠️ **`medium_kaeru` の名前ではなく、`budget` テーブルに実在する名前で書くこと。**
 *   ⚠️ 例: 利用者の言う `Web検索` は、⚠️ **販促費側では `インターネット検索`** である。
 *
 * ⚠️ 実績（section = 'spec' / response_medium = 0・2026-09-22 時点）
 *     インターネット検索      105,045,842
 *     SNS広告                  93,702,101
 *     Amazonギフトカード        3,600,828
 *     チラシ                      801,819
 *     LP制作                       66,399
 */
export const HOMEPAGE_BUDGET_MEDIUMS: string[] = [
    'インターネット検索',
    'SNS広告',
    'Amazonギフトカード',
    'チラシ',
    'LP制作',
];

/** その販促費が「ホームページ反響」の広告費か */
export const isHomepageBudget = (medium: string): boolean =>
    HOMEPAGE_BUDGET_MEDIUMS.includes(cleanMedium(medium));

/**
 * ⚠️ ポータル経由かどうか。
 *
 * ⚠️⚠️ **CustomerTrendKaeru.tsx の `isHp()` をそのまま写したもの。**
 *   ⚠️ ⚠️ **中身を変えないこと。** 変えるなら両方である。
 *   ⚠️ `ALLGRIT` は公式LINE、`カゴスマ` は `カゴスマ・タテルヤ` の実データ名。
 */
const PORTALS: string[] = ['SUUMO', 'ALLGRIT', "HOME'S", 'アットホーム', 'タウンライフ', 'カゴスマ'];

export const isHpCampaign = (value: string): boolean => {
    if (!value) return false;
    return !PORTALS.some(p => value.includes(p));
};

/** 正式名として扱う値の一覧（別名表に無ければ自分自身だけ） */
const aliasesOf = (canonical: string): string[] => MEDIUM_ALIAS[canonical] ?? [canonical];

/**
 * その顧客が、単独行として出している媒体（`show_graph = 1`）に当たるか。
 *
 * ⚠️⚠️ **反響媒体だけでなく `hp_campaign` も見る**（CustomerTrendKaeru と同じ）。
 *   ⚠️ ⚠️ **見ないと、ポータル経由の反響が「ホームページ反響」に流れ込む。**
 *   ⚠️ 突き合わせは別名も含めて行う（`公式LINE` は実データでは `ALLGRIT`）。
 */
export const matchesShownMedium = (
    customerMedium: string,
    hpCampaign: string,
    shownMedium: string
): boolean => {
    if (normalizeMedium(customerMedium) === shownMedium) return true;

    const campaign = cleanMedium(hpCampaign);
    if (campaign === '') return false;
    return aliasesOf(shownMedium).some(alias => campaign.includes(alias));
};

/**
 * その顧客が「ホームページ反響」に入るか。
 *
 * ⚠️⚠️ **CustomerTrendKaeru.tsx の `isHpGroup` と同じ式である。**
 *
 *   ```
 *   const isHpGroup = !isAnyDisplayMedium
 *       && (isHp(o.hp_campaign) || !o.medium || !o.hp_campaign);
 *   ```
 *
 * ⚠️ ⚠️ **「単独行のどれにも当たらない」ことが先に来る。**
 *   ⚠️ これが無いと ⚠️ **同じ顧客が SUUMO とホームページ反響の両方に数えられる。**
 *
 * ⚠️⚠️ **反響媒体が空の顧客もここに入る**（`!o.medium`）。
 *   ⚠️ ⚠️ **`show_graph = 0` の媒体かどうかは、もう見ていない**（2026-09-22 に変更）。
 *     ⚠️ 以前は `medium_kaeru` に載っている媒体だけを拾っていたため、
 *       ⚠️ **台帳に無い媒体の反響が「その他（未分類）」に落ちていた。**
 */
/**
 * ⚠️⚠️ **反響媒体がこれなら、無条件でホームページ反響に数える**（2026-09-22 の指示）。
 *
 * > CustomerKaeru.tsx のホームページ反響から Web検索と Instagram が抜けているので丸めること
 * > 総反響と一致しなくてもよい
 *
 * ⚠️ ⚠️ **`hp_campaign` を見ない。**
 *   ⚠️ ポータル名（SUUMO 等）がキャンペーン名に入っている顧客も、
 *     ⚠️ **反響媒体が Web検索・Instagram ならホームページ反響に数える。**
 *   ⚠️⚠️ **そのため SUUMO などの行と二重に数えられることがある。**
 *     ⚠️ ⚠️ **利用者の判断で許容している**（「総反響と一致しなくてもよい」）。
 *
 * ⚠️ 名前は `medium_kaeru` の正式名で書くこと（別名は `normalizeMedium` が寄せる）。
 */
export const HOMEPAGE_MEDIUMS: string[] = ['Web検索', 'Instagram'];

export const isHomepageCustomer = (
    customerMedium: string,
    hpCampaign: string,
    shownMediums: string[]
): boolean => {
    // ⚠️ 2026-09-22 追加。⚠️ **ここだけは単独行より先に判定する**（丸めを優先する）
    if (HOMEPAGE_MEDIUMS.includes(normalizeMedium(customerMedium))) return true;

    const matchesAnyShown = shownMediums.some(
        shown => matchesShownMedium(customerMedium, hpCampaign, shown)
    );
    if (matchesAnyShown) return false;

    return isHpCampaign(hpCampaign)
        || cleanMedium(customerMedium) === ''
        || cleanMedium(hpCampaign) === '';
};
