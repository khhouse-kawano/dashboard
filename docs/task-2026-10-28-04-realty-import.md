# 2026-10-28 不動産企画係: 以前のアプリのデータを取得・アップロードする（v2.2.224）

## 依頼
- 「次にデータを最新にするのでアプリケーションから取得する方法とアップロードする方法を。可能であればエージェントが関数や sql 書いて欲しい」
- 途中: 「そのままローカルのテーブルは差し替えてよい。本番もアプリケーションのデータと差し替える予定」

## 決めたこと
- **取得**: 以前のアプリの「📥 バックアップを保存（JSON・書類除く）」（exportJson。アプリの中身 S をそのまま）を使う。Supabase の鍵は扱わない
  - 中身は 9/2 に取り込んだ data.json（Supabase records `[{id, kind, data}]`）と同じ形: `S[kind]` の配列 = records の kind（SYNC_KINDS の13種類）、`S.settings / weekly / compliance` = app_state
- **アップロード**: 不動産企画係の設定画面の一番下に「以前のアプリのデータを取り込む」（マスターだけ）。② の3段（下見 → 200件ずつ書き込み → 仕上げ）
- 利用者の回答（AskUserQuestion）
  - 同じポータル反響が両方にある（extId が同じで id が違う）→ **以前のアプリを正**。Dashboard の行の id を付け替え、参照（entityId・dealId・ledgerId）も付け替えてから上書き
  - 以前のアプリで消えた行 → **非表示**（論理削除）。対象は raw_data がある行（以前のアプリから取り込んだ行）だけ
- 安全装置: ファイルの行が300件未満、または非表示が取り込み済みの行の20%超なら非表示しない
- ファイルの中で反響番号が重複 → 2行とも反響番号の列を空にして入れる（UNIQUE で別の行に上書きされないように）
- 変換は addTale.php と同じ（日付として読めない値・数値として読めない値は空にして警告）。docDraftAt（DATETIME）も変換
- ⚠️ 本番の取り込みの前後用の SQL を3本（控え・確認・戻す）

## 途中で見つけて直したこと
- **件数の数え方**: mysql2 は既定で FOUND_ROWS を付けるため、ON DUPLICATE KEY UPDATE で「変わらない」行も affectedRows = 1（新規と同じ）。→ 書く前に同じ id があったかで新規を判断
- **① を通ると {} が [] になる**: express_proxy.php は本文を PHP の配列に戻して json_encode し直す。空のオブジェクトが空の配列になり、空の週報（{}）で仕上げが 400 になる・行の中の {} が変わる。→ 行・設定・週報・コンプライアンスは**文字列にした JSON** で送り、② で JSON.parse する
- テストで別のサーバーがポート 3000 を使っていて開発サーバーに届かなかった → 利用者が停止

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | **importer.ts（新規）** | runImportCheck / runImportRecords / runImportFinish |
| backend-express/src/gateway | registry.ts | planner:import_check / import_records / import_finish（auth: 'master'）・realtyMaster |
| backend/src/core | express_proxy.php | 上の3つを両方の一覧に |
| frontend/src/components/realty/settings | **RealtyImport.tsx（新規）** | 取り込みのカード |
| frontend/src/components/realty/settings | RealtySettings.tsx | マスターのときだけ RealtyImport。取り込み後に読み直す（reload） |
| frontend/src/components/realty/common | realtyState.ts | post・ApiBody を export |
| frontend/src/utils | version.ts | 2.2.224 |
| backend/scripts/sql | **2026-10-28_realty_import_1_backup.sql / _2_check.sql / _3_restore.sql（新規）** | 控え・確認・戻す（① phpMyAdmin） |
| backend/scripts/sql | 2026-10-28_update_log_2.2.224.sql（新規） | 更新履歴＋記事。ローカルに流した（no=324） |
| backend/scripts/guide/articles/common | screen-270.md | 「以前のアプリのデータを取り込む（マスターだけ）」の節 |

## 業務ガイドの記事
- 「設定（不動産企画係）」に「以前のアプリのデータを取り込む（マスターだけ）」の節を追加（手順4つ・決めごと・注意）。要約にも追記

## 確認したこと
- ① を通してトークン無しで3つとも 401、一般の人（不動産企画係）は 403、一般の人には取り込みのカードが出ない
- 9/2 の書き出しから作ったテスト用のバックアップ（1167件）に、次を混ぜて Playwright で取り込み
  - 消えた行・反響番号が Dashboard だけの反響と同じ新しい行・Dashboard に2行になる反響・ファイル内の反響番号の重複・読めない日付と数値・新しい種類（comments）・120KB の契約書の下書き・空のオブジェクト・空の週報
  - 1回目: 新規4・更新7・変わらない1156・そろえた1・重複を非表示1・消えた行を非表示1（5秒）。確認 SQL で id の付け替え（xmtcbvzte8cpx01 → t224merge）・非表示の印・{} のまま入ったこと・設定の置き換えを確認
  - 2回目（同じファイル）: 新規0・更新0・変わらない1167・ほか0（何度流しても同じ）
- 安全装置: 10件のファイルでは非表示しない（下見・仕上げとも）、知らない種類 400、設定の形違い 400
- 控え・確認・戻す の SQL をローカルで流した。戻したあと 1309件・テスト行0・app_state の大きさと更新日時がテスト前と同じ
- テスト用の担当者・控えのテーブルは消した
- 型チェック（②）・本番ビルド（フロント）
- 整理: IMPORT_KINDS の export を外した → もう一度画面と API のテストを通した

## コード

### backend-express/src/features/realty/importer.ts（新規・全文）
```
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
 *     ⚠️ 対象は「以前のアプリから取り込んだ行」（raw_data がある行）だけ。Dashboard で入った行は触らない
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

/** この取り込みで非表示にした印（deleted_by） */
const DELETED_BY = '以前のアプリで削除';
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

/** 以前のアプリから取り込んだ、表示中の行（非表示にする候補） */
const importedVisibleRows = () =>
  query<DynamicRow>(
    `SELECT id, kind FROM brokerage_listings
      WHERE raw_data IS NOT NULL AND kind IN (${IMPORT_KINDS.map(() => '?').join(', ')})
        AND (show_dashboard IS NULL OR show_dashboard <> 0)`,
    [...IMPORT_KINDS]
  );

/** 非表示にする行（以前のアプリから取り込んだが、今のファイルに無い） */
const rowsToHide = async (fileIds: Set<string>) => {
  const imported = await importedVisibleRows();
  return { imported, hide: imported.filter((r) => !fileIds.has(String(r.id))) };
};

/** 非表示を断る理由（無ければ null） */
const hideRefusal = (fileCount: number, importedCount: number, hideCount: number): string | null => {
  if (hideCount === 0) return null;
  if (fileCount < MIN_RECORDS_FOR_HIDE) return `ファイルの行が ${fileCount} 件しかありません。違うファイルの可能性があるため、消えた行の非表示はしません`;
  if (hideCount > importedCount * MAX_HIDE_RATIO) {
    return `非表示にする行が ${hideCount} 件（以前のアプリから取り込んだ行の ${Math.round((hideCount / importedCount) * 100)}%）と多すぎます。古いファイルや途中で切れたファイルの可能性があるため、非表示はしません`;
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

  const { imported, hide } = await rowsToHide(new Set(ids));
  for (const r of hide) c(String(r.kind)).hide++;

  return ok({
    status: 'success',
    counts,
    total: keys.length,
    hide: hide.length,
    hideRefusal: hideRefusal(keys.length, imported.length, hide.length),
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
        if (IMPORT_COLUMNS.has(key)) row[key] = toColumnValue(key, value, warn);
      }
      if (ext === null && 'extId' in row && row.extId !== null) {
        row.extId = null;
        warn('ファイルの中で反響番号が重複しているため、反響番号の列は空にしました（原本には残っています）');
      }
      const cols = Object.keys(row);
      const updates = cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`);
      // ⚠️ この取り込みで非表示にした行が戻ってきたら表示に戻す。⚠️ deleted_by は最後に（左から順に評価される）
      updates.push(
        'show_dashboard = IF(deleted_by <=> ?, 1, show_dashboard)',
        'deleted_at = IF(deleted_by <=> ?, NULL, deleted_at)',
        'deleted_by = IF(deleted_by <=> ?, NULL, deleted_by)'
      );
      const res = await executeLarge(
        `INSERT INTO brokerage_listings (${cols.map((c) => `\`${c}\``).join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
        [...cols.map((c) => row[c]), DELETED_BY, DELETED_BY, DELETED_BY]
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
 * body = { ids: ファイルの全行の id, hide: true/false, settingsJson, weeklyJson, complianceJson（それぞれ文字列にした JSON。parseJsonText の注記） }
 * ⚠️ 行の書き込みが全部終わってから呼ぶ（途中で呼ぶと、まだ書いていない行を「消えた」と判断しないよう ids はファイル全体）
 */
export const runImportFinish = async (body: Record<string, unknown>): Promise<Result> => {
  const ids = Array.isArray(body.ids) ? body.ids.map((v) => String(v)) : [];
  if (ids.length === 0) return fail(400, 'ファイルの行の id がありません');

  let hidden = 0;
  let hideSkipped: string | null = null;
  if (body.hide === true) {
    const { imported, hide } = await rowsToHide(new Set(ids));
    hideSkipped = hideRefusal(ids.length, imported.length, hide.length);
    if (hideSkipped === null) {
      for (let i = 0; i < hide.length; i += 500) {
        const chunk = hide.slice(i, i + 500).map((r) => String(r.id));
        const res = await executeLarge(
          `UPDATE brokerage_listings SET show_dashboard = 0, deleted_at = NOW(), deleted_by = ?
            WHERE id IN (${chunk.map(() => '?').join(', ')})`,
          [DELETED_BY, ...chunk]
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
```

### frontend/src/components/realty/settings/RealtyImport.tsx（新規・全文）
```
import React, { useState } from 'react';
import { post } from '../common/realtyState';

/**
 * 以前のアプリのデータを取り込む（不動産企画係の設定画面の一番下。v2.2.224。マスターだけ）。
 *
 * ⚠️ 元のファイル: 以前のアプリの「⚙ 設定・データ管理 → 🔄 サーバーから再取得 → 📥 バックアップを保存（JSON・書類除く）」
 * ⚠️ 流れ: ファイルを読む → 下見（planner:import_check）→ 200件ずつ書き込み（import_records）→ 仕上げ（import_finish）
 *   処理は ② の features/realty/importer.ts（決めごともそこに書いてある）。何度流しても同じ結果。
 */

/** 取り込む配列（以前のアプリの SYNC_KINDS）。⚠️ ② の IMPORT_KINDS と同じ */
const KINDS: { key: string; label: string }[] = [
    { key: 'leads', label: '売り反響' },
    { key: 'buyLeads', label: '買い反響' },
    { key: 'deals', label: '商談案件' },
    { key: 'ledger', label: '媒介台帳' },
    { key: 'resales', label: '買取再販' },
    { key: 'renewals', label: '媒介の更新' },
    { key: 'settlements', label: '決済' },
    { key: 'sellerReports', label: '販売報告' },
    { key: 'viewings', label: '内見記録' },
    { key: 'comments', label: 'コメント' },
    { key: 'docs', label: '書類の目録' },
    { key: 'logs', label: '変更履歴' },
    { key: 'notices', label: '通知' },
];

type FileRecord = { id: string; kind: string; data: Record<string, unknown> };
type Parsed = {
    name: string;
    records: FileRecord[];
    settings: Record<string, unknown>;
    weekly: Record<string, unknown>;
    compliance: unknown[];
};
type KindCount = { file: number; insert: number; update: number; merge: number; conflict: number; hide: number };
type Check = { counts: Record<string, KindCount>; total: number; hide: number; hideRefusal: string | null; dupExtIds: string[] };
type Totals = { inserted: number; updated: number; unchanged: number; merged: number; retired: number; failed: number };

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** バックアップのファイルを行にする。⚠️ 完全バックアップ（書類込み）は中の app だけ使う */
const parseBackup = (name: string, text: string): Parsed => {
    let d: unknown;
    try {
        d = JSON.parse(text);
    } catch {
        throw new Error('JSON として読めません。以前のアプリの「バックアップを保存（JSON・書類除く）」のファイルを選んでください');
    }
    if (isObject(d) && isObject(d.app)) d = d.app;
    if (!isObject(d) || !isObject(d.settings) || !Array.isArray(d.deals) || !Array.isArray(d.ledger)) {
        throw new Error('以前のアプリのバックアップではありません（settings・deals・ledger がありません）');
    }
    const src = d;
    const records: FileRecord[] = [];
    for (const { key } of KINDS) {
        const list = src[key];
        if (!Array.isArray(list)) continue;
        for (const r of list) {
            if (isObject(r) && r.id !== null && r.id !== undefined && String(r.id) !== '') records.push({ id: String(r.id), kind: key, data: r });
        }
    }
    return {
        name,
        records,
        settings: src.settings as Record<string, unknown>,
        weekly: isObject(src.weekly) ? src.weekly : {},
        compliance: Array.isArray(src.compliance) ? src.compliance : [],
    };
};

/**
 * ② へ送る1行。⚠️ 中身は**文字列にした JSON** で送る。
 *   ① が本文を PHP の配列に戻して送り直すため、そのままだと空のオブジェクト {} が [] に変わる（② の importer.ts の parseJsonText）
 */
type SendRecord = { id: string; kind: string; json: string };

/** 送る束に分ける（200件まで・およそ 2MB まで。⚠️ 契約書の下書きで1行が大きいことがある） */
const batchesOf = (records: FileRecord[]): SendRecord[][] => {
    const out: SendRecord[][] = [];
    let cur: SendRecord[] = [];
    let size = 0;
    for (const rec of records) {
        const r: SendRecord = { id: rec.id, kind: rec.kind, json: JSON.stringify(rec.data) };
        const s = r.json.length;
        if (cur.length > 0 && (cur.length >= 200 || size + s > 2_000_000)) {
            out.push(cur);
            cur = [];
            size = 0;
        }
        cur.push(r);
        size += s;
    }
    if (cur.length) out.push(cur);
    return out;
};

const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [check, setCheck] = useState<Check | null>(null);
    const [hide, setHide] = useState(true);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<{ totals: Totals; hidden: number; hideSkipped: string | null; warnings: string[]; errors: string[] } | null>(null);

    const reset = () => { setParsed(null); setCheck(null); setResult(null); setProgress(null); };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        reset();
        setBusy(true);
        try {
            const p = parseBackup(f.name, await f.text());
            const c = await post('import_check', {
                records: p.records.map(r => ({ id: r.id, kind: r.kind, extId: r.data.extId ?? null })),
            });
            setParsed(p);
            setCheck(c as unknown as Check);
            setHide(!c.hideRefusal);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const run = async () => {
        if (!parsed || !check) return;
        const hideNote = hide && check.hide > 0 ? `\n以前のアプリで消えた ${check.hide} 件を非表示にします。` : '';
        if (!window.confirm(`${parsed.records.length} 件を取り込み、設定・週次行動計画・コンプライアンスを以前のアプリの内容で置き換えます。${hideNote}\nよろしいですか？`)) return;
        setBusy(true);
        const totals: Totals = { inserted: 0, updated: 0, unchanged: 0, merged: 0, retired: 0, failed: 0 };
        const warnings: string[] = [];
        const errors: string[] = [];
        try {
            const batches = batchesOf(parsed.records);
            let done = 0;
            setProgress({ done, total: parsed.records.length });
            for (const b of batches) {
                const r = await post('import_records', { records: b, skipExt: check.dupExtIds });
                for (const k of Object.keys(totals) as (keyof Totals)[]) totals[k] += Number(r[k]) || 0;
                warnings.push(...((r.warnings as string[]) ?? []));
                errors.push(...((r.errors as string[]) ?? []));
                done += b.length;
                setProgress({ done, total: parsed.records.length });
            }
            const fin = await post('import_finish', {
                ids: parsed.records.map(r => r.id),
                hide: hide && !check.hideRefusal,
                settingsJson: JSON.stringify(parsed.settings),
                weeklyJson: JSON.stringify(parsed.weekly),
                complianceJson: JSON.stringify(parsed.compliance),
            });
            setResult({ totals, hidden: Number(fin.hidden) || 0, hideSkipped: (fin.hideSkipped as string | null) ?? null, warnings, errors });
            onFinished();
        } catch (err) {
            // ⚠️ 途中で止まっても、もう一度同じファイルを流せば続きから同じ結果になる
            alert(`取り込みが途中で止まりました: ${(err as Error).message}\n同じファイルでもう一度取り込んでください（何度流しても同じ結果になります）。`);
            setResult({ totals, hidden: 0, hideSkipped: '途中で止まったため、非表示と設定の置き換えはしていません', warnings, errors });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>以前のアプリのデータを取り込む</h3>
                <span className="rlt-note">マスターだけに表示しています</span>
            </div>
            <div className="rlt-body">
                <ol className="rlt-sub" style={{ paddingLeft: 18, marginBottom: 10 }}>
                    <li>以前のアプリの「⚙ 設定・データ管理」で「🔄 サーバーから再取得」を押す</li>
                    <li>「📥 バックアップを保存（JSON・書類除く）」を押す</li>
                    <li>保存されたファイル（営業管理バックアップ_日付.json）をここで選ぶ → 件数を確かめて「取り込む」</li>
                </ol>
                <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy} />

                {check && parsed && (
                    <div style={{ marginTop: 12 }}>
                        <p className="rlt-sub">ファイル：{parsed.name}（{check.total} 件）</p>
                        <div className="rlt-tblwrap">
                            <table className="rlt-tbl" style={{ width: 'auto' }}>
                                <thead><tr>
                                    <th>種類</th><th className="r">ファイル</th><th className="r">新規</th><th className="r">更新</th>
                                    <th className="r" title="同じ反響番号の行が Dashboard にある。以前のアプリの内容にそろえる">そろえる</th>
                                    <th className="r" title="同じ反響の行が Dashboard に2行ある。Dashboard 側を非表示にする">重複</th>
                                    <th className="r" title="以前のアプリで消えた行">非表示</th>
                                </tr></thead>
                                <tbody>
                                    {KINDS.filter(k => check.counts[k.key]).map(k => {
                                        const c = check.counts[k.key];
                                        return (
                                            <tr key={k.key}>
                                                <td>{k.label}</td><td className="r">{c.file}</td><td className="r">{c.insert}</td><td className="r">{c.update}</td>
                                                <td className="r">{c.merge}</td><td className="r">{c.conflict}</td><td className="r">{c.hide}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {check.dupExtIds.length > 0 && (
                            <p className="rlt-sub">ファイルの中で反響番号が重複している反響が {check.dupExtIds.length} 件あります。その反響は反響番号を空にして取り込みます。</p>
                        )}
                        {check.hideRefusal && <div className="rlt-alert" style={{ marginTop: 8 }}>{check.hideRefusal}</div>}
                        <label className="rlt-sub" style={{ display: 'block', margin: '8px 0' }}>
                            <input type="checkbox" checked={hide} disabled={!!check.hideRefusal || busy} onChange={e => setHide(e.target.checked)} />{' '}
                            以前のアプリで消えた行（{check.hide} 件）を非表示にする（行は消さないので戻せます）
                        </label>
                        <p className="rlt-sub">設定・週次行動計画・コンプライアンスは、以前のアプリの内容で置き換えます。</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="rlt-btn" onClick={run} disabled={busy}>取り込む</button>
                            <button className="rlt-btn sec" onClick={reset} disabled={busy}>やめる</button>
                        </div>
                    </div>
                )}

                {progress && (
                    <p className="rlt-sub" style={{ marginTop: 8 }}>
                        書き込み {progress.done} / {progress.total} 件{busy ? '…' : ''}
                    </p>
                )}

                {result && (
                    <div style={{ marginTop: 8 }}>
                        <p className="rlt-saved">
                            新規 {result.totals.inserted}・更新 {result.totals.updated}・変わらない {result.totals.unchanged}・
                            そろえた {result.totals.merged}・重複を非表示 {result.totals.retired}・消えた行を非表示 {result.hidden}
                        </p>
                        {result.hideSkipped && <div className="rlt-alert">{result.hideSkipped}</div>}
                        {result.totals.failed > 0 && (
                            <div className="rlt-alert" style={{ background: '#f8d7da', borderColor: '#f1aeb5', color: '#842029' }}>
                                {result.totals.failed} 件を取り込めませんでした。
                                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{result.errors.slice(0, 20).map(m => <li key={m}>{m}</li>)}</ul>
                            </div>
                        )}
                        {result.warnings.length > 0 && (
                            <details className="rlt-sub">
                                <summary>直して取り込んだ値（{result.warnings.length} 件）</summary>
                                <ul style={{ paddingLeft: 18 }}>{result.warnings.slice(0, 100).map(m => <li key={m}>{m}</li>)}</ul>
                            </details>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RealtyImport;
```

### backend/scripts/sql/2026-10-28_realty_import_1_backup.sql（新規・全文）
```
-- =====================================================================
-- 不動産企画係: 以前のアプリのデータを取り込む**前に**流す（控えを作る）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 取り込みのたびに流す。⚠️ 前回の控えは消して作り直す（控えのテーブルだけを消す。本物の表には触らない）
-- ⚠️ 戻すときは 2026-10-28_realty_import_3_restore.sql
-- =====================================================================

DROP TABLE IF EXISTS brokerage_listings_bk_import;
CREATE TABLE brokerage_listings_bk_import LIKE brokerage_listings;
INSERT INTO brokerage_listings_bk_import SELECT * FROM brokerage_listings;

DROP TABLE IF EXISTS app_state_bk_import;
CREATE TABLE app_state_bk_import LIKE app_state;
INSERT INTO app_state_bk_import SELECT * FROM app_state;

-- 確認: 2行とも「本物」と「控え」の件数が同じならよい
SELECT 'brokerage_listings' AS 表, (SELECT COUNT(*) FROM brokerage_listings) AS 本物, (SELECT COUNT(*) FROM brokerage_listings_bk_import) AS 控え
UNION ALL
SELECT 'app_state', (SELECT COUNT(*) FROM app_state), (SELECT COUNT(*) FROM app_state_bk_import);
```

### backend/scripts/sql/2026-10-28_realty_import_2_check.sql（新規・全文）
```
-- =====================================================================
-- 不動産企画係: 以前のアプリのデータを取り込んだ**あと**の確認（読むだけ。何も変えない）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 先に 2026-10-28_realty_import_1_backup.sql で控えを作ってあること（控えと比べる）
-- =====================================================================

-- 1. 種類ごとの件数（取り込み前 → 取り込み後）。表示中・非表示に分けて
SELECT k.kind AS 種類,
       IFNULL(b.cnt, 0) AS 取り込み前,
       IFNULL(a.cnt, 0) AS 取り込み後,
       IFNULL(a.visible, 0) AS うち表示中,
       IFNULL(a.hidden_import, 0) AS うち以前のアプリで削除,
       IFNULL(a.hidden_dup, 0) AS うち重複で非表示
  FROM (SELECT DISTINCT kind FROM brokerage_listings) k
  LEFT JOIN (SELECT kind, COUNT(*) cnt FROM brokerage_listings_bk_import GROUP BY kind) b ON b.kind = k.kind
  LEFT JOIN (SELECT kind, COUNT(*) cnt,
                    SUM(show_dashboard IS NULL OR show_dashboard <> 0) visible,
                    SUM(deleted_by = '以前のアプリで削除') hidden_import,
                    SUM(deleted_by = '以前のアプリと重複') hidden_dup
               FROM brokerage_listings GROUP BY kind) a ON a.kind = k.kind
 ORDER BY k.kind;

-- 2. 中身が変わった行の数（種類ごと）
SELECT n.kind AS 種類, COUNT(*) AS 変わった行
  FROM brokerage_listings n
  JOIN brokerage_listings_bk_import o ON o.internal_id = n.internal_id
 WHERE NOT (o.raw_data <=> n.raw_data) OR NOT (o.id <=> n.id) OR NOT (o.show_dashboard <=> n.show_dashboard)
 GROUP BY n.kind;

-- 3. id をそろえた行（Dashboard のポータル取り込みの行を、以前のアプリの id に付け替えた）
SELECT n.kind AS 種類, o.id AS 前のid, n.id AS 今のid, n.extId AS 反響番号, n.name AS 名前
  FROM brokerage_listings n
  JOIN brokerage_listings_bk_import o ON o.internal_id = n.internal_id
 WHERE o.id <> n.id;

-- 4. 設定・週報・コンプライアンスの大きさと更新日時（前 → 後）
SELECT n.`key`, LENGTH(o.`data`) AS 前の大きさ, LENGTH(n.`data`) AS 今の大きさ, o.updated_at AS 前の更新, n.updated_at AS 今の更新
  FROM app_state n LEFT JOIN app_state_bk_import o ON o.`key` = n.`key`;

-- 5. 最新の受信日（以前のアプリの最近の入力が入ったか）
SELECT kind AS 種類, MAX(receivedDate) AS 最新の受信日, MAX(contractDate) AS 最新の契約日
  FROM brokerage_listings
 WHERE show_dashboard IS NULL OR show_dashboard <> 0
 GROUP BY kind;
```

### backend/scripts/sql/2026-10-28_realty_import_3_restore.sql（新規・全文）
```
-- =====================================================================
-- 不動産企画係: 取り込みを**取り消す**（控えに戻す）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ 取り込みのあとに Dashboard で入った・直した内容（ポータルの取り込みを含む）も、控えの時点に戻る。
--   取り込みの結果がおかしいときだけ使う。流す前に開発に相談すること
-- ⚠️ 控え（2026-10-28_realty_import_1_backup.sql で作ったもの）が無いときは、1文目でエラーになって止まる（phpMyAdmin はエラーで止まる）
-- ⚠️ 控えが空のときは、DELETE の条件で何も消さない
-- =====================================================================

SELECT COUNT(*) AS 控えの件数 FROM brokerage_listings_bk_import;

START TRANSACTION;
DELETE FROM brokerage_listings WHERE (SELECT COUNT(*) FROM brokerage_listings_bk_import) > 0;
INSERT INTO brokerage_listings SELECT * FROM brokerage_listings_bk_import;
DELETE FROM app_state WHERE (SELECT COUNT(*) FROM app_state_bk_import) > 0;
INSERT INTO app_state SELECT * FROM app_state_bk_import WHERE NOT EXISTS (SELECT 1 FROM app_state);
COMMIT;

-- 確認: 本物と控えの件数が同じならよい
SELECT (SELECT COUNT(*) FROM brokerage_listings) AS 本物, (SELECT COUNT(*) FROM brokerage_listings_bk_import) AS 控え;
```

### 直したファイル（差分）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 267b42dc..d3e9242b 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -172,6 +172,7 @@ import {
 } from '../features/realty';
 import type { Result as RealtyResult } from '../features/realty';
 import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
+import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
 import type { AuthenticatedStaff } from '../types/staff';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
@@ -1217,6 +1218,18 @@ register({ request: 'planner', roll: 'settings', summary: '【書き込み】不
 register({ request: 'planner', roll: 'weekly', summary: '【書き込み】不動産企画係: 週次行動計画のセルを保存', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runPlannerWeekly(s, body)) });
 register({ request: 'planner', roll: 'compliance', summary: '【書き込み】不動産企画係: コンプライアンスの入力を保存・クリア', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runPlannerCompliance(body)) });
 
+// ⚠️ v2.2.224 新規（② だけ）。以前の不動産企画係アプリのバックアップの取り込み。features/realty/importer.ts
+//   ⚠️ マスターだけ（auth: 'master'）。担当事業は問わない（マスターは全事業）
+const realtyMaster = (run: (body: GatewayContext['body']) => Promise<RealtyResult>) =>
+  async (ctx: GatewayContext) => {
+    const result = await run(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  };
+register({ request: 'planner', roll: 'import_check', summary: '不動産企画係: 以前のアプリのバックアップの下見（書き込まない）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runImportCheck) });
+register({ request: 'planner', roll: 'import_records', summary: '【書き込み】不動産企画係: 以前のアプリのバックアップの行を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runImportRecords) });
+register({ request: 'planner', roll: 'import_finish', summary: '【書き込み】不動産企画係: 取り込みの仕上げ（消えた行の非表示・設定の置き換え）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runImportFinish) });
+
 // ---------------------------------------------------------------------------
 // Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 0d10b462..90fcaebe 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -153,6 +153,10 @@ function expressProxyRequests(): array
         'planner:settings',
         'planner:weekly',
         'planner:compliance',
+        // ⚠️ v2.2.224。以前のアプリのバックアップの取り込み（マスターだけ）。⚠️ ② だけ。expressProxyExclusive() にも入れてある
+        'planner:import_check',
+        'planner:import_records',
+        'planner:import_finish',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -806,6 +810,10 @@ function expressProxyExclusive(): array
         'planner:settings',
         'planner:weekly',
         'planner:compliance',
+        // v2.2.224 新規。以前のアプリのバックアップの取り込み（マスターだけ）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'planner:import_check',
+        'planner:import_records',
+        'planner:import_finish',
 
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
diff --git a/frontend/src/components/realty/common/realtyState.ts b/frontend/src/components/realty/common/realtyState.ts
index d9174dc9..28c313a7 100644
--- a/frontend/src/components/realty/common/realtyState.ts
+++ b/frontend/src/components/realty/common/realtyState.ts
@@ -53,10 +53,10 @@ export type RealtyState = {
 };
 
 /** ② が返す本文。⚠️ 失敗のときは status = 'error' と message */
-type ApiBody = { status?: string; message?: string; [key: string]: unknown };
+export type ApiBody = { status?: string; message?: string; [key: string]: unknown };
 
-/** 失敗のときは ② のメッセージを投げる（画面は alert で出す） */
-const post = async (roll: string, body: Record<string, unknown> = {}): Promise<ApiBody> => {
+/** request = planner の roll を呼ぶ。失敗のときは ② のメッセージを投げる（画面は alert で出す） */
+export const post = async (roll: string, body: Record<string, unknown> = {}): Promise<ApiBody> => {
     try {
         const res = await apiClient.post<ApiBody>('', { request: 'planner', roll, ...body });
         if (res.data?.status === 'error') throw new Error(res.data.message || '保存に失敗しました');
diff --git a/frontend/src/components/realty/settings/RealtySettings.tsx b/frontend/src/components/realty/settings/RealtySettings.tsx
index 00f28a3c..b645c61b 100644
--- a/frontend/src/components/realty/settings/RealtySettings.tsx
+++ b/frontend/src/components/realty/settings/RealtySettings.tsx
@@ -1,4 +1,6 @@
-import React, { useCallback, useEffect, useRef, useState } from 'react';
+import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
+import AuthContext from '../../../context/AuthContext';
+import RealtyImport from './RealtyImport';
 import {
     REALTY_CSS, loadRealtyState, newId, saveRealtySettings,
 } from '../common/realtyState';
@@ -56,13 +58,17 @@ const RealtySettings: React.FC = () => {
     // ⚠️ 打っただけで離れていない項目。離れたときにだけ送る（打つたびに送らない）
     const dirty = useRef<Set<Key>>(new Set());
 
-    useEffect(() => {
+    const { authority } = useContext(AuthContext);
+
+    const reload = useCallback(() => {
         loadRealtyState()
-            .then(st => { latest.current = st.settings; setSettings(st.settings); })
+            .then(st => { latest.current = st.settings; dirty.current.clear(); setSettings(st.settings); })
             .catch((e: Error) => alert(`設定を読み込めませんでした: ${e.message}`))
             .finally(() => setLoading(false));
     }, []);
 
+    useEffect(() => { reload(); }, [reload]);
+
     /** 画面の値だけ変える（保存はしない） */
     const edit = useCallback(<K extends Key>(key: K, value: Settings[K]) => {
         latest.current = { ...latest.current, [key]: value };
@@ -295,6 +301,9 @@ const RealtySettings: React.FC = () => {
                 </div>
             </div>
 
+            {/* ⚠️ v2.2.224: 以前のアプリのバックアップの取り込み。マスターだけ（② も auth: 'master' で確かめる） */}
+            {authority === 'Master' && <RealtyImport onFinished={reload} />}
+
             <p className="rlt-sub">
                 以前のアプリの「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、のちの版で移します。
             </p>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 935dec58..1cdda918 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.223';
+export const newVersion = '2.2.224';
```
