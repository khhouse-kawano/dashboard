import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { errorMessageOf } from './sharedReport';

/**
 * 共有したレポートを見る画面（v2.2.268 新規）。URL は `/report?k=<共有キー>`。
 *
 * ─────────────────────────────────────────────
 * ⚠️ App.tsx で `/report` のときだけヘッダー・メニュー・アクティブユーザー・要確認を出さない（業務ガイドと同じ）。
 * ⚠️ ログインの確認は AuthProvider が行う。未ログインならログイン画面へ移り、ログイン後にこの URL へ戻る。
 *   ⚠️ ② の shared_report_get も auth: 'staff' でトークンを毎回確かめる（URL を知っているだけでは見られない）。
 * ⚠️⚠️ レポートは iframe（sandbox="allow-scripts" だけ）の中で表示する。ClaudeAnalysis.tsx と同じ。
 *   ⚠️ allow-same-origin を足さないこと。足すとレポートのスクリプトから localStorage のトークンが読める。
 * ─────────────────────────────────────────────
 */

interface Report {
    title: string;
    staffName: string;
    createdAt: string;
    source: string;
    html: string;
}

const safeFileName = (value: string): string =>
    value.replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'レポート';

const download = (report: Report): void => {
    const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(report.title)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SharedReportView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const key = searchParams.get('k') ?? '';
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setReport(null);
        setError('');
        if (key === '') {
            setError('URL に共有キーがありません。共有されたURLをそのまま開いてください。');
            return;
        }
        (async () => {
            try {
                const res = await apiClient.post('', { request: 'shared_report_get', key });
                if (cancelled) return;
                if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '');
                setReport(res.data as Report);
            } catch (e) {
                if (!cancelled) setError(errorMessageOf(e, 'レポートを読み込めませんでした。時間をおいて開き直してください。'));
            }
        })();
        return () => { cancelled = true; };
    }, [key]);

    useEffect(() => {
        document.title = report ? `${report.title}｜Dashboard` : 'レポート｜Dashboard';
    }, [report]);

    return (
        <div className="srv_wrap">
            <style>{`
                .srv_wrap { position: fixed; inset: 0; display: flex; flex-direction: column; background: #f8fafc;
                            font-size: 13px; color: #1f2937; }
                .srv_bar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 14px;
                           background: #fff; border-bottom: 1px solid #e5e7eb; }
                .srv_title { font-weight: 700; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .srv_meta { font-size: 11px; color: #6b7280; white-space: nowrap; }
                .srv_btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #cbd5e1; background: #fff;
                           color: #334155; border-radius: 6px; font-size: 11.5px; font-weight: 700; padding: 3px 10px; cursor: pointer;
                           text-decoration: none; white-space: nowrap; }
                .srv_btn:hover { background: #f1f5f9; }
                .srv_btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
                .srv_frame { flex: 1 1 auto; width: 100%; border: 0; background: #fff; }
                .srv_msg { margin: 64px auto; max-width: 520px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
                           padding: 24px; line-height: 1.9; text-align: center; }
                .srv_msg.is_error { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
            `}</style>

            <div className="srv_bar">
                <i className="fa-solid fa-share-nodes" style={{ color: '#64748b' }} aria-hidden="true" />
                <span className="srv_title">{report?.title ?? '共有されたレポート'}</span>
                {report && <span className="srv_meta">{report.staffName}・{report.createdAt.slice(0, 16)} に共有</span>}
                <span className="ms-auto d-flex gap-2">
                    {report && (
                        <button type="button" className="srv_btn" onClick={() => download(report)}>
                            <i className="fa-solid fa-download" aria-hidden="true" />HTMLをダウンロード
                        </button>
                    )}
                    <a className="srv_btn" href="/dashboard/home">
                        <i className="fa-solid fa-house" aria-hidden="true" />Dashboard へ
                    </a>
                </span>
            </div>

            {error !== '' && <div className="srv_msg is_error" role="alert">{error}</div>}
            {error === '' && report === null && <div className="srv_msg">読み込み中…</div>}
            {/* ⚠️ sandbox は allow-scripts だけ（上の注記） */}
            {report && <iframe className="srv_frame" title={report.title} sandbox="allow-scripts" srcDoc={report.html} />}
        </div>
    );
};

export default SharedReportView;
