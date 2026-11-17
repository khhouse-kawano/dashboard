import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { DUP_TABLES, isDupBrand } from './keys';
import type { DupBrand } from './keys';
import { refreshDupKeysSafely } from './refresh';

/**
 * 重複の詳細（v2.2.276。② だけ。画面の list/DuplicateBadge.tsx が開いたときに取る）。
 *
 * 本文: { request: 'inquiryDup', category: 'order' | 'spec' | 'used', id: 反響の表の id }
 * 応答: { status: 'success', items: [{ brand, id, inquiry_id, inquiry_date, medium, response_medium, shop, category, staff, sync, name, by_mail, by_mobile }] }
 *
 * ⚠️ 一致したのがメールか携帯かだけを返し、⚠️ 相手のメール・電話番号の値そのものは返さない。
 * ⚠️ 相手は注文・建売・中古の3つの表から探す（inquiry_dup_key の鍵で）。⚠️ 自分は除く。
 */

export interface InquiryDupResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

interface OwnKeyRow extends RowDataPacket {
  mail_key: string | null;
  mobile_key: string | null;
}

interface PartnerRow extends RowDataPacket {
  brand: DupBrand;
  src_id: number;
  by_mail: number;
  by_mobile: number;
}

interface DetailRow extends RowDataPacket {
  id: number;
  inquiry_id: string;
  inquiry_date: string;
  medium: string;
  response_medium: string;
  first_name: string;
  last_name: string;
  shop: string;
  category: string | null;
  staff: string;
  sync: number;
}

const fail = (httpStatus: number, message: string): InquiryDupResult => ({ httpStatus, body: { status: 'error', message } });

/** ⚠️ 反響日は 'YYYY-MM-DD' と 'YYYY/MM/DD' が混ざっている。並べるときだけ揃える */
const dateKey = (value: string): string => String(value ?? '').replace(/-/g, '/');

export const runInquiryDup = async (body: Record<string, unknown>): Promise<InquiryDupResult> => {
  const brand = body.category;
  const id = Number(body.id);
  if (!isDupBrand(brand)) return fail(400, '事業区分が正しくありません');
  if (!Number.isInteger(id) || id <= 0) return fail(400, '反響の id がありません');

  await refreshDupKeysSafely();

  const own = await query<OwnKeyRow>('SELECT mail_key, mobile_key FROM inquiry_dup_key WHERE brand = ? AND src_id = ?', [brand, id]);
  const mail = own[0]?.mail_key ?? null;
  const mobile = own[0]?.mobile_key ?? null;
  if (mail === null && mobile === null) return { httpStatus: 200, body: { status: 'success', items: [] } };

  const partners = await query<PartnerRow>(
    `SELECT brand, src_id, (mail_key <=> ?) AS by_mail, (mobile_key <=> ?) AS by_mobile
       FROM inquiry_dup_key
      WHERE (mail_key = ? OR mobile_key = ?) AND NOT (brand = ? AND src_id = ?)`,
    [mail, mobile, mail, mobile, brand, id]
  );

  const items: Record<string, unknown>[] = [];
  for (const target of Object.keys(DUP_TABLES) as DupBrand[]) {
    const mine = partners.filter((p) => p.brand === target);
    if (mine.length === 0) continue;
    const match = new Map(mine.map((p) => [Number(p.src_id), p]));
    // ⚠️ category（取引区分）は中古の表にしかない
    const categoryColumn = target === 'used' ? 'category' : 'NULL AS category';
    const rows = await query<DetailRow>(
      `SELECT id, inquiry_id, inquiry_date, medium, response_medium, first_name, last_name, shop, ${categoryColumn}, staff, sync
         FROM ${DUP_TABLES[target]} WHERE id IN (${mine.map(() => '?').join(', ')})`,
      mine.map((p) => p.src_id)
    );
    for (const r of rows) {
      const m = match.get(Number(r.id));
      items.push({
        brand: target,
        id: Number(r.id),
        inquiry_id: r.inquiry_id,
        inquiry_date: r.inquiry_date,
        medium: r.medium,
        response_medium: r.response_medium,
        shop: r.shop,
        category: r.category,
        staff: r.staff,
        sync: Number(r.sync),
        name: `${r.first_name ?? ''}${r.last_name ?? ''}`,
        by_mail: Number(m?.by_mail ?? 0) === 1,
        by_mobile: Number(m?.by_mobile ?? 0) === 1,
      });
    }
  }
  items.sort((a, b) => dateKey(String(b.inquiry_date)).localeCompare(dateKey(String(a.inquiry_date))));
  return { httpStatus: 200, body: { status: 'success', items } };
};
