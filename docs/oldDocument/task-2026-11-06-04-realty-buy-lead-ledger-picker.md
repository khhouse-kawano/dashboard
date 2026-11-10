# 作業記録 v2.2.256　不動産企画係：買い反響の問合せ物件を媒介獲得台帳に紐づける

## 依頼（2026-11-06）
- 「買い反響として届いた物件と媒介獲得物件を紐づけるには物件名の一致が必要？」
- 「買い反響の顧客情報編集で、入力した文字で獲得した物件をサジェスト表示 → クリックで紐づける機能を付けたい（ポータルに掲載する前の物件もあるので）。必要ならカラムを追加」
- 計画を出して「進めてよい」。媒介物件（propertyId）もつなぐかは、お勧めの「つなぐ」で進めた

## 質問への答え（調べた結果）
- 物件名の一致は不要。買い反響と台帳は、買い反響の **`ledgerId`（台帳の id）・`ledgerNo`（台帳 No.）** でつながる。`targetProperty`（問合せ物件名）は表示用の文字
- 2つの列は DB にも ② の `broker:update` の書き込める列にもすでにある → **列の追加は不要**
- 今の Dashboard には、物件名・住所で自動でつなぐ処理は無い。以前のアプリはポータルのメール取込（`mailBuyRow`・`mbFindLedger`。物件所在地で台帳を1件に絞れたらつなぐ）でつないでいた（未移植）
- 以前のアプリ v14.14 の買い反響の編集には「問合せ物件（媒介獲得台帳から選択）」の選択欄（`blLedOpts`・`blLedPick`・`saveBuyLead`）があった。今回これを検索の形で移した

## できるようになったこと
- 買い反響の顧客情報編集（買い反響・チームサマリー・架電キューのどこから開いても）に
  - 「問合せ物件（媒介獲得台帳）」：文字を入れると媒介獲得台帳から最大10件の候補（No.／売主／所在地／売出価格／媒介の種類／現況）。押すと紐づけ、札と「解除」
    - 探すのは 台帳No.・売主・所在地（addr1・addr2。URL は除く）・種別。空白・全角半角・大文字小文字は無視。空白で区切るとすべての言葉に当てはまるものだけ
    - 数字だけなら台帳 No. の一致を先頭に
    - 媒介終了の台帳は出さない（以前のアプリと同じ）。並びは媒介契約日の新しい順
    - ↑↓ と Enter でも選べる
  - 「問合せ物件名（表示用・自由入力可）」：今まで編集画面に無かった（以前のアプリにはあった）
- 紐づけると `ledgerId`・`ledgerNo` と、台帳の媒介物件 `propertyId` を入れる。解除はこの3つを空に（問合せ物件名は残す）
- 問合せ物件名が空なら台帳から作った名前（`leadLinks.ts` の `guessProperty`＝以前のアプリの cbGuessProperty）を入れる。違う名前が入っていれば置き換えるか聞く
- 買い反響の一覧の問合せ物件に「📝No.〇」の札（以前のアプリと同じ）
- 変更内容の表示では、`ledgerId`・`propertyId` の id は出さず「問合せ物件（台帳No.）」「問合せ物件名」で出す
- ⚠️ 建物名は台帳の行に無く（媒介物件の表 `realty_properties` にだけある）、画面から読む手段も無いので、検索には入れていない

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/common | **LedgerPicker.tsx**（新規） | 検索欄と候補・札・解除。台帳は `loadRecords(['ledger'])`（既存の planner:records）で読む。専用の `<style>`（接頭辞 `lp_`） |
| frontend/src/components/realty/common | LeadEdit.tsx | 追加：**`handleLedgerPick`**。買いの欄に「問合せ物件（媒介獲得台帳）」「問合せ物件名」。`FIELD_LABELS` に targetProperty・ledgerNo。変更内容の表示から ledgerId・propertyId を外す |
| frontend/src/components/realty/buy | LeadBuy.tsx | 一覧の問合せ物件に「📝No.〇」の札と、title に台帳 No. |
| backend-express/src/features/realty | index.ts | `broker:update` の書き込める列（`ALLOWED_COLUMNS`）に `propertyId` |
| backend/scripts/guide/articles/common | screen-247.md | 記事「反響から商談案件へのつながり（不動産企画係）」に「問合せ物件を媒介獲得台帳の物件に紐づける」の節 |
| backend/scripts/sql | 2026-11-06_update_log_2.2.256.sql（新規） | 更新履歴＋記事の SQL |
| frontend/src/utils | version.ts | 2.2.256 |

- ⚠️ DB の列は追加していない。② の新しい request も無い（`express_proxy.php` の変更なし）
- ⚠️ `propertyId` を書き込めるようにしたので、売り反響・台帳の編集で送られる `propertyId`（読んだときの値のまま）も保存されるようになる。値は変わらないので影響は無い

## テスト（ローカル）
- ② を作り直した（`docker compose up -d --build express-api`）
- ① 経由（`localhost:8080`）：トークン無し `broker:update` → 401
- テストの台帳2件（No.99256 アクティブ・媒介物件 testprop256／No.99257 媒介終了）と買い反響1件を入れて、Playwright（3100、`scratchpad/pw_256.cjs`）で確かめ、最後に消した（変更履歴の行も）
  - 「テスト町 1-2」で探す → No.99256 だけ（全角の「１－２」に半角で当たる）
  - 「テスト町」で探しても媒介終了の No.99257 は出ない
  - 「99256」で探す → 先頭が No.99256
  - 押すと札が出て、空だった問合せ物件名に「鹿児島市テスト町１－２－３」
  - 保存 → DB に ledgerId=test256L・ledgerNo=99256・propertyId=testprop256・問合せ物件名（画面 → ① → ② の経路）
  - 一覧の問合せ物件に「📝No.99256」
  - 解除して保存 → ledgerId・ledgerNo・propertyId は NULL、問合せ物件名は残る
  - 問合せ物件名に別の名前が入っているときに選ぶと、置き換えるかを聞く
  - 画面のエラー 0
- フロント・② の型チェック（tsc）は通った
- 一時スタッフ（id 999999）・テストの行は消した。開発サーバーは止めた（3100 のプロセスも止まったことを確かめた）
- リファクタリング：新しく書いたところに重複・不要な処理は無かった（所在地の組み立ては `guessProperty` の中と同じ規則だが、`guessProperty` は名前を返す関数で所在地だけは取り出せないため、既存のコードは変えずに LedgerPicker に小さく持った）

## 業務ガイド
- 記事「反響から商談案件へのつながり（不動産企画係）」（common/screen-247.md）
  - 買い反響の節を「問合せ物件を媒介獲得台帳の物件に紐づける」「段階と商談案件」に分けた
  - 紐づけ方（4手順）・札と解除・問合せ物件名の入り方・媒介終了は出ない・一覧の札・媒介物件にもつながる・買付登録との関係
  - 注意：物件名や住所が合っているだけでは紐づかない
- SQL は `2026-11-06_update_log_2.2.256.sql` の末尾。ローカルに流した（update_log は no=355）

## 追加・修正した関数・コンポーネント（全文）

### frontend/src/components/realty/common/LeadEdit.tsx の handleLedgerPick（追加）
```tsx
    /**
     * ⚠️ v2.2.256: 買い反響の問合せ物件を媒介獲得台帳に紐づける（以前のアプリの saveBuyLead・blLedPick）。
     *   台帳の id・No. と、台帳の媒介物件（propertyId）を入れる。null は解除（問合せ物件名は残す）。
     *   問合せ物件名が空なら台帳から作った名前を入れ、入っていて違うときは置き換えるか聞く。
     */
    const handleLedgerPick = (ledger: Record<string, unknown> | null) => {
        if (!ledger) {
            setCustomerInfo((prev: any) => ({ ...prev, ledgerId: null, ledgerNo: null, propertyId: null }));
            return;
        }
        const name = guessProperty(ledger);
        const curName = String(customerInfo.targetProperty ?? '').trim();
        const replace = name !== '' && name !== curName
            && (curName === '' || window.confirm(`問合せ物件名を「${name}」に置き換えますか？\n（今の入力：${curName}）`));
        setCustomerInfo((prev: any) => ({
            ...prev,
            ledgerId: String(ledger.id ?? ''),
            ledgerNo: ledger.no === null || ledger.no === undefined ? null : String(ledger.no),
            propertyId: ledger.propertyId ? String(ledger.propertyId) : null,
            ...(replace ? { targetProperty: name } : {}),
        }));
    };
```

### frontend/src/components/realty/common/LedgerPicker.tsx（新規）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { loadRecords } from './realtyState';
import { guessProperty } from './leadLinks';

/**
 * 買い反響の「問合せ物件（媒介獲得台帳）」（v2.2.256。以前のアプリ v14.14 の blLedOpts・blLedPick を検索の形にしたもの）。
 *   入れた文字で媒介獲得台帳を探して候補に出し、押すとその台帳に紐づける。
 *   ポータルに載せる前の物件や、電話・来店の反響を、台帳の物件とつなぐため。
 * ⚠️ 探すのは 台帳No.・売主・所在地（addr1・addr2。URL は除く）・種別。空白・全角半角・大文字小文字は無視する。
 * ⚠️ 媒介終了の台帳は候補に出さない（以前のアプリの blLedList と同じ）。今つながっている台帳は、媒介終了でも札に出す。
 */
type Row = Record<string, unknown>;

type Props = {
    /** 今つながっている台帳の id（buyLeads.ledgerId） */
    ledgerId: string;
    /** 今の台帳 No.（台帳が読めないときの札の表示用） */
    ledgerNo: string;
    /** 台帳を選んだ（null は解除） */
    onPick: (ledger: Row | null) => void;
};

const MAX = 10;
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
/** 比べるための形（空白を除き、全角英数を半角に、小文字に） */
const norm = (v: unknown): string => str(v).normalize('NFKC').replace(/\s/g, '').toLowerCase();
/** 所在地（addr2 の URL は除く。⚠️ 売り反響から作った台帳は addr2 に住所全体が入るので重ねない） */
const addrOf = (l: Row): string => {
    const a1 = str(l.addr1).trim();
    const a2 = str(l.addr2).split('http')[0].trim();
    return (a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`).trim();
};
const yen = (v: unknown): string => (Number(v) ? `${Math.round(Number(v) / 10000).toLocaleString()}万円` : '');
/** 候補・札の1行（以前のアプリの ledPickLabel に媒介の種類・現況を足した） */
const labelOf = (l: Row): string =>
    [`No.${str(l.no) || '―'}`, str(l.seller) || '売主未入力', addrOf(l).slice(0, 30), yen(l.price), str(l.baikaiType), str(l.propStatus)]
        .filter(Boolean).join('／');

const css = `
.lp_wrap{position:relative}
.lp_input{width:100%;box-sizing:border-box;font-size:11px;padding:4px 8px;border:1px solid #dee2e6;border-radius:4px;height:28px;color:#495057;background:#fff;outline:none}
.lp_input:focus{border-color:#86b7fe;box-shadow:0 0 0 2px rgba(13,110,253,.15)}
.lp_list{position:absolute;z-index:20;left:0;right:0;top:30px;background:#fff;border:1px solid #dee2e6;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.12);max-height:260px;overflow-y:auto;margin:0;padding:0;list-style:none}
.lp_item{padding:6px 8px;font-size:11px;color:#343a40;cursor:pointer;border-bottom:1px solid #f1f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lp_item:hover,.lp_item.lp_on{background:#e7f1ff}
.lp_none{padding:6px 8px;font-size:11px;color:#6c757d}
.lp_badge{display:flex;align-items:center;gap:6px;font-size:11px;background:#eef2f7;border:1px solid #c9d6e8;color:#22405c;border-radius:4px;padding:3px 8px;min-height:28px;box-sizing:border-box}
.lp_badge span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp_btn{font-size:10px;padding:1px 8px;border:1px solid #ced4da;border-radius:4px;background:#fff;color:#495057;cursor:pointer}
.lp_btn:hover{background:#f1f3f5}
.lp_hint{font-size:9px;color:#6c757d;margin-top:2px}
`;

const LedgerPicker: React.FC<Props> = ({ ledgerId, ledgerNo, onPick }) => {
    const [ledger, setLedger] = useState<Row[] | null>(null);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [cur, setCur] = useState(0);

    useEffect(() => {
        let alive = true;
        loadRecords(['ledger'])
            .then(r => { if (alive) setLedger(r.records.ledger ?? []); })
            .catch(e => { console.error('[LedgerPicker] 媒介獲得台帳を読めませんでした', e); if (alive) setLedger([]); });
        return () => { alive = false; };
    }, []);

    /** 候補になる台帳（媒介終了を除き、媒介契約日の新しい順）と、探すための文字 */
    const pool = useMemo(() => (ledger ?? [])
        .filter(l => str(l.propStatus) !== '媒介終了')
        .sort((a, b) => str(b.contractDate).localeCompare(str(a.contractDate)))
        .map(l => ({ l, key: norm([`no.${str(l.no)}`, l.seller, l.addr1, str(l.addr2).split('http')[0], l.category].join(' ')) })), [ledger]);

    const hits = useMemo(() => {
        const words = q.split(/[\s　]+/).map(norm).filter(Boolean);
        if (!words.length) return [];
        // ⚠️ 数字だけなら台帳 No. の一致を先に出す
        const exactNo = /^\d+$/.test(q.trim()) ? pool.filter(p => str(p.l.no) === q.trim()) : [];
        const rest = pool.filter(p => !exactNo.includes(p) && words.every(w => p.key.includes(w)));
        return [...exactNo, ...rest].slice(0, MAX).map(p => p.l);
    }, [q, pool]);

    const linked = ledgerId ? (ledger ?? []).find(l => str(l.id) === ledgerId) ?? null : null;

    const pick = (l: Row) => {
        onPick(l);
        setQ('');
        setOpen(false);
    };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || !hits.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setCur(c => Math.min(c + 1, hits.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCur(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(hits[cur]); }
        else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };

    if (ledgerId) {
        return (
            <div className="lp_wrap">
                <style>{css}</style>
                <div className="lp_badge" title={linked ? labelOf(linked) : ''}>
                    📝<span>{linked ? labelOf(linked) : `台帳 No.${ledgerNo || '―'}`}</span>
                    <button type="button" className="lp_btn" onClick={() => onPick(null)}>解除</button>
                </div>
                {linked && <div className="lp_hint">物件名の候補：{guessProperty(linked)}</div>}
            </div>
        );
    }

    return (
        <div className="lp_wrap">
            <style>{css}</style>
            <input
                className="lp_input"
                value={q}
                placeholder={ledger === null ? '媒介獲得台帳を読み込み中…' : '台帳No.・売主・所在地で探す（例：吉野 3丁目）'}
                disabled={ledger === null}
                onChange={e => { setQ(e.target.value); setOpen(true); setCur(0); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKey}
                aria-label="問合せ物件を媒介獲得台帳から探す"
            />
            {open && q.trim() !== '' && (
                <ul className="lp_list" role="listbox">
                    {hits.length === 0
                        ? <li className="lp_none">当てはまる物件がありません（媒介終了の物件は出しません）</li>
                        : hits.map((l, i) => (
                            // ⚠️ onMouseDown（入力欄の onBlur より先に動く）
                            <li key={str(l.id)} role="option" aria-selected={i === cur} className={`lp_item${i === cur ? ' lp_on' : ''}`}
                                onMouseDown={e => { e.preventDefault(); pick(l); }} onMouseEnter={() => setCur(i)} title={labelOf(l)}>
                                {labelOf(l)}
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
};

export default LedgerPicker;
```

## git diff（既存ファイル）
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 33ef44713..3bbced267 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -158,6 +158,8 @@ const ALLOWED_COLUMNS = [
   'freq', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
   'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
   'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
+  // ⚠️ v2.2.256: 買い反響を媒介獲得台帳に紐づけたときの媒介物件（realty_properties.id。台帳と同じ値。v2.2.250 の列）
+  'propertyId',
   'subStaff', 'subRatio', 'coBroker', 'delivery',
   // ⚠️ v2.2.222: 本番アプリ（V14.11〜）で増えた商談のリフォーム受注と、商談リストの登録日
   'reformPrice', 'reformGp', 'reformNote', 'createdAt',
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index ead08c821..780520ce7 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -54,6 +54,23 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 > 注意：今日の架電キュー・チームサマリーの編集画面では、段階に「媒介受託」を選べません。売り反響の画面の「媒介紐付」から登録してください。
 
 ## 買い反響（ポータル）
+### 問合せ物件を媒介獲得台帳の物件に紐づける
+ポータルに載せる前の物件や、電話・来店の反響のように、どの物件への問い合わせかを自動で拾えないときは、編集画面で紐づけます。
+1. 買い反響の顧客名を押して編集画面を開く
+2. 「**問合せ物件（媒介獲得台帳）**」の欄に、台帳No.・売主名・所在地の一部を入れる（例：「吉野 3丁目」「125」）。空白で区切ると、すべての言葉に当てはまる物件だけに絞れます
+3. 下に出た候補（台帳No.／売主／所在地／売出価格／媒介の種類／現況）を押す
+4. 「保存する」を押す
+
+- 紐づけると、欄に「📝 No.〇／売主…」の札が出ます。「**解除**」で外せます（問合せ物件名は残ります）
+- 「問合せ物件名」が空なら、台帳の物件名（自社名義なら括弧の中の物件名、それ以外は所在地）が入ります。すでに入っていて違うときは、置き換えるかを聞きます。他社物件・未定のときは、問合せ物件名だけを入れてください
+- 媒介終了の台帳は候補に出ません
+- 買い反響の一覧の「問合せ物件」に、紐づいている反響は「📝No.〇」の札が出ます
+- この欄で紐づけた買い反響は、台帳と同じ「媒介物件」にもつながります
+- 媒介獲得台帳の「🤝買付登録」の自社客付けで選んだ買い反響も、まだどの台帳にも紐づいていなければ、その台帳に紐づきます
+
+> 注意：物件名や住所が合っているだけでは、紐づきません。この欄か、媒介獲得台帳の「買付登録」で紐づけてください。
+
+### 段階と商談案件
 - 段階を「**購入申込**」にすると、「商談案件管理へ転記しますか？」と聞かれます。「OK」で、**商談案件管理に「買」の案件が1件作られます**。物件名・価格を確かめてください
 - その場で転記しなかったときは、段階の下の「**案件へ転記**」を押すと作れます。作った反響には「案件に連携済み」と出ます
 - 「追客終了」の理由は、売り反響と同じように保存されます
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index c8077e4c8..237f4646e 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -667,7 +667,9 @@ const LeadBuy = () => {
                                             <td style={{ ...getTdStyle(isUnassigned), whiteSpace: 'normal', lineHeight: '1.4', textAlign: 'left' }}>
                                                 {lead.phone} <br /> <span style={{ fontSize: '9px', color: '#8898aa' }}>{lead.mail}</span>
                                             </td>
-                                            <td style={{ ...getTdStyle(isUnassigned), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={lead.targetProperty || ''}>
+                                            <td style={{ ...getTdStyle(isUnassigned), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={`${lead.targetProperty || ''}${lead.ledgerId ? `（媒介獲得台帳 No.${lead.ledgerNo ?? '―'}）` : ''}`}>
+                                                {/* ⚠️ v2.2.256: 媒介獲得台帳に紐づく反響は台帳 No. の札（以前のアプリの買い反響の一覧と同じ） */}
+                                                {lead.ledgerId && <span className="badge bg-primary bg-opacity-10 text-primary border border-primary me-1" style={{ fontSize: '9px' }}>📝No.{lead.ledgerNo ?? '―'}</span>}
                                                 {lead.targetProperty}
                                             </td>
                                             <td style={{ ...getTdStyle(isUnassigned), fontWeight: 'bold', textAlign: 'right' }}>{formatYen(lead.budget)}</td>
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index 0eac13053..89404a5ab 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -7,6 +7,9 @@ import { removeSpaces, NEXT_QUICK, addDaysISO, LEAD_END_REASONS, BUY_END_REASONS
 import DocumentViewer from '../documents/DocumentViewer';
 // 💡 追加: サーバー保存済みの変更履歴
 import LeadHistory from './LeadHistory';
+// ⚠️ v2.2.256: 買い反響の問合せ物件（媒介獲得台帳から検索して紐づける）
+import LedgerPicker from './LedgerPicker';
+import { guessProperty } from './leadLinks';
 
 // 💡 追加: 変更内容プレビューで表示するフィールド名の日本語ラベル
 const FIELD_LABELS: Record<string, string> = {
@@ -16,6 +19,7 @@ const FIELD_LABELS: Record<string, string> = {
     connectDate: '通電日', viewDate: '内見日', visitDate: '訪問査定日', baikaiDate: '媒介契約日',
     contactDate: '接触日', contractDate: '契約日', followDate: 'フォロー日', fee: '仲介手数料',
     nextDate: '次回連絡日', nextNote: '次回アクション', note: '備考',
+    targetProperty: '問合せ物件名', ledgerNo: '問合せ物件（台帳No.）',
 };
 
 // ==========================================
@@ -166,6 +170,7 @@ const LeadEdit: React.FC<LeadEditProps> = ({
         const keys = new Set([...Object.keys(snapshot || {}), ...Object.keys(customerInfo || {})]);
         keys.forEach(k => {
             if (k === 'callDates' || k === 'id') return; // 架電履歴・IDは別UIで扱うため対象外
+            if (k === 'ledgerId' || k === 'propertyId') return; // ⚠️ v2.2.256: 台帳・媒介物件の id は「問合せ物件（台帳No.）」で見せる
             const from = (snapshot as any)?.[k];
             const to = (customerInfo as any)?.[k];
             if (String(from ?? '') !== String(to ?? '')) {
@@ -304,6 +309,29 @@ const LeadEdit: React.FC<LeadEditProps> = ({
         setCustomerInfo({ ...customerInfo, staff: newStaff });
     };
 
+    /**
+     * ⚠️ v2.2.256: 買い反響の問合せ物件を媒介獲得台帳に紐づける（以前のアプリの saveBuyLead・blLedPick）。
+     *   台帳の id・No. と、台帳の媒介物件（propertyId）を入れる。null は解除（問合せ物件名は残す）。
+     *   問合せ物件名が空なら台帳から作った名前を入れ、入っていて違うときは置き換えるか聞く。
+     */
+    const handleLedgerPick = (ledger: Record<string, unknown> | null) => {
+        if (!ledger) {
+            setCustomerInfo((prev: any) => ({ ...prev, ledgerId: null, ledgerNo: null, propertyId: null }));
+            return;
+        }
+        const name = guessProperty(ledger);
+        const curName = String(customerInfo.targetProperty ?? '').trim();
+        const replace = name !== '' && name !== curName
+            && (curName === '' || window.confirm(`問合せ物件名を「${name}」に置き換えますか？\n（今の入力：${curName}）`));
+        setCustomerInfo((prev: any) => ({
+            ...prev,
+            ledgerId: String(ledger.id ?? ''),
+            ledgerNo: ledger.no === null || ledger.no === undefined ? null : String(ledger.no),
+            propertyId: ledger.propertyId ? String(ledger.propertyId) : null,
+            ...(replace ? { targetProperty: name } : {}),
+        }));
+    };
+
     // ==========================================
     // 💡 フェーズ変更（追客終了になったら終了理由をリセット）
     // ==========================================
@@ -476,6 +504,15 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                                         <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション(メモ)</label>
                                         <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
                                     </div>
+                                    {/* ⚠️ v2.2.256: 問合せ物件（媒介獲得台帳から探して紐づける。ポータルに載せる前の物件・電話・来店の反響用） */}
+                                    <div className="col-md-7">
+                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>問合せ物件（媒介獲得台帳）</label>
+                                        <LedgerPicker ledgerId={String(customerInfo.ledgerId ?? '')} ledgerNo={String(customerInfo.ledgerNo ?? '')} onPick={handleLedgerPick} />
+                                    </div>
+                                    <div className="col-md-5">
+                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>問合せ物件名（表示用・自由入力可）</label>
+                                        <input type="text" style={compactInputStyle} value={customerInfo.targetProperty || ''} placeholder="他社物件・未定ならここに入力" onChange={e => setCustomerInfo({ ...customerInfo, targetProperty: e.target.value })} />
+                                    </div>
                                 </>
                             )}
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index d15d48b08..7f3e8818f 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.255';
+export const newVersion = '2.2.256';
```
