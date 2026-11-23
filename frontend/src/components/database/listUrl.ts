import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * v2.2.291 GET で ② に送る条件を、画面の URL にも出す・URL の条件で開く（顧客DB の建売・注文）。
 *
 * ⚠️ URL のキーは ② に送るキー（database_list の引数）と同じ。ページは page、表示件数は perPage。
 * ⚠️ 出さないもの：request・category・master（画面が決める）と、トークン（URL に出すと履歴・共有で漏れる）。
 * ⚠️ 既定値（trash=1・page=1・perPage=20）と空の条件は出さない。
 * ⚠️ ?id=（顧客の編集を開く。紹介・アンバサダーの反響一覧からのリンク）はそのまま残す。
 */
export const LIST_PER_PAGES = [20, 50, 100, 500];
const DEFAULT_PER_PAGE = LIST_PER_PAGES[0];

/** 開いたときの URL から条件を読む（⚠️ 最初の1回だけ使う。state の初期値にする） */
export const readListUrl = (sp: URLSearchParams) => {
    const perPage = Number(sp.get('perPage'));
    return {
        get: (key: string): string => sp.get(key) ?? '',
        page: Math.max(1, Math.floor(Number(sp.get('page')) || 1)),
        perPage: LIST_PER_PAGES.includes(perPage) ? perPage : DEFAULT_PER_PAGE,
        trash: sp.get('trash') === '0' ? 0 : 1,
    };
};

/** 今の条件・ページ・表示件数を URL に書く（⚠️ 履歴は増やさない。replace） */
export const useListUrlSync = (listParams: Record<string, string>, page: number, perPage: number) => {
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const next = new URLSearchParams();
        Object.entries(listParams).forEach(([k, v]) => { if (!(k === 'trash' && v === '1')) next.set(k, v); });
        if (page > 1) next.set('page', String(page));
        if (perPage !== DEFAULT_PER_PAGE) next.set('perPage', String(perPage));
        const id = searchParams.get('id');
        if (id) next.set('id', id);
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [listParams, page, perPage, searchParams, setSearchParams]);
};

/**
 * 条件・表示件数（・予備のときの全件）が変わったときだけ onChange を呼ぶ（ページを1に戻すため）。
 * ⚠️ 開いたとき（URL の page で開いたとき）には呼ばない。⚠️ StrictMode で effect が2回走っても呼ばない。
 */
export const useOnListChange = (listKey: string, others: unknown[], onChange: () => void) => {
    const prev = useRef({ key: listKey, others });
    useEffect(() => {
        const p = prev.current;
        if (p.key === listKey && p.others.length === others.length && p.others.every((o, i) => o === others[i])) return;
        prev.current = { key: listKey, others };
        onChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listKey, ...others]);
};
