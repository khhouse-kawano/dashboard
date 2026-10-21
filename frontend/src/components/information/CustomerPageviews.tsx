import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 顧客情報の「HP閲覧履歴」（v2.2.204 新規）。注文営業の顧客情報（InformationEdit.tsx）の商談ステップの上の行。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ② の customer_pageviews（features/tracking/customerPageviews.ts）。顧客の id だけを送り、
 *   ② が顧客の landing_params の khg_vid で tracking_pageviews を探す。
 * ⚠️ 訪問（visit_id。30分あくと別の訪問）ごとにまとめ、新しい訪問が上・訪問の中は見た順。
 * ⚠️ 開閉は親（InformationEdit.tsx の expand.history）。閉じていても上の数行は見えるので、開く前から読み込む。
 * ─────────────────────────────────────────────
 */

interface Pageview {
    id: number;
    visitId: string;
    url: string;
    title: string;
    createdAt: string;
    site: string;
}

interface Visit {
    visitId: string;
    site: string;
    pages: Pageview[];
}

interface Props {
    /** 顧客の id。⚠️ 新規の顧客は空 */
    customerId: string;
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** 2026-10-21 10:40:49 → 10/21(火) 10:40 */
const dayTime = (text: string): string => {
    const d = new Date(text.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return text;
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const timeOf = (text: string): string => text.slice(11, 16);

/** https://kh-house.jp/event/a/ → /event/a/ */
const pathOf = (url: string): string => {
    try { return decodeURI(new URL(url).pathname); } catch { return url; }
};

const CustomerPageviews = ({ customerId }: Props) => {
    const [state, setState] = useState<'loading' | 'error' | 'unlinked' | 'ok'>('loading');
    const [pageviews, setPageviews] = useState<Pageview[]>([]);
    const [limit, setLimit] = useState(0);

    useEffect(() => {
        if (!customerId) { setState('unlinked'); setPageviews([]); return; }
        let alive = true;
        setState('loading');
        apiClient.post('', { request: 'customer_pageviews', id: customerId })
            .then((res) => {
                if (!alive) return;
                setPageviews(res.data.pageviews ?? []);
                setLimit(res.data.limit ?? 0);
                setState(res.data.linked ? 'ok' : 'unlinked');
            })
            .catch((e) => {
                console.error('HP閲覧履歴の取得に失敗しました', e);
                if (alive) setState('error');
            });
        return () => { alive = false; };
    }, [customerId]);

    /** 新しい訪問が上。⚠️ ② は新しい順で返すので、同じ訪問の行は続いて並ぶ */
    const visits = useMemo(() => {
        const list: Visit[] = [];
        for (const p of pageviews) {
            const last = list[list.length - 1];
            if (last && last.visitId === p.visitId) last.pages.unshift(p);
            else list.push({ visitId: p.visitId, site: p.site, pages: [p] });
        }
        return list;
    }, [pageviews]);

    const style = (
        <style>{`
            .cpv_wrap { font-size: 12px; letter-spacing: .4px; color: #303030; }
            .cpv_summary { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; margin-bottom: 10px; }
            .cpv_summary b { font-size: 15px; font-variant-numeric: tabular-nums; margin-right: 2px; }
            .cpv_muted { color: #8a8f98; font-size: 11px; }
            .cpv_visit { border-left: 3px solid #d2d6da; padding: 2px 0 2px 12px; margin-bottom: 12px; }
            .cpv_visit_head { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-weight: 600; margin-bottom: 4px; }
            .cpv_page { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; padding: 3px 0; }
            .cpv_time { color: #8a8f98; font-variant-numeric: tabular-nums; }
            .cpv_title { color: #0d6efd; text-decoration: none; overflow-wrap: anywhere; }
            .cpv_title:hover { text-decoration: underline; }
            .cpv_path { display: block; color: #8a8f98; font-size: 11px; overflow-wrap: anywhere; }
        `}</style>
    );

    if (state !== 'ok' || pageviews.length === 0) {
        const message = {
            loading: '読み込み中…',
            error: '閲覧履歴を読み込めませんでした。時間をおいて開き直してください。',
            unlinked: 'この顧客の流入情報には顧客ID が無いため、サイトの閲覧と結びつけられません（タグを入れる前の反響など）。',
            ok: '閲覧の記録はまだありません。',
        }[state];
        return <div className="cpv_wrap">{style}<span className="cpv_muted">{message}</span></div>;
    }

    return (
        <div className="cpv_wrap">
            {style}
            <div className="cpv_summary">
                <span><b>{visits.length}</b>回の訪問</span>
                <span><b>{pageviews.length}</b>ページ</span>
                <span className="cpv_muted">最終 {dayTime(pageviews[0].createdAt)}</span>
                {pageviews.length >= limit && <span className="cpv_muted">※新しい {limit} ページまで</span>}
            </div>
            {visits.map((v) => (
                <div className="cpv_visit" key={v.visitId}>
                    <div className="cpv_visit_head">
                        <span>{dayTime(v.pages[0].createdAt)}</span>
                        <span className="cpv_muted">{v.pages.length}ページ{v.site && ` · ${v.site}`}</span>
                    </div>
                    {v.pages.map((p) => (
                        <div className="cpv_page" key={p.id}>
                            <span className="cpv_time">{timeOf(p.createdAt)}</span>
                            <span>
                                <a className="cpv_title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title || pathOf(p.url)}</a>
                                <span className="cpv_path">{pathOf(p.url)}</span>
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default CustomerPageviews;
