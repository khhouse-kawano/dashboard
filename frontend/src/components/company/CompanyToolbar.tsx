import React, { memo } from 'react';
import { getYears } from '../../utils/getYears';
import { REALTY_NAME } from './companyAggregate';
import type { Section, Shop } from './companyTypes';

/**
 * 全社報告用フォーマットの上のバー（v2.2.264 で Company.tsx から分けた）。見た目は反響一覧（list）のバーに寄せている。
 *
 * ⚠️ 以前は `position: fixed` で、高さを測って表をずらしていた。いまは表だけが動く並びなので、測らない。
 * ⚠️ 「事業部・課・店舗を選択」は、その行まで表を動かすだけ（絞り込みではない）。
 */

type Props = {
    category: string;
    targetYear: number | null;
    divisionArray: string[];
    sectionList: Section[];
    /** 選べる店舗（まとめ表示で隠れている子店舗は入れない） */
    shops: Shop[];
    showLastYear: boolean;
    showCancel: boolean;
    showMulti: boolean;
    /** 併売店の親子が1つでも設定されているか（無ければ「併売店をまとめる」を出さない） */
    canMerge: boolean;
    onYear: (year: number) => void;
    onJump: (id: string) => void;
    onRanking: () => void;
    onQuarter: () => void;
    onLastYear: () => void;
    onCancel: () => void;
    onMulti: () => void;
};

const CompanyToolbar = ({ category, targetYear, divisionArray, sectionList, shops, showLastYear, showCancel, showMulti, canMerge, onYear, onJump, onRanking, onQuarter, onLastYear, onCancel, onMulti }: Props) => {
    const hasSummary = category === 'order' || category === 'spec';
    const btnClass = `co_btn${category === 'spec' ? ' spec' : ''}`;
    return (
        <div className="co_toolbar">
            <div className="m-1">
                <select className="target" aria-label="期" onChange={(e) => onYear(Number(e.target.value))} value={String(targetYear)}>
                    {getYears().map(year => <option key={year} value={year}>{year}年5月期</option>)}
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="事業部へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">事業部を選択</option>
                    {divisionArray.map(division => <option key={division} value={division}>{division}</option>)}
                    <option value={`${REALTY_NAME}（事業部）`}>{REALTY_NAME}</option>
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="課へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">課を選択</option>
                    {sectionList.map(section => <option key={section.name} value={section.name}>{section.name}</option>)}
                </select>
            </div>
            <div className="m-1">
                <select className="target" aria-label="店舗へ移る" onChange={(e) => onJump(e.target.value)}>
                    <option value="">店舗を選択</option>
                    {shops.map((shop, index) =>
                        <option key={index} value={shop.shop}>{shop.brand === 'KHF' && `${shop.division}_`}{shop.shop}</option>)}
                </select>
            </div>
            {hasSummary && <button type="button" className={btnClass} onClick={onRanking}>契約棟数ランキング</button>}
            {hasSummary && <button type="button" className={btnClass} onClick={onQuarter}>4半期サマリー</button>}
            <label className="co_check"><input type="checkbox" checked={showLastYear} onChange={onLastYear} />昨年実績を表示</label>
            <label className="co_check"><input type="checkbox" checked={showCancel} onChange={onCancel} />キャンセル数を表示</label>
            {canMerge && <label className="co_check"><input type="checkbox" checked={showMulti} onChange={onMulti} />併売店をまとめる</label>}
            <span className="co_note">注文・建売は棟数（緑の括弧は仲介）／中古リノベ・不動産企画係は万円</span>
        </div>
    );
};

export default memo(CompanyToolbar);
