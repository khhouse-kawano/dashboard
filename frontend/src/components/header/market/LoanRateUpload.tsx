import React, { useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../../utils/csv';

/**
 * 金利データの月の登録（v2.2.240。⚠️ Master だけ。LoanRates.tsx の上部に出す）。
 *
 * ⚠️ 1回で「プラン別金利の CSV（plan_rates_YYYY-MM.csv）」と「分析レポートの HTML（rate_analysis_YYYY-MM.html）」を登録できる。どちらか片方だけでもよい。
 *   CSV  → loan_plan_rate_upload（⚠️ その月を丸ごと入れ替える。features/loanPlanRate.ts）
 *   HTML → analysis_report_upload（reportCategory = 'loan_rate'・period = 月。features/analysis/report.ts）
 * ⚠️ 対象月はファイル名の YYYY-MM から自動で入れる（直せる）。
 * ⚠️ CSV は画面でも検査し、誤りがあれば送らない（② でも同じ検査をする）。
 */

const REQUIRED_COLUMNS = ['g', 'id', 'fi', 'plan', 'rtype', 'term', 'feeType', 'dan', 'cond', 'rate', 'base', 'prev', 'asof', 'url', 'conf'];
/** analysis_report の上限（② の MAX_HTML_BYTES と同じ） */
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MONTH_IN_NAME = /(\d{4})-(0[1-9]|1[0-2])/;

type RowError = { line: number; message: string };
type Props = { onSaved: (month: string) => void };

const isRate = (v: string): boolean => v === '' || (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0 && Number(v) < 20);

const validate = (r: Record<string, string>): string => {
    if (!r.fi) return '金融機関名（fi）が空です';
    if (!r.plan) return 'プラン名（plan）が空です';
    const bad = (['rate', 'base', 'prev'] as const).find((c) => !isRate(r[c] ?? ''));
    return bad ? `${bad} が正しくありません: ${r[bad]}` : '';
};

/** 対象月の表記（2026-11 → 2026年11月） */
export const monthLabel = (month: string): string => {
    const [y, m] = month.split('-');
    return m ? `${y}年${Number(m)}月` : month;
};

const LoanRateUpload: React.FC<Props> = ({ onSaved }) => {
    const [month, setMonth] = useState('');
    const [csvName, setCsvName] = useState('');
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [html, setHtml] = useState('');
    const [htmlName, setHtmlName] = useState('');
    const [fileError, setFileError] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const guessMonth = (name: string) => {
        const m = MONTH_IN_NAME.exec(name);
        if (m && month === '') setMonth(`${m[1]}-${m[2]}`);
    };

    const pickCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setCsvName(file.name);
        setRows([]);
        setErrors([]);
        setFileError('');
        setResult(null);
        guessMonth(file.name);
        try {
            const { header, records } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) { setFileError(`CSV の見出しに ${missing.join('・')} がありません。plan_rates の CSV を選んでください。`); return; }
            if (records.length === 0) { setFileError('CSV にプランの行がありません。'); return; }
            setRows(records);
            setErrors(records.map((r, i) => ({ line: i + 2, message: validate(r) })).filter((x) => x.message !== ''));
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
        }
    };

    const pickHtml = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setHtml('');
        setHtmlName(file.name);
        setFileError('');
        setResult(null);
        guessMonth(file.name);
        if (file.size > MAX_HTML_BYTES) { setFileError(`HTML が大きすぎます（上限 ${MAX_HTML_BYTES / 1024 / 1024}MB）。`); return; }
        setHtml(await file.text());
    };

    const canSubmit = /^\d{4}-\d{2}$/.test(month) && (rows.length > 0 || html !== '') && errors.length === 0 && fileError === '' && !busy;

    const submit = async () => {
        if (!canSubmit) return;
        if (rows.length > 0 && !window.confirm(`${monthLabel(month)}のプラン別金利を、選んだ CSV（${rows.length}行）で入れ替えます。よろしいですか？`)) return;
        setBusy(true);
        setResult(null);
        const done: string[] = [];
        try {
            if (rows.length > 0) {
                const res = await apiClient.post('', { request: 'loan_plan_rate_upload', month, rows });
                const data = res.data ?? {};
                if (data.status !== 'ok') {
                    const detail = Array.isArray(data.errors) ? data.errors.slice(0, 5).map((x: RowError) => `${x.line}行目: ${x.message}`).join(' / ') : '';
                    throw new Error(`${data.message ?? 'CSV を登録できませんでした。'}${detail ? `（${detail}）` : ''}`);
                }
                done.push(`プラン別金利 ${data.rows}行`);
            }
            if (html !== '') {
                const res = await apiClient.post('', {
                    request: 'analysis_report_upload', title: `九州の住宅ローン金利 ${monthLabel(month)}`,
                    // ⚠️ data_as_of は DATE 列（'YYYY-MM' は入らない）。⚠️ 月の初日にする
                    reportCategory: 'loan_rate', period: month, html, dataAsOf: `${month}-01`,
                });
                if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? 'レポートを登録できませんでした。');
                done.push('分析レポート');
            }
            setResult({ ok: true, message: `${monthLabel(month)}の${done.join('と')}を登録しました。` });
            setRows([]); setCsvName(''); setHtml(''); setHtmlName('');
            onSaved(month);
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error as Error).message;
            setResult({ ok: false, message: `${done.length > 0 ? `${done.join('と')}は登録済みです。` : ''}${message}` });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="lr_upload mb-3">
            <div className="lr_upload_head">
                <span className="lr_upload_title"><i className="fa-solid fa-upload me-1" aria-hidden="true" />月のデータを登録</span>
                <span className="lr_badge">Master のみ</span>
                <span className="lr_note">Claude デスクトップが作った plan_rates_YYYY-MM.csv と rate_analysis_YYYY-MM.html を選んでください（片方だけでも登録できます）</span>
            </div>
            <div className="lr_upload_row">
                <label className="lr_field">
                    <span className="lr_label">対象月</span>
                    <input type="month" className="form-control form-control-sm" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 150 }} />
                </label>
                <label className="lr_field">
                    <span className="lr_label">プラン別金利（CSV）</span>
                    <input type="file" accept=".csv,text/csv" className="form-control form-control-sm" onChange={(e) => void pickCsv(e)} style={{ width: 260 }} />
                </label>
                <label className="lr_field">
                    <span className="lr_label">分析レポート（HTML）</span>
                    <input type="file" accept=".html,text/html" className="form-control form-control-sm" onChange={(e) => void pickHtml(e)} style={{ width: 260 }} />
                </label>
                <button type="button" className="btn btn-sm lr_btn" disabled={!canSubmit} onClick={() => void submit()}>
                    {busy ? '登録しています…' : '登録'}
                </button>
            </div>
            {(csvName || htmlName) && (
                <div className="lr_note mt-1">
                    {csvName && <>CSV：{csvName}（{rows.length}行{errors.length > 0 ? `・誤り ${errors.length}行` : ''}）　</>}
                    {htmlName && <>HTML：{htmlName}{html ? `（${Math.round(new Blob([html]).size / 1024)}KB）` : ''}</>}
                </div>
            )}
            {fileError && <div className="lr_error mt-1">{fileError}</div>}
            {errors.length > 0 && (
                <div className="lr_error mt-1">
                    誤りのある行があるため登録できません：{errors.slice(0, 5).map((x) => `${x.line}行目 ${x.message}`).join(' / ')}{errors.length > 5 ? ` ほか${errors.length - 5}行` : ''}
                </div>
            )}
            {result && <div className={`mt-1 ${result.ok ? 'lr_ok' : 'lr_error'}`} role="status">{result.message}</div>}
        </div>
    );
};

export default LoanRateUpload;
