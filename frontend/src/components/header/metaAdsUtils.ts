/**
 * 他社広告ライブラリの集計。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **実データを見たうえでの前提**（2026-09-16 / 3,814行）
 *
 *   `advertiser_period` … **掲載開始日**。取得日より後のものが0件なので確定
 *   `scraped_date`      … 取得日（週1）
 *   `ad_hash`           … UNIQUE。**1広告1行**
 *
 * ⚠️⚠️ **「掲載期間」は作れない。**
 *   ⚠️ `advertiser_period` は開始日だけで終了日が無く、
 *     `ad_hash` が UNIQUE なので同じ広告が複数の取得日にまたがらない。
 *   ⚠️ **「いつまで出ていたか」は分からない。**
 *     期間を出したつもりの指標を作らないこと。
 *
 * ⚠️⚠️ **`advertiser_period` の2割強は日付として使えない。**
 *   空 822件 / 日付でない 310件（例: `2026/09/08に・合計アクティブ時間20時間`）
 *   ⚠️ スクレイピングの取りこぼしである。
 *   ⚠️ 黙って落とすと**集計から静かに消える**ので、必ず「不明」として数える。
 * ─────────────────────────────────────────────
 */

export type AdData = {
    id: string | number;
    advertiser_name: string;
    advertiser_area: string;
    advertiser_period: string;
    ad_title: string;
    image_filename: string;
    scraped_date: string;
    lp_url: string;
    bookmark?: number;
};

/**
 * 掲載開始日を `YYYY-MM` にする。
 * ⚠️ 日付として読めないものは null。⚠️ 呼び出し側が「不明」として数えること。
 */
export const startMonth = (period: string): string | null => {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((period ?? '').trim());
    return m ? `${m[1]}-${m[2]}` : null;
};

/** 掲載開始日（並べ替え用）。⚠️ 読めないものは空文字で末尾に寄る */
export const startDate = (period: string): string => {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((period ?? '').trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

// ---------------------------------------------------------------------------
// 広告主ごと
// ---------------------------------------------------------------------------

export interface AdvertiserSummary {
    advertiser: string;
    /** バナー数（＝行数）。⚠️ 出稿回数ではない */
    banners: number;
    /** 見出しの種類 */
    titles: number;
    /**
     * 1見出しあたりの展開数。
     * ⚠️ 同じ見出しで画像やLPを変えた別バナーが何本あるか。
     *   ⚠️ 大きいほど「1つの訴求を作り込んでいる」と読める。
     */
    perTitle: number;
    /** エリア別の内訳。⚠️ 多い順 */
    areas: { area: string; count: number }[];
    /** 最新の掲載開始日。⚠️ 読めるものが無ければ空 */
    latestStart: string;
    /** ⚠️ 掲載開始日が取れなかった件数 */
    unknownStart: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const summarizeByAdvertiser = (ads: AdData[]): AdvertiserSummary[] => {
    const map = new Map<string, AdData[]>();
    for (const ad of ads) {
        const key = ad.advertiser_name ?? '';
        const list = map.get(key);
        if (list) list.push(ad); else map.set(key, [ad]);
    }

    const rows: AdvertiserSummary[] = [];

    map.forEach((list, advertiser) => {
        const titles = new Set(list.map(a => (a.ad_title ?? '').trim()));

        const areaCount = new Map<string, number>();
        for (const a of list) {
            const area = (a.advertiser_area ?? '').trim() || '不明';
            areaCount.set(area, (areaCount.get(area) ?? 0) + 1);
        }

        const starts = list.map(a => startDate(a.advertiser_period)).filter(v => v !== '');

        rows.push({
            advertiser,
            banners: list.length,
            titles: titles.size,
            // ⚠️ 0除算はしない（titles が 0 になることは無いが念のため）
            perTitle: titles.size === 0 ? 0 : round1(list.length / titles.size),
            areas: [...areaCount.entries()]
                .map(([area, count]) => ({ area, count }))
                .sort((a, b) => b.count - a.count),
            // ⚠️ sort は破壊的。元の配列を壊さないよう作った配列に対して行う
            latestStart: starts.length === 0 ? '' : starts.slice().sort()[starts.length - 1],
            unknownStart: list.length - starts.length,
        });
    });

    return rows.sort((a, b) => b.banners - a.banners);
};

// ---------------------------------------------------------------------------
// 見出しごと
// ---------------------------------------------------------------------------

export interface TitleSummary {
    title: string;
    /** この見出しで出している広告主。⚠️ 複数のことがある */
    advertisers: string[];
    /** 展開しているバナー数 */
    banners: number;
    firstStart: string;
    latestStart: string;
}

/**
 * ⚠️⚠️ **SQL で数えた値と一致しないことがある。**
 *   ⚠️ MySQL の既定の照合（`utf8mb4_general_ci`）は大文字小文字などを
 *     **同一視する**が、ここは厳密一致で数えている。
 *   ⚠️ 実測（2026-09-16）: 複数バナーを持つ見出しは
 *       SQL の既定照合 … 555
 *       厳密一致（＝ここ）… 554
 *     ⚠️ SQL 側で確かめるときは `GROUP BY BINARY TRIM(ad_title)` にすること。
 *
 * ⚠️ 空の見出しは 720 件ある（スクレイピングの取りこぼし）。⚠️ 集計しない。
 *   ⚠️ `テキストなし` という見出しも 148 件あるが、**そのまま数えている**
 *     （広告主が実際に使っている表記かもしれず、勝手に捨てない）。
 */
export const summarizeByTitle = (ads: AdData[]): TitleSummary[] => {
    const map = new Map<string, AdData[]>();
    for (const ad of ads) {
        const key = (ad.ad_title ?? '').trim();
        // ⚠️ 見出しが空の行は集計しない（1つの巨大な塊になって読めなくなる）
        if (key === '') continue;
        const list = map.get(key);
        if (list) list.push(ad); else map.set(key, [ad]);
    }

    const rows: TitleSummary[] = [];

    map.forEach((list, title) => {
        const starts = list.map(a => startDate(a.advertiser_period)).filter(v => v !== '').sort();
        rows.push({
            title,
            advertisers: [...new Set(list.map(a => a.advertiser_name))],
            banners: list.length,
            firstStart: starts[0] ?? '',
            latestStart: starts[starts.length - 1] ?? '',
        });
    });

    return rows.sort((a, b) => b.banners - a.banners);
};

// ---------------------------------------------------------------------------
// 月別の推移
// ---------------------------------------------------------------------------

export interface MonthlyRow {
    month: string;
    count: number;
}

/**
 * 掲載開始月ごとの新規バナー数。
 *
 * ⚠️⚠️ **日付が取れなかった件数を別に返す。**
 *   ⚠️ 合計に混ぜると「先月は少なかった」と誤読される。
 */
export const summarizeByMonth = (ads: AdData[]): {
    rows: MonthlyRow[];
    unknown: number;
    /** ⚠️ 収集を始めた月。これより前は信用できない（下の注記を参照） */
    since: string;
    /** ⚠️ 収集開始より前の月に落ちた件数。⚠️ グラフには出さないが必ず数える */
    beforeSince: number;
} => {
    const count = new Map<string, number>();
    let unknown = 0;

    /**
     * ⚠️⚠️ **収集を始めた月より前は、グラフとして読んではいけない。**
     *   ⚠️ 収集開始は `scraped_date` の最小値（実測 2026-06-23）。
     *   ⚠️ それ以前の月に入るのは「収集開始時点でまだ出ていた＝長期掲載の広告」だけで、
     *     **その月に実際どれだけ出稿されたかではない。**
     *   ⚠️ そのまま並べると右肩上がりのグラフに見えるが、**実態は収集開始の影響**である。
     */
    const scraped = ads.map(a => (a.scraped_date ?? '').slice(0, 7)).filter(v => v !== '');
    const since = scraped.length === 0 ? '' : scraped.slice().sort()[0];

    for (const ad of ads) {
        const month = startMonth(ad.advertiser_period);
        if (!month) { unknown += 1; continue; }
        count.set(month, (count.get(month) ?? 0) + 1);
    }

    const all = [...count.entries()]
        .map(([month, c]) => ({ month, count: c }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const rows = since === '' ? all : all.filter(r => r.month >= since);
    const beforeSince = all
        .filter(r => since !== '' && r.month < since)
        .reduce((s, r) => s + r.count, 0);

    return { rows, unknown, since, beforeSince };
};
