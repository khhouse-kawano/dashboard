import React, { useState } from 'react';
import { post } from '../common/realtyState';

/**
 * 以前のアプリの通話記録・練習記録（CSV）を取り込む（不動産企画係の設定画面。v2.2.226。マスターだけ）。
 *
 * ⚠️ 元のファイル: 以前のアプリの Supabase の表 call_logs（架電ナビの通話記録）・practice_logs（ロープレ練習の記録）を
 *   Supabase の画面から CSV で書き出したもの。列名はその表のまま（id・created_at・staff …）。
 * ⚠️ id で二重取り込みを防ぐ（② の features/realty/calls.ts）。同じファイルを何度流しても増えない。
 * ⚠️ 練習記録は、練習の画面（移行中）を移したときに使う。いまは取り込んで残すだけ。
 */

type Kind = 'call' | 'practice';
/** need = 無ければ別のファイルとみなす列 */
const KINDS: Record<Kind, { label: string; roll: string; need: string[] }> = {
    call: { label: '通話記録（call_logs）', roll: 'call_logs_import', need: ['id', 'created_at', 'outcome'] },
    practice: { label: '練習記録（practice_logs）', roll: 'practice_logs_import', need: ['id', 'created_at', 'mode'] },
};

const BATCH = 200;

/** CSV を読む（RFC 4180。"…" の中の , と改行と "" を扱う）。1行目は列名 */
const parseCsv = (text: string): Record<string, string>[] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const t = text.replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (quoted) {
            if (ch === '"') {
                if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
            } else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && t[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(c => c !== '')) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c !== '')) rows.push(row);
    const [head, ...body] = rows;
    if (!head) return [];
    return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
};

type Parsed = { kind: Kind; name: string; rows: Record<string, string>[] };

const RealtyLogImport: React.FC = () => {
    const [kind, setKind] = useState<Kind>('call');
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

    const onFile = async (file: File | undefined) => {
        setParsed(null);
        setResult(null);
        setProgress('');
        if (!file) return;
        const rows = parseCsv(await file.text());
        if (!rows.length) { alert('行がありません'); return; }
        const missing = KINDS[kind].need.filter(c => !(c in rows[0]));
        if (missing.length) {
            alert(`${KINDS[kind].label}の CSV ではないようです（${missing.join('・')} の列がありません）`);
            return;
        }
        setParsed({ kind, name: file.name, rows });
    };

    const run = async () => {
        if (!parsed) return;
        if (!window.confirm(`${KINDS[parsed.kind].label}を ${parsed.rows.length.toLocaleString()} 件取り込みます。すでにある記録（同じ id）は飛ばします。よろしいですか？`)) return;
        setBusy(true);
        const total = { inserted: 0, skipped: 0 };
        try {
            for (let i = 0; i < parsed.rows.length; i += BATCH) {
                setProgress(`${Math.min(i + BATCH, parsed.rows.length).toLocaleString()} / ${parsed.rows.length.toLocaleString()} 件`);
                // ⚠️ ① を通ると {} が [] になるため、1行ずつ JSON の文字列で送る
                const d = await post(KINDS[parsed.kind].roll, { rows: parsed.rows.slice(i, i + BATCH).map(r => JSON.stringify(r)) });
                total.inserted += Number(d.inserted) || 0;
                total.skipped += Number(d.skipped) || 0;
            }
            setResult(total);
        } catch (e) {
            alert(`途中で止まりました（${total.inserted} 件まで取り込み済み。もう一度流すと続きから入ります）: ${(e as Error).message}`);
            setResult(total);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>以前のアプリの通話記録・練習記録を取り込む（CSV）</h3>
                <span className="rlt-note">マスターだけ。Supabase の call_logs・practice_logs を CSV で書き出したファイル。同じ記録は二重に入りません</span>
            </div>
            <div className="rlt-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {(Object.keys(KINDS) as Kind[]).map(k => (
                        <label key={k} style={{ cursor: 'pointer' }}>
                            <input type="radio" name="rlt-log-kind" checked={kind === k} disabled={busy}
                                onChange={() => { setKind(k); setParsed(null); setResult(null); }} /> {KINDS[k].label}
                        </label>
                    ))}
                </div>
                {/* ⚠️ 選んだら空に戻す（同じファイルを選び直しても読み直すように） */}
                <input key={kind} type="file" accept=".csv,text/csv" disabled={busy}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
                {parsed && (
                    <div>
                        {parsed.name}：<b>{parsed.rows.length.toLocaleString()} 件</b>
                        <button className="rlt-btn" style={{ marginLeft: 8 }} disabled={busy} onClick={() => void run()}>取り込む</button>
                        {progress && <span className="rlt-note" style={{ marginLeft: 8 }}>{progress}</span>}
                    </div>
                )}
                {result && <div className="rlt-saved">取り込みました：新しく入れた {result.inserted.toLocaleString()} 件／すでにあった {result.skipped.toLocaleString()} 件</div>}
                <p className="rlt-sub">
                    練習記録は、ロープレ練習の画面（移行中）を移したときに使います。いまは取り込んで残すだけです。
                </p>
            </div>
        </div>
    );
};

export default RealtyLogImport;
