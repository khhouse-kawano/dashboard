import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';

/**
 * ローン情報更新（v2.2.168 新規）。ヘッダーの「システム管理 → ローン情報更新」から開く。
 *
 * ─────────────────────────────────────────────
 *   Claude Desktop で調べた住宅ローン金利の CSV をアップロードし、loan_rate に登録・確定する。
 *   ⚠️ 登録＝確定（2026-10-06 の決定）。⚠️ 押した人が確定者として記録される。
 *
 *   ⚠️ ⚠️ **Master だけ**（⚠️ メニューも Master だけに出す。⚠️ ② も auth: 'master'）。
 *   ⚠️ 顧客の計画書（funding_plan.loans）は変わらない。⚠️ 変わるのは「これから作る計画書」の金利。
 *
 *   ② : backend-express/src/features/loanRate.ts（loan_rate_latest / loan_rate_upload）
 *   テンプレート: frontend/public/templates/loan_rate_template.csv
 * ─────────────────────────────────────────────
 *
 * ⚠️ 自前のモーダルを持つ（⚠️ Header の共通モーダル（xl）には載せない。二重になる）。
 * ⚠️ 大きさは react-bootstrap の既定（＝ md）。⚠️ `size` に 'md' は渡せない（型が sm / lg / xl のみ）。
 */

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

/** ② の loan_rate_latest が返す1商品（⚠️ 差分の表示に使う列だけ） */
type LatestLoan = {
    id: string;
    fi: string;
    pn: string;
    rate: number;
};

type RowError = { line: number; message: string };

/** ⚠️ 必須の見出し。⚠️ 足りなければ CSV ごと受け付けない */
const REQUIRED_COLUMNS = ['id', 'fi', 'pn', 'rate'];

const ID_PATTERN = /^[a-z0-9_]{1,64}$/;

const templateUrl = (file: string) => `${process.env.PUBLIC_URL}/templates/${file}`;

/** 今日（ローカル時刻）を YYYY-MM-DD で */
const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 数値に。⚠️ % や カンマ が付いていても読む（② と同じ扱い） */
const toNumber = (value: string | undefined): number | null => {
    const s = String(value ?? '').replace(/[,%％\s]/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

/**
 * 1行の検査。⚠️ ② の validateRow と同じ条件（⚠️ ② でも必ず検査する。ここは事前の案内用）。
 */
const validateRecord = (r: Record<string, string>): string | null => {
    if (!ID_PATTERN.test(r.id ?? '')) return `id が正しくありません（英小文字・数字・_ のみ）: ${r.id || '（空）'}`;
    if (!r.fi) return '金融機関名（fi）が空です';
    if (!r.pn) return '商品名（pn）が空です';
    if (r.type && r.type !== 'v' && r.type !== 'f') return `type は v（変動）か f（固定）です: ${r.type}`;
    const rate = toNumber(r.rate);
    if (rate === null || rate <= 0 || rate >= 20) return `金利（rate）が正しくありません: ${r.rate ?? ''}`;
    if (r.feeMode && r.feeMode !== 'rate' && r.feeMode !== 'fixed') return `feeMode は rate か fixed です: ${r.feeMode}`;
    const feeVal = toNumber(r.feeVal) ?? 0;
    if (feeVal < 0) return `feeVal が負の値です: ${r.feeVal}`;
    if (r.feeMode === 'rate' && feeVal >= 10) return `feeMode=rate のとき feeVal は % です（10未満）: ${r.feeVal}`;
    if ((toNumber(r.hoshoVal) ?? 0) < 0) return `hoshoVal が負の値です: ${r.hoshoVal}`;
    return null;
};

const UploadLoan = ({ show, setShow }: Props) => {
    const [baseDate, setBaseDate] = useState(today);
    const [latest, setLatest] = useState<LatestLoan[]>([]);
    const [latestAsof, setLatestAsof] = useState('');
    const [fileName, setFileName] = useState('');
    const [records, setRecords] = useState<Record<string, string>[]>([]);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [fileError, setFileError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const loadLatest = useCallback(async () => {
        try {
            const res = await apiClient.post('', { request: 'loan_rate_latest' });
            setLatest(res.data?.loans ?? []);
            setLatestAsof(res.data?.asof ?? '');
        } catch (error) {
            // ⚠️ 取れなくても登録はできる（⚠️ 差分が「新規」に見えるだけ）
            console.error('現在の金利の取得に失敗しました:', error);
        }
    }, []);

    // ⚠️ 開くたびに初期化する（⚠️ 前回のファイルが残っていると、誤って同じ内容を登録しかねない）
    useEffect(() => {
        if (!show) return;
        setBaseDate(today());
        setFileName('');
        setRecords([]);
        setErrors([]);
        setFileError('');
        setResult(null);
        loadLatest();
    }, [show, loadLatest]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // ⚠️ 同じファイルを選び直しても onChange が走るように空にする
        e.target.value = '';
        if (!file) return;

        setFileName(file.name);
        setRecords([]);
        setErrors([]);
        setFileError('');
        setResult(null);

        try {
            const { header, records: parsed } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) {
                setFileError(`見出しに ${missing.join('・')} がありません。テンプレートの1行目をそのまま使ってください。`);
                return;
            }
            if (parsed.length === 0) {
                setFileError('商品の行がありません。');
                return;
            }

            const found: RowError[] = [];
            const seen = new Set<string>();
            parsed.forEach((r, i) => {
                const line = i + 2;
                const message = validateRecord(r);
                if (message) found.push({ line, message });
                else if (seen.has(r.id)) found.push({ line, message: `id が重複しています: ${r.id}` });
                seen.add(r.id);
            });
            setRecords(parsed);
            setErrors(found);
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
        }
    };

    /** 今の金利との差（⚠️ 新規・金利が変わった・変わらない） */
    const diff = useMemo(() => {
        const byId = new Map(latest.map((l) => [l.id, l]));
        const added: Record<string, string>[] = [];
        const changed: { fi: string; pn: string; from: number; to: number }[] = [];
        let same = 0;
        records.forEach((r) => {
            const now = byId.get(r.id);
            const rate = toNumber(r.rate);
            if (!now) added.push(r);
            else if (rate !== null && Math.abs(rate - now.rate) > 1e-9) changed.push({ fi: r.fi, pn: r.pn, from: now.rate, to: rate });
            else same++;
        });
        return { added, changed, same };
    }, [records, latest]);

    const canSubmit = records.length > 0 && errors.length === 0 && !fileError && !!baseDate && !submitting;

    const submit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setResult(null);
        try {
            const res = await apiClient.post('', { request: 'loan_rate_upload', base_date: baseDate, rows: records });
            const data = res.data ?? {};
            if (data.status === 'ok') {
                setResult({ ok: true, message: `${data.rates}件の金利を登録しました（新しい商品 ${data.newProducts}件）。これから作る計画書に反映されます。` });
                setRecords([]);
                setFileName('');
                loadLatest();
            } else {
                setResult({ ok: false, message: data.message || '登録できませんでした。' });
                if (Array.isArray(data.errors)) setErrors(data.errors);
            }
        } catch (error) {
            console.error('金利の登録に失敗しました:', error);
            setResult({ ok: false, message: '登録できませんでした。時間をおいて再度お試しください。' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '15px' }} className="fw-bold">
                    <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
                    ローン情報更新
                </Modal.Title>
            </Modal.Header>

            <Modal.Body style={{ fontSize: '13px' }}>
                <div className="text-muted mb-3" style={{ fontSize: '12px' }}>
                    現在の金利の基準日: <b>{latestAsof || '－'}</b>（{latest.length}商品）
                    <div className="mt-1 d-flex flex-wrap gap-3">
                        <a href={templateUrl('loan_rate_template.csv')} download>
                            <i className="fa-solid fa-file-csv me-1" aria-hidden="true" />テンプレート（CSV）
                        </a>
                        <a href={templateUrl('loan_rate_instructions.md')} download>
                            <i className="fa-solid fa-file-lines me-1" aria-hidden="true" />Claude への依頼文
                        </a>
                    </div>
                </div>

                <div className="mb-2">
                    <label className="form-label mb-1 fw-bold" htmlFor="loan_base_date" style={{ fontSize: '12px' }}>基準日</label>
                    <input
                        id="loan_base_date"
                        type="date"
                        className="form-control form-control-sm"
                        value={baseDate}
                        onChange={(e) => setBaseDate(e.target.value)}
                    />
                </div>

                <div className="mb-3">
                    <label className="form-label mb-1 fw-bold" htmlFor="loan_csv" style={{ fontSize: '12px' }}>CSV ファイル</label>
                    <input id="loan_csv" type="file" accept=".csv,text/csv" className="form-control form-control-sm" onChange={handleFile} />
                </div>

                {fileError && <div className="alert alert-danger py-2 mb-2">{fileError}</div>}

                {records.length > 0 && (
                    <div className="border rounded p-2 mb-2" style={{ background: '#f8f9fa' }}>
                        <div className="mb-1">
                            <b>{fileName}</b>：{records.length}商品
                            <span className="ms-2 text-muted">
                                新規 {diff.added.length} ／ 金利変更 {diff.changed.length} ／ 変更なし {diff.same}
                            </span>
                        </div>
                        {diff.changed.length > 0 && (
                            <ul className="mb-1 ps-3" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                {diff.changed.map((c) => (
                                    <li key={`${c.fi}/${c.pn}`}>
                                        {c.fi}　{c.from}% → <b className={c.to > c.from ? 'text-danger' : 'text-primary'}>{c.to}%</b>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {diff.added.length > 0 && (
                            <div className="text-muted">新規: {diff.added.map((a) => a.fi).join('、')}</div>
                        )}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="alert alert-danger py-2 mb-2">
                        <div className="fw-bold mb-1">{errors.length}行に誤りがあります（直してから選び直してください）</div>
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
                <button type="button" className="btn btn-sm btn-primary" disabled={!canSubmit} onClick={submit}>
                    {submitting ? '登録中…' : '登録して確定'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default UploadLoan;
