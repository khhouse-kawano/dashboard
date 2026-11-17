import React from 'react';

/**
 * 推移の画面（店舗別反響推移。v2.2.278 で販促媒体別反響推移も）で、選んだ期間・チェックのデータが揃うまで表の代わりに出す（v2.2.277）。
 * ⚠️ 揃う前の表は別の期間の数字になるので出さない（utils/useTrendData.ts の isReady）。
 */
const TrendLoadingNotice = ({ failed }: { failed: boolean }) => (
    <div className='p-3 text-center' style={{ fontSize: '13px', color: failed ? '#b91c1c' : '#64748b' }}>
        {failed ? '読み込めませんでした。時間をおいて、画面を開き直してください。' : '読み込み中…'}
    </div>
);

export default TrendLoadingNotice;
