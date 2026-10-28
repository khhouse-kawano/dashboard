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
    /**
     * 非表示にする範囲（② の importer.ts の HideScope）。
     * ⚠️ v2.2.225: 既定は全面差し替え（2026-10-28「既存の brokerage_listings は無いものとして考えてよい」）
     */
    const [hideScope, setHideScope] = useState<'all' | 'imported'>('all');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<{ totals: Totals; hidden: number; hideSkipped: string | null; warnings: string[]; errors: string[] } | null>(null);

    const reset = () => { setParsed(null); setCheck(null); setResult(null); setProgress(null); };

    /** 下見。⚠️ 非表示の件数は範囲で変わるので、範囲を変えたら呼び直す */
    const runCheck = async (p: Parsed, scope: 'all' | 'imported') => {
        const c = await post('import_check', {
            records: p.records.map(r => ({ id: r.id, kind: r.kind, extId: r.data.extId ?? null })),
            hideScope: scope,
        });
        setCheck(c as unknown as Check);
        setHide(!c.hideRefusal);
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        reset();
        setBusy(true);
        try {
            const p = parseBackup(f.name, await f.text());
            await runCheck(p, hideScope);
            setParsed(p);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const changeScope = async (scope: 'all' | 'imported') => {
        setHideScope(scope);
        if (!parsed) return;
        setBusy(true);
        try {
            await runCheck(parsed, scope);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const run = async () => {
        if (!parsed || !check) return;
        const hideNote = hide && check.hide > 0
            ? `\n${hideScope === 'all' ? 'ファイルに無い' : '以前のアプリで消えた'} ${check.hide} 件を非表示にします。`
            : '';
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
                hideScope,
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
                                    <th className="r" title="ファイルに無いため非表示にする行（範囲は下で選ぶ）">非表示</th>
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
                        <div className="rlt-sub" style={{ margin: '8px 0' }}>
                            <label style={{ display: 'block' }}>
                                <input type="radio" name="rlt-hide-scope" checked={hideScope === 'all'} disabled={busy} onChange={() => changeScope('all')} />{' '}
                                <b>全面差し替え</b>：ファイルに無い行はすべて非表示（Dashboard のポータル取り込みで入った反響も）
                            </label>
                            <label style={{ display: 'block' }}>
                                <input type="radio" name="rlt-hide-scope" checked={hideScope === 'imported'} disabled={busy} onChange={() => changeScope('imported')} />{' '}
                                以前のアプリで消えた行だけ非表示（Dashboard で入った行は残す）
                            </label>
                        </div>
                        <label className="rlt-sub" style={{ display: 'block', margin: '8px 0' }}>
                            <input type="checkbox" checked={hide} disabled={!!check.hideRefusal || busy} onChange={e => setHide(e.target.checked)} />{' '}
                            {hideScope === 'all' ? 'ファイルに無い行' : '以前のアプリで消えた行'}（{check.hide} 件）を非表示にする（行は消さないので戻せます）
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
