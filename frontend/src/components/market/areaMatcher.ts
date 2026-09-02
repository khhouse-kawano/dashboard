/**
 * 住所文字列から市区町村を割り出す。
 *
 * 自社CRM側の住所は「鹿児島市中山」「鹿児島県霧島市国分福島」「隼人町住吉」と
 * 書式がまちまちで、県が付く行と付かない行が混在している。
 * 旧実装はこれを `address.includes(市町村名)` で毎回総当たりしていたため、
 *   - 「鹿児島市」が「鹿児島県」にも一致してしまう
 *   - 行数 × 反響件数の掛け算になり、フィルタのたびに数百万回の比較が走る
 * という2つの問題があった。
 *
 * ここでは住所1件につき1回だけ市区町村を確定させ、以降は完全一致で引く。
 */

export type AreaRef = {
  pref: string;
  /** 郡名の接頭辞を落とした市区町村名 */
  areaKey: string;
};

/**
 * 市区町村を切り出す正規表現。
 *
 * 長いものから順に試す必要がある。「熊本市中央区」を先に拾わないと
 * 「熊本市」で止まってしまい、区の行に振り分けられない。
 * 郡付き（「三養基郡基山町」）も、郡を落とした町名だけの表記も両方来る。
 */
const AREA_PATTERNS = [
  /[^\s、,]{2,8}市[^\s、,]{1,4}区/, // 政令市の区
  /[^\s、,]{2,8}郡[^\s、,]{1,6}[町村]/, // 郡＋町村
  /[^\s、,]{2,8}[市町村]/, // 市 / 町 / 村
];

export class AreaMatcher {
  /** 市区町村名 → 参照。areaKey と、郡付きの正式名の両方を鍵に入れる。 */
  private readonly byName: Map<string, AreaRef>;

  /** 正規表現で拾えなかったときに総当たりする候補。長い順。 */
  private readonly fallbackNames: string[];

  /** 同じ住所を何度も解決しないための memo */
  private readonly cache = new Map<string, AreaRef | null>();

  private readonly prefs: string[];

  constructor(areas: { pref: string; area: string; areaKey: string }[], prefs: string[]) {
    this.byName = new Map();
    this.prefs = [...prefs].sort((a, b) => b.length - a.length);

    for (const { pref, area, areaKey } of areas) {
      if (areaKey === '' || areaKey === '-') continue;
      const ref: AreaRef = { pref, areaKey };
      // 「三養基郡基山町」でも「基山町」でも引けるようにする
      if (!this.byName.has(areaKey)) this.byName.set(areaKey, ref);
      if (!this.byName.has(area)) this.byName.set(area, ref);
    }

    this.fallbackNames = [...this.byName.keys()].sort((a, b) => b.length - a.length);
  }

  /**
   * 住所から市区町村を割り出す。判定できなければ null。
   *
   * 県名しか書かれていない住所は市区町村を決められないので null を返す。
   * その場合でも県だけは resolvePref で拾える。
   */
  resolve(address: string): AreaRef | null {
    const trimmed = address.trim();
    if (trimmed === '') return null;

    const cached = this.cache.get(trimmed);
    if (cached !== undefined) return cached;

    let found: AreaRef | null = null;

    for (const pattern of AREA_PATTERNS) {
      const matched = pattern.exec(trimmed);
      if (matched === null) continue;
      const ref = this.byName.get(matched[0]);
      if (ref !== undefined) {
        found = ref;
        break;
      }
    }

    // 「隼人町住吉」のように、市区町村マスタに無い旧町名で書かれている住所がある。
    // 正規表現で当たらなかったものだけ総当たりする。件数が少ないので許容できる。
    if (found === null) {
      for (const name of this.fallbackNames) {
        if (trimmed.includes(name)) {
          found = this.byName.get(name) ?? null;
          break;
        }
      }
    }

    this.cache.set(trimmed, found);
    return found;
  }

  /** 市区町村が判定できない住所でも、県だけは拾えることがある */
  resolvePref(address: string): string | null {
    const area = this.resolve(address);
    if (area !== null) return area.pref;

    const trimmed = address.trim();
    for (const pref of this.prefs) {
      if (trimmed.includes(pref)) return pref;
    }
    return null;
  }
}
