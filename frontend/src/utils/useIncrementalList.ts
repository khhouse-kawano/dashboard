import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/**
 * 長い一覧を少しずつ描く（v2.2.269 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 何千行を一度に描くと、ブラウザが固まる・落ちる（セキュリティログは最大2,000行を一度に描いていた）。
 *   ⚠️ はじめは step 行だけ描き、表の下（sentinelRef を付けた要素）が見えたら次の step 行を足す。
 * ⚠️ 並べ替え・絞り込みで list が変わったら、先頭の step 行に戻す。
 * ⚠️ スクロールするのが表の枠（overflow: auto の要素）なら、その要素を rootRef で渡すこと。
 *   ⚠️ 渡さないとブラウザの画面全体のスクロールで判定するため、枠の中をスクロールしても続きが出ない。
 * ⚠️ 見えたことに気づけない環境（古いブラウザ）のために、more() を「続きを表示」ボタンに付けておく。
 *
 * @example
 *   const wrapRef = useRef<HTMLDivElement>(null);
 *   const { visible, hasMore, more, sentinelRef, total } = useIncrementalList(rows, 100, wrapRef);
 *   <div ref={wrapRef} style={{ overflow: 'auto' }}>
 *     <table><tbody>{visible.map(...)}{hasMore && <tr ref={sentinelRef}>…</tr>}</tbody></table>
 *   </div>
 * ─────────────────────────────────────────────
 */
export const useIncrementalList = <T,>(
    list: T[],
    step = 100,
    rootRef?: RefObject<HTMLElement | null>,
) => {
    const [count, setCount] = useState(step);
    const [sentinel, setSentinel] = useState<Element | null>(null);
    const sentinelRef = useCallback((el: Element | null) => setSentinel(el), []);
    const listRef = useRef(list);

    // 一覧が変わったら（並べ替え・絞り込み・読み直し）先頭に戻す
    // ⚠️ 表の枠も上端に戻す。下のままだと、戻した直後に表の下が見えていて、すぐ次の step 行が足される
    useEffect(() => {
        if (listRef.current !== list) {
            listRef.current = list;
            setCount(step);
            if (rootRef?.current) rootRef.current.scrollTop = 0;
        }
    }, [list, step, rootRef]);

    const more = useCallback(() => setCount((c) => Math.min(c + step, list.length)), [step, list.length]);
    const hasMore = count < list.length;

    useEffect(() => {
        if (!hasMore || sentinel === null || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries.some((e) => e.isIntersecting)) more(); },
            // ⚠️ 下端の少し手前（300px）で足しておくと、スクロールが途切れない
            { root: rootRef?.current ?? null, rootMargin: '0px 0px 300px 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, sentinel, more, rootRef]);

    return { visible: list.slice(0, count), hasMore, more, sentinelRef, total: list.length, shown: Math.min(count, list.length) };
};
