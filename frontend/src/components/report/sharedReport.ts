import apiClient from '../../utils/apiClient';

/**
 * レポートの共有（v2.2.268）の共通部品。
 *   ClaudeAnalysis.tsx の「共有」ボタン、header/system/SharedReports.tsx（登録・一覧）、SharedReportView.tsx（共有URLの画面）が使う。
 *
 * ⚠️ 共有URL は `/dashboard/report?k=<22文字>`。⚠️ `/report/<キー>` の2段にすると再読み込みで真っ白になる（Guide.tsx の注記）。
 * ⚠️ 見るには Dashboard へのログインが必要（AuthProvider が未ログインならログイン画面へ移し、ログイン後にこの URL へ戻す）。
 */

export interface SharedReportItem {
    id: number;
    key: string;
    title: string;
    source: string;
    sourceId: number | null;
    htmlBytes: number;
    staffId: number;
    staffName: string;
    createdAt: string;
    revokedAt: string | null;
    viewCount: number;
    lastViewedAt: string | null;
}

/** ② の上限（features/sharedReport.ts の MAX_HTML_BYTES）と同じ値 */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** 共有URL（いま開いている Dashboard と同じ場所） */
export const sharedReportUrl = (key: string): string =>
    `${window.location.origin}/dashboard/report?k=${encodeURIComponent(key)}`;

export const errorMessageOf = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** 共有URLを作る（同じ分析をすでに共有していれば、そのURLが返る） */
export const createSharedReport = async (
    body: { source: 'ai_analysis'; id: number } | { source: 'upload'; title: string; html: string }
): Promise<{ item: SharedReportItem; reused: boolean }> => {
    const res = await apiClient.post('', { request: 'shared_report_create', ...body });
    if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '共有を作れませんでした。');
    return { item: res.data.item as SharedReportItem, reused: Boolean(res.data.reused) };
};

/**
 * クリップボードへ写す。⚠️ 写せない環境（http・権限なし）もあるので、結果を返して画面で URL を見せる。
 */
export const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
