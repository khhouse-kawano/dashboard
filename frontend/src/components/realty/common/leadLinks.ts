import { loadRecords } from './realtyState';
import { newRecordId, saveBrokerageRecord } from './leadUtiles';
import type { StaffSetting } from '../summary/kpi';

/**
 * 反響から次の台帳・案件への連携（v2.2.244 新規）。以前のアプリ v14.29 の leadToLedger / buyToDeal と同じ動き。
 *
 * ─────────────────────────────────────────────
 *   売り反響を「媒介受託」にする → 媒介獲得台帳（kind = ledger）へ1行作り、反響に ledgerNo を持たせる
 *   買い反響を「購入申込」にする → 商談案件（kind = deals）へ「買」案件を1件作り、反響に dealId を持たせる
 *
 * ⚠️ No. は「その種類の最大 + 1」（以前のアプリと同じ）。⚠️ 作る直前に読み直して数える（画面を開いた後に増えた分を拾う）。
 * ⚠️ 二重連携は呼び出し側で防ぐ（ledgerNo / dealId が入っていれば呼ばない）。
 * ⚠️ 媒介台帳の担当は略称（設定の staff.abbr）、反響の担当は氏名。以前のアプリと同じく読み替える。
 * ─────────────────────────────────────────────
 */

type Rec = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));

const todayStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nextNo = (rows: Rec[]): number =>
    Math.max(0, ...rows.map((r) => Number(r.no)).filter((n) => Number.isFinite(n))) + 1;

/** 住所の市区町村まで（以前のアプリの guessCity） */
const guessCity = (addr: string): string => addr.match(/^(.+?[市郡町村])/)?.[1] ?? '';

/** 'YYYY-MM-DD' か。⚠️ 以前のアプリと同じ形だけを受け付ける */
export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * 媒介契約日を聞く（以前のアプリの ieGuard と同じ）。
 * @returns null は取り消し・形の誤り
 */
export const askBaikaiDate = (current: string | null | undefined): string | null => {
    if (current && isIsoDate(current)) return current;
    const v = window.prompt(`媒介受託にします。媒介契約日を入力してください（例：${todayStr()}）`, todayStr());
    if (v == null) return null;
    const d = v.trim();
    if (!isIsoDate(d)) {
        alert('日付の形式が正しくありません（例：2026-08-10）');
        return null;
    }
    return d;
};

/**
 * 売り反響 → 媒介獲得台帳。
 * @returns 作った台帳の No. と、反響に保存した値
 */
export const leadToLedger = async (
    lead: Rec,
    baikaiDate: string,
    staffSettings: StaffSetting[] = []
): Promise<{ no: number; leadFields: Rec }> => {
    const { records } = await loadRecords(['ledger']);
    const no = nextNo(records.ledger);
    const abbr = staffSettings.find((s) => s.name === str(lead.staff))?.abbr ?? '';
    const addr = str(lead.addr);
    await saveBrokerageRecord(newRecordId(), {
        kind: 'ledger', no, staff: abbr, portal: abbr, source: str(lead.source),
        contractDate: baikaiDate, baikaiType: '専任媒介', seller: str(lead.name || lead.seller), contact: str(lead.contact),
        category: str(lead.category), currentStatus: '情報整理中', addr1: guessCity(addr), addr2: addr,
        price: lead.price || null, freq: '1か月', lastReportDate: '', reinsDate: '', priceRevDate: '',
        propStatus: 'アクティブ', keyStatus: '', keyInfo: '',
        note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
    });
    const leadFields = { ledgerNo: no, phase: '媒介受託', baikaiDate };
    await saveBrokerageRecord(str(lead.id), leadFields);
    return { no, leadFields };
};

/**
 * 編集画面（LeadEdit）で売り反響を保存したあと、媒介獲得台帳へ反映する（以前のアプリの saveLead の最後）。
 * ⚠️ 媒介受託・媒介契約日あり・まだ台帳に紐づいていないときだけ作る。作らなければ null。
 * ⚠️ 失敗は知らせて null を返す（反響の保存は済んでいるので、選び直せば作り直せる）。
 */
export const linkLedgerAfterEdit = async (
    saved: Rec,
    staffSettings: StaffSetting[] = []
): Promise<{ no: number; leadFields: Rec } | null> => {
    const baikaiDate = str(saved.baikaiDate).replace(/\//g, '-');
    if (str(saved.phase) !== '媒介受託' || str(saved.ledgerNo) !== '' || !isIsoDate(baikaiDate)) return null;
    return linkLedgerWithNotice(saved, baikaiDate, staffSettings);
};

/** leadToLedger を呼び、結果を知らせる。⚠️ 失敗は知らせて null（反響の保存は済んでいるので、選び直せば作り直せる） */
export const linkLedgerWithNotice = async (
    lead: Rec,
    baikaiDate: string,
    staffSettings: StaffSetting[] = []
): Promise<{ no: number; leadFields: Rec } | null> => {
    try {
        const result = await leadToLedger(lead, baikaiDate, staffSettings);
        alert(`媒介獲得台帳 No.${result.no} へ反映しました（媒介契約日 ${baikaiDate}）。\n媒介獲得台帳で媒介種別・販売価格を確認してください。`);
        return result;
    } catch (e) {
        console.error('[leadLinks] 媒介獲得台帳への反映に失敗しました', lead.id, e);
        alert('媒介獲得台帳への反映に失敗しました。時間をおいて、もう一度「媒介受託」を選び直すか、保存し直してください。');
        return null;
    }
};

/**
 * 買い反響 → 商談案件（買）。
 * @returns 作った案件の No.・id と、反響に保存した値
 */
export const buyToDeal = async (lead: Rec): Promise<{ no: number; dealId: string; leadFields: Rec }> => {
    const { records } = await loadRecords(['deals']);
    const no = nextNo(records.deals);
    const dealId = newRecordId();
    const ledgerNo = lead.ledgerNo == null || lead.ledgerNo === '' ? null : Number(lead.ledgerNo);
    await saveBrokerageRecord(dealId, {
        kind: 'deals', no, createdAt: todayStr(), property: str(lead.targetProperty), type: '買',
        price: Number(lead.budget) || 0, fee: null, feeManual: false,
        contactDate: str(lead.receivedDate) || todayStr(), staff: str(lead.staff), customer: str(lead.name),
        phase: '購入申込', contractDate: '', settleDate: '', priority: '', followDate: '',
        ledgerId: lead.ledgerId || null, ledgerNo,
        note: `買い反響より転記（${str(lead.portal) || 'ポータル未設定'}）${ledgerNo != null ? `／📝台帳No.${ledgerNo}` : ''}`,
    });
    // ⚠️ 以前のアプリと同じく、成約済みの反響はフェーズを戻さない
    const leadFields: Rec = { dealId, ...(str(lead.phase) === '成約' ? {} : { phase: '購入申込' }) };
    await saveBrokerageRecord(str(lead.id), leadFields);
    return { no, dealId, leadFields };
};
