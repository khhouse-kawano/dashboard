import React, { useCallback, useEffect, useState } from 'react';
import { post } from '../common/realtyState';
import { parseCsv } from './RealtyLogImport';

/**
 * いえらぶの物件一覧（CSV）を取り込む（不動産企画係の「設定・データ管理」。v2.2.260）。
 *
 * ─────────────────────────────────────────────
 *   ⚠️ 以前は sync（Heroku）の runIeloveProperty.ts が毎日自動で取っていた。
 *     2026-11 に、いえらぶの2段階認証（メール）が義務になり、Heroku からのログインも 403 で拒否されるようになったので、
 *     担当者が いえらぶの「売買物件一覧」から「一覧をダウンロード → CSV」で落としたファイル（sale_YYYYMMDD.csv）を上げる形にした。
 *   ⚠️ ファイルは Shift_JIS。⚠️ 数字の列は ="0123" の形（Excel のゼロ落ち防止）なので = を外して読む（sync と同じ）。
 *   ⚠️ 見出し → 列名の対応は、sync の runIeloveProperty.ts の propertyHeaderMap と同じ（⚠️ 片方だけ変えない）。
 *     「オリジナル項目1〜99」は取り込まない。
 *   ⚠️ 複数のファイル（店舗ごとに落としたもの）をまとめて選べる。同じ物件番号は後のファイルを使う。
 *   ② の planner:ielove_import（features/realty/ieloveImport.ts）。先に dryRun で件数を見せ、「取り込む」で書く。
 *   取り込み終えると、② が媒介獲得台帳・買い反響との突き合わせ（v2.2.258）を動かす。
 * ─────────────────────────────────────────────
 */

const HEADER_MAP: Record<string, string> = {
    '物件番号': 'property_id',
    '管理コード': 'management_code',
    '担当店舗名': 'store_name',
    '物件担当者': 'property_staff',
    '取引態様': 'transaction_type',
    '物件種別': 'property_type',
    '所在地': 'address',
    '物件名': 'property_name',
    '空き物件内容（部屋番号）': 'room_number',
    '土地面積': 'land_area',
    '建物面積': 'building_area',
    '間取り': 'layout',
    '築年数': 'building_age',
    '価格': 'price',
    '表面利回り': 'gross_yield',
    '交通1': 'transportation',
    '取扱業者': 'agency',
    '担当者': 'staff_in_charge',
    '電話番号': 'tel',
    '活動報告日': 'report_date',
    '活動報告予定日': 'next_report_date',
    '想定利回り': 'expected_yield',
    '総戸数・総区画数': 'total_units',
    '建物構造': 'structure',
    '用途地域': 'zoning',
    '用途地域2': 'zoning_2',
    '売主': 'seller',
    '所有者': 'owner',
    '価格(単位なし)': 'price_raw',
    '実需・投資': 'investment_type',
    '掲載期限': 'expiry_date',
    '物件掲載指示': 'publishing_instruction',
    '社内用メモ１': 'internal_note',
};
/** 無ければ、いえらぶの物件一覧の CSV ではないとみなす見出し */
const NEED = ['物件番号', '担当店舗名', '所在地', '物件種別'];
const BATCH = 200;

type Mapped = Record<string, string>;
type Summary = { total: number; invalid: number; inserted: number; updated: number; priceChanged: number; stores: Record<string, number> };
type Loaded = { names: string[]; rows: Mapped[]; preview: Summary };

/** Shift_JIS（いえらぶ）で読む。⚠️ UTF-8 で保存し直したファイルも読めるように、UTF-8 として正しければ UTF-8 */
const decode = (buf: ArrayBuffer): string => {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('shift_jis').decode(buf); }
};

/** 1ファイルを読み、列名を英語にした行にする。⚠️ いえらぶの CSV でなければ例外 */
const readFile = async (file: File): Promise<Mapped[]> => {
    const text = decode(await file.arrayBuffer()).replace(/="/g, '"');
    const rows = parseCsv(text);
    if (!rows.length) throw new Error(`${file.name}：行がありません`);
    const missing = NEED.filter(h => !(h in rows[0]));
    if (missing.length) throw new Error(`${file.name}：いえらぶの物件一覧の CSV ではないようです（${missing.join('・')} の列がありません）`);
    return rows.map(r => {
        const m: Mapped = {};
        for (const [ja, en] of Object.entries(HEADER_MAP)) if (ja in r) m[en] = r[ja];
        return m;
    });
};

const add = (a: Summary, d: Record<string, unknown>): Summary => {
    const stores = { ...a.stores };
    for (const [k, v] of Object.entries((d.stores as Record<string, number>) ?? {})) stores[k] = (stores[k] ?? 0) + Number(v);
    return {
        total: a.total + (Number(d.total) || 0),
        invalid: a.invalid + (Number(d.invalid) || 0),
        inserted: a.inserted + (Number(d.inserted) || 0),
        updated: a.updated + (Number(d.updated) || 0),
        priceChanged: a.priceChanged + (Number(d.priceChanged) || 0),
        stores,
    };
};
const EMPTY: Summary = { total: 0, invalid: 0, inserted: 0, updated: 0, priceChanged: 0, stores: {} };

/** 200行ずつ ② へ送る。⚠️ ① を通ると {} が [] になるため、1行ずつ JSON の文字列で送る */
const send = async (rows: Mapped[], dryRun: boolean, onProgress?: (done: number) => void) => {
    let sum = EMPTY;
    let matched: { ledgers: number; buyLeads: number } | null = null;
    for (let i = 0; i < rows.length; i += BATCH) {
        const last = i + BATCH >= rows.length;
        const d = await post('ielove_import', { rows: rows.slice(i, i + BATCH).map(r => JSON.stringify(r)), dryRun, finish: last });
        sum = add(sum, d);
        if (d.matched) matched = d.matched as { ledgers: number; buyLeads: number };
        onProgress?.(Math.min(i + BATCH, rows.length));
    }
    return { sum, matched };
};

const storeList = (s: Summary) => Object.entries(s.stores).map(([k, v]) => `${k.replace(/\s+/g, ' ')} ${v}件`).join('／');

const RealtyIeloveImport: React.FC = () => {
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<{ sum: Summary; matched: { ledgers: number; buyLeads: number } | null } | null>(null);
    const [status, setStatus] = useState<{ total: number; usedStore: number; lastRegistered: string | null } | null>(null);

    const loadStatus = useCallback(() => {
        post('ielove_import_status')
            .then(d => setStatus({ total: Number(d.total) || 0, usedStore: Number(d.usedStore) || 0, lastRegistered: (d.lastRegistered as string) || null }))
            .catch(e => console.error('[RealtyIeloveImport] 件数を読めませんでした', e));
    }, []);
    useEffect(() => { loadStatus(); }, [loadStatus]);

    const onFiles = async (files: File[]) => {
        setLoaded(null);
        setResult(null);
        if (!files.length) return;
        setBusy(true);
        setProgress('読み込み中…');
        try {
            // ⚠️ 同じ物件番号は後のファイルを使う（② でも同じ）
            const byId = new Map<string, Mapped>();
            for (const f of files) for (const r of await readFile(f)) byId.set(r.property_id ?? `?${byId.size}`, r);
            const rows = [...byId.values()];
            const { sum } = await send(rows, true);
            setLoaded({ names: files.map(f => f.name), rows, preview: sum });
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    const run = async () => {
        if (!loaded) return;
        const p = loaded.preview;
        if (!window.confirm(`いえらぶの物件を取り込みます。\n新しい物件 ${p.inserted}件・更新 ${p.updated}件（うち価格の変更 ${p.priceChanged}件）\nよろしいですか？`)) return;
        setBusy(true);
        try {
            const r = await send(loaded.rows, false, done => setProgress(`${done.toLocaleString()} / ${loaded.rows.length.toLocaleString()} 件`));
            setResult(r);
            setLoaded(null);
            loadStatus();
        } catch (e) {
            alert(`途中で止まりました。もう一度同じファイルを取り込むと、続きから入ります（同じ物件は上書きです）: ${(e as Error).message}`);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>いえらぶの物件一覧を取り込む（CSV）</h3>
                <span className="rlt-note">
                    いえらぶの2段階認証の義務化で、自動の取り込みができなくなったため、ここから取り込みます
                    {status && `（いま ${status.total.toLocaleString()} 件・うち中古住宅専門店 ${status.usedStore.toLocaleString()} 件／最後に取り込んだ日 ${status.lastRegistered ?? 'なし'}）`}
                </span>
            </div>
            <div className="rlt-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ol className="rlt-sub" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    <li>いえらぶ cloud の「売買物件一覧」を、店舗ごとに開く</li>
                    <li>「一覧をダウンロード」→「CSV 形式でダウンロード」で、ファイル（sale_日付.csv）を保存する</li>
                    <li>下でファイルを選ぶ（店舗ごとの複数のファイルを、まとめて選べます）→ 件数を確かめて「取り込む」</li>
                </ol>
                {/* ⚠️ 選んだら空に戻す（同じファイルを選び直しても読み直すように） */}
                <input type="file" accept=".csv,text/csv" multiple disabled={busy} aria-label="いえらぶの物件一覧の CSV"
                    onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void onFiles(fs); }} />
                {progress && <span className="rlt-note">{progress}</span>}
                {loaded && (
                    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                        <div>{loaded.names.join('・')}：<b>{loaded.rows.length.toLocaleString()} 件</b>（{storeList(loaded.preview)}）</div>
                        <div>
                            新しい物件 <b>{loaded.preview.inserted}</b> 件・更新 <b>{loaded.preview.updated}</b> 件（うち価格の変更 {loaded.preview.priceChanged} 件）
                            {loaded.preview.invalid > 0 && <span style={{ color: '#dc3545' }}>・物件番号が読めない行 {loaded.preview.invalid} 件（取り込みません）</span>}
                        </div>
                        <button className="rlt-btn" disabled={busy || loaded.preview.inserted + loaded.preview.updated === 0} onClick={() => void run()}>取り込む</button>
                    </div>
                )}
                {result && (
                    <div className="rlt-saved">
                        取り込みました：新しい物件 {result.sum.inserted} 件・更新 {result.sum.updated} 件（うち価格の変更 {result.sum.priceChanged} 件）。
                        {result.matched
                            ? `媒介獲得台帳 ${result.matched.ledgers} 件・買い反響 ${result.matched.buyLeads} 件が、新しくいえらぶの物件につながりました。`
                            : '台帳との突き合わせは、30分以内に自動で動きます。'}
                    </div>
                )}
                <p className="rlt-sub">
                    同じ物件番号の物件は上書きします（価格が変わったときは、価格の履歴に残ります）。いえらぶに無くなった物件は消しません。
                </p>
            </div>
        </div>
    );
};

export default RealtyIeloveImport;
