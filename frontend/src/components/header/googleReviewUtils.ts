/**
 * 口コミ集計（header/GoogleReview.tsx）の店舗名の突き合わせ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`google_review.shop` は Google ビジネスプロフィールの登録名で、
 *   `shop_list.shop` とは表記がまったく違う。**
 *
 *     google_review : 「国分ハウジング 薩摩川内店」
 *     shop_list     : 「KH薩摩川内店」
 *
 *   ⚠️ 事業区分・営業課で絞り込むには shop_list と突き合わせる必要があるため、
 *     ここで表記を寄せている（2026-09-15 の指示）。
 *
 * ⚠️ 手順は「空白を消す → 接頭辞を置き換える」。
 *   ⚠️ **マッピングのキー側も空白を消してから比べる**ので、
 *     「PG HOUSE（ピージーハウス）」のように**キーに空白があっても効く**。
 *     順序に依存しない形にしてある。
 * ─────────────────────────────────────────────
 */

/** 全角・半角の空白をすべて落とす */
const squash = (value: string): string => (value ?? '').replace(/[\s　]+/g, '');

/**
 * 注文事業のブランド名 → shop_list の接頭辞。
 *
 * ⚠️ 指示（2026-09-15）のとおり。⚠️ 並び順に意味がある：
 *   **長いキーを先に見る**こと。「国分ハウジング」を先に当てると
 *   「国分ハウジンググループ 中古住宅専門店」まで置き換わってしまう。
 *   ⚠️ 下の BRAND_PREFIX は長い順に並べ替えてから使う。
 */
const BRAND_PREFIX: Record<string, string> = {
    '国分ハウジング': 'KH',
    'デイジャストハウス': 'DJH',
    'ニーエルホーム-2lhome-': '2L',
    'なごみ工務店': 'なごみ',
    'フルコミホーム': 'FH',
    'JUSFYHOME（ジャスフィーホーム）': 'JH',
    'PGHOUSE（ピージーハウス）': 'PGH',
};

/**
 * 接頭辞では表せないもの（丸ごと置き換える）。
 *
 * ⚠️ キーは**空白を消した後**の文字列である。
 *
 * ⚠️⚠️ **「かえるホーム国分ハウジンググループ」→「鹿児島係」は
 *   shop_list に存在しない名前である。**
 *   実体は「鹿児島1係 / 2係 / 3係」の3つで、クチコミはその合計にあたる。
 *   ⚠️ 3係とも **不動産営業1課・建売分譲事業**なので、事業区分と営業課は
 *     一意に決まる（下の FALLBACK_ATTRS で手当てしている）。
 *   ⚠️ 1係に代表させると「3係合計のクチコミが1係のものに見える」ため、
 *     そうはしていない（2026-09-15 に利用者と確認）。
 */
const FULL_NAME: Record<string, string> = {
    'かえるホーム国分ハウジンググループ': '鹿児島係',
    'かえるホーム宮崎店（国分ハウジンググループ）': '宮崎係',
    'かえるホーム大分店（国分ハウジンググループ）': '大分係',
    '国分ハウジンググループ中古住宅専門店': '中古住宅専門店',
};

/**
 * 表記を寄せたあと、それでも shop_list に無いものへの手当て。
 *
 * ⚠️ `null` は「絞り込みの対象にしない」という意思表示である。
 *   ⚠️ 一覧には出すが、事業区分・営業課で絞ると消える。
 *   ⚠️ **取得しているのに画面から完全に消えるより、絞ったときだけ
 *     消えるほうがよい**（2026-09-15 に利用者と確認）。
 */
const FALLBACK_ATTRS: Record<string, { division: string; section: string } | null> = {
    // ⚠️ shop_list に無い（鹿児島1〜3係の合計）。属性だけ手当てする
    '鹿児島係': { division: '建売分譲事業', section: '不動産営業1課' },
    /**
     * ⚠️ 指示にも shop_list にも無い。絞り込みの対象外。
     * ⚠️⚠️ **キーは「変換後」の名前である。** 元の名前は
     *   「国分ハウジング不動産」だが、接頭辞の置き換えで `KH不動産` になる。
     *   ⚠️ 元の名前で書くと**一生引けない**（2026-09-15 の検証で発見）。
     */
    'KH不動産': null,
};

/**
 * 末尾に「店」を補って探すもの。
 *
 * ⚠️⚠️ Google 側の登録名が「PG HOUSE（ピージーハウス）宮崎」で**「店」が無い**。
 *   shop_list は「PGH宮崎店」なので、そのままだと一致しない。
 *   ⚠️ 全店舗に対して機械的に「店」を足すと別の店に化ける恐れがあるため、
 *     **shop_list に完全一致が無いときだけ**試す（下の resolveShopName 参照）。
 */
const TRY_SUFFIX = '店';

/**
 * `google_review.shop` を `shop_list.shop` の表記へ寄せる。
 *
 * ⚠️ shop_list に実在する名前の一覧を渡すこと。
 *   ⚠️ 「店」を補う判断に使う。渡さないと補正が効かない。
 */
export const resolveShopName = (rawShop: string, shopNames: Set<string>): string => {
    const squashed = squash(rawShop);

    // ① 丸ごと置き換えるもの（かえるホーム系・中古住宅専門店）
    const full = FULL_NAME[squashed];
    if (full) return full;

    // ② 接頭辞の置き換え。⚠️ 長いキーから試す
    const keys = Object.keys(BRAND_PREFIX).sort((a, b) => b.length - a.length);
    let converted = squashed;
    for (const key of keys) {
        if (squashed.startsWith(key)) {
            converted = BRAND_PREFIX[key] + squashed.slice(key.length);
            break;
        }
    }

    // ③ そのままで一致すればそれでよい
    if (shopNames.has(converted)) return converted;

    // ④ ⚠️ 「店」を補うと一致する場合だけ補う（PGH宮崎 → PGH宮崎店）
    if (!converted.endsWith(TRY_SUFFIX) && shopNames.has(converted + TRY_SUFFIX)) {
        return converted + TRY_SUFFIX;
    }

    // ⑤ どれにも当たらない。⚠️ 変換後の名前をそのまま返す（一覧には出す）
    return converted;
};

export type ShopMaster = { shop: string; section: string; division: string; brand: string };

/** 画面が使う1店舗分 */
export type ReviewShop = {
    no: number;
    /** 表示名。⚠️ shop_list の表記へ寄せたもの */
    shop: string;
    /** Google 側の登録名。⚠️ 突き合わせに失敗したときの手掛かりとして残す */
    rawShop: string;
    average: number;
    amount: number;
    url: string;
    address: string;
    reviews: { rating: number; date: string; text: string }[];
    /** ⚠️ 空文字なら shop_list と突き合わせられなかったもの */
    division: string;
    section: string;
};

/** クチコミ1件（google_review.recently_review の要素） */
type RawReview = { rating?: unknown; date?: unknown; text?: unknown };

/** JSON 列を安全に配列へ。⚠️ 壊れていても画面を落とさない */
const parseReviews = (value: unknown): RawReview[] => {
    if (Array.isArray(value)) return value as RawReview[];
    if (typeof value !== 'string' || value.trim() === '') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * API の応答を画面が使う形に整える。
 *
 * ⚠️ クチコミは**日付の降順**に並べる（指示）。
 *   ⚠️ 日付が空のものは末尾へ。並びが不定になるのを避ける。
 */
export const buildReviewShops = (
    rows: Record<string, unknown>[],
    master: ShopMaster[]
): ReviewShop[] => {
    const shopNames = new Set(master.map(m => m.shop));
    const byName = new Map(master.map(m => [m.shop, m]));

    return (rows ?? []).map(row => {
        const rawShop = String(row.shop ?? '');
        const shop = resolveShopName(rawShop, shopNames);

        // ⚠️ shop_list にあればそれを使い、無ければ手当て（FALLBACK_ATTRS）を見る
        const matched = byName.get(shop);
        const fallback = shop in FALLBACK_ATTRS ? FALLBACK_ATTRS[shop] : undefined;

        const reviews = parseReviews(row.recently_review)
            .map(r => ({
                rating: Number(r.rating ?? 0),
                date: String(r.date ?? ''),
                text: String(r.text ?? ''),
            }))
            // ⚠️ 日付の降順。空は末尾
            .sort((a, b) => {
                if (a.date === b.date) return 0;
                if (a.date === '') return 1;
                if (b.date === '') return -1;
                return a.date < b.date ? 1 : -1;
            });

        return {
            no: Number(row.no ?? 0),
            shop,
            rawShop,
            // ⚠️ average / amount は text 列なので数値にしてから使う
            average: Number(row.average ?? 0),
            amount: Number(row.amount ?? 0),
            url: String(row.url ?? ''),
            address: String(row.address ?? ''),
            reviews,
            division: matched?.division ?? fallback?.division ?? '',
            section: matched?.section ?? fallback?.section ?? '',
        };
    });
};
