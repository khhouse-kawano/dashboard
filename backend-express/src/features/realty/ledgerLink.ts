import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../db/pool';
import type { Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { jstNow, resolveMe, uid } from './calls';
import { norm } from './index';
import type { Result } from './index';

/**
 * 不動産企画係: 連動トリガー仕様書の ① 売り反響 → 媒介獲得（＋ ② 台帳の作成）（v2.2.248 新規。② だけ）。
 *
 * ─────────────────────────────────────────────
 *   planner:ledger_link … 売り反響の「媒介紐付」の画面（frontend common/LedgerLinkModal.tsx）の「登録」
 *
 *   1. 前提条件を確かめる（満たさなければ何も書かず、足りない項目の名前を返す。仕様書 共通ルール 2）
 *   2. 1つのトランザクションで（仕様書 共通ルール 3。途中で失敗したら全部戻る）
 *      ・売り反響を押さえる（FOR UPDATE）。すでに台帳に紐づいていれば作らずに、その台帳を返す（二重作成の防止）
 *      ・台帳 No. を振る（台帳の行を押さえて最大 + 1。同時に2人が登録しても重ならない）
 *      ・台帳を作る（現況は「情報整理中」＝仕様書の「販売準備中」。docs/realty-trigger-spec.md の対応表）
 *      ・売り反響を「媒介受託」（＝仕様書の「媒介獲得」）にし、媒介契約日・台帳 No.・台帳 ID を入れる
 *      ・変更履歴（kind = logs）を積む（仕様書の監査ログ）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 段階・現況の名前は今のまま（2026-11-05 の利用者の決定）。仕様書の名前とは docs/realty-trigger-spec.md の「8」で読み替える。
 * ⚠️ 前提条件は画面（frontend common/leadLinks.ts の ledgerFormProblems）と同じ。⚠️ どちらかを変えたら両方を変える。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string, extra: Record<string, unknown> = {}): Result =>
  ({ httpStatus, body: { status: 'error', message, ...extra } });

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/** ① の媒介の種類（仕様書：専属専任・専任・一般） */
export const BAIKAI_TYPES = ['専属専任媒介', '専任媒介', '一般媒介'];
/** 有効期間3か月の上限がある種類（宅建業法） */
const LIMITED_TYPES = ['専属専任媒介', '専任媒介'];

/**
 * 有効期間の満了日の上限＝契約日の3か月後の前日（仕様書の初期値）。
 * ⚠️ 3か月後に同じ日が無いとき（11/30 → 2/30 など）は、その月の末日（民法143条2項のただし書と同じ考え方）。
 * ⚠️ frontend common/leadLinks.ts の maxExpiryOf と同じ計算
 */
export const maxExpiryOf = (contractDate: string): string => {
  const [y, m, d] = contractDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + 3 + 1, 0)).getUTCDate();
  if (d > lastDay) return new Date(Date.UTC(y, m - 1 + 3, lastDay)).toISOString().slice(0, 10);
  return new Date(Date.UTC(y, m - 1 + 3, d - 1)).toISOString().slice(0, 10);
};

type LedgerLinkForm = {
  baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
  addr1: string; addr2: string; price: number; staff: string; freq: string; note: string; otherBrokers: string;
};

/** 画面から来た値を読む。⚠️ ① を通すと {} が [] になるので、画面は JSON の文字列で送る */
const formOf = (raw: unknown): LedgerLinkForm | null => {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  return {
    baikaiDate: str(r.baikaiDate).trim(), baikaiType: str(r.baikaiType).trim(), expiry: str(r.expiry).trim(),
    seller: str(r.seller).trim(), contact: str(r.contact).trim(), category: str(r.category).trim(),
    addr1: str(r.addr1).trim(), addr2: str(r.addr2).trim(), price: Number(r.price),
    staff: str(r.staff).trim(), freq: str(r.freq).trim(), note: str(r.note).trim(), otherBrokers: str(r.otherBrokers).trim(),
  };
};

/** 前提条件（仕様書 ①）。満たさない項目の説明を返す（空なら満たしている） */
export const problemsOf = (f: LedgerLinkForm, today: string): string[] => {
  const p: string[] = [];
  if (!BAIKAI_TYPES.includes(f.baikaiType)) p.push('媒介の種類');
  if (!isIsoDate(f.baikaiDate)) p.push('媒介契約日');
  else if (f.baikaiDate > today) p.push('媒介契約日（未来の日付は入れられません）');
  if (!isIsoDate(f.expiry)) p.push('有効期間の満了日');
  else if (isIsoDate(f.baikaiDate)) {
    if (f.expiry < f.baikaiDate) p.push('有効期間の満了日（媒介契約日より前です）');
    else if (LIMITED_TYPES.includes(f.baikaiType) && f.expiry > maxExpiryOf(f.baikaiDate)) {
      p.push(`有効期間の満了日（${f.baikaiType}は契約日から3か月以内＝${maxExpiryOf(f.baikaiDate)}まで）`);
    }
  }
  if (!Number.isInteger(f.price) || f.price < 1) p.push('売出価格（1円以上の整数）');
  if (!f.staff) p.push('担当者');
  if (!f.seller) p.push('売主');
  if (!f.addr2) p.push('物件の所在地');
  if (!f.category) p.push('物件の種別');
  return p;
};

/** 設定の担当者の略称（台帳の担当は略称。以前のアプリと同じ）。⚠️ 名前は空白を除いて突き合わせる */
const abbrOf = async (tx: Tx, name: string): Promise<string> => {
  const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
  let list: unknown = row?.staff;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return '';
  const me = norm(name);
  for (const s of list) {
    if (s !== null && typeof s === 'object' && norm((s as Record<string, unknown>).name) === me) return str((s as Record<string, unknown>).abbr);
  }
  return '';
};

/** 変更履歴を1件積む（frontend common/leadUtiles.ts の logChange と同じ形） */
const insertLog = (
  tx: Tx,
  log: { entity: string; entityId: string; entityNo: number | null; label: string; field: string; from: string; to: string; by: string; at: string; note: string }
) =>
  tx.execute(
    `INSERT INTO brokerage_listings (kind, \`id\`, entity, entityId, entityNo, label, field, \`from\`, \`to\`, \`by\`, \`at\`, note, show_dashboard)
     VALUES ('logs', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [uid(), log.entity, log.entityId, log.entityNo, log.label, log.field, log.from || '（未設定）', log.to || '（未設定）', log.by, log.at, log.note]
  );

/**
 * planner:ledger_link。body = { leadId, form: JSON 文字列 }
 * 応答
 *   作った          … { status: 'success', no, ledgerId, lead }（lead は保存後の売り反響）
 *   すでに紐づいている … { status: 'exists', no, ledgerId }
 *   前提条件を満たさない … 400 { status: 'error', message, problems: [...] }
 */
export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const leadId = str(body.leadId).trim();
  if (leadId === '') return fail(400, '売り反響が指定されていません');
  const form = formOf(body.form);
  if (form === null) return fail(400, '入力の形が正しくありません');
  const now = jstNow();
  const problems = problemsOf(form, now.date);
  if (problems.length > 0) return fail(400, `次の項目を確かめてください：${problems.join('・')}`, { problems });

  return withTransaction(async (tx) => {
    const [lead] = await tx.query<DynamicRow>(
      `SELECT * FROM brokerage_listings
        WHERE \`id\` = ? AND kind = 'leads' AND (show_dashboard IS NULL OR show_dashboard <> 0)
        FOR UPDATE`,
      [leadId]
    );
    if (lead === undefined) return fail(404, '売り反響が見つかりません（削除された可能性があります）');
    if (str(lead.ledgerNo) !== '') return ok({ status: 'exists', no: Number(lead.ledgerNo), ledgerId: str(lead.ledgerId) || null });

    // ⚠️ 台帳の行を押さえてから最大を数える（同時に登録されても No. が重ならない）。⚠️ 削除済みの台帳の No. も使わない
    const [max] = await tx.query<DynamicRow>(
      "SELECT COALESCE(MAX(CAST(`no` AS UNSIGNED)), 0) AS m FROM brokerage_listings WHERE kind = 'ledger' FOR UPDATE"
    );
    const no = Number(max?.m ?? 0) + 1;
    const ledgerId = uid();
    const abbr = await abbrOf(tx, form.staff);
    const by = await resolveMe(tx, staff);
    const note = form.otherBrokers && form.baikaiType === '一般媒介'
      ? `${form.note}${form.note ? '／' : ''}他の依頼先：${form.otherBrokers}`
      : form.note;

    await tx.execute(
      `INSERT INTO brokerage_listings
         (kind, \`id\`, \`no\`, staff, portal, source, contractDate, baikaiType, expiry, seller, contact, category,
          currentStatus, addr1, addr2, price, freq, lastReportDate, reinsDate, priceRevDate, propStatus, keyStatus, keyInfo,
          note, createdAt, show_dashboard)
       VALUES ('ledger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '情報整理中', ?, ?, ?, ?, NULL, NULL, NULL, 'アクティブ', NULL, NULL, ?, ?, 1)`,
      [ledgerId, no, abbr || null, abbr || null, str(lead.source) || null, form.baikaiDate, form.baikaiType, form.expiry,
        form.seller, form.contact || null, form.category, form.addr1 || null, form.addr2, form.price, form.freq || null,
        note || null, now.date]
    );

    const fromPhase = str(lead.phase);
    await tx.execute(
      `UPDATE brokerage_listings
          SET phase = '媒介受託', baikaiDate = ?, ledgerNo = ?, ledgerId = ?, endReason = NULL
        WHERE \`id\` = ?`,
      [form.baikaiDate, no, ledgerId, leadId]
    );

    const label = str(lead.seller) || str(lead.name) || str(lead.addr) || leadId;
    const at = new Date().toISOString();
    if (fromPhase !== '媒介受託') {
      await insertLog(tx, { entity: 'lead', entityId: leadId, entityNo: null, label, field: 'フェーズ', from: fromPhase, to: '媒介受託', by, at, note: `媒介紐付（台帳 No.${no}）` });
    }
    await insertLog(tx, {
      entity: 'ledger', entityId: ledgerId, entityNo: no, label: form.seller, field: '作成', from: '', to: `台帳 No.${no}`, by, at,
      note: `売り反響「${label}」の媒介紐付から作成（${form.baikaiType}・媒介契約日 ${form.baikaiDate}・満了日 ${form.expiry}・売出価格 ${form.price}円）`,
    });

    const [saved] = await tx.query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [leadId]);
    return ok({ status: 'success', no, ledgerId, lead: saved ?? null });
  });
};
