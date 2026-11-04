# 2026-11-04 v2.2.244 不動産企画係：反響から商談までのつながり（コードチェックと修正）

## 依頼（ReadMeClaude.md ではなく、会話での指示）
- 新しいブランチで作業する
- ダウンロードの `index.html`（`frontend/src/components/realty` の元データ。以前のアプリ v14.29.1）を手本に、コードをチェックする
- 開発担当からの連絡：
  - 反響から商談までのトリガーに、いくつか不適合がありそう
  - 買取案件などで、売主から買い取るときと再販するときの土地建物価格の内訳（消費税）の計算書式を組み込んでいる
- 利用者の判断（2026-11-04）：
  - スモールステップで進める
  - 買取再販は v2.2.245・v2.2.246 に分ける
  - 買付登録は次の版に回す（おすすめを採用）

⚠️ index.html には Supabase のキーがある。読んだのは、キーの形を sed で伏せた写し（スクラッチパッド）だけ。

## コードチェックの結果

### 反響 → 商談（v2.2.244 で直した）
1. 商談案件管理が、商談案件（kind = deals。ローカルで67件）を読んでいなかった。媒介台帳と買い反響を、元のアプリにないフェーズ名で絞り込んで出していた
2. 段階を変えても、次へつながっていなかった
   - 媒介受託 → 媒介台帳
   - 購入申込 → 商談案件
   - 失注 → 失注理由が必須
3. フェーズの選択肢が、元のアプリと違った（通電済み・机上査定・訪問査定・売却済・内見済み など）。歩留まりの数から漏れる。買い反響に「内見済み」が4件あった
4. 追客終了の理由を聞いていたが、保存していなかった。理由の選択肢に「他決」が無かった（成約・連絡不通 など、元のアプリにない値だった）
5. 一覧のフェーズを onBlur で保存していたため、触れるたびに保存し、追客終了の理由も聞き直していた
6. 編集画面の「次回アクション必須」が、媒介受託・成約も必須にしていた（元のアプリは免除）
7. 売り反響の一覧の「📞 架電」が、関数の定義が無く、押すとエラーで止まっていた（`getCurrentDateTime`。前からある不具合）

### 買取再販の消費税（v2.2.245・v2.2.246 で対応する。今回は触っていない）
- 元のアプリ v14.29 の「土地建物の按分」の仕組みが丸ごと無い
  - 仕入・販売の按分の比較と採用
  - 居住用賃貸建物の判定
  - 本件の消費税（個別対応／一括比例配分）
  - 固都税の精算
  - 契約書の記載例
  - 按分根拠書
  - 期限管理
  - 今期の消費税見込み
- 今ある誤り
  - フェーズ名（仕入契約**書**／売買契約**書**。元のアプリは …契約**済**）。「売買契約済」の1件が保有中から漏れる
  - 成約前の消費税が「還付」のように出る
  - 帳簿の条文が「1号ロ」になっている。元のアプリは「ハ」で、経理・税理士に確認してもらう
  - 粗利の計算方式が保存されない

### 気づいたこと（今回は直していない）
- frontend の `tsconfig.json` の include が `frontend/src` になっていて、どのファイルにも当たっていない。そのため、本番用ビルドで型が確かめられていない（今回の LeadSell の `getCurrentDateTime` のような誤りが、ビルドを通ってしまう）。型は、スクラッチパッドに置いた確認用の設定で tsc を流して確かめた。ほかの画面に、前からある型エラーが6件ある（NewCampaign・DatabaseKaeru・DatabaseOrder・CompetitorMaterials）
- 売り反響の「他決」の詳細（決め手・他社・価格）を入れる欄が無い（元のアプリの lostDialog）。DB にも列が無い
- 元のアプリの買い反響 → 商談案件は、案件に buyLeadId も持たせていた。Dashboard には列が無いので入れていない（反響側の dealId でつながる）

## ディレクトリ・ファイル
| 区分 | ファイル | 内容 |
|---|---|---|
| 新規 | `frontend/src/components/realty/common/leadLinks.ts` | 追加した関数：`isIsoDate`・`askBaikaiDate`・`leadToLedger`・`linkLedgerAfterEdit`・`linkLedgerWithNotice`・`buyToDeal` |
| 修正 | `frontend/src/components/realty/common/leadUtiles.ts` | 追加した定数・関数：`LEAD_PHASES`・`BUY_PHASES`・`DEAL_PHASES`・`DEAL_LOST_REASONS`・`NEXT_EXEMPT`・`askEndReason`。`LEAD_END_REASONS`・`BUY_END_REASONS` を元のアプリの値に |
| 修正 | `frontend/src/components/realty/sell/LeadSell.tsx` | `handlePhaseBlur` → `handlePhaseChange`、`linkToLedger`、`getCurrentDateTime`、選択肢、編集の保存後の台帳反映 |
| 修正 | `frontend/src/components/realty/buy/LeadBuy.tsx` | `handlePhaseBlur` → `handlePhaseChange`、`linkToDeal`、「案件へ転記」ボタン、選択肢 |
| 修正 | `frontend/src/components/realty/common/LeadEdit.tsx` | 選択肢、媒介契約日の必須、次回アクションの免除 |
| 修正 | `frontend/src/components/realty/callq/CallQueue.tsx`・`summary/Summary.tsx` | 編集の保存後の台帳反映 |
| 書き直し | `frontend/src/components/realty/deals/LeadOpportunity.tsx` | 商談案件管理（以前のアプリの renderDeals / editDeal / saveDeal） |
| 修正 | `frontend/src/components/realty/lost/LostAnalysis.tsx` | `DEAL_LOST_REASONS` を leadUtiles から読む・注記 |
| 修正 | `frontend/src/components/realty/summary/kpi.ts` | `stdFee` を export |
| 修正 | `backend-express/src/features/realty/index.ts`・`importer.ts`、`backend/src/handlers/brokerAction/broker_update.php` | 列 `lostReason`・`lostDate`・`lostNote` を許可・取り込み |
| 新規 | `backend/scripts/sql/2026-11-04_realty_deal_lost.sql` | 列の追加・原本から写す・「内見済み」→「内見済」 |
| 新規 | `backend/scripts/sql/2026-11-04_update_log_2.2.244.sql` | 更新履歴と業務ガイド2本 |
| 新規 | `backend/scripts/guide/articles/common/screen-247.md` | 記事「反響から商談案件へのつながり（不動産企画係）」 |
| 修正 | `backend/scripts/guide/articles/common/screen-230.md` | 入口の記事から上の記事へのリンク |
| 修正 | `frontend/src/utils/version.ts` | 2.2.244 |

## テスト
- 型：② の `tsc --noEmit` は通った。フロントは確認用の設定で tsc を流し、realty のエラーは0件。本番用ビルドも通った。PHP は `php -l` で構文の誤りなし
- ① を通す：トークン無しで `planner:records`・`broker:update` を送ると、どちらも 401
- SQL：ローカルで2回流して、結果が同じ（「内見済み」は0件、失注2件のうち原本に理由のあるものは0件）
- Playwright（3100・Master・テスト用の反響を DB に入れて確認）
  - 売り反響
    - 選択肢が元のアプリと同じ
    - 追客終了（理由「他決」が保存される）→ 架電中（理由が消える）
    - 触っただけでは履歴が増えない
    - 媒介受託 → 媒介契約日 → 台帳 No.218 ができる。担当は略称、現況は情報整理中、所在地は市まで
    - 媒介受託をやり直しても台帳は増えない
    - 📞 架電で記録が1件増え、エラーが出ない
  - 買い反響：購入申込 → 確認 → 商談案件 No.79（買・購入申込・反響の担当・物件・予算）ができる。「案件に連携済み」と出る
  - 商談案件管理
    - サマリー（チーム合計71件・契約61件）と一覧が出る
    - 失注を選ぶ → 確認 → 編集画面
    - 理由なしで保存すると止まる。理由ありで保存すると lostReason・lostDate・lostNote が入る
    - 新規の追加で、次回アクションの必須が働く
    - 手数料は 3,000万 → ¥960,000。一覧で 700万に直すと ¥300,000
  - 失注・他決の分析：入れた失注理由が表に出る（理由の入力 1／2件）
  - 業務ガイド：記事2本が表示される
- リファクタリング（台帳反映の通知を `linkLedgerWithNotice` にまとめた）のあと、もう一度流した。売り反響・買い反響の連携は同じく動いた
  - 商談案件管理の手順は、前回の実行で失注にした案件を拾ったため止まった（変更なしとして何も起きない）。このファイルはリファクタリングで触っていない
- 後片付け：テストで作った行（反響2・台帳2・商談案件3・履歴20）と仮スタッフを消した。行数は元の2,986に戻した。開発サーバー（3100）を止めた

## 新規ファイルの全文

### frontend/src/components/realty/common/leadLinks.ts
````ts
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
````

### frontend/src/components/realty/deals/LeadOpportunity.tsx
````tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../../context/AuthContext';
import DocumentViewer from '../documents/DocumentViewer';
import PlannerGenerator, { PlannerInputState } from '../documents/PlannerGenerator';
import LeadNotifications from '../common/LeadNotifications';
import {
    saveBrokerageRecord, recordFieldChanges, softDeleteRecord, newRecordId,
    DEAL_PHASES, DEAL_LOST_REASONS, NEXT_EXEMPT,
} from '../common/leadUtiles';
import { loadRecords } from '../common/realtyState';
import { CONFIRMED, dealFee, dealReform, dealReformGp, fmtYen, fmtYen0, pct, shareOf, stdFee, todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';

/**
 * 商談案件管理（不動産企画係）。⚠️ v2.2.244 で以前のアプリ v14.29 の「🏷 商談案件管理」（renderDeals / editDeal / saveDeal）に作り直した。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **読むのは商談案件（brokerage_listings の kind = deals）。**
 *   v2.2.243 までは媒介台帳と買い反響をフェーズで絞って出しており、商談案件そのもの（67件）が1件も出ていなかった。
 *   月次売上・失注分析は商談案件で数えるので、ここで直した値がそのまま集計に出る。
 *
 * ⚠️ 案件は次の3つでできる。
 *   ・この画面の「＋ 商談案件を追加」
 *   ・買い反響を「購入申込」にしたときの転記（common/leadLinks.ts の buyToDeal）
 *   ・媒介台帳の買付登録（⚠️ まだ移していない。v2.2.245 以降）
 * ⚠️ 失注にするときは失注理由が必須（lostReason・lostDate・lostNote。2026-11-04_realty_deal_lost.sql で列にした）。
 * ⚠️ 仲介手数料は成約価格から自動計算（800万円以下＝30万円／超＝3%＋6万円・税抜。kpi.ts の stdFee）。手入力した額があればそちら（feeManual）。
 * ⚠️ 削除は論理削除（show_dashboard = 0）。以前のアプリは消していた。
 * ─────────────────────────────────────────────
 */

type InitialDoc = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null;
    phone?: string | null;
    mail?: string | null;
    addr: string | null;
    price: number | null;
    fee: number | null;
    recordId?: string | null;
    docDraft?: string | null;
};

/** 編集画面の入力（⚠️ 数字の欄も文字で持つ。空欄と 0 を区別するため） */
type Form = {
    no: string; property: string; type: string; price: string; fee: string;
    staff: string; subStaff: string; subRatio: string; customer: string; phase: string;
    lostReason: string; lostNote: string; nextDate: string; nextNote: string;
    contactDate: string; contractDate: string; settleDate: string; followDate: string; note: string;
    reformPrice: string; reformGp: string; reformNote: string;
};

const DEAL_TYPES = ['売', '買', '買取'];

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** 'YYYY-MM-DD'。⚠️ 0000-00-00 は空 */
const day = (v: unknown): string => {
    const s = str(v).slice(0, 10);
    return s.startsWith('0000') ? '' : s;
};
const diffDays = (from: string, to: string): number =>
    Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);

const formOf = (d: Row): Form => ({
    no: str(d.no), property: str(d.property), type: str(d.type) || '売', price: num(d.price) ? String(num(d.price)) : '',
    fee: num(d.feeManual) ? str(d.fee) : '',
    staff: str(d.staff), subStaff: str(d.subStaff), subRatio: num(d.subRatio) ? String(num(d.subRatio)) : '',
    customer: str(d.customer), phase: str(d.phase) || '初回接触',
    lostReason: str(d.lostReason), lostNote: str(d.lostNote), nextDate: day(d.nextDate), nextNote: str(d.nextNote),
    contactDate: day(d.contactDate), contractDate: day(d.contractDate), settleDate: day(d.settleDate), followDate: day(d.followDate),
    note: str(d.note),
    reformPrice: dealReform(d) ? String(dealReform(d)) : '', reformGp: dealReformGp(d) ? String(dealReformGp(d)) : '',
    reformNote: str(d.reformNote),
});

const phaseClass = (p: string): string =>
    p === '決済完了' ? 'secondary' : p === '契約済' ? 'success' : p === '契約予定' ? 'primary' : p === '失注' ? 'danger' : 'warning';

const LeadOpportunity = () => {
    const { userName } = useContext(AuthContext);

    const [deals, setDeals] = useState<Row[]>([]);
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedPhase, setSelectedPhase] = useState('');
    const [hideSettled, setHideSettled] = useState(true);
    const [showReform, setShowReform] = useState(true);

    /** 編集中（null は閉じている）。editingId が空なら新規 */
    const [form, setForm] = useState<Form | null>(null);
    const [editingId, setEditingId] = useState('');

    const [documentShow, setDocumentShow] = useState(false);
    const [docData, setDocData] = useState<InitialDoc | undefined>(undefined);
    const [plannerShow, setPlannerShow] = useState(false);
    const [plannerData, setPlannerData] = useState<Partial<PlannerInputState> | undefined>(undefined);

    const today = todayStr();

    useEffect(() => {
        setIsLoading(true);
        loadRecords(['deals'])
            .then(({ records, settings }) => {
                setDeals(records.deals);
                setStaffNames((settings.staff ?? []).map(s => str(s.name)).filter(Boolean));
            })
            .catch(e => {
                console.error('[LeadOpportunity] 商談案件の読み込みに失敗しました', e);
                alert('商談案件を読み込めませんでした。時間をおいて開き直してください。');
            })
            .finally(() => setIsLoading(false));
    }, []);

    // -----------------------------------------------------------------------
    // 保存
    // -----------------------------------------------------------------------

    /** 1件を部分更新する（先に画面を直し、失敗したら戻す）。⚠️ 成功してから履歴を残す */
    const patchDeal = useCallback(async (id: string, fields: Row): Promise<boolean> => {
        const before = deals.find(d => str(d.id) === id);
        setDeals(prev => prev.map(d => (str(d.id) === id ? { ...d, ...fields } : d)));
        try {
            await saveBrokerageRecord(id, fields);
            if (before) {
                await recordFieldChanges({
                    entity: 'deal', entityId: id, entityNo: num(before.no) || null,
                    label: str(before.property) || str(before.customer) || id,
                    before, after: fields, by: userName || '不明',
                });
            }
            return true;
        } catch (e) {
            console.error('[LeadOpportunity] 保存に失敗しました', { id, fields }, e);
            setDeals(prev => prev.map(d => (str(d.id) === id && before ? before : d)));
            alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
            return false;
        }
    }, [deals, userName]);

    /** 一覧の数字の欄（成約価格・リフォーム）。⚠️ 値が変わったときだけ保存 */
    const saveNumber = (d: Row, field: 'price' | 'reformPrice' | 'reformGp', raw: string) => {
        const next = raw.trim() === '' ? 0 : Math.round(Number(raw));
        if (!Number.isFinite(next)) { alert('数字で入力してください。'); return; }
        if (field === 'reformPrice' && next < 0) { alert('リフォーム受注金額は0以上で入力してください。'); return; }
        if (next === Math.round(num(d[field]))) return;
        void patchDeal(str(d.id), { [field]: next });
    };

    /** 一覧のフェーズ。⚠️ 失注は理由が要るので編集画面を開く（以前のアプリの lostDialog） */
    const changePhase = (d: Row, e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        const prev = str(d.phase);
        if (next === prev) return;
        if (next === '失注') {
            e.target.value = prev;
            if (!window.confirm('フェーズを「失注」にすると月次売上の集計から除外されます。よろしいですか？\n失注理由を入れる画面を開きます。')) return;
            openEdit(d, { phase: '失注' });
            return;
        }
        void patchDeal(str(d.id), { phase: next });
    };

    const openEdit = (d: Row | null, preset: Partial<Form> = {}) => {
        if (d) {
            setEditingId(str(d.id));
            setForm({ ...formOf(d), ...preset });
        } else {
            const no = Math.max(0, ...deals.map(x => num(x.no))) + 1;
            setEditingId('');
            setForm({ ...formOf({ no, type: '売', phase: '初回接触' }), ...preset });
        }
    };

    const patchForm = (p: Partial<Form>) => setForm(prev => (prev ? { ...prev, ...p } : prev));

    /** 編集画面の保存（以前のアプリの saveDeal と同じ確かめ方） */
    const saveForm = async () => {
        if (!form) return;
        const price = Math.round(Number(form.price) || 0);
        const rfPrice = Math.max(0, Math.round(Number(form.reformPrice) || 0));
        const rfGp = Math.round(Number(form.reformGp) || 0);
        if (!form.property.trim()) { alert('物件名を入力してください。'); return; }
        const fields: Row = {
            no: Number(form.no) || null, property: form.property.trim(), type: form.type, price,
            feeManual: form.fee.trim() !== '', fee: form.fee.trim() !== '' ? Math.round(Number(form.fee)) : null,
            contactDate: form.contactDate, staff: form.staff, subStaff: form.subStaff, subRatio: Number(form.subRatio) || 0,
            customer: form.customer.trim(), phase: form.phase,
            contractDate: form.contractDate, settleDate: form.settleDate, followDate: form.followDate, note: form.note.trim(),
            nextDate: form.nextDate, nextNote: form.nextNote.trim(),
            reformPrice: rfPrice, reformGp: rfGp, reformNote: form.reformNote.trim(),
        };
        if (form.phase === '失注') {
            if (!form.lostReason) { alert('失注にするときは「失注理由」を選んでください。'); return; }
            const cur = deals.find(d => str(d.id) === editingId);
            fields.lostReason = form.lostReason;
            fields.lostNote = form.lostNote.trim();
            fields.lostDate = (cur && str(cur.phase) === '失注' && day(cur.lostDate)) || today;
        }
        if (!NEXT_EXEMPT.includes(form.phase)) {
            if (!form.nextDate || !form.nextNote.trim()) { alert('次回アクション（予定日・内容）は必須です。'); return; }
            if (form.nextDate < today && !window.confirm('次回アクション予定日が過去の日付です。このまま保存しますか？')) return;
        }
        if (rfGp !== 0 && rfPrice === 0) { alert('リフォーム受注金額を入力してください（粗利のみの登録はできません）。'); return; }
        if (rfPrice > 0 && rfGp > rfPrice && !window.confirm(`リフォーム粗利（${fmtYen(rfGp)}）が受注金額（${fmtYen(rfPrice)}）を上回っています。\nこのまま保存しますか？`)) return;
        // ⚠️ 手入力の額が規定の計算と同じなら自動計算に戻す（以前のアプリと同じ）
        if (fields.feeManual && stdFee(price) === fields.fee) { fields.feeManual = false; fields.fee = null; }

        if (editingId) {
            if (await patchDeal(editingId, fields)) setForm(null);
            return;
        }
        const id = newRecordId();
        const row: Row = { id, kind: 'deals', priority: '', createdAt: today, ...fields };
        try {
            await saveBrokerageRecord(id, row);
            setDeals(prev => [...prev, row]);
            setForm(null);
        } catch (e) {
            console.error('[LeadOpportunity] 商談案件の追加に失敗しました', row, e);
            alert('商談案件を追加できませんでした。もう一度お試しください。');
        }
    };

    const deleteDeal = async () => {
        if (!editingId || !window.confirm('この商談案件を削除しますか？\n（一覧と集計から外れます。データは残ります）')) return;
        try {
            await softDeleteRecord(editingId, userName || '不明');
            setDeals(prev => prev.filter(d => str(d.id) !== editingId));
            setForm(null);
        } catch (e) {
            console.error('[LeadOpportunity] 削除に失敗しました', editingId, e);
            alert('削除できませんでした。もう一度お試しください。');
        }
    };

    // -----------------------------------------------------------------------
    // 契約書・精算書
    // -----------------------------------------------------------------------

    const openDocument = (d: Row) => {
        const price = num(d.price) || null;
        setDocData({
            name: str(d.customer) || null, baikaiType: '専任媒介', category: null, phone: null, mail: null,
            addr: str(d.property) || null, price, fee: price ? dealFee(d) : null,
            recordId: str(d.id), docDraft: str(d.docDraft) || null,
        });
        setDocumentShow(true);
    };

    /** 以前のアプリの fromDeal(d) → SETL.open(dealId) */
    const openPlanner = (d: Row) => {
        const data: Partial<PlannerInputState> = {};
        if (str(d.property)) data.propName = str(d.property);
        if (num(d.price)) data.price = num(d.price);
        if (day(d.contractDate)) data.contractDate = day(d.contractDate);
        if (day(d.settleDate)) data.delivery = day(d.settleDate);
        if (str(d.customer)) {
            if (str(d.type) === '買') data.buyer = str(d.customer); else data.seller = str(d.customer);
        }
        setPlannerData(data);
        setPlannerShow(true);
    };

    // -----------------------------------------------------------------------
    // 集計・一覧
    // -----------------------------------------------------------------------

    /** 担当者別サマリー（以前のアプリと同じ: 失注を除く・共同担当も数える・リフォームは売上割合で按分） */
    const summary = useMemo(() => {
        const rows = staffNames.map(nm => {
            const dd = deals.filter(d => (str(d.staff) === nm || str(d.subStaff) === nm) && str(d.phase) !== '失注');
            const c = dd.filter(d => CONFIRMED.includes(str(d.phase))).length;
            return {
                nm, n: dd.length, c, p: dd.length - c,
                s: dd.filter(d => str(d.type) === '売').length, b: dd.filter(d => str(d.type) === '買').length,
                k: dd.filter(d => str(d.type) === '買取').length,
                rp: dd.reduce((a, d) => a + shareOf(d, nm, dealReform), 0), rg: dd.reduce((a, d) => a + shareOf(d, nm, dealReformGp), 0),
            };
        });
        const t = rows.reduce((a, r) => ({ n: a.n + r.n, c: a.c + r.c, p: a.p + r.p, s: a.s + r.s, b: a.b + r.b, k: a.k + r.k, rp: a.rp + r.rp, rg: a.rg + r.rg }),
            { n: 0, c: 0, p: 0, s: 0, b: 0, k: 0, rp: 0, rg: 0 });
        return { rows, t };
    }, [deals, staffNames]);

    const list = useMemo(() => deals
        .filter(d => {
            if (selectedStaff && str(d.staff) !== selectedStaff && str(d.subStaff) !== selectedStaff) return false;
            if (selectedPhase && str(d.phase) !== selectedPhase) return false;
            if (hideSettled && str(d.phase) === '決済完了' && !selectedPhase) return false;
            return true;
        })
        // ⚠️ 契約日の古い順（未入力は最後）。以前のアプリと同じ
        .sort((a, b) => ((day(a.contractDate) || '9999') < (day(b.contractDate) || '9999') ? -1 : 1)),
    [deals, selectedStaff, selectedPhase, hideSettled]);

    const totals = useMemo(() => ({
        fee: list.reduce((a, d) => a + dealFee(d), 0),
        rp: list.reduce((a, d) => a + dealReform(d), 0),
        rg: list.reduce((a, d) => a + dealReformGp(d), 0),
    }), [list]);

    const numInput = (d: Row, field: 'price' | 'reformPrice' | 'reformGp') => (
        <input
            key={`${str(d.id)}-${field}-${str(d[field])}`}
            type="number"
            className="form-control form-control-sm text-end"
            style={{ fontSize: '11px', minWidth: '96px' }}
            defaultValue={Math.round(num(d[field])) || ''}
            onBlur={e => saveNumber(d, field, e.target.value)}
        />
    );

    const dateInput = (d: Row, field: 'contractDate' | 'settleDate') => (
        <input
            key={`${str(d.id)}-${field}-${day(d[field])}`}
            type="date"
            className="form-control form-control-sm"
            style={{ fontSize: '11px', minWidth: '118px' }}
            defaultValue={day(d[field])}
            onChange={e => { if (e.target.value !== day(d[field])) void patchDeal(str(d.id), { [field]: e.target.value }); }}
        />
    );

    const th: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', color: '#6c757d' };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-end mb-3 pb-2 border-bottom" style={{ minWidth: '1200px' }}>
                <div>
                    <h4 className="fw-bold text-secondary mb-2" style={{ letterSpacing: '1px' }}>
                        <i className="bi bi-briefcase me-2 text-primary"></i>商談案件管理
                    </h4>
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        1行1案件。成約価格・進捗フェーズ・契約日・決済予定日・リフォーム受注額・粗利は一覧のまま直せます（自動保存）。
                        仲介手数料は成約価格から自動計算（800万円以下＝30万円／超＝価格×3％＋6万円・税抜）。税込10％を併記。
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2 mt-3 mt-md-0">
                    <LeadNotifications />
                    <button className="btn btn-primary btn-sm fw-bold" style={{ fontSize: '12px' }} onClick={() => openEdit(null)}>
                        ＋ 商談案件を追加
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
                <>
                    <div className="card shadow-sm border-0 rounded-3 mb-3" style={{ minWidth: '1000px', maxWidth: '1300px' }}>
                        <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
                            <h6 className="fw-bold text-dark mb-0">担当者別サマリー（自動集計）</h6>
                            <div className="text-muted" style={{ fontSize: '11px' }}>失注を除きます。リフォームは共同担当がいる案件を、仲介手数料と同じ売上割合で按分しています。</div>
                        </div>
                        <div className="card-body p-0">
                            <table className="table table-sm table-bordered table-hover mb-0 text-end align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="table-light">
                                    <tr>
                                        <th className="text-start ps-3" style={th}>担当者</th><th style={th}>案件数</th><th style={th}>契約件数</th><th style={th}>契約率</th>
                                        <th style={th}>未決案件</th><th style={th}>売 件数</th><th style={th}>買 件数</th><th style={th}>買取 件数</th>
                                        <th style={th}>リフォーム受注額</th><th style={th}>リフォーム粗利</th><th style={th}>リフォーム粗利率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.rows.map(r => (
                                        <tr key={r.nm}>
                                            <td className="text-start ps-3 fw-bold">{r.nm}</td><td>{r.n}</td><td>{r.c}</td><td>{r.n ? pct(r.c / r.n) : '―'}</td>
                                            <td>{r.p}</td><td>{r.s}</td><td>{r.b}</td><td>{r.k}</td>
                                            <td>{fmtYen0(r.rp)}</td><td>{fmtYen0(r.rg)}</td><td>{r.rp ? pct(r.rg / r.rp) : '―'}</td>
                                        </tr>
                                    ))}
                                    <tr className="table-light fw-bold">
                                        <td className="text-start ps-3">チーム合計</td><td>{summary.t.n}</td><td>{summary.t.c}</td><td>{summary.t.n ? pct(summary.t.c / summary.t.n) : '―'}</td>
                                        <td>{summary.t.p}</td><td>{summary.t.s}</td><td>{summary.t.b}</td><td>{summary.t.k}</td>
                                        <td>{fmtYen0(summary.t.rp)}</td><td>{fmtYen0(summary.t.rg)}</td><td>{summary.t.rp ? pct(summary.t.rg / summary.t.rp) : '―'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-3 mb-2" style={{ fontSize: '12px', minWidth: '1000px' }}>
                        <label className="d-flex align-items-center gap-1 text-muted fw-bold">担当
                            <select className="form-select form-select-sm" style={{ width: '140px', fontSize: '12px' }} value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                                <option value="">全員</option>
                                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label className="d-flex align-items-center gap-1 text-muted fw-bold">フェーズ
                            <select className="form-select form-select-sm" style={{ width: '130px', fontSize: '12px' }} value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)}>
                                <option value="">すべて</option>
                                {DEAL_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                        <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={hideSettled} onChange={e => setHideSettled(e.target.checked)} />決済完了を隠す
                        </label>
                        <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={showReform} onChange={e => setShowReform(e.target.checked)} />リフォームの列
                        </label>
                        <span className="text-muted">{list.length}件表示</span>
                    </div>

                    <div className="card shadow-sm border-0 rounded-3" style={{ minWidth: '1500px' }}>
                        <div className="card-body p-0 table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0 text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                    <tr>
                                        <th style={th}>No.</th><th style={th}>物件名</th><th style={th} className="text-center">種別</th>
                                        <th style={th} className="text-end">成約価格(円)</th><th style={th} className="text-end">仲介手数料(円)</th>
                                        {showReform && <><th style={th} className="text-end">リフォーム受注額</th><th style={th} className="text-end">リフォーム粗利</th><th style={th} className="text-end">粗利率</th></>}
                                        <th style={th}>担当者</th><th style={th}>顧客名</th><th style={th}>進捗フェーズ</th>
                                        <th style={th}>契約日</th><th style={th}>決済予定日</th><th style={th} className="text-end">経過日数</th>
                                        <th style={th}>備考</th><th style={th}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.length === 0 && (
                                        <tr><td colSpan={showReform ? 16 : 13} className="text-center text-muted py-5">該当する案件がありません</td></tr>
                                    )}
                                    {list.map(d => {
                                        const id = str(d.id);
                                        const fee = dealFee(d);
                                        const rp = dealReform(d);
                                        const rg = dealReformGp(d);
                                        const contact = day(d.contactDate);
                                        const phase = str(d.phase);
                                        return (
                                            <tr key={id}>
                                                <td className="text-muted">{str(d.no)}</td>
                                                <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>{str(d.property)}</td>
                                                <td className="text-center">{str(d.type)}</td>
                                                <td className="text-end">{numInput(d, 'price')}</td>
                                                <td className={`text-end ${num(d.feeManual) ? 'bg-warning bg-opacity-25' : ''}`}>
                                                    {fmtYen(fee)}{num(d.feeManual) ? <span className="ms-1 text-muted">手入力</span> : null}
                                                    <div className="text-muted" style={{ fontSize: '10px' }}>税込 {fmtYen(Math.round(fee * 1.1))}</div>
                                                </td>
                                                {showReform && <>
                                                    <td className="text-end">{numInput(d, 'reformPrice')}</td>
                                                    <td className="text-end">{numInput(d, 'reformGp')}</td>
                                                    <td className={`text-end ${rp && rg < 0 ? 'text-danger' : ''}`}>{rp ? pct(rg / rp) : '―'}</td>
                                                </>}
                                                <td>
                                                    {str(d.staff)}
                                                    {str(d.subStaff) && <div className="text-muted" style={{ fontSize: '10px' }}>+{str(d.subStaff)}（{num(d.subRatio)}%）</div>}
                                                </td>
                                                <td>{str(d.customer)}</td>
                                                <td>
                                                    <select
                                                        key={`${id}-phase-${phase}`}
                                                        className={`form-select form-select-sm border-${phaseClass(phase)}`}
                                                        style={{ fontSize: '11px', minWidth: '104px' }}
                                                        defaultValue={phase}
                                                        onChange={e => changePhase(d, e)}
                                                    >
                                                        {DEAL_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                                                        {phase && !DEAL_PHASES.includes(phase) && <option value={phase}>{phase}</option>}
                                                    </select>
                                                    {phase === '失注' && str(d.lostReason) && <div className="text-danger" style={{ fontSize: '10px' }}>{str(d.lostReason)}</div>}
                                                </td>
                                                <td>{dateInput(d, 'contractDate')}</td>
                                                <td>{dateInput(d, 'settleDate')}</td>
                                                <td className="text-end">{contact ? diffDays(contact, today) : '―'}</td>
                                                <td style={{ maxWidth: '200px', whiteSpace: 'normal' }} className="text-muted">
                                                    {str(d.note)}
                                                    {str(d.reformNote) && <div>🔧{str(d.reformNote)}</div>}
                                                </td>
                                                <td>
                                                    <div className="d-flex gap-1">
                                                        <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openDocument(d)} title="媒介契約書・事前説明書を作成">契約書</button>
                                                        <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openPlanner(d)} title="決済精算書・請求書・領収証を作成">精算書</button>
                                                        <button className="btn btn-outline-primary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openEdit(d)}>編集</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {showReform && (
                            <div className="card-footer bg-white text-muted" style={{ fontSize: '11px' }}>
                                表示中{list.length}件の合計　仲介手数料 <b>{fmtYen(totals.fee)}</b>　＋　リフォーム粗利 <b>{fmtYen(totals.rg)}</b>　＝　売上計上額 <b>{fmtYen(totals.fee + totals.rg)}</b>
                                　／　参考：リフォーム受注額 {fmtYen0(totals.rp)}（粗利率 {totals.rp ? pct(totals.rg / totals.rp) : '―'}）　※按分前の案件ベース金額
                            </div>
                        )}
                    </div>
                </>
            )}

            <Modal show={form !== null} onHide={() => setForm(null)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>{editingId ? '商談案件を編集' : '商談案件を追加'}</Modal.Title>
                </Modal.Header>
                {form && (
                    <Modal.Body style={{ fontSize: '12px' }}>
                        <div className="row g-2">
                            <div className="col-md-2"><label className="form-label mb-0 text-muted fw-bold">No.</label>
                                <input type="number" className="form-control form-control-sm" value={form.no} onChange={e => patchForm({ no: e.target.value })} /></div>
                            <div className="col-md-7"><label className="form-label mb-0 text-muted fw-bold">物件名 <span className="text-danger">*</span></label>
                                <input className="form-control form-control-sm" value={form.property} onChange={e => patchForm({ property: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">種別</label>
                                <select className="form-select form-select-sm" value={form.type} onChange={e => patchForm({ type: e.target.value })}>
                                    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">物件（成約）価格(円)</label>
                                <input type="number" className="form-control form-control-sm" value={form.price} onChange={e => patchForm({ price: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">仲介手数料(円) <span className="fw-normal">空欄＝自動計算</span></label>
                                <input type="number" className="form-control form-control-sm" value={form.fee} placeholder="自動" onChange={e => patchForm({ fee: e.target.value })} />
                                <div className="text-muted" style={{ fontSize: '10px' }}>
                                    {form.fee.trim() ? '手入力額を使います（黄色表示）' : `自動計算：${fmtYen(stdFee(Number(form.price) || 0))}`}
                                </div></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">顧客名</label>
                                <input className="form-control form-control-sm" value={form.customer} onChange={e => patchForm({ customer: e.target.value })} /></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">主担当者</label>
                                <select className="form-select form-select-sm" value={form.staff} onChange={e => patchForm({ staff: e.target.value })}>
                                    <option value=""></option>
                                    {[...staffNames, ...(form.staff && !staffNames.includes(form.staff) ? [form.staff] : [])].map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">共同担当（按分用）</label>
                                <select className="form-select form-select-sm" value={form.subStaff} onChange={e => patchForm({ subStaff: e.target.value })}>
                                    <option value="">なし</option>
                                    {[...staffNames, ...(form.subStaff && !staffNames.includes(form.subStaff) ? [form.subStaff] : [])].map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">共同担当の売上割合(%)</label>
                                <input type="number" min={0} max={100} className="form-control form-control-sm" value={form.subRatio} placeholder="例: 50" onChange={e => patchForm({ subRatio: e.target.value })} /></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">進捗フェーズ</label>
                                <select className="form-select form-select-sm" value={form.phase} onChange={e => patchForm({ phase: e.target.value })}>
                                    {[...DEAL_PHASES, ...(form.phase && !DEAL_PHASES.includes(form.phase) ? [form.phase] : [])].map(p => <option key={p} value={p}>{p}</option>)}
                                </select></div>
                            {form.phase === '失注' && <>
                                <div className="col-md-4"><label className="form-label mb-0 text-danger fw-bold">失注理由 <span>*必須</span></label>
                                    <select className="form-select form-select-sm" value={form.lostReason} onChange={e => patchForm({ lostReason: e.target.value })}>
                                        <option value=""></option>
                                        {[...DEAL_LOST_REASONS, ...(form.lostReason && !DEAL_LOST_REASONS.includes(form.lostReason) ? [form.lostReason] : [])].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select></div>
                                <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">失注の詳細（次に活かすこと）</label>
                                    <input className="form-control form-control-sm" value={form.lostNote} placeholder="例：ローン本審査で否決" onChange={e => patchForm({ lostNote: e.target.value })} /></div>
                            </>}
                            {!NEXT_EXEMPT.includes(form.phase) && <>
                                <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">次回アクション予定日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control form-control-sm" value={form.nextDate} onChange={e => patchForm({ nextDate: e.target.value })} /></div>
                                <div className="col-md-8"><label className="form-label mb-0 text-muted fw-bold">次回アクション内容 <span className="text-danger">*</span></label>
                                    <input className="form-control form-control-sm" value={form.nextNote} placeholder="ローン事前審査の結果確認 など" onChange={e => patchForm({ nextNote: e.target.value })} /></div>
                            </>}

                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">接触日</label>
                                <input type="date" className="form-control form-control-sm" value={form.contactDate} onChange={e => patchForm({ contactDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">契約日 <span className="fw-normal">入力月に売上計上</span></label>
                                <input type="date" className="form-control form-control-sm" value={form.contractDate} onChange={e => patchForm({ contractDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">決済予定日</label>
                                <input type="date" className="form-control form-control-sm" value={form.settleDate} onChange={e => patchForm({ settleDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">フォロー期日</label>
                                <input type="date" className="form-control form-control-sm" value={form.followDate} onChange={e => patchForm({ followDate: e.target.value })} /></div>
                            <div className="col-12"><label className="form-label mb-0 text-muted fw-bold">備考</label>
                                <input className="form-control form-control-sm" value={form.note} onChange={e => patchForm({ note: e.target.value })} /></div>

                            <div className="col-12 border-top pt-2 mt-2 fw-bold">🔧 リフォーム受注（この商談に付随する工事）
                                <div className="fw-normal text-muted" style={{ fontSize: '11px' }}>未受注なら空欄のままで構いません。<b>売上に計上されるのは「粗利」のみ</b>で、受注金額は粗利率を見るための参考値です。</div></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム受注金額(円)</label>
                                <input type="number" min={0} className="form-control form-control-sm" value={form.reformPrice} placeholder="0" onChange={e => patchForm({ reformPrice: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム粗利(円)</label>
                                <input type="number" className="form-control form-control-sm" value={form.reformGp} placeholder="0" onChange={e => patchForm({ reformGp: e.target.value })} />
                                {Number(form.reformPrice) > 0 && <div className="text-muted" style={{ fontSize: '10px' }}>粗利率 {pct((Number(form.reformGp) || 0) / Number(form.reformPrice))}</div>}</div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム内容・備考</label>
                                <input className="form-control form-control-sm" value={form.reformNote} placeholder="外壁塗装・水回り交換 など" onChange={e => patchForm({ reformNote: e.target.value })} /></div>
                        </div>
                    </Modal.Body>
                )}
                <Modal.Footer>
                    {editingId && <button className="btn btn-outline-danger btn-sm me-auto" onClick={() => void deleteDeal()}>削除</button>}
                    <button className="btn btn-light border btn-sm" onClick={() => setForm(null)}>キャンセル</button>
                    <button className="btn btn-primary btn-sm fw-bold" onClick={() => void saveForm()}>保存</button>
                </Modal.Footer>
            </Modal>

            <DocumentViewer documentShow={documentShow} setDocumentShow={setDocumentShow} initialData={docData} />
            <PlannerGenerator plannerShow={plannerShow} setPlannerShow={setPlannerShow} initialData={plannerData} />
        </div>
    );
};

export default LeadOpportunity;
````

### backend/scripts/sql/2026-11-04_realty_deal_lost.sql
````sql
-- =====================================================================
-- v2.2.244 不動産企画係：商談案件の失注理由を列にする・元のアプリにないフェーズの値を直す
--
--   1. brokerage_listings に lostReason（失注理由）・lostDate（失注日）・lostNote（失注の詳細）を足す
--      （商談案件管理で「失注」にするときに必須。以前のアプリ v14.25〜 と同じ項目）
--   2. 取り込み済みの商談案件の失注理由を、原本（raw_data）から列へ写す
--      ⚠️ 失注・他決の分析（LostAnalysis.tsx の rowOf）は列を優先して読むため、写さないと分析から消える
--   3. 買い反響のフェーズ「内見済み」を「内見済」に直す（Dashboard の編集画面で入った、以前のアプリにない値）
--
-- ⚠️ 何度流しても同じ結果になる（列は IF NOT EXISTS。写すのは列が空の行だけ）。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② のデプロイより先に流すこと
-- =====================================================================

-- 1. 列を足す
ALTER TABLE brokerage_listings
  ADD COLUMN IF NOT EXISTS lostReason VARCHAR(100) NULL DEFAULT NULL COMMENT '商談の失注理由（v2.2.244）' AFTER reformNote,
  ADD COLUMN IF NOT EXISTS lostDate DATE NULL DEFAULT NULL COMMENT '商談の失注日（v2.2.244）' AFTER lostReason,
  ADD COLUMN IF NOT EXISTS lostNote TEXT NULL DEFAULT NULL COMMENT '商談の失注の詳細（v2.2.244）' AFTER lostDate;

-- 2. 原本から写す（⚠️ 列が空の行だけ。⚠️ 日付は YYYY-MM-DD の形のときだけ）
UPDATE brokerage_listings
   SET lostReason = JSON_VALUE(raw_data, '$.lostReason')
 WHERE kind = 'deals' AND lostReason IS NULL AND JSON_VALID(raw_data)
   AND COALESCE(JSON_VALUE(raw_data, '$.lostReason'), '') <> '';
UPDATE brokerage_listings
   SET lostDate = JSON_VALUE(raw_data, '$.lostDate')
 WHERE kind = 'deals' AND lostDate IS NULL AND JSON_VALID(raw_data)
   AND JSON_VALUE(raw_data, '$.lostDate') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
UPDATE brokerage_listings
   SET lostNote = JSON_VALUE(raw_data, '$.lostNote')
 WHERE kind = 'deals' AND lostNote IS NULL AND JSON_VALID(raw_data)
   AND COALESCE(JSON_VALUE(raw_data, '$.lostNote'), '') <> '';

-- 3. 以前のアプリにないフェーズの値
UPDATE brokerage_listings SET phase = '内見済' WHERE kind = 'buyLeads' AND phase = '内見済み';

-- 4. 確かめる（naiken_mi が 0、lost_with_reason が失注の行のうち理由のある数）
SELECT
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'buyLeads' AND phase = '内見済み') AS naiken_mi,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'deals' AND phase = '失注') AS lost_deals,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'deals' AND lostReason IS NOT NULL) AS lost_with_reason;
````

### backend/scripts/guide/articles/common/screen-247.md
````markdown
---
title: 反響から商談案件へのつながり（不動産企画係）
section: 画面の使い方
sort: 247
summary: 売り反響・買い反響の段階を変えたときに媒介獲得台帳・商談案件管理へ自動で反映される動きと、商談案件管理の使い方。
---
不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へ自動でつながります。以前のアプリと同じ動きです。

## 売り反響（一括査定）
- 段階を「**媒介受託**」にすると、媒介契約日を聞かれます。入れると、**媒介獲得台帳に1行が自動で作られます**（台帳の No. は自動）。作られたら、媒介獲得台帳で媒介種別・販売価格を確かめてください
- 編集画面で「媒介受託」にするときは、媒介契約日が必須です。保存すると同じように台帳に作られます
- すでに台帳に作られた反響は、段階を変え直しても、もう1行は作られません
- 段階を「**追客終了**」にすると、理由を聞かれます（他決／辞退・売却中止／連絡不能／対象外／その他）。理由は「失注・他決の分析」に出ます。追客終了から別の段階に戻すと、理由は消えます

## 買い反響（ポータル）
- 段階を「**購入申込**」にすると、「商談案件管理へ転記しますか？」と聞かれます。「OK」で、**商談案件管理に「買」の案件が1件作られます**。物件名・価格を確かめてください
- その場で転記しなかったときは、段階の下の「**案件へ転記**」を押すと作れます。作った反響には「案件に連携済み」と出ます
- 「追客終了」の理由は、売り反響と同じように保存されます

> 注意：段階の名前は以前のアプリと同じです（通電済・内見済 など）。名前が違うと歩留まりの数に入らないため、選択肢にない名前は使わないでください。

## 商談案件管理
[[月次売上管理（不動産企画係）]] の数字のもとになる、商談案件の一覧です。
- 1行が1案件です。成約価格・進捗フェーズ・契約日・決済予定日・リフォームの受注額と粗利は、一覧のまま直せます（自動で保存）
- 仲介手数料は、成約価格から自動で計算します（800万円以下は30万円、それより上は価格×3％＋6万円・税抜）。手入力した額は黄色で出ます
- 「＋ 商談案件を追加」で、案件を手で作れます。「編集」で、共同担当と売上の割合、次回アクションなども直せます
- 上の「担当者別サマリー」は、失注を除いた案件の数と契約率、リフォームの受注額・粗利です

### 失注にする
1. 進捗フェーズで「失注」を選ぶ
2. 確認の画面で「OK」を押すと、編集の画面が開く
3. 「失注理由」を選び（必須）、必要なら「失注の詳細」を入れて保存する

失注理由は [[失注・他決の分析（不動産企画係）]] に出ます。

> 注意：次回アクション（予定日・内容）は、失注・決済完了以外の案件では必須です。

> 注意：媒介獲得台帳で現況を「買付有」にしたときに商談案件を作る「買付登録」は、まだ移していません。次の版で入れる予定です。

## 関係する記事
- [[不動産企画係の画面（入口と権限）]]
- [[月次売上管理（不動産企画係）]]
- [[失注・他決の分析（不動産企画係）]]
- [[売り反響・買い反響の歩留まり（不動産企画係）]]
````

### backend/scripts/sql/2026-11-04_update_log_2.2.244.sql（更新履歴の部分）
````sql
-- =====================================================================
-- v2.2.244 不動産企画係の反響から商談までの連携の見直し ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.244', '2026-11-04', '不動産企画係の画面で、反響の段階を変えたときに媒介獲得台帳・商談案件へ自動でつながるようにした。また、商談案件管理を以前のアプリと同じ一覧に直し、失注のときは理由を入れるようにした。');

````

## 修正したファイルの差分
````diff
diff --git a/backend-express/src/features/realty/importer.ts b/backend-express/src/features/realty/importer.ts
index ec4ce27ac..d3291e8c8 100644
--- a/backend-express/src/features/realty/importer.ts
+++ b/backend-express/src/features/realty/importer.ts
@@ -67,6 +67,8 @@ const IMPORT_COLUMNS = new Set([
   'endReason', 'ledgerNo', 'ledgerId', 'extId', 'dealId', 'dealNo',
   'subStaff', 'subRatio', 'coBroker', 'delivery',
   'reformPrice', 'reformGp', 'reformNote', 'createdAt',
+  // ⚠️ v2.2.244: 商談の失注理由（以前のアプリ v14.25〜。2026-11-04_realty_deal_lost.sql）
+  'lostReason', 'lostDate', 'lostNote',
   'receivedDate', 'connectDate', 'contactDate', 'visitDate', 'viewDate', 'baikaiDate',
   'contractDate', 'settleDate', 'followDate', 'inputDate', 'renewDate',
   'applicationDate', 'nextDate', 'nextNote',
@@ -87,7 +89,7 @@ const DATE_COLUMNS = new Set([
   'settleDate', 'contactDate', 'visitDate', 'connectDate', 'receivedDate',
   'viewDate', 'inputDate', 'renewDate', 'baikaiDate', 'nextDate', 'expiry',
   'taxCheckDate', 'buyContractDate', 'buySettleDate', 'listDate',
-  'sellContractDate', 'sellSettleDate',
+  'sellContractDate', 'sellSettleDate', 'lostDate',
 ]);
 /** DATETIME の列 */
 const DATETIME_COLUMNS = new Set(['docDraftAt']);
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 4ac64e9ad..6206986a2 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -161,6 +161,8 @@ const ALLOWED_COLUMNS = [
   'subStaff', 'subRatio', 'coBroker', 'delivery',
   // ⚠️ v2.2.222: 本番アプリ（V14.11〜）で増えた商談のリフォーム受注と、商談リストの登録日
   'reformPrice', 'reformGp', 'reformNote', 'createdAt',
+  // ⚠️ v2.2.244: 商談の失注理由（2026-11-04_realty_deal_lost.sql。importer.ts の IMPORT_COLUMNS にもある）
+  'lostReason', 'lostDate', 'lostNote',
   'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
   'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
   'contactDate', 'contractDate', 'settleDate', 'followDate',
diff --git a/backend/scripts/guide/articles/common/screen-230.md b/backend/scripts/guide/articles/common/screen-230.md
index aaaae6bb0..773580a18 100644
--- a/backend/scripts/guide/articles/common/screen-230.md
+++ b/backend/scripts/guide/articles/common/screen-230.md
@@ -9,7 +9,7 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 ## メニュー
 - **日々の行動**：[[今日の架電キュー（不動産企画係）]]・[[架電ナビ（一括査定）（不動産企画係）]]
 - **集計・分析**：チームサマリー（以前のアプリの「ダッシュボード」）・月次売上管理・月次媒介管理・失注・他決の分析
-- **入力・台帳**：売り反響（一括査定）・買い反響（ポータル）・商談案件管理・買取再販案件・媒介獲得台帳・売主への販売報告・媒介更新履歴・週次行動計画
+- **入力・台帳**：売り反響（一括査定）・買い反響（ポータル）・商談案件管理・買取再販案件・媒介獲得台帳・売主への販売報告・媒介更新履歴・週次行動計画（反響から台帳・案件への自動のつながりは [[反響から商談案件へのつながり（不動産企画係）]]）
 - **点検・管理**：データ品質チェック・コンプライアンス・設定・データ管理
 - **Dashboard**：月次報告書・掲載物件一覧（Dashboard にだけある画面）
 
diff --git a/backend/src/handlers/brokerAction/broker_update.php b/backend/src/handlers/brokerAction/broker_update.php
index 25acca3f8..0e51af12b 100644
--- a/backend/src/handlers/brokerAction/broker_update.php
+++ b/backend/src/handlers/brokerAction/broker_update.php
@@ -28,6 +28,8 @@ $allowedColumns = [
     'subStaff', 'subRatio', 'coBroker', 'delivery',
     // ⚠️ v2.2.222: 本番アプリで増えた商談のリフォーム受注と登録日（② の ALLOWED_COLUMNS と同じ）
     'reformPrice', 'reformGp', 'reformNote', 'createdAt',
+    // ⚠️ v2.2.244: 商談の失注理由（2026-11-04_realty_deal_lost.sql。② の ALLOWED_COLUMNS と同じ）
+    'lostReason', 'lostDate', 'lostNote',
     // リード（追客）
     'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
     'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index 98a95a423..cba5d8651 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -7,7 +7,8 @@ import type { Period } from '../common/leadFunnel';
 import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
-import { removeSpaces, safeParse, BUY_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { removeSpaces, safeParse, BUY_END_REASONS, BUY_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { buyToDeal } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
 import LeadCall, { CallLog } from '../common/LeadCall';
 import DocumentViewer from '../documents/DocumentViewer';
@@ -22,6 +23,12 @@ type BuyLead = {
     name: string;
     staff: string | null;
     phase: string;
+    /** 追客終了の理由 */
+    endReason?: string | null;
+    /** 商談案件へ転記したときの案件 id（v2.2.244 から一覧で作る） */
+    dealId?: string | null;
+    ledgerId?: string | null;
+    ledgerNo?: string | number | null;
     callDates: string | null;
     contactDate: string | null;
     phone: string;
@@ -273,7 +280,7 @@ const LeadBuy = () => {
      * brokerage_listings の1行を部分更新する。
      * 画面を先に更新し（楽観的更新）、保存に失敗したら元の値へ戻す。
      */
-    const handleApiPatch = async (id: string, fields: Record<string, unknown>) => {
+    const handleApiPatch = async (id: string, fields: Record<string, unknown>): Promise<boolean> => {
         // 失敗時に戻すための退避と、履歴の差分を取るための変更前の値。
         // setState の更新関数の中で拾うと React 18 では次のレンダリングまで
         // 実行されず、この直後の行では空のままになるためクロージャから取る。
@@ -295,10 +302,28 @@ const LeadBuy = () => {
                     by: userName || '不明',
                 });
             }
+            return true;
         } catch (e) {
             console.error('[LeadBuy] 保存に失敗しました', { id, fields }, e);
             setLeads(snapshot);
             alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
+            return false;
+        }
+    };
+
+    /**
+     * 購入申込 → 商談案件（買）へ転記（以前のアプリの buyToDeal。common/leadLinks.ts）。
+     * ⚠️ 案件に紐づいている（dealId がある）反響では作らない（二重に作らない）。
+     */
+    const linkToDeal = async (lead: BuyLead) => {
+        if (lead.dealId) { alert('既に商談案件に紐づいています。'); return; }
+        try {
+            const { no, leadFields } = await buyToDeal(lead as unknown as Record<string, unknown>);
+            setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...leadFields } as BuyLead : l)));
+            alert(`商談案件 No.${no} として転記しました。\n商談案件管理で物件名・価格を確認してください。`);
+        } catch (e) {
+            console.error('[LeadBuy] 商談案件への転記に失敗しました', lead.id, e);
+            alert('商談案件への転記に失敗しました。時間をおいて、もう一度お試しください。');
         }
     };
 
@@ -406,17 +431,29 @@ const LeadBuy = () => {
         handleApiUpdate(lead.id, 'staff', e.target.value);
     };
 
-    // 💡 追加: フェーズを「追客終了」にした際の理由入力（source.html の ieGuard 相当）
-    const handlePhaseBlur = (lead: BuyLead, e: React.FocusEvent<HTMLSelectElement>) => {
-        const val = e.target.value;
-        if (val === '追客終了') {
-            const reason = window.prompt(`追客終了の理由を入力してください（${BUY_END_REASONS.join('／')}）`, BUY_END_REASONS[0]);
-            if (reason == null) {
-                e.target.value = lead.phase || '';
-                return;
-            }
+    /**
+     * フェーズの変更（以前のアプリの ieGuard と同じ）。
+     * ⚠️ v2.2.244: 値が変わったときだけ動く（以前は onBlur で、触れるたびに保存し・追客終了の理由を聞き直していた）。
+     *   追客終了 … 理由を聞いて endReason も保存する（⚠️ 以前は聞いた理由を捨てていた）。追客終了から戻すと理由を消す
+     *   購入申込 … 保存したあと、確認して商談案件（買）へ転記する（⚠️ 案件に紐づいていない反響だけ）
+     */
+    const handlePhaseChange = async (lead: BuyLead, e: React.ChangeEvent<HTMLSelectElement>) => {
+        const select = e.target;
+        const prev = lead.phase || '';
+        const next = select.value;
+        if (next === prev) return;
+        const fields: Record<string, unknown> = { phase: next };
+        if (next === '追客終了') {
+            const reason = askEndReason(BUY_END_REASONS, lead.endReason);
+            if (reason == null) { select.value = prev; return; }
+            fields.endReason = reason;
+        } else if (lead.endReason) {
+            fields.endReason = '';
+        }
+        if (!(await handleApiPatch(lead.id, fields))) { select.value = prev; return; }
+        if (next === '購入申込' && !lead.dealId && window.confirm('商談案件管理へ「買」案件として転記しますか？')) {
+            await linkToDeal({ ...lead, ...fields } as BuyLead);
         }
-        handleApiUpdate(lead.id, 'phase', val);
     };
 
     // 💡 追加: 次回連絡日セルの視覚強化（source.html の nextCell() 相当）
@@ -548,9 +585,9 @@ const LeadBuy = () => {
                                         </select>
                                     </td>
                                     <td style={getTdStyle(false)}>
+                                        {/* ⚠️ v2.2.244: 以前のアプリの値。購入申込・追客終了は転記・理由が要るので、追加した後に一覧で変える */}
                                         <select style={compactInputStyle} defaultValue="反響受信" ref={newPhaseRef}>
-                                            <option value="">フェーズ</option>
-                                            {['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
+                                            {BUY_PHASES.filter(p => p !== '購入申込' && p !== '追客終了').map(p => <option key={p} value={p}>{p}</option>)}
                                         </select>
                                     </td>
                                     <td colSpan={9} style={{ ...getTdStyle(false), color: '#6c757d', textAlign: 'left', fontSize: '10px' }}>
@@ -614,11 +651,25 @@ const LeadBuy = () => {
                                                 <select
                                                     style={{ ...compactInputStyle, backgroundColor: isUnassigned ? '#fff' : '#f8f9fa', borderRadius: '4px', fontWeight: 'bold' }}
                                                     defaultValue={lead.phase || ''}
-                                                    onBlur={(e) => handlePhaseBlur(lead, e)}
+                                                    onChange={(e) => void handlePhaseChange(lead, e)}
                                                 >
                                                     <option value="">フェーズ</option>
-                                                    {['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
+                                                    {BUY_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
+                                                    {/* ⚠️ 選択肢に無い値（以前のアプリで手入力されたもの）も消さずに出す */}
+                                                    {lead.phase && !BUY_PHASES.includes(lead.phase) && <option value={lead.phase}>{lead.phase}</option>}
                                                 </select>
+                                                {/* ⚠️ v2.2.244: 以前のアプリの「案件へ転記」。購入申込・成約で、まだ案件に紐づいていない反響だけ */}
+                                                {(lead.phase === '購入申込' || lead.phase === '成約') && !lead.dealId && (
+                                                    <button
+                                                        type="button"
+                                                        style={{ fontSize: '9px', padding: '0 6px', height: '18px', marginTop: '2px', backgroundColor: '#fff', border: '1px solid #0d6efd', color: '#0d6efd', borderRadius: '10px', cursor: 'pointer' }}
+                                                        onClick={() => { if (window.confirm('商談案件管理へ「買」案件として転記しますか？')) void linkToDeal(lead); }}
+                                                        title="商談案件管理に「買」案件を作る"
+                                                    >
+                                                        案件へ転記
+                                                    </button>
+                                                )}
+                                                {lead.dealId && <div style={{ fontSize: '9px', color: '#198754', marginTop: '2px' }}>案件に連携済み</div>}
                                             </td>
                                             <td style={getTdStyle(isUnassigned)}>
                                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
diff --git a/frontend/src/components/realty/callq/CallQueue.tsx b/frontend/src/components/realty/callq/CallQueue.tsx
index b7f8e802a..3877a9783 100644
--- a/frontend/src/components/realty/callq/CallQueue.tsx
+++ b/frontend/src/components/realty/callq/CallQueue.tsx
@@ -5,7 +5,8 @@ import type { WeeklyRow } from '../common/realtyState';
 import { recordFieldChanges, saveBrokerageRecord } from '../common/leadUtiles';
 import LeadEdit from '../common/LeadEdit';
 import { todayStr } from '../summary/kpi';
-import type { Row } from '../summary/kpi';
+import type { Row, StaffSetting } from '../summary/kpi';
+import { linkLedgerAfterEdit } from '../common/leadLinks';
 import { openNavi } from '../navi/naviHost';
 import {
     CQ_OUT, ST, TAGL, build, callOutcome, callqConf, callqScripts, callsOnly, contactKpi, diffDays, keyOf, newListings,
@@ -239,6 +240,11 @@ const CallQueue: React.FC = () => {
         try {
             const row = await saveBrokerageRecord(str(cur.id), fields);
             replaceRow(kind, (row as Row | null) ?? { ...before, ...fields });
+            // ⚠️ v2.2.244: 売り反響を媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead）
+            if (kind === 'leads') {
+                const linked = await linkLedgerAfterEdit({ ...before, ...fields, id: cur.id }, settings.staff as StaffSetting[] | undefined);
+                if (linked) replaceRow(kind, { ...before, ...fields, ...((row as Row | null) ?? {}), ...linked.leadFields });
+            }
             if (before) {
                 await recordFieldChanges({
                     entity: kind === 'buyLeads' ? 'buy' : 'lead', entityId: str(cur.id),
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index a949d40f6..1ff8e391e 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -2,7 +2,7 @@ import React, { useEffect, useMemo, useContext, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import Table from 'react-bootstrap/Table';
 import AuthContext from '../../../context/AuthContext';
-import { removeSpaces, NEXT_QUICK, addDaysISO, LEAD_END_REASONS, BUY_END_REASONS } from './leadUtiles';
+import { removeSpaces, NEXT_QUICK, addDaysISO, LEAD_END_REASONS, BUY_END_REASONS, LEAD_PHASES, BUY_PHASES, NEXT_EXEMPT } from './leadUtiles';
 // 💡 追加: DocumentViewerをインポート
 import DocumentViewer from '../documents/DocumentViewer';
 // 💡 追加: サーバー保存済みの変更履歴
@@ -164,9 +164,9 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     const nameLabel = isSellType ? '売主名' : '顧客名';
     const sourceLabel = isSellType ? '反響元' : 'ポータル';
 
-    const phaseList = isSellType
-        ? ['反響受信', '追客中', '通電済み', '机上査定', '訪問査定', '査定書提出', '媒介受託', '売却済', '追客終了']
-        : ['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'];
+    // ⚠️ v2.2.244: 以前のアプリの値（leadUtiles.ts）。⚠️ 選択肢に無い今の値（手入力されたもの）は消さずに足す
+    const basePhases = isSellType ? LEAD_PHASES : BUY_PHASES;
+    const phaseList = customerInfo.phase && !basePhases.includes(customerInfo.phase) ? [...basePhases, customerInfo.phase] : basePhases;
 
     let titleLabel = '';
     switch (leadCategory) {
@@ -293,10 +293,16 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                 alert('追客終了の理由を選択してください。');
                 return;
             }
-        } else if (!customerInfo.nextDate || !String(customerInfo.nextNote || '').trim()) {
+        } else if (!NEXT_EXEMPT.includes(customerInfo.phase) && (!customerInfo.nextDate || !String(customerInfo.nextNote || '').trim())) {
+            // ⚠️ v2.2.244: 媒介受託・成約は免除（以前のアプリの V12.requireNext の CLOSED。以前は追客終了だけを免除していた）
             alert('次回アクション（次回連絡日・次回アクション内容）は必須です。');
             return;
         }
+        // ⚠️ v2.2.244: 媒介受託は媒介契約日を必須にする（以前のアプリの saveLead。保存後に媒介獲得台帳へ反映するため）
+        if (leadCategory === 'sell' && customerInfo.phase === '媒介受託' && !customerInfo.baikaiDate) {
+            alert('媒介受託にするには「媒介契約日」の入力が必要です。');
+            return;
+        }
         onSave();
     };
 
diff --git a/frontend/src/components/realty/common/leadUtiles.ts b/frontend/src/components/realty/common/leadUtiles.ts
index af0584fa5..723758c67 100644
--- a/frontend/src/components/realty/common/leadUtiles.ts
+++ b/frontend/src/components/realty/common/leadUtiles.ts
@@ -364,5 +364,29 @@ export const addDaysISO = (base: string | null | undefined, days: number): strin
     return `${y}-${m}-${day}`;
 };
 
-export const LEAD_END_REASONS = ['成約', '辞退・売側中止', '連絡不通', '対象外', 'その他'];
-export const BUY_END_REASONS = ['成約', '購入見送り', '連絡不能', '対象外', 'その他'];
\ No newline at end of file
+/**
+ * フェーズ・終了理由の選択肢（⚠️ v2.2.244 で以前のアプリ v14.29 の LEAD_PHASES / BUY_PHASES / PHASES / LEAD_ENDS / BUY_ENDS にそろえた）。
+ * ⚠️⚠️ **値を言い換えないこと。** 歩留まり（leadFunnel.ts・kpi.ts）と失注分析（LostAnalysis.tsx）はこの値で数える。
+ *   以前は「通電済み」「訪問査定」「内見済み」「成約（終了理由）」など別の値が入り、数から漏れていた。
+ */
+export const LEAD_PHASES = ['リード受信', '架電中', '通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託', '追客終了'];
+export const BUY_PHASES = ['反響受信', '追客中', '通電済', '内見予約', '内見済', '購入申込', '成約', '追客終了'];
+/** 商談案件（kind = deals）のフェーズ */
+export const DEAL_PHASES = ['初回接触', '資料送付', '内見済', '交渉中', '購入申込', '契約予定', '契約済', '決済完了', '失注'];
+export const LEAD_END_REASONS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];
+export const BUY_END_REASONS = ['他決', '購入見送り', '連絡不能', '対象外', 'その他'];
+/** 商談案件の失注理由（以前のアプリの DEAL_LOST_REASONS。失注・他決の分析も同じ値で数える） */
+export const DEAL_LOST_REASONS = ['価格・条件が合わない', '他社で成約（他決）', 'ローン否決・資金計画', '物件の問題（調査・瑕疵など）', 'お客様都合で見送り', '売主都合（売止・価格変更）', '連絡不能', 'その他'];
+/** 次回アクションを必須にしない（終わった）フェーズ。以前のアプリの V12 の CLOSED（summary/CommandCenter.tsx の CLOSED と同じ） */
+export const NEXT_EXEMPT = ['追客終了', '媒介受託', '成約', '失注', '決済完了'];
+
+/**
+ * 一覧で「追客終了」にしたときの理由（以前のアプリの ieGuard と同じ）。
+ * ⚠️ 選択肢に無い言葉も受け付ける（以前のアプリも自由入力。実データに「売却辞退」などがある）。空なら先頭（他決）。
+ * @returns null は取り消し
+ */
+export const askEndReason = (ends: string[], current: string | null | undefined): string | null => {
+    const v = window.prompt(`追客終了の理由を入力してください（${ends.join('／')}）`, current || ends[0]);
+    if (v == null) return null;
+    return v.trim() || ends[0];
+};
\ No newline at end of file
diff --git a/frontend/src/components/realty/lost/LostAnalysis.tsx b/frontend/src/components/realty/lost/LostAnalysis.tsx
index 611d0f190..668c1d04d 100644
--- a/frontend/src/components/realty/lost/LostAnalysis.tsx
+++ b/frontend/src/components/realty/lost/LostAnalysis.tsx
@@ -4,21 +4,22 @@ import { fyStartOf, periodGroups, periodHas, periodShort, recvMonthKey } from '.
 import type { Period } from '../common/leadFunnel';
 import { fiscalMonths, pct } from '../summary/kpi';
 import type { Row } from '../summary/kpi';
+// ⚠️ v2.2.244: 商談案件管理と同じ値を使う（以前はこの画面に同じ配列を持っていた）
+import { DEAL_LOST_REASONS } from '../common/leadUtiles';
 
 /**
  * 失注・他決の分析（不動産企画係。v2.2.225）。
  *
  * ⚠️ 移植元は本番アプリ（V18）の「🧩 失注・他決の分析」（renderLost）。計算・表・見出し・注記は同じ（括弧の中は移植元の名前）。
  *   売り反響・買い反響は受信月、商談案件は失注日（未入力は登録日）で数える。
- * ⚠️ 他決の詳細（lostWhy・lostTo・lostPrice・lostNote）や商談の失注理由（lostReason・lostDate）は DB の列に無いので、
- *   以前のアプリの原本（raw_data）から読む（rowOf）。
+ * ⚠️ 他決の詳細（lostWhy・lostTo・lostPrice・lostNote）は DB の列に無いので、以前のアプリの原本（raw_data）から読む（rowOf）。
+ * ⚠️ 商談の失注理由（lostReason・lostDate・lostNote）は v2.2.244 で列にした（商談案件管理で入れる）。
+ *   ⚠️ rowOf は列を優先する。取り込み済みの値は 2026-11-04_realty_deal_lost.sql で原本から列へ写してある。
  * ⚠️ 以前のアプリでは表の行を押すと編集画面が開いた。編集は売り反響・商談案件の画面で行う（この画面からは開かない）。
  */
 
 /** 終了理由（LEAD_ENDS） */
 const LEAD_ENDS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];
-/** 商談の失注理由（DEAL_LOST_REASONS） */
-const DEAL_LOST_REASONS = ['価格・条件が合わない', '他社で成約（他決）', 'ローン否決・資金計画', '物件の問題（調査・瑕疵など）', 'お客様都合で見送り', '売主都合（売止・価格変更）', '連絡不能', 'その他'];
 /** 他決の決め手（LEAD_LOST_WHY） */
 const LEAD_LOST_WHY = ['査定額が高かった', '大手の安心感', '知人・紹介・付き合い', '対応が早かった', '手数料・条件', '買取を選んだ', '地元での実績', '不明', 'その他'];
 /** 買い反響の終了理由（BUY_ENDS） */
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index fa4c71df9..f0ae967db 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -7,7 +7,8 @@ import type { Period } from '../common/leadFunnel';
 import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
-import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { askBaikaiDate, linkLedgerAfterEdit, linkLedgerWithNotice } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
 import LeadCall, { CallLog } from '../common/LeadCall';
 import DocumentViewer from '../documents/DocumentViewer';
@@ -48,6 +49,8 @@ export type SellLead = {
   targetProperty: string | null;
   endReason: string | null;
   ledgerNo: string | null;
+  /** 媒介契約日（媒介受託にしたとき。v2.2.244 から一覧でも入れる） */
+  baikaiDate?: string | null;
   extId: string | null;
   dealId: string | null;
   reinsDate: string | null;
@@ -137,6 +140,16 @@ const getLastAction = (callDatesJson: string | null) => {
   }
 };
 
+/**
+ * 架電の記録の日時（'YYYY-MM-DDTHH:mm'。端末の時刻）。LeadBuy.tsx と同じ。
+ * ⚠️ v2.2.244: 定義が無く、一覧の「📞 架電」を押すとエラーで止まっていた
+ */
+const getCurrentDateTime = () => {
+  const now = new Date();
+  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
+  return now.toISOString().slice(0, 16);
+};
+
 const compactThStyle: React.CSSProperties = {
   padding: '6px 8px',
   fontSize: '11px',
@@ -284,7 +297,7 @@ const LeadSell = () => {
    * 戻さないと「画面には反映されたのに DB には入っていない」状態になり、
    * 次のリロードで消えた理由が分からなくなるため。
    */
-  const handleApiPatch = async (id: string, fields: Record<string, unknown>) => {
+  const handleApiPatch = async (id: string, fields: Record<string, unknown>): Promise<boolean> => {
     // 失敗時に戻すための退避と、履歴の差分を取るための変更前の値。
     // setState の更新関数の中で拾うと React 18 では次のレンダリングまで
     // 実行されず、この直後の行では空のままになるためクロージャから取る。
@@ -306,13 +319,25 @@ const LeadSell = () => {
           by: userName || '不明',
         });
       }
+      return true;
     } catch (e) {
       console.error('[LeadSell] 保存に失敗しました', { id, fields }, e);
       setLeads(snapshot);
       alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
+      return false;
     }
   };
 
+  /**
+   * 媒介受託 → 媒介獲得台帳へ1行作る（以前のアプリの leadToLedger。common/leadLinks.ts）。
+   * ⚠️ 台帳に紐づいている（ledgerNo がある）反響では作らない（二重に作らない）。
+   */
+  const linkToLedger = async (lead: SellLead, baikaiDate: string) => {
+    if (lead.ledgerNo) return;
+    const linked = await linkLedgerWithNotice(lead as unknown as Record<string, unknown>, baikaiDate, settings.staff);
+    if (linked) setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...linked.leadFields } as SellLead : l)));
+  };
+
   const handleApiUpdate = (id: string, field: string, value: string | number) => {
     void handleApiPatch(id, { [field]: value });
   };
@@ -358,7 +383,7 @@ const LeadSell = () => {
       propStatus: null,
       currentStatus: null,
       type: null,
-      phase: newPhaseRef.current?.value || '反響受信',
+      phase: newPhaseRef.current?.value || 'リード受信',
       priority: null,
       property: null,
       targetProperty: null,
@@ -482,17 +507,33 @@ const LeadSell = () => {
     handleApiUpdate(lead.id, 'staff', e.target.value);
   };
 
-  // 💡 追加: フェーズを「追客終了」にした際の理由入力（source.html の ieGuard 相当）
-  const handlePhaseBlur = (lead: SellLead, e: React.FocusEvent<HTMLSelectElement>) => {
-    const val = e.target.value;
-    if (val === '追客終了') {
-      const reason = window.prompt(`追客終了の理由を入力してください（${LEAD_END_REASONS.join('／')}）`, LEAD_END_REASONS[0]);
-      if (reason == null) {
-        e.target.value = lead.phase || '';
-        return;
-      }
+  /**
+   * フェーズの変更（以前のアプリの ieGuard と同じ）。
+   * ⚠️ v2.2.244: 値が変わったときだけ動く（以前は onBlur で、触れるたびに保存し・追客終了の理由を聞き直していた）。
+   *   追客終了 … 理由を聞いて endReason も保存する（⚠️ 以前は聞いた理由を捨てていた）。追客終了から戻すと理由を消す
+   *   媒介受託 … 媒介契約日を聞き、媒介獲得台帳へ1行作る
+   */
+  const handlePhaseChange = async (lead: SellLead, e: React.ChangeEvent<HTMLSelectElement>) => {
+    const select = e.target;
+    const prev = lead.phase || 'リード受信';
+    const next = select.value;
+    if (next === prev) return;
+    const fields: Record<string, unknown> = { phase: next };
+    let baikaiDate: string | null = null;
+    if (next === '追客終了') {
+      const reason = askEndReason(LEAD_END_REASONS, lead.endReason);
+      if (reason == null) { select.value = prev; return; }
+      fields.endReason = reason;
+    } else if (lead.endReason) {
+      fields.endReason = '';
+    }
+    if (next === '媒介受託') {
+      baikaiDate = askBaikaiDate(lead.baikaiDate);
+      if (baikaiDate == null) { select.value = prev; return; }
+      fields.baikaiDate = baikaiDate;
     }
-    handleApiUpdate(lead.id, 'phase', val);
+    if (!(await handleApiPatch(lead.id, fields))) { select.value = prev; return; }
+    if (baikaiDate != null) await linkToLedger(lead, baikaiDate);
   };
 
   // 💡 追加: 次回連絡日セルの視覚強化（source.html の nextCell() 相当）
@@ -517,7 +558,12 @@ const LeadSell = () => {
       // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
       // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
       const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
-      void handleApiPatch(id, fields);
+      const saved = customerInfo as SellLead;
+      void handleApiPatch(id, fields).then(async ok => {
+        // ⚠️ v2.2.244: 媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead。媒介契約日は LeadEdit が必須にしている）
+        const linked = ok ? await linkLedgerAfterEdit(saved as unknown as Record<string, unknown>, settings.staff) : null;
+        if (linked) setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...linked.leadFields } as SellLead : l)));
+      });
     }
     setIsEditModalOpen(false);
   };
@@ -628,9 +674,9 @@ const LeadSell = () => {
                     </select>
                   </td>
                   <td style={getTdStyle(false)}>
-                    <select style={compactInputStyle} defaultValue="反響受信" ref={newPhaseRef}>
-                      <option value="">フェーズ</option>
-                      {['反響受信', '追客中', '通電済み', '机上査定', '訪問査定', '査定書提出', '媒介受託', '売却済', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
+                    {/* ⚠️ v2.2.244: 以前のアプリの値。媒介受託・追客終了は日付・理由が要るので、追加した後に一覧で変える */}
+                    <select style={compactInputStyle} defaultValue="リード受信" ref={newPhaseRef}>
+                      {LEAD_PHASES.filter(p => p !== '媒介受託' && p !== '追客終了').map(p => <option key={p} value={p}>{p}</option>)}
                     </select>
                   </td>
                   <td colSpan={9} style={{ ...getTdStyle(false), color: '#6c757d', textAlign: 'left', fontSize: '10px' }}>
@@ -700,11 +746,12 @@ const LeadSell = () => {
                       <td style={getTdStyle(isUnassigned)}>
                         <select
                           style={{ ...compactInputStyle, backgroundColor: isUnassigned ? '#fff' : '#f8f9fa', borderRadius: '4px', fontWeight: 'bold' }}
-                          defaultValue={lead.phase || ''}
-                          onBlur={(e) => handlePhaseBlur(lead, e)}
+                          defaultValue={lead.phase || 'リード受信'}
+                          onChange={(e) => void handlePhaseChange(lead, e)}
                         >
-                          <option value="">リード受信</option>
-                          {['架電中', '通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
+                          {LEAD_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
+                          {/* ⚠️ 選択肢に無い値（以前のアプリで手入力されたもの）も消さずに出す */}
+                          {lead.phase && !LEAD_PHASES.includes(lead.phase) && <option value={lead.phase}>{lead.phase}</option>}
                         </select>
                       </td>
                       <td style={getTdStyle(isUnassigned)}>
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index ba78cfc52..a82bcfae0 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -7,6 +7,7 @@ import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
 import LeadEdit, { LeadCategory } from '../common/LeadEdit';
 import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { linkLedgerAfterEdit } from '../common/leadLinks';
 // ⚠️ v2.2.222: 年間予算進捗・月次KPI・架電実績・朝礼用アラートは本番アプリの集計をそのまま写した kpi.ts で出す
 import {
     ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
@@ -260,6 +261,11 @@ const Summary = () => {
 
         try {
             await saveBrokerageRecord(id, fields);
+            // ⚠️ v2.2.244: 売り反響を媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead）
+            if (!isBuy) {
+                const linked = await linkLedgerAfterEdit({ ...(before ?? {}), ...fields, id }, settings.staff);
+                if (linked) setTarget(prev => prev.map(l => (l.id === id ? { ...l, ...linked.leadFields } as SummaryLead : l)));
+            }
             // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
             if (before) {
                 await recordFieldChanges({
diff --git a/frontend/src/components/realty/summary/kpi.ts b/frontend/src/components/realty/summary/kpi.ts
index 3977c9cf5..0547bcfe6 100644
--- a/frontend/src/components/realty/summary/kpi.ts
+++ b/frontend/src/components/realty/summary/kpi.ts
@@ -153,7 +153,7 @@ export const leadCost = (rows: Row[], mk: string, costs: Record<string, number>
 export const CONFIRMED = ['契約済', '契約予定', '決済完了'];
 
 /** 標準の仲介手数料（stdFee）。800万円以下は30万円、それ超は 3%＋6万円 */
-const stdFee = (price: number): number => (!price || price <= 0 ? 0 : price <= 8_000_000 ? 300_000 : Math.round(price * 0.03 + 60_000));
+export const stdFee = (price: number): number => (!price || price <= 0 ? 0 : price <= 8_000_000 ? 300_000 : Math.round(price * 0.03 + 60_000));
 
 /** 仲介手数料（dealFee）。手入力のときはその値 */
 export const dealFee = (d: Row): number => (num(d.feeManual) ? num(d.fee) : stdFee(num(d.price)));
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index c53859532..6f909408c 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.243';
+export const newVersion = '2.2.244';
````
