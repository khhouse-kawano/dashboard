import type { RowDataPacket } from 'mysql2/promise';
import { executeLarge, query, withTransaction } from '../../db/pool';
import type { Result } from './index';

/**
 * 以前の不動産企画係アプリ（khf-eigyokanri.netlify.app）のバックアップを取り込む（v2.2.224。② だけ。マスターだけ）。
 *
 * ─────────────────────────────────────────────
 * 元のファイル: 以前のアプリの「⚙ 設定・データ管理 → 📥 バックアップを保存（JSON・書類除く）」（exportJson。アプリの中身 S をそのまま）
 *   S.deals / S.ledger / S.leads / … の配列 → brokerage_listings の行（kind = 配列名。本番アプリの SYNC_KINDS）
 *   S.settings / S.weekly / S.compliance     → app_state の3行
 * ⚠️ 画面（RealtyImport.tsx）がファイルを読んで、行を 200 件ずつ送る（① の転送は1回 120 秒まで・本文の大きさにも限りがある）。
 *
 * 3段:
 *   planner:import_check   … 下見。書き込まない。種類ごとの新規・更新・重複・非表示にする件数
 *   planner:import_records … 行の書き込み（UPSERT）。何度流しても同じ結果
 *   planner:import_finish  … 以前のアプリで消えた行を非表示にし、設定・週報・コンプライアンスを置き換える
 *
 * 移植元: backend/src/handlers/addTale.php（9/2 の取り込み）。項目の変換（日付・数値・JSON）は同じ。
 *
 * ⚠️⚠️ 決めごと（2026-10-28 の利用者の回答）
 *   ・同じポータル反響（反響番号 extId が同じで id が違う）が Dashboard にもあるときは、**以前のアプリを正**にする。
 *     Dashboard の行の id を以前のアプリの id に付け替えてから上書きする（変更履歴・通知・商談の紐づけの id も付け替える）
 *   ・以前のアプリで消えた行（前に取り込んだが今のファイルに無い）は**非表示**（論理削除）。行は消さない
 *     ⚠️ v2.2.225: 全面差し替え（hideScope = all）では、Dashboard で入った行もファイルに無ければ非表示（HideScope の注記）
 * ⚠️ Dashboard だけの列（show_dashboard・deleted_*・master_data_id・property_db_*）は取り込みで上書きしない。
 *   ⚠️ ただし、この取り込みで非表示にした行がファイルに戻ってきたら、表示に戻す。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 取り込む種類（本番アプリの SYNC_KINDS）。⚠️ docs は書類の「目録」だけ（中身のファイルは入っていない） */
const IMPORT_KINDS = [
  'deals', 'ledger', 'renewals', 'leads', 'buyLeads', 'docs', 'settlements', 'resales',
  'logs', 'notices', 'sellerReports', 'viewings', 'comments',
] as const;

/** この取り込みで非表示にした印（deleted_by）。以前のアプリから取り込んだ行で、今のファイルに無いもの */
const DELETED_BY = '以前のアプリで削除';
/** 全面差し替え（hideScope = all）で非表示にした、以前のアプリから来ていない行（Dashboard のポータル取り込みなど） */
const NOT_IN_APP = '以前のアプリに無い行';
/** ファイルの行がこれより少なければ、消えた行の非表示を断る（違うファイル・途中で切れたファイルの事故よけ） */
const MIN_RECORDS_FOR_HIDE = 300;
/** 非表示にする行が、以前のアプリから取り込んだ行のこの割合を超えたら断る */
const MAX_HIDE_RATIO = 0.2;

// ---------------------------------------------------------------------------
// 項目の変換（移植元: addTale.php）
// ---------------------------------------------------------------------------

/** 取り込む列。⚠️ Dashboard だけの列（show_dashboard・deleted_*・master_data_id・property_db_*）は入れない */
const IMPORT_COLUMNS = new Set([
  'no', 'freq', 'note', 'staff', 'category', 'phase', 'priority', 'type',
  'addr1', 'addr2', 'addr', 'property', 'targetProperty', 'propName',
  'price', 'budget', 'fee', 'feeManual',
  'portal', 'seller', 'buyer', 'customer', 'name', 'source', 'contact', 'phone', 'mail',
  'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
  'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
  'endReason', 'ledgerNo', 'ledgerId', 'extId', 'dealId', 'dealNo',
  'subStaff', 'subRatio', 'coBroker', 'delivery',
  'reformPrice', 'reformGp', 'reformNote', 'createdAt',
  'receivedDate', 'connectDate', 'contactDate', 'visitDate', 'viewDate', 'baikaiDate',
  'contractDate', 'settleDate', 'followDate', 'inputDate', 'renewDate',
  'applicationDate', 'nextDate', 'nextNote',
  'callDates', 'reason', 'timing',
  'status', 'costs', 'targetGp',
  'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset',
  'taxCheckDate', 'buyContractDate', 'buySettleDate',
  'listPrice', 'listDate',
  'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate',
  'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo',
  'title', 'body', 'read', 'by', 'data', 'updatedAt',
  'docDraft', 'docDraftAt', 'docDraftBy',
]);

/** DATE の列。⚠️ 日付として読めない自由入力（'最終買取へ' など）は NULL（Strict Mode で行ごと落ちるため） */
const DATE_COLUMNS = new Set([
  'reinsDate', 'contractDate', 'priceRevDate', 'lastReportDate', 'followDate',
  'settleDate', 'contactDate', 'visitDate', 'connectDate', 'receivedDate',
  'viewDate', 'inputDate', 'renewDate', 'baikaiDate', 'nextDate', 'expiry',
  'taxCheckDate', 'buyContractDate', 'buySettleDate', 'listDate',
  'sellContractDate', 'sellSettleDate',
]);
/** DATETIME の列 */
const DATETIME_COLUMNS = new Set(['docDraftAt']);
/**
 * 配列・オブジェクトを入れてよい列（JSON 文字列で持つ）。
 * ⚠️ それ以外の列に配列・オブジェクトが来たら列には入れない（原本 raw_data には残る）。
 *   例: 販売報告（sellerReports）の portal はポータルごとの数字の配列で、反響元の列（VARCHAR）に入らない（2026-10-28 に実データで発見）
 */
const JSON_COLUMNS = new Set(['callDates', 'costs', 'coBroker', 'data', 'docDraft']);
/** 数値の列。⚠️ 数値として読めない値（台帳の no に 'to' など）は NULL */
const INT_COLUMNS = new Set([
  'no', 'price', 'budget', 'fee', 'subRatio', 'entityNo', 'targetGp',
  'buyPrice', 'buyBuilding', 'listPrice', 'sellPrice', 'sellBuilding',
  'reformPrice', 'reformGp', 'feeManual', 'expiryFix', 'buyStockAsset', 'read',
]);

type SqlValue = string | number | null;

const toColumnValue = (key: string, value: unknown, warn: (m: string) => void): SqlValue => {
  if (value === '' || value === null || value === undefined) return null;
  if (DATE_COLUMNS.has(key)) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
    if (!m) warn(`${key}: 日付として読めない値を空にしました（${String(value).slice(0, 30)}）`);
    return m ? m[1] : null;
  }
  if (DATETIME_COLUMNS.has(key)) {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(String(value));
    return m ? `${m[1]} ${m[2]}` : null;
  }
  if (INT_COLUMNS.has(key)) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const n = Number(value);
    if (typeof value !== 'object' && String(value).trim() !== '' && Number.isFinite(n)) return Math.round(n);
    warn(`${key}: 数値として読めない値を空にしました（${String(value).slice(0, 30)}）`);
    return null;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
};

// ---------------------------------------------------------------------------
// 送られてくる行の確かめ
// ---------------------------------------------------------------------------

type ImportRecord = { id: string; kind: string; data: Record<string, unknown> };

const extIdOf = (data: Record<string, unknown>): string | null => {
  const v = data.extId;
  return v === null || v === undefined || String(v).trim() === '' ? null : String(v);
};

/**
 * 画面が文字列にして送った JSON を読み戻す。
 * ⚠️⚠️ 中身は**文字列で**受け取る。① の express_proxy.php は本文を PHP の配列に戻してから送り直すため、
 *   そのまま送ると空のオブジェクト {} が空の配列 [] に変わる（週報が空のとき・行の中の {} など）。
 */
const parseJsonText = (v: unknown): unknown => {
  if (typeof v !== 'string') return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
};

const readRecords = (raw: unknown, max: number): ImportRecord[] | string => {
  if (!Array.isArray(raw) || raw.length === 0) return '行がありません';
  if (raw.length > max) return `一度に送れるのは ${max} 件までです`;
  const out: ImportRecord[] = [];
  for (const r of raw) {
    if (!isObject(r)) return '行の形が正しくありません';
    const data = parseJsonText(r.json);
    if (!isObject(data)) return '行の中身（json）が正しくありません';
    const id = String(r.id ?? '').trim();
    const kind = String(r.kind ?? '');
    if (id === '' || id.length > 100) return 'id が無い行があります';
    if (!(IMPORT_KINDS as readonly string[]).includes(kind)) return `知らない種類です: ${kind}`;
    out.push({ id, kind, data });
  }
  return out;
};

/** 下見だけ（id・種類・反響番号）。⚠️ data は無くてよい */
const readKeys = (raw: unknown): { id: string; kind: string; extId: string | null }[] | string => {
  if (!Array.isArray(raw) || raw.length === 0) return '行がありません';
  if (raw.length > 50000) return '行が多すぎます';
  const out: { id: string; kind: string; extId: string | null }[] = [];
  for (const r of raw) {
    if (!isObject(r)) return '行の形が正しくありません';
    const id = String(r.id ?? '').trim();
    const kind = String(r.kind ?? '');
    if (id === '') return 'id が無い行があります';
    if (!(IMPORT_KINDS as readonly string[]).includes(kind)) return `知らない種類です: ${kind}`;
    const ext = r.extId === null || r.extId === undefined || String(r.extId).trim() === '' ? null : String(r.extId);
    out.push({ id, kind, extId: ext });
  }
  return out;
};

// ---------------------------------------------------------------------------
// 下見（planner:import_check）
// ---------------------------------------------------------------------------

type KindCount = { file: number; insert: number; update: number; merge: number; conflict: number; hide: number };

/**
 * 非表示にする範囲（v2.2.225）。
 *   all      … **全面差し替え**。ファイルに無い表示中の行はすべて非表示（Dashboard のポータル取り込み・Dashboard で入れた行も）
 *   imported … 以前のアプリから取り込んだ行（raw_data がある行）のうち、ファイルに無いものだけ（v2.2.224 の動き）
 * ⚠️ 2026-10-28 の利用者の指示: 「既存の brokerage_listings は無いものとして考えてよい」「明日から不動産企画係が使い始める」
 *   → 画面は all を既定にする。同じ反響が反響番号の作り方の違いで2行になっていた分（109件）もこれで消える
 */
type HideScope = 'all' | 'imported';
const hideScopeOf = (v: unknown): HideScope => (v === 'all' ? 'all' : 'imported');

/** 非表示にする候補（表示中の行） */
const visibleRows = (scope: HideScope) =>
  query<DynamicRow>(
    `SELECT id, kind FROM brokerage_listings
      WHERE ${scope === 'imported' ? 'raw_data IS NOT NULL AND ' : ''}kind IN (${IMPORT_KINDS.map(() => '?').join(', ')})
        AND (show_dashboard IS NULL OR show_dashboard <> 0)`,
    [...IMPORT_KINDS]
  );

/** 非表示にする行（今のファイルに無い） */
const rowsToHide = async (fileIds: Set<string>, scope: HideScope) => {
  const candidates = await visibleRows(scope);
  return { candidates, hide: candidates.filter((r) => !fileIds.has(String(r.id))) };
};

/** 非表示を断る理由（無ければ null） */
const hideRefusal = (fileCount: number, candidateCount: number, hideCount: number): string | null => {
  if (hideCount === 0) return null;
  if (fileCount < MIN_RECORDS_FOR_HIDE) return `ファイルの行が ${fileCount} 件しかありません。違うファイルの可能性があるため、非表示はしません`;
  if (hideCount > candidateCount * MAX_HIDE_RATIO) {
    return `非表示にする行が ${hideCount} 件（いま表示中の行の ${Math.round((hideCount / candidateCount) * 100)}%）と多すぎます。古いファイルや途中で切れたファイルの可能性があるため、非表示はしません`;
  }
  return null;
};

export const runImportCheck = async (body: Record<string, unknown>): Promise<Result> => {
  const keys = readKeys(body.records);
  if (typeof keys === 'string') return fail(400, keys);

  const ids = keys.map((k) => k.id);
  const exts = keys.map((k) => k.extId).filter((e): e is string => e !== null);
  const existing = await query<DynamicRow>(
    `SELECT id, extId FROM brokerage_listings WHERE id IN (${ids.map(() => '?').join(', ')})${exts.length ? ` OR extId IN (${exts.map(() => '?').join(', ')})` : ''}`,
    [...ids, ...exts]
  );
  const byId = new Set(existing.map((r) => String(r.id)));
  const idByExt = new Map(existing.filter((r) => r.extId !== null).map((r) => [String(r.extId), String(r.id)]));

  // ⚠️ ファイルの中で同じ反響番号が2行以上あるもの。書き込みのときに反響番号を空にして送る（runImportRecords の skipExt）
  const seen = new Map<string, number>();
  for (const e of keys.map((k) => k.extId)) if (e !== null) seen.set(e, (seen.get(e) ?? 0) + 1);
  const dupExtIds = [...seen].filter(([, n]) => n > 1).map(([e]) => e);
  const dupSet = new Set(dupExtIds);

  const counts: Record<string, KindCount> = {};
  const c = (kind: string) => (counts[kind] = counts[kind] ?? { file: 0, insert: 0, update: 0, merge: 0, conflict: 0, hide: 0 });
  for (const k of keys) {
    const kc = c(k.kind);
    kc.file++;
    const other = k.extId === null || dupSet.has(k.extId) ? undefined : idByExt.get(k.extId);
    if (other !== undefined && other !== k.id) {
      if (byId.has(k.id)) kc.conflict++; // 同じ反響が Dashboard に2行ある（片方を非表示にする）
      else kc.merge++; // Dashboard の行の id を付け替えて上書き
    } else if (byId.has(k.id)) kc.update++;
    else kc.insert++;
  }

  const { candidates, hide } = await rowsToHide(new Set(ids), hideScopeOf(body.hideScope));
  for (const r of hide) c(String(r.kind)).hide++;

  return ok({
    status: 'success',
    counts,
    total: keys.length,
    hide: hide.length,
    hideRefusal: hideRefusal(keys.length, candidates.length, hide.length),
    dupExtIds,
  });
};

// ---------------------------------------------------------------------------
// 書き込み（planner:import_records）
// ---------------------------------------------------------------------------

/** id を参照している列（付け替えのとき一緒に直す） */
const REF_COLUMNS = ['entityId', 'dealId', 'ledgerId'] as const;

/**
 * Dashboard の行（oldId）を以前のアプリの id（newId）に付け替える。参照している列も直す。
 * ⚠️ 1つのトランザクション（値は小さいので通常の execute でよい）
 */
const renameId = (oldId: string, newId: string) =>
  withTransaction(async (tx) => {
    await tx.execute('UPDATE brokerage_listings SET id = ? WHERE id = ?', [newId, oldId]);
    for (const col of REF_COLUMNS) {
      await tx.execute(`UPDATE brokerage_listings SET \`${col}\` = ? WHERE \`${col}\` = ?`, [newId, oldId]);
    }
  });

/** 同じ反響番号の別の行を非表示にし、番号を外す（UNIQUE の衝突よけ） */
const retireDuplicate = (id: string) =>
  executeLarge(
    `UPDATE brokerage_listings SET extId = NULL, show_dashboard = 0, deleted_at = NOW(), deleted_by = ?
      WHERE id = ?`,
    ['以前のアプリと重複', id]
  );

/**
 * body = { records: [{ id, kind, json: 行を文字列にした JSON }]（300件まで）, skipExt: 下見の dupExtIds }
 * ⚠️ skipExt の反響番号は、ファイルの中で2行以上にある。列の extId は空にして入れる（UNIQUE で別の行に上書きされないように）。原本には残る
 */
export const runImportRecords = async (body: Record<string, unknown>): Promise<Result> => {
  const records = readRecords(body.records, 300);
  if (typeof records === 'string') return fail(400, records);
  const skipExt = new Set(Array.isArray(body.skipExt) ? body.skipExt.map((v) => String(v)) : []);
  const extOf = (r: ImportRecord) => {
    const e = extIdOf(r.data);
    return e !== null && skipExt.has(e) ? null : e;
  };

  const ids = records.map((r) => r.id);
  const exts = records.map(extOf).filter((e): e is string => e !== null);
  const existing = await query<DynamicRow>(
    `SELECT id, extId FROM brokerage_listings WHERE id IN (${ids.map(() => '?').join(', ')})${exts.length ? ` OR extId IN (${exts.map(() => '?').join(', ')})` : ''}`,
    [...ids, ...exts]
  );
  const byId = new Set(existing.map((r) => String(r.id)));
  const idByExt = new Map(existing.filter((r) => r.extId !== null).map((r) => [String(r.extId), String(r.id)]));

  const result = { inserted: 0, updated: 0, unchanged: 0, merged: 0, retired: 0, failed: 0 };
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const rec of records) {
    const warn = (m: string) => { if (warnings.length < 200) warnings.push(`${rec.kind} ${rec.id} ${m}`); };
    try {
      // ① 同じ反響番号の別の行があれば、以前のアプリを正にする
      const ext = extOf(rec);
      const other = ext === null ? undefined : idByExt.get(ext);
      if (other !== undefined && other !== rec.id) {
        if (byId.has(rec.id)) {
          await retireDuplicate(other);
          result.retired++;
        } else {
          await renameId(other, rec.id);
          byId.add(rec.id);
          result.merged++;
        }
        if (ext !== null) idByExt.set(ext, rec.id);
      }

      // ② UPSERT。⚠️ 原本（raw_data）が 64KB を超えることがある（契約書の下書き）ため executeLarge
      const row: Record<string, SqlValue> = { id: rec.id, kind: rec.kind, raw_data: JSON.stringify(rec.data) };
      for (const [key, value] of Object.entries(rec.data)) {
        if (!IMPORT_COLUMNS.has(key)) continue;
        if (value !== null && typeof value === 'object' && !JSON_COLUMNS.has(key)) continue; // 原本にだけ残す（JSON_COLUMNS の注記）
        row[key] = toColumnValue(key, value, warn);
      }
      if (ext === null && 'extId' in row && row.extId !== null) {
        row.extId = null;
        warn('ファイルの中で反響番号が重複しているため、反響番号の列は空にしました（原本には残っています）');
      }
      const cols = Object.keys(row);
      const updates = cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`);
      // ⚠️ この取り込みで非表示にした行が戻ってきたら表示に戻す。⚠️ deleted_by は最後に（左から順に評価される）
      updates.push(
        'show_dashboard = IF(deleted_by IN (?, ?), 1, show_dashboard)',
        'deleted_at = IF(deleted_by IN (?, ?), NULL, deleted_at)',
        'deleted_by = IF(deleted_by IN (?, ?), NULL, deleted_by)'
      );
      const res = await executeLarge(
        `INSERT INTO brokerage_listings (${cols.map((c) => `\`${c}\``).join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
        [...cols.map((c) => row[c]), DELETED_BY, NOT_IN_APP, DELETED_BY, NOT_IN_APP, DELETED_BY, NOT_IN_APP]
      );
      // ⚠️ mysql2 は既定で FOUND_ROWS を付けるので、変わらない行も affectedRows = 1（新規と同じ）になる。
      //   新規かどうかは、書く前に同じ id の行があったかで決める。あった行は 2 = 更新、それ以外 = 変わらない
      if (!byId.has(rec.id)) {
        result.inserted++;
        byId.add(rec.id);
      } else if (res.affectedRows === 2) result.updated++;
      else result.unchanged++;
    } catch (e) {
      result.failed++;
      if (errors.length < 50) errors.push(`${rec.kind} ${rec.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  return ok({ status: 'success', ...result, warnings, errors });
};

// ---------------------------------------------------------------------------
// 仕上げ（planner:import_finish）
// ---------------------------------------------------------------------------

/**
 * body = { ids: ファイルの全行の id, hide: true/false, hideScope: 'all' | 'imported', settingsJson, weeklyJson, complianceJson（それぞれ文字列にした JSON。parseJsonText の注記） }
 * ⚠️ 行の書き込みが全部終わってから呼ぶ（途中で呼ぶと、まだ書いていない行を「消えた」と判断しないよう ids はファイル全体）
 */
export const runImportFinish = async (body: Record<string, unknown>): Promise<Result> => {
  const ids = Array.isArray(body.ids) ? body.ids.map((v) => String(v)) : [];
  if (ids.length === 0) return fail(400, 'ファイルの行の id がありません');

  let hidden = 0;
  let hideSkipped: string | null = null;
  if (body.hide === true) {
    const { candidates, hide } = await rowsToHide(new Set(ids), hideScopeOf(body.hideScope));
    hideSkipped = hideRefusal(ids.length, candidates.length, hide.length);
    if (hideSkipped === null) {
      for (let i = 0; i < hide.length; i += 500) {
        const chunk = hide.slice(i, i + 500).map((r) => String(r.id));
        // ⚠️ 以前のアプリから取り込んだ行（raw_data あり）は「以前のアプリで削除」、それ以外は「以前のアプリに無い行」
        const res = await executeLarge(
          `UPDATE brokerage_listings
              SET show_dashboard = 0, deleted_at = NOW(), deleted_by = IF(raw_data IS NULL, ?, ?)
            WHERE id IN (${chunk.map(() => '?').join(', ')})`,
          [NOT_IN_APP, DELETED_BY, ...chunk]
        );
        hidden += res.affectedRows;
      }
    }
  }

  // 設定・週報・コンプライアンスは丸ごと置き換える（形は以前のアプリと同じ。features/realty/state.ts）
  const states: string[] = [];
  for (const [key, check] of [['settings', isObject], ['weekly', isObject], ['compliance', Array.isArray]] as const) {
    if (body[`${key}Json`] === undefined) continue;
    const value = parseJsonText(body[`${key}Json`]);
    if (!check(value)) return fail(400, `${key} の形が正しくありません`);
    await executeLarge(
      'INSERT INTO app_state (`key`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)',
      [key, JSON.stringify(value)]
    );
    states.push(key);
  }
  return ok({ status: 'success', hidden, hideSkipped, states });
};
