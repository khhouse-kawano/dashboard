/**
 * ポータル反響の印（v2.2.281）。
 *
 * 反響を顧客台帳へ取り込んだあと、その反響がポータルサイトから来たものなら
 * 顧客台帳の portal_flag = 1・portal_site = サイト名 にする。
 *
 * 判定：反響の medium と response_medium が同じで、inquiry_id の頭がポータルの接頭辞
 *   （大文字小文字を区別）で、その接頭辞のサイト名と medium が一致するとき。
 *
 * ⚠️⚠️ ① core/portal.php と backend/scripts/sql/2026-11-18_update_log_2.2.281.sql（過去分の埋め戻し）と
 *   **同じ式**にすること。変えるときは3か所そろえる。
 * ⚠️ ポータルと判定できないときは何もしない（前に入っている印は消さない）。
 */
export const PORTAL_PREFIXES: ReadonlyArray<readonly [prefix: string, site: string]> = [
  ['suumo', 'SUUMO'],
  ['homes', "HOME'S"],
  ['athome', 'athome'],
  ['townlife', 'タウンライフ'],
  ['allgrit', 'ALLGRIT'],
  ['kagosuma', 'カゴスマ'],
  ['mochiie', '持ち家計画'],
  ['tochishinchaku', '土地新着ネット'],
  ['housingBazar', 'ハウジングバザール'],
  ['metaJutaku', 'メタ住宅展示場'],
];

/** 事業区分 → [顧客台帳, 反響]。印の列があるのは注文と建売だけ */
const PORTAL_TABLES: Record<string, readonly [master: string, inquiry: string]> = {
  order: ['master_data', 'inquiry_customer'],
  spec: ['master_data_kaeru', 'inquiry_customer_kaeru'],
};

// ⚠️ 接頭辞に LIKE のワイルドカード（% _）は入れないこと
const SITE_BY_PREFIX_SQL = `CASE ${PORTAL_PREFIXES.map(([p, s]) => `WHEN i.inquiry_id LIKE BINARY '${p}%' THEN '${s.replace(/'/g, "''")}'`).join(' ')} END`;

/** 取り込んだ反響（inquiry_id）がポータルなら、その顧客台帳に印を付ける SQL と値。対象外の事業なら null */
export const portalMarkSql = (category: string, inquiryId: string): { sql: string; params: string[] } | null => {
  const tables = PORTAL_TABLES[category];
  if (tables === undefined || inquiryId === '') return null;
  const [master, inquiry] = tables;
  return {
    sql: `UPDATE ${master} m JOIN ${inquiry} i ON i.pg_id = m.id
             SET m.portal_flag = 1, m.portal_site = i.medium
           WHERE i.inquiry_id = ? AND i.medium = i.response_medium AND i.medium = ${SITE_BY_PREFIX_SQL}`,
    params: [inquiryId],
  };
};
