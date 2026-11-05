# 作業記録 2026-11-05-03　v2.2.247 不動産企画係：売り反響の媒介紐付・反響の登録をモーダルに

## 依頼
- 売り反響の「媒介紐付」のボタンが動かない。実装する。**媒介の紐づけは売り反響の画面からだけ**行う
- 反響を登録するときはモーダルを出す
- 追加の指示：媒介紐付は「モーダル → 売り反響の値を必要な項目へ反映 → 登録」の流れにする

## 利用者の決定（AskUserQuestion）
| 問い | 答え |
|---|---|
| 版の分け方 | v2.2.247 はこの2件。買取再販の誤りの修正は v2.2.248 へ |
| 「この画面からのみ」の意味 | 台帳を作るのは売り反響の画面だけ。架電キュー・チームサマリーでは作らない |
| 登録をモーダルにする画面 | 売り反響と買い反響の両方 |

## 以前のアプリ（index.html v14.29.1、伏せた写し）の動き
- 一覧の「媒介紐付」の列
  - 台帳あり → 「台帳No.」
  - 媒介受託で台帳なし → 「未転記」（押せない）
  - 追客終了 → 「―」
  - それ以外 → 「受託→台帳へ」
- 「受託→台帳へ」（`leadToLedger`）・一覧で段階を媒介受託にしたとき（`ieGuard`）・編集画面の保存（`saveLead`）のどれも、次の順で動く
  1. 媒介契約日が無ければ、ブラウザの入力欄（prompt）で聞く
  2. **確かめずに台帳を作る**（媒介種別は専任媒介に固定、販売価格は査定額）
  3. そのあと台帳の編集画面を自動で開き、「媒介種別・販売価格を確認してください」と出す
- Dashboard の v2.2.244〜246
  - 2 までは同じで、3 の代わりに「台帳 No.X へ反映しました」の知らせを出していた
  - 「🔗 媒介紐付」ボタンには、押したときの処理が無かった
  - 架電キュー・チームサマリーの編集画面でも、台帳を作っていた

## 変えたこと
### 媒介紐付（売り反響 → 媒介獲得台帳）
- **新規** `frontend/src/components/realty/common/LedgerLinkModal.tsx`：媒介紐付の画面
  - 売り反響の値を、台帳の項目に入れて開く（`ledgerFormOf`）
  - 必須は、媒介契約日・媒介種別・売主（`ledgerFormError`）
  - 「登録」を押すまで何も保存しない
- `frontend/src/components/realty/common/leadLinks.ts`
  - **追加**：`LEDGER_BAIKAI_TYPES`、`LEDGER_CATEGORIES`、`LEDGER_FREQS`、型 `LedgerForm`、`ledgerFormOf`、`ledgerFormError`、`noticeLedgerOnSellScreen`
  - **変更** `leadToLedger(lead, form, staffSettings)`
    - 台帳を、画面で確かめた値で作るようにした
    - 反響に `ledgerId` も保存するようにした
  - **変更** `linkLedgerWithNotice(lead, form, staffSettings)`
  - **削除**：`askBaikaiDate`、`linkLedgerAfterEdit`（使う所が無くなった）
- `frontend/src/components/realty/sell/LeadSell.tsx`
  - 列「媒介紐付」を分けた（書類の列の前）
    - 台帳あり → 台帳No.
    - 追客終了 → ―
    - 媒介受託で台帳なし → 「未転記→台帳へ」
    - それ以外 → 「🔗 媒介紐付」
  - 次の3つから、媒介紐付の画面を開く
    - ボタン
    - 一覧で段階を媒介受託にしたとき（台帳が無いとき。キャンセルすると段階が戻る）
    - 編集画面で媒介受託にして保存したとき
  - **追加** `submitLedger`
    1. 段階・媒介契約日を `handleApiPatch` で保存する（変更履歴に残す）
    2. `linkLedgerWithNotice` で台帳を作る
  - 段階の選択の `key` に段階を入れた。登録で段階が変わったときに、表示を描き直すため
- `frontend/src/components/realty/callq/CallQueue.tsx`、`frontend/src/components/realty/summary/Summary.tsx`
  - 台帳を作らないようにした
  - 媒介受託で保存すると、`noticeLedgerOnSellScreen` が「売り反響の画面の媒介紐付で転記してください」と知らせる

### 反響の登録をモーダルに（売り・買い）
- `frontend/src/components/realty/common/LeadEdit.tsx`：`id` が空なら登録として動く
  - タイトルは「反響を登録」、保存ボタンは「登録する」
  - 契約書・変更内容・変更履歴は出さない
  - 選べない段階（`NOT_ON_CREATE`）：媒介受託・追客終了・購入申込・成約
  - 必須：受信日。売りは売主名か所在地のどちらか、買いは顧客名。次回アクションの必須は、編集のときと同じ
  - **追加** prop `sourceOptions`：反響元・ポータルの選択肢を一覧と同じにする。渡さなければ、以前の固定の選択肢
- `frontend/src/components/realty/common/leadUtiles.ts`：**追加** `findDuplicateLead`
  - 同じ連絡先（電話・メール・連絡先のどれか）か、同名・同日の反響を探す
  - 以前のアプリの `saveLead` と同じ比べ方
- `LeadSell.tsx`、`LeadBuy.tsx`
  - 一覧の中の入力行（`isAdding`、ref 5つ、`handleSaveNewLead`）を消した
  - `handleAddClick` で登録のモーダルを開き、`createLead` で登録する
    - 重複があれば確かめる
    - 保存できてから一覧に足す

### そのほか
- 版：`frontend/src/utils/version.ts` → 2.2.247
- SQL：`backend/scripts/sql/2026-11-05_update_log_2.2.247.sql`（update_log と業務ガイド）。ローカルに流した（update_log no=346）
- 業務ガイド：`common/screen-247.md`「反響から商談案件へのつながり（不動産企画係）」
  - 「反響を登録する」の節を足した
  - 売り反響の節を、媒介紐付の画面の手順に書き換えた
  - 架電キュー・チームサマリーでは台帳を作らない、という注意を足した
- 引き継ぎ書 `docs/realty-handoff.md`（新規。前の依頼で作ったもの）も、この版に入れた

## テスト
- 型チェック（`npx tsc --noEmit -p .`）：エラー 0
- ESLint：警告はもとからある1件（`Summary.tsx` の `formatMan`）だけ
- ① を通した確認：トークン無しの `planner:records` → 401
- Playwright（3100・Master。テスト用の売り反響 A〜E を DB に入れた）
  - 列：A「🔗 媒介紐付」、B（媒介受託・台帳なし）「未転記→台帳へ」、C（追客終了）「―」
  - A
    - 開いた画面に、売り反響の値が入っていた（売主・連絡先・市区町村・所在地・区分・査定額・反響元の備考、媒介契約日は今日）
    - 一般媒介・1,480万円に直して登録 → 台帳 No.218（一般媒介・14,800,000）。反響は媒介受託・ledgerNo=218・ledgerId あり
  - B
    - 画面の媒介契約日は、反響に入っていた日（3日前）
    - キャンセルすると、DB も画面も変わらなかった
    - 売主を空にして登録すると「売主を入力してください。」で止まった
    - 登録 → No.219
  - D
    - 一覧で段階を媒介受託にすると、画面が開いた
    - キャンセルすると、段階は通電済に戻った（DB も通電済）
    - 編集画面で媒介受託・媒介契約日を入れて保存すると、媒介紐付の画面が開いた（媒介契約日は入れた日）
    - キャンセルすると「未転記→台帳へ」になった
  - 売り反響の登録のモーダル
    - 段階の選択肢は、リード受信〜査定書提出だけ
    - 反響元は一覧と同じ5つ
    - 契約書ボタンは出ない
    - 空で登録すると止まる
    - A と同じ電話番号では、重複を確かめる画面が出た → 登録できた
  - 買い反響の登録のモーダル
    - 段階の選択肢は、反響受信〜内見済だけ。ポータルは一覧と同じ
    - 登録すると、`kind=buyLeads`・SUUMO・反響受信。`seller` は入れない
  - 架電キュー・チームサマリーの画面は、エラー無く開いた
    - 編集から媒介受託で保存したときの知らせは、画面では押していない
    - 関数の分岐は、売り反響の未転記の表示で確かめた
  - ページのエラー：0
- 後片付け
  - テストの行・台帳・履歴と、仮スタッフを消した（行数は 2,986、台帳の最大 No. は 217 に戻った）
  - 開発サーバー（3100）を止めた

## 注意
- 売り反響に `ledgerId` も入るようになった（以前は `ledgerNo` だけ）。どちらも、もとからある列
- 媒介紐付の画面の担当の選択肢は、設定の担当者（氏名）。台帳には略称で入る（以前と同じ）

## 新規ファイルの全文
### frontend/src/components/realty/common/LedgerLinkModal.tsx
```tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormError, ledgerFormOf } from './leadLinks';
import type { LedgerForm } from './leadLinks';
import type { Row } from '../summary/kpi';

/**
 * 売り反響の「媒介紐付」（v2.2.247 新規）。売り反響 → 媒介獲得台帳。
 *
 * ─────────────────────────────────────────────
 *   開く   … 売り反響の値を台帳の項目に写して出す（ledgerFormOf。以前のアプリの leadToLedger と同じ写し方）
 *   登録   … 必須（媒介契約日・媒介種別・売主）を確かめ、onSubmit に渡す。台帳を作るのは呼び出し側（LeadSell.tsx）
 *   キャンセル … 何も保存しない（台帳も反響の段階も変わらない）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 利用者の指示（2026-11-05）: 台帳へつなぐのは売り反響の画面だけ。流れは「モーダル → 売り反響の値を必要な項目へ反映 → 登録」。
 *   v2.2.246 までは媒介契約日だけを聞き、すぐに台帳を作っていた（媒介種別は専任媒介のまま、販売価格は査定額のまま）。
 */

type Props = {
    /** 対象の売り反響（null は閉じている） */
    lead: Row | null;
    /** 担当の選択肢（設定の担当者の氏名） */
    staffNames: string[];
    onClose: () => void;
    /** 「登録」。台帳を作れたら true（閉じる）。false なら開いたまま */
    onSubmit: (lead: Row, form: LedgerForm) => Promise<boolean>;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };
const req = <span className="text-danger">*</span>;

/** 選択肢に無い今の値（反響で手入力された区分など）も消さずに出す */
const withCurrent = (options: string[], current: string): string[] =>
    current && !options.includes(current) ? [...options, current] : options;

const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
    const [form, setForm] = useState<LedgerForm | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setForm(lead ? ledgerFormOf(lead) : null);
        setBusy(false);
    }, [lead]);

    if (!lead || !form) return null;

    const set = (patch: Partial<LedgerForm>) => setForm(prev => (prev ? { ...prev, ...patch } : prev));

    const submit = async () => {
        const err = ledgerFormError(form);
        if (err) { alert(err); return; }
        setBusy(true);
        try {
            if (await onSubmit(lead, form)) onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal show onHide={busy ? undefined : onClose} size="lg" centered>
            <Modal.Header closeButton={!busy}>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>🔗 媒介紐付（媒介獲得台帳へ登録）</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ fontSize: '12px' }}>
                <div className="row g-2">
                    <div className="col-12 text-muted">
                        売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
                        <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。
                    </div>
                    <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
                        <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => set({ baikaiDate: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>媒介種別 {req}</div>
                        <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
                            {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-md-4"><div style={label}>担当</div>
                        <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                            <option value="">（未割当）</option>
                            {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                    <div className="col-md-6"><div style={label}>売主 {req}</div>
                        <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
                    <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
                        <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>市区町村</div>
                        <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
                    <div className="col-md-8"><div style={label}>所在地（番地まで）</div>
                        <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>区分</div>
                        <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
                            <option value="">選択してください</option>
                            {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-md-4"><div style={label}>販売価格(円)（初めは査定額）</div>
                        <input type="number" className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: Number(e.target.value) || null })} /></div>
                    <div className="col-md-4"><div style={label}>連絡頻度</div>
                        <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
                            {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-12"><div style={label}>備考</div>
                        <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                    <div className="col-12 text-muted mt-2">
                        📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。キャンセルすると、何も変わりません。
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
                <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
            </Modal.Footer>
        </Modal>
    );
};

export default LedgerLinkModal;
```

## 変更の差分（git diff）
```diff
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index 716a8a703..2f6c75b06 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -2,16 +2,36 @@
 title: 反響から商談案件へのつながり（不動産企画係）
 section: 画面の使い方
 sort: 247
-summary: 売り反響・買い反響から媒介獲得台帳・商談案件・買取再販案件へつなぐ動き（媒介受託・購入申込・買付登録・買取案件へ）と、商談案件管理・媒介獲得台帳の使い方。
+summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談案件・買取再販案件へつなぐ動き（媒介紐付・購入申込・買付登録・買取案件へ）、商談案件管理・媒介獲得台帳の使い方。
 ---
-不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へ自動でつながります。以前のアプリと同じ動きです。
+不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へつながります。以前のアプリと同じ動きです。
+
+## 反響を登録する
+売り反響・買い反響の画面の右上の「**反響を追加**」を押すと、登録の画面が開きます。
+- 受信日は必須です。売り反響は売主名か物件所在地のどちらか、買い反響は顧客名が必須です
+- 次回連絡日と次回アクションも必須です（編集のときと同じ）
+- 同じ連絡先（電話・メール）、または同じ名前で同じ受信日の反響がすでにあると、確かめる画面が出ます。別の人なら「OK」で登録できます
+- 登録のときに選べる段階は、はじめのほうの段階だけです。媒介受託・購入申込・成約・追客終了は、登録したあとに一覧で変えます
 
 ## 売り反響（一括査定）
-- 段階を「**媒介受託**」にすると、媒介契約日を聞かれます。入れると、**媒介獲得台帳に1行が自動で作られます**（台帳の No. は自動）。作られたら、媒介獲得台帳で媒介種別・販売価格を確かめてください
-- 編集画面で「媒介受託」にするときは、媒介契約日が必須です。保存すると同じように台帳に作られます
+媒介獲得台帳へつなぐのは、**売り反響の画面だけ**です。一覧の「**媒介紐付**」の列で、つながりが分かります。
+- 「**台帳No.〇**」：媒介獲得台帳につながっています
+- 「**🔗 媒介紐付**」：押すと、媒介獲得台帳へ登録する画面が開きます
+- 「**未転記→台帳へ**」（だいだい色）：段階は媒介受託なのに、台帳がまだありません。押すと同じ画面が開きます
+- 「―」：追客終了の反響です
+
+### 媒介獲得台帳へ登録する
+1. 「媒介紐付」を押す（一覧で段階を「**媒介受託**」に変えたときと、編集画面で媒介受託にして保存したときも、同じ画面が開きます）
+2. 売り反響の売主・連絡先・所在地・区分・査定額・担当が、台帳の項目に入った状態で開きます
+3. 媒介契約日・媒介種別（専任媒介／一般媒介／買取）・販売価格などを確かめて直す。**媒介契約日・媒介種別・売主は必須**です
+4. 「**登録**」を押すと、媒介獲得台帳に1行が作られ（台帳の No. は自動・現況は「情報整理中」）、売り反響の段階が「媒介受託」になります
+
+- 「キャンセル」を押すと、何も変わりません（一覧で媒介受託を選んだときは、段階も元に戻ります）
 - すでに台帳に作られた反響は、段階を変え直しても、もう1行は作られません
 - 段階を「**追客終了**」にすると、理由を聞かれます（他決／辞退・売却中止／連絡不能／対象外／その他）。理由は「失注・他決の分析」に出ます。追客終了から別の段階に戻すと、理由は消えます
 
+> 注意：今日の架電キュー・チームサマリーの編集画面で媒介受託にして保存しても、台帳は作られません（「未転記」になります）。売り反響の画面の「媒介紐付」の列で転記してください。
+
 ## 買い反響（ポータル）
 - 段階を「**購入申込**」にすると、「商談案件管理へ転記しますか？」と聞かれます。「OK」で、**商談案件管理に「買」の案件が1件作られます**。物件名・価格を確かめてください
 - その場で転記しなかったときは、段階の下の「**案件へ転記**」を押すと作れます。作った反響には「案件に連携済み」と出ます
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index 30f513cbd..7b5c9f173 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
+import React, { useEffect, useState, useMemo, useContext } from 'react';
 import apiClient from '../../../utils/apiClient';
 import { thisYear } from '../../../utils/thisYear';
 import LeadFunnelPanel from '../common/LeadFunnelPanel';
@@ -7,7 +7,7 @@ import type { Period } from '../common/leadFunnel';
 import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
-import { removeSpaces, safeParse, BUY_END_REASONS, BUY_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import { removeSpaces, safeParse, BUY_END_REASONS, BUY_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted, findDuplicateLead } from '../common/leadUtiles';
 import { buyToDeal } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
 import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
@@ -98,6 +98,9 @@ const formatDate = (dateStr: string | null | Date) => {
     return dateStr.replace(/-/g, '/');
 };
 
+/** 今日（'YYYY-MM-DD'）。登録のモーダルの受信日の初期値 */
+const todayIso = () => formatDate(new Date()).replace(/\//g, '-');
+
 const getCurrentDateTime = () => {
     const now = new Date();
     now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
@@ -187,7 +190,6 @@ const LeadBuy = () => {
     const [leads, setLeads] = useState<BuyLead[]>([]);
     const [isLoading, setIsLoading] = useState(false);
     const [staffList, setStaffList] = useState<string[]>([]);
-    const [isAdding, setIsAdding] = useState(false);
 
     const [displayLimit, setDisplayLimit] = useState<number>(15);
     // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
@@ -203,11 +205,6 @@ const LeadBuy = () => {
     const [documentShow, setDocumentShow] = useState(false);
     const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);
 
-    const newReceivedDateRef = useRef<HTMLInputElement>(null);
-    const newPortalRef = useRef<HTMLSelectElement>(null);
-    const newNameRef = useRef<HTMLInputElement>(null);
-    const newStaffRef = useRef<HTMLSelectElement>(null);
-    const newPhaseRef = useRef<HTMLSelectElement>(null);
 
     const now = new Date();
     const year = now.getFullYear();
@@ -349,62 +346,33 @@ const LeadBuy = () => {
         void handleApiPatch(id, { [field]: value });
     };
 
+    /**
+     * ⚠️ v2.2.247: 「反響を追加」は登録のモーダル（LeadEdit。id が空なら登録）で入れる（以前のアプリの買い反響の追加）。
+     *   v2.2.246 までは一覧に入力の行を足し、受信日・ポータル・顧客名・担当・段階だけを入れていた
+     */
     const handleAddClick = () => {
-        setIsAdding(true);
+        setCustomerInfo({ id: '', receivedDate: todayIso(), phase: '反響受信', callDates: '[]' });
+        setIsEditModalOpen(true);
     };
 
-    const handleSaveNewLead = async () => {
-        const name = newNameRef.current?.value;
-        if (!name) {
-            alert('顧客名を入力してください');
-            return;
-        }
-
-        const newRecord: BuyLead = {
-            id: newRecordId(),
-            receivedDate: newReceivedDateRef.current?.value || formatDate(new Date()),
-            portal: newPortalRef.current?.value || '',
-            name: name,
-            staff: newStaffRef.current?.value || '',
-            phase: newPhaseRef.current?.value || '反響受信',
-            callDates: '[]',
-            contactDate: null,
-            phone: '',
-            mail: '',
-            targetProperty: '',
-            budget: 0,
-            viewDate: null,
-            reinsDate: null,
-            priceRevDate: null,
-            lastReportDate: null,
-            followDate: null,
-            connectDate: null,
-            applicationDate: null,
-            contractDate: null,
-            nextDate: null,
-            nextNote: null,
-            addr: null,
-            note: null
+    /** 登録のモーダルの「登録する」。必須は LeadEdit が確かめる。⚠️ 同じ人の反響が既にあれば、確かめてから登録する */
+    const createLead = async (info: Partial<BuyLead>) => {
+        const dup = findDuplicateLead(leads, info);
+        if (dup && !window.confirm(`同じ連絡先、または同名・同日の反響が既に登録されています（${dup.name || '名称なし'}／${formatDate(dup.receivedDate)}）。\nそれでも登録しますか？`)) return;
+        // ⚠️ LeadEdit は名前を seller にも入れる。買い反響は name だけを持つ
+        const { id: _id, seller: _s, ...rest } = info as Partial<BuyLead> & { seller?: string };
+        const id = newRecordId();
+        const fields: Record<string, unknown> = {
+            ...rest, kind: 'buyLeads', name: String(info.name || '').trim(),
+            receivedDate: String(info.receivedDate || '').replace(/\//g, '-'), callDates: info.callDates || '[]', show_dashboard: 1,
         };
-
-        setLeads(prev => [newRecord, ...prev]);
-        setIsAdding(false);
-
+        setIsEditModalOpen(false);
         try {
-            await saveBrokerageRecord(newRecord.id, {
-                kind: 'buyLeads',
-                name: newRecord.name,
-                staff: newRecord.staff,
-                portal: newRecord.portal,
-                phase: newRecord.phase,
-                receivedDate: newRecord.receivedDate,
-                callDates: '[]',
-                show_dashboard: 1,
-            });
+            const row = await saveBrokerageRecord(id, fields);
+            setLeads(prev => [{ ...fields, ...(row ?? {}), id } as BuyLead, ...prev]);
         } catch (e) {
-            console.error('[LeadBuy] 新規リードの登録に失敗しました', newRecord, e);
-            setLeads(prev => prev.filter(l => l.id !== newRecord.id));
-            alert('新規リードの登録に失敗しました。もう一度お試しください。');
+            console.error('[LeadBuy] 反響の登録に失敗しました', id, e);
+            alert('反響を登録できませんでした。通信状況を確認して、もう一度お試しください。');
         }
     };
 
@@ -492,12 +460,12 @@ const LeadBuy = () => {
     };
 
     const handleSaveCustomerInfo = () => {
-        if (customerInfo.id) {
-            // id は DB 側の突合キーなので更新値としては送らない。
-            // 許可カラムに無いキーは broker_update.php 側で捨てられる。
-            const { id, ...fields } = customerInfo as BuyLead;
-            void handleApiPatch(id, fields);
-        }
+        // ⚠️ v2.2.247: id が無ければ登録（「反響を追加」）
+        if (!customerInfo.id) { void createLead(customerInfo); return; }
+        // id は DB 側の突合キーなので更新値としては送らない。
+        // 許可カラムに無いキーは broker_update.php 側で捨てられる。
+        const { id, ...fields } = customerInfo as BuyLead;
+        void handleApiPatch(id, fields);
         setIsEditModalOpen(false);
     };
 
@@ -538,7 +506,7 @@ const LeadBuy = () => {
                 availableMonths={[]}
                 periodGroups={periodOptions}
                 handleAddClick={handleAddClick}
-                isAdding={isAdding}
+                isAdding={isEditModalOpen && !customerInfo.id}
                 headerLabel={headerLabel}
                 nextActionAlert={nextActionAlert}
             />
@@ -593,45 +561,6 @@ const LeadBuy = () => {
                             </tr>
                         </thead>
                         <tbody>
-                            {/* 新規追加用インプット行 */}
-                            {isAdding && (
-                                <tr>
-                                    <td style={getTdStyle(false, { borderLeft: '4px solid #3182ce' })}>
-                                        <input type="date" style={compactInputStyle} defaultValue={formatDate(new Date()).replace(/\//g, '-')} ref={newReceivedDateRef} />
-                                    </td>
-                                    <td style={getTdStyle(false)}>
-                                        <select style={compactInputStyle} defaultValue="" ref={newPortalRef}>
-                                            <option value="">ポータル</option>
-                                            {BUY_PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
-                                        </select>
-                                    </td>
-                                    <td style={getTdStyle(false)}>
-                                        <input type="text" style={{ ...compactInputStyle, border: '1px solid #dee2e6' }} placeholder="顧客名" defaultValue="" ref={newNameRef} />
-                                    </td>
-                                    <td style={getTdStyle(false)}>
-                                        <select style={compactInputStyle} defaultValue="" ref={newStaffRef}>
-                                            <option value="">担当を選択</option>
-                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
-                                        </select>
-                                    </td>
-                                    <td style={getTdStyle(false)}>
-                                        {/* ⚠️ v2.2.244: 以前のアプリの値。購入申込・追客終了は転記・理由が要るので、追加した後に一覧で変える */}
-                                        <select style={compactInputStyle} defaultValue="反響受信" ref={newPhaseRef}>
-                                            {BUY_PHASES.filter(p => p !== '購入申込' && p !== '追客終了').map(p => <option key={p} value={p}>{p}</option>)}
-                                        </select>
-                                    </td>
-                                    <td colSpan={9} style={{ ...getTdStyle(false), color: '#6c757d', textAlign: 'left', fontSize: '10px' }}>
-                                        ※その他の詳細は追加後に設定できます。
-                                    </td>
-                                    <td style={getTdStyle(false)}>
-                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
-                                            <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }} onClick={handleSaveNewLead}>追加</button>
-                                            <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', color: '#6c757d', border: '1px solid #ced4da', borderRadius: '4px' }} onClick={() => setIsAdding(false)}>取消</button>
-                                        </div>
-                                    </td>
-                                </tr>
-                            )}
-
                             {isLoading ? (
                                 <tr>
                                     <td colSpan={15} style={{ padding: '40px', textAlign: 'center' }}>
@@ -783,6 +712,7 @@ const LeadBuy = () => {
                 customerInfo={customerInfo}
                 setCustomerInfo={setCustomerInfo}
                 leadCategory="buy"
+                sourceOptions={BUY_PORTALS}
                 staffList={staffList}
             />
 
diff --git a/frontend/src/components/realty/callq/CallQueue.tsx b/frontend/src/components/realty/callq/CallQueue.tsx
index 3877a9783..fda39de4e 100644
--- a/frontend/src/components/realty/callq/CallQueue.tsx
+++ b/frontend/src/components/realty/callq/CallQueue.tsx
@@ -5,8 +5,8 @@ import type { WeeklyRow } from '../common/realtyState';
 import { recordFieldChanges, saveBrokerageRecord } from '../common/leadUtiles';
 import LeadEdit from '../common/LeadEdit';
 import { todayStr } from '../summary/kpi';
-import type { Row, StaffSetting } from '../summary/kpi';
-import { linkLedgerAfterEdit } from '../common/leadLinks';
+import type { Row } from '../summary/kpi';
+import { noticeLedgerOnSellScreen } from '../common/leadLinks';
 import { openNavi } from '../navi/naviHost';
 import {
     CQ_OUT, ST, TAGL, build, callOutcome, callqConf, callqScripts, callsOnly, contactKpi, diffDays, keyOf, newListings,
@@ -240,11 +240,8 @@ const CallQueue: React.FC = () => {
         try {
             const row = await saveBrokerageRecord(str(cur.id), fields);
             replaceRow(kind, (row as Row | null) ?? { ...before, ...fields });
-            // ⚠️ v2.2.244: 売り反響を媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead）
-            if (kind === 'leads') {
-                const linked = await linkLedgerAfterEdit({ ...before, ...fields, id: cur.id }, settings.staff as StaffSetting[] | undefined);
-                if (linked) replaceRow(kind, { ...before, ...fields, ...((row as Row | null) ?? {}), ...linked.leadFields });
-            }
+            // ⚠️ v2.2.247: 媒介獲得台帳は売り反響の画面でだけ作る（v2.2.244〜246 はここでも作っていた）
+            if (kind === 'leads') noticeLedgerOnSellScreen({ ...before, ...fields });
             if (before) {
                 await recordFieldChanges({
                     entity: kind === 'buyLeads' ? 'buy' : 'lead', entityId: str(cur.id),
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index 1ff8e391e..7e2bed143 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -40,8 +40,19 @@ export type LeadEditProps = {
     staffList: string[];
     /** 架電ナビで架電する（v2.2.226。売り反響の画面だけが渡す） */
     onNavi?: () => void;
+    /** 反響元・ポータルの選択肢（v2.2.247。一覧と同じ値。渡さなければ以前からの固定の選択肢） */
+    sourceOptions?: string[];
 };
 
+/** 渡されないときの反響元・ポータルの選択肢（v2.2.246 まで全画面で使っていたもの） */
+const DEFAULT_SOURCES = ['SUUMO', 'アットホーム', "HOME'S", '一括査定サイト', '自社HP', '紹介', 'チラシ', 'その他'];
+
+/**
+ * ⚠️ v2.2.247: 登録（id が無い）のときに選べない段階。
+ *   媒介受託は台帳、購入申込・成約は商談案件、追客終了は理由が要るので、登録した後に一覧で変える（v2.2.244 の一覧の追加行と同じ）
+ */
+const NOT_ON_CREATE = ['媒介受託', '追客終了', '購入申込', '成約'];
+
 // 💡 追加: DocumentViewerへ渡すデータの型定義
 export type initialData = {
     name: string | null;
@@ -129,7 +140,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     setCustomerInfo,
     leadCategory,
     staffList,
-    onNavi
+    onNavi,
+    sourceOptions
 }) => {
     const { userName } = useContext(AuthContext);
 
@@ -165,8 +177,13 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     const sourceLabel = isSellType ? '反響元' : 'ポータル';
 
     // ⚠️ v2.2.244: 以前のアプリの値（leadUtiles.ts）。⚠️ 選択肢に無い今の値（手入力されたもの）は消さずに足す
-    const basePhases = isSellType ? LEAD_PHASES : BUY_PHASES;
+    // ⚠️ v2.2.247: id が無ければ反響の登録（売り・買い反響の「反響を追加」）
+    const isNew = !customerInfo?.id;
+    const basePhases = (isSellType ? LEAD_PHASES : BUY_PHASES).filter(p => !isNew || !NOT_ON_CREATE.includes(p));
     const phaseList = customerInfo.phase && !basePhases.includes(customerInfo.phase) ? [...basePhases, customerInfo.phase] : basePhases;
+    const currentSource = customerInfo.source || customerInfo.portal || '';
+    const sourceList = sourceOptions ?? DEFAULT_SOURCES;
+    const sources = currentSource && !sourceList.includes(currentSource) ? [...sourceList, currentSource] : sourceList;
 
     let titleLabel = '';
     switch (leadCategory) {
@@ -288,6 +305,20 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     // 💡 次回アクション必須化・追客終了理由の必須化（source.html の V12.requireNext() 相当）
     // ==========================================
     const handleSaveClick = () => {
+        // ⚠️ v2.2.247: 登録のときの必須（以前のアプリの saveLead。受信日と、氏名か所在地のどちらか）
+        if (isNew) {
+            const received = String(customerInfo.receivedDate || '').replace(/\//g, '-');
+            if (!/^\d{4}-\d{2}-\d{2}$/.test(received)) {
+                alert('受信日を入力してください。');
+                return;
+            }
+            const name = String(customerInfo.seller || customerInfo.name || '').trim();
+            const addr = String(customerInfo.addr1 || customerInfo.addr || '').trim();
+            if (!name && !(isSellType && addr)) {
+                alert(isSellType ? '売主名または物件所在地を入力してください。' : '顧客名を入力してください。');
+                return;
+            }
+        }
         if (customerInfo.phase === '追客終了') {
             if (!customerInfo.endReason) {
                 alert('追客終了の理由を選択してください。');
@@ -328,7 +359,7 @@ const LeadEdit: React.FC<LeadEditProps> = ({
             <Modal show={isOpen} onHide={onClose} centered size="lg">
                 <Modal.Header closeButton className="border-bottom-0 pb-0 bg-light pt-2 px-3">
                     <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '15px' }}>
-                        <i className="bi bi-person-lines-fill me-2 text-primary"></i>顧客情報編集 ({titleLabel})
+                        <i className="bi bi-person-lines-fill me-2 text-primary"></i>{isNew ? '反響を登録' : '顧客情報編集'} ({titleLabel})
                     </Modal.Title>
                 </Modal.Header>
                 
@@ -350,9 +381,9 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                             </div>
                             <div className="col-md-4">
                                 <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>{sourceLabel}</label>
-                                <select style={compactInputStyle} value={customerInfo.source || customerInfo.portal || ''} onChange={e => setCustomerInfo({ ...customerInfo, source: e.target.value, portal: e.target.value })}>
+                                <select style={compactInputStyle} value={currentSource} onChange={e => setCustomerInfo({ ...customerInfo, source: e.target.value, portal: e.target.value })}>
                                     <option value="">選択してください</option>
-                                    {['SUUMO', 'アットホーム', "HOME'S", '一括査定サイト', '自社HP', '紹介', 'チラシ', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
+                                    {sources.map(p => <option key={p} value={p}>{p}</option>)}
                                 </select>
                             </div>
                             <div className="col-md-4">
@@ -626,7 +657,7 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                         )}
 
                         {/* 💡 追加: 変更内容プレビュー（保存前の今回セッションの差分。サーバー側の永続履歴ではない） */}
-                        {changedFields.length > 0 && (
+                        {!isNew && changedFields.length > 0 && (
                             <div className="mt-3 border-top pt-3">
                                 <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>
                                     <i className="bi bi-clock-history me-1"></i>変更内容
@@ -656,20 +687,23 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                         )}
 
                         {/* 💡 追加: サーバーに保存済みの変更履歴（上の「変更内容」は保存前のプレビュー） */}
-                        <LeadHistory entityId={customerInfo?.id} enabled={isOpen} />
+                        {!isNew && <LeadHistory entityId={customerInfo?.id} enabled={isOpen} />}
                     </div>
                 </Modal.Body>
 
                 {/* 💡 修正: justify-content-between に変更し、左側に契約書ボタンを配置 */}
                 <Modal.Footer className="bg-light border-top-0 pt-0 pb-3 d-flex justify-content-between align-items-center">
                     <div>
-                        <button
-                            className="btn btn-outline-primary btn-sm px-3 fw-bold"
-                            style={{ fontSize: '11px' }}
-                            onClick={() => setDocumentShow(true)}
-                        >
-                            <i className="fa-solid fa-file-contract me-1 text-secondary"></i> 契約書
-                        </button>
+                        {/* ⚠️ v2.2.247: 登録のときは出さない（下書きの保存先の反響がまだ無い） */}
+                        {!isNew && (
+                            <button
+                                className="btn btn-outline-primary btn-sm px-3 fw-bold"
+                                style={{ fontSize: '11px' }}
+                                onClick={() => setDocumentShow(true)}
+                            >
+                                <i className="fa-solid fa-file-contract me-1 text-secondary"></i> 契約書
+                            </button>
+                        )}
                     </div>
                     <div className="d-flex gap-2">
                         {/* ⚠️ v2.2.226: 売り反響の画面から開いたときだけ（以前のアプリの編集画面の「🧭 ナビで架電」）。⚠️ 入力中の内容は保存せずに閉じる */}
@@ -677,7 +711,7 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                             <button className="btn btn-outline-primary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onNavi}>🧭 ナビで架電</button>
                         )}
                         <button className="btn btn-outline-secondary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onClose}>キャンセル</button>
-                        <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={handleSaveClick}>保存する</button>
+                        <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={handleSaveClick}>{isNew ? '登録する' : '保存する'}</button>
                     </div>
                 </Modal.Footer>
             </Modal>
diff --git a/frontend/src/components/realty/common/leadLinks.ts b/frontend/src/components/realty/common/leadLinks.ts
index 9185d90a6..725ac6eb5 100644
--- a/frontend/src/components/realty/common/leadLinks.ts
+++ b/frontend/src/components/realty/common/leadLinks.ts
@@ -7,6 +7,7 @@ import type { StaffSetting } from '../summary/kpi';
  *
  * ─────────────────────────────────────────────
  *   売り反響を「媒介受託」にする → 媒介獲得台帳（kind = ledger）へ1行作り、反響に ledgerNo を持たせる
+ *     ⚠️ v2.2.247: 売り反響の画面の「媒介紐付」の画面（LedgerLinkModal）で台帳の値を確かめてから作る。売り反響の画面だけで作る
  *   買い反響を「購入申込」にする → 商談案件（kind = deals）へ「買」案件を1件作り、反響に dealId を持たせる
  *   ⚠️ v2.2.246:
  *   媒介台帳の「買付登録」     → 他社客付けは商談案件「売」を1件、自社客付けは「売」「買」の2件（registerBuyOffer）
@@ -36,75 +37,93 @@ const guessCity = (addr: string): string => addr.match(/^(.+?[市郡町村])/)?.
 /** 'YYYY-MM-DD' か。⚠️ 以前のアプリと同じ形だけを受け付ける */
 export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);
 
+/** 媒介獲得台帳の選択肢（database/PropertyRegister.tsx の台帳の編集画面と同じ） */
+export const LEDGER_BAIKAI_TYPES = ['専任媒介', '一般媒介', '買取'];
+export const LEDGER_CATEGORIES = ['戸建', 'マンション', '住宅用地', '賃収マンション', '賃収・事業用', 'その他'];
+export const LEDGER_FREQS = ['1週間', '2週間', '1か月'];
+
 /**
- * 媒介契約日を聞く（以前のアプリの ieGuard と同じ）。
- * @returns null は取り消し・形の誤り
+ * ⚠️ v2.2.247: 売り反響 → 媒介獲得台帳の「媒介紐付」の画面（common/LedgerLinkModal.tsx）で確かめる値。
+ *   staff は氏名（台帳には略称で入れる）
  */
-export const askBaikaiDate = (current: string | null | undefined): string | null => {
-    if (current && isIsoDate(current)) return current;
-    const v = window.prompt(`媒介受託にします。媒介契約日を入力してください（例：${todayStr()}）`, todayStr());
-    if (v == null) return null;
-    const d = v.trim();
-    if (!isIsoDate(d)) {
-        alert('日付の形式が正しくありません（例：2026-08-10）');
-        return null;
-    }
-    return d;
+export type LedgerForm = {
+    baikaiDate: string; baikaiType: string; seller: string; contact: string; category: string;
+    addr1: string; addr2: string; price: number | null; staff: string; freq: string; note: string;
+};
+
+/** 売り反響の値を台帳の項目に写す（以前のアプリの leadToLedger と同じ写し方。媒介契約日が無ければ今日） */
+export const ledgerFormOf = (lead: Rec): LedgerForm => {
+    const addr = str(lead.addr || lead.addr1);
+    const baikaiDate = str(lead.baikaiDate).replace(/\//g, '-');
+    return {
+        baikaiDate: isIsoDate(baikaiDate) ? baikaiDate : todayStr(),
+        baikaiType: '専任媒介',
+        seller: str(lead.seller || lead.name),
+        contact: str(lead.contact) || [lead.phone, lead.mail].map(str).filter(Boolean).join(' / '),
+        category: str(lead.category),
+        addr1: guessCity(addr), addr2: addr,
+        price: Number(lead.price) || null,
+        staff: str(lead.staff),
+        freq: '1か月',
+        note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
+    };
+};
+
+/** 登録の前に確かめる（必須：媒介契約日・媒介種別・売主）。問題が無ければ null */
+export const ledgerFormError = (f: LedgerForm): string | null => {
+    if (!isIsoDate(f.baikaiDate)) return '媒介契約日を入力してください。';
+    if (!f.baikaiType) return '媒介種別を選んでください。';
+    if (!f.seller.trim()) return '売主を入力してください。';
+    return null;
 };
 
 /**
- * 売り反響 → 媒介獲得台帳。
+ * 売り反響 → 媒介獲得台帳。⚠️ v2.2.247: 台帳の値は「媒介紐付」の画面で確かめたもの（form）
  * @returns 作った台帳の No. と、反響に保存した値
  */
 export const leadToLedger = async (
     lead: Rec,
-    baikaiDate: string,
+    form: LedgerForm,
     staffSettings: StaffSetting[] = []
 ): Promise<{ no: number; leadFields: Rec }> => {
     const { records } = await loadRecords(['ledger']);
     const no = nextNo(records.ledger);
-    const abbr = staffSettings.find((s) => s.name === str(lead.staff))?.abbr ?? '';
-    const addr = str(lead.addr);
-    await saveBrokerageRecord(newRecordId(), {
+    const abbr = staffSettings.find((s) => s.name === form.staff)?.abbr ?? '';
+    const ledgerId = newRecordId();
+    await saveBrokerageRecord(ledgerId, {
         kind: 'ledger', no, staff: abbr, portal: abbr, source: str(lead.source),
-        contractDate: baikaiDate, baikaiType: '専任媒介', seller: str(lead.name || lead.seller), contact: str(lead.contact),
-        category: str(lead.category), currentStatus: '情報整理中', addr1: guessCity(addr), addr2: addr,
-        price: lead.price || null, freq: '1か月', lastReportDate: '', reinsDate: '', priceRevDate: '',
-        propStatus: 'アクティブ', keyStatus: '', keyInfo: '',
-        note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
+        contractDate: form.baikaiDate, baikaiType: form.baikaiType, seller: form.seller.trim(), contact: form.contact.trim(),
+        category: form.category, currentStatus: '情報整理中', addr1: form.addr1.trim(), addr2: form.addr2.trim(),
+        price: form.price || null, freq: form.freq, lastReportDate: '', reinsDate: '', priceRevDate: '',
+        propStatus: 'アクティブ', keyStatus: '', keyInfo: '', note: form.note,
     });
-    const leadFields = { ledgerNo: no, phase: '媒介受託', baikaiDate };
+    const leadFields = { ledgerNo: no, ledgerId, phase: '媒介受託', baikaiDate: form.baikaiDate };
     await saveBrokerageRecord(str(lead.id), leadFields);
     return { no, leadFields };
 };
 
 /**
- * 編集画面（LeadEdit）で売り反響を保存したあと、媒介獲得台帳へ反映する（以前のアプリの saveLead の最後）。
- * ⚠️ 媒介受託・媒介契約日あり・まだ台帳に紐づいていないときだけ作る。作らなければ null。
- * ⚠️ 失敗は知らせて null を返す（反響の保存は済んでいるので、選び直せば作り直せる）。
+ * ⚠️ v2.2.247: 媒介獲得台帳へつなぐのは売り反響の画面だけ（利用者の指示）。
+ *   架電キュー・チームサマリーの編集画面で媒介受託にして保存したときは、台帳を作らずに、売り反響の画面で転記するよう知らせる
  */
-export const linkLedgerAfterEdit = async (
-    saved: Rec,
-    staffSettings: StaffSetting[] = []
-): Promise<{ no: number; leadFields: Rec } | null> => {
-    const baikaiDate = str(saved.baikaiDate).replace(/\//g, '-');
-    if (str(saved.phase) !== '媒介受託' || str(saved.ledgerNo) !== '' || !isIsoDate(baikaiDate)) return null;
-    return linkLedgerWithNotice(saved, baikaiDate, staffSettings);
+export const noticeLedgerOnSellScreen = (saved: Rec): void => {
+    if (str(saved.phase) !== '媒介受託' || str(saved.ledgerNo) !== '') return;
+    alert('媒介受託で保存しました。\n媒介獲得台帳への転記は、売り反響の画面の「媒介紐付」の列で行ってください。');
 };
 
-/** leadToLedger を呼び、結果を知らせる。⚠️ 失敗は知らせて null（反響の保存は済んでいるので、選び直せば作り直せる） */
+/** leadToLedger を呼び、結果を知らせる。⚠️ 失敗は知らせて null */
 export const linkLedgerWithNotice = async (
     lead: Rec,
-    baikaiDate: string,
+    form: LedgerForm,
     staffSettings: StaffSetting[] = []
 ): Promise<{ no: number; leadFields: Rec } | null> => {
     try {
-        const result = await leadToLedger(lead, baikaiDate, staffSettings);
-        alert(`媒介獲得台帳 No.${result.no} へ反映しました（媒介契約日 ${baikaiDate}）。\n媒介獲得台帳で媒介種別・販売価格を確認してください。`);
+        const result = await leadToLedger(lead, form, staffSettings);
+        alert(`媒介獲得台帳 No.${result.no} を作りました（媒介契約日 ${form.baikaiDate}）。`);
         return result;
     } catch (e) {
         console.error('[leadLinks] 媒介獲得台帳への反映に失敗しました', lead.id, e);
-        alert('媒介獲得台帳への反映に失敗しました。時間をおいて、もう一度「媒介受託」を選び直すか、保存し直してください。');
+        alert('媒介獲得台帳を作れませんでした。時間をおいて、もう一度「媒介紐付」から登録してください。');
         return null;
     }
 };
diff --git a/frontend/src/components/realty/common/leadUtiles.ts b/frontend/src/components/realty/common/leadUtiles.ts
index 723758c67..7aa183b60 100644
--- a/frontend/src/components/realty/common/leadUtiles.ts
+++ b/frontend/src/components/realty/common/leadUtiles.ts
@@ -389,4 +389,27 @@ export const askEndReason = (ends: string[], current: string | null | undefined)
     const v = window.prompt(`追客終了の理由を入力してください（${ends.join('／')}）`, current || ends[0]);
     if (v == null) return null;
     return v.trim() || ends[0];
+};
+
+type LeadLike = { name?: unknown; seller?: unknown; receivedDate?: unknown; phone?: unknown; mail?: unknown; contact?: unknown };
+
+/** 連絡先の比べ方（以前のアプリの saveLead の norm）。数字・英字・@・. だけを残す */
+const normContact = (v: unknown): string => String(v ?? '').replace(/[^0-9A-Za-z@.]/g, '');
+
+const contactsOf = (l: LeadLike): string[] =>
+    [l.phone, l.mail, l.contact].map(normContact).filter(s => s !== '');
+
+/**
+ * ⚠️ v2.2.247: 反響の登録のときの重複（以前のアプリの saveLead）。
+ * 同じ連絡先（電話・メール・連絡先のどれか）、または同じ名前で同じ受信日の反響を返す。無ければ undefined
+ */
+export const findDuplicateLead = <T extends LeadLike>(rows: T[], rec: LeadLike): T | undefined => {
+    const keys = contactsOf(rec);
+    const name = String(rec.seller || rec.name || '').trim();
+    const day = String(rec.receivedDate ?? '').replace(/\//g, '-').slice(0, 10);
+    return rows.find(x =>
+        (keys.length > 0 && contactsOf(x).some(k => keys.includes(k)))
+        || (name !== '' && String(x.seller || x.name || '').trim() === name
+            && String(x.receivedDate ?? '').replace(/\//g, '-').slice(0, 10) === day)
+    );
 };
\ No newline at end of file
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 16d5e81e9..3e4f125ca 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
+import React, { useCallback, useEffect, useState, useMemo, useContext } from 'react';
 import apiClient from '../../../utils/apiClient';
 import { thisYear } from '../../../utils/thisYear';
 import LeadFunnelPanel from '../common/LeadFunnelPanel';
@@ -7,8 +7,10 @@ import type { Period } from '../common/leadFunnel';
 import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
-import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
-import { askBaikaiDate, leadToResale, linkLedgerAfterEdit, linkLedgerWithNotice } from '../common/leadLinks';
+import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted, findDuplicateLead } from '../common/leadUtiles';
+import { leadToResale, linkLedgerWithNotice } from '../common/leadLinks';
+import type { LedgerForm } from '../common/leadLinks';
+import LedgerLinkModal from '../common/LedgerLinkModal';
 import LeadEdit from '../common/LeadEdit';
 import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
 import type { LeadFilter } from '../common/LeadFilterBar';
@@ -120,6 +122,9 @@ const formatDate = (dateStr: string | null | Date) => {
   return dateStr.replace(/-/g, '/');
 };
 
+/** 今日（'YYYY-MM-DD'）。登録のモーダルの受信日の初期値 */
+const todayIso = () => formatDate(new Date()).replace(/\//g, '-');
+
 const getLastAction = (callDatesJson: string | null) => {
   if (!callDatesJson) return '―';
   try {
@@ -195,7 +200,6 @@ const LeadSell = () => {
   const [leads, setLeads] = useState<SellLead[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [staffList, setStaffList] = useState<string[]>([]);
-  const [isAdding, setIsAdding] = useState(false);
 
   const [displayLimit, setDisplayLimit] = useState<number>(15);
   // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
@@ -207,15 +211,14 @@ const LeadSell = () => {
 
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [customerInfo, setCustomerInfo] = useState<Partial<SellLead>>({});
+  /** ⚠️ v2.2.247: 媒介紐付の画面で開いている売り反響（null は閉じている） */
+  const [ledgerTarget, setLedgerTarget] = useState<SellLead | null>(null);
+  const ledgerStaffNames = useMemo(() => (settings.staff ?? []).map(s => s.name ?? '').filter(Boolean), [settings.staff]);
+  const closeLedgerModal = useCallback(() => setLedgerTarget(null), []);
 
   const [documentShow, setDocumentShow] = useState(false);
   const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);
 
-  const newReceivedDateRef = useRef<HTMLInputElement>(null);
-  const newSourceRef = useRef<HTMLSelectElement>(null);
-  const newSellerRef = useRef<HTMLInputElement>(null);
-  const newStaffRef = useRef<HTMLSelectElement>(null);
-  const newPhaseRef = useRef<HTMLSelectElement>(null);
 
   const dateFormate = (date: string | null) => {
     return (date === '0000-00-00' || !date) ? '' : date;
@@ -344,13 +347,23 @@ const LeadSell = () => {
   };
 
   /**
-   * 媒介受託 → 媒介獲得台帳へ1行作る（以前のアプリの leadToLedger。common/leadLinks.ts）。
+   * ⚠️ v2.2.247: 媒介紐付の画面（common/LedgerLinkModal.tsx）の「登録」。売り反響 → 媒介獲得台帳。
+   *   1. 段階を媒介受託・媒介契約日を保存（handleApiPatch。一覧で段階を変えたときと同じく、変更履歴に残す）
+   *   2. 画面で確かめた値で台帳へ1行作り、反響に台帳 No. を持たせる（common/leadLinks.ts の leadToLedger）
    * ⚠️ 台帳に紐づいている（ledgerNo がある）反響では作らない（二重に作らない）。
+   * @returns 作れたら true（画面を閉じる）
    */
-  const linkToLedger = async (lead: SellLead, baikaiDate: string) => {
-    if (lead.ledgerNo) return;
-    const linked = await linkLedgerWithNotice(lead as unknown as Record<string, unknown>, baikaiDate, settings.staff);
-    if (linked) setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...linked.leadFields } as SellLead : l)));
+  const submitLedger = async (row: Row, form: LedgerForm): Promise<boolean> => {
+    const lead = leads.find(l => l.id === String(row.id));
+    if (!lead || lead.ledgerNo) return true;
+    if (lead.phase !== '媒介受託' || lead.baikaiDate !== form.baikaiDate || lead.endReason) {
+      const ok = await handleApiPatch(lead.id, { phase: '媒介受託', baikaiDate: form.baikaiDate, ...(lead.endReason ? { endReason: '' } : {}) });
+      if (!ok) return false;
+    }
+    const linked = await linkLedgerWithNotice(lead as unknown as Record<string, unknown>, form, settings.staff);
+    if (!linked) return false;
+    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...linked.leadFields } as SellLead : l)));
+    return true;
   };
 
   /**
@@ -374,102 +387,34 @@ const LeadSell = () => {
     void handleApiPatch(id, { [field]: value });
   };
 
+  /**
+   * ⚠️ v2.2.247: 「反響を追加」は登録のモーダル（LeadEdit。id が空なら登録）で入れる（以前のアプリの editLead()）。
+   *   v2.2.246 までは一覧に入力の行を足し、受信日・反響元・売主名・担当・段階だけを入れていた
+   */
   const handleAddClick = () => {
-    setIsAdding(true);
+    setCustomerInfo({ kind: 'leads', id: '', receivedDate: todayIso(), phase: 'リード受信', callDates: '[]' });
+    setIsEditModalOpen(true);
   };
 
-  const handleSaveNewLead = async () => {
-    const seller = newSellerRef.current?.value;
-    if (!seller) {
-      alert('売主名を入力してください');
-      return;
-    }
-
-    const newRecord: SellLead = {
-      internal_id: '',
-      // 'sellLeads' ではなく 'leads'。brokerage_listings.kind および
-      // 一覧の絞り込み条件（kind === 'leads'）と一致させる必要がある。
-      kind: 'leads',
-      id: newRecordId(),
-      no: '',
-      freq: '',
-      note: null,
-      addr1: null,
-      addr2: null,
-      addr: null,
-      price: null,
-      budget: null,
-      fee: null,
-      feeManual: '',
-      staff: newStaffRef.current?.value || '',
-      portal: null,
-      seller: seller,
-      customer: seller,
-      name: seller,
-      source: newSourceRef.current?.value || '',
-      contact: null,
-      keyInfo: null,
-      category: null,
-      keyStatus: null,
-      baikaiType: null,
-      propStatus: null,
-      currentStatus: null,
-      type: null,
-      phase: newPhaseRef.current?.value || 'リード受信',
-      priority: null,
-      property: null,
-      targetProperty: null,
-      endReason: null,
-      ledgerNo: null,
-      extId: null,
-      dealId: null,
-      reinsDate: null,
-      contractDate: null,
-      priceRevDate: null,
-      lastReportDate: null,
-      followDate: null,
-      settleDate: null,
-      contactDate: null,
-      visitDate: null,
-      connectDate: null,
-      receivedDate: newReceivedDateRef.current?.value || formatDate(new Date()),
-      viewDate: null,
-      inputDate: null,
-      renewDate: null,
-      callDates: '[]',
-      nextDate: null,
-      nextNote: null,
-      created_at: '',
-      updated_at: '',
-      master_data_id: null,
-      property_db_id: null,
-      property_db_name: null,
-      show_dashboard: '1',
-      phone: '',
-      mail: '',
-      applicationDate: null
+  /** 登録のモーダルの「登録する」。必須は LeadEdit が確かめる。⚠️ 同じ人の反響が既にあれば、確かめてから登録する */
+  const createLead = async (info: Partial<SellLead>) => {
+    const dup = findDuplicateLead(leads, info);
+    if (dup && !window.confirm(`同じ連絡先、または同名・同日の反響が既に登録されています（${dup.seller || dup.name || '名称なし'}／${formatDate(dup.receivedDate)}）。\nそれでも登録しますか？`)) return;
+    const { id: _id, internal_id: _i, created_at: _c, updated_at: _u, ...rest } = info;
+    const seller = String(info.seller || info.name || '').trim();
+    const id = newRecordId();
+    // 'sellLeads' ではなく 'leads'。brokerage_listings.kind と一覧の絞り込み条件（kind === 'leads'）に合わせる
+    const fields: Record<string, unknown> = {
+      ...rest, kind: 'leads', seller, customer: seller, name: seller,
+      receivedDate: String(info.receivedDate || '').replace(/\//g, '-'), callDates: info.callDates || '[]', show_dashboard: 1,
     };
-
-    setLeads(prev => [newRecord, ...prev]);
-    setIsAdding(false);
-
+    setIsEditModalOpen(false);
     try {
-      await saveBrokerageRecord(newRecord.id, {
-        kind: 'leads',
-        seller: newRecord.seller,
-        customer: newRecord.customer,
-        name: newRecord.name,
-        staff: newRecord.staff,
-        source: newRecord.source,
-        phase: newRecord.phase,
-        receivedDate: newRecord.receivedDate,
-        callDates: '[]',
-        show_dashboard: 1,
-      });
+      const row = await saveBrokerageRecord(id, fields);
+      setLeads(prev => [{ ...fields, ...(row ?? {}), id } as SellLead, ...prev]);
     } catch (e) {
-      console.error('[LeadSell] 新規リードの登録に失敗しました', newRecord, e);
-      setLeads(prev => prev.filter(l => l.id !== newRecord.id));
-      alert('新規リードの登録に失敗しました。もう一度お試しください。');
+      console.error('[LeadSell] 反響の登録に失敗しました', id, e);
+      alert('反響を登録できませんでした。通信状況を確認して、もう一度お試しください。');
     }
   };
 
@@ -543,15 +488,19 @@ const LeadSell = () => {
    * フェーズの変更（以前のアプリの ieGuard と同じ）。
    * ⚠️ v2.2.244: 値が変わったときだけ動く（以前は onBlur で、触れるたびに保存し・追客終了の理由を聞き直していた）。
    *   追客終了 … 理由を聞いて endReason も保存する（⚠️ 以前は聞いた理由を捨てていた）。追客終了から戻すと理由を消す
-   *   媒介受託 … 媒介契約日を聞き、媒介獲得台帳へ1行作る
+   *   媒介受託 … ⚠️ v2.2.247: 台帳が無ければ、ここでは保存せずに媒介紐付の画面を開く（登録したときに段階も媒介受託になる）
    */
   const handlePhaseChange = async (lead: SellLead, e: React.ChangeEvent<HTMLSelectElement>) => {
     const select = e.target;
     const prev = lead.phase || 'リード受信';
     const next = select.value;
     if (next === prev) return;
+    if (next === '媒介受託' && !lead.ledgerNo) {
+      select.value = prev;
+      setLedgerTarget(lead);
+      return;
+    }
     const fields: Record<string, unknown> = { phase: next };
-    let baikaiDate: string | null = null;
     if (next === '追客終了') {
       const reason = askEndReason(LEAD_END_REASONS, lead.endReason);
       if (reason == null) { select.value = prev; return; }
@@ -559,13 +508,7 @@ const LeadSell = () => {
     } else if (lead.endReason) {
       fields.endReason = '';
     }
-    if (next === '媒介受託') {
-      baikaiDate = askBaikaiDate(lead.baikaiDate);
-      if (baikaiDate == null) { select.value = prev; return; }
-      fields.baikaiDate = baikaiDate;
-    }
-    if (!(await handleApiPatch(lead.id, fields))) { select.value = prev; return; }
-    if (baikaiDate != null) await linkToLedger(lead, baikaiDate);
+    if (!(await handleApiPatch(lead.id, fields))) select.value = prev;
   };
 
   // 💡 追加: 次回連絡日セルの視覚強化（source.html の nextCell() 相当）
@@ -586,17 +529,16 @@ const LeadSell = () => {
   };
 
   const handleSaveCustomerInfo = () => {
-    if (customerInfo.id) {
-      // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
-      // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
-      const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
-      const saved = customerInfo as SellLead;
-      void handleApiPatch(id, fields).then(async ok => {
-        // ⚠️ v2.2.244: 媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead。媒介契約日は LeadEdit が必須にしている）
-        const linked = ok ? await linkLedgerAfterEdit(saved as unknown as Record<string, unknown>, settings.staff) : null;
-        if (linked) setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...linked.leadFields } as SellLead : l)));
-      });
-    }
+    // ⚠️ v2.2.247: id が無ければ登録（「反響を追加」）
+    if (!customerInfo.id) { void createLead(customerInfo); return; }
+    // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
+    // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
+    const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
+    const saved = customerInfo as SellLead;
+    void handleApiPatch(id, fields).then(ok => {
+      // ⚠️ v2.2.247: 媒介受託で保存して台帳がまだ無ければ、媒介紐付の画面を開く（v2.2.244〜246 はすぐに台帳を作っていた）
+      if (ok && saved.phase === '媒介受託' && !saved.ledgerNo) setLedgerTarget(saved);
+    });
     setIsEditModalOpen(false);
   };
 
@@ -641,7 +583,7 @@ const LeadSell = () => {
         availableMonths={[]}
         periodGroups={periodOptions}
         handleAddClick={handleAddClick}
-        isAdding={isAdding}
+        isAdding={isEditModalOpen && !customerInfo.id}
         headerLabel={headerLabel}
         nextActionAlert={nextActionAlert}
       />
@@ -692,52 +634,14 @@ const LeadSell = () => {
                 <th style={compactThStyle}>区分</th>
                 <th style={compactThStyle}>通電日</th>
                 <th style={compactThStyle}>訪問査定日</th>
+                <th style={compactThStyle}>媒介紐付</th>
                 <th style={compactThStyle}>書類</th>
               </tr>
             </thead>
             <tbody>
-              {/* 新規追加用インプット行 */}
-              {isAdding && (
-                <tr>
-                  <td style={getTdStyle(false, { borderLeft: '4px solid #3182ce' })}>
-                    <input type="date" style={compactInputStyle} defaultValue={formatDate(new Date()).replace(/\//g, '-')} ref={newReceivedDateRef} />
-                  </td>
-                  <td style={getTdStyle(false)}>
-                    <select style={compactInputStyle} defaultValue="" ref={newSourceRef}>
-                      <option value="">反響元</option>
-                      {SELL_SOURCES.map(p => <option key={p} value={p}>{p}</option>)}
-                    </select>
-                  </td>
-                  <td style={getTdStyle(false)}>
-                    <input type="text" style={{ ...compactInputStyle, border: '1px solid #dee2e6' }} placeholder="売主名" defaultValue="" ref={newSellerRef} />
-                  </td>
-                  <td style={getTdStyle(false)}>
-                    <select style={compactInputStyle} defaultValue="" ref={newStaffRef}>
-                      <option value="">担当を選択</option>
-                      {staffList.map(s => <option key={s} value={s}>{s}</option>)}
-                    </select>
-                  </td>
-                  <td style={getTdStyle(false)}>
-                    {/* ⚠️ v2.2.244: 以前のアプリの値。媒介受託・追客終了は日付・理由が要るので、追加した後に一覧で変える */}
-                    <select style={compactInputStyle} defaultValue="リード受信" ref={newPhaseRef}>
-                      {LEAD_PHASES.filter(p => p !== '媒介受託' && p !== '追客終了').map(p => <option key={p} value={p}>{p}</option>)}
-                    </select>
-                  </td>
-                  <td colSpan={9} style={{ ...getTdStyle(false), color: '#6c757d', textAlign: 'left', fontSize: '10px' }}>
-                    ※その他の詳細は追加後に設定できます。
-                  </td>
-                  <td style={getTdStyle(false)}>
-                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
-                      <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }} onClick={handleSaveNewLead}>追加</button>
-                      <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', color: '#6c757d', border: '1px solid #ced4da', borderRadius: '4px' }} onClick={() => setIsAdding(false)}>取消</button>
-                    </div>
-                  </td>
-                </tr>
-              )}
-
               {isLoading ? (
                 <tr>
-                  <td colSpan={15} style={{ padding: '40px', textAlign: 'center' }}>
+                  <td colSpan={16} style={{ padding: '40px', textAlign: 'center' }}>
                     <div className="spinner-border text-primary" role="status"></div>
                   </td>
                 </tr>
@@ -788,7 +692,9 @@ const LeadSell = () => {
                         </select>
                       </td>
                       <td style={getTdStyle(isUnassigned)}>
+                        {/* ⚠️ v2.2.247: key に段階を入れる（「媒介紐付」のボタンで段階が変わったときに、表示を描き直す） */}
                         <select
+                          key={`${lead.id}:${lead.phase || ''}`}
                           style={{ ...compactInputStyle, backgroundColor: isUnassigned ? '#fff' : '#f8f9fa', borderRadius: '4px', fontWeight: 'bold' }}
                           defaultValue={lead.phase || 'リード受信'}
                           onChange={(e) => void handlePhaseChange(lead, e)}
@@ -868,11 +774,28 @@ const LeadSell = () => {
                       {/* 💡 売り特有の日付 */}
                       <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.connectDate)}</td>
                       <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.visitDate)}</td>
+                      {/*
+                        ⚠️ v2.2.247: 媒介紐付（以前のアプリの一覧と同じ）。台帳へつなぐのは、この画面だけ（架電キュー・チームサマリーでは作らない）
+                          台帳あり → 台帳No. ／ 追客終了 → ― ／ 媒介受託で台帳なし → 未転記→台帳へ ／ それ以外 → 媒介紐付。押すと LedgerLinkModal
+                      */}
                       <td style={getTdStyle(isUnassigned)}>
-                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
-                          <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', color: '#6c757d' }}>
-                            🔗 媒介紐付
+                        {lead.ledgerNo ? (
+                          <span className="badge bg-success bg-opacity-10 text-success border border-success" style={{ fontSize: '10px' }}>台帳No.{lead.ledgerNo}</span>
+                        ) : lead.phase === '追客終了' ? (
+                          <span style={{ color: '#adb5bd' }}>―</span>
+                        ) : (
+                          <button
+                            type="button"
+                            style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', ...(lead.phase === '媒介受託' ? { border: '1px solid #fd7e14', color: '#fd7e14', fontWeight: 'bold' } : { border: '1px solid #ced4da', color: '#6c757d' }) }}
+                            onClick={() => setLedgerTarget(lead)}
+                            title="媒介獲得台帳へ登録する画面を開く（登録すると段階は媒介受託になる）"
+                          >
+                            {lead.phase === '媒介受託' ? '未転記→台帳へ' : '🔗 媒介紐付'}
                           </button>
+                        )}
+                      </td>
+                      <td style={getTdStyle(isUnassigned)}>
+                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                           <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px', backgroundColor: '#fff', color: '#6c757d' }}
                               onClick={() => handleOpenDocument(lead)}>
                               <i className="fa-solid fa-file-contract me-1 text-secondary"></i>契約書
@@ -884,7 +807,7 @@ const LeadSell = () => {
                 })
               ) : (
                 <tr>
-                  <td colSpan={15} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
+                  <td colSpan={16} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                     データが見つかりません。
                   </td>
                 </tr>
@@ -908,6 +831,14 @@ const LeadSell = () => {
       {/* ==========================================
                 💡 顧客情報編集モーダル (売却仕様)
             ========================================== */}
+      {/* ⚠️ v2.2.247: 媒介紐付（売り反響 → 媒介獲得台帳。台帳へつなぐのは、この画面だけ） */}
+      <LedgerLinkModal
+        lead={ledgerTarget as unknown as Row | null}
+        staffNames={ledgerStaffNames}
+        onClose={closeLedgerModal}
+        onSubmit={submitLedger}
+      />
+
       <LeadEdit
         isOpen={isEditModalOpen}
         onClose={() => setIsEditModalOpen(false)}
@@ -915,6 +846,7 @@ const LeadSell = () => {
         customerInfo={customerInfo}
         setCustomerInfo={setCustomerInfo}
         leadCategory="sell"
+        sourceOptions={SELL_SOURCES}
         staffList={staffList}
         onNavi={() => {
           const lead = leads.find(l => l.id === customerInfo.id);
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index 022665d27..300d8338a 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -7,7 +7,7 @@ import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
 import LeadEdit, { LeadCategory } from '../common/LeadEdit';
 import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
-import { linkLedgerAfterEdit } from '../common/leadLinks';
+import { noticeLedgerOnSellScreen } from '../common/leadLinks';
 // ⚠️ v2.2.222: 年間予算進捗・月次KPI・架電実績・朝礼用アラートは本番アプリの集計をそのまま写した kpi.ts で出す
 import {
     ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
@@ -268,11 +268,8 @@ const Summary = () => {
 
         try {
             await saveBrokerageRecord(id, fields);
-            // ⚠️ v2.2.244: 売り反響を媒介受託で保存したら媒介獲得台帳へ（以前のアプリの saveLead）
-            if (!isBuy) {
-                const linked = await linkLedgerAfterEdit({ ...(before ?? {}), ...fields, id }, settings.staff);
-                if (linked) setTarget(prev => prev.map(l => (l.id === id ? { ...l, ...linked.leadFields } as SummaryLead : l)));
-            }
+            // ⚠️ v2.2.247: 媒介獲得台帳は売り反響の画面でだけ作る（v2.2.244〜246 はここでも作っていた）
+            if (!isBuy) noticeLedgerOnSellScreen({ ...(before ?? {}), ...fields });
             // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
             if (before) {
                 await recordFieldChanges({
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index f05ab03b8..900a0b316 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.246';
+export const newVersion = '2.2.247';
```
