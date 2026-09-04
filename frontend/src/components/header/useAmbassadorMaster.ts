import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 反響画面の店舗・担当営業マスタ。
 *
 * ⚠️ **3画面で共用している。** 条件を変えると全部に効く。
 *     AmbassadorList.tsx      公式アンバサダー台帳
 *     InquiryAmbassador.tsx   アンバサダー反響一覧
 *     InquiryIntroductory.tsx 紹介キャンペーン反響一覧
 *   片方だけ別のマスタに戻すと、同じ「担当店舗」なのに画面によって
 *   選べる店舗が違う、という状態になる。
 *
 * ⚠️ 店舗の条件は `show_flag = 1`（2026-09-06 に report_flag = 1 から変更）。
 *   担当を割り振る操作なので「今運用している店舗」が適切という判断。
 *   条件は backend-express/src/features/ambassador/master.ts にある。
 *
 * ⚠️ request 名は `ambassador_master` のままだが、アンバサダー専用ではない。
 *   先にアンバサダーで作ったという経緯によるもの。
 */

export type MasterShop = {
    brand: string | null;
    shop: string | null;
    section: string | null;
    area: string | null;
    /** 事業区分。⚠️ '注文事業' / '建売分譲事業' / '中古リノベ' 等。表示名とは違う */
    division: string | null;
};

export type MasterStaff = {
    name: string;
    shop: string;
    section: string;
    position: string;
    /** 年度。'2026' のような文字列 */
    period: string;
    status: string;
};

/**
 * 当年度。
 *
 * ⚠️ 年度の切り替わりは考慮していない（暦年で判定する）。
 *   staff_list.period が暦年で運用されているため、これに合わせている。
 *   4月始まりに変えるなら staff_list 側の運用とセットで直すこと。
 */
const thisYear = (): string => String(new Date().getFullYear());

export const useAmbassadorMaster = () => {
    const [shopList, setShopList] = useState<MasterShop[]>([]);
    const [staffList, setStaffList] = useState<MasterStaff[]>([]);
    /** ⚠️ マスタが取れなくても本体の閲覧は続けられるようにする。画面は止めない */
    const [masterError, setMasterError] = useState('');

    useEffect(() => {
        const fetchMaster = async () => {
            try {
                const res = await apiClient.post('', { request: 'ambassador_master' });
                if (res.data?.status !== 'ok') {
                    setMasterError(res.data?.message ?? '店舗・担当営業のマスタを取得できませんでした。');
                    return;
                }
                setShopList(res.data.shop ?? []);
                setStaffList(res.data.staff ?? []);
            } catch {
                // ⚠️ 黙らせない。選択肢が空なのか通信が失敗したのか区別できないと、
                //   「担当が選べない」という問い合わせの原因が特定できない
                setMasterError('店舗・担当営業のマスタを取得できませんでした。分析サーバーが停止している可能性があります。');
            }
        };
        void fetchMaster();
    }, []);

    /** 重複を除いて店舗名を並べる。⚠️ 並び順はサーバー側（brand_sort）のまま保つ */
    const toShopNames = (rows: MasterShop[]): string[] => {
        const seen = new Set<string>();
        const out: string[] = [];
        rows.forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            out.push(name);
        });
        return out;
    };

    /** 全店舗。事業区分を持たない画面（台帳）で使う */
    const shopOptions = useMemo(() => toShopNames(shopList), [shopList]);

    /**
     * 指定した事業区分の店舗。
     *
     * ⚠️ 引数は `shop_list.division` の値（'注文事業' 等）。表示名（'注文'）ではない。
     *   変換は divisions.ts の SHOP_DIVISION を使うこと。
     *
     * ⚠️ 区分で絞らないと、建売の反響に注文事業の店舗を割り当てられてしまう。
     *   同期先のテーブルが違うため、担当者の画面に出てこない顧客ができる。
     *
     * ⚠️ 一致する店舗が無い場合は空を返す（全店舗にフォールバックしない）。
     *   フォールバックすると、間違った選択肢が正しい顔をして出てしまう。
     */
    const shopOptionsForDivision = useCallback((shopDivision: string): string[] => {
        const target = shopDivision.trim();
        if (target === '') return [];
        return toShopNames(shopList.filter(s => (s.division ?? '').trim() === target));
    }, [shopList]);

    /** 当年度の営業職だけに絞ったもの */
    const currentStaff = useMemo(() => {
        const year = thisYear();
        // ⚠️ period は文字列型の列だが、数値で入っている可能性もある。
        //   String() で両側をそろえてから比較する
        return staffList.filter(s => String(s.period) === year);
    }, [staffList]);

    /**
     * 指定した店舗の担当営業。
     *
     * ⚠️ 店舗が未選択のときは**空を返す。** 全員を出すと、
     *   別店舗の担当者を割り当てられてしまう。
     *
     * ⚠️ 現在保存されている担当者が候補に無いことがある（異動・退職・年度替わり）。
     *   呼び出し側で、保存済みの値を選択肢に補って表示すること。
     *   補わないと select の値が空になり、次に触った瞬間に担当が消える。
     */
    const staffOptionsFor = useCallback((shop: string | null): string[] => {
        const target = (shop ?? '').trim();
        if (target === '') return [];

        const seen = new Set<string>();
        const out: string[] = [];
        currentStaff.forEach(s => {
            if (s.shop !== target) return;
            const name = (s.name ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            out.push(name);
        });
        return out;
    }, [currentStaff]);

    return {
        shopOptions,
        shopOptionsForDivision,
        staffOptionsFor,
        masterError,
        thisYear: thisYear(),
    };
};
