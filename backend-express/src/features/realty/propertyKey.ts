import rules from './propertyKeyRules.json';

/**
 * 媒介物件の「同じ物件か」の突き合わせ（v2.2.250。連動トリガー仕様書 ②）。
 *
 * ─────────────────────────────────────────────
 *   突き合わせ用の文字列（match_key）＝ 種別 | 場所
 *     地番があるとき       … 種別|c:地番
 *     マンション（建物名あり）… 種別|a:住所|建物名|部屋番号
 *     それ以外             … 種別|a:住所
 *   住所・地番・建物名・部屋番号は、propertyKeyRules.json の置き換えでそろえ、最後の「-」を落とす
 * ─────────────────────────────────────────────
 *
 * ⚠️ 移し替えの SQL（backend/scripts/realty/build-property-sql.cjs が作る）も同じ規則で作る。⚠️ どちらかだけを変えない。
 * ⚠️ 2026-11-05 の利用者の決定: 住所＋種別で突き合わせる（地番は任意で持ち、あれば優先）。マンションは建物名＋部屋番号も。
 */

const REPLACE: [string, string][] = rules.replace.map(([from, to]) => [from, to]);

/** 書き方の揺れをそろえる（置き換えを順に・最後の「-」を落とす） */
export const normPlace = (v: unknown): string => {
  let s = String(v ?? '');
  for (const [from, to] of REPLACE) s = s.split(from).join(to);
  return s.replace(/-+$/, '');
};

/** 台帳の住所（市区町村 addr1 と番地まで addr2）を1つに。⚠️ addr2 が市区町村から始まっていれば addr2 だけ（重ねない） */
export const fullAddress = (addr1: unknown, addr2: unknown): string => {
  const a1 = String(addr1 ?? '');
  const a2 = String(addr2 ?? '');
  return a2.startsWith(a1) ? a2 : `${a1}${a2}`;
};

export type PlaceInput = { category: string; addr: string; chiban?: string; buildingName?: string; roomNo?: string };

/**
 * @param uniqueId 場所が見分けられないとき（地番・建物名が無く、住所に数字＝番地が無い）に付ける ID（台帳の ID）。
 *   ⚠️ 「鹿児島市」だけの住所どうしを同じ物件にまとめないため。その台帳だけの物件になる（キーの末尾 |u:ID）
 */
export const propertyKeyOf = (p: PlaceInput, uniqueId: string): string => {
  const cat = String(p.category ?? '');
  const chiban = normPlace(p.chiban);
  if (chiban) return `${cat}|c:${chiban}`;
  const addr = normPlace(p.addr);
  const building = normPlace(p.buildingName);
  if (cat === 'マンション' && building) return `${cat}|a:${addr}|${building}|${normPlace(p.roomNo)}`;
  if (!/[0-9]/.test(addr)) return `${cat}|a:${addr}|u:${uniqueId}`;
  return `${cat}|a:${addr}`;
};

/** 突き合わせ用の文字列が、ほかの物件とまとめないもの（場所が見分けられない）か */
export const isUniqueKey = (key: string): boolean => key.includes('|u:');
