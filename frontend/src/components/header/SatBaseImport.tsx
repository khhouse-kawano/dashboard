import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { decodeCsv, parseCsv } from '../../utils/csv';

/**
 * 物件更新（v2.2.170 新規）。SatBaseサマリー（SatBaseDatabase.tsx）の「物件更新」から開く。
 *
 * ─────────────────────────────────────────────
 *   SatBase の「KHF物件管理【KHG】 - 中間加工（物件）」の CSV で satbase_property を更新する。
 *   ⚠️ 物件ID で突き合わせ、⚠️ **あれば更新・無ければ追加**。⚠️ CSV に無い物件は消さない。
 *   ⚠️ 空欄は空で上書き（⚠️ SatBase 側が正）。⚠️ 広告出稿・Instagram のトグルは変わらない。
 *
 *   ⚠️ ⚠️ **Master だけ**（⚠️ ボタンも Master だけに出す。⚠️ ② も auth: 'master'）。
 *
 *   ⚠️ 流れ: ファイルを選ぶ → ⚠️ ② に `dryRun: true` で送って件数を受け取る（⚠️ 書かない）
 *           → 「更新する」で ⚠️ 同じ行をもう一度送って反映。
 *
 *   ② : backend-express/src/features/satbase.ts（satbase_import）
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **見出し行は付くときと付かないときがある**（9/29 の出力は付き、10/7 は無し）。
 *   ⚠️ 1行目の先頭が数字でなければ見出しとみなして飛ばす。⚠️ 列は位置で読む（② の IMPORT_COLUMNS）。
 *
 * ⚠️ 大きさは react-bootstrap の既定（＝ md）。
 */

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
    /** ⚠️ 反映したあと一覧を取り直す（⚠️ SatBaseDatabase.tsx が渡す） */
    onImported: () => void;
};

type RowError = { line: number; message: string };

type Summary = {
    total: number;
    inserted: number;
    updated: number;
    unchanged: number;
    changedColumns: { label: string; count: number }[];
};

/** ⚠️ SatBase の出力の列数（⚠️ ② の IMPORT_COLUMNS と同じ） */
const COLUMN_COUNT = 38;

const SatBaseImport = ({ show, setShow, onImported }: Props) => {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<string[][]>([]);
    const [lines, setLines] = useState<number[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [fileError, setFileError] = useState('');
    const [busy, setBusy] = useState<'' | 'check' | 'apply'>('');
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    // ⚠️ 開くたびに初期化する（⚠️ 前回のファイルが残っていると、誤って同じ内容を反映しかねない）
    useEffect(() => {
        if (!show) return;
        setFileName('');
        setRows([]);
        setLines([]);
        setSummary(null);
        setErrors([]);
        setFileError('');
        setResult(null);
    }, [show]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // ⚠️ 同じファイルを選び直しても onChange が走るように空にする
        e.target.value = '';
        if (!file) return;

        setFileName(file.name);
        setRows([]);
        setLines([]);
        setSummary(null);
        setErrors([]);
        setFileError('');
        setResult(null);

        let parsed: string[][];
        try {
            parsed = parseCsv(decodeCsv(await file.arrayBuffer()));
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
            return;
        }

        // ⚠️ 1行目の先頭が数字でなければ見出し
        const hasHeader = parsed.length > 0 && !/^\d+$/.test(String(parsed[0][0] ?? '').trim());
        const data = hasHeader ? parsed.slice(1) : parsed;
        if (data.length === 0) {
            setFileError('物件の行がありません。');
            return;
        }
        if (data[0].length !== COLUMN_COUNT) {
            setFileError(`列の数が ${data[0].length} です（SatBase の出力は ${COLUMN_COUNT} 列）。SatBase から出力した CSV をそのまま選んでください。`);
            return;
        }
        // ⚠️ 行番号は見出しを含めて数える（⚠️ Excel で開いたときの行番号に合わせる。⚠️ 空行は数えていない）
        const lineNumbers = data.map((_, i) => i + (hasHeader ? 2 : 1));
        setRows(data);
        setLines(lineNumbers);

        // ⚠️ 確認（⚠️ 書かない）
        setBusy('check');
        try {
            const res = await apiClient.post('', { request: 'satbase_import', rows: data, lines: lineNumbers, dryRun: true });
            const body = res.data ?? {};
            if (body.status === 'ok') {
                setSummary(body as Summary);
            } else {
                setFileError(body.message || '確認できませんでした。');
                if (Array.isArray(body.errors)) setErrors(body.errors);
                setRows([]);
            }
        } catch (error) {
            console.error('物件更新の確認に失敗しました:', error);
            setFileError('確認できませんでした。時間をおいて再度お試しください。');
            setRows([]);
        } finally {
            setBusy('');
        }
    };

    const changes = summary ? summary.inserted + summary.updated : 0;
    const canApply = summary !== null && changes > 0 && rows.length > 0 && busy === '';

    const apply = async () => {
        if (!canApply) return;
        setBusy('apply');
        setResult(null);
        try {
            const res = await apiClient.post('', { request: 'satbase_import', rows, lines, dryRun: false });
            const body = res.data ?? {};
            if (body.status === 'ok') {
                setResult({ ok: true, message: `更新 ${body.updated}件・追加 ${body.inserted}件を反映しました。` });
                setRows([]);
                setSummary(null);
                setFileName('');
                onImported();
            } else {
                setResult({ ok: false, message: body.message || '反映できませんでした。' });
                if (Array.isArray(body.errors)) setErrors(body.errors);
            }
        } catch (error) {
            console.error('物件更新に失敗しました:', error);
            setResult({ ok: false, message: '反映できませんでした。時間をおいて再度お試しください。' });
        } finally {
            setBusy('');
        }
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '15px' }} className="fw-bold">
                    <i className="fa-solid fa-file-csv me-2 text-primary" aria-hidden="true" />
                    物件更新
                </Modal.Title>
            </Modal.Header>

            <Modal.Body style={{ fontSize: '13px' }}>
                <div className="text-muted mb-3" style={{ fontSize: '12px' }}>
                    SatBase から出力した「中間加工（物件）」の CSV を選んでください。物件ID で突き合わせて、
                    登録済みの物件は更新、まだ無い物件は追加します。CSV に無い物件はそのまま残ります。
                    空欄の項目は空で上書きされます。広告出稿・Instagram の状況は変わりません。
                </div>

                <div className="mb-3">
                    <label className="form-label mb-1 fw-bold" htmlFor="satbase_csv" style={{ fontSize: '12px' }}>CSV ファイル</label>
                    <input
                        id="satbase_csv"
                        type="file"
                        accept=".csv,text/csv"
                        className="form-control form-control-sm"
                        onChange={handleFile}
                        disabled={busy !== ''}
                    />
                </div>

                {busy === 'check' && <div className="text-muted mb-2">内容を確認しています…</div>}

                {fileError && <div className="alert alert-danger py-2 mb-2">{fileError}</div>}

                {summary && (
                    <div className="border rounded p-2 mb-2" style={{ background: '#f8f9fa' }}>
                        <div className="mb-1">
                            <b>{fileName}</b>：{summary.total.toLocaleString()}件
                        </div>
                        <div className="mb-1">
                            更新 <b>{summary.updated.toLocaleString()}</b>件 ／ 追加 <b>{summary.inserted.toLocaleString()}</b>件 ／
                            <span className="text-muted"> 変更なし {summary.unchanged.toLocaleString()}件</span>
                        </div>
                        {summary.changedColumns.length > 0 && (
                            <div className="text-muted" style={{ fontSize: '12px' }}>
                                変わる項目: {summary.changedColumns.map((c) => `${c.label}（${c.count}）`).join('、')}
                            </div>
                        )}
                        {changes === 0 && <div className="text-muted mt-1">反映する変更はありません。</div>}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="alert alert-danger py-2 mb-2">
                        <div className="fw-bold mb-1">誤りのある行（直してから選び直してください）</div>
                        <ul className="mb-0 ps-3" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                            {errors.map((e) => <li key={`${e.line}/${e.message}`}>{e.line}行目: {e.message}</li>)}
                        </ul>
                    </div>
                )}

                {result && (
                    <div className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} py-2 mb-0`}>{result.message}</div>
                )}
            </Modal.Body>

            <Modal.Footer className="py-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShow(false)}>閉じる</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={apply}>
                    {busy === 'apply' ? '更新中…' : '更新する'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default SatBaseImport;
