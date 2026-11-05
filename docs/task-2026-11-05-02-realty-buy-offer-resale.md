# 2026-11-05 v2.2.246 不動産企画係：媒介台帳の買付登録・売り反響から買取案件へ

## 依頼
- 「買取再販の誤りを直す以外を 246 で進める」
  - 買付登録（媒介台帳の「買付有」→ 商談案件）
  - 売り反響 → 買取案件へ移す操作
  - 買取再販の誤りの修正は次の版へ
- 利用者の判断（11/05）
  - 「買取案件へ」は、売り反響の行に置く（媒介受託で台帳ができた反響）
  - 買取再販案件の「＋ 案件を登録」は消す（必ず反響から作る）
- 制作者の業務の流れ（11/04）
  - 仲介：④購入申込で商談案件（売主⇔物件⇔買主）
  - 買取：①売り反響と物件が紐づく → ②自社買取の場合に買取案件へ移行

## 元のアプリ（v14.29.1）の作り
- 買付登録（openCoBroker / saveCoBroker / ledgerToDeal / ledgerToDealOwn / cbUnlink / cbPromptOnStatus）
  - 他社客付け：商談案件「売」を1件作り、台帳に客付けの内容（coBroker）を持たせる
  - 自社客付け：買い反響から買主を選び、「売」「買」の2件を作る
  - 台帳は dealId を持ち、現況を「買付有」にする。連携の解除では案件を残す
  - 現況を「買付有」にしたら、買付登録へ案内する
- 売り反響 → 買取案件へ直接移す操作は無かった
  - 媒介台帳の媒介種別「買取」と、買取再販案件の台帳 No.（ledgerNo）でつないでいた
  - ローカルのデータでも、媒介種別が買取の台帳が18件あり、買取再販11件はすべて台帳 No. でつながっている

## やったこと
| 画面 | 内容 |
|---|---|
| 媒介獲得台帳 | 「客付・案件」の列を足した。案件につながっていれば「案件No.」（押すと解除の画面）、なければ「🤝買付登録」（媒介終了は「-」） |
| 媒介獲得台帳 | 編集画面で現況を「買付有」にして保存したら、買付登録の画面を開くか聞く |
| 買付登録の画面（新規） | 他社客付け・自社客付け。入力・必須・確かめ方は元のアプリと同じ。自社が売主の物件（媒介種別が買取・売主が自社名義）は、手数料を計上しない印が最初から付く |
| 売り反響 | 台帳がある反響（媒介受託）の行に「買取案件へ」。台帳の媒介種別を「買取」にし、買取再販案件（仕入検討）を1件作って台帳 No. でつなぐ。同じ台帳には2件目を作らない |
| 買取再販案件 | 「＋ 案件を登録」を消し、案内の文に替えた |

### 気づいたこと（今回は直していない）
- 買取再販案件の「仕入担当・販売担当」の選択肢は、スタッフ表の名前（例「時任 聡一朗」）で、空白が入っている
  - 元のアプリから来た案件や、今回作る案件は、空白の無い名前（設定の担当者・歩留まりの集計と同じ）で入っている
  - そのため、編集画面では「未設定」と表示される。前からある食い違いで、v2.2.247（買取再販の修正）で直す
- 媒介受託で台帳を作るとき、所在地1に市、所在地2に住所全体を入れている（元のアプリと同じ）
  - そのため、商談案件の物件名の候補が「霧島市霧島市…」と重なっていた。候補を作るときに重ねないように直した（guessProperty）

## ディレクトリ・ファイル
| 区分 | ファイル | 内容 |
|---|---|---|
| 新規 | `frontend/src/components/realty/common/BuyOfferModal.tsx` | 買付登録の画面 |
| 修正 | `frontend/src/components/realty/common/leadLinks.ts` | 追加した関数・定数・型：`OWN_SELLER`・`OFFER_STATUS`・`BUYER_ATTRS`・`CoBroker`・`BuyOfferInput`・`isOwnStock`・`guessProperty`・`registerBuyOffer`・`unlinkBuyOffer`・`leadToResale`（と内部の `addDays`・`resaleCategoryOf`） |
| 修正 | `frontend/src/components/database/DatabaseBroker.tsx` | 「客付・案件」の列、買付登録の画面、現況「買付有」の案内、案件の No. の読み込み（`loadDeals`・`onOfferSaved`・`closeOffer`） |
| 修正 | `frontend/src/components/realty/sell/LeadSell.tsx` | 「買取案件へ」（`moveToResale`） |
| 修正 | `frontend/src/components/realty/resale/LeadResale.tsx` | 「＋ 案件を登録」（`openNewDeal`）を消した |
| 修正 | `frontend/src/utils/version.ts` | 2.2.246 |
| 新規 | `backend/scripts/sql/2026-11-05_update_log_2.2.246.sql` | 更新履歴と業務ガイド1本 |
| 修正 | `backend/scripts/guide/articles/common/screen-247.md` | 業務ガイド |

- ② VPS・① PHP・DB の列は変えていない
  - 使う列（dealId・coBroker・ledgerId・ledgerNo・baikaiType）は、もともと ①② の許可リストにある
  - 新しい request も無い

## 業務ガイド
- **反響から商談案件へのつながり（不動産企画係）** を直した
  - 「買付が入ったら（買付登録）」と「売り反響から買取へ（自社買取）」の節を足した
  - 「買付登録はまだ移していない」の注意を消した
  - 商談案件の作り方に、買付登録を足した
  - 買取再販案件の画面でも新しく作れないことを書いた
  - 存在しない記事へのリンク（[[買取再販案件]]）を作らないよう、文にした

## テスト
- 型（`npx tsc --noEmit -p frontend`）は0件。本番用ビルドが通った
- ① を通す：トークン無しで `broker:update`・`planner:records` を送ると 401
- update_log をローカルに流した（no=345。文は UPDATE で合わせ、記事も入れた）
- Playwright（3100・Master）。テスト用の台帳2件（No.9001・9002）・売り反響1件・買い反響1件を DB に入れて確かめた
  - 一覧に「客付・案件」の列がある
  - 他社客付け
    - 会社名なしで登録すると止まる
    - 登録すると商談案件 No.79（売・購入申込・担当は台帳の略称から氏名・価格は販売価格・手数料は自動）ができる
    - 台帳は「買付有」になり、客付け会社が残る。一覧に「案件No.79」が出る
  - 解除：確認のあと、台帳のつながりだけが外れ、案件は残る
  - 自社客付け
    - 買い反響を検索して選ぶと、No.80（売）・No.81（買。担当は買い反響の担当）ができる
    - 買い反響は「購入申込」になり、台帳 No.9001 につながり、物件名が入る
  - 編集画面で台帳 No.9002 の現況を「買付有」にして保存すると、案内のあとに買付登録の画面が開く
  - 媒介種別が「買取」の台帳では、手数料を計上しない印が最初から付き、「0 円で登録」と出る
  - 売り反響の「買取案件へ」
    - 買取再販案件 No.12（仕入検討・戸建・担当・売主・査定価格・台帳No.9001）ができ、台帳は「買取」になる
    - 2回目は「既に No.12 がつながっています」と出る
  - 買取再販案件
    - 「案件を登録」ボタンは無く、案内の文が出る
    - No.12 の行が出て、編集画面で台帳 No.9001 とのつながりと、標準の費目が出る
  - 画面のエラーは0件
- 物件名の候補の重なりを直したあと、もう一度流して同じ結果になった（物件名は「霧島市テスト町1-1」）
- 後片付け：テストの台帳・反響・作った案件・買取再販案件・履歴と、仮スタッフを消した
  - 行数は元の2,986、各 No. の最大も元のまま（商談案件 78・買取再販 11・台帳 217）
  - 開発サーバー（3100）を止めた

## 新規ファイルの全文

### frontend/src/components/realty/common/BuyOfferModal.tsx
````tsx
import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { loadRecords } from './realtyState';
import { safeParse } from './leadUtiles';
import { BUYER_ATTRS, guessProperty, isOwnStock, registerBuyOffer, unlinkBuyOffer } from './leadLinks';
import type { BuyOfferInput, CoBroker } from './leadLinks';
import { fmtYen, stdFee } from '../summary/kpi';
import type { Row, StaffSetting } from '../summary/kpi';

/**
 * 媒介獲得台帳の「買付登録」（v2.2.246 新規）。以前のアプリ v14.29 の openCoBroker / saveCoBroker と同じ入力・同じ確かめ方。
 *
 * ─────────────────────────────────────────────
 *   他社客付け … 客付け会社が必須。商談案件「売」を1件（自社は売主側の片手）
 *   自社客付け … 買い反響から買主を選ぶ。商談案件「売」「買」の2件（両手）
 *   作ったら台帳の現況を「買付有」にし、台帳に案件をつなぐ（common/leadLinks.ts の registerBuyOffer）
 *
 * ⚠️ 案件につながっている台帳では、登録の代わりに案件の No. と「連携を解除」を出す（二重に作らない）。
 * ⚠️ 自社が売主（媒介種別が買取・売主が自社名義）の物件は、仲介手数料を計上しない（既定で印が付く）。
 * ─────────────────────────────────────────────
 */

type Props = {
    /** 対象の台帳（null は閉じている） */
    ledger: Row | null;
    staffSettings: StaffSetting[];
    userName: string;
    onClose: () => void;
    /** 登録・解除したあと。台帳に保存した値を返す（一覧を直すため） */
    onSaved: (ledgerId: string, ledgerFields: Row) => void;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
/** 台帳の coBroker（⚠️ DB からは JSON の文字列で届くことがある） */
const coBrokerOf = (v: unknown): Partial<CoBroker> | null => {
    const o = typeof v === 'string' ? safeParse(v) : v;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Partial<CoBroker>) : null;
};
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };

const BuyOfferModal = ({ ledger, staffSettings, userName, onClose, onSaved }: Props) => {
    const [deals, setDeals] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<BuyOfferInput | null>(null);
    const [leadId, setLeadId] = useState('');
    const [leadQ, setLeadQ] = useState('');
    const [showLost, setShowLost] = useState(false);

    const staffNames = useMemo(() => staffSettings.map(s => str(s.name)).filter(Boolean), [staffSettings]);

    useEffect(() => {
        if (!ledger) return;
        const cb = coBrokerOf(ledger.coBroker) ?? {};
        const abbr = str(ledger.staff);
        setForm({
            kind: 'out', company: str(cb.company), person: str(cb.person), contact: str(cb.contact),
            price: Number(cb.price) || Number(ledger.price) || 0, contractDate: str(cb.contractDate), deliveryDate: str(cb.deliveryDate),
            buyerName: str(cb.buyerName), buyerAttr: str(cb.buyerAttr) || BUYER_ATTRS[0], property: guessProperty(ledger),
            staff: staffSettings.find(s => s.abbr === abbr)?.name ?? '', noFee: isOwnStock(ledger), note: str(cb.note),
        });
        setLeadId(''); setLeadQ(''); setShowLost(false);
        setLoading(true);
        loadRecords(['deals', 'buyLeads'])
            .then(({ records }) => { setDeals(records.deals); setBuyLeads(records.buyLeads); })
            .catch(e => { console.error('[BuyOfferModal] 読み込みに失敗しました', e); alert('商談案件・買い反響を読み込めませんでした。'); onClose(); })
            .finally(() => setLoading(false));
    }, [ledger, staffSettings, onClose]);

    const linked = ledger ? deals.find(d => str(d.id) === str(ledger.dealId)) : undefined;
    const dangling = !!ledger && str(ledger.dealId) !== '' && !linked && !loading;

    /** 買主の候補（自社客付け）。名前・ポータル・問合せ物件・台帳No. で探す。⚠️ 追客終了は印を付けたときだけ */
    const leadOptions = useMemo(() => {
        const q = leadQ.trim();
        return buyLeads
            .filter(b => showLost || str(b.phase) !== '追客終了')
            .filter(b => !q || [b.name, b.portal, b.targetProperty, b.contact, b.ledgerNo].some(v => str(v).includes(q)))
            .sort((a, b) => str(b.receivedDate).localeCompare(str(a.receivedDate)))
            .slice(0, 30);
    }, [buyLeads, leadQ, showLost]);
    const selectedLead = buyLeads.find(b => str(b.id) === leadId) ?? null;

    if (!ledger || !form) return null;
    const set = (p: Partial<BuyOfferInput>) => setForm(prev => (prev ? { ...prev, ...p } : prev));
    const own = form.kind === 'own';
    const ledNo = str(ledger.no) || '―';

    const save = async () => {
        if (busy) return;
        const inp: BuyOfferInput = { ...form, company: form.company.trim(), property: form.property.trim(), buyerName: form.buyerName.trim() };
        const miss: string[] = [];
        if (own) {
            if (!selectedLead) { alert('買主となる買い反響を選んでください。'); return; }
            const bd = deals.find(d => str(d.id) === str(selectedLead.dealId));
            if (bd && !window.confirm(`この買い反響は、既に商談案件 No.${str(bd.no)}「${str(bd.property)}」（${str(bd.phase)}）につながっています。\nこのまま登録すると、買い反響のつながりが新しく作る「買」案件に置き換わります（No.${str(bd.no)} は消えません）。続けますか？`)) return;
            if (str(selectedLead.phase) === '追客終了' && !window.confirm('この買い反響は「追客終了」です。買付登録して商談案件を作りますか？')) return;
            if (str(selectedLead.ledgerId) && str(selectedLead.ledgerId) !== str(ledger.id) && !window.confirm(`この買い反響は、別の物件（台帳No.${str(selectedLead.ledgerNo) || '―'}）につながっています。\n台帳No.${ledNo} の買付として登録しますか？（買い反響側のつながり先は変えません）`)) return;
            inp.company = '';
            if (!inp.buyerName) inp.buyerName = str(selectedLead.name);
            if (!inp.staff) inp.staff = str(selectedLead.staff);
        } else if (!inp.company) {
            miss.push('客付け会社名');
        }
        if (!inp.price) miss.push('買付金額');
        if (!inp.property) miss.push('物件名');
        if (miss.length) { alert(`未入力の項目があります：${miss.join('・')}`); return; }
        if (inp.contractDate && inp.deliveryDate && inp.deliveryDate < inp.contractDate && !window.confirm('引渡希望日が契約希望日より前になっています。このまま登録しますか？')) return;
        const listPrice = Number(ledger.price) || 0;
        if (listPrice && inp.price < listPrice * 0.7 && !window.confirm(`買付金額が販売価格（${fmtYen(listPrice)}）を大きく下回っています。このまま登録しますか？`)) return;

        setBusy(true);
        try {
            const r = await registerBuyOffer(ledger, inp, own ? selectedLead : null, userName || '不明');
            onSaved(str(ledger.id), r.ledgerFields);
            alert(r.buyNo
                ? `商談案件 No.${r.sellNo}（売）・No.${r.buyNo}（買）を作り、台帳 No.${ledNo}・買い反響とつなぎました。\n商談案件管理で物件名・価格・担当を確かめてください。`
                : `商談案件 No.${r.sellNo} を作り、台帳 No.${ledNo} とつなぎました。\n商談案件管理で物件名・価格・担当を確かめてください。`);
            onClose();
        } catch (e) {
            console.error('[BuyOfferModal] 買付登録に失敗しました', ledger.id, e);
            alert('買付登録に失敗しました。商談案件管理で、途中まで作られた案件が無いか確かめてから、もう一度お試しください。');
        } finally {
            setBusy(false);
        }
    };

    const unlink = async () => {
        if (!window.confirm(`台帳 No.${ledNo} と商談案件のつながりを解除します。\n（商談案件そのものは消えません。必要なら商談案件管理で失注にしてください）\nよろしいですか？`)) return;
        setBusy(true);
        try {
            onSaved(str(ledger.id), await unlinkBuyOffer(ledger, userName || '不明'));
            alert('連携を解除しました。もう一度登録できます。');
            onClose();
        } catch (e) {
            console.error('[BuyOfferModal] 解除に失敗しました', ledger.id, e);
            alert('解除に失敗しました。もう一度お試しください。');
        } finally {
            setBusy(false);
        }
    };

    const cb = coBrokerOf(ledger.coBroker);

    return (
        <Modal show onHide={onClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>
                    {linked ? '⚠ 既に商談案件へ連携済みです' : `🤝 買付登録（台帳 No.${ledNo}）`}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ fontSize: '12px' }}>
                {loading ? (
                    <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                ) : linked ? (
                    <div>
                        <p className="mb-2">台帳 No.{ledNo}（{str(ledger.seller)}）は、すでに <b>商談案件 No.{str(linked.no)}「{str(linked.property)}」</b>（{str(linked.phase)}）へ連携されています。</p>
                        {cb?.company && <p className="mb-2 text-muted">客付け：{cb.company}{cb.person ? `（${cb.person}）` : ''}／買主：{cb.buyerName || '―'}</p>}
                        <p className="text-muted mb-0">買付の条件は、商談案件管理で直してください。買付が白紙になったときは「連携を解除」してから、もう一度登録できます。</p>
                    </div>
                ) : (
                    <div className="row g-2">
                        <div className="col-12 text-muted">
                            売主：<b>{str(ledger.seller) || '（未入力）'}</b>／{str(ledger.baikaiType) || '媒介種別未設定'}／{str(ledger.addr1)}{str(ledger.addr2).split('http')[0].trim()}
                            {Number(ledger.price) ? `／販売価格 ${fmtYen(Number(ledger.price))}` : ''}
                        </div>
                        {dangling && <div className="col-12 text-danger">⚠ 以前につないだ商談案件が見つかりません。登録すると、新しい商談案件を作ってつなぎ直します。</div>}
                        <div className="col-12">
                            <div style={label}>客付け区分</div>
                            <select className="form-select form-select-sm" value={form.kind} onChange={e => set({ kind: e.target.value as 'out' | 'own' })}>
                                <option value="out">🤝 他社客付け（他社のお客様。自社は売主側の片手）</option>
                                <option value="own">🏠 自社客付け（自社の買い反響のお客様。両手）</option>
                            </select>
                        </div>
                        {own ? (
                            <div className="col-12">
                                <div style={label}>買主＝買い反響から選ぶ <span className="text-danger">*</span></div>
                                <div className="d-flex gap-2 align-items-center mb-1">
                                    <input className="form-control form-control-sm" placeholder="顧客名・ポータル・問合せ物件・台帳No. で探す" value={leadQ} onChange={e => setLeadQ(e.target.value)} />
                                    <label className="d-flex align-items-center gap-1 text-nowrap" style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" checked={showLost} onChange={e => setShowLost(e.target.checked)} />追客終了も出す
                                    </label>
                                </div>
                                <select className="form-select form-select-sm" size={6} value={leadId} onChange={e => setLeadId(e.target.value)} aria-label="買い反響">
                                    {leadOptions.map(b => (
                                        <option key={str(b.id)} value={str(b.id)}>
                                            {str(b.receivedDate).slice(0, 10)}　{str(b.name) || '（名称なし）'}　{str(b.portal)}　{str(b.phase)}{str(b.dealId) ? '（案件連携済）' : ''}　{str(b.targetProperty)}
                                        </option>
                                    ))}
                                </select>
                                {selectedLead && <div className="text-muted mt-1">選択中：{str(selectedLead.name)}（担当 {str(selectedLead.staff) || '未割当'}）</div>}
                            </div>
                        ) : (
                            <>
                                <div className="col-md-4"><div style={label}>客付け会社名 <span className="text-danger">*</span></div>
                                    <input className="form-control form-control-sm" placeholder="○○不動産（株）" value={form.company} onChange={e => set({ company: e.target.value })} /></div>
                                <div className="col-md-4"><div style={label}>客付け担当者名</div>
                                    <input className="form-control form-control-sm" value={form.person} onChange={e => set({ person: e.target.value })} /></div>
                                <div className="col-md-4"><div style={label}>客付け連絡先（TEL・メール）</div>
                                    <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                            </>
                        )}
                        <div className="col-md-4"><div style={label}>買付金額(円) <span className="text-danger">*</span></div>
                            <input type="number" className="form-control form-control-sm" value={form.price || ''} onChange={e => set({ price: Number(e.target.value) || 0 })} /></div>
                        <div className="col-md-4"><div style={label}>契約希望日（＝商談案件の契約日。月次売上の計上月）</div>
                            <input type="date" className="form-control form-control-sm" value={form.contractDate} onChange={e => set({ contractDate: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>引渡（決済）希望日</div>
                            <input type="date" className="form-control form-control-sm" value={form.deliveryDate} onChange={e => set({ deliveryDate: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>買主氏名{own ? '（空なら買い反響の名前）' : ''}</div>
                            <input className="form-control form-control-sm" value={form.buyerName} onChange={e => set({ buyerName: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>買主属性</div>
                            <select className="form-select form-select-sm" value={form.buyerAttr} onChange={e => set({ buyerAttr: e.target.value })}>
                                {BUYER_ATTRS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select></div>
                        <div className="col-md-4"><div style={label}>自社担当者</div>
                            <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                                <option value=""></option>
                                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select></div>
                        <div className="col-12"><div style={label}>物件名（商談案件に入る） <span className="text-danger">*</span></div>
                            <input className="form-control form-control-sm" value={form.property} onChange={e => set({ property: e.target.value })} /></div>
                        <div className="col-12">
                            <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.noFee} onChange={e => set({ noFee: e.target.checked })} />仲介手数料を計上しない（自社が売主＝買取再販の物件）
                            </label>
                            <div className="text-muted">{form.noFee ? '自社が売主のため、仲介手数料は 0 円で登録します' : `仲介手数料（自動計算・税抜）：${fmtYen(stdFee(form.price))}`}</div>
                        </div>
                        <div className="col-12"><div style={label}>備考（買付条件・融資の利用・特約など）</div>
                            <input className="form-control form-control-sm" placeholder="ローン特約あり（○○銀行）・引渡猶予2週間 など" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                        <div className="col-12 text-muted mt-2">
                            {own
                                ? '📌 登録すると、商談案件管理に「売」案件（売主側）と「買」案件（買主側）の2件を作り、台帳・買い反響の両方につなぎます。両手のため、仲介手数料はそれぞれの案件で自動計算します。'
                                : `📌 登録すると、商談案件管理に「売」案件（自社＝元付）を1件作り、台帳の現況を「買付有」にします。買主側は他社客付けのため、自社の手数料は売主側の片手です。`}
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                {linked ? (
                    <>
                        <button className="btn btn-outline-danger btn-sm me-auto" disabled={busy} onClick={() => void unlink()}>連携を解除</button>
                        <button className="btn btn-primary btn-sm" onClick={onClose}>閉じる</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-light border btn-sm" onClick={onClose}>キャンセル</button>
                        <button className="btn btn-primary btn-sm fw-bold" disabled={busy || loading} onClick={() => void save()}>{busy ? '登録しています…' : '登録'}</button>
                    </>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default BuyOfferModal;
````

### backend/scripts/sql/2026-11-05_update_log_2.2.246.sql（更新履歴の部分）
````sql
-- =====================================================================
-- v2.2.246 不動産企画係：媒介台帳の買付登録・売り反響から買取案件へ ＋ update_log
--   （末尾に業務ガイド「反響から商談案件へのつながり（不動産企画係）」の上書き）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.246', '2026-11-05', '不動産企画係の媒介獲得台帳から買付を登録して商談案件を作れるようにした（他社客付け・自社客付け）。また、売り反響から買取再販案件を作れるようにし、買取再販案件の画面では新しく作れないようにした（必ず反響から作る）。');

-- ---------------------------------------------------------------
````

## 修正したファイルの差分
````diff
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index f67be4aeb..716a8a703 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -2,7 +2,7 @@
 title: 反響から商談案件へのつながり（不動産企画係）
 section: 画面の使い方
 sort: 247
-summary: 売り反響・買い反響の段階を変えたときに媒介獲得台帳・商談案件管理へ自動で反映される動きと、商談案件管理・媒介獲得台帳の使い方。
+summary: 売り反響・買い反響から媒介獲得台帳・商談案件・買取再販案件へつなぐ動き（媒介受託・購入申込・買付登録・買取案件へ）と、商談案件管理・媒介獲得台帳の使い方。
 ---
 不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へ自動でつながります。以前のアプリと同じ動きです。
 
@@ -24,11 +24,29 @@ summary: 売り反響・買い反響の段階を変えたときに媒介獲得
 - 1行が1案件です。成約価格・進捗フェーズ・契約日・決済予定日・リフォームの受注額と粗利は、一覧のまま直せます（自動で保存）
 - 仲介手数料は、成約価格から自動で計算します（800万円以下は30万円、それより上は価格×3％＋6万円・税抜）。手入力した額は黄色で出ます
 - 「編集」で、共同担当と売上の割合、次回アクションなども直せます
-- この画面では、案件を新しく作れません。案件は必ず買い反響（「購入申込」）から作ります。どの反響から来たお客様かを、あとで辿れるようにするためです
+- この画面では、案件を新しく作れません。案件は、買い反響の「購入申込」か、媒介獲得台帳の「買付登録」（下）から作ります。どの反響から来たお客様かを、あとで辿れるようにするためです
 
 ## 媒介獲得台帳
 - 媒介も、この画面では新しく作れません。必ず売り反響を「媒介受託」にして作ります。売主がどの反響から来たかを、あとで辿れるようにするためです
 - 一覧は、**媒介契約日の新しい順に、全件を1枚**で出します（ページの切り替えはありません）。媒介契約日が入っていない台帳は、いちばん下に出ます
+
+### 買付が入ったら（買付登録）
+媒介獲得台帳の「客付・案件」の列の「**🤝買付登録**」を押します。編集の画面で現況を「買付有」にして保存したときも、買付登録の画面を開くか聞かれます。
+- **他社客付け**（他社のお客様が買う）：客付け会社名（必須）・担当者・連絡先を入れます。商談案件管理に「**売**」の案件が1件できます（自社は売主側の片手）
+- **自社客付け**（自社の買い反響のお客様が買う）：買い反響から買主を選びます。商談案件管理に「**売**」「**買**」の案件が2件できます（両手）。選んだ買い反響も「購入申込」になり、この物件とつながります
+- どちらも、買付金額（必須）・契約希望日・引渡希望日・買主・物件名（必須）・自社担当を入れます。契約希望日が、商談案件の契約日（月次売上を数える月）になります
+- 登録すると、台帳の現況は「買付有」になり、「客付・案件」の列に「案件No.」が出ます
+- 自社が売主の物件（媒介種別が「買取」、売主が自社名義）は、仲介手数料を計上しない印が最初から付きます
+
+買付が白紙になったときは、「案件No.」を押して「**連携を解除**」します。商談案件そのものは消えません（必要なら商談案件管理で失注にします）。解除すると、もう一度登録できます。
+
+## 売り反響から買取へ（自社買取）
+自社で買い取る売り反響は、売り反響の一覧で「**買取案件へ**」を押します。このボタンは、「媒介受託」で媒介獲得台帳ができた反響にだけ出ます。
+- 押すと、その台帳の媒介種別が「**買取**」になり、「買取再販案件」の画面に案件が1件できます（ステータスは「仕入検討」。売主・所在地・種別・担当・査定価格が入ります）
+- 同じ台帳には、2件目はできません
+- できた案件で、買取価格・建物の価格・費目を入れてください
+
+> 注意：買取再販案件の画面でも、新しく作れません。必ず売り反響から作ります。どの売主から仕入れたかを、あとで辿れるようにするためです。
 - 上の「担当者別サマリー」は、失注を除いた案件の数と契約率、リフォームの受注額・粗利です
 
 ### 失注にする
@@ -40,8 +58,6 @@ summary: 売り反響・買い反響の段階を変えたときに媒介獲得
 
 > 注意：次回アクション（予定日・内容）は、失注・決済完了以外の案件では必須です。
 
-> 注意：媒介獲得台帳で現況を「買付有」にしたときに商談案件を作る「買付登録」は、まだ移していません。次の版で入れる予定です。
-
 ## 関係する記事
 - [[不動産企画係の画面（入口と権限）]]
 - [[月次売上管理（不動産企画係）]]
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index beff1e02c..5b7346d5b 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -1,10 +1,15 @@
-import React, { useState, useMemo, useEffect } from 'react';
+import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import apiClient from '../../utils/apiClient';
 import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus, getContractExpirationDate, getRemainingDays, getContractStatusInfo } from './databaseUtils';
 import PropertyRegister from './PropertyRegister';
 import InformationEditResale from '../information/InformationEditResale';
 import PropertySummary from './PropertySummary';
+import BuyOfferModal from '../realty/common/BuyOfferModal';
+import { OFFER_STATUS } from '../realty/common/leadLinks';
+import { loadRecords } from '../realty/common/realtyState';
+import AuthContext from '../../context/AuthContext';
+import type { Row, StaffSetting } from '../realty/summary/kpi';
 
 export interface BrokerData {
     internal_id: number;
@@ -33,6 +38,10 @@ export interface BrokerData {
     baikaiType?: string | null;
     propStatus?: string | null;
     currentStatus?: string | null;
+    /** つないだ商談案件（売側）の id（v2.2.246 の買付登録。以前のアプリの l.dealId） */
+    dealId?: string | null;
+    /** 他社客付けの内容（JSON） */
+    coBroker?: unknown;
     type?: string | null;
     phase?: string | null;
     priority?: string | null;
@@ -78,6 +87,30 @@ const DatabaseBroker = () => {
 
     const [targetId, setTargetId] = useState('');
 
+    /**
+     * ⚠️ v2.2.246: 買付登録（realty/common/BuyOfferModal.tsx）。
+     *   担当者の設定（略称→氏名）と、つないだ商談案件の No. を出すために商談案件も読む。
+     */
+    const { userName } = useContext(AuthContext);
+    const [offerLedger, setOfferLedger] = useState<BrokerData | null>(null);
+    const [staffSettings, setStaffSettings] = useState<StaffSetting[]>([]);
+    const [dealNoById, setDealNoById] = useState<Record<string, string>>({});
+    const loadDeals = useCallback(() => {
+        loadRecords(['deals'])
+            .then(({ records, settings }) => {
+                setStaffSettings(settings.staff ?? []);
+                setDealNoById(Object.fromEntries(records.deals.map(d => [String(d.id), String(d.no ?? '―')])));
+            })
+            .catch(e => console.error('[DatabaseBroker] 商談案件の読み込みに失敗しました', e));
+    }, []);
+    useEffect(() => { loadDeals(); }, [loadDeals]);
+    const closeOffer = useCallback(() => setOfferLedger(null), []);
+    /** 買付登録・解除のあと、一覧の台帳を直し、案件の No. を読み直す */
+    const onOfferSaved = (ledgerId: string, fields: Row) => {
+        setOriginalData(prev => prev.map(d => (d.id === ledgerId ? { ...d, ...fields } as BrokerData : d)));
+        loadDeals();
+    };
+
 
     // データ取得
     useEffect(() => {
@@ -197,6 +230,9 @@ const DatabaseBroker = () => {
     const handleUpdate = async () => {
         if (!targetPropertyId) return;
         setIsSaving(true);
+        // ⚠️ v2.2.246: 現況を「買付有」にして保存したら買付登録へ案内する（以前のアプリの cbPromptOnStatus）
+        const before = originalData.find(d => d.id === targetPropertyId);
+        const toOffer = editData.currentStatus === OFFER_STATUS && before?.currentStatus !== OFFER_STATUS && !(before?.dealId && dealNoById[before.dealId]);
         try {
             const payload = {
                 request: 'broker',
@@ -208,6 +244,11 @@ const DatabaseBroker = () => {
             if (response.data.status === 'error') alert('更新に失敗しました');
             const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
             setOriginalData(filtered);
+            const saved = filtered.find((b: BrokerData) => b.id === targetPropertyId);
+            if (toOffer && saved && response.data.status !== 'error'
+                && window.confirm('台帳の現況を「買付有」にしました。\n商談案件管理へつなぐには、買付の内容（買主・買付金額・契約希望日）が要ります。\n買付登録の画面を開きますか？')) {
+                setOfferLedger(saved);
+            }
         } catch (e) {
             console.error(e);
             alert('更新に失敗しました。');
@@ -367,6 +408,8 @@ const DatabaseBroker = () => {
                                     <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayAddress')}>物件 / 住所 {getSortIcon('displayAddress')}</th>
                                     <th className="py-2 text-end" style={thStyle} onClick={() => requestSort('displayPrice')}>金額 / 予算 {getSortIcon('displayPrice')}</th>
                                     <th className="py-2" style={thStyle} onClick={() => requestSort('phase')}>フェーズ {getSortIcon('phase')}</th>
+                                    {/* ⚠️ v2.2.246: 買付登録（他社・自社の客付け）→ 商談案件 */}
+                                    <th className="py-2">客付・案件</th>
                                     <th className="py-2">REINZ</th>
                                     <th className="py-2">物件状態</th>
                                     <th className="py-2">MAP</th>
@@ -445,6 +488,21 @@ const DatabaseBroker = () => {
                                                 <td>
                                                     <span className="badge bg-light text-dark border">{item.currentStatus || '-'}</span>
                                                 </td>
+                                                <td>
+                                                    {item.dealId && dealNoById[item.dealId] ? (
+                                                        <button className="btn btn-sm btn-success bg-opacity-75 rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
+                                                            title="商談案件につながっています（押すと解除の画面）" onClick={() => setOfferLedger(item)}>
+                                                            案件No.{dealNoById[item.dealId]}
+                                                        </button>
+                                                    ) : item.propStatus === '媒介終了' ? (
+                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
+                                                    ) : (
+                                                        <button className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
+                                                            title="他社・自社の客付けの買付を登録して、商談案件管理へつなぐ" onClick={() => setOfferLedger(item)}>
+                                                            🤝買付登録{item.dealId ? '（連携切れ）' : ''}
+                                                        </button>
+                                                    )}
+                                                </td>
                                                 <td>
                                                     <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
                                                         {getReinsStatus(item.reinsDate, item.baikaiType).label}
@@ -497,7 +555,7 @@ const DatabaseBroker = () => {
                                     })
                                 ) : (
                                     <tr>
-                                        <td colSpan={19} className="text-center py-4 text-muted">
+                                        <td colSpan={20} className="text-center py-4 text-muted">
                                             該当するデータが見つかりません。
                                         </td>
                                     </tr>
@@ -516,6 +574,13 @@ const DatabaseBroker = () => {
                 staffList={staffList}
                 isSaving={isSaving}
                 handleUpdate={handleUpdate} />
+            <BuyOfferModal
+                ledger={offerLedger as Row | null}
+                staffSettings={staffSettings}
+                userName={userName || ''}
+                onClose={closeOffer}
+                onSaved={onOfferSaved}
+            />
             <PropertySummary
                 targetId={targetId}
                 setTargetId={setTargetId}
diff --git a/frontend/src/components/realty/common/leadLinks.ts b/frontend/src/components/realty/common/leadLinks.ts
index ba5f331bb..9185d90a6 100644
--- a/frontend/src/components/realty/common/leadLinks.ts
+++ b/frontend/src/components/realty/common/leadLinks.ts
@@ -1,5 +1,5 @@
 import { loadRecords } from './realtyState';
-import { newRecordId, saveBrokerageRecord } from './leadUtiles';
+import { logChange, newRecordId, saveBrokerageRecord } from './leadUtiles';
 import type { StaffSetting } from '../summary/kpi';
 
 /**
@@ -8,6 +8,9 @@ import type { StaffSetting } from '../summary/kpi';
  * ─────────────────────────────────────────────
  *   売り反響を「媒介受託」にする → 媒介獲得台帳（kind = ledger）へ1行作り、反響に ledgerNo を持たせる
  *   買い反響を「購入申込」にする → 商談案件（kind = deals）へ「買」案件を1件作り、反響に dealId を持たせる
+ *   ⚠️ v2.2.246:
+ *   媒介台帳の「買付登録」     → 他社客付けは商談案件「売」を1件、自社客付けは「売」「買」の2件（registerBuyOffer）
+ *   売り反響の「買取案件へ」   → 台帳の媒介種別を「買取」にし、買取再販案件（kind = resales）を1件作る（leadToResale）
  *
  * ⚠️ No. は「その種類の最大 + 1」（以前のアプリと同じ）。⚠️ 作る直前に読み直して数える（画面を開いた後に増えた分を拾う）。
  * ⚠️ 二重連携は呼び出し側で防ぐ（ledgerNo / dealId が入っていれば呼ばない）。
@@ -128,3 +131,184 @@ export const buyToDeal = async (lead: Rec): Promise<{ no: number; dealId: string
     await saveBrokerageRecord(str(lead.id), leadFields);
     return { no, dealId, leadFields };
 };
+
+// ---------------------------------------------------------------------------
+// 媒介台帳の買付登録（v2.2.246。以前のアプリ v14.29 の openCoBroker / saveCoBroker / ledgerToDeal / ledgerToDealOwn / cbUnlink）
+// ---------------------------------------------------------------------------
+
+/** 自社の売主名（以前のアプリの RS_OWNER）。買取再販の物件は「(株)国分ハウジング（物件名）」で台帳に入る */
+export const OWN_SELLER = '(株)国分ハウジング';
+/** 台帳の現況。商談中の意味（以前のアプリの CB_LED_STATUS） */
+export const OFFER_STATUS = '買付有';
+/** 買主属性（以前のアプリの CB_ATTRS） */
+export const BUYER_ATTRS = ['個人（実需）', '個人（住み替え）', '個人（投資）', '法人', '買取業者', 'その他'];
+
+/** 他社客付けのときに台帳へ残す客付けの内容（coBroker 列。JSON） */
+export type CoBroker = {
+    company: string; person: string; contact: string; buyerName: string; buyerAttr: string;
+    price: number; contractDate: string; deliveryDate: string; note: string; registeredAt: string; registeredBy: string;
+};
+
+export type BuyOfferInput = {
+    /** out = 他社客付け（片手）／own = 自社客付け（両手。買い反響のお客様） */
+    kind: 'out' | 'own';
+    company: string; person: string; contact: string;
+    price: number; contractDate: string; deliveryDate: string;
+    buyerName: string; buyerAttr: string; property: string;
+    /** 自社担当（氏名） */
+    staff: string;
+    /** 仲介手数料を計上しない（自社売主＝買取再販物件） */
+    noFee: boolean;
+    note: string;
+};
+
+/** 自社が売主（買取再販）の物件か。⚠️ 他社客付けでも自社の仲介手数料は出ない（以前のアプリの cbIsOwnStock） */
+export const isOwnStock = (ledger: Rec): boolean =>
+    str(ledger.baikaiType) === '買取' || str(ledger.seller).startsWith(OWN_SELLER);
+
+/** 商談案件の物件名の候補（以前のアプリの cbGuessProperty）。自社名義なら括弧の中、無ければ所在地、無ければ「売主名邸」 */
+export const guessProperty = (ledger: Rec): string => {
+    const m = str(ledger.seller).match(/^\(株\)国分ハウジング（(.+)）$/);
+    if (m) return m[1];
+    // ⚠️ 売り反響から作った台帳は、所在地1に市、所在地2に住所全体が入る（leadToLedger）。重ねない
+    const a1 = str(ledger.addr1).trim();
+    const a2 = str(ledger.addr2).split('http')[0].trim();
+    const base = (a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`).trim();
+    if (base) return base.slice(0, 32);
+    return ledger.seller ? `${str(ledger.seller)}邸` : '';
+};
+
+const addDays = (ds: string, n: number): string => {
+    const d = new Date(`${ds}T00:00:00`);
+    d.setDate(d.getDate() + n);
+    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
+};
+
+/**
+ * 買付を登録して商談案件を作る。
+ *   他社客付け … 「売」案件を1件。台帳に客付けの内容（coBroker）を残す
+ *   自社客付け … 「売」「買」の2件。買い反響に「買」案件をつなぎ、台帳にも未設定ならつなぐ
+ * 台帳は dealId（売側の案件）を持ち、現況を「買付有」にする（契約済のときは変えない）。
+ * ⚠️ 二重の登録は呼び出し側で防ぐ（台帳の dealId が生きていれば呼ばない）。
+ * @returns 作った売側の案件の No.（自社客付けのときは買側も）
+ */
+export const registerBuyOffer = async (
+    ledger: Rec,
+    inp: BuyOfferInput,
+    buyLead: Rec | null,
+    by: string
+): Promise<{ sellNo: number; buyNo: number | null; ledgerFields: Rec; buyLeadFields: Rec | null }> => {
+    const { records } = await loadRecords(['deals']);
+    let no = nextNo(records.deals) - 1;
+    const today = todayStr();
+    const ledNo = ledger.no == null || ledger.no === '' ? null : Number(ledger.no);
+    const ledLbl = `📝台帳No.${ledNo ?? '―'}`;
+    const base = (): Rec => ({
+        kind: 'deals', createdAt: today, price: inp.price, feeManual: inp.noFee, fee: inp.noFee ? 0 : null,
+        contactDate: today, subStaff: '', subRatio: 0, phase: '購入申込',
+        contractDate: inp.contractDate, settleDate: inp.deliveryDate, priority: '', followDate: '',
+        nextDate: inp.contractDate || addDays(today, 3),
+        reformPrice: 0, reformGp: 0, reformNote: '',
+        ledgerId: str(ledger.id), ledgerNo: ledNo, property: inp.property,
+    });
+    const buyerNote = `${inp.buyerName || '―'}${inp.buyerAttr ? `・${inp.buyerAttr}` : ''}${inp.note ? `／${inp.note}` : ''}`;
+
+    if (inp.kind === 'out') {
+        const cb: CoBroker = {
+            company: inp.company, person: inp.person, contact: inp.contact, buyerName: inp.buyerName, buyerAttr: inp.buyerAttr,
+            price: inp.price, contractDate: inp.contractDate, deliveryDate: inp.deliveryDate, note: inp.note,
+            registeredAt: new Date().toISOString(), registeredBy: by,
+        };
+        const sellNo = ++no;
+        const sellId = newRecordId();
+        await saveBrokerageRecord(sellId, {
+            ...base(), no: sellNo, type: '売', staff: inp.staff, customer: str(ledger.seller),
+            nextNote: `客付け（${inp.company}）と契約日程・必要書類の確定`,
+            note: `${ledLbl}より客付け買付／客付：${inp.company}${inp.person ? `（${inp.person}）` : ''}／買主：${buyerNote}`,
+            coBroker: cb,
+        });
+        const ledgerFields: Rec = { dealId: sellId, coBroker: cb, ...(str(ledger.currentStatus) === '契約済' ? {} : { currentStatus: OFFER_STATUS }) };
+        await saveBrokerageRecord(str(ledger.id), ledgerFields);
+        await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledNo, label: str(ledger.seller), field: '客付け連携', from: '', to: `商談案件 No.${sellNo}`, by, note: `買付金額 ${inp.price.toLocaleString()}円（${inp.company}）` });
+        return { sellNo, buyNo: null, ledgerFields, buyLeadFields: null };
+    }
+
+    // 自社客付け（両手）
+    const sellNo = ++no;
+    const buyNo = ++no;
+    const sellId = newRecordId();
+    const buyId = newRecordId();
+    await saveBrokerageRecord(sellId, {
+        ...base(), no: sellNo, type: '売', staff: inp.staff, customer: str(ledger.seller),
+        nextNote: '売主へ買付内容の報告・契約日程の確定',
+        note: `${ledLbl}より自社客付け（両手）／買主：${buyerNote}`,
+    });
+    await saveBrokerageRecord(buyId, {
+        ...base(), no: buyNo, type: '買', staff: str(buyLead?.staff) || inp.staff, customer: inp.buyerName,
+        nextNote: '買主の住宅ローン事前審査・契約書類の準備',
+        note: `🏠買い反響（${str(buyLead?.portal) || '反響元未設定'}）からの自社客付け／${ledLbl}${inp.note ? `／${inp.note}` : ''}`,
+    });
+    const ledgerFields: Rec = { dealId: sellId, coBroker: null, ...(str(ledger.currentStatus) === '契約済' ? {} : { currentStatus: OFFER_STATUS }) };
+    await saveBrokerageRecord(str(ledger.id), ledgerFields);
+    let buyLeadFields: Rec | null = null;
+    if (buyLead) {
+        buyLeadFields = {
+            dealId: buyId,
+            ...(str(buyLead.ledgerId) === '' ? { ledgerId: str(ledger.id), ledgerNo: ledNo } : {}),
+            ...(str(buyLead.targetProperty) === '' ? { targetProperty: inp.property } : {}),
+            ...(str(buyLead.phase) === '成約' ? {} : { phase: '購入申込' }),
+        };
+        await saveBrokerageRecord(str(buyLead.id), buyLeadFields);
+        await logChange({ entity: 'buy', entityId: str(buyLead.id), label: str(buyLead.name), field: '案件連携', from: '', to: `商談案件 No.${buyNo}`, by, note: `${ledLbl}へ買付（自社客付け）` });
+    }
+    await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledNo, label: str(ledger.seller), field: '客付け連携', from: '', to: `商談案件 No.${sellNo}（売）・No.${buyNo}（買）`, by, note: `買付金額 ${inp.price.toLocaleString()}円（自社客付け）` });
+    return { sellNo, buyNo, ledgerFields, buyLeadFields };
+};
+
+/** 連携を外す（買付が白紙・入力の誤り）。⚠️ 商談案件そのものは消さない（以前のアプリの cbUnlink） */
+export const unlinkBuyOffer = async (ledger: Rec, by: string): Promise<Rec> => {
+    const fields: Rec = { dealId: null };
+    await saveBrokerageRecord(str(ledger.id), fields);
+    await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledger.no == null ? null : Number(ledger.no), label: str(ledger.seller), field: '客付け連携', from: `案件ID ${str(ledger.dealId)}`, to: '解除', by });
+    return fields;
+};
+
+// ---------------------------------------------------------------------------
+// 売り反響 → 買取案件（v2.2.246）
+// ---------------------------------------------------------------------------
+
+/** 売り反響の区分 → 買取再販の種別（土地・戸建・マンション・その他） */
+const resaleCategoryOf = (c: string): string =>
+    c.includes('マンション') ? 'マンション' : c.includes('土地') ? '土地' : c.includes('戸建') || c.includes('一戸建') ? '戸建' : 'その他';
+
+/**
+ * 売り反響を自社買取にする。
+ * 媒介獲得台帳（反響の ledgerNo）の媒介種別を「買取」にし、買取再販案件を1件作って台帳 No. でつなぐ。
+ * ⚠️ 台帳の無い反響は先に「媒介受託」で台帳を作ってから（呼び出し側で止める）。
+ * ⚠️ その台帳につながる買取再販案件が既にあれば作らない（null を返す）。
+ * ⚠️ 費目（costs）は空で作る。買取再販の画面が開いたときに、種別ごとの標準の費目で埋める（normalizeResaleDeal）。
+ */
+export const leadToResale = async (
+    lead: Rec,
+    by: string
+): Promise<{ no: number; ledgerNo: number } | { exists: number } | null> => {
+    const ledgerNo = Number(lead.ledgerNo);
+    if (!Number.isFinite(ledgerNo) || ledgerNo <= 0) return null;
+    const { records } = await loadRecords(['ledger', 'resales']);
+    const ledger = records.ledger.find((l) => Number(l.no) === ledgerNo);
+    if (!ledger) return null;
+    const existing = records.resales.find((r) => Number(r.ledgerNo) === ledgerNo);
+    if (existing) return { exists: Number(existing.no) };
+    const no = nextNo(records.resales);
+    const addr = str(lead.addr);
+    await saveBrokerageRecord(newRecordId(), {
+        kind: 'resales', no, property: guessProperty({ ...ledger, seller: '' }) || addr.slice(0, 32) || `${str(lead.name)}邸`,
+        category: resaleCategoryOf(str(lead.category)), addr, staff: str(lead.staff), sellStaff: '',
+        status: '仕入検討', ledgerNo, seller: str(lead.name || lead.seller), buyer: '',
+        buyPrice: Number(lead.price) || 0, buyBuilding: 0, buySellerReg: '未確認', buyStockAsset: 1,
+        costs: '[]', note: `売り反響より買取（${str(lead.source) || '反響元未設定'}）`, show_dashboard: 1,
+    });
+    if (str(ledger.baikaiType) !== '買取') await saveBrokerageRecord(str(ledger.id), { baikaiType: '買取' });
+    await logChange({ entity: 'lead', entityId: str(lead.id), label: str(lead.name || lead.seller), field: '買取案件', from: '', to: `買取再販案件 No.${no}`, by, note: `台帳No.${ledgerNo} の媒介種別を買取に` });
+    return { no, ledgerNo };
+};
diff --git a/frontend/src/components/realty/resale/LeadResale.tsx b/frontend/src/components/realty/resale/LeadResale.tsx
index e5b12e9dc..3c81faa38 100644
--- a/frontend/src/components/realty/resale/LeadResale.tsx
+++ b/frontend/src/components/realty/resale/LeadResale.tsx
@@ -515,12 +515,11 @@ const LeadResale = () => {
     // ==========================================
     // 💡 案件の登録・編集
     // ==========================================
-    const openNewDeal = () => {
-        const no = Math.max(0, ...deals.map(d => d.no)) + 1;
-        setEditingDeal(newDeal(no));
-        setEditingId(null);
-        setIsEditOpen(true);
-    };
+    /*
+     * ⚠️ v2.2.246: 「＋ 案件を登録」（openNewDeal）を消した。買取再販案件は、売り反響の「買取案件へ」から作る
+     *   （realty/common/leadLinks.ts の leadToResale。台帳の媒介種別を「買取」にして台帳 No. でつなぐ）。
+     *   どの売主から仕入れたかを辿れるようにするため（制作者の要望。媒介台帳・商談案件と同じ）。
+     */
 
     const openEditDeal = (d: ResaleDeal) => {
         setEditingDeal({ ...d, costs: d.costs.map(c => ({ ...c })) });
@@ -712,13 +711,7 @@ const LeadResale = () => {
                         <option value="credit">建物の仕入税額控除を反映</option>
                         <option value="net">ネット（税抜換算）</option>
                     </select>
-                    <button
-                        className="shadow-sm"
-                        style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 16px', fontSize: '11px', fontWeight: 'bold', height: '26px' }}
-                        onClick={openNewDeal}
-                    >
-                        <i className="bi bi-plus-lg"></i> 案件を登録
-                    </button>
+                    <span className="text-muted" style={{ fontSize: '11px' }}>案件は売り反響の「買取案件へ」で作られます</span>
                 </div>
             </div>
 
@@ -889,7 +882,7 @@ const LeadResale = () => {
                                     }) : (
                                         <tr>
                                             <td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
-                                                {isLoading ? '読み込み中...' : '該当する買取再販案件が見つかりません。「＋ 案件を登録」から追加してください。'}
+                                                {isLoading ? '読み込み中...' : '該当する買取再販案件が見つかりません。案件は売り反響の「買取案件へ」で作られます。'}
                                             </td>
                                         </tr>
                                     )}
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 097bf3bb0..16d5e81e9 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -8,7 +8,7 @@ import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
-import { askBaikaiDate, linkLedgerAfterEdit, linkLedgerWithNotice } from '../common/leadLinks';
+import { askBaikaiDate, leadToResale, linkLedgerAfterEdit, linkLedgerWithNotice } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
 import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
 import type { LeadFilter } from '../common/LeadFilterBar';
@@ -353,6 +353,23 @@ const LeadSell = () => {
     if (linked) setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...linked.leadFields } as SellLead : l)));
   };
 
+  /**
+   * ⚠️ v2.2.246: 自社買取 → 買取案件へ（制作者の流れ「①売り反響と物件が紐づく ②自社買取の場合に買取案件へ移行」）。
+   *   台帳（媒介受託で作ったもの）の媒介種別を「買取」にし、買取再販案件を1件作って台帳 No. でつなぐ（common/leadLinks.ts の leadToResale）。
+   */
+  const moveToResale = async (lead: SellLead) => {
+    if (!window.confirm(`「${lead.seller || lead.name || ''}」を自社で買い取る案件として、買取再販案件を作ります。\n台帳 No.${lead.ledgerNo} の媒介種別は「買取」になります。よろしいですか？`)) return;
+    try {
+      const r = await leadToResale(lead as unknown as Record<string, unknown>, userName || '不明');
+      if (r === null) alert(`台帳 No.${lead.ledgerNo} が見つかりません。媒介獲得台帳を確かめてください。`);
+      else if ('exists' in r) alert(`台帳 No.${lead.ledgerNo} には、既に買取再販案件 No.${r.exists} がつながっています。`);
+      else alert(`買取再販案件 No.${r.no} を作りました（台帳 No.${r.ledgerNo}）。\n買取再販案件の画面で、買取価格・建物価格・費目を入れてください。`);
+    } catch (e) {
+      console.error('[LeadSell] 買取案件の作成に失敗しました', lead.id, e);
+      alert('買取案件を作れませんでした。時間をおいて、もう一度お試しください。');
+    }
+  };
+
   const handleApiUpdate = (id: string, field: string, value: string | number) => {
     void handleApiPatch(id, { [field]: value });
   };
@@ -780,6 +797,17 @@ const LeadSell = () => {
                           {/* ⚠️ 選択肢に無い値（以前のアプリで手入力されたもの）も消さずに出す */}
                           {lead.phase && !LEAD_PHASES.includes(lead.phase) && <option value={lead.phase}>{lead.phase}</option>}
                         </select>
+                        {/* ⚠️ v2.2.246: 台帳ができた反響（媒介受託）だけ。自社買取なら買取再販案件へ */}
+                        {lead.ledgerNo && (
+                          <button
+                            type="button"
+                            style={{ fontSize: '9px', padding: '0 6px', height: '18px', marginTop: '2px', backgroundColor: '#fff', border: '1px solid #fd7e14', color: '#fd7e14', borderRadius: '10px', cursor: 'pointer' }}
+                            onClick={() => void moveToResale(lead)}
+                            title="自社で買い取るときに、買取再販案件を作る"
+                          >
+                            買取案件へ
+                          </button>
+                        )}
                       </td>
                       <td style={getTdStyle(isUnassigned)}>
                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 3b9425387..f05ab03b8 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.245';
+export const newVersion = '2.2.246';
````
