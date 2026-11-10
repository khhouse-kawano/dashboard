import React, { useEffect, useMemo, useState } from 'react';
import { loadRecords } from './realtyState';
import { guessProperty } from './leadLinks';

/**
 * 買い反響の「問合せ物件（媒介獲得台帳）」（v2.2.256。以前のアプリ v14.14 の blLedOpts・blLedPick を検索の形にしたもの）。
 *   入れた文字で媒介獲得台帳を探して候補に出し、押すとその台帳に紐づける。
 *   ポータルに載せる前の物件や、電話・来店の反響を、台帳の物件とつなぐため。
 * ⚠️ 探すのは 台帳No.・売主・所在地（addr1・addr2。URL は除く）・種別・いえらぶの物件番号と物件名（v2.2.258）。空白・全角半角・大文字小文字は無視する。
 * ⚠️ v2.2.258 から、ポータルの買い反響は ② が問い合わせの物件番号で自動でつなぐ（features/realty/ieloveMatch.ts）。ここは手で選ぶとき用。
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
    [`No.${str(l.no) || '―'}`, str(l.seller) || '売主未入力', addrOf(l).slice(0, 30), yen(l.price), str(l.baikaiType), str(l.propStatus),
        str(l.property_db_id) ? `いえらぶ${str(l.property_db_id)}` : '']
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
        // ⚠️ v2.2.258: いえらぶの物件番号（ポータルの自社の物件番号と同じ）・物件名でも探せる
        .map(l => ({ l, key: norm([`no.${str(l.no)}`, l.seller, l.addr1, str(l.addr2).split('http')[0], l.category, l.property_db_id, l.property_db_name].join(' ')) })), [ledger]);

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
                placeholder={ledger === null ? '媒介獲得台帳を読み込み中…' : '台帳No.・売主・所在地・いえらぶの物件番号で探す（例：吉野 3丁目）'}
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
