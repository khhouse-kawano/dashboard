import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { getPeriod } from '../../utils/getPeriod';
import { thisYear } from '../../utils/thisYear';
import Ranking from './Ranking';

/**
 * ヘッダーの「活動サマリー → 契約率ランキング」から開く（v2.2.169 新規）。
 *
 * ─────────────────────────────────────────────
 *   Ranking.tsx は自分でデータを取らない（Company.tsx から受け取る作り）。
 *   ⚠️ ヘッダーには Company の画面が無いので、⚠️ **ここで同じデータを取って渡す。**
 *
 *   ⚠️⚠️ **Company.tsx と同じ材料・同じ絞り方にすること**（⚠️ 2つの入口で数字が食い違わないように）。
 *     ・API … `request: 'company'`（⚠️ Company.tsx と同じ）
 *     ・customerList … contract + contract_kaeru + contract_resale
 *     ・monthArray … getPeriod(thisYear - 1, 6)（⚠️ 今期の12か月）
 *     ・staffList … staff のうち period が今年度（thisYear）の行
 *     ・achievement … そのまま
 * ─────────────────────────────────────────────
 *
 * ⚠️ 開いたときだけ取る（⚠️ ヘッダーは全画面に出ているので、開かない人の分まで取らない）。
 *   ⚠️ 一度取ったら閉じても持っておく（⚠️ 開き直すたびに取らない）。
 */

type RankingProps = React.ComponentProps<typeof Ranking>;

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

const RankingLoader = ({ show, setShow }: Props) => {
    const [customerList, setCustomerList] = useState<RankingProps['customerList']>([]);
    const [staffList, setStaffList] = useState<RankingProps['staffList']>([]);
    const [achievement, setAchievement] = useState<RankingProps['achievement']>([]);
    const [loaded, setLoaded] = useState(false);

    // ⚠️ Company.tsx の monthArray と同じ（targetYear = thisYear のとき）
    const monthArray = useMemo(() => getPeriod(Number(thisYear) - 1, 6), []);

    useEffect(() => {
        if (!show || loaded) return;
        let alive = true;
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'company' });
                if (!alive) return;
                const data = response.data ?? {};
                setCustomerList([...(data.contract ?? []), ...(data.contract_kaeru ?? []), ...(data.contract_resale ?? [])]);
                setStaffList((data.staff ?? []).filter((s: { period: string }) => s.period === String(thisYear)));
                setAchievement(data.achievement ?? []);
                setLoaded(true);
            } catch (error) {
                // ⚠️ 黙らない。⚠️ 取れないと表が「該当するデータがありません」のままになる
                console.error('ランキングのデータ取得に失敗しました:', error);
            }
        })();
        return () => { alive = false; };
    }, [show, loaded]);

    return (
        <Ranking
            showRanking={show}
            setShowRanking={setShow}
            customerList={customerList}
            monthArray={monthArray}
            staffList={staffList}
            achievement={achievement}
        />
    );
};

export default RankingLoader;
