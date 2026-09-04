import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * アンバサダー画面の店舗・担当営業マスタ。台帳と反響一覧の両方で使う。
 *
 * ⚠️ **既存の shop_list / callStatusList を使ってはいけない。**
 *   shop_list は `show_flag = 1`（画面に出す店舗）で、ここで欲しいのは
 *   `report_flag = 1`（報告対象の店舗）。この2つは一致せず、
 *   実データには report_flag = 1 なのに show_flag = 0 の店舗が存在する。
 *   流用するとその店舗が選択肢から黙って消える。
 *
 * ⚠️ 2画面で同じ選択肢を出すために共通化している。
 *   片方だけ別のマスタに戻すと、同じ「担当店舗」なのに画面によって
 *   選べる店舗が違う、という状態になる。
 */

export type MasterShop = {
    brand: string | null;
    shop: string | null;
    section: string | null;
    area: string | null;
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

    /** 選択肢に出す店舗名。⚠️ 並び順はサーバー側（brand_sort）のまま保つ */
    const shopOptions = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        shopList.forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            out.push(name);
        });
        return out;
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

    return { shopOptions, staffOptionsFor, masterError, thisYear: thisYear() };
};
