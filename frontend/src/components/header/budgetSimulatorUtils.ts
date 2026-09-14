/**
 * 広告費シミュレーター（BudgetSimulator.tsx）の計算。
 *
 * ⚠️ UI から切り離してあるのは、KPI の判定と連動の規則を
 *   1箇所にまとめて読めるようにするため。
 */

export type Division = 'order' | 'spec';

export type SimCustomer = Record<string, string>;
export type SimBudget = { shop: string; medium: string; budget_period: string; budget_value: number };
export type SimShop = { id: number; brand: string; shop: string; section: string; area: string; division: string };

/**
 * 販促媒体のマスタ。
 * ⚠️ 事業ごとに別テーブルなので、来る列が違う。
 *     order … medium_list   （`list_medium`）
 *     spec  … medium_kaeru  （`show_graph`。2026-09-11 に足した列）
 *   どちらか片方しか無いので、両方とも任意にしてある。
 */
export type SimMedium = {
    medium: string;
    list_medium?: number | string;
    show_graph?: number | string;
    sort_key?: number | string;
};

/** 建売のホームページ反響をまとめる行。⚠️ マスタには無い、画面だけの行 */
export const HP_ROW = 'ホームページ反響計';

export const DIVISION_LABEL: Record<Division, string> = {
    order: '注文事業',
    spec: '建売分譲事業',
};

/**
 * KPI の段階。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **事業ごとに段階が違う。共通化しないこと。**
 *     注文 … 総反響 → 来場 → 次アポ → 契約
 *     建売 … 総反響 → 接触 → 申込み → 契約
 *
 * ⚠️ `key` は単価の色（shop/unitPriceSeries.ts）と対応させてある。
 *   並び替えないこと。実際の商談の順序であり、表の列順とも一致する。
 * ─────────────────────────────────────────────
 */
export type KpiKey = 'register' | 'interview' | 'appointment' | 'contract';

export type KpiDef = { key: KpiKey; label: string; unitLabel: string; color: string };

export const KPI_DEFS: Record<Division, KpiDef[]> = {
    order: [
        { key: 'register', label: '総反響', unitLabel: '反響単価', color: '#4e79a7' },
        { key: 'interview', label: '総来場', unitLabel: '来場単価', color: '#59a14f' },
        { key: 'appointment', label: '次アポ', unitLabel: '次アポ単価', color: '#f28e2b' },
        { key: 'contract', label: '契約', unitLabel: '契約単価', color: '#e15759' },
    ],
    spec: [
        { key: 'register', label: '総反響', unitLabel: '反響単価', color: '#4e79a7' },
        { key: 'interview', label: '接触', unitLabel: '接触単価', color: '#59a14f' },
        { key: 'appointment', label: '申込み', unitLabel: '申込単価', color: '#f28e2b' },
        { key: 'contract', label: '契約', unitLabel: '契約単価', color: '#e15759' },
    ],
};

/** 'YYYY-MM-DD' と 'YYYY/MM/DD' の差を吸収する */
export const formate = (value: string): string => (value ? value.replace(/-/g, '/') : '');

/**
 * 日付文字列から 'YYYY/MM' を取り出す。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`slice(0, 7)` で切ってはいけない。**
 *   `budget.budget_period` は形式が揃っていない。ローカルDBの実測
 *   （2026-09-14 / section = 'order' / 21,169件）で
 *
 *     YYYY/MM/DD（2桁）  … 21,108件
 *     YYYY/M/D（ゼロ埋めなし）… **19件**
 *     空文字             … 40件
 *
 *   が混在していた。ゼロ埋めなしを `slice(0, 7)` で切ると
 *   `'2026/8/'` となって月と一致せず、**静かに集計から落ちる。**
 *   ⚠️ その19件の合計は **970万円**。無視できない額である。
 *
 * ⚠️ 月が2桁（10〜12月）のときは偶然一致してしまうため、
 *   **1桁月だけが落ちる**という気づきにくい壊れ方をする。
 *
 * ⚠️ 空文字や解釈できない値は '' を返す。期間には決して入らない。
 * ─────────────────────────────────────────────
 */
export const toYearMonth = (value: string): string => {
    const matched = formate(value).match(/^(\d{4})\/(\d{1,2})/);
    if (!matched) return '';
    return `${matched[1]}/${matched[2].padStart(2, '0')}`;
};

/** その日付が期間（'YYYY/MM' の配列）に入っているか */
const inPeriod = (value: string, months: string[]): boolean => {
    const ym = toYearMonth(value);
    if (!ym) return false;
    return months.includes(ym);
};

/**
 * その顧客が KPI に該当するか。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **shop/ShopOrder.tsx・ShopKaeru.tsx と同じ判定にすること。**
 *   食い違うと、同じ期間・同じ店舗なのに店舗ランキングとシミュレーターで
 *   数字が合わず、どちらが正しいか分からなくなる。
 *   ⚠️ **片方を直したら必ず両方直すこと。**
 *
 * ⚠️ 注文の「次アポ」は `appointment || screening || contract`。
 *   ShopTrendOrder.tsx には `interview` の有無で分岐するコードがあるが、
 *   あれは「どの月に数えるか」の判定であり、条件の中身は同じ。
 *   ここは期間合計なので分岐しない。
 *
 * ⚠️ 建売は**上位の工程に進んだ人を下位にも数える。**
 *   接触日が空でも契約済みなら接触したはずで、入力漏れで
 *   歩留まりが逆転する（契約数 > 申込数）のを防ぐ。
 *
 * ⚠️ 契約の判定が事業で違う。
 *     注文 … status が '契約済み' または '解約'
 *     建売 … status が '契約済み' のみ（解約を含めない）
 *   ShopOrder.tsx / ShopKaeru.tsx がそれぞれそうなっている。
 * ─────────────────────────────────────────────
 */
export const matchesKpi = (division: Division, c: SimCustomer, kpi: KpiKey): boolean => {
    if (kpi === 'register') return true;

    if (division === 'order') {
        const isContract = !!c.contract && (c.status === '契約済み' || c.status === '解約');
        if (kpi === 'contract') return isContract;
        if (kpi === 'appointment') return !!(c.appointment || c.screening || c.contract);
        // 来場
        return !!(c.interview || c.appointment || c.screening || c.contract);
    }

    const isContract = !!(c.contract || c.contract_broker) && c.status === '契約済み';
    if (kpi === 'contract') return isContract;
    // 申込み
    if (kpi === 'appointment') return !!c.application || isContract;
    // 接触
    return !!(c.contact || c.interview || c.tour || c.application) || isContract;
};

// ---------------------------------------------------------------------------
// 販促媒体
// ---------------------------------------------------------------------------

/**
 * 媒体名の掃除。
 *
 * ⚠️⚠️ **実データには末尾の空白と改行が混ざっている。**
 *   ローカルDBの実測（2026-09-14 / master_data / show_dashboard = 1）で
 *     `SNS広告` 2,014件 のほかに `SNS広告\n` 16件
 *     `インターネット検索` 1,702件 のほかに `インターネット検索 ` 24件
 *     `チラシ` 1,110件 のほかに `チラシ ` 18件
 *   が別の値として入っていた。掃除せずにマスタ名と比べると
 *   **静かに落ちる**（エラーは出ず、件数がわずかに減るだけ）。
 */
export const cleanMedium = (value: string): string =>
    (value ?? '').replace(/[\r\n]/g, '').trim();

/**
 * 突合用の名前に寄せる。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`公式LINE` と `ALLGRIT` は同じものである**（2026-09-14 の指示）。
 *   ⚠️ 厄介なのは**表記がテーブルごとに違う**こと。実測で
 *       medium_list … `公式LINE`
 *       budget      … `公式LINE` 718件 / `ALLGRIT` 0件
 *       master_data … `ALLGRIT` 1,329件 **かつ** `公式LINE` 397件
 *   顧客側に**両方**入っているため、片方向に寄せるだけでは足りない。
 *   ⚠️ ここを通して**両方を同じ名前にしてから**比べること。
 *   ⚠️ `CustomerTrendOrder.tsx` の `formate()` は `公式LINE → ALLGRIT` の
 *     片方向で、顧客側の `公式LINE` 397件を取りこぼす。真似しないこと。
 *
 * ⚠️ `athome` と `アットホーム` も同じ（建売の顧客側は `アットホーム`）。
 *   CustomerTrendKaeru.tsx の `mediumFormate()` と同じ対応にしてある。
 * ─────────────────────────────────────────────
 */
export const mediumFormate = (medium: string): string => {
    const m = cleanMedium(medium);
    if (m === '公式LINE') return 'ALLGRIT';
    if (m === 'athome') return 'アットホーム';
    return m;
};

/**
 * 建売で「ホームページ反響」とみなすか。
 * ⚠️ CustomerTrendKaeru.tsx の `isHp()` と同じ。**ポータル以外**が HP 扱いである。
 *   ⚠️ この一覧は `displayMediums`（show_graph）とは**連動しない。**
 *     あちらは「表に出すか」、こちらは「HP反響か」で目的が違う。
 */
const isHp = (value: string): boolean => {
    if (!value) return false;
    const portal = ['SUUMO', 'ALLGRIT', `HOME'S`, 'アットホーム', 'タウンライフ', 'カゴスマ'];
    return !portal.some(p => value.includes(p));
};

/**
 * 表に出す媒体の行。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **実データではなくマスタから作る**（2026-09-14 の指示）。
 *   以前は顧客の `sales_promotion_name` を集めていたが、
 *   表記ゆれや一過性の値までそのまま行になっていた。
 *
 * ⚠️ 事業で見る列が違う。
 *     order … medium_list.list_medium = 1
 *     spec  … medium_kaeru.show_graph = 1（＋ 先頭に「ホームページ反響計」）
 *
 * ⚠️⚠️ **建売で `show_graph` 列がまだ無いと空になる。**
 *   2026-09-11 の SQL が未実行だと `Number(undefined)` が NaN になり、
 *   建売の媒体別が「ホームページ反響計」1行だけになる。**エラーは出ない。**
 *   CustomerTrendKaeru.tsx と同じ前提である。
 * ─────────────────────────────────────────────
 */
export const mediumRows = (division: Division, master: SimMedium[]): string[] => {
    const flag = division === 'order' ? 'list_medium' : 'show_graph';
    const rows = (master ?? [])
        .filter(m => Number(m[flag]) === 1)
        .sort((a, b) => (Number(a.sort_key) || 0) - (Number(b.sort_key) || 0))
        // ⚠️ 表示名も寄せる（`公式LINE` ではなく `ALLGRIT` で並ぶ）。
        //   建売の hp_campaign 側の突合が `ALLGRIT` 前提のため
        .map(m => mediumFormate(m.medium))
        .filter(Boolean);

    // ⚠️ 重複を落とす。medium_list には同名が複数ある（`HOME'S` / `SUUMO` など）
    const unique = [...new Set(rows)];

    return division === 'spec' ? [HP_ROW, ...unique] : unique;
};

/**
 * その顧客がこの媒体の行に該当するか。
 *
 * ⚠️⚠️ **建売は CustomerTrendKaeru.tsx の `matchesMediumRow()` と同じにすること**
 *   （2026-09-14 に利用者が「建売は CustomerTrendKaeru と同じでよい」と明言）。
 *   建売は `sales_promotion_name` だけでは足りず、`hp_campaign` も見る。
 *   ⚠️ 実測で建売の最多は `ネット` 4,899件だが、これは medium_kaeru の
 *     どの表示媒体でもなく、**ホームページ反響計に入る。**
 *     hp_campaign を見ないとこの4,899件が丸ごと消える。
 */
export const matchesMedium = (
    division: Division,
    customer: SimCustomer,
    row: string,
    rows: string[]
): boolean => {
    const name = mediumFormate(customer.medium ?? '');

    if (division === 'order') return name === mediumFormate(row);

    const campaign = customer.hp_campaign ?? '';
    /** 表示媒体（ホームページ反響計を除く）のどれかに当たるか */
    const displayed = rows.filter(r => r !== HP_ROW);
    const isAnyDisplay = displayed.some(d =>
        name === mediumFormate(d) || campaign.includes(d));

    if (row !== HP_ROW) {
        return name === mediumFormate(row) || campaign.includes(row);
    }
    // ⚠️ 媒体も hp_campaign も空のものは HP 側に寄せる（あちらと同じ）
    return !isAnyDisplay && (isHp(campaign) || !cleanMedium(customer.medium ?? '') || !campaign);
};

/** その広告費がこの媒体の行に該当するか */
export const budgetMatchesMedium = (
    budget: SimBudget,
    row: string,
    rows: string[]
): boolean => {
    const name = mediumFormate(budget.medium ?? '');
    // ⚠️ 表示媒体に付いていない広告費はまとめてホームページ反響計へ。
    //   CustomerTrendKaeru.tsx の mediumIndex === 1 と同じ扱い
    if (row === HP_ROW) return !rows.filter(r => r !== HP_ROW).some(r => mediumFormate(r) === name);
    return name === mediumFormate(row);
};

/** 期間・店舗で絞った顧客 */
export const filterCustomers = (
    customers: SimCustomer[],
    months: string[],
    shops: string[] | null
): SimCustomer[] =>
    customers.filter(c =>
        // ⚠️ 起算は「反響日」。店舗ランキングと同じ
        inPeriod(c.register, months) &&
        (shops === null || shops.includes(c.shop))
    );

/**
 * 期間・店舗で絞った広告費の合計。
 * ⚠️ `row` を渡すとその媒体の行だけを足す。省略すると全体。
 *   ⚠️ 単純な名前一致では**表記ゆれで落ちる**ので budgetMatchesMedium を通す。
 */
export const sumBudget = (
    budgets: SimBudget[],
    months: string[],
    shops: string[] | null,
    row?: string,
    rows: string[] = []
): number =>
    budgets
        .filter(b =>
            inPeriod(b.budget_period, months) &&
            (shops === null || shops.includes(b.shop)) &&
            (row === undefined || budgetMatchesMedium(b, row, rows))
        )
        .reduce((acc, b) => acc + Number(b.budget_value ?? 0), 0);

/** KPI ごとの件数 */
export const countKpis = (division: Division, customers: SimCustomer[]): Record<KpiKey, number> => {
    const out = { register: 0, interview: 0, appointment: 0, contract: 0 };
    customers.forEach(c => {
        KPI_DEFS[division].forEach(def => {
            if (matchesKpi(division, c, def.key)) out[def.key] += 1;
        });
    });
    return out;
};

// ---------------------------------------------------------------------------
// シミュレーション
// ---------------------------------------------------------------------------

/** 1ブロック（全体または媒体1つ）の状態 */
export type SimRow = {
    budget: number;
    counts: Record<KpiKey, number>;
};

/**
 * 単価。⚠️ **常に `広告費 ÷ 件数` で導出する。**
 *   単価そのものを state に持たないのは、広告費・件数・単価の3つを
 *   別々に持つと**すぐ辻褄が合わなくなる**ため。
 *
 * ⚠️ 件数が0なら null。0円と書くと「無料で取れた」と読める。
 */
export const unitPrice = (budget: number, count: number): number | null =>
    count > 0 && isFinite(budget / count) ? Math.round(budget / count) : null;

/**
 * 広告費を変えたときの件数。
 *
 * ⚠️⚠️ **単価を保ったまま件数を比例させる。**
 *   「広告費総額を 200000 に変更したら各種歩留まりが倍になる」という
 *   指示どおりの挙動。⚠️ 4つのKPIすべてが同じ倍率で動く。
 *
 * ⚠️ 元の広告費が0のときは比率が出せないので件数を変えない。
 *   0で割って Infinity にすると件数が壊れる。
 */
export const applyBudget = (row: SimRow, nextBudget: number): SimRow => {
    if (row.budget <= 0) return { ...row, budget: nextBudget };
    const ratio = nextBudget / row.budget;
    return {
        budget: nextBudget,
        counts: {
            register: Math.round(row.counts.register * ratio),
            interview: Math.round(row.counts.interview * ratio),
            appointment: Math.round(row.counts.appointment * ratio),
            contract: Math.round(row.counts.contract * ratio),
        },
    };
};

/**
 * 単価を変えたときの件数。
 *
 * ⚠️ **広告費は固定**し、`件数 = 広告費 ÷ 単価` で置き換える。
 *   「反響単価を 5000 に変更したら総反響が倍になる」という指示どおり。
 * ⚠️ 触ったKPIだけを変える。下流は連動させない
 *   （指示にある3つの例はいずれも、触った行だけが変わっている）。
 */
export const applyUnit = (row: SimRow, kpi: KpiKey, nextUnit: number): SimRow => {
    if (nextUnit <= 0) return row;
    return {
        ...row,
        counts: { ...row.counts, [kpi]: Math.round(row.budget / nextUnit) },
    };
};

/**
 * 件数を変えたとき。
 *
 * ⚠️ **広告費は固定**。単価は導出なので自動で変わる
 *   （「総反響を 20 にしたら反響単価が 1/2 になる」）。
 */
export const applyCount = (row: SimRow, kpi: KpiKey, nextCount: number): SimRow => ({
    ...row,
    counts: { ...row.counts, [kpi]: Math.max(0, Math.round(nextCount)) },
});

/**
 * 試算の軸。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **「何を固定するか」で連動の向きが変わる**（2026-09-14 の指示）。
 *
 *   'budget' … 広告費を固定する
 *       件数を変える → その単価が動く（「この広告費でこれだけ取るには単価いくら」）
 *       ⚠️ **投下した広告費から達成可能な件数を見る**ときの軸。
 *
 *   'unit'   … 単価を固定する
 *       件数を変える → **広告費が動く**（「これだけ取るにはいくら要るか」）
 *       ⚠️ **目標の契約数から必要な広告費を出す**ときの軸。
 *       ⚠️ 単価を保つため、ほかの3つの件数も同じ比率で動く。
 *         契約を1.5倍にするなら反響も来場も1.5倍要る、という意味である。
 *
 * ⚠️ 広告費そのものを書き換えたときは**どちらの軸でも同じ**
 *   （単価を保ったまま件数が比例する）。元の版の 'calc_contracts' に当たる。
 * ─────────────────────────────────────────────
 */
export type SimAxis = 'budget' | 'unit';

/**
 * 単価を固定したまま件数を変える。
 *
 * ⚠️⚠️ **広告費と、ほかの件数も同じ比率で動かす。** 触った KPI だけ動かすと
 *   その単価は保てても**ほかの3つの単価が壊れる**（広告費が変わるため）。
 *
 * ⚠️ 元の件数が0なら比率が出せないので何もしない。
 *   ⚠️ 0で割ると Infinity になり、広告費が NaN で表示される。
 * ⚠️ 0件にしたい場合も比率が0になり全部消えてしまうので受け付けない。
 */
export const applyCountKeepUnit = (row: SimRow, kpi: KpiKey, nextCount: number): SimRow => {
    const current = row.counts[kpi];
    const next = Math.max(0, Math.round(nextCount));
    if (current <= 0 || next <= 0) return row;

    const ratio = next / current;
    return {
        budget: Math.round(row.budget * ratio),
        counts: {
            register: Math.round(row.counts.register * ratio),
            interview: Math.round(row.counts.interview * ratio),
            appointment: Math.round(row.counts.appointment * ratio),
            contract: Math.round(row.counts.contract * ratio),
            // ⚠️ 触った KPI は丸めずに入力どおりにする。
            //   ratio を掛け直すと入力した数と1件ずれることがある
            [kpi]: next,
        },
    };
};

/**
 * 'YYYY/MM' を1年前にする。
 *
 * ⚠️⚠️ **試算の出発点（広告費・件数・単価）はすべて1年前を見る。**
 *   KPI 単価が「昨年の広告費 ÷ **昨年の**件数」でなければならないため
 *   （2026-09-14 の指示）。当期の件数を分母にすると、期の途中では
 *   件数が少ないぶん単価が跳ね上がり、基準として使えない。
 *
 * ⚠️ 選択期間の実績は**画面に併記するだけ**で、試算には入れない。
 */
export const lastYearMonth = (month: string): string => {
    const [y, m] = month.split('/');
    if (!y || !m) return month;
    return `${Number(y) - 1}/${m}`;
};

/**
 * 契約目標の合計。
 *
 * ⚠️⚠️ **`period` は 'YYYY-MM'（ハイフン）。** 画面の月は 'YYYY/MM'（スラッシュ）で、
 *   そのまま比較すると**1件も一致しない**（エラーは出ず目標が0になる）。
 *
 * ⚠️ `value` は text 型なので Number() を通す。空文字は0として扱う。
 *
 * ⚠️ 店舗を絞っていないとき（shops が null）は**対象事業の店舗だけ**を足す。
 *   company_achievement には全事業の店舗が入っているので、
 *   絞らないと注文の画面に建売の目標まで乗る。
 *   ⚠️ 実測（2026-09-14）で 注文28店 / 建売6店 / 中古2店 が入っていた。
 */
export const sumAchievement = (
    rows: { name: string; period: string; value: string }[],
    months: string[],
    shops: string[] | null,
    divisionShops: string[]
): number => {
    const target = new Set(shops ?? divisionShops);
    // ⚠️ 形式の揺れを吸収してから比べる（toYearMonth のコメント参照）
    const periods = new Set(months);
    return rows
        .filter(r => periods.has(toYearMonth(r.period)) && target.has(r.name))
        .reduce((acc, r) => acc + (Number(r.value) || 0), 0);
};

/**
 * 契約目標を達成するために必要な広告費。
 *
 * ⚠️⚠️ **単価は「昨年の広告費 ÷ 昨年の契約数」で出すこと。**
 *   画面に出している単価は「昨年の広告費 ÷ **今の**契約数」であり、
 *   期の途中だと契約数が少なく単価が跳ね上がる。
 *   それを使うと必要広告費が実態よりはるかに大きく出てしまう。
 *
 * ⚠️ 昨年の契約数が0なら出せない（null）。0で割らないこと。
 */
export const requiredBudget = (
    lastYearBudget: number,
    lastYearContract: number,
    targetContract: number
): number | null => {
    if (lastYearContract <= 0 || targetContract <= 0) return null;
    const unit = lastYearBudget / lastYearContract;
    if (!isFinite(unit)) return null;
    return Math.round(unit * targetContract);
};

/** 入力欄の文字列を数値にする。⚠️ 全角・カンマ・円記号を落とす */
export const toNumber = (value: string): number => {
    const half = value
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
        .replace(/[,，¥￥\s]/g, '');
    const n = Number(half);
    return Number.isFinite(n) ? n : 0;
};
